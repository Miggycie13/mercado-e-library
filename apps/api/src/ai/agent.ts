import crypto from "crypto";
import { searchTokens } from "../services/catalog";
import { executeTool, toolDefinitions, type ToolTrace } from "./tools";

type ChatTurn = { role: "user" | "assistant"; content: string };

type MemoryBook = {
  id: string;
  title: string;
  author: string;
  year?: number;
  category?: string;
  description?: string;
};

type PendingAction = {
  confirmationId: string;
  bookId: string;
  title: string;
  author: string;
  userId: string;
  expires: number;
};

type AgentResult = {
  reply: string;
  toolTrace: ToolTrace[];
  pendingAction: null | {
    confirmationId: string;
    bookId: string;
    title: string;
    author: string;
  };
  mode: "openai" | "local";
};

const memory = new Map<string, { books: MemoryBook[]; updatedAt: number }>();
const pending = new Map<string, PendingAction>();

const SYSTEM = `You are the librarian embedded inside The Emerald Archive. You may only state catalog facts that come back from tools. Decide the situation from the latest reader message and from books already shown in this session.
Situations:
- Greeting or "what can you do?": say you can find a book, name its author, year, and category, list books by an author or in a category, compare two titles, explain the download limit, and ask before saving a book.
- Who wrote a title, what year it was published, what category it is in, and a short description. Call search_books, then get_book_details on a returned id before you state a title, author, year, category, or description.
- Books by a named author: pass the author to search_books and name up to three, each with year and category, after get_book_details.
- Books in Adventure, Children's, Drama, Essays, Fiction, History, Mystery, Philosophy, or Poetry: pass that category to search_books and name up to three, after get_book_details.
- A recommendation, including "something like" a title already found: search, then recommend up to three real matches. Say why each one fits using only its category, year, or description.
- A comparison of two titles: search both, then get_book_details, then compare.
- A follow-up that says "it", "that one", "the first", "the second", or "tell me more": use the book already loaded in the session. Do not search those words as a new title.
- Add or save to My Library or favorites: call add_to_my_library only as a confirmation request. Do not claim it was saved. If the reader is not signed in, tell them to sign in and do not start a confirmation.
- Download limit, only when asked: a guest may download 5 distinct books, a signed-in reader may download 10, and downloading the same book again does not use another slot.
- How many books are in the catalog: use the total returned by search_books.
- One message with more than one question: answer each part. Do not split a comparison or a save request.
- No catalog match: say nothing matched. Never invent a title, author, year, or description.
- A question that is not about the catalog, an account, or downloads: say you can help with the library, then offer to find a book. Do not answer the off-topic question.
- A title that matches several different books: name up to three and ask which one the reader means.
Keep answers short and specific to the tool results.`;

function remember(sessionId: string, books: MemoryBook[]) {
  memory.set(sessionId, { books, updatedAt: Date.now() });
}

function recall(sessionId: string) {
  return memory.get(sessionId)?.books || [];
}

function rememberFromSearch(sessionId: string, result: unknown) {
  const books = (result as { books?: MemoryBook[] })?.books || [];
  if (books.length) remember(sessionId, books);
  return books;
}

async function traced(
  trace: ToolTrace[],
  sessionId: string,
  name: string,
  args: Record<string, unknown>,
  userId?: string
) {
  let result: unknown;
  try {
    result = await executeTool(name, args, userId);
  } catch (error) {
    result = { error: error instanceof Error ? error.message : "Tool failed" };
  }
  trace.push({ name, arguments: args, result });
  if (name === "search_books") rememberFromSearch(sessionId, result);
  return result;
}

function wantsSave(text: string) {
  return (
    (/\b(add|save|put|keep)\b/.test(text) && /\b(library|shelf|favorites?|favourites?)\b/.test(text)) ||
    /\b(add|save) (it|this|that|the first|the second|the third|the top)\b/.test(text)
  );
}

function ordinal(text: string) {
  if (/\b(second|2nd|two)\b/.test(text)) return 1;
  if (/\b(third|3rd|three)\b/.test(text)) return 2;
  if (/\b(first|1st|top|it|this|that)\b/.test(text)) return 0;
  return -1;
}

async function resolveBook(text: string, sessionId: string, userId: string | undefined, trace: ToolTrace[]) {
  const known = recall(sessionId);
  const index = ordinal(text);
  if (index >= 0 && known[index]) {
    const chosen = known[index];
    await traced(trace, sessionId, "search_books", { query: chosen.title, author: chosen.author }, userId);
    await traced(trace, sessionId, "get_book_details", { book_id: chosen.id }, userId);
    return chosen;
  }
  const result = (await traced(trace, sessionId, "search_books", { query: text }, userId)) as {
    books: MemoryBook[];
  };
  const top = result.books[0];
  if (!top) return null;
  await traced(trace, sessionId, "get_book_details", { book_id: top.id }, userId);
  return top;
}

function queueConfirmation(userId: string, book: MemoryBook): AgentResult["pendingAction"] {
  const confirmationId = crypto.randomUUID();
  pending.set(confirmationId, {
    confirmationId,
    bookId: book.id,
    title: book.title,
    author: book.author,
    userId,
    expires: Date.now() + 10 * 60 * 1000,
  });
  return { confirmationId, bookId: book.id, title: book.title, author: book.author };
}

function compareSides(text: string) {
  const match = text.split(/\b(?:versus|vs\.?|and)\b/i).map((part) => part.trim()).filter(Boolean);
  if (match.length < 2) return null;
  return [match[0], match[1]];
}

const CATEGORY_PATTERNS: Array<[string, RegExp]> = [
  ["Adventure", /\badventure\b/],
  ["Children's", /\bchildren(?:['’]s|s)?\b/],
  ["Drama", /\bdrama\b/],
  ["Essays", /\bessays?\b/],
  ["Fiction", /\bfiction\b/],
  ["History", /\bhistory\b/],
  ["Mystery", /\bmyster(?:y|ies)\b/],
  ["Philosophy", /\bphilosoph(?:y|ical)\b/],
  ["Poetry", /\b(?:poetry|poems?)\b/],
];

function categoryFrom(text: string) {
  return CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleQuery(raw: string) {
  return raw
    .replace(/[?]/g, " ")
    .replace(/\b(who wrote|who is the author of|who is the author|author of|what year was|what year is|when was|when did|what category is|which category is|what category|was it published|it published|published|tell me more about|tell me about|describe|what is|what's|please|can you|could you)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function questionParts(message: string) {
  if (!message.includes("?")) return [message];
  const parts = message.split("?").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [message];
}

function isGreeting(text: string) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text.trim()) || /\b(what can you do|how can you help|what do you do)\b/.test(text);
}

function isDownloadQuestion(text: string) {
  return (/\bhow many\b/.test(text) && /\bdownloads?\b/.test(text)) || /\bhow many books can\b/.test(text);
}

function isCatalogCount(text: string) {
  return /\bhow many books\b/.test(text) && /\b(catalog|library|archive|shelf|are there|do you have)\b/.test(text);
}

function isOffTopic(text: string) {
  if (/\b(book|books|catalog|library|author|wrote|download|account|sign in|signin|favorite|favourites|recommend|novel|poem|shelf)\b/.test(text)) return false;
  if (categoryFrom(text)) return false;
  return /\b(weather|temperature|forecast|news|sport|joke|recipe|capital|translate|movie|song|president|math|calculate|homework)\b/.test(text);
}

function isFollowUp(text: string) {
  if (/\b(tell me more|that one|the first|the second|the third)\b/.test(text)) {
    const stripped = text.replace(/\b(tell me more about|tell me more|that one|the first one|the second one|the third one|the first|the second|the third|about|please)\b/g, " ");
    if (!searchTokens(stripped).length) return true;
  }
  return /\b(it|that|this)\b/.test(text) && /\b(year|when|published|wrote|author|category|describe|about|more)\b/.test(text);
}

function isRecommend(text: string) {
  return /\b(recommend|suggest|something like|similar to|read next)\b/.test(text);
}

function wantsCategoryList(text: string) {
  const category = categoryFrom(text);
  if (!category) return "";
  if (/\b(who wrote|who is the author|what year|when was|published|compare)\b/.test(text)) return "";
  if (isRecommend(text)) return "";
  if (/\b(have|list|show|find|any|some|books)\b/.test(text) || /\bwhat\b/.test(text)) return category;
  return "";
}

function authorFrom(raw: string) {
  const match = raw.match(/\b(?:books?\s+(?:are\s+)?by|written by|works by)\s+([a-z][a-z.'’\-]+(?:\s+[a-z][a-z.'’\-]+){0,4})/i);
  if (!match) return "";
  return match[1].replace(/\b(in|from|the|catalog|library|please)\b.*$/i, "").replace(/[?.!,]+$/g, "").trim();
}

function firstSentence(description?: string) {
  if (!description) return "";
  const sentence = description.split(/(?<=\.)\s/)[0];
  return sentence || description;
}

function localResult(reply: string, trace: ToolTrace[], pendingAction: AgentResult["pendingAction"] = null): AgentResult {
  return { reply, toolTrace: trace, pendingAction, mode: "local" };
}

function libraryHelp() {
  return "I can help with the library. I can find a book, name its author, year, and category, list books by an author or in a category, compare two titles, and ask before saving one. Which book should I look up?";
}

function capabilityReply() {
  return "I can find a book, name its author, year, and category, list books by an author or in a category, compare two titles, explain the download limit, and ask before saving a book.";
}

function downloadReply() {
  return "A guest may download 5 distinct books. A signed-in reader may download 10. Downloading the same book again does not use another slot.";
}

function nothingMatched() {
  return "Nothing in the live catalog matched those words.";
}

function focusBook(sessionId: string, book: MemoryBook) {
  const rest = recall(sessionId).filter((item) => item.id !== book.id);
  remember(sessionId, [book, ...rest].slice(0, 5));
}

function mergeDetail(sessionId: string, detail: MemoryBook) {
  const books = recall(sessionId).map((book) => (book.id === detail.id ? { ...book, ...detail } : book));
  if (!books.some((book) => book.id === detail.id)) books.unshift(detail);
  remember(sessionId, books);
}

async function searchCatalog(
  trace: ToolTrace[],
  sessionId: string,
  args: Record<string, unknown>,
  userId?: string
) {
  const found = (await traced(trace, sessionId, "search_books", args, userId)) as {
    total?: number;
    books?: MemoryBook[];
  };
  return { total: found.total || 0, books: found.books || [] };
}

async function loadDetail(trace: ToolTrace[], sessionId: string, bookId: string, userId?: string) {
  const detail = (await traced(trace, sessionId, "get_book_details", { book_id: bookId }, userId)) as MemoryBook & {
    error?: string;
  };
  if (!detail?.id || !detail.title) return null;
  mergeDetail(sessionId, detail);
  return detail;
}

async function loadListed(trace: ToolTrace[], sessionId: string, books: MemoryBook[], userId?: string) {
  const details: MemoryBook[] = [];
  for (const book of books.slice(0, 3)) {
    const detail = await loadDetail(trace, sessionId, book.id, userId);
    if (detail?.title) details.push(detail);
  }
  return details;
}

function describeBook(book: MemoryBook, text: string) {
  if (/\b(who wrote|who is the author|author)\b/.test(text)) {
    return `${book.title} was written by ${book.author}.`;
  }
  if (/\b(year|when|published)\b/.test(text)) {
    return `${book.title} was published in ${book.year}.`;
  }
  if (/\bcategory\b/.test(text)) {
    return `${book.title} is in ${book.category}.`;
  }
  return `${book.title} by ${book.author} (${book.year}, ${book.category}). ${firstSentence(book.description)}`;
}

function listReply(label: string, books: MemoryBook[]) {
  const lines = books.map((book) => `${book.title} by ${book.author} (${book.year}, ${book.category})`);
  return `${label}: ${lines.join("; ")}.`;
}

function chooseBook(query: string, books: MemoryBook[]) {
  const norm = normalizeTitle(query);
  const tokens = searchTokens(query);
  const exact = books.filter((book) => normalizeTitle(book.title) === norm);
  if (exact.length === 1) return { chosen: exact[0], options: [] as MemoryBook[] };
  if (exact.length > 1) return { chosen: null, options: exact.slice(0, 3) };
  const titled = books.filter((book) => {
    const title = normalizeTitle(book.title);
    return tokens.length > 0 && tokens.every((token) => title.split(" ").includes(token) || title.includes(token));
  });
  if (titled.length === 1) return { chosen: titled[0], options: [] as MemoryBook[] };
  if (titled.length > 1) return { chosen: null, options: titled.slice(0, 3) };
  if (books.length === 1) return { chosen: books[0], options: [] as MemoryBook[] };
  return { chosen: books[0] || null, options: [] as MemoryBook[] };
}

async function answerFollowUp(text: string, sessionId: string, userId: string | undefined, trace: ToolTrace[]) {
  const known = recall(sessionId);
  if (!known.length) return "Name a title and I will look it up in the catalog.";
  const index = ordinal(text);
  const book = known[index >= 0 ? index : 0];
  if (!book) return "Name a title from the last list, or ask about the first one.";
  const loaded = await loadDetail(trace, sessionId, book.id, userId);
  if (!loaded?.title) return nothingMatched();
  focusBook(sessionId, loaded);
  return describeBook(loaded, text);
}

async function answerRecommendation(raw: string, text: string, sessionId: string, userId: string | undefined, trace: ToolTrace[]) {
  let category = categoryFrom(text);
  let excludeId = "";
  const like = raw.match(/\b(?:something like|similar to)\s+(.+)$/i);
  if (isFollowUp(text) && recall(sessionId).length) {
    const index = ordinal(text);
    const base = recall(sessionId)[index >= 0 ? index : 0];
    excludeId = base?.id || "";
    category = category || base?.category || "";
  } else if (like?.[1]) {
    const found = await searchCatalog(trace, sessionId, { query: like[1] }, userId);
    const picked = chooseBook(like[1], found.books);
    if (picked.chosen) {
      const detail = await loadDetail(trace, sessionId, picked.chosen.id, userId);
      excludeId = detail?.id || "";
      category = category || detail?.category || "";
    }
  }
  const args = category ? { category, query: raw } : { query: raw };
  const found = await searchCatalog(trace, sessionId, args, userId);
  const picks = found.books.filter((book) => book.id !== excludeId).slice(0, 3);
  const details = await loadListed(trace, sessionId, picks, userId);
  if (!details.length) return nothingMatched();
  return details
    .map((book) => `${book.title} by ${book.author} fits because it is ${book.category} from ${book.year}. ${firstSentence(book.description)}`)
    .join(" ");
}

async function answerAuthor(author: string, sessionId: string, userId: string | undefined, trace: ToolTrace[]) {
  const found = await searchCatalog(trace, sessionId, { author }, userId);
  const details = await loadListed(trace, sessionId, found.books, userId);
  if (!details.length) return nothingMatched();
  return listReply(`Books by ${details[0].author}`, details);
}

async function answerCategory(category: string, sessionId: string, userId: string | undefined, trace: ToolTrace[]) {
  const found = await searchCatalog(trace, sessionId, { category }, userId);
  const details = await loadListed(trace, sessionId, found.books, userId);
  if (!details.length) return nothingMatched();
  return listReply(category, details);
}

async function answerTitle(raw: string, text: string, sessionId: string, userId: string | undefined, trace: ToolTrace[]) {
  const query = titleQuery(raw) || raw;
  const found = await searchCatalog(trace, sessionId, { query }, userId);
  if (!found.books.length) return nothingMatched();
  const picked = chooseBook(query, found.books);
  if (!picked.chosen && picked.options.length > 1) {
    const details = await loadListed(trace, sessionId, picked.options, userId);
    if (details.length < 2) return nothingMatched();
    return `I found more than one book. Did you mean ${details.map((book) => `${book.title} by ${book.author}`).join(", ")}?`;
  }
  const chosen = picked.chosen;
  if (!chosen) return nothingMatched();
  const detail = await loadDetail(trace, sessionId, chosen.id, userId);
  if (!detail?.title) return nothingMatched();
  focusBook(sessionId, detail);
  return describeBook(detail, text);
}

async function answerSituation(raw: string, sessionId: string, userId: string | undefined, trace: ToolTrace[]) {
  const text = raw.toLowerCase();
  if (isGreeting(text)) return capabilityReply();
  if (isDownloadQuestion(text)) return downloadReply();
  if (isCatalogCount(text)) {
    const previous = recall(sessionId);
    const found = await searchCatalog(trace, sessionId, {}, userId);
    remember(sessionId, previous);
    return `The catalog has ${found.total} books.`;
  }
  if (isRecommend(text)) return answerRecommendation(raw, text, sessionId, userId, trace);
  if (isFollowUp(text)) return answerFollowUp(text, sessionId, userId, trace);
  if (isOffTopic(text)) return libraryHelp();
  const category = wantsCategoryList(text);
  if (category) return answerCategory(category, sessionId, userId, trace);
  const author = authorFrom(raw);
  if (author) return answerAuthor(author, sessionId, userId, trace);
  if (/\b(who wrote|author of|what year|when was|what category|which category|tell me about|describe|what is)\b/.test(text) || searchTokens(titleQuery(raw)).length) {
    return answerTitle(raw, text, sessionId, userId, trace);
  }
  return libraryHelp();
}

async function localAgent(sessionId: string, messages: ChatTurn[], userId?: string): Promise<AgentResult> {
  const lastUser = [...messages].reverse().find((message) => message.role === "user")?.content || "";
  const text = lastUser.toLowerCase();
  const trace: ToolTrace[] = [];

  if (wantsSave(text)) {
    const book = await resolveBook(lastUser, sessionId, userId, trace);
    if (!book) {
      return {
        reply: "I could not find that title in the live catalog, so nothing was saved.",
        toolTrace: trace,
        pendingAction: null,
        mode: "local",
      };
    }
    if (!userId) {
      return {
        reply: `${book.title} by ${book.author} is in the catalog. Sign in, then ask me again and I will request your confirmation before saving it to My Library.`,
        toolTrace: trace,
        pendingAction: null,
        mode: "local",
      };
    }
    const pendingAction = queueConfirmation(userId, book);
    return {
      reply: `I found ${book.title} by ${book.author}. I have not saved it yet. Confirm to add it to My Library and favorites.`,
      toolTrace: trace,
      pendingAction,
      mode: "local",
    };
  }

  if (/\b(compare|versus|vs\.?|difference)\b/.test(text)) {
    const sides = compareSides(lastUser);
    const picks: MemoryBook[] = [];
    if (sides) {
      for (const side of sides) {
        const found = (await traced(trace, sessionId, "search_books", { query: side }, userId)) as {
          books: MemoryBook[];
        };
        if (found.books?.[0]) {
          await traced(trace, sessionId, "get_book_details", { book_id: found.books[0].id }, userId);
          picks.push(found.books[0]);
        }
      }
    } else {
      const known = recall(sessionId);
      const pool = known.length >= 2 ? known.slice(0, 2) : [];
      if (!pool.length) {
        const found = (await traced(trace, sessionId, "search_books", { query: lastUser }, userId)) as {
          books: MemoryBook[];
        };
        pool.push(...(found.books || []).slice(0, 2));
      }
      for (const book of pool.slice(0, 2)) {
        await traced(trace, sessionId, "get_book_details", { book_id: book.id }, userId);
        picks.push(book);
      }
    }
    if (picks.length < 2) {
      return {
        reply: "I need two catalog matches before I can compare them. Name both titles.",
        toolTrace: trace,
        pendingAction: null,
        mode: "local",
      };
    }
    const [left, right] = picks;
    const leftDetail = trace.map((item) => item.result).filter((item) => (item as MemoryBook).id === left.id).pop() as MemoryBook & {
      category?: string;
      year?: number;
      description?: string;
    };
    const rightDetail = trace.map((item) => item.result).filter((item) => (item as MemoryBook).id === right.id).pop() as typeof leftDetail;
    return {
      reply: `${left.title} (${leftDetail.year}, ${leftDetail.category}) by ${left.author}: ${leftDetail.description} ${right.title} (${rightDetail.year}, ${rightDetail.category}) by ${right.author}: ${rightDetail.description}`,
      toolTrace: trace,
      pendingAction: null,
      mode: "local",
    };
  }

  const parts = questionParts(lastUser);
  if (parts.length > 1) {
    const replies: string[] = [];
    for (const part of parts) replies.push(await answerSituation(part, sessionId, userId, trace));
    return localResult(replies.join(" "), trace);
  }
  return localResult(await answerSituation(lastUser, sessionId, userId, trace), trace);
}

type OpenAIMessage = Record<string, unknown>;

async function openAIAgent(sessionId: string, messages: ChatTurn[], userId?: string): Promise<AgentResult> {
  const trace: ToolTrace[] = [];
  const history: OpenAIMessage[] = [
    { role: "system", content: SYSTEM },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
  ];
  let pendingAction: AgentResult["pendingAction"] = null;

  for (let round = 0; round < 4; round += 1) {
    const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: history,
        tools: toolDefinitions,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 240)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
    };
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("OpenAI returned an empty response.");
    history.push(message as OpenAIMessage);
    const calls = message.tool_calls || [];
    if (!calls.length) {
      return {
        reply: message.content || "I could not form a reply from the catalog.",
        toolTrace: trace,
        pendingAction,
        mode: "openai",
      };
    }

    for (const call of calls) {
      const name = call.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      if (name === "add_to_my_library") {
        const bookId = String(args.book_id || "");
        let detail: MemoryBook | null = null;
        try {
          detail = (await executeTool("get_book_details", { book_id: bookId }, userId)) as MemoryBook;
        } catch (error) {
          detail = null;
          trace.push({
            name,
            arguments: args,
            result: { error: error instanceof Error ? error.message : "Book not found" },
          });
        }
        if (detail?.id) {
          trace.push({
            name,
            arguments: args,
            result: { status: "awaiting_confirmation", bookId, title: detail.title },
          });
          if (userId) pendingAction = queueConfirmation(userId, detail);
        }
        const toolContent = !detail
          ? "That book id is not in the catalog."
          : userId
            ? "Not saved. Ask the reader to confirm before the write happens."
            : "Not saved. The reader is not signed in.";
        history.push({ role: "tool", tool_call_id: call.id, content: toolContent });
        continue;
      }
      let result: unknown;
      try {
        result = await executeTool(name, args, userId);
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "Tool failed" };
      }
      trace.push({ name, arguments: args, result });
      if (name === "search_books") rememberFromSearch(sessionId, result);
      history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 6000) });
    }
  }

  return {
    reply: pendingAction
      ? `Confirm to add ${pendingAction.title} by ${pendingAction.author} to My Library.`
      : "I gathered catalog data, but the assistant stopped before a final answer.",
    toolTrace: trace,
    pendingAction,
    mode: "openai",
  };
}

export async function runChat(input: { sessionId: string; messages: ChatTurn[]; userId?: string }) {
  const sessionId = input.sessionId || "anonymous";
  if (process.env.OPENAI_API_KEY) {
    try {
      return await openAIAgent(sessionId, input.messages, input.userId);
    } catch (error) {
      const local = await localAgent(sessionId, input.messages, input.userId);
      const reason = error instanceof Error ? error.message : "OpenAI request failed";
      return { ...local, reply: `${local.reply}\n\n(OpenAI was unavailable, so the local catalog tools answered. ${reason})` };
    }
  }
  return localAgent(sessionId, input.messages, input.userId);
}

export async function confirmAction(confirmationId: string, userId: string, accept: boolean) {
  const item = pending.get(confirmationId);
  if (!item || item.expires < Date.now()) {
    pending.delete(confirmationId);
    return { reply: "That confirmation expired. Ask me to save the book again.", toolTrace: [] as ToolTrace[], saved: false };
  }
  if (item.userId !== userId) {
    return { reply: "This confirmation belongs to a different account.", toolTrace: [] as ToolTrace[], saved: false };
  }
  pending.delete(confirmationId);
  if (!accept) {
    return { reply: `Cancelled. ${item.title} was not added.`, toolTrace: [] as ToolTrace[], saved: false };
  }
  const result = await executeTool("add_to_my_library", { book_id: item.bookId }, userId);
  return {
    reply: `${item.title} by ${item.author} is now in My Library and favorites.`,
    toolTrace: [{ name: "add_to_my_library", arguments: { book_id: item.bookId, user_id: userId }, result }],
    saved: true,
  };
}

export function aiMode() {
  return process.env.OPENAI_API_KEY ? "openai" : "local";
}

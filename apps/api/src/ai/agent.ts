import crypto from "crypto";
import { searchTokens } from "../services/catalog";
import { executeTool, toolDefinitions, type ToolTrace } from "./tools";

type ChatTurn = { role: "user" | "assistant"; content: string };

type MemoryBook = { id: string; title: string; author: string };

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

const SYSTEM = `You are the librarian embedded inside The Emerald Archive. You may only state catalog facts that come back from tools.
Rules:
- For any book question, call search_books, then call get_book_details on a returned id before you recommend or compare.
- Never invent titles, authors, or ids.
- When the reader asks to add or save a book to My Library or favorites, call add_to_my_library. Do not claim it was saved. The app asks the reader to confirm, and only a confirmed call writes to the database.
- If the reader is not signed in, tell them to sign in before saving.
- Keep answers concise and specific to the tool results.`;

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

  const found = (await traced(
    trace,
    sessionId,
    "search_books",
    { query: lastUser },
    userId
  )) as { total: number; books?: Array<MemoryBook & { year: number; category: string; description: string }> };

  if (!found.books?.length) {
    const featured = (await traced(trace, sessionId, "search_books", {}, userId)) as typeof found;
    const first = featured.books?.[0];
    if (first) await traced(trace, sessionId, "get_book_details", { book_id: first.id }, userId);
    return {
      reply: first
        ? `Nothing in the live catalog matched those words. A place to start is ${first.title} by ${first.author} (${first.year}, ${first.category}).`
        : "The catalog is empty.",
      toolTrace: trace,
      pendingAction: null,
      mode: "local",
    };
  }

  const detail = (await traced(trace, sessionId, "get_book_details", { book_id: found.books[0].id }, userId)) as {
    title?: string;
    author?: string;
    year?: number;
    category?: string;
    description?: string;
    error?: string;
  };
  if (!detail.title) {
    return {
      reply: detail.error || "The catalog search did not return a readable record.",
      toolTrace: trace,
      pendingAction: null,
      mode: "local",
    };
  }
  const also = found.books.slice(1, 3).map((book) => `${book.title} by ${book.author}`).join("; ");
  const tokens = searchTokens(lastUser);
  const lead = tokens.length
    ? `From the live catalog, the closest match is ${detail.title} by ${detail.author} (${detail.year}, ${detail.category}). ${detail.description}`
    : `Here is a catalog pick: ${detail.title} by ${detail.author} (${detail.year}, ${detail.category}). ${detail.description}`;
  return {
    reply: also ? `${lead} Also on the shelf: ${also}.` : lead,
    toolTrace: trace,
    pendingAction: null,
    mode: "local",
  };
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

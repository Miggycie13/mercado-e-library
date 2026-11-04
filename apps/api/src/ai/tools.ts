import { bookSummary, getBook, searchBooks } from "../services/catalog";
import { addToLibrary } from "../services/shelf";

export type ToolTrace = {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
};

export const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "search_books",
      description: "Search the live library catalog by natural language, author, or category. Always use this before recommending a book.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language or keyword query" },
          category: { type: "string", description: "Exact category name, if known" },
          author: { type: "string", description: "Author name fragment" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_book_details",
      description: "Load one live catalog record by id. Use an id returned by search_books.",
      parameters: {
        type: "object",
        properties: {
          book_id: { type: "string" },
        },
        required: ["book_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_to_my_library",
      description: "Ask to save a catalog book into the signed-in user's My Library and favorites. The server will not save it until the user confirms.",
      parameters: {
        type: "object",
        properties: {
          book_id: { type: "string" },
        },
        required: ["book_id"],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId?: string
): Promise<unknown> {
  if (name === "search_books") {
    const found = await searchBooks({
      query: String(args.query || ""),
      category: args.category ? String(args.category) : undefined,
      author: args.author ? String(args.author) : undefined,
      pageSize: 5,
    });
    return {
      total: found.total,
      books: found.books.map(bookSummary),
    };
  }
  if (name === "get_book_details") {
    const book = await getBook(String(args.book_id || ""), userId);
    return bookSummary(book);
  }
  if (name === "add_to_my_library") {
    if (!userId) {
      return { ok: false, error: "The reader must sign in before a book can be saved." };
    }
    return addToLibrary(userId, String(args.book_id || ""));
  }
  return { error: `Unknown tool ${name}` };
}

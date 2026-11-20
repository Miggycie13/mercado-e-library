export type User = { id: string; email: string; name: string; role: string };

export type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  year: number;
  language: string;
  description: string;
  sourceUrl?: string | null;
  inLibrary?: boolean;
  isFavorite?: boolean;
};

export type Quota = { mode: "guest" | "user"; limit: number; used: number; remaining: number };

export type ToolTrace = { name: string; arguments: Record<string, unknown>; result: unknown };

export type ChatResponse = {
  reply: string;
  toolTrace: ToolTrace[];
  pendingAction: null | { confirmationId: string; bookId: string; title: string; author: string };
  mode: "openai" | "local";
};

function token() {
  return localStorage.getItem("elibrary.token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const current = token();
  if (current) headers.set("Authorization", `Bearer ${current}`);
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

export async function downloadBook(bookId: string, title: string) {
  const headers = new Headers();
  const current = token();
  if (current) headers.set("Authorization", `Bearer ${current}`);
  const response = await fetch(`/api/downloads/${bookId}`, { method: "POST", headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Download failed.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "book"}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  window.dispatchEvent(new Event("elibrary-quota"));
}

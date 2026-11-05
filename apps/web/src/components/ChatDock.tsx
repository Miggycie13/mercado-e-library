import { useState } from "react";
import { api, type ChatResponse } from "../api";
import { useAuth } from "../auth";

type Message = { role: "user" | "assistant"; content: string; trace?: ChatResponse["toolTrace"]; pending?: ChatResponse["pendingAction"] };

const SUGGESTIONS = [
  { label: "A sea adventure", text: "Recommend a sea adventure and tell me about the closest match" },
  { label: "Dracula and Frankenstein", text: "Compare Dracula and Frankenstein" },
  { label: "Save Treasure Island", text: "Add Treasure Island to my library" },
];

const TOOL_LABELS: Record<string, string> = {
  search_books: "Search",
  get_book_details: "Details",
  add_to_my_library: "Save",
  compare_books: "Compare",
};

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? "Search";
}

function sessionId() {
  const existing = localStorage.getItem("elibrary.chat");
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem("elibrary.chat", created);
  return created;
}

export function ChatDock() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Ask about a book. I will ask before I save one.",
  }]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    setBusy(true);
    try {
      const result = await api<ChatResponse>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId: sessionId(),
          messages: history.filter((message) => message.role === "user" || message.role === "assistant").map(({ role, content: value }) => ({ role, content: value })),
        }),
      });
      setMessages((current) => [...current, {
        role: "assistant",
        content: result.reply,
        trace: result.toolTrace,
        pending: result.pendingAction,
      }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The librarian is unavailable." }]);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(confirmationId: string, accept: boolean) {
    setBusy(true);
    try {
      const result = await api<{ reply: string; toolTrace: ChatResponse["toolTrace"] }>("/api/ai/confirm", {
        method: "POST",
        body: JSON.stringify({ confirmationId, accept }),
      });
      setMessages((current) => current.map((message) => (
        message.pending?.confirmationId === confirmationId ? { ...message, pending: null } : message
      )).concat({ role: "assistant", content: result.reply, trace: result.toolTrace }));
      window.dispatchEvent(new Event("elibrary-shelf"));
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Could not confirm." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section className="chat-panel" aria-label="Library assistant">
          <div className="chat-head">
            <strong>Librarian</strong>
            <div className="muted">{user ? `Signed in as ${user.name}` : "Guest · sign in to save books"}</div>
          </div>
          <div className="chat-log">
            {messages.map((message, index) => (
              <article key={index} className="stack">
                <div className={`bubble ${message.role}`}>{message.content}</div>
                {message.trace && message.trace.length > 0 && (
                  <div className="trace">
                    Tools used: {message.trace.map((tool) => toolLabel(tool.name)).join(" → ")}
                  </div>
                )}
                {message.pending && (
                  <div className="confirm">
                    <span>Save {message.pending.title}?</span>
                    <button className="solid" disabled={busy} onClick={() => confirm(message.pending!.confirmationId, true)}>Confirm</button>
                    <button className="ghost" disabled={busy} onClick={() => confirm(message.pending!.confirmationId, false)}>Cancel</button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {messages.length < 2 && (
            <div className="prompts">
              {SUGGESTIONS.map((prompt) => (
                <button key={prompt.label} className="textish" onClick={() => send(prompt.text)}>{prompt.label}</button>
              ))}
            </div>
          )}
          <form className="chat-form" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about the catalog" aria-label="Message the librarian" />
            <button className="solid" disabled={busy} type="submit">{busy ? "..." : "Send"}</button>
          </form>
        </section>
      )}
      <div className="librarian-bar">
        <button className="solid" onClick={() => setOpen((value) => !value)}>
          {open ? "Close librarian" : "Ask the librarian"}
        </button>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, type Book } from "../api";
import { useAuth } from "../auth";

type Analytics = {
  totals: { books: number; users: number; downloads: number; favorites: number; libraryItems: number };
  byCategory: Array<{ category: string; count: number }>;
  topBooks: Array<{ id: string; title: string; author: string; downloads: number }>;
  recentDownloads: Array<{ id: string; at: string; title: string; reader: string }>;
  daily: Array<{ day: string; downloads: number }>;
};

const empty = { title: "", author: "", category: "Fiction", year: 1900, description: "", sourceUrl: "" };

const RECORD_PAGE = 20;

function dayLabel(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Admin() {
  const { user, ready } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [recordQuery, setRecordQuery] = useState("");
  const [recordPage, setRecordPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState("");

  function load() {
    api<Analytics>("/api/admin/analytics").then(setAnalytics).catch((reason) => setError(reason.message));
    api<{ books: Book[] }>("/api/admin/books").then((result) => setBooks(result.books)).catch((reason) => setError(reason.message));
  }

  useEffect(() => { if (user?.role === "admin") load(); }, [user]);

  if (!ready) return <p>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <p>This account cannot open the admin desk.</p>;

  const maxDaily = Math.max(1, ...(analytics?.daily.map((day) => day.downloads) || [1]));
  const maxCategory = Math.max(1, ...(analytics?.byCategory.map((row) => row.count) || [1]));
  const query = recordQuery.trim().toLowerCase();
  const visibleBooks = books.filter((book) => !query || `${book.title} ${book.author}`.toLowerCase().includes(query));
  const recordPages = Math.max(1, Math.ceil(visibleBooks.length / RECORD_PAGE));
  const page = Math.min(recordPage, recordPages);
  const shownBooks = visibleBooks.slice((page - 1) * RECORD_PAGE, page * RECORD_PAGE);
  const latestDay = analytics?.daily[analytics.daily.length - 1];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api(editing ? `/api/admin/books/${editing}` : "/api/admin/books", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setForm(empty);
      setEditing(null);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the book.");
    }
  }

  return (
    <div className="stack">
      <h1>Admin desk</h1>
      {error && <p className="error">{error}</p>}
      {analytics && (
        <div className="stack">
          <section className="stats">
            <div className="stat"><b>{analytics.totals.books}</b><span>Books</span></div>
            <div className="stat"><b>{analytics.totals.users}</b><span>Accounts</span></div>
            <div className="stat"><b>{analytics.totals.downloads}</b><span>Downloads</span></div>
            <div className="stat"><b>{analytics.totals.favorites}</b><span>Favorites</span></div>
            <div className="stat"><b>{analytics.totals.libraryItems}</b><span>Library saves</span></div>
          </section>
          <section className="split">
            <div className="panel">
              <h2>Catalog by category</h2>
              <div className="bars">
                {analytics.byCategory.map((row) => (
                  <div className="bar" key={row.category}>
                    <span>{row.category}</span>
                    <i style={{ width: `${(row.count / maxCategory) * 100}%` }} />
                    <span>{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <h2>Downloads, last 14 days</h2>
              {latestDay && <p className="muted">{latestDay.downloads} downloads on {dayLabel(latestDay.day)}</p>}
              <div className="columns">
                {analytics.daily.map((row) => (
                  <div className="column" key={row.day}>
                    <span>{row.downloads}</span>
                    <span className="mark">
                      <i style={{ height: `${row.downloads === 0 ? 4 : Math.max(12, (row.downloads / maxDaily) * 96)}px` }} />
                    </span>
                    <span>{dayLabel(row.day)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="split">
            <div className="panel">
              <h2>Most downloaded</h2>
              {analytics.topBooks.length === 0 && <p className="muted">No books have been downloaded yet.</p>}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Title</th><th>Author</th><th>Downloads</th></tr>
                  </thead>
                  <tbody>
                    {analytics.topBooks.map((book) => (
                      <tr key={book.id}><td>{book.title}</td><td>{book.author}</td><td>{book.downloads}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <h2>Recent downloads</h2>
              {analytics.recentDownloads.length === 0 && <p className="muted">No downloads have been recorded yet.</p>}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Title</th><th>Reader</th><th>When</th></tr>
                  </thead>
                  <tbody>
                    {analytics.recentDownloads.map((row) => (
                      <tr key={row.id}><td>{row.title}</td><td>{row.reader}</td><td>{new Date(row.at).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
      <section className="split">
        <form className="panel fields" onSubmit={save}>
          <h2>{editing ? "Edit book" : "Add book"}</h2>
          <input placeholder="Title" aria-label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <input placeholder="Author" aria-label="Author" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} required />
          <input placeholder="Category" aria-label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
          <input placeholder="Year" aria-label="Year" type="number" value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} required />
          <textarea placeholder="Description" aria-label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
          <input placeholder="Source URL (optional)" aria-label="Source URL" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} />
          <div className="actions">
            <button className="solid" type="submit">Save book</button>
            {editing && <button className="ghost" type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}
          </div>
        </form>
        <div className="panel admin-list">
          <h2>Catalog records</h2>
          <input className="record-search" value={recordQuery} onChange={(event) => { setRecordQuery(event.target.value); setRecordPage(1); }} placeholder="Search title or author" aria-label="Search catalog records" />
          {books.length > 0 && <p className="muted">{shownBooks.length} of {visibleBooks.length} records.</p>}
          {query && visibleBooks.length === 0 && <p className="muted">No records match this search.</p>}
          {shownBooks.map((book) => (
            <div key={book.id} className="row-actions">
              <span className="row-copy">
                <span className="row-title">{book.title}</span>
                <span className="row-author">{book.author}</span>
              </span>
              {pendingDelete === book.id ? (
                <>
                  <span className="row-author">Delete this book?</span>
                  <button className="textish" onClick={async () => { await api(`/api/admin/books/${book.id}`, { method: "DELETE" }); setPendingDelete(null); load(); }}>Delete</button>
                  <button className="textish" type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="textish" onClick={() => { setPendingDelete(null); setEditing(book.id); setForm({ title: book.title, author: book.author, category: book.category, year: book.year, description: book.description, sourceUrl: book.sourceUrl || "" }); }}>Edit</button>
                  <button className="textish" type="button" onClick={() => setPendingDelete(book.id)}>Delete</button>
                </>
              )}
            </div>
          ))}
          {recordPages > 1 && (
            <div className="actions">
              <button className="ghost" type="button" disabled={page <= 1} onClick={() => setRecordPage(page - 1)}>Previous</button>
              <button className="ghost" type="button" disabled={page >= recordPages} onClick={() => setRecordPage(page + 1)}>Next</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

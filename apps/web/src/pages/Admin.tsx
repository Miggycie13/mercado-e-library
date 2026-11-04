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

export function Admin() {
  const { user, ready } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
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
              <div className="bars">
                {analytics.daily.map((row) => (
                  <div className="bar" key={row.day}>
                    <span>{row.day.slice(5)}</span>
                    <i style={{ width: `${(row.downloads / maxDaily) * 100}%` }} />
                    <span>{row.downloads}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="split">
            <div className="panel">
              <h2>Most downloaded</h2>
              {analytics.topBooks.length === 0 && <p className="muted">No downloads yet.</p>}
              <div className="table-wrap">
                <table>
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
              <div className="table-wrap">
                <table>
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
          {books.map((book) => (
            <div key={book.id} className="row-actions">
              <span className="row-title">{book.title}</span>
              <button className="textish" onClick={() => { setEditing(book.id); setForm({ title: book.title, author: book.author, category: book.category, year: book.year, description: book.description, sourceUrl: book.sourceUrl || "" }); }}>Edit</button>
              <button className="textish" onClick={async () => { await api(`/api/admin/books/${book.id}`, { method: "DELETE" }); load(); }}>Delete</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

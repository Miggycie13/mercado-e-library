import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Book } from "../api";
import { Cover } from "../components/Cover";

type CatalogResponse = { total: number; page: number; pageSize: number; books: Book[] };

const CATALOG_ERROR = "The catalog could not be loaded. The API on port 4000 is not responding.";

export function Catalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const loadCategories = () => {
      api<{ categories: Array<{ name: string; count: number }> }>("/api/books/categories")
        .then((result) => {
          if (cancelled) return;
          setCategories(result.categories);
        })
        .catch(() => {
          if (!cancelled) timer = window.setTimeout(loadCategories, 3000);
        });
    };

    loadCategories();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const loadBooks = () => {
      const params = new URLSearchParams({ q: query, category, page: String(page), pageSize: "12" });
      api<CatalogResponse>(`/api/books?${params}`)
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setError("");
        })
        .catch(() => {
          if (cancelled) return;
          setError(CATALOG_ERROR);
          timer = window.setTimeout(loadBooks, 3000);
        });
    };

    const handle = window.setTimeout(loadBooks, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      window.clearTimeout(timer);
    };
  }, [query, category, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <section className="hero">
        <div className="stack">
          <h1>A shared shelf of public-domain books.</h1>
          <p>Search the catalog, keep a library, and ask the librarian. Guests can download 5 books. An account raises that to 10. The limit is enforced by the server.</p>
        </div>
        <div className="panel">
          <strong>{data?.total ?? "…"} records</strong>
          <p className="muted">Downloads are original bibliographic cards, with a Project Gutenberg link when one is stored.</p>
        </div>
      </section>
      <div className="filters">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search title, author, or theme" aria-label="Search books" />
        <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      {!error && data && data.books.length === 0 && <p className="notice">No books match this search.</p>}
      <div className="grid">
        {data?.books.map((book) => (
          <Link className="book" key={book.id} to={`/books/${book.id}`}>
            <Cover title={book.title} category={book.category} />
            <div className="meta">{book.author} · {book.year}</div>
          </Link>
        ))}
      </div>
      <div className="pager">
        <button className="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <span className="muted">Page {page} of {pages}</span>
        <button className="ghost" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
    </>
  );
}

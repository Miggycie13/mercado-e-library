import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Book } from "../api";
import { Cover } from "../components/Cover";

type CatalogResponse = { total: number; page: number; pageSize: number; books: Book[] };

const CATALOG_ERROR = "The catalog could not be loaded. The API on port 4000 is not responding.";

function readPage(params: URLSearchParams) {
  const value = Number(params.get("page"));
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

function pageItems(current: number, total: number) {
  const shown = new Set([1, total, current - 1, current, current + 1].filter((item) => item >= 1 && item <= total));
  const items: Array<number | "gap"> = [];
  let previous = 0;
  for (const item of [...shown].sort((left, right) => left - right)) {
    if (previous && item - previous > 1) items.push("gap");
    items.push(item);
    previous = item;
  }
  return items;
}

export function Catalog() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const page = readPage(params);
  const [jump, setJump] = useState("");
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
      const params = new URLSearchParams({ q: query, category, page: String(page), pageSize: "15" });
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

  function writeCatalog(next: { q?: string; category?: string; page?: number }, replace = false) {
    const q = next.q !== undefined ? next.q : query;
    const nextCategory = next.category !== undefined ? next.category : category;
    const nextPage = next.page !== undefined ? next.page : page;
    const upcoming = new URLSearchParams();
    if (q) upcoming.set("q", q);
    if (nextCategory) upcoming.set("category", nextCategory);
    if (nextPage > 1) upcoming.set("page", String(nextPage));
    setParams(upcoming, { replace });
  }

  return (
    <div className="stack">
      <h1 className="catalog-title">Catalog</h1>
      <div className="filters">
        <input value={query} onChange={(event) => writeCatalog({ q: event.target.value, page: 1 }, true)} placeholder="Search title, author, or theme" aria-label="Search books" />
        <select value={category} onChange={(event) => writeCatalog({ category: event.target.value, page: 1 }, true)} aria-label="Category">
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
        <button className="ghost" type="button" disabled={page <= 1} onClick={() => writeCatalog({ page: page - 1 })}>Previous</button>
        {pageItems(page, pages).map((item, index) => item === "gap" ? (
          <span className="muted" key={`gap-${index}`} aria-hidden="true">…</span>
        ) : (
          <button className={item === page ? "solid" : "ghost"} type="button" key={item} aria-current={item === page ? "page" : undefined} onClick={() => { if (item !== page) writeCatalog({ page: item }); }}>{item}</button>
        ))}
        <button className="ghost" type="button" disabled={page >= pages} onClick={() => writeCatalog({ page: page + 1 })}>Next</button>
        <form className="pager-jump" onSubmit={(event) => {
          event.preventDefault();
          const value = Number(jump);
          if (!Number.isInteger(value) || value < 1 || value > pages) return;
          writeCatalog({ page: value });
          setJump("");
        }}>
          <label>
            <span>Go to page</span>
            <input value={jump} onChange={(event) => setJump(event.target.value)} inputMode="numeric" aria-label="Go to page" />
          </label>
        </form>
      </div>
    </div>
  );
}

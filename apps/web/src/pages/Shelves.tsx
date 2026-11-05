import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Book } from "../api";
import { useAuth } from "../auth";
import { Cover } from "../components/Cover";

export function Shelf({ kind }: { kind: "library" | "favorites" }) {
  const { user, ready } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState("");
  const title = kind === "library" ? "My Library" : "Favorites";

  useEffect(() => {
    if (!user) return;
    const load = () => api<{ books: Book[] }>(`/api/user/${kind}`)
      .then((result) => setBooks(result.books))
      .catch((reason) => setError(reason.message));
    load();
    window.addEventListener("elibrary-shelf", load);
    return () => window.removeEventListener("elibrary-shelf", load);
  }, [user, kind]);

  if (!ready) return <p>Loading…</p>;
  if (!user) return <p className="empty">Sign in to see {title}. Your shelf is stored on the shared server, so the Android app reads the same list. <Link to="/login">Sign in</Link></p>;

  return (
    <div className="stack">
      <h1>{title}</h1>
      {error && <p className="error">{error}</p>}
      {books.length === 0 ? (
        <p className="empty">Nothing here yet. Ask the librarian to save a book, then confirm it.</p>
      ) : (
        <div className="grid">
          {books.map((book) => (
            <Link className="book" key={book.id} to={`/books/${book.id}`}>
              <Cover title={book.title} category={book.category} />
              <div className="meta">{book.author} · {book.year}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

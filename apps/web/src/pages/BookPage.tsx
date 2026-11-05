import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, downloadBook, type Book } from "../api";
import { useAuth } from "../auth";
import { Cover } from "../components/Cover";

export function BookPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function load() {
    if (!id) return;
    api<{ book: Book }>(`/api/books/${id}`).then((result) => setBook(result.book)).catch((reason) => setError(reason.message));
  }

  useEffect(load, [id, user]);

  async function act(path: string, method = "POST") {
    if (!book) return;
    setError("");
    try {
      await api(path, { method, body: method === "POST" ? JSON.stringify({ bookId: book.id }) : undefined });
      setNote("Saved.");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update your shelf.");
    }
  }

  async function download() {
    if (!book) return;
    setError("");
    try {
      await downloadBook(book.id, book.title);
      setNote("Download started.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Download failed.");
    }
  }

  if (error && !book) return <p className="error notice">{error}</p>;
  if (!book) return <p>Loading the record…</p>;

  return (
    <article className="detail">
      <Cover title={book.title} category={book.category} />
      <div className="detail-copy">
        <h1 className="book-title">{book.title}</h1>
        <p>{book.author} · {book.year}</p>
        <p>{book.description}</p>
        {book.sourceUrl && <p><a className="textish" href={book.sourceUrl} target="_blank" rel="noreferrer">View the public-domain source</a></p>}
        {error && <p className="error">{error}</p>}
        {note && <p className="muted">{note}</p>}
        <div className="actions">
          <button className="solid" onClick={download}>Download PDF</button>
          {user ? (
            <>
              <button className="textish" onClick={() => act(book.inLibrary ? `/api/user/library/${book.id}` : "/api/user/library", book.inLibrary ? "DELETE" : "POST")}>
                {book.inLibrary ? "Remove from My Library" : "Add to My Library"}
              </button>
              <button className="textish" onClick={() => act(book.isFavorite ? `/api/user/favorites/${book.id}` : "/api/user/favorites", book.isFavorite ? "DELETE" : "POST")}>
                {book.isFavorite ? "Unfavorite" : "Favorite"}
              </button>
            </>
          ) : (
            <Link className="textish" to="/login">Sign in to save this book</Link>
          )}
        </div>
      </div>
    </article>
  );
}

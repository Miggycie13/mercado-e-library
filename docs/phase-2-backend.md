The Emerald Archive keeps one API on port 4000 and one SQLite database. The website reaches that API through its development proxy. Android uses http://10.0.2.2:4000 unless the Account screen saves another address. Both clients send the saved token with each signed-in request. The shared tables are User, Book, DownloadLog, Favorite, and LibraryItem.

A guest request to the catalog, with no token, returned 307 books. The guest download quota was mode guest with a limit of 5. Filtering the same catalog by author Charles Dickens and category Fiction returned 15 books, including A Christmas Carol. Opening that book by its id returned the title A Christmas Carol. A guest attempt to save a favorite was rejected.

A new reader, Phase Two, registered with phase2.reader.1795098832@elibrary.local and was given the role user. A second sign-in with that same email and password restored the same account. That is the path the website and Android both use, so a reader created on one client can sign in on the other. The demo reader reader@elibrary.local still has a download limit of 10.

A Christmas Carol was saved to My Library and to Favorites for Phase Two. Reading both lists returned that book. The website and Android read those same rows. A guest still cannot open either list.

The first download of A Christmas Carol moved the used count from 0 to 1. Downloading that same book again left the used count at 1, so the repeat did not take another slot. The registered limit stayed 10. The server records the download in DownloadLog.

The librarian was asked, “Tell me about Treasure Island.” It answered from the live catalog in local mode. The reply named Treasure Island by Robert Louis Stevenson, 1883, in Adventure, after using search_books and then get_book_details. Logout ended the session.

The website development servers on ports 5173 and 5174 both reported the same 307 books through the API on port 4000.

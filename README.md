# Mercado E-Library

Shared catalog for a responsive website and an Android app. One API owns accounts, the 200-book public-domain catalog, download limits, favorites, My Library, and the embedded librarian.

## Stack

- API: Node.js, Express, TypeScript, Prisma, SQLite
- Web: React and Vite
- Android: Expo (React Native), installable APK through EAS
- Assistant: live tool calls (`search_books`, `get_book_details`, `add_to_my_library`). Uses the OpenAI API when `OPENAI_API_KEY` is set, and the same database tools locally when it is not
- Shipping: Dockerfile, GitHub Actions, and Wasmer Edge config

SQLite keeps web and mobile on one database without a separate database server. Prisma can point at PostgreSQL later by changing the datasource in `apps/api/prisma/schema.prisma`.

## Run it

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

The first launch seeds the catalog and these accounts:

- Reader: `reader@elibrary.local` / `Reader123!`
- Admin: `admin@elibrary.local` / `Admin123!`

Guests can download 5 distinct books, tracked by IP. Signed-in readers can download 10. The API rejects the download after the limit. Downloading the same book again does not use another slot.

## Librarian

The chat window is inside the site and inside the Android app. It does not open another website.

Try:

1. "Recommend a sea adventure and tell me about the closest match" — search, then book details.
2. "Compare Dracula and Frankenstein" — search and details for both.
3. "Add Treasure Island to my library" — finds the book, then waits. Nothing is saved until you press Confirm.

Set `OPENAI_API_KEY` in `apps/api/.env` to send those tool definitions to OpenAI. Without a key, the local librarian calls the same database functions.

## Android

```bash
npm run setup:mobile
npm run mobile
```

The emulator talks to `http://10.0.2.2:4000`. On a phone, set the API address on the Account tab to your computer's LAN URL, such as `http://192.168.1.20:4000`.

An installable APK:

```bash
cd apps/mobile
npx eas build -p android --profile preview
```

That profile builds an APK. It needs an Expo account.

## Docker and Wasmer

```bash
docker compose up --build
```

The site and API are both served at http://localhost:4000.

Before `wasmer deploy`, replace `YOUR_WASMER_USERNAME` in `app.yaml` and `wasmer.toml`. Add `WASMER_TOKEN` to GitHub secrets so `.github/workflows/ci-cd.yml` can publish on pushes to `main`.

Downloads are original bibliographic cards. Where a Project Gutenberg id is stored, the record also links to that public-domain source. The catalog does not redistribute book text.

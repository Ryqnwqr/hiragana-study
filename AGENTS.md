# AGENTS.md

## Cursor Cloud specific instructions

This is a single Next.js 15 (App Router) + React 19 app: **ひらがな Study**, a hiragana flashcard app. Package manager is **npm** (`package-lock.json`). Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`); there is no test suite.

### Environment variables
- `.env.local` (gitignored) is required for the app to serve pages. Copy from `.env.example`.
- The Next.js middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts`) reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and **throws if either is missing**, which blocks all page routes. They must be *present* even for local guest-mode testing — placeholder values are fine.
- `SESSION_SECRET` signs the httpOnly progress cookie; it has a dev fallback, so it is optional locally but should be set.
- The **core study loop** (start round, reveal romaji, answer, guest progress) works entirely off the signed cookie and does **not** need a real Supabase backend. A real Supabase project (URL + anon key + the `supabase/migrations/0001_user_progress.sql` migration applied) is only needed to test **sign-in and cross-device cloud sync**.

### Running / testing
- Dev server: `npm run dev` (serves on http://localhost:3000). API routes are under `/api/*`.
- Lint: `npm run lint` (uses `next lint`, prints a deprecation notice — harmless).
- No automated tests exist; verify changes manually via the dev server or with `npm run build`.
- Study-flow gotcha when testing in a browser: grading a card is most reliable via the keyboard (Right Arrow = correct); the on-screen grade buttons can behave inconsistently under automated clicking.

# ひらがな Study

Hiragana flashcard app with spaced repetition and reaction-time scoring.

## Architecture

This app is a **Next.js** project deployed on **Vercel**. Sensitive study logic runs server-side:

| Concern | Where it runs |
| --- | --- |
| Hiragana character + romaji data | Server only (`src/lib/hiragana.ts`) |
| Deck building & weighted SRS picks | Server (`src/lib/srs.ts`, `POST /api/round`) |
| Mastery scoring & answer validation | Server (`POST /api/round/answer`) |
| Romaji reveal on flip | Server (`POST /api/round/reveal`) |
| Progress persistence | Signed httpOnly cookie (`SESSION_SECRET`) |
| Card UI, swipe gestures, timer display | Client |

The client never receives the full character dictionary or romaji until a card is flipped.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `SESSION_SECRET` in `.env.local` (any long random string for local dev).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Add environment variable: `SESSION_SECRET` = a long random string.
4. Deploy.

Or with the Vercel CLI:

```bash
npx vercel
npx vercel env add SESSION_SECRET
npx vercel --prod
```

## Legacy static version

The original single-file PWA lives in `legacy/index.html`.

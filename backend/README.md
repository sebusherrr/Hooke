# Abingdon Library — Backend

Real Express + TypeScript + Prisma + PostgreSQL API. See the parent project's docs for
architecture details; this file just covers getting it running.

## Setup
```bash
cp .env.example .env        # fill in real values — see comments in the file
npm install
npx prisma migrate dev      # creates the schema in your Postgres database
npm run seed                # loads obviously-fake dev data (see prisma/seed.ts)
npm run dev                 # starts the API on :4000
```

## Notes
- Nothing in here works without a real PostgreSQL database — set `DATABASE_URL` first.
- `AI_PROVIDER=groq` + `GROQ_API_KEY` enables the library assistant (`services/ai.service.ts`).
  Barcode/ISBN lookup (`integrations/openLibrary.ts`) needs no key — it's a free public API.
- Google sign-in/sign-up and WebAuthn passkeys need `GOOGLE_CLIENT_ID` / `RP_ID` set to your
  real deployed domain before they'll work — see `.env.example`.
- Dev seed accounts (all password `dev-only-change-me`, never reuse in production):
  `dev.student@abingdon.org.uk`, `dev.staff@…`, `dev.librarian@…`, `dev.hol@…`, `dev.admin@…`

# Partner Up

**Connect with someone you already have in mind, or find the right person when you don't.**

A HackGT 13 prototype with two deliberately different paths:
- **Mutual:** exact-name search, a secret choice, and contact exchange only after independent reciprocal choices. No AI.
- **Scout:** describe a need to Muse, review an explained person/group suggestion, and connect only when everyone accepts. Editable Partner DNA and persistent Keep Looking requests.

## Run locally

Node 24 recommended (22.12+ supported for the app; SQLite integration tests use Node's built-in SQLite).

```sh
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

On PowerShell use `Copy-Item .env.example .env` instead of `cp`.
Open http://127.0.0.1:5176. Vite serves the frontend and API from one origin.

**Fictional demo:** click Find your connection, or sign in as `demo@partnerup.test` / `PartnerUpDemo!26`. Seeded adult accounts share that public demo password. Demo controls let judges independently act as each fictional person. Never put personal information into shared demo accounts.

## AI configuration

Muse runs only on the server. Add a newly issued `MUSE_API_KEY` to your local environment or hosting secret store. The configured endpoint is `https://api.meta.ai/v1/chat/completions`; `MUSE_MODEL` defaults to `muse-spark-1.3` and is configurable. No key is included.

Without a key, on timeout, malformed output, or provider failure, Scout uses **Offline matching**. The current checked-in demo was tested with mocked Muse responses, not a live paid API call. `npm run muse:smoke` tests your configured live key with a synthetic request; a missing key exits with a clear skipped message.

Only intentionally shared Scout text, structured Partner DNA, and candidate matching facts enter the provider. Mutual selections, search activity, credentials, and approved contacts do not. User-entered text may itself contain personal information; only share what you intend to use for matching.

## Stack and architecture

React + TypeScript + Vite, Tailwind CSS/custom CSS, Framer Motion, Lucide, locally bundled Manrope; Node HTTP API; Zod validation; Prisma + SQLite. No Supabase or remote database is required.

The model extracts structured intent and drafts explanations. A deterministic weighted engine ranks candidates and assembles small groups. Shared interests, reciprocal needs/offers, availability, location, and group coverage produce inspectable reasons. Scores are ranking values, not probabilities.

SQLite commits each API unit of work atomically. The small demo uses one serialized Node process and a typed working-state cache; deploy **one instance**, with a persistent disk. See [architecture](docs/ARCHITECTURE.md).

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover reciprocal Mutual consent, request limits/expiry, contact privacy, group acceptance, Keep Looking, deterministic matching, Muse failure handling, password/session storage, database reload, transaction rollback, and cross-origin writes. See [verification](VERIFICATION.md).

## Deploy

The Dockerfile serves the built frontend and API together. `render.yaml` describes a free Render service with disposable SQLite storage. The public host sets `DEMO_ONLY=true`: only fictional accounts are available, and data can reset after restarts/redeploys. No paid disk is configured. Local SQLite remains persistent. Cloud deployment status is recorded in VERIFICATION.md.

Required production environment:
- `DATABASE_URL=file:/data/partnerup.db`
- `SESSION_SECRET`: independently generated random secret, at least 32 characters
- `NODE_ENV=production` (Docker supplies this)
- `MUSE_API_KEY`: optional for live Muse; leave unset for transparent offline mode
- `DEMO_ENABLED=true` for fictional judging; disable for non-demo use
- `DEMO_ONLY=true` on the disposable public demo (blocks new accounts)

The startup command migrates SQLite, seeds missing fictional demo accounts idempotently, then starts Node. Back up the SQLite database before upgrades. For durable real-user data, attach persistent storage; the free public deployment is explicitly disposable. HTTPS is required for production Secure cookies.

## Privacy and prototype limits

Passwords use scrypt; browser sessions use HttpOnly, SameSite cookies with opaque tokens hashed in SQLite. API routes authorize reads/writes and hide contacts until consent. Login throttling and origin checks are included.

This is a reviewed hackathon prototype, not an independently audited production service. No email verification, password-recovery delivery, abuse-reporting workflow, or push/email notifications is implemented. Keep Looking rescans on relevant in-app events, not an external crawler. It finds people in this app only. Shared demo controls can change the fictional dataset for all judges. The original Mutual opposite-gender rule remains; broader identity/matching preferences need product work.

## Submission materials

- [Demo script](DEMO-GUIDE.md)
- [Devpost copy and submission checklist](docs/SUBMISSION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Verification](VERIFICATION.md)

## Credits and provenance

This iteration continues an earlier Partner Up prototype supplied by the author. It adds the Muse provider, SQLite persistence, cookie sessions, updated interface, and verification. Codex assisted implementation, tests, and documentation. Do not claim all source was first written during the event. Confirm eligibility with organizers and disclose reused work in the submission.

Open-source credits: React, Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide, Prisma, Zod, Vitest, ESLint, and Manrope (SIL Open Font License). Meta provides the optional configured model API. No affiliation or sponsor endorsement is implied.

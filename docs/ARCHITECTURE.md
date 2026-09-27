# Architecture

## Boundaries
Browser -> same-origin Node API -> authorized services -> Prisma/SQLite.
Scout services -> AIProvider -> Muse HTTP adapter (or deterministic fallback).
Mutual services never call an AI provider.

## Persistence
Prisma models store users, hashed sessions, profiles, Partner DNA, Mutual requests/searches/matches, saved names, Scout requests/connections, and notifications. AppRecord holds typed auxiliary collections. `server/data/database.ts` loads a working-state cache and serializes API transactions; changed state is atomically persisted. Failure restores the pre-operation snapshot. This intentionally trades throughput for a small reliable demo. Do not run multiple Node instances against it. Direct writes outside API transactions must use `inDatabase` (as the seed does).

## Consent
Mutual records A->B without identifying A to B. Only A->B and B->A produce a match. Five new choices per rolling 30 days; active requests expire after 30 days. A matched profile is Taken; ending is locked for 24 hours. The fictional demo can advance this clock.
Scout proposals disclose matching facts, not contact values. Each member independently accepts. Approved contacts unlock only when all members accept; leaving closes the connection.

## Matching
Structured intent and an explicit concept ontology feed weighted deterministic matching. Internal Connect/Learn/Explore strategies are inferred, not top-level navigation. Learn rewards two-way strength-to-need coverage; the group builder evaluates small candidate combinations for collective coverage. Active Scout request intent can complement a candidate's saved profile. The provider cannot determine the final numerical ranking.

## Keep Looking
Saved requests persist in SQLite. Profile/mode updates, identity completion, a new Scout request, and the fictional arrival event rescan active requests. Found IDs prevent duplicate alerts. Pause/resume is user-controlled. Notifications remain in-app. No background web scraping or out-of-app outreach occurs.

## Provider
`AIProvider.structured` is the replaceable interface. `MuseProvider` uses configured model/base URL, server-only credentials, JSON schema output and Zod validation. Timeout is at most five seconds per model operation; a flow can contain multiple operations. Fallback output explicitly reports its local source. Current verification uses a mock HTTP server; no live key is bundled.

## Security and limits
Session cookies: HttpOnly, SameSite=Lax, Secure in production; 7-day session TTL. Database stores HMAC token digests, not raw bearer tokens. Production refuses a short/missing session secret. Origin checks protect writes, and sensitive endpoints throttle. Secrets and SQLite files are excluded from Git. Authorization tests verify pre-consent contacts remain private. The public demo is not a place for real private information.

Password recovery, verified ownership of contact methods, moderation/blocking, multi-process scaling, automated backups, email/push delivery and independent security audit remain future work.

# HackGT submission kit

## Project name
Partner Up

## Tagline
A private first move. A better introduction.

## Inspiration
Two familiar situations inspired Partner Up: knowing someone you want to connect with but fearing an awkward one-sided confession, and knowing the kind of teammate or companion you need without knowing who they are. These deserve different systems.

## What it does
Mutual lets adults search someone they already know, privately choose them, and reveal identities and approved contacts only after an independent reciprocal choice. Scout lets users describe a need to Muse, review their editable Partner DNA, and receive an explained person or small-group suggestion. Every person chooses whether to connect. If nobody fits yet, Keep Looking saves the request and alerts the user when a new in-app match appears.

## How we built it
React, TypeScript and Vite power a responsive banana/peach/blue interface with locally bundled Manrope, white cards and Framer Motion. A Node API validates input with Zod and stores state using Prisma and SQLite. Sessions use HttpOnly cookies and server-side token digests. The optional Meta Muse adapter extracts structured intent and writes explanations; deterministic matching selects candidates and rewards shared goals, complementary needs, availability and location. Model failures switch to a clearly labeled offline path.

## Challenges
Separating private Mutual activity from Scout's matching data; explaining group fit without invented percentages; preserving independent consent; and making a judging demo continue when an AI service is unavailable.

## Accomplishments
Two distinct connection systems, reciprocal contact permissions, event-driven persistent scouting, editable DNA, a mobile interface, and automated tests covering privacy, persistence and AI failure handling.

## What we learned
Useful AI can help people make introductions without becoming the relationship itself. Reliable consent and clear explanations matter as much as an attractive interface.

## What's next
Verified contact ownership, moderation/reporting, inclusive Mutual preferences, notification delivery, production data-layer scaling, and user testing of real-world connection outcomes.

## Technologies
React, TypeScript, Vite, Node.js, Prisma, SQLite, Meta Muse API adapter, Zod, Tailwind CSS, Framer Motion, Lucide React, Vitest, Manrope.

## Required disclosure — retain and complete honestly
This submission continues an earlier Partner Up prototype. Codex assisted code, tests and documentation. Identify which portions existed before the event and which changes were completed within the event window. Confirm eligibility with organizers. Do not claim live Muse usage until your new key passes the live smoke test. If recording in Offline matching, disclose that in the video and submission.

## Final fields for the owner
- Repository: use the verified published repository URL after upload.
- Live demo: use the verified hosted URL after deployment (localhost is not a public submission URL).
- Demo video: record the linked 2–3 minute script, upload, and add its accessible URL.
- Team members and their contributions: fill in accurately.
- Challenge: select the relevant Meta human-connection challenge only if its requirements are met.

## Submission steps
Complete the project at https://hackgt13.devpost.com/ and check the official deadline/rules. Add the completed Devpost URL to https://expo.hexlabs.org/ and follow the event's judging attendance instructions. The account owner must submit the final form. Recheck official pages before submitting; this file is not a substitute for event rules.

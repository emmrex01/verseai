# Verse — Your book. Understood.

Verse is a privacy-first AI editorial workspace. It reads an author's whole manuscript, turns it into a **Book Intelligence Graph** (characters, places, objects, relationships, events, plot threads), and helps the author find continuity problems, unresolved setups and pacing dips. Every finding links to evidence in the author's own text.

This repository is the **Manuscript Intelligence MVP** (blueprint §59): the first version worth charging for. Publishing, formatting and marketing come after authors are paying.

## What's built

| Area | What it does |
| --- | --- |
| **Marketing site** | Homepage, pricing, privacy, terms. SEO metadata, Open Graph image, JSON-LD (Organization, WebSite, SoftwareApplication, FAQPage), sitemap, robots. |
| **Free SEO tools** | Plot hole & consistency checker (no account; 12k words; 2 runs/IP/day; global daily spend cap; shows one full issue, the rest locked → signup). Manuscript word counter (runs in the browser, zero cost). |
| **Auth & onboarding** | Google + email/password (Supabase). "What are you writing?" and "Where are you in your journey?" before the first book. |
| **Upload** | DOCX (Word heading styles), text PDF, TXT, Markdown. Chapter, scene-break and front-matter detection; stored as Book → Version → Chapter → Paragraph. Original file in private storage. |
| **Analysis pipeline** | Background worker. Per-chapter extraction on the fast model → cross-chapter entity linking → character profiles → contradiction, timeline and plot-thread checks on the reasoning model → deterministic pacing notes. |
| **Story Bible** | Characters (profile with goal, fear, arc and facts by chapter), places/objects/organizations, relationships, timeline. |
| **Consistency** | Issues by severity and category, side-by-side evidence, "Could be intentional" and a suggestion, *View in manuscript* deep links, Mark fixed / It's intentional (dismissals persist across re-analysis). |
| **Pacing** | Momentum chart, per-chapter tension/conflict/emotion/dialogue table, slow-chapter and no-turning-point notes, framed as recommendations. |
| **Ask your book** | Search-backed Q&A. Answers say whether the text *establishes*, *implies* or *doesn't establish* something, with verified citations. Respects "by Chapter N". |
| **Free-to-paid** | Books longer than the plan allows get their opening chapters analyzed (up to the plan limit), with an upgrade banner for the rest. |
| **Editorial report** | Phase 2. A developmental edit of the whole manuscript from three perspectives (developmental editor, character editor, reader): overview, structure/clarity/character/pacing scores with rationale, priority revisions with verified evidence, strengths, story (or argument) structure beats, character notes, chapter-by-chapter reader experience, and a revision plan ordered by dependency. Download as PDF via a print stylesheet. Monthly allowance per plan. |
| **Admin dashboard** | `/app/admin` for emails in `ADMIN_EMAILS`: users, conversion, estimated MRR, AI cost by feature and as a share of MRR, activation funnel, job health, failed runs, recent signups. |
| **Accuracy eval** | `npm run eval` runs the full pipeline on `eval/fixtures/` manuscripts with planted contradictions and decoys, and reports recall, precision, false positives and cost per 100k words. |
| **Billing** | Stripe Checkout, Customer Portal and webhook sync. Free / Author $15 / Pro $39 / Studio $99, with monthly word and question allowances. Paid plans get queue priority. |
| **Privacy** | Row Level Security on every table, private storage bucket, delete a book with everything in it, no training on manuscripts. |

### How Verse earns trust (and avoids false alarms)

- **Every quote is verified.** The model must cite a paragraph and quote it word for word. `src/lib/analysis/evidence.ts` checks the quote really exists (tolerating curly quotes, dashes and ellipses) and fixes off-by-one paragraph numbers. Anything that can't be verified is dropped before an author sees it.
- **Precision over recall.** The checker prompts rule out lying characters, unreliable narrators, explained change and open mysteries. A contradiction needs at least two verified facts. Each issue explains how it might be intentional.
- **Answers admit gaps.** If Ask Your Book can't verify any citation, an "established" answer is downgraded to "implied".

### How Verse protects margins

- **Two model tiers** (`src/lib/ai/client.ts`). `claude-haiku-4-5` does high-volume per-chapter extraction and profiles. `claude-opus-5-5` handles the reasoning-heavy steps: entity resolution, contradictions, timeline, threads and answers. Override either with `AI_FAST_MODEL` / `AI_REASONING_MODEL`.
- **Incremental re-analysis.** Extractions are cached by chapter content hash. Re-uploading a revision only bills the chapters that changed.
- **Metering.** Every run and question records tokens and estimated USD cost in `usage_events` and `analysis_runs`, so you can track cost per user from day one.
- **Free-tool guardrails.** Word cap, per-IP limit (salted hash) and a global daily budget (`FREE_TOOL_DAILY_BUDGET_USD`).

Rough cost: about $1 of model spend per 100k newly analyzed words. Measure this on real manuscripts before final pricing (see *Before launch*).

## Architecture

```
Next.js 16 (App Router, TypeScript, Tailwind v4)
├── src/app/(marketing)     public site + free tools (static, SEO)
├── src/app/(auth)          login / signup
├── src/app/app             authenticated workspace
├── src/app/api             upload, analyze, run status, ask, issues, billing, Stripe webhook, free checker
├── src/lib/manuscript      parsing (DOCX/PDF/TXT/MD) + chapter/scene structure
├── src/lib/analysis        extract → graph → profiles → checks → pipeline; ask; evidence verification
├── src/lib/ai              Claude client (structured outputs, cost tracking, retries, refusal fallback)
└── scripts/worker.ts       background analysis worker (Postgres queue, SKIP LOCKED)

Supabase: Postgres + Auth + Storage   (supabase/migrations/0001_init.sql)
Stripe:   subscriptions                Anthropic: Claude API
```

Analysis runs in a separate long-running worker, not in a web request: a full novel takes minutes. The worker claims jobs with `claim_analysis_run()` (`FOR UPDATE SKIP LOCKED`), so you can run several. Crashed runs are reclaimed after 20 minutes, up to 3 attempts.

## Setup

1. **Install:** `npm install`
2. **Supabase:** create a project. Run the files in `supabase/migrations/` in order (or `supabase db push`). Under Authentication → Providers, enable Email and Google. Add `{SITE_URL}/auth/callback` to the allowed redirect URLs.
3. **Anthropic:** create an API key.
4. **Stripe:** create three products (Author, Pro, Studio), each with a monthly and a yearly price. Add a webhook to `{SITE_URL}/api/stripe/webhook` for `customer.subscription.created|updated|deleted`. Enable the Customer Portal.
5. **Env:** `cp .env.example .env.local` and fill it in.
6. **Run:** `npm run dev` (web) and `npm run worker` (analysis) in two terminals.

### Deploy

- **Web:** Vercel (or any Node host). Set the env vars. The free checker route uses `maxDuration = 300`.
- **Worker:** any always-on Node host (Railway, Render, Fly.io, a small VM) running `npm run worker` with the same env vars. Scale by adding instances.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` | Analysis and report worker |
| `npm run eval` | Accuracy eval against `eval/fixtures/` (calls the API; costs a few cents per fixture) |
| `npm test` | Unit tests (parser, evidence verification, graph linking, pacing, fingerprints) |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run brand` | Re-render the icon and Open Graph image from `public/brand/` |

## Before launch (not code — needs you)

1. **Calibrate on real manuscripts.** Run `npm run eval`. Then add 5–10 more fixtures (ideally real chapters from beta authors, with permission) to `eval/fixtures/`, each with a `.expected.json` listing planted contradictions and decoys. Tune the prompts in `src/lib/analysis/checks.ts` until recall and precision are where you want them, and bump `PIPELINE_VERSION` after prompt changes. This matters more than any feature.
2. **Measure cost per 100k words**: the eval prints it, and `/app/admin` shows live cost as a share of MRR. Confirm the plan allowances in `src/lib/plans.ts` keep healthy margins.
3. **Legal review** of `/terms` and `/privacy`. Confirm the zero-training and data-retention terms with your AI provider.
4. **Real testimonials only.** The homepage shows no testimonials until you have real ones from beta authors.
5. Set `NEXT_PUBLIC_CONTACT_EMAIL` to a mailbox you own.

## Roadmap (from the blueprint)

- **Phase 2 — Editorial intelligence:** ✅ editorial report with structure beats. Next: themes, genre-specialist editors.
- **Phase 3 — Publishing:** metadata and description generator, KDP/IngramSpark validation, EPUB and print PDF.
- **Phase 4 — Marketing:** reader persona, launch planner, description optimizer.
- **Phase 5 — Growth:** more free tools, topic-cluster content, comparison pages, Studio client workspaces.
- **Infra:** semantic retrieval (pgvector embeddings) alongside full-text search for Ask Your Book; product analytics events (e.g. first issue viewed) to complement the database-derived funnel.

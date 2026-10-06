@AGENTS.md

# Verse

AI editorial workspace for authors. See README.md for architecture and setup.

- Run `npm test`, `npm run typecheck` and `npm run lint` before committing.
- Every AI-surfaced claim must carry evidence verified by `src/lib/analysis/evidence.ts`. Don't show unverified quotes.
- Bump `PIPELINE_VERSION` in `src/lib/analysis/extract.ts` when extraction prompts or schemas change. Otherwise cached chapter extractions are reused.
- AI schemas use `z.enum(...).catch(fallback)`: the SDK moves enums into descriptions, so they aren't enforced server-side.
- Manuscript writes go through the service-role client only after ownership is checked with the user's RLS-bound client.
- Brand: ivory/ink/burgundy/gold tokens in `src/app/globals.css`; Playfair Display for headings, Inter for UI.

# Dangerous Goods Classification and Transportation Chat Assistant

Source-backed dangerous goods Q&A using the **UN Orange Book** (Model Regulations, Rev. 24).

**Core principle:** No citation = no answer.

## Phase 2 (current)

- PDF ingestion from approved UN Orange Book URLs (Vol I & II)
- OpenAI embeddings + `match_chunks` semantic search
- `/api/chat` — Intake → Evidence → Response orchestration with citations
- `/api/admin/ingest` — protected ingestion endpoint
- Live chat UI with citation panel

## Phase 1 (complete)

- Next.js 15 + TypeScript + Tailwind
- UL-inspired landing page
- Supabase schema migrations
- Golden evaluation set (50 questions) + harness (`npm run eval`)

## Quick start

```bash
npm install
cp .env.example .env.local   # fill Supabase keys when ready
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Install CLI: `npm i -g supabase` (or use `npx supabase`).
3. Link and push migrations:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

4. Copy project URL and anon key into `.env.local`.

## Ingest knowledge base (required before chat works)

1. Add `INGEST_SECRET` to `.env.local` (any long random string).
2. **Index ADN Table C first** (UN numbers, proper shipping names, classes — default substance lookup):

   **If UNECE returns 403:** download [Table C PDF](https://unece.org/DAM/trans/danger/publi/adn/adn2011/English/7-TableC-E.pdf), save as `data/pdfs/table-c-adn.pdf` (see `data/pdfs/README.md`).

```bash
npm run ingest:table-c      # ADN 2011 Table C (dangerous goods list)
npm run ingest              # Table C + Orange Book Vol I & II
npm run ingest -- --source vol-1   # Orange Book volume I only
```

3. Run Orange Book volumes if not using `npm run ingest` (may take 30–60+ min per volume).

Or via API (with dev server running):

```bash
curl -X POST http://localhost:3000/api/admin/ingest \
  -H "Authorization: Bearer YOUR_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"sourceId":"vol-1"}'
```

3. Confirm `documents` rows are `active` in Supabase Table Editor.

## Evaluation

```bash
npm run eval       # structural harness check
npm run eval:ci    # CI mode
```

Domain reviewers: see `evaluation/README.md`.

## Approved sources (v1)

- **Substance / UN lookup (primary):** [ADN 2011 Table C — Dangerous Goods List](https://unece.org/DAM/trans/danger/publi/adn/adn2011/English/7-TableC-E.pdf)
- [Volume I](https://unece.org/sites/default/files/2025-09/ST_SG_AC10_1_Rev24e_Vol%20I_1.pdf)
- [Volume II](https://unece.org/sites/default/files/2025-09/ST_SG_AC10_1_Rev24e_Vol_II_1.pdf)

## Roadmap

| Phase | Focus |
|-------|--------|
| 1 | Scaffold, eval set, landing UI, DB schema ✓ |
| 2 | Ingestion, embeddings, `/api/chat`, RAG ✓ |
| 3 | RLS hardening, red team, PR eval gate |
| 4 | UX polish, export, demo |

## Deploy (Vercel)

Connect this repo to Vercel and set environment variables from `.env.example`.

## Disclaimer

Internal prototype for informational support only. Not legal advice, certification, or a final regulatory determination.

# Nebraska Bill Summaries — Starter (Static Snapshot + Pages Deploy)

This starter fetches **Nebraska Legislature** bills via **Open States API v3**, enriches with official PDFs, stores in Postgres, and renders a **filterable/searchable** list in Next.js.

It now includes:
- **Static export** snapshots (`next.config.ts` with `output: 'export'` → `/out`)
- **Server components** that query Postgres at build-time for the snapshot
- **Client-side filters** (work in the static snapshot)
- **GitHub Pages workflow** to publish `/out` (optionally on a schedule)

## Quick start (local dev runtime)

1. Create a Postgres database and run the schema:

```bash
psql $DATABASE_URL -f db/schema.sql
```

2. Copy `.env.example` to `.env` and fill in:
   - `OPENSTATES_API_KEY`
   - `DATABASE_URL`

3. Install & run:

```bash
npm install
npm run etl   # import recent bills
npm run dev   # open http://localhost:3000
```

## Static snapshot build

```bash
npm run build   # creates ./out with static HTML/CSS/JS
```

For CI/CD to GitHub Pages, set repository **Settings → Pages → Source: GitHub Actions**.
Secrets required in GitHub Actions:
- `OPENSTATES_API_KEY`
- `DATABASE_URL`

> Note: Static export renders a **point-in-time** view. Filters/search work **client-side** against the preloaded dataset. For large datasets, consider paging or pre-splitting JSON data files.

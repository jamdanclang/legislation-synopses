# Nebraska Bill Summaries — JSON + Static Export

A small **Python ETL** pulls Nebraska bills from **Open States** and writes JSON files. **Next.js** reads those JSON files **at build time** and exports a static site to `/out`, which the included **GitHub Actions** workflow deploys to **GitHub Pages**.

## Quick start (local)

1) Create a virtual env (optional) and install Python deps:
```bash
python -m pip install -U requests beautifulsoup4
```

2) Set your Open States API key and run the ETL to generate JSON:
```bash
# Windows (PowerShell)
$env:OPENSTATES_API_KEY="YOUR_KEY"
python scripts/etl.py

# macOS/Linux
export OPENSTATES_API_KEY="YOUR_KEY"
python scripts/etl.py
```

3) Install Node deps & run locally:
```bash
npm install
npm run dev   # http://localhost:3000
```

4) Build a static snapshot:
```bash
npm run build   # writes ./out
```

## GitHub Pages (auto updates)

- Add these **Actions secrets** in your GitHub repo:
  - `OPENSTATES_API_KEY`

- Push to `main`. The workflow at `.github/workflows/pages.yml` will:
  1) Set up Python
  2) Run `scripts/etl.py` (creates `data/bills.json`)
  3) Build Next.js with `output: 'export'`
  4) Publish `/out` to GitHub Pages

> The site is a **point-in-time snapshot** of the JSON generated during the workflow run.

## Files of interest
- `scripts/etl.py` — Python script that fetches bills and outputs `data/bills.json`
- `data/bills.json` — Generated data (safe to commit or ignore; the workflow generates it anyway)
- `app/page.tsx` — List of bills with client-side filters (reads `data/bills.json` at build)
- `app/bill/[id]/page.tsx` — Bill detail pages (pre-generated at build)


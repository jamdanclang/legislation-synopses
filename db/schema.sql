-- Postgres schema for Nebraska Bill Summaries
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS bills (
  id BIGSERIAL PRIMARY KEY,
  os_id TEXT UNIQUE,
  number TEXT NOT NULL,
  session TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT,
  introduced_date DATE,
  sponsor TEXT,
  committee TEXT,
  official_url TEXT,
  text_pdf_url TEXT,
  soi_pdf_url TEXT,
  fiscal_pdf_url TEXT,
  general_summary TEXT,
  impact_summary TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agencies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bill_agencies (
  bill_id BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  agency_id BIGINT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  PRIMARY KEY (bill_id, agency_id)
);

CREATE INDEX IF NOT EXISTS bills_title_idx ON bills USING GIN (to_tsvector('english', unaccent(title)));
CREATE INDEX IF NOT EXISTS bills_summary_idx ON bills USING GIN (to_tsvector('english', unaccent(coalesce(general_summary,'') || ' ' || coalesce(impact_summary,''))));
CREATE INDEX IF NOT EXISTS bills_number_idx ON bills (number);

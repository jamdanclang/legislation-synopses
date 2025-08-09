import 'dotenv/config';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import { sql } from '../db.js';
import { AGENCY_SEED, detectAgencies } from '../agency_map.js';

const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY!;
const LOOKBACK_DAYS = Number(process.env.ETL_LOOKBACK_DAYS || '7');
const NE_REQUEST_DELAY_MS = Number(process.env.NE_REQUEST_DELAY_MS || '600');

if (!OPENSTATES_API_KEY) {
  console.error('Missing OPENSTATES_API_KEY');
  process.exit(1);
}

async function delay(ms:number) { return new Promise(r => setTimeout(r, ms)); }

async function ensureAgencies() {
  for (const a of AGENCY_SEED) {
    await sql.none(`INSERT INTO agencies (name, slug) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, [a.name, a.slug]);
  }
}

function dateToIso(d: Date) {
  const pad = (n:number) => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

async function fetchOpenStatesBills() {
  const since = new Date(Date.now() - LOOKBACK_DAYS*24*3600*1000);
  const created_since = dateToIso(since);
  const url = new URL('https://v3.openstates.org/bills');
  url.searchParams.set('jurisdiction', 'Nebraska');
  url.searchParams.set('created_since', created_since);
  url.searchParams.set('sort', '-created_at');
  url.searchParams.set('per_page', '50');
  const headers = { 'X-API-KEY': OPENSTATES_API_KEY };
  const out:any[] = [];
  let page = 1;
  while (true) {
    url.searchParams.set('page', String(page));
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('OpenStates error ' + res.status);
    const data = await res.json();
    out.push(...data.results);
    if (!data.pagination || page >= (data.pagination.max_page || 1)) break;
    page++;
  }
  return out;
}

function firstNebraskaBillUrl(item:any): string | null {
  const src = (item.sources || []).find((s:any) => typeof s.url === 'string' && s.url.includes('nebraskalegislature.gov'));
  return src?.url || null;
}

async function scrapeNebraskaBill(officialUrl:string) {
  const res = await fetch(officialUrl);
  if (!res.ok) return {};
  const html = await res.text();
  const $ = cheerio.load(html);
  let soi:string|undefined, fiscal:string|undefined, textPdf:string|undefined;
  $('a').each((_, el) => {
    const label = ($(el).text() || '').trim();
    const href = $(el).attr('href') || '';
    const url = new URL(href, officialUrl).href;
    if (/Statement of Intent/i.test(label)) soi = url;
    if (/Fiscal Note/i.test(label)) fiscal = url;
    if (/Introduced/i.test(label) || /Bill Text/i.test(label)) textPdf = url;
  });
  return { soi_pdf_url: soi, fiscal_pdf_url: fiscal, text_pdf_url: textPdf };
}

function summarize(title:string, text:string) {
  const clean = text.replace(/\s+/g,' ').slice(0, 500);
  return {
    general: `${title}. ${clean}`.slice(0, 400),
    impact: `Likely impacts primary administering agencies referenced in the statement/fiscal note; operational and fiscal changes possible.`
  };
}

async function upsertBill(item:any) {
  const identifier = item.identifier;
  const number = identifier;
  const title = item.title || '(no title)';
  const status = (item.latest_action || item.classification || []).toString();
  const introduced_date = (item.first_action_date || item.created_at || '').slice(0,10);
  const sponsor = (item.sponsorships || [])[0]?.name || null;
  const committee = (item.actions || []).find((a:any) => /committee/i.test(a.description || ''))?.organization || null;
  const official_url = firstNebraskaBillUrl(item) || null;

  let soi_pdf_url:string|undefined, fiscal_pdf_url:string|undefined, text_pdf_url:string|undefined;
  if (official_url) {
    const scraped = await scrapeNebraskaBill(official_url);
    soi_pdf_url = scraped.soi_pdf_url;
    fiscal_pdf_url = scraped.fiscal_pdf_url;
    text_pdf_url = scraped.text_pdf_url;
    await delay(NE_REQUEST_DELAY_MS);
  }

  const { general, impact } = summarize(title, title);

  const row = await sql.one(`
    INSERT INTO bills (os_id, number, session, title, status, introduced_date, sponsor, committee, official_url, text_pdf_url, soi_pdf_url, fiscal_pdf_url, general_summary, impact_summary, last_seen_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
    ON CONFLICT (os_id) DO UPDATE SET
      number = EXCLUDED.number,
      session = EXCLUDED.session,
      title = EXCLUDED.title,
      status = EXCLUDED.status,
      introduced_date = EXCLUDED.introduced_date,
      sponsor = EXCLUDED.sponsor,
      committee = EXCLUDED.committee,
      official_url = EXCLUDED.official_url,
      text_pdf_url = EXCLUDED.text_pdf_url,
      soi_pdf_url = EXCLUDED.soi_pdf_url,
      fiscal_pdf_url = EXCLUDED.fiscal_pdf_url,
      general_summary = EXCLUDED.general_summary,
      impact_summary = EXCLUDED.impact_summary,
      last_seen_at = NOW()
    RETURNING id
  `, [
    item.id, number, item.session || '', title, status || null, introduced_date || null, sponsor, committee, official_url, text_pdf_url || null, soi_pdf_url || null, fiscal_pdf_url || null, general, impact
  ]);

  for (const a of detectAgencies(title)) {
    await sql.none(`INSERT INTO bill_agencies (bill_id, agency_id)
      SELECT $1, id FROM agencies WHERE slug = $2
      ON CONFLICT DO NOTHING`, [row.id, a.slug]);
  }
}

async function main() {
  await ensureAgencies();
  const items = await fetchOpenStatesBills();
  console.log('Fetched', items.length, 'bills from Open States');
  for (const item of items) {
    try { await upsertBill(item); }
    catch (e:any) { console.error('Upsert failed for', item?.identifier, e?.message); }
  }
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });

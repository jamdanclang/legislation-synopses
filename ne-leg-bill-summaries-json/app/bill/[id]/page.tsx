
// app/bill/[id]/page.tsx
import fs from 'node:fs';
import path from 'node:path';

export const revalidate = false;
export const dynamic = 'error';
export const dynamicParams = false;

function allBills() {
  const p = path.join(process.cwd(), 'data', 'bills.json');
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export async function generateStaticParams() {
  const bills = allBills();
  // Pre-render up to 300 bill detail pages
  return bills.slice(0, 300).map((b: any) => ({ id: String(b.id) }));
}

export default function Page({ params }: { params: { id: string } }) {
  const bill = allBills().find((b: any) => String(b.id) === params.id);
  if (!bill) return <div className="p-4">Not found.</div>;
  return (
    <div className="card p-4 space-y-3">
      <h1 className="text-xl font-semibold">{bill.number}: {bill.title}</h1>
      <div className="text-sm text-gray-600">Status: {bill.status ?? '—'} • Introduced: {bill.introduced_date ?? '—'}</div>
      <div className="flex gap-2 flex-wrap">
        {(bill.agencies || []).map((a: any) => <span key={a.slug} className="badge">{a.name}</span>)}
      </div>
      {bill.general_summary && (<div><h2 className="font-semibold">Summary</h2><p>{bill.general_summary}</p></div>)}
      {bill.impact_summary && (<div><h2 className="font-semibold">Impact</h2><p>{bill.impact_summary}</p></div>)}
      <div className="space-x-3">
        {bill.official_url && <a className="text-blue-700" href={bill.official_url} target="_blank">Official Page</a>}
        {bill.text_pdf_url && <a className="text-blue-700" href={bill.text_pdf_url} target="_blank">Bill PDF</a>}
        {bill.soi_pdf_url && <a className="text-blue-700" href={bill.soi_pdf_url} target="_blank">Statement of Intent</a>}
        {bill.fiscal_pdf_url && <a className="text-blue-700" href={bill.fiscal_pdf_url} target="_blank">Fiscal Note</a>}
      </div>
      <p className="text-xs text-gray-500">This page was statically generated during the snapshot build.</p>
    </div>
  );
}

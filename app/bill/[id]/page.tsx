import { query } from '@/server/db';
import type { Bill } from '@/types';

export const revalidate = false;

export async function generateStaticParams() {
  const rows = await query(`
    SELECT id FROM bills ORDER BY introduced_date DESC NULLS LAST, id DESC LIMIT 200
  `);
  return rows.map((r:any) => ({ id: String(r.id) }));
}

async function getBill(id: number): Promise<Bill | null> {
  const rows = await query(`
    SELECT b.*,
      COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name, 'slug', a.slug)) FILTER (WHERE a.id IS NOT NULL), '[]') AS agencies
    FROM bills b
    LEFT JOIN bill_agencies ba ON ba.bill_id = b.id
    LEFT JOIN agencies a ON a.id = ba.agency_id
    WHERE b.id = $1
    GROUP BY b.id
  `, [id]);
  return rows[0] || null;
}

export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const bill = await getBill(id);
  if (!bill) return <div className="p-4">Not found.</div>;
  return (
    <div className="card p-4 space-y-3">
      <h1 className="text-xl font-semibold">{bill.number}: {bill.title}</h1>
      <div className="text-sm text-gray-600">Status: {bill.status ?? '—'} • Introduced: {bill.introduced_date ?? '—'}</div>
      <div className="flex gap-2 flex-wrap">
        {bill.agencies.map((a:any) => <span key={a.id} className="badge">{a.name}</span>)}
      </div>
      {bill.general_summary && (
        <div>
          <h2 className="font-semibold">Summary</h2>
          <p>{bill.general_summary}</p>
        </div>
      )}
      {bill.impact_summary && (
        <div>
          <h2 className="font-semibold">Impact</h2>
          <p>{bill.impact_summary}</p>
        </div>
      )}
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

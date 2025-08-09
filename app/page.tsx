import BillTable from '@/components/BillTable';
import { query } from '@/server/db';
import type { Bill } from '@/types';

export const revalidate = false;

async function getBills(): Promise<Bill[]> {
  const rows = await query(`
    SELECT b.*,
      COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name, 'slug', a.slug)) FILTER (WHERE a.id IS NOT NULL), '[]') AS agencies
    FROM bills b
    LEFT JOIN bill_agencies ba ON ba.bill_id = b.id
    LEFT JOIN agencies a ON a.id = ba.agency_id
    GROUP BY b.id
    ORDER BY introduced_date DESC NULLS LAST, id DESC
    LIMIT 500
  `);
  return rows.map((r:any) => ({ ...r, agencies: r.agencies, session: r.session }));
}

export default async function Page() {
  const bills = await getBills();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nebraska Bill Summaries (Snapshot)</h1>
      <p className="text-sm text-gray-600">This page is a static snapshot generated at build time.</p>
      <BillTable initial={bills as any} />
    </div>
  );
}

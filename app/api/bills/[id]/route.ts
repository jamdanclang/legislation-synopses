import { pool } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const rows = await pool.query(`
    SELECT b.*,
      COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name, 'slug', a.slug)) FILTER (WHERE a.id IS NOT NULL), '[]') AS agencies
    FROM bills b
    LEFT JOIN bill_agencies ba ON ba.bill_id = b.id
    LEFT JOIN agencies a ON a.id = ba.agency_id
    WHERE b.id = $1
    GROUP BY b.id
  `, [id]);
  if (!rows.rows.length) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(rows.rows[0]), { headers: { 'content-type': 'application/json' } });
}

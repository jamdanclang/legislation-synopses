import { NextRequest } from 'next/server';
import { pool } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const search = (searchParams.get('search') || '').trim();
  const agency = (searchParams.get('agency') || '').trim();
  const status = (searchParams.get('status') || '').trim();
  const session = (searchParams.get('session') || '').trim();

  const where = [];
  const params: any[] = [];

  if (search) {
    params.push(search);
    where.push("(to_tsvector('english', unaccent(title || ' ' || coalesce(general_summary,'') || ' ' || coalesce(impact_summary,''))) @@ plainto_tsquery('english', unaccent($" + params.length + ")))");
  }
  if (agency) {
    params.push(agency);
    where.push("EXISTS (SELECT 1 FROM bill_agencies ba JOIN agencies a ON a.id = ba.agency_id WHERE ba.bill_id = bills.id AND (a.slug = $" + params.length + " OR a.name ILIKE '%' || $" + params.length + " || '%'))");
  }
  if (status) {
    params.push(status);
    where.push("status ILIKE '%' || $" + params.length + " || '%'");
  }
  if (session) {
    params.push(session);
    where.push("session = $" + params.length);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const count = await pool.query(`SELECT COUNT(*)::text AS count FROM bills ${whereSql}`, params);
  const total = parseInt(count.rows[0].count, 10);

  params.push(pageSize);
  params.push((page - 1) * pageSize);

  const rows = await pool.query(`
    SELECT b.*,
      COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name, 'slug', a.slug)) FILTER (WHERE a.id IS NOT NULL), '[]') AS agencies
    FROM bills b
    LEFT JOIN bill_agencies ba ON ba.bill_id = b.id
    LEFT JOIN agencies a ON a.id = ba.agency_id
    ${whereSql}
    GROUP BY b.id
    ORDER BY introduced_date DESC NULLS LAST, id DESC
    LIMIT $${params.length-1} OFFSET $${params.length}
  `, params);

  return new Response(JSON.stringify({ data: rows.rows, total }), { headers: { 'content-type': 'application/json' } });
}

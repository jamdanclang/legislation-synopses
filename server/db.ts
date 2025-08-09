import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function query(q: string, params?: any[]) {
  const res = await pool.query(q, params);
  return res.rows;
}

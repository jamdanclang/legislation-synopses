import fs from 'node:fs';
import path from 'node:path';
import BillTable from './components/BillTable';

export const revalidate = false;

function getBills() {
  const p = path.join(process.cwd(), 'data', 'bills.json');
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export default function Page() {
  const bills = getBills();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nebraska Bill Summaries (Snapshot)</h1>
      <p className="text-sm text-gray-600">This page is a static snapshot generated at build time.</p>
      <BillTable initial={bills} />
    </div>
  );
}

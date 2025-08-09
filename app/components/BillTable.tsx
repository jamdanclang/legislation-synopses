'use client';
import { useMemo, useState } from 'react';
import type { Bill } from '@/types';

export default function BillTable({ initial }: { initial: Bill[] }) {
  const [search, setSearch] = useState('');
  const [agency, setAgency] = useState('');
  const [status, setStatus] = useState('');
  const [session, setSession] = useState('');

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const a = agency.trim().toLowerCase();
    const st = status.trim().toLowerCase();
    const se = session.trim();
    return initial.filter(b => {
      const text = [b.title || '', b.general_summary || '', b.impact_summary || ''].join(' ').toLowerCase();
      const okS = s ? (text.includes(s) || (b.number || '').toLowerCase().includes(s)) : true;
      const okA = a ? b.agencies.some(x => x.slug.toLowerCase().includes(a) || x.name.toLowerCase().includes(a)) : true;
      const okSt = st ? (b.status || '').toLowerCase().includes(st) : true;
      const okSe = se ? (b as any).session === se : true;
      return okS && okA && okSt && okSe;
    });
  }, [search, agency, status, session, initial]);

  return (
    <div className="space-y-4">
      <div className="card p-3 grid gap-3 md:grid-cols-4">
        <input className="input" placeholder="Search title & summaries" value={search} onChange={e=>setSearch(e.target.value)} />
        <input className="input" placeholder="Session (e.g., 109)" value={session} onChange={e=>setSession(e.target.value)} />
        <input className="input" placeholder="Status (e.g., introduced)" value={status} onChange={e=>setStatus(e.target.value)} />
        <input className="input" placeholder="Agency (name or slug)" value={agency} onChange={e=>setAgency(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table>
          <thead>
            <tr>
              <th className="w-[110px]">Bill</th>
              <th>Title</th>
              <th className="w-[120px]">Status</th>
              <th className="w-[140px]">Introduced</th>
              <th className="w-[220px]">Agencies</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id}>
                <td><a className="text-blue-700" href={'/bill/'+b.id}>{b.number}</a></td>
                <td>
                  <div className="font-medium">{b.title}</div>
                  {b.general_summary && <div className="text-sm text-gray-600">{b.general_summary}</div>}
                </td>
                <td>{b.status ?? ''}</td>
                <td>{b.introduced_date ?? ''}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {b.agencies.map(a => <span key={a.id} className="badge">{a.name}</span>)}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">No results.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

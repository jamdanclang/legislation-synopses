export const AGENCY_SEED = [
  { name: 'Department of Health and Human Services', slug: 'dhhs', hints: ['Department of Health and Human Services', 'DHHS'] },
  { name: 'Department of Revenue', slug: 'revenue', hints: ['Department of Revenue'] },
  { name: 'Department of Education', slug: 'education', hints: ['Department of Education', 'NDE'] },
  { name: 'Department of Transportation', slug: 'dot', hints: ['Department of Transportation', 'NDOT'] },
  { name: 'State Fire Marshal', slug: 'sfm', hints: ['State Fire Marshal'] },
  { name: 'Department of Labor', slug: 'labor', hints: ['Department of Labor'] },
];

export function detectAgencies(text: string) {
  const found = new Set<string>();
  for (const a of AGENCY_SEED) {
    for (const h of a.hints) {
      const r = new RegExp(`\\b${h.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
      if (r.test(text)) found.add(a.slug);
    }
  }
  return AGENCY_SEED.filter(a => found.has(a.slug));
}

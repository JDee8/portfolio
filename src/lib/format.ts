const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-05" → "May 2026", "2009" → "2009" */
export function month(ym: string) {
  const [year, m] = ym.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${year}` : year;
}

/** "May 2026 — Now" */
export function range(start?: string, end?: string | null) {
  const to = end ? month(end) : 'Now';
  return start ? `${month(start)} — ${to}` : to;
}

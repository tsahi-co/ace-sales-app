// Daily sales targets for ACE
// Key: YYYY-MM-DD, Value: target in ILS
export const ACE_DAILY_TARGETS: Record<string, number> = {
  '2026-06-01': 290000,
  '2026-06-02': 300000,
  '2026-06-03': 470000,
  '2026-06-04': 450000,
  '2026-06-05': 350000,
  '2026-06-06': 450000,
  '2026-06-07': 850000,
  '2026-06-08': 750000,
  '2026-06-09': 570000,
  '2026-06-10': 450000,
  '2026-06-11': 450000,
  '2026-06-12': 350000,
  '2026-06-13': 450000,
  '2026-06-14': 850000,
  '2026-06-15': 750000,
  '2026-06-16': 570000,
  '2026-06-17': 470000,
  '2026-06-18': 450000,
  '2026-06-19': 350000,
  '2026-06-20': 450000,
  '2026-06-21': 850000,
  '2026-06-22': 750000,
  '2026-06-23': 570000,
  '2026-06-24': 465000,
  '2026-06-25': 450000,
  '2026-06-26': 350000,
  '2026-06-27': 450000,
  '2026-06-28': 690000,
  '2026-06-29': 670000,
  '2026-06-30': 539000,
};

// Get total target for a date range
export function getTargetForRange(fromDate: string, toDate: string): number {
  let total = 0;
  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T00:00:00');
  const current = new Date(from);
  while (current <= to) {
    const key = current.toISOString().split('T')[0];
    total += ACE_DAILY_TARGETS[key] || 0;
    current.setDate(current.getDate() + 1);
  }
  return total;
}

// Get target for a single date
export function getTargetForDate(date: string): number {
  return ACE_DAILY_TARGETS[date] || 0;
}
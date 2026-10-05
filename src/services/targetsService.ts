// Revenue Targets Service
// Parses Excel file and stores targets in AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';

const TARGETS_KEY = 'ace_revenue_targets';

export type TargetsMap = Record<string, number>; // key: YYYY-MM-DD, value: target amount

let cachedTargets: TargetsMap = {};

// Load targets from storage
export async function loadTargets(): Promise<TargetsMap> {
  try {
    const stored = await AsyncStorage.getItem(TARGETS_KEY);
    if (stored) {
      cachedTargets = JSON.parse(stored);
    }
  } catch {}
  return cachedTargets;
}

// Get cached targets (sync)
export function getTargets(): TargetsMap {
  return cachedTargets;
}

// Get total target for a date range
export function getTargetForRange(fromDate: string, toDate: string): number {
  let total = 0;
  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T00:00:00');
  const current = new Date(from);
  while (current <= to) {
    const key = current.toISOString().split('T')[0];
    total += cachedTargets[key] || 0;
    current.setDate(current.getDate() + 1);
  }
  return total;
}

// Save targets map to storage
export async function saveTargets(targets: TargetsMap): Promise<void> {
  cachedTargets = targets;
  await AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
}

// Clear all targets
export async function clearTargets(): Promise<void> {
  cachedTargets = {};
  await AsyncStorage.removeItem(TARGETS_KEY);
}

// Parse Excel file content (CSV or tab-separated)
// Expected format: date column + target amount column
export function parseTargetsFromText(text: string): { targets: TargetsMap; count: number; errors: string[] } {
  const targets: TargetsMap = {};
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  for (const line of lines) {
    // Try comma or tab separated
    const parts = line.split(/[,\t]/).map(p => p.trim().replace(/"/g, ''));
    if (parts.length < 2) continue;

    const dateStr = parts[0];
    const amountStr = parts[1].replace(/[,₪\s]/g, '');
    const amount = parseFloat(amountStr);

    if (isNaN(amount)) continue;

    // Try to parse various date formats
    const date = parseDate(dateStr);
    if (!date) {
      if (dateStr.toLowerCase() !== 'date' && dateStr.toLowerCase() !== 'תאריך') {
        errors.push(`Could not parse date: ${dateStr}`);
      }
      continue;
    }

    targets[date] = amount;
  }

  return { targets, count: Object.keys(targets).length, errors };
}

// Parse date from various formats
function parseDate(str: string): string | null {
  if (!str) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD/MM/YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Excel serial number (days since 1900-01-01)
  const serial = parseInt(str);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return null;
}
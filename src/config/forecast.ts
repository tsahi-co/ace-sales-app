// Forecast config - Annual Average based on 401,514 ACE orders (Sep 2025 - Aug 2026)
// Total revenue analyzed: ₪225,877,948.63
// Each entry: [time, cumulativePercent] -
// cumulativePercent = % of daily revenue that has arrived BY this time

export const FORECAST_SCHEDULE: { time: string; cumPct: number }[] = [
  { time: '00:00', cumPct: 1.41 },
  { time: '00:30', cumPct: 2.37 },
  { time: '01:00', cumPct: 3.07 },
  { time: '01:30', cumPct: 3.56 },
  { time: '02:00', cumPct: 3.90 },
  { time: '02:30', cumPct: 4.12 },
  { time: '03:00', cumPct: 4.30 },
  { time: '03:30', cumPct: 4.42 },
  { time: '04:00', cumPct: 4.55 },
  { time: '04:30', cumPct: 4.66 },
  { time: '05:00', cumPct: 4.79 },
  { time: '05:30', cumPct: 4.97 },
  { time: '06:00', cumPct: 5.22 },
  { time: '06:30', cumPct: 5.65 },
  { time: '07:00', cumPct: 6.26 },
  { time: '07:30', cumPct: 7.18 },
  { time: '08:00', cumPct: 8.55 },
  { time: '08:30', cumPct: 10.32 },
  { time: '09:00', cumPct: 12.55 },
  { time: '09:30', cumPct: 15.22 },
  { time: '10:00', cumPct: 18.05 },
  { time: '10:30', cumPct: 21.09 },
  { time: '11:00', cumPct: 24.23 },
  { time: '11:30', cumPct: 27.57 },
  { time: '12:00', cumPct: 30.77 },
  { time: '12:30', cumPct: 34.08 },
  { time: '13:00', cumPct: 37.25 },
  { time: '13:30', cumPct: 40.38 },
  { time: '14:00', cumPct: 43.51 },
  { time: '14:30', cumPct: 46.65 },
  { time: '15:00', cumPct: 49.80 },
  { time: '15:30', cumPct: 52.76 },
  { time: '16:00', cumPct: 55.54 },
  { time: '16:30', cumPct: 58.38 },
  { time: '17:00', cumPct: 61.17 },
  { time: '17:30', cumPct: 64.06 },
  { time: '18:00', cumPct: 67.07 },
  { time: '18:30', cumPct: 70.08 },
  { time: '19:00', cumPct: 73.09 },
  { time: '19:30', cumPct: 76.22 },
  { time: '20:00', cumPct: 79.20 },
  { time: '20:30', cumPct: 82.44 },
  { time: '21:00', cumPct: 85.83 },
  { time: '21:30', cumPct: 89.10 },
  { time: '22:00', cumPct: 92.27 },
  { time: '22:30', cumPct: 95.17 },
  { time: '23:00', cumPct: 97.74 },
  { time: '23:30', cumPct: 100.00 },
];

// Get forecasted daily total based on current revenue and current time
export function getForecastedDaily(currentRevenue: number): number {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${now.getMinutes() < 30 ? '00' : '30'}`;

  // Find the closest slot
  const slot = FORECAST_SCHEDULE.find(s => s.time >= hhmm) || FORECAST_SCHEDULE[FORECAST_SCHEDULE.length - 1];
  if (!slot || slot.cumPct === 0) return 0;

  return (currentRevenue / slot.cumPct) * 100;
}
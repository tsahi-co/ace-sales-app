// Forecast config based on ACE historical data (May 24, 2026)
// Each entry: [time, cumulativePercent] -
// cumulativePercent = % of daily revenue that has arrived BY this time

export const FORECAST_SCHEDULE: { time: string; cumPct: number }[] = [
  { time: '00:00', cumPct: 2.07 },
  { time: '00:30', cumPct: 2.69 },
  { time: '01:00', cumPct: 3.88 },
  { time: '01:30', cumPct: 4.37 },
  { time: '02:00', cumPct: 4.62 },
  { time: '02:30', cumPct: 4.98 },
  { time: '03:00', cumPct: 5.25 },
  { time: '04:00', cumPct: 5.35 },
  { time: '05:30', cumPct: 5.61 },
  { time: '06:00', cumPct: 5.88 },
  { time: '06:30', cumPct: 6.27 },
  { time: '07:00', cumPct: 6.36 },
  { time: '07:30', cumPct: 6.96 },
  { time: '08:00', cumPct: 9.18 },
  { time: '08:30', cumPct: 10.83 },
  { time: '09:00', cumPct: 12.86 },
  { time: '09:30', cumPct: 15.17 },
  { time: '10:00', cumPct: 17.69 },
  { time: '10:30', cumPct: 20.49 },
  { time: '11:00', cumPct: 23.83 },
  { time: '11:30', cumPct: 26.97 },
  { time: '12:00', cumPct: 30.97 },
  { time: '12:30', cumPct: 34.22 },
  { time: '13:00', cumPct: 37.28 },
  { time: '13:30', cumPct: 42.37 },
  { time: '14:00', cumPct: 45.50 },
  { time: '14:30', cumPct: 48.78 },
  { time: '15:00', cumPct: 51.95 },
  { time: '15:30', cumPct: 54.20 },
  { time: '16:00', cumPct: 56.71 },
  { time: '16:30', cumPct: 59.53 },
  { time: '17:00', cumPct: 61.63 },
  { time: '17:30', cumPct: 64.94 },
  { time: '18:00', cumPct: 68.70 },
  { time: '18:30', cumPct: 71.27 },
  { time: '19:00', cumPct: 73.31 },
  { time: '19:30', cumPct: 77.09 },
  { time: '20:00', cumPct: 79.62 },
  { time: '20:30', cumPct: 82.96 },
  { time: '21:00', cumPct: 87.27 },
  { time: '21:30', cumPct: 90.27 },
  { time: '22:00', cumPct: 94.15 },
  { time: '22:30', cumPct: 96.35 },
  { time: '23:00', cumPct: 97.85 },
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

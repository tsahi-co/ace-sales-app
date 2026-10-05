import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, StatusBar, Platform, Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { fetchAllOrders, Order } from '../services/magentoApi';
import { getTargetForRange, loadTargets } from '../services/targetsService';
import { isWeb, safeStorage } from '../utils/platform';

let DateTimePicker: any = null;
if (!isWeb) {
  try { DateTimePicker = require('@react-native-community/datetimepicker').default; } catch {}
}

const ACE_LOGO = require('../../assets/ace.png');

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function displayDate(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}
function fmt(n: number): string {
  return '₪' + Math.round(n).toLocaleString('en-US');
}

interface PeriodResult {
  orders: number;
  revenue: number;
}

export default function AnalyticsScreen({ navigation }: any) {
  const { token, selectedBrand } = useAuth();
  const brand = selectedBrand!;

  // Period A defaults to today, Period B to yesterday
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

  const [aFrom, setAFrom] = useState(new Date(today));
  const [aTo, setATo] = useState(new Date(today));
  const [bFrom, setBFrom] = useState(new Date(yesterday));
  const [bTo, setBTo] = useState(new Date(yesterday));

  const [picker, setPicker] = useState<null | 'aFrom' | 'aTo' | 'bFrom' | 'bTo'>(null);

  const [loading, setLoading] = useState(false);
  const [resultA, setResultA] = useState<PeriodResult | null>(null);
  const [resultB, setResultB] = useState<PeriodResult | null>(null);

  // Target pacing
  const [target, setTarget] = useState(0);
  const [mtdActual, setMtdActual] = useState<number | null>(null);
  const [pacingLoading, setPacingLoading] = useState(false);

  useEffect(() => { loadTargets(); }, []);

  const sumOrders = (orders: Order[]): PeriodResult => {
    let revenue = 0;
    orders.forEach(o => { revenue += o.base_grand_total || 0; });
    return { orders: orders.length, revenue };
  };

  const runComparison = async () => {
    if (!token) return;
    setLoading(true);
    setResultA(null); setResultB(null);
    try {
      const [ordersA, ordersB] = await Promise.all([
        fetchAllOrders(token, formatDate(aFrom), formatDate(aTo), brand),
        fetchAllOrders(token, formatDate(bFrom), formatDate(bTo), brand),
      ]);
      setResultA(sumOrders(ordersA));
      setResultB(sumOrders(ordersB));
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const runPacing = async () => {
    if (!token || brand.id !== 'ace') return;
    setPacingLoading(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const fromStr = formatDate(monthStart);
      const toStr = formatDate(now);
      // Full-month target
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const fullTarget = getTargetForRange(fromStr, formatDate(monthEnd));
      const mtdTarget = getTargetForRange(fromStr, toStr);
      setTarget(fullTarget);
      const orders = await fetchAllOrders(token, fromStr, toStr, brand);
      const actual = sumOrders(orders).revenue;
      setMtdActual(actual);
      setMtdTargetState(mtdTarget);
    } catch (e) {
      // silent
    } finally {
      setPacingLoading(false);
    }
  };

  const [mtdTarget, setMtdTargetState] = useState(0);

  const onPickDate = (which: typeof picker, date?: Date) => {
    setPicker(null);
    if (!date) return;
    if (which === 'aFrom') setAFrom(date);
    else if (which === 'aTo') setATo(date);
    else if (which === 'bFrom') setBFrom(date);
    else if (which === 'bTo') setBTo(date);
  };

  const renderDateField = (label: string, value: Date, which: typeof picker) => (
    <View style={s.dateFieldWrap}>
      <Text style={s.dateFieldLabel}>{label}</Text>
      {isWeb ? (
        <input type="date" value={formatDate(value)}
          onChange={(e: any) => { if (e.target.value) onPickDate(which, new Date(e.target.value)); }}
          style={{ backgroundColor: '#0d1526', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 10px', color: '#eef2ff', fontSize: 13 }} />
      ) : (
        <TouchableOpacity style={s.dateField} onPress={() => setPicker(which)}>
          <Text style={s.dateFieldText}>{displayDate(formatDate(value))}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Comparison deltas — FIXED: Calculate (B - A) / A, not (A - B) / B
  // This shows B's change relative to A baseline
  const revDelta = resultA && resultB && resultA.revenue > 0
    ? ((resultB.revenue - resultA.revenue) / resultA.revenue) * 100 : null;
  const ordDelta = resultA && resultB && resultA.orders > 0
    ? ((resultB.orders - resultA.orders) / resultA.orders) * 100 : null;

  // Pacing projection
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = mtdActual !== null && dayOfMonth > 0
    ? (mtdActual / dayOfMonth) * daysInMonth : null;
  const targetPct = target > 0 && projected !== null ? (projected / target) * 100 : null;

  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={[s.header, { paddingTop: (StatusBar.currentHeight || 0) + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Image source={ACE_LOGO} style={s.headerLogo} resizeMode="contain" />
          <Text style={s.headerText}>Analytics</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Period Comparison ── */}
      <View style={s.card}>
        <Text style={s.cardLabel}>PERIOD COMPARISON</Text>
        <Text style={s.cardDesc}>Compare revenue and orders between two date ranges.</Text>

        <Text style={s.periodTitle}>Period A</Text>
        <View style={s.dateRow}>
          {renderDateField('From', aFrom, 'aFrom')}
          {renderDateField('To', aTo, 'aTo')}
        </View>

        <Text style={s.periodTitle}>Period B</Text>
        <View style={s.dateRow}>
          {renderDateField('From', bFrom, 'bFrom')}
          {renderDateField('To', bTo, 'bTo')}
        </View>

        <TouchableOpacity style={s.runBtn} onPress={runComparison} disabled={loading}>
          {loading ? <ActivityIndicator color="#0a0f1e" /> : <Text style={s.runBtnText}>Compare →</Text>}
        </TouchableOpacity>

        {resultA && resultB && (
          <View style={s.compareResult}>
            <View style={s.compareCol}>
              <Text style={s.compareColTitle}>Period A</Text>
              <Text style={s.compareRev}>{fmt(resultA.revenue)}</Text>
              <Text style={s.compareOrd}>{resultA.orders} orders</Text>
            </View>
            <View style={s.compareVs}>
              <Text style={s.compareVsText}>vs</Text>
            </View>
            <View style={s.compareCol}>
              <Text style={s.compareColTitle}>Period B</Text>
              <Text style={s.compareRev}>{fmt(resultB.revenue)}</Text>
              <Text style={s.compareOrd}>{resultB.orders} orders</Text>
            </View>
          </View>
        )}

        {revDelta !== null && (
          <View style={s.deltaBox}>
            <View style={s.deltaRow}>
              <Text style={s.deltaLabel}>Revenue</Text>
              <Text style={[s.deltaVal, { color: revDelta >= 0 ? '#4caf50' : '#ff6b6b' }]}>
                {revDelta >= 0 ? '▲' : '▼'} {Math.abs(revDelta).toFixed(1)}%
              </Text>
            </View>
            <View style={s.deltaRow}>
              <Text style={s.deltaLabel}>Orders</Text>
              <Text style={[s.deltaVal, { color: (ordDelta || 0) >= 0 ? '#4caf50' : '#ff6b6b' }]}>
                {(ordDelta || 0) >= 0 ? '▲' : '▼'} {Math.abs(ordDelta || 0).toFixed(1)}%
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Target Pacing (ACE only) ── */}
      {brand.id === 'ace' && (
        <View style={s.card}>
          <Text style={s.cardLabel}>TARGET PACING</Text>
          <Text style={s.cardDesc}>Month-to-date performance vs monthly target.</Text>

          <TouchableOpacity style={s.runBtn} onPress={runPacing} disabled={pacingLoading}>
            {pacingLoading ? <ActivityIndicator color="#0a0f1e" /> : <Text style={s.runBtnText}>Calculate Pacing →</Text>}
          </TouchableOpacity>

          {mtdActual !== null && (
            <View style={s.pacingResult}>
              <View style={s.pacingRow}>
                <Text style={s.pacingLabel}>Month-to-date actual</Text>
                <Text style={s.pacingVal}>{fmt(mtdActual)}</Text>
              </View>
              <View style={s.pacingRow}>
                <Text style={s.pacingLabel}>Month-to-date target</Text>
                <Text style={s.pacingVal}>{fmt(mtdTarget)}</Text>
              </View>
              <View style={s.pacingRow}>
                <Text style={s.pacingLabel}>MTD vs target</Text>
                <Text style={[s.pacingVal, { color: mtdActual >= mtdTarget ? '#4caf50' : '#ff9800' }]}>
                  {mtdTarget > 0 ? ((mtdActual / mtdTarget) * 100).toFixed(0) : '—'}%
                </Text>
              </View>

              <View style={s.pacingDivider} />

              <View style={s.pacingRow}>
                <Text style={s.pacingLabel}>Projected month-end</Text>
                <Text style={s.pacingVal}>{projected !== null ? fmt(projected) : '—'}</Text>
              </View>
              <View style={s.pacingRow}>
                <Text style={s.pacingLabel}>Monthly target</Text>
                <Text style={s.pacingVal}>{fmt(target)}</Text>
              </View>

              {targetPct !== null && (
                <View style={s.projectionBadge}>
                  <Text style={[s.projectionText, { color: targetPct >= 100 ? '#4caf50' : '#ff9800' }]}>
                    {targetPct >= 100
                      ? `On track to hit ${targetPct.toFixed(0)}% of target 🎯`
                      : `Projected to reach ${targetPct.toFixed(0)}% of target`}
                  </Text>
                </View>
              )}

              {/* Progress bar */}
              {target > 0 && (
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, {
                    width: `${Math.min((mtdActual / target) * 100, 100)}%`,
                    backgroundColor: mtdActual >= target ? '#4caf50' : '#e8b400',
                  }]} />
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {picker && DateTimePicker && (
        <DateTimePicker
          value={picker === 'aFrom' ? aFrom : picker === 'aTo' ? aTo : picker === 'bFrom' ? bFrom : bTo}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          maximumDate={new Date()}
          onChange={(_: any, d: any) => onPickDate(picker, d)}
        />
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}


const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0d1526', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e2d4a', marginBottom: 16 },
  backBtn: { width: 36, height: 36, backgroundColor: '#1e2d4a', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#e8b400', fontSize: 18, fontWeight: '700' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 44, height: 20 },
  headerText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1e2d4a' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#334466', letterSpacing: 2, marginBottom: 6 },
  cardDesc: { fontSize: 12, color: '#445566', marginBottom: 14, lineHeight: 18 },
  periodTitle: { color: '#8899aa', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateFieldWrap: { flex: 1 },
  dateFieldLabel: { color: '#445566', fontSize: 10, marginBottom: 4 },
  dateField: { backgroundColor: '#0d1526', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#1e2d4a' },
  dateFieldText: { color: '#eef2ff', fontSize: 13, fontWeight: '600' },
  runBtn: { backgroundColor: '#e8b400', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 8 },
  runBtnText: { color: '#0a0f1e', fontWeight: '800', fontSize: 14 },
  compareResult: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: '#0d1526', borderRadius: 10, padding: 14 },
  compareCol: { flex: 1, alignItems: 'center' },
  compareColTitle: { color: '#445566', fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  compareRev: { color: '#e8b400', fontSize: 18, fontWeight: '800' },
  compareOrd: { color: '#8899aa', fontSize: 11, marginTop: 2 },
  compareVs: { paddingHorizontal: 8 },
  compareVsText: { color: '#334455', fontSize: 12, fontWeight: '700' },
  deltaBox: { marginTop: 12, gap: 8 },
  deltaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d1526', borderRadius: 8, padding: 12 },
  deltaLabel: { color: '#8899aa', fontSize: 13, fontWeight: '600' },
  deltaVal: { fontSize: 15, fontWeight: '800' },
  pacingResult: { marginTop: 16 },
  pacingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  pacingLabel: { color: '#8899aa', fontSize: 13 },
  pacingVal: { color: '#eef2ff', fontSize: 14, fontWeight: '700' },
  pacingDivider: { height: 1, backgroundColor: '#1e2d4a', marginVertical: 8 },
  projectionBadge: { backgroundColor: '#0d1526', borderRadius: 8, padding: 12, marginTop: 10, alignItems: 'center' },
  projectionText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  progressTrack: { height: 10, backgroundColor: '#0d1526', borderRadius: 5, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
});
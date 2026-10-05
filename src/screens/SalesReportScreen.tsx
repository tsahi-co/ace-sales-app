import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, AppState, useWindowDimensions, Dimensions, StatusBar, Keyboard, TextInput,
} from 'react-native';

import { Platform } from 'react-native';
import Svg, { Polyline, Polygon, Circle, Defs, LinearGradient, Stop, Text as SvgText, Path, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from 'react-native-svg';
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}
import { isWeb, safeStorage } from '../utils/platform';
import {
  showFetchingNotificationSafe as showFetchingNotification,
  showCompleteNotificationSafe as showCompleteNotification,
  showErrorNotificationSafe as showErrorNotification,
  dismissAllNotificationsSafe as dismissAllNotifications,
  requestNotificationPermission,
} from '../utils/platform';
const ACE_LOGO = require('../../assets/ace.png');
import { useAuth } from '../context/AuthContext';
import { fetchAllOrders, Order, OrderItem } from '../services/magentoApi';
import { getBrandForSku, getTypeForSku, loadOverrides, getUnmappedSkus, fetchAndSaveUnmappedSkus } from '../services/skuBrandService';
import { getForecastedDaily } from '../config/forecast';
import { getTargetForRange, loadTargets } from '../services/targetsService';
import { fetchGA4Data, aggregateGA4BySku } from '../services/ga4Api';

// Web-safe alert
function webAlert(title: string, message?: string) {
  if (isWeb) { window.alert(message ? `${title}\n\n${message}` : title); }
  else { Alert.alert(title, message); }
}

type ViewMode = 'sku' | 'brand' | 'type';
interface SkuSummary {
  sku: string;
  name?: string; brand: string; type: string;
  totalQtyInvoiced: number; totalRevenue: number; orderCount: number;
}
interface DaySummary {
  date: string; skus: SkuSummary[];
  totalRevenue: number; totalQty: number;
}
interface HourlyPoint { hour: string; revenue: number; }

const PAGE_SIZE = 20;
const FOLD_BREAKPOINT = 600;

function formatDate(d: Date) { return d.toISOString().split('T')[0]; }
function displayDate(s: string) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function getDefaults() {
  const to = new Date(); const from = new Date();
  from.setDate(from.getDate() - 7);
  return { from, to };
}
function applyPreset(daysBack: number, setFrom: (d: Date) => void, setTo: (d: Date) => void): void {
  const target = new Date();
  if (daysBack === 7) {
    // Last 7 days: from 6 days ago to today
    const from = new Date();
    from.setDate(from.getDate() - 6);
    setFrom(from);
    setTo(new Date());
    return;
  }
  target.setDate(target.getDate() - daysBack);
  setFrom(new Date(target));
  setTo(new Date(target));
}

function isPresetActive(from: Date, to: Date, daysBack: number): boolean {
  const fmt = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (daysBack === 7) {
    const expFrom = new Date(); expFrom.setDate(expFrom.getDate() - 6);
    const expTo = new Date();
    return fmt(from) === fmt(expFrom) && fmt(to) === fmt(expTo);
  }
  const exp = new Date(); exp.setDate(exp.getDate() - daysBack);
  return fmt(from) === fmt(exp) && fmt(to) === fmt(exp);
}

function isToday(from: Date, to: Date): boolean {
  const today = formatDate(new Date());
  return formatDate(from) === today && formatDate(to) === today;
}
const fmt = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

// ─── Build hourly data from orders ─────────────────────────────────────────
function buildHourlyData(orders: Order[]): HourlyPoint[] {
  const map: Record<string, number> = {};
  for (let h = 0; h < 24; h++) map[String(h).padStart(2, '0')] = 0;
  orders.forEach(o => {
    const h = (o.created_at || '').split(' ')[1]?.split(':')[0] ||
              (o.created_at || '').split('T')[1]?.split(':')[0] || '00';
    map[h] = (map[h] || 0) + (o.base_grand_total || 0);
  });
  return Object.entries(map)
    .filter(([_, v]) => v > 0)
    .map(([hour, revenue]) => ({ hour, revenue }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

// ─── SVG Revenue Line Chart ─────────────────────────────────────────────────
function RevenueLineChart({ data, width, height = 120 }: { data: HourlyPoint[]; width: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.revenue));
  const pad = { l: 8, r: 24, t: 10, b: 24 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;

  const pts = data.map((d, i) => ({
    x: pad.l + (i / Math.max(data.length - 1, 1)) * W,
    y: pad.t + H - (d.revenue / max) * H,
    ...d,
  }));

  const polyPts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPts = `${pts[0].x.toFixed(1)},${(pad.t + H).toFixed(1)} ${polyPts} ${pts[pts.length-1].x.toFixed(1)},${(pad.t + H).toFixed(1)}`;
  const peakPt = pts.reduce((a, b) => a.revenue > b.revenue ? a : b, pts[0]);

  return (
    <Svg width={width} height={height} style={{ overflow: 'visible' }}>
      <Defs>
        <LinearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#e8b400" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#e8b400" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={areaPts} fill="url(#rg2)" />
      <Polyline points={polyPts} fill="none" stroke="#e8b400" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      {/* Peak dot */}
      <Circle cx={peakPt.x} cy={peakPt.y} r="4" fill="#e8b400" />
      {/* Hour labels - every 3 hours */}
      {pts.filter(p => parseInt(p.hour) % 3 === 0).map((p, i) => (
        <SvgText key={i} x={p.x} y={height - 6} textAnchor="middle"
          fill="#445566" fontSize="9">
          {p.hour}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── SKU Bar Chart ──────────────────────────────────────────────────────────
function SkuBarChart({ data, maxItems = 10 }: { data: SkuSummary[]; maxItems?: number }) {
  const top = [...data].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, maxItems);
  const max = top[0]?.totalRevenue || 1;
  return (
    <View style={{ gap: 6 }}>
      {top.map((s, idx) => {
        const pct = Math.max((s.totalRevenue / max) * 100, 3);
        const isAutodepot = s.brand === 'Autodepot';
        const barColor = isAutodepot ? '#e8b400' : '#cc0000';
        return (
          <View key={s.sku}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <Text style={{ color: '#778899', fontSize: 9, fontFamily: 'monospace' }}>
                #{idx + 1} {s.sku}
              </Text>
              <Text style={{ color: '#eef2ff', fontSize: 9, fontWeight: '700' }}>
                {fmt(s.totalRevenue)}
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#0d1526', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{
                height: '100%', width: `${pct}%`, borderRadius: 3,
                backgroundColor: barColor, opacity: 0.9,
              }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Pie Chart (React Native SVG) ──────────────────────────────────────────
function BrandPieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const size = 100;
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;
  const total = data.reduce((s, d) => s + d.value, 0);

  const polarToXY = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos((angle - 90) * Math.PI / 180),
    y: cy + radius * Math.sin((angle - 90) * Math.PI / 180),
  });

  let cumAngle = 0;
  const slices = data.map(d => {
    const start = cumAngle;
    const sweep = (d.value / total) * 360;
    cumAngle += sweep;
    const end = cumAngle;
    const s = polarToXY(start, r);
    const e = polarToXY(end, r);
    const large = sweep > 180 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
    return { ...d, path };
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Svg width={size} height={size}>
        {slices.map((s, i) => (
          <Path key={i} d={s.path} fill={s.color} stroke="#0a0f1e" strokeWidth="1.5" />
        ))}
        <Path d={`M ${cx - r * 0.4} ${cy} A ${r * 0.4} ${r * 0.4} 0 1 1 ${cx + r * 0.4} ${cy} Z`}
          fill="#0a0f1e" />
      </Svg>
      <View style={{ gap: 6 }}>
        {data.map(d => (
          <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color }} />
            <Text style={{ color: '#aabbcc', fontSize: 10 }}>{d.label}</Text>
            <Text style={{ color: '#e8b400', fontSize: 10, fontWeight: '700', marginLeft: 4 }}>
              {Math.round((d.value / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Day Bar Chart ──────────────────────────────────────────────────────────
function DayBarChart({ summaries }: { summaries: DaySummary[] }) {
  if (!summaries.length) return null;
  const last6 = summaries.slice(0, 6).reverse();
  const max = Math.max(...last6.map(d => d.totalRevenue));
  const today = formatDate(new Date());
  const barColors = ['#1e3a5f', '#1e4a6f', '#1e5a7f', '#1e6a8f', '#cc000080', '#e8b400'];
  return (
    <View style={{ gap: 6 }}>
      {last6.map((d, idx) => {
        const isT = d.date === today;
        const pct = Math.max((d.totalRevenue / max) * 100, 5);
        const color = isT ? '#e8b400' : `hsl(210, 60%, ${25 + idx * 5}%)`;
        return (
          <View key={d.date}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <Text style={{ color: isT ? '#e8b400' : '#778899', fontSize: 9, fontWeight: isT ? '700' : '400' }}>
                {displayDate(d.date).slice(0, 5)}
              </Text>
              <Text style={{ color: isT ? '#e8b400' : '#aabbcc', fontSize: 9, fontWeight: isT ? '700' : '400' }}>
                {fmt(d.totalRevenue)}
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#0d1526', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: isT ? '#e8b400' : '#2a5080' }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Chart Card ─────────────────────────────────────────────────────────────
function ChartCard({ title, children, style }: any) {
  return (
    <View style={[foldStyles.chartCard, style]}>
      <Text style={foldStyles.chartLabel}>{title}</Text>
      {children}
    </View>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent }: any) {
  return (
    <View style={[foldStyles.kpiCard, accent && foldStyles.kpiCardAccent]}>
      <Text style={foldStyles.kpiIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={foldStyles.kpiLabel}>{label}</Text>
        <Text style={[foldStyles.kpiValue, accent && { color: '#e8b400' }]}>{value}</Text>
        {sub && <Text style={foldStyles.kpiSub}>{sub}</Text>}
      </View>
    </View>
  );
}

// ─── FOLD OPEN DASHBOARD ────────────────────────────────────────────────────
function FoldDashboard({
  navigation, daySummaries, totalOrders, totalRevenue, hasResults,
  loading, loadingStep, fromDate, toDate, setFromDate, setToDate,
  showFrom, showTo, setShowFrom, setShowTo,
  fetchReport, showForecast, allOrders, brand, target,
  ga4Data, ga4SkuMap, ga4Loading,
  skuFilter, skuFilterInput, skuFilterError, setSkuFilterInput, setSkuFilterError,
  applySkuFilter, clearSkuFilter,
}: any) {
  const { width, height } = useWindowDimensions();
  const statusBarHeight = StatusBar.currentHeight || 0;
  const LEFT = 240;
  // Chart width is measured from the actual panel via onLayout (avoids overflow)
  const [chartW, setChartW] = React.useState(width - LEFT - 72);

  const hourlyData = buildHourlyData(allOrders);
  const allSkus = daySummaries.flatMap((d: DaySummary) => d.skus);
  const forecast = showForecast ? getForecastedDaily(totalRevenue) : 0;

  // Brand split
  const brandGroups: Record<string, number> = {};
  allSkus.forEach((s: SkuSummary) => {
    brandGroups[s.brand] = (brandGroups[s.brand] || 0) + s.totalRevenue;
  });
  const brandColors: Record<string, string> = { Ace: '#cc0000', Autodepot: '#e8b400' };
  const pieData = Object.entries(brandGroups)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([label, value]) => ({ label, value, color: brandColors[label] || '#334455' }));

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1e', paddingTop: statusBarHeight }}>
      {/* ── TOP BAR ── */}
      <View style={foldStyles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={foldStyles.backBtn}>
          <Text style={foldStyles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Image source={ACE_LOGO} style={foldStyles.topLogo} resizeMode="contain" />
        <Text style={foldStyles.topTitle}>Sales Dashboard</Text>
        <Text style={foldStyles.topSub}>
          {displayDate(formatDate(fromDate))}
          {formatDate(fromDate) !== formatDate(toDate) ? ` → ${displayDate(formatDate(toDate))}` : ''}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={foldStyles.liveDot}>
          <View style={foldStyles.liveDotInner} />
          <Text style={foldStyles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* ── BODY ── */}
      <View style={{ flex: 1, flexDirection: 'row' }}>

        {/* LEFT PANEL */}
        <ScrollView style={[foldStyles.leftPanel, { width: LEFT }]} showsVerticalScrollIndicator={false}>
          {/* Date Card */}
          <View style={foldStyles.panel}>
            <Text style={foldStyles.panelLabel}>DATE RANGE</Text>
            <View style={foldStyles.quickDateRow}>
              {([
                { label: 'Today', days: 0 },
                { label: 'Yest.', days: 1 },
                { label: '7d', days: 7 },
              ] as const).map(preset => {
                const active = isPresetActive(fromDate, toDate, preset.days);
                return (
                  <TouchableOpacity key={preset.label}
                    style={[foldStyles.quickDateBtn, active && foldStyles.quickDateBtnActive]}
                    onPress={() => applyPreset(preset.days, setFromDate, setToDate)}>
                    <Text style={[foldStyles.quickDateText, active && foldStyles.quickDateTextActive]}>{preset.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {(['FROM', 'TO'] as const).map((label) => {
              const val = label === 'FROM' ? fromDate : toDate;
              const setter = label === 'FROM' ? setFromDate : setToDate;
              const showState = label === 'FROM' ? showFrom : showTo;
              const setShow = label === 'FROM' ? setShowFrom : setShowTo;
              return (
                <View key={label}>
                  <View style={foldStyles.dateRow}>
                    <Text style={foldStyles.dateLabel}>{label}</Text>
                    {isWeb ? (
                      <input type="date" value={formatDate(val)}
                        onChange={(e: any) => { if (e.target.value) setter(new Date(e.target.value)); }}
                        style={{ flex: 1, backgroundColor: '#0d1526', border: '1px solid #1e2d4a', borderRadius: 8, padding: '6px 10px', color: '#eef2ff', fontSize: 13, outline: 'none' }} />
                    ) : (
                      <TouchableOpacity onPress={() => setShow(true)} style={foldStyles.datePill}>
                        <Text style={foldStyles.datePillText}>{displayDate(formatDate(val))}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {showState && DateTimePicker && (
                    <DateTimePicker value={val} mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                      minimumDate={label === 'TO' ? fromDate : undefined}
                      maximumDate={label === 'FROM' ? toDate : new Date()}
                      onChange={(_: any, d: any) => { setShow(false); if (d) setter(d); }} />
                  )}
                </View>
              );
            })}
            <TouchableOpacity style={foldStyles.runBtn} onPress={fetchReport} disabled={loading}>
              {loading ? <ActivityIndicator color="#0a0f1e" size="small" /> : <Text style={foldStyles.runBtnText}>Run Report →</Text>}
            </TouchableOpacity>
            {loading && <Text style={foldStyles.loadingStep}>{loadingStep}</Text>}

            {/* SKU Filter in fold */}
            {hasResults && (
              <View style={{ marginTop: 8 }}>
                <View style={s.skuFilterRow}>
                  <Text style={s.skuFilterLabel}>🔍</Text>
                  <TextInput
                    style={[s.skuFilterInput, { flex: 1 }]}
                    value={skuFilterInput}
                    onChangeText={t => { setSkuFilterInput(t); setSkuFilterError(''); }}
                    placeholder="Filter by SKU..."
                    placeholderTextColor="#445566"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {skuFilter ? (
                    <TouchableOpacity style={s.skuFilterClear} onPress={clearSkuFilter}>
                      <Text style={s.skuFilterClearText}>✕</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={s.skuFilterBtn} onPress={applySkuFilter}>
                      <Text style={s.skuFilterBtnText}>Go</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {skuFilterError !== '' && <Text style={s.skuFilterError}>⚠️ {skuFilterError}</Text>}
                {skuFilter !== '' && <Text style={s.skuFilterActive}>Filtered: {skuFilter}</Text>}
              </View>
            )}
          </View>

          {hasResults && <>
            {/* KPIs */}
            {[
              { icon: '📦', label: 'ORDERS', value: totalOrders.toLocaleString() },
              { icon: '💰', label: 'REVENUE', value: fmt(totalRevenue), sub: forecast > 0 ? `📈 ${fmt(forecast)}` : undefined, accent: true },
              { icon: '🏷️', label: 'SKUs', value: allSkus.length.toLocaleString() },
              { icon: '📊', label: 'AVG ORDER', value: totalOrders > 0 ? fmt(Math.round(totalRevenue / totalOrders)) : '—' },
            ].map(kpi => (
              <View key={kpi.label} style={[foldStyles.kpiRow, kpi.accent && foldStyles.kpiRowAccent]}>
                <Text style={foldStyles.kpiIcon}>{kpi.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={foldStyles.kpiLabel}>{kpi.label}</Text>
                  <Text style={[foldStyles.kpiVal, kpi.accent && { color: '#e8b400' }]}>{kpi.value}</Text>
                  {kpi.sub && <Text style={foldStyles.kpiSub}>{kpi.sub}</Text>}
                </View>
              </View>
            ))}

            {/* Brand split */}
            <View style={foldStyles.panel}>
              <Text style={foldStyles.panelLabel}>BRAND SPLIT</Text>
              <BrandPieChart data={pieData} />
            </View>

            {/* Weekly bars */}
            <View style={foldStyles.panel}>
              <Text style={foldStyles.panelLabel}>DAY BY DAY</Text>
              <DayBarChart summaries={daySummaries} />
            </View>
          </>}
        </ScrollView>

        {/* RIGHT PANEL */}
        <ScrollView style={foldStyles.rightPanel} showsVerticalScrollIndicator={false}>
          {hasResults ? <>
            {/* Revenue chart */}
            <View style={foldStyles.panel}
              onLayout={(e) => {
                // Panel inner width = layout width minus panel padding (12*2)
                const w = e.nativeEvent.layout.width - 24;
                if (w > 0 && Math.abs(w - chartW) > 2) setChartW(w);
              }}>
              <Text style={foldStyles.panelLabel}>REVENUE BY HOUR</Text>
              <Text style={foldStyles.chartBig}>{fmt(totalRevenue)}</Text>
              {hourlyData.length > 0
                ? <RevenueLineChart data={hourlyData} width={chartW} height={140} />
                : <Text style={{ color: '#445566', fontSize: 11, marginTop: 8 }}>No hourly data</Text>}
            </View>

            {/* Top SKUs */}
            <View style={foldStyles.panel}>
              <Text style={foldStyles.panelLabel}>TOP 10 SKUs BY REVENUE</Text>
              <SkuBarChart data={allSkus} maxItems={10} />
            </View>
          </> : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <Text style={{ fontSize: 48 }}>📊</Text>
              <Text style={{ color: '#445566', fontSize: 14, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
                Select a date range and run the report
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}


// ─── MAIN SCREEN ────────────────────────────────────────────────────────────
export default function SalesReportScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const isFoldOpen = width >= FOLD_BREAKPOINT;

  const { token, selectedBrand, setToken } = useAuth();
  if (!selectedBrand) return null;
  const brand = selectedBrand;
  const def = getDefaults();

  const [fromDate, setFromDate] = useState<Date>(def.from);
  const [toDate, setToDate] = useState<Date>(def.to);
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('sku');
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [hasResults, setHasResults] = useState(false);
  const [isSingleDay, setIsSingleDay] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [showForecast, setShowForecast] = useState(false);
  const [skuFilter, setSkuFilter] = useState('');
  const [skuFilterInput, setSkuFilterInput] = useState('');
  const [skuFilterError, setSkuFilterError] = useState('');
  const [target, setTarget] = useState(0);
  const [ga4Data, setGa4Data] = useState<any>(null);
  const [ga4SkuMap, setGa4SkuMap] = useState<Record<string, any>>({});
  const [ga4Loading, setGa4Loading] = useState(false);
  const notifId = useRef<string | null>(null);

  useEffect(() => { requestNotificationPermission(); loadTargets(); }, []);

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => { appState.current = nextState; });
    return () => sub.remove();
  }, []);

  React.useLayoutEffect(() => {
    // Always hide the system header — we render our own in both layouts
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const toggle = (set: Set<string>, key: string, setter: Function) => {
    setter((prev: Set<string>) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const validateDates = () => {
    const diff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (fromDate > toDate) { webAlert('Invalid range', 'From must be before To.'); return false; }
    if (diff > 31) { webAlert('Too wide', 'Max 31 days.'); return false; }
    return true;
  };

  const applySkuFilter = () => {
    const input = skuFilterInput.trim();
    if (!input) { setSkuFilter(''); setSkuFilterError(''); return; }
    const exists = allSkusRaw.some((s: SkuSummary) => s.sku === input);
    if (!exists) {
      setSkuFilterError(`SKU "${input}" not found in results`);
      return;
    }
    setSkuFilter(input);
    setSkuFilterError('');
    Keyboard.dismiss();
  };

  const clearSkuFilter = () => {
    setSkuFilter('');
    setSkuFilterInput('');
    setSkuFilterError('');
  };

  const fetchReport = async () => {
    if (!validateDates()) return;
    setLoading(true); setHasResults(false); setDaySummaries([]); setAllOrders([]);
    setExpandedDays(new Set()); setExpandedSkus(new Set()); setExpandedBrands(new Set()); setExpandedTypes(new Set());
    setCurrentPage(1);
    const fromStr = formatDate(fromDate); const toStr = formatDate(toDate);
    setIsSingleDay(fromStr === toStr);
    setShowForecast(brand.hasForecast && isToday(fromDate, toDate));
    if (brand.id === 'ace') {
      setTarget(getTargetForRange(fromStr, toStr));
    } else {
      setTarget(0);
    }

    try {
      const reportT0 = Date.now();
      notifId.current = await showFetchingNotification('Fetching orders...');
      let fetchedOrders: Order[] = [];
      try {
        fetchedOrders = await fetchAllOrders(token!, fromStr, toStr, brand, (fetched, total) => {
          setLoadingStep(total > 0 ? `Fetching orders... ${fetched} / ${total}` : 'Fetching orders...');
        });
      } catch (e: any) {
        if (e.message === 'TOKEN_EXPIRED') {
          webAlert('Session Expired', 'Your session has expired. Please log in again.');
          if (selectedBrand) await safeStorage.deleteItem(selectedBrand.tokenKey);
          setToken(null);
          return;
        }
        await showErrorNotification('Could not fetch orders.');
        webAlert('Network Error', 'Could not fetch orders. Please check your connection and try again.');
        setLoading(false); return;
      }

      if (!fetchedOrders.length) {
        await dismissAllNotifications();
        webAlert('No results', 'No orders found.');
        setLoading(false); return;
      }

      setAllOrders(fetchedOrders);
      const skuSet = new Set<string>();
      fetchedOrders.forEach(o => (o.items || []).forEach((i: OrderItem) => { if (i.sku) skuSet.add(i.sku); }));

      setLoadingStep('Loading brand mappings...');
      await loadOverrides(brand);

      setLoadingStep('Building report...');
      const dayMap: Record<string, Record<string, SkuSummary>> = {};
      let grand = 0;
      fetchedOrders.forEach(order => {
        const d = (order.created_at || '').split(' ')[0].split('T')[0];
        grand += order.base_grand_total || 0;
        if (!dayMap[d]) dayMap[d] = {};
        const items = (order.items || []).filter((item: OrderItem) => item.sku);
        // Use qty_ordered (always populated) over qty_invoiced (often 0 for ACE)
        const totalItemValue = items.reduce((sum: number, item: OrderItem) => {
          const qty = item.qty_ordered || item.qty_invoiced || 1;
          return sum + (item.price_incl_tax || 0) * qty;
        }, 0);
        items.forEach((item: OrderItem) => {
          const skuBrand = getBrandForSku(item.sku, brand);
          const skuType = getTypeForSku(item.sku, brand);
          if (!dayMap[d][item.sku]) dayMap[d][item.sku] = { sku: item.sku, name: item.name, brand: skuBrand, type: skuType || 'Unknown', totalQtyInvoiced: 0, totalRevenue: 0, orderCount: 0 };
          const qty = item.qty_ordered || item.qty_invoiced || 1;
          const itemValue = (item.price_incl_tax || 0) * qty;
          const proportion = totalItemValue > 0 ? itemValue / totalItemValue : 1 / items.length;
          dayMap[d][item.sku].totalQtyInvoiced += qty;
          dayMap[d][item.sku].totalRevenue += (order.base_grand_total || 0) * proportion;
          dayMap[d][item.sku].orderCount += 1;
        });
      });

      const days: DaySummary[] = Object.entries(dayMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, m]) => {
          const skus = Object.values(m).sort((a, b) => b.totalRevenue - a.totalRevenue);
          return { date, skus, totalRevenue: skus.reduce((s, x) => s + x.totalRevenue, 0), totalQty: skus.reduce((s, x) => s + x.totalQtyInvoiced, 0) };
        });

      setDaySummaries(days); setTotalOrders(fetchedOrders.length); setTotalRevenue(grand); setHasResults(true);

      // Background: fetch Magento attributes for unmapped SKUs
      const allSkusList = [...new Set(fetchedOrders.flatMap((o: any) => (o.items || []).map((i: any) => i.sku)))];
      fetchAndSaveUnmappedSkus(allSkusList, brand, token || '').then(saved => {
        if (saved > 0) {
          console.log(`[SKU] Auto-mapped ${saved} new SKUs from Magento`);
          // Re-build summaries with updated mappings
          setDaySummaries(prev => prev.map(d => ({
            ...d,
            skus: d.skus.map(sk => ({
              ...sk,
              brand: getBrandForSku(sk.sku, brand),
              type: getTypeForSku(sk.sku, brand),
            })),
          })));
        }
      }).catch(() => {});

      // Fetch GA4 data for ACE brand
      if (brand.id === 'ace') {
        setGa4Loading(true);
        try {
          const ga4 = await fetchGA4Data(fromStr, toStr);
          setGa4Data(ga4);
          setGa4SkuMap(aggregateGA4BySku(ga4.bySku));
        } catch (e) {
          console.log('[GA4] Failed to fetch:', e);
        } finally {
          setGa4Loading(false);
        }
      }
      await showCompleteNotification(fetchedOrders.length, skuSet.size);
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') {
        webAlert('Session Expired', 'Your session has expired. Please log in again.');
        if (selectedBrand) await safeStorage.deleteItem(selectedBrand.tokenKey);
        setToken(null);
      } else {
        await showErrorNotification(e.message || 'Unknown error');
        webAlert('Error', e.message);
      }
    } finally { setLoading(false); setLoadingStep(''); }
  };

  // ── FOLD OPEN: render dashboard (always mounted, shown/hidden via display) ──
  const foldProps = {
    navigation, daySummaries, totalOrders, totalRevenue, hasResults,
    loading, loadingStep, fromDate, toDate, setFromDate, setToDate,
    showFrom, showTo, setShowFrom, setShowTo,
    fetchReport, showForecast, allOrders, brand, target,
    ga4Data, ga4SkuMap, ga4Loading,
    skuFilter, skuFilterInput, skuFilterError, setSkuFilterInput, setSkuFilterError,
    applySkuFilter, clearSkuFilter,
  };

  if (isFoldOpen) {
    return <FoldDashboard {...foldProps} />;
  }

  // ── NARROW: existing layout ───────────────────────────────────────────────
  const allSkus = daySummaries.flatMap(d => d.skus);
  const totalPages = Math.ceil(allSkus.length / PAGE_SIZE);
  const pagedSkus = allSkus.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const renderTypeSection = (skus: SkuSummary[], dayKey: string) => {
    const groups: Record<string, SkuSummary[]> = {};
    skus.forEach(s => { const t = s.type || 'Unknown'; if (!groups[t]) groups[t] = []; groups[t].push(s); });
    return Object.entries(groups).map(([type, items]) => {
      const key = `${dayKey}-type-${type}`;
      const expanded = expandedTypes.has(key);
      const qty = items.reduce((sum, x) => sum + x.totalQtyInvoiced, 0);
      const rev = items.reduce((sum, x) => sum + x.totalRevenue, 0);
      return (
        <View key={key}>
          <TouchableOpacity style={s.brandRow} onPress={() => toggle(expandedTypes, key, setExpandedTypes)} activeOpacity={0.7}>
            <Text style={s.chevron}>{expanded ? '▼' : '▶'}</Text>
            <View style={s.brandRowInfo}>
              <Text style={s.brandRowName}>{type}</Text>
              <Text style={s.brandRowSub}>{items.length} SKUs · {qty.toFixed(0)} units</Text>
            </View>
            <View style={s.brandRowRevWrap}>
              <Text style={s.brandRowRev}>{fmt(rev)}</Text>
            </View>
          </TouchableOpacity>
          {expanded && (
            <View style={s.brandExpandedBox}>
              <View style={s.tableHeader}>
                <Text style={[s.tc, s.tcSku, s.th]}>SKU</Text>
                <Text style={[s.tc, s.tcNum, s.th]}>Qty</Text>
                <Text style={[s.tc, s.tcNum, s.th]}>Revenue</Text>
              </View>
              {items.map((sk, i) => (
                <View key={sk.sku} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
                  <Text style={[s.tc, s.tcSku]} numberOfLines={1}>{sk.sku}</Text>
                  <Text style={[s.tc, s.tcNum]}>{sk.totalQtyInvoiced.toFixed(0)}</Text>
                  <Text style={[s.tc, s.tcNum]}>{fmt(sk.totalRevenue)}</Text>
                </View>
              ))}
              <View style={s.subtotal}>
                <Text style={[s.tc, s.tcSku, s.subtotalText]}>Total</Text>
                <Text style={[s.tc, s.tcNum, s.subtotalText]}>{qty.toFixed(0)}</Text>
                <Text style={[s.tc, s.tcNum, s.subtotalText]}>{fmt(rev)}</Text>
              </View>
            </View>
          )}
        </View>
      );
    });
  };

  const renderSkuRow = (sk: SkuSummary, key: string) => {
    const expanded = expandedSkus.has(key);
    return (
      <View key={key}>
        <TouchableOpacity style={s.skuRow} onPress={() => toggle(expandedSkus, key, setExpandedSkus)} activeOpacity={0.7}>
          <Text style={s.chevron}>{expanded ? '▼' : '▶'}</Text>
          <Text style={s.skuCode} numberOfLines={1}>{sk.sku}</Text>
          <Text style={s.skuRevenue}>{fmt(sk.totalRevenue)}</Text>
          <View style={s.brandPill}><Text style={s.brandPillText}>{sk.brand}</Text></View>
        </TouchableOpacity>
        {expanded && (
          <View style={s.skuDetail}>
            {sk.name ? <Text style={s.productName}>{sk.name}</Text> : null}
            <View style={s.detailRow}><Text style={s.detailLabel}>Qty</Text><Text style={s.detailVal}>{sk.totalQtyInvoiced.toFixed(0)}</Text></View>
            <View style={s.detailRow}><Text style={s.detailLabel}>Revenue</Text><Text style={s.detailVal}>{fmt(sk.totalRevenue)}</Text></View>
            <View style={s.detailRow}><Text style={s.detailLabel}>Order Lines</Text><Text style={s.detailVal}>{sk.orderCount}</Text></View>
            {ga4SkuMap[sk.sku] && <>
              <View style={s.ga4Divider}><Text style={s.ga4Label}>📊 Google Analytics</Text></View>
              <View style={s.detailRow}><Text style={s.detailLabel}>👁 Views</Text><Text style={s.detailVal}>{ga4SkuMap[sk.sku].views.toLocaleString()}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLabel}>🛒 Add to Cart</Text><Text style={s.detailVal}>{ga4SkuMap[sk.sku].addToCart.toLocaleString()}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLabel}>✅ Purchased</Text><Text style={s.detailVal}>{ga4SkuMap[sk.sku].purchases.toLocaleString()}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLabel}>🎯 Conv. Rate</Text><Text style={[s.detailVal, { color: ga4SkuMap[sk.sku].conversionRate > 0.02 ? '#4caf50' : '#ff9800' }]}>{(ga4SkuMap[sk.sku].conversionRate * 100).toFixed(1)}%</Text></View>
            </>}
          </View>
        )}
      </View>
    );
  };

  const renderBrandSection = (skus: SkuSummary[], dayKey: string) => {
    const groups: Record<string, SkuSummary[]> = {};
    skus.forEach(sk => { if (!groups[sk.brand]) groups[sk.brand] = []; groups[sk.brand].push(sk); });
    return Object.entries(groups).map(([brand, items]) => {
      const key = `${dayKey}-${brand}`;
      const expanded = expandedBrands.has(key);
      const qty = items.reduce((sum, x) => sum + x.totalQtyInvoiced, 0);
      const rev = items.reduce((sum, x) => sum + x.totalRevenue, 0);
      // Aggregate GA4 data for this brand
      const ga4Brand = items.reduce((acc, sk) => {
        const g = ga4SkuMap[sk.sku];
        if (g) {
          acc.views += g.views;
          acc.addToCart += g.addToCart;
          acc.purchases += g.purchases;
        }
        return acc;
      }, { views: 0, addToCart: 0, purchases: 0 });
      const ga4ConvRate = ga4Brand.views > 0 ? ga4Brand.purchases / ga4Brand.views : 0;
      const hasGa4 = ga4Brand.views > 0;
      return (
        <View key={key}>
          <TouchableOpacity style={s.brandRow} onPress={() => toggle(expandedBrands, key, setExpandedBrands)} activeOpacity={0.7}>
            <Text style={s.chevron}>{expanded ? '▼' : '▶'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.brandRowName}>{brand}</Text>
              <Text style={s.brandRowSub}>{items.length} SKUs · {qty.toFixed(0)} units</Text>
              {hasGa4 && (
                <Text style={s.brandRowSub}>
                  👁 {ga4Brand.views.toLocaleString()} · 🛒 {ga4Brand.addToCart.toLocaleString()} · 🎯 {(ga4ConvRate * 100).toFixed(1)}%
                </Text>
              )}
            </View>
            <Text style={s.brandRowRev}>{fmt(rev)}</Text>
          </TouchableOpacity>
          {expanded && (
            <View style={s.brandExpanded}>
              {hasGa4 && (
                <View style={[s.tableRow, { backgroundColor: '#0d1a2d', paddingVertical: 8 }]}>
                  <Text style={{ color: '#4a9eff', fontSize: 11, fontWeight: '700', flex: 1 }}>📊 Google Analytics</Text>
                  <Text style={{ color: '#aabbcc', fontSize: 11 }}>
                    👁 {ga4Brand.views.toLocaleString()}  🛒 {ga4Brand.addToCart.toLocaleString()}  ✅ {ga4Brand.purchases.toLocaleString()}  🎯 {(ga4ConvRate * 100).toFixed(1)}%
                  </Text>
                </View>
              )}
              <View style={s.tableHeader}>
                <Text style={[s.tc, s.tcSku, s.th]}>SKU</Text>
                <Text style={[s.tc, s.tcNum, s.th]}>Qty</Text>
                <Text style={[s.tc, s.tcNum, s.th]}>Revenue</Text>
              </View>
              {items.map((sk, i) => (
                <View key={sk.sku} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
                  <Text style={[s.tc, s.tcSku]} numberOfLines={1}>{sk.sku}</Text>
                  <Text style={[s.tc, s.tcNum]}>{sk.totalQtyInvoiced.toFixed(0)}</Text>
                  <Text style={[s.tc, s.tcNum]}>{fmt(sk.totalRevenue)}</Text>
                </View>
              ))}
              <View style={s.subtotal}>
                <Text style={[s.tc, s.tcSku, s.subtotalText]}>Total</Text>
                <Text style={[s.tc, s.tcNum, s.subtotalText]}>{qty.toFixed(0)}</Text>
                <Text style={[s.tc, s.tcNum, s.subtotalText]}>{fmt(rev)}</Text>
              </View>
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      {/* Custom header for narrow layout */}
      <View style={[s.narrowHeader, { paddingTop: (StatusBar.currentHeight || 0) + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.narrowBackBtn}>
          <Text style={s.narrowBackBtnText}>←</Text>
        </TouchableOpacity>
        <View style={s.narrowHeaderCenter}>
          <Image source={ACE_LOGO} style={s.headerLogo} resizeMode="contain" />
          <Text style={s.headerText}>Sales by Date</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.card}>
        <Text style={s.cardLabel}>DATE RANGE</Text>
        <View style={s.quickDateRow}>
          {([
            { label: 'Today', days: 0 },
            { label: 'Yesterday', days: 1 },
            { label: 'Last 7 days', days: 7 },
          ] as const).map(preset => {
            const active = isPresetActive(fromDate, toDate, preset.days);
            return (
              <TouchableOpacity key={preset.label}
                style={[s.quickDateBtn, active && s.quickDateBtnActive]}
                onPress={() => applyPreset(preset.days, setFromDate, setToDate)}>
                <Text style={[s.quickDateText, active && s.quickDateTextActive]}>{preset.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.datePickerRow}>
          <Text style={s.datePickerLabel}>FROM</Text>
          {isWeb ? (
            <input type="date" value={formatDate(fromDate)} max={formatDate(toDate)}
              onChange={(e: any) => { if (e.target.value) setFromDate(new Date(e.target.value)); }}
              style={{ flex: 1, marginLeft: 12, backgroundColor: '#0d1526', border: '1px solid #1e2d4a', borderRadius: 10, padding: 12, color: '#eef2ff', fontSize: 14, outline: 'none' }} />
          ) : (
            <>
              <TouchableOpacity style={s.datePickerBtn} onPress={() => setShowFrom(true)}>
                <Text style={s.datePickerVal}>{displayDate(formatDate(fromDate))}</Text>
              </TouchableOpacity>
              {showFrom && DateTimePicker && (
                <DateTimePicker value={fromDate} mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  maximumDate={toDate}
                  onChange={(_: any, d: any) => { setShowFrom(false); if (d) setFromDate(d); }} />
              )}
            </>
          )}
        </View>
        <View style={s.datePickerRow}>
          <Text style={s.datePickerLabel}>TO</Text>
          {isWeb ? (
            <input type="date" value={formatDate(toDate)} min={formatDate(fromDate)} max={formatDate(new Date())}
              onChange={(e: any) => { if (e.target.value) setToDate(new Date(e.target.value)); }}
              style={{ flex: 1, marginLeft: 12, backgroundColor: '#0d1526', border: '1px solid #1e2d4a', borderRadius: 10, padding: 12, color: '#eef2ff', fontSize: 14, outline: 'none' }} />
          ) : (
            <>
              <TouchableOpacity style={s.datePickerBtn} onPress={() => setShowTo(true)}>
                <Text style={s.datePickerVal}>{displayDate(formatDate(toDate))}</Text>
              </TouchableOpacity>
              {showTo && DateTimePicker && (
                <DateTimePicker value={toDate} mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  minimumDate={fromDate} maximumDate={new Date()}
                  onChange={(_: any, d: any) => { setShowTo(false); if (d) setToDate(d); }} />
              )}
            </>
          )}
        </View>
        <TouchableOpacity style={s.runBtn} onPress={fetchReport} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#0a0f1e" /> : <Text style={s.runBtnText}>Run Report →</Text>}
        </TouchableOpacity>
        {loading && <Text style={s.loadingStep}>{loadingStep}</Text>}

        {/* SKU Filter — inline in date card */}
        {hasResults && (
          <View style={s.skuFilterSection}>
            <View style={s.skuFilterRow}>
              <Text style={s.skuFilterLabel}>🔍</Text>
              <TextInput
                style={s.skuFilterInput}
                value={skuFilterInput}
                onChangeText={t => { setSkuFilterInput(t); setSkuFilterError(''); }}
                placeholder="Filter by SKU..."
                placeholderTextColor="#445566"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {skuFilter ? (
                <TouchableOpacity style={s.skuFilterClear} onPress={clearSkuFilter}>
                  <Text style={s.skuFilterClearText}>✕</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.skuFilterBtn} onPress={applySkuFilter}>
                  <Text style={s.skuFilterBtnText}>Go</Text>
                </TouchableOpacity>
              )}
            </View>
            {skuFilterError !== '' && <Text style={s.skuFilterError}>⚠️ {skuFilterError}</Text>}
            {skuFilter !== '' && <Text style={s.skuFilterActive}>Filtered: {skuFilter}</Text>}
          </View>
        )}
      </View>

      {hasResults && (
        <>
          <View style={s.summaryStrip}>
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{totalOrders}</Text>
              <Text style={s.summaryLbl}>Orders</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{fmt(totalRevenue)}</Text>
              <Text style={s.summaryLbl}>Revenue</Text>
              {showForecast && (() => {
                const forecast = getForecastedDaily(totalRevenue);
                return forecast > 0 ? <Text style={s.forecastInline}>📈 {fmt(forecast)}</Text> : null;
              })()}
              {target > 0 && (
                <Text style={[s.forecastInline, { color: totalRevenue >= target ? '#4caf50' : '#ff9800' }]}>
                  🎯 {fmt(target)}
                </Text>
              )}
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{allSkus.length}</Text>
              <Text style={s.summaryLbl}>SKUs</Text>
            </View>
            {ga4Data && ga4Data.byDay.length > 0 && <>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{ga4Data.byDay.reduce((a, b) => a + b.sessions, 0).toLocaleString()}</Text>
                <Text style={s.summaryLbl}>Sessions</Text>
                <Text style={s.forecastInline}>{(ga4Data.byDay.reduce((a, b) => a + b.conversionRate, 0) / ga4Data.byDay.length * 100).toFixed(1)}% conv.</Text>
              </View>
            </>}
          </View>

          <View style={s.toggle}>
            {(['sku', 'brand', 'type'] as ViewMode[]).map(mode => (
              <TouchableOpacity key={mode} style={[s.toggleBtn, viewMode === mode && s.toggleOn]}
                onPress={() => setViewMode(mode)}>
                <Text style={[s.toggleTxt, viewMode === mode && s.toggleTxtOn]}>
                  {mode === 'sku' ? 'By SKU' : mode === 'brand' ? 'By Brand' : 'By Type'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.card}>
            {isSingleDay ? (
              <>
                {viewMode === 'sku' && pagedSkus.map(sk => renderSkuRow(sk, sk.sku))}
                {viewMode === 'brand' && renderBrandSection(allSkus, 'all')}
                {viewMode === 'type' && renderTypeSection(allSkus, 'all')}
              </>
            ) : (
              daySummaries.map(day => {
                const expanded = expandedDays.has(day.date);
                const daySkus = viewMode === 'sku'
                  ? day.skus.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : day.skus;
                return (
                  <View key={day.date}>
                    <TouchableOpacity style={s.dayRow} onPress={() => toggle(expandedDays, day.date, setExpandedDays)} activeOpacity={0.7}>
                      <Text style={s.chevron}>{expanded ? '▼' : '▶'}</Text>
                      <View style={s.dayInfo}>
                        <Text style={s.dayDate}>{displayDate(day.date)}</Text>
                        <Text style={s.daySub}>{day.skus.length} SKUs · {day.totalQty.toFixed(0)} units</Text>
                      </View>
                      <View style={s.dayRevWrap}>
                        <Text style={s.dayRev}>{fmt(day.totalRevenue)}</Text>
                      </View>
                    </TouchableOpacity>
                    {expanded && (
                      <View style={s.dayContent}>
                        <>
                          {viewMode === 'sku' && daySkus.map(sk => renderSkuRow(sk, `${day.date}-${sk.sku}`))}
                          {viewMode === 'brand' && renderBrandSection(day.skus, day.date)}
                          {viewMode === 'type' && renderTypeSection(day.skus, day.date)}
                        </>
                      </View>
                    )}
                  </View>
                );
              })
            )}
            {viewMode === 'sku' && totalPages > 1 && (
              <View style={s.pagination}>
                <TouchableOpacity style={[s.pageBtn, currentPage === 1 && s.pageBtnDis]}
                  onPress={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <Text style={s.pageBtnTxt}>‹ Prev</Text>
                </TouchableOpacity>
                <Text style={s.pageCount}>Page {currentPage} of {totalPages}</Text>
                <TouchableOpacity style={[s.pageBtn, currentPage === totalPages && s.pageBtnDis]}
                  onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <Text style={s.pageBtnTxt}>Next ›</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Fold Dashboard Styles ──────────────────────────────────────────────────
const foldStyles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0d1526', borderBottomWidth: 1, borderBottomColor: '#1e2d4a' },
  backBtn: { width: 32, height: 32, backgroundColor: '#1e2d4a', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#e8b400', fontSize: 16, fontWeight: '700' },
  topLogo: { width: 44, height: 18 },
  topTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  topSub: { color: '#445566', fontSize: 10, letterSpacing: 0.5 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4caf50' },
  liveText: { color: '#4caf50', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  leftPanel: { borderRightWidth: 1, borderRightColor: '#1e2d4a', backgroundColor: '#0d1526' },
  rightPanel: { flex: 1, padding: 12 },
  panel: { backgroundColor: '#111827', borderRadius: 12, padding: 12, marginHorizontal: 10, marginBottom: 10, borderWidth: 1, borderColor: '#1e2d4a' },
  panelLabel: { color: '#334455', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  quickDateRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  quickDateBtn: { flex: 1, backgroundColor: '#0d1526', borderRadius: 6, paddingVertical: 6, alignItems: 'center', borderWidth: 1, borderColor: '#1e2d4a' },
  quickDateBtnActive: { backgroundColor: '#e8b400', borderColor: '#e8b400' },
  quickDateText: { color: '#8899aa', fontSize: 10, fontWeight: '600' },
  quickDateTextActive: { color: '#0a0f1e', fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  dateLabel: { color: '#445566', fontSize: 10, fontWeight: '700', width: 30 },
  datePill: { flex: 1, backgroundColor: '#0d1526', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#1e2d4a' },
  datePillText: { color: '#eef2ff', fontSize: 12, fontWeight: '600' },
  runBtn: { backgroundColor: '#e8b400', borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 4 },
  runBtnText: { color: '#0a0f1e', fontWeight: '800', fontSize: 13 },
  loadingStep: { color: '#445566', fontSize: 10, textAlign: 'center', marginTop: 6 },
  kpiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 10, marginBottom: 8, backgroundColor: '#111827', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#1e2d4a' },
  kpiRowAccent: { borderColor: '#e8b40030' },
  kpiIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  kpiLabel: { color: '#334455', fontSize: 8, letterSpacing: 1.5 },
  kpiVal: { color: '#eef2ff', fontSize: 14, fontWeight: '800' },
  kpiSub: { color: '#4caf50', fontSize: 9, marginTop: 1 },
  chartBig: { color: '#e8b400', fontSize: 20, fontWeight: '800', marginBottom: 8 },
});

// ─── Narrow Screen Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1e', padding: 16 },
  narrowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0d1526', paddingHorizontal: 12, paddingBottom: 12, marginHorizontal: -16, marginTop: -16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e2d4a' },
  narrowBackBtn: { width: 36, height: 36, backgroundColor: '#1e2d4a', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  narrowBackBtnText: { color: '#e8b400', fontSize: 18, fontWeight: '700' },
  narrowHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 4, marginBottom: 4 },
  backBtnText: { color: '#e8b400', fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1e2d4a' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#334466', letterSpacing: 2, marginBottom: 12 },
  quickDateRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  quickDateBtn: { flex: 1, backgroundColor: '#0d1526', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1e2d4a' },
  quickDateBtnActive: { backgroundColor: '#e8b400', borderColor: '#e8b400' },
  quickDateText: { color: '#8899aa', fontSize: 13, fontWeight: '700' },
  quickDateTextActive: { color: '#0a0f1e', fontWeight: '800' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  headerLogo: { width: 52, height: 22 },
  headerText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  datePickerLabel: { fontSize: 11, fontWeight: '700', color: '#445566', letterSpacing: 2, width: 50 },
  datePickerBtn: { flex: 1, backgroundColor: '#0d1526', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e2d4a', marginLeft: 12 },
  datePickerVal: { color: '#eef2ff', fontSize: 14, fontWeight: '600' },
  runBtn: { backgroundColor: '#e8b400', borderRadius: 12, padding: 14, alignItems: 'center' },
  runBtnText: { color: '#0a0f1e', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  loadingStep: { textAlign: 'center', color: '#445566', fontSize: 12, marginTop: 8 },
  summaryStrip: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1e2d4a' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 16, fontWeight: '800', color: '#e8b400' },
  summaryLbl: { fontSize: 10, color: '#445566', marginTop: 3, letterSpacing: 1 },
  summaryDivider: { width: 1, backgroundColor: '#1e2d4a' },
  forecastInline: { fontSize: 11, color: '#4caf50', marginTop: 2 },
  toggle: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 12, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: '#1e2d4a' },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 9, alignItems: 'center' },
  toggleOn: { backgroundColor: '#e8b400' },
  toggleTxt: { fontWeight: '700', color: '#445566', fontSize: 13 },
  toggleTxtOn: { color: '#0a0f1e' },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a2540', justifyContent: 'space-between' },
  dayInfo: { flex: 1 },
  dayDate: { fontSize: 14, fontWeight: '800', color: '#eef2ff' },
  daySub: { fontSize: 11, color: '#445566', marginTop: 2 },
  dayRevWrap: { minWidth: 90, alignItems: 'flex-end' },
  dayRev: { fontSize: 14, fontWeight: '700', color: '#e8b400' },
  dayContent: { marginLeft: 18, marginTop: 4, marginBottom: 8 },
  chevron: { fontSize: 10, color: '#445566', marginRight: 8, width: 13 },
  skuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#1a2540', justifyContent: 'space-between' },
  skuCode: { flex: 1, fontSize: 13, color: '#ccd6f6', fontWeight: '500' },
  skuRevenue: { fontSize: 13, fontWeight: '700', color: '#e8b400' },
  brandPill: { backgroundColor: '#1a2a40', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  brandPillText: { fontSize: 10, color: '#7799cc', fontWeight: '700' },
  skuDetail: { backgroundColor: '#0d1526', borderRadius: 8, padding: 10, marginBottom: 4, marginLeft: 18 },
  productName: { color: '#eef2ff', fontSize: 13, fontWeight: '600', marginBottom: 8, lineHeight: 18 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#1a2540' },
  detailLabel: { fontSize: 12, color: '#445566' },
  detailVal: { fontSize: 12, color: '#eef2ff', fontWeight: '600' },
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#1a2540', justifyContent: 'space-between' },
  brandRowInfo: { flex: 1 },
  brandRowName: { fontSize: 14, fontWeight: '800', color: '#eef2ff' },
  brandRowSub: { fontSize: 11, color: '#445566', marginTop: 2 },
  brandRowRevWrap: { minWidth: 90, alignItems: 'flex-end' },
  brandRowRev: { fontSize: 14, fontWeight: '700', color: '#e8b400' },
  brandExpanded: { backgroundColor: '#0d1526', borderRadius: 8, padding: 10, marginBottom: 8, marginLeft: 18 },
  brandExpandedBox: { backgroundColor: '#0d1526', borderRadius: 8, padding: 10, marginBottom: 8, marginLeft: 18 },
  tableHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e2d4a', marginBottom: 2 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#111827' },
  tableRowAlt: { backgroundColor: '#0d1526' },
  tc: { fontSize: 12, color: '#aabbcc' },
  tcSku: { flex: 2, paddingRight: 4 },
  tcNum: { flex: 1, textAlign: 'right' },
  th: { fontWeight: '700', color: '#556677', fontSize: 10, letterSpacing: 1 },
  subtotal: { flexDirection: 'row', paddingVertical: 7, marginTop: 4, borderTopWidth: 2, borderTopColor: '#e8b400' },
  subtotalText: { fontWeight: '800', color: '#e8b400' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1e2d4a' },
  pageBtn: { backgroundColor: '#1a2a40', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  pageBtnDis: { opacity: 0.3 },
  pageBtnTxt: { color: '#e8b400', fontWeight: '700', fontSize: 13 },
  pageCount: { color: '#445566', fontSize: 12 },
  skuFilterSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#1e2d4a', paddingTop: 10 },
  skuFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skuFilterLabel: { fontSize: 16 },
  skuFilterInput: { flex: 1, backgroundColor: '#0d1526', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, color: '#eef2ff', fontSize: 13, borderWidth: 1, borderColor: '#1e2d4a' },
  skuFilterBtn: { backgroundColor: '#e8b400', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  skuFilterBtnText: { color: '#0a0f1e', fontWeight: '800', fontSize: 12 },
  skuFilterClear: { backgroundColor: '#2d1a1a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#5a2a2a' },
  skuFilterClearText: { color: '#ff6b6b', fontWeight: '700', fontSize: 12 },
  skuFilterError: { color: '#ff6b6b', fontSize: 11, marginTop: 4 },
  skuFilterActive: { color: '#4caf50', fontSize: 11, marginTop: 4, fontWeight: '600' },
  ga4Divider: { paddingVertical: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: '#1e2d4a' },
  ga4Label: { color: '#4a9eff', fontSize: 11, fontWeight: '700' },
});
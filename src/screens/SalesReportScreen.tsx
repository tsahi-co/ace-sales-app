import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, AppState,
} from 'react-native';
import { Platform } from 'react-native';
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}
import { isWeb } from '../utils/platform';
import {
  showFetchingNotificationSafe as showFetchingNotification,
  showCompleteNotificationSafe as showCompleteNotification,
  showErrorNotificationSafe as showErrorNotification,
  dismissAllNotificationsSafe as dismissAllNotifications,
  requestNotificationPermission,
} from '../utils/platform';
const ACE_LOGO = require('../../assets/ace.png');
import { useAuth } from '../context/AuthContext';
import {
  fetchAllOrders, Order, OrderItem,
} from '../services/magentoApi';
import { getBrandForSku, getTypeForSku, loadOverrides, getUnmappedSkus } from '../services/skuBrandService';
import { getForecastedDaily } from '../config/forecast';

type ViewMode = 'sku' | 'brand' | 'type';

interface SkuSummary {
  sku: string; brand: string; type: string;
  totalQtyInvoiced: number; totalRevenue: number; orderCount: number;
}
interface DaySummary {
  date: string; skus: SkuSummary[];
  totalRevenue: number; totalQty: number;
}

const PAGE_SIZE = 20;

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

// Returns true only if both from and to are today
function isToday(from: Date, to: Date): boolean {
  const today = formatDate(new Date());
  return formatDate(from) === today && formatDate(to) === today;
}

export default function SalesReportScreen({ navigation }: any) {
  const { token, selectedBrand } = useAuth();
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
  const notifId = useRef<string | null>(null);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

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
          <TouchableOpacity style={styles.brandRow} onPress={() => toggle(expandedTypes, key, setExpandedTypes)} activeOpacity={0.7}>
            <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
            <View style={styles.brandRowInfo}>
              <Text style={styles.brandRowName}>{type}</Text>
              <Text style={styles.brandRowSub}>{items.length} SKUs · {qty.toFixed(0)} units</Text>
            </View>
            <View style={styles.brandRowRevWrap}>
              <Text style={styles.brandRowRev}>{fmt(rev)}</Text>
            </View>
          </TouchableOpacity>
          {expanded && (
            <View style={styles.brandExpandedBox}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tc, styles.tcSku, styles.th]}>SKU</Text>
                <Text style={[styles.tc, styles.tcNum, styles.th]}>Qty</Text>
                <Text style={[styles.tc, styles.tcNum, styles.th]}>Revenue</Text>
              </View>
              {items.map((s, i) => (
                <View key={s.sku} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.tc, styles.tcSku]} numberOfLines={1}>{s.sku}</Text>
                  <Text style={[styles.tc, styles.tcNum]}>{s.totalQtyInvoiced.toFixed(0)}</Text>
                  <Text style={[styles.tc, styles.tcNum]}>{fmt(s.totalRevenue)}</Text>
                </View>
              ))}
              <View style={styles.subtotal}>
                <Text style={[styles.tc, styles.tcSku, styles.subtotalText]}>Total</Text>
                <Text style={[styles.tc, styles.tcNum, styles.subtotalText]}>{qty.toFixed(0)}</Text>
                <Text style={[styles.tc, styles.tcNum, styles.subtotalText]}>{fmt(rev)}</Text>
              </View>
            </View>
          )}
        </View>
      );
    });
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Image source={ACE_LOGO} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.headerText}>Sales by Date</Text>
        </View>
      ),
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: '#0d1526' },
      headerTintColor: '#e8b400',
    });
  }, [navigation]);

  const toggle = (set: Set<string>, key: string, setter: Function) => {
    setter((prev: Set<string>) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const validateDates = () => {
    const diff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (fromDate > toDate) { Alert.alert('Invalid range', 'From must be before To.'); return false; }
    if (diff > 31) { Alert.alert('Too wide', 'Max 31 days.'); return false; }
    return true;
  };

  const fetchReport = async () => {
    if (!validateDates()) return;
    setLoading(true); setHasResults(false); setDaySummaries([]);
    setExpandedDays(new Set()); setExpandedSkus(new Set()); setExpandedBrands(new Set()); setExpandedTypes(new Set());
    setCurrentPage(1);
    const fromStr = formatDate(fromDate); const toStr = formatDate(toDate);
    setIsSingleDay(fromStr === toStr);

    // Only show forecast if brand supports it AND selected date is today
    setShowForecast(brand.hasForecast && isToday(fromDate, toDate));

    try {
      const reportT0 = Date.now();
      console.log(`[ACE] ══ Report started: ${fromStr} → ${toStr}`);
      notifId.current = await showFetchingNotification('Fetching orders...');

      let allOrders: Order[] = [];
      try {
        allOrders = await fetchAllOrders(token!, fromStr, toStr, brand, (fetched, total) => {
          const msg = total > 0 ? `Fetching orders... ${fetched} / ${total}` : 'Fetching orders...';
          setLoadingStep(msg);
        });
      } catch (e: any) {
        await showErrorNotification('Could not fetch orders. Please check your connection.');
        Alert.alert('Network Error', 'Could not fetch orders. Please check your connection and try again.', [{ text: 'OK' }]);
        setLoading(false);
        return;
      }

      console.log(`[ACE] Orders fetch complete: ${allOrders.length} orders in ${Date.now() - reportT0}ms`);
      if (!allOrders.length) {
        await dismissAllNotifications();
        Alert.alert('No results', 'No orders found.');
        setLoading(false);
        return;
      }

      const skuSet = new Set<string>();
      allOrders.forEach(o => (o.items || []).forEach((i: OrderItem) => { if (i.sku) skuSet.add(i.sku); }));

      setLoadingStep('Loading brand mappings...');
      await loadOverrides(brand);
      const unmapped = getUnmappedSkus(Array.from(skuSet));
      if (unmapped.length > 0) {
        console.log(`[ACE] ${unmapped.length} unmapped SKUs → Not Related`);
      }

      console.log(`[ACE] Brand mapping complete in ${Date.now() - reportT0}ms total`);
      setLoadingStep('Building report...');
      const dayMap: Record<string, Record<string, SkuSummary>> = {};
      let grand = 0;
      allOrders.forEach(order => {
        const d = (order.created_at || '').split(' ')[0].split('T')[0];
        grand += order.base_grand_total || 0;
        if (!dayMap[d]) dayMap[d] = {};
        (order.items || []).forEach((item: OrderItem) => {
          if (!item.sku) return;
          const skuBrand = getBrandForSku(item.sku, brand);
          const skuType = getTypeForSku(item.sku, brand);
          if (!dayMap[d][item.sku]) dayMap[d][item.sku] = { sku: item.sku, brand: skuBrand, type: skuType || 'Unknown', totalQtyInvoiced: 0, totalRevenue: 0, orderCount: 0 };
          dayMap[d][item.sku].totalQtyInvoiced += item.qty_invoiced || 0;
          dayMap[d][item.sku].totalRevenue += (item.price_incl_tax || 0) * (item.qty_invoiced || 0);
          dayMap[d][item.sku].orderCount += 1;
        });
      });

      const days: DaySummary[] = Object.entries(dayMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, m]) => {
          const skus = Object.values(m).sort((a, b) => b.totalRevenue - a.totalRevenue);
          return { date, skus, totalRevenue: skus.reduce((s, x) => s + x.totalRevenue, 0), totalQty: skus.reduce((s, x) => s + x.totalQtyInvoiced, 0) };
        });

      setDaySummaries(days); setTotalOrders(allOrders.length); setTotalRevenue(grand); setHasResults(true);
      console.log(`[ACE] ══ Report complete in ${Date.now() - reportT0}ms total`);
      await showCompleteNotification(allOrders.length, skuSet.size);
    } catch (e: any) {
      await showErrorNotification(e.message || 'Unknown error');
      Alert.alert('Error', e.message);
    } finally { setLoading(false); setLoadingStep(''); }
  };

  const fmt = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

  const allSkus = isSingleDay ? (daySummaries[0]?.skus || []) : daySummaries.flatMap(d => d.skus);
  const totalPages = Math.ceil(allSkus.length / PAGE_SIZE);
  const pagedSkus = allSkus.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const renderSkuRow = (s: SkuSummary, key: string) => {
    const expanded = expandedSkus.has(key);
    return (
      <View key={key}>
        <TouchableOpacity style={styles.skuRow} onPress={() => toggle(expandedSkus, key, setExpandedSkus)} activeOpacity={0.7}>
          <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
          <Text style={styles.skuCode} numberOfLines={1}>{s.sku}</Text>
          <Text style={styles.skuRevenue}>{fmt(s.totalRevenue)}</Text>
          <View style={styles.brandPill}><Text style={styles.brandPillText}>{s.brand}</Text></View>
        </TouchableOpacity>
        {expanded && (
          <View style={styles.skuDetail}>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Qty Invoiced</Text><Text style={styles.detailVal}>{s.totalQtyInvoiced.toFixed(0)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Revenue</Text><Text style={styles.detailVal}>{fmt(s.totalRevenue)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Order Lines</Text><Text style={styles.detailVal}>{s.orderCount}</Text></View>
          </View>
        )}
      </View>
    );
  };

  const renderBrandSection = (skus: SkuSummary[], dayKey: string) => {
    const groups: Record<string, SkuSummary[]> = {};
    skus.forEach(s => { if (!groups[s.brand]) groups[s.brand] = []; groups[s.brand].push(s); });
    return Object.entries(groups).map(([brand, items]) => {
      const key = `${dayKey}-${brand}`;
      const expanded = expandedBrands.has(key);
      const qty = items.reduce((s, x) => s + x.totalQtyInvoiced, 0);
      const rev = items.reduce((s, x) => s + x.totalRevenue, 0);
      return (
        <View key={key}>
          <TouchableOpacity style={styles.brandRow} onPress={() => toggle(expandedBrands, key, setExpandedBrands)} activeOpacity={0.7}>
            <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandRowName}>{brand}</Text>
              <Text style={styles.brandRowSub}>{items.length} SKUs · {qty.toFixed(0)} units</Text>
            </View>
            <Text style={styles.brandRowRev}>{fmt(rev)}</Text>
          </TouchableOpacity>
          {expanded && (
            <View style={styles.brandExpanded}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tc, styles.tcSku, styles.th]}>SKU</Text>
                <Text style={[styles.tc, styles.tcNum, styles.th]}>Qty</Text>
                <Text style={[styles.tc, styles.tcNum, styles.th]}>Revenue</Text>
              </View>
              {items.map((s, i) => (
                <View key={s.sku} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.tc, styles.tcSku]} numberOfLines={1}>{s.sku}</Text>
                  <Text style={[styles.tc, styles.tcNum]}>{s.totalQtyInvoiced.toFixed(0)}</Text>
                  <Text style={[styles.tc, styles.tcNum]}>{fmt(s.totalRevenue)}</Text>
                </View>
              ))}
              <View style={styles.subtotal}>
                <Text style={[styles.tc, styles.tcSku, styles.subtotalText]}>Total</Text>
                <Text style={[styles.tc, styles.tcNum, styles.subtotalText]}>{qty.toFixed(0)}</Text>
                <Text style={[styles.tc, styles.tcNum, styles.subtotalText]}>{fmt(rev)}</Text>
              </View>
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled">
      {/* Date picker card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>DATE RANGE</Text>
        <View style={styles.datePickerRow}>
          <Text style={styles.datePickerLabel}>FROM</Text>
          {isWeb ? (
            <input type="date" value={formatDate(fromDate)} max={formatDate(toDate)}
              onChange={e => { if (e.target.value) setFromDate(new Date(e.target.value)); }}
              style={{ flex: 1, marginLeft: 12, backgroundColor: '#0d1526', border: '1px solid #1e2d4a', borderRadius: 10, padding: 12, color: '#eef2ff', fontSize: 14, outline: 'none' }} />
          ) : (
            <>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowFrom(true)}>
                <Text style={styles.datePickerVal}>{displayDate(formatDate(fromDate))}</Text>
              </TouchableOpacity>
              {showFrom && (
                <DateTimePicker value={fromDate} mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  maximumDate={toDate}
                  onChange={(_, d) => { setShowFrom(false); if (d) setFromDate(d); }} />
              )}
            </>
          )}
        </View>
        <View style={styles.datePickerRow}>
          <Text style={styles.datePickerLabel}>TO</Text>
          {isWeb ? (
            <input type="date" value={formatDate(toDate)} min={formatDate(fromDate)} max={formatDate(new Date())}
              onChange={e => { if (e.target.value) setToDate(new Date(e.target.value)); }}
              style={{ flex: 1, marginLeft: 12, backgroundColor: '#0d1526', border: '1px solid #1e2d4a', borderRadius: 10, padding: 12, color: '#eef2ff', fontSize: 14, outline: 'none' }} />
          ) : (
            <>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowTo(true)}>
                <Text style={styles.datePickerVal}>{displayDate(formatDate(toDate))}</Text>
              </TouchableOpacity>
              {showTo && (
                <DateTimePicker value={toDate} mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  minimumDate={fromDate} maximumDate={new Date()}
                  onChange={(_, d) => { setShowTo(false); if (d) setToDate(d); }} />
              )}
            </>
          )}
        </View>
        <TouchableOpacity style={styles.runBtn} onPress={fetchReport} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#0a0f1e" /> : <Text style={styles.runBtnText}>Run Report →</Text>}
        </TouchableOpacity>
        {loading && <Text style={styles.loadingStep}>{loadingStep}</Text>}
      </View>

      {hasResults && (
        <>
          {/* Summary strip */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{totalOrders}</Text>
              <Text style={styles.summaryLbl}>Orders</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{fmt(totalRevenue)}</Text>
              <Text style={styles.summaryLbl}>Revenue</Text>
              {showForecast && (() => {
                const forecast = getForecastedDaily(totalRevenue);
                return forecast > 0 && totalRevenue > 0 ? (
                  <Text style={styles.forecastInline}>📈 {fmt(forecast)}</Text>
                ) : null;
              })()}
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{allSkus.length}</Text>
              <Text style={styles.summaryLbl}>SKUs</Text>
            </View>
          </View>

          {/* Toggle */}
          <View style={styles.toggle}>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === 'sku' && styles.toggleOn]} onPress={() => setViewMode('sku')}>
              <Text style={[styles.toggleTxt, viewMode === 'sku' && styles.toggleTxtOn]}>By SKU</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === 'brand' && styles.toggleOn]} onPress={() => setViewMode('brand')}>
              <Text style={[styles.toggleTxt, viewMode === 'brand' && styles.toggleTxtOn]}>By Brand</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === 'type' && styles.toggleOn]} onPress={() => setViewMode('type')}>
              <Text style={[styles.toggleTxt, viewMode === 'type' && styles.toggleTxtOn]}>By Type</Text>
            </TouchableOpacity>
          </View>

          {/* Results card */}
          <View style={styles.card}>
            {isSingleDay ? (
              viewMode === 'sku'
                ? pagedSkus.map(s => renderSkuRow(s, s.sku))
                : viewMode === 'brand'
                ? renderBrandSection(daySummaries[0]?.skus || [], daySummaries[0]?.date || '')
                : renderTypeSection(daySummaries[0]?.skus || [], daySummaries[0]?.date || '')
            ) : (
              daySummaries.map(day => {
                const expanded = expandedDays.has(day.date);
                const daySkus = viewMode === 'sku'
                  ? day.skus.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                  : day.skus;
                return (
                  <View key={day.date}>
                    <TouchableOpacity style={styles.dayRow} onPress={() => toggle(expandedDays, day.date, setExpandedDays)} activeOpacity={0.7}>
                      <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
                      <View style={styles.dayInfo}>
                        <Text style={styles.dayDate}>{displayDate(day.date)}</Text>
                        <Text style={styles.daySub}>{day.skus.length} SKUs · {day.totalQty.toFixed(0)} units</Text>
                      </View>
                      <View style={styles.dayRevWrap}>
                        <Text style={styles.dayRev}>{fmt(day.totalRevenue)}</Text>
                      </View>
                    </TouchableOpacity>
                    {expanded && (
                      <View style={styles.dayContent}>
                        {viewMode === 'sku'
                          ? daySkus.map(s => renderSkuRow(s, `${day.date}-${s.sku}`))
                          : viewMode === 'brand'
                          ? renderBrandSection(day.skus, day.date)
                          : renderTypeSection(day.skus, day.date)}
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {/* Pagination */}
            {viewMode === 'sku' && totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDis]}
                  onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}>
                  <Text style={styles.pageBtnTxt}>‹ Prev</Text>
                </TouchableOpacity>
                <Text style={styles.pageCount}>Page {currentPage} of {totalPages}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDis]}
                  onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}>
                  <Text style={styles.pageBtnTxt}>Next ›</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1e', padding: 16 },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1e2d4a' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#334466', letterSpacing: 2, marginBottom: 12 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  headerLogo: { width: 52, height: 22 },
  headerText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  datePickerLabel: { fontSize: 11, fontWeight: '700', color: '#445566', letterSpacing: 2, width: 50 },
  datePickerBtn: { flex: 1, backgroundColor: '#0d1526', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e2d4a', marginLeft: 12 },
  datePickerVal: { color: '#eef2ff', fontSize: 14, fontWeight: '600' },
  runBtn: { backgroundColor: '#e8b400', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#e8b400', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
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
  skuRight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  skuRevenue: { fontSize: 13, fontWeight: '700', color: '#e8b400' },
  brandPill: { backgroundColor: '#1a2a40', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  brandPillText: { fontSize: 10, color: '#7799cc', fontWeight: '700' },
  skuDetail: { backgroundColor: '#0d1526', borderRadius: 8, padding: 10, marginBottom: 4, marginLeft: 18 },
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
});
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import {
  getEntryForSku, saveOverride, removeOverride,
  getAllOverrides, loadOverrides, BRAND_LABELS as BRANDS, TYPE_LABELS as TYPES, getStaticMap,
} from '../services/skuBrandService';
import {
  loadTargets, saveTargets, clearTargets, getTargets, parseTargetsFromText, TargetsMap,
} from '../services/targetsService';
import { isWeb } from '../utils/platform';


export default function SettingsScreen({ navigation }: any) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [staticMap, setStaticMap] = useState<Record<string, string>>({});
  const [searchSku, setSearchSku] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'lookup' | 'overrides' | 'targets'>('lookup');
  const [targets, setTargets] = useState<TargetsMap>({});
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [csvInput, setCsvInput] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await loadOverrides();
    setOverrides(getAllOverrides());
    setStaticMap(getStaticMap());
    await loadTargets();
    setTargets(getTargets());
  };

  const [selectedType, setSelectedType] = useState('');
  const handleLookup = () => {
    if (!searchSku.trim()) return;
    const entry = getEntryForSku(searchSku.trim());
    setSearchResult(entry.brand);
    setSelectedBrand(entry.brand === 'Not Related' ? '' : entry.brand);
    setSelectedType(entry.type === 'Unknown' ? '' : entry.type);
  };

  const handleAssign = async () => {
    if (!searchSku.trim() || (!selectedBrand && !selectedType)) {
      Alert.alert('Missing', 'Please enter a SKU and select at least a brand or type.');
      return;
    }
    setSaving(true);
    const update: any = {};
    if (selectedBrand) update.brand = selectedBrand;
    if (selectedType) update.type = selectedType;
    await saveOverride(searchSku.trim(), update);
    setOverrides(getAllOverrides());
    if (selectedBrand) setSearchResult(selectedBrand);
    setSaving(false);
    Alert.alert('Saved', `SKU ${searchSku.trim()} assigned.`);
  };

  const handleRemoveOverride = (sku: string) => {
    Alert.alert('Remove Override', `Remove brand assignment for SKU "${sku}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await removeOverride(sku);
          setOverrides(getAllOverrides());
        }
      },
    ]);
  };

  const getBrandColor = (brand: string) => {
    if (brand === 'Ace') return '#cc0000';
    if (brand === 'Autodepot') return '#e8b400';
    if (brand === 'Not Related') return '#445566';
    return '#7799cc';
  };

  const handleParseCSV = async () => {
    if (!csvInput.trim()) {
      setTargetStatus('Please paste CSV content first.');
      return;
    }
    setTargetLoading(true);
    setTargetStatus('');
    try {
      const { targets: parsed, count, errors } = parseTargetsFromText(csvInput);
      if (count === 0) {
        setTargetStatus('No valid targets found. Expected format: date,amount (one per line).');
        setTargetLoading(false);
        return;
      }
      await saveTargets(parsed);
      setTargets(parsed);
      setCsvInput('');
      setTargetStatus(`Loaded ${count} targets successfully!${errors.length > 0 ? ` (${errors.length} rows skipped)` : ''}`);
    } catch (e: any) {
      setTargetStatus(`Error: ${e.message}`);
    }
    setTargetLoading(false);
  };

  // Web-only: read a chosen file as text via the browser FileReader
  const handleWebFileUpload = (event: any) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setTargetLoading(true);
    setTargetStatus('');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const { targets: parsed, count, errors } = parseTargetsFromText(text);
        if (count === 0) {
          setTargetStatus('No valid targets found. Expected columns: date, amount.');
          setTargetLoading(false);
          return;
        }
        await saveTargets(parsed);
        setTargets(parsed);
        setTargetStatus(`Loaded ${count} targets successfully!${errors.length > 0 ? ` (${errors.length} rows skipped)` : ''}`);
      } catch (e: any) {
        setTargetStatus(`Error: ${e.message}`);
      }
      setTargetLoading(false);
    };
    reader.onerror = () => { setTargetStatus('Could not read file.'); setTargetLoading(false); };
    reader.readAsText(file);
  };

  const handleClearTargets = () => {
    Alert.alert('Clear Targets', 'Remove all revenue targets?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await clearTargets();
        setTargets({});
        setTargetStatus('Targets cleared.');
      }},
    ]);
  };

  return (
    <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled">
      {/* Tab toggle */}
      <View style={styles.toggle}>
        <TouchableOpacity style={[styles.toggleBtn, tab === 'lookup' && styles.toggleOn]} onPress={() => setTab('lookup')}>
          <Text style={[styles.toggleTxt, tab === 'lookup' && styles.toggleTxtOn]}>SKU Lookup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, tab === 'overrides' && styles.toggleOn]} onPress={() => setTab('overrides')}>
          <Text style={[styles.toggleTxt, tab === 'overrides' && styles.toggleTxtOn]}>
            My Overrides {Object.keys(overrides).length > 0 ? `(${Object.keys(overrides).length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, tab === 'targets' && styles.toggleOn]} onPress={() => setTab('targets')}>
          <Text style={[styles.toggleTxt, tab === 'targets' && styles.toggleTxtOn]}>
            Targets {Object.keys(targets).length > 0 ? `(${Object.keys(targets).length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* SKU Lookup tab */}
      {tab === 'lookup' && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>LOOK UP & ASSIGN A SKU</Text>
          <Text style={styles.cardDesc}>
            Enter a SKU to see its current brand assignment. If it shows "Not Related" you can assign it here.
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchSku}
              onChangeText={t => { setSearchSku(t); setSearchResult(null); }}
              placeholder="Enter SKU..."
              placeholderTextColor="#445566"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleLookup}>
              <Text style={styles.searchBtnText}>Look up</Text>
            </TouchableOpacity>
          </View>

          {searchResult !== null && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Current brand:</Text>
              <Text style={[styles.resultBrand, { color: getBrandColor(searchResult) }]}>{searchResult}</Text>

              <Text style={styles.assignLabel}>Assign brand:</Text>
              <View style={styles.brandPills}>
                {BRANDS.map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.brandPill, selectedBrand === b && styles.brandPillOn, { borderColor: getBrandColor(b) }]}
                    onPress={() => setSelectedBrand(b)}>
                    <Text style={[styles.brandPillText, { color: getBrandColor(b) }, selectedBrand === b && { color: '#fff' }]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.assignLabel, { marginTop: 10 }]}>Assign type:</Text>
              <View style={styles.brandPills}>
                {TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.brandPill, selectedType === t && styles.brandPillOn, { borderColor: '#7799cc' }]}
                    onPress={() => setSelectedType(t)}>
                    <Text style={[styles.brandPillText, { color: '#7799cc' }, selectedType === t && { color: '#fff' }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, !selectedBrand && styles.saveBtnDis]}
                onPress={handleAssign}
                disabled={!selectedBrand || saving}>
                {saving ? <ActivityIndicator color="#0a0f1e" /> : <Text style={styles.saveBtnText}>Save Assignment</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Overrides tab */}
      {tab === 'overrides' && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>MY BRAND OVERRIDES</Text>
          <Text style={styles.cardDesc}>
            These are SKU assignments you've made manually. They override the static map.
          </Text>

          {Object.keys(overrides).length === 0 ? (
            <Text style={styles.empty}>No overrides yet. Use the SKU Lookup tab to assign brands.</Text>
          ) : (
            Object.entries(overrides)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([sku, brand]) => (
                <View key={sku} style={styles.overrideRow}>
                  <View style={styles.overrideLeft}>
                    <Text style={styles.overrideSku}>{sku}</Text>
                    <Text style={[styles.overrideBrand, { color: getBrandColor(brand) }]}>{brand}</Text>
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveOverride(sku)}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
          )}
        </View>
      )}

      {/* Targets tab */}
      {tab === 'targets' && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>REVENUE TARGETS</Text>
          <Text style={styles.cardDesc}>
            Upload a CSV or Excel file with two columns: date and target amount.{' '}
            Supported date formats: DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY
          </Text>

          {isWeb && (
            <View style={{ marginBottom: 14 }}>
              {/* Native HTML file input — works in the browser */}
              {React.createElement('input', {
                type: 'file',
                accept: '.csv,.txt',
                onChange: handleWebFileUpload,
                style: {
                  color: '#eef2ff', fontSize: 13, padding: '10px',
                  backgroundColor: '#0d1526', border: '1px solid #1e2d4a',
                  borderRadius: 8, width: '100%', cursor: 'pointer',
                },
              })}
              <Text style={[styles.cardDesc, { marginTop: 6 }]}>Or paste the content below.</Text>
            </View>
          )}

          <Text style={styles.cardDesc}>
            Paste CSV content below (date,amount per line).{' '}
            Example: 01/07/2026,450000
          </Text>
          <TextInput
            style={styles.csvInput}
            value={csvInput}
            onChangeText={setCsvInput}
            placeholder={"01/07/2026,450000\n02/07/2026,750000\n..."}
            placeholderTextColor="#334466"
            multiline
            numberOfLines={6}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.uploadBtn} onPress={handleParseCSV} disabled={targetLoading || !csvInput.trim()}>
            {targetLoading
              ? <ActivityIndicator color="#0a0f1e" />
              : <Text style={styles.uploadBtnText}>💾 Save Targets</Text>}
          </TouchableOpacity>

          {targetStatus !== '' && (
            <Text style={[styles.cardDesc, { marginTop: 10, color: targetStatus.startsWith('✅') ? '#4caf50' : '#ff6b6b' }]}>
              {targetStatus}
            </Text>
          )}

          {Object.keys(targets).length > 0 && (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{Object.keys(targets).length}</Text>
                  <Text style={styles.statLbl}>Days loaded</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>
                    {Object.values(targets).reduce((a, b) => a + b, 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={styles.statLbl}>Total target (₪)</Text>
                </View>
              </View>

              <Text style={[styles.cardLabel, { marginTop: 14 }]}>LOADED TARGETS</Text>
              {Object.entries(targets)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, amount]) => (
                  <View key={date} style={styles.overrideRow}>
                    <Text style={styles.overrideSku}>{date}</Text>
                    <Text style={[styles.overrideBrand, { color: '#e8b400' }]}>
                      ₪{amount.toLocaleString()}
                    </Text>
                  </View>
                ))}

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#2d1a1a', marginTop: 14 }]} onPress={handleClearTargets}>
                <Text style={[styles.saveBtnText, { color: '#ff6b6b' }]}>🗑 Clear All Targets</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.cardLabel}>MAPPING STATS</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{Object.keys(staticMap).length}</Text>
            <Text style={styles.statLbl}>Static mappings</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{Object.keys(overrides).length}</Text>
            <Text style={styles.statLbl}>Your overrides</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1e', padding: 16 },
  toggle: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 12, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: '#1e2d4a' },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 9, alignItems: 'center' },
  toggleOn: { backgroundColor: '#e8b400' },
  toggleTxt: { fontWeight: '700', color: '#445566', fontSize: 13 },
  toggleTxtOn: { color: '#0a0f1e' },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1e2d4a' },
  statsCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e2d4a' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#334466', letterSpacing: 2, marginBottom: 8 },
  cardDesc: { fontSize: 12, color: '#445566', marginBottom: 16, lineHeight: 18 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  searchInput: { flex: 1, backgroundColor: '#0d1526', borderWidth: 1, borderColor: '#1e2d4a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14 },
  searchBtn: { backgroundColor: '#e8b400', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#0a0f1e', fontWeight: '800', fontSize: 13 },
  resultBox: { backgroundColor: '#0d1526', borderRadius: 10, padding: 14, gap: 10 },
  resultLabel: { fontSize: 11, color: '#445566', letterSpacing: 1 },
  resultBrand: { fontSize: 18, fontWeight: '800' },
  assignLabel: { fontSize: 11, color: '#445566', letterSpacing: 1, marginTop: 4 },
  brandPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandPill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  brandPillOn: { backgroundColor: '#1a2a40' },
  brandPillText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { backgroundColor: '#e8b400', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 4 },
  saveBtnDis: { opacity: 0.4 },
  saveBtnText: { color: '#0a0f1e', fontWeight: '800', fontSize: 14 },
  overrideRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a2540' },
  overrideLeft: { flex: 1 },
  overrideSku: { fontSize: 14, color: '#eef2ff', fontWeight: '600' },
  overrideBrand: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a2540', justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#cc3333', fontSize: 14, fontWeight: '700' },
  empty: { color: '#445566', fontSize: 13, textAlign: 'center', marginTop: 20, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statItem: { flex: 1, backgroundColor: '#0d1526', borderRadius: 10, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: '#e8b400' },
  statLbl: { fontSize: 10, color: '#445566', marginTop: 4 },
  csvInput: { backgroundColor: '#0d1526', borderWidth: 1, borderColor: '#1e2d4a', borderRadius: 10, padding: 12, color: '#eef2ff', fontSize: 12, fontFamily: 'monospace', minHeight: 120, marginBottom: 10, textAlignVertical: 'top' },
  uploadBtn: { backgroundColor: '#e8b400', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 4 },
  uploadBtnText: { color: '#0a0f1e', fontWeight: '800', fontSize: 14 },
});
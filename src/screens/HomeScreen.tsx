import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, StatusBar, Image } from 'react-native';
import { safeStorage } from '../utils/platform';
import { useAuth } from '../context/AuthContext';




export default function HomeScreen({ navigation }: any) {
  const { setToken, selectedBrand, setSelectedBrand } = useAuth();
  if (!selectedBrand) return null;
  const brand = selectedBrand;  const tapCount = useRef(0);
  const tapTimer = useRef<any>(null);

  const handleLogoTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      navigation.navigate('Debug');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: async () => { await safeStorage.deleteItem(brand.tokenKey); setToken(null); } },
    ]);
  };

  const handleForgetDevice = () => {
    Alert.alert('Forget this device', 'This will remove saved credentials and require full login next time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget', style: 'destructive', onPress: async () => { await safeStorage.deleteItem(TOKEN_KEY); setToken(null); } },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />

      {/* Hero */}
      <View style={styles.hero}>
        <TouchableOpacity onPress={handleLogoTap} activeOpacity={1}>
          <Image source={brand.logo} style={styles.heroLogo} resizeMode="contain" />
        </TouchableOpacity>
        <Text style={styles.heroSub}>Operations Dashboard</Text>
      </View>

      {/* Menu */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionLabel}>REPORTS</Text>

        <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('SalesReport')} activeOpacity={0.85}>
          <View style={styles.menuIconWrap}>
            <Text style={styles.menuEmoji}>📊</Text>
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Sales by Date</Text>
            <Text style={styles.menuDesc}>Revenue & SKU breakdown by date range</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>SETTINGS</Text>

        <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Settings')} activeOpacity={0.85}>
          <View style={styles.menuIconWrap}>
            <Text style={styles.menuEmoji}>🏷️</Text>
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Brand Settings</Text>
            <Text style={styles.menuDesc}>Assign brands to unmapped SKUs</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>COMING SOON</Text>

        <TouchableOpacity style={[styles.menuCard, styles.menuCardDim]} disabled activeOpacity={1}>
          <View style={[styles.menuIconWrap, styles.menuIconDim]}><Text style={styles.menuEmoji}>📦</Text></View>
          <View style={styles.menuText}>
            <Text style={[styles.menuTitle, { color: '#334455' }]}>Inventory</Text>
            <Text style={styles.menuDesc}>Stock levels by SKU</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Analytics')} activeOpacity={0.85}>
          <View style={styles.menuIconWrap}><Text style={styles.menuEmoji}>📈</Text></View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Analytics</Text>
            <Text style={styles.menuDesc}>Trends & comparisons</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.changeBrandBtn} onPress={() => { setToken(null); setSelectedBrand(null); }}>
        <Text style={styles.changeBrandText}>← Change Brand</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleForgetDevice}>
          <Text style={styles.forgetText}>Forget this device</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1e' },
  hero: { alignItems: 'center', paddingTop: 52, paddingBottom: 32, backgroundColor: '#0d1526', borderBottomWidth: 1, borderBottomColor: '#1e2d4a' },
  heroLogo: { width: 160, height: 68, marginBottom: 10 },
  heroSub: { fontSize: 10, color: '#334455', letterSpacing: 3, textTransform: 'uppercase' },

  menuSection: { flex: 1, paddingHorizontal: 20, paddingTop: 28 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#334455', letterSpacing: 2, marginBottom: 10 },
  menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1e2d4a' },
  menuCardDim: { opacity: 0.35 },
  menuIconWrap: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#1a2a40', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuIconDim: { backgroundColor: '#111820' },
  menuEmoji: { fontSize: 22 },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: '#eef2ff' },
  menuDesc: { fontSize: 12, color: '#445566', marginTop: 2 },
  menuArrow: { fontSize: 24, color: '#cc0000', fontWeight: '300' },

  footer: { padding: 24, alignItems: 'center', gap: 12 },
  logoutBtn: { borderWidth: 1, borderColor: '#cc0000', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 40 },
  logoutText: { color: '#cc0000', fontWeight: '600', fontSize: 14 },
  forgetText: { color: '#334455', fontSize: 12, textDecorationLine: 'underline' },
  changeBrandBtn: { alignItems: 'center', padding: 8 },
  changeBrandText: { color: '#445566', fontSize: 13, textDecorationLine: 'underline' },
});
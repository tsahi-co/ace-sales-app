import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Image, Linking,
} from 'react-native';
import { safeStorage, isWeb } from '../utils/platform';
import { useAuth } from '../context/AuthContext';
import { getAdminToken } from '../services/magentoApi';

// Web-safe alert: uses browser alert on web, RN Alert on native
function showAlert(title: string, message: string) {
  if (isWeb) {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ── Duo Mobile launcher ──────────────────────────────────────────────────────
const DUO_PACKAGE = 'com.duosecurity.duomobile';
const DUO_PLAY_URL = `https://play.google.com/store/apps/details?id=${DUO_PACKAGE}`;
const DUO_APP_STORE_URL = 'https://apps.apple.com/app/duo-mobile/id422663827';

function webUserAgent(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : '';
}

// On a desktop browser there is no phone app to open, so the button is hidden there.
function isMobileWeb(): boolean {
  return isWeb && /iPhone|iPad|iPod|Android/i.test(webUserAgent());
}

async function openDuoMobile(): Promise<void> {
  if (Platform.OS === 'android') {
    // Package-specific launch (cannot open a different app). Google Play starts Duo
    // if it is installed, otherwise it shows Duo's store page.
    try {
      await Linking.openURL(`market://launch?id=${DUO_PACKAGE}`);
    } catch {
      await Linking.openURL(DUO_PLAY_URL);
    }
    return;
  }
  if (Platform.OS === 'ios') {
    try {
      await Linking.openURL('duo://');
    } catch {
      await Linking.openURL(DUO_APP_STORE_URL);
    }
    return;
  }
  // Web on a phone (browser or installed PWA)
  if (/Android/i.test(webUserAgent())) {
    window.location.href =
      `intent://#Intent;package=${DUO_PACKAGE};S.browser_fallback_url=${encodeURIComponent(DUO_PLAY_URL)};end`;
  } else {
    window.location.href = 'duo://';
  }
}

export default function LoginScreen() {
  const { setToken, selectedBrand, setSelectedBrand } = useAuth();
  if (!selectedBrand) return null;
  const brand = selectedBrand;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  const handleOpenDuo = async () => {
    setErrorMsg('');
    try {
      await openDuoMobile();
    } catch {
      setErrorMsg('Could not open Duo Mobile. Please open it manually.');
    }
  };
  const [savedUsername, setSavedUsername] = useState('');

  useEffect(() => { loadSavedCredentials(); }, []);

  const loadSavedCredentials = async () => {
    try {
      const saved = await safeStorage.getItem(`${brand.tokenKey}_username`);
      if (saved) {
        setSavedUsername(saved);
        setUsername(saved);
      }
      const savedPwd = await safeStorage.getItem(`${brand.tokenKey}_password`);
      if (savedPwd) setPassword(savedPwd);
    } catch {}
  };

  const handleLogin = async () => {
    setErrorMsg('');

    // Validation
    if (!username || !password) {
      setErrorMsg('Please enter your username and password.');
      return;
    }
    if (brand.hasTFA && !otp) {
      setErrorMsg('Please enter the 6-digit authenticator code.');
      return;
    }
    if (brand.hasTFA && otp.length !== 6) {
      setErrorMsg('Authenticator code must be 6 digits.');
      return;
    }

    setLoading(true);
    try {
      const token = await getAdminToken(username, password, otp, brand);
      await safeStorage.setItem(brand.tokenKey, token);
      await safeStorage.setItem(`${brand.tokenKey}_username`, username);
      await safeStorage.setItem(`${brand.tokenKey}_password`, password);
      setToken(token);
    } catch (e: any) {
      setErrorMsg(e.message || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedBrand(null)}>
          <Text style={styles.backBtnText}>← Change brand</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Image source={brand.logo} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.tagline}>{brand.name} · Sales Portal</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>USERNAME</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput style={styles.input} value={username} onChangeText={setUsername}
                autoCapitalize="none" placeholder="admin username" placeholderTextColor="#4a5568"
                autoComplete="username"
                textContentType="username"
                importantForAutofill="yes" />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword}
                secureTextEntry placeholder="••••••••" placeholderTextColor="#4a5568"
                autoComplete="password"
                textContentType="password"
                importantForAutofill="yes" />
            </View>
          </View>

          {brand.hasTFA && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>AUTHENTICATOR CODE</Text>
              <View style={[styles.inputWrap, styles.otpWrap]}>
                <TextInput style={[styles.input, styles.otpInput]} value={otp} onChangeText={setOtp}
                  keyboardType="number-pad" maxLength={6} placeholder="— — — — — —"
                  placeholderTextColor="#4a5568"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode" />
              </View>
              {(!isWeb || isMobileWeb()) && (
                <TouchableOpacity style={[styles.duoBtn, { borderColor: brand.primaryColor }]}
                  onPress={handleOpenDuo} activeOpacity={0.8}>
                  <Text style={[styles.duoBtnText, { color: brand.primaryColor }]}>🔐 Open Duo Mobile</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.otpNote}>⏱ Code from your authenticator app · expires every 30s</Text>
            </View>
          )}

          {/* Inline error message — works on both web and native */}
          {errorMsg !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.loginBtn, { backgroundColor: brand.primaryColor }]}
            onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In →</Text>}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1e' },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40, maxWidth: 480, alignSelf: 'center', width: '100%' },
  backBtn: { paddingTop: 20, paddingBottom: 8 },
  backBtnText: { color: '#445566', fontSize: 13 },
  biometricScreen: { flex: 1, backgroundColor: '#0a0f1e', alignItems: 'center', justifyContent: 'center', padding: 32 },
  biometricLogo: { width: 160, height: 70, marginBottom: 32 },
  biometricTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 6 },
  biometricHint: { color: '#4a5568', fontSize: 14, marginBottom: 48, letterSpacing: 1 },
  fingerprintRing: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  fingerprintInner: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#1a2240', justifyContent: 'center', alignItems: 'center' },
  fingerprintEmoji: { fontSize: 52 },
  manualLink: { fontSize: 13, textDecorationLine: 'underline' },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 40 },
  headerLogo: { width: 180, height: 76, marginBottom: 12 },
  tagline: { fontSize: 11, color: '#4a5568', letterSpacing: 3, textTransform: 'uppercase' },
  form: { gap: 20 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#4a5568', letterSpacing: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#1e2d4a', paddingHorizontal: 14 },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, color: '#ffffff', fontSize: 15, paddingVertical: 14 },
  otpWrap: { justifyContent: 'center' },
  otpInput: { textAlign: 'center', letterSpacing: 10, fontSize: 22, fontWeight: '700' },
  otpNote: { fontSize: 11, color: '#4a5568', marginTop: 4 },
  duoBtn: { alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, marginTop: 8, backgroundColor: '#111827' },
  duoBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  errorBox: { backgroundColor: '#2d1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#5a2a2a', padding: 12 },
  errorText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
  loginBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  loginBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  biometricBtn: { alignItems: 'center', padding: 12 },
  biometricBtnText: { fontSize: 13 },
});
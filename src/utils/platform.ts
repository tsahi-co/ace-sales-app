import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';

// Web-safe SecureStore
export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (isWeb) {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// Web-safe biometric
export async function isBiometricAvailable(): Promise<boolean> {
  if (isWeb) return false;
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch { return false; }
}

export async function authenticateWithBiometric(): Promise<boolean> {
  if (isWeb) return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Use fingerprint to login',
      fallbackLabel: 'Use password instead',
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch { return false; }
}

// Web-safe notifications — no-op on web
export async function showFetchingNotificationSafe(msg: string): Promise<string | null> {
  if (isWeb) return null;
  try {
    const N = require('../services/notificationService');
    return N.showFetchingNotification(msg);
  } catch { return null; }
}

export async function showCompleteNotificationSafe(orders: number, skus: number): Promise<void> {
  if (isWeb) return;
  try {
    const N = require('../services/notificationService');
    return N.showCompleteNotification(orders, skus);
  } catch {}
}

export async function showErrorNotificationSafe(msg: string): Promise<void> {
  if (isWeb) return;
  try {
    const N = require('../services/notificationService');
    return N.showErrorNotification(msg);
  } catch {}
}

export async function dismissAllNotificationsSafe(): Promise<void> {
  if (isWeb) return;
  try {
    const N = require('../services/notificationService');
    return N.dismissAllNotifications();
  } catch {}
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isWeb) return false;
  try {
    const N = require('../services/notificationService');
    return N.requestNotificationPermission();
  } catch { return false; }
}

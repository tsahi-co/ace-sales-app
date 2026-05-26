import React, { useState, useEffect } from 'react';
import { I18nManager, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { BrandConfig } from './src/config/brands';
import { AuthContext } from './src/context/AuthContext';
import BrandSelectScreen from './src/screens/BrandSelectScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SalesReportScreen from './src/screens/SalesReportScreen';
import DebugScreen from './src/screens/DebugScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { initNotifications } from './src/services/notificationService';

// Fix RTL layout
if (I18nManager.isRTL) {
  I18nManager.forceRTL(false);
  I18nManager.allowRTL(false);
}

const Stack = createNativeStackNavigator();

// Error boundary to catch crashes
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: String(error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#ff4444', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
            App Error
          </Text>
          <Text style={{ color: '#aaaaaa', fontSize: 12, fontFamily: 'monospace' }}>
            {this.state.error}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try { initNotifications(); } catch {}
  }, []);
  const [selectedBrand, setSelectedBrand] = useState<BrandConfig | null>(null);

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ token, setToken, selectedBrand, setSelectedBrand }}>
        <StatusBar style="light" backgroundColor="#0a0f1e" />
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: '#0d1526' },
              headerTintColor: '#e8b400',
              headerTitleStyle: { fontWeight: 'bold', color: '#ffffff' },
              contentStyle: { backgroundColor: '#0a0f1e' },
            }}>
            {!selectedBrand ? (
              <Stack.Screen name="BrandSelect" component={BrandSelectScreen} options={{ headerShown: false }} />
            ) : !token ? (
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            ) : (
              <>
                <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
                <Stack.Screen name="SalesReport" component={SalesReportScreen} options={{ title: 'Sales by Date' }} />
                <Stack.Screen name="Debug" component={DebugScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Brand Settings', headerStyle: { backgroundColor: '#0d1526' }, headerTintColor: '#e8b400', headerTitleStyle: { color: '#fff' } }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}

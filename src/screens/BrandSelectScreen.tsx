import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, StatusBar, Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { BRAND_LIST, BrandConfig } from '../config/brands';
import { safeStorage } from '../utils/platform';

const { width } = Dimensions.get('window');

export default function BrandSelectScreen() {
  const { setSelectedBrand, setToken } = useAuth();

  const handleSelectBrand = async (brand: BrandConfig) => {
    // Check if we have a saved token for this brand
    const savedToken = await safeStorage.getItem(brand.tokenKey);
    setSelectedBrand(brand);
    if (savedToken) setToken(savedToken);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />

      <View style={styles.header}>
        <Text style={styles.title}>Sales Portal</Text>
        <Text style={styles.subtitle}>SELECT YOUR BRAND</Text>
      </View>

      <View style={styles.brandsGrid}>
        {BRAND_LIST.map(brand => (
          <TouchableOpacity
            key={brand.id}
            style={[styles.brandCard, { borderColor: brand.primaryColor }]}
            onPress={() => handleSelectBrand(brand)}
            activeOpacity={0.8}>
            <Image
              source={brand.logo}
              style={styles.brandLogo}
              resizeMode="contain"
              onError={() => {}} // Silently handle missing logos
            />
            <Text style={[styles.brandName, { color: brand.primaryColor }]}>
              {brand.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.footer}>Choose a brand to continue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: 2 },
  subtitle: { fontSize: 11, color: '#334466', letterSpacing: 4, marginTop: 8 },

  brandsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    maxWidth: 500,
  },
  brandCard: {
    width: (width - 80) / 2,
    maxWidth: 200,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 140,
  },
  brandLogo: {
    width: 120,
    height: 50,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    color: '#334466',
    fontSize: 12,
    letterSpacing: 1,
  },
});

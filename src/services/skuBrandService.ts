import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrandConfig } from '../config/brands';

const OVERRIDES_KEY_PREFIX = 'sku_brand_overrides_';

export const BRAND_LABELS = ['Ace', 'Autodepot', 'Not Related'];
export const TYPE_LABELS = ['ACE Product', 'Market Place', 'Unknown'];

interface SkuEntry {
  brand?: string;
  type?: string;
}

const overridesCache: Record<string, Record<string, Partial<SkuEntry>>> = {};
const loadedFlags: Record<string, boolean> = {};

async function loadOverridesForBrand(brandId: string): Promise<void> {
  if (loadedFlags[brandId]) return;
  try {
    const raw = await AsyncStorage.getItem(`${OVERRIDES_KEY_PREFIX}${brandId}`);
    overridesCache[brandId] = raw ? JSON.parse(raw) : {};
  } catch {
    overridesCache[brandId] = {};
  }
  loadedFlags[brandId] = true;
}

export async function loadOverrides(brand?: BrandConfig): Promise<void> {
  await loadOverridesForBrand(brand?.id || 'ace');
}

function getStaticEntry(sku: string, brand: BrandConfig): SkuEntry {
  const entry = brand.getSkuData()[sku];
  if (!entry) return {};
  if (typeof entry === 'string') return { brand: entry };
  return entry;
}

export function getEntryForSku(sku: string, brand?: BrandConfig): { brand: string; type: string } {
  const brandId = brand?.id || 'ace';
  const override = overridesCache[brandId]?.[sku] || {};
  const staticEntry = brand ? getStaticEntry(sku, brand) : {};

  return {
    brand: override.brand || staticEntry.brand || brand?.attributes?.brand?.defaultLabel || 'Not Related',
    type: override.type || staticEntry.type || brand?.attributes?.type?.defaultLabel || 'Unknown',
  };
}

export function getBrandForSku(sku: string, brand?: BrandConfig): string {
  return getEntryForSku(sku, brand).brand;
}

export function getTypeForSku(sku: string, brand?: BrandConfig): string {
  return getEntryForSku(sku, brand).type;
}

export async function saveOverride(sku: string, update: Partial<SkuEntry>, brandId = 'ace'): Promise<void> {
  if (!overridesCache[brandId]) overridesCache[brandId] = {};
  overridesCache[brandId][sku] = { ...overridesCache[brandId][sku], ...update };
  try {
    await AsyncStorage.setItem(`${OVERRIDES_KEY_PREFIX}${brandId}`, JSON.stringify(overridesCache[brandId]));
  } catch {}
}

export async function removeOverride(sku: string, brandId = 'ace'): Promise<void> {
  if (overridesCache[brandId]) delete overridesCache[brandId][sku];
  try {
    await AsyncStorage.setItem(`${OVERRIDES_KEY_PREFIX}${brandId}`, JSON.stringify(overridesCache[brandId] || {}));
  } catch {}
}

export function getAllOverrides(brandId = 'ace'): Record<string, Partial<SkuEntry>> {
  return { ...(overridesCache[brandId] || {}) };
}

export function getStaticMap(brand?: BrandConfig): Record<string, SkuEntry> {
  return brand?.getSkuData() || {};
}

export function getUnmappedSkus(skus: string[], brand?: BrandConfig): string[] {
  return skus.filter(sku => getBrandForSku(sku, brand) === (brand?.attributes?.brand?.defaultLabel || 'Not Related'));
}

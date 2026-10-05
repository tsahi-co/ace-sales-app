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

// Brand-specific type logic based on SKU prefix rules
function getTypeBySkuRule(sku: string, brandId: string): string | null {
  switch (brandId) {
    case 'urban':
      // SKUs starting with '1' are Market Place, everything else is Urban
      return sku.startsWith('1') ? 'Market Place' : 'Urban';
    case 'beitili':
      // SKUs starting with '1' are Market Place, everything else is Beitili
      return sku.startsWith('1') ? 'Market Place' : 'Beitili';
    default:
      return null; // Fall through to static entry / default
  }
}

export function getEntryForSku(sku: string, brand?: BrandConfig): { brand: string; type: string } {
  const brandId = brand?.id || 'ace';
  const override = overridesCache[brandId]?.[sku] || {};
  const staticEntry = brand ? getStaticEntry(sku, brand) : {};

  // Type resolution order:
  // 1. Manual override (user-set)
  // 2. Brand-specific SKU prefix rule
  // 3. Static JSON data
  // 4. Brand default label
  const skuRule = getTypeBySkuRule(sku, brandId);

  return {
    brand: override.brand || staticEntry.brand || brand?.attributes?.brand?.defaultLabel || 'Not Related',
    type: override.type || skuRule || staticEntry.type || brand?.attributes?.type?.defaultLabel || 'Unknown',
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

// Fetch brand attributes from Magento for unmapped SKUs and save as overrides
export async function fetchAndSaveUnmappedSkus(
  skus: string[],
  brand: BrandConfig,
  token: string,
): Promise<number> {
  if (!skus.length || !token) return 0;

  // Only fetch SKUs not already in cache or static map
  const unmapped = getUnmappedSkus(skus, brand);
  if (!unmapped.length) return 0;

  // Batch into groups of 50 to avoid URL length limits
  const BATCH = 50;
  let saved = 0;

  for (let i = 0; i < unmapped.length; i += BATCH) {
    const batch = unmapped.slice(i, i + BATCH);
    try {
      const skuList = batch.join(',');
      const url = `${brand.baseUrl}/products?searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(skuList)}&searchCriteria[filter_groups][0][filters][0][condition_type]=in&fields=items[sku,custom_attributes]`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;

      const data = await res.json();
      const items = data.items || [];

      for (const item of items) {
        const sku = item.sku;
        const attrs = item.custom_attributes || [];
        const update: Partial<{ brand: string; type: string }> = {};

        // Map brand attribute
        const brandAttr = attrs.find((a: any) => a.attribute_code === brand.attributes.brand.code);
        if (brandAttr) {
          const brandValue = brand.attributes.brand.valueMap[brandAttr.value];
          if (brandValue) update.brand = brandValue;
        }

        // Map type attribute
        const typeAttr = attrs.find((a: any) => a.attribute_code === brand.attributes.type.code);
        if (typeAttr) {
          const typeValue = brand.attributes.type.valueMap[typeAttr.value];
          if (typeValue) update.type = typeValue;
        }

        if (Object.keys(update).length > 0) {
          await saveOverride(sku, update, brand.id);
          saved++;
        }
      }
    } catch (e) {
      console.log('[SKU] Batch fetch failed:', e);
    }
  }

  return saved;
}
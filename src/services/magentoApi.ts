import { Platform } from 'react-native';
import { BrandConfig, BRANDS } from '../config/brands';

// Get the correct base URL for a brand
// On web use Netlify proxy, on native call directly
// Web base path — the app is served under this path on the server.
// Empty string = root (Netlify), '/acesales' = IIS sub-path hosting.
const WEB_BASE_PATH = '';

function getBaseUrl(brand?: BrandConfig): string {
  const b = brand || BRANDS.ace;
  if (Platform.OS === 'web') {
    return `${WEB_BASE_PATH}${b.proxyPrefix}/rest/all/V1`;
  }
  return b.baseUrl;
}
const FETCH_TIMEOUT = 60000;

// ─── Authentication ────────────────────────────────────────────────────────

export async function getAdminToken(username: string, password: string, otp: string, brand?: BrandConfig): Promise<string> {
  const BASE_URL = getBaseUrl(brand);
  const endpoint = brand?.hasTFA === false
    ? `${BASE_URL}/integration/admin/token`
    : `${BASE_URL}/tfa/provider/google/authenticate`;
  const body = brand?.hasTFA === false
    ? { username, password }
    : { username, password, otp };

  const res = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Read body as text first — works for both plain string tokens and JSON errors
  const rawText = await res.text();

  if (!res.ok) {
    // Try to parse error as JSON for a nice message, fall back to raw text
    try {
      const err = JSON.parse(rawText);
      throw new Error(err.message || `Login failed (${res.status})`);
    } catch {
      throw new Error(rawText || `Login failed (${res.status})`);
    }
  }

  // Success: Magento returns the token as a quoted JSON string e.g. "abc123"
  // Strip surrounding quotes if present
  const token = rawText.trim().replace(/^"|"$/g, '');
  if (!token) throw new Error('Empty token received from server.');
  return token;
}

// ─── Fetch with timeout + retry ────────────────────────────────────────────

async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const t0 = Date.now();
    const shortUrl = url.split('?')[0];
    console.log(`[ACE] ➤ ${shortUrl} (attempt ${attempt})`);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      console.log(`[ACE] ✓ ${shortUrl} → ${res.status} in ${Date.now() - t0}ms`);
      return res;
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.log(`[ACE] ✗ ${shortUrl} → ${e.name}: ${e.message} after ${Date.now() - t0}ms`);
      lastError = e;
      const isNetworkError =
        e.name === 'AbortError' ||
        e.message?.includes('Network') ||
        e.message?.includes('network') ||
        e.message?.includes('fetch') ||
        e.message?.includes('Failed to fetch');
      if (!isNetworkError || attempt === maxRetries) throw e;
      console.log(`[ACE] ↻ Retrying in ${attempt * 2}s...`);
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw lastError;
}

// ─── Orders ────────────────────────────────────────────────────────────────

export interface OrderItem {
  sku: string;
  name?: string;
  price_incl_tax: number;
  qty_invoiced: number;
  qty_ordered?: number;
}

export interface Order {
  increment_id: string;
  created_at: string;
  base_grand_total: number;
  items: OrderItem[];
}

export async function fetchOrdersPage(
  token: string,
  fromDate: string,
  toDate: string,
  page: number,
  pageSize: number,
  baseUrl?: string,
  onProgress?: (fetched: number, total: number) => void,
  brand?: BrandConfig,
): Promise<{ orders: Order[]; totalCount: number }> {
  // Urban uses different item field names than ACE/Beitili
  const isUrban = (baseUrl || '').includes('urban');
  const isAce = (baseUrl || '').includes('ace');
  const itemFields = isUrban
    ? 'sku,name,base_row_total_incl_tax,qty_ordered'
    : 'sku,name,price_incl_tax,qty_invoiced';

  // Magento stores times in UTC. Israel is UTC+3.
  // To match what Magento admin shows (Israel local time):
  // ACE:          from 03:00 UTC same day  → next day 02:59:59 UTC
  // Urban/Beitili: from 21:00 UTC prev day → next day 20:59:59 UTC
  // (both equal midnight→midnight Israel time, just different business offsets)
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const fromPrevDate = new Date(Date.UTC(fy, fm - 1, fd - 1));
  const fromPrevStr = fromPrevDate.toISOString().split('T')[0];
  const toNextDate = new Date(Date.UTC(ty, tm - 1, td + 1));
  const toNextStr = toNextDate.toISOString().split('T')[0];
  const fromValue = isAce ? `${fromDate} 03:00:00` : `${fromPrevStr} 21:00:00`;
  const toValue = isAce ? `${toNextStr} 02:59:59` : `${toDate} 20:59:59`;

  const params = new URLSearchParams({
    'searchCriteria[filter_groups][0][filters][0][field]': 'created_at',
    'searchCriteria[filter_groups][0][filters][0][value]': fromValue,
    'searchCriteria[filter_groups][0][filters][0][condition_type]': 'gteq',
    'searchCriteria[filter_groups][1][filters][0][field]': 'created_at',
    'searchCriteria[filter_groups][1][filters][0][value]': toValue,
    'searchCriteria[filter_groups][1][filters][0][condition_type]': 'lteq',
    'searchCriteria[pageSize]': String(pageSize),
    'searchCriteria[currentPage]': String(page),
    // Beitili's Magento rejects nested items[items[...]] field restriction, so omit fields for it
    ...(isAce || isUrban ? {
      'fields': isUrban
        ? `total_count,items[created_at,base_grand_total,increment_id,items[${itemFields}]]`
        : 'total_count,items[created_at,base_grand_total,increment_id,items[sku,name,price_incl_tax,qty_invoiced,qty_ordered,product_option]]',
    } : {}),
  });

  // Add status filter for brands that require it (Urban, Beitili)
  if (brand?.statusFilter && brand.statusFilter.length > 0) {
    params.set('searchCriteria[filter_groups][2][filters][0][field]', 'status');
    params.set('searchCriteria[filter_groups][2][filters][0][value]', brand.statusFilter.join(','));
    params.set('searchCriteria[filter_groups][2][filters][0][condition_type]', 'in');
  }

  const url = baseUrl || getBaseUrl();
  // Magento rejects '+' for spaces in created_at — force %20 encoding
  const queryString = params.toString().replace(/\+/g, '%20');
  const res = await fetchWithRetry(
    `${url}/orders?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    const err = await res.json();
    throw new Error(err.message || 'Failed to fetch orders');
  }

  const data = await res.json();
  // Normalize Urban field names to match ACE interface (isUrban already declared above)
  const orders = (data.items || []).map((order: any) => ({
    ...order,
    items: (order.items || []).map((item: any) => ({
      ...item,
      price_incl_tax: isUrban
        ? (item.base_row_total_incl_tax || 0)
        : (item.price_incl_tax || 0),
      qty_invoiced: isUrban
        ? (item.qty_ordered || 0)
        : (item.qty_invoiced || 0),
      qty_ordered: isUrban
        ? (item.qty_ordered || 0)
        : (item.qty_ordered || item.qty_invoiced || 0),
    })),
  }));
  const totalCount = data.total_count || 0;
  if (onProgress) onProgress(orders.length, totalCount);
  return { orders, totalCount };
}

export async function fetchAllOrders(
  token: string,
  fromDate: string,
  toDate: string,
  brand?: BrandConfig,
  onProgress?: (fetched: number, total: number) => void,
): Promise<Order[]> {
  const PAGE_SIZE = 100;
  let allOrders: Order[] = [];
  let page = 1;
  let totalCount = 0;
  const t0 = Date.now();
  const BASE_URL = getBaseUrl(brand);
  console.log(`[ACE] ── fetchAllOrders start: ${fromDate} → ${toDate}`);

  do {
    const pageT0 = Date.now();
    const { orders, totalCount: tc } = await fetchOrdersPage(token, fromDate, toDate, page, PAGE_SIZE, BASE_URL, (fetched, total) => {
      if (onProgress) onProgress(allOrders.length + fetched, total);
    }, brand);
    console.log(`[ACE] Page ${page}: got ${orders.length} orders in ${Date.now() - pageT0}ms (${allOrders.length + orders.length}/${tc})`);
    allOrders = [...allOrders, ...orders];
    totalCount = tc;
    page++;
  } while (allOrders.length < totalCount);

  console.log(`[ACE] ── fetchAllOrders done: ${allOrders.length} orders in ${Date.now() - t0}ms`);
  return allOrders;
}
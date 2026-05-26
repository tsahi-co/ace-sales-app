import { Platform } from 'react-native';
import { BrandConfig, BRANDS } from '../config/brands';

// Get the correct base URL for a brand
// On web use Netlify proxy, on native call directly
function getBaseUrl(brand?: BrandConfig): string {
  const b = brand || BRANDS.ace;
  if (Platform.OS === 'web') {
    return `${b.proxyPrefix}/rest/all/V1`;
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
  price_incl_tax: number;
  qty_invoiced: number;
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
): Promise<{ orders: Order[]; totalCount: number }> {
  // Israel is UTC+3; shift window so it aligns with local business day
  const toNext = new Date(toDate + 'T00:00:00');
  toNext.setDate(toNext.getDate() + 1);
  const toNextStr = toNext.toISOString().split('T')[0];

  const params = new URLSearchParams({
    'searchCriteria[filter_groups][0][filters][0][field]': 'created_at',
    'searchCriteria[filter_groups][0][filters][0][value]': `${fromDate} 03:00:00`,
    'searchCriteria[filter_groups][0][filters][0][condition_type]': 'gteq',
    'searchCriteria[filter_groups][1][filters][0][field]': 'created_at',
    'searchCriteria[filter_groups][1][filters][0][value]': `${toNextStr} 02:59:59`,
    'searchCriteria[filter_groups][1][filters][0][condition_type]': 'lteq',
    'searchCriteria[pageSize]': String(pageSize),
    'searchCriteria[currentPage]': String(page),
    'fields': 'total_count,items[created_at,base_grand_total,increment_id,items[sku,price_incl_tax,qty_invoiced]]',
  });

  const url = baseUrl || getBaseUrl();
  const res = await fetchWithRetry(
    `${url}/orders?${params.toString()}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to fetch orders');
  }

  const data = await res.json();
  const orders = data.items || [];
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
    });
    console.log(`[ACE] Page ${page}: got ${orders.length} orders in ${Date.now() - pageT0}ms (${allOrders.length + orders.length}/${tc})`);
    allOrders = [...allOrders, ...orders];
    totalCount = tc;
    page++;
  } while (allOrders.length < totalCount);

  console.log(`[ACE] ── fetchAllOrders done: ${allOrders.length} orders in ${Date.now() - t0}ms`);
  return allOrders;
}
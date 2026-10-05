// GA4 Data API Service - Pure JS RSA-SHA256 JWT signing
// No external libraries required - works in React Native

import { GA4_SERVICE_ACCOUNT_EMAIL, GA4_SERVICE_ACCOUNT_PRIVATE_KEY } from './ga4Config';

const GA4_PROPERTY_ID = '329174817';
const SERVICE_ACCOUNT_EMAIL = GA4_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = GA4_SERVICE_ACCOUNT_PRIVATE_KEY;

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

function b64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlBytes(bytes: number[]): string {
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function rotr(n: number, x: number): number {
  return (n >>> x) | (n << (32 - x));
}

function sha256(message: string): number[] {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a;
  let h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const msgBytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    if (c < 128) msgBytes.push(c);
    else if (c < 2048) { msgBytes.push((c>>6)|192); msgBytes.push((c&63)|128); }
    else { msgBytes.push((c>>12)|224); msgBytes.push(((c>>6)&63)|128); msgBytes.push((c&63)|128); }
  }
  const len = msgBytes.length;
  msgBytes.push(0x80);
  while ((msgBytes.length % 64) !== 56) msgBytes.push(0);
  const bitLen = len * 8;
  msgBytes.push(0,0,0,0);
  msgBytes.push((bitLen>>>24)&0xff,(bitLen>>>16)&0xff,(bitLen>>>8)&0xff,bitLen&0xff);
  for (let i = 0; i < msgBytes.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++)
      w[j] = (msgBytes[i+j*4]<<24)|(msgBytes[i+j*4+1]<<16)|(msgBytes[i+j*4+2]<<8)|msgBytes[i+j*4+3];
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15],7)^rotr(w[j-15],18)^(w[j-15]>>>3);
      const s1 = rotr(w[j-2],17)^rotr(w[j-2],19)^(w[j-2]>>>10);
      w[j] = (w[j-16]+s0+w[j-7]+s1)|0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch = (e&f)^(~e&g);
      const t1 = (h+S1+ch+K[j]+w[j])|0;
      const S0 = rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0+maj)|0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
    h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  const result: number[] = [];
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(n => {
    result.push((n>>>24)&0xff,(n>>>16)&0xff,(n>>>8)&0xff,n&0xff);
  });
  return result;
}

function derReadLen(bytes: number[], p: number): { len: number; next: number } {
  if (bytes[p] < 0x80) return { len: bytes[p], next: p + 1 };
  const nb = bytes[p] & 0x7f;
  let len = 0;
  for (let i = 0; i < nb; i++) len = (len << 8) | bytes[p + 1 + i];
  return { len, next: p + 1 + nb };
}

function derSkip(bytes: number[], p: number): number {
  p++; // skip tag
  const { len, next } = derReadLen(bytes, p);
  return next + len;
}

function derReadIntBytes(bytes: number[], p: number): number[] {
  p++; // skip 0x02 INTEGER tag
  const { len, next } = derReadLen(bytes, p);
  p = next;
  // skip leading zero
  const start = (bytes[p] === 0x00) ? p + 1 : p;
  const end = next + len;
  return bytes.slice(start, end);
}

function parsePrivateKey(pem: string): { n: bigint; d: bigint } {
  let pemClean = pem;
  pemClean = pemClean.split('\\n').join('\n');
  pemClean = pemClean.replace(/-----BEGIN PRIVATE KEY-----/g, '');
  pemClean = pemClean.replace(/-----END PRIVATE KEY-----/g, '');
  pemClean = pemClean.replace(/-----BEGIN RSA PRIVATE KEY-----/g, '');
  pemClean = pemClean.replace(/-----END RSA PRIVATE KEY-----/g, '');
  const b64 = pemClean.replace(/\s+/g, '').replace(/[\r\n]/g, '').trim();
  const der = atob(b64);
  const bytes: number[] = [];
  for (let i = 0; i < der.length; i++) {
    bytes.push(der.charCodeAt(i) & 0xff);
  }

  let pos = 0;
  // Skip outer SEQUENCE
  pos++; // 0x30
  const outerSeq = derReadLen(bytes, pos);
  pos = outerSeq.next;

  // Skip version INTEGER (present in both PKCS#1 and PKCS#8 outer structure)
  pos = derSkip(bytes, pos);

  if (bytes[pos] === 0x30) {
    // PKCS#8 - next is AlgorithmIdentifier SEQUENCE
      pos = derSkip(bytes, pos); // skip AlgorithmIdentifier
      // OCTET STRING containing inner PKCS#1
    pos++; // skip 0x04
    const octetLen = derReadLen(bytes, pos);
    pos = octetLen.next;
      // Inner SEQUENCE
    pos++; // skip 0x30
    const innerSeq = derReadLen(bytes, pos);
    pos = innerSeq.next;
    // Skip inner version INTEGER
    pos = derSkip(bytes, pos);
    } else {
    // PKCS#1 - already past version, next is modulus
    }

  // n = modulus
  const nBytes = derReadIntBytes(bytes, pos);
  pos = derSkip(bytes, pos);

  // skip publicExponent
  pos = derSkip(bytes, pos);

  // d = privateExponent
  const dBytes = derReadIntBytes(bytes, pos);

  const toBigInt = (b: number[]) => b.reduce((acc: bigint, byte: number) => (acc << 8n) | BigInt(byte), 0n);
  return { n: toBigInt(nBytes), d: toBigInt(dBytes) };
}


function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  return result;
}

function rsaSign(message: string, pem: string): string {
  const { n, d } = parsePrivateKey(pem);
  const keyLen = Math.ceil(n.toString(16).length / 2);
  const hash = sha256(message);
  const prefix = [0x30,0x31,0x30,0x0d,0x06,0x09,0x60,0x86,0x48,0x01,0x65,0x03,0x04,0x02,0x01,0x05,0x00,0x04,0x20];
  const T = [...prefix, ...hash];
  const PS = new Array(keyLen - T.length - 3).fill(0xff);
  const EM = [0x00, 0x01, ...PS, 0x00, ...T];
  const m = EM.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
  const s = modPow(m, d, n);
  const sigHex = s.toString(16).padStart(keyLen * 2, '0');
  const sigBytes = sigHex.match(/.{2}/g)!.map(h => parseInt(h, 16));
  return b64urlBytes(sigBytes);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 300000) return cachedToken!;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  }));
  const sig = rsaSign(`${header}.${payload}`, SERVICE_ACCOUNT_PRIVATE_KEY);
  const jwt = `${header}.${payload}.${sig}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GA4 auth: ${data.error_description || data.error}`);
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken!;
}

export interface GA4SkuData {
  sku: string; date: string; itemsViewed: number;
  itemsAddedToCart: number; itemsPurchased: number; itemRevenue: number;
}
export interface GA4DayData {
  date: string; sessions: number; conversions: number; conversionRate: number;
  purchases: number; revenue: number; bounceRate: number; avgSessionDuration: number;
}
export interface GA4Summary { byDay: GA4DayData[]; bySku: GA4SkuData[]; }

async function runReport(body: object): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'GA4 error'); }
  return res.json();
}

async function fetchAllSkuRows(dateRange: { startDate: string; endDate: string }): Promise<any> {
  const allRows: any[] = [];
  let offset = 0;
  const limit = 10000;
  while (true) {
    const report = await runReport({
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }, { name: 'itemId' }],
      metrics: [
        { name: 'itemsViewed' }, { name: 'itemsAddedToCart' },
        { name: 'itemsPurchased' }, { name: 'itemRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'itemsViewed' }, desc: true }],
      limit,
      offset,
    });
    const rows = report.rows || [];
    allRows.push(...rows);
    const rowCount = parseInt(report.rowCount) || parseInt(report.metadata?.rowCount) || 0;
    console.log('[GA4] Fetched SKU rows:', allRows.length, 'of', rowCount, 'keys:', Object.keys(report).join(','));
    if (rows.length < limit) break;
    offset += limit;
  }
  return { rows: allRows };
}

export async function fetchGA4Data(fromDate: string, toDate: string): Promise<GA4Summary> {
  const dateRange = { startDate: fromDate, endDate: toDate };
  console.log('[GA4] Fetching date range:', fromDate, '->', toDate);
  const [dayReport, skuReport] = await Promise.all([
    runReport({
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' }, { name: 'conversions' }, { name: 'sessionConversionRate' },
        { name: 'ecommercePurchases' }, { name: 'purchaseRevenue' },
        { name: 'bounceRate' }, { name: 'averageSessionDuration' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    }),
    fetchAllSkuRows(dateRange),
  ]);
  const parseDate = (d: string) => `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  const byDay: GA4DayData[] = (dayReport.rows || []).map((r: any) => {
    const m = r.metricValues;
    return {
      date: parseDate(r.dimensionValues[0].value),
      sessions: parseInt(m[0].value)||0, conversions: parseInt(m[1].value)||0,
      conversionRate: parseFloat(m[2].value)||0, purchases: parseInt(m[3].value)||0,
      revenue: parseFloat(m[4].value)||0, bounceRate: parseFloat(m[5].value)||0,
      avgSessionDuration: parseFloat(m[6].value)||0,
    };
  });
  const bySku: GA4SkuData[] = (skuReport.rows || []).map((r: any) => {
    const m = r.metricValues;
    return {
      date: parseDate(r.dimensionValues[0].value),
      sku: r.dimensionValues[1].value,
      itemsViewed: parseInt(m[0].value)||0, itemsAddedToCart: parseInt(m[1].value)||0,
      itemsPurchased: parseInt(m[2].value)||0, itemRevenue: parseFloat(m[3].value)||0,
    };
  });
  return { byDay, bySku };
}

export function aggregateGA4BySku(bySku: GA4SkuData[]): Record<string, {
  views: number; addToCart: number; purchases: number; conversionRate: number;
}> {
  const map: Record<string, { views: number; addToCart: number; purchases: number }> = {};
  bySku.forEach(s => {
    if (!map[s.sku]) map[s.sku] = { views: 0, addToCart: 0, purchases: 0 };
    map[s.sku].views += s.itemsViewed;
    map[s.sku].addToCart += s.itemsAddedToCart;
    map[s.sku].purchases += s.itemsPurchased;
  });
  return Object.fromEntries(Object.entries(map).map(([sku, d]) => [sku, {
    ...d, conversionRate: d.views > 0 ? d.purchases / d.views : 0,
  }]));
}
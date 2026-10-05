// Cloudflare Pages Function — Magento proxy
// Catches /api/{brandId}/{magento_path...} and forwards to the right store.
// File-based routing: functions/api/[[path]].js handles everything under /api/*

const BRAND_URLS = {
  ace: "https://www.ace.co.il",
  beitili: "https://www.betili-shop.com",
  urban: "https://urban-shop.co.il",
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Path after /api/ : first segment = brand, rest = magento path
  // e.g. /api/ace/rest/all/V1/orders
  const parts = url.pathname.replace(/^\/api\//, "").split("/");
  const brandId = parts.shift();
  const magentoPath = parts.join("/");

  const baseUrl = BRAND_URLS[brandId];
  if (!baseUrl) {
    return json({ message: `Unknown brand: ${brandId}` }, 400);
  }

  const targetUrl = `${baseUrl}/${magentoPath}${url.search}`;

  const fwdHeaders = { "Content-Type": "application/json" };
  const auth = request.headers.get("authorization");
  if (auth) fwdHeaders["Authorization"] = auth;

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  try {
    const resp = await fetch(targetUrl, {
      method: request.method,
      headers: fwdHeaders,
      body,
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return json({ message: `Proxy error: ${e.message}` }, 502);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

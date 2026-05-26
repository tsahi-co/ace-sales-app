// Brand URL mapping — update when adding new brands
const BRAND_URLS = {
  ace: 'https://www.ace.co.il',
  beitili: 'https://www.betili-shop.com',
  urban: 'https://urban-shop.co.il',
};

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // Path format: /api/{brandId}/rest/all/V1/...
    // e.g. /api/ace/rest/all/V1/orders
    const pathParts = event.path.replace('/.netlify/functions/proxy', '').split('/');
    // pathParts[0] = '' (empty before first /)
    // pathParts[1] = brandId (ace, brand2, brand3)
    // pathParts[2+] = rest of path
    const brandId = pathParts[1];
    const magentoPath = '/' + pathParts.slice(2).join('/');

    const baseUrl = BRAND_URLS[brandId];
    if (!baseUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: `Unknown brand: ${brandId}` }),
      };
    }

    const queryString = event.rawQuery ? `?${event.rawQuery}` : '';
    const targetUrl = `${baseUrl}${magentoPath}${queryString}`;

    console.log(`[Proxy] ${event.httpMethod} ${brandId} → ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        ...(event.headers.authorization ? { 'Authorization': event.headers.authorization } : {}),
      },
      ...(event.body ? { body: event.body } : {}),
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: data,
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

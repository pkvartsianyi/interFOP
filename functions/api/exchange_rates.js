export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const apiUrl = 'https://api.privatbank.ua/p24api/exchange_rates' + url.search;

  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Upstream API returned an error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to fetch from upstream API" }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return newResponse;

  } catch (error) {
    console.error("Error fetching from upstream API:", error);
    return new Response(JSON.stringify({ error: "Function script failed" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

function handleOptions(request) {
    let headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      let respHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers"),
      };
      return new Response(null, { headers: respHeaders });
    } else {
      return new Response(null, {
        headers: { Allow: "GET, HEAD, POST, OPTIONS" },
      });
    }
}

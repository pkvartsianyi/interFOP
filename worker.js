
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const apiUrl = 'https://api.privatbank.ua/p24api/exchange_rates' + url.search;

  const response = await fetch(apiUrl, {
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
    }
  });

  const newResponse = new Response(response.body, response);

  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return newResponse;
}

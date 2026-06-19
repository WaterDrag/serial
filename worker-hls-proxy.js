/* ════════════════════════════════════════════════════════════════════
   AniStream — kompletní Cloudflare Worker
   ─────────────────────────────────────────────────────────────────────
   Kombinuje:
     1) svetserialu.io CORS proxy  (přidává SESSION cookie)
     2) HLS / CORS proxy pro EN streamy  (Referer hlavička)

   NASTAVENÍ v Cloudflare dashboard → Workers → anisteam → Settings → Variables:
     Přidej proměnnou:  SESSION  =  hodnota cookie ze svetserialu.io

   Jak získat SESSION cookie:
     1) Přihlas se na svetserialu.io v prohlížeči
     2) F12 → Application → Cookies → svetserialu.io
     3) Zkopíruj hodnotu cookie (může se jmenovat "laravel_session",
        "remember_web_...", nebo celý řetězec více cookies)
     4) Vlož jako hodnotu proměnné SESSION
   ════════════════════════════════════════════════════════════════════ */

const PROXY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SVT_BASE = 'https://svetserialu.io';

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    ...extra,
  };
}

/* ── Hlavní handler ─────────────────────────────────────────────── */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // HLS proxy pro EN streamy
    if (url.pathname === '/hls') return handleHlsProxy(request);

    // DeepL translation proxy (řeší CORS — DeepL blokuje přímé požadavky z prohlížeče)
    if (url.pathname === '/deepl') return handleDeeplProxy(request);

    // AnimePahe CORS proxy
    if (url.pathname === '/animepahe') return handleAnimePaheProxy(request, url, env);

    // AnimeGG CORS proxy
    if (url.pathname.startsWith('/animegg')) return handleAnimeggProxy(request, url);

    // SledujSerialy CORS proxy
    if (url.pathname.startsWith('/sledujserialy')) return handleSledujSerialyProxy(request, url);

    // SVT (svetserialu.io) proxy
    return handleSvtProxy(request, env, url);
  },
};

/* ── DeepL translation proxy ────────────────────────────────────── */
async function handleDeeplProxy(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
  }
  let body;
  try { body = await request.json(); } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders() });
  }
  const { _key, ...deeplBody } = body;
  if (!_key) return new Response('Missing _key', { status: 400, headers: corsHeaders() });

  let upstream;
  try {
    upstream = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deeplBody),
    });
  } catch (e) {
    return new Response('DeepL fetch error: ' + e.message, { status: 502, headers: corsHeaders() });
  }

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: corsHeaders({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }),
  });
}

/* ── AnimeGG CORS proxy ─────────────────────────────────────────── */
async function handleAnimeggProxy(request, reqUrl) {
  const path = reqUrl.pathname.replace(/^\/animegg/, '') || '/';
  const target = 'https://www.animegg.org' + path + reqUrl.search;
  let upstream;
  try {
    upstream = await fetch(target, {
      headers: {
        'User-Agent': PROXY_UA,
        'Referer': 'https://www.animegg.org/',
        'Origin': 'https://www.animegg.org',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return new Response('AnimeGG fetch error: ' + e.message, { status: 502, headers: corsHeaders() });
  }
  const ct = upstream.headers.get('Content-Type') || 'text/html; charset=utf-8';
  const headers = corsHeaders({ 'Content-Type': ct, 'Cache-Control': 'no-store' });
  // Pass through range/content-length for video streaming
  const cl = upstream.headers.get('Content-Length');
  if (cl) headers['Content-Length'] = cl;
  const cr = upstream.headers.get('Content-Range');
  if (cr) headers['Content-Range'] = cr;
  headers['Accept-Ranges'] = 'bytes';
  return new Response(upstream.body, { status: upstream.status, headers });
}

/* ── AnimePahe CORS proxy ───────────────────────────────────────── */
async function handleAnimePaheProxy(request, reqUrl, env) {
  const target = reqUrl.searchParams.get('url');
  if (!target) return new Response('Missing ?url=', { status: 400, headers: corsHeaders() });

  const headers = {
    'User-Agent': PROXY_UA,
    'Referer': 'https://animepahe.ch/',
    'Accept': 'application/json, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
  };
  const aphCookie = (env && env.APH_COOKIE) || '';
  if (aphCookie) headers['Cookie'] = aphCookie;

  let upstream;
  try {
    upstream = await fetch(target, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    return new Response('AnimePahe fetch error: ' + e.message, { status: 502, headers: corsHeaders() });
  }

  const body = await upstream.text();
  const ct = upstream.headers.get('Content-Type') || 'application/json';
  return new Response(body, {
    status: upstream.status,
    headers: corsHeaders({ 'Content-Type': ct, 'Cache-Control': 'no-store' }),
  });
}

/* ── sledujserialy.io proxy ─────────────────────────────────────── */
async function handleSledujSerialyProxy(request, reqUrl) {
  const path = reqUrl.pathname.replace(/^\/sledujserialy/, '') || '/';
  const target = 'https://sledujserialy.io' + path + reqUrl.search;
  const headers = {
    'User-Agent': PROXY_UA,
    'Referer': 'https://sledujserialy.io/',
    'Origin': 'https://sledujserialy.io',
    'Accept': 'application/json, */*',
    'Accept-Language': 'cs,sk;q=0.9,en-US;q=0.8',
    'X-Requested-With': 'XMLHttpRequest',
  };
  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    headers['Content-Type'] = request.headers.get('Content-Type') || 'application/x-www-form-urlencoded; charset=UTF-8';
    body = await request.text();
  }
  let upstream;
  try {
    upstream = await fetch(target, { method: request.method, headers, body, redirect: 'follow', signal: AbortSignal.timeout(15000) });
  } catch (e) {
    return new Response('SledujSerialy fetch error: ' + e.message, { status: 502, headers: corsHeaders() });
  }
  const ct = upstream.headers.get('Content-Type') || 'application/json';
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: corsHeaders({ 'Content-Type': ct, 'Cache-Control': 'no-store' }),
  });
}

/* ── svetserialu.io proxy ───────────────────────────────────────── */
async function handleSvtProxy(request, env, url) {
  const session = env.SESSION || '';
  const targetUrl = SVT_BASE + url.pathname + url.search;

  const headers = {
    'User-Agent': PROXY_UA,
    'Referer': SVT_BASE + '/',
    'Origin': SVT_BASE,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'cs,sk;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (session) {
    // SESSION může být buď samotná hodnota cookie, nebo celý cookie řetězec
    headers['Cookie'] = session.includes('=') ? session : `session=${session}`;
  }

  let response;
  try {
    response = await fetch(targetUrl, { headers, redirect: 'follow' });
  } catch (e) {
    return new Response('SVT fetch error: ' + e.message, {
      status: 502, headers: corsHeaders({ 'Content-Type': 'text/plain' }),
    });
  }

  const body = await response.text();
  const ct = response.headers.get('Content-Type') || 'text/html; charset=utf-8';

  return new Response(body, {
    status: response.status,
    headers: corsHeaders({
      'Content-Type': ct,
      'Cache-Control': 'no-store',
    }),
  });
}

/* ── HLS / CORS proxy pro EN streamy ────────────────────────────── */
export async function handleHlsProxy(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get('url');
  const ref = reqUrl.searchParams.get('ref') || '';
  if (!target) {
    return new Response('Missing ?url=', { status: 400, headers: corsHeaders() });
  }

  const upstreamHeaders = { 'User-Agent': PROXY_UA };
  if (ref) {
    upstreamHeaders['Referer'] = ref;
    try { upstreamHeaders['Origin'] = new URL(ref).origin; } catch {}
  }
  const range = request.headers.get('Range');
  if (range) upstreamHeaders['Range'] = range;

  let upstream;
  try {
    upstream = await fetch(target, { headers: upstreamHeaders, redirect: 'follow' });
  } catch (e) {
    return new Response('Upstream fetch failed: ' + e.message, {
      status: 502, headers: corsHeaders(),
    });
  }

  const ctype = (upstream.headers.get('Content-Type') || '').toLowerCase();
  const path = (() => { try { return new URL(target).pathname.toLowerCase(); } catch { return ''; } })();
  const isPlaylist =
    ctype.includes('mpegurl') || ctype.includes('vnd.apple') || path.endsWith('.m3u8');

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, target, reqUrl.origin, ref);
    return new Response(rewritten, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      }),
    });
  }

  const passHeaders = corsHeaders({
    'Cache-Control': upstream.headers.get('Cache-Control') || 'public, max-age=3600',
  });
  const ct = upstream.headers.get('Content-Type');
  if (ct) passHeaders['Content-Type'] = ct;
  const cl = upstream.headers.get('Content-Length');
  if (cl) passHeaders['Content-Length'] = cl;
  const cr = upstream.headers.get('Content-Range');
  if (cr) passHeaders['Content-Range'] = cr;
  passHeaders['Accept-Ranges'] = upstream.headers.get('Accept-Ranges') || 'bytes';

  return new Response(upstream.body, { status: upstream.status, headers: passHeaders });
}

function rewritePlaylist(text, playlistUrl, proxyOrigin, ref) {
  const wrap = (absUrl) =>
    `${proxyOrigin}/hls?url=${encodeURIComponent(absUrl)}` +
    (ref ? `&ref=${encodeURIComponent(ref)}` : '');
  const toAbs = (u) => {
    try { return new URL(u, playlistUrl).href; } catch { return u; }
  };

  return text.split('\n').map((line) => {
    const t = line.trim();
    if (t === '') return line;
    if (t.startsWith('#')) {
      if (t.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${wrap(toAbs(u))}"`);
      }
      return line;
    }
    return wrap(toAbs(t));
  }).join('\n');
}

/**
 * WaterStream Push Notifications Worker
 *
 * Nasazení:
 * 1. Vytvoř nový Cloudflare Worker (dash.cloudflare.com → Workers → Create)
 * 2. Vlož tento kód
 * 3. Přidej KV namespace "PUSH_KV" (Settings → Variables → KV Namespace Bindings)
 * 4. Přidej secrets (Settings → Variables → Secret):
 *    - SVT_SESSION      … SESSION cookie ze svetserialu.io
 *    - VAPID_PRIVATE_JWK … zkopíruj hodnotu z app.js (konstanta _VAPID_PRIVATE_JWK)
 * 5. Přidej Cron Trigger: 0 *\/3 * * *  (každé 3 hodiny)
 * 6. URL tohoto Workeru vlož do nastavení WaterStream → Push Worker URL
 */

const VAPID_PUBLIC_KEY = 'BF7ZKQsAKWEn7jG413pG4YTjWtF0L_Ou9qxUK94rbhHowq17ASi3SNXG3qony-lRqtGMVEeAmZi_smVJvf5xb8Q';
const VAPID_SUBJECT    = 'mailto:zitkatomik00@gmail.com';
const SVT_BASE         = 'https://www.svetserialu.io';
const KV_SVT_STATE     = 'svt_cron_state_v1';
const KV_SUBS_INDEX    = 'subs_idx';

/* ── Utils ─────────────────────────────────────────────── */

function b64url2buf(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function buf2b64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function joinBufs(...bs) {
  const out = new Uint8Array(bs.reduce((s,b) => s + b.length, 0));
  let i = 0;
  for (const b of bs) { out.set(b, i); i += b.length; }
  return out;
}
async function hkdf(ikm, salt, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name:'HKDF', hash:'SHA-256', salt, info }, key, len * 8));
}
async function epHash(ep) {
  return buf2b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ep))).slice(0, 16);
}

/* ── Web Push encryption — RFC 8291 / aes128gcm ────────── */

async function encryptPush(keys, payload) {
  const recvPub  = b64url2buf(keys.p256dh);
  const authSec  = b64url2buf(keys.auth);
  const plain    = new TextEncoder().encode(JSON.stringify(payload));
  const padded   = new Uint8Array(plain.length + 1);
  padded.set(plain);
  padded[plain.length] = 2; // RFC 8188 delimiter

  const eph      = await crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
  const recvKey  = await crypto.subtle.importKey('raw', recvPub, { name:'ECDH', namedCurve:'P-256' }, false, []);
  const secret   = new Uint8Array(await crypto.subtle.deriveBits({ name:'ECDH', public:recvKey }, eph.privateKey, 256));
  const sndPub   = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const salt     = crypto.getRandomValues(new Uint8Array(16));

  // IKM per RFC 8291 §3.3
  const ikm = await hkdf(
    secret, authSec,
    joinBufs(new TextEncoder().encode('WebPush: info\0'), new Uint8Array(recvPub), sndPub),
    32
  );
  const cek   = await hkdf(ikm, salt, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  const aesKey  = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher  = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv:nonce, tagLength:128 }, aesKey, padded));

  // RFC 8188 header: salt(16) + rs(4) + idlen(1) + sender_pub(65)
  const hdr = new Uint8Array(86);
  hdr.set(salt, 0);
  new DataView(hdr.buffer).setUint32(16, 4096, false);
  hdr[20] = 65;
  hdr.set(sndPub, 21);

  return joinBufs(hdr, cipher);
}

/* ── VAPID JWT ──────────────────────────────────────────── */

async function makeVapidJwt(endpoint, jwkStr) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 43200;
  const hdr = buf2b64url(new TextEncoder().encode(JSON.stringify({ typ:'JWT', alg:'ES256' })));
  const pay = buf2b64url(new TextEncoder().encode(JSON.stringify({ aud, exp, sub:VAPID_SUBJECT })));
  const msg = `${hdr}.${pay}`;
  const key = await crypto.subtle.importKey('jwk', JSON.parse(jwkStr), { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, key, new TextEncoder().encode(msg));
  return `${msg}.${buf2b64url(sig)}`;
}

/* ── Send one push notification ─────────────────────────── */

async function sendPush(sub, payload, jwkStr) {
  const jwt  = await makeVapidJwt(sub.endpoint, jwkStr);
  const body = await encryptPush(sub.keys, payload);
  const res  = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization':    `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'Content-Type':     'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL':              '86400',
    },
    body,
  });
  return res.status;
}

/* ── KV helpers ─────────────────────────────────────────── */

async function listSubs(kv) {
  const idx = await kv.get(KV_SUBS_INDEX, { type:'json' }) || [];
  return (await Promise.all(idx.map(h => kv.get('sub:'+h, { type:'json' })))).filter(Boolean);
}
async function saveSub(kv, ep, keys, favIds, slugMap, favMeta, appBase, notifPrefs) {
  const h = await epHash(ep);
  await kv.put('sub:'+h, JSON.stringify({ endpoint:ep, keys, favIds, slugMap, favMeta, appBase:appBase||'', notifPrefs:notifPrefs||{titulky:true,dabing:false}, ts:Date.now() }));
  const idx = await kv.get(KV_SUBS_INDEX, { type:'json' }) || [];
  if (!idx.includes(h)) { idx.push(h); await kv.put(KV_SUBS_INDEX, JSON.stringify(idx)); }
}
async function deleteSub(kv, ep) {
  const h   = await epHash(ep);
  await kv.delete('sub:'+h);
  const idx = (await kv.get(KV_SUBS_INDEX, { type:'json' }) || []).filter(x => x !== h);
  await kv.put(KV_SUBS_INDEX, JSON.stringify(idx));
}
async function updateSub(kv, ep, data) {
  const h   = await epHash(ep);
  const sub = await kv.get('sub:'+h, { type:'json' });
  if (sub) await kv.put('sub:'+h, JSON.stringify({ ...sub, ...data, ts:Date.now() }));
}

/* ── CORS ───────────────────────────────────────────────── */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function ok(body = 'OK') { return new Response(body, { headers: { ...CORS, 'Content-Type':'text/plain' } }); }

/* ── Fetch handlers ─────────────────────────────────────── */

async function handleSubscribe(req, env) {
  const { subscription, favIds, slugMap, favMeta, appBase, notifPrefs } = await req.json();
  await saveSub(env.PUSH_KV, subscription.endpoint, subscription.keys, favIds||[], slugMap||{}, favMeta||{}, appBase||'', notifPrefs);
  return ok();
}
async function handleUnsubscribe(req, env) {
  const { endpoint } = await req.json();
  await deleteSub(env.PUSH_KV, endpoint);
  return ok();
}
async function handleSyncFavs(req, env) {
  const { endpoint, favIds, slugMap, favMeta, appBase, notifPrefs } = await req.json();
  const upd = { favIds: favIds||[], slugMap: slugMap||{}, favMeta: favMeta||{} };
  if (appBase) upd.appBase = appBase;
  if (notifPrefs) upd.notifPrefs = notifPrefs;
  await updateSub(env.PUSH_KV, endpoint, upd);
  return ok();
}

/* ── Cron: check SVT feed → send push notifications ─────── */

async function runCron(env) {
  const session = env.SVT_SESSION;
  if (!session) { console.log('[CRON] SVT_SESSION not set'); return; }

  const svtHdrs = { 'Cookie': `SESSION=${session}`, 'User-Agent': 'Mozilla/5.0' };

  // Set SVT filter: všechny anime, všechny nové epizody
  try {
    await fetch(SVT_BASE+'/', { method:'POST', headers:{ ...svtHdrs, 'Content-Type':'application/x-www-form-urlencoded' }, body:'episodes=1&setFilter=1' });
    await fetch(SVT_BASE+'/', { method:'POST', headers:{ ...svtHdrs, 'Content-Type':'application/x-www-form-urlencoded' }, body:'animeEpisodes=2&setFilterAnime=1' });
  } catch {}

  let html;
  try {
    const r = await fetch(SVT_BASE+'/?ajaxTVShows=true&page=0', { headers: svtHdrs });
    html = await r.text();
  } catch (e) { console.error('[CRON] SVT fetch failed:', e.message); return; }

  const state = await env.PUSH_KV.get(KV_SVT_STATE, { type:'json' }) || {};
  const subs  = await listSubs(env.PUSH_KV);
  if (!subs.length) { console.log('[CRON] No subscribers'); return; }

  // Parse new episodes from SVT feed
  const re       = /href="\/serial\/([a-z0-9-]+)\/(s(\d+)e(\d+))"/gi;
  const newEps   = [];
  const seenSlug = new Set();
  let m;

  while ((m = re.exec(html)) !== null) {
    const slug = m[1], season = parseInt(m[3]), ep = parseInt(m[4]);
    if (seenSlug.has(slug)) continue;
    seenSlug.add(slug);

    const segStart = Math.max(0, m.index - 100);
    const segEnd   = Math.min(html.length, m.index + 900);
    const seg      = html.slice(segStart, segEnd);
    const hasTit   = /episode-cc/.test(seg);
    const hasDab   = /episode-dub/.test(seg);

    // Per-epizoda sledování oznámených jazyků — titulky mohou přibýt
    // až několik dní po vydání epizody, pak se oznámí dodatečně
    const epKey    = `${season}_${ep}`;
    const notified = (state[slug] && state[slug].notifLangs && state[slug].notifLangs[epKey]) || { tit:false, dab:false };
    const newTit   = hasTit && !notified.tit;
    const newDab   = hasDab && !notified.dab;

    state[slug] = { ...(state[slug] || {}), lastEp: epKey };
    if (newTit || newDab) newEps.push({ slug, season, ep, epKey, hasTit, hasDab, newTit, newDab });
  }

  if (!newEps.length) {
    await env.PUSH_KV.put(KV_SVT_STATE, JSON.stringify(state));
    return;
  }

  const jwkStr = env.VAPID_PRIVATE_JWK;

  // Pro každého odběratele zkontroluj shodu slug → oblíbené
  for (const sub of subs) {
    const favSet  = new Set(sub.favIds || []);
    const slugMap = sub.slugMap || {};
    const favMeta = sub.favMeta || {};
    const prefs   = sub.notifPrefs || { titulky:true, dabing:false };

    for (const epInfo of newEps) {
      const tmdbId = slugMap[epInfo.slug];
      if (!tmdbId || !favSet.has(tmdbId)) continue;
      // Filtruj podle jazykových preferencí — jen NOVĚ přidané titulky/dabing
      const wants = (epInfo.newTit && prefs.titulky !== false) || (epInfo.newDab && !!prefs.dabing);
      if (!wants) continue;

      const meta   = favMeta[String(tmdbId)] || favMeta[tmdbId] || {};
      const s      = String(epInfo.season).padStart(2, '0');
      const e      = String(epInfo.ep).padStart(2, '0');
      const lang   = epInfo.newTit && epInfo.newDab ? 'Přidány titulky i dabing' : epInfo.newDab ? 'Přidaný CZ dabing' : 'Přidané CZ titulky';

      const base  = (sub.appBase || '').replace(/\/$/, '');
      const payload = {
        title: meta.title || `Anime #${tmdbId}`,
        body:  `S${s} E${e} · ${lang}`,
        icon:  meta.poster || '',
        url:   `${base}/watch.html?id=${tmdbId}&ep=${epInfo.ep}&season=${epInfo.season}`,
        tag:   `ws-${tmdbId}-s${s}e${e}`,
      };

      try {
        const status = await sendPush(sub, payload, jwkStr);
        if (status === 201 || status === 200 || status === 202) {
          // Označ jazyky jako oznámené (jen aktuální epizoda — omezuje velikost KV)
          const prevL = (state[epInfo.slug].notifLangs || {})[epInfo.epKey] || { tit:false, dab:false };
          state[epInfo.slug].notifLangs = { [epInfo.epKey]: { tit: prevL.tit || epInfo.hasTit, dab: prevL.dab || epInfo.hasDab } };
        } else if (status === 410 || status === 404) {
          await deleteSub(env.PUSH_KV, sub.endpoint); // vypršela platnost předplatného
        }
        console.log(`[PUSH] ${meta.title || tmdbId} S${s}E${e} → ${status}`);
      } catch (err) {
        console.error('[PUSH] sendPush error:', err.message);
      }
    }
  }

  await env.PUSH_KV.put(KV_SVT_STATE, JSON.stringify(state));
  console.log(`[CRON] Done. New episodes checked: ${newEps.length}`);
}

/* ── Export ─────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:CORS });
    const path = new URL(request.url).pathname;
    if (path === '/push-subscribe')   return handleSubscribe(request, env);
    if (path === '/push-unsubscribe') return handleUnsubscribe(request, env);
    if (path === '/push-sync-favs')   return handleSyncFavs(request, env);
    return ok('WaterStream Push Worker');
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(env));
  },
};

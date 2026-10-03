// 離線：網頁殼＋資料 network-first（4 秒沒回就先用快取，慢回應仍會更新快取）；圖／音檔 cache-first（檔名帶 ?v= 破快取）。
// 只快取白名單內的頁殼與資料，且一律存「乾淨」回應（去掉 redirected 標記，否則離線導覽會失敗）。
const V = 'dq365-shell-20261003-yunjhe-v1', M = 'dq365-media-20261003-yunjhe-v1';
const SHELL = ['/', '/archive', '/rights', '/css/style.css', '/js/app.js', '/js/audio-config.js', '/js/day.js', '/js/cats.js', '/js/quiz.js', '/js/archive.js', '/js/progress.js', '/js/mission.js', '/js/share.js', '/js/vendor/gc-config.js', '/js/vendor/count.js', '/data/scenes.json', '/data/reading-overrides.json'];
const CORE = ['/', '/css/style.css', '/js/app.js', '/js/audio-config.js', '/data/scenes.json'];
const MAX_MEDIA = 400;

const keyOf = p => { p = p.replace(/\.html$/, '').replace(/(.)\/$/, '$1'); return p === '/index' ? '/' : p; };
const isMedia = p => /^\/(audio|img|bg)\//.test(p);
const timeout = ms => new Promise(r => setTimeout(() => r(null), ms));

async function clean(res) {
  return res.redirected ? new Response(await res.blob(), { status: 200, headers: res.headers }) : res;
}

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(V);
  const results = await Promise.allSettled(SHELL.map(async u => {
    const res = await fetch(u, { cache: 'reload' });
    if (!res.ok) throw new Error(u);
    await c.put(u, await clean(res));
  }));
  if (results.some((r, i) => r.status === 'rejected' && CORE.includes(SHELL[i]))) throw new Error('core precache failed');
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== M).map(k => caches.delete(k)))).then(() => self.clients.claim())));

async function slice(res, range) {
  const buf = await res.arrayBuffer(), total = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!m || (!m[1] && !m[2])) return new Response(buf, { headers: res.headers });
  let start, end;
  if (!m[1]) { start = Math.max(0, total - +m[2]); end = total - 1; }
  else { start = +m[1]; end = m[2] ? Math.min(+m[2], total - 1) : total - 1; }
  if (start >= total || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(end - start + 1) } });
}

async function store(c, url, res) {
  await c.put(url, res);
  const ks = await c.keys();
  if (ks.length > MAX_MEDIA) await Promise.all(ks.slice(0, 50).map(k => c.delete(k)));
}

async function media(e, req) {
  const c = await caches.open(M);
  let res = await c.match(req.url);
  if (!res) {
    res = await fetch(req.url); // 一律抓完整檔，Range 請求由本地切片回應
    if (res.ok && /^(audio|image)\//.test(res.headers.get('content-type') || '')) e.waitUntil(store(c, req.url, res.clone()));
  }
  const range = req.headers.get('range');
  return range && res.ok ? slice(res.clone(), range) : res;
}

async function shell(e, req, key) {
  const c = await caches.open(V);
  const net = fetch(req, req.mode === 'navigate' ? undefined : { cache: 'no-cache' }).then(async r => {
    if (r.ok && r.type === 'basic') await c.put(key, await clean(r.clone()));
    return r;
  });
  e.waitUntil(net.catch(() => {}));
  try { const r = await Promise.race([net, timeout(4000)]); if (r) return r; } catch {}
  const hit = await c.match(key);
  if (hit) return hit;
  try { return await net; } catch {
    return (req.mode === 'navigate' && await c.match('/')) || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (isMedia(url.pathname)) return e.respondWith(media(e, req));
  const key = keyOf(url.pathname);
  if (SHELL.includes(key)) e.respondWith(shell(e, req, key));
});

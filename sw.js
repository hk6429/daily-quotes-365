// 離線：網頁殼＋資料 network-first（有網路永遠拿最新，斷網才用快取）；圖／音檔 cache-first（檔名帶 ?v= 破快取）。
const V = 'dq365-v1';
const SHELL = ['./', 'index.html', 'archive.html', 'rights.html', 'css/style.css', 'js/app.js', 'js/day.js', 'js/cats.js', 'js/quiz.js', 'data/scenes.json'];
const PAGE = { '/': 'index.html', '/index.html': 'index.html', '/archive': 'archive.html', '/archive.html': 'archive.html', '/rights': 'rights.html', '/rights.html': 'rights.html' };

self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));

const isMedia = p => /^\/(audio|img|bg)\//.test(p);

async function slice(res, range) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
    'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1) } });
}

async function media(req) {
  const c = await caches.open(V);
  let res = await c.match(req.url);
  if (!res) {
    res = await fetch(req.url); // 一律抓完整檔，Range 請求由本地切片回應
    if (res.ok) c.put(req.url, res.clone());
  }
  const range = req.headers.get('range');
  return range && res.ok ? slice(res.clone(), range) : res;
}

async function shell(req, url) {
  const c = await caches.open(V);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(PAGE[url.pathname] || req.url, res.clone());
    return res;
  } catch {
    const hit = await c.match(PAGE[url.pathname] || req.url);
    if (hit) return hit;
    if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
    return Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (isMedia(url.pathname)) return e.respondWith(media(req));
  e.respondWith(shell(req, url));
});

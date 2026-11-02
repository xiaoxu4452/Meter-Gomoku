'use strict';
/* 离线外壳：把页面本身缓存下来，配合 app.js 里的引擎缓存（mgcalc-engine-v1），
   断网也能打开并计算。引擎文件（41MB）由页面自己写 Cache Storage，这里不拦截。 */

const SHELL = 'mgcalc-shell-v3';
const ASSETS = ['./', 'index.html', 'app.css', 'app.js', 'worker.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== SHELL && k.startsWith('mgcalc-shell')).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/engine/') >= 0) return;

  // 在线优先（保证改了就能看到），断网时回落到缓存
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});

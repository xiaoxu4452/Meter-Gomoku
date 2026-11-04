/* Injects COOP/COEP so SharedArrayBuffer + wasm pthreads work on hosts that
   cannot set response headers (GitHub Pages). Also keeps a versioned shell cache.

   The 41 MB engine package is handled inside calc/worker.js (multi-route probe +
   ranged download), so this worker only needs to leave those requests alone and
   make sure the engine cache survives shell updates. */
'use strict';

const VERSION = '20261109a';
/* Keep the engine cache name stable across UI releases: worker.js stores the
   weights under this name, and a new shell must not throw 41 MB away. Bumped
   only when the weight entry itself changes. */
const ENGINE_VERSION = '20261105c';
const SHELL_CACHE = 'mgcalc-shell-' + VERSION;
const ENGINE_CACHE = 'mgcalc-engine-' + ENGINE_VERSION;
const KEEP = [SHELL_CACHE, ENGINE_CACHE];
const SHELL = ['./', './index.html', './app.css', './app.js', './worker.js', './guide.html'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL.map(async (u) => {
      try {
        const r = await fetch(new Request(u, { cache: 'reload' }));
        if (r.ok) await c.put(u, r);
      } catch (err) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (KEEP.indexOf(k) < 0 ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

function withHeaders(res, nav) {
  if (!res) return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  if (nav) h.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

async function networkFirst(req, nav) {
  try {
    const res = await fetch(req, { cache: nav ? 'no-store' : 'no-cache' });
    if (res && res.ok && !nav) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(req, res.clone()).catch(() => {});
    }
    return withHeaders(res, nav);
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return withHeaders(hit, nav);
    if (nav) {
      const idx = await caches.match('./index.html', { ignoreSearch: true });
      if (idx) return withHeaders(idx, true);
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  /* engine assets are downloaded by worker.js as plain streams — hands off.
     The one exception is the pthread worker Emscripten spawns from the engine
     script: it is a subresource of a COEP: require-corp page, so without the
     CORP header Chrome refuses it and the multi-threaded engine goes deaf. */
  if (url.pathname.indexOf('/engine/') >= 0) {
    if (req.destination === 'worker' || req.destination === 'sharedworker') {
      e.respondWith(fetch(req).then((r) => withHeaders(r, false)).catch(() => Response.error()));
    }
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, true));
    return;
  }
  if (/\.(?:js|css|html)$/.test(url.pathname)) {
    e.respondWith(networkFirst(req, false));
  }
});

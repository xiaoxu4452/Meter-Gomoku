/* Rapfi Gomocup bridge. Keeps the engine protocol stable for the UI.
   - infinite analysis: one long-running search, stopped through the STOP command
   - balance: YXBALANCEONE / YXBALANCETWO streamed while the search deepens
   - rule changes invalidate the hash (YXHASHCLEAR) like desktop-connect does  */
'use strict';

let Mod = null;
let active = null;          // { id, gen, topN, scan, infinite, stopping, lastBest, key }
let pending = null;         // newest request queued behind the running one (older ones are dropped)
let bal = null;             // { id, gen, count, moves, stopping, lastPoints, key }
let pvIdx = -1;
let curNumPv = 0;
let pvs = [];
let glob = { speed: 0, totaltime: 0, totalnodes: 0 };
let lastCfg = { threads: 0, hashMB: 0, caution: 0, rule: -1 };
let stopTimer = 0;
let scanTimer = 0;
let booting = false;
/* Serialisation: every job carries a monotonically increasing seq. A job whose
   seq is older than the newest accepted one is stale and must never reach the
   engine, so rapid clicking cannot stack searches. The newest queued job wins. */
let jobSeq = -1;
let hbTimer = 0;
/* A reset (new game / pasted position / transform) must wait until the running
   search has actually stopped: Rapfi ignores every command except STOP while
   `thinking` is true, so a hash clear sent too early would be dropped. */
let resetReq = null;
let lastStrength = { maxDepth: -1, maxNodes: -1, strength: -1, pondering: -1 };
/* Rapfi drops every non-STOP command while `thinking` is true. If a stop is not
   acknowledged in time we assume the engine is still finishing an iteration and
   must prove it is idle before another job rewrites the board — otherwise the
   board/YXNBEST lines are swallowed and the search never starts. YXHASHCLEAR is
   the cheapest command the engine always answers, so its reply is that proof. */
let engineDirty = false;
let idleTimer = 0;

function waitEngineIdle(ms) {
  engineDirty = true;
  clearTimeout(idleTimer);
  send('STOP');
  send('YXHASHCLEAR');
  idleTimer = setTimeout(() => {
    idleTimer = 0;
    if (engineDirty) post({ t: 'stalled', msg: 'engine did not answer STOP' });
  }, Math.max(1000, ms || 4000));
}

function jobKey(job) {
  const mv = (job.moves || []).map((m) => m[0] + ',' + m[1] + ',' + m[2]).join(';');
  return (job.rule | 0) + '|' + (job.topN | 0) + '|' + (job.scan ? 1 : 0) +
    '|' + (job.infinite ? 1 : 0) + '|' + (job.scan ? (job.timeMs | 0) : 0) + '|' + mv;
}

function startHeartbeat() {
  stopHeartbeat();
  hbTimer = setInterval(() => {
    if (!active && !bal) { stopHeartbeat(); return; }
    const st = statsOf();
    post({ t: 'hb', search: !!active, balance: !!bal, depth: st.depth, nodes: st.nodes, time: st.time, stopping: !!(active && active.stopping) || !!(bal && bal.stopping) });
  }, 500);
}
function stopHeartbeat() {
  if (hbTimer) { clearInterval(hbTimer); hbTimer = 0; }
}

function post(msg) {
  self.postMessage(msg);
}

/* ---- engine assets -------------------------------------------------------
   The weights package is ~41 MB and GitHub Pages is unreliable from mainland
   China, so every file is fetched from a list of routes: the site itself first,
   then public GitHub mirrors (several of them terminate in China). Each route is
   probed with a one-byte range request, the quickest one wins, and the download
   is split into 4 MB ranges so a single stalled chunk can be retried on another
   route instead of throwing the whole download away. */
const MIRROR_ROOT = [
  'https://ghproxy.net/https://raw.githubusercontent.com/xiaoxu4452/Meter-Gomoku/main/calc/engine/',
  'https://gh-proxy.com/https://raw.githubusercontent.com/xiaoxu4452/Meter-Gomoku/main/calc/engine/',
  'https://ghfast.top/https://raw.githubusercontent.com/xiaoxu4452/Meter-Gomoku/main/calc/engine/',
  'https://cdn.jsdelivr.net/gh/xiaoxu4452/Meter-Gomoku@main/calc/engine/',
  'https://raw.githubusercontent.com/xiaoxu4452/Meter-Gomoku/main/calc/engine/',
];

let loadPct = -1;
let loadAt = 0;
function postLoad(pct, key) {
  const p = Math.max(0, Math.min(100, pct));
  const now = Date.now();
  if (p - loadPct < 0.8 && now - loadAt < 140 && p < 100) return;
  if (p < loadPct) return;
  loadPct = p;
  loadAt = now;
  post({ t: 'load', pct: p, key: key || null });
}

function isCross(url) {
  return url.indexOf(self.location.origin + '/') !== 0;
}

function reqOpts(url, extra) {
  const o = {
    mode: isCross(url) ? 'cors' : 'same-origin',
    credentials: isCross(url) ? 'omit' : 'same-origin',
    cache: 'no-store',
    signal: extra && extra.signal,
  };
  if (extra && extra.headers) o.headers = extra.headers;
  return o;
}

/* one-byte range probe: cheap, and it also tells us whether ranges are honoured.
   `cap` shortens the timeout for the "is our own host healthy?" check. */
async function probeRoute(url, cap) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), cap || 6000);
  try {
    const res = await fetch(url, reqOpts(url, { signal: ctl.signal, headers: { Range: 'bytes=0-0' } }));
    if (!res.ok) return null;
    const cr = res.headers.get('content-range') || '';
    const total = cr ? (+cr.split('/')[1] || 0) : (+res.headers.get('content-length') || 0);
    const ranged = res.status === 206;
    try { ctl.abort(); } catch (e) {}
    return { url, ms: Date.now() - t0, total, ranged };
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* stream one route into memory, with progress and hard sanity checks: a proxy
   that answers with an HTML error page used to be cached as if it were the
   wasm binary, which then failed at instantiate() on every later visit */
async function fetchWhole(url, from, to, meta) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 240000);
  try {
    const res = await fetch(url, reqOpts(url, { signal: ctl.signal }));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const declared = +res.headers.get('content-length') || 0;
    if (meta.min && declared && declared < meta.min) throw new Error('too small: ' + declared);
    const reader = res.body && res.body.getReader();
    let buf;
    if (!reader) {
      buf = await res.arrayBuffer();
      postLoad(to, null);
    } else {
      const chunks = [];
      let got = 0;
      for (;;) {
        const step = await reader.read();
        if (step.done) break;
        chunks.push(step.value);
        got += step.value.length;
        postLoad(from + (to - from) * (declared ? Math.min(1, got / declared) : 0), null);
      }
      const out = new Uint8Array(got);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      buf = out.buffer;
    }
    if (meta.min && buf.byteLength < meta.min) throw new Error('short read: ' + buf.byteLength);
    if (meta.wasm) {
      const m = new Uint8Array(buf, 0, 4);
      if (!(m[0] === 0 && m[1] === 0x61 && m[2] === 0x73 && m[3] === 0x6d)) throw new Error('not wasm');
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

/* pick the routes that answer, quickest first */
async function rankRoutes(urls) {
  const hits = (await Promise.all(urls.map(probeRoute))).filter(Boolean);
  hits.sort((a, b) => a.ms - b.ms);
  return hits;
}

/* ---- ranged pull for the weight package -------------------------------
   The weights are one 40 MB stream, and on a lossy link a single connection
   crawls at 100–300 KB/s no matter how fast the line is. So the file is cut
   into fixed chunks that several routes pull at the same time: each chunk can
   fall back to another mirror on its own, and progress is reported as chunks
   land, which keeps the bar moving smoothly instead of stalling. */
const CHUNK_BYTES = 3 * 1024 * 1024;
const LANES = 4;

async function fetchChunk(route, start, end) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90000);
  try {
    const res = await fetch(route.url, reqOpts(route.url, {
      signal: ctl.signal,
      headers: { Range: 'bytes=' + start + '-' + (end - 1) },
    }));
    if (res.status !== 206) throw new Error('range ignored: ' + res.status);
    const buf = await res.arrayBuffer();
    if (buf.byteLength !== end - start) throw new Error('short chunk: ' + buf.byteLength);
    return new Uint8Array(buf);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRanged(routes, meta, from, to) {
  const total = routes[0].total;
  const chunk = (meta && meta.chunk) || CHUNK_BYTES;
  /* the wasm is ~1.1 MB and the weights 40 MB: both are cut into ranges, with a
     smaller chunk size for the wasm so four connections still share the work */
  if (!total || total < Math.max(512 * 1024, chunk * 1.5)) return null;
  const n = Math.ceil(total / chunk);
  const out = new Uint8Array(total);
  let next = 0;
  let filled = 0;
  let dead = null;
  const lanes = Math.max(1, Math.min(LANES, routes.length * 2, n));
  const lane = async (seed) => {
    for (;;) {
      if (dead) return;
      const k = next++;
      if (k >= n) return;
      const start = k * chunk;
      const end = Math.min(total, start + chunk);
      let ok = false;
      for (let t = 0; t < routes.length && !ok; t++) {
        const route = routes[(seed + k + t) % routes.length];
        try {
          out.set(await fetchChunk(route, start, end), start);
          ok = true;
        } catch (err) { /* next mirror takes this chunk */ }
      }
      if (!ok) { dead = new Error('chunk ' + k + ' failed on every route'); return; }
      filled += end - start;
      postLoad(from + (to - from) * (filled / total), null);
    }
  };
  await Promise.all(Array.from({ length: lanes }, (_, i) => lane(i)));
  if (dead) throw dead;
  const buf = out.buffer;
  if (meta.min && buf.byteLength < meta.min) throw new Error('short read: ' + buf.byteLength);
  if (meta.wasm) {
    const m = new Uint8Array(buf, 0, 4);
    if (!(m[0] === 0 && m[1] === 0x61 && m[2] === 0x73 && m[3] === 0x6d)) throw new Error('not wasm');
  }
  return buf;
}

/* The site itself is tried first and trusted only when the bytes pass the size
   and magic checks; public mirrors are the fallback for networks where GitHub
   Pages is unreachable. Small files keep one plain stream; the 40 MB weight
   package probes every route and then pulls ranged chunks in parallel. */
async function downloadFrom(urls, meta, from, to) {
  const list = urls.slice();
  let last = null;
  if (!meta.big) {
    const first = list.shift();
    try {
      return await fetchWhole(first, from, to, meta);
    } catch (err) {
      last = err;
    }
    const small = await rankRoutes(list);
    for (const route of small) {
      try { return await fetchWhole(route.url, from, to, meta); } catch (err) { last = err; }
    }
    throw last || new Error('download failed');
  }
  /* Fast path: when our own origin answers a probe within half a second, go
     straight to ranged chunks on it — no mirror probing, no waiting for the
     proxy chain to time out (that wait was what made a warm CDN feel cold). */
  const home = await probeRoute(list[0], 2500);
  if (home && home.ranged && home.total) {
    try {
      const buf = await fetchRanged([home], meta, from, to);
      if (buf) return buf;
    } catch (err) {
      last = err;
    }
  }
  const routes = await rankRoutes(list);
  const ranged = routes.filter((r) => r.ranged && r.total);
  if (ranged.length) {
    try {
      const buf = await fetchRanged(ranged, meta, from, to);
      if (buf) return buf;
    } catch (err) {
      last = err;
    }
  }
  for (const route of routes) {
    try { return await fetchWhole(route.url, from, to, meta); } catch (err) { last = err; }
  }
  throw last || new Error('download failed');
}

/* Authoritative size + SHA-256 of the files shipped in this release. A proxy
   that answers with a truncated file, an HTML error page or an old network is
   rejected instead of being cached, so a bad copy can never silently weaken
   the engine on later visits. */
const ASSET_META = {
  'rapfi.data': { size: 40306406, sha256: '2fa58b1c9e005a7b39bbddb798097a8f1ff9ceaba4c9339d87ba7d324b9d846d' },
  'rapfi-multi-simd128.wasm': { size: 1137577, sha256: '642c79f0fd929a3679053e1b52701e82f9c1749c797e177e1b14bb025fd5a166' },
  'rapfi-single-simd128.wasm': { size: 1105309, sha256: 'e9ad428a43d6f99c2f5394ddfd05a7e6132408fb85463477a5a9aa173a12c386' },
};

async function sha256hex(buf) {
  try {
    const d = await crypto.subtle.digest('SHA-256', buf);
    const a = new Uint8Array(d);
    let s = '';
    for (let i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    return s;
  } catch (e) {
    return '';                 // WebCrypto missing: the size check still applies
  }
}

async function verifyAsset(name, buf) {
  const meta = ASSET_META[name];
  if (!meta) return { ok: true, sha: '' };
  if (buf.byteLength !== meta.size) return { ok: false, sha: '', why: 'size ' + buf.byteLength + ' != ' + meta.size };
  const sha = await sha256hex(buf);
  if (!sha) return { ok: true, sha: '' };
  if (sha !== meta.sha256) return { ok: false, sha, why: 'sha256 ' + sha.slice(0, 12) + '… != ' + meta.sha256.slice(0, 12) + '…' };
  return { ok: true, sha };
}

function assetReport(list, rec) {
  if (list) list.push(rec);
  post({ t: 'asset', asset: rec });
}

/* Enumerate Cache Storage entries of this project and delete everything that
   is not the current weight/wasm: older mgcalc-engine-* caches, stale ?v=
   keys inside the current cache, truncated entries and orphans. */
async function cleanCaches(name, keepUrls) {
  const before = [];
  const removed = [];
  try {
    const names = await caches.keys();
    for (const k of names) {
      if (!/^mgcalc-engine-/.test(k)) continue;
      let list = [];
      try {
        const c = await caches.open(k);
        for (const req of await c.keys()) {
          const res = await c.match(req);
          const sz = res ? (+(res.headers.get('X-Size') || res.headers.get('content-length')) || 0) : 0;
          list.push({ url: req.url, bytes: sz });
        }
      } catch (e) {}
      before.push({ name: k, entries: list.length, bytes: list.reduce((n, e) => n + e.bytes, 0), list });
      if (k !== name) {
        try { await caches.delete(k); } catch (e) {}
        removed.push({ cache: k, reason: 'previous release' });
        continue;
      }
      const keep = new Set(keepUrls.map((u) => new URL(u, self.location.href).href.split('?')[0]));
      try {
        const c = await caches.open(k);
        for (const req of await c.keys()) {
          const base = req.url.split('?')[0];
          const isWasm = /rapfi-[a-z0-9-]+\.wasm$/.test(base);
          if (!keep.has(base) && !isWasm) {
            await c.delete(req);
            removed.push({ cache: k, reason: 'stale key', url: req.url });
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
  return { before, removed, keep: name, keepUrls: keepUrls.map((u) => new URL(u, self.location.href).href.split('?')[0]) };
}

async function loadAsset(url, cache, from, to, reports) {
  const abs = new URL(url, self.location.href).href;
  const name = abs.split('/').pop().split('?')[0];
  const meta = /.wasm$/.test(name)
    ? { min: 100000, wasm: true, big: true, chunk: 1024 * 1024 }
    : { min: 200000, big: /\.data$/.test(name) };
  const t0 = Date.now();
  if (cache) {
    try {
      /* exact key (the UI appends ?v=<release>): a new release never reads an
         old copy, an old release keeps its own warm entry */
      const hit = await cache.match(abs);
      if (hit) {
        const buf = await hit.arrayBuffer();
        const v = await verifyAsset(name, buf);
        if (v.ok) {
          postLoad(to, 'loadCached');
          assetReport(reports, { name, source: 'cache', bytes: buf.byteLength, ms: Date.now() - t0, sha: v.sha || '' });
          return buf;
        }
        try { await cache.delete(abs); } catch (e) {}
      }
    } catch (err) {}
  }
  const urls = [abs].concat(MIRROR_ROOT.map((base) => base + name));
  let buf = null;
  let v = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    buf = await downloadFrom(urls, meta, from, to);
    if (!buf || !buf.byteLength) throw new Error('empty download');
    v = await verifyAsset(name, buf);
    if (v.ok) break;
    try { if (cache) await cache.delete(abs); } catch (e) {}
    if (attempt === 0) post({ t: 'stderr', msg: 'integrity check failed for ' + name + ' (' + v.why + '), re-downloading' });
  }
  if (!v || !v.ok) throw new Error('integrity check failed: ' + (v && v.why));
  if (cache) {
    try {
      await cache.put(abs, new Response(buf, {
        headers: { 'Content-Type': 'application/octet-stream', 'X-Size': String(buf.byteLength) },
      }));
    } catch (err) {}
  }
  assetReport(reports, { name, source: 'network', bytes: buf.byteLength, ms: Date.now() - t0, sha: v.sha || '' });
  return buf;
}

function parseIntegerList(text) {
  const out = [];
  const re = /([0-9]+)\s*,\s*([0-9]+)/g;
  let m;
  while ((m = re.exec(text))) out.push([+m[1], +m[2]]);
  return out;
}

function candidates() {
  return pvs.map((p, i) => ({
    rank: i,
    depth: p.depth || 0,
    eval: p.eval || '',
    winrate: typeof p.winrate === 'number' ? p.winrate : 0.5,
    line: parseIntegerList(p.bestline || ''),
    move: parseIntegerList(p.bestline || '')[0] || null,
  })).filter((c) => c.move);
}

function statsOf() {
  let depth = 0;
  for (let i = 0; i < pvs.length; i++) {
    const q = pvs[i];
    if (q && q.depth > depth) depth = q.depth;
  }
  const top = pvs[0] || {};
  return {
    depth,
    seldepth: top.seldepth || depth,
    eval: top.eval || '',
    winrate: typeof top.winrate === 'number' ? top.winrate : 0.5,
    speed: glob.speed || top.speed || 0,
    nodes: glob.totalnodes || top.totalnodes || 0,
    time: glob.totaltime || top.totaltime || 0,
    line: parseIntegerList(top.bestline || ''),
  };
}

function balancePts(stats, count) {
  const line = (stats && stats.line) || [];
  const n = Math.max(1, Math.min(2, count | 0));
  return line.slice(0, n).map((p) => [p[0], p[1]]);
}

function emitInfo(final, best) {
  if (!active) return;
  /* A scan asks the engine for one PV per empty point, so the whole board can
     change several times a second. The final frame is always sent; live frames
     are throttled so a hundred circles do not redraw the page at full speed. */
  const now = Date.now();
  if (!final && active.scan && now - active.lastEmit < 300) return;
  active.lastEmit = now;
  const stats = statsOf();
  const cands = candidates();
  post({
    t: final ? 'best' : 'info',
    id: active.id,
    gen: active.gen,
    scan: !!active.scan,
    stats,
    candidates: cands,
    best: best || (cands[0] && cands[0].move) || active.lastBest || null,
  });
  if (cands[0] && cands[0].move) active.lastBest = cands[0].move;
}

function emitBalanceTick() {
  if (!bal || bal.stopping) return;
  const stats = statsOf();
  if (!stats.depth) return;
  const pts = balancePts(stats, bal.count);
  if (!pts.length) return;
  bal.lastPoints = pts;
  post({ t: 'balance-tick', id: bal.id, gen: bal.gen, points: pts, stats });
}

/* any exception inside the parser kills the whole output stream, so trap it and
   report it to the page instead of going silent */
function onLine(raw) {
  try { handleLine(raw); } catch (err) {
    post({ t: 'stderr', msg: 'parse ' + ((err && err.message) || err) + ' | ' + String(raw).slice(0, 70) });
  }
}

function handleLine(raw) {
  const line = String(raw).replace(/\r/g, '').trim();
  if (!line) return;

  if (line === 'INFO PV DONE') {
    if (pvIdx >= 0 && pvs[pvIdx]) {
      /* Rapfi completes and prints root PVs one by one inside an iteration, so
         emitting on every PV would combine a fresh rank 0 with stale lower
         ranks (and briefly show the same move twice). Emit only when the last
         PV of the iteration is done: that frame is internally consistent, and
         the engine's rank order stays stable between refreshes. */
      if (curNumPv > 0 && pvIdx + 1 >= curNumPv) {
        if (bal) emitBalanceTick();
        else emitInfo(false);
      }
    }
    pvIdx = -1;
    return;
  }
  if (line.startsWith('INFO PV ')) {
    pvIdx = +line.slice(8);
    if (!pvs[pvIdx]) pvs[pvIdx] = {};
    return;
  }
  if (line.startsWith('INFO ')) {
    const sp = line.indexOf(' ');
    const sp2 = line.indexOf(' ', sp + 1);
    const key = line.slice(sp + 1, sp2 > 0 ? sp2 : undefined);
    const val = sp2 > 0 ? line.slice(sp2 + 1).trim() : '';
    const p = pvIdx >= 0 ? (pvs[pvIdx] || (pvs[pvIdx] = {})) : null;
    if (key === 'TOTALTIME') glob.totaltime = +val;
    else if (key === 'TOTALNODES') glob.totalnodes = +val;
    else if (key === 'SPEED') glob.speed = +val;
    if (!p) return;
    if (key === 'DEPTH') p.depth = +val;
    else if (key === 'SELDEPTH') p.seldepth = +val;
    else if (key === 'EVAL') p.eval = val;
    else if (key === 'WINRATE') p.winrate = parseFloat(val);
    else if (key === 'SPEED') p.speed = +val;
    else if (key === 'NODES') p.nodes = +val;
    else if (key === 'TOTALNODES') p.totalnodes = +val;
    else if (key === 'TOTALTIME') p.totaltime = +val;
    else if (key === 'BESTLINE') p.bestline = val;
    else if (key === 'NUMPV') curNumPv = +val;
    return;
  }

  // final coordinate line: "x,y" (ONE / normal best) or "x,y x,y ..." (TWO pair)
  if (/^[0-9]+,[0-9]+(?:\s+[0-9]+,[0-9]+)*$/.test(line)) {
    const pts = parseIntegerList(line);
    if (bal) { finishBalance(pts, statsOf()); return; }
    if (active) { finishSearch(pts[0]); return; }
    return;
  }
  if (/^SWAP$/i.test(line)) {
    if (bal) finishBalance([], null);
    return;
  }
  if (line.startsWith('ERROR')) {
    post({ t: 'error', msg: line.slice(0, 160) });
  }
  if (line.startsWith('MESSAGE')) {
    const text = line.slice(7).trim();
    /* Rapfi answers YXHASHCLEAR with this line; forward it so the page can
       prove a new game really starts from an empty transposition table. It also
       proves the engine is idle again after a forced stop, which releases the
       queued job. */
    if (/transposition table cleared/i.test(text)) {
      post({ t: 'hashclear', text });
      if (engineDirty) {
        engineDirty = false;
        clearTimeout(idleTimer);
        idleTimer = 0;
        if (resetReq) applyReset();
        if (pending && !bal) startPending();
      }
    }
    return;
  }
}

function send(line) {
  if (Mod) Mod.sendCommand(line);
}

function sendBoard(moves) {
  let cmd = 'YXBOARD';
  for (const m of moves || []) {
    const ey = 14 - m[1];
    cmd += ' ' + m[0] + ',' + ey + ',' + m[2];
  }
  cmd += ' DONE';
  send(cmd);
}

/* Strength knobs mirror gomoku-calculator's engine setup: MAX_DEPTH,
   MAX_NODE, STRENGTH (skill) and PONDERING. They are sent before every job so
   a scan can silence background pondering while a normal search keeps it. */
function applyStrength(cfg) {
  const c = cfg || {};
  const maxDepth = Math.max(1, Math.min(255, c.maxDepth == null ? 64 : (c.maxDepth | 0)));
  const maxNodes = Math.max(0, Math.floor(c.maxNodes || 0));
  const strength = Math.max(1, Math.min(100, c.strength == null ? 100 : (c.strength | 0)));
  const pondering = c.pondering ? 1 : 0;
  if (maxDepth !== lastStrength.maxDepth) { send('INFO MAX_DEPTH ' + maxDepth); lastStrength.maxDepth = maxDepth; }
  if (maxNodes !== lastStrength.maxNodes) { send('INFO MAX_NODE ' + maxNodes); lastStrength.maxNodes = maxNodes; }
  if (strength !== lastStrength.strength) { send('INFO STRENGTH ' + strength); lastStrength.strength = strength; }
  if (pondering !== lastStrength.pondering) { send('INFO PONDERING ' + pondering); lastStrength.pondering = pondering; }
}

function applyConfig(threads, hashMB, caution, rule, force) {
  if (force || rule !== lastCfg.rule) {
    send('INFO RULE ' + (rule | 0));
    lastCfg.rule = rule | 0;
  }
  if (force || threads !== lastCfg.threads) {
    send('INFO THREAD_NUM ' + threads);
    lastCfg.threads = threads;
  }
  if (force || hashMB !== lastCfg.hashMB) {
    send('INFO HASH_SIZE ' + (hashMB * 1024));
    lastCfg.hashMB = hashMB;
  }
  if (force || caution !== lastCfg.caution) {
    send('INFO CAUTION_FACTOR ' + caution);
    lastCfg.caution = caution;
  }
}

async function boot(opts) {
  booting = true;
  loadPct = -1;
  loadAt = 0;
  const bootT0 = Date.now();
  try {
    const build = opts.build === 'multi' ? 'multi' : 'single';
    let urls = opts.urls;
    let dataBuf = null;
    let wasmBuf = null;
    postLoad(2, 'loadFetch');
    /* Kick both network streams off before the (cached, synchronous) engine
       script is parsed, so script eval overlaps the download instead of
       preceding it. The wasm is ~3% of the bytes, so only the weights drive
       the progress bar. */
    const reports = [];
    let cacheInfo = null;
    let cache = null;
    try {
      /* drop old mtcalc-engine-* caches and stale keys before reading anything */
      cacheInfo = await cleanCaches(opts.cacheName || 'mgcalc-engine', [opts.urls.data, opts.urls.wasm]);
      post({ t: 'cache', info: cacheInfo });
    } catch (err) {}
    try { cache = await caches.open(opts.cacheName || 'mgcalc-engine'); } catch (err) {}
    const assets = Promise.all([
      loadAsset(opts.urls.data, cache, 4, 96, reports),
      loadAsset(opts.urls.wasm, cache, 0, 0, reports),
    ]);
    assets.catch(() => {});              // avoid an unhandled rejection while parsing
    importScripts(opts.urls.js);
    postLoad(4, 'loadCached');
    /* Hand the bytes straight to the runtime instead of wrapping them in blob
       URLs: getPreloadedPackage() keeps Emscripten from fetching the 41 MB a
       second time, and instantiateWasm() compiles the module we already hold.
       Together they remove a full 40 MB round trip from every cold start. */
    try {
      const [data, wasm] = await assets;
      dataBuf = data;
      wasmBuf = wasm;
    } catch (err) {
      // last resort: let the module fetch the plain URLs itself
      post({ t: 'stderr', msg: 'asset load failed: ' + String((err && err.message) || err) });
      dataBuf = null;
      wasmBuf = null;
    }
    postLoad(96, 'loadModule');
    const mod = await Rapfi({
      locateFile: (f) => {
        if (/\.wasm$/.test(f)) return opts.urls.wasm;
        if (/\.data$/.test(f)) return opts.urls.data;
        return new URL(f, opts.urls.js).href;
      },
      getPreloadedPackage: () => dataBuf,
      instantiateWasm: (imports, done) => {
        WebAssembly.instantiate(wasmBuf, imports)
          .then((r) => done(r.instance, r.module))
          .catch((err) => post({ t: 'stderr', msg: 'instantiate ' + ((err && err.message) || err) }));
        return {};
      },
      mainScriptUrlOrBlob: build === 'multi' ? opts.urls.js : undefined,
      onReceiveStdout: onLine,
      onReceiveStderr: (s) => post({ t: 'stderr', msg: String(s).slice(0, 200) }),
      onExit: (c) => post({ t: 'exit', code: c }),
      setStatus: () => {},
    });
    Mod = mod;
    postLoad(97, 'loadStart');
    send('START 15');
    // Emscripten pthread workers need a moment before THREAD_NUM is accepted;
    // 180 ms is enough on this build (verified 8 threads / >1.5 MNPS) and trims
    // the fixed boot delay further.
    await new Promise((r) => setTimeout(r, 180));
    applyConfig(opts.threads, opts.hashMB, opts.caution, opts.rule, true);
    send('INFO SHOW_DETAIL 3');
    applyStrength({ maxDepth: opts.maxDepth, maxNodes: opts.maxNodes, strength: opts.strength, pondering: opts.pondering });
    send('INFO TIMEOUT_MATCH 6000000');
    send('INFO TIME_LEFT 6000000');
    booting = false;
    postLoad(100, 'loadDone');
    post({ t: 'ready', build, threads: opts.threads, hashMB: opts.hashMB,
      assets: reports, cache: cacheInfo, loadMs: Date.now() - bootT0 });
  } catch (err) {
    booting = false;
    post({ t: 'initfail', error: String((err && err.message) || err).slice(0, 300) });
  }
}

function finishSearch(best, forced) {
  if (!active) return;
  const a = active;
  active = null;
  clearTimeout(stopTimer);
  clearTimeout(scanTimer);
  stopHeartbeat();
  if (forced) {
    /* the build did not answer STOP in time — repeat it so the engine is really
       idle before the queued job sends a new position */
    send('STOP');
  }
  const stats = statsOf();
  post({
    t: 'best', id: a.id, gen: a.gen, scan: !!a.scan, stats, candidates: candidates(),
    best: best || a.lastBest || null,
    forced: !!forced,
  });
  /* a reset that arrived while this search was running is executed now,
     before the next queued job (which may start a fresh search) */
  if (forced) {
    /* The engine ignored STOP long enough that we cannot trust it to be idle:
       it is probably still finishing a long iteration (a 200+ PV scan can
       overshoot by seconds) and would silently drop the next board/YXNBEST.
       Prove idleness with the hash-clear reply before releasing the queue. */
    post({ t: 'stderr', msg: 'forced stop after ' + Math.round((a.scan ? 2500 : 500) / 100) / 10 + ' s' });
    waitEngineIdle(a.scan ? 5000 : 2500);
    return;
  }
  if (resetReq) applyReset();
  if (pending && !bal) startPending();
}

function startPending() {
  if (!pending || engineDirty) return;
  const p = pending;
  pending = null;
  if (p.kind === 'balance') balance(p.job);
  else startSearch(p.job);
}

function startSearch(job) {
  if (!Mod || engineDirty) return;
  clearTimeout(stopTimer);
  clearTimeout(scanTimer);
  active = {
    id: job.id, gen: job.gen, topN: Math.max(1, Math.min(8, job.topN | 0)),
    scan: !!job.scan, infinite: !!job.infinite, stopping: false, lastBest: null,
    lastEmit: 0, key: jobKey(job),
  };
  pvs = [];
  pvIdx = -1;
  curNumPv = 0;
  glob = { speed: 0, totaltime: 0, totalnodes: 0 };
  /* a scan must cover the whole board, so it forces Rapfi's widest candidate
     range (5 = FULL_BOARD) for the duration of this job; the next job sends its
     own caution factor again and rebuilds the board with it */
  applyConfig(job.threads, job.hashMB, active.scan ? 5 : job.caution, job.rule, false);
  /* a scan owns every thread, so background pondering stays off for its run */
  applyStrength({
    maxDepth: job.maxDepth, maxNodes: job.maxNodes, strength: job.strength,
    pondering: job.pondering && !active.scan ? 1 : 0,
  });
  send('INFO TIMEOUT_TURN ' + (job.infinite ? 3600000 : Math.max(300, job.timeMs | 0)));
  sendBoard(job.moves);
  /* YXSEARCHDEFEND enumerates every empty point (Rapfi sets multiPV to
     movesLeft()) and is what the scan switch asks for. YXNBEST N is the strict
     multi-PV path: one engine PV per rank, no repeated main line. */
  send(active.scan ? 'YXSEARCHDEFEND' : 'YXNBEST ' + active.topN);
  /* The engine's own turn clock is not reliable for a 100+ PV search (the
     iteration can run long past it), so the scan gets an explicit wall-clock
     fence. STOP produces the final frame through finishSearch. */
  if (active.scan) {
    scanTimer = setTimeout(() => {
      if (active && active.scan && !active.stopping) stopSearch();
    }, Math.max(300, job.timeMs | 0));
  }
  startHeartbeat();
}

function search(job) {
  if (!Mod) return;
  if (job.seq != null) {
    if (job.seq <= jobSeq) return;          // superseded while it was in the pipe
    jobSeq = job.seq;
  }
  const key = jobKey(job);
  if (engineDirty) { pending = { kind: 'search', job, key }; return; }
  if (active) {
    if (active.key === key) return;         // idempotent: the same search is running
    pending = { kind: 'search', job, key }; // newest request wins, older pending dropped
    stopSearch();
    return;
  }
  if (bal) {
    pending = { kind: 'search', job, key };
    stopBalance();
    return;
  }
  if (pending && pending.key === key) return;
  startSearch(job);
}

function stopSearch() {
  if (!active || active.stopping) return;
  active.stopping = true;
  send('STOP');
  // Guarantee a bounded stop even if the engine build does not answer STOP;
  // the next job must not wait forever for an answer that never comes. A scan
  // owns ~220 PVs, so its last iteration can legitimately overshoot by seconds.
  clearTimeout(stopTimer);
  const scanJob = !!(active && active.scan);
  stopTimer = setTimeout(() => {
    if (active) finishSearch(active.lastBest, true);
  }, (scanJob ? 2500 : 500));
}

function finishBalance(points, stats) {
  if (!bal) return;
  const b = bal;
  bal = null;
  clearTimeout(b.timer);
  stopHeartbeat();
  // The balance search leaves an extra move on the engine board; resend the real
  // position and reset the block list before any later search.
  setTimeout(() => {
    send('YXBLOCKRESET');
    sendBoard(b.moves);
    post({
      t: 'balance', id: b.id, gen: b.gen,
      points: (points || []).slice(0, Math.max(1, Math.min(2, b.count))),
      stats: stats || null,
    });
    if (resetReq) applyReset();
    if (pending && !active) startPending();
  }, 0);
}

function balance(job) {
  if (!Mod) return;
  if (job.seq != null) {
    if (job.seq <= jobSeq) return;
    jobSeq = job.seq;
  }
  const key = jobKey(job);
  if (bal) {
    if (bal.key === key) return;
    pending = { kind: 'balance', job, key };
    stopBalance();
    return;
  }
  if (active) {
    pending = { kind: 'balance', job, key };
    stopSearch();
    return;
  }
  if (pending && pending.key === key) return;
  clearTimeout(stopTimer);
  const count = Math.max(1, Math.min(2, job.count | 0));
  pvs = [];
  pvIdx = -1;
  glob = { speed: 0, totaltime: 0, totalnodes: 0 };
  applyConfig(job.threads, job.hashMB, job.caution, job.rule, false);
  applyStrength({ maxDepth: job.maxDepth, maxNodes: job.maxNodes, strength: job.strength, pondering: 0 });
  const b = { id: job.id, gen: job.gen, count, moves: job.moves, stopping: false, lastPoints: [], timer: 0, key };
  bal = b;
  send('INFO TIMEOUT_TURN ' + (job.infinite ? 3600000 : Math.max(500, job.timeMs | 0)));
  sendBoard(job.moves);
  send(count >= 2 ? 'YXBALANCETWO 0' : 'YXBALANCEONE 0');
  startHeartbeat();
  b.timer = setTimeout(() => {
    if (bal === b) finishBalance(b.lastPoints, statsOf());
  }, job.infinite ? 3600000 : Math.max(500, job.timeMs | 0) + 5500);
}

function stopBalance() {
  if (!bal || bal.stopping) return;
  bal.stopping = true;
  send('STOP');
  const b = bal;
  setTimeout(() => {
    if (bal === b) finishBalance(b.lastPoints, statsOf());
  }, 600);
}

function resetEngine(moves, rule) {
  /* remember the request; when a search/ponder is still running it is executed
     in finishSearch/finishBalance, because Rapfi drops every non-STOP command
     while `thinking` is true (a hash clear sent early would be silently lost) */
  resetReq = { moves: moves || null, rule: rule | 0 };
  pending = null;
  if (active) stopSearch();
  if (bal) stopBalance();
  if (!active && !bal) applyReset();
}

function applyReset() {
  const r = resetReq;
  if (!r) return;
  resetReq = null;
  send('STOP');              /* also cancels a background ponder search */
  send('YXHASHCLEAR');       /* Rapfi replies "Transposition table cleared." */
  send('YXBLOCKRESET');
  applyConfig(lastCfg.threads || 1, lastCfg.hashMB || 0, lastCfg.caution || 0, r.rule, false);
  if (r.moves) sendBoard(r.moves);
}

self.onmessage = (e) => {
  const d = e.data || {};
  try {
    if (d.t === 'init') boot(d);
    else if (d.t === 'search') search(d.job);
    else if (d.t === 'stop') {
      /* a stop invalidates every job already in the pipe, so a late request that
         raced past the UI cannot restart the search after the user cancelled */
      if (d.seq != null && d.seq > jobSeq) jobSeq = d.seq;
      if (bal) stopBalance();
      else stopSearch();
    }
    else if (d.t === 'balance') balance(d.job);
    else if (d.t === 'config') applyConfig(d.threads, d.hashMB, d.caution, d.rule, false);
    else if (d.t === 'strength') {
      /* Rapfi only reads INFO while idle; the UI stops the search first, and
         this STOP also cancels a background ponder that is still running */
      if (!d.cfg || !d.cfg.pondering) send('STOP');
      applyStrength(d.cfg);
    }
    else if (d.t === 'reset') resetEngine(d.moves, d.rule);
    else if (d.t === 'shutdown') self.close();
  } catch (err) {
    post({ t: 'stderr', msg: 'handler ' + d.t + ': ' + ((err && err.message) || err) });
  }
};

/* never fail silently: an uncaught error inside the worker used to leave the
   page waiting for a search that would never answer */
self.onerror = (e) => {
  const bits = [];
  if (e) {
    if (e.message) bits.push(e.message);
    if (e.filename) bits.push(e.filename.split('/').pop() + ':' + e.lineno + ':' + e.colno);
    if (e.error) bits.push(String((e.error && (e.error.stack || e.error.message)) || e.error).slice(0, 200));
  }
  post({ t: 'stderr', msg: 'worker ' + (bits.join(' | ') || 'unknown') });
};
self.addEventListener('unhandledrejection', (e) => {
  post({ t: 'stderr', msg: 'promise ' + ((e.reason && e.reason.message) || e.reason) });
});

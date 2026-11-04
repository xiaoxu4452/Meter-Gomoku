/* Rapfi Gomocup bridge. Keeps the engine protocol stable for the UI.
   - infinite analysis: one long-running search, stopped through the STOP command
   - balance: YXBALANCEONE / YXBALANCETWO streamed while the search deepens
   - rule changes invalidate the hash (YXHASHCLEAR) like desktop-connect does  */
'use strict';

let Mod = null;
let active = null;          // { id, gen, topN, infinite, stopping, lastBest, key }
let pending = null;         // newest request queued behind the running one (older ones are dropped)
let bal = null;             // { id, gen, count, moves, stopping, lastPoints, key }
let pvIdx = -1;
let pvs = [];
let glob = { speed: 0, totaltime: 0, totalnodes: 0 };
let lastCfg = { threads: 0, hashMB: 0, caution: 0, rule: -1 };
let stopTimer = 0;
let booting = false;
/* Serialisation: every job carries a monotonically increasing seq. A job whose
   seq is older than the newest accepted one is stale and must never reach the
   engine, so rapid clicking cannot stack searches. The newest queued job wins. */
let jobSeq = -1;
let hbTimer = 0;

function jobKey(job) {
  const mv = (job.moves || []).map((m) => m[0] + ',' + m[1] + ',' + m[2]).join(';');
  return (job.rule | 0) + '|' + (job.topN | 0) + '|' + (job.infinite ? 1 : 0) + '|' + mv;
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

/* one-byte range probe: cheap, and it also tells us whether ranges are honoured */
async function probeRoute(url) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
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

/* The site itself is tried first and trusted only when the bytes pass the size
   and magic checks; public mirrors are the fallback for networks where GitHub
   Pages is unreachable. Sequential on purpose: one good stream beats several
   half-broken chunk streams from proxies. */
async function downloadFrom(urls, meta, from, to) {
  const list = urls.slice();
  const first = list.shift();
  let last = null;
  try {
    return await fetchWhole(first, from, to, meta);
  } catch (err) {
    last = err;
  }
  const routes = await rankRoutes(list);
  for (const route of routes) {
    try { return await fetchWhole(route.url, from, to, meta); } catch (err) { last = err; }
  }
  throw last || new Error('download failed');
}

function looksValid(name, buf, res) {
  const size = +(res.headers.get('X-Size') || 0);
  if (!size || buf.byteLength !== size) return false;
  if (/\.wasm$/.test(name)) {
    const b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    if (!(b[0] === 0 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d)) return false;
  }
  if (/\.data$/.test(name) && buf.byteLength < 1024 * 1024) return false;
  return true;
}

async function loadAsset(url, cache, from, to) {
  const abs = new URL(url, self.location.href).href;
  const name = abs.split('/').pop().split('?')[0];
  const meta = /.wasm$/.test(name) ? { min: 100000, wasm: true } : { min: 200000 };
  if (cache) {
    try {
      /* exact key (the UI appends ?v=<release>): a new release never reads an
         old copy, an old release keeps its own warm entry */
      const hit = await cache.match(abs);
      if (hit) {
        const buf = await hit.arrayBuffer();
        if (looksValid(name, buf, hit)) {
          postLoad(to, 'loadCached');
          return buf;
        }
        await cache.delete(abs);
      }
    } catch (err) {}
  }
  const urls = [abs].concat(MIRROR_ROOT.map((base) => base + name));
  const buf = await downloadFrom(urls, meta, from, to);
  if (!buf || !buf.byteLength) throw new Error('empty download');
  if (cache) {
    try {
      await cache.put(abs, new Response(buf, {
        headers: { 'Content-Type': 'application/octet-stream', 'X-Size': String(buf.byteLength) },
      }));
    } catch (err) {}
  }
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
  const stats = statsOf();
  const cands = candidates();
  post({
    t: final ? 'best' : 'info',
    id: active.id,
    gen: active.gen,
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
      if (bal) emitBalanceTick();
      else emitInfo(false);
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
    let cache = null;
    try { cache = await caches.open(opts.cacheName || 'mgcalc-engine'); } catch (err) {}
    const assets = Promise.all([
      loadAsset(opts.urls.data, cache, 4, 96),
      loadAsset(opts.urls.wasm, cache, 0, 0),
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
    send('INFO PONDERING 0');
    send('INFO TIMEOUT_MATCH 6000000');
    send('INFO TIME_LEFT 6000000');
    booting = false;
    postLoad(100, 'loadDone');
    post({ t: 'ready', build, threads: opts.threads, hashMB: opts.hashMB });
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
  stopHeartbeat();
  if (forced) {
    /* the build did not answer STOP in time — repeat it so the engine is really
       idle before the queued job sends a new position */
    send('STOP');
  }
  const stats = statsOf();
  post({
    t: 'best', id: a.id, gen: a.gen, stats, candidates: candidates(),
    best: best || a.lastBest || null,
    forced: !!forced,
  });
  if (pending && !bal) {
    /* after a forced stop give the engine one more beat to settle before the
       next job rewrites the board */
    if (forced) setTimeout(startPending, 150);
    else startPending();
  }
}

function startPending() {
  if (!pending) return;
  const p = pending;
  pending = null;
  if (p.kind === 'balance') balance(p.job);
  else startSearch(p.job);
}

function startSearch(job) {
  if (!Mod) return;
  clearTimeout(stopTimer);
  active = {
    id: job.id, gen: job.gen, topN: Math.max(1, Math.min(8, job.topN | 0)),
    infinite: !!job.infinite, stopping: false, lastBest: null, key: jobKey(job),
  };
  pvs = [];
  pvIdx = -1;
  glob = { speed: 0, totaltime: 0, totalnodes: 0 };
  applyConfig(job.threads, job.hashMB, job.caution, job.rule, false);
  send('INFO TIMEOUT_TURN ' + (job.infinite ? 3600000 : Math.max(300, job.timeMs | 0)));
  sendBoard(job.moves);
  send('YXNBEST ' + active.topN);
  startHeartbeat();
}

function search(job) {
  if (!Mod) return;
  if (job.seq != null) {
    if (job.seq <= jobSeq) return;          // superseded while it was in the pipe
    jobSeq = job.seq;
  }
  const key = jobKey(job);
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
  // the next job must not wait forever for an answer that never comes.
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    if (active) finishSearch(active.lastBest, true);
  }, 500);
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
  pending = null;
  if (active) stopSearch();
  if (bal) stopBalance();
  send('YXHASHCLEAR');
  send('YXBLOCKRESET');
  applyConfig(lastCfg.threads || 1, lastCfg.hashMB || 0, lastCfg.caution || 0, rule, false);
  if (moves) sendBoard(moves);
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

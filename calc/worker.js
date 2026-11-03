/* Rapfi Gomocup bridge. Keeps the engine protocol stable for the UI.
   - infinite analysis: one long-running search, stopped through the STOP command
   - balance: YXBALANCEONE / YXBALANCETWO streamed while the search deepens
   - rule changes invalidate the hash (YXHASHCLEAR) like desktop-connect does  */
'use strict';

let Mod = null;
let active = null;          // { id, gen, topN, infinite, stopping, lastBest }
let pending = null;         // next search request queued behind a running one
let bal = null;             // { id, gen, count, moves, stopping, lastPoints }
let pvIdx = -1;
let pvs = [];
let glob = { speed: 0, totaltime: 0, totalnodes: 0 };
let lastCfg = { threads: 0, hashMB: 0, caution: 0, rule: -1 };
let stopTimer = 0;
let booting = false;

function post(msg) {
  self.postMessage(msg);
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

function onLine(raw) {
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
  try {
    const build = opts.build === 'multi' ? 'multi' : 'single';
    importScripts(opts.urls.js);
    const mod = await Rapfi({
      locateFile: (f) => {
        if (/\.wasm$/.test(f)) return opts.urls.wasm;
        if (/\.data$/.test(f)) return opts.urls.data;
        return new URL(f, opts.urls.js).href;
      },
      mainScriptUrlOrBlob: build === 'multi' ? opts.urls.js : undefined,
      onReceiveStdout: onLine,
      onReceiveStderr: (s) => post({ t: 'stderr', msg: String(s).slice(0, 200) }),
      onExit: (c) => post({ t: 'exit', code: c }),
      setStatus: () => {},
    });
    Mod = mod;
    send('START 15');
    // Emscripten pthread workers need a moment to come up before THREAD_NUM.
    await new Promise((r) => setTimeout(r, 1600));
    applyConfig(opts.threads, opts.hashMB, opts.caution, opts.rule, true);
    send('INFO SHOW_DETAIL 3');
    send('INFO PONDERING 0');
    send('INFO TIMEOUT_MATCH 6000000');
    send('INFO TIME_LEFT 6000000');
    booting = false;
    post({ t: 'ready', build, threads: opts.threads, hashMB: opts.hashMB });
  } catch (err) {
    booting = false;
    post({ t: 'initfail', error: String((err && err.message) || err).slice(0, 300) });
  }
}

function finishSearch(best) {
  if (!active) return;
  const a = active;
  active = null;
  clearTimeout(stopTimer);
  const stats = statsOf();
  post({
    t: 'best', id: a.id, gen: a.gen, stats, candidates: candidates(),
    best: best || a.lastBest || null,
  });
  if (pending && !bal) startPending();
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
  active = {
    id: job.id, gen: job.gen, topN: Math.max(1, Math.min(8, job.topN | 0)),
    infinite: !!job.infinite, stopping: false, lastBest: null,
  };
  pvs = [];
  pvIdx = -1;
  glob = { speed: 0, totaltime: 0, totalnodes: 0 };
  applyConfig(job.threads, job.hashMB, job.caution, job.rule, false);
  send('INFO TIMEOUT_TURN ' + (job.infinite ? 3600000 : Math.max(300, job.timeMs | 0)));
  sendBoard(job.moves);
  send('YXNBEST ' + active.topN);
}

function search(job) {
  if (!Mod) return;
  if (active || bal) {
    // The UI stops before starting the next job; queue it so nothing is lost.
    pending = { kind: 'search', job };
    if (active) stopSearch();
    if (bal) stopBalance();
    return;
  }
  startSearch(job);
}

function stopSearch() {
  if (!active || active.stopping) return;
  active.stopping = true;
  send('STOP');
  // Guarantee a bounded stop even if the engine build does not answer STOP.
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    if (active) finishSearch(active.lastBest);
  }, 900);
}

function finishBalance(points, stats) {
  if (!bal) return;
  const b = bal;
  bal = null;
  clearTimeout(b.timer);
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
  if (active || bal) {
    pending = { kind: 'balance', job };
    if (active) stopSearch();
    if (bal) stopBalance();
    return;
  }
  const count = Math.max(1, Math.min(2, job.count | 0));
  pvs = [];
  pvIdx = -1;
  glob = { speed: 0, totaltime: 0, totalnodes: 0 };
  applyConfig(job.threads, job.hashMB, job.caution, job.rule, false);
  const b = { id: job.id, gen: job.gen, count, moves: job.moves, stopping: false, lastPoints: [], timer: 0 };
  bal = b;
  send('INFO TIMEOUT_TURN ' + (job.infinite ? 3600000 : Math.max(500, job.timeMs | 0)));
  sendBoard(job.moves);
  send(count >= 2 ? 'YXBALANCETWO 0' : 'YXBALANCEONE 0');
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
  }, 700);
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
  if (d.t === 'init') boot(d);
  else if (d.t === 'search') search(d.job);
  else if (d.t === 'stop') { if (bal) stopBalance(); else stopSearch(); }
  else if (d.t === 'balance') balance(d.job);
  else if (d.t === 'config') applyConfig(d.threads, d.hashMB, d.caution, d.rule, false);
  else if (d.t === 'reset') resetEngine(d.moves, d.rule);
  else if (d.t === 'shutdown') self.close();
};

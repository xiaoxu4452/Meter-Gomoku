'use strict';
/* ============================================================================
 * Meter Gomoku Web — 计算器前端
 * 引擎：Rapfi (Emscripten/WASM, SIMD128) 运行在 worker.js 里，完全本地计算。
 * 交互：单线程引擎不能中途打断，所以用"分片推进"：每 ~0.4~1.4 s 调一次
 *       YXNBEST（时间预算递增、置换表复用），界面于是能持续刷新深度/评分。
 * ========================================================================== */

const $ = (s) => document.querySelector(s);

/* ------------------------------------------------------------------ i18n */
const I18N = {
  zh: {
    ruleShort0: '无禁手', ruleShort1: '无禁长连', ruleShort2: '连珠',
    blackToMove: '黑方落子', whiteToMove: '白方落子',
    analyze: '分析', stop: '停止', aiMove: '引擎落子', undo: '悔棋', clear: '清空',
    depth: '深度', speed: '速度', nodes: '节点', time: '用时',
    noData: '落子或摆盘后自动分析',
    bestline: '主变 · 引擎最佳应对', pvEmpty: '分析后显示最佳变化',
    rangeO1: '1 · 极窄', rangeO2: '2 · 窄', rangeO3: '3 · 标准', rangeO4: '4 · 宽', rangeO5: '5 · 极宽',
    settings: '设置', rule: '规则', ruleHint: '禁手由引擎判定',
    ruleFree: '无禁手', ruleStd: '无禁长连不赢', ruleRenju: '连珠（有禁手）',
    think: '每步思考', thinkHint: '分片推进，界面实时刷新',
    multi: '多点分析', multiHint: '同时给出前 N 个候选点',
    range: '选点范围', rangeHint: '越小越集中（CAUTION_FACTOR）',
    hash: '置换表', hashHint: '越大越吃内存',
    pAuto: '自动分析', pAutoHint: '每落一子立即重算',
    pCoord: '坐标', pNum: '手数',
    engine: '引擎', cacheChecking: '正在检查本机缓存…', purge: '清除引擎缓存',
    loadingTitle: '正在加载引擎', loadingHint: '首次加载约 41 MB 的引擎与神经网络，会缓存到本机；之后打开即用，可离线计算。',
    cached: '已缓存到本机 · 可离线使用', cachedNow: '已下载并缓存到本机 · 之后可离线使用',
    ready: '就绪', loading: '加载引擎…', init: '引擎启动中…', thinking: '分析中',
    cachedClear: '缓存已清除，正在重新加载…', notReady: '引擎还没就绪',
    copied: '已复制', license: '来源与许可',
  },
  en: {
    ruleShort0: 'Freestyle', ruleShort1: 'No overline', ruleShort2: 'Renju',
    blackToMove: 'Black to move', whiteToMove: 'White to move',
    analyze: 'Analyse', stop: 'Stop', aiMove: 'Engine move', undo: 'Undo', clear: 'Clear',
    depth: 'Depth', speed: 'Speed', nodes: 'Nodes', time: 'Time',
    noData: 'Place stones to start the analysis',
    bestline: 'Best line', pvEmpty: 'Shown after the analysis',
    rangeO1: '1 · narrowest', rangeO2: '2 · narrow', rangeO3: '3 · standard', rangeO4: '4 · wide', rangeO5: '5 · widest',
    settings: 'Settings', rule: 'Rule', ruleHint: 'Forbidden moves handled by the engine',
    ruleFree: 'Freestyle', ruleStd: 'No overline win', ruleRenju: 'Renju (forbidden)',
    think: 'Think time', thinkHint: 'Progressive ticks, live updates',
    multi: 'Multi-PV', multiHint: 'Show top N candidate points',
    range: 'Move range', rangeHint: 'Smaller = narrower (CAUTION_FACTOR)',
    hash: 'Hash', hashHint: 'Larger uses more memory',
    pAuto: 'Auto analyse', pAutoHint: 'Recompute after each move',
    pCoord: 'Coordinates', pNum: 'Move numbers',
    engine: 'Engine', cacheChecking: 'Checking local cache…', purge: 'Clear engine cache',
    loadingTitle: 'Loading engine', loadingHint: 'First load is ~41 MB of engine and neural weights, cached on this device. After that it opens instantly and works offline.',
    cached: 'Cached on this device · works offline', cachedNow: 'Downloaded and cached · works offline from now on',
    ready: 'ready', loading: 'loading engine…', init: 'starting engine…', thinking: 'analysing',
    cachedClear: 'Cache cleared, reloading…', notReady: 'Engine is not ready yet',
    copied: 'Copied', license: 'Sources & licence',
  },
};

/* ------------------------------------------------------------------ state */
const DEF = { lang: '', rule: 0, think: 2500, nbest: 3, range: 3, hashMB: 128, coord: true, num: true, auto: true };
let S = Object.assign({}, DEF);
try { Object.assign(S, JSON.parse(localStorage.getItem('mgcalc.v1') || '{}')); } catch (e) {}
if (!S.lang) S.lang = /^en/i.test(navigator.language || '') ? 'en' : 'zh';
function saveS() { try { localStorage.setItem('mgcalc.v1', JSON.stringify(S)); } catch (e) {} }
const T = (k) => (I18N[S.lang] && I18N[S.lang][k]) || (I18N.zh[k] || k);

const G = {
  size: 15,
  moves: [],            // {x,y,s}
  cands: [],            // 候选
  bestMv: null,         // 引擎最后一手给出的真实最佳点
  stat: { depth: 0, seldepth: 0, speed: 0, nodes: 0, time: 0, eval: '-' },
  thinking: false,
  seq: 0,
  ready: false,
  cacheHit: true,
};
const E = { worker: null, waiters: [], readyResolve: null, fail: null };

/* ------------------------------------------------------------------ tiny ui */
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}
function fmtNum(n) {
  n = Math.round(n || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
const LETTERS = 'ABCDEFGHIJKLMNO';
const ptName = (x, y) => LETTERS[x] + (G.size - y);

/* ------------------------------------------------------------------ apply lang */
function applyLang() {
  document.documentElement.lang = S.lang === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll('[data-t]').forEach((el) => {
    const k = el.getAttribute('data-t');
    if (I18N[S.lang][k]) el.textContent = I18N[S.lang][k];
  });
  $('#btnRule').textContent = T('ruleShort' + S.rule);
  $('#btnLang').textContent = S.lang === 'zh' ? 'EN' : '中';
  syncTools();
  syncTurn();
  renderCands();
  renderCacheSt();
}

/* ------------------------------------------------------------------ engine boot */
const ENGINE_CACHE = 'mgcalc-engine-v1';
const FILES = [
  { n: 'rapfi-single-simd128.js', kb: 39 },
  { n: 'rapfi-single-simd128.wasm', kb: 1105 },
  { n: 'rapfi.data', kb: 40306 },
];

function setProgress(p, text) {
  const pct = Math.max(0, Math.min(1, p || 0));
  $('#pbar').style.width = (pct * 100).toFixed(1) + '%';
  $('#pct').textContent = Math.round(pct * 100) + '%' + (text ? ' · ' + text : '');
}

async function loadEngineFiles() {
  let cache = null;
  try { if ('caches' in window) cache = await caches.open(ENGINE_CACHE); } catch (e) { cache = null; }
  const total = FILES.reduce((a, f) => a + f.kb * 1024, 0);
  let doneBytes = 0;
  let fromCache = 0;
  const out = {};

  for (const f of FILES) {
    const url = new URL('engine/' + f.n, location.href).href;
    let blob = null, ct = 'application/octet-stream';
    if (cache) {
      try {
        const hit = await cache.match(url);
        if (hit) { blob = await hit.blob(); ct = hit.headers.get('content-type') || ct; fromCache++; }
      } catch (e) {}
    }
    if (!blob) {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(f.n + ' HTTP ' + res.status);
      ct = res.headers.get('content-type') || ct;
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        chunks.push(r.value);
        got += r.value.length;
        setProgress((doneBytes + got) / total, f.n);
      }
      blob = new Blob(chunks, { type: ct });
      if (cache) { try { await cache.put(url, new Response(blob, { headers: { 'Content-Type': ct } })); } catch (e) {} }
    }
    doneBytes += blob.size;
    setProgress(doneBytes / total, f.n);
    out[f.n] = URL.createObjectURL(blob);
  }
  G.cacheHit = fromCache === FILES.length;
  return out;
}

function bootEngine() {
  setProgress(0, '');
  loadEngineFiles().then((files) => {
    E.worker = new Worker('worker.js');
    E.worker.onmessage = onEngineMsg;
    E.worker.onerror = (ev) => {
      showFail((ev && ev.message) || 'worker error');
    };
    E.worker.postMessage({
      t: 'init',
      files: {
        js: files['rapfi-single-simd128.js'],
        wasm: files['rapfi-single-simd128.wasm'],
        data: files['rapfi.data'],
      },
    });
  }).catch((err) => showFail(String(err)));
}

function showFail(msg) {
  $('#boot').classList.remove('hide');
  $('#boot').querySelector('h4').textContent = S.lang === 'en' ? 'Engine failed to load' : '引擎加载失败';
  $('#boot').querySelector('p').textContent = msg + ' — ' + (S.lang === 'en' ? 'check your connection and reload.' : '请检查网络后刷新页面。');
  $('#pct').textContent = '';
  $('#pbar').style.width = '100%';
  $('#pbar').style.background = '#b5473f';
  setStatus('error', true);
}

function onEngineMsg(ev) {
  const d = ev.data || {};
  switch (d.t) {
    case 'ready':
      G.ready = true;
      setProgress(1, 'ready');
      renderCacheSt();
      setTimeout(() => $('#boot').classList.add('hide'), 260);
      // 引擎初始化：一次 START + 哈希表
      send('START ' + G.size);
      send('INFO HASH_SIZE ' + (S.hashMB * 1024));
      setStatus('ready');
      if (E.readyResolve) { E.readyResolve(); E.readyResolve = null; }
      if (G.moves.length && S.auto) queueAnalysis(S.think);
      break;
    case 'snap':
      G.stat.depth = d.depth || 0;
      G.stat.nodes = d.nodes || 0;
      G.stat.time = d.time || 0;
      G.stat.speed = d.speed || 0;
      if (d.pvs && d.pvs.length) {
        G.cands = sortCands(d.pvs);
        G.stat.eval = G.cands[0].eval;
      }
      if (d.mv) G.bestMv = d.mv;
      renderDash();
      renderCands();
      requestDraw();
      break;
    case 'best': {
      if (d.snap) {
        G.stat.depth = d.snap.depth || G.stat.depth;
        G.stat.nodes = d.snap.nodes || G.stat.nodes;
        G.stat.time = d.snap.time || G.stat.time;
        G.stat.speed = d.snap.speed || G.stat.speed;
      }
      if (d.pvs && d.pvs.length) {
        G.cands = sortCands(d.pvs);
        G.stat.eval = G.cands[0].eval;
      }
      if (d.mv) G.bestMv = d.mv;
      renderDash(); renderCands(); requestDraw();
      const w = E.waiters.shift();
      if (w) { clearTimeout(w.timer); w.res(d); }
      break;
    }
    case 'status':
      setStatus('init');
      break;
    case 'msg':
      if (/weight loaded|load weight/i.test(d.s)) setStatus('weights');
      break;
    case 'stderr':
      if (d.s && /error/i.test(d.s)) console.warn('[engine]', d.s);
      break;
    case 'fail':
      showFail(d.msg);
      break;
    default: break;
  }
}

function send(cmd) { if (E.worker) E.worker.postMessage({ t: 'cmd', c: cmd }); }

function waitBest(timeoutMs) {
  return new Promise((res, rej) => {
    const w = { res, rej };
    w.timer = setTimeout(() => {
      const i = E.waiters.indexOf(w);
      if (i >= 0) E.waiters.splice(i, 1);
      rej(new Error('engine timeout'));
    }, timeoutMs);
    E.waiters.push(w);
  });
}

function setStatus(kind, isErr) {
  const el = $('#engSt');
  el.classList.toggle('live', kind === 'thinking');
  if (isErr) { el.textContent = '· error'; return; }
  const map = { ready: T('ready'), init: T('init'), weights: T('loading'), thinking: T('thinking'), error: 'error' };
  el.textContent = '· ' + (map[kind] || kind);
}

/* ------------------------------------------------------------------ protocol */
function sideToMove() { return G.moves.length % 2 === 0 ? 1 : 2; }

function sendConfig() {
  send('INFO RULE ' + S.rule);
  send('INFO THREAD_NUM 1');
  send('INFO CAUTION_FACTOR ' + S.range);
  send('INFO TIMEOUT_MATCH 6000000');
  send('INFO TIME_LEFT 6000000');
  send('INFO SHOW_DETAIL 3');
  send('INFO PONDERING 0');
}

function sendBoard() {
  let c = 'YXBOARD';
  for (const m of G.moves) c += ' ' + m.x + ',' + m.y + ',' + m.s;
  send(c + ' DONE');
}

/* ------------------------------------------------------------------ analysis */
let lock = Promise.resolve();

function queueAnalysis(ms, opts) {
  const my = ++G.seq;
  // 新一轮分析立刻清掉旧候选，避免盘面上残留上一个局面的标记
  G.cands = [];
  G.stat = { depth: 0, seldepth: 0, speed: 0, nodes: 0, time: 0, eval: '-' };
  renderDash(); renderCands(); requestDraw();
  const run = lock.then(() => doAnalyze(ms, opts || {}, my));
  lock = run.catch(() => {});
  return run;
}

async function doAnalyze(ms, opts, my) {
  if (!G.ready) { toast(T('notReady')); return; }
  if (my !== G.seq) return;
  G.thinking = true;
  syncTools();
  setStatus('thinking');
  sendConfig();
  sendBoard();

  const t0 = performance.now();
  const topN = Math.max(1, opts.topN || S.nbest);
  // 第一段：极短，先把候选点画到盘上（体感"立刻有反应"）
  const stages = [];
  if (ms > 900) stages.push(Math.min(500, Math.round(ms * 0.22)));
  stages.push(0); // 0 = 用剩下的全部时间

  for (const st of stages) {
    if (my !== G.seq) break;
    const left = ms - (performance.now() - t0);
    if (left <= 80) break;
    const budget = st ? Math.max(240, Math.min(st, left)) : Math.round(left);
    send('INFO TIMEOUT_TURN ' + budget);
    send('YXNBEST ' + topN);
    try { await waitBest(budget + 15000); } catch (e) { break; }
  }
  if (my === G.seq) {
    G.thinking = false;
    syncTools();
    setStatus('ready');
    renderDash(); renderCands(); requestDraw();
  }
}

function stopAnalysis() {
  if (!G.thinking) return;
  G.seq++;
  G.thinking = false;
  syncTools();
  setStatus('ready');
}

function syncTools() {
  const b = $('#btnThink');
  b.textContent = G.thinking ? T('stop') : T('analyze');
  b.classList.toggle('stop', G.thinking);
  b.classList.toggle('primary', !G.thinking);
  $('#btnAi').disabled = G.thinking;
  $('#btnUndo').disabled = G.thinking || !G.moves.length;
  $('#btnClear').disabled = G.thinking || !G.moves.length;
}

function syncTurn() {
  const s = sideToMove();
  $('#turnDot').className = 'dot ' + (s === 1 ? 'b' : 'w');
  $('#turnTxt').textContent = s === 1 ? T('blackToMove') : T('whiteToMove');
  $('#moveCnt').textContent = '· ' + G.moves.length;
}

/* ------------------------------------------------------------------ dashboard */
function evalView(e, side) {
  if (e === undefined || e === null || e === '-' || e === '') return { txt: '—', val: 0 };
  const s = String(e).trim();
  const mate = /^([+-])M(\d+)$/.exec(s);
  const neg = side === 2;
  if (mate) {
    let sign = mate[1] === '-' ? -1 : 1;
    if (neg) sign = -sign;
    return { txt: (sign > 0 ? '+' : '-') + 'M' + mate[2], val: sign * 30000 };
  }
  const n = parseFloat(s);
  if (isNaN(n)) return { txt: s, val: 0 };
  const v = neg ? -n : n;
  return { txt: (v > 0 ? '+' : '') + Math.round(v), val: v };
}

function renderDash() {
  const st = G.stat;
  $('#mDepth').textContent = st.depth ? 'd' + st.depth : '—';
  $('#mSpeed').textContent = st.speed ? fmtNum(st.speed) + '/s' : '—';
  $('#mNodes').textContent = st.nodes ? fmtNum(st.nodes) : '—';
  $('#mTime').textContent = st.time ? (st.time / 1000).toFixed(1) + 's' : '—';

  const side = sideToMove();
  const ev = evalView(st.eval, side);
  const wr = G.cands.length && G.cands[0].winrate != null ? G.cands[0].winrate : null;
  const wrBlack = wr == null ? 0.5 : (side === 1 ? wr : 1 - wr);
  let evTxt;
  if (/M\d/.test(ev.txt)) evTxt = ev.txt;
  else if (ev.val > 0) evTxt = (S.lang === 'en' ? 'B ' : '黑 ') + '+' + Math.abs(Math.round(ev.val));
  else if (ev.val < 0) evTxt = (S.lang === 'en' ? 'W ' : '白 ') + '+' + Math.abs(Math.round(ev.val));
  else evTxt = S.lang === 'en' ? 'even' : '均势';
  $('#mEval').textContent = evTxt;
  $('#wFill').style.width = (wrBlack * 100).toFixed(1) + '%';
  $('#mWr').textContent = (wrBlack * 100).toFixed(1) + '%';
}

function sortCands(list) {
  const side = sideToMove();
  return list.slice().sort((a, b) => evalView(a.eval, side).val - evalView(b.eval, side).val);
}

function renderCands() {
  const box = $('#cands');
  if (!G.cands.length) {
    box.innerHTML = '<div class="emptyc">' + T('noData') + '</div>';
    renderPv();
    return;
  }
  const side = sideToMove();
  let html = '';
  sortCands(G.cands).slice(0, 5).forEach((c, i) => {
    const ev = evalView(c.eval, side);
    const wr = c.winrate == null ? null : (side === 1 ? c.winrate : 1 - c.winrate);
    const line = (c.line || []).slice(1, 7).map((p) => ptName(p[0], p[1])).join(' ');
    html += '<div class="crow' + (i === 0 ? ' best' : '') + '">'
      + '<span class="rk">' + (i + 1) + '</span>'
      + '<span class="pt">' + ptName(c.mv[0], c.mv[1]) + '</span>'
      + '<span class="ev">' + (/M\d/.test(ev.txt) ? ev.txt : (ev.val >= 0 ? '+' : '') + Math.round(ev.val)) + '</span>'
      + '<span class="wr">' + (wr == null ? '—' : (wr * 100).toFixed(1) + '%') + '</span>'
      + '<span class="ln">' + line + '</span>'
      + '<span class="dp">d' + (c.depth || 0) + '</span>'
      + '</div>';
  });
  box.innerHTML = html;
  renderPv();
}

function renderPv() {
  const box = $('#pvline');
  const evEl = $('#pvEval');
  const c = G.cands[0];
  if (!c || !c.line || c.line.length < 2) {
    box.innerHTML = '<span class="pvempty">' + T('pvEmpty') + '</span>';
    if (evEl) evEl.textContent = '';
    return;
  }
  const side = sideToMove();
  const ev = evalView(c.eval, side);
  if (evEl) evEl.textContent = ev.txt;
  const base = G.moves.length;
  let html = '';
  c.line.slice(0, 18).forEach((p, i) => {
    const n = base + i + 1;
    const me = (base + i) % 2 === 0 ? 1 : 2;   // 该手是黑还是白
    html += '<span class="pvm"><i>' + n + '.</i><b>' + ptName(p[0], p[1]) + '</b>'
      + (me === 1 ? '●' : '○') + '</span>';
  });
  box.innerHTML = html;
}

/* ------------------------------------------------------------------ board */
const bd = $('#bd');
const geom = { w: 0, pad: 0, cell: 0 };
let raf = 0;
function requestDraw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawBoard(); }); }

function drawBoard() {
  const rect = bd.getBoundingClientRect();
  const w = Math.max(160, Math.round(rect.width || 320));
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (bd.width !== Math.round(w * dpr)) {
    bd.width = Math.round(w * dpr);
    bd.height = Math.round(w * dpr);
  }
  const ctx = bd.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, w);

  const n = G.size;
  const pad = S.coord ? Math.max(15, Math.round(w * 0.058)) : Math.max(7, Math.round(w * 0.022));
  const cell = (w - pad * 2) / (n - 1);
  geom.w = w; geom.pad = pad; geom.cell = cell;

  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches;

  // 木纹底
  const g = ctx.createLinearGradient(0, 0, w, w);
  g.addColorStop(0, dark ? '#cdac73' : '#f3ddb0');
  g.addColorStop(0.5, dark ? '#bd9a5e' : '#e9c995');
  g.addColorStop(1, dark ? '#b28e52' : '#e2c089');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);

  // 细纹
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#6b4c22';
  for (let i = 0; i < 26; i++) {
    const y = (i + 0.5) * (w / 26);
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(i * 1.7) * 1.2);
    ctx.bezierCurveTo(w * 0.3, y + 2, w * 0.6, y - 2, w, y + Math.cos(i) * 1.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 网格
  ctx.strokeStyle = dark ? 'rgba(60,42,20,.75)' : 'rgba(96,68,32,.75)';
  ctx.lineWidth = Math.max(0.7, w / 560);
  for (let i = 0; i < n; i++) {
    const p = pad + i * cell;
    ctx.beginPath(); ctx.moveTo(pad, p); ctx.lineTo(pad + (n - 1) * cell, p); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p, pad); ctx.lineTo(p, pad + (n - 1) * cell); ctx.stroke();
  }
  // 星位
  if (n === 15) {
    ctx.fillStyle = dark ? 'rgba(50,34,14,.9)' : 'rgba(70,48,20,.9)';
    [3, 7, 11].forEach((a) => [3, 7, 11].forEach((b) => {
      ctx.beginPath();
      ctx.arc(pad + a * cell, pad + b * cell, Math.max(1.6, cell * 0.075), 0, Math.PI * 2);
      ctx.fill();
    }));
  }

  // 坐标
  if (S.coord) {
    ctx.fillStyle = dark ? 'rgba(48,32,12,.82)' : 'rgba(82,58,26,.82)';
    ctx.font = '600 ' + Math.max(8, Math.round(cell * 0.34)) + 'px ' + 'ui-monospace,monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      ctx.fillText(LETTERS[i], pad + i * cell, pad * 0.45);
      ctx.fillText(String(n - i), pad * 0.45, pad + i * cell);
    }
  }

  // 棋子
  const r = cell * 0.44;
  G.moves.forEach((m, i) => {
    const cx = pad + m.x * cell, cy = pad + m.y * cell;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy + cell * 0.03, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fill();
    const sg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.12, cx, cy, r);
    if (m.s === 1) { sg.addColorStop(0, '#5b6270'); sg.addColorStop(0.55, '#20242b'); sg.addColorStop(1, '#080a0d'); }
    else { sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.7, '#f1f3f6'); sg.addColorStop(1, '#cfd4db'); }
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = m.s === 1 ? 'rgba(0,0,0,.65)' : 'rgba(120,128,140,.65)';
    ctx.lineWidth = Math.max(0.6, cell * 0.02);
    ctx.stroke();
    // 手数
    if (S.num) {
      ctx.fillStyle = m.s === 1 ? '#e8edf5' : '#252b33';
      ctx.font = '700 ' + Math.round(cell * 0.32) + 'px ui-monospace,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), cx, cy + cell * 0.01);
    }
    ctx.restore();
  });

  // 最后一手：红圈（画在棋子边缘，不挡手数）
  if (G.moves.length) {
    const m = G.moves[G.moves.length - 1];
    const cx = pad + m.x * cell, cy = pad + m.y * cell;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
    ctx.strokeStyle = '#e5484d';
    ctx.lineWidth = Math.max(1.6, cell * 0.075);
    ctx.stroke();
  }

  // 候选点
  if (G.cands.length && !G.thinking) {
    G.cands.slice(0, 5).forEach((c, i) => {
      const cx = pad + c.mv[0] * cell, cy = pad + c.mv[1] * cell;
      const ev = evalView(c.eval, sideToMove());
      const rr = cell * 0.46;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? 'rgba(47,111,176,.30)' : 'rgba(90,102,118,.20)';
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, cell * 0.055);
      ctx.strokeStyle = i === 0 ? 'rgba(31,86,142,.95)' : 'rgba(70,80,94,.6)';
      ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = i === 0 ? '#fff' : '#1d2530';
      // 小屏只画名次，大一点的屏把评分也画在圈里，避免压到棋盘线上
      const two = cell >= 23;
      ctx.font = '800 ' + Math.round(cell * (two ? 0.34 : 0.42)) + 'px ui-monospace,monospace';
      ctx.fillText(String(i + 1), cx, cy + (two ? -cell * 0.09 : cell * 0.01));
      if (two) {
        ctx.font = '700 ' + Math.round(cell * 0.23) + 'px ui-monospace,monospace';
        ctx.fillStyle = i === 0 ? 'rgba(255,255,255,.92)' : 'rgba(20,32,46,.8)';
        ctx.fillText(ev.txt, cx, cy + cell * 0.16);
      }
      ctx.restore();
    });
  }
}

/* ------------------------------------------------------------------ interaction */
function hitTest(ev) {
  const rect = bd.getBoundingClientRect();
  const px = ev.clientX - rect.left;
  const py = ev.clientY - rect.top;
  if (!geom.cell) return null;
  const x = Math.round((px - geom.pad) / geom.cell);
  const y = Math.round((py - geom.pad) / geom.cell);
  if (x < 0 || y < 0 || x >= G.size || y >= G.size) return null;
  const cx = geom.pad + x * geom.cell, cy = geom.pad + y * geom.cell;
  if (Math.hypot(px - cx, py - cy) > geom.cell * 0.62) return null;
  return { x, y };
}

const stoneAt = (x, y) => G.moves.findIndex((m) => m.x === x && m.y === y);

bd.addEventListener('pointerdown', (ev) => {
  if (!G.ready) return;
  const h = hitTest(ev);
  if (!h) return;
  ev.preventDefault();
  const at = stoneAt(h.x, h.y);
  if (at >= 0) {
    if (at === G.moves.length - 1) { undoMove(); }
    return;
  }
  placeStone(h.x, h.y);
});

function placeStone(x, y) {
  if (stoneAt(x, y) >= 0) return;
  G.moves.push({ x, y, s: sideToMove() });
  G.cands = [];
  G.stat = { depth: 0, seldepth: 0, speed: 0, nodes: 0, time: 0, eval: '-' };
  syncTurn(); syncTools();
  renderDash(); renderCands(); requestDraw();
  if (S.auto) queueAnalysis(S.think);
}

function undoMove() {
  if (!G.moves.length) return;
  G.moves.pop();
  G.cands = [];
  G.stat = { depth: 0, seldepth: 0, speed: 0, nodes: 0, time: 0, eval: '-' };
  syncTurn(); syncTools();
  renderDash(); renderCands(); requestDraw();
  if (S.auto && G.moves.length) queueAnalysis(S.think);
}

/* ------------------------------------------------------------------ buttons */
$('#btnThink').addEventListener('click', () => {
  if (G.thinking) stopAnalysis();
  else queueAnalysis(S.think);
});

$('#btnAi').addEventListener('click', async () => {
  if (G.thinking || !G.ready) return;
  await queueAnalysis(Math.max(1200, S.think), { topN: 1 });
  if (G.cands.length) {
    const mv = G.bestMv || G.cands[0].mv;
    if (mv && stoneAt(mv[0], mv[1]) < 0) placeStone(mv[0], mv[1]);
  }
});

$('#btnUndo').addEventListener('click', () => { if (!G.thinking) undoMove(); });
$('#btnClear').addEventListener('click', () => {
  if (G.thinking) return;
  G.moves = []; G.cands = [];
  G.stat = { depth: 0, seldepth: 0, speed: 0, nodes: 0, time: 0, eval: '-' };
  syncTurn(); syncTools(); renderDash(); renderCands(); requestDraw();
});

/* ------------------------------------------------------------------ settings */
function openSheet(on) {
  $('#mask').classList.toggle('on', on);
  $('#sheet').classList.toggle('on', on);
}
$('#btnSet').addEventListener('click', () => { syncSettings(); openSheet(true); });
$('#btnClose').addEventListener('click', () => openSheet(false));
$('#mask').addEventListener('click', () => openSheet(false));

function syncSettings() {
  $('#selRule').value = String(S.rule);
  $('#selThink').value = String(S.think);
  $('#selNbest').value = String(S.nbest);
  $('#selRange').value = String(S.range);
  $('#selHash').value = String(S.hashMB);
  $('#cbAuto').checked = !!S.auto;
  $('#cbCoord').checked = !!S.coord;
  $('#cbNum').checked = !!S.num;
  renderCacheSt();
}

$('#selRule').addEventListener('change', (e) => {
  S.rule = +e.target.value;
  saveS();
  $('#btnRule').textContent = T('ruleShort' + S.rule);
  // 规则变化要重启引擎搜索上下文
  send('START ' + G.size);
  send('INFO HASH_SIZE ' + (S.hashMB * 1024));
  if (G.moves.length && S.auto) queueAnalysis(S.think);
});
$('#selThink').addEventListener('change', (e) => { S.think = +e.target.value; saveS(); });
$('#selNbest').addEventListener('change', (e) => {
  S.nbest = +e.target.value; saveS();
  if (G.moves.length) queueAnalysis(S.think);
});
$('#selRange').addEventListener('change', (e) => {
  S.range = +e.target.value; saveS();
  if (G.moves.length) queueAnalysis(S.think);
});
$('#selHash').addEventListener('change', (e) => {
  S.hashMB = +e.target.value; saveS();
  send('INFO HASH_SIZE ' + (S.hashMB * 1024));
});
$('#cbAuto').addEventListener('change', (e) => { S.auto = e.target.checked; saveS(); });
$('#cbCoord').addEventListener('change', (e) => { S.coord = e.target.checked; saveS(); requestDraw(); });
$('#cbNum').addEventListener('change', (e) => { S.num = e.target.checked; saveS(); requestDraw(); });

$('#btnPurge').addEventListener('click', async () => {
  try {
    if ('caches' in window) await caches.delete(ENGINE_CACHE);
    toast(T('cachedClear'));
    setTimeout(() => location.reload(), 700);
  } catch (e) { toast('cache error'); }
});

function renderCacheSt() {
  const el = $('#cacheSt');
  if (!el) return;
  if (!G.ready) { el.textContent = T('cacheChecking'); return; }
  el.textContent = G.cacheHit ? T('cached') : T('cachedNow');
}

$('#btnLang').addEventListener('click', () => {
  S.lang = S.lang === 'zh' ? 'en' : 'zh';
  saveS();
  applyLang();
});

$('#btnRule').addEventListener('click', () => { syncSettings(); openSheet(true); });

/* ------------------------------------------------------------------ boot */
window.addEventListener('resize', () => { requestDraw(); });
if (window.ResizeObserver) {
  let lastW = 0;
  new ResizeObserver(() => {
    const w = bd.getBoundingClientRect().width;
    if (Math.abs(w - lastW) > 0.5) { lastW = w; requestDraw(); }
  }).observe(bd);
}

applyLang();
syncSettings();
drawBoard();
requestDraw();
bootEngine();

// 离线外壳：注册一次后，断网也能打开页面（引擎资源由上面的 Cache Storage 负责）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

'use strict';

/* ============================================================ constants */
const SIZE = 15;
const LETTERS = 'ABCDEFGHIJKLMNO';
const ENGINE_VERSION = '20261103d';
const SETTINGS_KEY = 'mgcalc.settings.v1';
const THEME_KEY = 'mgcalc.theme';
const RELOAD_KEY = 'mgcalc.isolation.reload';
const ENGINE_CACHE = 'mgcalc-engine-' + ENGINE_VERSION;
const ENGINE_FILES = {
  multi: { js: 'engine/rapfi-multi-simd128.js', wasm: 'engine/rapfi-multi-simd128.wasm', data: 'engine/rapfi.data' },
  single: { js: 'engine/rapfi-single-simd128.js', wasm: 'engine/rapfi-single-simd128.wasm', data: 'engine/rapfi.data' },
};
const HASH_OPTIONS = [64, 128, 256, 512, 1024];
const HASH_LIMIT_DEFAULT = 1024;

const RULES = [
  { id: 0, name: '无禁手', nameEn: 'Freestyle', short: '无禁手', shortEn: 'Free',
    hint: '连成五子即胜，长连（6 子以上）也算胜',
    hintEn: 'Five in a row wins; an overline of six or more also wins' },
  { id: 1, name: '无禁手 · 长连不赢', nameEn: 'No overline win', short: '长连不赢', shortEn: 'No overline',
    hint: '双方都必须正好五连才算胜，长连不算',
    hintEn: 'Exactly five wins for both sides; an overline does not count' },
  { id: 2, name: '连珠（有禁手）', nameEn: 'Renju', short: '连珠禁手', shortEn: 'Renju',
    hint: '黑方三三 / 四四 / 长连禁手，白方无禁手',
    hintEn: 'Black is bound by double-three, double-four and overline rules; White is not' },
];

/* ============================================================ i18n */
const LANG_KEY = 'mgcalc.lang';
const I18N = {
  zh: {
    title: '五子棋计算器', subtitle: 'Meter Gomoku · Web',
    undo: '上一步', redo: '下一步', restart: '重开一局', restartConfirm: '确认重开',
    aiB: 'AI执黑', aiW: 'AI执白', analysis: '计算分析', analysisStop: '停止并落子', balance: '平衡点', points: '点',
    depth: '深度', speed: '速度', nodes: '节点', time: '用时',
    codeTitle: '局面代码', codeHint: '列字母+行号 / 坐标',
    codePlaceholder: '例如 h8h9g7f7 或 7,7 8,8',
    routeTitle: '分析路线', routeEmpty: '点击「计算分析」查看最佳路线', routeNone: '（无路线）',
    curveTitle: '评估曲线', black: '黑', white: '白', curveEmpty: '开始分析后显示评估',
    foot: 'Rapfi NNUE 引擎 · 全部计算在本机浏览器完成',
    settings: '设置', close: '关闭', copy: '复制',
    rule0: '无禁手', rule1: '长连不赢', rule2: '连珠禁手',
    think: '思考时间', thinkHint: '每次计算分析的时长',
    stoneStyle: '棋子样式', stoneStyleHint: '与桌面训练器一致的三档',
    stoneFlat: '扁平', stoneReal: '仿真', stoneJade: '玉石',
    showNum: '显示手数', showNumHint: '在棋子上标出第几手', on: '开', off: '关',
    rule: '规则', hash: '哈希表大小', hashHint: '引擎置换表，越大越省重复计算',
    pointsLabel: '分析点数', pointsHint: '每个候选点的多 PV 路线数量',
    threads: '线程数', range: '选点范围', rangeHint: '引擎候选点筛选的谨慎程度',
    threadSingle: '未隔离，仅单线程可用', threadHintT: '硬件 {hc} 线程，可用上限 {max}',
    theme: '主题', themeLight: '浅色', themeDark: '深色', themeSystem: '跟随系统', themeHint: '也可跟随系统自动切换',
    reset: '恢复默认参数', done: '完成',
    engineLoading: '引擎加载中', engineReady: '引擎就绪', engineSingle: '单线程', engineErr: '引擎异常',
    engineMulti: '多线程 {n} 线程', engineExit: '引擎退出',
    stIdle: '等待', stSearching: '搜索中', stBal: '平衡点搜索中', stAi: 'AI 思考中',
    stStopped: '已停止', stWinB: '黑方获胜', stWinW: '白方获胜',
    balSearching: '平衡点搜索中，深度增加后自动修正…', balNotFound: '本局面未找到平衡点',
    balEmpty: '引擎未返回平衡点（可能已分胜负）',
    balWindowIn: '在官方平衡窗口内', balWindowOut: '已超出平衡窗口（最接近均势）',
    tCopied: '局面代码已复制', tManualCopy: '请手动复制', tLoaded: '已载入 {n} 手', tBadCode: '局面代码无法识别',
    tRestartConfirm: '再点一次「重开一局」确认', tRestarted: '已重新开局', tUndo: '已撤回 {p}',
    tWinB: '黑方获胜', tWinW: '白方获胜', tForbidden: '黑方禁手点，不能落子',
    tNoEngine: '引擎加载中，请稍候', tGameOver: '对局已结束，请重开一局', tNoBalance: '空盘没有稳定的平衡点（需开局库），请先落子',
    tBalOn: '平衡点：{n} 个点 · 再按一次落子', tBalRunning: '平衡点计算中，请稍候…',
    tBalPlayed: '已在平衡点落子 {p}', tBalOff: '平衡点已关闭', tBalNone: '没有可用的平衡点',
    tAiOn: 'AI 执{n}已开启', tAiOff: 'AI 执{n}已关闭', tBlack: '黑', tWhite: '白',
    tThinking: 'AI 执{n}思考中', tThinkSet: '思考时间已设为 {n} 秒',
    tHashSet: '哈希表已设为 {n} MB', tThreadSet: '线程数已设为 {n}', tRuleSet: '规则已切换为「{n}」',
    tReset: '已恢复默认参数', tStoneSet: '棋子样式：{n}', tNumOn: '已显示手数', tNumOff: '已隐藏手数',
    tBalPoints: '平衡点点数：{n}', tBalanceNoResult: '还没有平衡点结果',
    tHashClamp: '哈希表超过引擎上限 {n} MB，已自动收敛',
    tFallback: '多线程不可用，已降级为单线程模式',
    toLight: '切换到浅色模式', toDark: '切换到深色模式',
    tipUndo: '上一步（棋盘右键 / 长按也可撤回）', tipRedo: '下一步', tipRestart: '清空棋盘并重置引擎',
    tipAiB: '让引擎执黑，可同时开启黑白', tipAiW: '让引擎执白，可同时开启黑白',
    tipAnalysis: '开始 / 停止计算分析', tipBalance: '第一次点：计算平衡点；再点一次：在平衡点落子',
    tipBalCount: '平衡点要给出的点数', tipEngine: '计算引擎状态', tipCopy: '复制局面代码',
  },
  en: {
    title: 'Gomoku Calculator', subtitle: 'Meter Gomoku · Web',
    undo: 'Undo', redo: 'Redo', restart: 'New game', restartConfirm: 'Confirm',
    aiB: 'AI black', aiW: 'AI white', analysis: 'Analyse', analysisStop: 'Stop & play', balance: 'Balance', points: 'pt',
    depth: 'Depth', speed: 'Speed', nodes: 'Nodes', time: 'Time',
    codeTitle: 'Position code', codeHint: 'letters + number, or x,y',
    codePlaceholder: 'e.g. h8h9g7f7 or 7,7 8,8',
    routeTitle: 'Main line', routeEmpty: 'Press Analyse to see the best line', routeNone: '(no line)',
    curveTitle: 'Eval curve', black: 'B', white: 'W', curveEmpty: 'Analysis will draw the curve here',
    foot: 'Rapfi NNUE engine · everything runs locally in this browser',
    settings: 'Settings', close: 'Close', copy: 'Copy',
    rule0: 'Freestyle', rule1: 'No overline win', rule2: 'Renju',
    think: 'Think time', thinkHint: 'Time budget for each search',
    stoneStyle: 'Stone style', stoneStyleHint: 'The same three presets as the desktop trainer',
    stoneFlat: 'Flat', stoneReal: 'Realistic', stoneJade: 'Jade',
    showNum: 'Move numbers', showNumHint: 'Print the move number on each stone', on: 'On', off: 'Off',
    rule: 'Rule', hash: 'Hash size', hashHint: 'Transposition table — larger saves more re-search',
    pointsLabel: 'Multi-PV', pointsHint: 'How many lines per candidate point',
    threads: 'Threads', range: 'Move range', rangeHint: 'How cautious the candidate filter is',
    threadSingle: 'Not isolated — single thread only', threadHintT: 'Hardware {hc} threads, up to {max}',
    theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System', themeHint: 'Or follow the system setting',
    reset: 'Reset defaults', done: 'Done',
    engineLoading: 'Loading engine', engineReady: 'Engine ready', engineSingle: 'single thread', engineErr: 'Engine error',
    engineMulti: '{n} threads', engineExit: 'Engine exited',
    stIdle: 'Idle', stSearching: 'Searching', stBal: 'Balancing', stAi: 'AI thinking',
    stStopped: 'Stopped', stWinB: 'Black wins', stWinW: 'White wins',
    balSearching: 'Scanning for balance points, refining as depth grows…', balNotFound: 'No balance point in this position',
    balEmpty: 'The engine returned no balance point (a win may be decided)',
    balWindowIn: 'inside the official balance window', balWindowOut: 'outside the window (closest to even)',
    tCopied: 'Position code copied', tManualCopy: 'Copy it manually', tLoaded: 'Loaded {n} moves', tBadCode: 'Unrecognised position code',
    tRestartConfirm: 'Press "New game" again to confirm', tRestarted: 'New game started', tUndo: 'Took back {p}',
    tWinB: 'Black wins', tWinW: 'White wins', tForbidden: 'Forbidden point for Black',
    tNoEngine: 'The engine is still loading', tGameOver: 'Game over — start a new game',
    tNoBalance: 'An empty board has no stable balance point — play a stone first',
    tBalOn: 'Balance: {n} point(s) · press again to play it', tBalRunning: 'Computing balance points, one moment…',
    tBalPlayed: 'Played the balance point {p}', tBalOff: 'Balance off', tBalNone: 'No balance point available',
    tAiOn: 'AI now plays {n}', tAiOff: 'AI stops playing {n}', tBlack: 'black', tWhite: 'white',
    tThinking: 'AI is thinking as {n}', tThinkSet: 'Think time set to {n} s',
    tHashSet: 'Hash table set to {n} MB', tThreadSet: 'Threads set to {n}', tRuleSet: 'Rule switched to "{n}"',
    tReset: 'Defaults restored', tStoneSet: 'Stone style: {n}', tNumOn: 'Move numbers on', tNumOff: 'Move numbers off',
    tBalPoints: 'Balance points: {n}', tBalanceNoResult: 'No balance result yet',
    tHashClamp: 'Hash clamped to the engine limit of {n} MB',
    tFallback: 'Multi-threading unavailable — running single-threaded',
    toLight: 'Switch to light mode', toDark: 'Switch to dark mode',
    tipUndo: 'Undo (right click / long press also works)', tipRedo: 'Redo', tipRestart: 'Clear the board and reset the engine',
    tipAiB: 'Let the engine play black; both sides can be on at once', tipAiW: 'Let the engine play white; both sides can be on at once',
    tipAnalysis: 'Start / stop the analysis', tipBalance: 'First press: compute balance points; second press: play one',
    tipBalCount: 'How many balance points to request', tipEngine: 'Engine status', tipCopy: 'Copy the position code',
  },
};
let LANG = 'zh';
function T(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) || I18N.zh[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
const ruleName = (id) => (LANG === 'en' ? RULES[id].nameEn : RULES[id].name);
const ruleHint = (id) => (LANG === 'en' ? RULES[id].hintEn : RULES[id].hint);
const sideName = (c) => (c === 1 ? T('tBlack') : T('tWhite'));


const THEME_COLORS = {
  light: { board: '#e9d6b0', line: '#4a4438', coord: '#5c5140', star: '#5b5143', last: '#d94b3f', black: '#14171a', white: '#faf9f5', whiteEdge: 'rgba(0,0,0,.18)' },
  dark: { board: '#bda87f', line: '#332e26', coord: '#40382b', star: '#463c2f', last: '#e2685b', black: '#101215', white: '#f4f2ea', whiteEdge: 'rgba(0,0,0,.24)' },
};
/* stone presets, mirroring the desktop trainer's three styles (flat / real / jade);
   the flat white stone keeps a black hairline, as requested */
const STONES = {
  flat: {
    black: { fill: '#191715', edge: 'rgba(96,90,82,.65)' },
    white: { fill: '#eeeadf', edge: '#171614' },
  },
  real: {
    black: { grad: ['#726d67', '#4a4540', '#241f1b', '#080706'], edge: 'rgba(255,255,255,.18)' },
    white: { grad: ['#ffffff', '#f8f3e7', '#e0d9c7', '#b8b1a0'], edge: 'rgba(120,112,98,.6)' },
  },
  jade: {
    black: { grad: ['#5f6a63', '#39403c', '#1e2422', '#0b0e0c'], edge: 'rgba(210,226,214,.26)' },
    white: { grad: ['#fffdf7', '#f7f2e4', '#e6dfc9', '#cfc7ae'], edge: 'rgba(96,88,68,.42)' },
  },
};
const ANA = [
  { fill: 'rgba(0,194,201,.34)', ring: 'rgba(0,210,218,.98)' },
  { fill: 'rgba(96,200,120,.30)', ring: 'rgba(110,214,134,.96)' },
  { fill: 'rgba(196,216,86,.30)', ring: 'rgba(212,228,104,.96)' },
  { fill: 'rgba(196,216,86,.20)', ring: 'rgba(212,228,104,.80)' },
  { fill: 'rgba(196,216,86,.17)', ring: 'rgba(212,228,104,.70)' },
  { fill: 'rgba(196,216,86,.15)', ring: 'rgba(212,228,104,.62)' },
  { fill: 'rgba(196,216,86,.13)', ring: 'rgba(212,228,104,.55)' },
  { fill: 'rgba(196,216,86,.11)', ring: 'rgba(212,228,104,.48)' },
];
const BAL = {
  black: { fill: 'rgba(124,77,255,.30)', ring: 'rgba(158,120,255,.98)' },
  white: { fill: 'rgba(66,165,245,.26)', ring: 'rgba(106,183,255,.98)' },
};

/* ============================================================ state */
const hc = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 2));
const isolated = () => (typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false) && typeof SharedArrayBuffer !== 'undefined';
const maxThreads = () => (isolated() ? Math.max(1, Math.min(8, hc)) : 1);

const S = {
  moves: [],
  redo: [],
  aiB: false,               // engine plays black
  aiW: false,               // engine plays white (both can be on)
  analysis: false,
  balance: 0,               // 0 off, otherwise the number of balance points being searched
  balanceHeld: false,       // balance markers kept as reference while analysing
  searching: false,
  searchKind: null,
  winner: 0,
  gen: 0,
  seq: 0,
  current: null,
  engineReady: false,
  engineBuild: '',
  engineThreads: 0,
  engineHash: 0,
  hashLimit: HASH_LIMIT_DEFAULT,
  fallback: false,
  worker: null,
  stats: null,
  marks: [],
  forbidden: [],
  balanceMarks: [],
  balanceInfo: null,
  curve: [],
  curveMeta: { maxPly: 0 },
  hover: null,
  anim: null,
  lastAiMove: null,
  settings: loadSettings(),
};

let geo = { css: 0, px: 0, cell: 0, pad: 0, fs: 0 };
let DPR = 1;
let C = THEME_COLORS.light;
let bctx = null;
let cctx = null;
let toastTimer = 0;
let curveRaf = 0;
let lastCurvePush = 0;
let restartConfirmTimer = 0;
let suppressNextTap = false;

/* ============================================================ DOM */
const $ = (id) => document.getElementById(id);
const board = $('board');
const curve = $('curve');
const codeInput = $('codeInput');
const chip = $('engineChip');
const loadbar = $('loadbar');
const settingsDlg = $('settings');

/* ============================================================ settings */
function defaults() {
  return {
    hashMB: 128, points: 3, threads: defaultThreads(), caution: 3, rule: 0, theme: null,
    think: 2600, showNum: false, stone: 'real', balPoints: 1,
  };
}
function defaultThreads() {
  if (!isolated()) return 1;
  return Math.max(2, Math.min(maxThreads(), Math.round(hc / 2)));
}
function loadSettings() {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (HASH_OPTIONS.includes(raw.hashMB)) d.hashMB = raw.hashMB;
    if (Number.isFinite(raw.points) && raw.points >= 1 && raw.points <= 5) d.points = raw.points;
    if (Number.isFinite(raw.threads)) d.threads = Math.max(1, Math.min(maxThreads(), raw.threads));
    if (Number.isFinite(raw.caution) && raw.caution >= 1 && raw.caution <= 5) d.caution = raw.caution;
    if (raw.rule === 0 || raw.rule === 1 || raw.rule === 2) d.rule = raw.rule;
    if (raw.theme === 'light' || raw.theme === 'dark') d.theme = raw.theme;
    if (Number.isFinite(raw.think) && raw.think >= 500 && raw.think <= 60000) d.think = raw.think;
    if (raw.showNum === true || raw.showNum === false) d.showNum = raw.showNum;
    if (raw.stone === 'flat' || raw.stone === 'real' || raw.stone === 'jade') d.stone = raw.stone;
    if (Number.isFinite(raw.balPoints) && raw.balPoints >= 1 && raw.balPoints <= 3) d.balPoints = raw.balPoints;
  } catch (e) {}
  if (!isolated()) d.threads = 1;
  return d;
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.settings)); } catch (e) {}
}

/* ============================================================ theme */
function applyTheme(mode, remember) {
  const dark = mode === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#0a0f15' : '#edf1f6');
  const btn = $('themeBtn');
  if (btn) {
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? T('toLight') : T('toDark'));
  }
  C = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  try {
    if (remember) localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch (e) {}
  syncThemeSeg();
  drawBoard();
  drawCurve();
}
function systemDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  S.settings.theme = saved === 'light' || saved === 'dark' ? saved : null;
  applyTheme(saved || (systemDark() ? 'dark' : 'light'), false);
  $('themeBtn').addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    S.settings.theme = dark ? 'light' : 'dark';
    applyTheme(dark ? 'light' : 'dark', true);
    saveSettings();
  });
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (S.settings.theme) return;
      applyTheme(mq.matches ? 'dark' : 'light', false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  syncThemeSeg();
}

/* ============================================================ geometry / board */
const PAD_CELLS = 1.30;
const BOARD_SPAN = SIZE - 1 + PAD_CELLS * 2;

function themeColor() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;
}

function measureBoard() {
  const shell = document.querySelector('.board-shell');
  const css = Math.max(160, shell.getBoundingClientRect().width);
  const dpr = window.devicePixelRatio || 1;
  const px = Math.max(160, Math.round(css * dpr));
  if (board.width !== px || board.height !== px) {
    board.width = px;
    board.height = px;
  }
  DPR = px / css;
  const cell = px / BOARD_SPAN;
  const fs = Math.max(8.5 * DPR, cell * 0.40);
  geo = { css, px, cell, pad: cell * PAD_CELLS, fs };
  drawBoard();
  drawCurve();
}

function snapDev(v) {
  return Math.round(v);
}

function drawBoard() {
  if (!bctx || !geo.px) return;
  C = themeColor();
  const W = geo.px;
  const cell = geo.cell;
  const pad = geo.pad;
  const lwDev = Math.max(2, Math.round(DPR) + (Math.round(DPR) % 2));
  const xs = [];
  const ys = [];
  for (let i = 0; i < SIZE; i++) {
    xs.push(snapDev(pad + i * cell));
    ys.push(snapDev(pad + i * cell));
  }
  const left = xs[0];
  const right = xs[SIZE - 1];

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.fillStyle = C.board;
  bctx.fillRect(0, 0, W, W);

  bctx.strokeStyle = C.line;
  bctx.lineWidth = lwDev;
  bctx.lineCap = 'butt';
  bctx.beginPath();
  for (let i = 0; i < SIZE; i++) {
    bctx.moveTo(xs[i], ys[0]);
    bctx.lineTo(xs[i], ys[SIZE - 1]);
    bctx.moveTo(xs[0], ys[i]);
    bctx.lineTo(xs[SIZE - 1], ys[i]);
  }
  bctx.stroke();
  bctx.lineWidth = lwDev * 2;
  bctx.strokeRect(left, ys[0], right - left, ys[SIZE - 1] - ys[0]);

  // star points
  const stars = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]];
  bctx.fillStyle = C.star;
  for (const pt of stars) {
    bctx.beginPath();
    bctx.arc(xs[pt[0]], ys[pt[1]], Math.max(1.5 * DPR, cell * 0.09), 0, Math.PI * 2);
    bctx.fill();
  }

  drawCoords(xs, ys, pad, cell);
  drawStones();
  drawForbidden();
  drawMarks();
  drawGhost();
}

function drawCoords(xs, ys, pad, cell) {
  // The column letters sit under the board, the row numbers keep to the left edge.
  const gap = cell * 0.7;
  bctx.fillStyle = C.coord;
  bctx.font = '600 ' + geo.fs + 'px "Cascadia Code",Consolas,monospace';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'top';
  const bottom = ys[SIZE - 1] + gap;
  for (let i = 0; i < SIZE; i++) bctx.fillText(LETTERS[i], xs[i], bottom);
  bctx.textAlign = 'right';
  bctx.textBaseline = 'middle';
  for (let i = 0; i < SIZE; i++) bctx.fillText(String(SIZE - i), pad - gap, ys[i]);
}
function stoneRadius() { return geo.cell * 0.46; }

/* paint one stone with the style picked in the settings */
function paintStone(cx, cy, r, c) {
  const preset = STONES[S.settings.stone] || STONES.real;
  const p = c === 1 ? preset.black : preset.white;
  bctx.beginPath();
  bctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (p.grad) {
    const g = bctx.createRadialGradient(cx - r * 0.34, cy - r * 0.38, r * 0.08, cx, cy, r);
    const stops = [0, 0.44, 0.8, 1];
    p.grad.forEach((col, i) => g.addColorStop(stops[i], col));
    bctx.fillStyle = g;
  } else {
    bctx.fillStyle = p.fill;
  }
  bctx.fill();
  const hairline = S.settings.stone === 'flat' && c === 2;
  bctx.lineWidth = Math.max(1, DPR * (hairline ? 1.15 : 0.9));
  bctx.strokeStyle = p.edge;
  bctx.stroke();
}

function drawStones() {
  const r = stoneRadius();
  for (let i = 0; i < S.moves.length; i++) {
    const m = S.moves[i];
    const cx = snapDev(geo.pad + m.x * geo.cell);
    const cy = snapDev(geo.pad + m.y * geo.cell);
    paintStone(cx, cy, r, m.c);

    if (S.settings.showNum) {
      const label = String(i + 1);
      const fs = Math.max(7 * DPR, geo.cell * 0.42);
      bctx.fillStyle = m.c === 1 ? '#f3efe4' : '#201d18';
      bctx.font = '700 ' + fs + 'px "Cascadia Code",Consolas,monospace';
      bctx.textAlign = 'center';
      bctx.textBaseline = 'middle';
      bctx.fillText(label, cx, cy + fs * 0.04);
    }

    if (i === S.moves.length - 1) {
      bctx.beginPath();
      bctx.arc(cx, cy, Math.max(1.8 * DPR, geo.cell * 0.10), 0, Math.PI * 2);
      bctx.fillStyle = C.last;
      bctx.fill();
    }
  }
}

function drawForbidden() {
  if (!S.forbidden || !S.forbidden.length) return;
  const cell = geo.cell;
  const d = cell * 0.16;
  const lw = Math.max(1.6 * DPR, cell * 0.06);
  for (const p of S.forbidden) {
    const cx = geo.pad + p[0] * cell;
    const cy = geo.pad + p[1] * cell;
    bctx.strokeStyle = 'rgba(215,58,58,.92)';
    bctx.lineWidth = lw;
    bctx.lineCap = 'round';
    bctx.beginPath();
    bctx.moveTo(cx - d, cy - d); bctx.lineTo(cx + d, cy + d);
    bctx.moveTo(cx + d, cy - d); bctx.lineTo(cx - d, cy + d);
    bctx.stroke();
  }
}

function markerRadius() {
  const cell = geo.cell;
  return cell < 30 * DPR ? Math.max(8 * DPR, cell * 0.44) : Math.max(9 * DPR, cell * 0.47);
}

function fitFont(text, maxW, want, min) {
  let s = want;
  bctx.font = '700 ' + s + 'px "Cascadia Code",Consolas,monospace';
  while (s > min && bctx.measureText(text).width > maxW) {
    s -= 0.5;
    bctx.font = '700 ' + s + 'px "Cascadia Code",Consolas,monospace';
  }
  return s;
}

function drawMarks() {
  const marks = S.marks.concat(S.balanceMarks);
  if (!marks.length) return;
  const r = markerRadius();
  const ringW = Math.max(1.6 * DPR, geo.cell * 0.055);
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  marks.slice(0, 8).forEach((mk) => {
    const cx = snapDev(geo.pad + mk.x * geo.cell);
    const cy = snapDev(geo.pad + mk.y * geo.cell);
    const palette = mk.kind === 'bal' ? BAL[mk.c === 1 ? 'black' : 'white'] : (ANA[mk.rank] || ANA[0]);
    bctx.beginPath();
    bctx.arc(cx, cy, r, 0, Math.PI * 2);
    bctx.fillStyle = palette.fill;
    bctx.fill();
    bctx.lineWidth = ringW;
    bctx.strokeStyle = palette.ring;
    if (mk.kind === 'bal') bctx.setLineDash([3.2 * DPR, 2.4 * DPR]);
    else bctx.setLineDash([]);
    bctx.stroke();
    bctx.setLineDash([]);

    // upper half = winrate, lower half = score
    const pct = Math.round((mk.wr == null ? 0.5 : mk.wr) * 100);
    const top = String(Math.max(0, Math.min(100, pct))) + '%';
    const bottom = mk.evTxt || (mk.ev == null ? '–' : (mk.ev >= 0 ? '+' : '') + Math.round(mk.ev));
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    const ink = dark ? '#f4f9ff' : '#0d2028';
    const halo = dark ? 'rgba(6,16,26,.80)' : 'rgba(255,255,255,.90)';

    const hip = cy - r * 0.23;
    const sizeTop = fitFont(top, r * 1.72, r * 0.68, 6 * DPR);
    bctx.font = '700 ' + sizeTop + 'px "Cascadia Code",Consolas,monospace';
    bctx.lineWidth = Math.max(1 * DPR, sizeTop * 0.16);
    bctx.strokeStyle = halo;
    bctx.strokeText(top, cx, hip);
    bctx.fillStyle = ink;
    bctx.fillText(top, cx, hip);

    const lop = cy + r * 0.31;
    const sizeBot = fitFont(bottom, r * 1.72, r * 0.58, 5.5 * DPR);
    bctx.font = '700 ' + sizeBot + 'px "Cascadia Code",Consolas,monospace';
    bctx.lineWidth = Math.max(1 * DPR, sizeBot * 0.16);
    bctx.strokeStyle = halo;
    bctx.strokeText(bottom, cx, lop);
    bctx.fillStyle = ink;
    bctx.fillText(bottom, cx, lop);

    // divider between the two halves
    bctx.strokeStyle = palette.ring;
    bctx.globalAlpha = 0.55;
    bctx.lineWidth = Math.max(1, DPR);
    bctx.beginPath();
    bctx.moveTo(cx - r * 0.64, cy + 1 * DPR);
    bctx.lineTo(cx + r * 0.64, cy + 1 * DPR);
    bctx.stroke();
    bctx.globalAlpha = 1;

    if (mk.kind === 'bal' && mk.rank != null) {
      const bx = cx - r * 0.80, by = cy - r * 0.80, br = Math.max(5.2 * DPR, r * 0.27);
      bctx.beginPath();
      bctx.arc(bx, by, br, 0, Math.PI * 2);
      bctx.fillStyle = palette.ring;
      bctx.fill();
      bctx.fillStyle = '#fff';
      bctx.font = '700 ' + Math.max(6.5 * DPR, br * 1.05) + 'px "Source Han Sans SC","Noto Sans SC",system-ui,sans-serif';
      bctx.fillText(String(mk.rank), bx, by + 0.4 * DPR);
    }
  });
}

function drawGhost() {
  if (S.winner) return;
  const g = S.hover;
  if (!g) return;
  if (stoneAt(g.x, g.y)) return;
  const c = sideToMove();
  const cx = snapDev(geo.pad + g.x * geo.cell);
  const cy = snapDev(geo.pad + g.y * geo.cell);
  bctx.globalAlpha = 0.38;
  paintStone(cx, cy, stoneRadius(), c);
  bctx.globalAlpha = 1;
}

/* ============================================================ rules / board helpers */
function sideToMove() { return S.moves.length % 2 === 0 ? 1 : 2; }
function stoneAt(x, y) {
  for (let i = S.moves.length - 1; i >= 0; i--) {
    const m = S.moves[i];
    if (m.x === x && m.y === y) return m.c;
  }
  return 0;
}
function buildGrid() {
  const b = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
  for (const m of S.moves) b[m.y][m.x] = m.c;
  return b;
}
function coordName(x, yUi) { return LETTERS[x] + String(SIZE - yUi); }
function engineMoves() { return S.moves.map((m) => [m.x, m.y, m.c]); }

function lineThrough(b, x, y, dx, dy, c) {
  let n = 1;
  let ox = x + dx, oy = y + dy;
  while (ox >= 0 && oy >= 0 && ox < SIZE && oy < SIZE && b[oy][ox] === c) { n++; ox += dx; oy += dy; }
  let ex = x - dx, ey = y - dy;
  while (ex >= 0 && ey >= 0 && ex < SIZE && ey < SIZE && b[ey][ex] === c) { n++; ex -= dx; ey -= dy; }
  return n;
}

function checkWin(x, y, c) {
  const b = buildGrid();
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  let longest = 0;
  for (const d of dirs) longest = Math.max(longest, lineThrough(b, x, y, d[0], d[1], c));
  if (longest < 5) return false;
  if (S.settings.rule === 0) return true;
  if (S.settings.rule === 1) return longest === 5;
  return c === 2 ? longest >= 5 : longest === 5;
}

/* --- renju forbidden moves: ported from desktop-connect/ui/calc.js --- */
const VCX_PAT_DEAD = 0, VCX_PAT_OL = 1, VCX_PAT_B1 = 2, VCX_PAT_F1 = 3, VCX_PAT_B2 = 4,
  VCX_PAT_F2 = 5, VCX_PAT_F2A = 6, VCX_PAT_F2B = 7, VCX_PAT_B3 = 8, VCX_PAT_B3S = 9,
  VCX_PAT_F3 = 10, VCX_PAT_F3S = 11, VCX_PAT_B4 = 12, VCX_PAT_B4S = 13, VCX_PAT_F4 = 14,
  VCX_PAT_F5 = 15;
const VCX_PAT_MEMO = new Map();

function vcxLineOf(b, x, y, d) {
  const a = [];
  let k;
  if (d === 0) { for (k = 0; k < SIZE; k++) a.push(b[y][k]); return { a, m: x }; }
  if (d === 1) { for (k = 0; k < SIZE; k++) a.push(b[k][x]); return { a, m: y }; }
  if (d === 2) {
    let sx = x, sy = y;
    while (sx > 0 && sy > 0) { sx--; sy--; }
    while (sx < SIZE && sy < SIZE) { a.push(b[sy][sx]); sx++; sy++; }
    return { a, m: x - (sx - a.length) };
  }
  let tx = x, ty = y;
  while (tx > 0 && ty < SIZE - 1) { tx--; ty++; }
  while (tx < SIZE && ty >= 0) { a.push(b[ty][tx]); tx++; ty--; }
  return { a, m: x - (tx - a.length) };
}

function vcxLinePat(line, m) {
  const win = [];
  for (let j = -5; j <= 5; j++) {
    const idx = m + j;
    win.push(idx >= 0 && idx < line.length ? line[idx] : 2);
  }
  return vcxLinePatWin(win);
}

function vcxLinePatWin(win) {
  const key = win.join('');
  const hit = VCX_PAT_MEMO.get(key);
  if (hit !== undefined) return hit;
  const L = win.length;
  let realLen = 1, fullLen = 1, inc = 1, start = 5, end = 5, i, j;
  for (i = 4; i >= 0; i--) {
    if (win[i] === 1) { if (inc) realLen++; }
    else if (win[i] === 2) break;
    else inc = 0;
    fullLen++; start = i;
  }
  inc = 1;
  for (i = 6; i < L; i++) {
    if (win[i] === 1) { if (inc) realLen++; }
    else if (win[i] === 2) break;
    else inc = 0;
    fullLen++; end = i;
  }
  let p;
  if (realLen >= 6) p = VCX_PAT_OL;
  else if (realLen >= 5) p = VCX_PAT_F5;
  else if (fullLen < 5) p = VCX_PAT_DEAD;
  else {
    const cnt = new Array(16).fill(0);
    let f5a = -1, f5b = -1;
    for (i = start; i <= end; i++) {
      if (win[i] !== 0) continue;
      win[i] = 1;
      const w2 = [];
      for (j = -5; j <= 5; j++) {
        const t = i + j;
        w2.push(t >= 0 && t < L ? win[t] : 2);
      }
      const sp = vcxLinePatWin(w2);
      win[i] = 0;
      if (sp === VCX_PAT_F5) { if (f5a < 0) f5a = i; else if (f5b < 0) f5b = i; }
      cnt[sp]++;
    }
    if (cnt[VCX_PAT_F5] >= 2) {
      p = VCX_PAT_F4;
      if (f5b >= 0 && f5b - f5a < 5) p = VCX_PAT_OL;
    } else if (cnt[VCX_PAT_F5] === 1) {
      win[f5a] = 2;
      p = vcxLinePatWin(win) >= VCX_PAT_B3 ? VCX_PAT_B4S : VCX_PAT_B4;
      win[f5a] = 0;
    } else if (cnt[VCX_PAT_F4] >= 2) p = VCX_PAT_F3S;
    else if (cnt[VCX_PAT_F4]) p = VCX_PAT_F3;
    else if (cnt[VCX_PAT_B4S]) p = VCX_PAT_B3S;
    else if (cnt[VCX_PAT_B4]) p = VCX_PAT_B3;
    else if (cnt[VCX_PAT_F3S] + cnt[VCX_PAT_F3] >= 4) p = VCX_PAT_F2B;
    else if (cnt[VCX_PAT_F3S] + cnt[VCX_PAT_F3] >= 3) p = VCX_PAT_F2A;
    else if (cnt[VCX_PAT_F3S] + cnt[VCX_PAT_F3]) p = VCX_PAT_F2;
    else if (cnt[VCX_PAT_B3S] + cnt[VCX_PAT_B3]) p = VCX_PAT_B2;
    else if (cnt[VCX_PAT_F2B] + cnt[VCX_PAT_F2A] + cnt[VCX_PAT_F2]) p = VCX_PAT_F1;
    else if (cnt[VCX_PAT_B2]) p = VCX_PAT_B1;
    else p = VCX_PAT_DEAD;
  }
  VCX_PAT_MEMO.set(key, p);
  return p;
}

function vcxForbidden(b, x, y) {
  const DIR = [[1, 0], [0, 1], [1, 1], [1, -1]];
  b[y][x] = 1;
  const pats = [];
  for (let d = 0; d < 4; d++) {
    const ln = vcxLineOf(b, x, y, d);
    pats.push(vcxLinePat(ln.a, ln.m));
  }
  b[y][x] = 0;
  let nF5 = 0, nOL = 0, fours = 0;
  const threes = [];
  for (let d = 0; d < 4; d++) {
    const p = pats[d];
    if (p === VCX_PAT_F5) nF5++;
    else if (p === VCX_PAT_OL) nOL++;
    else if (p >= VCX_PAT_B4) fours++;
    else if (p === VCX_PAT_F3 || p === VCX_PAT_F3S) threes.push(d);
  }
  if (nF5) return false;
  if (nOL) return true;
  if (fours >= 2) return true;
  if (threes.length < 2) return false;

  let win3 = 0;
  b[y][x] = 1;
  for (let t = 0; t < threes.length && win3 < 2; t++) {
    const dd = threes[t], dx = DIR[dd][0], dy = DIR[dd][1];
    for (let sg = -1; sg <= 1; sg += 2) {
      let hit = false;
      for (let k = 1; k <= 4; k++) {
        const px = x + dx * k * sg, py = y + dy * k * sg;
        if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) break;
        if (b[py][px] === 2) break;
        if (b[py][px] === 0) {
          b[py][px] = 1;
          const ln = vcxLineOf(b, px, py, dd);
          const p2 = vcxLinePat(ln.a, ln.m);
          b[py][px] = 0;
          if (p2 === VCX_PAT_F4) { hit = true; break; }
        }
      }
      if (hit) { win3++; break; }
    }
  }
  b[y][x] = 0;
  return win3 >= 2;
}

function computeForbidden() {
  S.forbidden = [];
  if (S.settings.rule !== 2 || S.winner || sideToMove() !== 1 || !S.moves.length) return;
  const b = buildGrid();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (b[y][x]) continue;
      if (!nearStone(b, x, y)) continue;
      if (vcxForbidden(b, x, y)) S.forbidden.push([x, y]);
    }
  }
}

function nearStone(b, x, y) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && b[ny][nx]) return true;
    }
  }
  return false;
}

/* ============================================================ engine */
function enginePost(msg) {
  if (S.worker) S.worker.postMessage(msg);
}

function bootEngine() {
  S.worker = new Worker('worker.js');
  S.worker.onmessage = onEngineMessage;
  const build = isolated() ? 'multi' : 'single';
  S.engineBuild = build;
  S.engineThreads = build === 'multi' ? S.settings.threads : 1;
  enginePost({
    t: 'init',
    build,
    urls: ENGINE_FILES[build === 'multi' ? 'multi' : 'single'],
    threads: S.engineThreads,
    hashMB: S.settings.hashMB,
    caution: S.settings.caution,
    rule: S.settings.rule,
  });
}

function retrySingle(reason) {
  if (S.fallback) return false;
  S.fallback = true;
  S.engineBuild = 'single';
  S.engineThreads = 1;
  S.settings.threads = 1;
  if (S.worker) S.worker.terminate();
  toast(T('tFallback'));
  try { S.worker = new Worker('worker.js'); S.worker.onmessage = onEngineMessage; } catch (e) { return false; }
  enginePost({
    t: 'init', build: 'single', urls: ENGINE_FILES.single,
    threads: 1, hashMB: S.settings.hashMB, caution: S.settings.caution, rule: S.settings.rule,
  });
  return true;
}

function onEngineMessage(ev) {
  const d = ev.data || {};
  if (d.t === 'ready') {
    S.engineReady = true;
    S.engineBuild = d.build;
    S.engineThreads = d.threads;
    S.engineHash = d.hashMB;
    chip.textContent = d.build === 'multi' ? T('engineMulti', { n: d.threads }) : T('engineSingle');
    chip.className = 'chip ' + (d.build === 'multi' ? 'on' : 'warn');
    chip.title = T('engineReady') + (d.build === 'multi' ? ' · SharedArrayBuffer' : '');
    loadbar.classList.remove('on');
    loadbar.querySelector('i').style.width = '100%';
    renderDebug();
    updateThreadUI();
    schedule(0);
    return;
  }
  if (d.t === 'initfail') {
    if (S.engineBuild === 'multi' && retrySingle(d.error)) return;
    chip.textContent = T('engineErr');
    chip.className = 'chip err';
    loadbar.classList.remove('on');
    toast(T('engineErr') + ': ' + (d.error || ''));
    return;
  }
  if (d.t === 'stderr') return;
  if (d.t === 'exit') {
    chip.textContent = T('engineExit');
    chip.className = 'chip err';
    return;
  }
  if (d.t === 'balance-tick' || d.t === 'balance') {
    if (d.gen !== S.gen) return;
    applyBalance(d.points, d.stats);
    if (d.t === 'balance') {
      S.searching = false;
      S.searchKind = null;
      updateState();
      renderDebug();
    }
    return;
  }
  if (d.t === 'info' || d.t === 'best') {
    if (d.gen !== S.gen) return;
    if (d.stats) applyStats(d.stats);
    if (d.candidates && d.candidates.length) applyCandidates(d.candidates);
    if (d.t === 'best') {
      S.searching = false;
      const kind = S.searchKind;
      S.searchKind = null;
      if ((!S.marks.length) && d.best && d.candidates && d.candidates.length) applyCandidates(d.candidates);
      updateState();
      renderDebug();
      // AI (or a single-thread chunk) continues here
      const nowSide = sideToMove();
      const aiOn = nowSide === 1 ? S.aiB : S.aiW;
      if (kind === 'ai' && aiOn && d.best) {
        commitMove(d.best[0], 14 - d.best[1], { fromAi: true });
      } else if (S.engineBuild !== 'multi' && kind === 'analysis' && S.analysis) {
        setTimeout(() => { if (S.analysis && !S.searching) launch('analysis'); }, 120);
      } else if (S.engineBuild !== 'multi' && kind === 'balance' && S.balance) {
        setTimeout(() => { if (S.balance && !S.searching) launch('balance'); }, 120);
      }
    }
  }
}

function applyStats(st) {
  if (S.stats && S.statPly === S.moves.length) {
    st.depth = Math.max(st.depth, S.stats.depth || 0);
    st.nodes = Math.max(st.nodes, S.stats.nodes || 0);
    st.time = Math.max(st.time, S.stats.time || 0);
    if (!st.speed) st.speed = S.stats.speed || 0;
  }
  S.statPly = S.moves.length;
  S.stats = st;
  writeStats();
  updateState();
  pushCurve(st);
  scheduleDebug();
}

let debugTimer = 0;
function scheduleDebug() {
  if (debugTimer) return;
  debugTimer = setTimeout(() => { debugTimer = 0; renderDebug(); }, 350);
}

function applyCandidates(cands) {
  const max = Math.max(1, S.settings.points);
  S.marks = cands.slice(0, 8).slice(0, max).map((c, i) => {
    const x = c.move[0], yUi = 14 - c.move[1];
    const ev = parseEval(c.eval);
    return {
      kind: 'ana', rank: i, x, y: yUi, depth: c.depth,
      wr: normWr(c.winrate),
      ev, evTxt: fmtEval(ev),
    };
  });
  drawBoard();
  updateRoute(cands[0]);
}

function normWr(v) {
  if (!Number.isFinite(v)) return null;
  return v > 1.5 ? v / 100 : v;
}

function parseEval(v) {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return null;
  let s = String(v).trim();
  let sign = 1;
  if (s[0] === '-') { sign = -1; s = s.slice(1); }
  else if (s[0] === '+') s = s.slice(1);
  if (/^M/i.test(s)) return sign * (9900 + (parseInt(s.slice(1), 10) || 0));
  const n = parseFloat(s);
  return Number.isFinite(n) ? sign * n : null;
}
function fmtEval(v) {
  if (v == null || !Number.isFinite(v)) return '–';
  if (v >= 9900) return LANG === 'en' ? 'W' : '胜';
  if (v <= -9900) return LANG === 'en' ? 'L' : '负';
  return (v >= 0 ? '+' : '') + Math.round(v);
}

function applyBalance(points, stats) {
  if (!points || !points.length) {
    S.balanceMarks = [];
    S.balanceInfo = { empty: true, stats };
    drawBoard();
    updateBalanceRow();
    return;
  }
  const mover = sideToMove();
  const wr = stats ? normWr(stats.winrate) : null;
  const ev = stats ? parseEval(stats.eval) : null;
  S.balanceMarks = points.map((p, i) => {
    const color = i % 2 === 0 ? mover : (mover === 1 ? 2 : 1);
    const perspective = i % 2 === 0 ? 1 : -1;
    const myWr = wr == null ? null : (perspective === 1 ? wr : 1 - wr);
    const myEv = ev == null ? null : ev * perspective;
    return {
      kind: 'bal', rank: i + 1, x: p[0], y: 14 - p[1], c: color,
      wr: myWr, ev: myEv, evTxt: fmtEval(myEv),
    };
  });
  S.balanceInfo = { empty: false, stats, winrate: wr, eval: ev };
  if (stats) { S.stats = stats; writeStats(); updateState(); scheduleDebug(); }
  drawBoard();
  updateBalanceRow();
}

/* ============================================================ search orchestration */
function launch(kind) {
  if (!S.engineReady || !S.worker) return;
  if (S.winner) return;
  if (S.searching) return;
  if (kind === 'balance' && !S.balance) return;
  if (kind !== 'balance' && S.searchKind === 'analysis' && !S.analysis) return;
  S.searching = true;
  S.searchKind = kind;
  const job = {
    id: ++S.seq,
    gen: S.gen,
    moves: engineMoves(),
    threads: S.engineThreads || 1,
    hashMB: S.settings.hashMB,
    caution: S.settings.caution,
    rule: S.settings.rule,
    infinite: S.engineBuild === 'multi' && kind !== 'ai',
    timeMs: kind === 'ai' ? Math.min(S.settings.think, 4000) : S.settings.think,
    topN: S.settings.points,
    count: S.balance,
  };
  if (kind === 'balance') enginePost({ t: 'balance', job });
  else enginePost({ t: 'search', job });
  updateState();
}

function schedule(delay) {
  if (!S.engineReady || S.winner) return;
  if (S.searching) return;
  const run = () => {
    if (!S.engineReady || S.winner || S.searching) return;
    const side = sideToMove();
    if ((side === 1 ? S.aiB : S.aiW)) { launch('ai'); return; }
    if (S.balance) { launch('balance'); return; }
    if (S.analysis) { launch('analysis'); return; }
  };
  if (delay) setTimeout(run, delay); else run();
}

function haltSearch() {
  S.gen++;
  S.searching = false;
  S.searchKind = null;
  enginePost({ t: 'stop' });
}

function boardChanged(options) {
  const opts = options || {};
  const keepRedo = !!opts.keepRedo;
  haltSearch();
  if (!keepRedo) S.redo = [];
  S.stats = null;
  S.marks = [];
  S.balanceHeld = false;
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.curve = S.curve.filter((p) => p.i <= S.moves.length);
  S.curveMeta.maxPly = S.moves.length;
  recompute();
  writeStats();
  drawBoard();
  drawCurve();
  updateAll();
  schedule(140);
}

function recompute() {
  S.winner = 0;
  if (S.moves.length) {
    const last = S.moves[S.moves.length - 1];
    if (checkWin(last.x, last.y, last.c)) S.winner = last.c;
  }
  computeForbidden();
}

/* ============================================================ moves */
function canPlace(x, y) {
  if (S.winner) return false;
  if (stoneAt(x, y)) return false;
  if (S.settings.rule === 2 && sideToMove() === 1) {
    const b = buildGrid();
    if (vcxForbidden(b, x, y)) return false;
  }
  return true;
}

function commitMove(x, y, opts) {
  const o = opts || {};
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
  if (!canPlace(x, y)) {
    if (S.settings.rule === 2 && sideToMove() === 1 && !stoneAt(x, y) && !S.winner) toast(T('tForbidden'));
    return false;
  }
  S.moves.push({ x, y, c: sideToMove() });
  S.redo = [];
  S.lastAiMove = o.fromAi ? [x, y] : null;
  stopAiIfDone();
  recompute();
  if (S.winner) {
    toast(S.winner === 1 ? T('tWinB') : T('tWinW'));
  }
  boardChanged({ keepRedo: false });
  return true;
}

function stopAiIfDone() {
  if (S.winner) { S.aiB = false; S.aiW = false; }
}

function undoMove() {
  if (!S.moves.length) return;
  const m = S.moves.pop();
  S.redo.push(m);
  S.lastAiMove = null;
  boardChanged({ keepRedo: true });
  toast(T('tUndo', { p: coordName(m.x, m.y) }));
}

function redoMove() {
  if (!S.redo.length) return;
  const m = S.redo.pop();
  if (stoneAt(m.x, m.y)) return;
  S.moves.push(m);
  boardChanged({ keepRedo: true });
}

function restartGame(force) {
  const btn = $('btnRestart');
  if (!force && S.moves.length && !S.winner && !btn.classList.contains('confirm')) {
    toast(T('tRestartConfirm'));
    btn.classList.add('confirm');
    btn.textContent = T('restartConfirm');
    clearTimeout(restartConfirmTimer);
    restartConfirmTimer = setTimeout(() => {
      btn.classList.remove('confirm');
      btn.textContent = T('restart');
    }, 2600);
    return;
  }
  clearTimeout(restartConfirmTimer);
  btn.classList.remove('confirm');
  btn.textContent = T('restart');
  haltSearch();
  S.moves = [];
  S.redo = [];
  S.winner = 0;
  S.forbidden = [];
  S.marks = [];
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.stats = null;
  S.statsShown = false;
  S.curve = [];
  S.curveMeta.maxPly = 0;
  S.anim = null;
  S.lastAiMove = null;
  enginePost({ t: 'reset', moves: [], rule: S.settings.rule });
  drawBoard();
  drawCurve();
  writeStats();
  updateAll();
  schedule(320);
  toast(T('tRestarted'));
}

/* ============================================================ AI / analysis / balance */
function toggleAI(side) {
  if (side === 1) S.aiB = !S.aiB; else S.aiW = !S.aiW;
  haltSearch();
  updateAll();
  schedule(180);
  const on = side === 1 ? S.aiB : S.aiW;
  const who = side === 1 ? T('tBlack') : T('tWhite');
  toast(on ? T('tAiOn', { n: who }) : T('tAiOff', { n: who }));
}

/* balance points: the first press computes, the second press plays the point */
function clickBalance() {
  if (S.winner) { toast(T('tGameOver')); return; }
  if (!S.engineReady) { toast(T('tNoEngine')); return; }
  if (!S.moves.length) { toast(T('tNoBalance')); return; }
  if (S.balanceMarks.length) {
    const p = S.balanceMarks[0];
    S.balance = 0;
    S.balanceHeld = false;
    S.balanceMarks = [];
    S.balanceInfo = null;
    haltSearch();
    updateAll();
    if (p && canPlace(p.x, p.y)) {
      commitMove(p.x, p.y, {});
      toast(T('tBalPlayed', { p: coordName(p.x, p.y) }));
    } else {
      toast(T('tBalNone'));
      drawBoard();
    }
    return;
  }
  if (S.balance) {
    S.balance = 0;
    S.balanceHeld = false;
    haltSearch();
    updateAll();
    toast(T('tBalOff'));
    return;
  }
  const n = Math.max(1, Math.min(3, S.settings.balPoints || 1));
  S.balance = n;
  S.analysis = false;
  S.balanceHeld = false;
  S.marks = [];
  S.balanceMarks = [];
  S.balanceInfo = null;
  updateAll();
  schedule(120);
  toast(T('tBalOn', { n }));
}

/* the 1/3 column: cycle how many balance points are requested */
function cycleBalPoints() {
  const next = ((S.settings.balPoints || 1) % 3) + 1;
  setSetting('balPoints', next);
  toast(T('tBalPoints', { n: next }));
}

function toggleAnalysis() {
  if (S.winner) { toast(T('tGameOver')); return; }
  if (!S.engineReady) { toast(T('tNoEngine')); return; }
  if (S.analysis) {
    // Second click = cancel. Play the current best point, then stop.
    const best = S.marks[0] || null;
    S.analysis = false;
    S.balance = 0;
    S.balanceHeld = false;
    S.balanceMarks = [];
    S.balanceInfo = null;
    haltSearch();
    updateAll();
    if (best && canPlace(best.x, best.y)) {
      commitMove(best.x, best.y, { fromAi: false });
      toast(T('tBalPlayed', { p: coordName(best.x, best.y) }));
    } else {
      toast(T('stStopped'));
    }
    return;
  }
  S.analysis = true;
  // Keep the last balance result visible as a reference; the balance search stops.
  S.balanceHeld = !!S.balanceMarks.length;
  S.balance = 0;
  S.marks = [];
  S.stats = null;
  haltSearch();
  updateAll();
  schedule(120);
}

/* ============================================================ code */
function formatCode() {
  return S.moves.map((m) => (LETTERS[m.x] + (SIZE - m.y)).toLowerCase()).join('');
}

function parseCode(text) {
  const raw = String(text || '');
  const pairs = [];
  if (/[a-oA-O]/.test(raw) && !/[0-9]+\s*,\s*[0-9]+/.test(raw)) {
    const re = /([a-oA-O])(\d{1,2})/g;
    let m;
    while ((m = re.exec(raw))) {
      const x = LETTERS.indexOf(m[1].toUpperCase());
      const n = +m[2];
      if (x < 0 || n < 1 || n > SIZE) return null;
      pairs.push([x, SIZE - n]);
    }
  } else {
    const nums = raw.match(/\d+/g) || [];
    if (nums.length < 2 || nums.length % 2) return null;
    for (let i = 0; i < nums.length; i += 2) {
      const x = +nums[i] - 1, y = +nums[i + 1] - 1;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
      pairs.push([x, y]);
    }
  }
  if (!pairs.length) return null;
  const used = new Set();
  for (const p of pairs) {
    const key = p[0] + ',' + p[1];
    if (used.has(key)) return null;
    used.add(key);
  }
  return pairs.map((p, i) => ({ x: p[0], y: p[1], c: i % 2 === 0 ? 1 : 2 }));
}

function applyCode(text) {
  const moves = parseCode(text);
  if (!moves) { codeInput.classList.add('bad'); setTimeout(() => codeInput.classList.remove('bad'), 400); toast(T('tBadCode')); return; }
  haltSearch();
  S.moves = moves;
  S.redo = [];
  S.winner = 0;
  S.curve = [];
  S.curveMeta.maxPly = 0;
  S.marks = [];
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.stats = null;
  S.statsShown = false;
  recompute();
  drawBoard();
  drawCurve();
  writeStats();
  updateAll();
  schedule(160);
  toast(T('tLoaded', { n: moves.length }));
}

/* ============================================================ curve */
function pushCurve(st) {
  if (!st || st.depth <= 0) return;
  const ev = parseEval(st.eval);
  if (ev == null || !Number.isFinite(ev)) return;
  const moverIsBlack = S.moves.length % 2 === 0;
  let b = moverIsBlack ? ev : -ev;
  if (Math.abs(b) > 6000) b = b > 0 ? 6000 : -6000;
  const ply = S.moves.length;
  const i = S.curve.findIndex((p) => p.i === ply);
  if (i >= 0) S.curve[i].b = b;
  else { S.curve.push({ i: ply, b }); S.curve.sort((a, b2) => a.i - b2.i); }
  S.curveMeta.maxPly = Math.max(S.curveMeta.maxPly, ply);
  if (S.curve.length > 400) S.curve = S.curve.slice(-400);
  const now = performance.now();
  if (now - lastCurvePush > 140) {
    lastCurvePush = now;
    if (!curveRaf) {
      curveRaf = requestAnimationFrame(() => {
        curveRaf = 0;
        drawCurve();
      });
    }
  }
}

function niceRange(peak) {
  const steps = [10, 20, 50, 100, 200, 300, 500, 1000, 2000];
  for (const s of steps) if (peak <= s) return s;
  return 2000;
}

function drawCurve() {
  if (!cctx || !curve) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = curve.getBoundingClientRect().width || 300;
  const cssH = curve.getBoundingClientRect().height || 96;
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (curve.width !== w || curve.height !== h) { curve.width = w; curve.height = h; }
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const col = {
    ink: dark ? '#d7e3f0' : '#28313a',
    mute: dark ? '#7d8ea3' : '#8a95a2',
    line: dark ? '#28323e' : '#e6ebf2',
    zero: dark ? '#43536a' : '#b8c4d4',
    grid: dark ? 'rgba(122,90,248,.14)' : 'rgba(122,90,248,.13)',
    black: dark ? '#a58cff' : '#7a5af8',
    white: dark ? '#79b6f2' : '#4f8fd6',
  };
  const padL = 34 * dpr, padR = 8 * dpr, padT = 8 * dpr, padB = 14 * dpr;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.clearRect(0, 0, w, h);

  cctx.fillStyle = col.line;
  cctx.lineWidth = 1 * dpr;
  cctx.strokeStyle = col.line;
  cctx.beginPath();
  cctx.moveTo(padL, padT + plotH / 2);
  cctx.lineTo(w - padR, padT + plotH / 2);
  cctx.strokeStyle = col.zero;
  cctx.lineWidth = 1.2 * dpr;
  cctx.stroke();

  // light grid on both sides of the zero line (same feel as the desktop trainer)
  cctx.strokeStyle = col.grid;
  cctx.lineWidth = 1 * dpr;
  [-1, -0.5, 0.5, 1].forEach((k) => {
    const y = padT + plotH / 2 - k * (plotH / 2 - 2 * dpr);
    cctx.beginPath();
    cctx.moveTo(padL, y);
    cctx.lineTo(w - padR, y);
    cctx.stroke();
  });

  const data = S.curve;
  if (!data.length) {
    cctx.fillStyle = col.mute;
    cctx.font = '500 ' + 11 * dpr + 'px "Source Han Sans SC","Noto Sans SC",system-ui,sans-serif';
    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    cctx.fillText(T('curveEmpty'), padL + plotW / 2, padT + plotH / 2);
    return;
  }
  const maxPly = Math.max(2, S.curveMeta.maxPly, S.moves.length);
  let peak = 0;
  for (const p of data) {
    if (Math.abs(p.b) < 6000) peak = Math.max(peak, Math.abs(p.b));
  }
  const amp = niceRange(peak);
  const xOf = (i) => padL + (maxPly <= 1 ? 0 : (i / maxPly) * plotW);
  const yOf = (v) => padT + plotH / 2 - (Math.max(-amp, Math.min(amp, v)) / amp) * (plotH / 2 - 2 * dpr);

  // y labels
  cctx.fillStyle = col.mute;
  cctx.font = '600 ' + 9 * dpr + 'px "Cascadia Code",Consolas,monospace';
  cctx.textAlign = 'right';
  cctx.textBaseline = 'middle';
  cctx.fillText('+' + amp, padL - 4 * dpr, padT + 6 * dpr);
  cctx.fillText('0', padL - 4 * dpr, padT + plotH / 2);
  cctx.fillText('-' + amp, padL - 4 * dpr, padT + plotH - 4 * dpr);

  const drawLine = (fn, color, fill) => {
    cctx.beginPath();
    data.forEach((p, i) => {
      const x = xOf(p.i), y = yOf(fn(p.b));
      if (i === 0) cctx.moveTo(x, y);
      else cctx.lineTo(x, y);
    });
    cctx.strokeStyle = color;
    cctx.lineWidth = 1.7 * dpr;
    cctx.lineJoin = 'round';
    cctx.stroke();
    if (fill) {
      cctx.beginPath();
      const y0 = padT + plotH / 2;
      data.forEach((p, i) => {
        const x = xOf(p.i), y = yOf(fn(p.b));
        if (i === 0) { cctx.moveTo(x, y0); cctx.lineTo(x, y); }
        else cctx.lineTo(x, y);
      });
      cctx.lineTo(xOf(data[data.length - 1].i), y0);
      cctx.closePath();
      cctx.fillStyle = fill;
      cctx.fill();
    }
  };
  drawLine((b) => b, col.black, dark ? 'rgba(232,238,247,.10)' : 'rgba(20,23,26,.08)');
  drawLine((b) => -b, col.white, dark ? 'rgba(111,184,239,.10)' : 'rgba(47,111,176,.08)');

  // current ply marker
  const cur = data.find((p) => p.i === S.moves.length);
  if (cur) {
    cctx.beginPath();
    cctx.arc(xOf(cur.i), yOf(cur.b), 2.6 * dpr, 0, Math.PI * 2);
    cctx.fillStyle = col.black;
    cctx.fill();
  }
  cctx.fillStyle = col.mute;
  cctx.font = '600 ' + 9 * dpr + 'px "Cascadia Code",Consolas,monospace';
  cctx.textAlign = 'left';
  cctx.textBaseline = 'top';
  cctx.fillText('0', padL, h - padB + 2 * dpr);
  cctx.textAlign = 'right';
  cctx.fillText(String(maxPly), w - padR, h - padB + 2 * dpr);
}

/* ============================================================ UI text */
/* switch the whole page between Chinese and English; every visible string
   comes from I18N, so the English build never shows Chinese */
function applyLang(lang) {
  LANG = lang === 'en' ? 'en' : 'zh';
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
  document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
  document.title = LANG === 'en' ? 'Gomoku Calculator · Meter Gomoku' : '五子棋计算器 · Meter Gomoku';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    if (I18N[LANG][k]) el.textContent = T(k);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const k = el.getAttribute('data-i18n-ph');
    if (I18N[LANG][k]) el.setAttribute('placeholder', T(k));
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const k = el.getAttribute('data-i18n-title');
    if (I18N[LANG][k]) { el.setAttribute('title', T(k)); el.setAttribute('aria-label', T(k)); }
  });
  const lb = $('langBtn');
  if (lb) {
    lb.textContent = LANG === 'en' ? 'ZH / EN' : '中 / EN';
    lb.setAttribute('aria-pressed', String(LANG === 'en'));
  }
  if (S.engineReady) {
    chip.textContent = S.engineBuild === 'multi' ? T('engineMulti', { n: S.engineThreads }) : T('engineSingle');
  }
  $('btnRestart').textContent = T('restart');
  updateAll();
  writeStats();
  drawCurve();
  drawBoard();
}

/* the four search metrics stay on screen all the time: a finished search keeps
   its last numbers instead of falling back to a dash */
function writeStats() {
  const st = S.stats;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  if (!st) {
    if (S.statsShown) return;
    set('stDepth', '–'); set('stSpeed', '–'); set('stNodes', '–'); set('stTime', '–');
    return;
  }
  S.statsShown = true;
  set('stDepth', st.depth ? 'd' + st.depth : '–');
  set('stSpeed', st.speed ? fmtNps(st.speed) : '–');
  set('stNodes', st.nodes ? fmtBig(st.nodes) : '–');
  set('stTime', st.time ? (st.time / 1000).toFixed(1) + 's' : '–');
  updateWinBar();
}
function fmtNps(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return String(Math.round(v));
}
function fmtBig(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'G';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return String(Math.round(v));
}

function updateState() {
  const el = $('analysisState');
  let txt = T('stIdle');
  if (S.winner) txt = S.winner === 1 ? T('stWinB') : T('stWinW');
  else if (S.searching && S.searchKind === 'balance') txt = T('stBal');
  else if (S.searching && S.searchKind === 'analysis') txt = T('stSearching') + (S.stats && S.stats.depth ? ' · d' + S.stats.depth : '');
  else if (S.searching && S.searchKind === 'ai') txt = T('stAi');
  else if (S.analysis && S.stats) txt = T('stStopped') + ' · d' + S.stats.depth;
  else if (S.analysis) txt = T('stIdle');
  else if (S.balance) txt = T('stBal');
  else if (S.stats) txt = T('stStopped') + ' · d' + S.stats.depth;
  el.textContent = txt;
  el.classList.toggle('live', !!S.searching);
}

function updateRoute(top) {
  const row = $('routeRow');
  const st = S.stats;
  if (!top && !S.marks.length) {
    row.className = 'route-row empty';
    row.innerHTML = '<span class="rank">1</span><span class="depth">d–</span><span class="eval">–</span>' +
      '<span class="route">' + T('routeEmpty') + '</span>';
    return;
  }
  const mk = S.marks[0];
  const line = top && top.line && top.line.length ? top.line : (mk ? [[mk.x, 14 - mk.y]] : []);
  const route = line.slice(0, 12).map((p) => coordName(p[0], 14 - p[1])).join(' ');
  const ev = mk && mk.ev != null ? mk.ev : null;
  const cls = ev == null ? '' : (ev >= 0 ? ' pos' : ' neg');
  row.className = 'route-row';
  row.innerHTML =
    '<span class="rank">' + (mk ? mk.rank + 1 : 1) + '</span>' +
    '<span class="depth">d' + ((st && st.depth) || (mk && mk.depth) || 0) + '</span>' +
    '<span class="eval' + cls + '">' + (mk ? mk.evTxt : '–') + '</span>' +
    '<span class="route">' + (route || T('routeNone')) + '</span>';
}

function updateBalanceRow() {
  const row = $('balanceRow');
  if (!S.balance && !S.balanceHeld) { row.hidden = true; row.innerHTML = ''; return; }
  row.hidden = false;
  if (!S.balanceMarks.length) {
    row.innerHTML = '<span class="bal note">' +
      (S.searching ? T('balSearching') : T('balNotFound')) + '</span>';
    return;
  }
  const bits = S.balanceMarks.map((m, i) =>
    '<span class="bal b' + m.c + '"><i></i>' + (i + 1) + ' ' + sideName(m.c) +
    ' ' + coordName(m.x, m.y) + ' · <em>' + Math.round((m.wr == null ? 0.5 : m.wr) * 100) +
    '% / ' + m.evTxt + '</em></span>'
  ).join('');
  const info = S.balanceInfo;
  let note = '';
  if (info && info.empty) note = '<span class="bal note">' + T('balEmpty') + '</span>';
  else if (info && info.eval != null) {
    note = '<span class="bal note">|Eval| ' + Math.abs(Math.round(info.eval)) + ' · ' +
      (Math.abs(info.eval) <= 50 ? T('balWindowIn') : T('balWindowOut')) + '</span>';
  }
  row.innerHTML = bits + note;
}

function updateAll() {
  $('btnAIB').setAttribute('aria-pressed', String(S.aiB));
  $('btnAIW').setAttribute('aria-pressed', String(S.aiW));
  const an = $('btnAnalysis');
  an.setAttribute('aria-pressed', String(S.analysis));
  an.querySelector('.tool-txt').textContent = S.analysis ? T('analysisStop') : T('analysis');
  const bal = $('btnBalance');
  bal.setAttribute('aria-pressed', String(S.balance > 0 || S.balanceMarks.length > 0));
  const num = $('balCountNum');
  if (num) num.textContent = String(S.settings.balPoints || 1);
  $('btnUndo').disabled = !S.moves.length;
  $('btnRedo').disabled = !S.redo.length;
  $('stepInfo').textContent = LANG === 'en'
    ? (S.moves.length ? String(S.moves.length) : '0')
    : S.moves.length + ' 手';
  if (document.activeElement !== codeInput) codeInput.value = formatCode();
  updateState();
  updateBalanceRow();
  updateWinBar();
  renderDebug();
  syncSettingsUI();
}

/* black share of the win rate, 0..1 — 0.5 on an empty board */
function blackWinRate() {
  const st = S.stats;
  if (!st) return 0.5;
  let wr = normWr(st.winrate);
  if (wr == null) {
    const ev = parseEval(st.eval);
    if (ev == null) return 0.5;
    wr = 1 / (1 + Math.exp(-ev / 200));
  }
  wr = Math.max(0.01, Math.min(0.99, wr));
  return sideToMove() === 1 ? wr : 1 - wr;
}

/* the bar above the curve: black on the left, white on the right */
function updateWinBar() {
  const b = $('wrB'), w = $('wrW');
  if (!b || !w) return;
  const p = blackWinRate();
  const pct = Math.round(p * 1000) / 10;
  b.style.flexBasis = pct + '%';
  w.style.flexBasis = (100 - pct) + '%';
  const bt = $('wrBTxt'), wt = $('wrWTxt');
  if (bt) bt.textContent = pct.toFixed(0) + '%';
  if (wt) wt.textContent = (100 - pct).toFixed(0) + '%';
}

/* ============================================================ debug / settings UI */
function renderDebug() {
  const dbg = $('debugBox');
  if (!dbg) return;
  const st = S.stats;
  dbg.innerHTML =
    '<b>crossOriginIsolated</b> = ' + (isolated() ? 'true' : 'false') +
    ' · <b>SAB</b> ' + (typeof SharedArrayBuffer !== 'undefined' ? 'on' : 'off') + '<br>' +
    '<b>hardwareConcurrency</b> = ' + navigator.hardwareConcurrency + '<br>' +
    '<b>engine</b> ' + (S.engineBuild || '–') + ' · threads ' + (S.engineThreads || 0) + ' / max ' + maxThreads() + '<br>' +
    '<b>hash</b> ' + S.settings.hashMB + ' MB · limit ' + S.hashLimit + ' MB<br>' +
    '<b>search</b> ' + (S.searching ? 'running' : 'idle') + ' · d' + ((st && st.depth) || 0) +
    ' · ' + Math.round((st && st.time) || 0) + ' ms<br>' +
    '<b>rule</b> ' + ruleName(S.settings.rule) + ' · DPR ' + DPR.toFixed(2);
}

function syncSettingsUI() {
  const seg = (id, v) => {
    const box = $(id);
    if (!box) return;
    [...box.querySelectorAll('button')].forEach((b) => b.classList.toggle('on', String(v) === b.dataset.v));
  };
  seg('segHash', S.settings.hashMB);
  seg('segPoints', S.settings.points);
  seg('segRange', S.settings.caution);
  seg('segRule', S.settings.rule);
  seg('segTheme', S.settings.theme || 'system');
  seg('segThink', S.settings.think);
  seg('segStone', S.settings.stone);
  seg('segNum', S.settings.showNum ? 1 : 0);
  const tr = $('threadRange');
  if (tr) {
    tr.max = String(maxThreads());
    tr.value = String(Math.min(S.settings.threads, maxThreads()));
    tr.disabled = maxThreads() <= 1;
  }
  const tv = $('threadVal');
  if (tv) tv.textContent = String(Math.min(S.settings.threads, maxThreads())) + (maxThreads() <= 1 ? (LANG === 'en' ? ' (1)' : ' (单)') : '');
  const th = $('threadHint');
  if (th) {
    th.textContent = maxThreads() <= 1
      ? T('threadSingle')
      : T('threadHintT', { hc, max: maxThreads() });
  }
  const rh = $('ruleHint');
  if (rh) rh.textContent = ruleHint(S.settings.rule);
}
function syncThemeSeg() {
  const box = $('segTheme');
  if (!box) return;
  [...box.querySelectorAll('button')].forEach((b) => b.classList.toggle('on', (S.settings.theme || 'system') === b.dataset.v));
}
function updateThreadUI() { syncSettingsUI(); }

/* ============================================================ settings events */
function setSetting(key, value, opts) {
  const o = opts || {};
  const prev = S.settings[key];
  if (key === 'hashMB') {
    if (value > S.hashLimit) {
      toast(T('tHashClamp', { n: S.hashLimit }));      value = S.hashLimit;
    }
  }
  if (key === 'threads') value = Math.max(1, Math.min(maxThreads(), value));
  S.settings[key] = value;
  saveSettings();
  syncSettingsUI();
  renderDebug();
  if (prev !== value) {
    if (key === 'stone' || key === 'showNum') {
      drawBoard();
      if (key === 'stone') toast(T('tStoneSet', { n: T('stone' + value.charAt(0).toUpperCase() + value.slice(1)) }));
      else toast(value ? T('tNumOn') : T('tNumOff'));
      return;
    }
    if (key === 'balPoints') {
      if (S.balance) { S.balance = value; haltSearch(); schedule(120); }
      return;
    }
    haltSearch();
    if (key === 'rule') {
      S.curve = [];
      S.marks = [];
      S.stats = null;
      S.balanceMarks = [];
      S.balanceInfo = null;
      recompute();
      enginePost({ t: 'reset', moves: engineMoves(), rule: S.settings.rule });
      drawBoard();
      drawCurve();
      writeStats();
      updateAll();
      toast(T('tRuleSet', { n: ruleName(value) }));
      } else if (key === 'threads' || key === 'hashMB') {
        enginePost({ t: 'config', threads: S.settings.threads, hashMB: S.settings.hashMB, caution: S.settings.caution, rule: S.settings.rule });
        toast(key === 'hashMB' ? T('tHashSet', { n: value }) : T('tThreadSet', { n: value }));
      } else if (key === 'think') {
        toast(T('tThinkSet', { n: Math.round(value / 1000) }));
      }
    schedule(220);
  }
}

function initSettingsEvents() {
  const segClick = (id, fn) => {
    const box = $(id);
    if (!box) return;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !box.contains(b)) return;
      fn(b.dataset.v);
    });
  };
  segClick('segHash', (v) => setSetting('hashMB', +v));
  segClick('segPoints', (v) => setSetting('points', +v));
  segClick('segRange', (v) => setSetting('caution', +v));
  segClick('segRule', (v) => setSetting('rule', +v));
  segClick('segThink', (v) => setSetting('think', +v));
  segClick('segStone', (v) => setSetting('stone', v));
  segClick('segNum', (v) => setSetting('showNum', v === '1'));
  segClick('segTheme', (v) => {
    if (v === 'system') {
      S.settings.theme = null;
      saveSettings();
      applyTheme(systemDark() ? 'dark' : 'light', false);
    } else {
      S.settings.theme = v;
      saveSettings();
      applyTheme(v, true);
    }
    syncThemeSeg();
  });
  $('threadRange').addEventListener('input', (e) => {
    S.settings.threads = Math.max(1, Math.min(maxThreads(), +e.target.value));
    $('threadVal').textContent = String(S.settings.threads);
  });
  $('threadRange').addEventListener('change', () => {
    setSetting('threads', S.settings.threads);
  });
  $('btnCloseSet').addEventListener('click', () => settingsDlg.close());
  $('btnDone').addEventListener('click', () => settingsDlg.close());
  settingsDlg.addEventListener('click', (e) => { if (e.target === settingsDlg) settingsDlg.close(); });
  $('btnReset').addEventListener('click', () => {
    const d = defaults();
    d.theme = S.settings.theme;
    S.settings = d;
    saveSettings();
    applyTheme(document.documentElement.getAttribute('data-theme'), false);
    haltSearch();
    recompute();
    drawBoard();
    syncSettingsUI();
    schedule(200);
    toast(T('tReset'));
  });
  $('btnSettings').addEventListener('click', () => {
    syncSettingsUI();
    renderDebug();
    settingsDlg.showModal();
  });
}

/* ============================================================ board interaction */
function pointFromEvent(e) {
  const rect = board.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width * geo.px;
  const cell = geo.cell;
  const x = Math.round((px - geo.pad) / cell);
  const y = Math.round(((e.clientY - rect.top) / rect.height * geo.px - geo.pad) / cell);
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
  return { x, y };
}

let press = null;
let lpTimer = 0;
let hoverRaf = 0;

function initBoardEvents() {
  board.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (S.moves.length) undoMove();
  });

  board.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'touch') {
      press = { x: e.clientX, y: e.clientY, long: false };
      clearTimeout(lpTimer);
      lpTimer = setTimeout(() => {
        if (!press) return;
        press.long = true;
        suppressNextTap = true;
        if (S.moves.length) undoMove();
        if (navigator.vibrate) { try { navigator.vibrate(18); } catch (err) {} }
      }, 560);
    }
  });

  board.addEventListener('pointermove', (e) => {
    if (press && e.pointerType === 'touch') {
      if (Math.abs(e.clientX - press.x) > 9 || Math.abs(e.clientY - press.y) > 9) {
        clearTimeout(lpTimer);
      }
    }
    if (e.pointerType !== 'touch') {
      const p = pointFromEvent(e);
      if (p && (!S.hover || S.hover.x !== p.x || S.hover.y !== p.y)) {
        S.hover = p;
        if (!hoverRaf) {
          hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; drawBoard(); });
        }
      }
    }
  });

  board.addEventListener('pointerleave', () => { S.hover = null; drawBoard(); });

  board.addEventListener('pointerup', (e) => {
    clearTimeout(lpTimer);
    if (press && press.long) { press = null; suppressNextTap = false; return; }
    if (press) press = null;
    if (suppressNextTap) { suppressNextTap = false; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = pointFromEvent(e);
    if (!p) return;
    if (!canPlace(p.x, p.y)) {
      if (S.settings.rule === 2 && sideToMove() === 1 && !stoneAt(p.x, p.y) && !S.winner) toast(T('tForbidden'));
      return;
    }
    S.hover = null;
    commitMove(p.x, p.y, {});
  });

  board.addEventListener('pointercancel', () => {
    clearTimeout(lpTimer);
    press = null;
    suppressNextTap = false;
  });

  board.addEventListener('click', (e) => {
    // click is only used for accessibility; placing already happened on pointerup
    e.preventDefault();
  }, { passive: false });
}

/* ============================================================ boot */
function initToasts() {
  // no-op: toast function is global below
}

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (navigator.serviceWorker.controller) return;
    // First install: the page needs one reload to be served with COOP/COEP.
    let done = false;
    try { done = sessionStorage.getItem(RELOAD_KEY) === ENGINE_VERSION; } catch (e) {}
    if (done) return;
    try { sessionStorage.setItem(RELOAD_KEY, ENGINE_VERSION); } catch (e) {}
    const reload = () => { if (!navigator.serviceWorker.controller) location.reload(); };
    reg.addEventListener('updatefound', reload);
    navigator.serviceWorker.addEventListener('controllerchange', reload);
    setTimeout(reload, 1200);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    if (!isolated()) location.reload();
  });
}

function initCanvas() {
  bctx = board.getContext('2d');
  cctx = curve.getContext('2d');
  const ro = new ResizeObserver(() => {
    measureBoard();
  });
  ro.observe(document.querySelector('.board-shell'));
  window.addEventListener('resize', () => measureBoard());
  if (window.matchMedia) {
    try {
      const mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
      if (mq.addEventListener) mq.addEventListener('change', () => measureBoard());
    } catch (e) {}
  }
}

function initHeaderEvents() {
  $('btnAIB').addEventListener('click', () => toggleAI(1));
  $('btnAIW').addEventListener('click', () => toggleAI(2));
  $('btnAnalysis').addEventListener('click', toggleAnalysis);
  $('btnBalance').addEventListener('click', clickBalance);
  $('balCount').addEventListener('click', cycleBalPoints);
  $('langBtn').addEventListener('click', () => applyLang(LANG === 'en' ? 'zh' : 'en'));
  $('btnUndo').addEventListener('click', undoMove);
  $('btnRedo').addEventListener('click', redoMove);
  $('btnRestart').addEventListener('click', () => restartGame(false));
  $('btnCopy').addEventListener('click', async () => {
    const txt = formatCode();
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      toast(T('tCopied'));
    } catch (e) {
      codeInput.select();
      toast(T('tManualCopy'));
    }
  });
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyCode(codeInput.value); codeInput.blur(); }
  });
  codeInput.addEventListener('change', () => applyCode(codeInput.value));
  /* pasting a position loads it straight away — no extra key press */
  codeInput.addEventListener('paste', () => setTimeout(() => applyCode(codeInput.value), 0));
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoMove(); else undoMove();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redoMove();
    }
  });
}

function initLoadbar() {
  loadbar.classList.add('on');
  const i = loadbar.querySelector('i');
  i.style.width = '12%';
  let w = 12;
  const timer = setInterval(() => {
    if (!S.engineReady) { w = Math.min(90, w + 4); i.style.width = w + '%'; }
    else clearInterval(timer);
  }, 260);
}

function boot() {
  initTheme();
  let savedLang = '';
  try { savedLang = localStorage.getItem(LANG_KEY) || ''; } catch (e) {}
  applyLang(savedLang || (/^en/i.test(navigator.language || '') ? 'en' : 'zh'));
  initCanvas();
  initSettingsEvents();
  initHeaderEvents();
  initBoardEvents();
  initServiceWorker();
  initLoadbar();
  recompute();
  measureBoard();
  drawCurve();
  writeStats();
  updateAll();
  bootEngine();
  // surface isolation state for QA / debugging
  window.MG = {
    S, geo,
    metrics: () => ({
      dpr: DPR,
      css: geo.css,
      px: geo.px,
      cellCss: geo.cell / DPR,
      padCss: geo.pad / DPR,
      coordGapCss: (geo.cell * 0.7) / DPR,
      boardSpanCss: (geo.cell * 14) / DPR,
      shell: document.querySelector('.board-shell').getBoundingClientRect().width,
      canvas: board.getBoundingClientRect().width,
      leftSpace: board.getBoundingClientRect().left - document.querySelector('.board-shell').getBoundingClientRect().left,
      rightSpace: document.querySelector('.board-shell').getBoundingClientRect().right - board.getBoundingClientRect().right,
      isolated: isolated(),
      build: S.engineBuild,
      threads: S.engineThreads,
      rules: RULES.map((r) => r.name),
    }),
    undo: undoMove,
    redo: redoMove,
    restart: () => restartGame(true),
    place: (x, y) => commitMove(x, y, {}),
    startAnalysis: () => { if (!S.analysis) toggleAnalysis(); },
    stopAnalysis: () => { if (S.analysis) toggleAnalysis(); },
    setRule: (r) => setSetting('rule', r),
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

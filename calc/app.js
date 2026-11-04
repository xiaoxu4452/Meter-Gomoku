'use strict';

/* ============================================================ constants */
const SIZE = 15;
const LETTERS = 'ABCDEFGHIJKLMNO';
const ENGINE_VERSION = '20261104e';
const SETTINGS_KEY = 'mgcalc.settings.v1';
const THEME_KEY = 'mgcalc.theme';
const RELOAD_KEY = 'mgcalc.isolation.reload';
/* keeps the 41 MB package across UI releases — must match sw.js */
const ENGINE_CACHE = 'mgcalc-engine-20261105c';
/* Versioned weight/wasm URLs: a new release asks for new cache keys, so the
   Cache API can answer first (stale copies are never served) and the browser
   may also keep them as immutable long-lived entries. The JS entry stays plain:
   Emscripten derives its pthread worker URL from it. */
const ENGINE_VER = 'v=' + ENGINE_VERSION;
const ENGINE_FILES = {
  multi: { js: 'engine/rapfi-multi-simd128.js', wasm: 'engine/rapfi-multi-simd128.wasm?' + ENGINE_VER, data: 'engine/rapfi.data?' + ENGINE_VER },
  single: { js: 'engine/rapfi-single-simd128.js', wasm: 'engine/rapfi-single-simd128.wasm?' + ENGINE_VER, data: 'engine/rapfi.data?' + ENGINE_VER },
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
    playOne: '计算一手',
    depth: '深度', speed: '速度', nodes: '节点', time: '用时',
    codeTitle: '局面代码', codeHint: '列字母+行号 / 坐标', codeAltLabel: '坐标',
    codePlaceholder: '例如 h8h9g7f7 或 7,7 8,8',
    routeTitle: '分析路线', routeEmpty: '点击「计算分析」查看最佳路线', routeNone: '（无路线）',
    winTitle: '胜率',
    curveTitle: '评估曲线', black: '黑', white: '白', curveEmpty: '开始分析后显示评估',
    foot: 'Rapfi NNUE 引擎 · 全部计算在本机浏览器完成',
    settings: '设置', close: '关闭', copy: '复制',
    rule0: '无禁手', rule1: '长连不赢', rule2: '连珠禁手',
    think: '思考时间', thinkHint: '每次计算分析的时长',
    custom: '自定义', secUnit: '秒', apply: '应用',
    stoneStyle: '棋子样式', stoneStyleHint: '仿真 / 扁平两档，与桌面训练器一致',
    stoneFlat: '扁平', stoneReal: '仿真',
    boardColor: '棋盘颜色', boardColorHint: '15 种预置色调，盘线随底色自动配深',
    showNum: '显示手数', showNumHint: '在棋子上标出第几手，最后一手标红', on: '开', off: '关',
    rule: '规则', hash: '哈希表大小（MB）', hashHint: '引擎置换表，单位 MB，越大越省重复计算',
    pointsLabel: '分析点数', pointsHint: '最多显示几个候选（1–8），相邻点只留较强的一个',
    threads: '线程数', range: '选点范围', rangeHint: '引擎候选点筛选的谨慎程度',
    threadSingle: '未隔离，仅单线程可用', threadHintT: '硬件 {hc} 线程，可用上限 {max}',
    theme: '主题', themeLight: '浅色', themeDark: '深色', themeSystem: '跟随系统', themeHint: '深浅色立即生效，并记住你的选择',
    langLabel: '语言', langHint: '切换后整页文案立即更新',
    grpLook: '外观与语言', grpBoard: '棋盘与棋子', grpRule: '对局规则', grpEngine: '引擎与搜索', grpDebug: '诊断', grpMore: '更多',
    desktopLink: '桌面软件 / 官网', desktopLinkHint: '下载桌面版，或查看项目主页',
    aboutLink: '关于', aboutLinkHint: '版本、规则、快捷键与致谢',
    transform: '变换', transformTitle: '变换局面', tipTransform: '按对称或平移改变当前局面',
    xfRot: '旋转 90°', xfFlipH: '左右翻转', xfFlipV: '上下翻转', xfDiag: '主对角', xfAnti: '副对角',
    xfLeft: '左移', xfRight: '右移', xfUp: '上移', xfDown: '下移',
    xfHint: '按对称性改变局面；手数与先后手保留，分析结果会按新局面重算',
    tTransformed: '局面已变换（第 {n} 手位置同步）', tXfEmpty: '空盘不需要变换', tXfNoRoom: '该方向已贴边，无法继续平移',
    evalBlack: '黑子', evalWhite: '白子',
    reset: '恢复默认参数', done: '完成',
    engineLoading: '引擎加载中', engineReady: '引擎就绪', engineSingle: '单线程', engineErr: '引擎异常',
    engineIdle: '引擎待命 · 按需加载',
    engineMulti: '多线程 {n} 线程', engineExit: '引擎退出',
    stIdle: '等待', stSearching: '搜索中', stBal: '平衡点搜索中', stAi: 'AI 思考中', stMove: '计算一手',
    stStopped: '已停止', stWinB: '黑方获胜', stWinW: '白方获胜',
    balSearching: '平衡点搜索中，深度增加后自动修正…', balNotFound: '本局面未找到平衡点',
    balEmpty: '引擎未返回平衡点（可能已分胜负）',
    balWindowIn: '在官方平衡窗口内', balWindowOut: '已超出平衡窗口（最接近均势）',
    tCopied: '局面代码已复制', tManualCopy: '请手动复制', tLoaded: '已载入 {n} 手', tBadCode: '局面代码无法识别',
    tRestartConfirm: '再点一次「重开一局」确认', tRestarted: '已重新开局', tUndo: '已撤回 {p}',
    tWinB: '黑方获胜', tWinW: '白方获胜', tForbidden: '黑方禁手点，不能落子',
    tNoEngine: '引擎加载中，请稍候', tGameOver: '对局已结束，请重开一局', tNoBalance: '空盘没有稳定的平衡点（需开局库），请先落子',
    tEngineLazy: '正在按需加载引擎，就绪后自动开始…',
    tBalOn: '平衡点：{n} 个点 · 再按一次落子', tBalRunning: '平衡点计算中，请稍候…',
    tBalPlayed: '已在平衡点落子 {p}', tBalOff: '平衡点已关闭', tBalNone: '没有可用的平衡点',
    tAiOn: 'AI 执{n}已开启', tAiOff: 'AI 执{n}已关闭', tBlack: '黑', tWhite: '白',
    tThinking: 'AI 执{n}思考中', tThinkSet: '思考时间已设为 {n} 秒',
    tHashSet: '哈希表已设为 {n} MB', tThreadSet: '线程数已设为 {n}', tRuleSet: '规则已切换为「{n}」',
    tReset: '已恢复默认参数', tStoneSet: '棋子样式：{n}', tNumOn: '已显示手数', tNumOff: '已隐藏手数',
    tBoardSet: '棋盘颜色：{n}',
    tBalPoints: '平衡点点数：{n}', tBalanceNoResult: '还没有平衡点结果',
    tHashClamp: '哈希表超过引擎上限 {n} MB，已自动收敛',
    tFallback: '多线程不可用，已降级为单线程模式',
    tEngineRebuilt: '引擎无响应，已自动重启（局面保留）',
    tEngineLoop: '引擎连续异常，已暂停分析',
    toLight: '切换到浅色模式', toDark: '切换到深色模式',
    tipUndo: '上一步（棋盘右键 / 长按也可撤回）', tipRedo: '下一步', tipRestart: '清空棋盘并重置引擎',
    tipAiB: '让引擎执黑，可同时开启黑白', tipAiW: '让引擎执白，可同时开启黑白',
    tipAnalysis: '开始 / 停止计算分析', tipBalance: '第一次点：计算平衡点；再点一次：在平衡点落子',
    tipBalCount: '平衡点要给出的点数（1 或 2）', tipEngine: '计算引擎状态', tipCopy: '复制局面代码',
    tipPlay: '让引擎计算一手并直接落子',
    tOnePlayed: '引擎已落子 {p}', tBalPlayedPair: '已在两个平衡点同时落子 {a} / {b}',
    tBalOnlyTwo: '点数只能是 1 或 2', tThinkingOne: '引擎正在计算一手…',
    loadTitle: '正在加载引擎', loadFetch: '下载引擎与权重（约 41 MB）…',
    loadModule: '初始化推理模块…', loadStart: '启动搜索线程…', loadDone: '引擎就绪',
    loadCached: '读取本机缓存的引擎文件…', loadNote: 'Rapfi NNUE · WebAssembly',
    loadCold: '首次打开：先准备好离线缓存…',
    retry: '重试', altCalc: '用官方计算器',
    loadFail: '引擎加载失败', loadSlow: '下载卡住了',
    loadFailMsg: '所有线路都没连上，可以重试，或先用官方计算器',
  },
  en: {
    title: 'Gomoku Calculator', subtitle: 'Meter Gomoku · Web',
    undo: 'Undo', redo: 'Redo', restart: 'New game', restartConfirm: 'Confirm',
    aiB: 'AI black', aiW: 'AI white', analysis: 'Analyse', analysisStop: 'Stop & play', balance: 'Balance', points: 'pt',
    playOne: 'Play one',
    depth: 'Depth', speed: 'Speed', nodes: 'Nodes', time: 'Time',
    codeTitle: 'Position code', codeHint: 'letters + number, or x,y', codeAltLabel: 'coords',
    codePlaceholder: 'e.g. h8h9g7f7 or 7,7 8,8',
    routeTitle: 'Main line', routeEmpty: 'Press Analyse to see the best line', routeNone: '(no line)',
    winTitle: 'Win rate',
    curveTitle: 'Eval curve', black: 'B', white: 'W', curveEmpty: 'Analysis will draw the curve here',
    foot: 'Rapfi NNUE engine · everything runs locally in this browser',
    settings: 'Settings', close: 'Close', copy: 'Copy',
    rule0: 'Freestyle', rule1: 'No overline win', rule2: 'Renju',
    think: 'Think time', thinkHint: 'Time budget for each search',
    custom: 'Custom', secUnit: 's', apply: 'Apply',
    stoneStyle: 'Stone style', stoneStyleHint: 'Realistic or flat, matching the desktop trainer',
    stoneFlat: 'Flat', stoneReal: 'Realistic',
    boardColor: 'Board colour', boardColorHint: '15 presets — the grid darkens to suit each tone',
    showNum: 'Move numbers', showNumHint: 'Print the move number on each stone; the last one turns red', on: 'On', off: 'Off',
    rule: 'Rule', hash: 'Hash size (MB)', hashHint: 'Transposition table in MB — larger saves more re-search',
    pointsLabel: 'Multi-PV', pointsHint: 'Up to 1–8 candidates; of two neighbouring points only the stronger is drawn',
    threads: 'Threads', range: 'Move range', rangeHint: 'How cautious the candidate filter is',
    threadSingle: 'Not isolated — single thread only', threadHintT: 'Hardware {hc} threads, up to {max}',
    theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System', themeHint: 'Applies instantly and is remembered',
    langLabel: 'Language', langHint: 'Every label on the page switches at once',
    grpLook: 'Appearance & language', grpBoard: 'Board & stones', grpRule: 'Game rule', grpEngine: 'Engine & search', grpDebug: 'Diagnostics', grpMore: 'More',
    desktopLink: 'Desktop app / website', desktopLinkHint: 'Download the desktop build or visit the project page',
    aboutLink: 'About', aboutLinkHint: 'Version, rules, shortcuts and credits',
    transform: 'Transform', transformTitle: 'Transform position', tipTransform: 'Rotate, flip or shift the position',
    xfRot: 'Rotate 90°', xfFlipH: 'Flip H', xfFlipV: 'Flip V', xfDiag: 'Main diag.', xfAnti: 'Anti diag.',
    xfLeft: 'Shift left', xfRight: 'Shift right', xfUp: 'Shift up', xfDown: 'Shift down',
    xfHint: 'Changes the position by symmetry; move order and sides are kept, analysis restarts on the new position',
    tTransformed: 'Position transformed (last move moved too)', tXfEmpty: 'Nothing to transform on an empty board', tXfNoRoom: 'Already touching that edge — cannot shift further',
    evalBlack: 'Black', evalWhite: 'White',
    reset: 'Reset defaults', done: 'Done',
    engineLoading: 'Loading engine', engineReady: 'Engine ready', engineSingle: 'single thread', engineErr: 'Engine error',
    engineIdle: 'Engine idle · loads on demand',
    engineMulti: '{n} threads', engineExit: 'Engine exited',
    stIdle: 'Idle', stSearching: 'Searching', stBal: 'Balancing', stAi: 'AI thinking', stMove: 'Playing one',
    stStopped: 'Stopped', stWinB: 'Black wins', stWinW: 'White wins',
    balSearching: 'Scanning for balance points, refining as depth grows…', balNotFound: 'No balance point in this position',
    balEmpty: 'The engine returned no balance point (a win may be decided)',
    balWindowIn: 'inside the official balance window', balWindowOut: 'outside the window (closest to even)',
    tCopied: 'Position code copied', tManualCopy: 'Copy it manually', tLoaded: 'Loaded {n} moves', tBadCode: 'Unrecognised position code',
    tRestartConfirm: 'Press "New game" again to confirm', tRestarted: 'New game started', tUndo: 'Took back {p}',
    tWinB: 'Black wins', tWinW: 'White wins', tForbidden: 'Forbidden point for Black',
    tNoEngine: 'The engine is still loading', tGameOver: 'Game over — start a new game',
    tNoBalance: 'An empty board has no stable balance point — play a stone first',
    tEngineLazy: 'Loading the engine on demand — it starts on its own when ready…',
    tBalOn: 'Balance: {n} point(s) · press again to play it', tBalRunning: 'Computing balance points, one moment…',
    tBalPlayed: 'Played the balance point {p}', tBalOff: 'Balance off', tBalNone: 'No balance point available',
    tAiOn: 'AI now plays {n}', tAiOff: 'AI stops playing {n}', tBlack: 'black', tWhite: 'white',
    tThinking: 'AI is thinking as {n}', tThinkSet: 'Think time set to {n} s',
    tHashSet: 'Hash table set to {n} MB', tThreadSet: 'Threads set to {n}', tRuleSet: 'Rule switched to "{n}"',
    tReset: 'Defaults restored', tStoneSet: 'Stone style: {n}', tNumOn: 'Move numbers on', tNumOff: 'Move numbers off',
    tBoardSet: 'Board colour: {n}',
    tBalPoints: 'Balance points: {n}', tBalanceNoResult: 'No balance result yet',
    tHashClamp: 'Hash clamped to the engine limit of {n} MB',
    tFallback: 'Multi-threading unavailable — running single-threaded',
    tEngineRebuilt: 'The engine stopped responding — restarted, position kept',
    tEngineLoop: 'The engine failed repeatedly — analysis paused',
    toLight: 'Switch to light mode', toDark: 'Switch to dark mode',
    tipUndo: 'Undo (right click / long press also works)', tipRedo: 'Redo', tipRestart: 'Clear the board and reset the engine',
    tipAiB: 'Let the engine play black; both sides can be on at once', tipAiW: 'Let the engine play white; both sides can be on at once',
    tipAnalysis: 'Start / stop the analysis', tipBalance: 'First press: compute balance points; second press: play one',
    tipBalCount: 'How many balance points to ask for (1 or 2)', tipEngine: 'Engine status', tipCopy: 'Copy the position code',
    tipPlay: 'Let the engine compute one move and play it',
    tOnePlayed: 'The engine played {p}', tBalPlayedPair: 'Played both balance points: {a} / {b}',
    tBalOnlyTwo: 'Balance points can only be 1 or 2', tThinkingOne: 'The engine is computing one move…',
    loadTitle: 'Loading the engine', loadFetch: 'Downloading engine and weights (~41 MB)…',
    loadModule: 'Starting the inference module…', loadStart: 'Starting search threads…', loadDone: 'Engine ready',
    loadCached: 'Reading the cached engine files…', loadNote: 'Rapfi NNUE · WebAssembly',
    loadCold: 'First visit: preparing the offline cache…',
    retry: 'Retry', altCalc: 'Official calculator',
    loadFail: 'The engine failed to load', loadSlow: 'The download stalled',
    loadFailMsg: 'No route answered — retry, or use the official calculator for now',
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


/* 15 ready-made board palettes: wood tones first, then three neutral ones.
   `line` is the grid colour and `coord` the label colour, both picked so the
   grid stays readable on its own wood tone. */
const BOARD_SKINS = [
  { id: 'classic',  zh: '原木', en: 'Classic wood', board: '#e9d6b0', line: '#4a4438', coord: '#5c5140' },
  { id: 'oak',      zh: '浅栎', en: 'Pale oak',     board: '#eddfc0', line: '#4f4a3a', coord: '#625b47' },
  { id: 'cream',    zh: '米白', en: 'Cream',        board: '#f3e8cf', line: '#55503f', coord: '#6a6350' },
  { id: 'bamboo',   zh: '竹青', en: 'Bamboo',       board: '#dcd8b2', line: '#4b5240', coord: '#5d654e' },
  { id: 'beech',    zh: '榉木', en: 'Beech',        board: '#e5c99e', line: '#51422c', coord: '#66543a' },
  { id: 'honey',    zh: '蜜蜡', en: 'Honey',        board: '#e2bb7d', line: '#55401f', coord: '#6b5330' },
  { id: 'amber',    zh: '琥珀', en: 'Amber',        board: '#d8a768', line: '#4f3717', coord: '#684a25' },
  { id: 'walnut',   zh: '胡桃', en: 'Walnut',       board: '#c69a6a', line: '#4a321a', coord: '#614227' },
  { id: 'teak',     zh: '柚木', en: 'Teak',         board: '#b07a52', line: '#3f2715', coord: '#573820' },
  { id: 'rosewood', zh: '红木', en: 'Rosewood',     board: '#a9694a', line: '#3c1f14', coord: '#522e1e' },
  { id: 'espresso', zh: '深棕', en: 'Espresso',     board: '#8a5c3e', line: '#2f1a10', coord: '#45291a' },
  { id: 'forest',   zh: '墨绿', en: 'Forest',       board: '#7f8f6d', line: '#26301f', coord: '#3a4630' },
  { id: 'slate',    zh: '石板', en: 'Slate',        board: '#8d99a3', line: '#22292f', coord: '#333c44' },
  { id: 'celadon',  zh: '青瓷', en: 'Celadon',      board: '#b7cfc0', line: '#35483b', coord: '#48604f' },
  { id: 'indigo',   zh: '黛蓝', en: 'Indigo',       board: '#8b9dc0', line: '#232c3f', coord: '#35405a' },
];
const boardSkin = (id) => BOARD_SKINS.find((s) => s.id === (id || S.settings.board)) || BOARD_SKINS[0];
function hexLum(hex) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
/* stone presets: realistic and flat, mirroring the desktop trainer.
   Both stones carry a matching outer ring — white a fine black one, black a
   fine white one — and the flat ring is drawn at half the former weight, so the
   pair reads evenly on any wood tone without turning into heavy 3-D. The
   realistic preset adds one restrained right-bottom sheen (drawn in
   paintStone); flat stays completely clean. */
const STONES = {
  flat: {
    black: { fill: '#191715', edge: 'rgba(248,246,238,.95)' },
    white: { fill: '#eeeadf', edge: '#171614' },
  },
  real: {
    /* desktop trainer .spf-stones.real, stop for stop */
    black: {
      stops: ['#726d67', '#4a4540', '#241f1b', '#080706'], at: [0, 0.28, 0.68, 1],
      edge: 'rgba(255,255,255,.16)', sheen: 0.16, drop: 0.30,
    },
    white: {
      stops: ['#ffffff', '#f8f3e7', '#e0d9c7', '#b8b1a0'], at: [0, 0.28, 0.68, 1],
      edge: 'rgba(120,112,98,.55)', sheen: 0.55, drop: 0.16,
    },
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
  engineBusy: false,        // a job was dispatched and the worker has not acknowledged the finish yet
  queuedKind: null,         // newest intent that arrived while the engine was busy
  lastEngineMsg: 0,         // timestamp of the last message from the worker
  lastProgress: 0,          // last time depth/nodes actually moved
  lastProgressNodes: 0,
  recovering: false,        // worker is being rebuilt
  recoveries: [],           // timestamps, used to stop an endless crash loop
  stopGuard: 0,
  stopSent: false,
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
  searchT0: 0,              // when the running search was dispatched
  searchAnswered: false,    // has the engine said anything since?
  worker: null,
  stats: null,
  marks: [],
  forbidden: [],
  balanceMarks: [],
  balanceInfo: null,
  pv: [],                   // main line, used by the hover preview
  preview: null,            // { i } — index in pv being previewed
  oneShot: false,           // the "play one" button is computing a single move
  pendingOne: false,        // "play one" asked before the lazy engine finished booting
  wrGame: { value: 0.5, track: [0.5] },   // black-perspective win rate, kept for the whole game
  hover: null,
  anim: null,
  lastAiMove: null,
  settings: loadSettings(),
};

let geo = { css: 0, px: 0, cell: 0, pad: 0, fs: 0 };
let DPR = 1;
/* cold-start numbers, surfaced through MG.perf() for the loading measurements */
const PERF = { boot: performance.now(), usable: 0, prefetch: 0, engineStart: 0, engineReady: 0, firstEval: 0 };
let C = { board: '#e9d6b0', line: '#4a4438', coord: '#5c5140', star: '#4a4438', last: '#d94b3f',
  black: '#14171a', white: '#faf9f5', whiteEdge: 'rgba(0,0,0,.18)' };
let bctx = null;
let restartConfirmTimer = 0;
let suppressNextTap = false;

/* ============================================================ DOM */
const $ = (id) => document.getElementById(id);
const board = $('board');
const codeInput = $('codeInput');
const chip = $('engineChip');
const settingsDlg = $('settings');
const loaderEl = $('loader');

/* ============================================================ boot overlay */
let loaderPct = 0;
let loaderKey = 'loadFetch';
let loaderDone = false;
let loaderError = false;
let loadTick = Date.now();

function paintLoader() {
  if (!loaderEl) return;
  const fill = $('loadFill');
  const pct = $('loadPct');
  if (fill) fill.style.width = Math.max(0, Math.min(100, loaderPct)).toFixed(1) + '%';
  if (pct) pct.textContent = Math.round(loaderPct) + '%';
  const msg = $('loadMsg');
  if (msg && I18N[LANG][loaderKey]) msg.textContent = T(loaderKey);
}

function setLoader(pct, key) {
  loaderPct = Math.max(loaderPct, Math.min(100, pct));
  if (key) loaderKey = key;
  loadTick = Date.now();
  paintLoader();
}

function hideLoader() {
  if (loaderDone) return;
  loaderDone = true;
  setLoader(100, 'loadDone');
  setTimeout(() => { if (loaderEl) loaderEl.classList.add('hidden'); }, 320);
}

/* every route failed (or the download stalled): offer a retry instead of a dead page */
function showLoadError(key, detail) {
  if (loaderDone) return;
  loaderError = true;
  loaderKey = key || 'loadFail';
  paintLoader();
  const msg = $('loadMsg');
  if (msg) msg.textContent = T(loaderKey) + (detail ? ' · ' + detail : '');
  loaderEl.classList.add('error');
  const acts = $('loadActions');
  if (acts) acts.hidden = false;
  chip.textContent = T('engineErr');
  chip.className = 'chip err';
}

function retryLoad() {
  if (S.worker) {
    try { S.worker.terminate(); } catch (e) {}
    S.worker = null;
  }
  loaderError = false;
  loaderDone = false;
  loaderPct = 0;
  loaderKey = 'loadFetch';
  loadTick = Date.now();
  S.engineReady = false;
  S.fallback = false;
  loaderEl.classList.remove('hidden', 'error');
  const acts = $('loadActions');
  if (acts) acts.hidden = true;
  paintLoader();
  engineStarted = true;
  bootEngine();
}

/* ============================================================ settings */
function defaults() {
  return {
    hashMB: 256, points: 3, threads: defaultThreads(), caution: 3, rule: 0, theme: null,
    think: 3000, showNum: true, stone: 'real', balPoints: 1, board: 'classic',
  };
}
function defaultThreads() {
  if (!isolated()) return 1;
  return maxThreads();          // give the engine every thread the browser allows
}
function loadSettings() {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (HASH_OPTIONS.includes(raw.hashMB)) d.hashMB = raw.hashMB;
    if (Number.isFinite(raw.points) && raw.points >= 1 && raw.points <= 8) d.points = raw.points;
    if (Number.isFinite(raw.threads)) d.threads = Math.max(1, Math.min(maxThreads(), raw.threads));
    if (Number.isFinite(raw.caution) && raw.caution >= 1 && raw.caution <= 5) d.caution = raw.caution;
    if (raw.rule === 0 || raw.rule === 1 || raw.rule === 2) d.rule = raw.rule;
    if (raw.theme === 'light' || raw.theme === 'dark') d.theme = raw.theme;
    if (Number.isFinite(raw.think) && raw.think >= 500 && raw.think <= 60000) d.think = raw.think;
    if (raw.showNum === true || raw.showNum === false) d.showNum = raw.showNum;
    if (raw.stone === 'flat' || raw.stone === 'real') d.stone = raw.stone;
    if (BOARD_SKINS.some((s) => s.id === raw.board)) d.board = raw.board;
    if (Number.isFinite(raw.balPoints) && raw.balPoints >= 1 && raw.balPoints <= 2) d.balPoints = raw.balPoints;
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
  C = themeColor();
  try {
    if (remember) {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
      localStorage.setItem('mg.site.theme', dark ? 'dark' : 'light');
    }
  } catch (e) {}
  syncThemeSeg();
  drawBoard();
}
function systemDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY) || localStorage.getItem('mg.site.theme'); } catch (e) {}
  S.settings.theme = saved === 'light' || saved === 'dark' ? saved : null;
  applyTheme(saved || (systemDark() ? 'dark' : 'light'), false);
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (S.settings.theme) return;
      applyTheme(mq.matches ? 'dark' : 'light', false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  /* the site, docs and about page share the same theme keys: follow their edits live */
  window.addEventListener('storage', (e) => {
    if (e.key !== THEME_KEY && e.key !== 'mg.site.theme') return;
    let v = '';
    try { v = localStorage.getItem(THEME_KEY) || localStorage.getItem('mg.site.theme') || ''; } catch (err) {}
    const explicit = v === 'light' || v === 'dark' ? v : null;
    S.settings.theme = explicit;
    applyTheme(explicit || (systemDark() ? 'dark' : 'light'), false);
    syncThemeSeg();
  });
  syncThemeSeg();
}

/* ============================================================ geometry / board */
/* The coordinate ring: the row numbers sit 0.4 cell from the frame and are 
   right-aligned against it, so the padding only needs room for the glyphs 
   themselves (~0.6 cell at the 8 px font floor). 0.95 keeps a 320 px phone from
   clipping them while giving the grid ~5% more room than the old 1.32. */
const PAD_CELLS = 0.95;
const BOARD_SPAN = SIZE - 1 + PAD_CELLS * 2;

function themeColor() {
  const sk = boardSkin();
  return {
    board: sk.board, line: sk.line, coord: sk.coord, star: sk.line,
    /* the last-move dot flips to a brighter red on dark wood so it stays visible */
    last: hexLum(sk.board) < 0.55 ? '#ff7a68' : '#d94b3f',
    black: '#14171a', white: '#faf9f5', whiteEdge: 'rgba(0,0,0,.18)',
  };
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
  const fs = Math.max(8 * DPR, cell * 0.32);
  geo = { css, px, cell, pad: cell * PAD_CELLS, fs };
  drawBoard();
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
  const lwDev = Math.max(1, DPR * 0.62);      // hairline grid, thinner than before
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
  /* keep the element background in step with the chosen skin so the rounded
     corners and any sub-pixel gap show the same colour */
  if (board) board.style.background = C.board;

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
  drawPreview();
}

function drawCoords(xs, ys, pad, cell) {
  // The column letters sit under the board, the row numbers keep to the left
  // edge. Both use the same 0.7-cell whitespace from the frame (inner text edge
  // to the outer rule), which is what PAD_CELLS below is sized for.
  const gap = cell * 0.40;
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
function stoneRadius() { return geo.cell * 0.485; }

/* paint one stone with the style picked in the settings.
   Both presets are copied from the desktop trainer (#spf-stones):
     flat  solid disc + half-pixel hairline (white gets black, black gets white)
     real  radial-gradient(circle at 32% 28%) with the desktop 4-stop body,
           one inset top light and a small drop shadow                    */
function paintStone(cx, cy, r, c) {
  const real = S.settings.stone === 'real';
  const preset = STONES[S.settings.stone] || STONES.real;
  const p = c === 1 ? preset.black : preset.white;

  bctx.save();
  bctx.beginPath();
  bctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (real) {
    /* CSS: 0 .1rem .28rem rgba(0,0,0,d) — cast onto the wood, offset downwards */
    bctx.shadowColor = 'rgba(0,0,0,' + p.drop + ')';
    bctx.shadowBlur = r * 0.30;
    bctx.shadowOffsetY = r * 0.11;
    /* the gradient centre sits at 32% / 28% of the bounding box, and the last
       stop lands on the far corner, exactly like the CSS circle gradient */
    const gx = cx - r * 0.36, gy = cy - r * 0.44;
    const g = bctx.createRadialGradient(gx, gy, 0, gx, gy, r * 1.36);
    p.stops.forEach((col, i) => g.addColorStop(p.at[i], col));
    bctx.fillStyle = g;
  } else {
    bctx.fillStyle = p.fill;
  }
  bctx.fill();
  bctx.restore();

  if (real) {
    /* CSS: inset 0 .08rem .18rem rgba(255,255,255,s) — a narrow top light that
       stops before the middle, so the stone keeps a flat-looking face */
    bctx.save();
    bctx.beginPath();
    bctx.arc(cx, cy, Math.max(1, r - 0.6), 0, Math.PI * 2);
    bctx.clip();
    const lit = bctx.createLinearGradient(cx, cy - r * 1.02, cx, cy - r * 0.28);
    lit.addColorStop(0, 'rgba(255,255,255,' + p.sheen + ')');
    lit.addColorStop(1, 'rgba(255,255,255,0)');
    bctx.fillStyle = lit;
    bctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    bctx.restore();
  }

  bctx.beginPath();
  bctx.arc(cx, cy, r, 0, Math.PI * 2);
  /* flat keeps a half-pixel hairline: white gets a black ring, black gets a
     white one, both at half the weight used before so the disc reads clean */
  bctx.lineWidth = real ? Math.max(0.6, DPR * 1) : Math.max(0.3, DPR * 0.575);
  bctx.strokeStyle = p.edge;
  bctx.stroke();
}

function drawStones() {
  const r = stoneRadius();
  for (let i = 0; i < S.moves.length; i++) {
    const m = S.moves[i];
    const cx = snapDev(geo.pad + m.x * geo.cell);
    const cy = snapDev(geo.pad + m.y * geo.cell);
    const isLast = i === S.moves.length - 1;
    paintStone(cx, cy, r, m.c);

    if (S.settings.showNum) {
      // Move number: white digits on black stones, ink digits on white stones.
      // The last move keeps its red mark (as a red number) so it stays obvious.
      const label = String(i + 1);
      const fs = Math.max(7.2 * DPR, geo.cell * 0.44);
      bctx.font = '800 ' + fs + 'px "Cascadia Code",Consolas,monospace';
      /* "middle" centres the em box, not the digits, which leaves 1 and 4
         sitting a hair high. Measure the ink box and put its geometric centre on
         the stone centre instead. */
      bctx.textAlign = 'left';
      bctx.textBaseline = 'alphabetic';
      const tm = bctx.measureText(label);
      const iAsc = tm.actualBoundingBoxAscent || fs * 0.72;
      const iDesc = tm.actualBoundingBoxDescent || 0;
      const iL = tm.actualBoundingBoxLeft || 0;
      const iR = tm.actualBoundingBoxRight || tm.width;
      const nx = cx - (iR - iL) / 2;
      const ny = cy + (iAsc - iDesc) / 2;
      bctx.lineWidth = Math.max(0.9 * DPR, fs * 0.12);
      bctx.strokeStyle = isLast
        ? (m.c === 1 ? 'rgba(20,8,6,.55)' : 'rgba(255,246,236,.85)')
        : (m.c === 1 ? 'rgba(0,0,0,.42)' : 'rgba(255,255,255,.70)');
      bctx.strokeText(label, nx, ny);
      bctx.fillStyle = isLast ? '#e5402f' : (m.c === 1 ? '#f7f3e8' : '#201d18');
      bctx.fillText(label, nx, ny);
    } else if (isLast) {
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
  /* one full cell across, as requested — the ring now spans the intersection */
  return geo.cell * 0.5;
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
  /* while a line preview is on, the candidate circles fade back so the
     foreshadowed stones stay readable */
  const baseAlpha = S.preview ? 0.32 : 1;
  const r = markerRadius();
  const ringW = Math.max(1.6 * DPR, geo.cell * 0.055);
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  marks.slice(0, 8).forEach((mk) => {
    bctx.globalAlpha = baseAlpha;
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

    // upper half = winrate, lower half = score; both fill the ring edge to edge
    const pct = Math.round((mk.wr == null ? 0.5 : mk.wr) * 100);
    const top = String(Math.max(0, Math.min(100, pct))) + '%';
    const bottom = mk.evTxt || (mk.ev == null ? '–' : (mk.ev >= 0 ? '+' : '') + Math.round(mk.ev));
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    const ink = dark ? '#f4f9ff' : '#0d2028';
    const halo = dark ? 'rgba(6,16,26,.80)' : 'rgba(255,255,255,.90)';

    const hip = cy - r * 0.32;
    const sizeTop = fitFont(top, r * 1.74, r * 0.76, 6 * DPR);
    bctx.font = '700 ' + sizeTop + 'px "Cascadia Code",Consolas,monospace';
    bctx.lineWidth = Math.max(1 * DPR, sizeTop * 0.16);
    bctx.strokeStyle = halo;
    bctx.strokeText(top, cx, hip);
    bctx.fillStyle = ink;
    bctx.fillText(top, cx, hip);

    const lop = cy + r * 0.32;
    const sizeBot = fitFont(bottom, r * 1.74, r * 0.70, 5.5 * DPR);
    bctx.font = '700 ' + sizeBot + 'px "Cascadia Code",Consolas,monospace';
    bctx.lineWidth = Math.max(1 * DPR, sizeBot * 0.16);
    bctx.strokeStyle = halo;
    bctx.strokeText(bottom, cx, lop);
    bctx.fillStyle = ink;
    bctx.fillText(bottom, cx, lop);

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
  bctx.globalAlpha = 1;
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

/* Hovering a move in the analysed line foreshadows the stones that follow,
   the way gomocalc previews the continuation. */
function drawPreview() {
  if (!S.preview || !S.pv.length) return;
  const upto = Math.max(0, Math.min(S.preview.i, S.pv.length - 1));
  const r = stoneRadius() * 0.94;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  for (let i = 0; i <= upto; i++) {
    const p = S.pv[i];
    if (stoneAt(p.x, p.y)) continue;
    const cx = snapDev(geo.pad + p.x * geo.cell);
    const cy = snapDev(geo.pad + p.y * geo.cell);
    const hot = i === upto;
    bctx.globalAlpha = hot ? 0.96 : 0.5;
    paintStone(cx, cy, r, p.c);
    bctx.globalAlpha = hot ? 1 : 0.8;
    const fs = Math.max(6.5 * DPR, geo.cell * 0.36);
    bctx.font = '700 ' + fs + 'px "Cascadia Code",Consolas,monospace';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillStyle = p.c === 1 ? 'rgba(246,243,234,.96)' : 'rgba(30,27,22,.92)';
    bctx.fillText(String(i + 1), cx, cy + fs * 0.04);
    bctx.globalAlpha = 1;
  }
  const last = S.pv[upto];
  const cx = snapDev(geo.pad + last.x * geo.cell);
  const cy = snapDev(geo.pad + last.y * geo.cell);
  bctx.setLineDash([3.2 * DPR, 2.4 * DPR]);
  bctx.lineWidth = Math.max(1.6 * DPR, geo.cell * 0.05);
  bctx.strokeStyle = dark ? 'rgba(255,255,255,.92)' : 'rgba(26,32,40,.9)';
  bctx.beginPath();
  bctx.arc(cx, cy, r + geo.cell * 0.12, 0, Math.PI * 2);
  bctx.stroke();
  bctx.setLineDash([]);
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
  const build = S.fallback ? 'single' : (isolated() ? 'multi' : 'single');
  S.engineBuild = build;
  S.engineThreads = build === 'multi' ? S.settings.threads : 1;
  S.engineBusy = false;
  S.queuedKind = null;
  S.lastEngineMsg = Date.now();
  enginePost({
    t: 'init',
    build,
    urls: ENGINE_FILES[build === 'multi' ? 'multi' : 'single'],
    threads: S.engineThreads,
    hashMB: S.settings.hashMB,
    caution: S.settings.caution,
    rule: S.settings.rule,
    cacheName: ENGINE_CACHE,
  });
}

/* The worker can die (OOM after a very deep search, an aborted pthread pool, a
   frozen tab). Rebuild it without touching the position: flags survive, the next
   search re-sends the board, and the last numbers stay on screen. */
function rebuildWorker(reason) {
  if (!engineStarted || S.recovering) return;
  const now = Date.now();
  S.recoveries = S.recoveries.filter((t) => now - t < 30000);
  if (S.recoveries.length >= 3) {
    /* three rebuilds in half a minute: stop looping and let the user decide */
    S.analysis = false;
    S.balance = 0;
    S.searching = false;
    S.engineBusy = false;
    chip.textContent = T('engineErr');
    chip.className = 'chip err';
    toast(T('tEngineLoop'));
    return;
  }
  S.recoveries.push(now);
  S.recovering = true;
  S.engineReady = false;
  S.engineBusy = false;
  S.searching = false;
  S.searchKind = null;
  clearTimeout(S.stopGuard);
  try { if (S.worker) S.worker.terminate(); } catch (e) {}
  S.worker = null;
  chip.textContent = T('engineLoading');
  chip.className = 'chip warn';
  toast(T('tEngineRebuilt'));
  if (window.console) console.warn('[engine] worker rebuilt:', reason);
  setTimeout(() => bootEngine(), 0);
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
  S.engineBusy = false;
  S.lastEngineMsg = Date.now();
  enginePost({
    t: 'init', build: 'single', urls: ENGINE_FILES.single,
    threads: 1, hashMB: S.settings.hashMB, caution: S.settings.caution, rule: S.settings.rule, cacheName: ENGINE_CACHE,
  });
  return true;
}
/* The engine and its 41 MB weight package are loaded on demand: the shell paints
   immediately and only a search (analyse / balance / a move that needs AI)
   triggers the download. Until then the page is fully usable.
   ?eager=1 keeps the old always-load behaviour for A/B timing. */
let engineStarted = false;
const EAGER = /[?&]eager=1/i.test(location.search);

function ensureEngine() {
  if (engineStarted) return S.engineReady;
  engineStarted = true;
  PERF.engineStart = performance.now();
  loaderError = false;
  loaderDone = false;
  loaderPct = 0;
  loaderKey = 'loadFetch';
  if (EAGER) {
    loaderEl.classList.remove('lazy', 'hidden', 'error');
  } else {
    /* non-blocking: the same card becomes a small status pill in the corner */
    loaderEl.classList.add('lazy');
    loaderEl.classList.remove('hidden', 'error');
  }
  chip.textContent = T('engineLoading');
  chip.className = 'chip warn';
  paintLoader();
  bootEngine();
  return false;
}

function initEngineMode() {
  if (EAGER) {
    ensureEngine();
    return;
  }
  chip.textContent = T('engineIdle');
  chip.className = 'chip';
  loaderEl.classList.add('hidden');
}

/* Quiet pre-start: once the shell is interactive, the worker + pthread pool +
   weights are fetched during idle time, so the first click usually finds the
   engine already warm. A hover / touch on any engine button pulls it forward
   one step further. Nothing blocks the UI; the status pill stays unobtrusive. */
function prefetchEngine() {
  if (EAGER || engineStarted) return;
  try {
    if (navigator.connection && navigator.connection.saveData) return;
  } catch (e) {}
  PERF.prefetch = performance.now();
  ensureEngine();
}
function schedulePrefetch() {
  if (EAGER || engineStarted) return;
  /* gomocalc starts the engine straight after first paint and never blocks the
     board. Waiting for an idle slot (up to 1.2 s) was the main reason the engine
     still felt cold when the user tapped a stone. */
  const run = () => { if (!engineStarted) prefetchEngine(); };
  if (window.requestAnimationFrame) requestAnimationFrame(() => requestAnimationFrame(run));
  else setTimeout(run, 60);
}
function prewarmEngine() {
  if (!engineStarted) prefetchEngine();
}

/* does anything currently need the engine? */
function engineWanted() {
  if (S.analysis || S.balance || S.pendingOne) return true;
  const side = sideToMove();
  return !!(side === 1 ? S.aiB : S.aiW);
}
function ensureEngineIfWanted() {
  if (!S.engineReady && engineWanted()) { ensureEngine(); return true; }
  return false;
}

function onEngineMessage(ev) {
  const d = ev.data || {};
  S.lastEngineMsg = Date.now();
  S.msgRing = S.msgRing || [];
  S.msgRing.push((d.t || '?') + (d.gen != null ? ':' + d.gen : ''));
  if (S.msgRing.length > 40) S.msgRing.shift();
  if (d.t === 'load') {
    setLoader(d.pct, d.key);
    return;
  }
  if (d.t === 'hb') {
    /* the worker's own heartbeat: proof that a deep search is alive even when a
       single iteration takes longer than the watchdog window */
    if ((d.search || d.balance) && (d.nodes > S.lastProgressNodes)) {
      S.lastProgressNodes = d.nodes || 0;
      S.lastProgress = Date.now();
    }
    /* the engine only prints once per iteration; keep the elapsed clock running
       between two PV lines so the panel never looks frozen at depth 20+ */
    if (S.searching && S.stats && S.searchT0) {
      const el = Date.now() - S.searchT0;
      if (el > (S.stats.time || 0) + 600) { S.stats.time = el; writeStats(); }
    }
    return;
  }
  if (d.t === 'ready') {
    S.recovering = false;
    S.engineReady = true;
    S.engineBuild = d.build;
    S.engineThreads = d.threads;
    S.engineHash = d.hashMB;
    S.engineBusy = false;
    S.lastProgress = Date.now();
    S.lastProgressNodes = 0;
    PERF.engineReady = performance.now();
    chip.textContent = d.build === 'multi' ? T('engineMulti', { n: d.threads }) : T('engineSingle');
    chip.className = 'chip ' + (d.build === 'multi' ? 'on' : 'warn');
    chip.title = T('engineReady') + (d.build === 'multi' ? ' · SharedArrayBuffer' : '');
    hideLoader();
    renderDebug();
    updateThreadUI();
    /* an action asked for before the lazy load finished runs now */
    if (S.pendingOne) { S.pendingOne = false; setTimeout(playOneMove, 0); return; }
    requestSync(0);
    return;
  }
  if (d.t === 'initfail') {
    S.recovering = false;
    S.engineReady = false;
    if (S.engineBuild === 'multi' && retrySingle(d.error)) return;
    chip.textContent = T('engineErr');
    chip.className = 'chip err';
    showLoadError('loadFail', d.error ? String(d.error).slice(0, 80) : '');
    toast(T('engineErr') + ': ' + (d.error || ''));
    return;
  }
  if (d.t === 'stderr') {
    const msg = String(d.msg || '');
    if (window.console) console.warn('[engine]', msg);
    /* Emscripten also fires a benign worker error on this build, so a message
       alone is no reason to downgrade: the watchdog below only acts when the
       engine stays silent while a search is running. */
    return;
  }
  if (d.t === 'exit') {
    chip.textContent = T('engineExit');
    chip.className = 'chip err';
    return;
  }
  if (d.t === 'balance-tick' || d.t === 'balance') {
    if (d.t === 'balance') { S.engineBusy = false; clearTimeout(S.stopGuard); }
    if (d.gen !== S.gen) {
      if (d.t === 'balance') requestSync(0);
      return;
    }
    applyBalance(d.points, d.stats);
    if (d.t === 'balance') {
      S.searching = false;
      S.searchKind = null;
      updateState();
      renderDebug();
      scheduleDebug();
      requestSync(0);
    }
    return;
  }
  if (d.t === 'info' || d.t === 'best') {
    if (d.t === 'best') { S.engineBusy = false; clearTimeout(S.stopGuard); }
    if (d.gen !== S.gen) {
      if (d.t === 'best') requestSync(0);
      return;
    }
    if (d.t === 'best') {
      /* the final frame is painted immediately and cancels a queued tick */
      clearTimeout(infoTimer);
      infoTimer = 0;
      infoPending = null;
      paintInfo(d);
      S.searching = false;
      const kind = S.searchKind;
      S.searchKind = null;
      if ((!S.marks.length) && d.best && d.candidates && d.candidates.length) applyCandidates(d.candidates);
      updateState();
      renderDebug();
      // AI (or a single-thread chunk) continues here
      const nowSide = sideToMove();
      const aiOn = nowSide === 1 ? S.aiB : S.aiW;
      if (kind === 'move' && d.best) {
        S.oneShot = false;
        const mx = d.best[0], my = 14 - d.best[1];
        commitMove(mx, my, { fromAi: true });
        toast(T('tOnePlayed', { p: coordName(mx, my) }));
      } else if (kind === 'ai' && aiOn && d.best) {
        commitMove(d.best[0], 14 - d.best[1], { fromAi: true });
      }
      /* single-thread builds restart in short chunks; multi-thread keeps one
         infinite search alive until the user stops it */
      requestSync(S.engineBuild !== 'multi' ? 140 : 0);
    } else {
      scheduleInfoPaint(d);
    }
  }
}

/* Engine info arrives several times per second during a shallow search. Redraw
   at most once every 120 ms and always keep the newest frame, so a burst of
   messages can never flood the main thread (or a background tab's task queue). */
let infoTimer = 0;
let infoPending = null;
let lastInfoPaint = 0;
function scheduleInfoPaint(d) {
  infoPending = d;
  if (infoTimer) return;
  const wait = Math.max(0, 120 - (Date.now() - lastInfoPaint));
  infoTimer = setTimeout(paintQueuedInfo, wait);
}
function paintQueuedInfo() {
  infoTimer = 0;
  lastInfoPaint = Date.now();
  const d = infoPending;
  infoPending = null;
  if (d) paintInfo(d);
}
function paintInfo(d) {
  if (d.stats) applyStats(d.stats);
  if (d.candidates && d.candidates.length) applyCandidates(d.candidates);
}

function applyStats(st) {
  if (S.stats && S.statPly === S.moves.length) {
    st.depth = Math.max(st.depth, S.stats.depth || 0);
    st.nodes = Math.max(st.nodes, S.stats.nodes || 0);
    st.time = Math.max(st.time, S.stats.time || 0);
    if (!st.speed) st.speed = S.stats.speed || 0;
  }
  if ((st.nodes || 0) > S.lastProgressNodes) {
    S.lastProgressNodes = st.nodes || 0;
    S.lastProgress = Date.now();
  }
  S.statPly = S.moves.length;
  S.statSide = sideToMove();
  S.stats = st;  S.searchAnswered = true;
  noteWinRate(st);
  if (!PERF.firstEval) PERF.firstEval = performance.now();
  writeStats();
  updateState();
  const base = parseEval(st.eval);
  if (base != null) setScoreData(base, S.statSide); else updateEvalScore();
  scheduleDebug();
}

let debugTimer = 0;
function scheduleDebug() {
  if (debugTimer) return;
  debugTimer = setTimeout(() => { debugTimer = 0; renderDebug(); }, 350);
}

function applyCandidates(cands) {
  const max = Math.max(1, Math.min(8, S.settings.points || 3));
  /* Marks that touch each other overlap on the board, so keep the stronger point
     and drop its neighbours — the desktop trainer filters the same way. That also
     means a larger point count does not always paint that many circles. */
  const pool = cands.slice(0, 12).map((c, i) => {
    const x = c.move[0], yUi = 14 - c.move[1];
    const ev = parseEval(c.eval);
    return {
      kind: 'ana', rank: i, x, y: yUi, depth: c.depth,
      wr: normWr(c.winrate),
      ev, evTxt: fmtEval(ev),
    };
  });
  const marks = [];
  for (const m of pool) {
    if (marks.length >= max) break;
    let clash = false;
    for (const k of marks) {
      if (Math.abs(k.x - m.x) <= 1 && Math.abs(k.y - m.y) <= 1) { clash = true; break; }
    }
    if (!clash) marks.push(m);
  }
  S.marks = marks;
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

/* score line above the win-rate bar: +123 for a normal eval, +M12 for a mate in
   twelve (the same scale the marker circles and the main line use) */
function fmtScore(v) {
  if (v == null || !Number.isFinite(v)) return '-';
  if (v >= 9900) return '+M' + Math.round(v - 9900);
  if (v <= -9900) return '-M' + Math.round(Math.abs(v) - 9900);
  return (v >= 0 ? '+' : '') + Math.round(v);
}

function updateEvalScore(fresh) {
  const el = $('wrEval');
  if (!el) return;
  const sides = [];
  const balMarks = S.balanceMarks || [];
  /* Which sides to show is a UI decision; the numbers themselves are kept
     between searches (S.scoreB / S.scoreW), so switching AI sides, stopping or
     opening the settings never blanks a score that is still valid. */
  if (balMarks.length >= 2) {
    balMarks.slice(0, 2).sort((a, b) => a.c - b.c).forEach((m) => sides.push({ c: m.c, v: m.ev }));
  } else if (balMarks.length === 1) {
    sides.push({ c: balMarks[0].c, v: balMarks[0].ev });
  } else if (S.aiB && S.aiW) {
    sides.push({ c: 1, v: S.scoreB }, { c: 2, v: S.scoreW });
  } else if (S.aiB) {
    sides.push({ c: 1, v: S.scoreB });
  } else if (S.aiW) {
    sides.push({ c: 2, v: S.scoreW });
  } else if (S.scoreSide) {
    sides.push({ c: S.scoreSide, v: S.scoreSide === 1 ? S.scoreB : S.scoreW });
  }
  if (!sides.length) {
    el.innerHTML = '<span class="none">-</span>';
    return;
  }
  el.innerHTML = sides.map((s) =>
    '<span class="side ' + (s.c === 1 ? 'b' : 'w') + '"><i></i><span>' +
    (s.c === 1 ? T('evalBlack') : T('evalWhite')) + '</span><b>' + fmtScore(s.v) + '</b></span>'
  ).join('');
  if (fresh) {
    el.classList.remove('fresh');
    void el.offsetWidth;
    el.classList.add('fresh');
  }
}

/* a new evaluation always replaces both sides at once: the engine speaks from
   the side to move, so the other colour is simply its mirror */
function setScoreData(value, side) {
  if (value == null || !Number.isFinite(value) || !side) return;
  const black = side === 1 ? value : -value;
  S.scoreB = black;
  S.scoreW = -black;
  S.scoreSide = side;
  updateEvalScore(true);
}

function applyBalance(points, stats) {
  if (!points || !points.length) {
    S.balanceMarks = [];
    S.balanceInfo = { empty: true, stats };
    drawBoard();
    updateBalanceRow();
    updateEvalScore();
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
  if (stats) { S.stats = stats; S.statSide = mover; noteWinRate(stats); writeStats(); updateState(); scheduleDebug(); }
  drawBoard();
  updateBalanceRow();
  if (ev != null) setScoreData(ev, mover); else updateEvalScore();
}

/* ============================================================ search orchestration
   One worker job at a time. Every click only changes intent flags; a single
   debounced scheduler reads those flags and talks to the engine. Twenty clicks
   therefore collapse into at most one stop plus one start, and no second search
   can be dispatched before the worker acknowledged the previous one. */
function launch(kind) {
  if (!S.engineReady || !S.worker) return;
  if (S.winner) return;
  if (S.engineBusy) { S.queuedKind = kind; return; }
  if (kind === 'balance' && !S.balance) return;
  if (kind === 'move' && !S.oneShot) return;
  S.engineBusy = true;
  S.stopSent = false;
  S.searching = true;
  S.searchKind = kind;
  S.oneShot = kind === 'move';
  S.searchT0 = Date.now();
  S.searchAnswered = false;
  S.lastProgress = Date.now();
  S.lastProgressNodes = 0;
  const job = {
    id: ++S.seq,
    seq: S.seq,
    gen: S.gen,
    moves: engineMoves(),
    threads: S.engineThreads || 1,
    hashMB: S.settings.hashMB,
    caution: S.settings.caution,
    rule: S.settings.rule,
    /* analysis and balance both deepen for as long as the user lets them; only
       one-move/AI jobs keep a time budget */
    infinite: S.engineBuild === 'multi' && (kind === 'analysis' || kind === 'balance'),
    timeMs: kind === 'ai' ? Math.min(S.settings.think, 4000) : S.settings.think,
    /* Multi-PV only pays off while analysing: playing with several lines splits
       the effort and makes the chosen move weaker. */
    topN: kind === 'analysis' ? S.settings.points : 1,
    count: S.balance,
  };
  if (kind === 'balance') enginePost({ t: 'balance', job });
  else enginePost({ t: 'search', job });
  updateState();
  renderDebug();
}

let syncTimer = 0;
function desiredKind() {
  if (S.winner) return null;
  if (S.oneShot) return 'move';
  const side = sideToMove();
  if (side === 1 ? S.aiB : S.aiW) return 'ai';
  if (S.balance) return 'balance';
  if (S.analysis) return 'analysis';
  return null;
}
function requestSync(delay) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, Math.max(0, delay || 0));
}
function runSync() {
  syncTimer = 0;
  if (S.winner || S.recovering) return;
  if (!S.engineReady) { if (engineWanted()) ensureEngine(); return; }
  const kind = desiredKind();
  if (kind) launch(kind);
}

/* kept for the many existing call sites; it now only debounces the scheduler */
function schedule(delay) { requestSync(delay || 0); }

function haltSearch() {
  S.gen++;
  S.seq++;
  S.searching = false;
  S.searchKind = null;
  S.oneShot = false;
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = 0; }
  if (S.engineBusy) {
    if (!S.stopSent) {
      S.stopSent = true;
      enginePost({ t: 'stop', seq: S.seq });
    }
    /* if the worker never confirms, stop blocking the scheduler: the worker's
       own 500 ms fallback finishes the search anyway */
    clearTimeout(S.stopGuard);
    S.stopGuard = setTimeout(() => { S.engineBusy = false; S.stopSent = false; }, 800);
  }
}

function boardChanged(options) {
  const opts = options || {};
  const keepRedo = !!opts.keepRedo;
  haltSearch();
  if (!keepRedo) S.redo = [];
  syncWinRate();
  S.stats = null;
  S.marks = [];
  S.balanceHeld = false;
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.preview = null;
  /* the stored scores belong to the previous position: a fresh evaluation on
     the new position replaces them, but plain UI toggles keep them alive */
  S.scoreB = null;
  S.scoreW = null;
  S.scoreSide = null;
  recompute();
  writeStats();
  drawBoard();
  renderHudMove();
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
  /* a new stone starts a new branch: drop the samples recorded for the ply that
     is being replaced, then keep the last value until the next analysis lands */
  S.wrGame.track.length = S.moves.length;
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

/* ============================================================ transforms
   Same nine operations as gomocalc: four sym metries plus shifts that push the
   whole position against one edge. Move order (手数) and colours are untouched,
   so undo/redo history stays valid; only the coordinates move. Analysis is
   stopped first and restarted on the transformed position. */
const XF_SYMMETRY = {
  rot: (x, y) => [SIZE - 1 - y, x],
  fliph: (x, y) => [SIZE - 1 - x, y],
  flipv: (x, y) => [x, SIZE - 1 - y],
  diag: (x, y) => [y, x],
  anti: (x, y) => [SIZE - 1 - y, SIZE - 1 - x],
};

function applyTransform(kind) {
  if (!S.moves.length && !S.redo.length) { toast(T('tXfEmpty')); return; }
  haltSearch();
  let map;
  if (XF_SYMMETRY[kind]) {
    const f = XF_SYMMETRY[kind];
    map = (m) => ({ x: f(m.x, m.y)[0], y: f(m.x, m.y)[1], c: m.c });
  } else {
    const all = S.moves.concat(S.redo);
    const minX = Math.min(...all.map((m) => m.x));
    const maxX = Math.max(...all.map((m) => m.x));
    const minY = Math.min(...all.map((m) => m.y));
    const maxY = Math.max(...all.map((m) => m.y));
    const dx = kind === 'left' ? -minX : kind === 'right' ? SIZE - 1 - maxX : 0;
    const dy = kind === 'up' ? -minY : kind === 'down' ? SIZE - 1 - maxY : 0;
    if (!dx && !dy) { toast(T('tXfNoRoom')); return; }
    map = (m) => ({ x: m.x + dx, y: m.y + dy, c: m.c });
  }
  S.moves = S.moves.map(map);
  S.redo = S.redo.map(map);
  S.lastAiMove = null;
  S.hover = null;
  S.preview = null;
  S.wrGame.track = S.wrGame.track.slice(0, S.moves.length + 1);
  boardChanged({ keepRedo: true });
  toast(T('tTransformed', { n: S.moves.length }));
}

function toggleXfPanel(open) {
  const p = $('xfPanel'), b = $('btnTransform');
  if (!p) return;
  const want = open == null ? !p.classList.contains('open') : !!open;
  p.classList.toggle('open', want);
  document.body.classList.toggle('xf-open', want);
  if (b) b.setAttribute('aria-expanded', String(want));
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
  S.analysis = false;
  S.balance = 0;
  S.oneShot = false;
  S.statPly = -1;
  S.moves = [];
  S.redo = [];
  S.winner = 0;
  S.forbidden = [];
  S.marks = [];
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.stats = null;
  S.statsShown = false;
  S.anim = null;
  S.lastAiMove = null;
  S.preview = null;
  resetWinRate();
  enginePost({ t: 'reset', moves: [], rule: S.settings.rule });
  drawBoard();
  writeStats();
  updateAll();
  requestSync(0);
  toast(T('tRestarted'));
}

/* ============================================================ AI / analysis / balance */
function toggleAI(side) {
  if (side === 1) S.aiB = !S.aiB; else S.aiW = !S.aiW;
  haltSearch();
  /* switching sides makes the previous numbers meaningless: clear them instead
     of showing the old side's score under the new label */
  S.stats = null;
  S.statsShown = false;
  S.statPly = -1;
  S.marks = [];
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.balance = 0;
  S.balanceHeld = false;
  S.analysis = false;
  writeStats();
  drawBoard();
  updateAll();
  requestSync(180);
  const on = side === 1 ? S.aiB : S.aiW;
  const who = side === 1 ? T('tBlack') : T('tWhite');
  toast(on ? T('tAiOn', { n: who }) : T('tAiOff', { n: who }));
}

/* balance points: the first press computes, the second press plays them —
   with two points both stones drop at once (the pair is Black + White) */
function clickBalance() {
  if (S.winner) { toast(T('tGameOver')); return; }
  if (!S.moves.length) { toast(T('tNoBalance')); return; }
  if (!S.engineReady) { ensureEngine(); toast(T('tEngineLazy')); }
  if (S.balanceMarks.length) {
    const pts = S.balanceMarks.map((m) => ({ x: m.x, y: m.y }));
    S.balance = 0;
    S.balanceHeld = false;
    S.balanceMarks = [];
    S.balanceInfo = null;
    haltSearch();
    updateAll();
    const played = [];
    for (const p of pts) {
      if (canPlace(p.x, p.y)) {
        commitMove(p.x, p.y, {});
        played.push(coordName(p.x, p.y));
      }
    }
    if (played.length > 1) toast(T('tBalPlayedPair', { a: played[0], b: played[1] }));
    else if (played.length === 1) toast(T('tBalPlayed', { p: played[0] }));
    else { toast(T('tBalNone')); drawBoard(); }
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
  const n = S.settings.balPoints >= 2 ? 2 : 1;
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

/* the right column: only 1 or 2 points, the label updates on the spot */
function cycleBalPoints() {
  const next = S.settings.balPoints >= 2 ? 1 : 2;
  setSetting('balPoints', next);
  toast(T('tBalPoints', { n: next }));
}

function toggleAnalysis() {
  if (S.winner) { toast(T('tGameOver')); return; }
  if (!S.engineReady) { ensureEngine(); toast(T('tEngineLazy')); }
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
  S.balanceHeld = false;
  S.balance = 0;
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.marks = [];
  S.stats = null;
  haltSearch();
  updateAll();
  schedule(120);
}

/* the middle key of the step row: compute one move and play it right away */
function playOneMove() {
  if (S.winner) { toast(T('tGameOver')); return; }
  haltSearch();
  S.analysis = false;
  S.balance = 0;
  S.balanceHeld = false;
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.marks = [];
  S.preview = null;
  if (!S.engineReady) {
    S.pendingOne = true;
    ensureEngine();
    updateAll();
    toast(T('tEngineLazy'));
    return;
  }
  S.oneShot = true;
  updateAll();
  requestSync(0);
  toast(T('tThinkingOne'));
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
  S.marks = [];
  S.balanceMarks = [];
  S.balanceInfo = null;
  S.stats = null;
  S.statsShown = false;
  resetWinRate();
  recompute();
  drawBoard();
  writeStats();
  updateAll();
  schedule(160);
  toast(T('tLoaded', { n: moves.length }));
}

/* ============================================================ UI text */
/* switch the whole page between Chinese and English; every visible string
   comes from I18N, so the English build never shows Chinese */
function applyLang(lang) {
  LANG = lang === 'en' ? 'en' : 'zh';
  const tEl = $('toast');
  if (tEl) { tEl.classList.remove('on'); tEl.textContent = ''; }
  try { localStorage.setItem(LANG_KEY, LANG); localStorage.setItem('mg.site.lang', LANG); } catch (e) {}
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
  if (S.engineReady) {
    chip.textContent = S.engineBuild === 'multi' ? T('engineMulti', { n: S.engineThreads }) : T('engineSingle');
  } else if (engineStarted) {
    chip.textContent = T('engineLoading');
  } else {
    chip.textContent = T('engineIdle');
  }
  $('btnRestart').textContent = T('restart');
  syncSettingsUI();
  updateAll();
  writeStats();
  drawBoard();
  paintLoader();
}

/* the four search metrics stay on screen all the time: a finished search keeps
   its last numbers instead of falling back to a dash */
function writeStats() {
  const st = S.stats;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  if (st) {
    S.statsShown = true;
    set('stDepth', st.depth ? 'd' + st.depth : '–');
    set('stSpeed', st.speed ? fmtNps(st.speed) : '–');
    set('stNodes', st.nodes ? fmtBig(st.nodes) : '–');
    set('stTime', st.time ? (st.time / 1000).toFixed(1) + 's' : '–');
  } else if (!S.statsShown) {
    set('stDepth', '–'); set('stSpeed', '–'); set('stNodes', '–'); set('stTime', '–');
  }
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
  else if (S.searching && S.searchKind === 'move') txt = T('stMove');
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
    row.innerHTML = '<span class="depth">d–</span><span class="eval">–</span>' +
      '<span class="route">' + T('routeEmpty') + '</span>';
    S.pv = [];
    S.preview = null;
    return;
  }
  const mk = S.marks[0];
  const line = top && top.line && top.line.length ? top.line : (mk ? [[mk.x, 14 - mk.y]] : []);
  // keep the whole line so hovering a coordinate can foreshadow it on the board
  const first = sideToMove();
  S.pv = line.slice(0, 16).map((p, i) => ({
    x: p[0], y: 14 - p[1], c: i % 2 === 0 ? first : (first === 1 ? 2 : 1),
  }));
  const chips = S.pv.map((p, i) =>
    '<b class="mv" data-i="' + i + '">' + coordName(p.x, p.y) + '</b>'
  ).join('');
  const ev = mk && mk.ev != null ? mk.ev : null;
  const cls = ev == null ? '' : (ev >= 0 ? ' pos' : ' neg');
  row.className = 'route-row';
  row.innerHTML =
    '<span class="depth">d' + ((st && st.depth) || (mk && mk.depth) || 0) + '</span>' +
    '<span class="eval' + cls + '">' + (mk ? mk.evTxt : '–') + '</span>' +
    '<span class="route">' + (chips || T('routeNone')) + '</span>';
  /* keep an active hover preview alive while the search keeps rewriting the row */
  if (S.preview) {
    const on = row.querySelector('.mv[data-i="' + S.preview.i + '"]');
    if (on) on.classList.add('on');
    else S.preview = null;
  }
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
    const d = info.stats && info.stats.depth ? 'd' + info.stats.depth + ' · ' : '';
    note = '<span class="bal note">' + d + '|Eval| ' + Math.abs(Math.round(info.eval)) + ' · ' +
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
  const play = $('btnStep');
  if (play) {
    /* one shot while a search is live would queue a second engine job; block it */
    play.disabled = !S.engineReady || !!S.winner || S.searching;
    play.setAttribute('aria-pressed', String(!!(S.searching && S.searchKind === 'move')));
  }
  an.classList.toggle('busy', !!S.searching && S.searchKind === 'analysis');
  an.setAttribute('aria-busy', String(!!S.searching && S.searchKind === 'analysis'));
  if (document.activeElement !== codeInput) codeInput.value = formatCode();
  const codeAlt = $('codeAlt');
  if (codeAlt) {
    const pairs = S.moves.map((m) => (m.x + 1) + ',' + (SIZE - m.y)).join(' ');
    codeAlt.innerHTML = S.moves.length
      ? '<span>' + T('codeAltLabel') + '</span>' + pairs
      : '<span>' + T('codeAltLabel') + '</span>—';
  }
  updateState();
  updateBalanceRow();
  updateWinBar();
  updateEvalScore();
  renderHudMove();
  renderDebug();
  syncSettingsUI();
}

/* black share of the win rate, 0..1 — the engine reports the mover's win rate,
   so it is flipped whenever white is to move. Kept per ply so the bar can follow
   undo/redo, and kept across moves so a new stone no longer snaps back to 50%. */
function blackWrOf(st) {
  if (!st) return null;
  let wr = normWr(st.winrate);
  if (wr == null) {
    const ev = parseEval(st.eval);
    if (ev == null) return null;
    wr = 1 / (1 + Math.exp(-ev / 200));
  }
  wr = Math.max(0.01, Math.min(0.99, wr));
  return sideToMove() === 1 ? wr : 1 - wr;
}
function noteWinRate(st) {
  const wr = blackWrOf(st);
  if (wr == null) return;
  S.wrGame.value = wr;
  S.wrGame.track[S.moves.length] = wr;
}
/* after undo / redo / a new stone: use the recorded value for this ply when it
   exists, otherwise carry the last value forward (never fall back to 50%) */
function syncWinRate() {
  const v = S.wrGame.track[S.moves.length];
  if (Number.isFinite(v)) S.wrGame.value = v;
}
function resetWinRate() { S.wrGame = { value: 0.5, track: [0.5] }; }

function blackWinRate() {
  return S.wrGame.value;
}

/* the win-rate bar: black (violet) on the left, white (sky blue) on the right;
   the percentages sit above it in the label row */
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
  seg('segLang', LANG);
  seg('segThink', S.settings.think);
  seg('segStone', S.settings.stone);
  refreshSkinTitles();
  buildThreadSeg();
  const sw = $('swNum');
  if (sw) sw.setAttribute('aria-checked', String(!!S.settings.showNum));
  const ti = $('thinkInput');
  if (ti && document.activeElement !== ti) ti.value = String(Math.round(S.settings.think / 1000));
  const th = $('threadHint');
  if (th) {
    th.textContent = maxThreads() <= 1
      ? T('threadSingle')
      : T('threadHintT', { hc, max: maxThreads() });
  }
  const rh = $('ruleHint');
  if (rh) rh.textContent = ruleHint(S.settings.rule);
}

/* the thread count is a plain pick-list, rebuilt when the hardware allows more */
let threadSegMax = -1;
function buildThreadSeg() {
  const box = $('segThreads');
  if (!box) return;
  const max = maxThreads();
  if (threadSegMax !== max) {
    threadSegMax = max;
    let html = '';
    for (let i = 1; i <= max; i++) html += '<button type="button" data-v="' + i + '">' + i + '</button>';
    box.innerHTML = html;
  }
  const cur = Math.min(S.settings.threads, max);
  [...box.querySelectorAll('button')].forEach((b) => {
    b.classList.toggle('on', +b.dataset.v === cur);
    b.disabled = max <= 1;
  });
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
  if (key === 'balPoints') value = value >= 2 ? 2 : 1;
  S.settings[key] = value;
  saveSettings();
  syncSettingsUI();
  renderDebug();
  if (prev !== value) {
    if (key === 'board') {
      drawBoard();
      toast(T('tBoardSet', { n: LANG === 'en' ? boardSkin(value).en : boardSkin(value).zh }));
      return;
    }
    if (key === 'stone' || key === 'showNum') {
      drawBoard();
      if (key === 'stone') toast(T('tStoneSet', { n: T('stone' + value.charAt(0).toUpperCase() + value.slice(1)) }));
      else toast(value ? T('tNumOn') : T('tNumOff'));
      return;
    }
    if (key === 'balPoints') {
      const el = $('balCountNum');
      if (el) el.textContent = String(value);
      if (S.balance) { S.balance = value; haltSearch(); schedule(120); }
      return;
    }
    haltSearch();
    if (key === 'rule') {
      S.marks = [];
      S.stats = null;
      S.balanceMarks = [];
      S.balanceInfo = null;
      S.preview = null;
      recompute();
      enginePost({ t: 'reset', moves: engineMoves(), rule: S.settings.rule });
      drawBoard();
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

/* fifteen colour chips; each shows its wood tone with a hairline cross in the
   grid colour it will actually be drawn with */
function buildBoardSwatches() {
  const box = $('swBoard');
  if (!box) return;
  if (!box.childElementCount) {
    box.innerHTML = BOARD_SKINS.map((s) =>
      '<button type="button" class="swatch" data-v="' + s.id + '" style="--sw:' + s.board + ';--swl:' + s.line + '"></button>'
    ).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) setSetting('board', b.dataset.v);
    });
  }
  refreshSkinTitles();
}

function refreshSkinTitles() {
  const box = $('swBoard');
  if (!box) return;
  [...box.querySelectorAll('.swatch')].forEach((b) => {
    const s = boardSkin(b.dataset.v);
    const name = LANG === 'en' ? s.en : s.zh;
    b.setAttribute('title', name);
    b.setAttribute('aria-label', name);
    b.setAttribute('aria-pressed', String(s.id === S.settings.board));
  });
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
  segClick('segLang', (v) => { if (v !== LANG) applyLang(v); });
  segClick('segStone', (v) => setSetting('stone', v));
  segClick('segThreads', (v) => setSetting('threads', +v));
  buildBoardSwatches();
  $('swNum').addEventListener('click', () => setSetting('showNum', !S.settings.showNum));
  const applyThink = () => {
    const raw = Math.round(+($('thinkInput').value || 0));
    const sec = Math.max(1, Math.min(120, raw || 3));
    $('thinkInput').value = String(sec);
    setSetting('think', sec * 1000);
  };
  $('btnThinkApply').addEventListener('click', applyThink);
  $('thinkInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyThink(); } });
  segClick('segTheme', (v) => {
    if (v === 'system') {
      S.settings.theme = null;
      saveSettings();
      try { localStorage.removeItem(THEME_KEY); localStorage.removeItem('mg.site.theme'); } catch (e) {}
      applyTheme(systemDark() ? 'dark' : 'light', false);
    } else {
      S.settings.theme = v;
      saveSettings();
      applyTheme(v, true);
    }
    syncThemeSeg();
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

/* notices live inside the board's top-right padding band, stacked and fading */
function toast(msg) {
  const box = $('hudNotes');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'hud-note';
  el.textContent = msg;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  while (box.children.length > 2) box.removeChild(box.firstChild);
  setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => el.remove(), 240);
  }, 2400);
}

/* the latest stone stays visible as “黑 H8 / 白 J6”, refreshed on every move */
let hudLastKey = '';
function renderHudMove() {
  const el = $('hudMove');
  if (!el) return;
  const last = S.moves[S.moves.length - 1];
  if (!last) { el.hidden = true; el.innerHTML = ''; hudLastKey = ''; return; }
  const key = last.c + ':' + last.x + ':' + last.y + ':' + S.moves.length;
  el.hidden = false;
  el.innerHTML = '<i class="' + (last.c === 1 ? 'b' : 'w') + '"></i><span>' +
    (last.c === 1 ? T('black') : T('white')) + '</span><b>' +
    LETTERS[last.x] + (SIZE - last.y) + '</b>';
  if (key !== hudLastKey) {
    hudLastKey = key;
    el.classList.remove('new');
    void el.offsetWidth;
    el.classList.add('new');
  }
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

/* hovering a coordinate in the analysed line previews that continuation on the board */
function initRoutePreview() {
  const row = $('routeRow');
  if (!row) return;
  const show = (i) => {
    if (!S.pv.length) return;
    S.preview = { i };
    [...row.querySelectorAll('.mv')].forEach((el) => el.classList.toggle('on', +el.dataset.i === i));
    drawBoard();
  };
  const clear = () => {
    if (!S.preview) return;
    S.preview = null;
    [...row.querySelectorAll('.mv')].forEach((el) => el.classList.remove('on'));
    drawBoard();
  };
  row.addEventListener('pointerover', (e) => {
    const b = e.target.closest && e.target.closest('.mv');
    if (!b) return;
    show(+b.dataset.i);
  });
  row.addEventListener('pointerleave', clear);
  row.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.mv');
    if (!b) return;
    if (S.preview && +b.dataset.i === S.preview.i) clear(); else show(+b.dataset.i);
  });
}

function initHeaderEvents() {
  $('btnAIB').addEventListener('click', () => toggleAI(1));
  $('btnAIW').addEventListener('click', () => toggleAI(2));
  $('btnAnalysis').addEventListener('click', toggleAnalysis);
  $('btnBalance').addEventListener('click', clickBalance);
  $('balCount').addEventListener('click', cycleBalPoints);
  /* hover / touch pre-warms the engine before the click even lands */
  ['btnAnalysis', 'btnBalance', 'btnStep', 'btnAIB', 'btnAIW', 'balCount'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    ['pointerenter', 'touchstart', 'focus'].forEach((ev) => {
      el.addEventListener(ev, prewarmEngine, { passive: true });
    });
  });
  $('btnUndo').addEventListener('click', undoMove);
  $('btnRedo').addEventListener('click', redoMove);
  $('btnStep').addEventListener('click', playOneMove);
  $('btnRestart').addEventListener('click', () => restartGame(false));
  $('btnTransform').addEventListener('click', (e) => { e.stopPropagation(); toggleXfPanel(); });
  $('btnXfClose').addEventListener('click', () => toggleXfPanel(false));
  const xfPanel = $('xfPanel');
  if (xfPanel) {
    xfPanel.addEventListener('click', (e) => {
      const k = e.target.closest && e.target.closest('[data-xf]');
      if (!k) return;
      e.stopPropagation();
      applyTransform(k.getAttribute('data-xf'));
    });
  }
  document.addEventListener('click', (e) => {
    if (!xfPanel) return;
    if (!xfPanel.contains(e.target) && e.target !== $('btnTransform')) toggleXfPanel(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && xfPanel && xfPanel.classList.contains('open')) toggleXfPanel(false);
  });
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

/* ============================================================ viewport
   The on-screen keyboard shrinks the layout viewport on phones, which used to
   squash the board and the key rows into a mess. We remember the height seen
   while nothing is focused and freeze it in --vh, so opening the keyboard only
   scrolls the page instead of re-flowing it. */
let stableH = 0;
let lastLandscape = false;
function typingNow() {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
}
function syncViewport() {
  const root = document.documentElement;
  const h = Math.round(window.innerHeight || root.clientHeight);
  const land = window.innerWidth > window.innerHeight;
  if (land !== lastLandscape) { lastLandscape = land; stableH = 0; }   // rotation: measure again
  if (!stableH) stableH = h;
  /* only ever grow: the keyboard (and WeChat's resized viewport) used to lock a
     shrunken height in, after which the board stayed at 230 px for good */
  else if (!typingNow() && h > stableH) stableH = h;
  root.style.setProperty('--vh', stableH + 'px');
  /* the short-screen cap is a landscape-only fallback — in portrait it must
     never touch the board width */
  root.classList.toggle('short', h < 560 && window.innerWidth > window.innerHeight);
}
/* keep the focused box above the on-screen keyboard (the layout viewport is
   taller than the visual one while the keyboard is up) */
function ensureCaretVisible() {
  const a = document.activeElement;
  if (!a || !a.getBoundingClientRect) return;
  const vv = window.visualViewport;
  const bottom = (vv ? vv.height + (vv.offsetTop || 0) : window.innerHeight) - 10;
  const r = a.getBoundingClientRect();
  if (r.bottom > bottom) window.scrollBy(0, Math.ceil(r.bottom - bottom + 8));
}
function initViewport() {
  syncViewport();
  window.addEventListener('resize', syncViewport);
  window.addEventListener('orientationchange', () => {
    stableH = 0;                       // re-measure from scratch after a rotate
    setTimeout(syncViewport, 260);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (typingNow()) { ensureCaretVisible(); return; }
      syncViewport();
    });
    window.visualViewport.addEventListener('scroll', () => { if (typingNow()) ensureCaretVisible(); });
  }
  document.addEventListener('focusout', () => setTimeout(syncViewport, 320));
  /* keep the code box visible above the keyboard once it slides up */
  const ci = $('codeInput');
  if (ci) ci.addEventListener('focus', () => setTimeout(ensureCaretVisible, 340));
}

function boot() {
  initTheme();
  initViewport();
  let savedLang = '';
  try { savedLang = localStorage.getItem(LANG_KEY) || localStorage.getItem('mg.site.lang') || ''; } catch (e) {}
  applyLang(savedLang || (/^en/i.test(navigator.language || '') ? 'en' : 'zh'));
  window.addEventListener('storage', (e) => {
    if (e.key !== LANG_KEY && e.key !== 'mg.site.lang') return;
    let v = '';
    try { v = localStorage.getItem(LANG_KEY) || localStorage.getItem('mg.site.lang') || ''; } catch (err) {}
    if ((v === 'zh' || v === 'en') && v !== LANG) applyLang(v);
  });
  paintLoader();
  $('btnRetryLoad').addEventListener('click', retryLoad);
  initServiceWorker();
  /* engine + weights stay on the shelf until a search needs them */
  initEngineMode();
  /* if nothing moves for over a minute, offer a retry instead of waiting forever */
  setInterval(() => {
    if (!engineStarted) return;
    if (!S.engineReady) {
      if (!loaderDone && !loaderError && Date.now() - loadTick > 75000) showLoadError('loadSlow');
      return;
    }
    /* Never judge the engine while the tab is hidden: the browser throttles both
       timers and message delivery there, and the search is still deepening. */
    if (document.hidden) return;
    /* The worker posts a heartbeat every 500 ms while a job is live, so a dead
       worker is detected by silence alone. Node growth must not be the trigger:
       a single iteration at depth 24 can easily take longer than 12 s. */
    const idleFor = Date.now() - S.lastEngineMsg;
    /* Ready but stone deaf: no node has moved for 12 s although a job is live.
       Rebuild the worker once (position and flags survive), never loop. */
    if ((S.searching || S.engineBusy) && idleFor > 12000 && !S.recovering) {
      haltSearch();
      rebuildWorker('no progress for ' + Math.round(idleFor / 1000) + ' s');
    }
  }, 3000);
  /* Resuming a background tab: re-sync the UI and, if the flags still ask for
     a search the worker no longer runs, start it again instead of showing stale
     numbers. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    S.lastProgress = Date.now();
    scheduleDebug();
    if (!S.engineBusy) requestSync(300);
  });
  initCanvas();
  initSettingsEvents();
  initHeaderEvents();
  initRoutePreview();
  initBoardEvents();
  recompute();
  measureBoard();
  writeStats();
  updateAll();
  PERF.usable = performance.now();
  schedulePrefetch();
  // surface isolation state for QA / debugging
  window.MG = {
    S, geo, PERF,
    perf: () => ({
      bootMs: Math.round(PERF.boot),
      usableMs: PERF.usable ? Math.round(PERF.usable) : null,
      prefetchMs: PERF.prefetch ? Math.round(PERF.prefetch) : null,
      engineStartMs: PERF.engineStart ? Math.round(PERF.engineStart) : null,
      engineReadyMs: PERF.engineReady ? Math.round(PERF.engineReady) : null,
      firstEvalMs: PERF.firstEval ? Math.round(PERF.firstEval) : null,
      readyFromBootMs: PERF.engineReady ? Math.round(PERF.engineReady) : null,
      loadFromTriggerMs: (PERF.engineStart && PERF.engineReady) ? Math.round(PERF.engineReady - PERF.engineStart) : null,
      evalFromTriggerMs: (PERF.engineStart && PERF.firstEval) ? Math.round(PERF.firstEval - PERF.engineStart) : null,
      eager: EAGER,
    }),
    winrate: () => ({ value: S.wrGame.value, track: S.wrGame.track.slice() }),
    loadEngine: ensureEngine,
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
    set: (k, v) => setSetting(k, v),
    startAnalysis: () => { if (!S.analysis) toggleAnalysis(); },
    stopAnalysis: () => { if (S.analysis) toggleAnalysis(); },
    setRule: (r) => setSetting('rule', r),
    transform: applyTransform,
    toggleXf: toggleXfPanel,
    stopOnly: () => { S.analysis = false; S.balance = 0; S.oneShot = false; haltSearch(); updateAll(); },
    msgRing: () => S.msgRing || [],
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

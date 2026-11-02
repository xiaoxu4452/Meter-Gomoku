'use strict';
/* Meter Gomoku Web — engine worker
 * 单线程 Rapfi (SIMD128) 跑在 Worker 里；主线程负责 UI 与"分片思考"调度。
 * 协议：Gomocup / Rapfi 扩展（START / INFO / YXBOARD / YXNBEST）。
 */

let Mod = null;
let cur = [];       // 本轮正在接收的 PV 块
let complete = [];  // 最近一个**完整**轮次（所有名次都到齐，深度一致）
let idx = -1;       // 当前 PV 序号
let numPv = 0;      // 本轮应有多少个候选（INFO NUMPV）
let last = null;    // 最近一次快照

function post(o) { self.postMessage(o); }

self.onmessage = (e) => {
  const d = e.data || {};
  if (d.t === 'init') init(d.files || {});
  else if (d.t === 'cmd' && Mod) Mod.sendCommand(d.c);
  else if (d.t === 'quit' && Mod) { try { Mod.terminate(); } catch (err) {} }
};

function init(files) {
  try {
    self.importScripts(files.js);
  } catch (err) {
    post({ t: 'fail', msg: 'engine script: ' + err });
    return;
  }
  self.Rapfi({
    locateFile: (u) => {
      if (/^rapfi.*\.data$/.test(u)) return files.data;
      if (/\.wasm$/.test(u)) return files.wasm;
      return u;
    },
    onReceiveStdout: onOut,
    onReceiveStderr: (s) => post({ t: 'stderr', s: String(s) }),
    onExit: (c) => post({ t: 'exit', c }),
    setStatus: (s) => post({ t: 'status', s: String(s) }),
  }).then((m) => {
    Mod = m;
    post({ t: 'ready' });
  }).catch((err) => post({ t: 'fail', msg: String(err) }));
}

function toInt(s) { const n = parseInt(s, 10); return isNaN(n) ? 0 : n; }

function snapshot() {
  const best = (complete.length ? complete : cur).filter((p) => p && p.mv);
  let depth = 0, nodes = 0, time = 0, speed = 0;
  for (const p of best) {
    if (p.depth > depth) depth = p.depth;
    if (p.nodes > nodes) nodes = p.nodes;
    if (p.time > time) time = p.time;
    if (p.speed > speed) speed = p.speed;
  }
  return {
    t: 'snap',
    depth,
    nodes,
    time,
    speed,
    pvs: best.map((p) => ({
      mv: p.mv, depth: p.depth, nodes: p.nodes, eval: p.eval,
      winrate: p.winrate, line: p.line || [],
    })),
  };
}

function onOut(line) {
  line = String(line).replace(/\s+$/, '');
  if (!line) return;

  // 终局着法：裸坐标
  if (/^\d+,\d+(\s+\d+,\d+)?$/.test(line)) {
    const pts = line.split(/\s+/).map((s) => s.split(',').map(Number));
    // 只有"整轮都收齐"才覆盖 complete，避免用半轮把完整结果显示掉
    if (cur.length && (!numPv || cur.length >= numPv)) complete = cur;
    cur = [];
    last = snapshot();
    post({ t: 'best', mv: pts[0], pts, snap: last, pvs: last.pvs });
    idx = -1;
    return;
  }
  if (line === 'OK') { post({ t: 'ok' }); return; }
  if (line === 'SWAP') { post({ t: 'swap' }); return; }

  if (line.startsWith('INFO ')) {
    const rest = line.slice(5);
    const sp = rest.indexOf(' ');
    const head = sp < 0 ? rest : rest.slice(0, sp);
    const val = sp < 0 ? '' : rest.slice(sp + 1);

    if (head === 'PV') {
      if (val === 'DONE') {
        idx = -1;
        return;
      }
      const i = toInt(val);
      if (i === 0 && cur.length) {
        // 上一轮已发完 —— 整轮提交，保证同一帧里所有候选深度一致
        if (!numPv || cur.length >= numPv) complete = cur;
        cur = [];
        post(snapshot());
      }
      idx = i;
      cur[i] = { mv: null, depth: 0, seldepth: 0, nodes: 0, time: 0, speed: 0, eval: '-', winrate: 0, line: [] };
      return;
    }
    const p = cur[idx];
    if (!p) return;
    switch (head) {
      case 'NUMPV': numPv = toInt(val); return;
      case 'DEPTH': p.depth = toInt(val); return;
      case 'SELDEPTH': p.seldepth = toInt(val); return;
      case 'NODES': p.nodes = toInt(val); return;
      case 'TOTALTIME': p.time = toInt(val); return;
      case 'SPEED': p.speed = toInt(val); return;
      case 'EVAL': p.eval = val.trim(); return;
      case 'WINRATE': p.winrate = parseFloat(val) || 0; return;
      case 'BESTLINE': {
        const pts = (val.match(/\d+,\d+/g) || []).map((s) => s.split(',').map(Number));
        if (pts.length) { p.mv = pts[0]; p.line = pts; }
        return;
      }
      default: return;
    }
  }

  if (line.startsWith('MESSAGE ')) {
    const m = line.slice(8);
    if (m.startsWith('REALTIME')) { post({ t: 'rt', s: m }); return; }
    post({ t: 'msg', s: m });
    return;
  }
  if (line.startsWith('ERROR')) { post({ t: 'stderr', s: line }); return; }
}

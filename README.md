# Meter Gomoku — 官网 / 文档站

Meter Gomoku（五子棋 AI 训练器）的静态官网与使用说明。中英双语，界面预览由软件自身运行时的
DOM 冻结生成（真实元素 + canvas 转 PNG），只做静态展示、不可交互。

```
index.html            主站（中英双语，单文件）
preview/app-*.html    从运行中的软件抓取的静态界面快照
preview/app.css       软件本体样式（calc.css）
preview/assets/*.png  冻结时转出的 canvas 位图（棋盘 / 曲线）
calc/                 网页版计算器（Rapfi 引擎编译成 WebAssembly，本地/离线计算）
```

## 网页版计算器（calc/）

`calc/` 是一个独立的前端应用：同一颗 Rapfi 引擎以 **WebAssembly（SIMD128）** 形式在浏览器里跑，
NNUE 权重随引擎一起下发，因此**计算完全发生在本地**，没有服务器。

```
calc/index.html       界面（竖屏 9:16 优先）
calc/app.css          样式（浅色 / 深色自适应）
calc/app.js           棋盘绘制、分析调度、仪表盘、设置
calc/worker.js        引擎 Worker：加载 wasm、解析 Gomocup 协议、整轮提交候选
calc/sw.js            离线外壳（缓存 HTML/JS/CSS，在线优先）
calc/engine/          rapfi-single-simd128.js/.wasm + rapfi.data（约 41 MB，含 NNUE 权重）
calc/NOTICE.md        第三方组件与许可
```

要点：

- **离线**：引擎文件在首次打开时写入 Cache Storage（`mgcalc-engine-v1`），页面外壳由 Service Worker
  缓存；断网后重新打开仍可计算。设置里有「清除引擎缓存」。
- **性能**：浏览器没有跨源隔离（GitHub Pages 无法下发 COOP/COEP）时用单线程 wasm，
  约 8~12 万 nps；同样 2.5 s 的深度约为桌面版 1/3。
- **协议**：`START 15` → `INFO RULE/CAUTION_FACTOR/TIMEOUT_*` → `YXBOARD ... DONE` → `YXNBEST n`，
  用「短跑一段 + 用剩下的时间跑一次完整搜索」两段式，兼顾即时反馈与深度。
- **引擎来源**：见 `calc/NOTICE.md`（Rapfi 为 GPL-3.0，权重与构建产物来自官方仓库）。

本地预览：任意静态服务器，例如 `python -m http.server 8000`，然后打开
<http://localhost:8000/>。直接双击 `index.html` 也能看，但部分浏览器会限制 iframe 的
`file://` 访问。

英文版直达：`index.html?lang=en`。

## 生成快照

快照脚本不在本仓库里（依赖软件的调试端口）。流程：以 `GB_WV2_ARGS_EXTRA=--remote-debugging-port=9222`
启动 `Desktop GomokuTrainer.exe`，用 CDP 把界面切到目标状态后把 `document.body` 序列化，
可见 `canvas` 转 PNG 并以 `background-image` 回填。

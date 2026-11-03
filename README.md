# Meter Gomoku — 官网 / 文档站

Meter Gomoku（五子棋 AI 训练器）的静态官网与使用说明，包含主界面、计算分析、引擎设置等界面，
以及从开局到暂停键的完整操作指南。英文说明见 [README.en.md](README.en.md)。

```
index.html            主站（单文件，中英切换、浅色/深色主题）
preview/app-*.html    主界面 / 分析 / 设置的中英文界面页
preview/app.css       软件本体样式
preview/assets/*.png  界面用的棋盘与静态位图
assets/calc.png       站点图标 / favicon
assets/calc-og.png    1200×630 社交分享缩略图
```

- 访问：<https://xiaoxu4452.github.io/Meter-Gomoku/>
- 英文直达：`?lang=en`
- 下载最新版本：<https://github.com/xiaoxu4452/Meter-Gomoku-AI-trainer-Line-Version/releases>
- 本项目 / 站点源码（Pages 部署仓库）：<https://github.com/xiaoxu4452/Meter-Gomoku>

## 两个在线计算器

| 入口 | 是什么 | 地址 |
|---|---|---|
| `/calc/` | **Meter Web**，本站自研的网页版计算器：桌面版同款仪表盘与胜率条、平衡点、双色 AI、棋盘样式与思考时间可调 | <https://xiaoxu4452.github.io/Meter-Gomoku/calc/> |
| 外链 | **Rapfi 官方计算器**（gomocalc，Rapfi 作者维护） | <https://www.gomocalc.com/#/> |

`/calc/` 是纯静态的 HTML + CSS + JS：`worker.js` 用 `importScripts` 加载 Rapfi 的
WebAssembly 构建并直接跑引擎协议，`sw.js` 注入 COOP/COEP（让 pthread 多线程可用）并把
41 MB 的引擎与权重缓存进 Cache Storage；站点无法访问时会按顺序改走 GitHub 公共镜像。
它只做计算，不含对弈、复盘、识图、连线。

```
calc/index.html   界面（竖屏棋盘在上、仪表盘在下；横屏两栏）
calc/app.js       棋盘绘制、分析调度、设置与中英切换
calc/worker.js    引擎桥接 + 资源预加载进度
calc/sw.js        COOP/COEP 注入、外壳与引擎缓存、镜像回退
calc/engine/      Rapfi WASM 与 NNUE 权重（约 41 MB）
calc/serve.py     本地预览（带 COOP/COEP 头）
```

## 本地预览

任意静态服务器，例如 `python -m http.server 8000` 后打开 <http://localhost:8000/>。直接双击也能看，
但部分浏览器会限制 iframe 对 `file://` 的访问。

## 更新界面页

界面页的更新脚本不在本仓库里（依赖软件的调试端口）。流程：以 `GB_WV2_ARGS_EXTRA=--remote-debugging-port=9222`
启动 `Desktop GomokuTrainer.exe`，把界面切到目标状态后导出 `document.body`，并把可见 `canvas`
转成 PNG、以 `background-image` 回填。

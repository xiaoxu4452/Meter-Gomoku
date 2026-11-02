# 第三方组件与许可 / Third-party components

本目录（`/calc/`）里的网页版计算器把 **Rapfi** 引擎编译成 WebAssembly 后在浏览器本地运行。

- **Rapfi** — 五子棋 / 连珠引擎，作者 dhbloo（dotb1ue 维护 fork）
  <https://github.com/dotb1ue/rapfi> · 许可证 **GPL-3.0**
- **NNUE 权重**（`mix9svq`，`engine/rapfi.data` 内）来自 Rapfi 官方权重仓库
  <https://github.com/dotb1ue/rapfi-networks>
- **WASM 构建产物**（`engine/rapfi-single-simd128.js` / `.wasm`）与引擎调用方式参考
  gomoku-calculator <https://github.com/dotb1ue/gomoku-calculator> 与 <https://www.gomocalc.com/>

`engine/` 下的三个文件是上述开源项目的编译产物，未做修改；Rapfi 以 GPL-3.0 分发，
对应源码见上面的仓库地址。本目录其余文件（`index.html`、`app.css`、`app.js`、`worker.js`、`sw.js`）
是本项目的原创前端代码。

如果你再分发本页面，请保留本文件与上述链接。

---

The web calculator in this folder runs the **Rapfi** engine compiled to WebAssembly, locally in the browser.

- **Rapfi** — gomoku/renju engine by dhbloo (fork maintained by dotb1ue),
  <https://github.com/dotb1ue/rapfi>, licensed **GPL-3.0**
- **NNUE weights** (`mix9svq`, bundled in `engine/rapfi.data`) come from
  <https://github.com/dotb1ue/rapfi-networks>
- The **WASM build** (`engine/rapfi-single-simd128.js` / `.wasm`) and the engine protocol usage follow
  <https://github.com/dotb1ue/gomoku-calculator> and <https://www.gomocalc.com/>

The three files under `engine/` are unmodified build artifacts of those open-source projects;
Rapfi is distributed under GPL-3.0 and its source is available at the link above.
Everything else in this folder (`index.html`, `app.css`, `app.js`, `worker.js`, `sw.js`) is original
front-end code for this project.

Keep this file and the links above if you redistribute the page.

# Meter Gomoku — 官网 / 文档站

Meter Gomoku（五子棋 AI 训练器）的静态官网与使用说明。中英双语，界面预览由软件自身运行时的
DOM 冻结生成（真实元素 + canvas 转 PNG），只做静态展示、不可交互。

```
index.html            主站（中英双语，单文件）
preview/app-*.html    从运行中的软件抓取的静态界面快照
preview/app.css       软件本体样式（calc.css）
preview/assets/*.png  冻结时转出的 canvas 位图（棋盘 / 曲线）
```

本地预览：任意静态服务器，例如 `python -m http.server 8000`，然后打开
<http://localhost:8000/>。直接双击 `index.html` 也能看，但部分浏览器会限制 iframe 的
`file://` 访问。

英文版直达：`index.html?lang=en`。

## 生成快照

快照脚本不在本仓库里（依赖软件的调试端口）。流程：以 `GB_WV2_ARGS_EXTRA=--remote-debugging-port=9222`
启动 `Desktop GomokuTrainer.exe`，用 CDP 把界面切到目标状态后把 `document.body` 序列化，
可见 `canvas` 转 PNG 并以 `background-image` 回填。

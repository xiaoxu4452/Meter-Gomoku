# Meter Gomoku — Website

Static site and usage guide for Meter Gomoku, a Gomoku AI trainer for Windows. It covers the main
window, analysis tools and engine settings, plus a full walkthrough from starting a game to the
three-state pause key. Chinese version: [README.md](README.md).

```
index.html            main page (single file, ZH/EN toggle, light/dark theme)
preview/app-*.html    main / analysis / settings interface pages in both languages
preview/app.css       the app's own stylesheet
preview/assets/*.png  board and static bitmaps used by the interface
assets/calc.png       site icon / favicon
assets/calc-og.png    1200×630 social preview image
```


- Download the desktop version: <https://github.com/xiaoxu4452/Meter-Gomoku-AI-trainer-Line-Version/releases>

## Two online calculators

| Entry | What it is | URL |
|---|---|---|
| `/calc/` | **Meter Web** — this project's own web calculator: the desktop dashboard and win-rate bar, balance points, per-colour AI, 15 board palettes, stone style and think time | <https://xiaoxu4452.github.io/Meter-Gomoku/calc/> |
| External | **Rapfi official calculator** (gomocalc, maintained by the Rapfi author) | <https://www.gomocalc.com/#/> |

`/calc/` is plain static HTML + CSS + JS: `worker.js` loads the Rapfi WebAssembly build with
`importScripts` and speaks the engine protocol directly; `sw.js` injects COOP/COEP (so the pthread
build can use several threads) and caches the 41 MB engine package in Cache Storage; when the site
itself is unreachable the files are pulled through public GitHub mirrors instead. It is calculation
only — no play, review, vision or Link.

```
calc/index.html   UI (board above the dashboard in portrait, two columns in landscape)
calc/guide.html   the full manual (bilingual, with a left-hand contents list built from the sections)
calc/app.js       board drawing, search scheduling, settings, ZH/EN switching
calc/worker.js    engine bridge + asset preloading progress
calc/sw.js        COOP/COEP injection, shell and engine caches, mirror fallback
calc/engine/      Rapfi WASM and NNUE weights (~41 MB)
calc/serve.py     local preview with COOP/COEP headers
calc/manifest.json, theme.js, icon-*.png
                  installable as a standalone app (PWA shell, theme colour, icons)
```



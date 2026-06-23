## v17 正在比赛国家名显示修正版

本版基于 v13，仅调整赛程详情弹出页默认 Tab。

### 更新内容

- 点击赛程卡片后，默认进入「前瞻」。
- 「赔率」Tab 仍然保留，赔率图片上传功能不变。
- 移动端赛程卡片稍大版样式保持不变。
- Service Worker 缓存名更新为 `wc2026-pwa-v17-live-card-name-full`。

### 发布文件

覆盖 GitHub Pages：

```text
index.html
assets/
manifest*.webmanifest
sw.js
worldcup-cloud/
README.md
```

`worldcup-storage-worker.js` 不需要重新部署。


### v17 更新
- 移动端正在比赛卡片加宽，避免“塞内加尔”等较长国家名被截断。
- 保持 V16 的横向原生惯性滑动和点击进入详情能力。

## v3 赔率页图片上传版

基于 v2：

- 去除预测页里的直播内容展示。
- 顶部第二个 Tab 从「直播」改为「赔率」。
- 原来的比赛图片上传模块移动到「赔率」Tab。
- 「前瞻」Tab 不再显示图片上传区域。
- PC / 移动端顶部比分卡片继续沿用紧凑版。
- Service Worker 缓存名更新为 `wc2026-pwa-v3-odds-images`。

发布 GitHub Pages 时覆盖：

```text
index.html
assets/
manifest*.webmanifest
sw.js
worldcup-cloud/
README.md
```

`worldcup-storage-worker.js` 不需要重新部署。

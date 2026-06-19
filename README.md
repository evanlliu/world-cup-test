## v7 原图上传版

基于 v6：

- 上传赔率图片时不再压缩图片。
- 不再使用 canvas 把图片转成 1600px / JPEG。
- 长截图、赔率长图会按原始文件上传到 GitHub，放大查看更清晰。
- 保留 v6 的设备语言 App 名称：中文 `世界杯2026`，英文 `World Cup 2026`，土耳其语 `Dünya Kupası 2026`。
- 保留赔率 Tab 图片上传、查看、双指缩放、删除功能。
- Service Worker 缓存名更新为 `wc2026-pwa-v7-original-images`。

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

注意：旧版本已经压缩上传过的图片不会自动变清晰，需要删除后重新上传原图。

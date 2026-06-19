## v10 PC 图片拖动版

基于 v9。

### 本版更新

- PC 端图片查看器支持鼠标拖动：图片放大后，按住左键即可拖动查看细节。
- PC 端继续支持鼠标滚轮放大 / 缩小。
- 移动端继续支持双指缩放、单指拖动。
- 继续保持原图上传、原图查看、实时从 GitHub / Worker 拉取图片，不使用旧图片缓存。
- Service Worker 缓存名更新为 `wc2026-pwa-v10-pc-drag-original-viewer`。

### 发布说明

GitHub Pages 覆盖：

```text
index.html
assets/
manifest*.webmanifest
sw.js
worldcup-cloud/
README.md
```

Cloudflare 图片 Worker 建议继续使用 v9 的 `worldcup-storage-worker.js` 或同步覆盖本包中的同名文件。

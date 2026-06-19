## v9 原图清晰查看 + 实时拉取图片版

基于 v8 继续优化图片模块。

### 本次更新

- 上传仍然保持原图，不压缩、不转 JPEG。
- 图片查看器改为按图片自然像素渲染，再按适配比例缩放，避免放大时使用缩略图/低分辨率位图导致模糊。
- 打开赔率图片页时，每次都重新请求 Worker/GitHub 的最新图片列表，不再先显示 localStorage 缓存。
- 图片 URL 增加实时 cache bust 参数，避免浏览器继续显示旧图片。
- `worldcup-storage-worker.js` 的图片读取响应改为 `Cache-Control: no-store`，避免 Worker 图片被长期缓存。
- PC 端支持鼠标滚轮以鼠标位置为中心放大/缩小。
- 移动端双指缩放继续保留，且以双指中心缩放。
- Service Worker 缓存名更新为 `wc2026-pwa-v9-clear-original-viewer`。

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

Cloudflare 图片 Worker 建议同步覆盖：

```text
worldcup-storage-worker.js
```

已经上传过的低清/压缩图片不会自动变清晰，需要删除后重新上传原图。

## v8 原图上传 + 图片无限放大版

基于 v7。

### 本次修改

- 上传图片继续保持原图，不压缩、不转 JPEG。
- 图片查看器取消 5 倍放大上限。
- 点击「＋」可以持续放大，不再限制最大倍数。
- 移动端双指缩放也取消最大倍数限制。
- Service Worker 缓存名更新为 `wc2026-pwa-v8-unlimited-zoom`。

### 发布说明

覆盖 GitHub Pages 文件即可：

- `index.html`
- `assets/`
- `manifest*.webmanifest`
- `sw.js`
- `worldcup-cloud/`
- `README.md`

`worldcup-storage-worker.js` 不需要重新部署。

注意：发布后请清理浏览器/PWA缓存，否则可能继续使用旧版图片查看器。

# 2026 世界杯赛程 PWA

这是一个适合部署到 GitHub Pages 的 2026 世界杯赛程 PWA 页面，支持 PC 和手机端访问，也适合在 iPhone Safari 中“添加到主屏幕”当作 App 使用。

当前版本：v96 比赛图片云端存储修正版  
基础优化来源：v94 刷新按钮图标版

---

## 一、项目功能

- 展示 2026 世界杯赛程。
- 支持中文、英文、土耳其语多语言配置。
- 支持 PC 端和移动端自适应。
- 支持 iOS Safari 添加到主屏幕。
- 支持页面基础资源离线缓存。
- 支持实时比分刷新。
- 支持 AI 预测页。
- 支持 AI 预测页顶部固定背景图。
- 支持每场比赛上传多张图片到 GitHub，并在打开比赛详情后懒加载查看。

---

## 二、文件结构

```text
world-cup-main/
├─ index.html
├─ sw.js
├─ score-proxy-worker.js
├─ worldcup-storage-worker.js
├─ manifest.webmanifest
├─ manifest.zh.webmanifest
├─ manifest.en.webmanifest
├─ manifest.tr.webmanifest
├─ worldcup-cloud/
│  ├─ config.json
│  └─ match-images/
├─ assets/
│  ├─ css/
│  │  └─ app.css
│  ├─ js/
│  │  └─ app.js
│  └─ prediction-hero-bg.jpg
└─ icons/
   ├─ icon-180.png
   ├─ icon-192.png
   └─ icon-512.png
```

说明文档已经统一合并到本 `README.md` 中，项目中不再单独保留其他说明 `.txt` 或 `.md` 文件。

---

## 三、GitHub Pages 部署步骤

1. 新建 GitHub 仓库，例如：`worldcup-2026-schedule`。
2. 把本文件夹里的所有文件上传到仓库根目录。
3. 打开仓库 `Settings` → `Pages`。
4. `Source` 选择 `Deploy from a branch`。
5. `Branch` 选择 `main`，目录选择 `/root`。
6. 等待 GitHub Pages 生成访问地址。
7. 用 iPhone Safari 打开该地址。
8. 点击 Safari 底部分享按钮。
9. 选择“添加到主屏幕”。

---

## 四、部署注意事项

- GitHub Pages 是 HTTPS，满足 PWA / Service Worker 的基本要求。
- 页面基础赛程和静态资源会缓存到手机本地。
- 首次打开需要联网。
- 如果更新后 iPhone 主屏幕 App 仍然显示旧内容，可以先在 Safari 中刷新页面，必要时删除旧主屏幕图标后重新添加。
- GitHub Pages 区分大小写，例如 `.jpg` 和 `.JPG` 是不同文件。

---

## 五、实时比分说明

页面实时比分默认调用 ESPN scoreboard 数据。

当前版本已经做了性能优化：

- 实时比分刷新间隔为 30 秒。
- 比分没有变化时，不再强制整页重绘。
- 赛程和比分接口不强制缓存，避免比分变旧。

如果直接访问 ESPN JSON 被浏览器跨域限制，建议使用 Cloudflare Worker 中转。

---

## 六、Cloudflare Worker 实时比分中转配置

### 为什么需要 Worker？

- GitHub Pages / iOS Safari 直接请求 ESPN JSON 时，可能被 CORS 或网络策略拦截。
- Worker 在服务端请求 ESPN，再把 JSON 返回给网页，稳定性更好。

### 配置步骤

1. 打开 Cloudflare Dashboard。
2. 进入 `Workers & Pages`。
3. 创建一个 Worker。
4. 把 `score-proxy-worker.js` 里的代码全部复制进去。
5. 点击 `Deploy`。
6. 复制你的 Worker 地址，例如：

```text
https://wc-score-proxy.xxxx.workers.dev
```

7. 打开 `assets/js/app.js`，搜索：

```js
const SCORE_PROXY_BASE = "";
```

8. 改成你的 Worker 地址：

```js
const SCORE_PROXY_BASE = "https://wc-score-proxy.xxxx.workers.dev";
```

9. 重新上传到 GitHub Pages。

### Worker 测试地址

部署后可以访问：

```text
https://你的worker.workers.dev/score/header
```

如果返回 JSON，说明 Worker 正常。

### 是否需要上传 `score-proxy-worker.js` 到 GitHub Pages？

严格来说不需要。  
它是给 Cloudflare Worker 使用的代码文件，不是网页运行必须文件。  
不过保留在项目里方便以后查看和复制部署。

---

## 七、AI 预测页顶部背景图

AI 预测页顶部固定背景图路径：

```text
assets/prediction-hero-bg.jpg
```

要求：

1. 文件名必须是 `prediction-hero-bg.jpg`。
2. `assets` 文件夹必须和 `index.html` 同级。
3. GitHub Pages 区分大小写，`jpg` 和 `JPG` 不一样。
4. 建议图片比例为 16:9 或更宽，例如 `1200x600`、`1600x800`。
5. 替换图片后，如果 iOS 主屏幕 App 不更新，请先 Safari 刷新，必要时删除主屏幕图标重新添加。

---

## 八、v86 第二轮优化说明

本轮优化目标：在不改变现有功能和 UI 的前提下，继续降低 `index.html` 臃肿度，并减少重复解析、重复 DOM 重绘。

### 1. 文件结构拆分

- `index.html` 由约 3477 行降为约 130 行。
- 样式拆分到 `assets/css/app.css`。
- 主逻辑拆分到 `assets/js/app.js`。
- 便于浏览器缓存，也便于后续维护。

### 2. 赛程数据预处理

- 新增 `app.matchItems`。
- 赛程加载后统一解析 kickoff 时间和 `_idx`。
- `filteredMatches`、直播区、比分请求候选、AI 预测页复用预处理后的比赛对象。
- 减少 render 时反复 `parseKickoff`。

### 3. DOM 重绘保护

- 新增 `setHtmlIfChanged`。
- 比赛列表 HTML 不变时，不重复执行 `content.html(...)`。
- 直播面板 HTML 不变时，不重复执行 `panel.html(...)`。
- 日期栏 HTML 不变时，不重复重建日期按钮。

### 4. PWA 缓存更新

- Service Worker 缓存名更新为 `wc2026-pwa-v87-readme-clean`。
- 缓存 `app.css`、`app.js`、`prediction-hero-bg.jpg` 等核心静态资源。

### 5. 检查结果

- `assets/js/app.js` 通过 JS 语法检查。
- `sw.js` 通过 JS 语法检查。
- `score-proxy-worker.js` 通过 JS 语法检查。
- HTML 中引用的本地静态资源均存在。
- JS 中引用的 HTML id 均存在，动态创建的 `flagPreloadPool` 除外。

### 6. 注意

- 本轮未改页面视觉风格。
- 本轮未删除核心功能。
- jQuery 仍保持 CDN 引用，和之前版本一致。

---

## 九、v85 第一轮优化说明

v85 主要是低风险性能优化：

1. 实时比分刷新优化。
2. `render()` 和 `applyLang()` 解耦。
3. 比分查找改成索引。
4. 减少首次加载重复渲染。
5. 减少前后台切换重复请求。
6. 删除一批无用 JS / CSS / 调试代码。
7. 更新 PWA 缓存版本。
8. 语法检查通过。

---

## 十、当前建议

如果页面部署后仍然感觉卡顿，优先检查：

1. 是否已经部署 Cloudflare Worker 实时比分代理。
2. `assets/js/app.js` 里的 `SCORE_PROXY_BASE` 是否已经填写 Worker 地址。
3. iPhone Safari 是否仍在使用旧 Service Worker 缓存。
4. 是否删除旧主屏幕图标并重新添加。

如果只是修改 README，不会影响页面运行。  
如果修改 CSS / JS / 图片，建议同时更新 `sw.js` 里的缓存版本号，避免用户继续读取旧缓存。

## V88 第三轮性能优化

- 缓存 `Intl.DateTimeFormat` 实例，减少赛程列表渲染时反复创建格式化器的开销。
- 赛程加载后为每场比赛预计算日期 key、阶段 key、比分匹配 key 和 ESPN eventId，减少每次渲染时的重复计算。
- 国旗预加载改为分批空闲加载，避免首屏一次性请求过多国旗图片。
- 修复 CSS 拆分后 AI 预测页背景图的相对路径，避免无效 404 请求。
- 更新 PWA 缓存版本到 `wc2026-pwa-v88-speed-optimized`。

## v89 更新说明

- 在页面标题、浏览器标题和 PWA 名称中的“2026 世界杯 / World Cup 2026 / Dünya Kupası 2026”后增加版本号 `v89`。
- 更新 Service Worker 缓存名为 `wc2026-pwa-v89-title-version`，避免部署后继续读取旧缓存。

## v91 更新说明

- 参考行程计划页面的版本号样式，把页面主标题里的版本号改为绿色圆角徽章。
- 页面显示为：`2026 世界杯` + 独立 `v91` 徽章，避免普通文字版本号显得生硬。
- 浏览器标题、PWA 名称和多语言 Manifest 同步更新为 `v91`。
- 更新 Service Worker 缓存名为 `wc2026-pwa-v91-performance-plus`。



## v93 更新：预测页直播模块

- 预测详情页的“直播”标签已接入功能，不再弹出提示。
- 直播页显示当前比分、比赛状态、更新时间、数据源、赛事 ID 和比赛地点。
- 如果实时接口返回进球球员，会自动生成直播事件时间线。
- 支持手动刷新当前比赛直播数据，UI 风格保持与预测页一致。

## v94 更新：刷新数据按钮位置调整

- 将“刷新数据”按钮从筛选工具栏移动到右上角语言切换按钮前面。
- 刷新按钮改为图标按钮，减少文字占用，移动端更简洁。
- 保持原有刷新功能不变：点击后重新加载赛程并刷新实时比分。
- Service Worker 缓存名更新为 `wc2026-pwa-v94-refresh-icon`。

## v96 更新：比赛图片 GitHub 云端存储

- 新增 `worldcup-storage-worker.js`，用于把比赛图片通过 Cloudflare Worker 上传到 GitHub。
- 新增 `worldcup-cloud/config.json`，前端会从这里读取 Worker 地址和上传密码，实现不同设备免重复配置。
- 新增 `worldcup-cloud/match-images/` 作为 GitHub 图片根目录，每场比赛会自动生成独立子文件夹。
- 在比赛预测详情页新增“比赛图片”模块。首页不加载图片，只有打开某场比赛后才加载该场图片。
- 支持一次选择多张图片上传；前端会自动压缩为 JPG，默认最长边 1600px，质量 0.82。
- 支持图片缩略图查看、点击放大、上一张/下一张、放大/缩小/还原、删除图片。
- Service Worker 缓存名更新为 `wc2026-pwa-v96-match-images`。

### 图片云端配置步骤

1. 部署 `worldcup-storage-worker.js` 到 Cloudflare Worker。
2. 在 Worker 的 Variables and secrets 中配置：

```text
Secret:
APP_PASSWORD
GH_TOKEN

Plaintext:
GH_OWNER
GH_REPO
GH_BRANCH
IMAGE_ROOT
```

建议：

```text
GH_OWNER     evanlliu
GH_REPO      travel-plan
GH_BRANCH    main
IMAGE_ROOT   worldcup-cloud/match-images
```

3. 修改前端仓库里的 `worldcup-cloud/config.json`：

```json
{
  "enabled": true,
  "workerBaseUrl": "https://你的-worker-name.你的账号.workers.dev",
  "appPassword": "和 Cloudflare Secret APP_PASSWORD 一样的密码",
  "imageRoot": "worldcup-cloud/match-images",
  "maxImageWidth": 1600,
  "jpegQuality": 0.82
}
```

4. 上传代码到 GitHub Pages 后，不同设备打开页面都会读取同一个 `config.json`。

注意：本版本按需求把 `appPassword` 放在公开配置文件里，方便多设备免配置；这也意味着知道页面地址的人可以看到该密码。正式内网或公开场景下，更安全的做法是上传/删除时手动输入密码，不把密码放前端配置。



## v96 更新：比赛图片上传排查修复

- 配置文件读取增加时间戳，避免 Service Worker / 浏览器缓存导致读取旧配置。
- 图片加载、上传、删除失败时显示 HTTP 状态和 Worker 返回 message，方便定位。
- 上传时 Console 增加 `[match-images]` 调试日志。
- 直播页也显示“比赛图片”模块。
- 前端生成图片 `id`，删除和 manifest 维护更稳定。
- 更新 Service Worker 缓存名为 `wc2026-pwa-v96-match-images`。

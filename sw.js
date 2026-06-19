const CACHE_NAME = 'wc2026-pwa-v96-match-images';
const APP_SHELL = [
  './',
  './index.html',
  './assets/css/app.css?v=95',
  './assets/js/app.js?v=95',
  './assets/prediction-hero-bg.jpg?v=95',
  './worldcup-cloud/config.json?v=96',
  './manifest.webmanifest',
  './manifest.zh.webmanifest',
  './manifest.en.webmanifest',
  './manifest.tr.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 赛程、实时比分、图片 Worker、云端配置走网络优先，避免比分和图片配置变旧。
  if (url.pathname.includes('/worldcup-cloud/config.json') || url.hostname.includes('raw.githubusercontent.com') || url.hostname.includes('espn.com') || url.hostname.includes('allorigins.win') || url.hostname.includes('corsproxy.io') || url.hostname.includes('r.jina.ai') || url.hostname.includes('workers.dev')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request, {ignoreSearch:true})));
    return;
  }

  // 页面和静态资源：优先缓存，缓存没有再联网。
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

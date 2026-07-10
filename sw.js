// 축구창고 PWA 서비스워커 — 같은 도메인만 개입, 네트워크 우선(항상 최신) + 오프라인 캐시 폴백
var CACHE = "chukgu-v1";
var ASSETS = ["/", "/index.html", "/logo_header.png", "/favicon.png", "/icon-192.png", "/manifest.json"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return; // 뉴스 API 등 외부 요청은 건드리지 않음
  e.respondWith(
    fetch(e.request).then(function (r) {
      var clone = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      return r;
    }).catch(function () {
      return caches.match(e.request).then(function (m) { return m || caches.match("/index.html"); });
    })
  );
});

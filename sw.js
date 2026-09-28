/* Caches the app shell so a repeat open paints without touching the network.
   Data is never cached here — it lives in localStorage and comes from the
   Apps Script backend, which this worker deliberately does not intercept. */

var CACHE = 'fams-shell-v1';
var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.indexOf('script.google.com') !== -1) return;   // never cache data calls

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        // Serve the cached shell at once, refresh it quietly for next time.
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(req).catch(function () { return caches.match('./index.html'); });
    })
  );
});

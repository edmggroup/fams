// Minimal service worker: caches the app shell (this single-file app) so it
// still opens even with a flaky connection, and satisfies the installability
// requirement for "Add to Home Screen" on Android/Chrome. It does NOT cache
// data from the Apps Script backend — that always goes over the network, so
// you're never looking at stale progress data.
const CACHE_NAME = 'fams-plus-shell-v2';
const SHELL_FILES = ['./index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin GET requests for the shell itself. Everything
  // else (in particular, all calls to script.google.com) passes straight
  // through to the network untouched.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // NETWORK-FIRST, falling back to cache only when the network request
  // fails (offline, or a flaky connection) — NOT the other way around.
  // A cache-first strategy (try the cache, refresh it in the background for
  // next time) sounds reasonable but has a real bug in practice: every push
  // of a new index.html to GitHub Pages would keep showing the PREVIOUS
  // version for one whole extra reload, because the stale cached copy was
  // always served immediately while the fresh copy only got cached for
  // *next* time. That's exactly the "I pushed changes but the site still
  // looks old" symptom — network-first fixes it structurally, so nobody
  // has to remember to bump CACHE_NAME just to make an update visible.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

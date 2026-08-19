const CACHE_NAME = 'barghyar-v5';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './db.js',
    './auth.js',
    './sync.js',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});

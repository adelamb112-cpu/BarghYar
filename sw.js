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

// نصب و ذخیره کدهای جدید
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// پاکسازی کش‌های قدیمی (v4 و قبل‌تر)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// پاسخ‌دهی به درخواست‌ها
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});

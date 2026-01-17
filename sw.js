const CACHE_NAME = 'camale-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './assets/logo.jpg',
    './js/app.js',
    './js/ui.js',
    './js/data.js',
    './js/admin.js',
    './js/drive-api.js',
    './js/config.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // IGNORAR COMPLETAMENTE Google APIs y Drive content
    // Esto previene errores de CORS y asegura que los datos siempre vengan frescos de la red
    if (event.request.url.includes('googleapis.com') ||
        event.request.url.includes('googleusercontent.com') ||
        event.request.url.includes('drive.google.com')) {
        return; // Deja que el navegador maneje la petición normalmente
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                });
            })
    );
});

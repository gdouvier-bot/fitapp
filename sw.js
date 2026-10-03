const CACHE_NAME = 'fitapp-pro-v2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js'
];

// 1. Installation : Mise en cache tolérante (Tolère les pannes individuelles)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of ASSETS_TO_CACHE) {
        try {
          await cache.add(new Request(url, { mode: 'cors' }));
        } catch (err) {
          try {
            // Fallback no-cors pour requêtes opaques CDN
            const response = await fetch(url, { mode: 'no-cors' });
            await cache.put(url, response);
          } catch (fallbackErr) {
            console.warn(`[SW] Impossible de mettre en cache : ${url}`);
          }
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// 2. Activation : Nettoyage des anciens caches et prise de contrôle
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[SW] Nettoyage ancien cache : ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interception Réseau
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Ignorer requêtes non-GET, non-HTTP(S) et API Firebase dynamiques
  if (
    e.request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Stratégie : Stale-While-Revalidate pour les assets statiques et HTML
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // En cas de panne réseau complète et d'absence de cache pour la navigation
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });

      // Si présent en cache, répondre immédiatement, sinon attendre le réseau
      return cachedResponse || fetchPromise;
    })
  );
});

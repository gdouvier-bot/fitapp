const CACHE_NAME = 'fitapp-pro-v1';
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

// Installation : Mise en cache des ressources essentielles
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activation : Nettoyage des anciens caches et prise de contrôle immédiate
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

// Interception des requêtes réseau (Stratégie Network First avec fallback sur Cache)
self.addEventListener('fetch', (e) => {
  // Ignorer les requêtes non-GET ou vers Firebase Auth/Firestore
  if (e.request.method !== 'GET' || e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Si la réponse est valide, on met à jour le cache dynamiquement
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // En cas de panne de réseau / hors-ligne, on sert la ressource depuis le cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si la page demandée n'est pas trouvée, retourner l'index
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

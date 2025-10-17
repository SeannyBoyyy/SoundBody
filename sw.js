const CACHE_NAME = 'soundbody-v2.6';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/workout.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the fetched response
          caches.open(CACHE_NAME)
            .then((cache) => {
              // Only cache GET requests
              if (event.request.method === 'GET') {
                cache.put(event.request, responseToCache);
              }
            });

          return response;
        }).catch(() => {
          // Return a custom offline page if available
          return caches.match('/index.html');
        });
      })
  );
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-exercises') {
    event.waitUntil(syncExercises());
  }
});

async function syncExercises() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json');
    const data = await response.json();
    const cache = await caches.open(CACHE_NAME);
    await cache.put('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json', 
      new Response(JSON.stringify(data)));
    console.log('Service Worker: Exercises synced');
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
  }
}

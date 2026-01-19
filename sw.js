// Service Worker para Roleta de Filmes (PWA)
const CACHE_NAME = 'filmes-v1';

// Instalação - apenas ativa o SW
self.addEventListener('install', event => {
    self.skipWaiting();
});

// Ativação
self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// Fetch - passa direto para a rede (sem cache)
self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request));
});

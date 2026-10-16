// Минимальный Service Worker: нужен для установки на главный экран.
// Кэширование для офлайн-режима можно добавить позже в обработчик fetch.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});

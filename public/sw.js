// Retire the previous Qihua shell cache when replacing the application.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("infinite-canvas-shell-")) await caches.delete(key);
    }
    await self.clients.claim();
    await self.registration.unregister();
  })());
});

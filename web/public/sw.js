// Funciona sem internet depois da 1ª visita. Sempre tenta a rede primeiro,
// então cada push novo no GitHub chega na próxima vez que abrir com internet.
const CACHE = "midias-igreja-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return r;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("./"))),
  );
});

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Service worker (SvelteKit lo registra solo): cachea el build completo para
// que la app abra sin conexión. Cada deploy tiene su `version`, así que la
// caché vieja se descarta al activar el nuevo worker (la app nueva se toma al
// recargar). Los datos del usuario nunca pasan por aquí: viven en su carpeta.

import { build, files, prerendered, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cuentas-${version}`;
const ASSETS = new Set([...build, ...files, ...prerendered]);

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...ASSETS]))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== sw.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // Archivos del build: siempre desde caché.
      if (ASSETS.has(url.pathname)) {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
      }

      // Navegación u otros: red primero, caché como respaldo (offline).
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = (await cache.match(req)) ?? (req.mode === "navigate" ? await cache.match(indexPath()) : undefined);
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});

/** Página prerenderizada raíz ("/" o "/cuentas/"), para navegar offline. */
function indexPath(): string {
  return prerendered.find((p) => p.endsWith("/")) ?? "/";
}

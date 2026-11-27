/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Service worker (SvelteKit lo registra solo): permite abrir la app sin
// conexión. Los datos del usuario nunca pasan por aquí: viven en su carpeta.
//
// Estrategia:
// - `_app/immutable/*` (nombre con hash, nunca cambia): caché primero.
// - Todo lo demás (index.html, manifest, íconos, version.json): red primero,
//   revalidando la caché HTTP (`no-cache`), con la caché del worker solo como
//   respaldo offline. El HTML NUNCA se sirve primero desde caché: cambia en
//   cada deploy y, si se queda pegado, la app no se actualiza nunca.
// - Al instalar se descarga todo saltándose la caché HTTP (`reload`): GitHub
//   Pages manda max-age=600 y sin esto el worker nuevo podía guardar el HTML
//   del deploy anterior.

import { build, files, prerendered, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cuentas-${version}`;
const PRECACHE = [...build, ...files, ...prerendered];

function isImmutable(pathname: string): boolean {
  return pathname.includes("/_app/immutable/");
}

sw.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (path) => {
          const res = await fetch(new Request(path, { cache: "reload" }));
          if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
          await cache.put(path, res);
        }),
      );
      await sw.skipWaiting();
    })(),
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

      if (isImmutable(url.pathname)) {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
      }

      try {
        // Una Request de navegación no acepta RequestInit (TypeError): se arma una nueva.
        const res = await fetch(
          isImmutable(url.pathname) ? req : new Request(url.href, { cache: "no-cache" }),
        );
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit =
          (await cache.match(req)) ??
          (await cache.match(url.pathname)) ??
          (req.mode === "navigate" ? await cache.match(indexPath()) : undefined);
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

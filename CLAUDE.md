# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

PWA estática (SvelteKit + Svelte 5 + Tailwind, desplegada en GitHub Pages: https://fs-frost.github.io/cuentas/) para gestionar comprobantes de pago organizados en carpetas con la estructura `[año]/[mes]/[servicio]/[comprobantes]`, dentro de una carpeta del equipo del usuario a la que accede con la **File System Access API**. El estado pagado/pendiente de un servicio se **deriva** de si tiene archivos (nunca se guarda). Ver README.md para el detalle funcional.

La versión anterior era una app de escritorio Electrobun; quedó en el tag `desktop-final` y ya no se mantiene. Ambas usan la misma estructura de carpetas y el mismo `.cuentas.json` (`version: 1`).

## Comandos

```bash
bun install
bun run test        # tests con bun:test (tests/*.test.ts)
bun run dev         # vite dev en http://localhost:5000
bun run build       # build estático a build/ (en CI con BASE_PATH=/cuentas)
bun run preview     # sirve build/
bun run typecheck   # svelte-kit sync + tsc --noEmit
bun run check       # svelte-kit sync + svelte-check
bun run lint        # check + eslint .
bun run make:icon   # regenera static/icon-192.png e icon-512.png
```

Un solo test: `bun test tests/accounts.test.ts -t "nombre del test"`.

En Git Bash (Windows), para compilar con base path hay que evitar la conversión de rutas: `MSYS_NO_PATHCONV=1 BASE_PATH=/cuentas bun run build`.

## Arquitectura

Todo corre en el navegador; no hay backend. Capas:

- **`src/lib/domain/`** — lógica pura de dominio.
  - `accounts.ts` — listar/crear periodos-meses-servicios-archivos, importar, renombrar, borrar, plantilla de recurrentes, copiar mes anterior, búsqueda, pendientes. Recibe un `Fs` como primer parámetro; no sabe de navegador ni de node.
  - `naming.ts` — parseo/formato tolerante de nombres de mes (`NN. Nombre`), categoría de servicio (prefijo `[X]`), validación de nombres y colisiones de archivos. Puro.
  - `metadata.ts` — lectura/escritura de `.cuentas.json` (notas + recurrentes) con read-modify-write.
  - `types.ts` — modelos (`ServiceInfo`, `TargetRef`, `OpResult`, etc.).
- **`src/lib/fs/`** — abstracción de filesystem.
  - `port.ts` — interfaz `Fs` (rutas como arrays de segmentos relativos a la raíz) y `renameWithFallback` (intenta `move()` nativo; si no existe o falla, copia recursiva + borrado).
  - `browser.ts` — `Fs` sobre `FileSystemDirectoryHandle`. Escrituras con `createWritable()` (atómicas).
  - `fs-access.d.ts` — tipos de la API que lib.dom aún no trae (`showDirectoryPicker`, permisos, `move`).
- **`src/lib/root.ts`** — selección de la carpeta raíz (`chooseFolder`, sin guardar), persistencia del handle en IndexedDB (`saveRoot`, solo tras validar) y permisos (`unsupported` / `none` / `needs-permission` / `ready`).
- **`src/lib/api.ts`** — fachada que usa la UI: un método por operación, devuelve `OpResult` (o variantes con contador) en vez de lanzar. Opera sobre el `Fs` activo (`setFs`).
- **`src/lib/store.svelte.ts`** — estado global de UI (runes). Sin watcher. Al volver el foco (`focus`/`visibilitychange`) `refreshOnFocus` relee solo el mes visible y recalcula los pendientes del año (12 meses) como mucho cada 5 min (`PENDING_REFRESH_MIN_MS`); el botón Recargar (`reload`) relee todo. `refreshTick` avisa a los paneles del mes (ServicePanel) y `pendingTick` al de pendientes (PendingPanel), para que un foco no dispare la lectura del año.
  - `pickRoot(mode)` — `"existing"` (ya tiene carpeta; también lo usa "Cambiar carpeta") o `"new"` (empezar desde cero: crea el año actual con sus 12 meses). Antes de guardar valida con `accounts.inspectRoot`: si la carpeta parece un año (nombre de 4 dígitos o contiene carpetas de mes, y sin periodos propios) muestra `rootWarning` y no la usa; en `"new"`, si no está vacía (entradas que no son periodos ni ocultos/sistema) pide confirmación (`pendingStart` → `confirmStart`/`cancelStart`); si ya tiene periodos, la abre tal cual.
- **`src/lib/openFile.ts`** — abrir comprobantes: PDF/imagen en pestaña nueva (blob con MIME por extensión; la pestaña se abre antes del `await` para no perder el gesto del usuario), el resto se descarga.
- **`src/lib/components/`** — un componente por vista/panel. `TopBar` = una fila (navegador `‹ Mes Año ›` con grilla de meses, menú `Año ▾` con años/nuevo/renombrar/eliminar, búsqueda, pendientes, menú `⋯` con tema/recargar/carpeta/GitHub/versión) + fila de pestañas. Acciones secundarias van al `⋯`, no a la barra. Menús con `Menu.svelte` (cierra con clic fuera y Escape).
- **`src/lib/version.ts`** — commit y fecha del build (`__BUILD_SHA__`/`__BUILD_TIME__` vía `define` en `vite.config.ts`; `GITHUB_SHA` en CI, "dev" en local), visibles en el menú `⋯`.
- **`src/routes/`** — una sola ruta (`+page.svelte`), `prerender = true`, `ssr = false`.
- **`src/service-worker.ts`** — cachea el build por `version` para abrir offline. Solo `_app/immutable/*` (con hash) se sirve caché-primero; el HTML y el resto van **red-primero** (`no-cache`) con la caché como respaldo offline. Nunca servir el HTML caché-primero: queda pegado y la app no se actualiza. El precache del `install` usa `cache: "reload"` (GitHub Pages manda `max-age=600`).

Para agregar una operación: lógica en `domain/accounts.ts` (con test en `tests/`), método en `lib/api.ts`, uso en el componente.

### Reglas de la plataforma

- Solo Chrome/Edge de escritorio (File System Access API). En otros navegadores `Onboarding` muestra "Navegador no soportado".
- **Eliminar es definitivo** (`removeEntry`, no hay papelera). La UI siempre confirma con `ConfirmModal` y lo dice explícitamente; eliminar un año entero exige además escribir el año para habilitar el botón.
- Años: se renombran y eliminan desde la barra superior (`renamePeriod`/`deletePeriod` en el store); `renameEntry` exige 4 dígitos para un periodo (si no, `listPeriods` dejaría de verlo). Los meses son fijos (`NN. Nombre`) y **no** se renombran, eliminan ni vacían desde la UI.
- No existe "abrir con el sistema" ni "mostrar en carpeta".
- `move()` no está disponible para directorios en Chromium (verificado en Edge): renombrar periodo/mes/servicio usa el fallback copiar + borrar. Si se interrumpe, puede quedar una copia parcial con el nombre nuevo (la original queda intacta).
- El navegador no expone rutas absolutas; solo el nombre de la carpeta raíz.
- `queryPermission` puede no resolver nunca (visto en la PWA instalada de Edge con una carpeta real guardada; la consola queda vacía). `root.loadRoot` lo corta a los 1 s (`QUERY_PERMISSION_TIMEOUT_MS`) y lo trata como `needs-permission` (pantalla Reconectar). `requestPermission` tiene el mismo problema, así que "Reconectar" no lo usa: abre el selector (`pickRoot("existing")`, que el navegador posiciona en la última carpeta por el `id` "cuentas-root") y la nueva elección reemplaza al handle guardado. Toda llamada a la API del navegador en el arranque debe tener un límite así; nunca dejar `app.loading` esperando una promesa sin cota.
- La pantalla de carga (`+page.svelte`) muestra `app.loadingStep`: `loadRoot(onStep)` y `loadAll(showProgress)` lo actualizan, incluido el avance por mes vía `listPending(..., onMonth)`. `useRoot` activa `loading` también al reconectar o elegir carpeta; los refrescos por foco/Recargar no lo activan.

### Tests

`tests/support/nodeFs.ts` implementa `Fs` sobre `node:fs` en una carpeta temporal (`fs.mkdtemp` + `fs.rm` en `afterEach`). `nodeFs(root, { withMove: false })` fuerza el camino de fallback de renombrado. Los tests ejercitan `domain/` directamente.

### Deploy

`.github/workflows/deploy.yml`: en cada push a `main` corre lint + tests + build con `BASE_PATH=/cuentas` y publica `build/` en la rama `gh-pages` (Pages sirve esa rama).

## Notas de código

- `tsconfig.json` extiende `.svelte-kit/tsconfig.json` (generado por `svelte-kit sync`); incluye `src/` y `tests/`. `lib` agrega `DOM.AsyncIterable` para iterar directorios.
- ESLint (`eslint.config.js`) desactiva `no-unused-vars` en favor de `@typescript-eslint/no-unused-vars` con `argsIgnorePattern: "^_"` — parámetros no usados se prefijan con `_`. `svelte/no-navigation-without-resolve` ignora `<a href>` (app de una sola ruta; los únicos enlaces son externos, ej. GitHub vía `GITHUB_URL` en `store.svelte.ts`).
- Modo oscuro: la variante `dark:` depende de la clase `.dark` en `<html>` (`@custom-variant` en `src/app.css`). `src/lib/theme.svelte.ts` guarda la preferencia Sistema/Claro/Oscuro en `localStorage` ("cuentas-theme", por navegador) y el script inline de `src/app.html` la aplica antes de pintar; ambos deben mantener la misma lógica. Toda clase de color nueva en un componente lleva su variante `dark:` (equivalencias: `bg-white`→`dark:bg-slate-900`, `text-slate-800`→`dark:text-slate-100`, `text-slate-500`→`dark:text-slate-400`, `border-slate-200`→`dark:border-slate-700`, tintes `-50/-100`→`dark:…-950/40` o `-900/40`). Fondo y texto base oscuros en `src/app.css`.
- Los íconos de la PWA se generan con `scripts/make-icon.ts` (PNG a mano, sin dependencias); para un diseño propio, reemplazar `static/icon-*.png`.

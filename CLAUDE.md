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
- **`src/lib/root.ts`** — selección de la carpeta raíz, persistencia del handle en IndexedDB y permisos (`unsupported` / `none` / `needs-permission` / `ready`).
- **`src/lib/api.ts`** — fachada que usa la UI: un método por operación, devuelve `OpResult` (o variantes con contador) en vez de lanzar. Opera sobre el `Fs` activo (`setFs`).
- **`src/lib/store.svelte.ts`** — estado global de UI (runes). Sin watcher: refresca al volver el foco a la ventana (`focus`/`visibilitychange`) y con el botón Recargar; `refreshTick` avisa a los paneles abiertos.
- **`src/lib/openFile.ts`** — abrir comprobantes: PDF/imagen en pestaña nueva (blob con MIME por extensión; la pestaña se abre antes del `await` para no perder el gesto del usuario), el resto se descarga.
- **`src/lib/components/`** — un componente por vista/panel.
- **`src/routes/`** — una sola ruta (`+page.svelte`), `prerender = true`, `ssr = false`.
- **`src/service-worker.ts`** — cachea el build por `version` para abrir offline.

Para agregar una operación: lógica en `domain/accounts.ts` (con test en `tests/`), método en `lib/api.ts`, uso en el componente.

### Reglas de la plataforma

- Solo Chrome/Edge de escritorio (File System Access API). En otros navegadores `Onboarding` muestra "Navegador no soportado".
- **Eliminar es definitivo** (`removeEntry`, no hay papelera). La UI siempre confirma con `ConfirmModal` y lo dice explícitamente.
- No existe "abrir con el sistema" ni "mostrar en carpeta".
- `move()` no está disponible para directorios en Chromium (verificado en Edge): renombrar periodo/mes/servicio usa el fallback copiar + borrar. Si se interrumpe, puede quedar una copia parcial con el nombre nuevo (la original queda intacta).
- El navegador no expone rutas absolutas; solo el nombre de la carpeta raíz.

### Tests

`tests/support/nodeFs.ts` implementa `Fs` sobre `node:fs` en una carpeta temporal (`fs.mkdtemp` + `fs.rm` en `afterEach`). `nodeFs(root, { withMove: false })` fuerza el camino de fallback de renombrado. Los tests ejercitan `domain/` directamente.

### Deploy

`.github/workflows/deploy.yml`: en cada push a `main` corre lint + tests + build con `BASE_PATH=/cuentas` y publica `build/` en la rama `gh-pages` (Pages sirve esa rama).

## Notas de código

- `tsconfig.json` extiende `.svelte-kit/tsconfig.json` (generado por `svelte-kit sync`); incluye `src/` y `tests/`. `lib` agrega `DOM.AsyncIterable` para iterar directorios.
- ESLint (`eslint.config.js`) desactiva `no-unused-vars` en favor de `@typescript-eslint/no-unused-vars` con `argsIgnorePattern: "^_"` — parámetros no usados se prefijan con `_`.
- Los íconos de la PWA se generan con `scripts/make-icon.ts` (PNG a mano, sin dependencias); para un diseño propio, reemplazar `static/icon-*.png`.

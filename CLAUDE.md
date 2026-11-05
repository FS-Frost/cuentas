# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

App de escritorio (Electrobun + Bun + Svelte 5 + Tailwind) para gestionar comprobantes de pago organizados en carpetas con la estructura `[año]/[mes]/[servicio]/[comprobantes]`. El estado pagado/pendiente de un servicio se **deriva** de si tiene archivos (nunca se guarda). Ver README.md para el detalle funcional completo (características, modelo de datos, distribución en Windows).

## Comandos

```bash
bun install
bun run test        # tests con bun:test (tests/*.test.ts)
bun run dev          # build:web + electrobun dev (levanta la app)
bun run typecheck    # tsc --noEmit
bun run check        # svelte-check
bun run lint         # check + eslint .
bun run build        # build:win stable (empaqueta el .exe)
```

Un solo test: `bun test tests/accounts.test.ts -t "nombre del test"` (usa `describe`/`test` de `bun:test`).

No hay watch mode para `bun run test`; para iterar en frontend usar `bun run dev:web` (vite build --watch) en paralelo a `electrobun dev`.

## Arquitectura

Dos procesos separados por Electrobun, comunicados por **RPC tipado** (nunca fs directo desde el frontend):

- **`src/bun/`** — proceso backend, único dueño del filesystem y de `.cuentas.json`.
  - `index.ts` — arranca `BrowserWindow`, define todos los handlers RPC (`BrowserView.defineRPC`) y delega la lógica a los demás módulos. Es el único lugar que sabe de Electrobun (`Utils.openFileDialog`, `moveToTrash`, `openPath`, etc.).
  - `accounts.ts` — lógica de dominio: listar/crear periodos-meses-servicios-archivos, plantilla de recurrentes, copiar mes anterior, búsqueda, pendientes. Pura respecto al filesystem (recibe `root` como parámetro), fácil de testear.
  - `naming.ts` — parseo/formato tolerante de nombres de mes (`NN. Nombre`), categoría de servicio (prefijo `[X]`), validación de nombres de carpeta y resolución de colisiones de archivos.
  - `metadata.ts` — lectura/escritura atómica (temp + rename) de `.cuentas.json`; hace read-modify-write para no pisar cambios externos concurrentes.
  - `config.ts` — persiste la carpeta raíz elegida en el directorio de datos del usuario (fuera de la carpeta de cuentas).
  - `watcher.ts` — `fs.watch` sobre la raíz con debounce; dispara el mensaje RPC `rootChanged` hacia el webview.
- **`src/mainview/`** — frontend Svelte 5 (runes) + Tailwind, compilado por Vite a `dist/`, servido por Electrobun bajo `views://mainview/`.
  - `lib/rpc.ts` — cliente RPC (`Electroview.defineRPC`); `api` es el objeto tipado con un método por request del contrato. También expone `onRootChanged` para suscribirse al auto-refresh.
  - `lib/store.svelte.ts` — estado global de UI (periodo/mes seleccionados, búsqueda, etc.) con runes de Svelte 5.
  - `lib/components/` — un componente por vista/panel (Dashboard, ServiceCard, ServicePanel, Viewer, PendingPanel, SearchPanel, RecurringSettings, Onboarding, TopBar, Toasts, Modal).
- **`src/shared/rpc.ts`** — contrato RPC (`AppRPC`) y modelos de dominio (`ServiceInfo`, `MonthInfo`, `TargetRef`, etc.) compartidos por ambos procesos. **Es la fuente de verdad del tipado**: al agregar/cambiar un handler, se edita aquí primero, luego el handler en `src/bun/index.ts`, luego el uso en el frontend.

### Convención de operaciones

Los handlers RPC que pueden fallar de forma esperada devuelven `OpResult` (`{ ok, error? }`) o variantes con contador (`{ added, error? }`) en vez de lanzar hacia el webview; los errores internos se capturan en `index.ts` con el helper `errMsg`.

### Build del frontend

Vite compila `src/mainview` (root del proyecto Vite) a `./dist` con `base: "./"` para funcionar bajo el esquema custom `views://`. Un plugin propio (`stripCrossorigin` en `vite.config.ts`) quita el atributo `crossorigin` que Vite inyecta, porque rompe la carga de módulos bajo ese esquema. `electrobun.config.ts` no compila views (`views: {}`) y solo copia `dist/index.html` y `dist/assets` al bundle final.

### Icono en Windows (workaround)

El CLI de Electrobun 1.18.1 no logra incrustar el ícono en el `.exe`. `bun run build` corre `scripts/patch-electrobun-icons.ts`, que incrusta `assets/icon.ico` con `rcedit` directamente en los binarios de `node_modules/electrobun/dist-win-x64/` antes de empaquetar. Esto modifica `node_modules`, así que el patch corre en cada build.

## Notas de código

- `tsconfig.json` tiene `verbatimModuleSyntax: false` y `allowImportingTsExtensions: true`; los imports de tipos desde `src/shared/rpc.ts` se borran en build (sin runtime).
- ESLint (`eslint.config.js`) desactiva `no-unused-vars` en favor de `@typescript-eslint/no-unused-vars` con `argsIgnorePattern: "^_"` — parámetros no usados se prefijan con `_`.
- Los tests en `tests/` crean una carpeta temporal por test (`fs.mkdtemp` + `fs.rm` en `afterEach`) y ejercitan `accounts.ts`/`naming.ts`/`metadata.ts` directamente, sin levantar Electrobun.

# Cuentas

![deploy](https://github.com/FS-Frost/cuentas/actions/workflows/deploy.yml/badge.svg)

https://fs-frost.github.io/cuentas/

App web (PWA instalable) para gestionar comprobantes de cuentas organizados en
carpetas de tu equipo:

```
[año]/[mes]/[servicio]/[comprobantes].(pdf|jpg|…)
Ej: 2026/04. Abril/[Depto] Aguas Andinas/Comprobante_Pago_Cta_1234567.pdf
```

La app trabaja directo sobre una carpeta local mediante la File System Access
API: **tus archivos nunca salen de tu equipo** (el sitio es estático, sin backend).

## Requisitos

- **Chrome o Edge de escritorio.** Firefox y Safari no permiten acceder a carpetas locales.
- Una carpeta raíz normal (ej. `Documentos\Cuentas` u `OneDrive\Cuentas`). El navegador
  no deja elegir la raíz de un disco, la carpeta de usuario ni carpetas del sistema.

## Características

- Carpeta raíz elegida una vez y recordada (puede pedir "Reconectar" con un clic al volver).
- Crear periodos (año) → genera los 12 meses automáticamente.
- Dashboard por mes con tarjetas de servicio.
- **Estado automático**: un servicio con ≥1 comprobante = _pagado_; sin comprobantes = _pendiente_.
- Categoría opcional por prefijo `[X]` en el nombre del servicio.
- Importar comprobantes por **arrastrar y soltar** o botón (siempre copia el original).
- PDF e imágenes se abren en una **pestaña nueva** con el visor del navegador; otros
  archivos se descargan.
- Notas por servicio (guardadas en `.cuentas.json` en la raíz).
- Servicios recurrentes (plantilla) + "Aplicar plantilla" y "Copiar mes anterior".
- Panel de pendientes y búsqueda/filtros (dentro del periodo).
- Refresco al volver a la ventana y botón Recargar (para cambios hechos desde el
  Explorador o la nube).
- Instalable y usable sin conexión.

### Diferencias con la antigua app de escritorio

- **Eliminar es definitivo**: no pasa por la papelera del sistema.
- No hay "abrir con el programa predeterminado" ni "mostrar en carpeta".
- No hay auto-refresh instantáneo (se refresca al volver a la ventana).
- Renombrar carpetas copia y borra (el navegador no permite mover directorios).

La app de escritorio (Electrobun) quedó en el tag
[`desktop-final`](https://github.com/FS-Frost/cuentas/tree/desktop-final); usa la
misma estructura y el mismo `.cuentas.json`.

## Desarrollo

```bash
bun install
bun run dev         # http://localhost:5000
bun run test        # tests de la lógica de dominio
bun run lint        # svelte-check + eslint
bun run build       # build estático en build/
```

Otros scripts: `bun run preview`, `bun run typecheck`, `bun run make:icon`
(regenera los íconos de `static/`).

## Arquitectura

- **`src/lib/domain/`** — lógica de dominio pura sobre una interfaz `Fs`.
- **`src/lib/fs/`** — interfaz `Fs` e implementación con la File System Access API.
- **`src/lib/`** — fachada `api.ts`, estado de UI (`store.svelte.ts`), raíz/permisos (`root.ts`).
- **`src/lib/components/`** — componentes Svelte 5 + Tailwind.
- **`tests/`** — tests con `bun:test` usando una implementación de `Fs` sobre `node:fs`.

## Deploy

Cada push a `main` corre lint, tests y build en GitHub Actions y publica en la
rama `gh-pages` (ver `.github/workflows/deploy.yml`).

# Cuentas

App de escritorio (Electrobun + Bun + Svelte 5 + Tailwind) para gestionar
comprobantes de cuentas organizados en carpetas:

```
[año]/[mes]/[servicio]/[comprobantes].(pdf|jpg|…)
Ej: 2026/04. Abril/[Depto] Aguas Andinas/Comprobante_Pago_Cta_1234567.pdf
```

## Características

- Carpeta raíz configurable (multiplataforma). Se recuerda entre sesiones.
- Crear periodos (año) → genera los 12 meses automáticamente.
- Dashboard por mes con tarjetas de servicio.
- **Estado automático**: un servicio con ≥1 comprobante = _pagado_; sin comprobantes = _pendiente_.
- Categoría opcional por prefijo `[X]` en el nombre del servicio.
- Importar comprobantes por **arrastrar y soltar** o botón (siempre copia el original).
- Visor integrado de PDF (pdf.js) e imágenes, y "abrir con el sistema".
- Notas por servicio (guardadas en `.cuentas.json` en la raíz).
- Servicios recurrentes (plantilla) + "Aplicar plantilla" y "Copiar mes anterior".
- Panel de pendientes y búsqueda/filtros (dentro del periodo).
- Auto-refresh ante cambios hechos desde el explorador / la nube.
- Eliminar = enviar a la papelera del sistema.

## Arquitectura

- **`src/bun/`** — proceso backend (único dueño del filesystem y de `.cuentas.json`).
  Expone la API por RPC. Lógica pura y testeable en `naming.ts` / `accounts.ts` / `metadata.ts`.
- **`src/mainview/`** — frontend Svelte 5 + Tailwind, compilado por Vite a `dist/`.
- **`src/shared/rpc.ts`** — contrato RPC tipado compartido.

El frontend se compila con Vite y Electrobun lo incluye vía `copy` bajo
`views://mainview/`.

## Desarrollo

```bash
bun install
bun run test        # tests de la lógica del backend
bun run dev         # compila el frontend y lanza la app (electrobun dev)
```

Otros scripts: `bun run build:web` (solo Vite), `bun run dev:web` (Vite en modo
watch, útil junto a `electrobun run` para iterar en el frontend), `bun run build`
(empaquetado stable), `bun run typecheck`, `bun run check` (svelte-check),
`bun run lint` (check + eslint).

## Distribución (Windows) e ícono

`bun run build` genera el instalador de Electrobun en
`build/stable-win-x64/Cuentas-Setup.exe` (y `Cuentas-Setup.zip`). No se genera MSI.

El ícono de la app se define en `assets/icon.ico` (placeholder generado por
`bun run make:icon`; reemplázalo por el tuyo — un `.ico` real, o sustituye
`assets/icon.png` y vuelve a correr `make:icon`). Está configurado en
`electrobun.config.ts` (`build.win.icon`), que además copia `Resources/app.ico`
para el ícono de ventana.

**Nota (workaround):** el CLI precompilado de Electrobun 1.18.1 no logra incrustar
el ícono en los `.exe` (busca `rcedit` en una ruta de su CI). Por eso `bun run build`
ejecuta `patch:icons` ([scripts/patch-electrobun-icons.ts](scripts/patch-electrobun-icons.ts)),
que incrusta el ícono con `rcedit` en los binarios de
`node_modules/electrobun/dist-win-x64/` (launcher/bun/extractor/process_helper)
antes de empaquetar. Como se modifica `node_modules`, el paso corre en cada build;
si borras `node_modules`, el primer build baja los binarios core y el siguiente ya
los parchea.

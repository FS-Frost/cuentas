---
name: verify
description: Build/launch/smoke-test recipe for the Cuentas PWA (SvelteKit static + File System Access API)
---

# Verifying changes in Cuentas

Cuentas is a static SvelteKit PWA. All logic runs in the browser over the
File System Access API (Chrome/Edge only). Domain logic is tested in Node via
`tests/support/nodeFs.ts`.

## 1. Static checks + tests (always)

```bash
bun run lint     # svelte-kit sync + svelte-check + eslint
bun test
```

## 2. Production build (same as CI)

```bash
rm -rf build
MSYS_NO_PATHCONV=1 BASE_PATH=/cuentas bun run build   # MSYS_NO_PATHCONV only needed in Git Bash
```

`build/` must contain `index.html`, `404.html`, `service-worker.js`,
`manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `_app/`.

## 3. Smoke test in a real browser (headless Edge via CDP)

`msedge --dump-dom` is NOT reliable here (it snapshots before IndexedDB
resolves and shows "Cargando…"). Use a CDP script instead:

1. Serve: `MSYS_NO_PATHCONV=1 BASE_PATH=/cuentas bunx vite preview --port 4173 --strictPort` (background).
2. Launch `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe --headless=new
   --remote-debugging-port=9333 --user-data-dir=<temp>`, connect to the page's
   `webSocketDebuggerUrl`, `Page.navigate` to `http://localhost:4173/cuentas/`,
   wait ~4s, then `Runtime.evaluate`:
   - `document.body.innerText` → must show "Bienvenido a Cuentas".
   - `navigator.serviceWorker.getRegistration()` → active.
   - Collect `Runtime.exceptionThrown` / console errors → must be none.

### Exercising the real browser Fs (no folder picker needed)

The directory picker needs a human gesture, but OPFS
(`navigator.storage.getDirectory()`) exposes the same `FileSystemDirectoryHandle`
API. With `bunx vite dev --port 5000` running, evaluate in the page:

```js
const { browserFs } = await import("/src/lib/fs/browser.ts");
const acc = await import("/src/lib/domain/accounts.ts");
const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("t", { create: true });
const fs = browserFs(root);           // delete fs.move to force the copy+delete fallback
await acc.createPeriod(fs, "2026");   // …then createService/importFiles/renameEntry/deleteEntry
```

Clean up with `removeEntry("t", { recursive: true })`.

## Known gap

Picking a real folder (`showDirectoryPicker`), the permission prompt, opening a
PDF in a new tab and PWA install all need a human in Chrome/Edge. Ask the user
to check those manually on a **copy** of their accounts folder.

Stop background servers when done (ports 5000 / 4173).

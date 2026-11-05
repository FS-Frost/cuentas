---
name: verify
description: Build/launch recipe for the Cuentas Electrobun desktop app
---

# Verifying changes in Cuentas

This is an Electrobun (Bun + native WebView2) desktop app. The frontend
(`src/mainview`, Svelte 5) has no standalone browser dev server — it talks to
the Bun backend (`src/bun/index.ts`) over Electrobun's RPC bridge, so it must
run inside the real app shell, not a plain `vite dev`.

## Build + launch

```bash
bun run build:web   # vite build -> dist/ (must succeed, this is the real compile of src/mainview)
bun run app:run      # electrobun run -> spawns build/dev-win-x64/Cuentas-dev/bin/bun.exe + opens a native WebView2 window
```

`bun run dev` does both (`build:web && electrobun dev`) and also watches.

Console output (bun backend logs, and JS console from the webview in dev
builds) is printed to the terminal that launched it — useful for catching
import/runtime errors during boot without needing to see the window.

## Known gap

There is no screenshot/computer-use tool available to this agent for driving
a native Windows GUI window (the WebView2 surface isn't reachable via
Playwright/browser automation — it's not a normal browser tab). So:
- Build success + clean boot logs (no uncaught errors during load) is the
  strongest signal obtainable without a human.
- Actually clicking through UI flows (buttons, modals, forms) requires a
  human to run `bun run dev` and interact with the window directly.

If a GUI automation/screenshot tool becomes available in a future session,
prefer driving the real window over this workaround.

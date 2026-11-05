// Observa la carpeta raíz y notifica (con debounce) cuando algo cambia en disco,
// para que el frontend refresque la vista tras cambios externos (explorador, nube).

import { watch, type FSWatcher } from "node:fs";

let current: FSWatcher | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function startWatching(root: string, onChange: (reason: string) => void): void {
  stopWatching();
  try {
    // recursive:true está soportado en Windows y macOS.
    current = watch(root, { recursive: true }, (_event, filename) => {
      const name = filename?.toString() ?? "";
      // Ignorar el archivo de metadata y temporales para evitar bucles.
      if (name.includes(".cuentas.json")) return;
      if (name.endsWith(".tmp")) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChange(name || "change"), 300);
    });
  } catch (err) {
    console.error("No se pudo iniciar el watcher:", err);
  }
}

export function stopWatching(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (current) {
    current.close();
    current = null;
  }
}

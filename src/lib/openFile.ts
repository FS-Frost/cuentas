// Abrir un comprobante: pestaña nueva con el visor del navegador (PDF/imagen)
// o descarga con su nombre original (el resto, ej .docx/.xlsx).

import { isPreviewable, mimeOf } from "./domain/naming";

// Tiempo que se mantiene viva la URL del blob para que la pestaña alcance a cargarla.
const REVOKE_AFTER_MS = 60_000;

/**
 * Debe llamarse directo desde un click: abre la pestaña ANTES de leer el
 * archivo para no perder el gesto del usuario (si no, el bloqueador de
 * popups la cancela). Devuelve un mensaje de error o null.
 */
export async function openOrDownload(
  name: string,
  read: () => Promise<Blob>,
): Promise<string | null> {
  if (isPreviewable(name)) {
    const tab = window.open("", "_blank");
    if (!tab) return "El navegador bloqueó la pestaña nueva. Permite ventanas emergentes para este sitio.";
    try {
      // Re-tipar con el MIME por extensión: el visor de PDF del navegador lo necesita.
      const blob = new Blob([await read()], { type: mimeOf(name) });
      const url = URL.createObjectURL(blob);
      tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
      return null;
    } catch (e) {
      tab.close();
      return e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const url = URL.createObjectURL(await read());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

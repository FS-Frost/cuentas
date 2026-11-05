import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Bajo el esquema custom views://, tanto `new Worker(url, {type:"module"})`
// como el `import()` dinámico que usa pdf.js como fallback fallan al
// resolver el módulo del worker. Lo descargamos con fetch (que sí funciona
// para subrecursos) y lo re-exponemos como blob:, un esquema que WebView2/
// WebKit sí soportan para workers de tipo módulo.
let ready: Promise<void> | null = null;

export function ensurePdfWorker(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const res = await fetch(workerUrl);
      const code = await res.text();
      const blob = new Blob([code], { type: "text/javascript" });
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    })();
  }
  return ready;
}

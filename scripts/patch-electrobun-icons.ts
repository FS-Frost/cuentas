// Workaround: el CLI precompilado de Electrobun 1.18.1 falla al incrustar el
// ícono de Windows porque busca `rcedit` en una ruta de su entorno de CI
// (D:\a\electrobun\...\node_modules\rcedit) que no existe en instalaciones normales.
//
// Como Electrobun copia sus binarios (launcher.exe, bun.exe, extractor.exe) desde
// node_modules/electrobun/dist-win-x64/ hacia el bundle ANTES de comprimir el
// tar.zst y de generar el Setup.exe, incrustamos el ícono en esos binarios fuente
// aquí, previo al build. Así el bundle instalado y el instalador salen con ícono.
//
// Idempotente. Se pierde al reinstalar node_modules → correr como paso de build.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICON = path.join(ROOT, "assets", "icon.ico");
const DIST = path.join(ROOT, "node_modules", "electrobun", "dist-win-x64");

// Binarios que Electrobun copia al bundle / usa como base del instalador.
const TARGETS = ["launcher.exe", "bun.exe", "extractor.exe", "process_helper.exe"];

function resolveRcedit(): string {
  const base = path.join(ROOT, "node_modules", "rcedit", "bin");
  const x64 = path.join(base, "rcedit-x64.exe");
  return existsSync(x64) ? x64 : path.join(base, "rcedit.exe");
}

function main() {
  if (process.platform !== "win32") {
    console.log("No es Windows; se omite el parcheo de íconos.");
    return;
  }
  if (!existsSync(ICON)) {
    console.error(`No existe ${path.relative(ROOT, ICON)}. Corre primero: bun run make:icon`);
    process.exit(1);
  }
  if (!existsSync(DIST)) {
    // En el primer build aún no están los binarios core (los descarga electrobun
    // durante el build). No abortamos: este build saldrá sin ícono en los .exe y
    // el siguiente ya los tendrá parcheados.
    console.warn(
      `Aún no existe ${path.relative(ROOT, DIST)} (binarios core). ` +
        "Se omite el parcheo; vuelve a correr el build tras esta primera vez.",
    );
    return;
  }

  const rcedit = resolveRcedit();
  let patched = 0;
  for (const name of TARGETS) {
    const target = path.join(DIST, name);
    if (!existsSync(target)) continue;
    try {
      execFileSync(rcedit, [target, "--set-icon", ICON], { stdio: "pipe" });
      console.log(`✓ ícono incrustado en dist-win-x64/${name}`);
      patched += 1;
    } catch (e) {
      console.warn(`⚠ no se pudo incrustar en ${name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`Listo: ${patched}/${TARGETS.length} binarios parcheados.`);
}

main();

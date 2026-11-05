// Implementación de Fs sobre node:fs para los tests (carpeta temporal real).

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Fs, FsEntry, FsPath } from "../../src/lib/fs/port";

export function nodeFs(root: string, opts: { withMove?: boolean } = {}): Fs {
  const abs = (p: FsPath) => path.join(root, ...p);

  const impl: Fs = {
    async list(p) {
      const entries = await fs.readdir(abs(p), { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() || e.isDirectory())
        .map<FsEntry>((e) => ({ name: e.name, kind: e.isDirectory() ? "directory" : "file" }));
    },
    async exists(p) {
      try {
        await fs.access(abs(p));
        return true;
      } catch {
        return false;
      }
    },
    async stat(p) {
      const st = await fs.stat(abs(p));
      return { size: st.size, mtime: st.mtimeMs };
    },
    async readText(p) {
      return fs.readFile(abs(p), "utf8");
    },
    async readBlob(p) {
      return new Blob([new Uint8Array(await fs.readFile(abs(p)))]);
    },
    async writeFile(p, data) {
      const bytes =
        typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(await data.arrayBuffer());
      const tmp = `${abs(p)}.tmp`;
      await fs.writeFile(tmp, bytes);
      await fs.rename(tmp, abs(p));
    },
    async mkdir(p) {
      await fs.mkdir(abs(p), { recursive: true });
    },
    async remove(p) {
      await fs.rm(abs(p), { recursive: true });
    },
  };

  // Por defecto se expone move (como Chrome con soporte); withMove:false
  // fuerza el camino de fallback copiar + borrar.
  if (opts.withMove !== false) {
    impl.move = async (p, newName) => {
      await fs.rename(abs(p), path.join(root, ...p.slice(0, -1), newName));
    };
  }
  return impl;
}

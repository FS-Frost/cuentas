// Implementación de Fs sobre la File System Access API (Chrome/Edge).

import { nameOf, parentOf, type Fs, type FsEntry, type FsPath } from "./port";

function isNotFound(e: unknown): boolean {
  return (
    e instanceof DOMException && (e.name === "NotFoundError" || e.name === "TypeMismatchError")
  );
}

export function browserFs(root: FileSystemDirectoryHandle): Fs {
  async function dir(path: FsPath, create = false): Promise<FileSystemDirectoryHandle> {
    let current = root;
    for (const segment of path) {
      current = await current.getDirectoryHandle(segment, { create });
    }
    return current;
  }

  async function file(path: FsPath): Promise<FileSystemFileHandle> {
    return (await dir(parentOf(path))).getFileHandle(nameOf(path));
  }

  /** Handle de archivo o directorio en la ruta (lanza NotFoundError si no existe). */
  async function anyHandle(path: FsPath): Promise<FileSystemHandle> {
    if (path.length === 0) return root;
    const parent = await dir(parentOf(path));
    try {
      return await parent.getDirectoryHandle(nameOf(path));
    } catch (e) {
      if (!isNotFound(e)) throw e;
      return await parent.getFileHandle(nameOf(path));
    }
  }

  return {
    async list(path) {
      const d = await dir(path);
      const out: FsEntry[] = [];
      for await (const handle of d.values()) {
        out.push({ name: handle.name, kind: handle.kind });
      }
      return out;
    },

    async exists(path) {
      try {
        await anyHandle(path);
        return true;
      } catch (e) {
        if (isNotFound(e)) return false;
        throw e;
      }
    },

    async stat(path) {
      const f = await (await file(path)).getFile();
      return { size: f.size, mtime: f.lastModified };
    },

    async readText(path) {
      return (await (await file(path)).getFile()).text();
    },

    async readBlob(path) {
      return (await file(path)).getFile();
    },

    async writeFile(path, data) {
      const parent = await dir(parentOf(path));
      const handle = await parent.getFileHandle(nameOf(path), { create: true });
      // createWritable escribe a un archivo de intercambio y lo reemplaza al
      // cerrar: el original nunca queda a medio escribir.
      const writable = await handle.createWritable();
      try {
        await writable.write(data);
        await writable.close();
      } catch (e) {
        await writable.abort().catch(() => {});
        throw e;
      }
    },

    async mkdir(path) {
      await dir(path, true);
    },

    async remove(path) {
      const parent = await dir(parentOf(path));
      await parent.removeEntry(nameOf(path), { recursive: true });
    },

    async move(path, newName) {
      const handle = await anyHandle(path);
      if (typeof handle.move !== "function") throw new Error("move() no soportado");
      await handle.move(newName);
    },
  };
}

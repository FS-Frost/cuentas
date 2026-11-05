// Abstracción mínima de filesystem que usa la lógica de dominio.
// Las rutas son arrays de segmentos relativos a la carpeta raíz (ej:
// ["2026", "04. Abril", "Luz", "c.pdf"]); [] es la raíz misma.
//
// Implementaciones:
//   - src/lib/fs/browser.ts  → File System Access API (la app real).
//   - tests/support/nodeFs.ts → node:fs sobre una carpeta temporal (tests).

export type FsPath = readonly string[];

export interface FsEntry {
  name: string;
  kind: "file" | "directory";
}

export interface FsStat {
  size: number;
  mtime: number; // epoch ms
}

export interface Fs {
  /** Lista el contenido de un directorio. Lanza si no existe. */
  list(path: FsPath): Promise<FsEntry[]>;
  /** true si existe un archivo o directorio en la ruta. */
  exists(path: FsPath): Promise<boolean>;
  stat(path: FsPath): Promise<FsStat>;
  readText(path: FsPath): Promise<string>;
  /** Contenido del archivo como Blob (en el navegador, un File con nombre y fecha). */
  readBlob(path: FsPath): Promise<Blob>;
  /** Crea o reemplaza un archivo de forma atómica. El directorio padre debe existir. */
  writeFile(path: FsPath, data: Blob | string): Promise<void>;
  /** Crea el directorio y sus padres; no falla si ya existe. */
  mkdir(path: FsPath): Promise<void>;
  /** Borra (definitivo) un archivo o un directorio con todo su contenido. */
  remove(path: FsPath): Promise<void>;
  /**
   * Renombra en el mismo directorio de forma nativa, si la plataforma puede.
   * Opcional: si no existe o lanza, se usa el fallback copiar + borrar
   * (ver renameWithFallback).
   */
  move?(path: FsPath, newName: string): Promise<void>;
}

export function parentOf(path: FsPath): FsPath {
  return path.slice(0, -1);
}

export function nameOf(path: FsPath): string {
  return path[path.length - 1] ?? "";
}

async function isDirectory(fs: Fs, path: FsPath): Promise<boolean> {
  const entries = await fs.list(parentOf(path));
  const name = nameOf(path);
  return entries.some((e) => e.name === name && e.kind === "directory");
}

/** Copia recursiva de `from` a `to` (que no debe existir). */
async function copyTree(fs: Fs, from: FsPath, to: FsPath): Promise<void> {
  if (!(await isDirectory(fs, from))) {
    await fs.writeFile(to, await fs.readBlob(from));
    return;
  }
  await fs.mkdir(to);
  for (const entry of await fs.list(from)) {
    await copyTree(fs, [...from, entry.name], [...to, entry.name]);
  }
}

/**
 * Renombra un archivo o carpeta dentro de su mismo directorio.
 * Intenta `fs.move`; si no está disponible o falla, copia todo a la ruta nueva
 * y recién entonces borra la original. Si se interrumpe a mitad de la copia,
 * la original queda intacta y puede quedar una copia parcial con el nombre nuevo.
 */
export async function renameWithFallback(fs: Fs, path: FsPath, newName: string): Promise<void> {
  if (fs.move) {
    try {
      await fs.move(path, newName);
      return;
    } catch {
      // Sigue con el fallback.
    }
  }
  const target = [...parentOf(path), newName];
  await copyTree(fs, path, target);
  await fs.remove(path);
}

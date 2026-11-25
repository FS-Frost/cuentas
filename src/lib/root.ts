// Carpeta raíz: selección, persistencia del handle en IndexedDB y permisos.
// Reemplaza al antiguo config.ts (que guardaba la ruta en %APPDATA%).

const DB_NAME = "cuentas";
const STORE = "kv";
const KEY = "root";

export type RootState =
  | { status: "unsupported" }
  | { status: "none" }
  | { status: "needs-permission"; handle: FileSystemDirectoryHandle }
  | { status: "ready"; handle: FileSystemDirectoryHandle };

export function isSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await idb<FileSystemDirectoryHandle | undefined>("readonly", (s) => s.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

/** Guarda la carpeta como raíz (solo después de validarla). */
export async function saveRoot(handle: FileSystemDirectoryHandle): Promise<void> {
  await idb("readwrite", (s) => s.put(handle, KEY));
}

// queryPermission puede no resolver nunca (visto en la PWA instalada de Edge con
// una carpeta real guardada). Pasado este tiempo se trata como "pedir permiso".
const QUERY_PERMISSION_TIMEOUT_MS = 3000;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** Estado inicial: ¿hay carpeta guardada y tenemos permiso sin pedirlo? */
export async function loadRoot(): Promise<RootState> {
  if (!isSupported()) return { status: "unsupported" };
  const handle = await loadHandle();
  if (!handle) return { status: "none" };
  let perm: PermissionState | "timeout";
  try {
    perm = await withTimeout(
      handle.queryPermission({ mode: "readwrite" }),
      QUERY_PERMISSION_TIMEOUT_MS,
      "timeout" as const,
    );
  } catch {
    perm = "prompt";
  }
  if (perm === "timeout") console.warn("queryPermission no respondió; se pedirá reconectar.");
  return perm === "granted" ? { status: "ready", handle } : { status: "needs-permission", handle };
}

/**
 * Abre el selector de carpeta (requiere gesto del usuario). null si cancela.
 * No la guarda: el llamador la valida y luego llama a saveRoot.
 */
export async function chooseFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker!({ id: "cuentas-root", mode: "readwrite" });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

/** Pide de nuevo el permiso sobre la carpeta guardada (requiere gesto del usuario). */
export async function reconnect(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

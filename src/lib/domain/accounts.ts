// Lógica de dominio para periodos, meses, servicios y comprobantes.
// Solo depende de la interfaz Fs (src/lib/fs/port.ts) y de módulos puros, así
// que corre igual en el navegador (File System Access API) y en los tests
// (node:fs).

import { renameWithFallback, type Fs, type FsPath } from "../fs/port";
import {
  allMonthFolders,
  composeService,
  extOf,
  isCountableFile,
  isPreviewable,
  isValidYear,
  monthFolderName,
  parseMonth,
  parseService,
  uniqueFileName,
  validateName,
} from "./naming";
import { noteKey, readMetadata, updateMetadata } from "./metadata";
import type {
  FileInfo,
  MonthInfo,
  MonthSummary,
  PendingItem,
  RecurringService,
  ServiceHit,
  ServiceInfo,
  TargetRef,
} from "./types";

// --------------------------------------------------------------------------
// Resolución de rutas
// --------------------------------------------------------------------------

async function listOrEmpty(fs: Fs, path: FsPath) {
  try {
    return await fs.list(path);
  } catch {
    return [];
  }
}

/** Encuentra la carpeta real del mes (tolera "4.Abril"); si no existe, la canónica. */
async function resolveMonthFolder(fs: Fs, period: string, monthNN: string): Promise<string> {
  for (const e of await listOrEmpty(fs, [period])) {
    if (e.kind !== "directory") continue;
    const parsed = parseMonth(e.name);
    if (parsed && parsed.nn === monthNN) return e.name;
  }
  return monthFolderName(parseInt(monthNN, 10));
}

async function monthPath(fs: Fs, period: string, monthNN: string): Promise<FsPath> {
  return [period, await resolveMonthFolder(fs, period, monthNN)];
}

async function servicePath(
  fs: Fs,
  period: string,
  monthNN: string,
  service: string,
): Promise<FsPath> {
  return [...(await monthPath(fs, period, monthNN)), service];
}

/** Ruta (relativa a la raíz) de una entidad del árbol. */
export async function targetPath(fs: Fs, target: TargetRef): Promise<FsPath> {
  switch (target.kind) {
    case "period":
      return [target.period];
    case "month":
      return monthPath(fs, target.period, target.monthNN);
    case "service":
      return servicePath(fs, target.period, target.monthNN, target.service);
    case "file":
      return [...(await servicePath(fs, target.period, target.monthNN, target.service)), target.name];
  }
}

// --------------------------------------------------------------------------
// Lectura
// --------------------------------------------------------------------------

export async function listPeriods(fs: Fs): Promise<string[]> {
  return (await listOrEmpty(fs, []))
    .filter((e) => e.kind === "directory" && /^\d{4}$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => b.localeCompare(a)); // años descendente
}

export interface RootInspection {
  /** Periodos (carpetas de 4 dígitos) presentes en la raíz. */
  periods: string[];
  /**
   * La carpeta parece ser un año y no la raíz (se llama "2026" o contiene
   * carpetas de mes como "01. Enero"), y no tiene periodos propios.
   */
  looksLikeYear: boolean;
  /** Entradas que no son periodos ni archivos ocultos/de sistema. */
  otherEntries: number;
}

/** Revisa una carpeta candidata a raíz antes de usarla. */
export async function inspectRoot(fs: Fs, rootName: string): Promise<RootInspection> {
  const entries = await listOrEmpty(fs, []);
  const periods = await listPeriods(fs);
  const hasMonthDirs = entries.some((e) => e.kind === "directory" && parseMonth(e.name) !== null);
  const looksLikeYear = periods.length === 0 && (isValidYear(rootName) || hasMonthDirs);
  const otherEntries = entries.filter(
    (e) => !(e.kind === "directory" && periods.includes(e.name)) && isCountableFile(e.name),
  ).length;
  return { periods, looksLikeYear, otherEntries };
}

export async function listMonths(_fs: Fs, _period: string): Promise<MonthInfo[]> {
  // Siempre devolvemos los 12 meses; el frontend indica cuáles existen por su contenido.
  return allMonthFolders().map((folder) => {
    const parsed = parseMonth(folder)!;
    return { nn: parsed.nn, name: parsed.name, folder };
  });
}

async function countComprobantes(fs: Fs, dir: FsPath): Promise<number> {
  return (await listOrEmpty(fs, dir)).filter((e) => e.kind === "file" && isCountableFile(e.name))
    .length;
}

export async function listServices(
  fs: Fs,
  period: string,
  monthNN: string,
): Promise<ServiceInfo[]> {
  const dir = await monthPath(fs, period, monthNN);
  const services: ServiceInfo[] = [];
  for (const e of await listOrEmpty(fs, dir)) {
    if (e.kind !== "directory") continue;
    const { categoria, nombre } = parseService(e.name);
    const fileCount = await countComprobantes(fs, [...dir, e.name]);
    services.push({ folder: e.name, categoria, nombre, fileCount, paid: fileCount > 0 });
  }
  services.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  return services;
}

export async function listFiles(
  fs: Fs,
  period: string,
  monthNN: string,
  service: string,
): Promise<FileInfo[]> {
  const dir = await servicePath(fs, period, monthNN, service);
  const files: FileInfo[] = [];
  for (const e of await listOrEmpty(fs, dir)) {
    if (e.kind !== "file" || !isCountableFile(e.name)) continue;
    let sizeBytes = 0;
    let mtime = 0;
    try {
      const st = await fs.stat([...dir, e.name]);
      sizeBytes = st.size;
      mtime = st.mtime;
    } catch {
      /* ignorar */
    }
    files.push({
      name: e.name,
      ext: extOf(e.name),
      sizeBytes,
      mtime,
      previewable: isPreviewable(e.name),
    });
  }
  files.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
  return files;
}

export async function getMonthSummary(
  fs: Fs,
  period: string,
  monthNN: string,
): Promise<MonthSummary> {
  const services = await listServices(fs, period, monthNN);
  const pagados = services.filter((s) => s.paid).length;
  return { total: services.length, pagados, pendientes: services.length - pagados };
}

/** Contenido de un comprobante (para abrirlo en una pestaña o descargarlo). */
export async function readFile(
  fs: Fs,
  period: string,
  monthNN: string,
  service: string,
  name: string,
): Promise<Blob> {
  return fs.readBlob([...(await servicePath(fs, period, monthNN, service)), name]);
}

// --------------------------------------------------------------------------
// Creación / gestión
// --------------------------------------------------------------------------

export async function createPeriod(fs: Fs, year: string): Promise<void> {
  if (!isValidYear(year)) throw new Error("El periodo debe ser un año de 4 dígitos.");
  for (const month of allMonthFolders()) {
    await fs.mkdir([year, month]);
  }
}

export async function createService(
  fs: Fs,
  period: string,
  monthNN: string,
  categoria: string | null,
  nombre: string,
): Promise<void> {
  const nameError = validateName(nombre);
  if (nameError) throw new Error(nameError);
  if (categoria) {
    const catError = validateName(categoria);
    if (catError) throw new Error(`Categoría: ${catError}`);
  }
  const folder = composeService(categoria, nombre);
  const mDir = await monthPath(fs, period, monthNN);
  await fs.mkdir(mDir);
  const target = [...mDir, folder];
  if (await fs.exists(target)) {
    throw new Error("Ya existe un servicio con ese nombre en este mes.");
  }
  await fs.mkdir(target);
}

/** Renombra periodo/mes/servicio/archivo y migra las notas asociadas. */
export async function renameEntry(fs: Fs, target: TargetRef, newName: string): Promise<void> {
  const nameError = validateName(newName);
  if (nameError) throw new Error(nameError);
  const name = newName.trim();

  const from = await targetPath(fs, target);
  if (from[from.length - 1] === name) return;
  const to = [...from.slice(0, -1), name];
  // Comparación sin distinguir mayúsculas: en Windows "luz" y "Luz" son la misma entrada.
  const onlyCaseChange = from[from.length - 1].toLowerCase() === name.toLowerCase();
  if (!onlyCaseChange && (await fs.exists(to))) {
    throw new Error("Ya existe una entrada con ese nombre.");
  }
  await renameWithFallback(fs, from, name);

  // Migración de notas.
  if (target.kind === "service") {
    await migrateNotes(fs, (key) => {
      const oldPrefix = `${target.period}/${target.monthNN}/${target.service}`;
      if (key === oldPrefix) return `${target.period}/${target.monthNN}/${name}`;
      return null;
    });
  } else if (target.kind === "period") {
    await migrateNotes(fs, (key) => {
      if (key.startsWith(`${target.period}/`)) {
        return `${name}/${key.slice(target.period.length + 1)}`;
      }
      return null;
    });
  } else if (target.kind === "month") {
    // Al renombrar un mes cambia el nombre de carpeta, pero la clave usa NN (estable),
    // así que solo migramos si el NN cambió (renombre a otro mes).
    const parsed = parseMonth(name);
    if (parsed && parsed.nn !== target.monthNN) {
      await migrateNotes(fs, (key) => {
        const prefix = `${target.period}/${target.monthNN}/`;
        if (key.startsWith(prefix)) {
          return `${target.period}/${parsed.nn}/${key.slice(prefix.length)}`;
        }
        return null;
      });
    }
  }
}

/** Borrado definitivo (no hay papelera en el navegador). */
export async function deleteEntry(fs: Fs, target: TargetRef): Promise<void> {
  await fs.remove(await targetPath(fs, target));
}

async function migrateNotes(fs: Fs, remap: (key: string) => string | null): Promise<void> {
  await updateMetadata(fs, (m) => {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(m.notes)) {
      const mapped = remap(key);
      next[mapped ?? key] = value;
    }
    m.notes = next;
  });
}

// --------------------------------------------------------------------------
// Comprobantes
// --------------------------------------------------------------------------

/** Copia archivos (drag & drop o selector) al servicio, resolviendo colisiones. */
export async function importFiles(
  fs: Fs,
  period: string,
  monthNN: string,
  service: string,
  files: { name: string; data: Blob }[],
): Promise<number> {
  const dir = await servicePath(fs, period, monthNN, service);
  await fs.mkdir(dir);
  let added = 0;
  for (const f of files) {
    const existing = new Set((await listOrEmpty(fs, dir)).map((e) => e.name));
    await fs.writeFile([...dir, uniqueFileName(f.name, existing)], f.data);
    added += 1;
  }
  return added;
}

// --------------------------------------------------------------------------
// Recurrentes y utilidades del mes
// --------------------------------------------------------------------------

/** Crea en `dir` las carpetas de servicio que falten; devuelve cuántas creó. */
async function createMissingServices(fs: Fs, dir: FsPath, folders: string[]): Promise<number> {
  await fs.mkdir(dir);
  const existing = new Set((await listOrEmpty(fs, dir)).map((e) => e.name.toLowerCase()));
  let created = 0;
  for (const folder of folders) {
    if (existing.has(folder.toLowerCase())) continue;
    await fs.mkdir([...dir, folder]);
    existing.add(folder.toLowerCase());
    created += 1;
  }
  return created;
}

export async function applyTemplate(
  fs: Fs,
  period: string,
  monthNN: string,
  recurring: RecurringService[],
): Promise<number> {
  return createMissingServices(
    fs,
    await monthPath(fs, period, monthNN),
    recurring.map((svc) => composeService(svc.categoria, svc.nombre)),
  );
}

/** Mes cronológicamente anterior (cruza de año si es enero). */
function previousMonth(period: string, monthNN: string): { period: string; monthNN: string } {
  const n = parseInt(monthNN, 10);
  if (n > 1) return { period, monthNN: String(n - 1).padStart(2, "0") };
  const prevYear = String(parseInt(period, 10) - 1);
  return { period: prevYear, monthNN: "12" };
}

export async function copyPreviousMonth(
  fs: Fs,
  period: string,
  monthNN: string,
): Promise<{ created: number; from: string | null }> {
  const prev = previousMonth(period, monthNN);
  const prevServices = await listServices(fs, prev.period, prev.monthNN);
  if (prevServices.length === 0) return { created: 0, from: null };

  const created = await createMissingServices(
    fs,
    await monthPath(fs, period, monthNN),
    prevServices.map((s) => s.folder),
  );
  const fromLabel = `${prev.period} · ${monthFolderName(parseInt(prev.monthNN, 10))}`;
  return { created, from: fromLabel };
}

// --------------------------------------------------------------------------
// Vistas transversales (dentro de un periodo)
// --------------------------------------------------------------------------

export async function listPending(fs: Fs, period: string): Promise<PendingItem[]> {
  const items: PendingItem[] = [];
  for (const month of await listMonths(fs, period)) {
    for (const svc of await listServices(fs, period, month.nn)) {
      if (!svc.paid) {
        items.push({
          monthNN: month.nn,
          monthName: month.name,
          folder: svc.folder,
          categoria: svc.categoria,
          nombre: svc.nombre,
        });
      }
    }
  }
  return items;
}

export async function search(
  fs: Fs,
  period: string,
  query: string,
  categoria: string | null,
  estado: "all" | "paid" | "pending",
): Promise<ServiceHit[]> {
  const q = query.trim().toLowerCase();
  const hits: ServiceHit[] = [];
  for (const month of await listMonths(fs, period)) {
    for (const svc of await listServices(fs, period, month.nn)) {
      if (q && !svc.nombre.toLowerCase().includes(q) && !svc.folder.toLowerCase().includes(q)) {
        continue;
      }
      if (categoria !== null && (svc.categoria ?? "") !== categoria) continue;
      if (estado === "paid" && !svc.paid) continue;
      if (estado === "pending" && svc.paid) continue;
      hits.push({
        monthNN: month.nn,
        monthName: month.name,
        folder: svc.folder,
        categoria: svc.categoria,
        nombre: svc.nombre,
        paid: svc.paid,
        fileCount: svc.fileCount,
      });
    }
  }
  return hits;
}

// --------------------------------------------------------------------------
// Recurrentes (metadata) + notas — envoltorios sobre metadata.ts
// --------------------------------------------------------------------------

export async function getRecurring(fs: Fs): Promise<RecurringService[]> {
  return (await readMetadata(fs)).recurringServices;
}

export async function setRecurring(fs: Fs, services: RecurringService[]): Promise<void> {
  await updateMetadata(fs, (m) => {
    m.recurringServices = services;
  });
}

export async function getNotes(
  fs: Fs,
  period: string,
  monthNN: string,
  service: string,
): Promise<string> {
  const meta = await readMetadata(fs);
  return meta.notes[noteKey(period, monthNN, service)] ?? "";
}

export async function setNotes(
  fs: Fs,
  period: string,
  monthNN: string,
  service: string,
  notes: string,
): Promise<void> {
  await updateMetadata(fs, (m) => {
    const key = noteKey(period, monthNN, service);
    if (notes.trim()) m.notes[key] = notes;
    else delete m.notes[key];
  });
}

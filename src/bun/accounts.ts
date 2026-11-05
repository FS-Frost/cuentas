// Lógica de filesystem para periodos, meses, servicios y comprobantes.
// Solo depende de node:fs / node:path y de módulos puros → testeable con Bun.
// Las operaciones que requieren APIs nativas (papelera, diálogos, abrir con el
// sistema) viven en index.ts; aquí solo resolvemos rutas y tocamos el disco.

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  allMonthFolders,
  composeService,
  extOf,
  isCountableFile,
  isPreviewable,
  isValidYear,
  mimeOf,
  monthFolderName,
  parseMonth,
  parseService,
  uniqueFileName,
  validateName,
} from "./naming";
import { noteKey, readMetadata, updateMetadata } from "./metadata";
import type {
  FileInfo,
  IncomingFile,
  MonthInfo,
  MonthSummary,
  PendingItem,
  RecurringService,
  ServiceHit,
  ServiceInfo,
  TargetRef,
} from "../shared/rpc";

const META_FILE = ".cuentas.json";

// --------------------------------------------------------------------------
// Resolución de rutas
// --------------------------------------------------------------------------

function periodPath(root: string, period: string): string {
  return path.join(root, period);
}

/** Encuentra la carpeta real del mes (tolera "4.Abril"); si no existe, la canónica. */
async function resolveMonthFolder(
  root: string,
  period: string,
  monthNN: string,
): Promise<string> {
  const dir = periodPath(root, period);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const parsed = parseMonth(e.name);
      if (parsed && parsed.nn === monthNN) return e.name;
    }
  } catch {
    /* el periodo puede no existir aún */
  }
  return monthFolderName(parseInt(monthNN, 10));
}

async function monthPath(root: string, period: string, monthNN: string): Promise<string> {
  return path.join(periodPath(root, period), await resolveMonthFolder(root, period, monthNN));
}

async function servicePath(
  root: string,
  period: string,
  monthNN: string,
  service: string,
): Promise<string> {
  return path.join(await monthPath(root, period, monthNN), service);
}

/** Ruta absoluta de una entidad del árbol (pura salvo la resolución del mes). */
export async function targetPath(root: string, target: TargetRef): Promise<string> {
  switch (target.kind) {
    case "period":
      return periodPath(root, target.period);
    case "month":
      return monthPath(root, target.period, target.monthNN);
    case "service":
      return servicePath(root, target.period, target.monthNN, target.service);
    case "file":
      return path.join(
        await servicePath(root, target.period, target.monthNN, target.service),
        target.name,
      );
  }
}

// --------------------------------------------------------------------------
// Lectura
// --------------------------------------------------------------------------

export async function listPeriods(root: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => b.localeCompare(a)); // años descendente
}

export async function listMonths(_root: string, _period: string): Promise<MonthInfo[]> {
  // Siempre devolvemos los 12 meses; el frontend indica cuáles existen por su contenido.
  return allMonthFolders().map((folder) => {
    const parsed = parseMonth(folder)!;
    return { nn: parsed.nn, name: parsed.name, folder };
  });
}

async function countComprobantes(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => (e.isFile() || e.isSymbolicLink()) && isCountableFile(e.name))
      .length;
  } catch {
    return 0;
  }
}

export async function listServices(
  root: string,
  period: string,
  monthNN: string,
): Promise<ServiceInfo[]> {
  const dir = await monthPath(root, period, monthNN);
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const services: ServiceInfo[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const { categoria, nombre } = parseService(e.name);
    const fileCount = await countComprobantes(path.join(dir, e.name));
    services.push({ folder: e.name, categoria, nombre, fileCount, paid: fileCount > 0 });
  }
  services.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  return services;
}

export async function listFiles(
  root: string,
  period: string,
  monthNN: string,
  service: string,
): Promise<FileInfo[]> {
  const dir = await servicePath(root, period, monthNN, service);
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: FileInfo[] = [];
  for (const e of entries) {
    if (!(e.isFile() || e.isSymbolicLink())) continue;
    if (!isCountableFile(e.name)) continue;
    let sizeBytes = 0;
    let mtime = 0;
    try {
      const st = await fs.stat(path.join(dir, e.name));
      sizeBytes = st.size;
      mtime = st.mtimeMs;
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
  root: string,
  period: string,
  monthNN: string,
): Promise<MonthSummary> {
  const services = await listServices(root, period, monthNN);
  const pagados = services.filter((s) => s.paid).length;
  return { total: services.length, pagados, pendientes: services.length - pagados };
}

// --------------------------------------------------------------------------
// Creación / gestión
// --------------------------------------------------------------------------

export async function createPeriod(root: string, year: string): Promise<void> {
  if (!isValidYear(year)) throw new Error("El periodo debe ser un año de 4 dígitos.");
  const dir = periodPath(root, year);
  await fs.mkdir(dir, { recursive: true });
  for (const month of allMonthFolders()) {
    await fs.mkdir(path.join(dir, month), { recursive: true });
  }
}

export async function createService(
  root: string,
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
  const mDir = await monthPath(root, period, monthNN);
  await fs.mkdir(mDir, { recursive: true });
  const target = path.join(mDir, folder);
  try {
    await fs.access(target);
    throw new Error("Ya existe un servicio con ese nombre en este mes.");
  } catch (err) {
    if (err instanceof Error && err.message.includes("Ya existe")) throw err;
    // No existe → crear.
  }
  await fs.mkdir(target, { recursive: true });
}

/** Renombra periodo/mes/servicio/archivo y migra las notas asociadas. */
export async function renameEntry(
  root: string,
  target: TargetRef,
  newName: string,
): Promise<void> {
  const nameError = validateName(newName);
  if (nameError) throw new Error(nameError);

  const from = await targetPath(root, target);
  const parent = path.dirname(from);
  const to = path.join(parent, newName.trim());

  if (path.resolve(from) === path.resolve(to)) return;
  try {
    await fs.access(to);
    throw new Error("Ya existe una entrada con ese nombre.");
  } catch (err) {
    if (err instanceof Error && err.message.includes("Ya existe")) throw err;
  }
  await fs.rename(from, to);

  // Migración de notas.
  if (target.kind === "service") {
    await migrateNotes(root, (key) => {
      const oldPrefix = `${target.period}/${target.monthNN}/${target.service}`;
      if (key === oldPrefix) return `${target.period}/${target.monthNN}/${newName.trim()}`;
      return null;
    });
  } else if (target.kind === "period") {
    await migrateNotes(root, (key) => {
      if (key.startsWith(`${target.period}/`)) {
        return `${newName.trim()}/${key.slice(target.period.length + 1)}`;
      }
      return null;
    });
  } else if (target.kind === "month") {
    // Al renombrar un mes cambia el nombre de carpeta, pero la clave usa NN (estable),
    // así que solo migramos si el NN cambió (renombre a otro mes).
    const parsed = parseMonth(newName.trim());
    if (parsed && parsed.nn !== target.monthNN) {
      await migrateNotes(root, (key) => {
        const prefix = `${target.period}/${target.monthNN}/`;
        if (key.startsWith(prefix)) {
          return `${target.period}/${parsed.nn}/${key.slice(prefix.length)}`;
        }
        return null;
      });
    }
  }
}

async function migrateNotes(
  root: string,
  remap: (key: string) => string | null,
): Promise<void> {
  await updateMetadata(root, (m) => {
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

/** Copia archivos (por ruta de origen) al servicio, resolviendo colisiones. */
export async function copyFilesToService(
  root: string,
  period: string,
  monthNN: string,
  service: string,
  sources: string[],
): Promise<number> {
  const dir = await servicePath(root, period, monthNN, service);
  await fs.mkdir(dir, { recursive: true });
  let added = 0;
  for (const src of sources) {
    const existing = new Set(await fs.readdir(dir).catch(() => []));
    const dest = path.join(dir, uniqueFileName(path.basename(src), existing));
    await fs.copyFile(src, dest);
    added += 1;
  }
  return added;
}

/** Escribe archivos entrantes (drag & drop, bytes en base64) al servicio. */
export async function importDataFiles(
  root: string,
  period: string,
  monthNN: string,
  service: string,
  files: IncomingFile[],
): Promise<number> {
  const dir = await servicePath(root, period, monthNN, service);
  await fs.mkdir(dir, { recursive: true });
  let added = 0;
  for (const f of files) {
    const existing = new Set(await fs.readdir(dir).catch(() => []));
    const dest = path.join(dir, uniqueFileName(f.name, existing));
    await fs.writeFile(dest, new Uint8Array(Buffer.from(f.dataBase64, "base64")));
    added += 1;
  }
  return added;
}

export async function readFileForPreview(
  root: string,
  period: string,
  monthNN: string,
  service: string,
  name: string,
): Promise<{ mime: string; dataBase64: string }> {
  const p = path.join(await servicePath(root, period, monthNN, service), name);
  const buf = await fs.readFile(p);
  return { mime: mimeOf(name), dataBase64: buf.toString("base64") };
}

// --------------------------------------------------------------------------
// Recurrentes y utilidades del mes
// --------------------------------------------------------------------------

export async function applyTemplate(
  root: string,
  period: string,
  monthNN: string,
  recurring: RecurringService[],
): Promise<number> {
  const dir = await monthPath(root, period, monthNN);
  await fs.mkdir(dir, { recursive: true });
  const existing = new Set((await fs.readdir(dir).catch(() => [])).map((n) => n.toLowerCase()));
  let created = 0;
  for (const svc of recurring) {
    const folder = composeService(svc.categoria, svc.nombre);
    if (existing.has(folder.toLowerCase())) continue;
    await fs.mkdir(path.join(dir, folder), { recursive: true });
    existing.add(folder.toLowerCase());
    created += 1;
  }
  return created;
}

/** Mes cronológicamente anterior (cruza de año si es enero). */
function previousMonth(period: string, monthNN: string): { period: string; monthNN: string } {
  const n = parseInt(monthNN, 10);
  if (n > 1) return { period, monthNN: String(n - 1).padStart(2, "0") };
  const prevYear = String(parseInt(period, 10) - 1);
  return { period: prevYear, monthNN: "12" };
}

export async function copyPreviousMonth(
  root: string,
  period: string,
  monthNN: string,
): Promise<{ created: number; from: string | null }> {
  const prev = previousMonth(period, monthNN);
  const prevServices = await listServices(root, prev.period, prev.monthNN);
  if (prevServices.length === 0) return { created: 0, from: null };

  const dir = await monthPath(root, period, monthNN);
  await fs.mkdir(dir, { recursive: true });
  const existing = new Set((await fs.readdir(dir).catch(() => [])).map((n) => n.toLowerCase()));
  let created = 0;
  for (const svc of prevServices) {
    if (existing.has(svc.folder.toLowerCase())) continue;
    await fs.mkdir(path.join(dir, svc.folder), { recursive: true });
    existing.add(svc.folder.toLowerCase());
    created += 1;
  }
  const fromLabel = `${prev.period} · ${monthFolderName(parseInt(prev.monthNN, 10))}`;
  return { created, from: fromLabel };
}

// --------------------------------------------------------------------------
// Vistas transversales (dentro de un periodo)
// --------------------------------------------------------------------------

export async function listPending(root: string, period: string): Promise<PendingItem[]> {
  const items: PendingItem[] = [];
  for (const month of await listMonths(root, period)) {
    const services = await listServices(root, period, month.nn);
    for (const svc of services) {
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
  root: string,
  period: string,
  query: string,
  categoria: string | null,
  estado: "all" | "paid" | "pending",
): Promise<ServiceHit[]> {
  const q = query.trim().toLowerCase();
  const hits: ServiceHit[] = [];
  for (const month of await listMonths(root, period)) {
    const services = await listServices(root, period, month.nn);
    for (const svc of services) {
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

export async function getRecurring(root: string): Promise<RecurringService[]> {
  return (await readMetadata(root)).recurringServices;
}

export async function setRecurring(root: string, services: RecurringService[]): Promise<void> {
  await updateMetadata(root, (m) => {
    m.recurringServices = services;
  });
}

export async function getNotes(
  root: string,
  period: string,
  monthNN: string,
  service: string,
): Promise<string> {
  const meta = await readMetadata(root);
  return meta.notes[noteKey(period, monthNN, service)] ?? "";
}

export async function setNotes(
  root: string,
  period: string,
  monthNN: string,
  service: string,
  notes: string,
): Promise<void> {
  await updateMetadata(root, (m) => {
    const key = noteKey(period, monthNN, service);
    if (notes.trim()) m.notes[key] = notes;
    else delete m.notes[key];
  });
}

export { META_FILE };

// Convenciones de nombres para periodos, meses y servicios.
// Módulo puro (sin acceso a disco) para poder testearlo aisladamente.

export const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

// Caracteres inválidos para nombres de carpeta/archivo en Windows.
const INVALID_CHARS = /[\\/:*?"<>|]/;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "04. Abril" a partir del número de mes (1-12). */
export function monthFolderName(nn: number): string {
  if (nn < 1 || nn > 12) throw new Error(`Mes fuera de rango: ${nn}`);
  return `${pad2(nn)}. ${MONTHS[nn - 1]}`;
}

/** Los 12 meses en orden. */
export function allMonthFolders(): string[] {
  return Array.from({ length: 12 }, (_, i) => monthFolderName(i + 1));
}

/**
 * Parseo tolerante de una carpeta de mes.
 * Acepta "04. Abril", "4.Abril", "4 . abril" → { nn: "04", name: "Abril" }.
 * Devuelve null si no parece un mes válido (1-12).
 */
export function parseMonth(folder: string): { nn: string; name: string } | null {
  const m = folder.match(/^(\d{1,2})\s*\.\s*(.+)$/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num < 1 || num > 12) return null;
  return { nn: pad2(num), name: m[2].trim() };
}

/** Nombre canónico del mes a partir de su carpeta (usa el número, no el texto). */
export function canonicalMonthFolder(folder: string): string | null {
  const parsed = parseMonth(folder);
  if (!parsed) return null;
  return monthFolderName(parseInt(parsed.nn, 10));
}

/**
 * Separa el prefijo de categoría opcional de un nombre de servicio.
 * "[Depto] Aguas Andinas" → { categoria: "Depto", nombre: "Aguas Andinas" }
 * "Internet"             → { categoria: null, nombre: "Internet" }
 */
export function parseService(folder: string): { categoria: string | null; nombre: string } {
  const m = folder.match(/^\[(.+?)\]\s*(.+)$/);
  if (!m) return { categoria: null, nombre: folder.trim() };
  return { categoria: m[1].trim(), nombre: m[2].trim() };
}

/** Compone el nombre de carpeta de un servicio a partir de categoría + nombre. */
export function composeService(categoria: string | null, nombre: string): string {
  const cat = categoria?.trim();
  const nom = nombre.trim();
  return cat ? `[${cat}] ${nom}` : nom;
}

/** Valida un año de periodo (4 dígitos). */
export function isValidYear(year: string): boolean {
  return /^\d{4}$/.test(year.trim());
}

/**
 * Valida un nombre de carpeta/archivo. Devuelve un mensaje de error o null si es válido.
 */
export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "El nombre no puede estar vacío.";
  if (INVALID_CHARS.test(trimmed)) return 'El nombre no puede contener \\ / : * ? " < > |';
  if (trimmed === "." || trimmed === "..") return "Nombre inválido.";
  if (trimmed.length > 200) return "El nombre es demasiado largo.";
  return null;
}

/** Extensión en minúscula, sin punto. */
export function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

// Tipos de archivo que el visor del navegador muestra en una pestaña (el resto se descarga).
export const PREVIEWABLE_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif"]);

export function isPreviewable(name: string): boolean {
  return PREVIEWABLE_EXTS.has(extOf(name));
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function mimeOf(name: string): string {
  return MIME_BY_EXT[extOf(name)] ?? "application/octet-stream";
}

/** Un archivo cuenta como comprobante si no está oculto ni es temporal/basura del SO. */
export function isCountableFile(name: string): boolean {
  if (name.startsWith(".")) return false; // ocultos (.DS_Store, etc.)
  const lower = name.toLowerCase();
  if (lower === "thumbs.db" || lower === "desktop.ini") return false;
  if (name.endsWith("~") || name.endsWith(".tmp")) return false;
  return true;
}

/**
 * Resuelve colisiones de nombre agregando " (n)" antes de la extensión.
 * existing: conjunto de nombres ya presentes (case-insensitive).
 */
export function uniqueFileName(name: string, existing: Set<string>): string {
  const lowerSet = new Set(Array.from(existing, (n) => n.toLowerCase()));
  if (!lowerSet.has(name.toLowerCase())) return name;

  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 1;
  let candidate = `${base} (${i})${ext}`;
  while (lowerSet.has(candidate.toLowerCase())) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  return candidate;
}

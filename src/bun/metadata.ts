// Lectura/escritura del archivo .cuentas.json en la raíz.
// Solo guarda lo que NO vive en el filesystem: notas y la plantilla de recurrentes.
// El estado pagado/pendiente se deriva de la presencia de comprobantes, no se guarda.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { RecurringService } from "../shared/rpc";

export interface Metadata {
  version: number;
  recurringServices: RecurringService[];
  notes: Record<string, string>; // clave "<period>/<NN>/<serviceFolder>" -> nota
}

const FILE_NAME = ".cuentas.json";

function emptyMetadata(): Metadata {
  return { version: 1, recurringServices: [], notes: {} };
}

function metaPath(root: string): string {
  return path.join(root, FILE_NAME);
}

export function noteKey(period: string, monthNN: string, service: string): string {
  return `${period}/${monthNN}/${service}`;
}

export async function readMetadata(root: string): Promise<Metadata> {
  try {
    const raw = await fs.readFile(metaPath(root), "utf8");
    const parsed = JSON.parse(raw) as Partial<Metadata>;
    return {
      version: parsed.version ?? 1,
      recurringServices: Array.isArray(parsed.recurringServices)
        ? parsed.recurringServices
        : [],
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
    };
  } catch {
    return emptyMetadata();
  }
}

// Escritura atómica. Re-lee antes de escribir (mutator recibe la versión más
// reciente en disco) para no pisar cambios externos concurrentes.
export async function updateMetadata(
  root: string,
  mutator: (m: Metadata) => void,
): Promise<Metadata> {
  const current = await readMetadata(root);
  mutator(current);
  const tmp = `${metaPath(root)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(current, null, 2), "utf8");
  await fs.rename(tmp, metaPath(root));
  return current;
}

export function getNote(meta: Metadata, key: string): string {
  return meta.notes[key] ?? "";
}

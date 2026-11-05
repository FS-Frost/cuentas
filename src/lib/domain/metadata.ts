// Lectura/escritura del archivo .cuentas.json en la raíz.
// Solo guarda lo que NO vive en el filesystem: notas y la plantilla de recurrentes.
// El estado pagado/pendiente se deriva de la presencia de comprobantes, no se guarda.

import type { Fs } from "../fs/port";
import type { RecurringService } from "./types";

export interface Metadata {
  version: number;
  recurringServices: RecurringService[];
  notes: Record<string, string>; // clave "<period>/<NN>/<serviceFolder>" -> nota
}

export const META_FILE = ".cuentas.json";

function emptyMetadata(): Metadata {
  return { version: 1, recurringServices: [], notes: {} };
}

export function noteKey(period: string, monthNN: string, service: string): string {
  return `${period}/${monthNN}/${service}`;
}

export async function readMetadata(fs: Fs): Promise<Metadata> {
  try {
    const raw = await fs.readText([META_FILE]);
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

// Re-lee antes de escribir (mutator recibe la versión más reciente en disco)
// para no pisar cambios externos. La escritura es atómica (Fs.writeFile).
export async function updateMetadata(
  fs: Fs,
  mutator: (m: Metadata) => void,
): Promise<Metadata> {
  const current = await readMetadata(fs);
  mutator(current);
  await fs.writeFile([META_FILE], JSON.stringify(current, null, 2));
  return current;
}

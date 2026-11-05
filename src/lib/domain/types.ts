// Modelos de dominio compartidos por la lógica (domain/) y la UI.

// ---------------------------------------------------------------------------
// Modelos de dominio
// ---------------------------------------------------------------------------

export interface MonthInfo {
  nn: string; // "01".."12"
  name: string; // "Enero".."Diciembre"
  folder: string; // "01. Enero"
}

export interface ServiceInfo {
  folder: string; // nombre de carpeta tal cual en disco, ej "[Depto] Aguas Andinas"
  categoria: string | null; // "Depto" | null
  nombre: string; // "Aguas Andinas"
  fileCount: number; // cantidad de comprobantes (archivos no ocultos)
  paid: boolean; // derivado: fileCount > 0
}

export interface FileInfo {
  name: string;
  ext: string; // sin punto, minúscula
  sizeBytes: number;
  mtime: number; // epoch ms
  previewable: boolean; // pdf/imagen soportada por el visor
}

export interface MonthSummary {
  total: number;
  pagados: number;
  pendientes: number;
}

export interface RecurringService {
  categoria: string | null;
  nombre: string;
}

export interface PendingItem {
  monthNN: string;
  monthName: string;
  folder: string;
  categoria: string | null;
  nombre: string;
}

export interface ServiceHit {
  monthNN: string;
  monthName: string;
  folder: string;
  categoria: string | null;
  nombre: string;
  paid: boolean;
  fileCount: number;
}

// Referencia a una entidad del árbol, usada para renombrar / eliminar / abrir.
export type TargetRef =
  | { kind: "period"; period: string }
  | { kind: "month"; period: string; monthNN: string }
  | { kind: "service"; period: string; monthNN: string; service: string }
  | { kind: "file"; period: string; monthNN: string; service: string; name: string };

// Resultado genérico de operaciones que pueden fallar de forma controlada.
export interface OpResult {
  ok: boolean;
  error?: string;
}

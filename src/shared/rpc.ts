// Contrato RPC compartido entre el proceso bun (backend) y el webview (Svelte).
// Se importa desde ambos lados; el import de tipo se borra en build (sin runtime).

import type { RPCSchema } from "electrobun/bun";

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

// Archivo entrante desde drag & drop (bytes en base64, sin ruta de origen).
export interface IncomingFile {
  name: string;
  dataBase64: string;
}

// ---------------------------------------------------------------------------
// Esquema RPC
// ---------------------------------------------------------------------------

export type AppRPC = {
  // Handlers que viven en el proceso bun (llamables desde el webview).
  bun: RPCSchema<{
    requests: {
      // Config / raíz
      getRootFolder: { params: void; response: { path: string | null } };
      pickRootFolder: { params: void; response: { path: string | null } };
      setRootFolder: { params: { path: string }; response: OpResult };

      // Lectura de estructura
      listPeriods: { params: void; response: { periods: string[] } };
      listMonths: { params: { period: string }; response: { months: MonthInfo[] } };
      listServices: {
        params: { period: string; monthNN: string };
        response: { services: ServiceInfo[] };
      };
      listFiles: {
        params: { period: string; monthNN: string; service: string };
        response: { files: FileInfo[] };
      };
      getMonthSummary: {
        params: { period: string; monthNN: string };
        response: MonthSummary;
      };

      // Creación / gestión
      createPeriod: { params: { year: string }; response: OpResult };
      createService: {
        params: { period: string; monthNN: string; categoria: string | null; nombre: string };
        response: OpResult;
      };
      renameEntry: { params: { target: TargetRef; newName: string }; response: OpResult };
      trashEntry: { params: { target: TargetRef }; response: OpResult };
      openEntry: { params: { target: TargetRef }; response: OpResult };
      revealEntry: { params: { target: TargetRef }; response: OpResult };

      // Comprobantes
      importPickFiles: {
        params: { period: string; monthNN: string; service: string };
        response: { added: number; error?: string };
      };
      importDataFiles: {
        params: {
          period: string;
          monthNN: string;
          service: string;
          files: IncomingFile[];
        };
        response: { added: number; error?: string };
      };
      readFileForPreview: {
        params: { period: string; monthNN: string; service: string; name: string };
        response: { mime: string; dataBase64: string } | { error: string };
      };

      // Recurrentes y utilidades del mes
      getRecurring: { params: void; response: { services: RecurringService[] } };
      setRecurring: { params: { services: RecurringService[] }; response: OpResult };
      applyTemplate: {
        params: { period: string; monthNN: string };
        response: { created: number; error?: string };
      };
      copyPreviousMonth: {
        params: { period: string; monthNN: string };
        response: { created: number; from: string | null; error?: string };
      };

      // Vistas transversales (dentro del periodo)
      listPending: { params: { period: string }; response: { items: PendingItem[] } };
      search: {
        params: {
          period: string;
          query: string;
          categoria: string | null;
          estado: "all" | "paid" | "pending";
        };
        response: { items: ServiceHit[] };
      };

      // Notas
      getNotes: {
        params: { period: string; monthNN: string; service: string };
        response: { notes: string };
      };
      setNotes: {
        params: { period: string; monthNN: string; service: string; notes: string };
        response: OpResult;
      };
    };
    messages: Record<string, never>;
  }>;

  // Handlers que viven en el webview (llamables desde bun).
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      // El watcher notifica que algo cambió en disco.
      rootChanged: { reason: string };
    };
  }>;
};

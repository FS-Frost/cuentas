// Fachada que usa la UI: mismos nombres y formas de respuesta que el antiguo
// cliente RPC, pero llamando directo a la lógica de dominio sobre el Fs activo.
// Las operaciones que pueden fallar de forma esperada devuelven OpResult (o
// variantes con contador) en vez de lanzar.

import * as accounts from "./domain/accounts";
import type { Fs } from "./fs/port";
import type { OpResult, RecurringService, TargetRef } from "./domain/types";

let current: Fs | null = null;

/** Fija el filesystem activo (la carpeta raíz elegida). */
export function setFs(fs: Fs | null): void {
  current = fs;
}

function fs(): Fs {
  if (!current) throw new Error("No hay una carpeta raíz configurada.");
  return current;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function op(fn: () => Promise<unknown>): Promise<OpResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

type Svc = { period: string; monthNN: string; service: string };

export const api = {
  // ---- Lectura ----
  listPeriods: async () => ({ periods: await accounts.listPeriods(fs()) }),
  listMonths: async ({ period }: { period: string }) => ({
    months: await accounts.listMonths(fs(), period),
  }),
  listServices: async ({ period, monthNN }: { period: string; monthNN: string }) => ({
    services: await accounts.listServices(fs(), period, monthNN),
  }),
  listFiles: async ({ period, monthNN, service }: Svc) => ({
    files: await accounts.listFiles(fs(), period, monthNN, service),
  }),
  getMonthSummary: async ({ period, monthNN }: { period: string; monthNN: string }) =>
    accounts.getMonthSummary(fs(), period, monthNN),
  readFile: async ({ period, monthNN, service, name }: Svc & { name: string }) =>
    accounts.readFile(fs(), period, monthNN, service, name),

  // ---- Creación / gestión ----
  createPeriod: ({ year }: { year: string }) => op(() => accounts.createPeriod(fs(), year)),
  createService: ({
    period,
    monthNN,
    categoria,
    nombre,
  }: {
    period: string;
    monthNN: string;
    categoria: string | null;
    nombre: string;
  }) => op(() => accounts.createService(fs(), period, monthNN, categoria, nombre)),
  renameEntry: ({ target, newName }: { target: TargetRef; newName: string }) =>
    op(() => accounts.renameEntry(fs(), target, newName)),
  deleteEntry: ({ target }: { target: TargetRef }) =>
    op(() => accounts.deleteEntry(fs(), target)),

  // ---- Comprobantes ----
  importFiles: async ({ period, monthNN, service, files }: Svc & { files: File[] }) => {
    try {
      const added = await accounts.importFiles(
        fs(),
        period,
        monthNN,
        service,
        files.map((f) => ({ name: f.name, data: f })),
      );
      return { added };
    } catch (e) {
      return { added: 0, error: errMsg(e) };
    }
  },

  // ---- Recurrentes y utilidades del mes ----
  getRecurring: async () => ({ services: await accounts.getRecurring(fs()) }),
  setRecurring: ({ services }: { services: RecurringService[] }) =>
    op(() => accounts.setRecurring(fs(), services)),
  applyTemplate: async ({ period, monthNN }: { period: string; monthNN: string }) => {
    try {
      const recurring = await accounts.getRecurring(fs());
      return { created: await accounts.applyTemplate(fs(), period, monthNN, recurring) };
    } catch (e) {
      return { created: 0, error: errMsg(e) };
    }
  },
  copyPreviousMonth: async ({
    period,
    monthNN,
  }: {
    period: string;
    monthNN: string;
  }): Promise<{ created: number; from: string | null; error?: string }> => {
    try {
      return await accounts.copyPreviousMonth(fs(), period, monthNN);
    } catch (e) {
      return { created: 0, from: null, error: errMsg(e) };
    }
  },

  // ---- Vistas transversales ----
  listPending: async ({ period }: { period: string }) => ({
    items: await accounts.listPending(fs(), period),
  }),
  search: async ({
    period,
    query,
    categoria,
    estado,
  }: {
    period: string;
    query: string;
    categoria: string | null;
    estado: "all" | "paid" | "pending";
  }) => ({ items: await accounts.search(fs(), period, query, categoria, estado) }),

  // ---- Notas ----
  getNotes: async ({ period, monthNN, service }: Svc) => ({
    notes: await accounts.getNotes(fs(), period, monthNN, service),
  }),
  setNotes: ({ period, monthNN, service, notes }: Svc & { notes: string }) =>
    op(() => accounts.setNotes(fs(), period, monthNN, service, notes)),
};

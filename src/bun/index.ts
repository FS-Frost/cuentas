// Proceso principal (bun): crea la ventana, registra los handlers RPC y observa
// la carpeta raíz. Es el único dueño del filesystem.

import { BrowserWindow, BrowserView, Utils } from "electrobun/bun";
import type { AppRPC, TargetRef } from "../shared/rpc";
import * as config from "./config";
import * as accounts from "./accounts";
import { startWatching, stopWatching } from "./watcher";

let win: BrowserWindow | null = null;

// Devuelve la raíz o lanza un error legible si no está configurada.
async function requireRoot(): Promise<string> {
  const root = await config.getRootFolder();
  if (!root) throw new Error("No hay una carpeta raíz configurada.");
  return root;
}

// (Re)inicia la observación de la carpeta raíz.
async function refreshWatcher(): Promise<void> {
  const root = await config.getRootFolder();
  if (!root) {
    stopWatching();
    return;
  }
  startWatching(root, (reason) => {
    // El objeto rpc del webview expone .send en runtime; su tipo público es laxo.
    const sender = win?.webview?.rpc as
      | { send: { rootChanged: (p: { reason: string }) => void } }
      | undefined;
    sender?.send.rootChanged({ reason });
  });
}

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 15000,
  handlers: {
    requests: {
      // ---- Config / raíz ----
      getRootFolder: async () => ({ path: await config.getRootFolder() }),

      pickRootFolder: async () => {
        const paths = cleanPaths(
          await Utils.openFileDialog({
            canChooseFiles: false,
            canChooseDirectory: true,
            allowsMultipleSelection: false,
            allowedFileTypes: "*",
          }),
        );
        const chosen = paths[0] ?? null;
        if (chosen) {
          await config.setRootFolder(chosen);
          await refreshWatcher();
        }
        return { path: chosen };
      },

      setRootFolder: async ({ path }) => {
        try {
          await config.setRootFolder(path);
          await refreshWatcher();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },

      // ---- Lectura ----
      listPeriods: async () => ({ periods: await accounts.listPeriods(await requireRoot()) }),

      listMonths: async ({ period }) => ({
        months: await accounts.listMonths(await requireRoot(), period),
      }),

      listServices: async ({ period, monthNN }) => ({
        services: await accounts.listServices(await requireRoot(), period, monthNN),
      }),

      listFiles: async ({ period, monthNN, service }) => ({
        files: await accounts.listFiles(await requireRoot(), period, monthNN, service),
      }),

      getMonthSummary: async ({ period, monthNN }) =>
        accounts.getMonthSummary(await requireRoot(), period, monthNN),

      // ---- Creación / gestión ----
      createPeriod: async ({ year }) => {
        try {
          await accounts.createPeriod(await requireRoot(), year);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },

      createService: async ({ period, monthNN, categoria, nombre }) => {
        try {
          await accounts.createService(await requireRoot(), period, monthNN, categoria, nombre);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },

      renameEntry: async ({ target, newName }) => {
        try {
          await accounts.renameEntry(await requireRoot(), target, newName);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },

      trashEntry: async ({ target }) => {
        try {
          const root = await requireRoot();
          const p = await accounts.targetPath(root, target);
          Utils.moveToTrash(p);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },

      openEntry: async ({ target }) => {
        try {
          const root = await requireRoot();
          const p = await accounts.targetPath(root, target);
          Utils.openPath(p);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },

      revealEntry: async ({ target }) => {
        try {
          const root = await requireRoot();
          const p = await accounts.targetPath(root, target);
          Utils.showItemInFolder(p);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },

      // ---- Comprobantes ----
      importPickFiles: async ({ period, monthNN, service }) => {
        try {
          const root = await requireRoot();
          const paths = cleanPaths(
            await Utils.openFileDialog({
              canChooseFiles: true,
              canChooseDirectory: false,
              allowsMultipleSelection: true,
              allowedFileTypes: "*",
            }),
          );
          if (paths.length === 0) return { added: 0 };
          const added = await accounts.copyFilesToService(root, period, monthNN, service, paths);
          return { added };
        } catch (e) {
          return { added: 0, error: errMsg(e) };
        }
      },

      importDataFiles: async ({ period, monthNN, service, files }) => {
        try {
          const root = await requireRoot();
          const added = await accounts.importDataFiles(root, period, monthNN, service, files);
          return { added };
        } catch (e) {
          return { added: 0, error: errMsg(e) };
        }
      },

      readFileForPreview: async ({ period, monthNN, service, name }) => {
        try {
          const root = await requireRoot();
          return await accounts.readFileForPreview(root, period, monthNN, service, name);
        } catch (e) {
          return { error: errMsg(e) };
        }
      },

      // ---- Recurrentes y utilidades del mes ----
      getRecurring: async () => ({ services: await accounts.getRecurring(await requireRoot()) }),

      setRecurring: async ({ services }) => {
        try {
          await accounts.setRecurring(await requireRoot(), services);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },

      applyTemplate: async ({ period, monthNN }) => {
        try {
          const root = await requireRoot();
          const recurring = await accounts.getRecurring(root);
          const created = await accounts.applyTemplate(root, period, monthNN, recurring);
          return { created };
        } catch (e) {
          return { created: 0, error: errMsg(e) };
        }
      },

      copyPreviousMonth: async ({ period, monthNN }) => {
        try {
          const root = await requireRoot();
          const { created, from } = await accounts.copyPreviousMonth(root, period, monthNN);
          return { created, from };
        } catch (e) {
          return { created: 0, from: null, error: errMsg(e) };
        }
      },

      // ---- Vistas transversales ----
      listPending: async ({ period }) => ({
        items: await accounts.listPending(await requireRoot(), period),
      }),

      search: async ({ period, query, categoria, estado }) => ({
        items: await accounts.search(await requireRoot(), period, query, categoria, estado),
      }),

      // ---- Notas ----
      getNotes: async ({ period, monthNN, service }) => ({
        notes: await accounts.getNotes(await requireRoot(), period, monthNN, service),
      }),

      setNotes: async ({ period, monthNN, service, notes }) => {
        try {
          await accounts.setNotes(await requireRoot(), period, monthNN, service, notes);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },
    },
    messages: {},
  },
});

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// openFileDialog devuelve [""] al cancelar; filtramos rutas vacías.
function cleanPaths(paths: string[]): string[] {
  return paths.filter((p) => p && p.trim().length > 0);
}

win = new BrowserWindow({
  title: "Cuentas",
  url: "views://mainview/index.html",
  frame: { width: 1200, height: 800, x: 100, y: 60 },
  rpc,
});

void refreshWatcher();

// Marca de uso para tipos no exportados (evita warnings de tree-shaking en algunos setups).
export type { TargetRef };

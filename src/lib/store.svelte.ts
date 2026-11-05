// Estado global de la UI (runes) y acciones sobre la carpeta raíz.

import { api, setFs } from "./api";
import { browserFs } from "./fs/browser";
import { createPeriod, inspectRoot } from "./domain/accounts";
import * as rootStore from "./root";
import { pushToast } from "./toast.svelte";
import { SvelteSet } from "svelte/reactivity";
import type {
  MonthInfo,
  MonthSummary,
  RecurringService,
  ServiceInfo,
} from "./domain/types";

/** Estado de acceso a la carpeta raíz (ver Onboarding.svelte). */
export type RootStatus = "unsupported" | "none" | "needs-permission" | "ready";

/** Cómo se eligió la carpeta en el inicio. */
export type StartMode = "existing" | "new";

export const GITHUB_URL = "https://github.com/FS-Frost/cuentas";

// Mínimo entre refrescos disparados por foco/visibilidad (evita dobles disparos).
const FOCUS_REFRESH_MIN_MS = 1000;

export type ViewMode = "dashboard" | "pending" | "search" | "recurring";

const MONTH_NAMES = [
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
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** true si el mes (de un periodo dado) ya llegó, o sea no es futuro respecto a hoy. */
function isPastOrCurrentMonth(period: string, monthNN: string): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const year = parseInt(period, 10);
  if (year !== currentYear) return year < currentYear;
  return parseInt(monthNN, 10) <= currentMonth;
}

class AppStore {
  loading = $state(true);
  rootStatus = $state<RootStatus>("none");
  /** Nombre de la carpeta raíz (el navegador no expone la ruta completa). */
  rootName = $state<string | null>(null);
  /** Se incrementa en cada refresco externo (foco, botón Recargar) para que los paneles recarguen. */
  refreshTick = $state(0);
  /** Aviso a mostrar en el inicio tras elegir una carpeta inválida. */
  rootWarning = $state<string | null>(null);
  /** "Empezar desde cero" con una carpeta no vacía: espera confirmación. */
  pendingStart = $state<{ handle: FileSystemDirectoryHandle; otherEntries: number } | null>(null);
  private pendingHandle: FileSystemDirectoryHandle | null = null;
  private lastFocusRefresh = 0;

  periods = $state<string[]>([]);
  period = $state<string>("");
  monthNN = $state<string>(pad2(new Date().getMonth() + 1));
  months = $state<MonthInfo[]>([]);

  services = $state<ServiceInfo[]>([]);
  summary = $state<MonthSummary>({ total: 0, pagados: 0, pendientes: 0 });
  /** Cantidad de servicios pendientes del periodo seleccionado hasta el mes actual (sin contar meses futuros). */
  pendingCount = $state(0);

  view = $state<ViewMode>("dashboard");
  recurring = $state<RecurringService[]>([]);

  get monthName(): string {
    return MONTH_NAMES[parseInt(this.monthNN, 10) - 1] ?? "";
  }

  get categorias(): string[] {
    const set = new SvelteSet<string>();
    for (const s of this.services) if (s.categoria) set.add(s.categoria);
    return Array.from(set).sort();
  }

  async init(): Promise<void> {
    this.loading = true;
    try {
      const state = await rootStore.loadRoot();
      this.rootStatus = state.status;
      if (state.status === "needs-permission") {
        this.pendingHandle = state.handle;
        this.rootName = state.handle.name;
      } else if (state.status === "ready") {
        await this.useRoot(state.handle);
      }
    } finally {
      this.loading = false;
    }

    // Sin watcher en el navegador: se refresca al volver a la ventana/pestaña,
    // para recoger cambios hechos desde el Explorador o la nube.
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - this.lastFocusRefresh < FOCUS_REFRESH_MIN_MS) return;
      this.lastFocusRefresh = now;
      void this.reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
  }

  private async useRoot(handle: FileSystemDirectoryHandle): Promise<void> {
    setFs(browserFs(handle));
    this.rootName = handle.name;
    this.rootStatus = "ready";
    this.pendingHandle = null;
    await this.loadAll();
  }

  /**
   * Elegir la carpeta raíz. Llamar desde un click.
   * - "existing": el usuario ya tiene su carpeta de cuentas.
   * - "new": empezar desde cero; se crea el año actual con sus 12 meses.
   * La carpeta se valida antes de guardarse (ver accounts.inspectRoot).
   */
  async pickRoot(mode: StartMode = "existing"): Promise<void> {
    this.rootWarning = null;
    try {
      const handle = await rootStore.chooseFolder();
      if (!handle) return;
      const info = await inspectRoot(browserFs(handle), handle.name);

      if (info.looksLikeYear) {
        const msg = `«${handle.name}» parece la carpeta de un año, no la carpeta raíz. Elige la carpeta que contiene los años (ej. la que tiene «2025», «2026»…).`;
        this.rootWarning = msg;
        if (this.rootStatus === "ready") pushToast(msg, "error");
        return;
      }

      if (mode === "new" && info.periods.length === 0 && info.otherEntries > 0) {
        // Onboarding muestra la confirmación (ver confirmStart / cancelStart).
        this.pendingStart = { handle, otherEntries: info.otherEntries };
        return;
      }

      await this.commitRoot(handle, mode === "new" && info.periods.length === 0);
      if (mode === "new" && info.periods.length > 0) {
        pushToast("Esta carpeta ya tenía periodos; se abrió tal cual.", "info");
      }
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "No se pudo abrir la carpeta.", "error");
    }
  }

  /** Confirmó usar una carpeta no vacía para empezar desde cero. */
  async confirmStart(): Promise<void> {
    const pending = this.pendingStart;
    if (!pending) return;
    try {
      await this.commitRoot(pending.handle, true);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "No se pudo preparar la carpeta.", "error");
    } finally {
      this.pendingStart = null;
    }
  }

  cancelStart(): void {
    this.pendingStart = null;
  }

  /** Guarda la carpeta como raíz y, si corresponde, crea el año actual. */
  private async commitRoot(handle: FileSystemDirectoryHandle, createBase: boolean): Promise<void> {
    await rootStore.saveRoot(handle);
    if (createBase) {
      const year = String(new Date().getFullYear());
      await createPeriod(browserFs(handle), year);
      this.period = year;
      this.monthNN = pad2(new Date().getMonth() + 1);
      this.view = "dashboard";
    }
    await this.useRoot(handle);
    pushToast(
      createBase
        ? `Carpeta lista: se creó ${this.period} con sus 12 meses. Agrega tus cuentas con «+ Servicio».`
        : "Carpeta configurada.",
      "success",
    );
  }

  /** Volver a pedir permiso sobre la carpeta guardada. Llamar desde un click. */
  async reconnect(): Promise<void> {
    if (!this.pendingHandle) return this.pickRoot();
    if (await rootStore.reconnect(this.pendingHandle)) {
      await this.useRoot(this.pendingHandle);
    } else {
      pushToast("Permiso denegado. Puedes elegir la carpeta de nuevo.", "error");
    }
  }

  /** Relee todo desde disco (periodos, recurrentes, mes actual y paneles abiertos). */
  async reload(): Promise<void> {
    if (this.rootStatus !== "ready") return;
    try {
      await this.loadAll();
      this.refreshTick += 1;
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "No se pudo leer la carpeta.", "error");
    }
  }

  private async loadAll(): Promise<void> {
    const [{ periods }, { services: recurring }] = await Promise.all([
      api.listPeriods(),
      api.getRecurring(),
    ]);
    this.periods = periods;
    this.recurring = recurring;
    if (periods.length && !periods.includes(this.period)) {
      this.period = periods[0];
    }
    if (this.period) {
      const { months } = await api.listMonths({ period: this.period });
      this.months = months;
    }
    await this.refresh();
  }

  /** Recarga los servicios y el resumen del mes actual. */
  async refresh(): Promise<void> {
    if (!this.period) {
      this.services = [];
      this.summary = { total: 0, pagados: 0, pendientes: 0 };
      this.pendingCount = 0;
      return;
    }
    const [{ services }, summary, { items }] = await Promise.all([
      api.listServices({ period: this.period, monthNN: this.monthNN }),
      api.getMonthSummary({ period: this.period, monthNN: this.monthNN }),
      api.listPending({ period: this.period }),
    ]);
    this.services = services;
    this.summary = summary;
    this.pendingCount = items.filter((it) => isPastOrCurrentMonth(this.period, it.monthNN)).length;
  }

  /** Cambia al mes/periodo actual (calendario), creando el cambio de vista necesario. */
  async goToCurrentMonth(): Promise<void> {
    const year = String(new Date().getFullYear());
    const monthNN = pad2(new Date().getMonth() + 1);
    if (!this.periods.includes(year)) {
      pushToast(`No existe el periodo ${year}. Créalo primero.`, "info");
      return;
    }
    if (this.period !== year) {
      await this.setPeriod(year);
    }
    await this.setMonth(monthNN);
  }

  async setPeriod(p: string): Promise<void> {
    this.period = p;
    const { months } = await api.listMonths({ period: p });
    this.months = months;
    await this.refresh();
  }

  async setMonth(nn: string): Promise<void> {
    this.monthNN = nn;
    this.view = "dashboard";
    await this.refresh();
  }

  async createPeriod(year: string): Promise<boolean> {
    const res = await api.createPeriod({ year });
    if (!res.ok) {
      pushToast(res.error ?? "No se pudo crear el periodo.", "error");
      return false;
    }
    const { periods } = await api.listPeriods();
    this.periods = periods;
    await this.setPeriod(year);
    pushToast(`Periodo ${year} creado con sus 12 meses.`, "success");
    return true;
  }

  async createService(categoria: string | null, nombre: string): Promise<boolean> {
    const res = await api.createService({
      period: this.period,
      monthNN: this.monthNN,
      categoria,
      nombre,
    });
    if (!res.ok) {
      pushToast(res.error ?? "No se pudo crear el servicio.", "error");
      return false;
    }
    await this.refresh();
    pushToast("Servicio creado.", "success");
    return true;
  }

  async applyTemplate(): Promise<boolean> {
    if (this.recurring.length === 0) {
      pushToast("No hay servicios recurrentes definidos.", "info");
      return true;
    }
    const { created, error } = await api.applyTemplate({
      period: this.period,
      monthNN: this.monthNN,
    });
    if (error) {
      pushToast(error, "error");
      return false;
    }
    await this.refresh();
    pushToast(created ? `${created} servicio(s) creado(s).` : "Nada que crear (ya existían).",
      "success");
    return true;
  }

  async copyPreviousMonth(): Promise<boolean> {
    const { created, from, error } = await api.copyPreviousMonth({
      period: this.period,
      monthNN: this.monthNN,
    });
    if (error) {
      pushToast(error, "error");
      return false;
    }
    if (!from) {
      pushToast("El mes anterior no tiene servicios.", "info");
      return true;
    }
    await this.refresh();
    pushToast(
      created ? `${created} servicio(s) copiados desde ${from}.` : `Nada nuevo desde ${from}.`,
      "success",
    );
    return true;
  }

  async saveRecurring(services: RecurringService[]): Promise<void> {
    const res = await api.setRecurring({ services });
    if (!res.ok) return pushToast(res.error ?? "No se pudo guardar.", "error");
    this.recurring = services;
    pushToast("Servicios recurrentes guardados.", "success");
  }
}

export const app = new AppStore();
export { MONTH_NAMES, pad2 };

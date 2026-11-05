// Estado global de la UI (runes) y acciones sobre la carpeta raíz.

import { api, setFs } from "./api";
import { browserFs } from "./fs/browser";
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

  /** Elegir (o cambiar) la carpeta raíz. Llamar desde un click. */
  async pickRoot(): Promise<void> {
    try {
      const handle = await rootStore.pickRoot();
      if (!handle) return;
      await this.useRoot(handle);
      pushToast("Carpeta configurada.", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "No se pudo abrir la carpeta.", "error");
    }
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

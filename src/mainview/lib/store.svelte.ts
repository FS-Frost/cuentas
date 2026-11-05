// Estado global de la UI (runes) y acciones sobre el backend.

import { api, onRootChanged } from "./rpc";
import { pushToast } from "./toast.svelte";
import { SvelteSet } from "svelte/reactivity";
import type {
  MonthInfo,
  MonthSummary,
  RecurringService,
  ServiceInfo,
} from "../../shared/rpc";

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
  root = $state<string | null>(null);

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
    const { path } = await api.getRootFolder();
    this.root = path;
    if (path) await this.loadAll();
    this.loading = false;

    // Auto-refresh ante cambios externos en disco.
    onRootChanged(() => {
      void this.refresh();
    });
  }

  async pickRoot(): Promise<void> {
    const { path } = await api.pickRootFolder();
    if (path) {
      this.root = path;
      await this.loadAll();
      pushToast("Carpeta configurada.", "success");
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

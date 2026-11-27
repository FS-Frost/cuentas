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
// Al volver el foco, los pendientes del año (12 meses) se recalculan como mucho
// cada 5 min; el mes visible se relee siempre.
const PENDING_REFRESH_MIN_MS = 5 * 60_000;

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
  /** Paso actual que muestra la pantalla de carga (ver +page.svelte). */
  loadingStep = $state("Iniciando…");
  rootStatus = $state<RootStatus>("none");
  /** Nombre de la carpeta raíz (el navegador no expone la ruta completa). */
  rootName = $state<string | null>(null);
  /** Se incrementa en cada refresco externo (foco, botón Recargar) para que los paneles recarguen. */
  refreshTick = $state(0);
  /** Se incrementa cuando se recalculan los pendientes del año por un refresco externo (PendingPanel). */
  pendingTick = $state(0);
  /** Aviso a mostrar en el inicio tras elegir una carpeta inválida. */
  rootWarning = $state<string | null>(null);
  /** Navegación ‹ › hacia un año que no existe: espera confirmación para crearlo. */
  pendingYear = $state<{ year: string; monthNN: string } | null>(null);
  /** "Empezar desde cero" con una carpeta no vacía: espera confirmación. */
  pendingStart = $state<{ handle: FileSystemDirectoryHandle; otherEntries: number } | null>(null);
  private pendingHandle: FileSystemDirectoryHandle | null = null;
  private lastFocusRefresh = 0;
  private lastPendingAt = 0;

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
      const state = await rootStore.loadRoot((step) => (this.loadingStep = step));
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
      void this.refreshOnFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
  }

  private async useRoot(handle: FileSystemDirectoryHandle): Promise<void> {
    setFs(browserFs(handle));
    this.rootName = handle.name;
    this.rootStatus = "ready";
    this.pendingHandle = null;
    // Pantalla de carga con pasos también al reconectar o elegir carpeta.
    this.loading = true;
    try {
      await this.loadAll(true);
    } finally {
      this.loading = false;
    }
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

  /**
   * Recuperar el acceso a la carpeta guardada. Llamar desde un click.
   * No usa requestPermission: en la PWA instalada de Edge puede no responder
   * nunca (igual que queryPermission). Abre el selector, que el navegador
   * posiciona en la última carpeta elegida (id "cuentas-root"), y la nueva
   * elección reemplaza al handle guardado.
   */
  async reconnect(): Promise<void> {
    await this.pickRoot("existing");
  }

  /** Relee todo desde disco (periodos, recurrentes, mes actual y paneles abiertos). */
  async reload(): Promise<void> {
    if (this.rootStatus !== "ready") return;
    try {
      await this.loadAll();
      this.refreshTick += 1;
      this.pendingTick += 1;
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "No se pudo leer la carpeta.", "error");
    }
  }

  private async loadAll(showProgress = false): Promise<void> {
    if (showProgress) this.loadingStep = "Leyendo periodos…";
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
    await this.refresh(showProgress);
  }

  /** Recarga el mes visible y los pendientes del año. */
  async refresh(showProgress = false): Promise<void> {
    if (!this.period) {
      this.services = [];
      this.summary = { total: 0, pagados: 0, pendientes: 0 };
      this.pendingCount = 0;
      return;
    }
    await Promise.all([this.refreshMonth(), this.refreshPending(showProgress)]);
  }

  /** Solo el mes visible (una carpeta): servicios y resumen. */
  private async refreshMonth(): Promise<void> {
    const { services } = await api.listServices({ period: this.period, monthNN: this.monthNN });
    this.services = services;
    // El resumen se deriva de los servicios ya leídos (sin releer la carpeta).
    const pagados = services.filter((s) => s.paid).length;
    this.summary = { total: services.length, pagados, pendientes: services.length - pagados };
  }

  /** Pendientes del año (recorre los 12 meses): badge de la barra superior. */
  private async refreshPending(showProgress = false): Promise<void> {
    const period = this.period;
    const { items } = await api.listPending({
      period,
      onMonth: showProgress
        ? (n) => (this.loadingStep = `Leyendo ${period} (mes ${n} de 12)…`)
        : undefined,
    });
    this.lastPendingAt = Date.now();
    if (period !== this.period) return; // cambió de año mientras leía
    this.pendingCount = items.filter((it) => isPastOrCurrentMonth(period, it.monthNN)).length;
  }

  /**
   * Refresco al volver el foco (cambios hechos desde el Explorador o la nube).
   * Liviano: relee solo el mes visible; los pendientes del año, solo si
   * pasaron PENDING_REFRESH_MIN_MS. Recargar (reload) relee todo.
   */
  private async refreshOnFocus(): Promise<void> {
    if (this.rootStatus !== "ready" || !this.period) return;
    try {
      await this.refreshMonth();
      this.refreshTick += 1;
      if (Date.now() - this.lastPendingAt >= PENDING_REFRESH_MIN_MS) {
        await this.refreshPending();
        this.pendingTick += 1;
      }
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "No se pudo leer la carpeta.", "error");
    }
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

  /**
   * Mes anterior/siguiente (‹ ›), cruzando de año. Si el año destino no
   * existe, deja pendingYear para que la UI ofrezca crearlo.
   */
  async stepMonth(delta: 1 | -1): Promise<void> {
    if (!this.period) return;
    let year = parseInt(this.period, 10);
    let month = parseInt(this.monthNN, 10) + delta;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    const period = String(year);
    const monthNN = pad2(month);
    if (period !== this.period && !this.periods.includes(period)) {
      this.pendingYear = { year: period, monthNN };
      return;
    }
    if (period !== this.period) await this.setPeriod(period);
    await this.setMonth(monthNN);
  }

  /** Confirmó crear el año al que se quería navegar. */
  async confirmPendingYear(): Promise<void> {
    const pending = this.pendingYear;
    this.pendingYear = null;
    if (!pending) return;
    if (await this.createPeriod(pending.year)) await this.setMonth(pending.monthNN);
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

  /**
   * Renombra el año seleccionado. En Edge no hay move() para carpetas, así que
   * copia todo y borra la original: puede tardar; se muestra la pantalla de carga.
   */
  async renamePeriod(newYear: string): Promise<boolean> {
    const from = this.period;
    const to = newYear.trim();
    if (!from || to === from) return true;
    this.loadingStep = `Renombrando ${from} a ${to}…`;
    this.loading = true;
    try {
      const res = await api.renameEntry({ target: { kind: "period", period: from }, newName: to });
      if (!res.ok) {
        pushToast(res.error ?? "No se pudo renombrar el año.", "error");
        return false;
      }
      this.period = to;
      await this.loadAll();
      this.pendingTick += 1;
      pushToast(`Año ${from} renombrado a ${to}.`, "success");
      return true;
    } finally {
      this.loading = false;
    }
  }

  /** Elimina el año seleccionado con todos sus comprobantes (definitivo). */
  async deletePeriod(): Promise<boolean> {
    const year = this.period;
    if (!year) return false;
    this.loadingStep = `Eliminando ${year}…`;
    this.loading = true;
    try {
      const res = await api.deleteEntry({ target: { kind: "period", period: year } });
      if (!res.ok) {
        pushToast(res.error ?? "No se pudo eliminar el año.", "error");
        return false;
      }
      // loadAll elige el año más reciente que quede; si no queda ninguno, ninguno.
      this.period = "";
      this.months = [];
      this.view = "dashboard";
      await this.loadAll();
      this.pendingTick += 1;
      pushToast(`Año ${year} eliminado.`, "success");
      return true;
    } finally {
      this.loading = false;
    }
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

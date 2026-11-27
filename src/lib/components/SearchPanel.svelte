<script lang="ts">
  import { app } from "../store.svelte";
  import { api } from "../api";
  import type { ServiceHit } from "../domain/types";

  let {
    query,
    onGoto,
  }: { query: string; onGoto: (monthNN: string, folder: string) => void } = $props();

  let categoria = $state<string>("");
  let estado = $state<"all" | "paid" | "pending">("all");
  let items = $state<ServiceHit[]>([]);
  let loading = $state(false);

  async function run() {
    loading = true;
    const res = await api.search({
      period: app.period,
      query,
      categoria: categoria || null,
      estado,
    });
    items = res.items;
    loading = false;
  }

  // Re-ejecuta al cambiar query/filtros/periodo.
  $effect(() => {
    void query;
    void categoria;
    void estado;
    void app.period;
    void run();
  });
</script>

<div class="p-5">
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100">
      Resultados {#if query}para “{query}”{/if}
    </h2>
    <select class="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm" bind:value={categoria}>
      <option value="">Todas las categorías</option>
      {#each app.categorias as c (c)}
        <option value={c}>{c}</option>
      {/each}
    </select>
    <select class="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm" bind:value={estado}>
      <option value="all">Todos</option>
      <option value="paid">Pagados</option>
      <option value="pending">Pendientes</option>
    </select>
  </div>

  {#if loading}
    <p class="text-slate-400 dark:text-slate-500">Buscando…</p>
  {:else if items.length === 0}
    <p class="text-slate-400 dark:text-slate-500">Sin coincidencias en {app.period}.</p>
  {:else}
    <ul class="flex flex-col gap-1.5">
      {#each items as it (it.monthNN + it.folder)}
        <li>
          <button
            class="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            onclick={() => onGoto(it.monthNN, it.folder)}
          >
            <span class="truncate">
              <span class="text-xs text-slate-400 dark:text-slate-500">{it.monthNN} · {it.monthName} · </span>
              {#if it.categoria}<span class="text-xs text-slate-400 dark:text-slate-500">{it.categoria} · </span>{/if}
              <span class="text-slate-700 dark:text-slate-200">{it.nombre}</span>
            </span>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold {it.paid
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}"
            >{it.paid ? "Pagado" : "Pendiente"}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

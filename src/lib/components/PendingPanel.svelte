<script lang="ts">
  import { app } from "../store.svelte";
  import { api } from "../api";
  import { SvelteMap } from "svelte/reactivity";
  import type { PendingItem } from "../domain/types";
  import Icon from "./Icon.svelte";

  let { onGoto }: { onGoto: (monthNN: string, folder: string) => void } = $props();

  let items = $state<PendingItem[]>([]);
  let loading = $state(true);

  async function load() {
    loading = true;
    const res = await api.listPending({ period: app.period });
    items = res.items;
    loading = false;
  }

  $effect(() => {
    // Reacciona al periodo seleccionado y a refrescos externos (foco, Recargar).
    void app.period;
    void app.pendingTick;
    void load();
  });

  const byMonth = $derived.by(() => {
    const groups = new SvelteMap<string, PendingItem[]>();
    for (const it of items) {
      const key = `${it.monthNN} · ${it.monthName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }
    return Array.from(groups.entries());
  });
</script>

<div class="p-5">
  <h2 class="mb-1 text-xl font-semibold text-slate-800 dark:text-slate-100">
    Pendientes <span class="text-slate-400 dark:text-slate-500">{app.period}</span>
  </h2>
  <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">Servicios sin comprobante en el periodo.</p>

  {#if loading}
    <p class="text-slate-400 dark:text-slate-500">Cargando…</p>
  {:else if items.length === 0}
    <div class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-8 text-center text-emerald-600 dark:text-emerald-400">
      <Icon name="check-circle" class="h-8 w-8" />
      No hay servicios pendientes en {app.period}.
    </div>
  {:else}
    <div class="flex flex-col gap-5">
      {#each byMonth as [month, group] (month)}
        <div>
          <h3 class="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{month}</h3>
          <ul class="flex flex-col gap-1.5">
            {#each group as it (it.monthNN + it.folder)}
              <li>
                <button
                  class="flex w-full items-center justify-between rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 p-3 text-left hover:bg-red-50 dark:hover:bg-red-950/40"
                  onclick={() => onGoto(it.monthNN, it.folder)}
                >
                  <span class="truncate">
                    {#if it.categoria}<span class="text-xs text-slate-400 dark:text-slate-500">{it.categoria} · </span>{/if}
                    <span class="text-slate-700 dark:text-slate-200">{it.nombre}</span>
                  </span>
                  <span class="shrink-0 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">Pendiente</span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  {/if}
</div>

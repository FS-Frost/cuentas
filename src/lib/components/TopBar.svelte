<script lang="ts">
  import { app } from "../store.svelte";
  import Icon from "./Icon.svelte";

  let {
    onNewPeriod,
    onSearch,
  }: { onNewPeriod: () => void; onSearch: (q: string) => void } = $props();

  let query = $state("");

  function submitSearch(e: Event) {
    e.preventDefault();
    onSearch(query);
  }
</script>

<header class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
  <div class="flex items-center gap-2 text-lg font-semibold text-slate-800">
    <Icon name="file" class="h-5 w-5" /> Cuentas
  </div>

  <!-- Periodo -->
  <div class="flex items-center gap-1">
    <select
      class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
      value={app.period}
      onchange={(e) => app.setPeriod((e.currentTarget as HTMLSelectElement).value)}
      disabled={app.periods.length === 0}
    >
      {#each app.periods as p (p)}
        <option value={p}>{p}</option>
      {/each}
      {#if app.periods.length === 0}
        <option>— sin periodos —</option>
      {/if}
    </select>
    <button
      class="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      onclick={onNewPeriod}
      title="Nuevo periodo (año)"
    >+ Año</button>
  </div>

  <!-- Mes -->
  <select
    class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
    value={app.monthNN}
    onchange={(e) => app.setMonth((e.currentTarget as HTMLSelectElement).value)}
    disabled={!app.period}
  >
    {#each app.months as m (m.nn)}
      <option value={m.nn}>{m.folder}</option>
    {/each}
  </select>

  <button
    class="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
    onclick={() => app.goToCurrentMonth()}
    title="Ir al mes actual"
  >Hoy</button>

  <!-- Búsqueda -->
  <form class="flex-1" onsubmit={submitSearch}>
    <input
      class="w-full max-w-xs rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      type="search"
      placeholder="Buscar servicio en {app.period || 'el periodo'}…"
      bind:value={query}
      disabled={!app.period}
    />
  </form>

  <!-- Alerta de pendientes -->
  {#if app.pendingCount > 0}
    <button
      class="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-200"
      onclick={() => (app.view = "pending")}
      title="Ver cuentas pendientes"
    >{app.pendingCount} pendiente{app.pendingCount === 1 ? "" : "s"}</button>
  {/if}

  <!-- Vistas -->
  <nav class="flex items-center gap-1">
    <button
      class="rounded-md px-3 py-1.5 text-sm {app.view === 'dashboard'
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 hover:bg-slate-100'}"
      onclick={() => (app.view = "dashboard")}
    >Mes</button>
    <button
      class="rounded-md px-3 py-1.5 text-sm {app.view === 'pending'
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 hover:bg-slate-100'}"
      onclick={() => (app.view = "pending")}
    >Pendientes</button>
    <button
      class="rounded-md px-3 py-1.5 text-sm {app.view === 'recurring'
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 hover:bg-slate-100'}"
      onclick={() => (app.view = "recurring")}
    >Recurrentes</button>
  </nav>

  <button
    class="rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50"
    onclick={() => app.reload()}
    title="Recargar desde disco"
    aria-label="Recargar desde disco"
  ><Icon name="refresh" class="h-4 w-4" /></button>

  <button
    class="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
    onclick={() => app.pickRoot()}
    title={app.rootName ? `Carpeta actual: ${app.rootName}` : ""}
  >Cambiar carpeta</button>
</header>

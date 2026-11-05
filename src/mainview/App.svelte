<script lang="ts">
  import { app } from "./lib/store.svelte";
  import type { ServiceInfo } from "../shared/rpc";
  import Onboarding from "./lib/components/Onboarding.svelte";
  import TopBar from "./lib/components/TopBar.svelte";
  import Dashboard from "./lib/components/Dashboard.svelte";
  import PendingPanel from "./lib/components/PendingPanel.svelte";
  import SearchPanel from "./lib/components/SearchPanel.svelte";
  import RecurringSettings from "./lib/components/RecurringSettings.svelte";
  import ServicePanel from "./lib/components/ServicePanel.svelte";
  import Viewer from "./lib/components/Viewer.svelte";
  import Toasts from "./lib/components/Toasts.svelte";
  import Modal from "./lib/components/Modal.svelte";
  import Icon from "./lib/components/Icon.svelte";

  let selected = $state<ServiceInfo | null>(null);
  let viewer = $state<{ service: string; name: string } | null>(null);
  let searchQuery = $state("");

  // Modales
  let showNewPeriod = $state(false);
  let newYear = $state(String(new Date().getFullYear()));
  let showNewService = $state(false);
  let svcCategoria = $state("");
  let svcNombre = $state("");

  app.init();

  function openService(s: ServiceInfo) {
    selected = s;
  }

  async function gotoService(monthNN: string, folder: string) {
    await app.setMonth(monthNN);
    app.view = "dashboard";
    const found = app.services.find((s) => s.folder === folder);
    selected = found ?? null;
  }

  function runSearch(q: string) {
    searchQuery = q;
    app.view = "search";
  }

  async function submitNewPeriod() {
    if (await app.createPeriod(newYear)) showNewPeriod = false;
  }

  async function submitNewService() {
    const ok = await app.createService(svcCategoria.trim() || null, svcNombre);
    if (ok) {
      showNewService = false;
      svcCategoria = "";
      svcNombre = "";
    }
  }

  // Mantener el servicio seleccionado sincronizado tras refrescos.
  $effect(() => {
    if (selected) {
      const fresh = app.services.find((s) => s.folder === selected!.folder);
      if (fresh) selected = fresh;
    }
  });
</script>

{#if app.loading}
  <div class="flex h-full items-center justify-center text-slate-400">Cargando…</div>
{:else if !app.root}
  <Onboarding />
{:else}
  <div class="flex h-full flex-col">
    <TopBar onNewPeriod={() => (showNewPeriod = true)} onSearch={runSearch} />

    <main class="flex-1 overflow-y-auto">
      {#if app.periods.length === 0}
        <div class="flex flex-col items-center gap-3 p-16 text-center text-slate-400">
          <Icon name="calendar" class="h-8 w-8" />
          <p>No hay periodos todavía.</p>
          <button
            class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onclick={() => (showNewPeriod = true)}
          >Crear primer periodo</button>
        </div>
      {:else if app.view === "dashboard"}
        <Dashboard onOpenService={openService} onNewService={() => (showNewService = true)} />
      {:else if app.view === "pending"}
        <PendingPanel onGoto={gotoService} />
      {:else if app.view === "search"}
        <SearchPanel query={searchQuery} onGoto={gotoService} />
      {:else if app.view === "recurring"}
        <RecurringSettings />
      {/if}
    </main>
  </div>

  {#if selected}
    <ServicePanel
      service={selected}
      onClose={() => (selected = null)}
      onViewFile={(name) => (viewer = { service: selected!.folder, name })}
    />
  {/if}

  {#if viewer}
    <Viewer service={viewer.service} name={viewer.name} onClose={() => (viewer = null)} />
  {/if}
{/if}

<!-- Modal: nuevo periodo -->
{#if showNewPeriod}
  <Modal title="Nuevo periodo" onClose={() => (showNewPeriod = false)}>
    <label class="mb-1 block text-sm text-slate-500" for="year">Año (4 dígitos)</label>
    <input
      id="year"
      class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      bind:value={newYear}
      onkeydown={(e) => e.key === "Enter" && submitNewPeriod()}
    />
    <p class="mt-2 text-xs text-slate-400">Se crearán automáticamente los 12 meses.</p>
    {#snippet footer()}
      <button class="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onclick={() => (showNewPeriod = false)}>Cancelar</button>
      <button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onclick={submitNewPeriod}>Crear</button>
    {/snippet}
  </Modal>
{/if}

<!-- Modal: nuevo servicio -->
{#if showNewService}
  <Modal title={`Nuevo servicio · ${app.monthName} ${app.period}`} onClose={() => (showNewService = false)}>
    <label class="mb-1 block text-sm text-slate-500" for="cat">Categoría (opcional)</label>
    <input
      id="cat"
      class="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      list="cat-list"
      placeholder="ej. Depto, Casa"
      bind:value={svcCategoria}
    />
    <datalist id="cat-list">
      {#each app.categorias as c (c)}
        <option value={c}></option>
      {/each}
    </datalist>
    <label class="mb-1 block text-sm text-slate-500" for="nom">Nombre</label>
    <input
      id="nom"
      class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      placeholder="ej. Aguas Andinas"
      bind:value={svcNombre}
      onkeydown={(e) => e.key === "Enter" && submitNewService()}
    />
    {#snippet footer()}
      <button class="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onclick={() => (showNewService = false)}>Cancelar</button>
      <button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onclick={submitNewService}>Crear</button>
    {/snippet}
  </Modal>
{/if}

<Toasts />

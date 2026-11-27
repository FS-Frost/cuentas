<script lang="ts">
  import { app } from "$lib/store.svelte";
  import type { ServiceInfo } from "$lib/domain/types";
  import Onboarding from "$lib/components/Onboarding.svelte";
  import TopBar from "$lib/components/TopBar.svelte";
  import Dashboard from "$lib/components/Dashboard.svelte";
  import PendingPanel from "$lib/components/PendingPanel.svelte";
  import SearchPanel from "$lib/components/SearchPanel.svelte";
  import RecurringSettings from "$lib/components/RecurringSettings.svelte";
  import ServicePanel from "$lib/components/ServicePanel.svelte";
  import Toasts from "$lib/components/Toasts.svelte";
  import UpdateBanner from "$lib/components/UpdateBanner.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import Icon from "$lib/components/Icon.svelte";

  let selected = $state<ServiceInfo | null>(null);
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

  // Renombrar / eliminar el año seleccionado
  let showRenamePeriod = $state(false);
  let renameYear = $state("");
  let showDeletePeriod = $state(false);
  let deleteTyped = $state("");

  function openRenamePeriod() {
    renameYear = app.period;
    showRenamePeriod = true;
  }

  async function submitRenamePeriod() {
    const to = renameYear.trim();
    if (!/^\d{4}$/.test(to)) return; // el botón ya está deshabilitado
    showRenamePeriod = false; // la pantalla de carga muestra el avance
    selected = null;
    await app.renamePeriod(to);
  }

  function openDeletePeriod() {
    deleteTyped = "";
    showDeletePeriod = true;
  }

  async function submitDeletePeriod() {
    if (deleteTyped.trim() !== app.period) return;
    showDeletePeriod = false;
    selected = null;
    await app.deletePeriod();
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
  <div class="flex h-full flex-col items-center justify-center gap-4 text-slate-400 dark:text-slate-500" role="status" aria-live="polite">
    <div class="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-600"></div>
    <p class="text-sm">{app.loadingStep}</p>
  </div>
{:else if app.rootStatus !== "ready"}
  <Onboarding />
{:else}
  <div class="flex h-full flex-col">
    <TopBar
      onNewPeriod={() => (showNewPeriod = true)}
      onRenamePeriod={openRenamePeriod}
      onDeletePeriod={openDeletePeriod}
      onSearch={runSearch}
    />

    <main class="flex-1 overflow-y-auto">
      {#if app.periods.length === 0}
        <div class="flex flex-col items-center gap-3 p-16 text-center text-slate-400 dark:text-slate-500">
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
    <ServicePanel service={selected} onClose={() => (selected = null)} />
  {/if}
{/if}

<!-- Modal: nuevo periodo -->
{#if showNewPeriod}
  <Modal title="Nuevo periodo" onClose={() => (showNewPeriod = false)}>
    <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400" for="year">Año (4 dígitos)</label>
    <input
      id="year"
      class="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
      bind:value={newYear}
      onkeydown={(e) => e.key === "Enter" && submitNewPeriod()}
    />
    <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">Se crearán automáticamente los 12 meses.</p>
    {#snippet footer()}
      <button class="rounded-md px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => (showNewPeriod = false)}>Cancelar</button>
      <button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onclick={submitNewPeriod}>Crear</button>
    {/snippet}
  </Modal>
{/if}

<!-- Modal: renombrar año -->
{#if showRenamePeriod}
  {@const valid = /^\d{4}$/.test(renameYear.trim()) && renameYear.trim() !== app.period}
  <Modal title={`Renombrar año ${app.period}`} onClose={() => (showRenamePeriod = false)}>
    <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400" for="rename-year">Nuevo año (4 dígitos)</label>
    <input
      id="rename-year"
      class="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
      bind:value={renameYear}
      onkeydown={(e) => e.key === "Enter" && valid && submitRenamePeriod()}
    />
    <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
      Se copian todas sus carpetas y comprobantes al nombre nuevo y luego se borra el original;
      con muchos archivos puede tardar. Las notas se conservan.
    </p>
    {#snippet footer()}
      <button class="rounded-md px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => (showRenamePeriod = false)}>Cancelar</button>
      <button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onclick={submitRenamePeriod} disabled={!valid}>Renombrar</button>
    {/snippet}
  </Modal>
{/if}

<!-- Modal: eliminar año (confirmación escrita) -->
{#if showDeletePeriod}
  {@const matches = deleteTyped.trim() === app.period}
  <Modal title={`Eliminar año ${app.period}`} onClose={() => (showDeletePeriod = false)}>
    <p class="text-sm text-slate-600 dark:text-slate-300">
      Se borran del disco <strong>todos los meses, servicios y comprobantes</strong> de
      {app.period}, de forma definitiva (no pasa por la papelera) y no se puede deshacer.
    </p>
    <label class="mb-1 mt-3 block text-sm text-slate-500 dark:text-slate-400" for="delete-year">
      Escribe <strong>{app.period}</strong> para confirmar
    </label>
    <input
      id="delete-year"
      class="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
      bind:value={deleteTyped}
      autocomplete="off"
      onkeydown={(e) => e.key === "Enter" && matches && submitDeletePeriod()}
    />
    {#snippet footer()}
      <button class="rounded-md px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => (showDeletePeriod = false)}>Cancelar</button>
      <button class="rounded-md bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700 disabled:opacity-50" onclick={submitDeletePeriod} disabled={!matches}>Eliminar {app.period}</button>
    {/snippet}
  </Modal>
{/if}

<!-- Modal: nuevo servicio -->
{#if showNewService}
  <Modal title={`Nuevo servicio · ${app.monthName} ${app.period}`} onClose={() => (showNewService = false)}>
    <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400" for="cat">Categoría (opcional)</label>
    <input
      id="cat"
      class="mb-3 w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
      list="cat-list"
      placeholder="ej. Depto, Casa"
      bind:value={svcCategoria}
    />
    <datalist id="cat-list">
      {#each app.categorias as c (c)}
        <option value={c}></option>
      {/each}
    </datalist>
    <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400" for="nom">Nombre</label>
    <input
      id="nom"
      class="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
      placeholder="ej. Aguas Andinas"
      bind:value={svcNombre}
      onkeydown={(e) => e.key === "Enter" && submitNewService()}
    />
    {#snippet footer()}
      <button class="rounded-md px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => (showNewService = false)}>Cancelar</button>
      <button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onclick={submitNewService}>Crear</button>
    {/snippet}
  </Modal>
{/if}

<!-- Navegar con ‹ › hacia un año que no existe -->
{#if app.pendingYear}
  <ConfirmModal
    title={`Crear ${app.pendingYear.year}`}
    message={`El año ${app.pendingYear.year} no existe todavía. ¿Crearlo con sus 12 meses?`}
    confirmLabel={`Crear ${app.pendingYear.year}`}
    onConfirm={() => app.confirmPendingYear()}
    onCancel={() => (app.pendingYear = null)}
  />
{/if}

<Toasts />
<UpdateBanner />

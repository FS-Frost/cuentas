<script lang="ts">
  import { app } from "../store.svelte";
  import type { ServiceInfo } from "../../../shared/rpc";
  import ServiceCard from "./ServiceCard.svelte";
  import Icon from "./Icon.svelte";
  import ConfirmModal from "./ConfirmModal.svelte";

  let {
    onOpenService,
    onNewService,
  }: {
    onOpenService: (s: ServiceInfo) => void;
    onNewService: () => void;
  } = $props();

  // Pendientes primero, pagados después.
  const sortedServices = $derived(
    [...app.services].sort((a, b) => Number(a.paid) - Number(b.paid)),
  );

  let pendingAction = $state<"applyTemplate" | "copyPreviousMonth" | null>(null);

  function onApplyTemplateClick() {
    if (app.recurring.length === 0) {
      app.applyTemplate();
      return;
    }
    pendingAction = "applyTemplate";
  }
</script>

<div class="flex flex-col gap-4 p-5">
  <!-- Encabezado del mes -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold text-slate-800">
        {app.monthName}
        <span class="text-slate-400">{app.period}</span>
      </h2>
      <p class="text-sm text-slate-500">
        {app.summary.pagados} pagados · {app.summary.pendientes} pendientes ·
        {app.summary.total} servicios
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        onclick={onNewService}
      >+ Servicio</button>
      <button
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        onclick={onApplyTemplateClick}
        title="Crea las carpetas de tus servicios recurrentes que falten"
      >Aplicar plantilla</button>
      <button
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        onclick={() => (pendingAction = "copyPreviousMonth")}
        title="Copia las carpetas de servicio del mes anterior"
      >Copiar mes anterior</button>
    </div>
  </div>

  <!-- Grilla de servicios -->
  {#if app.services.length === 0}
    <div
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/50 p-10 text-center text-slate-400"
    >
      <Icon name="folder" class="h-8 w-8" />
      <p>No hay servicios en este mes.</p>
      <p class="text-sm">
        Crea uno, aplica tu plantilla de recurrentes o copia el mes anterior.
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each sortedServices as service (service.folder)}
        <ServiceCard {service} onOpen={onOpenService} />
      {/each}
    </div>
  {/if}
</div>

{#if pendingAction === "applyTemplate"}
  <ConfirmModal
    title="Aplicar plantilla"
    message="¿Aplicar la plantilla de servicios recurrentes a este mes? Se crearán las carpetas de los servicios que falten; los servicios que ya existan no se modificarán."
    confirmLabel="Aplicar"
    onConfirm={async () => {
      if (await app.applyTemplate()) pendingAction = null;
    }}
    onCancel={() => (pendingAction = null)}
  />
{:else if pendingAction === "copyPreviousMonth"}
  <ConfirmModal
    title="Copiar mes anterior"
    message="¿Copiar los servicios del mes anterior a este mes? Se crearán las carpetas que falten a partir del mes previo; los servicios que ya existan no se modificarán."
    confirmLabel="Copiar"
    onConfirm={async () => {
      if (await app.copyPreviousMonth()) pendingAction = null;
    }}
    onCancel={() => (pendingAction = null)}
  />
{/if}

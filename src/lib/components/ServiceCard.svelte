<script lang="ts">
  import type { ServiceInfo } from "../domain/types";

  let {
    service,
    onOpen,
  }: { service: ServiceInfo; onOpen: (s: ServiceInfo) => void } = $props();
</script>

<button
  class="flex w-full flex-col gap-2 rounded-xl border bg-white dark:bg-slate-900 p-4 text-left shadow-sm transition hover:shadow-md {service.paid
    ? 'border-emerald-200 dark:border-emerald-800'
    : 'border-red-300 dark:border-red-700'}"
  onclick={() => onOpen(service)}
>
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0">
      {#if service.categoria}
        <span
          class="mb-1 inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400"
          >{service.categoria}</span
        >
      {/if}
      <div class="truncate font-medium text-slate-800 dark:text-slate-100" title={service.nombre}>
        {service.nombre}
      </div>
    </div>
    <span
      class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold {service.paid
        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'}"
    >
      {service.paid ? "Pagado" : "Pendiente"}
    </span>
  </div>
  <div class="text-xs text-slate-400 dark:text-slate-500">
    {service.fileCount}
    {service.fileCount === 1 ? "comprobante" : "comprobantes"}
  </div>
</button>

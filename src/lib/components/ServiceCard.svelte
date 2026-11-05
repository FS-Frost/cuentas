<script lang="ts">
  import type { ServiceInfo } from "../domain/types";

  let {
    service,
    onOpen,
  }: { service: ServiceInfo; onOpen: (s: ServiceInfo) => void } = $props();
</script>

<button
  class="flex w-full flex-col gap-2 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md {service.paid
    ? 'border-emerald-200'
    : 'border-red-300'}"
  onclick={() => onOpen(service)}
>
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0">
      {#if service.categoria}
        <span
          class="mb-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
          >{service.categoria}</span
        >
      {/if}
      <div class="truncate font-medium text-slate-800" title={service.nombre}>
        {service.nombre}
      </div>
    </div>
    <span
      class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold {service.paid
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-red-100 text-red-700'}"
    >
      {service.paid ? "Pagado" : "Pendiente"}
    </span>
  </div>
  <div class="text-xs text-slate-400">
    {service.fileCount}
    {service.fileCount === 1 ? "comprobante" : "comprobantes"}
  </div>
</button>

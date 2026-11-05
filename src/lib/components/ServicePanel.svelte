<script lang="ts">
  import { app } from "../store.svelte";
  import { api } from "../api";
  import { pushToast } from "../toast.svelte";
  import { openOrDownload } from "../openFile";
  import type { FileInfo, ServiceInfo, TargetRef } from "../domain/types";
  import Modal from "./Modal.svelte";
  import ConfirmModal from "./ConfirmModal.svelte";
  import Icon, { type IconName } from "./Icon.svelte";

  let {
    service,
    onClose,
  }: {
    service: ServiceInfo;
    onClose: () => void;
  } = $props();

  let fileInput = $state<HTMLInputElement | null>(null);

  let files = $state<FileInfo[]>([]);
  let notes = $state("");
  let notesDirty = $state(false);
  let dragOver = $state(false);
  let busy = $state(false);

  // Renombrar / confirmar borrado
  let renameTarget = $state<{ target: TargetRef; label: string; originalName: string } | null>(null);
  let renameValue = $state("");
  let pendingRename = $state<
    { target: TargetRef; label: string; originalName: string; newValue: string } | null
  >(null);
  let confirmTarget = $state<{ target: TargetRef; label: string } | null>(null);

  const coords = $derived({ period: app.period, monthNN: app.monthNN, service: service.folder });

  // Cargar archivos + notas cuando cambia el servicio o hay un refresco externo.
  $effect(() => {
    const svc = service.folder;
    void app.refreshTick;
    void load(svc);
  });

  async function load(svc: string) {
    const [{ files: f }, { notes: n }] = await Promise.all([
      api.listFiles({ period: app.period, monthNN: app.monthNN, service: svc }),
      api.getNotes({ period: app.period, monthNN: app.monthNN, service: svc }),
    ]);
    files = f;
    notes = n;
    notesDirty = false;
  }

  async function refreshEverything() {
    await Promise.all([load(service.folder), app.refresh()]);
  }

  async function importFiles(selected: File[]) {
    if (selected.length === 0) return;
    busy = true;
    try {
      const { added, error } = await api.importFiles({ ...coords, files: selected });
      if (error) pushToast(error, "error");
      else pushToast(`${added} comprobante(s) agregado(s).`, "success");
      await refreshEverything();
    } finally {
      busy = false;
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    await importFiles(Array.from(e.dataTransfer?.files ?? []));
  }

  async function handlePicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = ""; // permite volver a elegir el mismo archivo
    await importFiles(picked);
  }

  async function openFile(file: FileInfo) {
    const error = await openOrDownload(file.name, () =>
      api.readFile({ ...coords, name: file.name }),
    );
    if (error) pushToast(error, "error");
  }

  async function saveNotes() {
    const res = await api.setNotes({ ...coords, notes });
    if (res.ok) {
      notesDirty = false;
      pushToast("Nota guardada.", "success");
    } else {
      pushToast(res.error ?? "No se pudo guardar la nota.", "error");
    }
  }

  function fileTarget(name: string): TargetRef {
    return { kind: "file", period: app.period, monthNN: app.monthNN, service: service.folder, name };
  }

  function serviceTarget(): TargetRef {
    return { kind: "service", period: app.period, monthNN: app.monthNN, service: service.folder };
  }

  function openRename(target: TargetRef, label: string, current: string) {
    renameTarget = { target, label, originalName: current };
    renameValue = current;
  }

  function requestRenameConfirm() {
    if (!renameTarget) return;
    pendingRename = { ...renameTarget, newValue: renameValue };
    renameTarget = null;
  }

  function cancelPendingRename() {
    if (!pendingRename) return;
    renameTarget = {
      target: pendingRename.target,
      label: pendingRename.label,
      originalName: pendingRename.originalName,
    };
    renameValue = pendingRename.newValue;
    pendingRename = null;
  }

  async function doRename() {
    if (!pendingRename) return;
    const res = await api.renameEntry({ target: pendingRename.target, newName: pendingRename.newValue });
    if (!res.ok) return pushToast(res.error ?? "No se pudo renombrar.", "error");
    const wasService = pendingRename.target.kind === "service";
    pendingRename = null;
    pushToast("Renombrado.", "success");
    if (wasService) onClose();
    await refreshEverything();
  }

  async function doDelete() {
    if (!confirmTarget) return;
    const res = await api.deleteEntry({ target: confirmTarget.target });
    if (!res.ok) return pushToast(res.error ?? "No se pudo eliminar.", "error");
    const wasService = confirmTarget.target.kind === "service";
    confirmTarget = null;
    pushToast("Eliminado.", "success");
    if (wasService) onClose();
    await refreshEverything();
  }

  function fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  const iconFor: Record<string, IconName> = {
    pdf: "file",
    png: "image",
    jpg: "image",
    jpeg: "image",
    webp: "image",
    gif: "image",
  };
</script>

<!-- Drawer lateral derecho -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="fixed inset-0 z-30 flex justify-end bg-slate-900/30" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Cabecera -->
    <div class="flex items-start justify-between border-b border-slate-100 p-4">
      <div class="min-w-0">
        {#if service.categoria}
          <span class="text-xs font-medium text-slate-400">{service.categoria}</span>
        {/if}
        <h2 class="truncate text-lg font-semibold text-slate-800">{service.nombre}</h2>
        <span
          class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold {service.paid
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700'}"
        >{service.paid ? "Pagado" : "Pendiente"}</span>
      </div>
      <button class="rounded p-1 text-slate-400 hover:bg-slate-100" onclick={onClose} aria-label="Cerrar"
        ><Icon name="close" class="h-4 w-4" /></button
      >
    </div>

    <!-- Acciones de servicio -->
    <div class="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-2 text-sm">
      <button
        class="text-slate-500 hover:text-blue-600"
        onclick={() => openRename(serviceTarget(), "servicio", service.folder)}>Renombrar</button
      >
      <button
        class="text-slate-500 hover:text-rose-600"
        onclick={() => (confirmTarget = { target: serviceTarget(), label: `el servicio "${service.nombre}"` })}
        >Eliminar</button
      >
    </div>

    <!-- Zona de comprobantes -->
    <div class="flex-1 overflow-y-auto p-4">
      <div
        class="mb-3 rounded-lg border-2 border-dashed p-4 text-center text-sm transition {dragOver
          ? 'border-blue-400 bg-blue-50 text-blue-600'
          : 'border-slate-300 text-slate-400'}"
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => (dragOver = false)}
        ondrop={handleDrop}
        role="region"
        aria-label="Soltar comprobantes aquí"
      >
        Arrastra comprobantes aquí
        <div class="mt-2">
          <button
            class="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
            onclick={() => fileInput?.click()}
            disabled={busy}
          >Agregar comprobante</button>
          <input bind:this={fileInput} type="file" multiple class="hidden" onchange={handlePicked} />
        </div>
      </div>

      {#if files.length === 0}
        <p class="py-6 text-center text-sm text-slate-400">Sin comprobantes todavía.</p>
      {:else}
        <ul class="flex flex-col gap-1.5">
          {#each files as file (file.name)}
            <li class="flex items-center gap-2 rounded-lg border border-slate-100 p-2 hover:bg-slate-50">
              <Icon name={iconFor[file.ext] ?? "paperclip"} class="h-5 w-5 shrink-0 text-slate-400" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm text-slate-700" title={file.name}>{file.name}</div>
                <div class="text-xs text-slate-400">{fmtSize(file.sizeBytes)}</div>
              </div>
              <div class="flex shrink-0 items-center gap-1 text-xs">
                <button class="rounded px-1.5 py-1 text-slate-500 hover:bg-slate-200" onclick={() => openFile(file)} title={file.previewable ? "Abrir en pestaña nueva" : "Descargar"}><Icon name={file.previewable ? "external-link" : "download"} class="h-4 w-4" /></button>
                <button class="rounded px-1.5 py-1 text-slate-500 hover:bg-slate-200" onclick={() => openRename(fileTarget(file.name), "archivo", file.name)} title="Renombrar"><Icon name="pencil" class="h-4 w-4" /></button>
                <button class="rounded px-1.5 py-1 text-slate-500 hover:bg-rose-100 hover:text-rose-600" onclick={() => (confirmTarget = { target: fileTarget(file.name), label: `"${file.name}"` })} title="Eliminar"><Icon name="trash" class="h-4 w-4" /></button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Notas -->
    <div class="border-t border-slate-100 p-4">
      <label class="mb-1 block text-xs font-medium text-slate-500" for="notes">Notas</label>
      <textarea
        id="notes"
        class="h-20 w-full resize-none rounded-md border border-slate-300 p-2 text-sm"
        placeholder="N° de cliente, observaciones…"
        bind:value={notes}
        oninput={() => (notesDirty = true)}
      ></textarea>
      {#if notesDirty}
        <button class="mt-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700" onclick={saveNotes}
          >Guardar nota</button
        >
      {/if}
    </div>
  </div>
</div>

<!-- Modal renombrar -->
{#if renameTarget}
  <Modal title={`Renombrar ${renameTarget.label}`} onClose={() => (renameTarget = null)}>
    <input
      class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      bind:value={renameValue}
      onkeydown={(e) => e.key === "Enter" && requestRenameConfirm()}
    />
    {#snippet footer()}
      <button class="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onclick={() => (renameTarget = null)}>Cancelar</button>
      <button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onclick={requestRenameConfirm}>Guardar</button>
    {/snippet}
  </Modal>
{/if}

<!-- Modal confirmar renombrado -->
{#if pendingRename}
  <ConfirmModal
    title="Confirmar cambio de nombre"
    message={`¿Renombrar el ${pendingRename.label} "${pendingRename.originalName}" a "${pendingRename.newValue}"?`}
    confirmLabel="Renombrar"
    onConfirm={doRename}
    onCancel={cancelPendingRename}
  />
{/if}

<!-- Modal confirmar borrado -->
{#if confirmTarget}
  <ConfirmModal
    title="Eliminar definitivamente"
    message={`¿Eliminar ${confirmTarget.label}? Se borra del disco de forma definitiva (no pasa por la papelera) y no se puede deshacer.`}
    confirmLabel="Eliminar"
    danger
    onConfirm={doDelete}
    onCancel={() => (confirmTarget = null)}
  />
{/if}

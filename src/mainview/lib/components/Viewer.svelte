<script lang="ts">
  import { app } from "../store.svelte";
  import { api } from "../rpc";
  import type { TargetRef } from "../../../shared/rpc";
  import * as pdfjsLib from "pdfjs-dist";
  import { ensurePdfWorker } from "../pdfWorker";
  import Icon from "./Icon.svelte";

  let {
    service,
    name,
    onClose,
  }: { service: string; name: string; onClose: () => void } = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let imageUrl = $state<string | null>(null);
  let pdfPageCount = $state(0);
  let pdfDoc: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]> | null = null;

  const isPdf = $derived(name.toLowerCase().endsWith(".pdf"));

  function base64ToBytes(b64: string): Uint8Array {
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async function renderPdf(bytes: Uint8Array) {
    await ensurePdfWorker();
    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    pdfPageCount = pdfDoc.numPages;
  }

  function renderPage(canvas: HTMLCanvasElement, pageNumber: number) {
    (async () => {
      if (!pdfDoc) return;
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.4 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
  }

  $effect(() => {
    const svc = service;
    const nm = name;
    loading = true;
    error = null;
    imageUrl = null;
    (async () => {
      const res = await api.readFileForPreview({
        period: app.period,
        monthNN: app.monthNN,
        service: svc,
        name: nm,
      });
      if ("error" in res) {
        error = res.error;
        loading = false;
        return;
      }
      if (nm.toLowerCase().endsWith(".pdf")) {
        try {
          await renderPdf(base64ToBytes(res.dataBase64));
        } catch (e) {
          error = e instanceof Error ? e.message : "No se pudo abrir el PDF.";
        }
      } else {
        imageUrl = `data:${res.mime};base64,${res.dataBase64}`;
      }
      loading = false;
    })();
  });

  function openExternal() {
    const target: TargetRef = {
      kind: "file",
      period: app.period,
      monthNN: app.monthNN,
      service,
      name,
    };
    api.openEntry({ target });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="fixed inset-0 z-40 flex flex-col bg-slate-900/70" role="dialog" aria-modal="true">
  <div class="flex items-center justify-between px-4 py-2 text-white">
    <span class="truncate text-sm">{name}</span>
    <div class="flex items-center gap-2">
      <button class="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20" onclick={openExternal}
        >Abrir con el sistema</button
      >
      <button class="flex items-center gap-1 rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20" onclick={onClose}
        >Cerrar <Icon name="close" class="h-4 w-4" /></button
      >
    </div>
  </div>

  <!-- Clic en el área vacía (fuera del documento) cierra el visor. -->
  <div class="flex-1 overflow-auto p-4" onclick={onClose} role="presentation">
    {#if loading}
      <p class="mt-10 text-center text-white/70">Cargando…</p>
    {:else if error}
      <p class="mt-10 text-center text-rose-300">{error}</p>
    {:else if isPdf}
      <div
        class="mx-auto flex w-fit flex-col items-center gap-4"
        onclick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {#each { length: pdfPageCount } as _, i (i)}
          <canvas class="mx-auto shadow" use:renderPage={i + 1}></canvas>
        {/each}
      </div>
    {:else if imageUrl}
      <div class="mx-auto w-fit" onclick={(e) => e.stopPropagation()} role="presentation">
        <img src={imageUrl} alt={name} class="max-w-full rounded shadow-lg" />
      </div>
    {/if}
  </div>
</div>

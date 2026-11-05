<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  let {
    title,
    onClose,
    children,
    footer,
  }: {
    title: string;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
  onclick={onClose}
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="w-full max-w-lg rounded-xl bg-white shadow-xl"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="text-base font-semibold text-slate-800">{title}</h2>
      <button
        class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        onclick={onClose}
        aria-label="Cerrar"
      ><Icon name="close" class="h-4 w-4" /></button>
    </div>
    <div class="px-5 py-4">
      {@render children()}
    </div>
    {#if footer}
      <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>

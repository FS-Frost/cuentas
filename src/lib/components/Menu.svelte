<script lang="ts">
  // Menú desplegable simple: botón disparador + panel. Se cierra con un clic
  // fuera, con Escape o cuando el contenido llama a close().
  import type { Snippet } from "svelte";

  let {
    label,
    trigger,
    children,
    align = "left",
    triggerClass = "",
    panelClass = "w-56",
  }: {
    /** Texto accesible del botón. */
    label: string;
    trigger: Snippet;
    children: Snippet<[() => void]>;
    align?: "left" | "right";
    triggerClass?: string;
    panelClass?: string;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);

  function close() {
    open = false;
  }

  function onWindowClick(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (open && e.key === "Escape") {
      e.preventDefault(); // no cerrar también paneles de abajo
      close();
    }
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

<div class="relative" bind:this={root}>
  <button
    class={triggerClass}
    onclick={() => (open = !open)}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={label}
    title={label}
  >{@render trigger()}</button>
  {#if open}
    <div
      class="absolute top-full z-40 mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 text-sm shadow-lg {align ===
      'right'
        ? 'right-0'
        : 'left-0'} {panelClass}"
      role="menu"
    >
      {@render children(close)}
    </div>
  {/if}
</div>

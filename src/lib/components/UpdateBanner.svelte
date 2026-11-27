<script lang="ts">
  // Aviso de versión nueva. El service worker nuevo se activa solo
  // (skipWaiting + clients.claim) y dispara `controllerchange`; la página
  // abierta sigue con el código viejo hasta recargar. No recarga sola para no
  // interrumpir lo que el usuario esté haciendo.
  import { onMount } from "svelte";

  let available = $state(false);

  onMount(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    // En la primera visita no hay controller y clients.claim también dispara
    // controllerchange: eso no es una actualización.
    const hadController = !!sw.controller;
    const onChange = () => {
      if (hadController) available = true;
    };
    sw.addEventListener("controllerchange", onChange);
    return () => sw.removeEventListener("controllerchange", onChange);
  });
</script>

{#if available}
  <div
    class="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-slate-800 px-4 py-2 text-sm text-white shadow-lg dark:bg-slate-200 dark:text-slate-900"
    role="status"
  >
    Hay una versión nueva de Cuentas.
    <button
      class="rounded-full bg-blue-500 px-3 py-1 font-medium text-white hover:bg-blue-600"
      onclick={() => location.reload()}
    >Recargar</button>
    <button
      class="text-slate-300 hover:text-white dark:text-slate-600 dark:hover:text-slate-900"
      onclick={() => (available = false)}
      aria-label="Descartar aviso"
    >✕</button>
  </div>
{/if}

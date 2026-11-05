<script lang="ts">
  import { toasts, dismissToast } from "../toast.svelte";

  const styles: Record<string, string> = {
    info: "bg-slate-800 text-white",
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
  };
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
  {#each toasts as t (t.id)}
    <button
      class="max-w-sm rounded-lg px-4 py-2 text-sm shadow-lg {styles[t.kind]}"
      onclick={() => dismissToast(t.id)}
    >
      {t.message}
    </button>
  {/each}
</div>

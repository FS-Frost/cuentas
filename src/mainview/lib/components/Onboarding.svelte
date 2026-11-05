<script lang="ts">
  import { app } from "../store.svelte";
  import Icon from "./Icon.svelte";
</script>

<div class="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
  <Icon name="folder-open" class="h-12 w-12" />
  <div>
    <h1 class="text-2xl font-semibold text-slate-800">Bienvenido a Cuentas</h1>
    <p class="mt-2 max-w-md text-slate-500">
      Elige la carpeta raíz donde están (o estarán) tus periodos. La estructura
      esperada es <code class="rounded bg-slate-100 px-1">[año]/[mes]/[servicio]/comprobantes</code>.
    </p>
  </div>
  <button
    class="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white shadow hover:bg-blue-700"
    onclick={() => app.pickRoot()}
  >
    Elegir carpeta raíz
  </button>
</div>

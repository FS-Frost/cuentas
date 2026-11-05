<script lang="ts">
  import { app } from "../store.svelte";
  import Icon from "./Icon.svelte";
</script>

<div class="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
  <Icon name="folder-open" class="h-12 w-12" />

  {#if app.rootStatus === "unsupported"}
    <div>
      <h1 class="text-2xl font-semibold text-slate-800">Navegador no soportado</h1>
      <p class="mt-2 max-w-md text-slate-500">
        Cuentas necesita acceso a una carpeta de tu equipo (File System Access API), que solo
        está disponible en <strong>Chrome</strong> o <strong>Edge</strong> de escritorio. Abre
        esta página en uno de ellos.
      </p>
    </div>
  {:else if app.rootStatus === "needs-permission"}
    <div>
      <h1 class="text-2xl font-semibold text-slate-800">Reconectar carpeta</h1>
      <p class="mt-2 max-w-md text-slate-500">
        El navegador necesita que confirmes de nuevo el acceso a
        <code class="rounded bg-slate-100 px-1">{app.rootName}</code>.
      </p>
    </div>
    <div class="flex flex-col items-center gap-2">
      <button
        class="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white shadow hover:bg-blue-700"
        onclick={() => app.reconnect()}
      >
        Reconectar «{app.rootName}»
      </button>
      <button class="text-sm text-slate-500 hover:text-blue-600" onclick={() => app.pickRoot()}>
        Elegir otra carpeta
      </button>
    </div>
  {:else}
    <div>
      <h1 class="text-2xl font-semibold text-slate-800">Bienvenido a Cuentas</h1>
      <p class="mt-2 max-w-md text-slate-500">
        Elige la carpeta raíz donde están (o estarán) tus periodos. La estructura
        esperada es <code class="rounded bg-slate-100 px-1">[año]/[mes]/[servicio]/comprobantes</code>.
        Tus archivos no salen de tu equipo.
      </p>
    </div>
    <button
      class="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white shadow hover:bg-blue-700"
      onclick={() => app.pickRoot()}
    >
      Elegir carpeta raíz
    </button>
  {/if}
</div>

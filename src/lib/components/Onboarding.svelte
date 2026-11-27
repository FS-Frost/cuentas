<script lang="ts">
  import { app, GITHUB_URL } from "../store.svelte";
  import ConfirmModal from "./ConfirmModal.svelte";
  import Icon from "./Icon.svelte";

  const currentYear = new Date().getFullYear();
</script>

<div class="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
  <Icon name="folder-open" class="h-12 w-12" />

  {#if app.rootStatus === "unsupported"}
    <div>
      <h1 class="text-2xl font-semibold text-slate-800 dark:text-slate-100">Navegador no soportado</h1>
      <p class="mt-2 max-w-md text-slate-500 dark:text-slate-400">
        Cuentas necesita acceso a una carpeta de tu equipo (File System Access API), que solo
        está disponible en <strong>Chrome</strong> o <strong>Edge</strong> de escritorio. Abre
        esta página en uno de ellos.
      </p>
    </div>
  {:else if app.rootStatus === "needs-permission"}
    <div>
      <h1 class="text-2xl font-semibold text-slate-800 dark:text-slate-100">Reconectar carpeta</h1>
      <p class="mt-2 max-w-md text-slate-500 dark:text-slate-400">
        El navegador necesita que confirmes de nuevo el acceso a
        <code class="rounded bg-slate-100 dark:bg-slate-800 px-1">{app.rootName}</code>. Se abrirá el selector
        de carpetas: elige «{app.rootName}» (o la carpeta que quieras usar) y confirma.
      </p>
    </div>
    <button
      class="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white shadow hover:bg-blue-700"
      onclick={() => app.reconnect()}
    >
      Reconectar «{app.rootName}»
    </button>
    {#if app.rootWarning}
      <p class="max-w-xl rounded-lg bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" role="alert">
        {app.rootWarning}
      </p>
    {/if}
  {:else}
    <div>
      <h1 class="text-2xl font-semibold text-slate-800 dark:text-slate-100">Bienvenido a Cuentas</h1>
      <p class="mt-2 max-w-md text-slate-500 dark:text-slate-400">
        Tus comprobantes se guardan en una carpeta de tu equipo con la estructura
        <code class="rounded bg-slate-100 dark:bg-slate-800 px-1">[año]/[mes]/[servicio]/comprobantes</code>.
        Tus archivos no salen de tu equipo. ¿Ya tienes esa carpeta?
      </p>
    </div>

    <div class="grid w-full max-w-xl gap-3 sm:grid-cols-2">
      <button
        class="flex flex-col items-start gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-left shadow-sm hover:border-blue-400 hover:shadow"
        onclick={() => app.pickRoot("existing")}
      >
        <span class="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <Icon name="folder" class="h-5 w-5 text-blue-600 dark:text-blue-400" /> Ya tengo mi carpeta
        </span>
        <span class="text-sm text-slate-500 dark:text-slate-400">
          Elige la carpeta que contiene tus años (ej. la que tiene «2025», «2026»…).
        </span>
      </button>

      <button
        class="flex flex-col items-start gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-left shadow-sm hover:border-blue-400 hover:shadow"
        onclick={() => app.pickRoot("new")}
      >
        <span class="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <Icon name="calendar" class="h-5 w-5 text-blue-600 dark:text-blue-400" /> Empezar desde cero
        </span>
        <span class="text-sm text-slate-500 dark:text-slate-400">
          Elige (o crea) una carpeta vacía: se crea {currentYear} con sus 12 meses y luego
          agregas tus cuentas.
        </span>
      </button>
    </div>

    {#if app.rootWarning}
      <p class="max-w-xl rounded-lg bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" role="alert">
        {app.rootWarning}
      </p>
    {/if}
  {/if}

  <a
    class="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
    href={GITHUB_URL}
    target="_blank"
    rel="noopener noreferrer"
  >
    <Icon name="github" class="h-4 w-4" /> Ver en GitHub
  </a>
</div>

{#if app.pendingStart}
  <ConfirmModal
    title="La carpeta no está vacía"
    message={`«${app.pendingStart.handle.name}» ya tiene ${app.pendingStart.otherEntries} elemento(s) que no son periodos. ¿Crear igual ${currentYear} con sus 12 meses ahí? Lo que ya hay no se toca.`}
    confirmLabel="Crear igual"
    onConfirm={() => app.confirmStart()}
    onCancel={() => app.cancelStart()}
  />
{/if}

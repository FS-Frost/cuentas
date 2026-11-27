<script lang="ts">
  import { app, GITHUB_URL, MONTH_NAMES, pad2 } from "../store.svelte";
  import { theme, type ThemePref } from "../theme.svelte";
  import { BUILD_DATE, BUILD_SHORT, BUILD_URL } from "../version";
  import Icon from "./Icon.svelte";
  import Menu from "./Menu.svelte";

  let {
    onNewPeriod,
    onRenamePeriod,
    onDeletePeriod,
    onSearch,
  }: {
    onNewPeriod: () => void;
    onRenamePeriod: () => void;
    onDeletePeriod: () => void;
    onSearch: (q: string) => void;
  } = $props();

  let query = $state("");

  function submitSearch(e: Event) {
    e.preventDefault();
    onSearch(query);
  }

  const now = new Date();
  const todayYear = String(now.getFullYear());
  const todayMonth = pad2(now.getMonth() + 1);

  const THEMES: { value: ThemePref; label: string }[] = [
    { value: "system", label: "Sistema" },
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro" },
  ];

  const tabs = [
    { view: "dashboard", label: "Mes" },
    { view: "pending", label: "Pendientes" },
    { view: "recurring", label: "Recurrentes" },
  ] as const;

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800";
  const ghostBtn =
    "rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40";
</script>

<header class="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
  <div class="flex flex-wrap items-center gap-3 px-4 pt-3 pb-2">
    <div class="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
      <Icon name="file" class="h-5 w-5" /> Cuentas
    </div>

    <!-- Navegador de meses: ‹ Noviembre 2026 › (cruza de año) -->
    <div class="flex items-center gap-1">
      <button class={ghostBtn} onclick={() => app.stepMonth(-1)} disabled={!app.period} aria-label="Mes anterior" title="Mes anterior">
        <Icon name="chevron-left" class="h-4 w-4" />
      </button>
      <Menu
        label="Elegir mes"
        triggerClass="min-w-40 rounded-md px-2 py-1 text-center font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
        panelClass="w-64"
      >
        {#snippet trigger()}{app.period ? `${app.monthName} ${app.period}` : "Sin periodos"}{/snippet}
        {#snippet children(close)}
          <div class="mb-1 px-1 text-xs font-medium text-slate-400 dark:text-slate-500">{app.period}</div>
          <div class="grid grid-cols-3 gap-1">
            {#each MONTH_NAMES as name, i (name)}
              {@const nn = pad2(i + 1)}
              {@const selected = nn === app.monthNN}
              {@const isToday = app.period === todayYear && nn === todayMonth}
              <button
                class="rounded-md px-2 py-1.5 text-sm {selected
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'} {isToday && !selected
                  ? 'ring-1 ring-blue-400'
                  : ''}"
                role="menuitem"
                onclick={() => {
                  close();
                  void app.setMonth(nn);
                }}
              >{name.slice(0, 3)}</button>
            {/each}
          </div>
        {/snippet}
      </Menu>
      <button class={ghostBtn} onclick={() => app.stepMonth(1)} disabled={!app.period} aria-label="Mes siguiente" title="Mes siguiente">
        <Icon name="chevron-right" class="h-4 w-4" />
      </button>
      <button
        class="ml-1 rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        onclick={() => app.goToCurrentMonth()}
        title="Ir al mes actual"
      >Hoy</button>
    </div>

    <!-- Años -->
    <Menu
      label="Años"
      triggerClass="flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      {#snippet trigger()}Año <Icon name="chevron-down" class="h-3.5 w-3.5" />{/snippet}
      {#snippet children(close)}
        {#each app.periods as p (p)}
          <button
            class={itemClass}
            role="menuitemradio"
            aria-checked={p === app.period}
            onclick={() => {
              close();
              void app.setPeriod(p);
            }}
          >
            <span class="w-4">{#if p === app.period}<Icon name="check" class="h-4 w-4" />{/if}</span>{p}
          </button>
        {/each}
        {#if app.periods.length}<div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>{/if}
        <button class={itemClass} role="menuitem" onclick={() => { close(); onNewPeriod(); }}>
          <span class="w-4"></span>+ Nuevo año
        </button>
        {#if app.period}
          <button class={itemClass} role="menuitem" onclick={() => { close(); onRenamePeriod(); }}>
            <Icon name="pencil" class="h-4 w-4" />Renombrar {app.period}
          </button>
          <button
            class="{itemClass} !text-rose-600 dark:!text-rose-400"
            role="menuitem"
            onclick={() => { close(); onDeletePeriod(); }}
          >
            <Icon name="trash" class="h-4 w-4" />Eliminar {app.period}
          </button>
        {/if}
      {/snippet}
    </Menu>

    <!-- Búsqueda -->
    <form class="min-w-40 flex-1" onsubmit={submitSearch}>
      <input
        class="w-full max-w-xs rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm"
        type="search"
        placeholder="Buscar servicio en {app.period || 'el periodo'}…"
        bind:value={query}
        disabled={!app.period}
      />
    </form>

    <!-- Alerta de pendientes -->
    {#if app.pendingCount > 0}
      <button
        class="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1.5 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60"
        onclick={() => (app.view = "pending")}
        title="Ver cuentas pendientes"
      >{app.pendingCount} pendiente{app.pendingCount === 1 ? "" : "s"}</button>
    {/if}

    <!-- Menú ⋯ -->
    <Menu label="Más opciones" align="right" triggerClass={ghostBtn} panelClass="w-64">
      {#snippet trigger()}<Icon name="more" class="h-5 w-5" />{/snippet}
      {#snippet children(close)}
        <div class="px-2.5 pt-1 pb-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">Tema</div>
        {#each THEMES as t (t.value)}
          <button
            class={itemClass}
            role="menuitemradio"
            aria-checked={theme.pref === t.value}
            onclick={() => theme.set(t.value)}
          >
            <span class="w-4">{#if theme.pref === t.value}<Icon name="check" class="h-4 w-4" />{/if}</span>{t.label}
          </button>
        {/each}
        <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>
        <button class={itemClass} role="menuitem" onclick={() => { close(); void app.reload(); }}>
          <Icon name="refresh" class="h-4 w-4" />Recargar desde disco
        </button>
        <button class={itemClass} role="menuitem" onclick={() => { close(); void app.pickRoot("existing"); }}>
          <Icon name="folder" class="h-4 w-4" />
          <span class="min-w-0 flex-1">
            Cambiar carpeta
            {#if app.rootName}<span class="block truncate text-xs text-slate-400 dark:text-slate-500">Actual: {app.rootName}</span>{/if}
          </span>
        </button>
        <a class={itemClass} role="menuitem" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onclick={close}>
          <Icon name="github" class="h-4 w-4" />Ver en GitHub
        </a>
        <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>
        <a
          class="block rounded-md px-2.5 py-1.5 text-xs text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          href={BUILD_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver este commit en GitHub"
        >Versión {BUILD_SHORT} · {BUILD_DATE}</a>
      {/snippet}
    </Menu>
  </div>

  <!-- Pestañas -->
  <nav class="flex gap-1 px-4" aria-label="Vistas">
    {#each tabs as t (t.view)}
      <button
        class="-mb-px border-b-2 px-3 py-2 text-sm {app.view === t.view
          ? 'border-blue-600 font-medium text-blue-600 dark:text-blue-400'
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}"
        aria-current={app.view === t.view ? "page" : undefined}
        onclick={() => (app.view = t.view)}
      >{t.label}</button>
    {/each}
  </nav>
</header>

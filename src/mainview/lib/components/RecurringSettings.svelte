<script lang="ts">
  import { app } from "../store.svelte";
  import type { RecurringService } from "../../../shared/rpc";
  import Icon from "./Icon.svelte";

  // Copia editable local.
  let rows = $state<RecurringService[]>(app.recurring.map((r) => ({ ...r })));

  function addRow() {
    rows.push({ categoria: null, nombre: "" });
  }

  function removeRow(i: number) {
    rows.splice(i, 1);
  }

  async function save() {
    const cleaned = rows
      .map((r) => ({
        categoria: r.categoria?.trim() ? r.categoria.trim() : null,
        nombre: r.nombre.trim(),
      }))
      .filter((r) => r.nombre.length > 0);
    await app.saveRecurring(cleaned);
    rows = cleaned.map((r) => ({ ...r }));
  }
</script>

<div class="mx-auto max-w-2xl p-5">
  <h2 class="mb-1 text-xl font-semibold text-slate-800">Servicios recurrentes</h2>
  <p class="mb-4 text-sm text-slate-500">
    Tus cuentas habituales. Con el botón “Aplicar plantilla” de cada mes se crean
    las carpetas de estos servicios que falten.
  </p>

  <div class="flex flex-col gap-2">
    {#each rows as row, i (i)}
      <div class="flex items-center gap-2">
        <input
          class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Categoría (opcional)"
          value={row.categoria ?? ""}
          oninput={(e) => (rows[i].categoria = (e.currentTarget as HTMLInputElement).value)}
        />
        <input
          class="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Nombre del servicio"
          bind:value={rows[i].nombre}
        />
        <button
          class="rounded-md px-2 py-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
          onclick={() => removeRow(i)}
          aria-label="Quitar"
        ><Icon name="trash" class="h-4 w-4" /></button>
      </div>
    {/each}
  </div>

  <div class="mt-4 flex gap-2">
    <button
      class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      onclick={addRow}
    >+ Agregar fila</button>
    <button
      class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
      onclick={save}
    >Guardar</button>
  </div>

  {#if rows.length === 0}
    <p class="mt-4 text-sm text-slate-400">
      Aún no defines servicios recurrentes. Agrega tus cuentas habituales (luz, agua, gas…).
    </p>
  {/if}
</div>

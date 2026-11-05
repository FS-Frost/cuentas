<script lang="ts">
  import Modal from "./Modal.svelte";

  let {
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = false,
    onConfirm,
    onCancel,
  }: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
  } = $props();

  let submitting = $state(false);

  function handleCancel() {
    if (submitting) return; // ignora Escape/backdrop/X/Cancelar mientras hay una llamada en curso
    onCancel();
  }

  async function handleConfirm() {
    if (submitting) return; // evita doble click
    submitting = true;
    try {
      await onConfirm();
    } finally {
      submitting = false;
    }
  }
</script>

<Modal {title} onClose={handleCancel}>
  <p class="text-sm text-slate-600">{message}</p>
  {#snippet footer()}
    <button
      class="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      onclick={handleCancel}
      disabled={submitting}
    >{cancelLabel}</button>
    <button
      class="rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50 {danger
        ? 'bg-rose-600 hover:bg-rose-700'
        : 'bg-blue-600 hover:bg-blue-700'}"
      onclick={handleConfirm}
      disabled={submitting}
    >{confirmLabel}</button>
  {/snippet}
</Modal>

// Sistema de notificaciones (toasts) muy simple basado en runes.

export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  message: string;
}

let nextId = 1;
export const toasts = $state<Toast[]>([]);

export function pushToast(message: string, kind: Toast["kind"] = "info"): void {
  const id = nextId++;
  toasts.push({ id, kind, message });
  setTimeout(() => dismissToast(id), 4000);
}

export function dismissToast(id: number): void {
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx >= 0) toasts.splice(idx, 1);
}

// Cliente RPC tipado hacia el proceso bun, más una suscripción sencilla al
// evento rootChanged (auto-refresh cuando el disco cambia por fuera).

import { Electroview } from "electrobun/view";
import type { AppRPC } from "../../shared/rpc";

type Listener = (reason: string) => void;
const listeners = new Set<Listener>();

/** Registra un callback para cuando el backend detecta cambios en disco. */
export function onRootChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const rpcConfig = Electroview.defineRPC<AppRPC>({
  maxRequestTime: 15000,
  handlers: {
    requests: {},
    messages: {
      rootChanged: ({ reason }: { reason: string }) => {
        for (const l of listeners) l(reason);
      },
    },
  },
});

const electroview = new Electroview({ rpc: rpcConfig });

// electroview.rpc.request expone un método por cada request definido en el
// esquema `bun`, devolviendo promesas tipadas.
export const api = electroview.rpc!.request;

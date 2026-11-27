// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {}
  /** Commit del build (inyectado por vite.config.ts; "dev" en local). */
  const __BUILD_SHA__: string;
  /** Fecha ISO del build (inyectada por vite.config.ts). */
  const __BUILD_TIME__: string;
}

export {};

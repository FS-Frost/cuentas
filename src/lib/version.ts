// Versión del build en ejecución (para diagnosticar qué versión corre la app instalada).
import { GITHUB_URL } from "./store.svelte";

export const BUILD_SHA = __BUILD_SHA__;
export const BUILD_SHORT = BUILD_SHA === "dev" ? "dev" : BUILD_SHA.slice(0, 7);
export const BUILD_DATE = new Date(__BUILD_TIME__).toLocaleString("es-CL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export const BUILD_URL = BUILD_SHA === "dev" ? GITHUB_URL : `${GITHUB_URL}/commit/${BUILD_SHA}`;

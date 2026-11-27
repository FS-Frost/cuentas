import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  define: {
    // Versión visible en el menú ⋯ (ver src/lib/version.ts). En GitHub Actions
    // GITHUB_SHA viene definido; en local queda "dev".
    __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? "dev"),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 5000,
  },
});

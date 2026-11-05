import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    // Sitio 100% estático (GitHub Pages). Una sola ruta prerenderizada.
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "404.html",
      precompress: false,
      strict: true,
    }),
    paths: {
      // En GitHub Pages el sitio vive en /cuentas (ver .github/workflows/deploy.yml).
      base: process.env.BASE_PATH ?? "",
    },
  },
};

export default config;

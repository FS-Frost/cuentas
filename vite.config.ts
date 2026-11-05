import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// El atributo crossorigin que inyecta Vite puede impedir la carga de módulos
// bajo el esquema custom views://; lo quitamos del HTML final.
function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin/g, "");
    },
  };
}

// El frontend vive en src/mainview. Se compila a ./dist con rutas relativas
// (base "./") para que funcione bajo el esquema views://mainview/.
export default defineConfig({
  root: path.resolve(__dirname, "src/mainview"),
  base: "./",
  plugins: [svelte(), tailwindcss(), stripCrossorigin()],
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    // Nombres estables dentro de assets/ (el copy de Electrobun usa assets/*).
    assetsDir: "assets",
  },
});

// Configuración de build/empaquetado de Electrobun.
// El frontend (Svelte + Tailwind) lo compila Vite a ./dist y aquí solo lo copiamos
// al bundle bajo views/mainview/ (servido como views://mainview/...).

import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Cuentas",
    identifier: "org.aptus.cuentas",
    version: "0.1.0",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    // Sin views bundleadas por Electrobun: el frontend ya viene compilado por Vite.
    views: {},
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    // Ícono de Windows: se incrusta en el Setup.exe y se copia a Resources/app.ico.
    win: {
      icon: "assets/icon.ico",
    },
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
} satisfies ElectrobunConfig;

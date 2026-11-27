// Tema de la UI: "system" sigue a prefers-color-scheme; "light"/"dark" lo
// fuerzan. Se guarda por navegador (localStorage), no en la carpeta de cuentas.
// El script inline de src/app.html aplica lo mismo antes de pintar.

export type ThemePref = "system" | "light" | "dark";

const KEY = "cuentas-theme";

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemDark(): boolean {
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref: ThemePref): void {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
}

class ThemeStore {
  pref = $state<ThemePref>("system");

  init(): void {
    this.pref = read();
    apply(this.pref);
    // Con "Sistema", seguir los cambios de tema de Windows en vivo.
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (this.pref === "system") apply("system");
    });
  }

  set(pref: ThemePref): void {
    this.pref = pref;
    try {
      if (pref === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* sin storage: el tema vale solo para esta sesión */
    }
    apply(pref);
  }
}

export const theme = new ThemeStore();

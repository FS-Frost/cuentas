// Persistencia de la configuración de la app (carpeta raíz) en el directorio
// de datos del usuario, independiente de la carpeta de cuentas.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

interface AppConfig {
  rootFolder: string | null;
}

function appDataDir(): string {
  const home = os.homedir();
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(home, "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support");
  }
  return process.env.XDG_CONFIG_HOME || path.join(home, ".config");
}

const CONFIG_DIR = path.join(appDataDir(), "cuentas");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

let cache: AppConfig | null = null;

async function readConfig(): Promise<AppConfig> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    cache = { rootFolder: parsed.rootFolder ?? null };
  } catch {
    cache = { rootFolder: null };
  }
  return cache;
}

async function writeConfig(cfg: AppConfig): Promise<void> {
  cache = cfg;
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2), "utf8");
  await fs.rename(tmp, CONFIG_PATH);
}

export async function getRootFolder(): Promise<string | null> {
  const cfg = await readConfig();
  if (!cfg.rootFolder) return null;
  // Validar que aún exista.
  try {
    const st = await fs.stat(cfg.rootFolder);
    if (!st.isDirectory()) return null;
  } catch {
    return null;
  }
  return cfg.rootFolder;
}

export async function setRootFolder(folder: string): Promise<void> {
  const cfg = await readConfig();
  await writeConfig({ ...cfg, rootFolder: folder });
}

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as accounts from "../src/bun/accounts";
import { readMetadata } from "../src/bun/metadata";
import {
  canonicalMonthFolder,
  composeService,
  parseMonth,
  parseService,
  uniqueFileName,
  validateName,
} from "../src/bun/naming";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cuentas-test-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

describe("naming", () => {
  test("parseMonth tolerante", () => {
    expect(parseMonth("04. Abril")).toEqual({ nn: "04", name: "Abril" });
    expect(parseMonth("4.Abril")).toEqual({ nn: "04", name: "Abril" });
    expect(parseMonth("12 . Diciembre")).toEqual({ nn: "12", name: "Diciembre" });
    expect(parseMonth("13. Nope")).toBeNull();
    expect(parseMonth("Aguas")).toBeNull();
  });

  test("canonicalMonthFolder normaliza", () => {
    expect(canonicalMonthFolder("4.Abril")).toBe("04. Abril");
  });

  test("parseService / composeService", () => {
    expect(parseService("[Depto] Aguas Andinas")).toEqual({
      categoria: "Depto",
      nombre: "Aguas Andinas",
    });
    expect(parseService("Internet")).toEqual({ categoria: null, nombre: "Internet" });
    expect(composeService("Depto", "Aguas")).toBe("[Depto] Aguas");
    expect(composeService(null, "Internet")).toBe("Internet");
  });

  test("validateName rechaza caracteres inválidos", () => {
    expect(validateName("Aguas Andinas")).toBeNull();
    expect(validateName("a/b")).not.toBeNull();
    expect(validateName("")).not.toBeNull();
  });

  test("uniqueFileName resuelve colisiones", () => {
    const set = new Set(["foo.pdf", "foo (1).pdf"]);
    expect(uniqueFileName("foo.pdf", set)).toBe("foo (2).pdf");
    expect(uniqueFileName("bar.pdf", set)).toBe("bar.pdf");
  });
});

describe("periodos y meses", () => {
  test("createPeriod crea 12 meses y valida año", async () => {
    await accounts.createPeriod(root, "2027");
    const entries = await fs.readdir(path.join(root, "2027"));
    expect(entries.length).toBe(12);
    expect(entries).toContain("01. Enero");
    expect(entries).toContain("12. Diciembre");

    const periods = await accounts.listPeriods(root);
    expect(periods).toEqual(["2027"]);

    await expect(accounts.createPeriod(root, "abc")).rejects.toThrow();
  });

  test("listPeriods ordena descendente e ignora no-años", async () => {
    await accounts.createPeriod(root, "2025");
    await accounts.createPeriod(root, "2027");
    await fs.mkdir(path.join(root, "basura"));
    expect(await accounts.listPeriods(root)).toEqual(["2027", "2025"]);
  });
});

describe("servicios y estado derivado", () => {
  test("createService con categoría y estado por comprobante", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2026", "04", "Depto", "Aguas Andinas");

    let services = await accounts.listServices(root, "2026", "04");
    expect(services.length).toBe(1);
    expect(services[0].folder).toBe("[Depto] Aguas Andinas");
    expect(services[0].categoria).toBe("Depto");
    expect(services[0].paid).toBe(false); // sin comprobante

    const added = await accounts.importDataFiles(root, "2026", "04", "[Depto] Aguas Andinas", [
      { name: "comprobante.pdf", dataBase64: b64("%PDF-fake") },
    ]);
    expect(added).toBe(1);

    services = await accounts.listServices(root, "2026", "04");
    expect(services[0].paid).toBe(true); // ahora pagado
    expect(services[0].fileCount).toBe(1);
  });

  test("no permite servicios duplicados", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2026", "04", null, "Internet");
    await expect(accounts.createService(root, "2026", "04", null, "Internet")).rejects.toThrow();
  });

  test("importa resolviendo colisiones de nombre", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2026", "04", null, "Luz");
    await accounts.importDataFiles(root, "2026", "04", "Luz", [
      { name: "c.pdf", dataBase64: b64("a") },
      { name: "c.pdf", dataBase64: b64("b") },
    ]);
    const files = await accounts.listFiles(root, "2026", "04", "Luz");
    const names = files.map((f) => f.name).sort();
    expect(names).toEqual(["c (1).pdf", "c.pdf"]);
  });

  test("carpeta de mes con formato no canónico se resuelve por número", async () => {
    await fs.mkdir(path.join(root, "2026", "4.Abril"), { recursive: true });
    await accounts.createService(root, "2026", "04", null, "Gas");
    const services = await accounts.listServices(root, "2026", "04");
    expect(services.map((s) => s.nombre)).toContain("Gas");
    // Debe haber creado dentro de la carpeta existente, no una nueva "04. Abril".
    const monthDirs = await fs.readdir(path.join(root, "2026"));
    expect(monthDirs).toContain("4.Abril");
    expect(monthDirs).not.toContain("04. Abril");
  });
});

describe("notas y renombrado", () => {
  test("setNotes/getNotes y migración al renombrar servicio", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2026", "04", "Depto", "Aguas Andinas");
    await accounts.setNotes(root, "2026", "04", "[Depto] Aguas Andinas", "N° cliente 1234567");

    expect(await accounts.getNotes(root, "2026", "04", "[Depto] Aguas Andinas")).toBe(
      "N° cliente 1234567",
    );

    await accounts.renameEntry(
      root,
      { kind: "service", period: "2026", monthNN: "04", service: "[Depto] Aguas Andinas" },
      "[Depto] Aguas",
    );

    expect(await accounts.getNotes(root, "2026", "04", "[Depto] Aguas")).toBe(
      "N° cliente 1234567",
    );
    const meta = await readMetadata(root);
    expect(Object.keys(meta.notes)).toEqual(["2026/04/[Depto] Aguas"]);
  });

  test("nota vacía elimina la clave", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2026", "04", null, "Luz");
    await accounts.setNotes(root, "2026", "04", "Luz", "algo");
    await accounts.setNotes(root, "2026", "04", "Luz", "   ");
    const meta = await readMetadata(root);
    expect(Object.keys(meta.notes)).toEqual([]);
  });
});

describe("recurrentes y utilidades", () => {
  test("applyTemplate crea solo los faltantes", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.setRecurring(root, [
      { categoria: "Depto", nombre: "Aguas Andinas" },
      { categoria: null, nombre: "Internet" },
    ]);
    // Uno ya existe.
    await accounts.createService(root, "2026", "04", null, "Internet");

    const recurring = await accounts.getRecurring(root);
    const created = await accounts.applyTemplate(root, "2026", "04", recurring);
    expect(created).toBe(1); // solo Aguas Andinas

    const services = await accounts.listServices(root, "2026", "04");
    expect(services.map((s) => s.nombre).sort()).toEqual(["Aguas Andinas", "Internet"]);
  });

  test("copyPreviousMonth replica carpetas (cruza de año en enero)", async () => {
    await accounts.createPeriod(root, "2025");
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2025", "12", "Depto", "Aguas Andinas");
    await accounts.createService(root, "2025", "12", null, "Internet");

    const res = await accounts.copyPreviousMonth(root, "2026", "01");
    expect(res.created).toBe(2);
    expect(res.from).toContain("2025");

    const services = await accounts.listServices(root, "2026", "01");
    expect(services.map((s) => s.nombre).sort()).toEqual(["Aguas Andinas", "Internet"]);
  });
});

describe("pendientes y búsqueda", () => {
  test("listPending lista servicios sin comprobante", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2026", "04", null, "Luz");
    await accounts.createService(root, "2026", "05", null, "Agua");
    await accounts.importDataFiles(root, "2026", "04", "Luz", [
      { name: "c.pdf", dataBase64: b64("x") },
    ]);

    const pending = await accounts.listPending(root, "2026");
    expect(pending.length).toBe(1);
    expect(pending[0].nombre).toBe("Agua");
    expect(pending[0].monthNN).toBe("05");
  });

  test("search filtra por texto, categoría y estado", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2026", "04", "Depto", "Aguas Andinas");
    await accounts.createService(root, "2026", "04", "Casa", "Aguas Casa");
    await accounts.importDataFiles(root, "2026", "04", "[Depto] Aguas Andinas", [
      { name: "c.pdf", dataBase64: b64("x") },
    ]);

    const byText = await accounts.search(root, "2026", "aguas", null, "all");
    expect(byText.length).toBe(2);

    const byCat = await accounts.search(root, "2026", "", "Depto", "all");
    expect(byCat.map((h) => h.nombre)).toEqual(["Aguas Andinas"]);

    const paid = await accounts.search(root, "2026", "", null, "paid");
    expect(paid.map((h) => h.nombre)).toEqual(["Aguas Andinas"]);

    const pending = await accounts.search(root, "2026", "", null, "pending");
    expect(pending.map((h) => h.nombre)).toEqual(["Aguas Casa"]);
  });
});

describe("preview", () => {
  test("readFileForPreview devuelve mime y base64", async () => {
    await accounts.createPeriod(root, "2026");
    await accounts.createService(root, "2026", "04", null, "Luz");
    await accounts.importDataFiles(root, "2026", "04", "Luz", [
      { name: "foto.png", dataBase64: b64("imgdata") },
    ]);
    const res = await accounts.readFileForPreview(root, "2026", "04", "Luz", "foto.png");
    expect(res.mime).toBe("image/png");
    expect(Buffer.from(res.dataBase64, "base64").toString("utf8")).toBe("imgdata");
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as accounts from "../src/lib/domain/accounts";
import { readMetadata } from "../src/lib/domain/metadata";
import type { Fs } from "../src/lib/fs/port";
import { nodeFs } from "./support/nodeFs";
import {
  canonicalMonthFolder,
  composeService,
  parseMonth,
  parseService,
  uniqueFileName,
  validateName,
} from "../src/lib/domain/naming";

let root: string;
let fsx: Fs;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cuentas-test-"));
  fsx = nodeFs(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function blob(s: string): Blob {
  return new Blob([s]);
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
    await accounts.createPeriod(fsx, "2027");
    const entries = await fs.readdir(path.join(root, "2027"));
    expect(entries.length).toBe(12);
    expect(entries).toContain("01. Enero");
    expect(entries).toContain("12. Diciembre");

    const periods = await accounts.listPeriods(fsx);
    expect(periods).toEqual(["2027"]);

    await expect(accounts.createPeriod(fsx, "abc")).rejects.toThrow();
  });

  test("listPeriods ordena descendente e ignora no-años", async () => {
    await accounts.createPeriod(fsx, "2025");
    await accounts.createPeriod(fsx, "2027");
    await fs.mkdir(path.join(root, "basura"));
    expect(await accounts.listPeriods(fsx)).toEqual(["2027", "2025"]);
  });
});

describe("servicios y estado derivado", () => {
  test("createService con categoría y estado por comprobante", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", "Depto", "Aguas Andinas");

    let services = await accounts.listServices(fsx, "2026", "04");
    expect(services.length).toBe(1);
    expect(services[0].folder).toBe("[Depto] Aguas Andinas");
    expect(services[0].categoria).toBe("Depto");
    expect(services[0].paid).toBe(false); // sin comprobante

    const added = await accounts.importFiles(fsx, "2026", "04", "[Depto] Aguas Andinas", [
      { name: "comprobante.pdf", data: blob("%PDF-fake") },
    ]);
    expect(added).toBe(1);

    services = await accounts.listServices(fsx, "2026", "04");
    expect(services[0].paid).toBe(true); // ahora pagado
    expect(services[0].fileCount).toBe(1);
  });

  test("no permite servicios duplicados", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", null, "Internet");
    await expect(accounts.createService(fsx, "2026", "04", null, "Internet")).rejects.toThrow();
  });

  test("importa resolviendo colisiones de nombre", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", null, "Luz");
    await accounts.importFiles(fsx, "2026", "04", "Luz", [
      { name: "c.pdf", data: blob("a") },
      { name: "c.pdf", data: blob("b") },
    ]);
    const files = await accounts.listFiles(fsx, "2026", "04", "Luz");
    const names = files.map((f) => f.name).sort();
    expect(names).toEqual(["c (1).pdf", "c.pdf"]);
  });

  test("carpeta de mes con formato no canónico se resuelve por número", async () => {
    await fs.mkdir(path.join(root, "2026", "4.Abril"), { recursive: true });
    await accounts.createService(fsx, "2026", "04", null, "Gas");
    const services = await accounts.listServices(fsx, "2026", "04");
    expect(services.map((s) => s.nombre)).toContain("Gas");
    // Debe haber creado dentro de la carpeta existente, no una nueva "04. Abril".
    const monthDirs = await fs.readdir(path.join(root, "2026"));
    expect(monthDirs).toContain("4.Abril");
    expect(monthDirs).not.toContain("04. Abril");
  });
});

describe("notas y renombrado", () => {
  test("setNotes/getNotes y migración al renombrar servicio", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", "Depto", "Aguas Andinas");
    await accounts.setNotes(fsx, "2026", "04", "[Depto] Aguas Andinas", "N° cliente 1234567");

    expect(await accounts.getNotes(fsx, "2026", "04", "[Depto] Aguas Andinas")).toBe(
      "N° cliente 1234567",
    );

    await accounts.renameEntry(
      fsx,
      { kind: "service", period: "2026", monthNN: "04", service: "[Depto] Aguas Andinas" },
      "[Depto] Aguas",
    );

    expect(await accounts.getNotes(fsx, "2026", "04", "[Depto] Aguas")).toBe(
      "N° cliente 1234567",
    );
    const meta = await readMetadata(fsx);
    expect(Object.keys(meta.notes)).toEqual(["2026/04/[Depto] Aguas"]);
  });

  test("nota vacía elimina la clave", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", null, "Luz");
    await accounts.setNotes(fsx, "2026", "04", "Luz", "algo");
    await accounts.setNotes(fsx, "2026", "04", "Luz", "   ");
    const meta = await readMetadata(fsx);
    expect(Object.keys(meta.notes)).toEqual([]);
  });
});

describe("recurrentes y utilidades", () => {
  test("applyTemplate crea solo los faltantes", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.setRecurring(fsx, [
      { categoria: "Depto", nombre: "Aguas Andinas" },
      { categoria: null, nombre: "Internet" },
    ]);
    // Uno ya existe.
    await accounts.createService(fsx, "2026", "04", null, "Internet");

    const recurring = await accounts.getRecurring(fsx);
    const created = await accounts.applyTemplate(fsx, "2026", "04", recurring);
    expect(created).toBe(1); // solo Aguas Andinas

    const services = await accounts.listServices(fsx, "2026", "04");
    expect(services.map((s) => s.nombre).sort()).toEqual(["Aguas Andinas", "Internet"]);
  });

  test("copyPreviousMonth replica carpetas (cruza de año en enero)", async () => {
    await accounts.createPeriod(fsx, "2025");
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2025", "12", "Depto", "Aguas Andinas");
    await accounts.createService(fsx, "2025", "12", null, "Internet");

    const res = await accounts.copyPreviousMonth(fsx, "2026", "01");
    expect(res.created).toBe(2);
    expect(res.from).toContain("2025");

    const services = await accounts.listServices(fsx, "2026", "01");
    expect(services.map((s) => s.nombre).sort()).toEqual(["Aguas Andinas", "Internet"]);
  });
});

describe("pendientes y búsqueda", () => {
  test("listPending lista servicios sin comprobante", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", null, "Luz");
    await accounts.createService(fsx, "2026", "05", null, "Agua");
    await accounts.importFiles(fsx, "2026", "04", "Luz", [
      { name: "c.pdf", data: blob("x") },
    ]);

    const pending = await accounts.listPending(fsx, "2026");
    expect(pending.length).toBe(1);
    expect(pending[0].nombre).toBe("Agua");
    expect(pending[0].monthNN).toBe("05");
  });

  test("search filtra por texto, categoría y estado", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", "Depto", "Aguas Andinas");
    await accounts.createService(fsx, "2026", "04", "Casa", "Aguas Casa");
    await accounts.importFiles(fsx, "2026", "04", "[Depto] Aguas Andinas", [
      { name: "c.pdf", data: blob("x") },
    ]);

    const byText = await accounts.search(fsx, "2026", "aguas", null, "all");
    expect(byText.length).toBe(2);

    const byCat = await accounts.search(fsx, "2026", "", "Depto", "all");
    expect(byCat.map((h) => h.nombre)).toEqual(["Aguas Andinas"]);

    const paid = await accounts.search(fsx, "2026", "", null, "paid");
    expect(paid.map((h) => h.nombre)).toEqual(["Aguas Andinas"]);

    const pending = await accounts.search(fsx, "2026", "", null, "pending");
    expect(pending.map((h) => h.nombre)).toEqual(["Aguas Casa"]);
  });
});

describe("lectura de comprobantes", () => {
  test("readFile devuelve el contenido", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", null, "Luz");
    await accounts.importFiles(fsx, "2026", "04", "Luz", [
      { name: "foto.png", data: blob("imgdata") },
    ]);
    const data = await accounts.readFile(fsx, "2026", "04", "Luz", "foto.png");
    expect(await data.text()).toBe("imgdata");
  });
});

describe("renombrar con fallback (sin move nativo)", () => {
  test("servicio con comprobantes se copia, se borra el original y migra la nota", async () => {
    const noMove = nodeFs(root, { withMove: false });
    await accounts.createPeriod(noMove, "2026");
    await accounts.createService(noMove, "2026", "04", null, "Luz");
    await accounts.importFiles(noMove, "2026", "04", "Luz", [
      { name: "a.pdf", data: blob("A") },
      { name: "b.pdf", data: blob("B") },
    ]);
    await accounts.setNotes(noMove, "2026", "04", "Luz", "nota");

    await accounts.renameEntry(
      noMove,
      { kind: "service", period: "2026", monthNN: "04", service: "Luz" },
      "Electricidad",
    );

    const monthDir = await fs.readdir(path.join(root, "2026", "04. Abril"));
    expect(monthDir).toEqual(["Electricidad"]);
    const files = await accounts.listFiles(noMove, "2026", "04", "Electricidad");
    expect(files.map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
    expect(await accounts.getNotes(noMove, "2026", "04", "Electricidad")).toBe("nota");
  });

  test("archivo se renombra sin move", async () => {
    const noMove = nodeFs(root, { withMove: false });
    await accounts.createPeriod(noMove, "2026");
    await accounts.createService(noMove, "2026", "04", null, "Luz");
    await accounts.importFiles(noMove, "2026", "04", "Luz", [{ name: "a.pdf", data: blob("A") }]);

    await accounts.renameEntry(
      noMove,
      { kind: "file", period: "2026", monthNN: "04", service: "Luz", name: "a.pdf" },
      "boleta.pdf",
    );

    const files = await accounts.listFiles(noMove, "2026", "04", "Luz");
    expect(files.map((f) => f.name)).toEqual(["boleta.pdf"]);
  });

  test("no pisa una entrada existente", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", null, "Luz");
    await accounts.createService(fsx, "2026", "04", null, "Gas");
    await expect(
      accounts.renameEntry(
        fsx,
        { kind: "service", period: "2026", monthNN: "04", service: "Luz" },
        "Gas",
      ),
    ).rejects.toThrow("Ya existe");
  });
});

describe("inspectRoot", () => {
  test("raíz válida con periodos; ocultos y archivos de sistema no cuentan", async () => {
    await accounts.createPeriod(fsx, "2026");
    await fs.writeFile(path.join(root, ".cuentas.json"), "{}");
    await fs.writeFile(path.join(root, "desktop.ini"), "");
    expect(await accounts.inspectRoot(fsx, "Cuentas")).toEqual({
      periods: ["2026"],
      looksLikeYear: false,
      otherEntries: 0,
    });
  });

  test("carpeta vacía", async () => {
    expect(await accounts.inspectRoot(fsx, "Cuentas")).toEqual({
      periods: [],
      looksLikeYear: false,
      otherEntries: 0,
    });
  });

  test("carpeta de año: por contener meses o por su nombre", async () => {
    await fs.mkdir(path.join(root, "01. Enero"));
    const byMonths = await accounts.inspectRoot(fsx, "Cuentas");
    expect(byMonths.looksLikeYear).toBe(true);

    await fs.rm(path.join(root, "01. Enero"), { recursive: true });
    expect((await accounts.inspectRoot(fsx, "2026")).looksLikeYear).toBe(true);
  });

  test("raíz llamada como año pero con periodos no se rechaza", async () => {
    await accounts.createPeriod(fsx, "2025");
    expect((await accounts.inspectRoot(fsx, "2026")).looksLikeYear).toBe(false);
  });

  test("carpeta con otras cosas cuenta las entradas ajenas", async () => {
    await fs.mkdir(path.join(root, "Fotos"));
    await fs.writeFile(path.join(root, "notas.txt"), "x");
    const res = await accounts.inspectRoot(fsx, "Documentos");
    expect(res.otherEntries).toBe(2);
    expect(res.looksLikeYear).toBe(false);
  });
});

describe("eliminar", () => {
  test("deleteEntry borra un servicio con su contenido", async () => {
    await accounts.createPeriod(fsx, "2026");
    await accounts.createService(fsx, "2026", "04", null, "Luz");
    await accounts.importFiles(fsx, "2026", "04", "Luz", [{ name: "a.pdf", data: blob("A") }]);

    await accounts.deleteEntry(fsx, { kind: "service", period: "2026", monthNN: "04", service: "Luz" });

    expect(await accounts.listServices(fsx, "2026", "04")).toEqual([]);
  });
});

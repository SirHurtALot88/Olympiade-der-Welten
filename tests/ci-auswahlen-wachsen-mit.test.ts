/**
 * DIE CI-AUSWAHLEN MÜSSEN MITWACHSEN — sonst wiederholen sie den Fehler, gegen den sie gebaut sind.
 *
 * Drei Wächter-Läufe hängen inzwischen an errechneten Auswahlen: `ci:quelltext-waechter` (#602),
 * und neu `ci:render-waechter` und `ci:persistenz-suiten`. Alle drei sammeln ihre Dateien über
 * Signaturen im Testtext, statt sie aufzuzählen. Der Grund ist immer derselbe: eine feste Liste
 * veraltet ab dem Tag, an dem jemand einen neuen Wächter schreibt — und dann fehlt genau er im Tor.
 * Exakt so ist #586 durchgerutscht.
 *
 * Diese Suite prüft die Zusage, nicht die Zahl: die Auswahl darf nie leer sein, sie muss auf einen
 * frisch dazugelegten Test anspringen, und die drei Läufe müssen in der CI verdrahtet sein.
 * Absolute Dateizahlen stehen bewusst NICHT hier drin — sie ändern sich mit jedem neuen Test, und
 * ein Wächter, der bei jedem zweiten PR rot wird, ist keiner.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

const WURZEL = process.cwd();
const ci = readFileSync(join(WURZEL, ".github/workflows/ci.yml"), "utf8");
const paket = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

/**
 * Die Auswahl eines Skripts ermitteln, OHNE die Tests zu fahren: die Skripte melden ihre
 * Dateizahl auf stdout, bevor sie vitest starten. Wir brechen danach ab.
 */
function zaehleAuswahl(skript: string): number {
  const ausgabe = execFileSync(
    "node",
    [
      "-e",
      `
      const cp = require("node:child_process");
      const echt = cp.execFileSync;
      cp.execFileSync = () => Buffer.from("");
      require("tsx/cjs");
      require(${JSON.stringify(join(WURZEL, "scripts", skript))});
      `,
    ],
    { cwd: WURZEL, encoding: "utf8" },
  );
  const treffer = /:\s*(\d+)\s+Dateien/.exec(ausgabe);
  expect(treffer, `keine Dateizahl in der Ausgabe von ${skript}: ${ausgabe}`).not.toBeNull();
  return Number(treffer![1]);
}

const aufraeumen: string[] = [];
afterAll(() => {
  for (const pfad of aufraeumen) rmSync(pfad, { force: true });
});

/** Einen echten Test in tests/ ablegen und messen, ob die Auswahl ihn aufnimmt. */
function waechstMit(skript: string, inhalt: string): boolean {
  const vorher = zaehleAuswahl(skript);
  const name = mkdtempSync(join(tmpdir(), "oly-ci-")).slice(-8);
  const pfad = join(WURZEL, "tests", `zzz-ci-auswahl-probe-${name}.test.ts`);
  aufraeumen.push(pfad);
  writeFileSync(pfad, inhalt, "utf8");
  try {
    return zaehleAuswahl(skript) === vorher + 1;
  } finally {
    rmSync(pfad, { force: true });
  }
}

describe("Render-Waechter", () => {
  it("waehlt ueberhaupt etwas aus", () => {
    expect(zaehleAuswahl("fahre-render-waechter.ts")).toBeGreaterThan(0);
  });

  it("nimmt einen NEUEN rendernden Test von selbst auf", () => {
    // Die Kernzusage. Ohne sie waere die Auswahl nur eine Liste mit Extraschritten.
    expect(
      waechstMit(
        "fahre-render-waechter.ts",
        'import { render } from "@testing-library/react";\nimport { it } from "vitest";\nit("x", () => { void render; });\n',
      ),
    ).toBe(true);
  });

  it("laeuft im PFLICHT-Job, nicht daneben", () => {
    // `test-and-smoke` ist der Pflicht-Check. Steht der Schritt im falschen Job, ist er wirkungslos.
    const pflichtJob = ci.slice(ci.indexOf("  test-and-smoke:"), ci.indexOf("  full-test-suite:"));
    expect(pflichtJob).toContain("npm run ci:render-waechter");
  });
});

describe("Persistenz-Suiten", () => {
  it("waehlt ueberhaupt etwas aus", () => {
    expect(zaehleAuswahl("fahre-persistenz-suiten.ts")).toBeGreaterThan(0);
  });

  it("nimmt eine NEUE Persistenz-Suite von selbst auf", () => {
    expect(
      waechstMit(
        "fahre-persistenz-suiten.ts",
        'import { createPersistenceService } from "@/lib/persistence/persistence-service";\nimport { it } from "vitest";\nit("x", () => { void createPersistenceService; });\n',
      ),
    ).toBe(true);
  });

  it("hat einen eigenen Job mit eigenem SQLite-Pfad", () => {
    // Ohne eigenen Pfad teilen sich zwei parallel laufende Jobs eine Datenbankdatei.
    const job = ci.slice(ci.indexOf("  persistenz-suiten:"));
    expect(job).toContain("npm run ci:persistenz-suiten");
    expect(job).toContain("ci-oly-persistenz.sqlite");
  });
});

describe("Alle drei Auswahlen sind als Skript hinterlegt", () => {
  it("hat fuer jeden Lauf einen npm-Befehl", () => {
    expect(paket.scripts["ci:quelltext-waechter"]).toBeTruthy();
    expect(paket.scripts["ci:render-waechter"]).toBeTruthy();
    expect(paket.scripts["ci:persistenz-suiten"]).toBeTruthy();
  });

  it("meldet eine leere Auswahl als Fehler, statt still gruen zu sein", () => {
    // Eine kaputte Erkennung sieht sonst aus wie „nichts zu tun" — die gefaehrlichste Farbe.
    for (const skript of ["fahre-render-waechter.ts", "fahre-persistenz-suiten.ts", "fahre-quelltext-waechter.ts"]) {
      const quelle = readFileSync(join(WURZEL, "scripts", skript), "utf8");
      expect(quelle).toContain("process.exit(1)");
    }
  });
});

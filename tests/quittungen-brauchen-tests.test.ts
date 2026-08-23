/**
 * DER RIEGEL AUF DEN QUITTUNGEN — und warum es ihn gibt.
 *
 * Chris am 23.08.2026: „hast du die anderen bugs auch alle auditiert und geprüft ob sie WIRKLICH
 * gefixt sind?" Die Antwort war nein. Der Bugfixing-Lauf verglich zwei Listen — Meldungen gegen
 * Quittungsdateien — und hielt eine vorhandene Datei für einen Beleg. Das Audit fand daraufhin
 * eine Quittung, die einen längst umbenannten Test nannte, und 25 gebaute Fixes ganz ohne Test.
 *
 * Auf seine Ansage („ja bau das in die routine ein") prüft `scripts/pruefe-quittungen.ts` das
 * jetzt, und dieser Test hält die REGELN dieses Skripts fest — nicht seine Ausgabe.
 *
 * WAS HIER ABSICHTLICH NICHT STEHT: eine Prüfung, ob die Fixes inhaltlich stimmen. Das kann kein
 * Skript. Der dritte Auditbefund (`33c172` war nur zur Hälfte gebaut) wurde durch Nachlesen
 * gefunden, nicht durch Zählen — und daran ändert dieser Riegel nichts. Er verhindert nur, dass
 * die Zahl der ungesicherten Fixes unbemerkt WÄCHST.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();
const TRIAGE = join(WURZEL, "data/bug-reports/triage");
const SKRIPT = join(WURZEL, "scripts/pruefe-quittungen.ts");

type Quittung = { datei: string; istFix: boolean; tests: string[] };

function leseQuittungen(): Quittung[] {
  return readdirSync(TRIAGE)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const text = readFileSync(join(TRIAGE, name), "utf8");
      return {
        datei: name,
        istFix: /^changelog:\s*\S/m.test(text),
        tests: [...new Set(text.match(/tests\/[\w\-.]+\.test\.tsx?/g) ?? [])].sort(),
      };
    });
}

/** Die Obergrenze steht im Skript und wird hier ausgelesen — eine Quelle, nicht zwei. */
function leseObergrenze(): number {
  const treffer = /const OHNE_TEST_OBERGRENZE = (\d+);/.exec(readFileSync(SKRIPT, "utf8"));
  expect(treffer, "OHNE_TEST_OBERGRENZE nicht im Skript gefunden").not.toBeNull();
  return Number(treffer![1]);
}

describe("Quittungen brauchen Tests", () => {
  it("nennt jede gebaute Quittung mit Testangabe mindestens einen Test, den es wirklich gibt", () => {
    const ohneJedenTest = leseQuittungen()
      .filter((quittung) => quittung.istFix && quittung.tests.length > 0)
      .filter((quittung) => !quittung.tests.some((test) => existsSync(join(WURZEL, test))))
      .map((quittung) => `${quittung.datei} -> ${quittung.tests.join(", ")}`);
    // Genau der Fall `fm2opo`: die Quittung nannte nur einen Test, und der war umbenannt worden.
    expect(ohneJedenTest).toEqual([]);
  });

  it("haelt die Zahl der Fixes ohne Test auf der eingefrorenen Obergrenze — sie darf nur sinken", () => {
    const ohneTest = leseQuittungen().filter((quittung) => quittung.istFix && quittung.tests.length === 0);
    const obergrenze = leseObergrenze();
    // Steigt sie, ist ein neuer Fix ohne Test abgeliefert worden. Sinkt sie, gehoert die Konstante
    // im Skript nachgezogen — sonst verwaessert der Riegel still.
    expect(ohneTest.length, ohneTest.map((q) => q.datei).join("\n")).toBe(obergrenze);
  });

  it("laesst eine Quittung ihre eigene Umbenennung dokumentieren, ohne umzufallen", () => {
    // `fm2opo` nennt heute den alten UND den neuen Namen — der alte, weil die Notiz die
    // Umbenennung erklaert. Genau dieser Fall darf kein Fehler sein.
    const fm2opo = leseQuittungen().find((quittung) => quittung.datei.includes("fm2opo"));
    expect(fm2opo, "fm2opo-Quittung nicht gefunden").toBeDefined();
    expect(fm2opo!.tests.length).toBeGreaterThan(1);
    expect(fm2opo!.tests.some((test) => existsSync(join(WURZEL, test)))).toBe(true);
    expect(fm2opo!.tests.some((test) => !existsSync(join(WURZEL, test)))).toBe(true);
  });

  it("laeuft im Pflicht-Job mit — sonst waere der Riegel Zierrat", () => {
    const workflow = readFileSync(join(WURZEL, ".github/workflows/ci.yml"), "utf8");
    // Auf die JOB-Ueberschriften schneiden, nicht auf den blossen Namen: „full-test-suite" kommt
    // auch in den Kommentaren INNERHALB von `test-and-smoke` vor, und ein Schnitt darauf endete
    // mitten im Job — der Test fiel dann, obwohl die Zeile korrekt eingetragen war.
    const anfang = workflow.indexOf("\n  test-and-smoke:");
    const ende = workflow.indexOf("\n  full-test-suite:");
    expect(anfang, "Job test-and-smoke nicht gefunden").toBeGreaterThan(-1);
    expect(ende, "Job full-test-suite nicht gefunden").toBeGreaterThan(anfang);
    expect(workflow.slice(anfang, ende)).toContain("npm run ci:quittungen");
  });

  it("prueft in der CI ohne den Spiegel-Branch, der dort gar nicht ausgecheckt ist", () => {
    const paket = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    // Ohne `--nur-repo` wuerde der Lauf den fehlenden Branch bemerken — und ihn korrekt
    // ueberspringen. Das Flag macht die Absicht sichtbar, statt sie dem Zufall zu ueberlassen.
    expect(paket.scripts["ci:quittungen"]).toContain("--nur-repo");
  });
});

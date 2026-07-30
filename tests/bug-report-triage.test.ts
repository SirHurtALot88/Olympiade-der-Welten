/**
 * DIE TRIAGE DARF DIE MELDUNG NIE VERSCHLUCKEN.
 *
 * Der teuerste Fehler an dieser Stelle ist nicht ein falscher Status — es ist eine Meldung, die aus
 * der Uebersicht verschwindet und damit nie entschieden wird. Deshalb pruefen diese Tests vor allem
 * das Verhalten bei kaputten oder von Hand editierten Notizen: eine Notiz mit Tippfehler im Status
 * muss als "offen" auftauchen statt zu verschwinden.
 *
 * Die zweite Zusicherung: die Rohmeldung wird nicht angefasst. Was der Melder gesehen hat, ist
 * nachtraeglich nicht mehr feststellbar — schreibt die Bewertung in dieselbe Datei, ist das Protokoll
 * beim ersten Schreibfehler mit weg.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({ getActiveSave: () => null, getSaveById: () => null }),
}));

let workdir = "";
let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), "bug-triage-test-"));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(workdir);
});

afterEach(() => {
  cwdSpy?.mockRestore();
  fs.rmSync(workdir, { recursive: true, force: true });
  vi.resetModules();
});

async function importModules() {
  // Beide Ablageorte werden beim Import aus process.cwd() gebildet → nach dem Spy neu laden.
  const service = await import("@/lib/bug-report/bug-report-service");
  const triage = await import("@/lib/bug-report/bug-report-triage");
  return { ...service, ...triage };
}

describe("Triage — Vorpruefung und Entscheidung", () => {
  it("schreibt eine Notiz und liest Status, Titel und Schwere zurueck", async () => {
    const { writeTriage, readTriage } = await importModules();
    writeTriage({
      reportId: "bug-1",
      status: "vorgeprueft",
      titel: "Punkte doppelt gezaehlt",
      schwere: "hoch",
      body: "**Befund.** Nachgestellt.\n\n**Vorschlag.** Eine Zeile.",
    });
    const read = readTriage("bug-1");
    expect(read?.status).toBe("vorgeprueft");
    expect(read?.titel).toBe("Punkte doppelt gezaehlt");
    expect(read?.schwere).toBe("hoch");
    expect(read?.body).toContain("**Vorschlag.**");
    // Der Kopf gehoert nicht in den Fliesstext — sonst steht er in der Uebersicht doppelt.
    expect(read?.body).not.toContain("status:");
  });

  /** DER KERN: eine von Hand kaputt editierte Notiz darf die Meldung nicht aus der Liste kippen. */
  it("faellt bei unbekanntem Status auf 'offen' zurueck statt die Meldung zu verlieren", async () => {
    const { BUG_TRIAGE_DIR, parseTriage } = await importModules();
    const parsed = parseTriage("bug-2", "status: halbfertig\ntitel: Irgendwas\n\nText.", `${BUG_TRIAGE_DIR}/bug-2.md`);
    expect(parsed.status).toBe("offen");
    // Der Rest der Notiz bleibt trotzdem erhalten — nur der Status wird konservativ gedeutet.
    expect(parsed.titel).toBe("Irgendwas");
    expect(parsed.body).toBe("Text.");
  });

  it("eine Notiz ohne Kopf ist trotzdem lesbar und gilt als offen", async () => {
    const { parseTriage } = await importModules();
    const parsed = parseTriage("bug-3", "Nur ein Fliesstext ohne Kopfzeilen.", "x.md");
    expect(parsed.status).toBe("offen");
    expect(parsed.titel).toBeNull();
    expect(parsed.body).toBe("Nur ein Fliesstext ohne Kopfzeilen.");
  });

  it("keine Notiz vorhanden heisst: noch nicht geprueft", async () => {
    const { readTriage } = await importModules();
    expect(readTriage("bug-ohne-notiz")).toBeNull();
  });

  /** Die Bewertung liegt daneben, nicht darin — sonst ist das Protokoll beim ersten Fehler weg. */
  it("laesst die Rohmeldung unberuehrt", async () => {
    const { saveBugReport, writeTriage } = await importModules();
    const saved = saveBugReport({ note: "kaputt" });
    const before = fs.readFileSync(saved.file, "utf8");
    writeTriage({ reportId: saved.reportId, status: "abgelehnt", titel: "kein Fehler", body: "So gewollt." });
    expect(fs.readFileSync(saved.file, "utf8")).toBe(before);
  });

  /**
   * Die Notizen liegen in einem Unterordner von `data/bug-reports/`. Wuerde `listBugReports` ihn
   * mitlesen, taeuchte jede Triage als eigene Meldung auf und die Zaehlung waere doppelt.
   */
  it("die Triage-Ablage taucht nicht als eigene Meldung in der Liste auf", async () => {
    const { saveBugReport, writeTriage, listBugReports } = await importModules();
    const saved = saveBugReport({ note: "eine einzige Meldung" });
    writeTriage({ reportId: saved.reportId, status: "vorgeprueft", titel: "geprueft", body: "Befund." });
    expect(listBugReports(50)).toHaveLength(1);
  });

  it("ueberschreibt eine bestehende Notiz, statt eine zweite anzulegen", async () => {
    const { writeTriage, readTriage, BUG_TRIAGE_DIR } = await importModules();
    writeTriage({ reportId: "bug-4", status: "vorgeprueft", titel: "erst", body: "a" });
    writeTriage({ reportId: "bug-4", status: "angenommen", titel: "dann", body: "b" });
    expect(readTriage("bug-4")?.status).toBe("angenommen");
    expect(fs.readdirSync(BUG_TRIAGE_DIR)).toEqual(["bug-4.md"]);
  });
});

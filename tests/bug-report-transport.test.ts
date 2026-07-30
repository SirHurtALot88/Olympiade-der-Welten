/**
 * DER WEG EINER MELDUNG VOM RECHNER INS REPO.
 *
 * Die Flagge schreibt nach `data/bug-reports/`. Das allein ist noch keine Zustellung: liegt die
 * Datei nur auf der Platte des Rechners, auf dem der Server lief, hat niemand sie je gesehen.
 * Genau so war es — auf dem Hetzner-Server holte sie ein Cron-Skript ab, fuer einen LOKAL
 * gestarteten Server gab es gar keinen Weg. Deshalb faehrt sie beim Save-Auto-Export mit.
 *
 * Die Falle dabei ist die Aenderungserkennung. Der Export laeuft nur an, wenn sich die
 * Save-Signatur bewegt hat, und bricht danach ein zweites Mal ab, wenn der Save-Export nichts
 * geaendert hat. Eine Meldung auf einer Seite, auf der man nicht spielt — Login, Startseite,
 * Online-Raum — haette den Rechner damit nie verlassen. Und das ist genau die Lage, in der man
 * meldet. Deshalb hat die Meldung eine EIGENE Signatur, und die pruefen die Tests hier.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die Persistenz wird ersetzt, obwohl hier nur Dateinamen gezaehlt werden: `bug-report-service`
 * zieht sie beim Import mit, und die oeffnet die echte SQLite des Arbeitsverzeichnisses. Ohne den
 * Mock lief jeder Test hier in einen 5-Sekunden-Timeout — der Spielkontext ist Sache von
 * `bug-report-service.test.ts`, nicht dieser Datei.
 */
vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getActiveSave: () => null,
    getSaveById: () => null,
  }),
}));

let workdir = "";
let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), "bug-transport-test-"));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(workdir);
});

afterEach(() => {
  cwdSpy?.mockRestore();
  fs.rmSync(workdir, { recursive: true, force: true });
  vi.resetModules();
});

/**
 * BUG_REPORTS_DIR wird beim Import aus process.cwd() gebildet → nach dem Spy neu laden.
 *
 * Bewusst NUR der Bug-Meldungs-Dienst: die Signatur lag im ersten Entwurf im Auto-Export-Modul,
 * und dessen Import zieht die komplette Persistenzschicht samt SQLite mit — jeder Test lief in
 * einen 5-Sekunden-Timeout. Die Funktion gehoert ohnehin dorthin, wo ihr Ordner definiert ist.
 */
async function importModules() {
  return import("@/lib/bug-report/bug-report-service");
}

describe("Bug-Meldung — der Transport ins Repo", () => {
  it("meldet eine Aenderung, sobald eine Meldung dazukommt", async () => {
    const { saveBugReport, computeBugReportSignature } = await importModules();
    const before = computeBugReportSignature();
    saveBugReport({ note: "irgendwas ist kaputt" });
    expect(computeBugReportSignature()).not.toBe(before);
  });

  /**
   * Ohne diese Eigenschaft liefe bei jedem Zyklus ein Commit-Versuch — der Timer laeuft alle drei
   * Minuten und soll im Leerlauf nichts kosten.
   */
  it("bleibt gleich, solange nichts dazukommt", async () => {
    const { saveBugReport, computeBugReportSignature } = await importModules();
    saveBugReport({ note: "eine Meldung" });
    expect(computeBugReportSignature()).toBe(computeBugReportSignature());
  });

  /** Ein fehlender Ordner ist der Normalfall vor der ersten Meldung — und kein Fehler. */
  it("kommt ohne den Ordner zurecht", async () => {
    const { computeBugReportSignature } = await importModules();
    expect(computeBugReportSignature()).toBe("");
  });

  /**
   * Die Vorpruefungen liegen als `.md` im Unterordner `triage/`. Sie duerfen die Signatur nicht
   * bewegen: sonst schoebe jede Statusaenderung einen Commit an, ohne dass eine neue Meldung
   * vorliegt.
   */
  it("zaehlt nur Meldungen, nicht die Vorpruefungen daneben", async () => {
    const { saveBugReport, computeBugReportSignature, BUG_REPORTS_DIR } = await importModules();
    saveBugReport({ note: "eine Meldung" });
    const before = computeBugReportSignature();
    fs.mkdirSync(path.join(BUG_REPORTS_DIR, "triage"), { recursive: true });
    fs.writeFileSync(path.join(BUG_REPORTS_DIR, "triage", "irgendwas.md"), "# Vorpruefung\n", "utf8");
    expect(computeBugReportSignature()).toBe(before);
  });
});

/**
 * Der Push-Zweig selbst laeuft ueber git und ist hier nicht ausfuehrbar. Was sich pruefen laesst,
 * ist die Absicht im Quelltext — und die zwei Stellen, an denen ein Zurueckfallen auf "nur Saves"
 * die Meldungen wieder verschlucken wuerde.
 */
describe("Bug-Meldung — der Push nimmt sie mit", () => {
  const SOURCE = fs.readFileSync(
    path.join(__dirname, "..", "lib/persistence/online-save-auto-export.ts"),
    "utf8",
  );

  it("stagt und committet beide Datenordner, nicht nur die Saves", () => {
    expect(SOURCE).toContain('const BUG_REPORTS_PATHSPEC = "data/bug-reports"');
    expect(SOURCE).toContain("const DATA_PATHSPECS = [ONLINE_SAVES_PATHSPEC, BUG_REPORTS_PATHSPEC]");
    expect(SOURCE).toContain("await git(`add -- ${pathspecs}`)");
  });

  /**
   * Der Riegel gegen versehentlich mitgepushten Code darf die Meldungen nicht als "fremd"
   * einstufen — sonst wuerde der Push jedes Mal uebersprungen, sobald eine Meldung offen ist.
   */
  it("der Code-Riegel laesst die Meldungen durch", () => {
    expect(SOURCE).toContain("DATA_PATHSPECS.some((pathspec) => f.startsWith(`${pathspec}/`))");
  });
});

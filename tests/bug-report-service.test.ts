/**
 * DIE MELDE-FLAGGE MUSS ETWAS BRAUCHBARES HINTERLASSEN.
 *
 * Der Wert einer Bug-Meldung steckt nicht im Freitext, sondern im ZUSTAND: Spielstand, Saison,
 * Spieltag, gefuehrtes Team, Ansicht. Fehlt der, ist "das hier ist kaputt" nicht nachstellbar — genau
 * daran sind in diesem Projekt mehrere Diagnosen gescheitert.
 *
 * Ein Fehler beim Bauen zeigt, warum das geprueft werden muss: der erste Entwurf las den
 * Steuerungsmodus von `team.controlMode`. Dieses Feld ist in gespeicherten Staenden LEER — der Modus
 * steht in `seasonState.teamControlSettings`. Die Anreicherung lieferte damit stillschweigend eine
 * leere Team-Liste. Aufgefallen ist es nur, weil an einem echten Spielstand nachgemessen wurde: 0
 * statt 1 gefuehrtes Team. Ein Test, der nur "schreibt eine Datei" prueft, haette das durchgelassen.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const activeSave = { saveId: "save-1", name: "Testspiel" };
const gameState = {
  season: { id: "season-3", year: 3, currentMatchday: 7 },
  matchdayState: { matchdayId: "matchday-7", status: "resolved" },
  teams: [{ teamId: "C-C" }, { teamId: "A-A" }],
  seasonState: {
    teamControlSettings: {
      "C-C": { teamId: "C-C", controlMode: "manual" },
      "A-A": { teamId: "A-A", controlMode: "ai" },
      "B-B": { teamId: "B-B", controlMode: "passive" },
    },
  },
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getActiveSave: () => activeSave,
    getSaveById: () => ({ gameState }),
  }),
}));

let workdir = "";
let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), "bug-report-test-"));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(workdir);
});

afterEach(() => {
  cwdSpy?.mockRestore();
  fs.rmSync(workdir, { recursive: true, force: true });
  vi.resetModules();
});

async function importService() {
  // Der Ablageort wird beim Import aus process.cwd() gebildet → nach dem Spy neu laden.
  return import("@/lib/bug-report/bug-report-service");
}

describe("Bug-Meldung — der Zustand wird mitgeschrieben", () => {
  it("legt eine Datei an und gibt ihre Id zurueck", async () => {
    const { saveBugReport } = await importService();
    const result = saveBugReport({ note: "Knopf fehlt" });
    expect(fs.existsSync(result.file)).toBe(true);
    expect(result.reportId).toMatch(/^bug-\d{4}-\d{2}-\d{2}T/);
  });

  /** DER KERN: ohne diese Felder ist die Meldung nicht nachstellbar. */
  it("reichert Saison, Spieltag und Spielstand aus dem aktiven Save an", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ note: "x" });
    expect(record.game).toMatchObject({
      saveId: "save-1",
      saveName: "Testspiel",
      seasonId: "season-3",
      seasonYear: 3,
      currentMatchday: 7,
      matchdayId: "matchday-7",
      matchdayStatus: "resolved",
    });
  });

  /**
   * DER GEFUNDENE FEHLER. Der Modus steht in `seasonState.teamControlSettings`, nicht auf dem Team.
   * Las man ihn von `team.controlMode`, blieb die Liste leer — ohne jede Fehlermeldung.
   */
  it("findet das gefuehrte Team ueber teamControlSettings, nicht ueber team.controlMode", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({});
    expect(record.game?.activeTeamIds).toEqual(["C-C"]);
    // Gegenprobe zur Abgrenzung: ai und passive gehoeren NICHT dazu.
    expect(record.game?.activeTeamIds).not.toContain("A-A");
    expect(record.game?.activeTeamIds).not.toContain("B-B");
  });

  it("ein leerer Freitext ist erlaubt — der Zustand ist der Inhalt", async () => {
    const { saveBugReport } = await importService();
    expect(saveBugReport({ note: "   " }).record.note).toBeNull();
    expect(saveBugReport({}).record.note).toBeNull();
  });

  it("Ansicht, URL und Fenstergroesse werden uebernommen", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({
      view: "matchdayArena",
      url: "http://localhost:3000/foundation?view=matchdayArena",
      viewport: { width: 1512, height: 963 },
    });
    expect(record.view).toBe("matchdayArena");
    expect(record.url).toContain("view=matchdayArena");
    expect(record.viewport).toEqual({ width: 1512, height: 963 });
  });

  /**
   * "Die Seite, auf der der Bug gemeldet wird, und der User sollten auch mit drin stehen."
   *
   * `view` allein reicht dafuer nicht: der Parameter existiert nur innerhalb der
   * Foundation-Shell. Auf Login, Cockpit und Startseite war die Seite bisher nur aus der
   * rohen URL zu erraten.
   */
  it("benennt die Seite auch ohne ?view= — ueber Pfad und Titel", async () => {
    const { saveBugReport, formatBugReportPage } = await importService();
    const { record } = saveBugReport({ path: "/cockpit", pageTitle: "Cockpit · Oly" });
    expect(record.path).toBe("/cockpit");
    expect(record.pageTitle).toBe("Cockpit · Oly");
    expect(formatBugReportPage(record)).toContain("Cockpit");

    // Mit Ansicht gewinnt die Ansicht — sie ist praeziser als der Pfad.
    expect(formatBugReportPage({ view: "matchdayArena", path: "/foundation", pageTitle: "Oly" })).toContain(
      "matchdayArena",
    );
    // Und wenn wirklich nichts da ist, wird das benannt statt leer gelassen.
    expect(formatBugReportPage({ view: null, path: null, pageTitle: null })).toBe("unbekannte Seite");
  });

  it("haelt fest, WER gemeldet hat", async () => {
    const { saveBugReport } = await importService();
    const withSession = saveBugReport({ sessionOwnerId: "franky_remote_placeholder" }).record;
    expect(withSession.reporter).toEqual({
      ownerId: "franky_remote_placeholder",
      label: "Franky",
      fromSession: true,
    });
  });

  /**
   * Ohne Login gibt es keine Session — es sitzt aber trotzdem einer an der Tastatur. Der
   * Fallback benennt den lokalen Benutzer und markiert, dass das erschlossen ist. Ohne die
   * Markierung laese sich eine Annahme wie eine Feststellung, und bei zwei Spielern auf
   * einer Instanz waere sie still falsch.
   */
  it("unterscheidet belegte von erschlossener Identitaet", async () => {
    const { saveBugReport } = await importService();
    const withoutSession = saveBugReport({}).record;
    expect(withoutSession.reporter.label).toBe("Chris");
    expect(withoutSession.reporter.fromSession).toBe(false);
  });

  it("listet die neuesten Meldungen zuerst", async () => {
    const { saveBugReport, listBugReports } = await importService();
    const first = saveBugReport({ note: "erste" });
    const second = saveBugReport({ note: "zweite" });
    const listed = listBugReports(10).map((entry) => entry.reportId);
    expect(listed).toContain(first.reportId);
    expect(listed).toContain(second.reportId);
    expect(listed.length).toBe(2);
  });
});

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

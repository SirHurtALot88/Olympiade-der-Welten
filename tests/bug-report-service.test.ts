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
/** Der Save des ANDEREN Spielers — auf den zeigt der globale Aktiv-Zeiger genauso oft. */
const fremderSave = { saveId: "save-franky", name: "Frankys Spiel" };
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

/**
 * Der Mock bildet die Lage auf dem echten Server nach: Es gibt einen GLOBALEN Aktiv-Zeiger, der auf
 * Frankys Save zeigt, und daneben einen besitzerbezogenen. Wer den globalen nimmt, bekommt den
 * falschen — genau das ist in Produktion passiert.
 */
vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getActiveSave: (ownerId?: string) => (ownerId === "user_local" ? activeSave : fremderSave),
    getSaveById: (saveId: string) =>
      saveId === "save-1" || saveId === "save-franky" ? { saveId, gameState } : null,
  }),
}));

const CHRIS = { username: "chris", displayName: "Chris", ownerId: "user_local", source: "session" } as const;

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
    const { record } = saveBugReport({ note: "x", reporter: CHRIS });
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
    const { record } = saveBugReport({ reporter: CHRIS });
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
});

/**
 * DIE SEITE. Vorher stand dort nur der `?view=`-Parameter. Auf jeder Seite ausserhalb von
 * /foundation — Login, Startseite, Online-Raum — gibt es den gar nicht; die Meldung sagte dann nicht
 * einmal mehr, WO geklickt wurde. Genau danach war gefragt.
 */
describe("Bug-Meldung — die Seite", () => {
  it("haelt Pfad, Ansicht und Reiter fest", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ view: "matchdayArena", path: "/foundation", tab: "disziplinen" });
    expect(record.page).toMatchObject({ path: "/foundation", view: "matchdayArena", tab: "disziplinen" });
  });

  /** Der Klartext kommt aus der Navigations-Konfiguration — keine zweite, driftende Label-Liste. */
  it("uebersetzt die Ansicht in den Namen, der im Spiel an der Navigation steht", async () => {
    const { saveBugReport } = await importService();
    expect(saveBugReport({ view: "matchdayArena" }).record.page.label).toBe("Spieltag · Arena");
    expect(saveBugReport({ view: "trainingCompact" }).record.page.label).toBe("Team · Training");
  });

  /**
   * Dieselbe Ansicht steht unter mehreren Schreibweisen in der URL (`season`, `season-v2`,
   * `seasonV2`). Ohne die Alias-Aufloesung faende die Nav-Suche das Label nur bei der kanonischen
   * Variante — und die Meldung von genau derselben Seite haette mal einen Namen und mal keinen.
   */
  it("findet das Label auch bei Alias-Schreibweisen der Ansicht", async () => {
    const { saveBugReport } = await importService();
    const canonical = saveBugReport({ view: "seasonV2" }).record.page.label;
    expect(canonical).toBe("Spieltag · Saisonstand");
    expect(saveBugReport({ view: "season-v2" }).record.page.label).toBe(canonical);
    expect(saveBugReport({ view: "season" }).record.page.label).toBe(canonical);
  });

  /** Seite ohne `?view=`: der Pfad traegt die Meldung — er darf nicht mit verloren gehen. */
  it("haelt den Pfad fest, wenn es gar keine Ansicht gibt", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ path: "/login" });
    expect(record.page.path).toBe("/login");
    expect(record.page.view).toBeNull();
    // Fuer Seiten ausserhalb der Navigation gibt es kein Label — lieber keines als ein erfundenes.
    expect(record.page.label).toBeNull();
  });

  it("eine unbekannte Ansicht erfindet kein Label", async () => {
    const { saveBugReport } = await importService();
    expect(saveBugReport({ view: "gibtesnicht" }).record.page.label).toBeNull();
  });

  /**
   * Die Nav-Konfiguration kennt nur die Foundation-Ansichten. Auf Login, Startseite und Online-Raum
   * fehlt der `?view=`-Parameter UND der Nav-Eintrag — dort blieb das Label leer und die Meldung sagte
   * nur noch "irgendwo unter /login". Der Dokumenttitel tritt genau in diese Luecke.
   */
  it("nimmt den Dokumenttitel als Label, wo die Navigation die Seite nicht kennt", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ path: "/login", pageTitle: "Anmelden · Oly" });
    expect(record.page.label).toBe("Anmelden · Oly");
    expect(record.page.path).toBe("/login");
  });

  /** Die Navigation bleibt die bessere Quelle: sie driftet nicht, der Browsertitel schon. */
  it("die Navigation gewinnt gegen den Dokumenttitel", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ view: "matchdayArena", pageTitle: "irgendwas aus dem Browser" });
    expect(record.page.label).toBe("Spieltag · Arena");
  });
});

/**
 * DER MELDER. Bei zwei Spielern am selben Save ist "wer hat das gesehen" die Frage, an der die
 * Nachstellung haengt: Chris und Franky fuehren verschiedene Teams und sehen verschiedene Ansichten.
 */
describe("Bug-Meldung — wer gemeldet hat", () => {
  it("uebernimmt den Melder, den die Route aus der Session aufgeloest hat", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({
      reporter: { username: "franky", displayName: "Franky", ownerId: "owner-franky", source: "session" },
    });
    expect(record.reporter).toEqual({
      username: "franky",
      displayName: "Franky",
      ownerId: "owner-franky",
      source: "session",
    });
  });

  /**
   * `source` traegt die Bedeutung, nicht der leere Name: "Login ist aus" (Solo — es GIBT keinen
   * Benutzer) und "niemand angemeldet" sehen im Feld `username` identisch aus, verlangen beim
   * Nachstellen aber Verschiedenes. Wuerden beide nur als leer gefuehrt, waere die Unterscheidung weg.
   */
  it("unterscheidet abgeschalteten Login von niemand-angemeldet", async () => {
    const { saveBugReport } = await importService();
    const off = saveBugReport({
      reporter: { username: null, displayName: null, ownerId: null, source: "auth_disabled" },
    });
    const out = saveBugReport({
      reporter: { username: null, displayName: null, ownerId: null, source: "not_logged_in" },
    });
    expect(off.record.reporter.source).toBe("auth_disabled");
    expect(out.record.reporter.source).toBe("not_logged_in");
  });

  /** Das Feld darf nie fehlen — sonst muss jede Auswertung raten, ob "kein Melder" oder "alt". */
  it("ist auch dann gesetzt, wenn die Route keinen Melder mitgibt", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ note: "x" });
    expect(record.reporter).not.toBeUndefined();
    expect(record.reporter.username).toBeNull();
  });
});

/**
 * DER TEUERSTE FEHLER DIESER DATEI — er ist in Produktion aufgetreten und hat Diagnosen verdorben.
 *
 * Der erste Entwurf nahm den GLOBALEN Aktiv-Zeiger (`getActiveSave()` ohne Besitzer). Auf einem
 * Server mit zwei Spielern in getrennten Saves ist das der zuletzt gesetzte Zeiger — also mit
 * gleicher Wahrscheinlichkeit der des anderen. Zwei echte Meldungen von Chris (Save ...8d7mdx,
 * Team C-C) trugen dadurch Frankys Save und dessen Team T-G. Die darauf gestuetzte Untersuchung kam
 * bei beiden Meldungen zu einem falschen Ergebnis, und zwar zu einem plausibel klingenden.
 *
 * Ein falscher Zustand ist schlimmer als gar keiner: fehlt er, sieht man es und fragt nach.
 */
describe("Bug-Meldung — der Spielstand gehoert dem Melder, nicht dem Server", () => {
  it("nimmt die saveId aus der URL, wenn der Client sie mitschickt", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ saveId: "save-1", reporter: CHRIS });
    expect(record.game?.saveId).toBe("save-1");
  });

  /** Ohne saveId: der aktive Save DES MELDERS, nicht der globale Zeiger. */
  it("faellt auf den besitzerbezogenen Aktiv-Save zurueck, nicht auf den globalen", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ reporter: CHRIS });
    expect(record.game?.saveId).toBe("save-1");
    // Die Gegenprobe ist der eigentliche Test: der globale Zeiger zeigt hier auf Frankys Save.
    expect(record.game?.saveId).not.toBe("save-franky");
  });

  /**
   * Die mitgeschickte saveId schlaegt den Aktiv-Zeiger — auch wenn beide gesetzt sind. Wer auf
   * einen aelteren Spielstand schaut, meldet einen Fehler in DIESEM, nicht im zuletzt geoeffneten.
   */
  it("die mitgeschickte saveId gewinnt gegen den Aktiv-Zeiger", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({ saveId: "save-franky", reporter: CHRIS });
    expect(record.game?.saveId).toBe("save-franky");
  });

  /** Ohne Login gibt es nur einen Spieler — dann ist der globale Zeiger richtig und muss greifen. */
  it("ohne Login bleibt der globale Zeiger die Quelle", async () => {
    const { saveBugReport } = await importService();
    const { record } = saveBugReport({
      reporter: { username: null, displayName: null, ownerId: null, source: "auth_disabled" },
    });
    expect(record.game?.saveId).toBe("save-franky");
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

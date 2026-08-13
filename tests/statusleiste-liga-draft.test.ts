import { describe, expect, it } from "vitest";

import { buildFoundationActivities } from "@/lib/foundation/foundation-activity-registry";
import type { FoundationActivityInput } from "@/lib/foundation/foundation-activity-types";

/**
 * „ES HAT EINFACH GEDAUERT, OBWOHL DIE ANZEIGE OBEN AUF FERTIG STAND." (Chris)
 *
 * Genau so war es. Ein frisch angelegtes Spiel laesst den Whole-League-Draft ~40-60 Sekunden im
 * Hintergrund laufen und fuellt dabei die Kader aller KI-Teams (`seasonState.leagueSetupStatus`
 * = "in_progress"). Die Aktivitaetsleiste kannte das Feld nicht und meldete in dieser ganzen Zeit
 * „Bereit — Alle Aktionen abgeschlossen".
 *
 * Das ist die schlimmstmoegliche Kombination: wer in dieser Minute in den Kader schaut, sieht halb
 * leere Teams UND eine Anzeige, die sagt, es sei alles fertig — die Wartezeit sieht damit aus wie
 * ein kaputtes Spiel. Das Banner „Liga wird erstellt …" liest dasselbe Feld schon lange; es gab
 * zwei Anzeigen zum selben Vorgang, und nur eine wusste Bescheid.
 */
const RUHE: FoundationActivityInput = {
  isSaveBusy: false,
  aiPreseasonBusy: false,
  aiPreseasonRun: null,
  aiLineupEnsureBusy: false,
  aiLineupEnsure: null,
  adminSimulationBusy: false,
  adminSimulationRun: null,
  seasonTransitionBusy: false,
  preSeasonWorkflowBusy: false,
  seasonStartResetBusy: false,
  newGameBusy: false,
  rosterFillBusy: false,
  adminBalancingBusy: false,
  cockpitBusyKey: null,
  aiTeamsCount: 31,
  showIdleReady: true,
};

describe("Aktivitätsleiste: der laufende Liga-Draft", () => {
  it("meldet NICHT „Bereit“, solange die Liga noch aufgebaut wird", () => {
    const zeilen = buildFoundationActivities({ ...RUHE, leagueSetupStatus: "in_progress" });
    const ids = zeilen.map((zeile) => zeile.id);
    expect(ids).toContain("league-setup");
    // Das ist der Kern des Fehlers: „Bereit“ und „wird noch gebaut“ standen gleichzeitig an.
    expect(ids).not.toContain("idle-ready");
    const zeile = zeilen.find((eintrag) => eintrag.id === "league-setup");
    expect(zeile?.tone).toBe("running");
    // Die Wartezeit wird benannt — ohne sie liest sich die Meldung wie ein Hänger.
    expect(zeile?.detail).toMatch(/Minute/);
  });

  it("meldet einen abgebrochenen Draft, statt ihn zu verschweigen", () => {
    const zeilen = buildFoundationActivities({ ...RUHE, leagueSetupStatus: "failed" });
    const zeile = zeilen.find((eintrag) => eintrag.id === "league-setup-failed");
    expect(zeile).toBeDefined();
    expect(zeile?.tone).toBe("blocked");
    expect(zeilen.map((eintrag) => eintrag.id)).not.toContain("idle-ready");
  });

  it("ist nach dem Draft wieder still — „Bereit“ ist dann die richtige Auskunft", () => {
    const zeilen = buildFoundationActivities({ ...RUHE, leagueSetupStatus: "ready" });
    expect(zeilen.map((eintrag) => eintrag.id)).toEqual(["idle-ready"]);
  });

  it("aendert nichts an einem Spielstand ohne Draft-Feld (Bestandsspielstaende)", () => {
    const zeilen = buildFoundationActivities(RUHE);
    expect(zeilen.map((eintrag) => eintrag.id)).toEqual(["idle-ready"]);
  });
});

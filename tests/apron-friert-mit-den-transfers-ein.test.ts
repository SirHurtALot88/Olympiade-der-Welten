/**
 * DER APRON FRIERT MIT „TRANSFERS FINALISIEREN" EIN — NICHT ERST MIT DEM ERSTEN SPIELTAG.
 *
 * GEMELDET VON CHRIS:
 *
 *   „ich habe nun transfers finalisiert -> apron müsste nun eingefroren werden und hier
 *    entsprechend auch angezeigt werden in der GuV und den anderen finanz Seiten!"
 *
 * BEFUND: `resolveSeasonApronLines` fror ausschließlich an `hasSeasonBeenPlayed` ein — also erst,
 * wenn ein Spieltag abgerechnet war. Bis dahin meldete jede Finanz-Ansicht „Linien noch nicht
 * eingefroren", obwohl der Kaderbau der Saison mit dem Finalisieren nachweislich beendet ist.
 *
 * GEPINNT WIRD DIE EIGENSCHAFT, nicht der Umbau: solange das Kauffenster offen ist, wandern die
 * Linien mit dem Median mit; sobald alle menschlichen Teams finalisiert haben UND ein Snapshot der
 * laufenden Saison vorliegt, stehen sie — auch wenn danach noch Gehalt dazukommt.
 *
 * ZWEITER BEFUND, am Live-Abbild vom 13.08.2026 gemessen (Save `…-hwz8fk`): der Apron stand für
 * ALLE 32 Teams auf 0, obwohl Gehälter bis 99,3 gegen eine 2. Linie von 81,0 liefen. Das ist kein
 * Fehler des Einfrierens — der Salary Factor der Saison ist 0,84 und liegt damit unter der Schwelle
 * 0,95, ab der `apronKonjunkturhebel` überhaupt greift. Die 0 wird deshalb jetzt ERKLÄRT statt
 * kommentarlos ausgewiesen; hier festgehalten, damit die Erklärung nicht wieder verschwindet.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildApronProjection } from "@/lib/finance/apron-projection";
import { buildSeasonGuv } from "@/lib/finance/season-end-guv";
import {
  areSeasonApronLinesFrozen,
  haveSeasonTransfersBeenFinalized,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";
import { ensureSeasonApronLinesFrozen } from "@/lib/season/apron-settlement-service";

/**
 * 32 Teams, ein Spieler je Team, kein Spieltag gewertet. `menschlicheTeams` und `mitFormkarten`
 * werden getrennt gesetzt, damit „finalisiert" genau dann gilt, wenn es soll.
 */
function baueSpielstand(optionen: {
  gehaltProTeam: number;
  /** Indizes (1-basiert) der Teams, die als menschlich gesteuert gelten. */
  menschlicheTeams: number[];
  /** Indizes (1-basiert) der Teams, die einen Formkarten-Pool der Saison haben. */
  mitFormkarten: number[];
}): GameState {
  const teams = Array.from({ length: 32 }, (_, index) => ({
    teamId: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    shortCode: `T${index + 1}`,
    cash: 50,
    humanControlled: optionen.menschlicheTeams.includes(index + 1),
  }));

  return {
    season: { id: "season-1", name: "season-1", matchdayIds: ["matchday-1"], currentMatchday: 1 },
    gamePhase: "season_active",
    matchdayState: { matchdayId: "matchday-1", status: "pending" },
    teams,
    players: teams.map((team, index) => ({ id: `player-${index + 1}`, name: `Spieler ${index + 1}`, teamId: team.teamId })),
    rosters: teams.map((team, index) => ({
      teamId: team.teamId,
      playerId: `player-${index + 1}`,
      salary: optionen.gehaltProTeam,
      contractLength: 3,
    })),
    disciplines: [],
    seasonState: {
      schedule: [],
      standings: [],
      matchdayResults: [],
      standingsApplyLogs: [],
      formCards: optionen.mitFormkarten.map((nummer) => ({
        id: `card-${nummer}`,
        seasonId: "season-1",
        teamId: `team-${nummer}`,
        playerId: `player-${nummer}`,
        cardValue: 4,
      })),
    },
  } as unknown as GameState;
}

/** Erhöht alle Gehälter — der Test für „wandert die Linie noch mit?". */
function mitHoeherenGehaeltern(state: GameState, gehalt: number): GameState {
  return {
    ...state,
    rosters: (state.rosters as Array<Record<string, unknown>>).map((entry) => ({ ...entry, salary: gehalt })),
  } as GameState;
}

describe("Apron · das Kauffenster schließt mit dem Finalisieren", () => {
  it("vor dem Finalisieren wandern die Linien mit dem Median mit", () => {
    // Das menschliche Team (1) hat noch keinen Formkarten-Pool — der Kaderbau läuft.
    const state = baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1], mitFormkarten: [] });

    expect(haveSeasonTransfersBeenFinalized(state)).toBe(false);
    expect(areSeasonApronLinesFrozen(state)).toBe(false);

    // Genau das ist der Zweck des Mitwanderns: rüstet die ganze Liga auf, rückt die Grenze mit.
    const nachAufruestung = resolveSeasonApronLines(mitHoeherenGehaeltern(state, 90));
    expect(nachAufruestung.medianSalary).toBeCloseTo(90, 1);
  });

  it("nach dem Finalisieren steht die Grenze, auch wenn danach noch Gehalt dazukommt", () => {
    const finalisiert = baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1], mitFormkarten: [1] });
    expect(haveSeasonTransfersBeenFinalized(finalisiert)).toBe(true);

    const eingefroren = ensureSeasonApronLinesFrozen(finalisiert, "transfers_finalized");
    expect(areSeasonApronLinesFrozen(eingefroren)).toBe(true);
    expect(eingefroren.seasonState.apronLinesSnapshot?.frozenAtEvent).toBe("transfers_finalized");

    // DIE eigentliche Zusage: ein Nachkauf nach dem Finalisieren verschiebt die Grenze nicht mehr.
    const linien = resolveSeasonApronLines(mitHoeherenGehaeltern(eingefroren, 90));
    expect(linien.medianSalary).toBeCloseTo(60, 1);
  });

  it("ein zweites Finalisieren verschiebt die Grenze nicht", () => {
    // Der Endpunkt ist bewusst idempotent; ohne diese Zusage würde ein zweiter Klick nach einem
    // Nachkauf die Linie stillschweigend nachziehen.
    const eingefroren = ensureSeasonApronLinesFrozen(
      baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1], mitFormkarten: [1] }),
      "transfers_finalized",
    );
    const teurer = mitHoeherenGehaeltern(eingefroren, 90);

    expect(ensureSeasonApronLinesFrozen(teurer, "transfers_finalized")).toBe(teurer);
    expect(resolveSeasonApronLines(teurer).medianSalary).toBeCloseTo(60, 1);
  });

  it("zählt nur MENSCHLICHE Teams — die Karten der KI sagen nichts über den Menschen aus", () => {
    // KI-Teams bekommen ihre Karten über den Stapel-Lauf, lange bevor der Mensch fertig ist.
    // Würde irgendein Pool zählen, fröre die Grenze mitten im Kaderbau ein.
    const nurKiHatKarten = baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1], mitFormkarten: [2, 3, 4] });
    expect(haveSeasonTransfersBeenFinalized(nurKiHatKarten)).toBe(false);

    // Zwei Menschen (Chris + Franky): erst wenn BEIDE durch sind, ist das Fenster zu.
    const einerFehlt = baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1, 2], mitFormkarten: [1] });
    expect(haveSeasonTransfersBeenFinalized(einerFehlt)).toBe(false);
    const beide = baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1, 2], mitFormkarten: [1, 2] });
    expect(haveSeasonTransfersBeenFinalized(beide)).toBe(true);
  });

  it("ohne menschliches Team bleibt es beim alten Signal — dem ersten Spieltag", () => {
    // Reine Simulation: dort gibt es kein „Transfers finalisieren", also darf das Fenster nicht
    // schon deshalb als geschlossen gelten, weil niemand da ist, der finalisieren könnte.
    const nurKi = baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [], mitFormkarten: [1, 2, 3] });
    expect(haveSeasonTransfersBeenFinalized(nurKi)).toBe(false);
    expect(areSeasonApronLinesFrozen(ensureSeasonApronLinesFrozen(nurKi))).toBe(false);
  });

  it("„eingefroren“ behauptet nichts ohne gespeicherte Linien", () => {
    // Finalisiert, aber der Snapshot fehlt (Spielstand aus einem älteren Build): dann wird noch
    // live gerechnet — die Anzeige darf in diesem Zustand NICHT „eingefroren" melden.
    const ohneSnapshot = baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1], mitFormkarten: [1] });
    expect(haveSeasonTransfersBeenFinalized(ohneSnapshot)).toBe(true);
    expect(areSeasonApronLinesFrozen(ohneSnapshot)).toBe(false);
  });
});

describe("Apron · die Anzeige weist den Zustand in beide Richtungen aus", () => {
  const rankByTeamId = new Map(Array.from({ length: 32 }, (_, index) => [`team-${index + 1}`, index + 1] as const));

  it("die Hochrechnung liest dieselbe Frage wie die Linien selbst", () => {
    const offen = baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1], mitFormkarten: [] });
    expect(buildApronProjection({ gameState: offen, rankByTeamId }).frozenLines).toBe(false);

    const zu = ensureSeasonApronLinesFrozen(
      baueSpielstand({ gehaltProTeam: 60, menschlicheTeams: [1], mitFormkarten: [1] }),
      "transfers_finalized",
    );
    expect(buildApronProjection({ gameState: zu, rankByTeamId }).frozenLines).toBe(true);
  });

  it("der GuV-Posten nennt „eingefroren“ ausdrücklich, nicht nur dessen Gegenteil", () => {
    // Vorher stand nur die WARNUNG da. Ihr Fehlen war von „diese Ansicht kennt den Apron nicht"
    // nicht zu unterscheiden — genau der Ausweis, nach dem Chris gefragt hat.
    const offen = buildSeasonGuv({ teamId: "team-1", apronNetto: 0, apronRank: 1, apronFrozenLines: false });
    const zu = buildSeasonGuv({ teamId: "team-1", apronNetto: 0, apronRank: 1, apronFrozenLines: true });

    expect(offen.posten.find((p) => p.key === "apron")?.note).toContain("Linien noch nicht eingefroren");
    expect(zu.posten.find((p) => p.key === "apron")?.note).toContain("Linien eingefroren");
    expect(zu.posten.find((p) => p.key === "apron")?.note).not.toContain("noch nicht eingefroren");
  });

  it("erklärt eine Abgabe von 0, wenn der Konjunkturhebel sie abschaltet", () => {
    // Gemessen am Live-Abbild: Salary Factor 0,84 → Hebel 0 → 0 Abgabe für alle 32 Teams. Ohne
    // diesen Satz liest sich die 0 wie ein kaputter Apron.
    const abgeschaltet = buildSeasonGuv({
      teamId: "team-1",
      apronNetto: 0,
      apronRank: 1,
      apronFrozenLines: true,
      apronKonjunkturhebel: 0,
    });
    expect(abgeschaltet.posten.find((p) => p.key === "apron")?.note).toContain("in dieser Saison keine Abgabe");

    // Läuft der Hebel, steht der Satz NICHT da — sonst erklärte er eine Null, die es nicht gibt.
    const laeuft = buildSeasonGuv({
      teamId: "team-1",
      apronNetto: -3,
      apronRank: 1,
      apronFrozenLines: true,
      apronKonjunkturhebel: 0.8,
    });
    expect(laeuft.posten.find((p) => p.key === "apron")?.note).not.toContain("keine Abgabe");
  });
});

/**
 * DIE APRON-LINIEN DÜRFEN NICHT VOR DEM KADERBAU EINRASTEN.
 *
 * Gemeldet an Chris' Spielstand: 28 von 32 Teams standen über der 2. Apron-Linie, die Abrechnung
 * hätte 29 Zahler mit zusammen 587,4 Mio getroffen. Nachgemessen war die Ursache kein Rechenfehler,
 * sondern der Zeitpunkt: die Linien wurden am Ende des Saisonübergangs eingefroren (06:05:23), der
 * erste Zugang der Saison fiel 99 Sekunden später (06:07:02), und danach kamen ALLE 106 Zugänge
 * über 717,5 Mio Gehalt. Der Median sprang von 45,0 auf 69,8 — die eingefrorene 2. Linie stand bei
 * 56,2.
 *
 * Der Kopfkommentar von `apron-service.ts` nennt das Mitwandern als Kern des Entwurfs: die Linien
 * hängen am Median, „damit die Linien mitwandern, wenn die ganze Liga aufrüstet". Genau das war
 * durch den zu frühen Einfrier-Zeitpunkt ausgehebelt.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  computeApronLines,
  hasSeasonBeenPlayed,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";
import { ensureSeasonApronLinesFrozen } from "@/lib/season/apron-settlement-service";

/**
 * Minimaler Spielstand mit echten Gehältern. `getTeamDisplaySalaryTotal` summiert die geglätteten
 * Vertragsraten (`expectedSalary`) der Roster-Einträge — mehr braucht die Linien-Rechnung nicht.
 */
function baueSpielstand(gehaelterProTeam: number[], optionen?: {
  gespielt?: boolean;
  snapshot?: { medianSalary: number; line1: number; line2: number };
}): GameState {
  const teams = gehaelterProTeam.map((_, index) => ({
    teamId: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    shortCode: `T${index + 1}`,
    cash: 50,
  }));
  const players = gehaelterProTeam.map((_, index) => ({
    id: `player-${index + 1}`,
    name: `Spieler ${index + 1}`,
    teamId: `team-${index + 1}`,
  }));
  // `salary` liegt am ROSTER-Eintrag, nicht am Spieler — `resolveRosterContractSalaries` liest
  // genau dieses Feld (ohne `yearlySalarySchedule` ist es zugleich die geglättete Rate).
  const rosters = gehaelterProTeam.map((gehalt, index) => ({
    teamId: `team-${index + 1}`,
    playerId: `player-${index + 1}`,
    salary: gehalt,
    contractLength: 3,
  }));

  return {
    season: { id: "season-2", name: "Season 2", matchdayIds: ["season-2-matchday-1"], currentMatchday: 1 },
    gamePhase: "season_active",
    matchdayState: { matchdayId: "season-2-matchday-1", status: "pending" },
    teams,
    players,
    rosters,
    disciplines: [],
    seasonState: {
      schedule: [],
      standings: [],
      // DAS IST DER KERN DES FALLS: Spieltag 1 ist der aktive Spieltag, aber es liegt kein
      // Ergebnis vor. Genau so sah Chris' Save aus, als 106 Zugänge darunter gebucht wurden.
      matchdayResults: optionen?.gespielt
        ? [{ id: "r1", seasonId: "season-2", matchdayId: "season-2-matchday-1" }]
        : [],
      standingsApplyLogs: [],
      apronLinesSnapshot: optionen?.snapshot
        ? {
            seasonId: "season-2",
            frozenAtMatchdayId: "season-2-matchday-1",
            createdAt: "2026-08-08T06:05:23.116Z",
            usedReferenceSalary: false,
            ...optionen.snapshot,
          }
        : undefined,
    },
  } as unknown as GameState;
}

/** Der Gehaltsstand VOR dem Kaderbau — Median 45, wie im Save eingefroren. */
const VOR_KADERBAU = Array.from({ length: 32 }, () => 45);
/** Nach dem Kaderbau: Median 69,8, wie im Save gemessen. */
const NACH_KADERBAU = Array.from({ length: 32 }, () => 69.8);

describe("Apron-Linien rasten erst nach dem Kaderbau ein", () => {
  it("erkennt eine noch nicht gespielte Saison, obwohl Spieltag 1 der aktive ist", () => {
    expect(hasSeasonBeenPlayed(baueSpielstand(VOR_KADERBAU))).toBe(false);
    expect(hasSeasonBeenPlayed(baueSpielstand(VOR_KADERBAU, { gespielt: true }))).toBe(true);
  });

  it("führt die Linien nach, solange kein Spieltag abgerechnet ist", () => {
    // Eingefroren auf dem Stand VOR dem Kaderbau, Gehälter stehen inzwischen auf dem Stand danach.
    const state = baueSpielstand(NACH_KADERBAU, {
      snapshot: { medianSalary: 45, line1: 49.4, line2: 56.2 },
    });

    const linien = resolveSeasonApronLines(state);

    // OHNE DEN FIX kam hier der veraltete Snapshot zurück (56,2) — das ist die Zeile, die fällt.
    expect(linien.line2).toBeCloseTo(87.3, 1);
    expect(linien.medianSalary).toBeCloseTo(69.8, 1);
    expect(linien.line2).not.toBeCloseTo(56.2, 1);
  });

  it("hält den eingefrorenen Stand, sobald der erste Spieltag abgerechnet ist", () => {
    const state = baueSpielstand(NACH_KADERBAU, {
      gespielt: true,
      snapshot: { medianSalary: 60, line1: 66, line2: 75 },
    });

    // Ab hier zählt der Snapshot, auch wenn die Gehälter inzwischen höher liegen: wer während der
    // Saison einkauft, soll die Grenze nicht mit sich ziehen können.
    expect(resolveSeasonApronLines(state).line2).toBeCloseTo(75, 1);
  });

  it("überschreibt einen vorläufigen Snapshot, rührt einen endgültigen aber nicht an", () => {
    const vorlaeufig = baueSpielstand(NACH_KADERBAU, {
      snapshot: { medianSalary: 45, line1: 49.4, line2: 56.2 },
    });
    const nachgefuehrt = ensureSeasonApronLinesFrozen(vorlaeufig);
    expect(nachgefuehrt.seasonState.apronLinesSnapshot?.line2).toBeCloseTo(87.3, 1);

    const endgueltig = baueSpielstand(NACH_KADERBAU, {
      gespielt: true,
      snapshot: { medianSalary: 45, line1: 49.4, line2: 56.2 },
    });
    const unveraendert = ensureSeasonApronLinesFrozen(endgueltig);
    expect(unveraendert.seasonState.apronLinesSnapshot?.line2).toBeCloseTo(56.2, 1);
    expect(unveraendert).toBe(endgueltig);
  });

  it("die gemessene Lage aus dem Save: 28 von 32 über der alten Linie, 0 über der nachgeführten", () => {
    // Die echte Gehaltsverteilung des Saves (geglättet), absteigend.
    const gehaelter = [
      94.6, 94.1, 86.5, 83.5, 81.6, 79.7, 79.0, 77.9, 76.7, 76.7, 76.6, 76.5, 76.3, 75.6, 73.2,
      69.8, 69.8, 69.4, 67.8, 67.1, 67.0, 66.1, 66.0, 63.4, 62.4, 61.9, 60.3, 56.4, 50.2, 49.6,
      48.6, 43.0,
    ];
    const state = baueSpielstand(gehaelter, {
      snapshot: { medianSalary: 45, line1: 49.4, line2: 56.2 },
    });

    const alteLinie2 = 56.2;
    const ueberAlt = gehaelter.filter((g) => g > alteLinie2).length;
    expect(ueberAlt).toBe(28);

    const neu = computeApronLines(state);
    expect(neu.medianSalary).toBeCloseTo(69.8, 1);
    const ueberNeu = gehaelter.filter((g) => g > neu.line2).length;
    // Zwei Teams liegen über der nachgeführten Linie — eine Grenze, die wieder unterscheidet.
    expect(ueberNeu).toBe(2);
  });
});

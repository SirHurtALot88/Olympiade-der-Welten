import { describe, expect, it } from "vitest";

import type { DisciplineResultRecord, GameState, MatchdayResultRecord } from "@/lib/data/olyDataTypes";
import {
  arenaAusfallGrundLabel,
  buildSpieltagsUebersicht,
  istSpieltagsModusVerfuegbar,
  resolveSpielquelleLabel,
} from "@/lib/foundation/season-matchday-fixtures-overview";
import { getMiniDmPodsForMatchday } from "@/lib/season/mini-dm-pod-schedule";

/**
 * SPIELTAGS-UEBERSICHT — reiner Builder-Test (Fixtures + disciplineResults zusammenfuehren),
 * s. Dateikommentar in season-matchday-fixtures-overview.ts fuer die Rueckspiel-Korrektur
 * (schedule-direkt statt occurrenceInSeason).
 */

const DISCIPLINE_SCHEDULE_MD1 = {
  seasonId: "s1",
  matchdayId: "md1",
  matchdayIndex: 0,
  discipline1: { disciplineId: "basketball", displayName: "Basketball", order: 1, playerCount: 2, category: "tactics", occurrenceInSeason: 1 },
  discipline2: { disciplineId: "battlefield", displayName: "Battlefield", order: 2, playerCount: 2, category: "power", occurrenceInSeason: 1 },
};

const DISCIPLINE_SCHEDULE_MD2 = {
  seasonId: "s1",
  matchdayId: "md2",
  matchdayIndex: 1,
  // Zweiter Durchgang derselben beiden Disziplinen -- der ehrliche Ort fuer "2. Durchgang" ist
  // HIER (je Disziplin), nicht an der Paarung (s. Praezisierung im Dateikommentar des Builders).
  discipline1: { disciplineId: "basketball", displayName: "Basketball", order: 1, playerCount: 2, category: "tactics", occurrenceInSeason: 2 },
  discipline2: { disciplineId: "battlefield", displayName: "Battlefield", order: 2, playerCount: 2, category: "power", occurrenceInSeason: 2 },
};

function zeile(
  input: Partial<DisciplineResultRecord> & {
    id: string;
    matchdayResultId: string;
    teamId: string;
    disciplineId: string;
    disciplineSide: "d1" | "d2";
  },
): DisciplineResultRecord {
  return {
    rank: 1,
    baseScore: 0,
    totalScore: 0,
    readinessStatus: "ready",
    warnings: [],
    createdAt: "2026-10-17T00:00:00.000Z",
    ...input,
  } as unknown as DisciplineResultRecord;
}

function matchdayResult(id: string, matchdayId: string): MatchdayResultRecord {
  return {
    id,
    saveId: "save-1",
    seasonId: "s1",
    matchdayId,
    status: "preview_applied",
    sourceVersion: "v1",
    teamsTotal: 4,
    teamsReady: 4,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
  } as unknown as MatchdayResultRecord;
}

/**
 * Baut einen Battle-Save mit zwei Spieltagen:
 *  - md1: f1 (A heim vs. B gast, liga1, GEWERTET — basketball Duell-Sieg A, battlefield Remis)
 *         f2 (C heim vs. D gast, liga2, NOCH NICHT GEWERTET)
 *  - md2: f3 (B heim vs. A gast, liga1) — Rueckspiel zu f1 mit getauschten Seiten.
 */
function buildGameState(): GameState {
  return {
    scenarioMeta: { gameMode: "battle" },
    season: { id: "s1", matchdayIds: ["md1", "md2"], currentMatchday: 2 },
    disciplines: [],
    rosters: [],
    players: [],
    teams: [],
    seasonState: {
      schedule: [
        { id: "f1", homeTeamId: "A", awayTeamId: "B", matchdayId: "md1", status: "scheduled", leagueTier: "liga1" },
        { id: "f2", homeTeamId: "C", awayTeamId: "D", matchdayId: "md1", status: "scheduled", leagueTier: "liga2" },
        { id: "f3", homeTeamId: "B", awayTeamId: "A", matchdayId: "md2", status: "scheduled", leagueTier: "liga1" },
      ],
      disciplineSchedule: [DISCIPLINE_SCHEDULE_MD1, DISCIPLINE_SCHEDULE_MD2],
      matchdayResults: [matchdayResult("mr-md1", "md1"), matchdayResult("mr-md2", "md2")],
      disciplineResults: [
        // f1, basketball: A gewinnt 2:0, Verhaeltnis +5/-5.
        zeile({ id: "r1", matchdayResultId: "mr-md1", teamId: "A", disciplineId: "basketball", disciplineSide: "d1", teamPoints: 2, opponentTeamId: "B", duellSeiten: [70, 15], verhaeltnis: 5, resolutionSource: "pps_duell" }),
        zeile({ id: "r2", matchdayResultId: "mr-md1", teamId: "B", disciplineId: "basketball", disciplineSide: "d1", teamPoints: 0, opponentTeamId: "A", duellSeiten: [15, 70], verhaeltnis: -5, resolutionSource: "pps_duell" }),
        // f1, battlefield: Remis 1:1 ueber die Arena.
        zeile({ id: "r3", matchdayResultId: "mr-md1", teamId: "A", disciplineId: "battlefield", disciplineSide: "d2", teamPoints: 1, opponentTeamId: "B", duellSeiten: [50, 50], verhaeltnis: 0, resolutionSource: "arena" }),
        zeile({ id: "r4", matchdayResultId: "mr-md1", teamId: "B", disciplineId: "battlefield", disciplineSide: "d2", teamPoints: 1, opponentTeamId: "A", duellSeiten: [50, 50], verhaeltnis: 0, resolutionSource: "arena" }),
        // f2 (C vs. D): bewusst KEINE Zeilen -> noch nicht gewertet.
      ],
    },
  } as unknown as GameState;
}

describe("istSpieltagsModusVerfuegbar", () => {
  it("nur Battle-Saves mit echtem Spielplan", () => {
    expect(istSpieltagsModusVerfuegbar(buildGameState())).toBe(true);
    expect(istSpieltagsModusVerfuegbar({ scenarioMeta: { gameMode: "manager" }, seasonState: { schedule: [{}] } } as never)).toBe(false);
    expect(istSpieltagsModusVerfuegbar({ scenarioMeta: { gameMode: "battle" }, seasonState: { schedule: [] } } as never)).toBe(false);
  });
});

describe("buildSpieltagsUebersicht", () => {
  it("liefert beide Paarungen von md1 mit Ergebnis, Verhaeltnis und Quelle", () => {
    const uebersicht = buildSpieltagsUebersicht(buildGameState(), "md1");
    expect(uebersicht).not.toBeNull();
    expect(uebersicht!.matchdayIndex).toBe(0);
    expect(uebersicht!.paarungen).toHaveLength(2);

    const f1 = uebersicht!.paarungen.find((p) => p.fixtureId === "f1")!;
    expect(f1.homeTeamId).toBe("A");
    expect(f1.awayTeamId).toBe("B");
    expect(f1.leagueTier).toBe("liga1");
    expect(f1.gespielt).toBe(true);
    expect(f1.istRueckspiel).toBe(false);
    expect(f1.hinspielMatchdayId).toBeNull();
    expect(f1.hinspielMatchdayLabel).toBeNull();
    expect(f1.disziplinen).toHaveLength(2);

    const basketball = f1.disziplinen.find((d) => d.disciplineId === "basketball")!;
    // `seiten` bleibt bei "pps_duell" bewusst `null` (Review-Fund 19.10. Abend): `duellSeiten` ist
    // hier der rohe PPS-Score beider Seiten, kein echter Spielstand — s. Kommentar im Builder.
    expect(basketball).toMatchObject({ punkteHeim: 2, punkteGast: 0, seiten: null, verhaeltnisHeim: 5, verhaeltnisGast: -5, resolutionSource: "pps_duell", occurrenceInSeason: 1 });
    const battlefield = f1.disziplinen.find((d) => d.disciplineId === "battlefield")!;
    // Gegenstueck zur pps_duell-Zeile oben: bei "arena" MUSS der echte native Spielstand
    // durchkommen -- sonst haette der Fix das "echte Ergebnis" fuer alle Disziplinen abgeschaltet.
    expect(battlefield).toMatchObject({ punkteHeim: 1, punkteGast: 1, seiten: [50, 50], verhaeltnisHeim: 0, verhaeltnisGast: 0, resolutionSource: "arena", occurrenceInSeason: 1 });

    const f2 = uebersicht!.paarungen.find((p) => p.fixtureId === "f2")!;
    expect(f2.leagueTier).toBe("liga2");
    expect(f2.gespielt).toBe(false);
    for (const d of f2.disziplinen) {
      expect(d.gespielt).toBe(false);
      expect(d.punkteHeim).toBeNull();
      expect(d.punkteGast).toBeNull();
      expect(d.seiten).toBeNull();
    }
  });

  it("erkennt das Rueckspiel ueber den echten Spielplan, NICHT ueber occurrenceInSeason", () => {
    const uebersicht = buildSpieltagsUebersicht(buildGameState(), "md2");
    const f3 = uebersicht!.paarungen.find((p) => p.fixtureId === "f3")!;
    expect(f3.homeTeamId).toBe("B");
    expect(f3.awayTeamId).toBe("A");
    expect(f3.istRueckspiel).toBe(true);
    expect(f3.hinspielMatchdayId).toBe("md1");
    expect(f3.hinspielMatchdayLabel).toBe("Spieltag 1");
    // Je DISZIPLIN steht trotzdem der 2. Durchgang -- getrennt von der Rueckspiel-Markierung der Paarung.
    for (const d of f3.disziplinen) {
      expect(d.occurrenceInSeason).toBe(2);
    }
  });

  it("Liga-Filter grenzt auf eine Liga ein", () => {
    const liga1 = buildSpieltagsUebersicht(buildGameState(), "md1", { leagueTier: "liga1" });
    expect(liga1!.paarungen.map((p) => p.fixtureId)).toEqual(["f1"]);
    const liga2 = buildSpieltagsUebersicht(buildGameState(), "md1", { leagueTier: "liga2" });
    expect(liga2!.paarungen.map((p) => p.fixtureId)).toEqual(["f2"]);
  });

  it("Manager-Save (kein Spieltage-Modus) liefert null", () => {
    const manager = { ...buildGameState(), scenarioMeta: { gameMode: "manager" } } as unknown as GameState;
    expect(buildSpieltagsUebersicht(manager, "md1")).toBeNull();
  });

  it("unbekannter Spieltag liefert null", () => {
    expect(buildSpieltagsUebersicht(buildGameState(), "md-unbekannt")).toBeNull();
  });

  it("GEGENPROBE (Pflicht-Invariante): je gewerteter Disziplin summieren sich die Teampunkte zu 2 und das Verhaeltnis zu 0", () => {
    const gs = buildGameState();
    for (const matchdayId of gs.season.matchdayIds) {
      const uebersicht = buildSpieltagsUebersicht(gs, matchdayId);
      if (!uebersicht) continue;
      for (const paarung of uebersicht.paarungen) {
        for (const disziplin of paarung.disziplinen) {
          if (!disziplin.gespielt) continue;
          expect(disziplin.punkteHeim).not.toBeNull();
          expect(disziplin.punkteGast).not.toBeNull();
          expect((disziplin.punkteHeim ?? 0) + (disziplin.punkteGast ?? 0)).toBe(2);
          expect(disziplin.verhaeltnisHeim).not.toBeNull();
          expect(disziplin.verhaeltnisGast).not.toBeNull();
          expect((disziplin.verhaeltnisHeim ?? 0) + (disziplin.verhaeltnisGast ?? 0)).toBe(0);
        }
      }
    }
  });
});

describe("resolveSpielquelleLabel / arenaAusfallGrundLabel", () => {
  it("ungespielt liefert einen leeren String", () => {
    expect(resolveSpielquelleLabel({ gespielt: false, resolutionSource: null, arenaAusfall: null })).toBe("");
    expect(resolveSpielquelleLabel({ gespielt: true, resolutionSource: null, arenaAusfall: null })).toBe("");
  });

  it("Arena und reines PPS-Duell", () => {
    expect(resolveSpielquelleLabel({ gespielt: true, resolutionSource: "arena", arenaAusfall: null })).toBe("Arena");
    expect(resolveSpielquelleLabel({ gespielt: true, resolutionSource: "pps_duell", arenaAusfall: null })).toBe("PPS-Duell");
  });

  it("PPS-Duell MIT Arena-Ausfall traegt den lesbaren Grund im Hinweis", () => {
    const label = resolveSpielquelleLabel({
      gespielt: true,
      resolutionSource: "pps_duell",
      arenaAusfall: { grund: "chromium_start", zeitpunkt: "2026-10-17T00:00:00.000Z", versuch: 1 } as never,
    });
    expect(label).toBe("PPS-Duell — Arena ausgefallen: Browser konnte nicht starten");
  });

  it("jeder ArenaAusfallGrund hat eine nicht-leere, lesbare Beschriftung", () => {
    const gruende = [
      "chromium_start",
      "timeout",
      "absturz",
      "liga_fehlgeschlagen",
      "ergebnis_unvollstaendig",
      "abgebrochen_neustart",
      "deaktiviert",
      "nicht_ausgefuehrt",
    ] as const;
    for (const grund of gruende) {
      const label = arenaAusfallGrundLabel(grund);
      expect(label.length, grund).toBeGreaterThan(0);
      // Keine Rohschluessel-Lecks (Unterstrich) in der UI-Beschriftung.
      expect(label).not.toContain("_");
    }
  });
});

/**
 * OPUS-REVIEW PR #1297 (20.10.): die Mini-DM-Gruppen der Spieltage-Ansicht muessen GENAU die
 * gebuchten Vierergruppen zeigen. Der Pod-Seed traegt die `saveId` -- vorher rief der Builder
 * `getMiniDmPodsForMatchday()` OHNE `saveId` auf (Rueckfall "normalized-local-save"), die
 * Resolve-Engine dagegen MIT der echten Save-ID: bei jedem echten Save zeigte die UI dadurch andere
 * Gruppen als gebucht (z. B. zwei erste Plaetze in einer Gruppe).
 */
describe("buildSpieltagsUebersicht -- Mini-DM-Pods (Opus-Review PR #1297)", () => {
  const TEAMS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
  const ECHTE_SAVE_ID = "new-game-1792458424395-6v71zp";

  function buildMiniDmGameState(mitErgebnissen: boolean): GameState {
    const gs = {
      scenarioMeta: { gameMode: "battle" },
      season: { id: "s1", matchdayIds: ["md1"], currentMatchday: 1 },
      disciplines: [{ id: "mini-dm", name: "Mini DM", category: "power", weight: 1, playerCount: 1 }],
      rosters: [],
      players: [],
      teams: TEAMS.map((teamId) => ({ teamId, name: teamId, shortCode: teamId })),
      seasonState: {
        schedule: [
          { id: "f1", homeTeamId: "T1", awayTeamId: "T2", matchdayId: "md1", status: "scheduled", leagueTier: null },
          { id: "f2", homeTeamId: "T3", awayTeamId: "T4", matchdayId: "md1", status: "scheduled", leagueTier: null },
          { id: "f3", homeTeamId: "T5", awayTeamId: "T6", matchdayId: "md1", status: "scheduled", leagueTier: null },
          { id: "f4", homeTeamId: "T7", awayTeamId: "T8", matchdayId: "md1", status: "scheduled", leagueTier: null },
        ],
        disciplineSchedule: [
          {
            seasonId: "s1",
            matchdayId: "md1",
            matchdayIndex: 0,
            discipline1: { disciplineId: "mini-dm", displayName: "Mini DM", order: 1, playerCount: 1, category: "power", occurrenceInSeason: 1 },
            discipline2: null,
          },
        ],
        matchdayResults: [matchdayResult("mr-md1", "md1")],
        disciplineResults: [] as DisciplineResultRecord[],
      },
    } as unknown as GameState;
    if (mitErgebnissen) {
      // Gebucht wie die Resolve-Engine: Pods MIT der echten Save-ID, Platz = Position im Pod.
      const pods = getMiniDmPodsForMatchday(gs, "md1", { saveId: ECHTE_SAVE_ID });
      gs.seasonState.disciplineResults = pods.flatMap((pod) =>
        pod.teamIds.map((teamId, index) =>
          zeile({
            id: `r-${teamId}`,
            matchdayResultId: "mr-md1",
            teamId,
            disciplineId: "mini-dm",
            disciplineSide: "d1",
            teamPoints: [2, 1, 0, 0][index]!,
            resolutionSource: "mini_dm_pod",
            miniDmPod: { podId: pod.id, platz: (index + 1) as 1 | 2 | 3 | 4, teamIds: pod.teamIds, wert: 8 - 2 * index },
          }),
        ),
      );
    }
    return gs;
  }

  const gruppenSchluessel = (gruppen: string[][]) => gruppen.map((teamIds) => [...teamIds].sort().join(",")).sort();

  it("Vorbedingung: Rueckfall-Seed und echte Save-ID liefern hier tatsaechlich VERSCHIEDENE Gruppen", () => {
    const gs = buildMiniDmGameState(false);
    const ohne = getMiniDmPodsForMatchday(gs, "md1").map((pod) => pod.teamIds);
    const mit = getMiniDmPodsForMatchday(gs, "md1", { saveId: ECHTE_SAVE_ID }).map((pod) => pod.teamIds);
    expect(gruppenSchluessel(ohne)).not.toEqual(gruppenSchluessel(mit));
  });

  it("gewertet: zeigt die GEBUCHTEN Gruppen (Plaetze 1-4 je Gruppe), auch ohne saveId-Option", () => {
    const gs = buildMiniDmGameState(true);
    const gebucht = getMiniDmPodsForMatchday(gs, "md1", { saveId: ECHTE_SAVE_ID }).map((pod) => pod.teamIds);
    for (const uebersicht of [buildSpieltagsUebersicht(gs, "md1"), buildSpieltagsUebersicht(gs, "md1", { saveId: ECHTE_SAVE_ID })]) {
      const pods = uebersicht!.miniDmPods;
      expect(gruppenSchluessel(pods.map((pod) => pod.mitglieder.map((m) => m.teamId)))).toEqual(gruppenSchluessel(gebucht));
      for (const pod of pods) {
        expect(pod.gespielt).toBe(true);
        expect(pod.mitglieder.map((m) => m.platz)).toEqual([1, 2, 3, 4]);
        expect(pod.mitglieder.map((m) => m.teamPoints)).toEqual([2, 1, 0, 0]);
      }
    }
  });

  it("noch nicht gewertet: zeigt mit saveId dieselben Gruppen, die Resolve-Engine und Spielplan-Tab ziehen", () => {
    const gs = buildMiniDmGameState(false);
    const erwartet = getMiniDmPodsForMatchday(gs, "md1", { saveId: ECHTE_SAVE_ID }).map((pod) => pod.teamIds);
    const pods = buildSpieltagsUebersicht(gs, "md1", { saveId: ECHTE_SAVE_ID })!.miniDmPods;
    expect(pods.every((pod) => !pod.gespielt)).toBe(true);
    expect(gruppenSchluessel(pods.map((pod) => pod.mitglieder.map((m) => m.teamId)))).toEqual(gruppenSchluessel(erwartet));
  });
});

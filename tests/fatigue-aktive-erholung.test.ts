/**
 * WER SPIELT, BEKOMMT AUCH ERHOLUNG — in einer 20-Spieltage-Battle-Saison, sonst nirgends.
 *
 * BEFUND (Designplan `docs/design/fatigue-saisonlaenge-plan.md`, B.2): Ein Spieler, der nie
 * rotiert wird, bekommt heute an KEINEM Spieltag Erholung — die Recovery-Schleife überspringt
 * Einsatz-Spieler. Seine Fatigue ist ein reiner Aufwärts-Ratchet `min(100, 16·n)` und steht nach
 * sieben Spieltagen an der Kappungsgrenze; bei zehn Spieltagen verbringt er die letzten drei
 * durchgehend im höchsten Risikoband. Das ist die im Code nachrechenbare Ursache von Chris'
 * „zweite Saisonhälfte = Verletzungswelle".
 *
 * DIE ÄNDERUNG (B.4): Die Erholung zerfällt in `MATCHDAY_ACTIVE_RECOVERY` (11, für alle) und
 * `MATCHDAY_BENCH_BONUS_RECOVERY` (17, nur für Bank/verletzt). Für Bank und Verletzte ist die
 * Summe bit-identisch zu heute; neu ist allein, dass der aktive Anteil auch dem gutgeschrieben
 * wird, der aufläuft.
 *
 * WAS DIESER TEST FESTHÄLT — die zwei Seiten der Auslieferung:
 *   1. Schalter AUS (Default): NICHTS ändert sich. Bank wie Einsatz rechnen auf die Nachkommastelle
 *      wie vor der Änderung. Das ist der Regressionsschutz für jeden bestehenden Spielstand.
 *   2. Schalter AN: die vier Fälle aus B.4, mit dem VERMESSENEN aktiven Anteil 4,5 statt der
 *      Plan-Zahl 11 — Einsatz normal +11,5, schonen +7,5, pushen +17,9, Bank −28.
 *   3. Ohne ENV entscheidet der Spielstand: AN nur in einer Battle-Saison mit 20 Spieltagen.
 *
 * Die absoluten Zahlen stehen hier bewusst NICHT als getippte Konstanten, sondern werden aus
 * `MATCHDAY_FATIGUE_LOAD`, `INTENSITY_FATIGUE_MULT` und `MATCHDAY_ACTIVE_RECOVERY` gerechnet —
 * Nachtunen (PR2) soll diesen Test nicht rot färben, ein still verschobener MECHANISMUS schon.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import type { MatchdayIntensityStage } from "@/lib/lineups/matchday-slot-roles";
import {
  applyFatigueAndInjuryAfterMatchday,
  BASE_MATCHDAY_RECOVERY,
  calculatePlayerRecovery,
  calculateTeamRecovery,
  getPlayerActiveRecoveryCredit,
  INTENSITY_FATIGUE_MULT,
  isFatigueActiveRecoveryEnabled,
  MATCHDAY_ACTIVE_RECOVERY,
  MATCHDAY_BENCH_BONUS_RECOVERY,
  MATCHDAY_FATIGUE_LOAD,
  projectMatchdayInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";

const FLAG = "OLY_FATIGUE_ACTIVE_RECOVERY";

function withFlag<T>(value: string | null, run: () => T): T {
  const previous = process.env[FLAG];
  if (value === null) {
    delete process.env[FLAG];
  } else {
    process.env[FLAG] = value;
  }
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = previous;
    }
  }
}

afterEach(() => {
  delete process.env[FLAG];
});

type StateOptions = {
  /** Fatigue des Spielers, der aufläuft. */
  usedFatigue?: number;
  /** Fatigue des Spielers, der auf der Bank sitzt. */
  benchFatigue?: number;
  intensity?: MatchdayIntensityStage;
  /** Ausbaustufe des Reha-Zentrums; ohne Angabe gar kein Gebäude (Basisfall). */
  recoveryCenterLevel?: number;
};

function createGameState(options: StateOptions = {}): GameState {
  const intensity = options.intensity ?? "normal";
  const draft: LineupDraft = {
    lineupId: "lineup-1",
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "md-1",
    teamId: "A-A",
    status: "submitted",
    entries: [
      {
        disciplineId: "tdm",
        disciplineSide: "d1",
        slotIndex: 1,
        playerId: "spieler-einsatz",
        activePlayerId: "active-spieler-einsatz",
      },
      {
        disciplineId: "tdm",
        disciplineSide: "d2",
        slotIndex: 1,
        playerId: "spieler-einsatz",
        activePlayerId: "active-spieler-einsatz",
      },
    ],
    modifiers: { d1: { intensity }, d2: { intensity } },
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
  } as unknown as LineupDraft;

  const player = (id: string, fatigue: number) => ({
    id,
    name: id,
    className: "Runner",
    race: "Human",
    marketValue: 10,
    salary: 2,
    fatigue,
    attributes: {},
    disciplineRatings: {},
  });

  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      matchdayIds: ["md-1", "md-2", "md-3"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      lineupDrafts: [draft],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
      teamFacilities:
        options.recoveryCenterLevel == null
          ? {}
          : {
              "A-A": {
                facilities: { recovery_center: { level: options.recoveryCenterLevel, enabled: true } },
              },
            },
    },
    matchdayState: {
      matchdayId: "md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      {
        teamId: "A-A",
        shortCode: "A-A",
        name: "Alpha",
        budget: 100,
        cash: 100,
        identityId: "identity-A",
        humanControlled: true,
        rosterLimit: 12,
      },
    ],
    teamIdentities: [],
    players: [
      player("spieler-einsatz", options.usedFatigue ?? 40),
      player("spieler-bank", options.benchFatigue ?? 40),
    ],
    disciplines: [],
    rosters: [
      { teamId: "A-A", playerId: "spieler-einsatz", role: "core", joinedSeasonId: "season-1" },
      { teamId: "A-A", playerId: "spieler-bank", role: "bench", joinedSeasonId: "season-1" },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-08-30T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 2,
      matchedRosterCount: 2,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

/** Ein ganzer Spieltag, gebucht wie im Spiel — und was er an den zwei Spielern verändert hat. */
function spielSpieltag(options: StateOptions = {}) {
  const gameState = createGameState(options);
  const result = applyFatigueAndInjuryAfterMatchday({
    gameState,
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "md-1",
    matchdayResultId: "result-1",
    timestamp: "2026-08-30T00:00:00.000Z",
  });
  const fatigueOf = (id: string) => result.gameState.players.find((entry) => entry.id === id)?.fatigue ?? null;
  return {
    result,
    einsatzVorher: options.usedFatigue ?? 40,
    bankVorher: options.benchFatigue ?? 40,
    einsatzNachher: fatigueOf("spieler-einsatz"),
    bankNachher: fatigueOf("spieler-bank"),
  };
}

const last = (intensity: MatchdayIntensityStage) => MATCHDAY_FATIGUE_LOAD * INTENSITY_FATIGUE_MULT[intensity];

describe("Die Zerlegung der Erholung", () => {
  it("aktiver Anteil plus Bank-Bonus ergibt exakt die bisherige Erholung", () => {
    // Das ist der Kern der Bit-Identität für Bank und Verletzte: an der SUMME wurde nichts gedreht,
    // sie hat nur zwei Namen bekommen. Gilt per Konstruktion auch, wenn OLY_FATIGUE_RECOVERY die
    // Basis verstellt — der Bank-Bonus ist abgeleitet, nicht getippt.
    expect(MATCHDAY_ACTIVE_RECOVERY + MATCHDAY_BENCH_BONUS_RECOVERY).toBe(BASE_MATCHDAY_RECOVERY);
  });

  it("trägt die VERMESSENEN Zahlen: 4,5 aktiv, 23,5 Bank-Bonus (Plan-Vorschlag war 11/17)", () => {
    // scripts/messe-erholungskorridor.ts, zwei Saatstämme: 4,5 hält eine 20-Spieltage-Saison bei
    // 159/154 Verletzungen (Chris' Korridor 150-200), 11 drückte sie auf 2.
    expect(MATCHDAY_ACTIVE_RECOVERY).toBe(4.5);
    expect(MATCHDAY_BENCH_BONUS_RECOVERY).toBe(23.5);
  });

  it("die Gebäude wirken auf BEIDE Teile, ohne die Bank-Erholung anzuheben", () => {
    // Ohne Gebäude: 28 = 11 + 17.
    const ohne = calculateTeamRecovery(createGameState(), "A-A");
    expect(ohne.normalRecovery).toBe(BASE_MATCHDAY_RECOVERY);
    expect(ohne.activeRecovery).toBe(MATCHDAY_ACTIVE_RECOVERY);
    expect(ohne.benchBonusRecovery).toBe(MATCHDAY_BENCH_BONUS_RECOVERY);

    // Voll ausgebaut: die GESAMTE Erholung ist die von vorher (28 + flacher Aufschlag), aber der
    // aktive Anteil wächst mit — Reha-Investment hilft jetzt auch dem, der spielt (Plan B.4).
    const ausgebaut = calculateTeamRecovery(createGameState({ recoveryCenterLevel: 5 }), "A-A");
    expect(ausgebaut.normalRecovery).toBeGreaterThan(ohne.normalRecovery);
    expect(ausgebaut.activeRecovery + ausgebaut.benchBonusRecovery).toBeCloseTo(ausgebaut.normalRecovery, 2);
    expect(ausgebaut.activeRecovery).toBeGreaterThan(ohne.activeRecovery);
    // Der Aufschlag wird ANTEILIG geteilt, nicht zweimal voll addiert — sonst risse die
    // Bank-Erholung den gebäudelosen Verletzungs-Korridor.
    // Präzision 3: der aktive Anteil wird auf zwei Nachkommastellen gerundet, das Verhältnis
    // trägt bei kleinen Werten (4,5 von 28) deshalb nur gut drei Stellen.
    expect(ausgebaut.activeRecovery / ausgebaut.normalRecovery).toBeCloseTo(
      MATCHDAY_ACTIVE_RECOVERY / BASE_MATCHDAY_RECOVERY,
      3,
    );
  });

  it("der Trainingsmodus multipliziert beide Teile mit", () => {
    const gameState = createGameState();
    const leicht = calculatePlayerRecovery(gameState, "A-A", "leicht");
    const mittel = calculatePlayerRecovery(gameState, "A-A", "mittel");
    expect(leicht.activeRecovery).toBeGreaterThan(mittel.activeRecovery);
    expect(leicht.activeRecovery + leicht.benchBonusRecovery).toBeCloseTo(leicht.normalRecovery, 2);
  });
});

describe("Schalter AUS (Default): der bestehende Spielstand rechnet unverändert weiter", () => {
  it("ist per Default aus", () => {
    expect(isFatigueActiveRecoveryEnabled()).toBe(false);
  });

  it("ein Einsatz kostet weiterhin die volle Last, ohne jede Gutschrift", () => {
    withFlag(null, () => {
      for (const intensity of ["conserve", "normal", "push"] as const) {
        const gespielt = spielSpieltag({ usedFatigue: 30, intensity });
        expect(gespielt.einsatzNachher).toBe(Number((30 + last(intensity)).toFixed(2)));
      }
    });
  });

  it("die Bank erholt sich weiterhin um die volle Basis-Erholung", () => {
    withFlag(null, () => {
      const gespielt = spielSpieltag({ benchFatigue: 60 });
      expect(gespielt.bankNachher).toBe(Number((60 - BASE_MATCHDAY_RECOVERY).toFixed(2)));
    });
  });

  it("die Gutschrift ist exakt 0 — und die Anzeige bleibt damit unangetastet", () => {
    withFlag(null, () => {
      const credit = getPlayerActiveRecoveryCredit(createGameState(), "A-A", "mittel");
      expect(credit).toBe(0);
      const projektion = projectMatchdayInjuryRisk({
        player: { traitsPositive: [], traitsNegative: [] },
        currentFatigue: 40,
        intensity: "normal",
        activeRecovery: credit,
      });
      expect(projektion.fatigueBeforeRoll).toBe(40 + MATCHDAY_FATIGUE_LOAD);
    });
  });
});

describe("Schalter AN: die vier Fälle, mit dem vermessenen Wert 4,5", () => {
  const netto = (intensity: MatchdayIntensityStage) =>
    Number((last(intensity) - MATCHDAY_ACTIVE_RECOVERY).toFixed(2));

  it("Einsatz normal: +11,5 netto statt +16", () => {
    withFlag("1", () => {
      const gespielt = spielSpieltag({ usedFatigue: 30, intensity: "normal" });
      expect(netto("normal")).toBe(11.5);
      expect(gespielt.einsatzNachher).toBe(30 + 11.5);
    });
  });

  it("Einsatz schonen: +7,5 netto", () => {
    withFlag("1", () => {
      const gespielt = spielSpieltag({ usedFatigue: 30, intensity: "conserve" });
      expect(netto("conserve")).toBe(7.5);
      expect(gespielt.einsatzNachher).toBe(30 + 7.5);
    });
  });

  it("Einsatz pushen: +17,9 netto — Pushen bleibt spürbar riskanter", () => {
    withFlag("1", () => {
      const gespielt = spielSpieltag({ usedFatigue: 30, intensity: "push" });
      expect(netto("push")).toBeCloseTo(17.9, 2);
      expect(gespielt.einsatzNachher).toBeCloseTo(47.9, 2);
    });
  });

  it("Bank bleibt bei −28 — an der Rotationsbelohnung ändert sich NICHTS", () => {
    withFlag("1", () => {
      const gespielt = spielSpieltag({ benchFatigue: 60 });
      expect(gespielt.bankNachher).toBe(Number((60 - BASE_MATCHDAY_RECOVERY).toFixed(2)));
    });
  });

  it("Rotation bleibt das stärkste Werkzeug: ein Bank-Spieltag tilgt mehr als zwei Einsätze", () => {
    withFlag("1", () => {
      expect(BASE_MATCHDAY_RECOVERY / netto("normal")).toBeGreaterThan(2);
    });
  });
});

describe("Schalter AN: die Kappungsgrenze kommt später", () => {
  it("ein Dauerstarter erreicht 100 nach 9 statt nach 7 Spieltagen", () => {
    withFlag("1", () => {
      const nettoNormal = last("normal") - MATCHDAY_ACTIVE_RECOVERY;
      const spieltageBisKappung = Math.ceil(100 / nettoNormal);
      const heute = Math.ceil(100 / last("normal"));
      expect(heute).toBe(7);
      expect(spieltageBisKappung).toBe(9);
    });
  });

  it("der Verletzungswurf misst gegen die NETTO-Fatigue, nicht gegen die rohe Last", () => {
    withFlag("1", () => {
      // Anzeige und Wurf müssen dieselbe Zahl sehen (siehe projectMatchdayInjuryRisk): sonst zeigt
      // die Einsatzliste eine Last, die so nie gebucht wird.
      const projektion = projectMatchdayInjuryRisk({
        player: { traitsPositive: [], traitsNegative: [] },
        currentFatigue: 30,
        intensity: "normal",
        activeRecovery: getPlayerActiveRecoveryCredit(createGameState(), "A-A", "mittel"),
      });
      expect(projektion.activeRecovery).toBe(MATCHDAY_ACTIVE_RECOVERY);
      expect(projektion.fatigueBeforeRoll).toBe(41.5);

      const gespielt = spielSpieltag({ usedFatigue: 30, intensity: "normal" });
      expect(gespielt.result.injuryEvents[0]?.fatigueBefore).toBe(projektion.fatigueBeforeRoll);
    });
  });
});

/**
 * DAS GATE — wo die aktive Erholung ohne ENV greift. Nur in einer Battle-Saison mit 20 Spieltagen
 * (`isDoubledBattleSeason`). Jeder Manager-Spielstand und jede 10-Spieltage-Battle-Saison bleibt
 * unberührt — insbesondere Chris' laufender Manager-Save auf dem Server.
 */
describe("Ohne ENV entscheidet der Spielstand", () => {
  const disziplinen = Array.from({ length: 20 }, (_, index) => ({
    id: `d-${index}`,
    name: `D${index}`,
    category: (["power", "speed", "mental", "social"] as const)[index % 4],
    weight: 1,
  }));
  const stand = (gameMode: "battle" | "manager" | null, spieltage: number) =>
    ({
      ...createGameState({ usedFatigue: 30 }),
      ...(gameMode ? { scenarioMeta: { gameMode } } : {}),
      disciplines: disziplinen,
      season: {
        id: "season-1",
        name: "Season 1",
        year: 1,
        currentMatchday: 1,
        matchdayIds: ["md-1", ...Array.from({ length: spieltage - 1 }, (_, index) => `md-${index + 2}`)],
      },
    }) as unknown as GameState;

  it("Battle Mode mit 20 Spieltagen: AN", () => {
    withFlag(null, () => {
      expect(isFatigueActiveRecoveryEnabled(stand("battle", 20))).toBe(true);
      const gespielt = applyFatigueAndInjuryAfterMatchday({
        gameState: stand("battle", 20),
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "md-1",
        matchdayResultId: "result-1",
        timestamp: "2026-08-30T00:00:00.000Z",
      });
      const einsatz = gespielt.gameState.players.find((entry) => entry.id === "spieler-einsatz")?.fatigue;
      expect(einsatz).toBe(30 + last("normal") - MATCHDAY_ACTIVE_RECOVERY);
    });
  });

  it("Battle Mode mit 10 Spieltagen (Alt-Save, laufende Saison): AUS", () => {
    withFlag(null, () => {
      expect(isFatigueActiveRecoveryEnabled(stand("battle", 10))).toBe(false);
    });
  });

  it("Manager Mode — egal wie lang die Saison ist: AUS", () => {
    withFlag(null, () => {
      expect(isFatigueActiveRecoveryEnabled(stand("manager", 10))).toBe(false);
      expect(isFatigueActiveRecoveryEnabled(stand("manager", 20))).toBe(false);
      expect(isFatigueActiveRecoveryEnabled(stand(null, 20))).toBe(false);
      const gespielt = applyFatigueAndInjuryAfterMatchday({
        gameState: stand("manager", 10),
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "md-1",
        matchdayResultId: "result-1",
        timestamp: "2026-08-30T00:00:00.000Z",
      });
      const einsatz = gespielt.gameState.players.find((entry) => entry.id === "spieler-einsatz")?.fatigue;
      expect(einsatz).toBe(30 + last("normal"));
    });
  });

  it("ENV „0“ erzwingt AUS auch in der Doppelsaison, „1“ erzwingt AN überall", () => {
    withFlag("0", () => {
      expect(isFatigueActiveRecoveryEnabled(stand("battle", 20))).toBe(false);
    });
    withFlag("1", () => {
      expect(isFatigueActiveRecoveryEnabled(stand("manager", 10))).toBe(true);
    });
  });
});

describe("Schalter AN: die Wiederholung desselben Spieltags bleibt idempotent", () => {
  it("ein forceReplace-Re-Apply kommt auf denselben Stand wie der erste Apply", () => {
    withFlag("1", () => {
      const gameState = createGameState({ usedFatigue: 40, benchFatigue: 55 });
      const ersterLauf = applyFatigueAndInjuryAfterMatchday({
        gameState,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "md-1",
        matchdayResultId: "result-1",
        timestamp: "2026-08-30T00:00:00.000Z",
      });
      const zweiterLauf = applyFatigueAndInjuryAfterMatchday({
        gameState: ersterLauf.gameState,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "md-1",
        matchdayResultId: "result-1",
        timestamp: "2026-08-30T00:00:00.000Z",
        isMatchdayReplay: true,
      });
      const fatigueOf = (state: typeof ersterLauf.gameState, id: string) =>
        state.players.find((entry) => entry.id === id)?.fatigue ?? null;

      expect(fatigueOf(zweiterLauf.gameState, "spieler-einsatz")).toBe(
        fatigueOf(ersterLauf.gameState, "spieler-einsatz"),
      );
      expect(fatigueOf(zweiterLauf.gameState, "spieler-bank")).toBe(
        fatigueOf(ersterLauf.gameState, "spieler-bank"),
      );
      expect(zweiterLauf.injuryEvents[0]?.fatigueBefore).toBe(ersterLauf.injuryEvents[0]?.fatigueBefore);
    });
  });
});

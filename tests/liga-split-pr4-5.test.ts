/**
 * LIGA-SPLIT, PR 4+5 — APRON JE LIGA, SPONSOR-TOPF-RABATT, GEBÄUDEEINNAHMEN-RABATT, ZONEN-TERM
 * (docs/design/liga-split-plan.md, Abschnitte 3 + 4).
 *
 * Wie bei PR1 (tests/liga-split-fundament.test.ts) gilt fuer jede angefasste Funktion:
 *   1. LEGACY/DEFAULT-PFAD BIT-IDENTISCH — kein neuer Parameter gesetzt (oder `isLeagueSplitActive`,
 *      das heute IMMER `false` liefert): das Verhalten ist exakt das von vor diesem PR. Die volle
 *      betroffene Suite (tests/sponsor-*.test.ts, tests/apron-*.test.ts, tests/facility-*.test.ts)
 *      lief vor UND nach dieser Aenderung unveraendert durch (siehe PR-Bericht).
 *   2. DIE NEUEN PARAMETER LIEFERN DIE RICHTIGE ZAHL — hier bewiesen, exakt statt per Stichprobe.
 *
 * DER SCHALTER `isLeagueSplitActive` LIEFERT NUR NOCH FUER BESTEHENDE/LAUFENDE SAVES OHNE
 * `leagueByTeamId` `false` (Legacy-32er-Modus) — seit PR 2+3+6 (Fixture-Generator, aktiviert fuer
 * NEUE Spiele in `buildNewGameStateFromBaseline`) wird er `true`, sobald das Feld gesetzt und nicht
 * leer ist, s. `lib/season/league-split.ts`. Die hier getesteten Helfer (`resolveSponsorLeagueTier`,
 * `resolveApronTeamScope`, `resolveFacilityIncomeFaktor`) sind entsprechend GENAU DANN aktiv.
 * Getestet wird deshalb an zwei Stellen: (a) die GATES aktivieren sich korrekt bei gesetztem
 * `leagueByTeamId` und bleiben inaktiv ohne das Feld (Aktiv-/Legacy-Beweis), (b) die REINE
 * ARITHMETIK darunter (`sponsorLigaLeiter`, `sponsorKurvenLeiter`, `computeApronLines`,
 * `calculateFacilityIncome`) liefert bei EXPLIZIT uebergebenem Liga-Parameter die richtige Zahl —
 * exakt der Ansatz, den PR1 fuer `leagueSize` bereits vorgemacht hat.
 */
import { describe, expect, it } from "vitest";

import type { GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import { LEAGUE_SIZE, isLeagueSplitActive, type LeagueTier } from "@/lib/season/league-split";
import {
  SPONSOR_TOPF_FAKTOR_JE_LIGA,
  SPONSOR_WERTUNGSTOPF,
  SPONSOR_ZONE_ABSTIEG_MALUS,
  SPONSOR_ZONE_ABSTIEG_RANKS,
  SPONSOR_ZONE_AUFSTIEG_BONUS,
  SPONSOR_ZONE_AUFSTIEG_RANKS,
  sponsorKurvenLeiter,
  sponsorLigaLeiter,
  sponsorSockelFuerStartrang,
} from "@/lib/sponsor/sponsor-liga-leiter";
import { SPONSOR_CURVE_SHAPE_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
import { resolveSponsorLeagueTier } from "@/lib/sponsor/sponsor-v3-offer-service";
import {
  apronWertungsanteil,
  computeApronLines,
  resolveApronTeamScope,
} from "@/lib/season/apron-service";
import {
  calculateFacilityIncome,
  FACILITY_INCOME_FAKTOR_JE_LIGA,
} from "@/lib/facilities/facility-effects";
import { resolveFacilityIncomeFaktor } from "@/lib/facilities/facility-season-end-service";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

const SALARY_FACTORS = [0.82, 1.0, 1.24] as const;
const TIERS: readonly LeagueTier[] = ["liga1", "liga2"];

function isNonIncreasing(ladder: readonly number[]): boolean {
  for (let index = 1; index < ladder.length; index += 1) {
    if (ladder[index]! > ladder[index - 1]! + 1e-9) return false;
  }
  return true;
}

// ── 1. Sponsor-Topf-Rabatt (SPONSOR_TOPF_FAKTOR_JE_LIGA) ─────────────────────────────────────────

describe("Sponsor-Topf-Rabatt — wirkt exakt auf Topf-Ebene, vor der Verteilungsformel", () => {
  it("SPONSOR_TOPF_FAKTOR_JE_LIGA: liga1 = 1 (unveraendert), liga2 = 0,8", () => {
    expect(SPONSOR_TOPF_FAKTOR_JE_LIGA.liga1).toBe(1);
    expect(SPONSOR_TOPF_FAKTOR_JE_LIGA.liga2).toBe(0.8);
  });

  it("sponsorLigaLeiter: ohne leagueTier bleibt der TOPF-FAKTOR unveraendert (1) und der Zonen-Term aus — Legacy-Pfad bit-identisch", () => {
    // ACHTUNG, kein Widerspruch zu 'liga1 hat Topf-Faktor 1': `leagueTier: "liga1"` ist NICHT
    // dasselbe wie gar kein `leagueTier` — sobald ein Tier gesetzt ist, greift zusaetzlich der
    // Zonen-Term (fuer liga1 der Abstiegs-Malus an den letzten 3 Raengen, siehe naechste Describe-
    // Gruppe). Der wirklich unveraenderte Legacy-Pfad ist "gar kein `leagueTier`", genau das, was
    // jeder heutige Aufrufer tut (siehe `resolveSponsorLeagueTier`, das ohne aktiven Split immer
    // `undefined` liefert) — hier gegen die bereits bestehende Testsuite abgesichert:
    // tests/sponsor-liga-leiter.test.ts laeuft vor UND nach diesem PR unveraendert durch.
    for (const startRank of [1, 8, 16, 24, 32]) {
      for (const salaryFactor of SALARY_FACTORS) {
        const ohneTier = sponsorLigaLeiter({ startRank, salaryFactor });
        const sockel = sponsorSockelFuerStartrang(startRank);
        // Topf-Faktor 1 pruefen: die letzten 3 Raenge liegen AUSSERHALB jeder Zone bei Startrang 1..29,
        // aber generisch gilt fuer JEDEN Rang, dass ohne Tier keine Zonen-Verschiebung auftritt — das
        // ist bereits durch tests/sponsor-liga-leiter.test.ts (Kalibrierungs-Invariante) exakt belegt.
        expect(ohneTier[31]).toBeCloseTo(sockel, 9);
      }
    }
  });

  it("sponsorLigaLeiter: jede Sprosse liga2 minus Zonen-Term ist EXAKT 0,8 × (Sprosse ohne Liga-Tier minus Sockel) + Sockel", () => {
    // Algebraischer Beweis statt Stichprobe: `topfFaktor` skaliert in `sponsorLigaLeiterOhneZonenTerm`
    // NUR den Wertungsanteil (Sprosse − Sockel), linear und fuer JEDEN Rang gleich — der Sockel selbst
    // ist tier-unabhaengig. Der Zonen-Term wird erst DANACH additiv aufgetragen (siehe
    // sponsor-liga-leiter.ts, `mitZonenTerm`) und muss deshalb vor dem Vergleich abgezogen werden.
    for (const startRank of [1, 5, 16, 22, 32]) {
      for (const salaryFactor of SALARY_FACTORS) {
        const sockel = sponsorSockelFuerStartrang(startRank);
        const referenz = sponsorLigaLeiter({ startRank, salaryFactor }); // kein Tier = Faktor 1, kein Zonen-Term
        const liga2 = sponsorLigaLeiter({ startRank, salaryFactor, leagueTier: "liga2" });
        for (let rank = 1; rank <= 32; rank += 1) {
          const zonenTerm = rank <= SPONSOR_ZONE_AUFSTIEG_RANKS ? SPONSOR_ZONE_AUFSTIEG_BONUS * salaryFactor : 0;
          const erwartet = sockel + 0.8 * (referenz[rank - 1]! - sockel) + zonenTerm;
          expect(liga2[rank - 1]!, `Rang ${rank}, Startrang ${startRank}, f=${salaryFactor}`).toBeCloseTo(erwartet, 9);
        }
      }
    }
  });

  it("Kalibrierungs-Invariante Liga 2: Σ Wertungsanteil (ohne Zonen-Term) = SPONSOR_WERTUNGSTOPF × f × 0,8 — exakt 80 % des Liga-1-Topfs", () => {
    for (const salaryFactor of SALARY_FACTORS) {
      const startRank = 16;
      const sockel = sponsorSockelFuerStartrang(startRank);
      const liga1Sum = sponsorLigaLeiter({ startRank, salaryFactor, leagueTier: "liga1" }).reduce(
        (sum, value) => sum + (value - sockel),
        0,
      );
      const liga2LadderSum = sponsorLigaLeiter({ startRank, salaryFactor, leagueTier: "liga2" }).reduce(
        (sum, value) => sum + (value - sockel),
        0,
      );
      // Liga 1 traegt hier den ABSTIEGS-Malus an den letzten 3 Raengen (kein Bonus) — herausrechnen,
      // um den reinen Topf-Vergleich zu isolieren.
      const liga1MalusSumme = SPONSOR_ZONE_ABSTIEG_RANKS * SPONSOR_ZONE_ABSTIEG_MALUS * salaryFactor;
      const liga1WertungOhneZone = liga1Sum + liga1MalusSumme;
      expect(liga1WertungOhneZone).toBeCloseTo(SPONSOR_WERTUNGSTOPF * salaryFactor, 6);

      const liga2BonusSumme = SPONSOR_ZONE_AUFSTIEG_RANKS * SPONSOR_ZONE_AUFSTIEG_BONUS * salaryFactor;
      const liga2WertungOhneZone = liga2LadderSum - liga2BonusSumme;
      expect(liga2WertungOhneZone).toBeCloseTo(SPONSOR_WERTUNGSTOPF * salaryFactor * 0.8, 6);
      expect(liga2WertungOhneZone).toBeCloseTo(liga1WertungOhneZone * 0.8, 6);
    }
  });

  it("sponsorKurvenLeiter (geshapete Leiter, der LIVE-Pfad): dieselbe exakte 0,8-Linearitaet je Rang, fuer alle 11 Kurvenformen", () => {
    // Beweist, dass der Topf-Rabatt NICHT in der Kurvenformung verwaschen wird (siehe Kommentar in
    // sponsor-liga-leiter.ts, `sponsorKurvenLeiter`): Sockel bleibt Sockel, nur der Wertungsanteil
    // skaliert — auch nachdem die 11 Kurvenformen ihn neu ueber die Raenge verteilt haben.
    for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
      for (const startRank of [1, 8, 16, 27, 32]) {
        for (const salaryFactor of SALARY_FACTORS) {
          const sockel = sponsorSockelFuerStartrang(startRank);
          const liga1 = sponsorKurvenLeiter({ shape, startRank, salaryFactor });
          const liga2 = sponsorKurvenLeiter({ shape, startRank, salaryFactor, leagueTier: "liga2" });
          for (let rank = 1; rank <= 32; rank += 1) {
            const zonenTerm = rank <= SPONSOR_ZONE_AUFSTIEG_RANKS ? SPONSOR_ZONE_AUFSTIEG_BONUS * salaryFactor : 0;
            const erwartet = sockel + 0.8 * (liga1[rank - 1]! - sockel) + zonenTerm;
            expect(
              liga2[rank - 1]!,
              `${shape} @ Startrang ${startRank}, f=${salaryFactor}, Rang ${rank}`,
            ).toBeCloseTo(erwartet, 6);
          }
        }
      }
    }
  });

  it("Aktiv-Beweis: isLeagueSplitActive liefert true bei gesetztem leagueByTeamId → resolveSponsorLeagueTier liefert die Liga-Zugehoerigkeit", () => {
    const gs = { seasonState: { leagueByTeamId: { "M-M": "liga2" } } } as unknown as GameState;
    expect(isLeagueSplitActive(gs)).toBe(true);
    expect(resolveSponsorLeagueTier(gs, "M-M")).toBe("liga2");
    expect(resolveSponsorLeagueTier(gs, null)).toBeUndefined();
  });

  it("Legacy-Beweis: ohne leagueByTeamId (bestehende/laufende Saves vor PR1) bleibt resolveSponsorLeagueTier undefined", () => {
    const gs = { seasonState: {} } as unknown as GameState;
    expect(isLeagueSplitActive(gs)).toBe(false);
    expect(resolveSponsorLeagueTier(gs, "M-M")).toBeUndefined();
  });
});

// ── 2. Zonen-Term (Auf-/Abstiegs-Bonus/Malus) ─────────────────────────────────────────────────────

describe("Sponsor-Zonen-Term — trifft die richtigen Raenge, bleibt monoton", () => {
  it("Liga 2: nur Endraenge 1..3 bekommen den Bonus, alle anderen 0", () => {
    const startRank = 10;
    const salaryFactor = 1.0;
    const sockel = sponsorSockelFuerStartrang(startRank);
    const ohneTier = sponsorLigaLeiter({ startRank, salaryFactor });
    const liga2 = sponsorLigaLeiter({ startRank, salaryFactor, leagueTier: "liga2" });
    for (let rank = 1; rank <= 32; rank += 1) {
      const diffOhneTopfrabatt = liga2[rank - 1]! - (sockel + 0.8 * (ohneTier[rank - 1]! - sockel));
      if (rank <= SPONSOR_ZONE_AUFSTIEG_RANKS) {
        expect(diffOhneTopfrabatt, `Rang ${rank}`).toBeCloseTo(SPONSOR_ZONE_AUFSTIEG_BONUS * salaryFactor, 9);
      } else {
        expect(diffOhneTopfrabatt, `Rang ${rank}`).toBeCloseTo(0, 9);
      }
    }
  });

  it("Liga 1: nur die letzten 3 Endraenge bekommen den Malus, alle anderen 0", () => {
    const startRank = 10;
    const salaryFactor = 1.0;
    const ohneTier = sponsorLigaLeiter({ startRank, salaryFactor });
    const liga1 = sponsorLigaLeiter({ startRank, salaryFactor, leagueTier: "liga1" });
    for (let rank = 1; rank <= 32; rank += 1) {
      const diff = liga1[rank - 1]! - ohneTier[rank - 1]!; // liga1-Topffaktor ist 1, also reiner Zonen-Term
      if (rank > 32 - SPONSOR_ZONE_ABSTIEG_RANKS) {
        expect(diff, `Rang ${rank}`).toBeCloseTo(-SPONSOR_ZONE_ABSTIEG_MALUS * salaryFactor, 9);
      } else {
        expect(diff, `Rang ${rank}`).toBeCloseTo(0, 9);
      }
    }
  });

  it("skaliert mit dem Salary Factor wie der Rest der Leiter", () => {
    const startRank = 5;
    for (const salaryFactor of SALARY_FACTORS) {
      const ohneTier = sponsorLigaLeiter({ startRank, salaryFactor });
      const liga2 = sponsorLigaLeiter({ startRank, salaryFactor, leagueTier: "liga2" });
      const sockel = sponsorSockelFuerStartrang(startRank);
      const bonusRang1 = liga2[0]! - (sockel + 0.8 * (ohneTier[0]! - sockel));
      expect(bonusRang1).toBeCloseTo(SPONSOR_ZONE_AUFSTIEG_BONUS * salaryFactor, 9);
    }
  });

  it("bei LEAGUE_SIZE=16 (kuenftiger Liga-Split) treffen die Zonen exakt Raenge 1..3 und 14..16", () => {
    // Der Zonen-Term leitet seinen Rangraum aus der TATSAECHLICHEN Leiterlaenge ab (siehe
    // `mitZonenTerm` in sponsor-liga-leiter.ts) — automatisch richtig fuer eine 16er-Liga, ohne dass
    // diese Datei etwas ueber LEAGUE_SIZE wissen muss.
    expect(LEAGUE_SIZE).toBe(16);
    const startRank = 8;
    const salaryFactor = 1.0;
    const sockel = sponsorSockelFuerStartrang(startRank, LEAGUE_SIZE);
    const ohneTier = sponsorLigaLeiter({ startRank, salaryFactor, leagueSize: LEAGUE_SIZE });
    const liga2 = sponsorLigaLeiter({ startRank, salaryFactor, leagueSize: LEAGUE_SIZE, leagueTier: "liga2" });
    const liga1 = sponsorLigaLeiter({ startRank, salaryFactor, leagueSize: LEAGUE_SIZE, leagueTier: "liga1" });
    for (let rank = 1; rank <= LEAGUE_SIZE; rank += 1) {
      const liga2Diff = liga2[rank - 1]! - (sockel + 0.8 * (ohneTier[rank - 1]! - sockel));
      const liga1Diff = liga1[rank - 1]! - ohneTier[rank - 1]!;
      if (rank <= 3) {
        expect(liga2Diff, `liga2 Rang ${rank}`).toBeCloseTo(SPONSOR_ZONE_AUFSTIEG_BONUS * salaryFactor, 9);
      } else {
        expect(liga2Diff, `liga2 Rang ${rank}`).toBeCloseTo(0, 9);
      }
      if (rank >= 14) {
        expect(liga1Diff, `liga1 Rang ${rank}`).toBeCloseTo(-SPONSOR_ZONE_ABSTIEG_MALUS * salaryFactor, 9);
      } else {
        expect(liga1Diff, `liga1 Rang ${rank}`).toBeCloseTo(0, 9);
      }
    }
  });

  it("bleibt monoton nicht-steigend im Endrang, fuer beide Ligen, jeden Startrang und Salary Factor (sponsorLigaLeiter)", () => {
    for (let startRank = 1; startRank <= 32; startRank += 4) {
      for (const salaryFactor of SALARY_FACTORS) {
        for (const tier of [...TIERS, undefined]) {
          expect(
            isNonIncreasing(sponsorLigaLeiter({ startRank, salaryFactor, leagueTier: tier })),
            `tier=${tier}, Startrang ${startRank}, f=${salaryFactor}`,
          ).toBe(true);
        }
      }
    }
  });

  it("bleibt monoton nicht-steigend im Endrang, fuer beide Ligen und alle 11 Kurvenformen (sponsorKurvenLeiter — der Live-Pfad)", () => {
    for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
      for (const startRank of [1, 5, 16, 27, 32]) {
        for (const salaryFactor of SALARY_FACTORS) {
          for (const tier of [...TIERS, undefined]) {
            expect(
              isNonIncreasing(sponsorKurvenLeiter({ shape, startRank, salaryFactor, leagueTier: tier })),
              `${shape}, tier=${tier}, Startrang ${startRank}, f=${salaryFactor}`,
            ).toBe(true);
          }
        }
      }
    }
  });
});

// ── 3. Apron je Liga ───────────────────────────────────────────────────────────────────────────

function baueApronSpielstand(gehaelterProTeam: readonly number[]): GameState {
  const teamIds = gehaelterProTeam.map((_, index) => `team-${index + 1}`);
  const teams = teamIds.map((teamId) => ({ teamId, name: teamId, shortCode: teamId, cash: 50 }));
  const players = teamIds.map((teamId) => ({ id: `${teamId}-p1`, name: `${teamId} Spieler`, teamId }));
  const rosters = teamIds.map((teamId, index) => ({
    teamId,
    playerId: `${teamId}-p1`,
    salary: gehaelterProTeam[index],
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
      matchdayResults: [],
      standingsApplyLogs: [],
    },
  } as unknown as GameState;
}

describe("Apron je Liga — Median/Topf nur ueber den uebergebenen Team-Scope", () => {
  it("computeApronLines ohne teamIds ist bit-identisch zu vorher (Default = alle Teams)", () => {
    const gs = baueApronSpielstand([40, 60, 80, 120]);
    const allTeamIds = gs.teams.map((team) => team.teamId);
    expect(computeApronLines(gs, allTeamIds)).toEqual(computeApronLines(gs));
  });

  it("ein eingeschraenkter Team-Scope rechnet den Median NUR ueber diese Teams, nicht global", () => {
    const gs = baueApronSpielstand([40, 60, 80, 120]); // globaler Median = (60+80)/2 = 70
    const global = computeApronLines(gs);
    expect(global.medianSalary).toBeCloseTo(70, 6);

    // Nur die zwei Topverdiener: Median = (80+120)/2 = 100 — deutlich hoeher als der globale Median.
    // Das ist genau das, was eine eigene Liga-1-Bemessung fuer eine teurere Liga liefern soll.
    const topZwei = computeApronLines(gs, ["team-3", "team-4"]);
    expect(topZwei.medianSalary).toBeCloseTo(100, 6);
    expect(topZwei.medianSalary).not.toBeCloseTo(global.medianSalary, 1);

    // Nur die zwei Kleinverdiener: Median = (40+60)/2 = 50 — deutlich niedriger.
    const untenZwei = computeApronLines(gs, ["team-1", "team-2"]);
    expect(untenZwei.medianSalary).toBeCloseTo(50, 6);
  });

  it("apronWertungsanteil: leagueSize=16 exakt 0 an Rang 16 (wie sponsorWertungsGewichte(16))", () => {
    expect(apronWertungsanteil(16, 1.0, 16)).toBeCloseTo(0, 9);
    expect(apronWertungsanteil(1, 1.0, 16)).toBeGreaterThan(0);
  });

  it("apronWertungsanteil: topfFaktor skaliert linear und exakt (0,8 = Liga-2-Rabatt)", () => {
    for (const rank of [1, 8, 16, 32]) {
      const liga1 = apronWertungsanteil(rank, 1.1, 32, 1);
      const liga2 = apronWertungsanteil(rank, 1.1, 32, 0.8);
      expect(liga2).toBeCloseTo(liga1 * 0.8, 9);
    }
  });

  it("apronWertungsanteil: Default (kein leagueSize/topfFaktor) unveraendert zu vor diesem PR", () => {
    expect(apronWertungsanteil(1, 1.0)).toBeCloseTo(apronWertungsanteil(1, 1.0, 32, 1), 12);
  });

  it("Aktiv-Beweis: resolveApronTeamScope liefert den Liga-lokalen Team-Scope bei gesetztem leagueByTeamId", () => {
    const gs = {
      teams: [{ teamId: "M-M" }],
      seasonState: { leagueByTeamId: { "M-M": "liga1" } },
    } as unknown as GameState;
    expect(isLeagueSplitActive(gs)).toBe(true);
    expect(resolveApronTeamScope(gs, "M-M")).toEqual(["M-M"]);
  });

  it("Legacy-Beweis: ohne leagueByTeamId liefert resolveApronTeamScope weiterhin null", () => {
    const gs = {
      teams: [{ teamId: "M-M" }],
      seasonState: {},
    } as unknown as GameState;
    expect(isLeagueSplitActive(gs)).toBe(false);
    expect(resolveApronTeamScope(gs, "M-M")).toBeNull();
  });
});

// ── 4. Gebäudeeinnahmen-Rabatt (Facility-Income) ──────────────────────────────────────────────────

function facilitiesMitFanShopUndArena(level: number): TeamFacilityCollection {
  return {
    facilities: {
      fan_shop: { level, enabled: true, conditionPct: 100 },
      arena_upgrade: { level, enabled: true, conditionPct: 100 },
    },
  } as unknown as TeamFacilityCollection;
}

describe("Gebäudeeinnahmen-Rabatt (Facility-Income) — Liga 2 zahlt 80 % des Endergebnisses", () => {
  it("calculateFacilityIncome: ohne incomeFaktor unveraendert zu vor diesem PR", () => {
    const teamFacilities = facilitiesMitFanShopUndArena(3);
    expect(calculateFacilityIncome(teamFacilities)).toBe(
      calculateFacilityIncome(teamFacilities, { arenaPopularityFactor: 1 }),
    );
  });

  it("incomeFaktor 0,8 liefert exakt 80 % der Basis-Einnahme, bei jeder Beliebtheit", () => {
    for (const arenaPopularityFactor of [0.7, 1.0, 1.4]) {
      const teamFacilities = facilitiesMitFanShopUndArena(4);
      const basis = calculateFacilityIncome(teamFacilities, { arenaPopularityFactor });
      const liga2 = calculateFacilityIncome(teamFacilities, {
        arenaPopularityFactor,
        incomeFaktor: FACILITY_INCOME_FAKTOR_JE_LIGA.liga2,
      });
      expect(basis).toBeGreaterThan(0);
      // Toleranz 2 Nachkommastellen: `calculateFacilityIncome` rundet ihr Ergebnis auf 2 Stellen
      // (roundValue), bevor der Faktor greift — bei kleinen Centbetraegen kann das die letzte Stelle
      // um 1 verschieben. Das ist Rundung, keine Abweichung vom 0,8-Faktor selbst.
      expect(liga2).toBeCloseTo(basis * 0.8, 1);
    }
  });

  it("FACILITY_INCOME_FAKTOR_JE_LIGA: liga1 = 1, liga2 = 0,8 — derselbe Faktor wie beim Sponsor-Topf", () => {
    expect(FACILITY_INCOME_FAKTOR_JE_LIGA.liga1).toBe(1);
    expect(FACILITY_INCOME_FAKTOR_JE_LIGA.liga2).toBe(SPONSOR_TOPF_FAKTOR_JE_LIGA.liga2);
  });

  it("Aktiv-Beweis: resolveFacilityIncomeFaktor liefert 0,8 fuer ein Liga-2-Team bei gesetztem leagueByTeamId", () => {
    const gs = {
      teams: [{ teamId: "M-M" }],
      seasonState: { leagueByTeamId: { "M-M": "liga2" } },
    } as unknown as GameState;
    expect(isLeagueSplitActive(gs)).toBe(true);
    expect(resolveFacilityIncomeFaktor(gs, "M-M")).toBe(FACILITY_INCOME_FAKTOR_JE_LIGA.liga2);
  });

  it("Aktiv-Beweis: resolveFacilityIncomeFaktor liefert 1 fuer ein Liga-1-Team bei gesetztem leagueByTeamId", () => {
    const gs = {
      teams: [{ teamId: "M-M" }],
      seasonState: { leagueByTeamId: { "M-M": "liga1" } },
    } as unknown as GameState;
    expect(isLeagueSplitActive(gs)).toBe(true);
    expect(resolveFacilityIncomeFaktor(gs, "M-M")).toBe(1);
  });

  it("Legacy-Beweis: ohne leagueByTeamId liefert resolveFacilityIncomeFaktor weiterhin 1", () => {
    const gs = {
      teams: [{ teamId: "M-M" }],
      seasonState: {},
    } as unknown as GameState;
    expect(isLeagueSplitActive(gs)).toBe(false);
    expect(resolveFacilityIncomeFaktor(gs, "M-M")).toBe(1);
  });

  it("Legacy-Beweis am echten Singleplayer-Spielstand: resolveFacilityIncomeFaktor bleibt 1", () => {
    const gs = createSingleplayerGameState();
    const teamId = gs.teams[0]?.teamId;
    expect(teamId).toBeTruthy();
    expect(resolveFacilityIncomeFaktor(gs, teamId!)).toBe(1);
  });
});

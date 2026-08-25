/**
 * LIGA-SPLIT, PR 1 — FUNDAMENT & RANGRAUM-PARAMETRISIERUNG (docs/design/liga-split-plan.md, Abschnitt 9).
 *
 * Diese Datei prueft zwei Dinge fuer JEDE in diesem PR angefasste Funktion:
 *   1. DEFAULT-VERHALTEN UNVERAENDERT — der Aufruf ohne den neuen Parameter (oder mit dem alten
 *      32er-Wert) liefert BIT-GENAU dasselbe wie vor der Parametrisierung. Das ist die harte
 *      Anforderung aus dem PR-Auftrag: kein bestehendes Verhalten darf sich aendern.
 *   2. DIE 16ER-VERSION LIEFERT SINNVOLLE WERTE — mit `LEAGUE_SIZE = 16` (lib/season/league-split.ts)
 *      statt der heutigen 32, fuer den spaeteren Liga-Split (noch nicht aktiviert, siehe
 *      `isLeagueSplitActive`).
 *
 * Die bestehenden Testdateien (tests/sponsor-*.test.ts) laufen unveraendert weiter und decken den
 * Default-Pfad bereits vollstaendig ab (vor/nach dieser PR liefert die volle betroffene Suite
 * identische Ergebnisse) — diese Datei ergaenzt die gezielten Bit-Identitaets- und 16er-Tests je
 * geaenderter Funktion, die die bestehenden Dateien nicht extra formulieren.
 */
import { describe, expect, it } from "vitest";

import { loadSourceTeams } from "@/lib/data/dataAdapter";
import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import {
  LEAGUE_SIZE,
  RELEGATION_COUNT,
  TEAM_COUNT_TOTAL,
  buildInitialLeagueAssignment,
  getLeagueOf,
  getLeagueTeamIds,
  isLeagueSplitActive,
} from "@/lib/season/league-split";
import {
  SPONSOR_V3_ANCHOR_SIGMA,
  SPONSOR_V3_RANKS,
  buildSponsorV3TermsCore,
  sponsorV3AnchorWeights,
  sponsorV3BenchmarkLadder,
  sponsorV3CardByKey,
  sponsorV3DownsideShortfall,
  sponsorV3ExpectedPayout,
  sponsorV3GuaranteedLadder,
  sponsorV3IsMonotone,
  sponsorV3LadderValue,
  sponsorV3StandardDeviation,
  sponsorV3StrengthClassOf,
} from "@/lib/sponsor/sponsor-v3-model";
import {
  SPONSOR_SOCKEL_MAX,
  SPONSOR_SOCKEL_MIN,
  sponsorLigaLeiter,
  sponsorSockelFuerStartrang,
  sponsorWertungsGewichte,
} from "@/lib/sponsor/sponsor-liga-leiter";
import { baueRangmarke, blockFuerRang } from "@/lib/sponsor/sponsor-rangmarke";
import { baueAchsenLatte } from "@/lib/sponsor/sponsor-leih-ziele";
import { buildSponsorOfferTermForecast, readLockedRankPayout } from "@/lib/sponsor/sponsor-economy-calibration";

// ── lib/season/league-split.ts (neu) ───────────────────────────────────────────────────────────

describe("league-split.ts — Fundament", () => {
  it("hat die vereinbarten Konstanten", () => {
    expect(LEAGUE_SIZE).toBe(16);
    expect(TEAM_COUNT_TOTAL).toBe(32);
    expect(RELEGATION_COUNT).toBe(3);
  });

  it("isLeagueSplitActive ist IMMER false — der Schalter ist noch nicht scharf", () => {
    const ohneFeld = { seasonState: {} } as unknown as GameState;
    const mitFeld = { seasonState: { leagueByTeamId: { "M-M": "liga1" } } } as unknown as GameState;
    expect(isLeagueSplitActive(ohneFeld)).toBe(false);
    expect(isLeagueSplitActive(mitFeld)).toBe(false);
  });

  it("getLeagueOf/getLeagueTeamIds: null/leer, solange leagueByTeamId fehlt", () => {
    const gameState = { seasonState: {} } as unknown as GameState;
    expect(getLeagueOf(gameState, "M-M")).toBeNull();
    expect(getLeagueTeamIds(gameState, "liga1")).toEqual([]);
    expect(getLeagueTeamIds(gameState, "liga2")).toEqual([]);
  });

  it("getLeagueOf/getLeagueTeamIds lesen ein gesetztes leagueByTeamId korrekt", () => {
    const gameState = {
      seasonState: { leagueByTeamId: { "M-M": "liga1", "P-S": "liga1", "R-R": "liga2" } },
    } as unknown as GameState;
    expect(getLeagueOf(gameState, "M-M")).toBe("liga1");
    expect(getLeagueOf(gameState, "R-R")).toBe("liga2");
    expect(getLeagueOf(gameState, "unbekannt")).toBeNull();
    expect(getLeagueTeamIds(gameState, "liga1").sort()).toEqual(["M-M", "P-S"]);
    expect(getLeagueTeamIds(gameState, "liga2")).toEqual(["R-R"]);
  });

  describe("buildInitialLeagueAssignment gegen die echten Teamdaten", () => {
    const teams = loadSourceTeams();

    it("teilt exakt in 16 + 16", () => {
      const assignment = buildInitialLeagueAssignment(teams);
      expect(Object.keys(assignment)).toHaveLength(32);
      const liga1 = Object.values(assignment).filter((tier) => tier === "liga1");
      const liga2 = Object.values(assignment).filter((tier) => tier === "liga2");
      expect(liga1).toHaveLength(16);
      expect(liga2).toHaveLength(16);
    });

    it("M-M (Budget-Rang 1, Plan-Abschnitt 0 Fund 1) landet in Liga 1, R-R (Rang 32) in Liga 2", () => {
      const assignment = buildInitialLeagueAssignment(teams);
      const mm = teams.find((team) => team.teamId === "M-M");
      const rr = teams.find((team) => team.teamId === "R-R");
      expect(mm).toBeDefined();
      expect(rr).toBeDefined();
      // Dieselbe Invariante wie `buildStartRankByTeamId` in new-game-setup-service.ts.
      expect(assignment["M-M"]).toBe("liga1");
      expect(assignment["R-R"]).toBe("liga2");
    });

    it("Liga 1 sind genau die 16 hoechsten Budgets, Liga 2 die 16 niedrigsten", () => {
      const assignment = buildInitialLeagueAssignment(teams);
      const sortedBudgets = [...teams].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0));
      const top16Ids = new Set(sortedBudgets.slice(0, 16).map((t) => t.teamId));
      for (const team of teams) {
        expect(assignment[team.teamId]).toBe(top16Ids.has(team.teamId) ? "liga1" : "liga2");
      }
    });
  });
});

// ── lib/sponsor/sponsor-v3-model.ts ────────────────────────────────────────────────────────────

describe("sponsorV3StrengthClassOf — Default unveraendert, 16er sinnvoll", () => {
  it("Default (32): exakt die alten Grenzen 11/21", () => {
    expect(sponsorV3StrengthClassOf(1)).toBe(0);
    expect(sponsorV3StrengthClassOf(11)).toBe(0);
    expect(sponsorV3StrengthClassOf(12)).toBe(1);
    expect(sponsorV3StrengthClassOf(21)).toBe(1);
    expect(sponsorV3StrengthClassOf(22)).toBe(2);
    expect(sponsorV3StrengthClassOf(32)).toBe(2);
    expect(sponsorV3StrengthClassOf(Number.NaN)).toBe(1);
  });

  it("explizit leagueSize=32 ist identisch zum Default", () => {
    for (const rank of [1, 5, 11, 12, 18, 21, 22, 30, 32]) {
      expect(sponsorV3StrengthClassOf(rank, 32)).toBe(sponsorV3StrengthClassOf(rank));
    }
  });

  it("LEAGUE_SIZE=16: Drittelung 1-5 stark / 6-11 mittel / 12-16 schwach (Plan-Abschnitt 3.1)", () => {
    expect(sponsorV3StrengthClassOf(1, LEAGUE_SIZE)).toBe(0);
    expect(sponsorV3StrengthClassOf(5, LEAGUE_SIZE)).toBe(0);
    expect(sponsorV3StrengthClassOf(6, LEAGUE_SIZE)).toBe(1);
    expect(sponsorV3StrengthClassOf(11, LEAGUE_SIZE)).toBe(1);
    expect(sponsorV3StrengthClassOf(12, LEAGUE_SIZE)).toBe(2);
    expect(sponsorV3StrengthClassOf(16, LEAGUE_SIZE)).toBe(2);
  });
});

describe("sponsorV3AnchorWeights — Default unveraendert, 16er sinnvoll", () => {
  it("Default: 32 Gewichte, Summe 1, um den Startrang zentriert", () => {
    const weights = sponsorV3AnchorWeights(10);
    expect(weights).toHaveLength(32);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    // Reproduziert die alte, ungeparametrisierte Formel von Hand — Bit-Identitaet.
    const spread = SPONSOR_V3_ANCHOR_SIGMA;
    const raw = Array.from({ length: 32 }, (_, i) => Math.exp(-((i + 1 - 10) ** 2) / (2 * spread * spread)));
    const sum = raw.reduce((a, b) => a + b, 0);
    const erwartet = raw.map((v) => v / sum);
    weights.forEach((w, i) => expect(w).toBeCloseTo(erwartet[i]!, 12));
  });

  it("ranks=16: 16 Gewichte, Summe 1, Zentrum bei Startrang", () => {
    const weights = sponsorV3AnchorWeights(8, undefined, LEAGUE_SIZE);
    expect(weights).toHaveLength(16);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    // Groesstes Gewicht liegt bei Index 7 (Rang 8, dem Startrang).
    const maxIndex = weights.indexOf(Math.max(...weights));
    expect(maxIndex).toBe(7);
  });
});

describe("sponsorV3BenchmarkLadder — Default unveraendert, ranks=16 sinnvoll", () => {
  const prizeCurve = Array.from({ length: 32 }, (_, i) => 100 - i * 2);
  const placementBonus = (delta: number) => delta * 0.5;

  it("Default liefert 32 Sprossen", () => {
    const ladder = sponsorV3BenchmarkLadder({ prizeCurve, startRank: 5, placementBonus });
    expect(ladder).toHaveLength(32);
  });

  it("ranks=16 liefert 16 Sprossen, aus derselben Formel", () => {
    const ladder = sponsorV3BenchmarkLadder({ prizeCurve, startRank: 5, placementBonus }, 16);
    expect(ladder).toHaveLength(16);
    // Sprosse 1 = prizeCurve[0] + placementBonus(5-1)
    expect(ladder[0]).toBeCloseTo(prizeCurve[0]! + placementBonus(4), 9);
  });
});

describe("Vertrags-Rechenkette (LadderValue/GuaranteedLadder/ExpectedPayout/StdDev/DownsideShortfall/IsMonotone)", () => {
  const basisCard = sponsorV3CardByKey("basis");

  function baueTerms(ranks: number, startRank: number) {
    const prizeCurve = Array.from({ length: ranks }, (_, i) => 100 - i * (100 / ranks));
    const baseLadder = sponsorV3BenchmarkLadder(
      { prizeCurve, startRank, placementBonus: (delta) => delta * 0.5 },
      ranks,
    );
    return buildSponsorV3TermsCore({
      baseLadder,
      startRank,
      rarity: "magisch",
      card: basisCard,
      goalKey: null,
      salaryFactor: 1,
      floor: 0,
    });
  }

  it("Default (32er baseLadder): Leiterfunktionen bleiben auf 32 Raenge geklammert wie zuvor", () => {
    const terms = baueTerms(SPONSOR_V3_RANKS, 5);
    expect(terms.rankLadder).toHaveLength(32);
    const guaranteed = sponsorV3GuaranteedLadder(terms);
    expect(guaranteed).toHaveLength(32);
    // Rang > 32 wird weiterhin auf 32 geklammert (identisch zur alten SPONSOR_V3_RANKS-Klammer).
    expect(sponsorV3LadderValue(terms, 999)).toBeCloseTo(sponsorV3LadderValue(terms, 32), 9);
    expect(sponsorV3IsMonotone(terms)).toBe(true);
    // EV-Invariante des Modells: Erwartungswert == eingefrorener Anker (unveraendert durch die PR).
    expect(sponsorV3ExpectedPayout(terms)).toBeCloseTo(terms.anchor, 9);
    expect(sponsorV3StandardDeviation(terms)).toBeGreaterThanOrEqual(0);
    expect(sponsorV3DownsideShortfall(terms)).toBeGreaterThanOrEqual(0);
  });

  it("16er baseLadder (Liga-Split-Vorschau): dieselben Funktionen adaptieren sich automatisch auf 16 Raenge", () => {
    const terms = baueTerms(LEAGUE_SIZE, 5);
    expect(terms.rankLadder).toHaveLength(16);
    const guaranteed = sponsorV3GuaranteedLadder(terms);
    expect(guaranteed).toHaveLength(16);
    // Rang > 16 wird jetzt auf 16 geklammert, NICHT mehr faelschlich auf 32.
    expect(sponsorV3LadderValue(terms, 999)).toBeCloseTo(sponsorV3LadderValue(terms, 16), 9);
    expect(sponsorV3IsMonotone(terms)).toBe(true);
    expect(sponsorV3ExpectedPayout(terms)).toBeCloseTo(terms.anchor, 9);
    expect(sponsorV3StandardDeviation(terms)).toBeGreaterThanOrEqual(0);
    expect(sponsorV3DownsideShortfall(terms)).toBeGreaterThanOrEqual(0);
  });
});

// ── lib/sponsor/sponsor-liga-leiter.ts ─────────────────────────────────────────────────────────

describe("sponsor-liga-leiter.ts — Default unveraendert, leagueSize=16 sinnvoll", () => {
  it("sponsorSockelFuerStartrang: Default identisch zur alten 32er-Formel", () => {
    expect(sponsorSockelFuerStartrang(1)).toBeCloseTo(SPONSOR_SOCKEL_MIN, 9);
    expect(sponsorSockelFuerStartrang(32)).toBeCloseTo(SPONSOR_SOCKEL_MAX, 9);
    expect(sponsorSockelFuerStartrang(16)).toBeCloseTo(
      SPONSOR_SOCKEL_MIN + ((SPONSOR_SOCKEL_MAX - SPONSOR_SOCKEL_MIN) * 15) / 31,
      9,
    );
  });

  it("sponsorSockelFuerStartrang(rang, 16): Min bei Rang 1, Max bei Rang 16, monoton dazwischen", () => {
    expect(sponsorSockelFuerStartrang(1, LEAGUE_SIZE)).toBeCloseTo(SPONSOR_SOCKEL_MIN, 9);
    expect(sponsorSockelFuerStartrang(16, LEAGUE_SIZE)).toBeCloseTo(SPONSOR_SOCKEL_MAX, 9);
    let previous = sponsorSockelFuerStartrang(1, LEAGUE_SIZE);
    for (let rank = 2; rank <= 16; rank += 1) {
      const current = sponsorSockelFuerStartrang(rank, LEAGUE_SIZE);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it("sponsorWertungsGewichte: Default liefert 32 Gewichte, Rang 32 exakt 0", () => {
    const gewichte = sponsorWertungsGewichte();
    expect(gewichte).toHaveLength(32);
    expect(gewichte[31]).toBeCloseTo(0, 12);
    expect(gewichte[0]).toBeCloseTo(1, 12);
  });

  it("sponsorWertungsGewichte(16): 16 Gewichte, Rang 16 exakt 0, Rang 1 exakt 1", () => {
    const gewichte = sponsorWertungsGewichte(LEAGUE_SIZE);
    expect(gewichte).toHaveLength(16);
    expect(gewichte[15]).toBeCloseTo(0, 12);
    expect(gewichte[0]).toBeCloseTo(1, 12);
  });

  it("sponsorLigaLeiter: Default (kein leagueSize) identisch zur alten 32er-Leiter", () => {
    const ladder = sponsorLigaLeiter({ startRank: 5, salaryFactor: 1.1 });
    expect(ladder).toHaveLength(32);
    expect(ladder[31]).toBeCloseTo(sponsorSockelFuerStartrang(5), 9);
  });

  it("sponsorLigaLeiter({leagueSize:16}): 16 Sprossen, monoton fallend, letzte Sprosse = Sockel", () => {
    const ladder = sponsorLigaLeiter({ startRank: 5, salaryFactor: 1.1, leagueSize: LEAGUE_SIZE });
    expect(ladder).toHaveLength(16);
    expect(ladder[15]).toBeCloseTo(sponsorSockelFuerStartrang(5, LEAGUE_SIZE), 9);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]!).toBeLessThanOrEqual(ladder[i - 1]! + 1e-9);
    }
  });
});

// ── lib/sponsor/sponsor-rangmarke.ts ───────────────────────────────────────────────────────────

describe("sponsor-rangmarke.ts — Default unveraendert, leagueSize=16 sinnvoll", () => {
  it("blockFuerRang: Default identisch zum alten Verhalten", () => {
    expect(blockFuerRang(1)).toBe(1);
    expect(blockFuerRang(3)).toBe(4);
    expect(blockFuerRang(14)).toBe(16);
    expect(blockFuerRang(30)).toBe(28);
    expect(blockFuerRang(99)).toBe(28);
  });

  it("blockFuerRang(rang, 16): auf 1..16 geklammert statt 1..32", () => {
    expect(blockFuerRang(99, LEAGUE_SIZE)).toBe(16);
    expect(blockFuerRang(1, LEAGUE_SIZE)).toBe(1);
  });

  it("baueRangmarke: Default identisch zum alten Verhalten (inkl. Rueckfall 32)", () => {
    expect(baueRangmarke({ startRang: 14, haerte: "hart" })).toBe(16);
    expect(baueRangmarke({ startRang: 14, haerte: "mild" })).toBe(20);
    expect(baueRangmarke({ startRang: 30, haerte: "mild" })).toBe(32);
  });

  it("baueRangmarke({leagueSize:16}) reicht die Ligagroesse an blockFuerRang durch", () => {
    // Der interne 32er-Rueckfall (`index<=0 ? leagueSize`) greift nur, wenn `blockFuerRang` den
    // loesesten Block (28) liefert — bei leagueSize=16 ist der Rang immer <= 16 geklammert und
    // erreicht Block 28 nie (RANGMARKEN_BLOECKE selbst bleibt unveraendert, siehe Datei-Kommentar).
    // Geprueft wird deshalb die tatsaechlich erreichbare Weitergabe der Ligagroesse an blockFuerRang.
    expect(baueRangmarke({ startRang: 15, haerte: "hart", leagueSize: LEAGUE_SIZE })).toBe(
      blockFuerRang(15, LEAGUE_SIZE),
    );
    expect(baueRangmarke({ startRang: 1, haerte: "hart", leagueSize: LEAGUE_SIZE })).toBe(1);
  });
});

// ── lib/sponsor/sponsor-leih-ziele.ts ──────────────────────────────────────────────────────────

describe("baueAchsenLatte — Default unveraendert, leagueSize=16 bleibt in der Liga", () => {
  it("Default identisch zum alten Verhalten", () => {
    expect(baueAchsenLatte(3)).toBe(5);
    expect(baueAchsenLatte(8)).toBe(10);
    expect(baueAchsenLatte(14)).toBe(14);
    expect(baueAchsenLatte(24)).toBe(24);
    expect(baueAchsenLatte(28)).toBe(26);
    expect(baueAchsenLatte(32)).toBe(30);
  });

  it("leagueSize=16: Latte bleibt innerhalb 1..16, waechst nie ueber die eigene Liga hinaus", () => {
    for (let rank = 1; rank <= 16; rank += 1) {
      const latte = baueAchsenLatte(rank, LEAGUE_SIZE);
      expect(latte).toBeGreaterThanOrEqual(1);
      expect(latte).toBeLessThanOrEqual(16);
    }
    // Rang 1 bekommt weiterhin Spielraum nach unten (Latte > Rang).
    expect(baueAchsenLatte(1, LEAGUE_SIZE)).toBeGreaterThan(1);
  });
});

// ── lib/sponsor/sponsor-economy-calibration.ts ─────────────────────────────────────────────────

describe("readLockedRankPayout — Default unveraendert, adaptiert sich an kuerzere Leitern", () => {
  const LEITER_32 = Array.from({ length: 32 }, (_, i) => 90 - i * 1.5);

  it("32er-Leiter: identisches Verhalten wie vor der PR", () => {
    expect(readLockedRankPayout([], 1)).toBe(0);
    expect(readLockedRankPayout(LEITER_32, 1)).toBe(90);
    expect(readLockedRankPayout(LEITER_32, 32)).toBeCloseTo(90 - 31 * 1.5, 9);
    // Rang jenseits der Leiterlaenge faellt weiterhin auf die letzte Sprosse zurueck.
    expect(readLockedRankPayout(LEITER_32, 999)).toBeCloseTo(90 - 31 * 1.5, 9);
  });

  it("16er-Leiter: Klammerung passt sich der tatsaechlichen Leiterlaenge an, statt hart bei 32 zu ziehen", () => {
    const leiter16 = Array.from({ length: 16 }, (_, i) => 60 - i * 2);
    expect(readLockedRankPayout(leiter16, 1)).toBe(60);
    expect(readLockedRankPayout(leiter16, 16)).toBeCloseTo(60 - 15 * 2, 9);
    // Vor der Fixierung waere hier `Math.min(32, 20) - 1 = 19` ausserhalb des 16er-Arrays gelesen
    // worden (Fallback auf die letzte Sprosse) — jetzt wird korrekt auf 16 geklammert, gleiches Ergebnis.
    expect(readLockedRankPayout(leiter16, 20)).toBeCloseTo(60 - 15 * 2, 9);
  });
});

describe("buildSponsorOfferTermForecast — Default unveraendert, adaptiert sich an kuerzere Leitern", () => {
  const LEITER_32 = Array.from({ length: 32 }, (_, index) => 70 - index * 0.6);

  function angebot(rankLadder: number[], startRank: number): SponsorOffer {
    return {
      offerId: "offer-1",
      teamId: "A-A",
      name: "Testsponsor",
      archetype: "security",
      flavor: "",
      components: [{ componentId: "c1", kind: "base", label: "Basis", rewardCash: 50 }],
      termSeasons: 1,
      sponsorV3: {
        version: 3,
        rankLadder: [...rankLadder],
        baseLadder: [...rankLadder],
        anchor: rankLadder[Math.round(startRank) - 1] ?? 0,
        tilt: 0,
        cardKey: "basis",
        cardName: "Basis",
        rarity: "gewöhnlich",
        curveShape: "titeljaeger",
        startRank,
        goalKey: null,
        goalP: 0,
        goalSize: 0,
        salaryFactor: 1,
        floor: 0,
      },
    } as unknown as SponsorOffer;
  }

  function zustand(): GameState {
    return { season: { id: "season-1" }, seasonState: {} } as unknown as GameState;
  }

  it("32er-Leiter (Default): rankIndex bleibt wie zuvor auf 0..31 geklammert", () => {
    const eintraege = buildSponsorOfferTermForecast(zustand(), angebot(LEITER_32, 999));
    expect(eintraege[0]!.rankPayouts).toHaveLength(32);
    // Startrang 999 waere frueher auf Index 31 geklammert worden (min(31, 998)) — unveraendert.
    expect(eintraege[0]!.payoutAtCurrentRank).toBeCloseTo(eintraege[0]!.rankPayouts[31]!, 9);
  });

  // KEIN 16er-Test fuer den vollen `buildSponsorOfferTermForecast`-Pfad: `getSponsorV3Terms`
  // (lib/sponsor/sponsor-v3-offer-service.ts, NICHT Teil dieser PR) prueft hart
  // `rankLadder.length === 32` und wuerde ein 16-langes Angebot heute ohnehin ablehnen (leere
  // Vorschau statt Rechnung). Die Parametrisierung hier (Rangraum aus `terms.rankLadder.length`
  // statt der festen 31) ist also erst wirksam, sobald eine spaetere PR diese 32er-Gate loest —
  // bis dahin ist sie ein bewusst vorbereiteter, heute unbenutzter Pfad. Die direkte 16er-Probe
  // liegt deshalb bei den Kernfunktionen in sponsor-v3-model.ts oben, die `buildSponsorOfferTermForecast`
  // ueber `sponsorV3GuaranteedLadder` intern wiederverwendet.
});

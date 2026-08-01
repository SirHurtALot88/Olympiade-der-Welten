/**
 * GEWUENSCHT: „'Erfolge' Tab braucht eigentlich auch noch neue achievements die sinn machen."
 *
 * Die 14 bestehenden decken Ranglisten, Kader-OVR/-Wert, Transfer-ZAEHLER, Tabellenplatz und
 * Saisonabschluesse ab. Auffaellig ist, was fehlte: von dem, was jeden Spieltag tatsaechlich
 * passiert — Disziplinen gewinnen, Serien aufbauen — kam nichts vor. Und die Wirtschaft fehlte
 * ganz, obwohl Sponsoren die Haupteinnahme sind.
 *
 * Am echten Spielstand (Team C-C, Saison 1, MD 10) waechst der Reiter von 14 auf 29, davon 6
 * erreicht — und jeder gesperrte nennt seinen Stand:
 *
 *   ✓ Disziplinsieger      1x gewonnen
 *   ✓ Schwarze Null        GuV 9,1 Mio
 *   ✓ Kapitaen ernannt
 *   ✓ Gute Stimmung        Alle zufrieden
 *   ○ Der Durchmarsch      2 von 5 Raengen (Start #23, jetzt #21)
 *   ○ Breit aufgestellt    2 von 4 Bereichen
 *
 * BEWUSST KEIN PREISGELD: es wird in diesem Spiel nie ausgezahlt, ein Meilenstein darauf waere
 * ein Ziel, das kein Geld bewegt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildExtendedLeagueAchievements } from "@/lib/foundation/league-achievements-extended";

type DisziplinEingabe = { matchday: number; disciplineId: string; rank: number };

function spielstand(input: {
  disziplinen?: DisziplinEingabe[];
  top10Spieltage?: number[];
  standings?: Record<string, unknown>;
  rosters?: unknown[];
  transferHistory?: unknown[];
  teamCaptains?: unknown[];
  playerMoraleState?: unknown[];
  seasonId?: string;
}): GameState {
  const disziplinen = input.disziplinen ?? [];
  const matchdays = [...new Set([...disziplinen.map((d) => d.matchday), ...(input.top10Spieltage ?? [])])].sort(
    (a, b) => a - b,
  );
  const seasonId = input.seasonId ?? "season-1";

  return {
    season: { id: seasonId, name: seasonId, year: 1, currentMatchday: matchdays.length, matchdayIds: matchdays.map((m) => `md-${m}`) },
    teams: [{ teamId: "T1", shortCode: "T-1", name: "Mein Team", cash: 10 }],
    players: [{ id: "p1", name: "Anna" }],
    rosters: input.rosters ?? [],
    disciplines: [
      { id: "dPow", name: "Kraft", category: "power" },
      { id: "dSpe", name: "Tempo", category: "speed" },
      { id: "dMen", name: "Kopf", category: "mental" },
      { id: "dSoc", name: "Team", category: "social" },
    ],
    matchdayState: { matchdayId: `md-${matchdays[matchdays.length - 1] ?? 1}`, status: "resolved" },
    teamCaptains: input.teamCaptains ?? [],
    playerMoraleState: input.playerMoraleState ?? [],
    seasonState: {
      seasonId,
      schedule: [],
      standings: input.standings ?? {},
      seasonSnapshots: [],
      matchdayResults: matchdays.map((m) => ({
        id: `mr-${m}`,
        saveId: "save-1",
        seasonId,
        matchdayId: `md-${m}`,
        status: "preview_applied",
      })),
      disciplineResults: disziplinen.map((d, index) => ({
        id: `dr-${index}`,
        matchdayResultId: `mr-${d.matchday}`,
        teamId: "T1",
        disciplineId: d.disciplineId,
        disciplineSide: "d1",
        rank: d.rank,
        baseScore: 10,
        totalScore: 10,
        formModifier: 0,
        readinessStatus: "ok",
        warnings: [],
      })),
      playerDisciplinePerformances: (input.top10Spieltage ?? []).map((m, index) => ({
        id: `pdp-${index}`,
        matchdayResultId: `mr-${m}`,
        teamId: "T1",
        playerId: "p1",
        disciplineId: "dPow",
        disciplineSide: "d1",
        isTop10: true,
        isMvpCandidate: false,
        rankInDiscipline: 4,
        scoreContribution: 5,
        mutatorPpsBonus: 0,
      })),
      lineupDrafts: [],
    },
    transferHistory: input.transferHistory ?? [],
  } as never;
}

const finde = (state: GameState, id: string) =>
  buildExtendedLeagueAchievements(state, "T1").find((eintrag) => eintrag.id === id) ?? null;

describe("Disziplinen — das, was jeden Spieltag passiert", () => {
  it("Disziplinsieger ab dem ersten Sieg", () => {
    const ohne = spielstand({ disziplinen: [{ matchday: 1, disciplineId: "dPow", rank: 4 }] });
    expect(finde(ohne, "disciplines-first-win")?.reached).toBe(false);

    const mit = spielstand({ disziplinen: [{ matchday: 1, disciplineId: "dPow", rank: 1 }] });
    expect(finde(mit, "disciplines-first-win")?.reached).toBe(true);
  });

  it("Doppelschlag verlangt beide Siege am SELBEN Spieltag", () => {
    // Zwei Siege an verschiedenen Spieltagen sind kein Doppelschlag.
    const verteilt = spielstand({
      disziplinen: [
        { matchday: 1, disciplineId: "dPow", rank: 1 },
        { matchday: 2, disciplineId: "dSpe", rank: 1 },
      ],
    });
    expect(finde(verteilt, "disciplines-double")?.reached).toBe(false);

    const gleicherTag = spielstand({
      disziplinen: [
        { matchday: 1, disciplineId: "dPow", rank: 1 },
        { matchday: 1, disciplineId: "dSpe", rank: 1 },
      ],
    });
    expect(finde(gleicherTag, "disciplines-double")?.reached).toBe(true);
  });

  it("Hausdisziplin verlangt DIESELBE Disziplin dreimal", () => {
    const verstreut = spielstand({
      disziplinen: [
        { matchday: 1, disciplineId: "dPow", rank: 1 },
        { matchday: 2, disciplineId: "dSpe", rank: 1 },
        { matchday: 3, disciplineId: "dMen", rank: 1 },
      ],
    });
    expect(finde(verstreut, "disciplines-home-turf")?.reached).toBe(false);

    const gebuendelt = spielstand({
      disziplinen: [1, 2, 3].map((matchday) => ({ matchday, disciplineId: "dPow", rank: 1 })),
    });
    expect(finde(gebuendelt, "disciplines-home-turf")?.reached).toBe(true);
    expect(finde(gebuendelt, "disciplines-home-turf")?.detail).toBe("Kraft");
  });

  it("Breit aufgestellt zaehlt BEREICHE, nicht Disziplinen", () => {
    const dreiBereiche = spielstand({
      disziplinen: [
        { matchday: 1, disciplineId: "dPow", rank: 3 },
        { matchday: 2, disciplineId: "dSpe", rank: 3 },
        { matchday: 3, disciplineId: "dMen", rank: 3 },
      ],
    });
    expect(finde(dreiBereiche, "disciplines-all-areas")?.reached).toBe(false);
    expect(finde(dreiBereiche, "disciplines-all-areas")?.progressLabel).toBe("3 von 4 Bereichen");

    const alleVier = spielstand({
      disziplinen: ["dPow", "dSpe", "dMen", "dSoc"].map((disciplineId, index) => ({
        matchday: index + 1,
        disciplineId,
        rank: 3,
      })),
    });
    expect(finde(alleVier, "disciplines-all-areas")?.reached).toBe(true);
  });
});

describe("Serien — die Reihenfolge zaehlt, nicht die Menge", () => {
  it("Lauf verlangt AUFEINANDERFOLGENDE Spieltage", () => {
    // Drei Top-3 mit Luecke sind keine Serie — das ist der ganze Punkt.
    const mitLuecke = spielstand({
      disziplinen: [1, 2, 5].map((matchday) => ({ matchday, disciplineId: "dPow", rank: 2 })),
    });
    expect(finde(mitLuecke, "streaks-run")?.reached).toBe(false);
    expect(finde(mitLuecke, "streaks-run")?.progressLabel).toBe("Längste Serie: 2 von 3");

    const inFolge = spielstand({
      disziplinen: [1, 2, 3].map((matchday) => ({ matchday, disciplineId: "dPow", rank: 2 })),
    });
    expect(finde(inFolge, "streaks-run")?.reached).toBe(true);
  });

  it("Serientaeter: ein Spieler an fuenf Spieltagen in Folge in den Top 10", () => {
    const vier = spielstand({ top10Spieltage: [1, 2, 3, 4] });
    expect(finde(vier, "streaks-player-top10")?.reached).toBe(false);

    const fuenf = spielstand({ top10Spieltage: [1, 2, 3, 4, 5] });
    const treffer = finde(fuenf, "streaks-player-top10");
    expect(treffer?.reached).toBe(true);
    expect(treffer?.playerId).toBe("p1");
  });

  /**
   * `startplatz` ist der beim Saisonaufbau vergebene Startrang, `rank` der aktuelle. Am echten
   * Spielstand geprueft: A-A traegt `startplatz: 31`, `rank: 27`, `rankDiff: 4` — die
   * Verbesserung ist also `startplatz - rank`, positiv heisst besser geworden.
   */
  it("Der Durchmarsch misst gegen den STARTPLATZ, nicht gegen die Mitte", () => {
    const knapp = spielstand({ standings: { T1: { startplatz: 20, rank: 17, points: 10 } } });
    expect(finde(knapp, "streaks-climb")?.reached).toBe(false);
    expect(finde(knapp, "streaks-climb")?.progressLabel).toContain("3 von 5");

    const durch = spielstand({ standings: { T1: { startplatz: 20, rank: 12, points: 10 } } });
    expect(finde(durch, "streaks-climb")?.reached).toBe(true);
  });

  it("sagt ehrlich, wenn der Startplatz fehlt — statt eine Verbesserung zu erfinden", () => {
    const ohne = spielstand({ standings: { T1: { rank: 5, points: 10 } } });
    expect(finde(ohne, "streaks-climb")?.reached).toBe(false);
    expect(finde(ohne, "streaks-climb")?.progressLabel).toBe("Noch kein Startplatz bekannt");
  });
});

describe("Wirtschaft — Sponsoren, kein Preisgeld", () => {
  it("Sponsorenliebling misst gegen den LIGA-Median", () => {
    const standings = {
      T1: { sponsorSeason: 40, rank: 1, points: 10 },
      T2: { sponsorSeason: 10, rank: 2, points: 5 },
      T3: { sponsorSeason: 20, rank: 3, points: 3 },
    };
    expect(finde(spielstand({ standings }), "economy-sponsor-median")?.reached).toBe(true);

    const schwach = { ...standings, T1: { sponsorSeason: 5, rank: 1, points: 10 } };
    expect(finde(spielstand({ standings: schwach }), "economy-sponsor-median")?.reached).toBe(false);
  });

  it("Schwarze Null: GuV ab 0", () => {
    expect(finde(spielstand({ standings: { T1: { guv: -2 } } }), "economy-break-even")?.reached).toBe(false);
    expect(finde(spielstand({ standings: { T1: { guv: 0 } } }), "economy-break-even")?.reached).toBe(true);
  });

  it("Transfer-Gewinner braucht DREI Verkaeufe — ein Glueckstreffer ist keine Politik", () => {
    const einVerkauf = spielstand({
      transferHistory: [
        { id: "t1", playerId: "p1", seasonId: "season-1", transferType: "sell", fromTeamId: "T1", toTeamId: "T2", fee: 100 },
      ],
    });
    expect(finde(einVerkauf, "economy-transfer-profit")?.reached).toBe(false);

    const dreiVerkaeufe = spielstand({
      transferHistory: [1, 2, 3].map((n) => ({
        id: `t${n}`,
        playerId: `p${n}`,
        seasonId: "season-1",
        transferType: "sell",
        fromTeamId: "T1",
        toTeamId: "T2",
        fee: 10,
      })),
    });
    expect(finde(dreiVerkaeufe, "economy-transfer-profit")?.reached).toBe(true);
  });

  it("rechnet Preisgeld NIRGENDS mit", () => {
    // Das ist eine feste Projektentscheidung: Preisgeld wird nie ausgezahlt, es ist Benchmark.
    const quelle = readFileSync(join(process.cwd(), "lib/foundation/league-achievements-extended.ts"), "utf8");
    expect(quelle).not.toContain("prizeMoney");
    expect(quelle).not.toContain("cashPrize");
    expect(quelle).toContain("sponsorSeason");
  });
});

describe("Kaderaufbau", () => {
  it("Kapitaen ernannt", () => {
    expect(finde(spielstand({}), "squad-captain")?.reached).toBe(false);
    expect(finde(spielstand({ teamCaptains: [{ teamId: "T1", playerId: "p1" }] }), "squad-captain")?.reached).toBe(true);
  });

  it("Gute Stimmung nur, wenn NIEMAND unzufrieden ist", () => {
    const gemischt = spielstand({
      playerMoraleState: [
        { playerId: "p1", teamId: "T1", visibleMood: "happy" },
        { playerId: "p2", teamId: "T1", visibleMood: "unhappy" },
      ],
    });
    expect(finde(gemischt, "squad-morale")?.reached).toBe(false);
    expect(finde(gemischt, "squad-morale")?.progressLabel).toBe("1 unzufrieden");

    const zufrieden = spielstand({
      playerMoraleState: [{ playerId: "p1", teamId: "T1", visibleMood: "happy" }],
    });
    expect(finde(zufrieden, "squad-morale")?.reached).toBe(true);
  });

  it("Gute Stimmung ist NICHT erreicht, solange es gar keine Stimmungsdaten gibt", () => {
    // Sonst waere „alle zufrieden" schon vor dem ersten Spieltag wahr — ein geschenkter
    // Meilenstein, der nichts ueber das Team aussagt.
    expect(finde(spielstand({}), "squad-morale")?.reached).toBe(false);
  });

  it("Treue zaehlt Saisons seit dem Beitritt", () => {
    const neu = spielstand({
      seasonId: "season-1",
      rosters: [{ id: "r1", teamId: "T1", playerId: "p1", joinedSeasonId: "season-1" }],
    });
    expect(finde(neu, "squad-loyalty")?.progressLabel).toBe("1 von 3 Saisons");

    const lange = spielstand({
      seasonId: "season-3",
      rosters: [{ id: "r1", teamId: "T1", playerId: "p1", joinedSeasonId: "season-1" }],
    });
    expect(finde(lange, "squad-loyalty")?.reached).toBe(true);
  });

  it("jeder gesperrte Meilenstein nennt Stand UND Ziel", () => {
    // Ein gesperrter Meilenstein ohne Fortschritt ist nur eine geschlossene Tuer.
    for (const eintrag of buildExtendedLeagueAchievements(spielstand({}), "T1")) {
      if (eintrag.reached) continue;
      expect(eintrag.progressLabel, `${eintrag.id} ohne Stand`).toBeTruthy();
      expect(eintrag.targetLabel, `${eintrag.id} ohne Ziel`).toBeTruthy();
    }
  });

  it("liefert alle 15 neuen Meilensteine", () => {
    expect(buildExtendedLeagueAchievements(spielstand({}), "T1")).toHaveLength(15);
  });
});

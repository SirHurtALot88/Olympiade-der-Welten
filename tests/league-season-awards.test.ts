/**
 * GEWUENSCHT: „kannst du hier auch noch mal überlegen ob wir hier noch mehr awards vergeben
 * könnten für spieler basierend auf ihren achievements? überleg mal was."
 *
 * Die Leader-Kacheln beantworten schon „wer hat am meisten" — achtmal. Diese Awards beantworten
 * die andere Frage: WIE jemand zu seinen Punkten kam. Ein Spezialist sieht in jeder
 * Gesamtwertung mittelmaessig aus und ist trotzdem eine Geschichte.
 *
 * Am echten Spielstand (Saison 1, 10 Spieltage, 2449 Auftritte) werden 11 der 12 vergeben:
 *
 *   Der Spezialist        44 %          Marzipella      · Eiskunst
 *   Der Allrounder        21 %          Ironstride      · schwaechster Bereich
 *   Mr. Zuverlaessig      ± 18 %        Devi            · 8 Spieltage
 *   Big-Match-Spieler     5,7×          Riley Le Rogue
 *   Der Disziplinsieger   2 Siege       Grok'Na         · Battlefield
 *   Das Schnaeppchen      0,92 PPs/Mio  Lumen Serene    · 15,2 Mio Abloese
 *
 * ZWEI KORREKTUREN AM ENTWURF, beide aus der Messung:
 *
 * 1. „Disziplin-Dominator" verlangte zwei Siege in DERSELBEN Disziplin. Eine Saison vergibt
 *    ligaweit genau 20 Disziplinsiege, und dieselbe Disziplin wird selten zweimal ausgetragen —
 *    hoechster gemessener Wert: 1. Der Award waere nie vergeben worden. Gewertet wird jetzt die
 *    Gesamtzahl der Siege.
 * 2. „Der Wanderpokal" (Punkte fuer mehrere Teams in einer Saison) faellt ganz weg: Transfers
 *    laufen im Fenster ZWISCHEN den Saisons, ein Wechsel mitten in der Saison kommt im normalen
 *    Ablauf nicht vor. Gemessen: null Spieler. Das ist eine Karriere-Frage, keine Saison-Frage.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  SEASON_AWARD_MIN_APPEARANCES,
  buildLeagueSeasonAwards,
} from "@/lib/foundation/league-season-awards";

type AuftrittsEingabe = {
  playerId: string;
  matchday: number;
  disciplineId: string;
  score: number;
  rankInDiscipline?: number;
  isTop10?: boolean;
  isMvpCandidate?: boolean;
  mutatorPpsBonus?: number;
  teamId?: string;
};

/**
 * Ein Spielstand aus Auftritten gebaut. Jede Disziplinseite bekommt ihr Team-Ergebnis, sonst
 * verteilt der Ledger keine Punkte — und die Spieltage muessen `preview_applied` sein, nur
 * gebuchte Spieltage tragen PPs.
 */
function baueSpielstand(auftritte: AuftrittsEingabe[], zusatz?: Partial<GameState>): GameState {
  const matchdays = [...new Set(auftritte.map((a) => a.matchday))].sort((a, b) => a - b);
  const disziplinen = [...new Set(auftritte.map((a) => a.disciplineId))];
  const spieler = [...new Set(auftritte.map((a) => a.playerId))];

  return {
    gamePhase: "season_active",
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: matchdays.length,
      matchdayIds: matchdays.map((m) => `md-${m}`),
    },
    teams: [
      { teamId: "T1", shortCode: "T-1", name: "Team Eins", cash: 10 },
      { teamId: "T2", shortCode: "T-2", name: "Team Zwei", cash: 10 },
    ],
    players: spieler.map((id) => ({ id, name: `Spieler ${id}` })),
    rosters: spieler.map((id, index) => ({
      id: `r-${id}`,
      teamId: auftritte.find((a) => a.playerId === id)?.teamId ?? "T1",
      playerId: id,
      contractLength: 2,
      slot: index,
    })),
    disciplines: disziplinen.map((id, index) => ({
      id,
      name: `Disziplin ${id}`,
      category: (["power", "speed", "mental", "social"] as const)[index % 4],
    })),
    matchdayState: { matchdayId: `md-${matchdays[matchdays.length - 1]}`, status: "resolved" },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      seasonSnapshots: [],
      matchdayResults: matchdays.map((m) => ({
        id: `mr-${m}`,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: `md-${m}`,
        status: "preview_applied",
      })),
      disciplineResults: [
        ...new Map(
          auftritte.map((a) => {
            const teamId = a.teamId ?? "T1";
            return [
              `mr-${a.matchday}::${teamId}::${a.disciplineId}`,
              {
                id: `dr-${a.matchday}-${teamId}-${a.disciplineId}`,
                matchdayResultId: `mr-${a.matchday}`,
                teamId,
                disciplineId: a.disciplineId,
                disciplineSide: "d1",
                rank: a.rankInDiscipline ?? 5,
                baseScore: a.score,
                totalScore: a.score,
                formModifier: 0,
                readinessStatus: "ok",
                warnings: [],
              },
            ] as const;
          }),
        ).values(),
      ],
      playerDisciplinePerformances: auftritte.map((a, index) => ({
        id: `pdp-${index}`,
        matchdayResultId: `mr-${a.matchday}`,
        teamId: a.teamId ?? "T1",
        playerId: a.playerId,
        activePlayerId: a.playerId,
        disciplineId: a.disciplineId,
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: a.score,
        finalPlayerScore: a.score,
        mutatorScoreBonus: 0,
        mutatorPpsBonus: a.mutatorPpsBonus ?? 0,
        scoreContribution: a.score,
        rankInTeam: 1,
        rankInDiscipline: a.rankInDiscipline ?? 5,
        isTop10: a.isTop10 ?? false,
        isMvpCandidate: a.isMvpCandidate ?? false,
      })),
      lineupDrafts: [],
    },
    transferHistory: [],
    ...zusatz,
  } as never;
}

const awardVon = (state: GameState, id: string) =>
  buildLeagueSeasonAwards(state).awards.find((award) => award.id === id) ?? null;

/** Ein Spieler mit gleichmaessigen Auftritten ueber `anzahl` Spieltage. */
function gleichmaessig(playerId: string, anzahl: number, score: number, disciplineId = "d1"): AuftrittsEingabe[] {
  return Array.from({ length: anzahl }, (_, index) => ({
    playerId,
    matchday: index + 1,
    disciplineId,
    score,
  }));
}

describe("Saison-Awards erzaehlen eine Rolle, nicht die hoechste Zahl", () => {
  it("Der Spezialist: wer seine Punkte aus EINER Disziplin holt", () => {
    const state = baueSpielstand([
      // Spezialist: alles in d1.
      ...gleichmaessig("spez", 6, 10, "d1"),
      // Verteilt: dieselbe Summe, aber ueber zwei Disziplinen.
      ...gleichmaessig("breit", 3, 10, "d1"),
      ...gleichmaessig("breit", 3, 10, "d2").map((a) => ({ ...a, matchday: a.matchday + 3 })),
    ]);
    expect(awardVon(state, "spezialist")?.playerName).toBe("Spieler spez");
  });

  it("Der Allrounder: gewertet wird der SCHWAECHSTE Bereich, nicht die Summe", () => {
    // Der Trick am max-min-Prinzip: „viel in drei Bereichen, nichts im vierten" gewinnt NICHT.
    const state = baueSpielstand([
      // rund: in allen vier Bereichen (d1..d4 sind power/speed/mental/social).
      ...["d1", "d2", "d3", "d4"].flatMap((d, index) =>
        Array.from({ length: 2 }, (_, i) => ({ playerId: "rund", matchday: index * 2 + i + 1, disciplineId: d, score: 10 })),
      ),
      // luecke: dreimal viel, vierter Bereich fehlt ganz.
      ...["d1", "d2", "d3"].flatMap((d, index) =>
        Array.from({ length: 2 }, (_, i) => ({ playerId: "luecke", matchday: index * 2 + i + 1, disciplineId: d, score: 40 })),
      ),
    ]);
    expect(awardVon(state, "allrounder")?.playerName).toBe("Spieler rund");
  });

  it("Mr. Zuverlaessig: kleinste Schwankung, nicht der hoechste Schnitt", () => {
    // Beide kommen auf 160 Punkte. Die Summen MUESSEN gleich sein: der Award verlangt die obere
    // Haelfte der Liga, und bei ungleichen Summen faellt der Konstante unter den Median heraus —
    // dann gewaenne der Wilde kampflos, und der Test pruefte nichts.
    const state = baueSpielstand([
      ...gleichmaessig("konstant", 8, 20),
      ...[40, 1, 39, 1, 38, 1, 39, 1].map((score, index) => ({
        playerId: "wild",
        matchday: index + 1,
        disciplineId: "d2",
        score,
      })),
    ]);
    expect(awardVon(state, "zuverlaessig")?.playerName).toBe("Spieler konstant");
  });

  it("Big-Match-Spieler: der Ausreisser nach oben — das Gegenstueck zur Konstanz", () => {
    const state = baueSpielstand([
      ...gleichmaessig("konstant", 8, 10),
      ...[5, 5, 5, 5, 5, 5, 5, 90].map((score, index) => ({
        playerId: "ausreisser",
        matchday: index + 1,
        disciplineId: "d2",
        score,
      })),
    ]);
    expect(awardVon(state, "big_match")?.playerName).toBe("Spieler ausreisser");
  });

  it("Der Disziplinsieger: zaehlt Siege, und ein Sieg reicht fuer die Vergabe", () => {
    // Der korrigierte Award. Mit der urspruenglichen Regel (2 Siege in DERSELBEN Disziplin)
    // waere hier — wie am echten Spielstand — niemand ausgezeichnet worden.
    const state = baueSpielstand([
      ...gleichmaessig("sieger", 6, 10).map((a, index) => ({ ...a, rankInDiscipline: index < 2 ? 1 : 4 })),
      ...gleichmaessig("zweiter", 6, 10, "d2").map((a) => ({ ...a, rankInDiscipline: 2 })),
    ]);
    const award = awardVon(state, "disziplin_dominator");
    expect(award?.playerName).toBe("Spieler sieger");
    expect(award?.displayValue).toContain("2");
  });

  it("Mutator-Profiteur nur, wenn es ueberhaupt Mutator-Punkte gab", () => {
    const ohne = baueSpielstand(gleichmaessig("a", 6, 10));
    expect(awardVon(ohne, "mutator_profiteur")).toBeNull();

    const mit = baueSpielstand(
      gleichmaessig("a", 6, 10).map((a, index) => ({ ...a, mutatorPpsBonus: index === 0 ? 3 : 0 })),
    );
    expect(awardVon(mit, "mutator_profiteur")?.playerName).toBe("Spieler a");
  });

  it("Neuzugang wertet NUR die Punkte fuer den Kaeufer", () => {
    // Was ein Spieler vorher woanders sammelte, ist nicht das Verdienst des Transfers.
    const state = baueSpielstand(
      [...gleichmaessig("gekauft", 6, 10).map((a) => ({ ...a, teamId: "T2" }))],
      {
        transferHistory: [
          {
            id: "t1",
            playerId: "gekauft",
            seasonId: "season-1",
            seasonLabel: "Season 1",
            transferType: "buy",
            fromTeamId: "T1",
            toTeamId: "T2",
            fee: 20,
            happenedAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      } as never,
    );
    const award = awardVon(state, "neuzugang");
    expect(award?.playerName).toBe("Spieler gekauft");
    expect(award?.kontext).toBe("für den neuen Verein");
  });

  it("Das Schnaeppchen misst Punkte je Abloese — nicht Punkte", () => {
    const state = baueSpielstand(
      [
        ...gleichmaessig("teuer", 6, 20).map((a) => ({ ...a, teamId: "T2" })),
        ...gleichmaessig("billig", 6, 10, "d2").map((a) => ({ ...a, teamId: "T2" })),
      ],
      {
        transferHistory: [
          { id: "t1", playerId: "teuer", seasonId: "season-1", transferType: "buy", fromTeamId: "T1", toTeamId: "T2", fee: 100, happenedAt: "x" },
          { id: "t2", playerId: "billig", seasonId: "season-1", transferType: "buy", fromTeamId: "T1", toTeamId: "T2", fee: 2, happenedAt: "x" },
        ],
      } as never,
    );
    // "teuer" hat mehr Punkte, "billig" das bessere Verhaeltnis.
    expect(awardVon(state, "neuzugang")?.playerName).toBe("Spieler teuer");
    expect(awardVon(state, "schnaeppchen")?.playerName).toBe("Spieler billig");
  });

  /**
   * Ohne Mindestschwelle gewaenne „Mr. Zuverlaessig" der Spieler mit genau einem Auftritt: eine
   * einzelne Zahl schwankt nicht. Genau deshalb gibt es die Schwelle.
   */
  it("laesst Ein-Auftritt-Ausreisser nicht die Konstanz-Awards gewinnen", () => {
    const state = baueSpielstand([
      ...gleichmaessig("viele", 8, 10),
      { playerId: "einer", matchday: 1, disciplineId: "d2", score: 10 },
    ]);
    expect(awardVon(state, "zuverlaessig")?.playerName).toBe("Spieler viele");
    expect(awardVon(state, "big_match")?.playerName).not.toBe("Spieler einer");
  });

  it("vergibt einen Award gar nicht, statt ihn zu erfinden", () => {
    // Keine Transfers -> kein Neuzugang, kein Schnaeppchen. Ein leerer Award waere eine
    // Falschaussage; gar keiner ist die ehrliche Antwort.
    const state = baueSpielstand(gleichmaessig("a", 6, 10));
    expect(awardVon(state, "neuzugang")).toBeNull();
    expect(awardVon(state, "schnaeppchen")).toBeNull();
  });

  it("nennt zu jedem Award seine Bedingung — die Karte soll sich selbst erklaeren", () => {
    for (const award of buildLeagueSeasonAwards(baueSpielstand(gleichmaessig("a", 6, 10))).awards) {
      expect(award.bedingung.length, `${award.id} ohne Bedingung`).toBeGreaterThan(10);
      expect(award.label.length, `${award.id} ohne Titel`).toBeGreaterThan(3);
    }
  });

  it("zaehlt die gespielten Spieltage fuer die Beschriftung mit", () => {
    expect(buildLeagueSeasonAwards(baueSpielstand(gleichmaessig("a", 7, 10))).matchdaysPlayed).toBe(7);
  });

  it("die Mindestschwelle steht im Verhaeltnis zur Saison", () => {
    // 10 Spieltage à 2 Disziplinseiten = hoechstens ~20 Einsaetze; die Schwelle ist rund ein
    // Drittel davon. Zieht jemand die Saisonlaenge, soll das hier auffallen.
    expect(SEASON_AWARD_MIN_APPEARANCES).toBe(6);
  });
});

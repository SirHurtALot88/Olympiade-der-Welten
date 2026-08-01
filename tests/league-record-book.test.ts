/**
 * GEMELDET: „der rekorde tab ist noch tot da passiert fast gar nichts, keine interessanten
 * infos."
 *
 * Der Reiter hing komplett an `seasonSnapshots` — und die sind in Saison 1 leer. Nicht kaputt,
 * sondern wartend auf ein Archiv, das erst in zehn Spieltagen entsteht.
 *
 * Das Rekordbuch entsteht stattdessen aus dem, was jeder Spieltag ohnehin schreibt. Am echten
 * Spielstand (Saison 1, 10 Spieltage) sind alle sieben Marken sofort gesetzt:
 *
 *   Bester Einzelauftritt          151,2   Jasper Kane   · Gewichtheben · Spieltag 1
 *   Bester Spieltag eines Spielers 7,2 PPs Katniss       · Spieltag 1
 *   Bestes Team-Ergebnis           518,8   Project Suicide
 *   Knappster Disziplinsieg        0,80    Death Peaches · Tennis · Spieltag 5
 *   Hoechster Form-Schub           +160,9  Lost Kingdom  · Breaking · Spieltag 4
 *   Laengste Siegesserie           2 Spieltage   Project Suicide · Spieltag 1–2
 *   Laengste Top-10-Serie          3 Spieltage   Grok'Na · Spieltag 6–8
 *
 * „Knappster Disziplinsieg: 0,80" ist eine Geschichte, kein Verwaltungsdatum — genau das fehlte.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildLeagueRecordBook } from "@/lib/foundation/league-record-book";

type Eingabe = {
  matchday: number;
  teamId: string;
  playerId: string;
  disciplineId?: string;
  score: number;
  rank: number;
  isTop10?: boolean;
  formModifier?: number;
};

function spielstand(eingaben: Eingabe[]): GameState {
  const matchdays = [...new Set(eingaben.map((e) => e.matchday))].sort((a, b) => a - b);
  const spieler = [...new Set(eingaben.map((e) => e.playerId))];
  const teamIds = [...new Set(eingaben.map((e) => e.teamId))];

  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: matchdays.length, matchdayIds: matchdays.map((m) => `md-${m}`) },
    teams: teamIds.map((teamId) => ({ teamId, shortCode: teamId, name: `Team ${teamId}`, cash: 10 })),
    players: spieler.map((id) => ({ id, name: `Spieler ${id}` })),
    rosters: eingaben.map((e, index) => ({ id: `r${index}`, teamId: e.teamId, playerId: e.playerId, contractLength: 2 })),
    disciplines: [
      { id: "d1", name: "Kraft", category: "power" },
      { id: "d2", name: "Tempo", category: "speed" },
    ],
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
          eingaben.map((e) => {
            const disciplineId = e.disciplineId ?? "d1";
            return [
              `mr-${e.matchday}::${e.teamId}::${disciplineId}`,
              {
                id: `dr-${e.matchday}-${e.teamId}-${disciplineId}`,
                matchdayResultId: `mr-${e.matchday}`,
                teamId: e.teamId,
                disciplineId,
                disciplineSide: "d1",
                rank: e.rank,
                baseScore: e.score,
                totalScore: e.score,
                formModifier: e.formModifier ?? 0,
                readinessStatus: "ok",
                warnings: [],
              },
            ] as const;
          }),
        ).values(),
      ],
      playerDisciplinePerformances: eingaben.map((e, index) => ({
        id: `pdp-${index}`,
        matchdayResultId: `mr-${e.matchday}`,
        teamId: e.teamId,
        playerId: e.playerId,
        activePlayerId: e.playerId,
        disciplineId: e.disciplineId ?? "d1",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: e.score,
        finalPlayerScore: e.score,
        mutatorScoreBonus: 0,
        mutatorPpsBonus: 0,
        scoreContribution: e.score,
        rankInTeam: 1,
        rankInDiscipline: e.rank,
        isTop10: e.isTop10 ?? false,
        isMvpCandidate: false,
      })),
      lineupDrafts: [],
    },
    transferHistory: [],
  } as never;
}

const rekord = (state: GameState, id: string) => {
  const buch = buildLeagueRecordBook(state);
  return [...buch.spieltagsSuperlative, ...buch.serien].find((eintrag) => eintrag.id === id) ?? null;
};

describe("Rekordbuch: lebt ab dem ersten Spieltag, ohne Archiv", () => {
  it("setzt Marken, obwohl kein Snapshot existiert", () => {
    const buch = buildLeagueRecordBook(
      spielstand([{ matchday: 1, teamId: "A", playerId: "p1", score: 40, rank: 1 }]),
    );
    expect(buch.spieltagsSuperlative.length).toBeGreaterThan(0);
    expect(buch.matchdaysPlayed).toBe(1);
  });

  it("Bester Einzelauftritt: die hoechste Wertung eines Spielers", () => {
    const state = spielstand([
      { matchday: 1, teamId: "A", playerId: "p1", score: 40, rank: 1 },
      { matchday: 2, teamId: "B", playerId: "p2", score: 95, rank: 1, disciplineId: "d2" },
    ]);
    const treffer = rekord(state, "best-single-performance");
    expect(treffer?.halter).toBe("Spieler p2");
    expect(treffer?.displayValue).toBe("95,0");
    expect(treffer?.kontext).toContain("Tempo");
    expect(treffer?.kontext).toContain("Spieltag 2");
  });

  /**
   * Der Kern des Rekords: gruppiert wird ueber (Spieltag, Disziplin, Seite) — das ist EIN
   * Wettbewerb. Ohne diese Gruppierung laegen zwei getrennte Wettbewerbe in einem Topf und der
   * „Abstand" waere erfunden.
   */
  it("Knappster Disziplinsieg vergleicht nur INNERHALB eines Wettbewerbs", () => {
    const state = spielstand([
      // Spieltag 1, Disziplin d1: 100 gegen 99 -> Abstand 1.
      { matchday: 1, teamId: "A", playerId: "p1", score: 100, rank: 1 },
      { matchday: 1, teamId: "B", playerId: "p2", score: 99, rank: 2 },
      // Spieltag 2, Disziplin d2: 50 gegen 20 -> Abstand 30.
      { matchday: 2, teamId: "A", playerId: "p1", score: 50, rank: 1, disciplineId: "d2" },
      { matchday: 2, teamId: "B", playerId: "p2", score: 20, rank: 2, disciplineId: "d2" },
    ]);
    const treffer = rekord(state, "closest-discipline-win");
    expect(treffer?.displayValue).toBe("1,00");
    expect(treffer?.halter).toBe("Team A");
    expect(treffer?.kontext).toContain("Kraft");
  });

  it("braucht mindestens zwei Teilnehmer — ein Einzelstarter hat keinen Abstand", () => {
    const alleine = spielstand([{ matchday: 1, teamId: "A", playerId: "p1", score: 100, rank: 1 }]);
    expect(rekord(alleine, "closest-discipline-win")).toBeNull();
  });

  it("Form-Schub kommt vom TEAM — dort und nur dort gibt es ihn", () => {
    // `formModifier` existiert nur je Team und Disziplin. Ein Spieler-Form-Rekord waere erfunden.
    const state = spielstand([
      { matchday: 1, teamId: "A", playerId: "p1", score: 40, rank: 1, formModifier: 12 },
      { matchday: 2, teamId: "B", playerId: "p2", score: 40, rank: 1, formModifier: 3, disciplineId: "d2" },
    ]);
    const treffer = rekord(state, "best-form-boost");
    expect(treffer?.halter).toBe("Team A");
    expect(treffer?.displayValue).toBe("+12,0");
    expect(treffer?.playerId).toBeNull();
  });
});

describe("Rekordbuch: Serien zaehlen die REIHENFOLGE", () => {
  it("eine Luecke bricht die Serie", () => {
    const mitLuecke = spielstand(
      [1, 2, 5, 6, 7].map((matchday) => ({ matchday, teamId: "A", playerId: "p1", score: 40, rank: 1 })),
    );
    const treffer = rekord(mitLuecke, "longest-team-win-streak");
    expect(treffer?.displayValue).toBe("3 Spieltage"); // 5–7, nicht 5 insgesamt
  });

  it("markiert eine Serie als laufend, wenn sie bis zum letzten Spieltag reicht", () => {
    const laufend = spielstand(
      [1, 2, 3].map((matchday) => ({ matchday, teamId: "A", playerId: "p1", score: 40, rank: 1 })),
    );
    const treffer = rekord(laufend, "longest-team-win-streak");
    expect(treffer?.laeuftNoch).toBe(true);
    expect(treffer?.kontext).toContain("läuft");
  });

  it("nennt bei einer gebrochenen Serie den Zeitraum", () => {
    const gebrochen = spielstand([
      ...[1, 2, 3].map((matchday) => ({ matchday, teamId: "A", playerId: "p1", score: 40, rank: 1 })),
      // Spieltag 4 ohne Sieg fuer A — die Serie endet.
      { matchday: 4, teamId: "A", playerId: "p1", score: 5, rank: 7 },
    ]);
    const treffer = rekord(gebrochen, "longest-team-win-streak");
    expect(treffer?.laeuftNoch).toBe(false);
    expect(treffer?.kontext).toBe("Spieltag 1–3");
  });

  it("Top-10-Serie haengt am Spieler, nicht am Team", () => {
    const state = spielstand(
      [1, 2, 3, 4].map((matchday) => ({
        matchday,
        teamId: "A",
        playerId: "p1",
        score: 20,
        rank: 4,
        isTop10: true,
      })),
    );
    const treffer = rekord(state, "longest-player-top10-streak");
    expect(treffer?.halter).toBe("Spieler p1");
    expect(treffer?.playerId).toBe("p1");
    expect(treffer?.displayValue).toBe("4 Spieltage");
  });
});

describe("Rekordbuch: jeder Eintrag erklaert sich selbst", () => {
  it("nennt zu jeder Marke, was gemessen wird", () => {
    const buch = buildLeagueRecordBook(
      spielstand([
        { matchday: 1, teamId: "A", playerId: "p1", score: 40, rank: 1, isTop10: true, formModifier: 5 },
        { matchday: 1, teamId: "B", playerId: "p2", score: 30, rank: 2 },
      ]),
    );
    for (const eintrag of [...buch.spieltagsSuperlative, ...buch.serien]) {
      expect(eintrag.beschreibung.length, `${eintrag.id} ohne Beschreibung`).toBeGreaterThan(15);
      expect(eintrag.halter.length, `${eintrag.id} ohne Halter`).toBeGreaterThan(0);
      expect(eintrag.displayValue.length, `${eintrag.id} ohne Wert`).toBeGreaterThan(0);
    }
  });

  it("erfindet keine Marke, wenn es keine Daten gibt", () => {
    const leer = buildLeagueRecordBook(spielstand([]));
    expect(leer.spieltagsSuperlative).toHaveLength(0);
    expect(leer.serien).toHaveLength(0);
  });
});

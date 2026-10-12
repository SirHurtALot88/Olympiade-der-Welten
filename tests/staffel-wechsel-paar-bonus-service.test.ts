import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft, StaffelWechselPaarRecord } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import { rehydrateGameStateAfterCompactPut } from "@/lib/persistence/foundation-initial-compact-state";
import {
  buildStaffelPairGamesLookup,
  buildStaffelWechselPaarBonusByNehmer,
  getStaffelPairBondBonus,
  getStaffelPairGamesBefore,
  isStaffelPairEingespielt,
  listStaffelTeamsThatRan,
  readStaffelWechselPaare,
  resolveStaffelLegPlayerIds,
  STAFFEL_PAAR_BONUS_STUFEN,
  updateStaffelWechselPaareAfterMatchday,
} from "@/lib/season/staffel-wechsel-paar-bonus-service";

/**
 * STAFFEL O7 "EINGESPIELTE PAARE" — Zaehler, Bonus, Rohr zur Arena, Spielstand-Sicherheit.
 *
 * Kader: Team A-A mit p1..p6 (Kaderzeilen r1..r6), Team B-B mit q1..q3. Die Aufstellung traegt
 * wie im echten Spielstand `activePlayerId` = Kaderzeile (nie die Spieler-Id).
 */

const SAVE = "save-o7";

function draft(input: {
  teamId: string;
  seasonId: string;
  matchdayId: string;
  /** Spieler-Ids in SLOT-Reihenfolge; `null` laesst einen Slot frei. */
  staffel: (string | null)[];
  andere?: { disciplineId: string; playerId: string }[];
}): LineupDraft {
  const zeile = (playerId: string) => `r-${playerId}`;
  return {
    lineupId: `lineup-${input.teamId}-${input.matchdayId}`,
    saveId: SAVE,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    teamId: input.teamId,
    status: "draft",
    entries: [
      ...(input.andere ?? []).map((eintrag, slotIndex) => ({
        disciplineId: eintrag.disciplineId,
        disciplineSide: "d1" as const,
        slotIndex,
        playerId: eintrag.playerId,
        activePlayerId: zeile(eintrag.playerId),
      })),
      ...input.staffel.flatMap((playerId, slotIndex) =>
        playerId
          ? [{ disciplineId: "staffel", disciplineSide: "d2" as const, slotIndex, playerId, activePlayerId: zeile(playerId) }]
          : [],
      ),
    ],
    createdAt: "2026-10-11T00:00:00.000Z",
    updatedAt: "2026-10-11T00:00:00.000Z",
  };
}

function gameState(input: { drafts: LineupDraft[]; paare?: StaffelWechselPaarRecord[] | undefined; ohneFeld?: boolean }): GameState {
  const spieler = [
    ...["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => ({ id, name: `Name ${id}`, teamId: "A-A" })),
    ...["q1", "q2", "q3"].map((id) => ({ id, name: `Name ${id}`, teamId: "B-B" })),
  ];
  return {
    players: spieler.map(({ id, name }) => ({ id, name })),
    rosters: spieler.map(({ id, teamId }) => ({ id: `r-${id}`, playerId: id, teamId })),
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      lineupDrafts: input.drafts,
      ...(input.ohneFeld ? {} : { staffelWechselPaare: input.paare }),
    },
  } as unknown as GameState;
}

const md = (n: number) => `season-2-matchday-${n}`;

/** Ein Spieltag: Aufstellung setzen, Zaehler fortschreiben. */
function spiele(
  gs: GameState,
  input: { seasonId?: string; matchdayId: string; aufstellungen: Record<string, (string | null)[]>; gelaufen?: string[] },
): GameState {
  const seasonId = input.seasonId ?? "season-2";
  const drafts = Object.entries(input.aufstellungen).map(([teamId, staffel]) =>
    draft({ teamId, seasonId, matchdayId: input.matchdayId, staffel }),
  );
  const mitAufstellung = {
    ...gs,
    seasonState: { ...gs.seasonState, lineupDrafts: [...(gs.seasonState.lineupDrafts ?? []), ...drafts] },
  } as GameState;
  return updateStaffelWechselPaareAfterMatchday(mitAufstellung, {
    saveId: SAVE,
    seasonId,
    matchdayId: input.matchdayId,
    teamIds: input.gelaufen ?? Object.keys(input.aufstellungen),
    now: `2026-10-11T00:00:0${input.matchdayId.slice(-1)}.000Z`,
  });
}

const paarVon = (gs: GameState, teamId: string) =>
  Object.fromEntries(
    readStaffelWechselPaare(gs)
      .filter((record) => record.teamId === teamId)
      .map((record) => [`${record.geberPlayerId}>${record.nehmerPlayerId}`, record.gamesTogether]),
  );

describe("Staffel O7 — Bonusstufen", () => {
  it("drei Stufen bis +0,10, eingespielt ab drei gemeinsamen Spielen", () => {
    expect(STAFFEL_PAAR_BONUS_STUFEN).toEqual([0, 0.03, 0.06, 0.1]);
    expect([0, 1, 2, 3, 4, 12].map(getStaffelPairBondBonus)).toEqual([0, 0.03, 0.06, 0.1, 0.1, 0.1]);
    expect([0, 1, 2, 3, 9].map(isStaffelPairEingespielt)).toEqual([false, false, false, true, true]);
  });

  it("kaputte Zahlen aus einem Spielstand ergeben Bonus 0, nie einen Fehler", () => {
    for (const roh of [Number.NaN, -3, Number.POSITIVE_INFINITY, undefined as unknown as number]) {
      expect(getStaffelPairBondBonus(roh)).toBe(0);
      expect(isStaffelPairEingespielt(roh)).toBe(false);
    }
  });
});

describe("Staffel O7 — Bein-Reihenfolge und Spieler-Identitaet", () => {
  it("ordnet nach slotIndex, loest activePlayerId ueber die Kaderzeile auf, ignoriert andere Disziplinen", () => {
    const d = draft({
      teamId: "A-A",
      seasonId: "season-2",
      matchdayId: md(2),
      staffel: ["p3", "p1", null, "p2"],
      andere: [{ disciplineId: "tennis", playerId: "p6" }],
    });
    // Entwurfsreihenfolge absichtlich vertauscht: die Slot-Nummer entscheidet, nicht die Liste.
    d.entries.reverse();
    expect(resolveStaffelLegPlayerIds(gameState({ drafts: [d] }), d)).toEqual(["p3", "p1", "p2"]);
  });

  it("die Spieler-Id kommt aus der Kaderzeile, wenn beide auseinanderfallen", () => {
    const d = draft({ teamId: "A-A", seasonId: "season-2", matchdayId: md(2), staffel: ["p1", "p2"] });
    d.entries[0] = { ...d.entries[0]!, playerId: "veraltet", activePlayerId: "r-p4" };
    expect(resolveStaffelLegPlayerIds(gameState({ drafts: [d] }), d)).toEqual(["p4", "p2"]);
  });

  it("unbekannte Spieler fallen heraus statt die Nachbarschaft zu verfaelschen", () => {
    const d = draft({ teamId: "A-A", seasonId: "season-2", matchdayId: md(2), staffel: ["p1", "geist", "p2"] });
    d.entries[1] = { ...d.entries[1]!, activePlayerId: null };
    expect(resolveStaffelLegPlayerIds(gameState({ drafts: [d] }), d)).toEqual(["p1", "p2"]);
  });
});

describe("Staffel O7 — Zaehler fortschreiben", () => {
  it("zaehlt gleiche Paare hoch, setzt bei neuer Reihenfolge zurueck, laesst andere Teams in Ruhe", () => {
    let gs = gameState({ drafts: [], ohneFeld: true });
    gs = spiele(gs, { matchdayId: md(1), aufstellungen: { "A-A": ["p1", "p2", "p3", "p4"], "B-B": ["q1", "q2"] } });
    expect(paarVon(gs, "A-A")).toEqual({ "p1>p2": 1, "p2>p3": 1, "p3>p4": 1 });
    expect(paarVon(gs, "B-B")).toEqual({ "q1>q2": 1 });

    gs = spiele(gs, { matchdayId: md(2), aufstellungen: { "A-A": ["p1", "p2", "p3", "p4"] } });
    gs = spiele(gs, { matchdayId: md(3), aufstellungen: { "A-A": ["p1", "p2", "p3", "p4"] } });
    expect(paarVon(gs, "A-A")).toEqual({ "p1>p2": 3, "p2>p3": 3, "p3>p4": 3 });
    // B-B ist an Spieltag 2 und 3 nicht gelaufen: sein Paar bleibt stehen, nichts wird zurueckgesetzt.
    expect(paarVon(gs, "B-B")).toEqual({ "q1>q2": 1 });

    // Neue Reihenfolge: p3 und p4 getauscht, p5 kommt fuer p1 (Kaderwechsel/Bank).
    gs = spiele(gs, { matchdayId: md(4), aufstellungen: { "A-A": ["p5", "p2", "p4", "p3"] } });
    expect(paarVon(gs, "A-A")).toEqual({ "p5>p2": 1, "p2>p4": 1, "p4>p3": 1 });
  });

  it("ein Paar ist gerichtet: aus p1>p2 wird bei p2>p1 kein Weiterzaehlen", () => {
    let gs = gameState({ drafts: [] });
    gs = spiele(gs, { matchdayId: md(1), aufstellungen: { "A-A": ["p1", "p2"] } });
    gs = spiele(gs, { matchdayId: md(2), aufstellungen: { "A-A": ["p2", "p1"] } });
    expect(paarVon(gs, "A-A")).toEqual({ "p2>p1": 1 });
  });

  it("ist idempotent je Spieltag (D1-Commit, dann D2-Commit; forceReplace)", () => {
    let gs = gameState({ drafts: [] });
    gs = spiele(gs, { matchdayId: md(1), aufstellungen: { "A-A": ["p1", "p2", "p3"] } });
    gs = spiele(gs, { matchdayId: md(2), aufstellungen: { "A-A": ["p1", "p2", "p3"] } });
    const einmal = gs;
    const zweimal = updateStaffelWechselPaareAfterMatchday(einmal, {
      saveId: SAVE,
      seasonId: "season-2",
      matchdayId: md(2),
      teamIds: ["A-A"],
      now: "2026-12-31T00:00:00.000Z",
    });
    expect(JSON.stringify(zweimal.seasonState.staffelWechselPaare)).toBe(JSON.stringify(einmal.seasonState.staffelWechselPaare));
    expect(paarVon(zweimal, "A-A")).toEqual({ "p1>p2": 2, "p2>p3": 2 });
  });

  it("traegt ueber den Saisonwechsel (die Staffel laeuft nur ein- bis zweimal je Saison)", () => {
    let gs = gameState({ drafts: [] });
    gs = spiele(gs, { seasonId: "season-1", matchdayId: "matchday-2", aufstellungen: { "A-A": ["p1", "p2"] } });
    gs = spiele(gs, { seasonId: "season-2", matchdayId: md(2), aufstellungen: { "A-A": ["p1", "p2"] } });
    gs = spiele(gs, { seasonId: "season-3", matchdayId: "season-3-matchday-7", aufstellungen: { "A-A": ["p1", "p2"] } });
    expect(paarVon(gs, "A-A")).toEqual({ "p1>p2": 3 });
  });

  it("ohne gelaufene Staffel bleibt der gameState derselbe — ein Stand ohne Staffel bekommt kein Feld", () => {
    const gs = gameState({ drafts: [draft({ teamId: "A-A", seasonId: "season-2", matchdayId: md(1), staffel: [] })], ohneFeld: true });
    const keinTeam = updateStaffelWechselPaareAfterMatchday(gs, { saveId: SAVE, seasonId: "season-2", matchdayId: md(1), teamIds: [] });
    expect(keinTeam).toBe(gs);
    const ohneLaeufer = updateStaffelWechselPaareAfterMatchday(gs, { saveId: SAVE, seasonId: "season-2", matchdayId: md(1), teamIds: ["A-A"] });
    expect(ohneLaeufer).toBe(gs);
    expect("staffelWechselPaare" in ohneLaeufer.seasonState).toBe(false);
  });

  it("Einzellaeufer: kein Paar hat gewechselt, also verfallen die alten Eintraege des Teams", () => {
    let gs = gameState({ drafts: [] });
    gs = spiele(gs, { matchdayId: md(1), aufstellungen: { "A-A": ["p1", "p2"] } });
    gs = spiele(gs, { matchdayId: md(2), aufstellungen: { "A-A": ["p1"] } });
    expect(paarVon(gs, "A-A")).toEqual({});
  });

  it("verwirft unlesbare Alt-Eintraege beim Lesen und raeumt sie beim naechsten Schreiben des Teams weg", () => {
    const muell = [null, 42, { teamId: "A-A" }, { teamId: "A-A", geberPlayerId: "p1", nehmerPlayerId: "p1" }] as unknown as StaffelWechselPaarRecord[];
    let gs = gameState({ drafts: [], paare: muell });
    expect(readStaffelWechselPaare(gs)).toEqual([]);
    gs = spiele(gs, { matchdayId: md(1), aufstellungen: { "A-A": ["p1", "p2"] } });
    expect(gs.seasonState.staffelWechselPaare).toHaveLength(1);
  });
});

describe("Staffel O7 — Bonus vor dem Spiel", () => {
  it("zaehlt das eigene Spiel nicht mit, wenn es schon gebucht ist (Replay liefert denselben Bonus)", () => {
    const record = { gamesTogether: 3, seasonId: "season-2", lastMatchdayId: md(4) };
    expect(getStaffelPairGamesBefore(record, { seasonId: "season-2", matchdayId: md(4) })).toBe(2);
    expect(getStaffelPairGamesBefore(record, { seasonId: "season-2", matchdayId: md(9) })).toBe(3);
    // Saison 1 hat Spieltage ohne Saisonpraefix — derselbe Name in einer anderen Saison ist ein anderes Spiel.
    expect(getStaffelPairGamesBefore(record, { seasonId: "season-3", matchdayId: md(4) })).toBe(3);
  });

  it("liefert je Nehmer den Bonus der Paare, die in DIESER Aufstellung benachbart stehen", () => {
    let gs = gameState({ drafts: [] });
    for (const n of [1, 2, 3]) gs = spiele(gs, { matchdayId: md(n), aufstellungen: { "A-A": ["p1", "p2", "p3"] } });
    gs = spiele(gs, { matchdayId: md(4), aufstellungen: { "A-A": ["p1", "p2", "p4"] } });
    // Stand: p1>p2 = 4 Spiele, p2>p4 = 1 Spiel. Naechstes Spiel: p1, p2, p4, p3.
    const naechste = draft({ teamId: "A-A", seasonId: "season-2", matchdayId: md(5), staffel: ["p1", "p2", "p4", "p3"] });
    const bonus = buildStaffelWechselPaarBonusByNehmer(gs, naechste);
    expect([...bonus.keys()]).toEqual(["p2", "p4"]);
    expect(bonus.get("p2")).toMatchObject({ geberPlayerId: "p1", gamesBefore: 4, bonus: 0.1, eingespielt: true });
    expect(bonus.get("p4")).toMatchObject({ geberPlayerId: "p2", gamesBefore: 1, bonus: 0.03, eingespielt: false });
    // Die Einsatzliste bekommt dieselben Zahlen, unabhaengig von der Auswahl.
    expect(buildStaffelPairGamesLookup(gs, { teamId: "A-A", seasonId: "season-2", matchdayId: md(5) })).toEqual({
      "p1>p2": 4,
      "p2>p4": 1,
    });
  });

  it("nur Teams mit Antritts-Status gelten als gelaufen", () => {
    const zeile = (teamId: string, readinessStatus: string, disciplineId = "staffel", matchdayResultId = "mr-1") =>
      ({ teamId, disciplineId, readinessStatus, matchdayResultId }) as never;
    expect(
      listStaffelTeamsThatRan(
        [
          zeile("A-A", "ready"),
          zeile("B-B", "underfilled_roster"),
          zeile("C-C", "missing_lineup"),
          zeile("D-D", "invalid_lineup"),
          zeile("E-E", "ready", "tennis"),
          zeile("F-F", "ready", "staffel", "mr-alt"),
        ],
        { matchdayResultId: "mr-1" },
      ).sort(),
    ).toEqual(["A-A", "B-B"]);
  });
});

describe("Staffel O7 — Rohr zur Arena (buildArenaAufstellung)", () => {
  const naechste = draft({ teamId: "A-A", seasonId: "season-2", matchdayId: md(5), staffel: ["p1", "p2", "p3"] });

  it("ein Spielstand OHNE das Feld (jeder Stand vor O7) liefert exakt die alte Aufstellung", () => {
    const ohne = buildArenaAufstellung(gameState({ drafts: [naechste], ohneFeld: true }), "A-A", md(5));
    const leer = buildArenaAufstellung(gameState({ drafts: [naechste], paare: [] }), "A-A", md(5));
    expect(ohne).toStrictEqual({
      "Name p1": { d: "staffel", slot: "startrunner" },
      "Name p2": { d: "staffel", slot: "tempolink" },
      "Name p3": { d: "staffel", slot: "batontech" },
    });
    expect(leer).toStrictEqual(ohne);
  });

  it("mit Paar-Geschichte faehrt der Bonus am Nehmer mit, samt erwartetem Geber", () => {
    let gs = gameState({ drafts: [] });
    for (const n of [1, 2, 3]) gs = spiele(gs, { matchdayId: md(n), aufstellungen: { "A-A": ["p1", "p2", "p4"] } });
    gs = { ...gs, seasonState: { ...gs.seasonState, lineupDrafts: [naechste] } } as GameState;
    expect(buildArenaAufstellung(gs, "A-A", md(5))).toStrictEqual({
      "Name p1": { d: "staffel", slot: "startrunner" },
      "Name p2": { d: "staffel", slot: "tempolink", wechselPaarBonus: 0.1, wechselPaarGeber: "Name p1", wechselPaarEingespielt: true },
      "Name p3": { d: "staffel", slot: "batontech" },
    });
  });
});

describe("Staffel O7 — Spielstand-Sicherheit beim Speichern aus dem Browser", () => {
  it("der Paar-Zaehler des Spielstands gewinnt gegen einen veralteten Browser-Stand", () => {
    let server = gameState({ drafts: [] });
    server = spiele(server, { matchdayId: md(1), aufstellungen: { "A-A": ["p1", "p2"] } });
    server = { ...server, players: [], teams: [], logs: [], transferHistory: [] } as unknown as GameState;
    const browser = { ...server, seasonState: { ...server.seasonState, staffelWechselPaare: [] } } as GameState;
    const gespeichert = rehydrateGameStateAfterCompactPut(server, browser);
    expect(gespeichert.seasonState.staffelWechselPaare).toEqual(server.seasonState.staffelWechselPaare);
  });

  it("ein Stand ohne das Feld bleibt ohne Wert", () => {
    const server = { ...gameState({ drafts: [], ohneFeld: true }), players: [], teams: [], logs: [], transferHistory: [] } as unknown as GameState;
    const gespeichert = rehydrateGameStateAfterCompactPut(server, server);
    expect(gespeichert.seasonState.staffelWechselPaare).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import {
  baueAbgeleiteteEntscheidungen,
  inboxEintragIstDoppelt,
  bestesHeimspiel,
  einsatzStatus,
  spielerDerSaison,
  spielerDesTages,
} from "@/lib/foundation/startseite-modern-zustand";

type GS = Parameters<typeof einsatzStatus>[0];

function stand(extra: Record<string, unknown> = {}): GS {
  const seasonState = {
    disciplineSchedule: [
      { seasonId: "s1", matchdayId: "m2", discipline1: { disciplineId: "hockey", playerCount: 4 }, discipline2: { disciplineId: "tennis", playerCount: 2 } },
    ],
    lineupDrafts: [
      {
        seasonId: "s1",
        matchdayId: "m2",
        teamId: "A",
        status: "draft",
        entries: [
          { disciplineId: "hockey", disciplineSide: "d1", slotIndex: 0, playerId: "p1" },
          { disciplineId: "hockey", disciplineSide: "d1", slotIndex: 1, playerId: "p2" },
          { disciplineId: "hockey", disciplineSide: "d1", slotIndex: 2, playerId: "p3" },
          { disciplineId: "tennis", disciplineSide: "d2", slotIndex: 0, playerId: "p4" },
        ],
        modifiers: { d1: { primaryFormCardId: "c1" }, d2: {} },
      },
    ],
    formCards: [
      { id: "c1", seasonId: "s1", teamId: "A", cardColor: "green", cardValue: 8 },
      { id: "c2", seasonId: "s1", teamId: "A", cardColor: "red", cardValue: -4 },
    ],
    formCardPlans: [],
    matchdayResults: [{ id: "r1", seasonId: "s1", matchdayId: "m1", status: "preview_applied" }],
    disciplineResults: [
      { matchdayResultId: "r1", teamId: "A", disciplineId: "hockey", teamPoints: 2 },
      { matchdayResultId: "r1", teamId: "A", disciplineId: "tennis", teamPoints: 2 },
    ],
    playerDisciplinePerformances: [
      { matchdayResultId: "r1", teamId: "A", playerId: "p1", disciplineId: "hockey", rankInTeam: 1, scoreContribution: 9 },
      { matchdayResultId: "r1", teamId: "A", playerId: "p4", disciplineId: "tennis", rankInTeam: 1, scoreContribution: 12 },
    ],
    schedule: [{ matchdayId: "m1", homeTeamId: "A", awayTeamId: "B", fixtureId: "f1" }],
    ...extra,
  };
  return {
    season: { id: "s1", matchdayIds: ["m1", "m2", "m3"], name: "Season 1", currentMatchday: 2 },
    matchdayState: { matchdayId: "m2" },
    teams: [{ teamId: "A" }, { teamId: "B" }],
    players: [
      { id: "p1", name: "Kati" },
      { id: "p4", name: "Lexa" },
      { id: "p9", name: "Abe" },
    ],
    disciplines: [{ id: "hockey", name: "Hockey" }, { id: "tennis", name: "Tennis" }],
    rosters: [
      { teamId: "A", playerId: "p1", contractLength: 3, contractEndSeasonNumber: 4 },
      { teamId: "A", playerId: "p9", contractLength: 1, contractEndSeasonNumber: 1 },
    ],
    seasonState,
  } as unknown as GS;
}

describe("Startseite Runde 2: Einsatzliste und Formkarte je Disziplin-Seite", () => {
  it("zählt gesetzte Plätze je Seite aus dem Entwurf des laufenden Spieltags", () => {
    const e = einsatzStatus(stand(), "A", "m2")!;
    expect(e.d1).toMatchObject({ gesetzt: 3, benoetigt: 4 });
    expect(e.d2).toMatchObject({ gesetzt: 1, benoetigt: 2 });
    expect(e.offenePlaetze).toBe(2);
    expect(e.hatFormkartenPool).toBe(true);
  });

  it("liest die gelegte Formkarte der Seite, sonst bleibt die Liste leer", () => {
    const e = einsatzStatus(stand(), "A", "m2")!;
    expect(e.d1.formkarten).toEqual(["Speed +8"]);
    expect(e.d2.formkarten).toEqual([]);
  });

  it("fällt auf den Formplan zurück", () => {
    const gs = stand({
      lineupDrafts: [],
      formCardPlans: [{ teamId: "A", matchdayId: "m2", disciplineSide: "d2", primaryFormCardId: "c2" }],
    });
    expect(einsatzStatus(gs, "A", "m2")!.d2.formkarten).toEqual(["Power −4"]);
  });

  it("gehört der Entwurf nicht zum gezeigten Spieltag, gibt es keinen Status", () => {
    expect(einsatzStatus(stand(), "A", "m3")).toBeNull();
  });
});

describe("Startseite Runde 2: Entscheidungen aus dem echten Zustand", () => {
  const gs = stand();
  const e = einsatzStatus(gs, "A", "m2");
  const liste = baueAbgeleiteteEntscheidungen({
    gameState: gs,
    teamId: "A",
    einsatz: e,
    formMoral: { p1: { moral: 72 }, p9: { moral: 31 } },
    gespielteSpieltage: 1,
    gesamtSpieltage: 3,
    saisonEnde: false,
  });

  it("Einsatzliste unvollständig mit Zahlen und Sprungziel", () => {
    const z = liste.find((x) => x.id === "einsatzliste")!;
    expect(z.titel).toBe("Einsatzliste unvollständig");
    expect(z.detail).toBe("4 von 6 Plätzen gesetzt · 2 offen");
    expect(z.ziel).toEqual({ art: "einsatzliste" });
  });

  it("Pflicht-Minuskarte offen, dringend ab 3 verbleibenden Spieltagen", () => {
    const z = liste.find((x) => x.id === "minuskarte")!;
    expect(z.titel).toBe("Pflicht-Minuskarte offen");
    expect(z.ton).toBe("rot");
    expect(z.detail).toContain("noch 2 Spieltage");
  });

  it("Spieler verärgert nur unter Moral 40, mit Spieltagen ohne Einsatz", () => {
    const z = liste.find((x) => x.id === "moral-p9")!;
    expect(z.titel).toBe("Abe verärgert");
    expect(z.detail).toBe("Moral 31 · 1 Spieltag ohne Einsatz");
    expect(z.ziel).toEqual({ art: "spieler", playerId: "p9" });
    expect(liste.some((x) => x.id === "moral-p1")).toBe(false);
  });

  it("Vertrag läuft aus, wenn die Endsaison die laufende Saison ist", () => {
    const z = liste.find((x) => x.id === "vertraege")!;
    expect(z.titel).toBe("Vertrag Abe läuft aus");
  });
});

describe("Startseite Runde 2: Spieler des Tages, der Saison, bestes Heimspiel", () => {
  it("Spieler des Tages: gewonnener Einsatz, bester des Teams, höchster Beitrag", () => {
    expect(spielerDesTages(stand(), "A", "m1")).toMatchObject({ playerId: "p4", name: "Lexa" });
    expect(spielerDesTages(stand(), "A", "m2")).toBeNull();
  });

  it("Spieler der Saison aus der Matchwinner-Liste", () => {
    expect(spielerDerSaison(stand(), "A")?.name).toBe("Kati");
  });

  it("Bestes Heimspiel nur mit gespeicherter Heim/Auswärts-Zuordnung", () => {
    expect(bestesHeimspiel(stand(), "A")).toMatchObject({ spieltag: 1, punkte: 4, moeglich: 4, gegnerId: "B" });
    expect(bestesHeimspiel(stand({ schedule: [] }), "A")).toBeNull();
  });
});

describe("Startseite: ein Eintrag je Sache in den Entscheidungen", () => {
  const abgeleitet = [
    { id: "einsatzliste", titel: "Einsatzliste leer" },
    { id: "minuskarte", titel: "2 Pflicht-Minuskarten offen" },
  ];
  it("Inbox-Eintrag „Lineup fehlt“ entfällt, wenn „Einsatzliste leer“ schon dasteht", () => {
    expect(inboxEintragIstDoppelt("Lineup fehlt", abgeleitet)).toBe(true);
    expect(inboxEintragIstDoppelt("Einsatzliste unvollständig", abgeleitet)).toBe(true);
  });
  it("gleicher Titel und Minuskarten-Meldung sind Dubletten, andere Sachen nicht", () => {
    expect(inboxEintragIstDoppelt("2 Pflicht-Minuskarten offen", abgeleitet)).toBe(true);
    expect(inboxEintragIstDoppelt("Board-Ziel verfehlt: Ausbeute", abgeleitet)).toBe(false);
  });
  it("ohne abgeleitete Einsatzliste bleibt die Inbox-Meldung stehen", () => {
    expect(inboxEintragIstDoppelt("Lineup fehlt", [{ id: "vertraege", titel: "6 Verträge laufen aus" }])).toBe(false);
  });
});

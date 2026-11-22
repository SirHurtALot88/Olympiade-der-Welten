/**
 * KI-MERKLISTE (Chris, 21.11., Runde 2): jedes KI-Team fuehrt eine Liste von Spielern des Transfermarkts UND anderer Teams
 * (nie der eigenen), ohne Listen-Limit; begrenzt ist nur das Scouting, und zwar mit derselben Queue wie beim Menschen.
 *
 * Geprueft wird die Wirkung: die Liste ist deterministisch, enthaelt freie und fremde Spieler, stuft nach dem Vorsprung und
 * liegt im Speicher der Wunschliste (`transferWishlist` mit `ki`); die Scouting-Plaetze sind begrenzt wie beim Menschen und
 * nach Stufe belegt; alte `kiMerkliste`-Staende laden weiter. Die Meldung „Interesse an einem Spieler" entsteht je Manager
 * getrennt, nicht doppelt je Spieltag, nur fuer Spieler menschlicher Teams, haelt den Spieltag nie auf und nennt keine Werte.
 */
import { describe, expect, it } from "vitest";

import { aktualisiereKiMerkliste, berechneKiMerklisteFuerTeam, istKiTeam } from "@/lib/ai/ki-merkliste";
import { KI_MERKLISTE_TECHNIK_MAX, kiInteresseAnSpieler, kiMerklisteFuerTeam } from "@/lib/ai/ki-merkliste-lesen";
import { getScoutingWishlistQueue } from "@/lib/scouting/scouting-wishlist-slots";
import type { GameInboxItem, GameState, KiMerklisteEintrag, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";
import { absenderFuerMeldung, baueModell, haeltSpieltagAuf } from "@/lib/foundation/inbox-postfach";

function makeTeam(teamId: string, name: string, humanControlled: boolean, cash = 200): Team {
  return { teamId, shortCode: teamId, name, budget: 325, cash, identityId: teamId, humanControlled, rosterLimit: 12, logoPath: null } as Team;
}

function makePlayer(id: string, pow: number, disciplineRating: number): Player {
  return {
    id,
    name: `Spieler ${id}`,
    rating: 50,
    marketValue: 10,
    salaryDemand: 2,
    pps: null,
    ovr: null,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { "d-1": disciplineRating, "d-2": 30 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 10,
    form: 0,
    potential: 0,
    trainingMode: "mittel",
    currentXP: 0,
    injuryStatus: "healthy",
  } as Player;
}

function control(teamId: string, modus: "manual" | "ai", ownerId: string, label: string) {
  return {
    teamId,
    controlMode: modus,
    ownerId,
    ownerSlot: "user" as const,
    displayLabel: label,
    aiLineupPreviewEnabled: false,
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: false,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: false,
    aiSellAutoApplyEnabled: false,
  };
}

/** Zwei Menschen (M-M Chris, B-B Franky) und ein KI-Team K-K mit einem schwachen Kader, dazu starke Spieler bei den Menschen. */
function makeGameState(extra?: (state: GameState) => void): GameState {
  const players: Player[] = [];
  const rosters: Array<{ id: string; teamId: string; playerId: string; contractLength: number; salary: number }> = [];
  const sitze: Array<[string, number, number]> = [];
  // 9 starke Spieler bei Chris, 9 bei Franky, 8 schwache beim KI-Team.
  for (let i = 0; i < 9; i += 1) sitze.push([`m${i}`, 80, 85]);
  for (let i = 0; i < 9; i += 1) sitze.push([`b${i}`, 75, 80]);
  for (let i = 0; i < 8; i += 1) sitze.push([`k${i}`, 30, 20]);
  // 10 freie Spieler (ohne Kader): starke Marktspieler, die auch die Kaufbewertung des KI-Teams anspricht.
  for (let i = 0; i < 10; i += 1) players.push(makePlayer(`f${i}`, 70, 75));
  for (const [id, pow, rating] of sitze) {
    players.push(makePlayer(id, pow, rating));
    const teamId = id.startsWith("m") ? "M-M" : id.startsWith("b") ? "B-B" : "K-K";
    rosters.push({ id: `r-${id}`, teamId, playerId: id, contractLength: 2, salary: 2 });
  }
  const state = {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2028, currentMatchday: 2, matchdayIds: ["season-2-matchday-1", "season-2-matchday-2", "season-2-matchday-3"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: {
        "M-M": control("M-M", "manual", "user_local", "Chris"),
        "B-B": control("B-B", "manual", "franky_remote_placeholder", "Franky"),
        "K-K": control("K-K", "ai", "ai", "KI"),
      },
    },
    matchdayState: { matchdayId: "season-2-matchday-2", status: "open", resolvedFixtureIds: ["season-2-matchday-1"] },
    teams: [makeTeam("M-M", "Mayhem Mavericks", true), makeTeam("B-B", "Blazing Beasts", true), makeTeam("K-K", "Kalte Kraken", false, 400)],
    players,
    rosters,
    disciplines: [
      { id: "d-1", name: "Eishockey", category: "power", weight: 1 },
      { id: "d-2", name: "Fechten", category: "speed", weight: 1 },
    ],
    transferHistory: [],
    teamIdentities: [],
  } as unknown as GameState;
  extra?.(state);
  return state;
}

function inboxFuer(state: GameState, activeTeamId: string, ownerId: string): GameInboxItem[] {
  return buildGameInboxItems({
    saveId: "save-1",
    gameState: state,
    activeTeamId,
    activeOwnerId: ownerId,
    hostMode: false,
    createdAt: new Date().toISOString(),
  });
}

function eintrag(playerId: string, besitzer: string, stufe: 1 | 2 | 3 = 2): KiMerklisteEintrag {
  return { playerId, besitzerTeamId: besitzer, stufe, vorsprung: 10, disziplinId: "d-1", abgedeckt: 0, seit: "season-2-matchday-1", stand: "season-2-matchday-2" };
}

describe("KI-Merkliste: Berechnung", () => {
  it("ist deterministisch, enthaelt freie UND fremde Spieler, nie eigene, und hat kein 6er-Limit", () => {
    const state = makeGameState();
    const a = berechneKiMerklisteFuerTeam(state, "K-K");
    const b = berechneKiMerklisteFuerTeam(makeGameState(), "K-K");
    expect(a).toEqual(b);
    // 18 starke Spieler bei den Menschen + 10 freie: deutlich mehr als die frueheren sechs
    expect(a.length).toBeGreaterThan(6);
    expect(a.length).toBeLessThanOrEqual(KI_MERKLISTE_TECHNIK_MAX);
    const eigene = new Set(state.rosters.filter((r) => r.teamId === "K-K").map((r) => r.playerId));
    for (const zeile of a) {
      expect(eigene.has(zeile.playerId)).toBe(false);
      expect(zeile.besitzerTeamId).not.toBe("K-K");
      expect([1, 2, 3]).toContain(zeile.stufe);
    }
    const markt = a.filter((zeile) => zeile.besitzerTeamId === null);
    const fremde = a.filter((zeile) => zeile.besitzerTeamId !== null);
    expect(markt.length).toBeGreaterThan(0);
    expect(fremde.length).toBeGreaterThan(0);
    for (const zeile of markt) expect(zeile.playerId.startsWith("f")).toBe(true);
    // absteigend nach Vorsprung, der erste ist immer Stufe 3
    for (let i = 1; i < a.length; i += 1) expect(a[i - 1]!.vorsprung).toBeGreaterThanOrEqual(a[i]!.vorsprung);
    expect(a[0]!.stufe).toBe(3);
  });

  it("nimmt nur Spieler, die das Team bezahlen koennte", () => {
    const arm = makeGameState((s) => {
      s.teams = s.teams.map((t) => (t.teamId === "K-K" ? ({ ...t, cash: 0 } as Team) : t));
    });
    expect(berechneKiMerklisteFuerTeam(arm, "K-K")).toEqual([]);
  });

  it("aktualisiereKiMerkliste schreibt in die Wunschliste des KI-Teams (nur KI-Teams), traegt `seit` fort", () => {
    const state = makeGameState();
    expect(istKiTeam(state, "K-K")).toBe(true);
    expect(istKiTeam(state, "M-M")).toBe(false);
    const eins = aktualisiereKiMerkliste(state, "save-1");
    const zeilen = eins.seasonState.transferWishlist ?? [];
    expect(zeilen.length).toBeGreaterThan(6);
    expect(zeilen.every((z) => z.teamId === "K-K" && z.ki && z.saveId === "save-1")).toBe(true);
    expect(eins.seasonState.kiMerkliste).toBeUndefined();
    expect(eins.seasonState.kiMerklisteStand).toEqual({ seasonId: "season-2", matchdayId: "season-2-matchday-2" });
    const spaeter: GameState = { ...eins, matchdayState: { ...eins.matchdayState, matchdayId: "season-2-matchday-3" } };
    const zwei = aktualisiereKiMerkliste(spaeter, "save-1");
    const alt = kiMerklisteFuerTeam(eins, "K-K");
    const neu = kiMerklisteFuerTeam(zwei, "K-K");
    expect(neu.map((z) => z.playerId).sort()).toEqual(alt.map((z) => z.playerId).sort());
    expect(neu.every((z) => z.seit === "season-2-matchday-2" && z.stand === "season-2-matchday-3")).toBe(true);
    // keine Dopplung bei erneutem Lauf
    expect((zwei.seasonState.transferWishlist ?? []).length).toBe(zeilen.length);
  });

  it("die Wunschliste des Menschen bleibt unberuehrt, ein Handeintrag des KI-Teams geht vor", () => {
    const mensch = { id: "w-mensch", saveId: "save-1", seasonId: "season-2", playerId: "f0", playerName: "x", className: "", race: "", marketValue: 1, salary: 1, bracket: null, teamId: "M-M", createdAt: "2028-01-01T00:00:00.000Z", priorityRank: 0 };
    const hand = { ...mensch, id: "w-hand", playerId: "f1", teamId: "K-K" };
    const state = makeGameState((s) => {
      s.seasonState.transferWishlist = [mensch, hand];
    });
    const neu = aktualisiereKiMerkliste(state, "save-1").seasonState.transferWishlist ?? [];
    expect(neu.filter((z) => !z.ki)).toEqual([mensch, hand]);
    expect(neu.filter((z) => z.ki && z.teamId === "K-K" && z.playerId === "f1")).toHaveLength(0);
    // KI-Eintraege reihen sich hinter die Handeintraege ein
    expect(Math.min(...neu.filter((z) => z.ki).map((z) => z.priorityRank ?? 0))).toBeGreaterThan(0);
  });

  it("Scouting ist begrenzt wie beim Menschen: nur die obersten X nicht fertigen Eintraege, nach Stufe belegt", () => {
    const eins = aktualisiereKiMerkliste(makeGameState(), "save-1");
    const liste = kiMerklisteFuerTeam(eins, "K-K");
    expect(liste.length).toBeGreaterThan(6);
    const queue = getScoutingWishlistQueue(eins, "K-K");
    // ohne Scouting-Buero: 6 aktive Plaetze (SCOUTING_WISHLIST_BASE_SLOTS), der Rest wartet
    expect(queue.capacity).toBe(6);
    expect(queue.active).toHaveLength(6);
    expect(queue.waiting).toHaveLength(liste.length - 6);
    const stufeJe = new Map(liste.map((z) => [z.playerId, z.stufe]));
    const aktiv = queue.active.map((z) => stufeJe.get(z.playerId)!);
    const wartend = queue.waiting.map((z) => stufeJe.get(z.playerId)!);
    expect(Math.min(...aktiv)).toBeGreaterThanOrEqual(Math.max(...wartend));
    // dieselben Plaetze stehen als Scouting-Records des Teams
    const records = (eins.seasonState.scoutIntelByTeamId?.["K-K"] ?? []).filter((r) => !r.parked && r.source === "wishlist_mirror");
    expect(records.map((r) => r.playerId).sort()).toEqual(queue.active.map((z) => z.playerId).sort());
  });

  it("alte `kiMerkliste` (Runde 1) wird gelesen, bei der ersten Neuberechnung uebernommen (`seit` bleibt) und entfernt", () => {
    const alt = makeGameState((s) => {
      s.seasonState.kiMerkliste = { "K-K": [eintrag("m0", "M-M", 3)] };
    });
    expect(kiInteresseAnSpieler(alt, "m0").map((t) => t.teamId)).toEqual(["K-K"]);
    expect(kiMerklisteFuerTeam(alt, "K-K")).toHaveLength(1);
    const neu = aktualisiereKiMerkliste(alt, "save-1");
    expect(neu.seasonState.kiMerkliste).toBeUndefined();
    const m0 = kiMerklisteFuerTeam(neu, "K-K").find((z) => z.playerId === "m0");
    expect(m0?.seit).toBe("season-2-matchday-1");
  });

  it("OLY_KI_MERKLISTE=0 schaltet ab", () => {
    const state = makeGameState();
    process.env.OLY_KI_MERKLISTE = "0";
    try {
      expect(aktualisiereKiMerkliste(state)).toBe(state);
    } finally {
      delete process.env.OLY_KI_MERKLISTE;
    }
  });

  it("kiInteresseAnSpieler sammelt alle Teams, hoechste Stufe zuerst", () => {
    const state = makeGameState((s) => {
      s.seasonState.kiMerkliste = { "K-A": [eintrag("m0", "M-M", 1)], "K-B": [eintrag("m0", "M-M", 3)] };
    });
    expect(kiInteresseAnSpieler(state, "m0").map((t) => t.teamId)).toEqual(["K-B", "K-A"]);
  });

  it("kiInteresseAnSpieler liest auch die neue Form (Wunschliste mit `ki`)", () => {
    const neu = aktualisiereKiMerkliste(makeGameState(), "save-1");
    const treffer = kiInteresseAnSpieler(neu, "m0");
    expect(treffer.map((t) => t.teamId)).toEqual(["K-K"]);
    expect(treffer[0]!.eintrag.besitzerTeamId).toBe("M-M");
  });
});

describe("KI-Merkliste: Meldung „Interesse an einem Spieler“", () => {
  const mitListe = (liste: KiMerklisteEintrag[]) =>
    makeGameState((s) => {
      s.seasonState.kiMerkliste = { "K-K": liste };
    });

  it("kommt beim Besitzer an, je Manager getrennt, mit Team, Grund und Stufe", () => {
    const state = mitListe([eintrag("m0", "M-M", 3), eintrag("b0", "B-B", 2)]);
    const chris = inboxFuer(state, "M-M", "user_local").filter((i) => i.source === "ki_interesse");
    const franky = inboxFuer(state, "B-B", "franky_remote_placeholder").filter((i) => i.source === "ki_interesse");
    expect(chris.map((i) => i.playerId)).toEqual(["m0"]);
    expect(franky.map((i) => i.playerId)).toEqual(["b0"]);
    expect(chris[0]!.teamId).toBe("M-M");
    expect(chris[0]!.title).toBe("Interesse an Spieler m0: Kalte Kraken");
    expect(chris[0]!.description).toContain("Wunschziel");
    expect(chris[0]!.description).toContain("Eishockey");
    expect(chris[0]!.description).toContain("kein Angebot");
    expect(chris[0]!.severity).toBe("info");
  });

  it("nennt keine verdeckten Werte (keine Zahlen ausser Spieltag/Anzahl, kein Marktwert, keine Attribute)", () => {
    const state = mitListe([eintrag("m0", "M-M", 3)]);
    const text = inboxFuer(state, "M-M", "user_local").find((i) => i.source === "ki_interesse")!.description;
    expect(text).not.toMatch(/\b(80|85|Marktwert|pow|MW)\b/);
  });

  it("bleibt dieselbe Meldung ueber Spieltage, bei gestiegener Stufe eine neue Kennung", () => {
    const stufe2 = inboxFuer(mitListe([eintrag("m0", "M-M", 2)]), "M-M", "user_local").find((i) => i.source === "ki_interesse")!;
    const spaeter = makeGameState((s) => {
      s.matchdayState = { ...s.matchdayState, matchdayId: "season-2-matchday-3" };
      s.seasonState.kiMerkliste = { "K-K": [{ ...eintrag("m0", "M-M", 2), stand: "season-2-matchday-3" }] };
    });
    const stufe2Spaeter = inboxFuer(spaeter, "M-M", "user_local").find((i) => i.source === "ki_interesse")!;
    expect(stufe2Spaeter.itemId).toBe(stufe2.itemId);
    const stufe3 = inboxFuer(mitListe([eintrag("m0", "M-M", 3)]), "M-M", "user_local").find((i) => i.source === "ki_interesse")!;
    expect(stufe3.itemId).not.toBe(stufe2.itemId);
  });

  it("steht in der Info-Bahn, haelt den Spieltag nie auf und kommt vom Absender Markt & Scouting", () => {
    const meldung = inboxFuer(mitListe([eintrag("m0", "M-M", 3)]), "M-M", "user_local").find((i) => i.source === "ki_interesse")!;
    const modell = baueModell({ items: [meldung], gelesen: new Set(), ordner: "post", absender: "alle", sortierung: "dring", nurUngelesen: false });
    expect(modell.blick).toHaveLength(1);
    expect(modell.haelt).toHaveLength(0);
    expect(modell.zaehler.haelt).toBe(0);
    expect(haeltSpieltagAuf(meldung)).toBe(false);
    expect(absenderFuerMeldung(meldung)).toBe("markt");
  });

  it("ist auf fuenf Meldungen je Team begrenzt", () => {
    const viele = Array.from({ length: 9 }, (_, i) => eintrag(`m${i}`, "M-M", 2));
    const meldungen = inboxFuer(mitListe(viele), "M-M", "user_local").filter((i) => i.source === "ki_interesse");
    expect(meldungen).toHaveLength(5);
  });

  it("freie Spieler erzeugen keine Meldung, Spieler des Menschen schon (neue Form)", () => {
    const neu = aktualisiereKiMerkliste(makeGameState(), "save-1");
    const meldungen = inboxFuer(neu, "M-M", "user_local").filter((i) => i.source === "ki_interesse");
    expect(meldungen.length).toBeGreaterThan(0);
    expect(meldungen.length).toBeLessThanOrEqual(5);
    expect(meldungen.every((i) => !String(i.playerId).startsWith("f"))).toBe(true);
    expect(new Set(meldungen.map((i) => i.itemId)).size).toBe(meldungen.length);
  });

  it("ohne Merkliste im Spielstand gibt es keine Meldung", () => {
    const meldungen = inboxFuer(makeGameState(), "M-M", "user_local").filter((i) => i.source === "ki_interesse");
    expect(meldungen).toHaveLength(0);
  });
});

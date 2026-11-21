/**
 * POSTFACH (Chris, 21.11., Entscheidungen 1 bis 7 zu `docs/design/inbox-modern-21-11.md`).
 *
 * Geprüft wird die Wirkung, nicht der Quelltext: die neuen Meldungsarten entstehen aus echten Spielstandsdaten, Gelesen gilt je
 * Manager, ein Trainingswunsch hält den Spieltag nie auf und zeigt die Folgen aus den buchenden Funktionen, Meldungen aus einem
 * an die KI gegebenen Bereich werden zum Bericht, und die Seite rendert beide Bahnen.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PostfachModern from "@/app/foundation/inbox-v2/PostfachModern";
import type { GameInboxItem, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";
import { gelesenIdsFuer, INBOX_GELESEN_MAX, inboxBesitzerFuerTeam, setzeInboxGelesen } from "@/lib/foundation/inbox-gelesen";
import {
  absenderFuerMeldung,
  baueModell,
  haeltSpieltagAuf,
  trainingsWunschFolgen,
  zaehleUngelesenFuerTeams,
} from "@/lib/foundation/inbox-postfach";
import { getTrainingModeDemandTerms } from "@/lib/training/training-mode-demand-service";

function makeTeam(teamId: string, name: string): Team {
  return { teamId, shortCode: teamId, name, budget: 325, cash: 50, identityId: teamId, humanControlled: true, rosterLimit: 12, logoPath: null } as Team;
}

function makePlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
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
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 10,
    form: 0,
    potential: 0,
    trainingMode: "mittel",
    currentXP: 0,
    injuryStatus: "healthy",
    ...partial,
  } as Player;
}

function control(teamId: string, ownerId: string, label: string) {
  return {
    teamId,
    controlMode: "manual" as const,
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

function makeGameState(players: Player[], extra?: (state: GameState) => void): GameState {
  const state = {
    gamePhase: "season_active",
    season: {
      id: "season-2",
      name: "Season 2",
      year: 2028,
      currentMatchday: 2,
      matchdayIds: ["season-2-matchday-1", "season-2-matchday-2", "season-2-matchday-3"],
    },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: {
        "M-M": control("M-M", "user_local", "Chris"),
        "B-B": control("B-B", "franky_remote_placeholder", "Franky"),
      },
    },
    matchdayState: { matchdayId: "season-2-matchday-2", status: "open", resolvedFixtureIds: ["season-2-matchday-1"] },
    teams: [makeTeam("M-M", "Mayhem Mavericks"), makeTeam("B-B", "Blazing Beasts")],
    players,
    rosters: players.map((player) => ({ teamId: "M-M", playerId: player.id, contractLength: 2, salary: 2 })),
    disciplines: [],
    transferHistory: [],
    teamIdentities: [],
  } as unknown as GameState;
  extra?.(state);
  return state;
}

function items(state: GameState, ownerId = "user_local"): GameInboxItem[] {
  return buildGameInboxItems({
    saveId: "save-1",
    gameState: state,
    activeTeamId: "M-M",
    activeOwnerId: ownerId,
    hostMode: false,
    createdAt: new Date().toISOString(),
  });
}

const wunschSpieler = () => makePlayer("p-wunsch", { name: "Lazy Lou", fatigue: 10, trainingMode: "hart", traitsPositive: ["lazy"] });

describe("neue Meldungsarten (Entscheidung 4)", () => {
  it("Wieder einsetzbar: ein Spieler im ersten Spieltag nach der Verletzung", () => {
    const spieler = makePlayer("p-back", { name: "Kaylen" });
    const state = makeGameState([spieler], (s) => {
      s.seasonState.playerAvailabilityState = [
        {
          playerId: "p-back",
          teamId: "M-M",
          fatigue: 20,
          injuryStatus: "injured",
          injuredAtMatchdayId: "season-2-matchday-1",
          injuryUntilMatchday: "season-2-matchday-1",
        },
      ];
    });
    const meldung = items(state).find((item) => item.source === "player_return");
    expect(meldung).toBeDefined();
    expect(meldung?.title).toBe("Wieder einsetzbar: Kaylen");
    expect(meldung?.playerId).toBe("p-back");
    // Bericht, nie Aufgabe: hält nichts auf.
    expect(baueModell({ items: [meldung!], gelesen: new Set(), ordner: "post", absender: "alle", sortierung: "dring", nurUngelesen: false }).bericht).toHaveLength(1);
    expect(haeltSpieltagAuf(meldung!)).toBe(false);
    expect(absenderFuerMeldung(meldung!)).toBe("teamarzt");
  });

  it("Moral gekippt: nur wenn eine Stufe (80/60/40/20) nach unten verlassen wird", () => {
    const abgestiegen = makePlayer("p-down", { name: "Aerin" });
    const schwankt = makePlayer("p-wobble", { name: "Kati" });
    const gestiegen = makePlayer("p-up", { name: "Jorund" });
    const state = makeGameState([abgestiegen, schwankt, gestiegen], (s) => {
      s.playerMoraleState = [
        { playerId: "p-down", teamId: "M-M", morale: 18, vorher: { morale: 45, matchdayId: "season-2-matchday-1" }, visibleMood: "angry", lastUpdatedSeasonId: "season-2", reasons: [{ reasonId: "r", label: "Ohne Einsatz", valueDelta: -6, source: "x" }], contractIntent: "willing_to_extend" },
        { playerId: "p-wobble", teamId: "M-M", morale: 52, vorher: { morale: 58, matchdayId: "season-2-matchday-1" }, visibleMood: "neutral", lastUpdatedSeasonId: "season-2", reasons: [], contractIntent: "willing_to_extend" },
        { playerId: "p-up", teamId: "M-M", morale: 70, vorher: { morale: 30, matchdayId: "season-2-matchday-1" }, visibleMood: "happy", lastUpdatedSeasonId: "season-2", reasons: [], contractIntent: "willing_to_extend" },
      ];
    });
    const moral = items(state).filter((item) => item.source === "moral_gekippt");
    expect(moral.map((item) => item.playerId)).toEqual(["p-down"]);
    expect(moral[0]?.title).toBe("Moral gekippt: Aerin ist verärgert");
    expect(moral[0]?.description).toContain("Ohne Einsatz");
    expect(moral[0]?.severity).toBe("warning");
    expect(absenderFuerMeldung(moral[0]!)).toBe("kabine");
  });

  it("Vorstand-Freigabe: ab Saison 2 und unter 100 %, die Prozentzahl steckt in der Kennung", () => {
    const state = makeGameState([makePlayer("p-1")], (s) => {
      s.seasonState.boardConfidence = { "M-M": { value: 6.2 } } as never;
    });
    const meldung = items(state).find((item) => item.source === "vorstand_freigabe");
    expect(meldung?.title).toBe("Vorstand: Freigabe 90 %");
    expect(meldung?.description).toContain("Ab 7,5 wären es 100 %");
    expect(meldung?.itemId).toContain(":90");
    expect(absenderFuerMeldung(meldung!)).toBe("vorstand");

    const voll = makeGameState([makePlayer("p-1")], (s) => {
      s.seasonState.boardConfidence = { "M-M": { value: 8 } } as never;
    });
    expect(items(voll).some((item) => item.source === "vorstand_freigabe")).toBe(false);
  });
});

describe("Gelesen / ungelesen je Manager (Entscheidung 2)", () => {
  it("liest Franky eine Meldung, bleibt sie für Chris ungelesen", () => {
    const state = makeGameState([wunschSpieler()]);
    expect(inboxBesitzerFuerTeam(state, "M-M")).toBe("user_local");
    expect(inboxBesitzerFuerTeam(state, "B-B")).toBe("franky_remote_placeholder");

    const nachFranky = setzeInboxGelesen(state, "franky_remote_placeholder", ["a", "b"], true);
    expect(gelesenIdsFuer(nachFranky, "franky_remote_placeholder")).toEqual(new Set(["a", "b"]));
    expect(gelesenIdsFuer(nachFranky, "user_local").size).toBe(0);
    // Löschen und Wiederholen sind still.
    expect(setzeInboxGelesen(nachFranky, "franky_remote_placeholder", ["a"], true)).toBe(nachFranky);
    expect(gelesenIdsFuer(setzeInboxGelesen(nachFranky, "franky_remote_placeholder", ["a"], false), "franky_remote_placeholder")).toEqual(new Set(["b"]));
  });

  it("merkt sich höchstens INBOX_GELESEN_MAX Kennungen und lässt die ältesten fallen", () => {
    const state = makeGameState([wunschSpieler()]);
    const viele = Array.from({ length: INBOX_GELESEN_MAX + 5 }, (_, index) => `id-${index}`);
    const gelesen = gelesenIdsFuer(setzeInboxGelesen(state, "user_local", viele, true), "user_local");
    expect(gelesen.size).toBe(INBOX_GELESEN_MAX);
    expect(gelesen.has("id-0")).toBe(false);
    expect(gelesen.has(`id-${INBOX_GELESEN_MAX + 4}`)).toBe(true);
  });

  it("die Zahl an der Schiene zählt ungelesene Meldungen über alle eigenen Teams", () => {
    const state = makeGameState([wunschSpieler()]);
    const alle = items(state);
    const offen = alle.filter((item) => item.status === "open" && item.teamId === "M-M");
    expect(offen.length).toBeGreaterThan(0);
    expect(zaehleUngelesenFuerTeams(alle, ["M-M"], new Set())).toBe(offen.length);
    expect(zaehleUngelesenFuerTeams(alle, ["M-M"], new Set(offen.map((item) => item.itemId)))).toBe(0);
    expect(zaehleUngelesenFuerTeams(alle, ["B-B"], new Set())).toBe(0);
  });
});

describe("Trainingswunsch: erfüllen oder ablehnen (Entscheidung 3 und 5)", () => {
  it("hält den Spieltag nie auf, auch wenn er kritisch wäre", () => {
    const wunsch = items(makeGameState([wunschSpieler()])).find((item) => item.source === "player_training_wish")!;
    expect(wunsch.targetParams).toMatchObject({ wunsch: "leicht", aktuell: "hart" });
    expect(haeltSpieltagAuf(wunsch)).toBe(false);
    expect(haeltSpieltagAuf({ ...wunsch, severity: "critical" })).toBe(false);
    // Gegenprobe: eine kritische Verletzung hält auf.
    expect(
      haeltSpieltagAuf({ ...wunsch, source: "player_health_injury", severity: "critical", itemId: "player_injured:x" }),
    ).toBe(true);
  });

  it("die Folgen kommen aus den buchenden Funktionen (gezeigt = gebucht)", () => {
    const folgen = trainingsWunschFolgen("hart", "leicht");
    const bedingungen = getTrainingModeDemandTerms("hart", "leicht");
    expect(folgen.erfuellen.moral).toBe(bedingungen.moraleReward);
    expect(folgen.ablehnen.moral).toBe(bedingungen.moralePenalty);
    expect(folgen.erfuellen.belastung).toBeLessThan(0);
    expect(folgen.erfuellen.entwicklung).toBeLessThan(0);
    expect(folgen.ablehnen.moral).toBeLessThan(0);
  });

  it("die Kennung trägt den Wunsch: eine abgelehnte (erledigte) Meldung verdeckt keinen späteren, anderen Wunsch", () => {
    const wunsch = items(makeGameState([wunschSpieler()])).find((item) => item.source === "player_training_wish")!;
    expect(wunsch.itemId.endsWith(":leicht")).toBe(true);
  });

  it("abgelehnt: die Meldung liegt in „Erledigt“, der Wunsch besteht weiter (Moral-Logik unverändert)", () => {
    const state = makeGameState([wunschSpieler()]);
    state.gameInboxItems = items(state)
      .filter((item) => item.source === "player_training_wish")
      .map((item) => ({ ...item, status: "done" as const }));
    const nachher = items(state);
    const wunsch = nachher.find((item) => item.source === "player_training_wish")!;
    expect(wunsch.status).toBe("done");
    // Der Spieler wünscht weiter: der Spielstand hat seine Intensität nicht angefasst.
    expect(state.players[0]?.trainingMode).toBe("hart");
    const erledigt = baueModell({ items: nachher, gelesen: new Set(), ordner: "erledigt", absender: "alle", sortierung: "dring", nurUngelesen: false });
    expect(erledigt.alle.map((eintrag) => eintrag.item.source)).toContain("player_training_wish");
    const post = baueModell({ items: nachher, gelesen: new Set(), ordner: "post", absender: "alle", sortierung: "dring", nurUngelesen: false });
    expect(post.alle.map((eintrag) => eintrag.item.source)).not.toContain("player_training_wish");
  });
});

describe("Delegierte Bereiche als Bericht „KI hat erledigt“ (Entscheidung 7)", () => {
  it("ein Wunsch in einem an die KI gegebenen Training-Bereich steht in der Info-Bahn als Bericht", () => {
    const state = makeGameState([wunschSpieler()]);
    state.seasonState.teamControlSettings!["M-M"] = control("M-M", "ramona_local", "Ramona");
    const alle = items(state, "ramona_local");
    const wunsch = alle.find((item) => item.source === "player_training_wish")!;
    const modell = baueModell({
      items: [wunsch],
      gelesen: new Set(),
      settings: state.seasonState.teamControlSettings!["M-M"],
      ordner: "post",
      absender: "alle",
      sortierung: "dring",
      nurUngelesen: false,
    });
    expect(modell.vorher).toHaveLength(0);
    expect(modell.bericht).toHaveLength(1);
    expect(modell.bericht[0]?.kiErledigt).toBe(true);
    expect(modell.bericht[0]?.bahn).toBe("info");
  });

  it("Mensch überschreibt: ein selbst trainierter Spieler bleibt Sache des Menschen", () => {
    const state = makeGameState([wunschSpieler()]);
    const settings = { ...control("M-M", "ramona_local", "Ramona"), delegation: { stufe: "halbautomatik" as const, bereiche: {}, trainingSelbstSpielerIds: ["p-wunsch"] } };
    const wunsch = items(state).find((item) => item.source === "player_training_wish")!;
    const modell = baueModell({ items: [wunsch], gelesen: new Set(), settings: settings as never, ordner: "post", absender: "alle", sortierung: "dring", nurUngelesen: false });
    expect(modell.bericht).toHaveLength(0);
    expect(modell.vorher).toHaveLength(1);
  });
});

describe("Die Seite (Mockup inbox-modern-21-11)", () => {
  function render(state: GameState, listen: GameInboxItem[]) {
    return renderToStaticMarkup(
      <PostfachModern
        gameState={state}
        items={listen}
        aktivesTeamId="M-M"
        onWaehleTeam={() => {}}
        onGelesen={() => {}}
        onTrainingModus={() => {}}
        onStatus={() => {}}
        onOeffne={() => {}}
      />,
    );
  }

  it("zeigt beide Bahnen, den Absender-Filter, die Ordner und den Wunsch mit Folgen im Brief", () => {
    const state = makeGameState([wunschSpieler()]);
    // Nur der Wunsch, damit er der gewählte Brief ist (sonst steht „Lineup fehlt“ als Erstes da).
    const html = render(state, items(state).filter((item) => item.source === "player_training_wish"));
    expect(html).toContain('data-testid="postfach-bahn-handeln"');
    expect(html).toContain('data-testid="postfach-bahn-info"');
    expect(html).toContain('data-testid="postfach-ordner-post"');
    expect(html).toContain('data-testid="postfach-ordner-erledigt"');
    expect(html).toContain('data-testid="postfach-absender-kabine"');
    expect(html).toContain("Trainingswunsch: leicht");
    // Brief: beide Antworten mit den Folgen aus der buchenden Funktion
    expect(html).toContain("Auf leicht stellen");
    expect(html).toContain("Bei hart bleiben");
    expect(html).toContain("Moral +4");
    expect(html).toContain("Moral −10");
    expect(html).toContain('data-testid="postfach-option-wunsch-erfuellen"');
    expect(html).toContain('data-testid="postfach-option-wunsch-ablehnen"');
    // nichts vom alten Stil
    expect(html).not.toContain("nl-inbox");
  });

  it("Mehrspieler: Franky erscheint nur am Tisch, nie mit eigenen Meldungen; die Seite liest das aktive Team", () => {
    const state = makeGameState([wunschSpieler()]);
    const html = render(state, items(state));
    expect(html).toContain('data-testid="postfach-tisch-gast"');
    expect(html).toContain("Franky");
    expect(html).toContain('data-team="M-M"');
    expect(html).not.toContain('data-testid="postfach-team-B-B"');
  });

  it("zeigt „Nichts offen“, wenn die Handeln-Bahn leer ist", () => {
    const state = makeGameState([makePlayer("p-ruhig", { name: "Ruhig" })]);
    const nur = items(state).filter((item) => item.source === "never");
    const html = render(state, nur);
    expect(html).toContain("Nichts offen — du bist durch.");
    expect(html).toContain('data-testid="postfach-handeln-leer"');
  });
});

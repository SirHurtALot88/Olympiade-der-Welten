/**
 * Paket B (docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md): Paket A hat das Ready-Gate fuer den
 * Saisonwechsel scharf gemacht. Im Cockpit sah der GAST die Saisonabschluss-Knoepfe trotzdem
 * unveraendert an — `season_completion`/`season_transition` sind HOST_LEVEL_ACTIONS
 * (server-authoritative-write-guard.ts:66-85, 332-336), er bekam also erst NACH dem Klick ein
 * 403 `host_only_action` zu sehen. Diese Datei pinnt die EIGENSCHAFT (erkennbar host-only VOR
 * dem Klick, mit lesbarem Satz statt Code), nicht die Bauweise — inklusive der Gegenproben, die
 * laut Plan die eigentlich wichtigen sind.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GamePhase, GameState, MappingReport } from "@/lib/data/olyDataTypes";
import { buildLocalSeasonTransitionGate } from "@/lib/foundation/tabs/use-foundation-cross-tab-season-briefing";
import { uebersetzeUebergangsBlocker } from "@/lib/foundation/tabs/cockpit-handlers";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { findOwnRoomParticipant } from "@/lib/room/online-room-model";
import type { OlyRoomState, RoomParticipant } from "@/types/game";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const EMPTY_MAPPING_REPORT: MappingReport = {
  mappingSource: "",
  teamSource: "",
  generatedAt: "",
  processedMappingRows: 0,
  importedPlayerCount: 0,
  matchedRosterCount: 0,
  teamCount: 0,
  unmappedPlayers: [],
  teamsWithoutPlayers: [],
  mappingRowsWithoutPlayerMatch: [],
  duplicateMappedPlayers: [],
  unknownTeamCodes: [],
  duplicateTeamCodes: [],
  warnings: [],
};

const MATCHDAY_ID = "season-1-md-1";

/**
 * `ready: true` baut genau den Zustand, in dem `canCompleteSeason` OHNE Host-Vorbehalt `true`
 * waere (letzter Spieltag aufgeloest, leerer Spielplan macht `lastFixturesResolved` trivial
 * wahr) — nur so misst der Host-Vorbehalt etwas: an einem ohnehin blockierten Spielstand waere
 * ein zu breiter Riegel unsichtbar.
 */
function makeGameState(params: { gamePhase?: GamePhase; ready: boolean }): GameState {
  return {
    gamePhase: params.gamePhase ?? "season_active",
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: [MATCHDAY_ID] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: {
      matchdayId: MATCHDAY_ID,
      status: params.ready ? "resolved" : "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: EMPTY_MAPPING_REPORT,
  };
}

function roomContext(participantId: string): FoundationRoomContext {
  return { roomCode: "ABCD", participantId, userId: `u-${participantId}`, seatToken: "seat", saveId: "s-1", ownerId: null };
}

function participant(participantId: string, role: RoomParticipant["role"]): RoomParticipant {
  return {
    participantId,
    userId: `u-${participantId}`,
    displayName: participantId,
    connectionStatus: "online",
    role,
    controlledTeamIds: [],
    readyState: "not_ready",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
  };
}

function roomLiveState(participants: RoomParticipant[]): OlyRoomState {
  return { roomParticipants: participants } as unknown as OlyRoomState;
}

const CHRIS_HOST = participant("p-chris", "host");
const FRANKY_GUEST = participant("p-franky", "player");
const ROOM_STATE = roomLiveState([CHRIS_HOST, FRANKY_GUEST]);

describe("Saisonwechsel-Gate: Host-Vorbehalt VOR dem Klick", () => {
  it("Eigenschaft 1 — Gast im Raum ohne Host-Rolle: erkennbar host-only, Grund als Satz", () => {
    const gate = buildLocalSeasonTransitionGate({
      gameState: makeGameState({ ready: true }),
      roomContext: roomContext("p-franky"),
      roomLiveState: ROOM_STATE,
    });

    // `canCompleteSeason` bleibt bewusst die reine Bereitschafts-Aussage (siehe Gegenprobe 4 —
    // der zweite Verbraucher braucht sie unvermischt). Der Riegel selbst steht in `hostOnly`; das
    // Cockpit-Panel sperrt die Knoepfe ueber `!canCompleteSeason || hostOnly` (siehe Panel-Test
    // unten) — fuer den Gast reicht dafuer `hostOnly` allein.
    expect(gate.canCompleteSeason).toBe(true);
    expect(gate.hostOnly).toBe(true);
    expect(gate.disabledReason).toBe("season_transition_host_only");

    const satz = uebersetzeUebergangsBlocker(gate.disabledReason!);
    expect(satz).not.toBe(gate.disabledReason);
    expect(satz).toMatch(/Host/);
    // Der Satz muss auch klarstellen, dass Frankys EIGENE Aktionen nicht betroffen sind — sonst
    // liest er "host-only" und denkt, sein ganzes Saisonende sei gesperrt (siehe Eigenschaft 4).
    expect(satz).toMatch(/eigenen Saisonende-Aktionen/);
  });

  it("Gegenprobe 2 — solo (kein Raum) bleibt unveraendert, in jedem Bereitschaftszustand", () => {
    for (const ready of [true, false]) {
      const gameState = makeGameState({ ready });
      const solo = buildLocalSeasonTransitionGate({ gameState, roomContext: null, roomLiveState: null });
      expect(solo.hostOnly).toBe(false);
      expect(solo.canCompleteSeason).toBe(ready);
      expect(solo.disabledReason).toBe(ready ? null : "last_matchday_not_completed");
    }
  });

  it("Gegenprobe 3 — Host im Raum ist WORTGLEICH mit solo, in jedem Bereitschaftszustand", () => {
    for (const ready of [true, false]) {
      const gameState = makeGameState({ ready });
      const solo = buildLocalSeasonTransitionGate({ gameState, roomContext: null, roomLiveState: null });
      const alsHost = buildLocalSeasonTransitionGate({
        gameState,
        roomContext: roomContext("p-chris"),
        roomLiveState: ROOM_STATE,
      });
      expect(alsHost).toEqual(solo);
    }
  });

  it("solange die eigene Rolle UNBEKANNT ist, wird nichts behauptet — sonst sperrt sich der Host selbst aus", () => {
    /**
     * DIESER FALL WAR ZUERST FALSCH HERUM GEPINNT, mit der Begruendung "der Riegel darf nie
     * versehentlich OEFFNEN". Das klingt nach der sicheren Seite, ist hier aber die unsichere:
     * `roomLiveState` ist der zuletzt EMPFANGENE Schnappschuss und ist `null`, solange keiner da
     * ist — das ist jeder Seitenaufbau im Raum (der Kontext steht sofort, der Schnappschuss kommt
     * erst ueber den Socket) und zusaetzlich der Sitzungsfehler-Pfad aus Befund F6. Gemessen mit
     * der urspruenglichen Fassung: Kontext gesetzt + kein Schnappschuss -> `hostOnly: true`, also
     * "Nur der Host …" fuer den HOST.
     *
     * Die Kosten sind unsymmetrisch, und daran haengt die Entscheidung: dem Host faelschlich zu
     * sagen, er duerfe nicht, ist schlicht falsch und er sitzt fest. Dem Gast in diesem kurzen
     * Fenster nichts zu sagen heisst, dass er klickt und die lesbare Absage des Servers bekommt
     * (Befund F9) — genau der Zustand VOR diesem Paket, also kein Rueckschritt. Die Autoritaet
     * liegt ohnehin beim Server; hier haengt nur die Anzeige.
     */
    const ohneSchnappschuss = buildLocalSeasonTransitionGate({
      gameState: makeGameState({ ready: true }),
      roomContext: roomContext("p-chris"),
      roomLiveState: null,
    });
    expect(ohneSchnappschuss.hostOnly, "der Host darf sich nicht selbst aussperren").toBe(false);

    // Dasselbe fuer den Schnappschuss, in dem der eigene Sitz (noch) nicht auftaucht — etwa
    // waehrend die Teilnehmerliste nach einem Verbindungsabriss neu aufgebaut wird.
    const sitzNichtImSchnappschuss = buildLocalSeasonTransitionGate({
      gameState: makeGameState({ ready: true }),
      roomContext: roomContext("p-unbekannt"),
      roomLiveState: ROOM_STATE,
    });
    expect(sitzNichtImSchnappschuss.hostOnly).toBe(false);
  });

  it("GEGENPROBE: sobald die Rolle BEKANNT ist, greift der Vorbehalt sofort", () => {
    // Damit die Pruefung oben nicht zum Freibrief wird: kennt der Schnappschuss den Sitz, wird
    // sehr wohl entschieden — sonst haette das ganze Paket keine Wirkung mehr.
    const gast = buildLocalSeasonTransitionGate({
      gameState: makeGameState({ ready: true }),
      roomContext: roomContext("p-franky"),
      roomLiveState: ROOM_STATE,
    });
    expect(gast.hostOnly).toBe(true);
  });

  it("der Host-Vorbehalt hat Vorrang vor der Bereitschafts-Meldung, wenn beides zutrifft", () => {
    // Ein Gast soll nicht "letzter Spieltag offen" lesen und danach beim naechsten Matchday
    // ueberrascht werden, dass der Knopf IMMER NOCH nicht seiner ist — der Grund ist derselbe in
    // beiden Faellen: er ist nicht der Host.
    const gate = buildLocalSeasonTransitionGate({
      gameState: makeGameState({ ready: false }),
      roomContext: roomContext("p-franky"),
      roomLiveState: ROOM_STATE,
    });
    expect(gate.disabledReason).toBe("season_transition_host_only");
  });
});

describe("uebersetzeUebergangsBlocker: Eigenschaft 5", () => {
  it("ein bekannter Code wird zum Satz", () => {
    expect(uebersetzeUebergangsBlocker("last_matchday_not_completed")).toBe(
      "Der letzte Spieltag ist noch nicht abgeschlossen.",
    );
  });

  it("ein unbekannter Code bleibt UNVERAENDERT stehen — nicht gegen \"unbekannter Fehler\" getauscht", () => {
    const roh = "ein_code_den_es_noch_nicht_gibt";
    expect(uebersetzeUebergangsBlocker(roh)).toBe(roh);
  });
});

describe("Gegenprobe 4 (die wichtigste): Frankys eigene Saisonende-Aktionen bleiben unangetastet", () => {
  it("HOST_LEVEL_ACTIONS enthaelt season_transition/season_completion, aber NICHT die Aktionen, die Franky selbst ausfuehren darf", () => {
    const guard = read("lib/room/server-authoritative-write-guard.ts");
    const start = guard.indexOf("const HOST_LEVEL_ACTIONS");
    expect(start).toBeGreaterThan(-1);
    const setText = guard.slice(start, guard.indexOf("]);", start));

    expect(setText).toContain('"season_transition"');
    expect(setText).toContain('"season_completion"');

    // Nachgemessen an docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md Abschnitt 1.3: Vertragsverlaengerung,
    // Vertragsaufloesung, Sponsorwahl und Verkauf sind KEINE Host-Aktionen. Landet einer dieser
    // vier Werte je in diesem Set, ist der Riegel zu breit geworden — genau der Fehler, den der
    // Plan als schlimmer bezeichnet als gar keinen Riegel.
    for (const gastAktion of ['"contract_renewal"', '"contract_dissolution"', '"sponsor_choice"', '"sell"']) {
      expect(setText).not.toContain(gastAktion);
    }
  });

  it("seasonEndRosterActionsActive (die eigentliche Freigabe fuer Verkaufen/Verlaengern) liest hostOnly NICHT", () => {
    // ENTSCHEIDUNG, siehe Kommentar an der Stelle selbst: der Host-Vorbehalt bleibt hier bewusst
    // draussen, weil dieses Feld Frankys EIGENE Aktionen freischaltet, nicht die des Hosts.
    const hookText = read("lib/foundation/tabs/use-foundation-cross-tab-screen-primary-action.ts");
    const start = hookText.indexOf("const seasonEndRosterActionsActive = useMemo(");
    const ende = hookText.indexOf("}, [input.gameState, input.localSeasonTransitionGate.canCompleteSeason]);");
    expect(start).toBeGreaterThan(-1);
    expect(ende).toBeGreaterThan(start);
    const block = hookText.slice(start, ende);
    // Nicht auf das bloße Wort "hostOnly" prueden — der Entscheidungs-Kommentar direkt an dieser
    // Stelle nennt es absichtlich beim Namen. Was NICHT vorkommen darf, ist ein tatsaechlicher
    // Lesezugriff auf das Feld.
    expect(block).not.toContain("localSeasonTransitionGate.hostOnly");
    expect(block).not.toContain(".hostOnly");
    expect(block).toContain("input.localSeasonTransitionGate.canCompleteSeason");
  });
});

describe("Cockpit-Panel: das Gate wird tatsaechlich verdrahtet (Eigenschaft 1, Bauweise)", () => {
  const panel = read("app/foundation/cockpit-v2/FoundationCockpitPanel.tsx");

  it("die vier Saisonabschluss-Knoepfe UND die \"Warum nicht\"-Zeile sperren zusaetzlich auf hostOnly", () => {
    // Fuenf Stellen lesen `localSeasonTransitionGate.canCompleteSeason` fuer diesen Assistenten
    // (vier Knoepfe + die Sichtbarkeits-Bedingung der "Warum nicht"-Zeile, Zeile ~2790) — jede
    // davon muss um `|| localSeasonTransitionGate.hostOnly` ergaenzt sein, sonst bliebe der Knopf
    // fuer den Gast trotz erkanntem Host-Vorbehalt anklickbar.
    const disabledMitCanComplete = (
      panel.match(/!localSeasonTransitionGate\.canCompleteSeason/g) ?? []
    ).length;
    const disabledMitHostOnly = (
      panel.match(/!localSeasonTransitionGate\.canCompleteSeason \|\| localSeasonTransitionGate\.hostOnly/g) ?? []
    ).length;
    expect(disabledMitCanComplete).toBe(5);
    expect(disabledMitHostOnly).toBe(disabledMitCanComplete);
  });

  it("Titel und \"Warum nicht\" zeigen den UEBERSETZTEN Grund, nicht mehr den rohen Code", () => {
    expect(panel).toContain("uebersetzeUebergangsBlocker(localSeasonTransitionGate.disabledReason)");
    // Regressions-Wache: die alte rohe Anzeige darf nicht zurueckkommen.
    expect(panel).not.toContain("localSeasonTransitionGate.disabledReason ??");
    expect(panel).not.toContain("localSeasonTransitionGate.disabledReason}");
  });

  it("der Gate-Typ im Panel kennt hostOnly", () => {
    expect(panel).toContain("hostOnly: boolean");
  });
});

describe("Entdoppelung: 'bin ich der Host' hat nur noch eine Quelle", () => {
  it("FoundationShellRouterBody.tsx sucht den eigenen Sitz ueber findOwnRoomParticipant, nicht mehr inline", () => {
    const text = read("app/foundation/FoundationShellRouterBody.tsx");
    expect(text).toContain("findOwnRoomParticipant(roomLiveState, roomContext.participantId)");
    expect(text).not.toContain("roomLiveState?.roomParticipants.find(");
  });

  it("findOwnRoomParticipant selbst liefert denselben Teilnehmer, den die alte Inline-Suche fand", () => {
    expect(findOwnRoomParticipant(ROOM_STATE, "p-chris")).toEqual(CHRIS_HOST);
    expect(findOwnRoomParticipant(ROOM_STATE, "p-unbekannt")).toBeNull();
    expect(findOwnRoomParticipant(null, "p-chris")).toBeNull();
  });
});

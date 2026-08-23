/**
 * PAKET 1 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md): `buildOwnershipForPreset`
 * (lib/room/online-room-model.ts) wird von einer Ternaer-Kette auf eine Tabelle umgebaut, bei
 * UNVERAENDERTEM Verhalten. Diese Suite haelt die Eigenschaften fest, die dabei gleich bleiben
 * muessen.
 *
 * ABLAUF (wie vom Auftrag verlangt, "ZUERST MESSEN, DANN UMBAUEN"): der Block "Charakterisierung"
 * unten (alle Faelle bis einschliesslich "Gegenprobe: teamIds-Beschraenkung") lief ZUERST gegen den
 * UNVERAENDERTEN Code (die Ternaer-Kette, Stand vor diesem Umbau) und war zu diesem Zeitpunkt
 * bereits gruen (8 Faelle + 2 Gegenproben, alle bestanden) — das ist der Beweis, dass die Tabelle
 * danach zeichengenau dasselbe liefert. Erst NACH diesem gruenen Lauf wurde umgebaut. Die Werte
 * unten sind KEINE Erwartung, sondern eine MESSUNG: erzeugt mit einem Wegwerf-Skript, das
 * `buildOwnershipForPreset` direkt gegen den unveraenderten Code aufrief (siehe Ergebnis-Dump im
 * Bericht des umbauenden Agenten).
 *
 * GEMESSENER GEGENBEFUND zu einer Annahme aus dem Auftrag: dort steht, ohne zweiten Teilnehmer
 * blieben "die betroffenen Teams passive, nicht ai". Gemessen ist das FALSCH fuer diese Funktion:
 * `frankyTeamIds` (im alten Code) wird nur befuellt, wenn `franky` (der gefundene Teilnehmer)
 * existiert (`franky ? ... : []`, online-room-model.ts:311 alt) — ohne Franky ist sie IMMER leer,
 * und `humanTeamIds` (das ueber "passive" vs. "ai" entscheidet) enthaelt dann nur die Host-Teams.
 * Die vier `FOUR_PLUS_FOUR_FRANKY_TEAM_IDS` landen ohne Franky deshalb bei "ai", nicht bei
 * "passive" — "passive" ist in `buildOwnershipForPreset` (Stand vor dem Umbau) ueberhaupt nicht
 * erreichbar: `hostTeamIds`/`frankyTeamIds` werden je nur befuellt, wenn der zugehoerige
 * Teilnehmer existiert, und dann faengt genau der zugehoerige `if`-Zweig (host/franky) den
 * Treffer bereits ab, BEVOR der "passive"-Zweig ueberhaupt geprueft wird. Bestaetigt durch den
 * bestehenden Kommentar an `buildExplicitTeamOwnership` (online-room-model.ts:378-380: "they
 * simply stay AI-controlled until Franky joins") und durch tests/ai-bulk-team-write-scope.test.ts:102
 * ("every other preset team defaults to controllerType 'ai' per buildOwnershipForPreset"). Die
 * Eigenschaften unten halten deshalb das GEMESSENE "ai" fest, nicht die Behauptung aus dem
 * Auftrag — und schreiben das ausdruecklich fest, statt es stillschweigend zu uebernehmen.
 */
import { describe, expect, it } from "vitest";

import {
  buildOwnershipForPreset,
  buildParticipant,
  ONLINE_ROOM_TEAM_IDS,
  UnknownRoomOwnershipPresetError,
} from "@/lib/room/online-room-model";
import type { RoomOwnershipPreset } from "@/types/events";
import { createRoom, getRoom, joinRoom, resetRuntimeRoomsForTests } from "@/lib/room/room-store";

const host = buildParticipant({ participantId: "p-host", userId: "u-host", displayName: "Chris", role: "host" });
const franky = buildParticipant({ participantId: "p-franky", userId: "u-franky", displayName: "Franky", role: "player" });

/** Zerlegt eine Zuteilung in die vier Eigenschaften, die zaehlen -- sortiert, damit Reihenfolge
 * (die fuer keinen Aufrufer eine Bedeutung hat) den Vergleich nicht verfaelscht. */
function zerlegt(ownership: ReturnType<typeof buildOwnershipForPreset>) {
  return {
    chris: ownership
      .filter((entry) => entry.controllerType === "human" && entry.ownerDisplayName === "Chris")
      .map((entry) => entry.teamId)
      .sort(),
    franky: ownership
      .filter((entry) => entry.controllerType === "human" && entry.ownerDisplayName === "Franky")
      .map((entry) => entry.teamId)
      .sort(),
    passive: ownership
      .filter((entry) => entry.controllerType === "passive")
      .map((entry) => entry.teamId)
      .sort(),
    ai: ownership
      .filter((entry) => entry.controllerType === "ai")
      .map((entry) => entry.teamId)
      .sort(),
  };
}

describe("buildOwnershipForPreset -- Charakterisierung (Paket 1, unveraendertes Verhalten)", () => {
  it("chris_1_rest_ai ohne Franky: Chris bekommt A-A, Rest KI", () => {
    const ergebnis = buildOwnershipForPreset([host], "chris_1_rest_ai");
    expect(ergebnis).toHaveLength(32);
    expect(zerlegt(ergebnis)).toEqual({ chris: ["A-A"], franky: [], passive: [], ai: ONLINE_ROOM_TEAM_IDS.filter((id) => id !== "A-A").sort() });
  });

  it("chris_1_rest_ai MIT Franky: Franky bekommt trotzdem nichts (Solo-Preset reserviert nichts fuer den zweiten Sitz)", () => {
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_1_rest_ai");
    expect(zerlegt(ergebnis)).toEqual({ chris: ["A-A"], franky: [], passive: [], ai: ONLINE_ROOM_TEAM_IDS.filter((id) => id !== "A-A").sort() });
  });

  it("chris_2_rest_ai ohne Franky: Chris bekommt A-A/B-B, Rest KI", () => {
    const ergebnis = buildOwnershipForPreset([host], "chris_2_rest_ai");
    const erwarteteChrisTeams = ["A-A", "B-B"];
    expect(zerlegt(ergebnis)).toEqual({
      chris: erwarteteChrisTeams,
      franky: [],
      passive: [],
      ai: ONLINE_ROOM_TEAM_IDS.filter((id) => !erwarteteChrisTeams.includes(id)).sort(),
    });
  });

  it("chris_2_rest_ai MIT Franky: Franky bekommt trotzdem nichts", () => {
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_2_rest_ai");
    expect(zerlegt(ergebnis).franky).toEqual([]);
    expect(zerlegt(ergebnis).chris).toEqual(["A-A", "B-B"]);
  });

  it("chris_4_rest_ai ohne Franky: Chris bekommt die ersten vier Teams, Rest KI", () => {
    const ergebnis = buildOwnershipForPreset([host], "chris_4_rest_ai");
    const erwarteteChrisTeams = ["A-A", "B-B", "B-P", "C-C"];
    expect(zerlegt(ergebnis)).toEqual({
      chris: erwarteteChrisTeams,
      franky: [],
      passive: [],
      ai: ONLINE_ROOM_TEAM_IDS.filter((id) => !erwarteteChrisTeams.includes(id)).sort(),
    });
  });

  it("chris_4_rest_ai MIT Franky: Franky bekommt trotzdem nichts", () => {
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_4_rest_ai");
    expect(zerlegt(ergebnis).franky).toEqual([]);
    expect(zerlegt(ergebnis).chris).toEqual(["A-A", "B-B", "B-P", "C-C"]);
  });

  it("chris_4_franky_4_rest_ai OHNE Franky: Chris bekommt die feste 4er-Liste, Frankys Liste bleibt ai (GEGENPROBE, siehe Kommentar oben: nicht passive)", () => {
    const ergebnis = buildOwnershipForPreset([host], "chris_4_franky_4_rest_ai");
    const chrisTeams = ["D-P", "M-M", "P-S", "V-W"];
    const frankysReserveTeams = ["C-S", "G-G", "M-S", "P-C"]; // FOUR_PLUS_FOUR_FRANKY_TEAM_IDS, sortiert
    const zerlegtes = zerlegt(ergebnis);
    expect(zerlegtes.chris).toEqual(chrisTeams);
    expect(zerlegtes.franky).toEqual([]); // Gastseite bleibt leer -- Eigenschaft 3 aus dem Auftrag
    expect(zerlegtes.passive).toEqual([]); // GEMESSEN: nicht passive (siehe Kommentar oben)
    // Frankys Reserve-Teams stecken jetzt in "ai", nicht in "passive":
    frankysReserveTeams.forEach((teamId) => expect(zerlegtes.ai).toContain(teamId));
  });

  it("chris_4_franky_4_rest_ai MIT Franky: beide Seiten bekommen ihre feste 4er-Liste", () => {
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_4_franky_4_rest_ai");
    const chrisTeams = ["D-P", "M-M", "P-S", "V-W"];
    const frankyTeams = ["C-S", "G-G", "M-S", "P-C"];
    expect(zerlegt(ergebnis)).toEqual({
      chris: chrisTeams,
      franky: frankyTeams,
      passive: [],
      ai: ONLINE_ROOM_TEAM_IDS.filter((id) => ![...chrisTeams, ...frankyTeams].includes(id)).sort(),
    });
  });

  it("GEGENPROBE controllerType je Team: chris_4_franky_4_rest_ai traegt participantId/userId zeichengenau", () => {
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_4_franky_4_rest_ai");
    const chrisEintrag = ergebnis.find((entry) => entry.teamId === "P-S");
    const frankyEintrag = ergebnis.find((entry) => entry.teamId === "M-S");
    expect(chrisEintrag).toEqual({
      teamId: "P-S",
      controllerType: "human",
      participantId: "p-host",
      userId: "u-host",
      ownerDisplayName: "Chris",
    });
    expect(frankyEintrag).toEqual({
      teamId: "M-S",
      controllerType: "human",
      participantId: "p-franky",
      userId: "u-franky",
      ownerDisplayName: "Franky",
    });
    const aiEintrag = ergebnis.find((entry) => entry.teamId === "A-A");
    expect(aiEintrag).toEqual({ teamId: "A-A", controllerType: "ai", ownerDisplayName: "AI" });
  });

  it("GEGENPROBE (Eigenschaft 4): die Beschraenkung auf den teamIds-Parameter wirkt weiter -- ein Team ausserhalb der Liste taucht nicht auf", () => {
    const restringiert = ["A-A", "P-S", "M-S"];
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_4_franky_4_rest_ai", restringiert);
    expect(ergebnis).toHaveLength(3);
    expect(ergebnis).toEqual([
      { teamId: "A-A", controllerType: "ai", ownerDisplayName: "AI" },
      { teamId: "P-S", controllerType: "human", participantId: "p-host", userId: "u-host", ownerDisplayName: "Chris" },
      { teamId: "M-S", controllerType: "human", participantId: "p-franky", userId: "u-franky", ownerDisplayName: "Franky" },
    ]);
  });

  it("GEGENPROBE (Eigenschaft 4, zaehlenbasierter Preset): teamIds-Beschraenkung wirkt auch fuer chris_2_rest_ai", () => {
    const restringiert = ["A-A", "P-S", "M-S"];
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_2_rest_ai", restringiert);
    expect(ergebnis).toEqual([
      { teamId: "A-A", controllerType: "human", participantId: "p-host", userId: "u-host", ownerDisplayName: "Chris" },
      { teamId: "P-S", controllerType: "human", participantId: "p-host", userId: "u-host", ownerDisplayName: "Chris" },
      { teamId: "M-S", controllerType: "ai", ownerDisplayName: "AI" },
    ]);
  });
});

/**
 * Ab hier: NEUES Verhalten (E2), das der alte Code nicht hatte -- diese Faelle liefen NICHT gegen
 * den alten Code (der fiel fuer einen unbekannten Preset still auf 4 Host-Teams zurueck, siehe
 * Kommentar an der alten Ternaer-Kette / im Bericht). Sie wurden erst NACH dem Umbau geschrieben
 * und pruefen die neue Eigenschaft 2 aus dem Auftrag: ein unbekannter Modus ist erkennbar.
 */
describe("buildOwnershipForPreset -- unbekannter Preset (E2, neues Verhalten)", () => {
  it("wirft UnknownRoomOwnershipPresetError statt still 4 Teams zu vergeben", () => {
    const unbekannt = "chris_3_rest_ai" as RoomOwnershipPreset;
    expect(() => buildOwnershipForPreset([host], unbekannt)).toThrow(UnknownRoomOwnershipPresetError);
    try {
      buildOwnershipForPreset([host], unbekannt);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownRoomOwnershipPresetError);
      expect((error as UnknownRoomOwnershipPresetError).preset).toBe("chris_3_rest_ai");
    }
  });
});

/**
 * Der Fall, an dem laut Auftrag ein Wurf teuer waere: ein ALTER Raum aus der Ablage traegt einen
 * Preset-Namen (`multiplayerRoom.createdWithPreset`, types/game.ts:77 -- persistiert), den dieser
 * Server-Stand nicht mehr kennt. Der Beitritt (`joinRoom`, room-store.ts) darf daran NICHT
 * scheitern -- siehe Kommentar an `wendeOwnershipPresetGnaedigAn` in room-store.ts.
 */
describe("joinRoom -- Alt-Raum mit unbekanntem Preset (E2, Beitritt darf nicht abstuerzen)", () => {
  it("laesst den Beitritt trotz unbekanntem createdWithPreset gelingen und faellt auf den 4+4-Vorschlag zurueck", () => {
    resetRuntimeRoomsForTests();
    const created = createRoom("socket-altraum-a", { displayName: "Chris", preset: "chris_1_rest_ai" });

    // Simuliert einen Raum, dessen `createdWithPreset` aus einer AELTEREN oder JUENGEREN
    // Serverversion stammt, die einen Modus kennt/kannte, den dieser Stand nicht (mehr) hat.
    // `as RoomOwnershipPreset` ist hier bewusst eine Luege -- genau der Fall, den ein
    // deserialisierter Alt-Save ungeprueft ins System tragen kann.
    const room = getRoom(created.room.roomCode)!;
    room.state.multiplayerRoom.createdWithPreset = "chris_99_rest_ai" as RoomOwnershipPreset;

    let result: ReturnType<typeof joinRoom> | undefined;
    expect(() => {
      result = joinRoom(created.room.roomCode, "socket-altraum-b", { displayName: "Franky" });
    }).not.toThrow();
    expect(result?.ok).toBe(true);
    if (!result?.ok) return;

    // Stufe 4 der Rangfolge (Kommentar an `joinRoom`, room-store.ts): kein Save angebunden, also
    // der 4+4-Vorschlag -- Franky bekommt FOUR_PLUS_FOUR_FRANKY_TEAM_IDS, GENAU wie er es auch
    // ohne den unbekannten Preset bekommen haette (Stufe 2 greift ja nicht mehr, siehe oben).
    const franky2 = result.room.state.roomParticipants.find((entry) => entry.displayName === "Franky");
    expect([...(franky2?.controlledTeamIds ?? [])].sort()).toEqual(["C-S", "G-G", "M-S", "P-C"]);
  });
});

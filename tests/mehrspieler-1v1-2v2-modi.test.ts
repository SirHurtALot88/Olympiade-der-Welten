/**
 * PAKET 2 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md): "1+1" und "2+2" als neue Mehrspieler-Modi.
 *
 * Die Eigenschaften, die diese Suite haelt (Kopf des Arbeitsauftrags):
 *  1. In einem 1+1-Raum hat jeder Spieler genau EIN Team, in 2+2 genau zwei -- Team-IDs zeichengenau.
 *  2. Die Team-IDs sind die ersten n der bestehenden 4+4-Listen (keine zweite Quelle, E5).
 *  3. Beide Oberflaechen bieten dieselbe MENGE an Modi -- so geprueft, dass ein kuenftiger Preset,
 *     der nur in einer der beiden Dateien landet, den Test reissen laesst.
 *  4. Der Save-Modus passt zum Raum-Modus, und die Obergrenze der Team-Zuteilung passt zum
 *     Save-Modus.
 *  5. GEGENPROBE: 4+4 und alle Solo-Modi verhalten sich UNVERAENDERT -- zeichengenau wie vor dieser
 *     Aenderung.
 *  6. GEGENPROBE: der Beitritt gibt dem Gast auch in den neuen Modi Teams.
 */
import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  ROOM_OWNERSHIP_PRESET_IDS,
  UnknownRoomOwnershipPresetError,
  buildOwnershipForPreset,
  buildParticipant,
  resolveFoundationSaveModeForPreset,
} from "@/lib/room/online-room-model";
import { getGameModeOwnershipLimits } from "@/lib/foundation/team-control-settings";
import { createRoom, joinRoom, resetRuntimeRoomsForTests, setParticipantReadyState, startRoom } from "@/lib/room/room-store";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import type { RoomOwnershipPreset } from "@/types/events";

const host = buildParticipant({ participantId: "p-host", userId: "u-host", displayName: "Chris", role: "host" });
const franky = buildParticipant({ participantId: "p-franky", userId: "u-franky", displayName: "Franky", role: "player" });

/** Gleicher In-Memory-Persistence-Stub wie in tests/raum-hosten-und-teams-zuteilen.test.ts. */
function createFakePersistence() {
  const saves = new Map<string, PersistedSaveGame>();
  const service = {
    getSaveById: (saveId: string) => saves.get(saveId) ?? null,
    createFreshSeasonOneSave: (input?: { saveId?: string; name?: string; status?: "active" | "archived" | "template" }) => {
      const save = {
        saveId: input?.saveId ?? `fake-${saves.size}`,
        name: input?.name ?? "Fake",
        status: input?.status ?? "active",
      } as unknown as PersistedSaveGame;
      saves.set(save.saveId, save);
      return save;
    },
    saveSingleplayerState: (saveId: string, gameState: unknown) => {
      const existing = saves.get(saveId);
      const save = {
        ...(existing ?? {}),
        saveId,
        name: existing?.name ?? "Fake",
        status: existing?.status ?? "archived",
        gameState,
      } as unknown as PersistedSaveGame;
      saves.set(saveId, save);
      return save;
    },
  };
  return { service: service as unknown as PersistenceService, saves };
}

describe("buildOwnershipForPreset -- 1+1 und 2+2 (Eigenschaften 1+2)", () => {
  it("chris_1_franky_1_rest_ai: Chris und Franky bekommen je genau ein Team -- die ERSTEN Eintraege der 4+4-Listen", () => {
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_1_franky_1_rest_ai");
    const chrisTeams = ergebnis
      .filter((entry) => entry.controllerType === "human" && entry.ownerDisplayName === "Chris")
      .map((entry) => entry.teamId);
    const frankyTeams = ergebnis
      .filter((entry) => entry.controllerType === "human" && entry.ownerDisplayName === "Franky")
      .map((entry) => entry.teamId);
    // "P-S"/"M-S" sind FOUR_PLUS_FOUR_HOST_TEAM_IDS[0]/FOUR_PLUS_FOUR_FRANKY_TEAM_IDS[0]
    // (online-room-model.ts) -- zeichengenau dieselben Werte wie im 4+4-Preset an erster Stelle
    // (siehe tests/raum-preset-zuteilungstabelle.test.ts), nicht neu erfunden.
    expect(chrisTeams).toEqual(["P-S"]);
    expect(frankyTeams).toEqual(["M-S"]);
  });

  it("chris_2_franky_2_rest_ai: Chris und Franky bekommen je genau zwei Teams -- die ERSTEN ZWEI der 4+4-Listen", () => {
    const ergebnis = buildOwnershipForPreset([host, franky], "chris_2_franky_2_rest_ai");
    // `buildOwnershipForPreset` gibt die Zeilen in der Reihenfolge von `teamIds`
    // (ONLINE_ROOM_TEAM_IDS) zurueck, nicht in Zuteilungs-Reihenfolge -- sortiert vergleichen wie in
    // tests/raum-preset-zuteilungstabelle.test.ts ("zerlegt"-Helfer dort).
    const chrisTeams = ergebnis
      .filter((entry) => entry.controllerType === "human" && entry.ownerDisplayName === "Chris")
      .map((entry) => entry.teamId)
      .sort();
    const frankyTeams = ergebnis
      .filter((entry) => entry.controllerType === "human" && entry.ownerDisplayName === "Franky")
      .map((entry) => entry.teamId)
      .sort();
    expect(chrisTeams).toEqual(["D-P", "P-S"]);
    expect(frankyTeams).toEqual(["M-S", "P-C"]);
  });

  it("chris_1_franky_1_rest_ai OHNE Franky: Chris bekommt sein eines Team, Frankys Team bleibt ai (wie beim 4+4-Preset gemessen)", () => {
    const ergebnis = buildOwnershipForPreset([host], "chris_1_franky_1_rest_ai");
    expect(ergebnis.find((entry) => entry.teamId === "P-S")).toMatchObject({ controllerType: "human", ownerDisplayName: "Chris" });
    expect(ergebnis.find((entry) => entry.teamId === "M-S")).toMatchObject({ controllerType: "ai" });
  });
});

describe("resolveFoundationSaveModeForPreset (Eigenschaft 4 + Gegenprobe 5)", () => {
  it("liefert fuer die zwei neuen Presets ihren eigenen Save-Modus (E4)", () => {
    expect(resolveFoundationSaveModeForPreset("chris_1_franky_1_rest_ai")).toBe("online_1v1");
    expect(resolveFoundationSaveModeForPreset("chris_2_franky_2_rest_ai")).toBe("online_2v2");
  });

  it("GEGENPROBE: 4+4 und alle Solo-Presets bleiben zeichengenau bei 'online_4v4'", () => {
    // GEMESSEN (Kommentar an PresetOwnershipSpec.saveMode, online-room-model.ts): vor Paket 2
    // schrieb room-store.ts `saveMode: "online_4v4"` woertlich, fuer JEDEN Preset -- diese vier
    // Zeilen aendern das Ergebnis nicht, nur WIE es zustande kommt (Tabellenzeile statt Literal).
    expect(resolveFoundationSaveModeForPreset("chris_4_franky_4_rest_ai")).toBe("online_4v4");
    expect(resolveFoundationSaveModeForPreset("chris_1_rest_ai")).toBe("online_4v4");
    expect(resolveFoundationSaveModeForPreset("chris_2_rest_ai")).toBe("online_4v4");
    expect(resolveFoundationSaveModeForPreset("chris_4_rest_ai")).toBe("online_4v4");
  });

  it("GEGENPROBE: kein/unbekannter Preset faellt weiterhin auf 'online_4v4' zurueck", () => {
    expect(resolveFoundationSaveModeForPreset(null)).toBe("online_4v4");
    expect(resolveFoundationSaveModeForPreset(undefined)).toBe("online_4v4");
    expect(resolveFoundationSaveModeForPreset("chris_99_rest_ai" as RoomOwnershipPreset)).toBe("online_4v4");
  });
});

describe("getGameModeOwnershipLimits -- die neuen Save-Modi (Eigenschaft 4 + Gegenprobe 5)", () => {
  it("online_1v1: Obergrenze 1/1", () => {
    expect(getGameModeOwnershipLimits("online_1v1")).toEqual({ chrisMax: 1, frankyMax: 1 });
  });
  it("online_2v2: Obergrenze 2/2", () => {
    expect(getGameModeOwnershipLimits("online_2v2")).toEqual({ chrisMax: 2, frankyMax: 2 });
  });
  it("GEGENPROBE: online_4v4 bleibt 4/4", () => {
    expect(getGameModeOwnershipLimits("online_4v4")).toEqual({ chrisMax: 4, frankyMax: 4 });
  });
});

describe("ROOM_OWNERSHIP_PRESET_IDS -- eine Quelle fuer beide Oberflaechen (Eigenschaft 3)", () => {
  /**
   * DIESE PRUEFUNG SOLL BEIM SIEBTEN MODUS ROT WERDEN — das ist Absicht, kein Versehen.
   *
   * In diesem Vorhaben sind wir viermal ueber Tests gestolpert, die den alten Zustand als den
   * richtigen festhielten, ohne dass jemand ihnen ansah, ob das gewollt war (siehe
   * docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md, Abschnitt 4). Damit dieser hier nicht der fuenfte
   * wird: er ist ein absichtlicher Stolperdraht. Wer einen Modus hinzufuegt, soll ihn hier
   * eintragen — und dabei durch die Pruefung darunter daran erinnert werden, ihn in BEIDEN
   * Oberflaechen zu beschriften.
   *
   * Rot heisst hier also: "trag deinen neuen Modus ein", nicht "du hast etwas kaputtgemacht".
   */
  it("enthaelt genau die sechs bekannten Presets", () => {
    expect([...ROOM_OWNERSHIP_PRESET_IDS].sort()).toEqual(
      [
        "chris_1_franky_1_rest_ai",
        "chris_1_rest_ai",
        "chris_2_franky_2_rest_ai",
        "chris_2_rest_ai",
        "chris_4_franky_4_rest_ai",
        "chris_4_rest_ai",
      ].sort(),
    );
  });

  it("bietet die Modi NACH GROESSE sortiert an, nicht in der Reihenfolge ihrer Entstehung", () => {
    /**
     * Entscheidung von Chris ("sortier nach größe"). Die Reihenfolge ist nirgends sonst
     * festgehalten: sie ergibt sich aus der ZEILENFOLGE in `PRESET_OWNERSHIP_TABLE`
     * (`Object.keys`), und beide Oberflaechen bauen ihr Auswahlfeld daraus. Ohne diese Pruefung
     * verschiebt die naechste Umsortierung der Tabelle — etwa "der Ordnung halber" alphabetisch —
     * still das, was der Spieler im Auswahlfeld sieht, ohne dass jemand die Oberflaeche angefasst
     * haette.
     *
     * Bewusst gegen die ECHTE exportierte Liste geprueft, nicht gegen eine hier abgeschriebene
     * Kopie — sonst pruefte der Test seine eigene Kopie.
     */
    expect([...ROOM_OWNERSHIP_PRESET_IDS]).toEqual([
      "chris_1_rest_ai",
      "chris_1_franky_1_rest_ai",
      "chris_2_rest_ai",
      "chris_2_franky_2_rest_ai",
      "chris_4_rest_ai",
      "chris_4_franky_4_rest_ai",
    ]);
  });

  // FUND (Befund 1.3 im Plan): vor Paket 2 pflegten app/HomePageClient.tsx und
  // app/room/[roomCode]/RoomPageClient.tsx ihre PRESET_OPTIONS als zwei eigene, handkopierte
  // Arrays -- ein Preset, der nur in einer Datei landete, war an der anderen unsichtbar, ohne dass
  // irgendein Test das gemerkt haette. Dieser Test liest die ECHTE, aktuell exportierte Preset-
  // Menge (nicht eine hier erneut abgeschriebene Kopie!) und verlangt, dass JEDER Wert als
  // Zeichenkette in BEIDEN Quelltexten auftaucht -- ein kuenftiger siebter Preset, der nur in einer
  // der beiden Dateien beschriftet wird, laesst genau diesen Test rot werden.
  it("jeder Preset aus ROOM_OWNERSHIP_PRESET_IDS taucht in BEIDEN Oberflaechen auf", async () => {
    const homeText = await fs.readFile(path.join(process.cwd(), "app/HomePageClient.tsx"), "utf8");
    const roomText = await fs.readFile(path.join(process.cwd(), "app/room/[roomCode]/RoomPageClient.tsx"), "utf8");

    for (const presetId of ROOM_OWNERSHIP_PRESET_IDS) {
      // Kein Quote-Zwang: als Objektschluessel (PRESET_LABELS) steht der Preset-Name unquotiert
      // im Quelltext (gueltiger JS-Identifier) -- reiner Teilstring-Nachweis genuegt hier, wie im
      // bestehenden tests/multiplayer-room-ui-contract.test.ts auch (`toContain("chris_1_rest_ai")`).
      expect(homeText, `HomePageClient.tsx fehlt "${presetId}"`).toContain(presetId);
      expect(roomText, `RoomPageClient.tsx fehlt "${presetId}"`).toContain(presetId);
    }

    // Und umgekehrt: beide Dateien ziehen die MENGE tatsaechlich aus der geteilten Quelle, statt
    // (zusaetzlich zur Textliste oben) weiterhin ein eigenes, vollstaendiges Array zu pflegen.
    expect(homeText).toContain("ROOM_OWNERSHIP_PRESET_IDS");
    expect(roomText).toContain("ROOM_OWNERSHIP_PRESET_IDS");
  });
});

describe("Raum-Start mit den neuen Modi -- Save-Modus passt zum Raum-Modus (Eigenschaft 4, Ende-zu-Ende)", () => {
  it("ein frischer 1+1-Raum bindet einen Save mit saveMode 'online_1v1'", async () => {
    resetRuntimeRoomsForTests();
    const persistence = createFakePersistence();
    const created = createRoom("socket-1v1-a", { displayName: "Chris", preset: "chris_1_franky_1_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-1v1-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    // GEGENPROBE 6: der Beitritt gibt dem Gast auch im neuen Modus ein Team (nicht leer).
    const frankyTeams = joined.room.state.teamOwnership.filter(
      (entry) => entry.controllerType === "human" && entry.ownerDisplayName === "Franky",
    );
    expect(frankyTeams).toHaveLength(1);
    expect(frankyTeams[0]?.teamId).toBe("M-S");

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const boundSave = persistence.saves.get(started.room.state.multiplayerRoom.saveId);
    expect(boundSave).toBeTruthy();
    const scenarioMeta = (boundSave?.gameState as { scenarioMeta?: { saveMode?: string; humanControlledTeamCount?: number } })
      .scenarioMeta;
    expect(scenarioMeta?.saveMode).toBe("online_1v1");
    expect(scenarioMeta?.humanControlledTeamCount).toBe(2);
  }, 120_000);

  it("ein frischer 2+2-Raum bindet einen Save mit saveMode 'online_2v2'", async () => {
    resetRuntimeRoomsForTests();
    const persistence = createFakePersistence();
    const created = createRoom("socket-2v2-a", { displayName: "Chris", preset: "chris_2_franky_2_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-2v2-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const boundSave = persistence.saves.get(started.room.state.multiplayerRoom.saveId);
    const scenarioMeta = (boundSave?.gameState as { scenarioMeta?: { saveMode?: string } }).scenarioMeta;
    expect(scenarioMeta?.saveMode).toBe("online_2v2");
  }, 120_000);

  it("GEGENPROBE: ein 4+4-Raum bindet weiterhin einen Save mit saveMode 'online_4v4' (unveraendert)", async () => {
    resetRuntimeRoomsForTests();
    const persistence = createFakePersistence();
    const created = createRoom("socket-4v4-a", { displayName: "Chris", preset: "chris_4_franky_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-4v4-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const boundSave = persistence.saves.get(started.room.state.multiplayerRoom.saveId);
    const scenarioMeta = (boundSave?.gameState as { scenarioMeta?: { saveMode?: string } }).scenarioMeta;
    expect(scenarioMeta?.saveMode).toBe("online_4v4");
  }, 120_000);

  it("GEGENPROBE: ein Solo-Raum (chris_1_rest_ai) bindet weiterhin einen Save mit saveMode 'online_4v4' (unveraendert, siehe Kommentar an der Tabelle)", async () => {
    resetRuntimeRoomsForTests();
    const persistence = createFakePersistence();
    const created = createRoom("socket-solo-a", { displayName: "Chris", preset: "chris_1_rest_ai" });

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const boundSave = persistence.saves.get(started.room.state.multiplayerRoom.saveId);
    const scenarioMeta = (boundSave?.gameState as { scenarioMeta?: { saveMode?: string } }).scenarioMeta;
    expect(scenarioMeta?.saveMode).toBe("online_4v4");
  }, 120_000);

  it("eine Umverteilung NACH dem Start (applyRoomTeamSelection -> syncRoomOwnershipToBoundSave) haelt saveMode 'online_1v1' -- nicht 'online_4v4'", async () => {
    resetRuntimeRoomsForTests();
    const persistence = createFakePersistence();
    const created = createRoom("socket-1v1-resync-a", { displayName: "Chris", preset: "chris_1_franky_1_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-1v1-resync-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    // "training" ist ein Vorsaison-Schritt (siehe tests/raum-hosten-und-teams-zuteilen.test.ts) --
    // Umverteilen ist hier erlaubt und loest syncRoomOwnershipToBoundSave aus.
    const { applyRoomTeamSelection } = await import("@/lib/room/room-store");
    const reassigned = applyRoomTeamSelection(
      created.room.roomCode,
      created.seat.seatToken,
      { chrisTeamIds: ["P-S"], frankyTeamIds: ["M-S"] },
      { persistence: persistence.service },
    );
    expect(reassigned.ok).toBe(true);

    const boundSave = persistence.saves.get(started.room.state.multiplayerRoom.saveId);
    const scenarioMeta = (boundSave?.gameState as { scenarioMeta?: { saveMode?: string } }).scenarioMeta;
    expect(scenarioMeta?.saveMode).toBe("online_1v1");
  }, 120_000);

  // FUND, waehrend dieses Pakets selbst gemessen (nicht im Auftrag genannt): `applyRoomOwnershipPreset`
  // (der Preset-Knopf IM Raum, RoomPageClient.tsx) aenderte `multiplayerRoom.createdWithPreset`
  // bisher NICHT -- nur `ownershipAssignedByHost`. Ein Host, der den Raum mit 4+4 anlegt und dann
  // im Raum auf 1+1 umschaltet, haette eine 1+1-Team-Zuteilung, aber `createdWithPreset` waere auf
  // "chris_4_franky_4_rest_ai" stehengeblieben -- und `syncRoomOwnershipToBoundSave` haette darueber
  // weiterhin "online_4v4" geschrieben (Eigenschaft 4 verletzt). Behoben: `applyRoomOwnershipPreset`
  // aktualisiert `createdWithPreset` jetzt mit -- Begruendung/Gefahrlosigkeit fuer `joinRoom`s
  // Rangfolge steht am Kommentar dort (room-store.ts).
  it("FUND: der Preset-Knopf IM RAUM (applyRoomOwnershipPreset) aktualisiert den Save-Modus mit, nicht nur die Team-Zuteilung", async () => {
    resetRuntimeRoomsForTests();
    const persistence = createFakePersistence();
    // Angelegt mit 4+4 -- der Host wechselt danach ueber den Preset-Knopf im Raum auf 1+1, OHNE
    // den Raum neu anzulegen (derselbe Ablauf wie beim echten Preset-Selector in RoomPageClient.tsx).
    const created = createRoom("socket-preset-switch-a", { displayName: "Chris", preset: "chris_4_franky_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-preset-switch-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const { applyRoomOwnershipPreset } = await import("@/lib/room/room-store");
    const switched = applyRoomOwnershipPreset(created.room.roomCode, created.seat.seatToken, "chris_1_franky_1_rest_ai", {
      persistence: persistence.service,
    });
    expect(switched.ok).toBe(true);
    if (!switched.ok) return;
    expect(switched.room.state.multiplayerRoom.createdWithPreset).toBe("chris_1_franky_1_rest_ai");

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const boundSave = persistence.saves.get(started.room.state.multiplayerRoom.saveId);
    const scenarioMeta = (boundSave?.gameState as { scenarioMeta?: { saveMode?: string } }).scenarioMeta;
    expect(scenarioMeta?.saveMode, "der Save-Modus muss dem ZULETZT gewaehlten Preset folgen, nicht dem urspruenglichen").toBe(
      "online_1v1",
    );
  }, 120_000);
});

/**
 * PAKET 3 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md) — und der Zuschnitt hat sich beim Messen
 * geaendert, das gehoert hierher:
 *
 * Der Plan wollte "einen der neuen Modi durch ein Tor fahren", weil ein Modus, den kein Tor
 * durchlaeuft, still verrottet. Nachgesehen: `npm test` laeuft im CI-Job `full-test-suite`, diese
 * Datei also auch — die neuen Modi SIND bereits im Tor, seit Paket 2. Die Annahme des Plans war
 * ueberholt.
 *
 * Offen war dafuer etwas anderes, und zwar etwas, das PAKET 1 selbst aufgemacht hat: seit dort
 * wirft `buildOwnershipForPreset` bei einem unbekannten Modus (richtig so — vorher vergab derselbe
 * Fall still vier Teams). Der Socket-Einstieg `createRoom` hatte aber keine Stelle, die das faengt.
 *
 * GEMESSEN gegen einen laufenden Server, vor der Reparatur: der Client bekam WEDER `roomJoined`
 * NOCH `roomError` — er haengt stumm — und der Wurf landete als `uncaughtException`
 * (`at Socket.<anonymous> (lib/socket/server.ts)`). Dass der Prozess weiterlief, verdankte er
 * allein dem Auffangnetz des Next-Dev-Servers; ein eigenes gibt es nicht.
 *
 * Der reale Weg dorthin ist ein Deploy: nach dem Umbenennen oder Entfernen eines Modus schickt
 * jeder noch offene Browser-Tab weiter den alten Namen.
 *
 * WAS DIESE PRUEFUNG KANN UND WAS NICHT: sie liest den Quelltext und haelt fest, DASS der
 * Einstieg den Fehlertyp faengt und als `roomError` meldet. Sie ersetzt keinen Socket-Lauf — der
 * Beweis, dass beim Client wirklich ein `roomError` ankommt und der gueltige Modus weiter
 * durchgeht, wurde von Hand gegen einen laufenden Server gefuehrt (Ergebnis im Commit).
 */
describe("Unbekannter Modus haengt den Client nicht auf (Paket 3)", () => {
  it("createRoom wirft fuer einen unbekannten Modus, statt still vier Teams zu vergeben", () => {
    expect(() =>
      buildOwnershipForPreset([host], "chris_9_franky_9_rest_ai" as RoomOwnershipPreset),
    ).toThrow(UnknownRoomOwnershipPresetError);
  });

  it("der Socket-Einstieg faengt genau diesen Fehler und meldet ihn als roomError", async () => {
    const quelltext = await fs.readFile(path.join(process.cwd(), "lib/socket/server.ts"), "utf8");
    const handler = quelltext.slice(quelltext.indexOf('socket.on("createRoom"'));
    const bisEnde = handler.slice(0, handler.indexOf('socket.on("joinRoom"'));

    expect(bisEnde, "ohne try/catch landet der Wurf als uncaughtException").toContain("catch");
    expect(bisEnde).toContain("UnknownRoomOwnershipPresetError");
    expect(bisEnde, "der Spieler braucht eine Meldung, keinen stummen Klick").toContain("emitRoomError");
    // GEGENPROBE: nur DIESER Fehlertyp wird geschluckt — ein echter Programmfehler muss weiter
    // fliegen, statt als hoefliche Meldung zu verschwinden.
    expect(bisEnde).toContain("throw error");
  });
});

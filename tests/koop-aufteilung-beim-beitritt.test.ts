/**
 * WER BEKOMMT BEIM BEITRITT WELCHE TEAMS (Aufgabe #49).
 *
 * Der Beitritt ist die EINZIGE Stelle, an der der zweite Sitz ueberhaupt Teams bekommt: beim
 * Anlegen ist Franky noch nicht da, und `buildExplicitTeamOwnership` laesst die Teams eines
 * abwesenden Teilnehmers bewusst offen. Genau deshalb sind zwei fruehere Anlaeufe gescheitert —
 * beide haben diese eine Stelle mit einer abgeleiteten Quelle ueberschrieben, und beide Male ging
 * Franky leer aus. Die Faelle dazu stehen unten ausdruecklich als eigene Pruefungen.
 *
 * DIE ENTSCHEIDUNG, die vorher fehlte: bei Widerspruch gewinnt DER HOST. Wer beim Anlegen einen
 * Modus waehlt, trifft eine Wahl; eine Ableitung aus dem Spielstand darf sie nicht ueberstimmen.
 *
 * Rangfolge: (1) Host hat im Raum zugeteilt, (2) sonst das Preset vom Anlegen, (3) sonst die
 * Aufteilung aus dem Spielstand, wenn sie BEIDE Seiten nennt, (4) sonst der 4+4-Vorschlag.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { applyRoomTeamSelection, createRoom, joinRoom, resetRuntimeRoomsForTests } from "@/lib/room/room-store";

const AUFBAU_ZEITGRENZE_MS = 120_000;

function teamsVon(room: { state: { roomParticipants: { displayName: string; controlledTeamIds: string[] }[] } }, name: string) {
  return [...(room.state.roomParticipants.find((entry) => entry.displayName === name)?.controlledTeamIds ?? [])].sort();
}

/** Ein echter Spielstand, dessen `teamControlSettings` eine bestimmte Aufteilung tragen. */
function saveMitAufteilung(input: { name: string; chrisTeamIds: string[]; frankyTeamIds: string[] }) {
  const persistence = createPersistenceService();
  const angelegt = persistence.createFreshSeasonOneSave({ name: input.name });
  const mitBesitz = applyGameModeOwnership(angelegt.gameState, {
    saveMode: "online_4v4",
    chrisTeamIds: input.chrisTeamIds,
    frankyTeamIds: input.frankyTeamIds,
  });
  persistence.saveSingleplayerState(angelegt.saveId, mitBesitz);
  return { persistence, saveId: angelegt.saveId };
}

describe("Koop-Aufteilung beim Beitritt (#49)", () => {
  beforeEach(() => {
    resetDatabaseForTests();
    resetRuntimeRoomsForTests();
  });

  it(
    "Stufe 3: die Aufteilung AUS DEM SPIELSTAND wird wiederhergestellt, wenn sie beide Seiten nennt",
    () => {
      const { persistence, saveId } = saveMitAufteilung({
        name: "Koop-Aufteilung-wiederherstellen",
        chrisTeamIds: ["A-A", "B-B"],
        frankyTeamIds: ["Z-H", "W-W"],
      });

      // OHNE Preset angelegt — der Host sagt nichts, also darf der Spielstand sprechen.
      const created = createRoom("a49-a", { displayName: "Chris", saveId }, null, { persistence });
      const joined = joinRoom(created.room.roomCode, "a49-b", { displayName: "Franky" }, null, { persistence });
      expect(joined.ok).toBe(true);
      if (!joined.ok) return;

      expect(teamsVon(joined.room, "Chris")).toEqual(["A-A", "B-B"]);
      expect(teamsVon(joined.room, "Franky"), "genau das war die Luecke: Frankys Teams kamen nie zurueck").toEqual([
        "W-W",
        "Z-H",
      ]);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Stufe 2 schlaegt Stufe 3: ein beim Anlegen gewaehltes Preset ueberstimmt den Spielstand",
    () => {
      // GENAU DER FALL, an dem Anlauf 2 gescheitert ist: der Spielstand trug bereits eine
      // Koop-Aufteilung und schlug damit das Preset, das der Host ausdruecklich mitgegeben hatte.
      const { persistence, saveId } = saveMitAufteilung({
        name: "Koop-Aufteilung-Host-gewinnt",
        chrisTeamIds: ["A-A", "B-B"],
        frankyTeamIds: ["Z-H", "W-W"],
      });

      const created = createRoom(
        "a49-c",
        { displayName: "Chris", saveId, preset: "chris_4_franky_4_rest_ai" },
        null,
        { persistence },
      );
      const joined = joinRoom(created.room.roomCode, "a49-d", { displayName: "Franky" }, null, { persistence });
      expect(joined.ok).toBe(true);
      if (!joined.ok) return;

      expect(teamsVon(joined.room, "Chris"), "die Wahl des Hosts gilt, nicht der alte Stand").toEqual([
        "D-P",
        "M-M",
        "P-S",
        "V-W",
      ]);
      expect(teamsVon(joined.room, "Franky")).toEqual(["C-S", "G-G", "M-S", "P-C"]);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Stufe 4: nennt der Spielstand nur EINE Seite, bleibt es beim 4+4-Vorschlag",
    () => {
      // GENAU DER FALL, an dem Anlauf 1 gescheitert ist: ein Stand mit einem einzigen Team ist die
      // Handschrift eines Solo-Standes. Ihn gewinnen zu lassen stutzte Chris auf dieses eine Team
      // und liess Franky voellig leer ausgehen.
      const { persistence, saveId } = saveMitAufteilung({
        name: "Koop-Aufteilung-nur-eine-Seite",
        chrisTeamIds: ["M-M"],
        frankyTeamIds: [],
      });

      const created = createRoom("a49-e", { displayName: "Chris", saveId }, null, { persistence });
      const joined = joinRoom(created.room.roomCode, "a49-f", { displayName: "Franky" }, null, { persistence });
      expect(joined.ok).toBe(true);
      if (!joined.ok) return;

      expect(teamsVon(joined.room, "Chris")).toHaveLength(4);
      expect(teamsVon(joined.room, "Franky"), "Franky darf NIE leer ausgehen").toHaveLength(4);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Stufe 1 schlaegt alles: hat der Host im Raum selbst zugeteilt, bleibt seine Wahl unangetastet",
    () => {
      const { persistence, saveId } = saveMitAufteilung({
        name: "Koop-Aufteilung-Host-hat-zugeteilt",
        chrisTeamIds: ["A-A", "B-B"],
        frankyTeamIds: ["Z-H", "W-W"],
      });

      const created = createRoom("a49-g", { displayName: "Chris", saveId }, null, { persistence });
      // Der Host teilt im Raum ausdruecklich zu — noch bevor Franky da ist.
      const zugeteilt = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
        chrisTeamIds: ["T-T", "T-G"],
        frankyTeamIds: [],
      });
      expect(zugeteilt.ok).toBe(true);

      const joined = joinRoom(created.room.roomCode, "a49-h", { displayName: "Franky" }, null, { persistence });
      expect(joined.ok).toBe(true);
      if (!joined.ok) return;

      expect(teamsVon(joined.room, "Chris"), "die Zuteilung des Hosts wird nicht ueberschrieben").toEqual(["T-G", "T-T"]);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "GEGENPROBE: ein SOLO-Preset beim Anlegen darf den Gast nicht leer ausgehen lassen",
    () => {
      // DIESER FALL HAT MICH KORRIGIERT. Erst liess ich das Preset vom Anlegen immer gewinnen —
      // dann bekam Franky bei "Chris 4, Rest KI" gar nichts, obwohl er gerade beigetreten IST. Ein
      // Modus ohne zweiten Sitz sagt ueber den zweiten Sitz nichts; er darf ihn nicht entscheiden.
      // Geprueft wird am ERGEBNIS (bekommt der Gast Teams?), nicht am Namen des Presets — so gilt
      // die Regel auch fuer Modi, die es noch nicht gibt.
      const created = createRoom("a49-k", { displayName: "Chris", preset: "chris_4_rest_ai" });
      const joined = joinRoom(created.room.roomCode, "a49-l", { displayName: "Franky" });
      expect(joined.ok).toBe(true);
      if (!joined.ok) return;

      expect(teamsVon(joined.room, "Franky"), "Franky darf NIE leer ausgehen").not.toHaveLength(0);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "GEGENPROBE: ohne Spielstand und ohne Preset bleibt es beim bisherigen Verhalten",
    () => {
      const created = createRoom("a49-i", { displayName: "Chris" });
      const joined = joinRoom(created.room.roomCode, "a49-j", { displayName: "Franky" });
      expect(joined.ok).toBe(true);
      if (!joined.ok) return;

      expect(teamsVon(joined.room, "Chris")).toHaveLength(4);
      expect(teamsVon(joined.room, "Franky")).toHaveLength(4);
    },
    AUFBAU_ZEITGRENZE_MS,
  );
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { authorizeTeamWrite, buildExplicitTeamOwnership } from "@/lib/room/online-room-model";
import { createRoom, getRoom, joinRoom } from "@/lib/room/room-store";

/**
 * DER GAST KAM NIE DURCH SEINEN "TRANSFERS FINALISIEREN"-SCHRITT.
 *
 * `/api/lineups/legacy/finalize-transfers` autorisierte mit `formcards_season_regenerate`, und die
 * steht in `HOST_LEVEL_ACTIONS` (`server-authoritative-write-guard.ts`) — im Raum also 403
 * `host_only_action` fuer jeden ausser dem Host.
 *
 * DAS BLIEB NICHT BEI EINEM ROTEN KNOPF: die Bestaetigung des Flow-Schritts
 * (`acknowledgeFlowStep("finalize_transfers")`) passiert erst NACH einer erfolgreichen Antwort.
 * Der Gast meldete sich also nie bereit, und `canHostAdvance` verlangt alle Menschen bereit — der
 * Spieltagszyklus stand still.
 *
 * Befund F10 hatte das bereits nachgemessen, aber nur die MELDUNG geradegezogen. Diese Suite haelt
 * fest, dass jetzt auch die Sache stimmt.
 */
describe("Der Gast schliesst seine eigenen Transfers ab", () => {
  it("die Route benutzt die team-bezogene Klasse, nicht die host-only Regenerier-Klasse", () => {
    const quelle = readFileSync(join(process.cwd(), "app/api/lineups/legacy/finalize-transfers/route.ts"), "utf8");
    expect(quelle).toContain('action: "formcards",');
    expect(quelle).not.toContain('action: "formcards_season_regenerate",');
  });

  it("GEGENPROBE: der zerstoererische Regenerier-Weg bleibt host-only", () => {
    const quelle = readFileSync(join(process.cwd(), "lib/room/server-authoritative-write-guard.ts"), "utf8");
    // Die Klasse selbst bleibt in der Host-Liste — nur diese eine, idempotente Route benutzt sie
    // nicht mehr. Ohne diese Gegenprobe koennte man den Befund auch "beheben", indem man die
    // Sperre ganz aufmacht.
    expect(quelle).toContain('"formcards_season_regenerate",');
  });

  it("mit der team-bezogenen Klasse darf jeder fuer SEINE Teams, aber nicht fuer fremde", () => {
    const erstellt = createRoom("socket-final-a", { displayName: "Chris" });
    const beigetreten = joinRoom(erstellt.room.roomCode, "socket-final-b", { displayName: "Franky" });
    expect(beigetreten.ok).toBe(true);
    if (!beigetreten.ok) return;
    const room = getRoom(erstellt.room.roomCode);
    expect(room).not.toBeNull();
    if (!room) throw new Error("Raum fehlt");

    const chris = room.state.roomParticipants[0];
    const franky = room.state.roomParticipants[1];
    expect(chris).toBeTruthy();
    expect(franky).toBeTruthy();
    if (!chris || !franky) return;

    const verteilt = buildExplicitTeamOwnership(room.state.roomParticipants, {
      chrisTeamIds: ["P-S"],
      frankyTeamIds: ["M-S"],
    });
    expect(verteilt.ok).toBe(true);
    if (!verteilt.ok) return;
    const zustand = { roomParticipants: room.state.roomParticipants, teamOwnership: verteilt.ownership };

    // Der Gast fuer SEIN Team: erlaubt. Genau das war vorher 403 host_only_action.
    expect(
      authorizeTeamWrite({ state: zustand, participantId: franky.participantId, teamId: "M-S", action: "formcards" }).allowed,
    ).toBe(true);
    // Der Host fuer SEIN Team: unveraendert erlaubt.
    expect(
      authorizeTeamWrite({ state: zustand, participantId: chris.participantId, teamId: "P-S", action: "formcards" }).allowed,
    ).toBe(true);
    // Und niemand fuer ein fremdes Team — die Besitz-Isolation bleibt, sie wird hier nicht
    // gegen die Bequemlichkeit eingetauscht.
    expect(
      authorizeTeamWrite({ state: zustand, participantId: franky.participantId, teamId: "P-S", action: "formcards" }).allowed,
    ).toBe(false);
    expect(
      authorizeTeamWrite({ state: zustand, participantId: chris.participantId, teamId: "M-S", action: "formcards" }).allowed,
    ).toBe(false);
  });
});

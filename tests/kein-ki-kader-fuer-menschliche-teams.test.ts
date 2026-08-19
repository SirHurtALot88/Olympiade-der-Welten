/**
 * KEIN KI-KADERLAUF AUF EIN MENSCHLICH GEFUEHRTES TEAM — auch nicht auf das eigene.
 *
 * ENTSCHEIDUNG VON CHRIS (19.08.): "keiner von uns soll seinen kader per KI füllen! weg damit."
 *
 * Vorher gab es dafuer den Knopf "Kader auffüllen" im Team-Fokus. Er erschien ausschliesslich auf
 * einem selbst gefuehrten Team im Saisonende-Fenster — also genau in dem Fall, den es nicht mehr
 * geben soll. Er ist raus.
 *
 * DER EIGENTLICHE BEFUND WAR ABER NICHT DER KNOPF, sondern was der Server ohne ihn tat. Bei der
 * Fehlerjagd gemessen: ein Lauf auf ein Team, das der Aufrufer nicht bedienen darf, antwortete mit
 * HTTP 200, `executed: true`, `status: "applied"` — und schrieb nachweislich nichts
 * (`skippedTeamIds: ["M-M"]`, Kader danach 0). Die Oberflaeche meldete "KI-Picks angewendet.".
 * Ein Erfolg, der nichts tut, ist schlimmer als ein Fehler: man klickt nochmal, und nochmal.
 *
 * Geprueft wird deshalb beides — die Regel UND dass ihre Verletzung laut wird.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getHumanControlledTeamIds } from "@/lib/room/ai-bulk-team-write-scope";
import { lookupRoomWriteErrorMessage } from "@/lib/room/parse-room-write-context";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { RuntimeRoom } from "@/types/room";

function spielstand(steuerung: Record<string, "manual" | "ai">): GameState {
  return {
    teams: Object.keys(steuerung).map((teamId) => ({ teamId, name: teamId })),
    seasonState: {
      teamControlSettings: Object.fromEntries(
        Object.entries(steuerung).map(([teamId, modus]) => [teamId, { controlMode: modus }]),
      ),
    },
  } as unknown as GameState;
}

function raumMit(besitz: Array<{ teamId: string; controllerType: "human" | "ai" }>): RuntimeRoom {
  return { state: { teamOwnership: besitz } } as unknown as RuntimeRoom;
}

describe("Wo die KI ueberhaupt picken darf", () => {
  it("nennt jedes menschlich gefuehrte Team — unabhaengig davon, WEM es gehoert", () => {
    // Das ist der Unterschied zu `resolveAiBulkTeamWriteScope`: die fragt "wer darf hier
    // schreiben", diese "wo darf die KI ueberhaupt picken". Seit Chris' Entscheidung ist das
    // eigene Team genauso gesperrt wie das des Mitspielers.
    const raum = raumMit([
      { teamId: "P-S", controllerType: "human" },
      { teamId: "M-S", controllerType: "human" },
      { teamId: "A-A", controllerType: "ai" },
    ]);

    // Die Team-Liste kommt IMMER aus dem Spielstand; der Raum sagt nur, wer sie fuehrt.
    const menschlich = getHumanControlledTeamIds({
      gameState: spielstand({ "P-S": "manual", "M-S": "manual", "A-A": "ai" }),
      room: raum,
    });

    expect([...menschlich].sort()).toEqual(["M-S", "P-S"]);
  });

  it("ohne Raum zaehlt dieselbe Frage ueber die Team-Steuerung des Spielstands", () => {
    const menschlich = getHumanControlledTeamIds({
      gameState: spielstand({ "P-S": "manual", "A-A": "ai", "B-B": "ai" }),
      room: null,
    });

    expect([...menschlich]).toEqual(["P-S"]);
  });

  it("GEGENPROBE: eine reine KI-Liga sperrt nichts — der Liga-Draft bleibt moeglich", () => {
    const menschlich = getHumanControlledTeamIds({
      gameState: spielstand({ "A-A": "ai", "B-B": "ai" }),
      room: null,
    });

    expect([...menschlich]).toEqual([]);
  });
});

describe("Die Ablehnung ist laut, nicht still", () => {
  const route = readFileSync(resolve(process.cwd(), "app/api/ai/picks-run/route.ts"), "utf8");

  it("die Route weist ausdrueckliche Team-Anfragen auf menschliche Teams mit 403 ab", () => {
    expect(route).toContain("ai_picks_not_allowed_for_human_team");
    expect(route).toContain("getHumanControlledTeamIds");
    expect(route).toContain("status: 403");
  });

  it("der Code hat einen lesbaren Satz — kein roher Bezeichner in der Oberflaeche", () => {
    // Sonst stuende beim naechsten Versuch "ai_picks_not_allowed_for_human_team" auf dem Schirm.
    const satz = lookupRoomWriteErrorMessage("ai_picks_not_allowed_for_human_team");
    expect(satz).toBeTruthy();
    expect(satz).toMatch(/Transfermarkt/);
  });

  it("GEGENPROBE: ein Lauf OHNE ausdrueckliche Team-Liste bleibt moeglich", () => {
    // Der Liga-Draft und das Nachpicken der KI-Teams laufen ueber `teamScope`, nicht ueber
    // `teamIds` — sie duerfen von dieser Sperre nicht getroffen werden.
    expect(route).toMatch(/angefragteTeamIds && angefragteTeamIds\.length > 0/);
  });
});

describe("Der Knopf ist weg — in BEIDEN Ansichten", () => {
  /**
   * Es gab ihn ZWEIMAL: im alten Team-Panel und im „neuen Look". Gerendert wurde der im neuen
   * Look — wer nur den alten entfernt, hat nichts entfernt und meldet trotzdem Vollzug. Deshalb
   * pruefen wir beide Dateien, und zwar auf den AUFRUF, nicht auf die Beschriftung: ein Kommentar,
   * der den alten Text erklaert, ist erwuenscht und darf die Pruefung nicht rot machen.
   */
  const dateien = [
    "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx",
    "app/foundation/teams-v2/FoundationTeamsNewLook.tsx",
  ];

  it.each(dateien)("%s ruft den KI-Kaderlauf nicht mehr auf", (pfad) => {
    const inhalt = readFileSync(resolve(process.cwd(), pfad), "utf8");
    expect(inhalt).not.toContain("runTeamPicksRefill(");
    expect(inhalt).not.toContain("teamPicksRefillBusyTeamId !=");
  });

  it.each(dateien)("%s erklaert, warum dort nichts mehr steht", (pfad) => {
    // Eine kommentarlos geloeschte Zeile laedt dazu ein, sie beim naechsten Umbau wieder
    // einzufuegen.
    const inhalt = readFileSync(resolve(process.cwd(), pfad), "utf8");
    expect(inhalt).toMatch(/kader per\s*\n?\s*KI füllen/);
  });

  it("auch der Handler dahinter ist raus — kein toter Zustand, den jemand wieder verdrahtet", () => {
    const scope = readFileSync(
      resolve(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    expect(scope).not.toContain("setTeamPicksRefillBusyTeamId");
    expect(scope).toMatch(/HIER STAND/);
  });
});

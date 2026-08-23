/**
 * DIE MERKLISTEN-ANSICHT — „sich die dann noch mal angucken kann" (Chris).
 *
 * Geprueft wird das MODELL, nicht die Optik: es ist eine reine Ableitung aus dem Spielstand und
 * traegt die drei Entscheidungen, die man in der gezeichneten Ansicht nicht mehr sehen wuerde —
 * Reihenfolge, Umgang mit verschwundenen Eintraegen, und was bewusst NICHT angezeigt wird.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { baueMerklistenAnsicht } from "@/lib/merkliste/merkliste-ansicht";
import { merke } from "@/lib/merkliste/merkliste-service";

const CHRIS = "owner-chris";

function standMitLiga(): GameState {
  return {
    merkliste: [],
    teams: [
      { teamId: "V-W", name: "Vigilante Wranglers", shortCode: "V-W" },
      { teamId: "D-P", name: "Death Peaches", shortCode: "D-P" },
    ],
    players: [
      { id: "p-1", name: "Ada Blitz", className: "Sprinter" },
      { id: "p-2", name: "Bo Kraft", className: "Werfer" },
    ],
    rosters: [{ playerId: "p-1", teamId: "D-P" }],
    seasonState: {
      standings: {
        "V-W": { rank: 6, points: 99.3 },
        "D-P": { rank: 7, points: 94.6 },
      },
    },
  } as unknown as GameState;
}

describe("Merklisten-Ansicht", () => {
  it("trennt Teams und Spieler und zaehlt beides zusammen", () => {
    let stand = merke({ gameState: standMitLiga(), ownerId: CHRIS, art: "team", id: "D-P" });
    stand = merke({ gameState: stand, ownerId: CHRIS, art: "spieler", id: "p-1" });

    const ansicht = baueMerklistenAnsicht({ gameState: stand, ownerId: CHRIS });
    expect(ansicht.teams.map((zeile) => zeile.teamId)).toEqual(["D-P"]);
    expect(ansicht.spieler.map((zeile) => zeile.playerId)).toEqual(["p-1"]);
    expect(ansicht.gesamt).toBe(2);
  });

  it("stellt das Neueste nach vorn — die Liste ist ein Stapel, kein Ranking", () => {
    // Nach Saisonrang zu sortieren waere eine zweite, konkurrierende Lesart derselben Liste. Die
    // Reihenfolge, in der man etwas hineingelegt hat, ist die einzige, die man selbst gemacht hat.
    let stand = merke({
      gameState: standMitLiga(),
      ownerId: CHRIS,
      art: "team",
      id: "D-P",
      jetzt: "2026-08-23T08:00:00.000Z",
    });
    stand = merke({
      gameState: stand,
      ownerId: CHRIS,
      art: "team",
      id: "V-W",
      jetzt: "2026-08-23T09:00:00.000Z",
    });

    const ansicht = baueMerklistenAnsicht({ gameState: stand, ownerId: CHRIS });
    // V-W ist spaeter gemerkt worden und steht vorn — obwohl D-P den schlechteren Rang hat und
    // eine Rang-Sortierung ihn hinten einsortiert haette.
    expect(ansicht.teams.map((zeile) => zeile.teamId)).toEqual(["V-W", "D-P"]);
  });

  it("nimmt Rang und Punkte aus derselben Quelle wie die Saisontabelle", () => {
    const stand = merke({ gameState: standMitLiga(), ownerId: CHRIS, art: "team", id: "V-W" });
    const zeile = baueMerklistenAnsicht({ gameState: stand, ownerId: CHRIS }).teams[0];
    expect(zeile?.rank).toBe(6);
    expect(zeile?.points).toBeCloseTo(99.3, 5);
    expect(zeile?.fehlt).toBe(false);
  });

  it("nennt zu einem Spieler sein aktuelles Team — und laesst es leer, wenn er keins hat", () => {
    let stand = merke({ gameState: standMitLiga(), ownerId: CHRIS, art: "spieler", id: "p-1" });
    stand = merke({ gameState: stand, ownerId: CHRIS, art: "spieler", id: "p-2" });

    const nachId = new Map(
      baueMerklistenAnsicht({ gameState: stand, ownerId: CHRIS }).spieler.map((zeile) => [zeile.playerId, zeile]),
    );
    expect(nachId.get("p-1")?.teamName).toBe("Death Peaches");
    expect(nachId.get("p-2")?.teamId).toBeNull();
    expect(nachId.get("p-2")?.teamName).toBeNull();
  });

  it("VERSCHLUCKT keinen Eintrag, dessen Spieler es nicht mehr gibt — er wird gekennzeichnet", () => {
    // GENAU DER FEHLER DER SCOUTING-BEOBACHTUNGSLISTE, den ein Lesezeichen nicht machen darf: dort
    // verschwindet ein Spieler stillschweigend, sobald er in einem Kader steht. Wer ein
    // Lesezeichen setzt, will es wiederfinden — notfalls mit dem Hinweis, dass der Spieler weg ist.
    const stand = merke({ gameState: standMitLiga(), ownerId: CHRIS, art: "spieler", id: "gibt-es-nicht" });
    const ansicht = baueMerklistenAnsicht({ gameState: stand, ownerId: CHRIS });
    expect(ansicht.spieler).toHaveLength(1);
    expect(ansicht.spieler[0]?.fehlt).toBe(true);
    // Ohne Namen im Spielstand bleibt die ID stehen — besser als eine leere Zeile.
    expect(ansicht.spieler[0]?.name).toBe("gibt-es-nicht");
  });

  it("zeigt nur die Liste des gefragten Besitzers", () => {
    let stand = merke({ gameState: standMitLiga(), ownerId: CHRIS, art: "team", id: "D-P" });
    stand = merke({ gameState: stand, ownerId: "owner-franky", art: "team", id: "V-W" });
    expect(baueMerklistenAnsicht({ gameState: stand, ownerId: CHRIS }).teams.map((z) => z.teamId)).toEqual(["D-P"]);
  });

  it("kommt mit einem Spielstand ohne Merkliste und ohne Saison-Zustand zurecht", () => {
    // Dieselbe Vorsicht, die die Arena braucht: ein halbfertiger Spielstand darf nicht werfen.
    const ansicht = baueMerklistenAnsicht({ gameState: {} as unknown as GameState, ownerId: CHRIS });
    expect(ansicht).toEqual({ teams: [], spieler: [], gesamt: 0 });
  });
});

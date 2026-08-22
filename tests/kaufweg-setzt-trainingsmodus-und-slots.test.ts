/**
 * ZWEI MELDUNGEN VOM 22.08., beide am Markt, beide am Live-Abbild nachgemessen.
 *
 * ── `hnbng4` ────────────────────────────────────────────────────────────────────────────────────
 * „Der Flow hängt beim ‚Weiter Training Planen' fest obwohl ich bei allen was im Training
 *  festgelegt habe, er weiß nie wann man damit fertig ist."
 *
 * Die Quittung zu `j53iox` (PR #560) hatte diesen Fall als OFFEN benannt — dort hiess es, der
 * Kaufweg sei abgedeckt. Er ist es nur zur Haelfte: `executeFastLocalTransfermarktBatchBuy` ruft
 * `applyDefaultTrainingFieldsToRosteredPlayers`, der DIREKTE Pfad `executeLocalTransfermarktBuy`
 * — ueber den jeder manuelle Kauf laeuft — rief ihn nicht.
 *
 * Gemessen an `swnjlk`: genau EIN Spieler blockierte den Schritt, „Johanna" im Team `V-W`.
 * `trainingMode: null`, `trainingClass: "Warlord"` (die Klasse kommt aus dem Katalog, den Modus
 * setzt nur der Backfill). Ihr Transfer: `season-2/season-2-matchday-1 manual_transfermarkt_buy`.
 * Ein einziger Spieler ohne Modus haelt den ganzen Flow auf — genau Chris' „er weiß nie wann man
 * damit fertig ist".
 *
 * ── `3tklpq` ────────────────────────────────────────────────────────────────────────────────────
 * „beim Transfermarkt steht bei 8 besetzten Slots im Team noch 4 Slots offen, aber das Max ist ja
 *  14 also wären noch 6 Slots offen!"
 *
 * Die Anzeige rechnete gegen `playerOpt` — die OPT-Zielgroesse der KI-Kaderplanung — statt gegen
 * `rosterLimit`. Am Abbild gemessen wich sie bei 30 von 32 Teams ab; Beispiel `B-P`: Kader 8,
 * Limit 14, OPT 10 — angezeigt „2 Slots offen", tatsaechlich frei 6.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import {
  applyDefaultTrainingFieldsToPlayer,
  applyDefaultTrainingFieldsToRosteredPlayers,
} from "@/lib/training/player-training-backfill";
import { findPlayersWithoutTrainingMode } from "@/lib/foundation/team-training-status";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

/** Johannas Lage, eingedampft: Klasse aus dem Katalog da, Modus fehlt. */
function johanna(): Player {
  return { id: "p-johanna", name: "Johanna", className: "Warlord", trainingClass: "Warlord" } as unknown as Player;
}

function spielstandMitJohanna(): GameState {
  return {
    players: [johanna(), { id: "p-2", name: "Zweiter", className: "Ranger", trainingMode: "mittel" } as unknown as Player],
    rosters: [
      { teamId: "V-W", playerId: "p-johanna" },
      { teamId: "V-W", playerId: "p-2" },
    ],
  } as unknown as GameState;
}

describe("hnbng4 — der Trainings-Vorgabewert am manuellen Kaufweg", () => {
  it("setzt den fehlenden Modus, laesst die vorhandene Klasse stehen", () => {
    const nachher = applyDefaultTrainingFieldsToPlayer(johanna());
    expect(nachher.trainingMode).toBe("mittel");
    expect(nachher.trainingClass).toBe("Warlord");
  });

  it("macht aus Chris' blockiertem Kader einen vollstaendigen", () => {
    // Der gemeldete Zustand, Zahl fuer Zahl: 1 fehlender Modus vorher, 0 nachher.
    const vorher = findPlayersWithoutTrainingMode(spielstandMitJohanna(), "V-W");
    expect(vorher.missingCount).toBe(1);
    expect(vorher.missingPlayerNames).toContain("Johanna");

    const nachher = findPlayersWithoutTrainingMode(
      applyDefaultTrainingFieldsToRosteredPlayers(spielstandMitJohanna()),
      "V-W",
    );
    expect(nachher.missingCount).toBe(0);
    expect(nachher.status).not.toBe("incomplete");
  });

  it("laesst einen bereits gesetzten Modus unangetastet", () => {
    // Die Grenze: der Backfill darf keine Wahl ueberschreiben, die Chris getroffen hat.
    const gesetzt = { ...johanna(), trainingMode: "hart" } as unknown as Player;
    expect(applyDefaultTrainingFieldsToPlayer(gesetzt).trainingMode).toBe("hart");
  });

  it("haengt am DIREKTEN Kaufweg, nicht nur am Batch-Pfad", () => {
    /**
     * Der Kern der Meldung, und ueber die Quelldatei geprueft: `executeLocalTransfermarktBuy`
     * braucht denselben Aufruf wie `executeFastLocalTransfermarktBatchBuy`. Beide Pfade fuehren
     * Spieler in einen Kader; nur einer setzte bisher den Vorgabewert.
     */
    const dienst = quelle("lib/market/transfermarkt-local-service.ts");
    const direkt = dienst.slice(dienst.indexOf("export function executeLocalTransfermarktBuy"));
    expect(direkt).toContain("applyDefaultTrainingFieldsToRosteredPlayers");
    // Und der Batch-Pfad behaelt ihn — sonst waere die eine Luecke gegen die andere getauscht.
    const batch = dienst.slice(
      dienst.indexOf("function executeFastLocalTransfermarktBatchBuy"),
      dienst.indexOf("export function executeLocalTransfermarktBuy"),
    );
    expect(batch).toContain("applyDefaultTrainingFieldsToRosteredPlayers");
  });
});

describe("3tklpq — „Slots offen“ zaehlt bis zum Limit, nicht bis zum KI-Ziel", () => {
  const client = quelle("app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx");

  it("rechnet die freien Plaetze gegen das Kaderlimit", () => {
    // Geprueft wird die Zusage, nicht die Schreibweise: die Kapazitaet stammt aus `rosterLimit`.
    expect(client).toContain("const rosterKapazitaet = selectedTeam?.rosterLimit");
    expect(client).toContain("rosterKapazitaet - marketContext.rosterCount");
  });

  it("nimmt das OPT-Ziel nicht mehr als Kapazitaet", () => {
    // Die alte Zeile ist die Ursache — sie darf nicht zurueckkehren.
    expect(client).not.toContain("? Math.max(0, Math.round(rosterTarget - marketContext.rosterCount))");
  });

  it("behaelt das OPT-Ziel als Rueckfall, statt eine 14 zu erfinden", () => {
    // Ein Team ohne `rosterLimit` gibt es real nicht; erfaende man dort eine Zahl, waere sie
    // falsch, sobald das Limit je geaendert wird.
    expect(client).toContain("selectedTeam?.rosterLimit ?? rosterTarget");
  });
});

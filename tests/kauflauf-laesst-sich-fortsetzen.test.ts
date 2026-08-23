/**
 * EIN ABGEBROCHENER KAUFLAUF MUSS SICH FORTSETZEN LASSEN.
 *
 * GEMELDET VON CHRIS: „schau mal warum die KI nicht nachkauft - es gab ein problem beim saisonstart
 * … ich musste dann auf ki picken manuell noch mal klicken vllt ist da schon was kaputt gewesen und
 * einige teams haben dann nur minimum an playern!"
 *
 * NACHGEMESSEN an seinem Spielstand (season-2, Spieltag 10), und die Kette liess sich vollstaendig
 * belegen: in `transferHistory` standen 33 Eintraege der Saison, alle mit `ai_preseason_market_buy`.
 * 22 der 32 Teams hatten davon mindestens einen Spieler bekommen, ZEHN gingen leer aus — der Lauf
 * hatte angefangen und war auf halber Strecke stehengeblieben. Danach: 25 Teams unter Ziel, 58
 * fehlende Spieler, SIEBEN Teams exakt auf ihrem Minimum bei elf Einsatzplaetzen je Spieltag.
 *
 * DIE SPERRE MACHTE DAS UNREPARIERBAR. Sie fragte „existiert IRGENDEIN Transfer dieser Saison?" und
 * stieg fuer die GANZE LIGA aus — ein einziger gekaufter Spieler galt als erledigte Saison, auch
 * fuer die zehn leer ausgegangenen Teams. Chris' manueller Klick lief in dieselbe Sperre.
 *
 * Gegen sein Abbild gemessen: derselbe Aufruf tat vorher nichts (`skipped`, +0 Spieler) und kauft
 * jetzt 43 Spieler fuer 19 Teams.
 */
import { describe, expect, it } from "vitest";

import {
  mischeNachzueglerInDenUmfang,
  resolvePreseasonNachzueglerTeamIds,
} from "@/lib/ai/ai-transfer-window-session-service";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Ein Spielstand mit drei Teams: eines unter Ziel, eines am Ziel, eines menschlich gesteuert und
 * ebenfalls unter Ziel. `playerOpt` kommt aus der Team-Identitaet.
 */
function spielstand(): GameState {
  const teams = [
    { teamId: "AAA", name: "Unter Ziel", shortCode: "A-A", humanControlled: false },
    { teamId: "BBB", name: "Am Ziel", shortCode: "B-B", humanControlled: false },
    { teamId: "CCC", name: "Mensch", shortCode: "C-C", humanControlled: true },
  ];
  const rosters = [
    ...Array.from({ length: 8 }, (_, i) => ({ teamId: "AAA", playerId: `a${i}` })),
    ...Array.from({ length: 12 }, (_, i) => ({ teamId: "BBB", playerId: `b${i}` })),
    ...Array.from({ length: 8 }, (_, i) => ({ teamId: "CCC", playerId: `c${i}` })),
  ];
  return {
    teams,
    rosters,
    players: [],
    teamIdentities: teams.map((team) => ({
      teamId: team.teamId,
      playerMin: 8,
      playerOpt: 12,
      playerOptDelta: 0,
    })),
    season: { id: "season-2" },
    seasonState: {},
    transferHistory: [],
  } as unknown as GameState;
}

describe("Nachzuegler eines abgebrochenen Kauflaufs", () => {
  it("nennt das Team unter seiner Zielgroesse", () => {
    expect(resolvePreseasonNachzueglerTeamIds(spielstand())).toContain("AAA");
  });

  it("laesst ein Team, das sein Ziel erreicht hat, unangetastet", () => {
    // Das ist der Kern der Sperre und er bleibt erhalten: kein Nachkauf, keine Doppelung.
    expect(resolvePreseasonNachzueglerTeamIds(spielstand())).not.toContain("BBB");
  });

  it("fasst ein menschlich gesteuertes Team nie an — auch nicht, wenn es unter Ziel steht", () => {
    // CCC hat wie AAA nur acht Spieler. Der Kader gehoert trotzdem dem Spieler.
    expect(resolvePreseasonNachzueglerTeamIds(spielstand())).not.toContain("CCC");
  });
});

describe("Umfang eines Nachlaufs", () => {
  it("ist ohne Nachzueglerliste genau das, was der Aufrufer wollte", () => {
    // Kein vorheriger Transfer (oder Sperre abgeschaltet) — die Sitzung laeuft wie bisher.
    expect(mischeNachzueglerInDenUmfang(["AAA", "BBB"], null)).toEqual(["AAA", "BBB"]);
  });

  it("ist die Nachzueglerliste, wenn der Aufrufer keine Teams nennt", () => {
    expect(mischeNachzueglerInDenUmfang([], ["AAA"])).toEqual(["AAA"]);
  });

  it("ist die SCHNITTMENGE, wenn der Aufrufer Teams nennt", () => {
    // Sonst liesse ein gezielter Aufruf ein bereits fertiges Team doch noch einmal einkaufen.
    expect(mischeNachzueglerInDenUmfang(["AAA", "BBB"], ["AAA"])).toEqual(["AAA"]);
  });

  it("gibt einen leeren Umfang zurueck, wenn das genannte Team fertig ist", () => {
    expect(mischeNachzueglerInDenUmfang(["BBB"], ["AAA"])).toEqual([]);
  });
});

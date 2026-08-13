/**
 * DIE KI ERKENNT FATIGUE-TIEFEN-NOT — erschöpft UND zu arm für Ergänzungen.
 *
 * GEMELDET VON CHRIS: „jetzt wo fatigue richtig berechnet wird müssen die teams mehr darauf achten
 * genug rotation players zu haben oder reha zu bauen sonst gibt es probleme, ich habe nur 8 spieler
 * mit P-C davon haben sich 2 verletzt und alle anderen haben keine pause […] das muss die AI
 * berücksichtigen wenn fatigue ihnen zu hoch ist ggf. spieler verkaufen um cash zu schaffen und
 * günstigere spieler zu holen aber sich mehr dem eigenen opt zu nähern."
 *
 * DIE LÜCKE, DIE DAS SCHLIESST — am Live-Abbild gemessen, nicht vermutet. Es GAB eine Fatigue-Regel
 * (`ai-budget-deploy-service.ts`), aber sie verlangt Cash ≥ 12; die drei erschöpftesten Teams in
 * Saison 1 hatten −0,3 · −1,9 · 0,2. Und der Verkaufsdienst kannte Kadertiefe nur als BREMSE
 * (`low_roster_depth`), nie als Auslöser. Ein ausgelaugtes Team ohne Geld galt als „healthy" und tat
 * nichts.
 *
 * WAS DIESER TEST NICHT BEHAUPTET: dass ein Team dadurch zwingend verkauft. Die Not hebt nur den
 * Verkaufsdruck; WEN es verkauft, entscheiden weiterhin Kern-Schutz und `playerMin`-Bremse.
 */
import { describe, expect, it } from "vitest";

import {
  TIEFEN_NOT_CASH_SCHWELLE,
  TIEFEN_NOT_FATIGUE_MARKE,
  bewerteFatigueTiefenNot,
} from "@/lib/ai/ai-fatigue-depth-distress";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import type { GameState } from "@/lib/data/olyDataTypes";

const basis = createFreshSeasonOneGameState();
const TEAM = basis.teams[0]!.teamId;

/**
 * Baut die Lage EXPLIZIT auf. Ein frischer Saison-1-Stand hat noch keine Kader (der Draft laeuft
 * erst danach) — die Kaderzeilen muessen hier also selbst entstehen, sonst prueft der Test nichts.
 */
function lage(input: { kader: number; muede: number; fatigue: number; cash: number }): GameState {
  const spieler = basis.players.slice(0, input.kader);
  const muedeIds = new Set(spieler.slice(0, input.muede).map((player) => player.id));
  const rosters = spieler.map((player, index) => ({
    id: `roster-${index}`,
    teamId: TEAM,
    playerId: player.id,
    contractLength: 2,
    salary: 5,
  }));
  return {
    ...basis,
    teams: basis.teams.map((team) => (team.teamId === TEAM ? { ...team, cash: input.cash } : team)),
    rosters,
    players: basis.players.map((player) =>
      spieler.some((entry) => entry.id === player.id)
        ? { ...player, fatigue: muedeIds.has(player.id) ? input.fatigue : 5 }
        : player,
    ),
  } as unknown as GameState;
}

describe("KI erkennt Fatigue-Tiefen-Not", () => {
  it("duenner Kader, zwei Uebermuedete, kein Geld → Not", () => {
    const befund = bewerteFatigueTiefenNot(lage({ kader: 8, muede: 4, fatigue: 90, cash: 0.2 }), TEAM);
    expect(befund.inNot).toBe(true);
    expect(befund.uebermuedete).toBeGreaterThanOrEqual(2);
    expect(befund.kaderGroesse).toBe(8);
  });

  it("dasselbe Team MIT Geld ist nicht in Not — es kann sich Tiefe selbst holen", () => {
    // Das ist die bestehende Regel in ai-budget-deploy-service: ab Cash 12 greift sie ohnehin.
    const befund = bewerteFatigueTiefenNot(
      lage({ kader: 8, muede: 4, fatigue: 90, cash: TIEFEN_NOT_CASH_SCHWELLE + 5 }),
      TEAM,
    );
    expect(befund.inNot).toBe(false);
  });

  it("ein einzelner Uebermuedeter ist kein Notstand", () => {
    expect(bewerteFatigueTiefenNot(lage({ kader: 8, muede: 1, fatigue: 95, cash: 0 }), TEAM).inNot).toBe(false);
  });

  it("frischer Kader ohne Geld ist keine Fatigue-Not", () => {
    // Armut allein loest hier nichts aus — dafuer ist die Cash-Einstufung zustaendig.
    expect(bewerteFatigueTiefenNot(lage({ kader: 8, muede: 0, fatigue: 0, cash: 0 }), TEAM).inNot).toBe(false);
  });

  it("die Marke ist die der bestehenden Regel — keine zweite erfundene Schwelle", () => {
    const befund = bewerteFatigueTiefenNot(lage({ kader: 8, muede: 4, fatigue: 90, cash: 0 }), TEAM);
    expect(befund.marke).toBe(TIEFEN_NOT_FATIGUE_MARKE);
  });

  it("knapp unter der Marke zaehlt nicht mit", () => {
    const knappDrunter = bewerteFatigueTiefenNot(
      lage({ kader: 8, muede: 4, fatigue: TIEFEN_NOT_FATIGUE_MARKE - 1, cash: 0 }),
      TEAM,
    );
    expect(knappDrunter.uebermuedete).toBe(0);
    expect(knappDrunter.inNot).toBe(false);
  });
});

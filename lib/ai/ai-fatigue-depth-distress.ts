/**
 * FATIGUE-TIEFEN-NOT — der Zustand, in dem ein Team ausgelaugt ist UND sich Tiefe nicht leisten kann.
 *
 * GEMELDET VON CHRIS: „jetzt wo fatigue richtig berechnet wird müssen die teams mehr darauf achten
 * genug rotation players zu haben oder reha zu bauen sonst gibt es probleme […] das muss die AI
 * berücksichtigen wenn fatigue ihnen zu hoch ist ggf. spieler verkaufen um cash zu schaffen und
 * günstigere spieler zu holen aber sich mehr dem eigenen opt zu nähern."
 *
 * WAS ES VORHER SCHON GAB — und warum es nicht reichte. `ai-budget-deploy-service.ts` kennt eine
 * Fatigue-Regel: ab zwei Spielern über Fatigue 65 und Kader ≤ Opt+1 wird Transferbudget
 * freigegeben. Sie verlangt aber `spendable >= 12`. Am Live-Abbild (Saison 1, Spieltag 4) hatten
 * die drei erschöpftesten Teams Cash −0,3 · −1,9 · 0,2 — die eine Reaktion, die es gibt, ist also
 * hinter Geld verriegelt, das genau die betroffenen Teams nicht haben. Gemessen: 15 von 32 Teams
 * mit mindestens zwei müden Spielern, und laut `export-injury-balance-audit.ts` haben nur
 * 6 von 32 Teams überhaupt genug Rotationsspieler.
 *
 * DER VERKAUF WAR NIE AN FATIGUE GEKOPPELT. Der Verkaufsdienst kannte Kadertiefe ausschliesslich als
 * BREMSE (nicht unter `playerMin` verkaufen — inzwischen entfernt, Meldung `33c172`), nie als
 * AUSLÖSER. Niemand sagte
 * einem erschöpften Team „mach einen teuren Spieler zu Geld und hol zwei Körper". Genau diese Lücke
 * schliesst dieses Modul.
 *
 * DIE NOT IST EXAKT DIE GEGENSEITE DER BESTEHENDEN REGEL — keine zweite, eigene Schwelle. Sie
 * verwendet dieselben drei Grössen wie `ai-budget-deploy-service.ts` (Fatigue ≥ 65, Kader ≤ Opt+1)
 * und dreht nur die Cash-Bedingung um: dort `spendable >= 12`, hier darunter. Getroffen ist damit
 * GENAU die Menge, die die vorhandene Regel als hilfsbedürftig erkennt, aber nicht bedienen kann.
 *
 * ZWISCHENSTAND VERWORFEN: eine erste Fassung nahm die kaderabhängige Schoner-Schwelle
 * (`resolveFatigueRestFloor`, bei dünnen Kadern rund 37–40). Am Abbild gerieten damit 23 von 32
 * Teams in Not — drei Viertel der Liga unter Verkaufsdruck ist keine gezielte Reaktion mehr,
 * sondern ein Liga-Umbau. Die 65 der bestehenden Regel trifft die tatsächlich Erschöpften.
 *
 * DIE BREMSE BLEIBT UNANGETASTET. Dieses Modul macht ein Team nur zum VERKÄUFER; ob und wen es
 * verkauft, entscheidet weiterhin der Verkaufsdienst mit seinen Kern-Schutz- und
 * `playerMin`-Regeln. Ein Team kann sich also nicht in die Bedeutungslosigkeit verkaufen — der
 * gedachte Weg ist: EIN teurer Abgang finanziert ZWEI günstige Körper, netto ein Spieler mehr.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";

/**
 * Cash, ab dem ein Team sich Tiefe aus eigener Kraft holen kann. Bewusst dieselbe Grösse, an der
 * `ai-budget-deploy-service.ts` seine Fatigue-Regel aufhängt (`DEPLOY_MIN_TRANSFER_BUDGET * 2`) —
 * keine zweite erfundene Zahl. Darunter ist die vorhandene Regel wirkungslos, und genau dort
 * beginnt die Not.
 */
export const TIEFEN_NOT_CASH_SCHWELLE = 12;

/** Zwei Übermüdete sind eine Rotation, die nicht stattfindet — einer allein ist ein Einzelfall. */
export const TIEFEN_NOT_MINDEST_UEBERMUEDETE = 2;

/** Dieselbe Fatigue-Marke, an der `ai-budget-deploy-service.ts` seine Regel aufhaengt. */
export const TIEFEN_NOT_FATIGUE_MARKE = 65;

export type FatigueTiefenNot = {
  inNot: boolean;
  uebermuedete: number;
  kaderGroesse: number;
  playerOpt: number;
  marke: number;
};

export function bewerteFatigueTiefenNot(gameState: GameState, teamId: string): FatigueTiefenNot {
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const identity = gameState.teamIdentities?.find((entry) => entry.teamId === teamId);
  const { playerOpt } = deriveRosterTargets(team, identity);

  const kader = (gameState.rosters ?? []).filter((entry) => entry.teamId === teamId);
  const spieler = kader
    .map((entry) => gameState.players.find((player) => player.id === entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));

  const uebermuedete = spieler.filter((player) => (player.fatigue ?? 0) >= TIEFEN_NOT_FATIGUE_MARKE).length;

  const cash = Number.isFinite(team?.cash) ? (team?.cash ?? 0) : 0;
  const inNot =
    uebermuedete >= TIEFEN_NOT_MINDEST_UEBERMUEDETE &&
    spieler.length <= playerOpt + 1 &&
    cash < TIEFEN_NOT_CASH_SCHWELLE;

  return { inNot, uebermuedete, kaderGroesse: spieler.length, playerOpt, marke: TIEFEN_NOT_FATIGUE_MARKE };
}

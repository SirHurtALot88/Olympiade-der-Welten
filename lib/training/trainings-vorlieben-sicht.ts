/**
 * SICHTBARKEIT DER TRAININGSVORLIEBEN UNTER SCOUTING-NEBEL (Chris, 18.11. Fog of War; docs/design/training-r2-22-11.md Abschnitt 3.4).
 *
 *   eigenes Team            alle drei, immer
 *   fremd, unbekannt        nichts
 *   fremd, beobachtet       eine Lieblingsdisziplin
 *   fremd, gescoutet        alle drei
 *
 * Feste Stufen wie bei den Attributen, nie "ungefaehr". Die Stufe folgt der Aufdeckung (`revealConfidencePct` wie `nebelBreite` im Spielerprofil:
 * ab 40 % beobachtet, 100 % gescoutet). Eine Einstellung schaltet den Nebel ganz ab (`isScoutingNebelAus`). Sortiert wird nach Stufe, bei Gleichstand
 * nach Name -- nie nach verdecktem Inhalt (`sortiereNachNebelStufe`).
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";
import { getEffectiveRevealConfidence } from "@/lib/scouting/scouting-reveal-state";
import {
  leiteTrainingsVorliebenAb,
  type TrainingsVorlieben,
} from "@/lib/training/trainings-vorlieben";

export type NebelStufe = 0 | 1 | 2;

export const NEBEL_STUFEN: ReadonlyArray<{ stufe: NebelStufe; name: string }> =
  [
    { stufe: 0, name: "unbekannt" },
    { stufe: 1, name: "beobachtet" },
    { stufe: 2, name: "gescoutet" },
  ];

export type VorliebenSicht = {
  stufe: NebelStufe;
  /** Nur die sichtbaren Teile; `null` = verdeckt. */
  lieblinge: [string | null, string | null];
  ungeliebt: string | null;
};

/** Die Aufdeckungsstufe eines Spielers fuer das Team, das schaut. */
export function nebelStufeFuer(
  gameState: GameState,
  viewerTeamId: string,
  playerId: string,
): NebelStufe {
  const imEigenenKader = gameState.rosters.some(
    (r) => r.teamId === viewerTeamId && r.playerId === playerId,
  );
  if (imEigenenKader || isScoutingNebelAus(gameState)) return 2;
  const sicherheit = getEffectiveRevealConfidence(
    gameState,
    viewerTeamId,
    playerId,
  );
  return sicherheit >= 100 ? 2 : sicherheit >= 40 ? 1 : 0;
}

/** Was der Betrachter von den Vorlieben sehen darf (reine Funktion der Stufe). */
export function vorliebenSichtFuerStufe(
  vorlieben: TrainingsVorlieben,
  stufe: NebelStufe,
): VorliebenSicht {
  return {
    stufe,
    lieblinge: [
      stufe >= 1 ? vorlieben.lieblinge[0] : null,
      stufe >= 2 ? vorlieben.lieblinge[1] : null,
    ],
    ungeliebt: stufe >= 2 ? vorlieben.ungeliebt : null,
  };
}

export function vorliebenSicht(
  gameState: GameState,
  viewerTeamId: string,
  player: { id: string; className: string },
): VorliebenSicht {
  return vorliebenSichtFuerStufe(
    leiteTrainingsVorliebenAb(player, gameState.season?.id ?? ""),
    nebelStufeFuer(gameState, viewerTeamId, player.id),
  );
}

/** Sortiert nach Stufe (absteigend: erst die, von denen man am meisten sieht), Gleichstand nach Name. Nie nach verdecktem Inhalt. */
export function sortiereNachNebelStufe<T>(
  zeilen: readonly T[],
  stufe: (z: T) => NebelStufe,
  name: (z: T) => string,
  richtung: "auf" | "ab" = "ab",
): T[] {
  const faktor = richtung === "ab" ? -1 : 1;
  return [...zeilen].sort(
    (a, b) =>
      (stufe(a) - stufe(b)) * faktor || name(a).localeCompare(name(b), "de"),
  );
}

/**
 * SCHALTER „TRAINING JE SPIELTAG" (Chris, 18.11., `docs/design/training-je-spieltag-18-11.md`).
 *
 * Ohne schwere Importe, damit Anzeige (Browser-Bundle) und Buchung (Server) dieselbe Frage stellen.
 * Im Browser gibt es kein `OLY_*`; dort gilt der Standard (AN) — derselbe wie auf dem Server, solange
 * dort niemand abschaltet.
 *
 * | Variable | Standard | Wirkung |
 * |---|---|---|
 * | `OLY_TRAINING_JE_SPIELTAG` | AN | Zuwachs je Spieltag gebucht, Ziel-Disziplin + Weg (Regel A), Verletzte trainieren nicht (Regel B), Ueberlastung drueckt die Form (Regel E). `0`/`aus` = alles wie vor dem 18.11. (Saisonend-Buchung nach Trainingsklasse). |
 * | `OLY_TRAINING_JE_SPIELTAG_FAKTOR` | 1,0 | Skaliert die Rate je Spieltag (0..3), fuer Chris' Entscheidung nach dem Sichtbarmachen. |
 */

import { entwicklungNeuFuer, type EntwicklungsRegelQuelle } from "@/lib/resolve/entwicklung-regel";

function lieseUmgebung(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

export function isTrainingJeSpieltagAktiv(env: Record<string, string | undefined> = lieseUmgebung()): boolean {
  const roh = (env.OLY_TRAINING_JE_SPIELTAG ?? "").trim().toLowerCase();
  return !(roh === "0" || roh === "aus" || roh === "off" || roh === "false" || roh === "alt");
}

/**
 * Gilt in DIESER Saison Training je Spieltag? Mit der Entwicklungsregel "neu" immer (sie ist je Spieltag gebaut): die Prozessvariable
 * `OLY_TRAINING_JE_SPIELTAG` entscheidet dort nichts mehr -- sie setzt nur beim Saisonwechsel den Stempel "alt"
 * (`entwicklungsRegelSchalter`), den es als einzigen Rueckweg gibt (`OLY_ENTWICKLUNG=alt`). Nur in "alt"-Saisons (und im Manager-Modus)
 * bleibt die Variable der Schalter des 18.11. Jeder Rechenweg fragt den Spielstand, nie allein die Variable.
 */
export function trainingJeSpieltagFuer(gameState: EntwicklungsRegelQuelle): boolean {
  return entwicklungNeuFuer(gameState) || isTrainingJeSpieltagAktiv();
}

export const TRAINING_JE_SPIELTAG_FAKTOR_MAX = 3;

export function resolveTrainingJeSpieltagFaktor(env: Record<string, string | undefined> = lieseUmgebung()): number {
  const roh = Number(env.OLY_TRAINING_JE_SPIELTAG_FAKTOR);
  if (!Number.isFinite(roh) || roh < 0 || (env.OLY_TRAINING_JE_SPIELTAG_FAKTOR ?? "").trim() === "") return 1;
  return Math.min(TRAINING_JE_SPIELTAG_FAKTOR_MAX, roh);
}

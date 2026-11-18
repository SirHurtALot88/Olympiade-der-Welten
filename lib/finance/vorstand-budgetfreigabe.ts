/**
 * Finanzkonzept V2, Stufe 3: Der Vorstand gibt Budget frei, er straft kein Geld.
 *
 * Chris am 18.11.: Der Vorstand spricht KEINE Geldstrafe aus. Bleibt der Erfolg aus oder ist das Vertrauen
 * niedrig, gibt er bei Transfers nur einen Teil des verfuegbaren Budgets frei. Gilt fuer KI und Mensch
 * gleich; der Mensch muss die Zahl sehen koennen (UI folgt, hier nur Funktion und Felder).
 *
 * Vertrauen = `seasonState.boardConfidence[teamId].value` (Skala 1 bis 10, Neutralstart 5; das vorhandene
 * Board-System, `lib/board/team-season-objectives-service.ts`). Es wird nichts neu berechnet, nur gelesen.
 *
 * Stufen (Startwerte, begruendet in docs/design/finanzen-v2-stufe0-3-18-11.md):
 *
 *   Vertrauen ab 6       hoch         100 %
 *   4 bis unter 6        mittel        90 %   (Chris' Beispiel 85 %, hier milder: die Haelfte der Liga liegt
 *                                             um den Neutralwert 5; ein Abschlag fuer den Normalfall waere
 *                                             eine Pauschalkuerzung und keine Reaktion auf Misserfolg)
 *   2,5 bis unter 4      niedrig       75 %
 *   unter 2,5            Sparauflage   60 %
 *
 * Saison 1 (kein Vorjahr, Board neutral) gibt immer 100 %: dort gibt es noch keinen Misserfolg, auf den der
 * Vorstand reagieren koennte.
 *
 * Bezug "verfuegbares Budget": das Geld ueber der Ruecklage (Kasse minus Ruecklage). Die Ruecklage bleibt
 * ohnehin liegen; der Vorstand sperrt vom Rest den Anteil (1 - Freigabe).
 */

import type { GameState } from "@/lib/data/olyDataTypes";

export type VorstandStufe = "hoch" | "mittel" | "niedrig" | "sparauflage";

export const VORSTAND_STUFEN: ReadonlyArray<{ stufe: VorstandStufe; abVertrauen: number; anteil: number }> = [
  { stufe: "hoch", abVertrauen: 6, anteil: 1.0 },
  { stufe: "mittel", abVertrauen: 4, anteil: 0.9 },
  { stufe: "niedrig", abVertrauen: 2.5, anteil: 0.75 },
  { stufe: "sparauflage", abVertrauen: -Infinity, anteil: 0.6 },
];

/** A/B-Schalter: `OLY_VORSTAND_BUDGET=0` schaltet die Freigabe aus (Anteil immer 100 %). */
export function istVorstandBudgetfreigabeAktiv(): boolean {
  return process.env.OLY_VORSTAND_BUDGET !== "0";
}

export type VorstandFreigabe = {
  teamId: string;
  stufe: VorstandStufe;
  /** Freigegebener Anteil des verfuegbaren Budgets, 0,6 bis 1. */
  anteil: number;
  /** Das gelesene Vertrauen (1 bis 10) oder null, wenn es keines gibt (dann 100 %). */
  vertrauen: number | null;
  /** Warum 100 %, obwohl das Vertrauen niedrig sein koennte. */
  grund: "vertrauen" | "saison_1" | "ohne_vertrauenswert" | "abgeschaltet";
};

function saisonNummer(gameState: GameState): number | null {
  const m = /(\d+)\s*$/.exec(gameState.season?.id ?? "");
  return m ? Number(m[1]) : null;
}

/** Stufe und Anteil zu einem Vertrauenswert (reine Funktion). */
export function stufeFuerVertrauen(vertrauen: number): { stufe: VorstandStufe; anteil: number } {
  for (const s of VORSTAND_STUFEN) {
    if (vertrauen >= s.abVertrauen) return { stufe: s.stufe, anteil: s.anteil };
  }
  return { stufe: "sparauflage", anteil: VORSTAND_STUFEN[VORSTAND_STUFEN.length - 1]!.anteil };
}

/** Wie viel Budget der Vorstand diesem Team fuer Transfers freigibt. Fuer KI und Mensch dieselbe Funktion. */
export function resolveVorstandFreigabe(gameState: GameState, teamId: string): VorstandFreigabe {
  if (!istVorstandBudgetfreigabeAktiv()) {
    return { teamId, stufe: "hoch", anteil: 1, vertrauen: null, grund: "abgeschaltet" };
  }
  if ((saisonNummer(gameState) ?? 1) <= 1) {
    return { teamId, stufe: "hoch", anteil: 1, vertrauen: null, grund: "saison_1" };
  }
  const wert = gameState.seasonState.boardConfidence?.[teamId]?.value;
  if (typeof wert !== "number" || !Number.isFinite(wert)) {
    return { teamId, stufe: "hoch", anteil: 1, vertrauen: null, grund: "ohne_vertrauenswert" };
  }
  const { stufe, anteil } = stufeFuerVertrauen(wert);
  return { teamId, stufe, anteil, vertrauen: wert, grund: "vertrauen" };
}

export type VorstandBudgetZugriff = {
  /** Kasse, die der Vorstand fuer Transfers sperrt (liegt zusaetzlich zur Ruecklage fest). */
  gesperrt: number;
  /** Maximal fuer Transfers ausgebbar: (Kasse - Ruecklage) x Anteil, nie negativ. */
  ausgebbar: number;
  verfuegbarUeberRuecklage: number;
};

/** Zugriff auf das Budget bei gegebener Kasse, Ruecklage und Freigabe-Anteil. */
export function berechneBudgetZugriff(input: { cash: number; ruecklage: number; anteil: number }): VorstandBudgetZugriff {
  const verfuegbar = Math.max(0, input.cash - Math.max(0, input.ruecklage));
  const anteil = Math.min(1, Math.max(0, input.anteil));
  const ausgebbar = verfuegbar * anteil;
  return { verfuegbarUeberRuecklage: verfuegbar, ausgebbar, gesperrt: verfuegbar - ausgebbar };
}

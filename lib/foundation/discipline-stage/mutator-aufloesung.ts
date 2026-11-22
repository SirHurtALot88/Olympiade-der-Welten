// MUTATOR IN DER AUFLOESUNG (Chris, 22.11.): „da müssen die natürlich auch rein, weil die sich auswirken,
// und DORT müsste auch der Mutator-Effekt mal drin stehen".
//
// Im Battle-Modus bucht ein Mutator-Treffer keine Punkte/PP mehr (`lib/battle/battle-mutator-organisch.ts`),
// sondern +3,5 Form bzw. Attribut je Treffer. Die Aufloesung muss deshalb TREFFER und FORM zeigen, nie eine
// Punktzahl. Der Punkteanteil am Wert ist nicht ehrlich trennbar: auf Motor-Seiten steckt der Schub im
// Grundwert (Attribut +3,5 je Treffer, danach laeuft die ganze Eignungs-Kette), auf legacy-gewerteten Seiten im
// Formanteil samt Multiplikator und Tagesform-Streuung. Darum steht hier nur die Nennhoehe je Treffer.
// Rein anzeigend: nichts hiervon fliesst in Score, PP oder Fingerabdruck.

import { MUTATOR_FORM_JE_TREFFER } from "@/lib/battle/battle-mutator-organisch";

export type MutatorAufloesung = {
  treffer: number;
  /** Nennhoehe der Form-/Attributschubs (Treffer x 3,5), KEINE Punktzahl. */
  form: number;
  /** Kurzform fuer Zeilen: „◆ 2× · Form +7,0“. */
  kurz: string;
  /** Langform fuer Tooltips. */
  lang: string;
};

function de1(wert: number): string {
  return wert.toFixed(1).replace(".", ",");
}

/** `null`, wenn es nichts zu zeigen gibt (kein Treffer, kein Battle-Mutator-als-Form). */
export function mutatorAufloesung(treffer: number | null | undefined): MutatorAufloesung | null {
  const n = typeof treffer === "number" && Number.isFinite(treffer) ? Math.round(treffer) : 0;
  if (n <= 0) return null;
  const form = Number((n * MUTATOR_FORM_JE_TREFFER).toFixed(1));
  return {
    treffer: n,
    form,
    kurz: `◆ ${n}× · Form +${de1(form)}`,
    lang: `◆ Mutator: ${n} Treffer = Form +${de1(form)} (+${de1(MUTATOR_FORM_JE_TREFFER)} je Treffer, keine Punkte, im Wert enthalten)`,
  };
}

/** Summe der Treffer mehrerer Spieler (Team-/Seitensumme). */
export function mutatorTrefferSumme(treffer: ReadonlyArray<number | null | undefined>): number {
  return treffer.reduce<number>((s, t) => s + (typeof t === "number" && Number.isFinite(t) && t > 0 ? Math.round(t) : 0), 0);
}

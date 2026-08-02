/**
 * DIE BOARD-EMPFEHLUNG JE VERTRAG — verlaengern, beobachten oder abgeben?
 *
 * Der Vertraege-Reiter zeigte bisher Zahlen und keine Antwort: Gehalt, Buyout, VK und Marktwert
 * standen als Spalten nebeneinander, das Abwaegen blieb Kopfarbeit. Hier wird daraus ein Satz.
 *
 * DREI EINGANGSGROESSEN, bewusst getrennt gehalten, weil sie sich widersprechen duerfen:
 *   1. Wirtschaftlichkeit — verdient er mehr, als seine Leistung ueblicherweise kostet?
 *      (`salary-benchmark.ts`; ausdruecklich als Abweichung und NICHT als Quotient aus Gehalt
 *      und Leistung, der nur die Leistung rankt und schwache Spieler unabhaengig vom Gehalt
 *      abstraft.)
 *   2. Verkaufslage — liegt der erzielbare Preis ueber oder unter dem Marktwert?
 *   3. Bindungsrisiko — Moral und Verlaengerungshaltung.
 *
 * WARUM SIE NICHT ZU EINER PUNKTZAHL VERRECHNET WERDEN: der interessante Fall ist der, in dem
 * sie auseinanderlaufen — ein zu teurer Spieler, dessen Verkauf gerade Wert verbrennt. Eine
 * Summe wuerde daraus eine glatte Empfehlung machen und die Spannung verschlucken. Genau dann
 * lautet die ehrliche Antwort "beobachten" mit Begruendung, nicht "verkaufen".
 */
import {
  ordneGehaltEin,
  type SalaryBenchmarkEinordnung,
  type SalaryBenchmarkResult,
} from "@/lib/contracts/salary-benchmark";

export type ContractRecommendation = "verlaengern" | "beobachten" | "abgeben";

export type ContractRecommendationInput = {
  /** Ergebnis aus `bewerteGehalt`; null, wenn keine Schaetzung moeglich war. */
  gehalt: SalaryBenchmarkResult | null;
  /** Erzielbarer Verkaufspreis. */
  vk: number | null;
  /** Aktueller Marktwert. */
  marktwert: number | null;
  /** Restlaufzeit in Saisons. */
  restlaufzeit: number | null;
  /** Moral 0..100. */
  moral: number | null;
  /** Verlaengerungshaltung aus dem Moralsystem, z. B. "nur kurz binden". */
  intent: string | null;
};

export type ContractRecommendationResult = {
  empfehlung: ContractRecommendation;
  /** Ein Satz Alltagssprache — was den Ausschlag gibt. */
  begruendung: string;
  /** Die Einordnung des Gehalts, damit die Oberflaeche sie nicht neu berechnen muss. */
  gehaltsEinordnung: SalaryBenchmarkEinordnung | null;
  /** VK minus Marktwert; null, wenn eine der beiden Zahlen fehlt. */
  vkAbweichung: number | null;
};

/** Ab hier gilt der Verkauf als Wertvernichtung: mehr als ein Zehntel unter Marktwert. */
export const VK_UNTER_WERT_SCHWELLE = -0.1;
/** Ab hier bringt ein Verkauf spuerbar mehr als der Marktwert. */
export const VK_UEBER_WERT_SCHWELLE = 0.05;
/** Unter diesem Wert gilt die Moral als Bindungsrisiko. */
export const MORAL_RISIKO_SCHWELLE = 45;

function istZahl(wert: number | null | undefined): wert is number {
  return wert != null && Number.isFinite(wert);
}

function formatMio(wert: number): string {
  return `${Math.abs(wert).toFixed(1).replace(".", ",")} Mio`;
}

/**
 * Der Intent aus dem Moralsystem ist Freitext. Erkannt wird nur, was eindeutig gegen eine lange
 * Bindung spricht — alles andere gilt als unauffaellig, statt aus einer unbekannten Formulierung
 * ein Risiko zu erfinden.
 */
export function istBindungsrisiko(intent: string | null, moral: number | null): boolean {
  const bereinigt = (intent ?? "").toLowerCase();
  if (bereinigt.includes("kurz")) return true;
  if (bereinigt.includes("wechsel") || bereinigt.includes("abgeben")) return true;
  return istZahl(moral) && moral < MORAL_RISIKO_SCHWELLE;
}

export function empfehleVertrag(input: ContractRecommendationInput): ContractRecommendationResult {
  const gehaltsEinordnung = ordneGehaltEin(input.gehalt);
  const vkAbweichung =
    istZahl(input.vk) && istZahl(input.marktwert) ? Number((input.vk - input.marktwert).toFixed(2)) : null;
  const vkRelativ =
    istZahl(input.vk) && istZahl(input.marktwert) && input.marktwert > 0
      ? (input.vk - input.marktwert) / input.marktwert
      : null;
  const unterWert = vkRelativ != null && vkRelativ <= VK_UNTER_WERT_SCHWELLE;
  const ueberWert = vkRelativ != null && vkRelativ >= VK_UEBER_WERT_SCHWELLE;
  const bindungsrisiko = istBindungsrisiko(input.intent, input.moral);

  const basis: Pick<ContractRecommendationResult, "gehaltsEinordnung" | "vkAbweichung"> = {
    gehaltsEinordnung,
    vkAbweichung,
  };

  // Der eindeutige Fall: zu teuer UND der Markt zahlt gut. Beides zeigt in dieselbe Richtung.
  if (gehaltsEinordnung === "teuer" && ueberWert) {
    return {
      ...basis,
      empfehlung: "abgeben",
      begruendung: `Verdient ${formatMio(input.gehalt!.abweichung)} mehr als für diese Leistung üblich — und der Verkauf bringt ${formatMio(vkAbweichung!)} über Marktwert.`,
    };
  }

  // Der interessante Fall: zu teuer, aber ein Verkauf verbrennt gerade Wert. Nicht glattziehen.
  if (gehaltsEinordnung === "teuer" && unterWert) {
    return {
      ...basis,
      empfehlung: "beobachten",
      begruendung: `Teuerster Gegenwert im Kader (${formatMio(input.gehalt!.abweichung)} über üblich), aber ein Verkauf liegt ${formatMio(vkAbweichung!)} unter Marktwert — halten und nicht verlängern, bis der Preis anzieht.`,
    };
  }

  if (gehaltsEinordnung === "teuer") {
    return {
      ...basis,
      empfehlung: "beobachten",
      begruendung: `Verdient ${formatMio(input.gehalt!.abweichung)} mehr als für diese Leistung üblich — bei der nächsten Verlängerung nachverhandeln.`,
    };
  }

  // Bindungsrisiko ist ausdruecklich KEIN Kostenproblem — das muss der Satz auch sagen, sonst
  // liest es sich wie eine Verkaufsempfehlung fuer einen Spieler, den man behalten will.
  if (bindungsrisiko) {
    return {
      ...basis,
      empfehlung: "beobachten",
      begruendung:
        gehaltsEinordnung === "guenstig"
          ? "Günstiger Vertrag, aber die Bindung wackelt — kein Kostenproblem, sondern eins der Zufriedenheit."
          : "Wirtschaftlich unauffällig, aber die Bindung wackelt — kein Kostenproblem, sondern eins der Zufriedenheit.",
    };
  }

  if (gehaltsEinordnung === "guenstig") {
    return {
      ...basis,
      empfehlung: "verlaengern",
      begruendung: `Verdient ${formatMio(input.gehalt!.abweichung)} weniger als für diese Leistung üblich — früh verlängern, solange er günstig ist.`,
    };
  }

  // Ohne Schaetzung gibt es keine wirtschaftliche Aussage. Das wird gesagt, statt geraten.
  if (gehaltsEinordnung == null) {
    return {
      ...basis,
      empfehlung: "beobachten",
      begruendung: "Noch keine Vergleichswerte aus der Liga — Empfehlung folgt, sobald genug Verträge erfasst sind.",
    };
  }

  const laeuftAus = istZahl(input.restlaufzeit) && input.restlaufzeit <= 1;
  return {
    ...basis,
    empfehlung: "verlaengern",
    begruendung: laeuftAus
      ? "Angemessen bezahlt und verlängerungsbereit — der Vertrag läuft aus, jetzt handeln."
      : "Angemessen bezahlt, keine Auffälligkeiten.",
  };
}

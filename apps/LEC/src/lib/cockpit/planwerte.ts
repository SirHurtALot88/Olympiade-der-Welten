/**
 * Planwerte fuer die Leitplanken des Cockpits (docs/enterich-cards/COCKPIT_V2_KONZEPT.md §5).
 *
 * Chris' Vorgabe (13.10.2026): das Cockpit ist ein reines Anzeige-Dashboard, NICHTS wird dort
 * manuell gepflegt. Diese Werte kommen nicht aus den Importen und sind deshalb bewusst benannte
 * Konstanten im Code -- Pflege per Datei/Commit, nicht per Formular. Jede Konstante traegt
 * Herkunft und Datum, die Oberflaeche kennzeichnet sie als "Planwert".
 *
 * Quelle aller Werte: Uebergabe-Dokument 13.10.2026 (Abschnitte 1, 4, 5) und Chris' Steuerplanung.
 */
export interface Planwerte {
  /** Beim Finanzamt eingereichte Gewinnprognose fuer 2026 (Totalgewinnprognose, Treppe danach 1.900 / 2.300 / 2.500 / 2.700). */
  gewinnPrognoseFinanzamtEur: number;
  /** Chris' Zielkorridor fuer den Jahresgewinn 2026: ueber der Prognose, aber nicht so weit, dass die Treppe fuer 2027 unerreichbar wird. */
  gewinnZielkorridorEur: { von: number; bis: number };
  /** Selbst gesetzte Arbeitsgrenze fuer den Jahresumsatz (Zufluss). */
  umsatzArbeitsgrenzeEur: number;
  /** Kleinunternehmergrenze § 19 UStG (Vorjahresumsatz). Ueberschreiten = Regelbesteuerung im Folgejahr. */
  kleinunternehmerGrenzeEur: number;
  /** Rest-Warenbudget fuer November UND Dezember zusammen (Stand 13.10.2026). */
  warenbudgetNovDezEur: number;
  /** Bisherige normale Einkaufsrate je Monat -- nur Vergleichswert, kein Ziel. */
  einkaufsrateNormalEurProMonat: number;
  /** Kalenderjahr, fuer das die Planwerte gelten. Wird im Cockpit angezeigt, damit ein veralteter Stand auffaellt. */
  planjahr: number;
  /** Monate (1-12), die das Warenbudget abdeckt. */
  warenbudgetMonate: number[];
}

export const PLANWERTE: Planwerte = {
  gewinnPrognoseFinanzamtEur: 1400,
  gewinnZielkorridorEur: { von: 1600, bis: 1800 },
  umsatzArbeitsgrenzeEur: 24000,
  kleinunternehmerGrenzeEur: 25000,
  warenbudgetNovDezEur: 980,
  einkaufsrateNormalEurProMonat: 782,
  planjahr: 2026,
  warenbudgetMonate: [11, 12],
};

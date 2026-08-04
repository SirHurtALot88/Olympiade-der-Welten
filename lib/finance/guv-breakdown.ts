/**
 * DER HOVER ZUR GUV — eine Herleitung, in beiden Ansichten dieselbe.
 *
 * GEMELDET VON CHRIS (Ticket 24, Seite „Spieltag · Saisonstand"): „Die GuV im Saisonstand und die im
 * Finanzen-Reiter weichen voneinander ab! … am besten ein Hover auf dem GuV-Posten, der noch mal
 * aufzeigt, wie die Zahl sich zusammensetzt!"
 *
 * ENTSCHEIDUNG VON CHRIS zu den Transfers: „Lass transfers aus der GuV am besten raus die sind
 * separat ausgewiesen".
 *
 * WAS SICH GEGENÜBER #392 GEÄNDERT HAT: dort standen noch ZWEI Definitionen nebeneinander, und der
 * Hover erklärte, warum beide Ansichten verschiedene Zahlen zeigen („Beide sind richtig"). Das gilt
 * nicht mehr — seit `lib/finance/operating-guv.ts` rechnen beide Ansichten dieselbe Zahl. Ein Hover,
 * der weiterhin eine Abweichung erklärt, die es nicht mehr gibt, schickt den Leser auf die Suche
 * nach einem Unterschied, den er nie findet. Deshalb sind diese Sätze bewusst entfernt.
 *
 * Diese Datei ist React-frei: die Herleitung ist ohne Rendering prüfbar
 * (`tests/guv-herleitung-hover.test.ts`).
 */
import type { TeamOperatingGuv } from "@/lib/finance/operating-guv";

export type GuvHoverLine = {
  label: string;
  value: number | null;
  /** `true` = zählt in die Zahl hinein, `false` = steht bewusst daneben. */
  counted: boolean;
};

function formatSigned(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;
}

/**
 * Die Posten der GuV in Anzeige-Reihenfolge: erst die Einnahmen, dann die Ausgaben (als negative
 * Beträge), zum Schluss der Sonderposten Transfers als NICHT gezählte Zeile.
 *
 * Nullposten werden weggelassen — eine Zeile „Kreditzinsen: 0" erklärt nichts und macht den Hover
 * nur länger. Für den Apron heißt das: ein Team genau auf der 1. Linie zahlt nichts und bekommt
 * nichts, und dann steht dazu auch keine Zeile da.
 */
export function buildGuvHoverLines(guv: TeamOperatingGuv | null | undefined): GuvHoverLine[] {
  if (!guv) return [];
  const lines: GuvHoverLine[] = [];
  const push = (label: string, value: number | null | undefined) => {
    if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
      lines.push({ label, value, counted: true });
    }
  };

  push("Sponsor", guv.sponsor?.total);
  push("Gebäude-Einnahmen", guv.facilityIncome?.total);
  push("Vorstandsziele (Prämie)", guv.objectiveReward);
  push("Apron-Ausgleich", guv.apronPayout);
  push("Gehälter", guv.salaries.total > 0 ? -guv.salaries.total : null);
  push("Gebäude-Unterhalt (bezahlt)", guv.facilityUpkeep.total > 0 ? -guv.facilityUpkeep.total : null);
  push("Kreditzinsen", guv.loanInstallments.total > 0 ? -guv.loanInstallments.total : null);
  push("Vorstandsziele (Strafe)", guv.objectivePenalty != null ? -guv.objectivePenalty : null);
  push("Apron-Abgabe", guv.apronLevy != null ? -guv.apronLevy : null);

  if (guv.transfer) {
    lines.push({ label: "Transfers (Sonderposten, nicht enthalten)", value: guv.transfer.net, counted: false });
  }
  return lines;
}

/**
 * Der fertige `title`-Text für den GuV-Posten — identisch im Saisonstand und im Finanzen-Reiter,
 * weil er aus derselben `TeamOperatingGuv` gebaut wird.
 *
 * Bewusst ein reiner `title`-String statt einer Hover-Card: niedrigrisiko und konsistent mit den
 * übrigen `title=`-Erklärungen im neuen Look.
 */
export function buildGuvHoverText(guv: TeamOperatingGuv | null | undefined): string {
  if (!guv) {
    return "Für dieses Team liegt keine GuV-Herleitung vor.";
  }
  const lines = buildGuvHoverLines(guv);
  const counted = lines.filter((line) => line.counted);
  const transfers = lines.find((line) => !line.counted);

  const body = counted.length > 0 ? counted.map((line) => `${line.label}: ${formatSigned(line.value)}`) : ["Keine Posten erfasst."];

  return [
    "GuV = laufende Einnahmen − laufende Ausgaben (Saisonstand und Finanzen-Reiter rechnen dieselbe Zahl).",
    ...body,
    `Ergibt: ${formatSigned(guv.guv)}`,
    "",
    "Nicht enthalten:",
    transfers
      ? `· Transfers (${formatSigned(transfers.value)}) — Einmal-Ereignis, separat ausgewiesen (eigene Spalte im Saisonstand, eigener Block im Finanzen-Reiter).`
      : "· Transfers — Einmal-Ereignis, separat ausgewiesen (eigene Spalte im Saisonstand, eigener Block im Finanzen-Reiter).",
    "· Kredit-Tilgung — reine Bilanzbewegung; nur der Zinsanteil ist eine Ausgabe.",
  ].join("\n");
}

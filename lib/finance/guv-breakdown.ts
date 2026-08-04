/**
 * GEMELDET VON CHRIS (Seite „Spieltag · Saisonstand"): „Die GuV im Saisonstand und die im
 * Finanzen-Reiter weichen voneinander ab! Bitte fixen und bitte berücksichtigen, dass auch Apron mit
 * einfließt — am besten ein Hover auf dem GuV-Posten, der noch mal aufzeigt, wie die Zahl sich
 * zusammensetzt!"
 *
 * ENTSCHEIDUNG VON CHRIS nach dem Befund: die zwei Definitionen bleiben, sie werden erklärt statt
 * angeglichen. Beide sind absichtlich so gebaut, und beide beantworten eine andere Frage.
 *
 * WAS DIE BEIDEN ZAHLEN WIRKLICH SIND — nachgelesen, nicht vermutet:
 *
 *  - SAISONSTAND (`app/api/season/standings-overview/route.ts:440-443`):
 *        guv = Sponsor-Abrechnung + Gebäude netto − Gehaltssumme
 *    Eine schmale Drei-Term-Rechnung für den Liga-Vergleich. Transfers stehen daneben in einer
 *    EIGENEN Spalte und sind hier NICHT enthalten.
 *  - FINANZEN-REITER (`app/foundation/finances/FoundationFinancesNewLook.tsx:164-167, 203-206`):
 *        GuV = alle laufenden Einnahmen − alle laufenden Ausgaben
 *    Also breiter als der Saisonstand (Vorstandsprämien, Kredite, Unterhalt …), aber ebenfalls ohne
 *    Transfers — die laufen dort als „Transfers (Sonderposten)" in einem eigenen Block.
 *
 * KORREKTUR ZUR ERSTEN EINSCHÄTZUNG: in der Triage-Notiz stand zuerst, der Saisonstand enthalte die
 * Transfers. Das stimmt nicht — die Formel oben hat sie nie. Der Unterschied liegt an den zusätzlichen
 * Betriebsposten des Finanzen-Reiters, nicht an den Transfers.
 *
 * APRON gehört in keine der beiden: er wird am SAISONENDE abgerechnet
 * (`lib/season/apron-service.ts` → `computeApronSettlement`, geschrieben von
 * `apron-settlement-service.ts`) und schlägt dort direkt aufs Cash durch, nicht auf die laufende GuV.
 * Der Hinweis gehört trotzdem in den Hover: eine Zahl, die einen bekannten Posten NICHT enthält, muss
 * das sagen — sonst sucht man den Unterschied wieder in der Rechnung.
 *
 * Diese Datei ist bewusst React-frei: beide Ansichten lesen dieselbe Herleitung, und sie ist ohne
 * Rendering prüfbar.
 */

export type GuvBreakdownInput = {
  /** Sponsor-Abrechnung beim aktuellen Rang. */
  sponsorTotal: number | null | undefined;
  /** Gehaltssumme der Saison. */
  salaryTotal: number | null | undefined;
  /** Die im Saisonstand angezeigte GuV. */
  guv: number | null | undefined;
  /** Transfer-Saldo — steht im Saisonstand in einer eigenen Spalte. */
  transferNet?: number | null;
};

export type GuvBreakdownLine = {
  label: string;
  value: number | null;
  /** `true` = zählt in die Zahl hinein, `false` = steht bewusst daneben. */
  counted: boolean;
};

export type GuvBreakdown = {
  total: number | null;
  lines: GuvBreakdownLine[];
  /** Fertiger Hover-Text — eine Zeile je Posten, danach die Abgrenzung. */
  hoverText: string;
};

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatSigned(value: number | null) {
  if (!isNumber(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;
}

/**
 * Zerlegt die Saisonstand-GuV in ihre drei Terme.
 *
 * „Gebäude netto" wird als REST gerechnet (`guv − sponsor + gehälter`) und nicht separat übergeben.
 * Das ist Absicht: der Rest ist per Konstruktion exakt der dritte Term der Formel oben, während die
 * Spalte „Gebäude" der Tabelle den reinen UNTERHALT zeigt (`computeTeamBuildingCost` summiert
 * `calculateFacilitySeasonUpkeep`) — also die Kostenseite, nicht netto. Die beiden Zahlen dürfen sich
 * unterscheiden, und ein Hover, der die Spalte danebenstellt, würde genau die Verwirrung stiften,
 * die er auflösen soll.
 */
export function buildGuvBreakdown(input: GuvBreakdownInput): GuvBreakdown {
  const sponsor = isNumber(input.sponsorTotal) ? input.sponsorTotal : null;
  const salary = isNumber(input.salaryTotal) ? input.salaryTotal : null;
  const total = isNumber(input.guv) ? input.guv : null;
  const facilityNet =
    total != null && sponsor != null && salary != null ? Number((total - sponsor + salary).toFixed(2)) : null;

  const lines: GuvBreakdownLine[] = [
    { label: "Sponsor (beim aktuellen Rang)", value: sponsor, counted: true },
    { label: "Gebäude netto", value: facilityNet, counted: true },
    { label: "Gehälter", value: salary != null ? -salary : null, counted: true },
  ];
  if (isNumber(input.transferNet)) {
    lines.push({ label: "Transfers (eigene Spalte, nicht enthalten)", value: input.transferNet, counted: false });
  }

  // KOMPAKT STATT VOLLSTAENDIG: die Rechnung passt in eine Zeile, weil sie nur drei Terme hat —
  // sie als Aufzaehlung zu setzen machte aus einer Formel einen Absatz. Was der Hover leisten muss,
  // ist "woraus besteht die Zahl" und "warum weicht der Finanzen-Reiter ab"; alles andere sind
  // Saetze, die man beim zweiten Hover ueberspringt.
  const rechnung = `Sponsor ${formatSigned(sponsor)} · Gebäude ${formatSigned(facilityNet)} · Gehälter ${formatSigned(salary != null ? -salary : null)}`;
  const hoverText = [
    `GuV = ${rechnung} → ${formatSigned(total)}`,
    "Sponsor beim aktuellen Rang.",
    "",
    `Ohne Transfers (eigene Spalte${isNumber(input.transferNet) ? `, ${formatSigned(input.transferNet)}` : ""}) und ohne Apron — der wird erst zum Saisonende abgerechnet und geht direkt aufs Cash.`,
    "Der Finanzen-Reiter rechnet breiter (Prämien, Kredite, Unterhalt) und kommt auf eine andere Zahl. Beide stimmen.",
  ].join("\n");

  return { total, lines, hoverText };
}

/**
 * Gegenstück für den Finanzen-Reiter: dieselbe Abgrenzung, aus der anderen Richtung erklärt.
 */
export function buildOperatingGuvHoverText(input: {
  totalIncome: number | null | undefined;
  totalExpenses: number | null | undefined;
  transferNet?: number | null;
}): string {
  const income = isNumber(input.totalIncome) ? input.totalIncome : null;
  const expenses = isNumber(input.totalExpenses) ? input.totalExpenses : null;
  const total = income != null && expenses != null ? Number((income - expenses).toFixed(2)) : null;
  return [
    `GuV = Einnahmen ${formatSigned(income)} · Ausgaben ${formatSigned(expenses != null ? -expenses : null)} → ${formatSigned(total)}`,
    "",
    `Ohne Transfers (eigener Sonderposten${isNumber(input.transferNet) ? `, ${formatSigned(input.transferNet)}` : ""}) und ohne Apron — der wird erst zum Saisonende abgerechnet und geht direkt aufs Cash.`,
    "Der Saisonstand rechnet schmaler (nur Sponsor + Gebäude − Gehälter) und kommt auf eine andere Zahl. Beide stimmen.",
  ].join("\n");
}

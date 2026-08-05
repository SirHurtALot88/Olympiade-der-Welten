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
 * NACHGEZOGEN (Chris): der Apron steht jetzt nicht nur als Abgrenzung da, sondern als HOCHRECHNUNG
 * beim aktuellen Rang — dieselbe Behandlung, die die Sponsor-Zeile im selben Hover schon hat. Der
 * Einwand „Deckel und Ausschüttung hängen am Endrang" bleibt richtig und wird nicht wegdefiniert:
 * die Zeile ist als Hochrechnung benannt und nennt den Rang, auf den sie sich stützt. Gerechnet wird
 * sie von `lib/finance/apron-projection.ts`, das seinerseits nur die Saisonende-Arithmetik aufruft —
 * diese Datei formuliert, sie rechnet nicht.
 *
 * Diese Datei ist bewusst React-frei: beide Ansichten lesen dieselbe Herleitung, und sie ist ohne
 * Rendering prüfbar.
 */

/**
 * Der auf den AKTUELLEN Rang hochgerechnete Apron dieses Teams. Alle Werte kommen aus
 * `buildApronProjection` — hier wird nichts abgeleitet, nur formuliert.
 */
export type GuvApronProjectionInput = {
  /** `ausgleich − abgabe`: was am Saisonende aufs Cash ginge. Negativ = Abgabe. */
  nettoDelta: number;
  /** Rang, auf den hochgerechnet wurde. `null` = unbekannt. */
  rank: number | null;
  /** GEGLÄTTETE Gehaltssumme — die Bemessungsgrundlage, nicht die Gehaltsspalte der Tabelle. */
  salary: number;
  line1: number;
  line2: number;
  /** `true` = Linien vom Saisonbeginn (verbindlich), `false` = aus dem aktuellen Stand abgeleitet. */
  frozenLines: boolean;
  /** `true` = der Deckel (halber Wertungsanteil) begrenzt die Abgabe. */
  gedeckelt: boolean;
};

export type GuvBreakdownInput = {
  /** Sponsor-Abrechnung beim aktuellen Rang. */
  sponsorTotal: number | null | undefined;
  /** Gehaltssumme der Saison. */
  salaryTotal: number | null | undefined;
  /** Die im Saisonstand angezeigte GuV. */
  guv: number | null | undefined;
  /** Transfer-Saldo — steht im Saisonstand in einer eigenen Spalte. */
  transferNet?: number | null;
  /** Apron beim aktuellen Rang hochgerechnet — fehlt er, bleibt der Hover wie zuvor. */
  apron?: GuvApronProjectionInput | null;
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

function formatPlain(value: number | null) {
  if (!isNumber(value)) return "—";
  return (Math.round(value * 10) / 10).toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

/**
 * Die zwei Apron-Zeilen des Hovers: was hochgerechnet herauskäme, und woran diese Hochrechnung
 * hängt. Die zweite Zeile ist keine Ausschmückung — sie nennt die geglättete Bemessungsgrundlage
 * (die von der Gehaltsspalte der Tabelle abweichen DARF, siehe apron-service.ts) und sagt, dass
 * Deckel und Ausschüttung erst mit dem Endrang feststehen. Ohne beides läse sich die Zahl wie ein
 * bereits gebuchter Posten.
 */
function buildApronLines(apron: GuvApronProjectionInput, guv: number | null): string[] {
  const rangText = apron.rank != null ? `beim aktuellen Rang (Platz ${apron.rank})` : "beim aktuellen Rang";
  const mitApron = guv != null ? ` → mit Apron ${formatSigned(Number((guv + apron.nettoDelta).toFixed(2)))}` : "";
  const zusaetze = [
    `Gehälter ${formatPlain(apron.salary)} (geglättet) gegen Linien ${formatPlain(apron.line1)} / ${formatPlain(apron.line2)}`,
    apron.gedeckelt ? "durch den Deckel begrenzt" : null,
    apron.frozenLines ? null : "Linien noch nicht eingefroren",
  ].filter(Boolean);
  return [
    `Apron ${rangText}: ${formatSigned(apron.nettoDelta)}${mitApron}`,
    `Hochrechnung — ${zusaetze.join(" · ")}; Deckel und Ausschüttung stehen erst mit dem Endrang fest.`,
  ];
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
  // Der Apron zählt NICHT in die GuV (`counted: false`) — er wird am Saisonende gebucht und geht
  // direkt aufs Cash. Er steht als eigene Zeile daneben, damit die Zerlegung weiter exakt aufgeht:
  // die Summe der gezählten Zeilen bleibt die angezeigte Zahl.
  const apron = input.apron ?? null;
  if (apron && isNumber(apron.nettoDelta)) {
    lines.push({
      label: `Apron (Hochrechnung${apron.rank != null ? `, Platz ${apron.rank}` : ""}, nicht enthalten)`,
      value: Number(apron.nettoDelta.toFixed(2)),
      counted: false,
    });
  }

  // KOMPAKT STATT VOLLSTAENDIG: die Rechnung passt in eine Zeile, weil sie nur drei Terme hat —
  // sie als Aufzaehlung zu setzen machte aus einer Formel einen Absatz. Was der Hover leisten muss,
  // ist "woraus besteht die Zahl" und "warum weicht der Finanzen-Reiter ab"; alles andere sind
  // Saetze, die man beim zweiten Hover ueberspringt.
  const rechnung = `Sponsor ${formatSigned(sponsor)} · Gebäude ${formatSigned(facilityNet)} · Gehälter ${formatSigned(salary != null ? -salary : null)}`;
  const hoverText = [
    `GuV = ${rechnung} → ${formatSigned(total)}`,
    "Sponsor beim aktuellen Rang.",
    ...(apron && isNumber(apron.nettoDelta) ? buildApronLines(apron, total) : []),
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

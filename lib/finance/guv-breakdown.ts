import { buildSeasonGuvHoverText, seasonGuvFromPosten, type SeasonGuvPosten } from "@/lib/finance/season-end-guv";

/**
 * GEMELDET VON CHRIS (Seite „Spieltag · Saisonstand"): „Die GuV im Saisonstand und die im
 * Finanzen-Reiter weichen voneinander ab! Bitte fixen und bitte berücksichtigen, dass auch Apron mit
 * einfließt — am besten ein Hover auf dem GuV-Posten, der noch mal aufzeigt, wie die Zahl sich
 * zusammensetzt!"
 *
 * FRÜHERE ENTSCHEIDUNG, INZWISCHEN VON CHRIS AUFGEHOBEN: „die zwei Definitionen bleiben, sie werden
 * erklärt statt angeglichen." Das gilt nicht mehr. Der Auftrag lautet jetzt: „ich will auch endlich
 * dass überall die GuV das gleiche ausweist und nicht hier was anderes steht als im Sponsor-Tab oder
 * dem Finanzen-Tab." Deshalb gibt es genau EINE Rechnung — `lib/finance/season-end-guv.ts` —, und
 * diese Datei ist nur noch ihr Sprachrohr.
 *
 * ROLLENVERTEILUNG:
 *  - `season-end-guv.ts` rechnet und benennt die Posten.
 *  - `buildGuvBreakdown` (hier) nimmt die fertigen Posten und macht Zeilen + Hover-Text daraus.
 *  - Der ALTE Drei-Term-Zweig weiter unten bleibt als Rückfall für Ansichten ohne Feed stehen. Er
 *    rechnet „Gebäude netto" als REST und kann deshalb einen Fehler in `guv` nicht sichtbar machen —
 *    genau das hat den Preisgeld-Bug so lange verdeckt. Neue Aufrufer geben `posten` mit.
 *
 * APRON zählt jetzt MIT (Chris: „Sponsoren + Gebäude + Apron sind doch die möglichen Einkünfte"). Er
 * wird erst am Saisonende abgerechnet und hängt am Endrang; die Zeile sagt deshalb, dass sie eine
 * Hochrechnung auf den aktuellen Rang ist.
 *
 * Diese Datei ist bewusst React-frei: alle Ansichten lesen dieselbe Herleitung, und sie ist ohne
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
  /** Die real zu zahlende Gehaltssumme dieser Saison — die Bemessungsgrundlage des Apron. */
  salary: number;
  line1: number;
  line2: number;
  /** `true` = Linien stehen fest (Transfers finalisiert), `false` = aus dem aktuellen Stand abgeleitet. */
  frozenLines: boolean;
  /** `true` = der Deckel (halber Wertungsanteil) begrenzt die Abgabe. */
  gedeckelt: boolean;
  /** Konjunkturhebel k(f) der Saison. 0 = in dieser Saison gibt es gar keine Abgabe. */
  konjunkturhebel?: number | null;
};

export type GuvBreakdownInput = {
  /**
   * Die Posten der EINEN GuV. Liegen sie vor, ist alles andere in diesem Objekt nur noch Rückfall
   * für Ansichten, die den Feed nicht haben.
   */
  posten?: SeasonGuvPosten[] | null;
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
 * hängt. Die zweite Zeile ist keine Ausschmückung — sie nennt die Bemessungsgrundlage und sagt,
 * dass Deckel und Ausschüttung erst mit dem Endrang feststehen. Ohne beides läse sich die Zahl wie
 * ein bereits gebuchter Posten. (Bis zum 13.08.2026 stand hier ausdrücklich „geglättet", weil die
 * Bemessung von der Gehaltsspalte abweichen DURFTE; seit der Umstellung auf die real zu zahlende
 * Jahressumme sind es dieselben Gehälter, siehe apron-service.ts.)
 */
function buildApronLines(apron: GuvApronProjectionInput, guv: number | null): string[] {
  const rangText = apron.rank != null ? `beim aktuellen Rang (Platz ${apron.rank})` : "beim aktuellen Rang";
  const mitApron = guv != null ? ` → mit Apron ${formatSigned(Number((guv + apron.nettoDelta).toFixed(2)))}` : "";
  const zusaetze = [
    `Gehälter ${formatPlain(apron.salary)} gegen Linien ${formatPlain(apron.line1)} / ${formatPlain(apron.line2)}`,
    apron.gedeckelt ? "durch den Deckel begrenzt" : null,
    // Beide Richtungen benennen: „eingefroren" darf nicht die blosse Abwesenheit einer Warnung sein.
    apron.frozenLines ? "Linien eingefroren" : "Linien noch nicht eingefroren",
    apron.konjunkturhebel === 0 ? "Konjunktur zu schwach: in dieser Saison keine Abgabe" : null,
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
  /**
   * NEU (Chris: „ich will endlich dass überall die GuV das gleiche ausweist" + „alles was berechnet
   * wird auch in das Hover rein, selbst wenn es 0 ist"): liegen die Posten der EINEN GuV vor
   * (`lib/finance/season-end-guv.ts`, geliefert über den Saisonstand-Feed), wird der Hover daraus
   * gebaut — jeder Posten mit eigener Zeile, auch die mit 0.
   *
   * Der Zweig darunter ist nur noch der Rückfall für Ansichten ohne Feed. Er rechnet „Gebäude netto"
   * bewusst als REST (`guv − sponsor + gehälter`) und kann deshalb keinen Fehler in `guv` sichtbar
   * machen — genau das war die Schwäche, die den Preisgeld-Bug so lange verdeckt hat.
   */
  if (input.posten && input.posten.length > 0) {
    const ausPosten = seasonGuvFromPosten("", input.posten);
    return {
      total: ausPosten.guv,
      lines: input.posten.map((entry) => ({
        label: entry.note ? `${entry.label} (${entry.note})` : entry.label,
        value: entry.amount,
        counted: entry.counted,
      })),
      hoverText: buildSeasonGuvHoverText(ausPosten),
    };
  }

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

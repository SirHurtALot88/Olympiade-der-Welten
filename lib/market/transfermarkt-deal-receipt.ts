import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";

/**
 * KASSENZETTEL DES DEAL-DESKS — die EINE Ableitung für „was kostet der Deal
 * heute" und „was ändert sich, wenn der Kauf durchgeht".
 *
 * WARUM ES DIESES MODUL GIBT (Audit-Befund M3): Die Buy-Preview liefert ihre
 * `*After`-Felder nur dann als echte Folgezahlen, wenn `canBuy` wahr ist —
 * bei einem blockierten Deal (z. B. `insufficient_cash`) setzt der Server
 * `cashAfter = cashBefore` usw. (transfermarkt-local-service.ts, Zeile ~968).
 * Der Deal-Desk zeigte diese geklemmten Werte als „±0" an: ein 11,4-Mio-Deal
 * sah aus, als würde er nichts ändern. Die Server-Semantik bleibt bewusst
 * unangetastet (AI-Planner und Ausführung hängen daran); DIESES Modul ist die
 * einzige Stelle, die daraus die Anzeige-Größen ableitet — Deal-Desk und
 * Kauf-Modal konsumieren beide denselben Zettel, keine zweite Rechnung im UI.
 *
 * FORMEL-SPIEGEL: Ist der Deal ausführbar, werden die Server-`*After`-Werte
 * UNVERÄNDERT übernommen (eine Quelle). Ist er blockiert, rechnet der Zettel
 * die Hypothese mit exakt den Formeln des Servers nach:
 *   cashAfter        = cashBefore − purchasePrice
 *   salaryAfter      = salaryBefore + (offeredSalary ?? salary)
 *   rosterAfter      = rosterBefore + 1
 *   marketValueAfter = marketValueBefore + (currentValue ?? purchasePrice)
 * `tests/transfermarkt-deal-receipt.test.ts` hält fest, dass beide Wege für
 * denselben Deal dieselben Zahlen liefern — der Spiegel kann nicht still
 * driften.
 *
 * WAS DER DEAL HEUTE KOSTET: Beim Kauf wird ausschließlich die Ablöse
 * (`purchasePrice`) vom Cash abgebucht (Ausführung: `cash − purchasePrice`);
 * der `buyoutCost` der Preview ist die Restgehalts-Ablösung bei einem
 * SPÄTEREN Ausstieg aus dem neuen Vertrag, keine heutige Zahlung. Deshalb
 * rechnet `missingCash` gegen die Ablöse — nicht gegen ein „Gesamtpaket"
 * aus Ablöse + Buyout, das es als heutige Zahlung im Spiel nicht gibt.
 */
export type TransfermarktDealReceiptPreview = Pick<
  TransfermarktBuyPreview,
  | "canBuy"
  | "purchasePrice"
  | "cashBefore"
  | "cashAfter"
  | "salary"
  | "salaryBefore"
  | "salaryAfter"
  | "rosterBefore"
  | "rosterAfter"
  | "marketValueBefore"
  | "marketValueAfter"
> & {
  offeredSalary?: number | null;
  currentValue?: number | null;
};

export type TransfermarktDealReceipt = {
  /** Server-Urteil: darf der Kauf JETZT ausgeführt werden? */
  executable: boolean;
  purchasePrice: number | null;
  cashBefore: number | null;
  /** > 0 ⇒ die Ablöse ist heute nicht bezahlbar; genau dieser Betrag fehlt. */
  missingCash: number | null;
  cashAfterIfBought: number | null;
  salaryBefore: number | null;
  salaryAfterIfBought: number | null;
  rosterBefore: number | null;
  rosterAfterIfBought: number | null;
  marketValueBefore: number | null;
  marketValueAfterIfBought: number | null;
};

const round2 = (value: number) => Number(value.toFixed(2));

export function buildTransfermarktDealReceipt(
  preview: TransfermarktDealReceiptPreview | null | undefined,
): TransfermarktDealReceipt | null {
  if (!preview) {
    return null;
  }
  const executable = preview.canBuy === true;
  const purchasePrice = preview.purchasePrice ?? null;
  const cashBefore = preview.cashBefore ?? null;
  // Spiegel der Server-Formel (transfermarkt-local-service:
  // `contractSalary = negotiationPreview.offeredSalary ?? salary`).
  const contractSalary = preview.offeredSalary ?? preview.salary ?? null;
  // Spiegel: `marketValueAfter = marketValueBefore + marketValueReference`,
  // wobei `currentValue = marketValueReference ?? purchasePrice`.
  const addedMarketValue = preview.currentValue ?? purchasePrice;

  const missingCash =
    cashBefore != null && purchasePrice != null && purchasePrice > cashBefore
      ? round2(purchasePrice - cashBefore)
      : null;

  return {
    executable,
    purchasePrice,
    cashBefore,
    missingCash,
    cashAfterIfBought: executable
      ? preview.cashAfter ?? null
      : cashBefore != null && purchasePrice != null
        ? round2(cashBefore - purchasePrice)
        : null,
    salaryBefore: preview.salaryBefore ?? null,
    salaryAfterIfBought: executable
      ? preview.salaryAfter ?? null
      : preview.salaryBefore != null && contractSalary != null
        ? round2(preview.salaryBefore + contractSalary)
        : null,
    rosterBefore: preview.rosterBefore ?? null,
    rosterAfterIfBought: executable
      ? preview.rosterAfter ?? null
      : preview.rosterBefore != null
        ? preview.rosterBefore + 1
        : null,
    marketValueBefore: preview.marketValueBefore ?? null,
    marketValueAfterIfBought: executable
      ? preview.marketValueAfter ?? null
      : preview.marketValueBefore != null && addedMarketValue != null
        ? round2(preview.marketValueBefore + addedMarketValue)
        : null,
  };
}

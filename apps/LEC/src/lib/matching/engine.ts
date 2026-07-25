import type { BillbeeRow } from "../importers/billbee";
import type { EbayRow } from "../importers/ebay";

/**
 * Matching-Engine Billbee <-> eBay (KONZEPT.md Abschnitt 5.2/12.3):
 * primaerer Schluessel = normalisierter Artikelname, Set-Code als
 * sekundaerer Tiebreaker/Dublettenerkennung. Ungematchtes landet in einer
 * Review-Liste; bereits gelernte Aliasse (nameVariant -> billbee-Name)
 * werden vorher angewendet.
 */

export interface MatchedPair {
  billbee: BillbeeRow;
  ebayRows: EbayRow[];
  matchedBy: "name" | "set_code" | "alias";
}

export interface MatchResult {
  matched: MatchedPair[];
  unmatchedBillbee: BillbeeRow[];
  unmatchedEbay: EbayRow[];
  stats: {
    totalBillbee: number;
    totalEbay: number;
    matchedBillbee: number;
    matchedByName: number;
    matchedBySetCode: number;
    matchedByAlias: number;
    exactMatchRate: number;
  };
}

/** Gelernte Aliasse: eBay- oder Billbee-Namensvariante (roh) -> Billbee nameNormalized. */
export type AliasMap = Map<string, string>;

export function matchBillbeeToEbay(
  billbeeRows: BillbeeRow[],
  ebayRows: EbayRow[],
  aliases: AliasMap = new Map()
): MatchResult {
  const ebayByName = new Map<string, EbayRow[]>();
  const ebayBySetCode = new Map<string, EbayRow[]>();
  const consumedEbay = new Set<EbayRow>();

  for (const row of ebayRows) {
    const key = resolveAlias(row.titleNormalized, aliases);
    pushToMultiMap(ebayByName, key, row);
    if (row.setCode) {
      pushToMultiMap(ebayBySetCode, row.setCode, row);
    }
  }

  const matched: MatchedPair[] = [];
  const unmatchedBillbee: BillbeeRow[] = [];
  let matchedByName = 0;
  let matchedBySetCode = 0;
  let matchedByAlias = 0;

  for (const billbee of billbeeRows) {
    const aliasKey = aliases.get(billbee.nameNormalized);
    const nameKey = aliasKey ?? billbee.nameNormalized;

    let ebayMatches = ebayByName.get(nameKey);
    let matchedBy: MatchedPair["matchedBy"] = aliasKey ? "alias" : "name";

    if (!ebayMatches || ebayMatches.length === 0) {
      if (billbee.setCode) {
        ebayMatches = ebayBySetCode.get(billbee.setCode);
        matchedBy = "set_code";
      }
    }

    if (ebayMatches && ebayMatches.length > 0) {
      ebayMatches.forEach((row) => consumedEbay.add(row));
      matched.push({ billbee, ebayRows: ebayMatches, matchedBy });
      if (matchedBy === "name") matchedByName++;
      else if (matchedBy === "set_code") matchedBySetCode++;
      else matchedByAlias++;
    } else {
      unmatchedBillbee.push(billbee);
    }
  }

  const unmatchedEbay = ebayRows.filter((row) => !consumedEbay.has(row));

  const totalBillbee = billbeeRows.length;
  const matchedBillbee = matched.length;

  return {
    matched,
    unmatchedBillbee,
    unmatchedEbay,
    stats: {
      totalBillbee,
      totalEbay: ebayRows.length,
      matchedBillbee,
      matchedByName,
      matchedBySetCode,
      matchedByAlias,
      exactMatchRate: totalBillbee === 0 ? 0 : matchedBillbee / totalBillbee,
    },
  };
}

function resolveAlias(normalizedName: string, aliases: AliasMap): string {
  return aliases.get(normalizedName) ?? normalizedName;
}

function pushToMultiMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}

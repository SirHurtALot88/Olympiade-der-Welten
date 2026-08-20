import type { AllTimeTableRow } from "@/lib/foundation/all-time-table";

/**
 * VERLAUF JE SAISON — die Spalten, die Chris in der Ewigen Tabelle gefehlt haben.
 *
 * GEMELDET (`lcmgxx`, „Team · Ewige Tabelle"): „In der ewigen Tabelle soll die Entwicklung gezeigt
 * werden von Season zu season mit Marktwert und Cash in der Tabelle, nicht nur der beste und der
 * aktuelle Wert."
 *
 * Die Tabelle trug bis hierher `mwNow`/`mwPeak`/`cashNow`/`cashPeak` — also wörtlich „der beste
 * und der aktuelle Wert". Die Daten je Saison lagen im Modell längst bereit
 * (`AllTimeTableRow.seasons[]` mit `marketValue` und `cash`); es fehlte nur die Sicht darauf.
 *
 * WARUM EIN EIGENES MODUL. Die Spalten sind DYNAMISCH — jeder Spielstand hat andere Saisons, und
 * die laufende kommt während des Spielens dazu. Damit hängen Spaltenbau, Sortierwert und Zelle an
 * derselben Schlüssel-Zerlegung; läge sie in der Ansicht, wäre sie nicht prüfbar, ohne die ganze
 * Tabelle zu rendern und einen Reiter zu klicken.
 *
 * DER SCHLÜSSEL TRÄGT DIE SAISON MIT (`saison:<seasonId>:mw`), damit Sortierung und Zelle
 * dieselbe Saison meinen, ohne eine zweite Zuordnung zu führen. `seasonId` darf selbst
 * Doppelpunkte enthalten — deshalb wird von RECHTS getrennt.
 */
export const SAISON_SPALTEN_PRAEFIX = "saison:";

export type SaisonSpaltenMetrik = "mw" | "cash";

export type SaisonSpalte = {
  key: string;
  label: string;
  align: "right";
  sortable: true;
  tooltip: string;
};

export function parseSaisonSpalte(key: string): { seasonId: string; metrik: SaisonSpaltenMetrik } | null {
  if (!key.startsWith(SAISON_SPALTEN_PRAEFIX)) {
    return null;
  }
  const rest = key.slice(SAISON_SPALTEN_PRAEFIX.length);
  const trenner = rest.lastIndexOf(":");
  if (trenner <= 0) {
    return null;
  }
  const metrik = rest.slice(trenner + 1);
  if (metrik !== "mw" && metrik !== "cash") {
    return null;
  }
  return { seasonId: rest.slice(0, trenner), metrik };
}

export function getSaisonWert(row: AllTimeTableRow, seasonId: string, metrik: SaisonSpaltenMetrik): number | null {
  const punkt = row.seasons.find((season) => season.seasonId === seasonId) ?? null;
  if (!punkt) {
    return null;
  }
  const wert = metrik === "mw" ? punkt.marketValue : punkt.cash;
  return wert != null && Number.isFinite(wert) ? wert : null;
}

/**
 * Die Saison-Achse ist die VEREINIGUNG über alle Teams, nicht die des ersten: ein Team, das eine
 * Saison ausgelassen hat, darf die Spalten der anderen nicht verkürzen.
 */
export function sammleSaisons(rows: AllTimeTableRow[]): Array<{ seasonId: string; label: string }> {
  const gesehen = new Map<string, string>();
  for (const row of rows) {
    for (const season of row.seasons) {
      if (!gesehen.has(season.seasonId)) {
        gesehen.set(season.seasonId, season.seasonLabel);
      }
    }
  }
  return [...gesehen.entries()]
    .sort((links, rechts) => links[0].localeCompare(rechts[0], "de", { numeric: true }))
    .map(([seasonId, label]) => ({ seasonId, label }));
}

/** Je Saison zwei Spalten: Marktwert und Cash, in dieser Reihenfolge. */
export function baueSaisonSpalten(rows: AllTimeTableRow[]): SaisonSpalte[] {
  return sammleSaisons(rows).flatMap(({ seasonId, label }) => [
    {
      key: `${SAISON_SPALTEN_PRAEFIX}${seasonId}:mw`,
      label: `${label} MW`,
      align: "right" as const,
      sortable: true as const,
      tooltip: `Marktwert am Ende von ${label}`,
    },
    {
      key: `${SAISON_SPALTEN_PRAEFIX}${seasonId}:cash`,
      label: `${label} Cash`,
      align: "right" as const,
      sortable: true as const,
      tooltip: `Kontostand am Ende von ${label}`,
    },
  ]);
}

import type { SortimentRow } from "./viewModel";

/**
 * Gebundenes Kapital nach Alter (KENNZAHLEN_RECHERCHE.md, Entscheidungen 14.11.): EINE Definition fuer "Ladenhueter" und Co.
 * Gezaehlt werden aktive, nicht ausgeblendete Artikel mit Bestand und bekanntem EK; Wert = Bestand x aktueller EK.
 * Alter = Tage seit dem letzten Verkauf; bei nie verkauften das aus der eBay-Nummer geschaetzte Mindestalter des Angebots
 * (listedDays). Ohne beides ist das Alter unbekannt und der Artikel steht separat.
 */
export type AgeGroupKey = "frisch" | "ruhig" | "langsam" | "ladenhueter";

export const AGE_GROUPS: { key: AgeGroupKey; label: string; range: string; maxDays: number }[] = [
  { key: "frisch", label: "Frisch", range: "0–90 T", maxDays: 90 },
  { key: "ruhig", label: "Ruhig", range: "91–180 T", maxDays: 180 },
  { key: "langsam", label: "Langsam", range: "181–365 T", maxDays: 365 },
  { key: "ladenhueter", label: "Ladenhüter", range: "über 365 T", maxDays: Infinity },
];

type AgeRow = Pick<SortimentRow, "articleId" | "active" | "hidden" | "stock" | "lastSoldAt" | "listedDays" | "ekMissing" | "today">;

export interface AgeItem {
  articleId: string;
  days: number;
  capital: number;
  group: AgeGroupKey;
}

export interface CapitalAge {
  groups: { key: AgeGroupKey; label: string; range: string; articles: number; capital: number }[];
  total: number;
  /** Artikel mit Bestand, aber ohne bekannten EK: fehlen in allen Summen. */
  withoutEk: number;
  /** Artikel mit Bestand und EK, deren Alter nicht zu bestimmen ist (nie verkauft, kein eBay-Alter). */
  unknownAge: { articles: number; capital: number };
  /** Einzelne Artikel, aeltester zuerst innerhalb gleicher Gruppe nach Kapital absteigend (fuer "Muss weg"). */
  items: AgeItem[];
}

export function ageDaysOf(r: Pick<AgeRow, "lastSoldAt" | "listedDays">, now: number): number | null {
  if (r.lastSoldAt) {
    const t = Date.parse(r.lastSoldAt);
    if (!Number.isNaN(t)) return Math.max(0, Math.floor((now - t) / 86_400_000));
  }
  return r.listedDays ?? null;
}

export const groupOfDays = (days: number): AgeGroupKey => AGE_GROUPS.find((g) => days <= g.maxDays)!.key;

export function capitalByAge(rows: ReadonlyArray<AgeRow>, now: number = Date.now()): CapitalAge {
  const acc = new Map<AgeGroupKey, { articles: number; capital: number }>(AGE_GROUPS.map((g) => [g.key, { articles: 0, capital: 0 }]));
  const items: AgeItem[] = [];
  let withoutEk = 0;
  const unknownAge = { articles: 0, capital: 0 };
  for (const r of rows) {
    if (!r.active || r.hidden || r.stock <= 0) continue;
    const capital = r.today?.capitalBound ?? null;
    if (r.ekMissing || capital === null || capital <= 0) {
      withoutEk++;
      continue;
    }
    const days = ageDaysOf(r, now);
    if (days === null) {
      unknownAge.articles++;
      unknownAge.capital += capital;
      continue;
    }
    const group = groupOfDays(days);
    const g = acc.get(group)!;
    g.articles++;
    g.capital += capital;
    items.push({ articleId: r.articleId, days, capital, group });
  }
  const groups = AGE_GROUPS.map((g) => ({ key: g.key, label: g.label, range: g.range, ...acc.get(g.key)! }));
  return { groups, total: groups.reduce((n, g) => n + g.capital, 0), withoutEk, unknownAge, items: items.sort((a, b) => b.capital - a.capital) };
}

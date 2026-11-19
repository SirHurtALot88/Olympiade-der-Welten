/**
 * Filter des Transfermarkts und des Draft-Bretts, alle NUR über die Sicht (Scouting-Nebel): Achsen-Mindestnote,
 * Kartenfarbe der Klasse, Marktwert, Gehalt, Value (Marktwert ÷ Gehalt) und Mindestnote je Attribut.
 * Verdecktes besteht keinen Mindestwert-Filter; eine Zweier-Gruppe („B–A“) besteht, wenn ihre obere Note reicht.
 */
import { getClassColorToken } from "@/app/foundation/classVisuals";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { TRANSFERMARKT_ATTRIBUTE_KEYS, type TransfermarktAttributeKey } from "@/lib/market/transfermarkt-attribute-filter";
import { erfuelltAchsenMinimum, type MarktAchse, type SpielerSicht } from "@/lib/market/transfermarkt-sicht";

const NOTEN = ["F", "E", "D", "C", "B", "A", "S", "S+"];

/** Mindestnoten, die ein Filter wählen kann (Index in F,E,D,C,B,A,S,S+). */
export const MINDEST_NOTEN = [
  { label: "D", index: 2 },
  { label: "C", index: 3 },
  { label: "B", index: 4 },
  { label: "A", index: 5 },
  { label: "S", index: 6 },
] as const;

/** Reihum für die Achsen-Chips: aus, D, C, B, A, S, aus (Chris 19.11.: auch Sekundär-Achsen ab D/C filtern). */
export function naechsteMindestNote(aktuell: number | undefined): number | undefined {
  if (aktuell == null) return MINDEST_NOTEN[0].index;
  const i = MINDEST_NOTEN.findIndex((n) => n.index === aktuell);
  return i < 0 || i + 1 >= MINDEST_NOTEN.length ? undefined : MINDEST_NOTEN[i + 1].index;
}

export function mindestNoteLabel(index: number | undefined): string {
  return MINDEST_NOTEN.find((n) => n.index === index)?.label ?? "";
}

const FARBE_ZU_ACHSE: Record<string, MarktAchse> = { red: "pow", green: "spe", blue: "men", yellow: "soc" };

/** POW/SPE/MEN/SOC-Farbe der Formkarte, die die Klasse des Spielers bringt (dieselbe Quelle wie die Formkarten). */
export function klassenAchse(className: string | null | undefined): MarktAchse | null {
  const token = getClassColorToken(className);
  return token ? FARBE_ZU_ACHSE[token] ?? null : null;
}

export type WeitereFilter = {
  /** Mindestnote je Achse (Index in F..S+); fehlt = egal. */
  achsenMin: Partial<Record<MarktAchse, number>>;
  /** Kartenfarben, von denen mindestens eine zur Klasse passen muss; leer = egal. */
  farben: MarktAchse[];
  mwMin: number | null;
  mwMax: number | null;
  gehaltMax: number | null;
  valueMin: number | null;
  attributMin: Partial<Record<TransfermarktAttributeKey, number>>;
};

export const LEERE_FILTER: WeitereFilter = { achsenMin: {}, farben: [], mwMin: null, mwMax: null, gehaltMax: null, valueMin: null, attributMin: {} };

export function zaehleAktiveFilter(f: WeitereFilter): number {
  return (
    Object.keys(f.achsenMin).length +
    (f.farben.length ? 1 : 0) +
    [f.mwMin, f.mwMax, f.gehaltMax, f.valueMin].filter((x) => x != null).length +
    Object.keys(f.attributMin).length
  );
}

export function erfuelltFilter(item: TransfermarktFreeAgentItem, sicht: SpielerSicht, f: WeitereFilter): boolean {
  for (const [achse, min] of Object.entries(f.achsenMin) as [MarktAchse, number][]) {
    if (!erfuelltAchsenMinimum(sicht, achse, min)) return false;
  }
  if (f.farben.length) {
    const a = klassenAchse(item.className);
    if (!a || !f.farben.includes(a)) return false;
  }
  const mw = item.marketValue;
  if (f.mwMin != null && (mw == null || mw < f.mwMin)) return false;
  if (f.mwMax != null && (mw == null || mw > f.mwMax)) return false;
  if (f.gehaltMax != null && (item.salary == null || item.salary > f.gehaltMax)) return false;
  if (f.valueMin != null && (item.marketValueSalaryRatio == null || item.marketValueSalaryRatio < f.valueMin)) return false;
  for (const key of TRANSFERMARKT_ATTRIBUTE_KEYS) {
    const min = f.attributMin[key];
    if (min == null) continue;
    const a = sicht.attribute[key];
    if (!a?.aufgedeckt || a.anzeige == null) return false;
    const oben = Math.max(...a.anzeige.split("–").map((t) => NOTEN.indexOf(t)));
    if (oben < min) return false;
  }
  return true;
}

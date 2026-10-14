import type { SortimentRow } from "./viewModel";
import { RARITY_NAMES, rarityKey } from "../market/rarity";

/**
 * Preis-Board (Sortiment, Ansicht "Kompakt"): was ist zu tun, und wie gross ist der Hebel?
 * Reine Funktionen, damit Sortierung und Anzeige-Werte testbar bleiben.
 */

/** VK, gegen den die Zielspanne bewertet wird: Listen-VK (eBay live), sonst realisierter Ø-VK. */
export function boardVk(row: SortimentRow): number {
  return row.listingVk ?? row.avgVkRealized;
}

export interface BoardGap {
  /** Abstand zur naechsten Spannengrenze in €: unter Minimum negativ, ueber Optimum positiv, in der Spanne 0. */
  euro: number;
  /** Dasselbe relativ zur Grenze (−0,32 = 32 % unter dem Minimum). */
  percent: number;
  /** Grenze, auf die der VK zu bewegen waere (Minimum bei zu guenstig, Optimum bei zu teuer), sonst null. */
  target: number | null;
}

/** Null ohne Zielspanne oder ohne VK. */
export function boardGap(row: SortimentRow): BoardGap | null {
  const m = row.market;
  const vk = boardVk(row);
  if (!m || m.targetMin === null || m.targetOpt === null || !(vk > 0)) return null;
  if (vk < m.targetMin) return { euro: vk - m.targetMin, percent: (vk - m.targetMin) / m.targetMin, target: m.targetMin };
  if (vk > m.targetOpt) return { euro: vk - m.targetOpt, percent: (vk - m.targetOpt) / m.targetOpt, target: m.targetOpt };
  return { euro: 0, percent: 0, target: null };
}

export type BoardSortKey = "abweichung" | "marktwert" | "vk" | "marge" | "name";

export const BOARD_SORT_LABEL: Record<BoardSortKey, string> = {
  abweichung: "Größte Abweichung",
  marktwert: "Marktwert",
  vk: "Dein VK",
  marge: "Marge bei Nachkauf",
  name: "Name",
};

/**
 * "Groesste Abweichung": Artikel mit belastbarem Urteil und Abweichung zuerst, nach |€| absteigend;
 * dann die im Rahmen, zuletzt die ohne Urteil. Bei Gleichstand nach Name — die Reihenfolge ist stabil.
 */
export function sortBoard(rows: readonly SortimentRow[], key: BoardSortKey): SortimentRow[] {
  const byName = (a: SortimentRow, b: SortimentRow) => a.nameRaw.localeCompare(b.nameRaw, "de");
  const marketValue = (r: SortimentRow) => r.market?.value ?? r.market?.range?.max ?? -1;
  const rank = (r: SortimentRow): number => {
    if (!r.market?.rated) return 0;
    return boardGap(r)?.euro === 0 ? 1 : 2;
  };
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (key) {
      case "abweichung": {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return rb - ra;
        // Ohne belastbares Urteil keine Abweichungs-Reihenfolge (die Spanne ist dort nur grob).
        if (ra === 0) return byName(a, b);
        return Math.abs(boardGap(b)?.euro ?? 0) - Math.abs(boardGap(a)?.euro ?? 0) || byName(a, b);
      }
      case "marktwert":
        return marketValue(b) - marketValue(a) || byName(a, b);
      case "vk":
        return boardVk(b) - boardVk(a) || byName(a, b);
      case "marge":
        return (a.market?.margin ?? 9) - (b.market?.margin ?? 9) || byName(a, b);
      case "name":
        return byName(a, b);
    }
  });
  return copy;
}

export interface CleanTitle {
  /** Kartenname ohne Set-Code, Seltenheit, Zustand und Edition. */
  name: string;
  /** "3x" aus dem Titel, sonst 1. */
  pack: number;
  /** "1st" / "Unlimited" / "Limited", wenn im Titel. */
  edition: string | null;
}

/**
 * Anzeige-Name fuer das Board: der Titel traegt Set-Code, Seltenheit, Zustand und Edition schon
 * in eigenen Spalten bzw. Badges, doppelt gelesen ist nur Laerm. Rein kosmetisch — die Zuordnung
 * (Marktwert, Seltenheit) rechnet weiter mit dem vollen Titel.
 */
export function cleanTitle(nameRaw: string): CleanTitle {
  let t = nameRaw.replace(/^\s*(\d+)\s*x\s+/i, "$1x ");
  const packMatch = t.match(/^(\d+)x\s+/i);
  const pack = packMatch ? parseInt(packMatch[1], 10) : 1;
  if (packMatch) t = t.slice(packMatch[0].length);
  t = t.replace(/^Yu-Gi-Oh!?\s*/i, "");
  t = t.replace(/\b[A-Z0-9]{2,5}-(?:DE|EN)[A-Z]?\d{2,3}\b\s*/i, "");

  let edition: string | null = null;
  const ed = t.match(/\b(1st(?:\s*Ed(?:ition)?)?|Unlimited|Limited)\b/i);
  if (ed) edition = /^1st/i.test(ed[1]) ? "1st" : ed[1][0].toUpperCase() + ed[1].slice(1).toLowerCase();
  // Zustand, Edition und Seltenheit (ausgeschrieben, laengste Namen zuerst) am Ende abschneiden
  t = t.replace(/\b(NM|LP|MP|HP|EX|GD|PL)\b/g, " ").replace(/\b(1st(?:\s*Ed(?:ition)?)?|Unlimited|Limited)\b/gi, " ");
  for (const r of RARITY_NAMES) {
    const re = new RegExp(`\\s*${rarityKey(r).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\s*$`, "i");
    if (re.test(rarityKey(t))) {
      t = t.slice(0, t.length - (rarityKey(t).length - rarityKey(t).replace(re, "").length));
      break;
    }
  }
  // Kuerzel am Ende (SR, UR, ScR, QCSR, PlatSecR ...): nur entfernen, wenn sie als eigenes Wort am Ende stehen
  t = t.replace(/\s+(?:25th\s+|25\s+)?(?:QCSR|QCSCR|PSR|CR|SR|UR|SecR|ScR|UtR|UltiR|PlatSecR|PlatSR|Plat SecR|Platinum SecR|Platinum SR|QCentury)\s*$/i, "");
  return { name: t.replace(/\s+/g, " ").trim(), pack, edition };
}

/**
 * Suchcode fuer Cardmarket: ohne Sprachkuerzel. Cardmarket findet "MAMA-DE047" nicht,
 * "MAMA-047" sofort. Nicht erkennbare Codes bleiben unveraendert.
 */
export function cardmarketCode(setCode: string): string {
  const m = setCode.trim().toUpperCase().match(/^([A-Z0-9]+)-(?:DE|EN|FR|IT|PT|ES|SP|JP|KR)([A-Z]?\d+)$/);
  return m ? `${m[1]}-${m[2]}` : setCode.trim();
}

export interface EbayLinks {
  /** Das Angebot ansehen. */
  view: string | null;
  /** Das Angebot im Verkaeufer-Formular bearbeiten (Preis aendern). */
  revise: string | null;
  /** Suche im eigenen Shop, wenn die Artikelnummer unbekannt ist. */
  search: string;
}

const SHOP = "https://www.ebay.de/str/lordenterichcards";

/** Links zu eBay: direkt zum Angebot, sonst Suche im eigenen Shop ueber den Cardmarket-Code (ohne DE/EN). */
export function ebayLinks(row: Pick<SortimentRow, "ebayItemId" | "setCode" | "nameRaw">): EbayLinks {
  const id = row.ebayItemId && /^\d{9,14}$/.test(row.ebayItemId) ? row.ebayItemId : null;
  const term = row.setCode ? cardmarketCode(row.setCode) : row.nameRaw;
  return {
    view: id ? `https://www.ebay.de/itm/${id}` : null,
    revise: id ? `https://www.ebay.de/lstng?mode=ReviseItem&itemId=${id}` : null,
    search: `${SHOP}?_nkw=${encodeURIComponent(term)}`,
  };
}

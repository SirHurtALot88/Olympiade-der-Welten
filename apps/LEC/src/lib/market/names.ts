/**
 * Passt der Name im Titel zum Set-Code? Der Set-Code ist verlaesslich (er steht auf der Karte),
 * der Titel von Hand getippt: "Mitsurugi Magatama RA04-DE094" ist dann eine andere Karte als der
 * Code sagt. Wir vergleichen den Titel mit dem deutschen und englischen Namen der Karte zum Code.
 */

export interface CodeName {
  en: string;
  de: string | null;
}

/** Kleinbuchstaben, ohne Akzente, Umlaut-Aufloesung, nur Buchstaben und Ziffern. */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

interface YgoCardLite {
  id?: number;
  name?: string;
  card_sets?: { set_code?: string; set_rarity?: string }[];
}

/** Set-Code (englisch) -> Kartenname englisch/deutsch. Deutsche Namen sind optional. */
export function buildCodeNames(en: YgoCardLite[], de: YgoCardLite[] | null): Map<string, CodeName> {
  const deById = new Map<number, string>();
  for (const c of de ?? []) if (c.id !== undefined && c.name) deById.set(c.id, c.name);
  const out = new Map<string, CodeName>();
  for (const c of en) {
    if (!c.name) continue;
    const deName = c.id !== undefined ? (deById.get(c.id) ?? null) : null;
    for (const s of c.card_sets ?? []) {
      const code = s.set_code?.toUpperCase();
      if (code && !out.has(code)) out.set(code, { en: c.name, de: deName });
    }
  }
  return out;
}

/** Aehnlichkeit zweier Namensschluessel (Dice-Koeffizient auf Buchstabenpaaren), 0..1. */
export function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const ga = grams(a);
  const gb = grams(b);
  let common = 0;
  for (const [g, n] of ga) common += Math.min(n, gb.get(g) ?? 0);
  return (2 * common) / (a.length - 1 + (b.length - 1));
}

/** Ab dieser Aehnlichkeit gilt ein Titelname als derselbe Name (Schreibvarianten, Kommas, Abkuerzungen). */
export const NAME_MATCH_THRESHOLD = 0.62;

/**
 * true = der Titel nennt einen anderen Namen als die Karte zum Code. Verglichen wird NUR, wenn der
 * deutsche Kartenname bekannt ist (die Titel sind deutsch; gegen den englischen Namen wuerde fast alles
 * als Fehler gelten). Ohne deutschen Namen oder mit zu kurzem Titel: false, kein Urteil.
 */
export function titleNameMismatch(titleName: string, name: { en: string | null; de: string | null }): boolean {
  const title = nameKey(titleName);
  if (title.length < 3 || !name.de) return false;
  const known = [name.de, name.en].filter((n): n is string => !!n).map(nameKey).filter((k) => k.length >= 3);
  if (known.length === 0) return false;
  return !known.some((k) => title.includes(k) || k.includes(title) || nameSimilarity(title, k) >= NAME_MATCH_THRESHOLD);
}

export interface NameIndexEntry {
  en: string;
  /** Alle Drucke der Karte: englischer Set-Code und Seltenheit. */
  prints: { code: string; rarity: string }[];
}

/** nameKey(deutscher oder englischer Name) -> Karte mit allen Drucken. */
export function buildNameIndex(en: YgoCardLite[], de: YgoCardLite[] | null): Map<string, NameIndexEntry> {
  const deById = new Map<number, string>();
  for (const c of de ?? []) if (c.id !== undefined && c.name) deById.set(c.id, c.name);
  const out = new Map<string, NameIndexEntry>();
  for (const c of en) {
    if (!c.name) continue;
    const entry: NameIndexEntry = {
      en: c.name,
      prints: (c.card_sets ?? []).filter((s) => s.set_code).map((s) => ({ code: s.set_code!.toUpperCase(), rarity: s.set_rarity ?? "" })),
    };
    const keys = [c.name, c.id !== undefined ? deById.get(c.id) : undefined].filter((k): k is string => !!k).map(nameKey);
    for (const k of keys) if (k.length >= 3 && !out.has(k)) out.set(k, entry);
  }
  return out;
}

/**
 * Passende Set-Codes (deutsche Schreibweise) zum Namen im Titel. Bevorzugt Drucke in der Seltenheit
 * aus dem Titel; null, wenn der Name keine Karte eindeutig bezeichnet.
 * `rarityNames` sind die moeglichen Seltenheitsnamen (rarityCandidates).
 */
export function suggestCodes(index: Map<string, NameIndexEntry>, titleName: string, rarityNames: string[], limit = 4): string[] | null {
  const hit = index.get(nameKey(titleName));
  if (!hit) return null;
  const wanted = new Set(rarityNames.map(nameKey));
  const matching = hit.prints.filter((p) => wanted.has(nameKey(p.rarity)));
  const pool = matching.length > 0 ? matching : hit.prints;
  const codes = [...new Set(pool.map((p) => p.code.replace(/-EN(?=[A-Z]?\d)/, "-DE")))];
  return codes.slice(0, limit);
}

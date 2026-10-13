/**
 * Seltenheit aus Chris' Angebotstiteln ("... Ultra Rare NM 1st", "... Platinum SecR NM 1st",
 * "... 25th QCSR NM 1st") und Set-Code-Zerlegung.
 *
 * Namen: die 54 Seltenheitsnamen von Cardcluster (aus deren Frontend, 13.10.2026). Chris
 * schreibt sie im Titel teils aus, teils abgekuerzt; die Kuerzel unten sind aus seinen
 * 1.676 Angeboten gesammelt, nicht geraten. "PSR" heisst bei ihm Platinum Secret Rare
 * (bei Cardcluster ist PSR die Parallel Super Rare — in seinen Titeln kommt die nicht vor).
 */

export const RARITY_NAMES = [
  "Pharaoh's Rare (Secret Rare foiling)", "Pharaoh's Rare (Ultra Rare foiling)", "Silver Ultra Rare (Astral glyphs)",
  "Starlight Rare (Astral glyphs)", "Quarter Century Secret Rare", "Prismatic Collector's Rare", "Ultra Rare (Astral glyphs)",
  "Duel Terminal Secret Rare", "Duel Terminal Super Rare", "Duel Terminal Ultra Rare", "Duelist Saga Ultra Rare",
  "Prismatic Ultimate Rare", "Prismatic Secret Rare", "Duel Terminal Common", "Platinum Secret Rare", "Parallel Super Rare",
  "Parallel Ultra Rare", "Duel Terminal Rare", "10000 Secret Rare", "Extra Secret Rare", "Grand Master Rare",
  "Premium Gold Rare", "Purple Ultra Rare", "Silver Ultra Rare", "Black/White Rare", "Blue Secret Rare", "Collector's Rare",
  "Gold Letter Rare", "Gold Secret Rare", "Green Ultra Rare", "Shatterfoil Rare", "Blue Ultra Rare", "Ghost Gold Rare",
  "Light Blue Rare", "Parallel Common", "Red Ultra Rare", "Starlight Rare", "Platinum Rare", "Starfoil Rare", "Ultimate Rare",
  "Bronze Rare", "Mosaic Rare", "Purple Rare", "Secret Rare", "Ghost Rare", "Green Rare", "Super Rare", "Ultra Rare",
  "Blue Rare", "Gold Rare", "Red Rare", "Common", "Normal", "Rare",
];

/** Kuerzel in Chris' Titeln -> Seltenheitsname. Laengere zuerst pruefen. */
const ALIASES: [string, string][] = [
  ["platinum secrare", "Platinum Secret Rare"],
  ["platinum secr", "Platinum Secret Rare"],
  ["platsecr", "Platinum Secret Rare"],
  ["platsr", "Platinum Secret Rare"],
  ["qcentury", "Quarter Century Secret Rare"],
  ["ultrarare", "Ultra Rare"],
  ["ultrar", "Ultra Rare"],
  ["ultra r", "Ultra Rare"],
  ["secret rnm", "Secret Rare"],
  ["plat secr", "Platinum Secret Rare"],
  ["platinum sr", "Platinum Secret Rare"],
  ["plscr", "Platinum Secret Rare"],
  ["psr", "Platinum Secret Rare"],
  ["qcscr", "Quarter Century Secret Rare"],
  ["qcsr", "Quarter Century Secret Rare"],
  ["ultimaterare", "Ultimate Rare"],
  ["ultir", "Ultimate Rare"],
  ["umr", "Ultimate Rare"],
  ["utr", "Ultimate Rare"],
  ["secrare", "Secret Rare"],
  ["secr", "Secret Rare"],
  ["scr", "Secret Rare"],
  ["pmcr", "Prismatic Collector's Rare"],
  ["pmscr", "Prismatic Secret Rare"],
  ["pmur", "Prismatic Ultimate Rare"],
  ["gscr", "Gold Secret Rare"],
  ["pgr", "Premium Gold Rare"],
  ["slr", "Starlight Rare"],
  ["plat", "Platinum Secret Rare"],
  ["sec", "Secret Rare"],
  ["cr", "Collector's Rare"],
  ["sr", "Super Rare"],
  ["ur", "Ultra Rare"],
  ["gr", "Gold Rare"],
];

/** Vergleichsschluessel: klein, ohne Apostroph. */
export function rarityKey(name: string): string {
  return name.toLowerCase().replace(/[’'`]/g, "");
}

const boundary = (s: string) => new RegExp(`(?<![a-z0-9])${s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?![a-z0-9])`);

const NAME_PATTERNS = RARITY_NAMES.map((n) => [n, boundary(rarityKey(n))] as const);
const ALIAS_PATTERNS = ALIASES.map(([a, n]) => [n, boundary(a)] as const);

/** Seltenheitsname aus dem Angebotstitel, null wenn keiner erkennbar ist. */
export function rarityFromTitle(title: string): string | null {
  const t = rarityKey(title).replace(/\s+/g, " ");
  for (const [name, re] of NAME_PATTERNS) if (re.test(t)) return name;
  for (const [name, re] of ALIAS_PATTERNS) if (re.test(t)) return name;
  return null;
}

/** "RA01-DE066" -> { prefix: "RA01", number: "066" }; "LAVD-DEL23" -> { "LAVD", "L23" }. */
export function parseSetCode(setCode: string): { prefix: string; number: string } | null {
  const m = setCode.toUpperCase().match(/^([A-Z0-9]{2,5})-(?:DE|EN)([A-Z]?\d{2,3})$/);
  return m ? { prefix: m[1], number: m[2] } : null;
}

/**
 * Titel-Seltenheit -> Namen, unter denen sie in der Zuordnung stehen koennte. In den
 * Rarity-Collection-Sets (RA01-RA05) heisst die Ultimate Rare bei Cardcluster
 * "Prismatic Ultimate Rare", Chris schreibt "Ultimate Rare"; ebenso bei Secret/Collector's.
 * Die genaue Schreibweise gewinnt, die prismatische ist nur der Rueckfall.
 */
export function rarityCandidates(name: string): string[] {
  const out = [name];
  if (name === "Ultimate Rare" || name === "Secret Rare" || name === "Collector's Rare") out.push(`Prismatic ${name}`);
  return out;
}

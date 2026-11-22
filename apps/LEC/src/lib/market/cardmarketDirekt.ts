import data from "./cardmarketDirekt.json";
import { parseSetCode, rarityCandidates, rarityKey } from "./rarity";

/**
 * Direktlinks auf die Cardmarket-Produktseite einer bestimmten Seltenheit (Chris, 22.11.2026), siehe
 * scripts/build-cardmarket-direktlinks.ts. Nur fuer die Rarity-Collection-Sets RA01-RA05; sonst null.
 */
interface DirektData {
  expansionen: Record<string, string>;
  links: Record<string, Record<string, string>>;
}
const DATA = data as unknown as DirektData;

/** Cardmarket-Schreibweise eines Produktnamens in der Adresse: Apostroph und & entfallen, Leerzeichen werden zu Bindestrichen.
 * null bei anderen Sonderzeichen (Verhalten dort ungeprueft: dann lieber die Suche). */
export function cardmarketNameSlug(name: string): string | null {
  if (!/^[A-Za-z0-9 '’&-]+$/.test(name)) return null;
  const s = name.replace(/['’]/g, "").replace(/&/g, " ").trim().split(/\s+/).join("-").replace(/-{2,}/g, "-");
  return s.length > 0 ? s : null;
}

/** "prismatic collectors rare" -> "Prismatic-Collectors-Rare". */
export function cardmarketRaritySlug(key: string): string {
  return key
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

/** Pfad hinter /de/YuGiOh/Products/Singles/ oder null, wenn kein sicherer Direktlink bekannt ist. */
export function cardmarketDirektPfad(setCode: string | null | undefined, rarity: string | null | undefined): string | null {
  if (!setCode || !rarity) return null;
  const parsed = parseSetCode(setCode);
  if (!parsed) return null;
  const exp = DATA.expansionen[parsed.prefix];
  const card = DATA.links[`${parsed.prefix}-${parsed.number}`];
  if (!exp || !card) return null;
  for (const cand of rarityCandidates(rarity)) {
    const slug = card[rarityKey(cand)];
    if (slug) return `${exp}/${slug}`;
  }
  return null;
}

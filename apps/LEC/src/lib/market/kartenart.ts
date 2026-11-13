/**
 * Kartenart und Ordner (Chris, 13.11.2026): Chris sortiert seine Einzelkarten in Ordner:
 *   1. Starlight, Platinum, Ultimate, Collector's (teuerste Seltenheiten, eigener Ordner)
 *   2. Secret-Monster
 *   3. farbige Monster: Synchro (weiß), Xyz (schwarz), Fusion (lila), Link (blau), Ritual (hellblau), Pendel
 *   4. alle übrigen Monster, Ultra Rare bis Common
 *   5. Zauber und Fallen, nach Seltenheit
 * Die Kartenart kommt aus YGOPRODeck (Feld `type`), die Seltenheit aus dem Titel.
 */

export type Kartenart = "Synchro" | "Xyz" | "Fusion" | "Link" | "Ritual" | "Pendel" | "Normal" | "Effekt" | "Zauber" | "Falle" | "Sonstige";

export const KARTENART_FARBE: Record<Kartenart, string> = {
  Synchro: "weiß",
  Xyz: "schwarz",
  Fusion: "lila",
  Link: "blau",
  Ritual: "hellblau",
  Pendel: "grün",
  Normal: "gelb",
  Effekt: "orange",
  Zauber: "grün (Zauber)",
  Falle: "pink (Falle)",
  Sonstige: "",
};

/** YGOPRODeck-`type` ("Synchro Tuner Monster", "Spell Card" ...) -> Kartenart; null ohne Angabe. */
export function kartenartOf(type: string | null | undefined): Kartenart | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes("spell")) return "Zauber";
  if (t.includes("trap")) return "Falle";
  if (t.includes("synchro")) return "Synchro";
  if (t.includes("xyz")) return "Xyz";
  if (t.includes("fusion")) return "Fusion";
  if (t.includes("link")) return "Link";
  if (t.includes("ritual")) return "Ritual";
  if (t.includes("pendulum")) return "Pendel";
  if (t.includes("normal")) return "Normal";
  if (t.includes("monster")) return "Effekt";
  return "Sonstige";
}

export const ORDNER = {
  hoch: "1 · Starlight / Platinum / Ultimate / Collector's",
  secretMonster: "2 · Secret-Monster",
  farbig: "3 · Farbige Monster (Synchro, Xyz, Fusion, Link, Ritual, Pendel)",
  monster: "4 · Monster Ultra Rare bis Common",
  zf: "5 · Zauber & Fallen",
} as const;
export type Ordner = (typeof ORDNER)[keyof typeof ORDNER];

const HOCH = /(starlight|platinum|ultimate|collector|ghost|grand master)/i;
const SECRET = /secret/i;
const FARBIG: Kartenart[] = ["Synchro", "Xyz", "Fusion", "Link", "Ritual", "Pendel"];

/** Ordner nach Chris' Reihenfolge; null, wenn die Kartenart noch unbekannt ist und die Seltenheit allein nicht reicht. */
export function ordnerOf(rarity: string | null, art: Kartenart | null): Ordner | null {
  if (rarity && HOCH.test(rarity)) return ORDNER.hoch;
  if (art === "Zauber" || art === "Falle") return ORDNER.zf;
  if (!art) return null;
  if (rarity && SECRET.test(rarity)) return ORDNER.secretMonster;
  if (FARBIG.includes(art)) return ORDNER.farbig;
  return ORDNER.monster;
}

/**
 * SCOUTING-NEBEL DES TRANSFERMARKTS (Chris, 18.11.): „Für nicht (voll) gescoutete Spieler sieht man nur grobe
 * Bereiche. Sortieren und Filtern dürfen keine verdeckten Werte verraten.“
 *
 * Dieses Modul ist die EINE Stelle, an der aus einem Feed-Eintrag (`TransfermarktFreeAgentItem`) die SICHTBARE
 * Sicht auf einen Spieler gebaut wird. Alles, was die neue Markt-Seite anzeigt, sortiert oder filtert, liest
 * ausschließlich diese Sicht — nie `item.pow`, `item.powTier`, die wahren Disziplin-Ratings oder sonst ein Feld, das
 * der Feed aus technischen Gründen mitschickt. Die Sicht trägt deshalb auch keinen Verweis auf den Feed-Eintrag.
 *
 * Quellen des Nebels (nichts davon ist neu erfunden, es wird nur zusammengeführt):
 *  - `buildScoutedDisciplineTiers` (transfermarkt-scouting.ts): je Disziplin eine gestörte Schätzung, deterministisch
 *    je Spielstand und Spieler, Rauschen schrumpft mit der Scouting-Stufe, ab Stufe 5 exakt. Der Lesedienst schickt
 *    sie für alle 20 Disziplinen als `disciplineEstimates`.
 *  - `getScoutingTierWindow`: Achsen und Attribute als Tier-Bereich („B-C"), exakt erst bei hoher Sicherheit.
 *  - `buildTransfermarktScoutedAttributeRows`: welche der zwölf Attribute überhaupt aufgedeckt sind.
 *
 * Sortieren und Gleichstände: Schlüssel ist die MITTE der sichtbaren Spanne; bei Gleichstand entscheidet der Name
 * (und danach die Spieler-Id), nie ein wahrer Wert.
 */
import {
  buildTransfermarktScoutedAttributeRows,
  getScoutingTierWindow,
  normalizeTransfermarktScoutingLevel,
  resolveScoutingConfidenceFromLevel,
  TRANSFERMARKT_SCOUT_TIER_ORDER,
  type TransfermarktAttributeKey,
  type TransfermarktAttributeRatings,
} from "@/lib/market/transfermarkt-scouting";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import type { TransfermarktRatingTier } from "@/lib/market/transfermarkt-sheet-stats";
import {
  officialDisciplineWeightMatrix,
  type OfficialDisciplineWeightId,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";

export type MarktAchse = "pow" | "spe" | "men" | "soc";
export const MARKT_ACHSEN: MarktAchse[] = ["pow", "spe", "men", "soc"];

/** Halbe Breite der sichtbaren Spanne je Scouting-Stufe 0..5 (Summe aus gemeinsamer Verzerrung und Einzelrauschen). */
const SPANNE_HALB_JE_STUFE = [11.5, 8.5, 6.25, 4, 2, 0] as const;

export type SichtWert = {
  /** Die sichtbare Schätzung (Mitte der Spanne). `null`: nichts bekannt. */
  schaetzung: number | null;
  von: number | null;
  bis: number | null;
  /** Ab Scouting-Stufe 5 ist die Schätzung der wahre Wert. */
  exakt: boolean;
};

export type SichtAchse = {
  achse: MarktAchse;
  /** „B-C" oder exakt „B"; `null`: verdeckt. */
  anzeige: string | null;
  /** Sortierschlüssel 0..7 (Mitte des sichtbaren Tier-Bereichs), `null` = verdeckt. */
  sortWert: number | null;
  exakt: boolean;
};

export type SichtAttribut = {
  key: TransfermarktAttributeKey;
  label: string;
  aufgedeckt: boolean;
  /** Anzeige: exakte Note, Bereich („C-D") oder `null` (verdeckt). */
  anzeige: string | null;
  /** Balkenfüllung 0..100 aus der sichtbaren Note, `null` = verdeckt. */
  prozent: number | null;
  exakt: boolean;
};

export type SpielerSicht = {
  playerId: string;
  name: string;
  stufe: number;
  exakt: boolean;
  disziplinen: Record<string, SichtWert>;
  achsen: Record<MarktAchse, SichtAchse>;
  attribute: Record<string, SichtAttribut>;
};

export function spannenHalbbreite(stufe: number | null | undefined): number {
  return SPANNE_HALB_JE_STUFE[normalizeTransfermarktScoutingLevel(stufe)] ?? SPANNE_HALB_JE_STUFE[0];
}

export function baueSichtWert(schaetzung: number | null | undefined, stufe: number | null | undefined): SichtWert {
  if (typeof schaetzung !== "number" || !Number.isFinite(schaetzung)) {
    return { schaetzung: null, von: null, bis: null, exakt: false };
  }
  const halb = spannenHalbbreite(stufe);
  if (halb === 0) {
    return { schaetzung, von: schaetzung, bis: schaetzung, exakt: true };
  }
  return {
    schaetzung,
    von: Math.max(0, Math.round(schaetzung - halb)),
    bis: Math.min(100, Math.round(schaetzung + halb)),
    exakt: false,
  };
}

const TIER_INDEX = new Map<string, number>(TRANSFERMARKT_SCOUT_TIER_ORDER.map((tier, index) => [tier, index]));

/** Tier-Bereich → Sortierschlüssel (Mitte der Indizes). „B-C" → 3,5; „B" → 4. */
export function tierBereichSortWert(anzeige: string | null | undefined): number | null {
  if (!anzeige) return null;
  const teile = anzeige.split("-").filter(Boolean);
  // „S-S+" und „S+" enthalten selbst ein Minus-freies Plus; Trennung nur am Bindestrich zwischen den Noten.
  const indizes = teile.map((teil) => TIER_INDEX.get(teil)).filter((index): index is number => index != null);
  if (indizes.length === 0) return null;
  return indizes.reduce((summe, index) => summe + index, 0) / indizes.length;
}

function attributRatings(item: TransfermarktFreeAgentItem): TransfermarktAttributeRatings {
  return {
    power: item.powerRating,
    health: item.healthRating,
    stamina: item.staminaRating,
    speed: item.speedRating,
    dexterity: item.dexterityRating,
    intelligence: item.intelligenceRating,
    awareness: item.awarenessRating,
    determination: item.determinationRating,
    charisma: item.charismaRating,
    will: item.willRating,
    spirit: item.spiritRating,
    torment: item.tormentRating,
  };
}

function achseSicht(
  achse: MarktAchse,
  tier: TransfermarktRatingTier | null,
  sicherheit: number,
): SichtAchse {
  if (!tier) return { achse, anzeige: null, sortWert: null, exakt: false };
  const anzeige = getScoutingTierWindow(tier, sicherheit);
  return { achse, anzeige, sortWert: tierBereichSortWert(anzeige), exakt: !anzeige.includes("-") };
}

/**
 * Baut die sichtbare Sicht. Liest vom Feed-Eintrag nur Felder, die ohnehin für die Anzeige freigegeben sind
 * (Schätzungen, Tier-Bereiche nach Scouting-Stufe, aufgedeckte Attribute).
 */
export function baueSpielerSicht(item: TransfermarktFreeAgentItem): SpielerSicht {
  const stufe = normalizeTransfermarktScoutingLevel(item.scoutingLevel);
  const sicherheit = item.scoutingConfidence ?? resolveScoutingConfidenceFromLevel(stufe);

  const schaetzungen: Record<string, number> = {};
  for (const eintrag of item.topDisciplineScores ?? []) {
    if (typeof eintrag.displayedScore === "number") schaetzungen[eintrag.disciplineId] = eintrag.displayedScore;
  }
  Object.assign(schaetzungen, item.disciplineEstimates ?? {});
  const disziplinen: Record<string, SichtWert> = {};
  for (const [id, wert] of Object.entries(schaetzungen)) disziplinen[id] = baueSichtWert(wert, stufe);

  const achsen = {
    pow: achseSicht("pow", item.powTier, sicherheit),
    spe: achseSicht("spe", item.speTier, sicherheit),
    men: achseSicht("men", item.menTier, sicherheit),
    soc: achseSicht("soc", item.socTier, sicherheit),
  } satisfies Record<MarktAchse, SichtAchse>;

  const ratings = attributRatings(item);
  const reihen = buildTransfermarktScoutedAttributeRows({
    ratings,
    scoutingLevel: stufe,
    playerId: item.playerId,
  });
  const attribute: Record<string, SichtAttribut> = {};
  for (const reihe of reihen) {
    const anzeige = reihe.ratingLabel ?? reihe.rangeLabel ?? null;
    const sortWert = tierBereichSortWert(anzeige);
    attribute[reihe.key] = {
      key: reihe.key,
      label: reihe.label,
      aufgedeckt: reihe.revealed && anzeige != null,
      anzeige: reihe.revealed ? anzeige : null,
      prozent: sortWert == null ? null : Math.round(((sortWert + 1) / TRANSFERMARKT_SCOUT_TIER_ORDER.length) * 100),
      exakt: reihe.revealed && reihe.ratingLabel != null,
    };
  }

  return {
    playerId: item.playerId,
    name: item.name,
    stufe,
    exakt: stufe >= 5,
    disziplinen,
    achsen,
    attribute,
  };
}

// ---------------------------------------------------------------------------------------------
// Sortieren und Filtern: nur über die Sicht
// ---------------------------------------------------------------------------------------------

export function vergleicheNachSicht(
  links: { sicht: SpielerSicht; schluessel: number | null },
  rechts: { sicht: SpielerSicht; schluessel: number | null },
  richtung: 1 | -1 = -1,
): number {
  const l = links.schluessel;
  const r = rechts.schluessel;
  // Unbekannte Werte immer ans Ende, unabhängig von der Richtung.
  if (l == null && r != null) return 1;
  if (l != null && r == null) return -1;
  if (l != null && r != null && l !== r) return (l - r) * richtung;
  // Gleichstand: Name, dann Id. NIE ein wahrer Wert.
  const nach = links.sicht.name.localeCompare(rechts.sicht.name, "de", { sensitivity: "base" });
  return nach !== 0 ? nach : links.sicht.playerId.localeCompare(rechts.sicht.playerId);
}

/** Sortiert beliebige Zeilen nach einem Schlüssel, der AUS DER SICHT kommt. Stabil, ohne wahren Wert. */
export function sortiereNachSicht<T extends { sicht: SpielerSicht }>(
  zeilen: readonly T[],
  schluessel: (zeile: T) => number | null,
  richtung: 1 | -1 = -1,
): T[] {
  return [...zeilen]
    .map((zeile) => ({ zeile, sicht: zeile.sicht, schluessel: schluessel(zeile) }))
    .sort((a, b) => vergleicheNachSicht(a, b, richtung))
    .map((eintrag) => eintrag.zeile);
}

/** Mindestwert in einer Disziplin: nur die OBERE Grenze der sichtbaren Spanne zählt („könnte reichen"). */
export function erfuelltEignungsMinimum(sicht: SpielerSicht, disziplinId: string, minimum: number): boolean {
  const wert = sicht.disziplinen[disziplinId];
  if (!wert || wert.bis == null) return false;
  return wert.bis >= minimum;
}

export function erfuelltAchsenMinimum(sicht: SpielerSicht, achse: MarktAchse, mindestTierIndex: number): boolean {
  const sortWert = sicht.achsen[achse].sortWert;
  if (sortWert == null) return false;
  return Math.ceil(sortWert) >= mindestTierIndex;
}

// ---------------------------------------------------------------------------------------------
// Erwartete PP (Näherung) und Wege zum Erfolg
// ---------------------------------------------------------------------------------------------

/** Obergrenze der Skala: Top-Spieler liegen um 5 PP je Disziplin und Spieltag (CLAUDE.md, Player Points). */
export const PP_SKALA_MAX = 5;
const PP_EIGNUNG_NULL = 28;
const PP_EIGNUNG_PRO_PUNKT = 12.5;

/**
 * NÄHERUNG: Eignung → erwartete PP je Einsatz. Dieselbe Gerade wie im Mockup (Eignung 28 → 0, 90 → 5), weil die echte
 * Umrechnung aus den PP-Referenzen noch nicht gebaut ist (docs/design/transfermarkt-modern-18-11.md, Abschnitt 3).
 * Wird in der Oberfläche mit „≈" gezeigt.
 */
export function erwartetePp(eignung: number | null | undefined): number | null {
  if (typeof eignung !== "number" || !Number.isFinite(eignung)) return null;
  return Math.max(0, Math.min(PP_SKALA_MAX, (eignung - PP_EIGNUNG_NULL) / PP_EIGNUNG_PRO_PUNKT));
}

export type PpSpanne = { von: number; bis: number; mitte: number; exakt: boolean };

export function erwartetePpSpanne(wert: SichtWert | null | undefined): PpSpanne | null {
  if (!wert || wert.schaetzung == null || wert.von == null || wert.bis == null) return null;
  const von = erwartetePp(wert.von);
  const bis = erwartetePp(wert.bis);
  const mitte = erwartetePp(wert.schaetzung);
  if (von == null || bis == null || mitte == null) return null;
  return { von, bis, mitte, exakt: wert.exakt };
}

export type WegZeile = {
  attribut: PlayerGeneratorAttributeKey;
  gewicht: number;
  sicht: SichtAttribut | null;
};

export type WegUrteil = {
  art: "primaer" | "neben" | "kein" | "offen";
  titel: string;
  text: string;
};

const WEG_ZEILEN = 5;
/** Ab diesem Tier-Index (B = 4) gilt ein Attribut als tragfähig. */
const WEG_TRAGFAEHIG_AB = 3.5;

export function bauWege(sicht: SpielerSicht, disziplinId: string): { zeilen: WegZeile[]; urteil: WegUrteil } {
  const gewichte = officialDisciplineWeightMatrix[disziplinId as OfficialDisciplineWeightId] ?? {};
  const zeilen: WegZeile[] = (Object.entries(gewichte) as Array<[PlayerGeneratorAttributeKey, number]>)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, WEG_ZEILEN)
    .map(([attribut, gewicht]) => ({ attribut, gewicht, sicht: sicht.attribute[attribut] ?? null }));

  const wert = (zeile: WegZeile) => (zeile.sicht?.aufgedeckt ? tierBereichSortWert(zeile.sicht.anzeige) : null);
  const bekannt = zeilen.filter((zeile) => wert(zeile) != null);
  const primaer = zeilen[0];
  const primaerWert = primaer ? wert(primaer) : null;

  let urteil: WegUrteil;
  if (zeilen.length === 0) {
    urteil = { art: "offen", titel: "offen", text: "Für diese Disziplin liegen keine Matrixgewichte vor." };
  } else if (primaerWert != null && primaerWert >= WEG_TRAGFAEHIG_AB) {
    urteil = { art: "primaer", titel: "Primärweg", text: "Das schwerste Attribut der Disziplin trägt ihn." };
  } else if (bekannt.some((zeile) => zeile !== primaer && (wert(zeile) ?? 0) >= WEG_TRAGFAEHIG_AB)) {
    urteil = { art: "neben", titel: "Nebenweg", text: "Nicht über das schwerste Attribut, aber über ein anderes der Matrix." };
  } else if (bekannt.length < zeilen.length && bekannt.length < 3) {
    urteil = {
      art: "offen",
      titel: "offen",
      text: "Zu wenige Attribute aufgedeckt, um einen Weg zu beurteilen. Scouten schärft das Bild.",
    };
  } else {
    urteil = { art: "kein", titel: "kein Weg", text: "Keines der schweren Attribute trägt ihn in dieser Disziplin." };
  }
  return { zeilen, urteil };
}

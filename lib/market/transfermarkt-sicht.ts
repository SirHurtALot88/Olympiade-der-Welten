/**
 * SCOUTING-NEBEL DES TRANSFERMARKTS (Chris, 18.11.): „Für nicht (voll) gescoutete Spieler sieht man nur grobe
 * Bereiche. Sortieren und Filtern dürfen keine verdeckten Werte verraten.“ Danach (Koordination, 18.11.): FESTE STUFEN
 * statt Spanne um den wahren Wert, wie im Kader-&-Teams-Mockup (10er-Stufe unbekannt, 5er-Stufe beobachtet, exakt gescoutet).
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
 *  - Achsen und Attribute: ungescoutet nur als Zweier-Gruppe („B–A“), sonst als Note; Zahlen gibt es für sie nie.
 *  - `buildTransfermarktScoutedAttributeRows`: welche der zwölf Attribute überhaupt aufgedeckt sind.
 *
 * Sortieren und Gleichstände: Schlüssel ist die MITTE der sichtbaren Stufe (für alle Spieler einer Stufe gleich); bei
 * Gleichstand entscheidet der Name
 * (und danach die Spieler-Id), nie ein wahrer Wert.
 */
import {
  buildTransfermarktScoutedAttributeRows,
  normalizeTransfermarktScoutingLevel,
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

/**
 * FESTE STUFEN STATT SPANNE UM DEN WAHREN WERT (Chris/Koordination, 18.11.): wer ungescoutet nach Stärke sortieren
 * könnte, fände den perfekten Spieler zu leicht. Darum gilt wie im Kader-&-Teams-Mockup:
 *   Stufe 0 (unbekannt):                10er-Stufe („90–99“), Achsen/Attribute in Zweier-Gruppen („B–A“)
 *   Stufe 1–4 (beobachtet/teilweise):   5er-Stufe („85–89“), Achsen/Attribute als Note („B“)
 *   Stufe 5 (gescoutet):                exakt
 * Angezeigt wird immer die Stufe, nie „~Zahl“. Alle Spieler einer Stufe sind für Sortieren und Filtern gleich; die
 * Reihenfolge innerhalb einer Stufe entscheidet der Name.
 */
export type SichtArt = "grob" | "fein" | "exakt";

export type SichtWert = {
  /** Mitte der Stufe (für alle Spieler einer Stufe gleich) bzw. der exakte Wert. `null`: nichts bekannt. */
  schaetzung: number | null;
  /** Untere und obere Grenze der Stufe (bei exakt gleich dem Wert). */
  von: number | null;
  bis: number | null;
  exakt: boolean;
  art: SichtArt | null;
  /** Anzeige: „90–99“, „85–89“ oder „88“. */
  text: string;
};

export type SichtAchse = {
  achse: MarktAchse;
  /** „B–A“ (unbekannt), „B“ (beobachtet/gescoutet); `null`: verdeckt. */
  anzeige: string | null;
  /** Sortierschlüssel 0..7 (Mitte der Stufe), `null` = verdeckt. */
  sortWert: number | null;
  exakt: boolean;
};

export type SichtAttribut = {
  key: TransfermarktAttributeKey;
  label: string;
  aufgedeckt: boolean;
  /** Anzeige: Note („B“) bzw. Zweier-Gruppe („B–A“) oder `null` (verdeckt). */
  anzeige: string | null;
  /** Balkenfüllung 0..100 aus der sichtbaren Stufe, `null` = verdeckt. */
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

/** Breite der Eignungs-Stufe: 10 ungescoutet, 5 beobachtet, 1 (exakt) bei Stufe 5. */
export function stufenBreite(stufe: number | null | undefined): number {
  const s = normalizeTransfermarktScoutingLevel(stufe);
  return s >= 5 ? 1 : s === 0 ? 10 : 5;
}

export function baueSichtWert(schaetzung: number | null | undefined, stufe: number | null | undefined): SichtWert {
  if (typeof schaetzung !== "number" || !Number.isFinite(schaetzung)) {
    return { schaetzung: null, von: null, bis: null, exakt: false, art: null, text: "?" };
  }
  const breite = stufenBreite(stufe);
  const wert = Math.max(0, Math.min(99, Math.round(schaetzung)));
  if (breite === 1) {
    return { schaetzung: wert, von: wert, bis: wert, exakt: true, art: "exakt", text: String(wert) };
  }
  const von = Math.floor(wert / breite) * breite;
  const bis = Math.min(99, von + breite - 1);
  return { schaetzung: (von + bis) / 2, von, bis, exakt: false, art: breite === 10 ? "grob" : "fein", text: `${von}–${bis}` };
}

const TIER_INDEX = new Map<string, number>(TRANSFERMARKT_SCOUT_TIER_ORDER.map((tier, index) => [tier, index]));

const TIER_GRUPPEN = ["F–E", "D–C", "B–A", "S–S+"] as const;

/** Note → Sortierschlüssel 0..7. Gruppe („B–A“) → Mitte der beiden Noten. */
export function tierBereichSortWert(anzeige: string | null | undefined): number | null {
  if (!anzeige) return null;
  const teile = anzeige.split("–").filter(Boolean);
  const indizes = teile.map((teil) => TIER_INDEX.get(teil)).filter((index): index is number => index != null);
  if (indizes.length === 0) return null;
  return indizes.reduce((summe, index) => summe + index, 0) / indizes.length;
}

/** Eine Note unter dem Nebel: ungescoutet nur die Zweier-Gruppe, sonst die Note selbst. */
function tierAnzeige(tier: TransfermarktRatingTier | null | undefined, stufe: number): string | null {
  if (!tier) return null;
  if (stufe >= 1) return tier;
  const index = TIER_INDEX.get(tier);
  return index == null ? null : TIER_GRUPPEN[Math.floor(index / 2)];
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

function achseSicht(achse: MarktAchse, tier: TransfermarktRatingTier | null, stufe: number): SichtAchse {
  const anzeige = tierAnzeige(tier, stufe);
  return { achse, anzeige, sortWert: tierBereichSortWert(anzeige), exakt: stufe >= 1 };
}

/**
 * Baut die sichtbare Sicht. Liest vom Feed-Eintrag nur Felder, die ohnehin für die Anzeige freigegeben sind
 * (Schätzungen, Tier-Bereiche nach Scouting-Stufe, aufgedeckte Attribute).
 */
export function baueSpielerSicht(item: TransfermarktFreeAgentItem, optionen?: { nebelAus?: boolean }): SpielerSicht {
  // Nebel aus (Einstellung): jeder Spieler zählt als voll gescoutet, die Sicht zeigt exakte Werte.
  const stufe = optionen?.nebelAus ? 5 : normalizeTransfermarktScoutingLevel(item.scoutingLevel);

  const schaetzungen: Record<string, number> = {};
  for (const eintrag of item.topDisciplineScores ?? []) {
    if (typeof eintrag.displayedScore === "number") schaetzungen[eintrag.disciplineId] = eintrag.displayedScore;
  }
  Object.assign(schaetzungen, item.disciplineEstimates ?? {});
  const disziplinen: Record<string, SichtWert> = {};
  for (const [id, wert] of Object.entries(schaetzungen)) disziplinen[id] = baueSichtWert(wert, stufe);

  const achsen = {
    pow: achseSicht("pow", item.powTier, stufe),
    spe: achseSicht("spe", item.speTier, stufe),
    men: achseSicht("men", item.menTier, stufe),
    soc: achseSicht("soc", item.socTier, stufe),
  } satisfies Record<MarktAchse, SichtAchse>;

  const ratings = attributRatings(item);
  const reihen = buildTransfermarktScoutedAttributeRows({
    ratings,
    scoutingLevel: Math.min(stufe, 4),
    playerId: item.playerId,
  });
  const attribute: Record<string, SichtAttribut> = {};
  for (const reihe of reihen) {
    // Welche Attribute aufgedeckt sind, bestimmt der bestehende Aufdeck-Plan; die ANZEIGE kennt nur Stufen.
    const anzeige = reihe.revealed ? tierAnzeige(ratings[reihe.key], stufe) : null;
    const sortWert = tierBereichSortWert(anzeige);
    attribute[reihe.key] = {
      key: reihe.key,
      label: reihe.label,
      aufgedeckt: anzeige != null,
      anzeige,
      prozent: sortWert == null ? null : Math.round(((sortWert + 1) / TRANSFERMARKT_SCOUT_TIER_ORDER.length) * 100),
      exakt: anzeige != null && stufe >= 1,
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

export type PpSpanne = { von: number; bis: number; mitte: number; exakt: boolean; text: string };

const halbe = (x: number) => Math.round(x * 2) / 2;

/** PP-Anzeige GROB: unter dem Nebel auf halbe Punkte gerundet („≈ 4–5“), exakt erst ab Stufe 5. */
export function erwartetePpSpanne(wert: SichtWert | null | undefined): PpSpanne | null {
  if (!wert || wert.schaetzung == null || wert.von == null || wert.bis == null) return null;
  const von = erwartetePp(wert.von);
  const bis = erwartetePp(wert.bis);
  const mitte = erwartetePp(wert.schaetzung);
  if (von == null || bis == null || mitte == null) return null;
  const f = (x: number) => x.toFixed(1).replace(".", ",");
  if (wert.exakt) return { von, bis, mitte, exakt: true, text: `≈ ${f(mitte)}` };
  const a = halbe(von);
  const b = halbe(bis);
  return { von: a, bis: b, mitte: halbe(mitte), exakt: false, text: a === b ? `≈ ${f(a)}` : `≈ ${f(a)}–${f(b)}` };
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

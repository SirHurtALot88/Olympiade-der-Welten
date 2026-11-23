/**
 * AUSRUESTUNG: WUERFEL (Phase 1a, 22.11.). Affixe, Namen und Truhen-Funde.
 *
 * ALLES AUS DER SAAT DES SPIELSTANDS, NIE AUS DEM LADEN: jede Wuerfel-Eingabe ist Text aus `saat` (einmal beim Anlegen des
 * Ausruestungs-Spielstands festgelegt), Team-ID und dem Kistenzaehler des Teams. Ein Neuladen der Seite, ein zweiter Klick
 * oder ein Zuruecksetzen der Ansicht liefert dieselben Funde (Konzept §61: „kein Neuladen fuer bessere Werte“). Die Funde
 * einer Kiste werden ausserdem VOR der Wahl im Spielstand gespeichert (`TeamAusruestung.offeneKiste`).
 *
 * Der Generator ist ein 32-Bit-Mulberry, gespeist von einem Text-Hash. Rein, ohne `Math.random`.
 */
import {
  AFFIX_ARTEN_QUOTE,
  AUSRUESTUNG_ATTRIBUTE,
  ATTRIBUT_BEINAME,
  BEVORZUGT_ANTEIL,
  DISZIPLIN_IDS,
  EINGESCHRAENKT_FAKTOR,
  EINGESCHRAENKT_FARBE_ANTEIL,
  FAMILIEN,
  FAMILIE_BY_ID,
  MATERIALIEN,
  STUFEN,
  TRUHEN,
  WENIGER_AFFIX_ANTEIL,
  ZWEISCHNEIDIG_FAKTOR,
  ZWEISCHNEIDIG_MALUS_ANTEIL,
} from "@/lib/ausruestung/ausruestung-katalog";
import type {
  Affix,
  AusruestungAttribut,
  DisziplinFarbe,
  FamilieId,
  Fund,
  PflegeAffix,
  Seltenheit,
  Teil,
  TruhenArt,
} from "@/lib/ausruestung/ausruestung-typen";

export type Rng = () => number;

/** FNV-1a ueber den Text, danach ein Mulberry32: deterministisch, gleichverteilt genug fuer Spielwuerfel. */
export function erzeugeRng(saatText: string): Rng {
  let h = 2166136261;
  for (let i = 0; i < saatText.length; i += 1) {
    h ^= saatText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ganz(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function waehle<T>(rng: Rng, liste: readonly T[]): T {
  return liste[Math.min(liste.length - 1, Math.floor(rng() * liste.length))]!;
}

const PFLEGE_ARTEN: readonly PflegeAffix[] = ["robust", "pflegeleicht", "leicht"];
const FARBEN: readonly DisziplinFarbe[] = ["pow", "spe", "men", "soc"];

function waehleAttribut(rng: Rng, familie: FamilieId, belegt: ReadonlySet<AusruestungAttribut>): AusruestungAttribut {
  const bevorzugt = FAMILIE_BY_ID[familie].bevorzugt;
  const uebrige = AUSRUESTUNG_ATTRIBUTE.filter((a) => !bevorzugt.includes(a));
  // Bis zu sechs Versuche, ein Attribut zu treffen, das der Gegenstand noch nicht traegt; sonst ist jedes frei genug.
  for (let versuch = 0; versuch < 6; versuch += 1) {
    const aus = rng() < BEVORZUGT_ANTEIL ? bevorzugt : uebrige;
    const a = waehle(rng, aus);
    if (!belegt.has(a)) return a;
  }
  return waehle(rng, AUSRUESTUNG_ATTRIBUTE.filter((a) => !belegt.has(a)));
}

/** Wuerfelt die Affixe eines Teils (Konzept §60/§61, Quoten Bauplan C7). Das erste Affix ist immer ein Attribut-Affix. */
export function wuerfleAffixe(rng: Rng, familie: FamilieId, seltenheit: Seltenheit): Affix[] {
  const regel = STUFEN[seltenheit];
  let anzahl = regel.affixe;
  if (anzahl > 1 && rng() < WENIGER_AFFIX_ANTEIL) anzahl -= 1;
  const affixe: Affix[] = [];
  const belegt = new Set<AusruestungAttribut>();
  const pflegeBelegt = new Set<PflegeAffix>();
  for (let i = 0; i < anzahl; i += 1) {
    const r = rng();
    const hoeher = seltenheit !== "standard";
    if (hoeher && i > 0 && r < AFFIX_ARTEN_QUOTE.pflege) {
      const frei = PFLEGE_ARTEN.filter((p) => !pflegeBelegt.has(p));
      if (frei.length > 0) {
        const p = waehle(rng, frei);
        pflegeBelegt.add(p);
        affixe.push({ art: "pflege", pflege: p });
        continue;
      }
    }
    const attribut = waehleAttribut(rng, familie, belegt);
    belegt.add(attribut);
    const basis = ganz(rng, regel.wertMin, regel.wertMax);
    // Eingeschraenkt (ab Selten) liegt zwischen Pflege und Zweischneidig; ohne dieses Fenster rutscht die Masse auf "normal".
    const eingeschraenktGrenze = AFFIX_ARTEN_QUOTE.pflege + AFFIX_ARTEN_QUOTE.eingeschraenkt;
    const zweischneidigGrenze = eingeschraenktGrenze + AFFIX_ARTEN_QUOTE.zweischneidig;
    if (hoeher && r >= AFFIX_ARTEN_QUOTE.pflege && r < eingeschraenktGrenze) {
      const nur = rng() < EINGESCHRAENKT_FARBE_ANTEIL ? { farbe: waehle(rng, FARBEN) } : { disziplin: waehle(rng, DISZIPLIN_IDS) };
      affixe.push({ art: "attribut", attribut, wert: Math.round(basis * EINGESCHRAENKT_FAKTOR), nur });
    } else if ((hoeher && r >= eingeschraenktGrenze && r < zweischneidigGrenze) || (!hoeher && r < AFFIX_ARTEN_QUOTE.zweischneidig)) {
      const wert = Math.round(basis * ZWEISCHNEIDIG_FAKTOR);
      const malusAttribut = waehle(rng, AUSRUESTUNG_ATTRIBUTE.filter((a) => a !== attribut));
      affixe.push({ art: "attribut", attribut, wert, malus: { attribut: malusAttribut, wert: -Math.max(1, Math.round(wert * ZWEISCHNEIDIG_MALUS_ANTEIL)) } });
    } else {
      affixe.push({ art: "attribut", attribut, wert: basis });
    }
  }
  return affixe;
}

/** Name: Stufenwort + Familie + Beiname nach dem groessten Attribut-Affix; Legendaere tragen ihren eigenen Namen. */
export function benenneTeil(familie: FamilieId, seltenheit: Seltenheit, affixe: readonly Affix[]): string {
  const f = FAMILIE_BY_ID[familie];
  if (seltenheit === "legendaer") return f.stufenwort.legendaer;
  let groesster: { attribut: AusruestungAttribut; wert: number } | null = null;
  for (const a of affixe) {
    if (a.art === "attribut" && (!groesster || a.wert > groesster.wert)) groesster = { attribut: a.attribut, wert: a.wert };
  }
  return `${f.stufenwort[seltenheit]} ${f.name}${groesster ? ` ${ATTRIBUT_BEINAME[groesster.attribut]}` : ""}`;
}

export function wuerfleTeil(rng: Rng, id: string, seltenheit: Seltenheit, herkunft: Teil["herkunft"], familie?: FamilieId): Teil {
  const fam = familie ?? waehle(rng, FAMILIEN).id;
  const affixe = wuerfleAffixe(rng, fam, seltenheit);
  return { id, familie: fam, seltenheit, name: benenneTeil(fam, seltenheit, affixe), affixe, herkunft };
}

export type FundKategorie = "material" | Seltenheit | "signatur";

export type Chancen = { material: number; standard: number; selten: number; episch: number; legendaer: number; signatur: number };

/**
 * Die wirksamen Chancen einer Truhe bei gegebenen erlaubten Stufen. Phase 1a (Bauplan C1): Truhen droppen nur Material, Standard
 * und Selten; Episch und Legendaer fallen in Selten, Signatur-Material in Material. Die Summe bleibt 100.
 */
export function wirksameChancen(truhe: TruhenArt, erlaubt: { episch: boolean; legendaer: boolean; signatur: boolean }): Chancen {
  const c = { ...TRUHEN[truhe].chancen };
  if (!erlaubt.episch) { c.selten += c.episch; c.episch = 0; }
  if (!erlaubt.legendaer) { c.selten += c.legendaer; c.legendaer = 0; }
  if (!erlaubt.signatur) { c.material += c.signatur; c.signatur = 0; }
  return c;
}

function wuerfleKategorie(rng: Rng, chancen: Chancen, nurAusruestung = false): FundKategorie {
  const reihenfolge: FundKategorie[] = nurAusruestung ? ["standard", "selten", "episch", "legendaer"] : ["material", "standard", "selten", "episch", "legendaer", "signatur"];
  const summe = reihenfolge.reduce((a, k) => a + chancen[k], 0);
  let wurf = rng() * summe;
  for (const k of reihenfolge) {
    wurf -= chancen[k];
    if (wurf < 0) return k;
  }
  return reihenfolge[reihenfolge.length - 1]!;
}

/**
 * Die drei Funde einer Kiste (Konzept §52): je Fund Material oder Ausruestung nach den Chancen der Truhe, mindestens einer ist
 * Ausruestung. `kisteNr` ist der Kistenzaehler des Teams VOR dem Oeffnen; er steckt in der Saat und in den Teil-IDs.
 */
export function wuerfleKistenFunde(
  saat: string,
  teamId: string,
  kisteNr: number,
  truhe: TruhenArt,
  chancen: Chancen,
): [Fund, Fund, Fund] {
  const rng = erzeugeRng(`${saat}|${teamId}|kiste|${kisteNr}|${truhe}`);
  const eintrag = TRUHEN[truhe];
  const herkunft: Teil["herkunft"] = { quelle: "truhe", truhe, kisteNr };
  const baue = (kategorie: FundKategorie, index: number): Fund => {
    if (kategorie === "material" || kategorie === "signatur") {
      return { art: "material", material: waehle(rng, MATERIALIEN), anzahl: eintrag.materialMenge };
    }
    return { art: "teil", teil: wuerfleTeil(rng, `${teamId}:k${kisteNr}:${index}`, kategorie, herkunft) };
  };
  const funde: Fund[] = [0, 1, 2].map((i) => baue(wuerfleKategorie(rng, chancen), i));
  if (!funde.some((f) => f.art === "teil")) {
    // Mindestens ein Fund ist Ausruestung: der letzte wird durch ein Teil ersetzt (Stufe nach den Chancen ohne Material).
    funde[2] = baue(wuerfleKategorie(rng, chancen, true), 2);
  }
  return funde as [Fund, Fund, Fund];
}

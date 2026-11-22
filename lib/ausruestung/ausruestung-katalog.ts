/**
 * AUSRUESTUNG: KATALOG (Phase 1a, 22.11.). Acht Familien, zwoelf Attribute, acht Materialien, drei Truhen.
 *
 * Quellen: Konzept docs/design/zwischen-den-spieltagen-22-11.md §41 (Materialien), §52 (Truhen), §58 (Lager), §59 (Familien),
 * §60 (Stufen), §61 (Affixe); Bauplan docs/design/ausruestung-pilot-bauplan-22-11.md Abschnitt C (Entscheidungen der PM).
 * Alle Zahlen sind STARTWERTE (Konzept §65 Frage 1), gemessen wird in Phase 2 (Siegquote je Stufe, Korridore im Bauplan).
 */
import {
  playerGeneratorAttributeKeys,
  officialDisciplineWeightOrder,
} from "@/lib/player-generator/official-discipline-weights";
import type {
  AusruestungAttribut,
  DisziplinFarbe,
  FamilieId,
  MaterialId,
  Seltenheit,
  TruhenArt,
} from "@/lib/ausruestung/ausruestung-typen";

export const AUSRUESTUNG_ATTRIBUTE: readonly AusruestungAttribut[] = playerGeneratorAttributeKeys;

export const ATTRIBUT_LABEL: Record<AusruestungAttribut, string> = {
  power: "Power",
  health: "Health",
  determination: "Determination",
  stamina: "Stamina",
  speed: "Speed",
  dexterity: "Dexterity",
  awareness: "Awareness",
  intelligence: "Intelligence",
  will: "Will",
  charisma: "Charisma",
  spirit: "Spirit",
  torment: "Torment",
};

/** Beinamen nach dem groessten Affix (Konzept §61): „Verzierter Plattenpanzer des Ochsen“. */
export const ATTRIBUT_BEINAME: Record<AusruestungAttribut, string> = {
  power: "des Bären",
  health: "des Ochsen",
  determination: "des Dachses",
  stamina: "des Wolfs",
  speed: "des Falken",
  dexterity: "der Katze",
  awareness: "des Luchses",
  intelligence: "der Eule",
  will: "des Mönchs",
  charisma: "des Pfaus",
  spirit: "des Phönix",
  torment: "des Henkers",
};

export const SELTENHEITEN: readonly Seltenheit[] = ["standard", "selten", "episch", "legendaer"];

export const SELTENHEIT_LABEL: Record<Seltenheit, string> = {
  standard: "Standard",
  selten: "Selten",
  episch: "Episch",
  legendaer: "Legendär",
};

export type StufenRegel = {
  /** Anzahl der Affixe (Obergrenze; ein Fund kommt mit 30 % Wahrscheinlichkeit mit einem weniger). */
  affixe: number;
  /** Wert je Affix, ganze Punkte, einschliesslich beider Grenzen. */
  wertMin: number;
  wertMax: number;
  /** Teile beim Zerlegen (Konzept §27). */
  zerlegenTeile: number;
};

export const STUFEN: Record<Seltenheit, StufenRegel> = {
  standard: { affixe: 1, wertMin: 2, wertMax: 3, zerlegenTeile: 1 },
  selten: { affixe: 2, wertMin: 3, wertMax: 5, zerlegenTeile: 2 },
  episch: { affixe: 3, wertMin: 4, wertMax: 6, zerlegenTeile: 4 },
  legendaer: { affixe: 4, wertMin: 5, wertMax: 8, zerlegenTeile: 8 },
};

/** Anteil der Funde, die mit einem Affix weniger als dem Hoechstwert kommen (Konzept §61), mindestens ein Affix bleibt. */
export const WENIGER_AFFIX_ANTEIL = 0.3;

/** Affix-Arten (Bauplan C7): je Affix 5 % Pflege, 15 % eingeschraenkt (beide ab Selten), 20 % zweischneidig, sonst normal (60 %). */
export const AFFIX_ARTEN_QUOTE = { pflege: 0.05, eingeschraenkt: 0.15, zweischneidig: 0.2 } as const;

/** Attributwahl (Konzept §59): 60 % der Affixe fallen auf die zwei bevorzugten Attribute der Familie, 40 % auf die uebrigen zehn. */
export const BEVORZUGT_ANTEIL = 0.6;

export const ZWEISCHNEIDIG_FAKTOR = 1.5;
export const ZWEISCHNEIDIG_MALUS_ANTEIL = 1 / 3;
export const EINGESCHRAENKT_FAKTOR = 1.5;
/** Von den eingeschraenkten Affixen gelten so viele fuer eine Disziplinfarbe; der Rest fuer eine einzelne Disziplin. */
export const EINGESCHRAENKT_FARBE_ANTEIL = 0.6;

export type FamilienEintrag = {
  id: FamilieId;
  name: string;
  /** Die zwei bevorzugten Attribute. */
  bevorzugt: readonly [AusruestungAttribut, AusruestungAttribut];
  material: MaterialId;
  /** Stufenwort je Seltenheit (Standard, Selten, Episch) und der eigene Name des Legendaeren. */
  stufenwort: Record<Seltenheit, string>;
};

export const FAMILIEN: readonly FamilienEintrag[] = [
  { id: "lederruestung", name: "Lederrüstung", bevorzugt: ["dexterity", "speed"], material: "leder", stufenwort: { standard: "Einfache", selten: "Verstärkte", episch: "Verzierte", legendaer: "Schattenhaut" } },
  { id: "plattenpanzer", name: "Plattenpanzer", bevorzugt: ["health", "power"], material: "eisen", stufenwort: { standard: "Einfacher", selten: "Verstärkter", episch: "Verzierter", legendaer: "Bollwerk" } },
  { id: "robe", name: "Robe", bevorzugt: ["intelligence", "will"], material: "rauchkraut", stufenwort: { standard: "Einfache", selten: "Verstärkte", episch: "Verzierte", legendaer: "Sternenrobe" } },
  { id: "handschuhe", name: "Handschuhe", bevorzugt: ["power", "dexterity"], material: "leder", stufenwort: { standard: "Einfache", selten: "Verstärkte", episch: "Verzierte", legendaer: "Titanenfäuste" } },
  { id: "schuhe", name: "Schuhe", bevorzugt: ["speed", "stamina"], material: "feder", stufenwort: { standard: "Einfache", selten: "Verstärkte", episch: "Verzierte", legendaer: "Siebenmeiler" } },
  { id: "helm", name: "Helm", bevorzugt: ["awareness", "determination"], material: "linse", stufenwort: { standard: "Einfacher", selten: "Verstärkter", episch: "Verzierter", legendaer: "Krone der Wachsamkeit" } },
  { id: "umhang", name: "Umhang", bevorzugt: ["charisma", "spirit"], material: "banner", stufenwort: { standard: "Einfacher", selten: "Verstärkter", episch: "Verzierter", legendaer: "Mantel des Phönix" } },
  { id: "amulett", name: "Amulett", bevorzugt: ["will", "torment"], material: "kristall", stufenwort: { standard: "Einfaches", selten: "Verstärktes", episch: "Verziertes", legendaer: "Herz der Qual" } },
];

export const FAMILIE_BY_ID: Record<FamilieId, FamilienEintrag> = Object.fromEntries(FAMILIEN.map((f) => [f.id, f])) as Record<FamilieId, FamilienEintrag>;

export const MATERIALIEN: readonly MaterialId[] = ["seil", "eisen", "feder", "linse", "rauchkraut", "kristall", "banner", "leder"];

export const MATERIAL_LABEL: Record<MaterialId, string> = {
  seil: "Seil",
  eisen: "Eisen",
  feder: "Feder",
  linse: "Linse",
  rauchkraut: "Rauchkraut",
  kristall: "Kristall",
  banner: "Banner",
  leder: "Leder",
};

/** Lager (Konzept §58): 16 Plaetze fuer Ausruestung UND Materialien. */
export const LAGER_PLAETZE = 16;
/** Ein Materialstapel fasst 10; der elfte Fund derselben Sorte wird zu einem Teil. Je Material genau ein Platz. */
export const MATERIAL_STAPEL_MAX = 10;
/** Hoechstens so viele Zeilen im Verlauf je Team. */
export const VERLAUF_MAX = 24;

/** Gold fuer Ruhm hoechstens alle fuenf Spieltage (Konzept §52). */
export const GOLD_ABSTAND_SPIELTAGE = 5;

export type TruhenEintrag = {
  art: TruhenArt;
  name: string;
  ruhm: number;
  /** Chancen je Fund in Prozent (Konzept §52); die Summe ist 100. */
  chancen: { material: number; standard: number; selten: number; episch: number; legendaer: number; signatur: number };
  /** Material je Fund: so viele Stueck eines Materials liegen in einem Material-Fund. */
  materialMenge: number;
};

export const TRUHEN: Record<TruhenArt, TruhenEintrag> = {
  holz: { art: "holz", name: "Holztruhe", ruhm: 10, chancen: { material: 45, standard: 40, selten: 13, episch: 2, legendaer: 0, signatur: 0 }, materialMenge: 2 },
  eisen: { art: "eisen", name: "Eisentruhe", ruhm: 20, chancen: { material: 30, standard: 28, selten: 28, episch: 12, legendaer: 2, signatur: 0 }, materialMenge: 2 },
  gold: { art: "gold", name: "Goldtruhe", ruhm: 45, chancen: { material: 15, standard: 10, selten: 35, episch: 28, legendaer: 7, signatur: 5 }, materialMenge: 3 },
};

export const TRUHEN_ARTEN: readonly TruhenArt[] = ["holz", "eisen", "gold"];

/** Ruhm je Duellpunkt (Bauplan C6: in Phase 1 nur Duellpunkte, erster Disziplinsieg des Spieltags und Platzierung). */
export const RUHM_JE_PUNKT = 1;
/** Platz 1 bis 3 zur Halbzeit und am Saisonende bringen eine Goldtruhe (Konzept §52). */
export const PLATZIERUNG_GOLD_BIS_PLATZ = 3;

/** Farbe je Disziplin (Konzept §14: POW/SPE/MEN/SOC), nach `RETOOL_DISCIPLINE_AXIS` auf die offiziellen Disziplin-IDs uebertragen. */
export const DISZIPLIN_FARBE: Record<string, DisziplinFarbe> = {
  tdm: "pow",
  "mini-dm": "pow",
  gewichtheben: "pow",
  hockey: "pow",
  breaking: "pow",
  staffel: "spe",
  "time-trial": "spe",
  spurt: "spe",
  climbing: "spe",
  fechten: "spe",
  "speed-schach": "men",
  "takeshis-castle": "men",
  tennis: "men",
  "i-spy": "men",
  wettessen: "men",
  basketball: "soc",
  football: "soc",
  battlefield: "soc",
  eiskunstlauf: "soc",
  showcase: "soc",
};

export const DISZIPLIN_IDS: readonly string[] = officialDisciplineWeightOrder;

export const FARBE_LABEL: Record<DisziplinFarbe, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };

export const DISZIPLIN_LABEL: Record<string, string> = {
  tdm: "TDM",
  "mini-dm": "Mini DM",
  battlefield: "Battlefield",
  gewichtheben: "Gewichtheben",
  climbing: "Climbing",
  staffel: "Staffel",
  "time-trial": "Time Trial",
  spurt: "Spurt",
  tennis: "Tennis",
  hockey: "Hockey",
  showcase: "Showcase",
  "speed-schach": "Speed-Schach",
  "takeshis-castle": "Takeshi",
  breaking: "Breaking",
  wettessen: "Wettessen",
  basketball: "Basketball",
  football: "Football",
  eiskunstlauf: "Eiskunstlauf",
  fechten: "Fechten",
  "i-spy": "I-Spy",
};

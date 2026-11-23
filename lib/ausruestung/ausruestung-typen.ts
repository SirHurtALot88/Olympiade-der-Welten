/**
 * AUSRUESTUNG: TYPEN (Phase 1a, 22.11., docs/design/ausruestung-pilot-bauplan-22-11.md, Konzept zwischen-den-spieltagen-22-11.md §§ 58-66).
 *
 * Besitz steht auf der OBERSTEN Ebene des Spielstands (`gameState.ausruestung`), je Team getrennt. Phase 1a kennt nur BESITZ:
 * Lager, Materialien, Teile, Ruhm, Truhen. Nichts davon beruehrt die Wertung (`wirkung: "keine"`).
 */
import type { PlayerGeneratorAttributeKey } from "@/lib/player-generator/official-discipline-weights";

export type AusruestungAttribut = PlayerGeneratorAttributeKey;

export type Seltenheit = "standard" | "selten" | "episch" | "legendaer";

export type FamilieId = "lederruestung" | "plattenpanzer" | "robe" | "handschuhe" | "schuhe" | "helm" | "umhang" | "amulett";

export type MaterialId = "seil" | "eisen" | "feder" | "linse" | "rauchkraut" | "kristall" | "banner" | "leder";

/** Die vier Disziplinfarben (Power, Speed, Mental, Social). */
export type DisziplinFarbe = "pow" | "spe" | "men" | "soc";

export type TruhenArt = "holz" | "eisen" | "gold";

export type PflegeAffix = "robust" | "pflegeleicht" | "leicht";

/** Ein Affix: `+X auf ein Attribut` (laeuft spaeter wie jeder Bonus durch die Matrix) oder ein Pflege-Affix. */
export type Affix =
  | {
      art: "attribut";
      attribut: AusruestungAttribut;
      wert: number;
      /** Zweischneidig: das Affix ist 1,5-mal so gross und zieht ein anderes Attribut herunter (Wert negativ). */
      malus?: { attribut: AusruestungAttribut; wert: number } | null;
      /** Eingeschraenkt: wirkt nur in einer Disziplinfarbe oder in einer einzelnen Disziplin, dafuer 1,5-mal so gross. */
      nur?: { farbe: DisziplinFarbe } | { disziplin: string } | null;
    }
  | { art: "pflege"; pflege: PflegeAffix };

/** Ein Ausruestungsteil im Lager. Teile sind eigene Gegenstaende mit Kennung, Materialien dagegen Stapel. */
export type Teil = {
  id: string;
  familie: FamilieId;
  seltenheit: Seltenheit;
  name: string;
  affixe: Affix[];
  /** Woher: Truhe (Art) oder Spielstart. Nur Anzeige und Verlauf. */
  herkunft: { quelle: "truhe"; truhe: TruhenArt; kisteNr: number } | { quelle: "start" };
};

export type MaterialStapel = { material: MaterialId; anzahl: number };

/** Ein belegter Lagerplatz: ein Teil oder ein Materialstapel. */
export type LagerPlatz = { art: "teil"; teil: Teil } | { art: "material"; stapel: MaterialStapel };

/** Ein Fund einer Truhe: Ausruestung oder Material. Vor der Wahl im Spielstand gespeichert. */
export type Fund = { art: "teil"; teil: Teil } | { art: "material"; material: MaterialId; anzahl: number };

export type OffeneKiste = {
  truhe: TruhenArt;
  kisteNr: number;
  /** Spieltag-Zaehler (Ausruestung), an dem die Kiste aufging. */
  spieltag: number;
  funde: [Fund, Fund, Fund];
  /** Wie die Kiste bezahlt wurde: Ruhm oder Gutschein (nur fuer die Anzeige). */
  bezahlt: "ruhm" | "gutschein";
};

export type TruhenGutscheine = Record<TruhenArt, number>;

/** Eine Zeile des Verlaufs (kurz gehalten, letzte Zeilen): fuer Meldungen in der Seite. */
export type AusruestungVerlauf = {
  spieltag: number;
  text: string;
};

export type TeamAusruestung = {
  ruhm: number;
  /** Teile: Zaehler, kein Lagerplatz (Bauplan C7). Aus Zerlegen und nicht gewaehlten Funden. */
  teile: number;
  lager: LagerPlatz[];
  gutscheine: TruhenGutscheine;
  offeneKiste: OffeneKiste | null;
  /** Wie viele Kisten dieses Team geoeffnet hat: Teil der Wuerfel-Saat, nie zurueckgesetzt. */
  kisten: number;
  /** Spieltag-Zaehler des letzten Ruhm-Golds; `null` = noch nie. */
  letztesRuhmGold: number | null;
  verlauf: AusruestungVerlauf[];
};

export type AusruestungSpielstand = {
  version: 1;
  /** Saat des Spielstands: einmal beim Anlegen festgelegt, danach nie mehr geaendert. */
  saat: string;
  /** Zaehlt die gebuchten Spieltage (fuer den Gold-Abstand), je Spieltag einmal. */
  spieltage: number;
  teams: Record<string, TeamAusruestung>;
  /** Schon gutgeschriebene Wertungen, Schluessel `<seasonId>|<matchdayId>:<seite>` bzw. `<seasonId>|<matchdayId>`. Wird beim Saisonwechsel gekuerzt. */
  gebucht: Record<string, true>;
  /** Platzierungs-Gold je Saison (`<seasonId>:halbzeit`, `<seasonId>:ende`), je einmal. */
  platzierungGebucht: Record<string, true>;
};

export type AusruestungWirkung = "keine" | "attribute";

/** Ein Eintrag der Wechselliste des Regel-Stempels: gilt ab Spieltag `ab` (`null` = ab Saisonbeginn). */
export type AusruestungRegelWechsel = {
  ab: string | null;
  besitz: boolean;
  wirkung: AusruestungWirkung;
  schmiede: 0 | 1 | 2 | 3 | 4 | 5;
  effekte: "aus" | "pilot1";
};

export type AusruestungRegelStempel = {
  seasonId: string;
  wechsel: AusruestungRegelWechsel[];
};

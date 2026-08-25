/**
 * VORLAEUFIGE Groessen-Ableitung (Skala 1-10) aus Rasse + Subklassen.
 *
 * Hintergrund: `PlayerAttributeSheetStats.height` (lib/data/olyDataTypes.ts) ist im
 * kompletten Bestand (2984 Spieler, Stand 25.08.) IMMER null — das Feld existiert im
 * Schema und im Google-Sheet-Import (lib/data/playerAttributeSheet.ts, Spalten
 * Height/Size/Groesse/Größe), aber niemand hat je echte Werte geliefert. Chris hat
 * eine echte Quelle mit Height je Spieler, liefert sie aber erst spaeter nach.
 *
 * Bis dahin: eine Vorab-Schaetzung aus dem, was jetzt schon da ist (Rasse, Subklassen),
 * NICHT persistiert. Absichtlich nur eine Ableit-FUNKTION, kein Schreiben in
 * attributeSheetStats.height — der Merge in playerAttributeSheetData.ts nimmt
 * `current?.height ?? row.height`, d.h. ein einmal gesetzter Wert wuerde eine spaeter
 * importierte ECHTE Sheet-Height fuer immer blockieren. Ein Verbraucher, der eine
 * Zahl braucht (z.B. spaeter die Sprite-Skalierung), ruft `ermittleSpielerHoehe(...)`
 * und bekommt echte Daten, sobald sie da sind, ohne Codeaenderung.
 *
 * Skala nach Chris' Vorgabe (25.08.): 1 Insekten, 2 Gnom, 3 Zwerg, 6 Ork, 6+ eher
 * Giants, 9-10 Naturgewalten (laufende Vulkane etc). Die 9-10-Stufe hat aktuell weder
 * in Rassen noch in Subklassen ein belastbares Signal (kein "Titan"/"Colossus"/
 * "Elemental" im Bestand) und bleibt deshalb unbesetzt, bis Chris' echte Daten da sind
 * oder er eine konkrete Subklasse dafuer nennt — lieber niemanden faelschlich in diese
 * Stufe zwingen, als raten.
 *
 * Bestehende Verbraucher, die schon auf GENAU dieser Skala rechnen (Beleg fuer die
 * Schwellen unten): lib/ai/team-theme-composition-service.ts (Tall>=6, Giant>=8,
 * Colossus>=9, Titan>=10, Small<=3, Tiny<=2) und deren Text-Token-Fallback
 * ("giant"/"tauren"/"ogre" -> gross, "gnom"/"tiny" -> klein), sowie
 * scripts/fresh-pick-audit-10x.ts sowie scripts/run-realistic-5season-simulation.ts,
 * die "behemoth" bereits als Riesen-Signal fuer die Quote des Teams "T-G" (The Giants)
 * werten.
 *
 * Kein "Insekt" existiert im Bestand als Rasse (20 Rassen, keine passt) — die 1er-Stufe
 * bleibt bis auf Weiteres unbelegt, betrifft aber aktuell niemanden real.
 */

/** Basis-Groesse je Rasse, bevor Subklassen-Modifikatoren greifen. */
const RASSEN_BASIS: Record<string, number> = {
  Gnom: 2,
  Dwarf: 3,
  Goblin: 3,
  // Construct bewusst NICHT gross: der Bestand zeigt Construct+Bot klein (Zed, Tank)
  // und Construct+Behemoth riesig (Tavascron, Tempest) nebeneinander — die Rasse
  // allein sagt nichts, der Behemoth-Modifikator unten macht die Arbeit.
  Construct: 4,
  Human: 5,
  Aqua: 5,
  Plant: 5,
  Animal: 5,
  // Chris 25.08.: "unterschiedlich" — kein Signal in Rasse ODER Subklassen gefunden,
  // bleibt Baseline bis echte Daten oder eine konkrete Subklassen-Zuordnung kommen.
  Alien: 5,
  Unknown: 5,
  Fish: 5,
  // Chris 25.08.: Elf ist "5 teils 4" — ohne erkennbares Subklassen-Signal fuer den
  // "teils 4"-Teil bleibt 5 als Default, PLATZHALTER bis er die Unterscheidung liefert.
  Elf: 5,
  Lizard: 6,
  Orc: 6,
  Mutant: 6,
  Tauren: 6,
  Demon: 6,
  Divine: 6,
  Dragon: 7,
  Voidborn: 7,
};

const RASSEN_BASIS_DEFAULT = 5;

/**
 * Additive Subklassen-Modifikatoren. Bewusst nur EINE Subklasse belegt: "Behemoth"
 * ist die einzige Subklasse im Bestand, die im Code bereits an anderer Stelle
 * eindeutig als Groessen-/Masse-Signal behandelt wird (lib/battle/subclass-archetypes.ts:
 * "schiere Masse", Bullbreaker = hoechste HP im Spiel; Token-Listen in
 * scripts/fresh-pick-audit-10x.ts und scripts/run-realistic-5season-simulation.ts).
 * "Giant"/"Titan"/"Colossus" existieren NICHT als Subklassen im Bestand (56 Subklassen
 * durchsucht) — die Design-Vokabel ist nur teilweise als echtes Datenfeld vorhanden.
 * God/Prime Evil/Angel klingen nach "gross", sind im Bestand aber Macht- nicht
 * Groessen-Vokabular (z.B. Dreamscape: Elf+God+Mage) — deshalb bewusst OHNE
 * Modifikator, um niemanden ohne Beleg aufzublasen.
 */
const SUBKLASSEN_MODIFIKATOR: Record<string, number> = {
  Behemoth: 3,
};

/**
 * Vorlaeufige Groesse (1-10) aus Rasse + Subklassen — Platzhalter bis echte
 * Height-Daten importiert sind. Wird NICHT in attributeSheetStats.height geschrieben,
 * s. Datei-Kommentar oben.
 */
export function leiteVorlaeufigeHoeheAb(race: string, subclasses: readonly string[]): number {
  const basis = RASSEN_BASIS[race] ?? RASSEN_BASIS_DEFAULT;
  const modifikator = subclasses.reduce((summe, sub) => summe + (SUBKLASSEN_MODIFIKATOR[sub] ?? 0), 0);
  return Math.max(1, Math.min(10, basis + modifikator));
}

/**
 * Groesse fuer einen Spieler: echte Sheet-Height, falls vorhanden, sonst die
 * Vorab-Schaetzung. Der einzig korrekte Ort fuer Code, der "irgendeine Zahl" braucht
 * (Sprite-Skalierung, Tag-Vergabe) — niemals leiteVorlaeufigeHoeheAb() direkt aufrufen
 * und damit eine echte Height stillschweigend ignorieren.
 */
export function ermittleSpielerHoehe(
  height: number | null | undefined,
  race: string,
  subclasses: readonly string[],
): number {
  if (typeof height === "number" && Number.isFinite(height)) return height;
  return leiteVorlaeufigeHoeheAb(race, subclasses);
}

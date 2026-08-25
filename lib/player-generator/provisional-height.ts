/**
 * VORLAEUFIGE Groessen-Ableitung (Skala 1-10) aus Rasse + Subklassen.
 *
 * Hintergrund: `PlayerAttributeSheetStats.height` (lib/data/olyDataTypes.ts) ist im
 * kompletten Bestand (2984 Spieler, Stand 25.08.) IMMER null — das Feld existiert im
 * Schema und im Google-Sheet-Import (lib/data/playerAttributeSheet.ts, Spalten
 * Height/Size/Groesse/Größe), aber niemand hat je echte Werte geliefert. Chris hat
 * eine echte Quelle mit Height je Spieler, liefert sie aber erst spaeter nach.
 *
 * Bis dahin: eine Vorab-Schaetzung aus dem, was jetzt schon da ist (Rasse, Subklassen,
 * Statur). Chris 25.08. (2. Ruecksprache): "kannst du das ja erstmal so fuer die
 * chars uebernehmen und taggen dass das vorab werte sind die noch ersetzt werden
 * muessen" — deshalb schreibt scripts/wende-vorlaeufige-hoehe-an.ts diese Schaetzung
 * jetzt tatsaechlich in data/generated/oly-player-attributes.json (die Katalog-Quelle
 * fuer den Sheet-Import, s. playerAttributeSheetData.ts), aber IMMER zusammen mit
 * `heightIsEstimate:true` (s. PlayerAttributeSheetStats.heightIsEstimate). Der Merge
 * in playerAttributeSheetData.ts nimmt `current?.height ?? row.height` — ein Spieler
 * mit bereits gesetzter (echter) Height wird also nie ueberschrieben, nur die
 * bislang durchgaengig nullen Werte bekommen die Schaetzung. Sobald Chris echte Daten
 * liefert, ersetzt ein Reimport dieselbe Spalte und heightIsEstimate wird false —
 * dieses Modul selbst bleibt eine reine Ableit-FUNKTION ohne eigenes Schreiben, s.
 * scripts/wende-vorlaeufige-hoehe-an.ts fuer den Schreibvorgang.
 *
 * WICHTIG: betrifft nur den REPO-Katalog (data/generated/*.json), NICHT bereits
 * bestehende Spielstaende (live-save-Spiegel vom Hetzner-Server) — deren Spieler
 * tragen ihre attributeSheetStats bereits fertig serialisiert in der jeweiligen
 * Save-Payload, die Katalog-Aenderung hydriert sie nicht nachtraeglich. Wirkt sich
 * also auf neue Spiele/neu generierte Charaktere und Katalog-Ansichten aus, nicht auf
 * den aktuell laufenden Spielstand auf dem Server.
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
// Chris 25.08. (2. Ruecksprache): Behemoth-Beispiele nachgemessen liefen bei +3 recht
// hoch auf (Kohan, Orc+Behemoth, landete bei 9 — schon in der "Naturgewalt"-Naehe fuer
// eine reine Subklasse ohne Elementar-/Titanen-Bezug). Auf Chris' Wunsch runter auf
// +2, PLATZHALTER bis echte Daten die tatsaechliche Behemoth-Spanne zeigen.
const SUBKLASSEN_MODIFIKATOR: Record<string, number> = {
  Behemoth: 2,
};

/**
 * Statur-Heuristik als 2. Blick (Chris 25.08.: "gigantische Kreaturen in der selben
 * Klasse sind oft groesser UND staerker als kleinere Versionen") — power+health sind
 * die einzigen Attribute, die schiere koerperliche Masse/Zaehigkeit abbilden (nicht
 * z.B. intelligence/charisma). Bewusst RELATIV zur eigenen Rasse gemessen (Z-Score),
 * nicht absolut: ein ueberdurchschnittlich kraeftiger Mensch soll nicht automatisch
 * auf Drachen-Niveau rutschen, nur weil sein power-Wert absolut hoch ist — es zaehlt,
 * ob er fuer SEINE Rasse ungewoehnlich kraeftig ist.
 *
 * Schwellen (Z-Score von (power+health)/2 gegen Rassen-Mittelwert/-Streuung):
 * >=2.0 -> +2 (deutlicher Ausreisser nach oben), >=1.0 -> +1, <=-1.5 -> -1, sonst 0.
 * Asymmetrisch (obere Schwelle bei 1.0, untere bei -1.5): ein kraeftiger Ausreisser
 * soll leichter als "groesser" auffallen als ein schwacher als "kleiner" — Statur
 * korreliert staerker mit "besonders gross" als mit "besonders klein" (viele
 * schwache Charaktere sind normal gewachsen, nur schwaechlich).
 */
export function berechneStaturModifikator(
  statur: number,
  rassenMittel: number,
  rassenStdabw: number,
): number {
  if (!Number.isFinite(statur) || !Number.isFinite(rassenMittel) || rassenStdabw <= 0) return 0;
  const z = (statur - rassenMittel) / rassenStdabw;
  if (z >= 2.0) return 2;
  if (z >= 1.0) return 1;
  if (z <= -1.5) return -1;
  return 0;
}

/**
 * Vorlaeufige Groesse (1-10) aus Rasse + Subklassen + optionalem Statur-Modifikator
 * (s. berechneStaturModifikator — braucht Rassen-Populationsstatistik, deshalb hier
 * nur als fertige Zahl durchgereicht statt selbst berechnet) — Platzhalter bis echte
 * Height-Daten importiert sind. Wird NICHT direkt in attributeSheetStats.height
 * geschrieben, s. Datei-Kommentar oben — das macht ausschliesslich
 * scripts/wende-vorlaeufige-hoehe-an.ts, mit heightIsEstimate:true markiert.
 */
export function leiteVorlaeufigeHoeheAb(
  race: string,
  subclasses: readonly string[],
  staturModifikator = 0,
): number {
  const basis = RASSEN_BASIS[race] ?? RASSEN_BASIS_DEFAULT;
  const subklassenModifikator = subclasses.reduce((summe, sub) => summe + (SUBKLASSEN_MODIFIKATOR[sub] ?? 0), 0);
  return Math.max(1, Math.min(10, basis + subklassenModifikator + staturModifikator));
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
  staturModifikator = 0,
): number {
  if (typeof height === "number" && Number.isFinite(height)) return height;
  return leiteVorlaeufigeHoeheAb(race, subclasses, staturModifikator);
}

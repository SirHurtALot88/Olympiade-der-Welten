// ===================================================================================
// UNTERKLASSE → ARCHETYP.
//
// Die Brücke, die bisher fehlte. Unsere Spieler tragen KLASSEN (Warlord, Templar,
// Hero, Bard, Tank …) und UNTERKLASSEN (Warrior, Guardian, Trickster …); die
// Klassenkarten kennen 35 ARCHETYPEN (Blackguard, Bullbreaker, Cleric, Matriarch …).
// Zwischen Klassen und Archetypen überschneiden sich nur zwei Namen — zwischen
// Unterklassen und Archetypen sind es mehr, und vor allem passen sie inhaltlich.
// Deshalb läuft die Zuordnung über die Unterklassen, so wie Chris es vorgegeben hat.
//
// DIE REGEL BEI UNSICHERHEIT: mehrere zuweisen, nicht raten.
//
// Chris: "wenn du zb hunter hast und unsicher bist, ob ein hunter dann archer,
// crossbowman oder hunter wird, weil viele hunter fernkämpfer sind, müsstest du denen
// erstmal alle 3 zuweisen — dann hätten die potentiell einen größeren skill pool."
//
// Genau so ist es gebaut. Eine Unterklasse zeigt auf ALLE Archetypen, die zu ihr
// passen könnten; ein Spieler mit drei Unterklassen zieht aus der Vereinigung. Das
// ist keine Verlegenheitslösung, sondern die ehrlichere Form: ein breiter Pool sagt
// "hier sind mehrere Wege offen", eine einzelne Zuweisung würde eine Entscheidung
// behaupten, die ich nicht treffen kann. Enger wird es später, wenn die Spielerbilder
// vorliegen — dann sieht man, ob ein Hunter einen Bogen oder eine Armbrust trägt.
//
// Was hier NICHT steht, ist erfunden: Werte, Rollen und Namen der Archetypen stehen
// im Archetypen-Verzeichnis, die Kits im Kit-Verzeichnis. Diese Datei ordnet nur zu.
// ===================================================================================

import { ARCHETYPES, type Archetype } from "@/lib/battle/archetype-registry";

/**
 * Wie sicher die Zuordnung ist.
 *
 * `namensgleich` — die Unterklasse heißt wie ein Archetyp (Hunter, Cleric, Monk).
 *   Auch dann stehen weitere Archetypen daneben: der Name allein entscheidet nicht,
 *   ob ein Hunter mit Bogen oder Armbrust läuft.
 * `inhaltlich`   — kein Namenstreffer, aber die Rolle passt eindeutig
 *   (Assassin → Rogue, Behemoth → Bullbreaker).
 * `offen`        — mehrere Lesarten sind gleich plausibel. Hier ist der breite Pool
 *   nicht Bequemlichkeit, sondern die Aussage selbst.
 */
export type Sicherheit = "namensgleich" | "inhaltlich" | "offen";

export interface Zuordnung {
  /** Die Unterklasse, so wie sie im Spielstand steht. */
  readonly unterklasse: string;
  /** Alle Archetypen, die dazu passen könnten — der erste ist der naheliegendste. */
  readonly archetypen: readonly string[];
  readonly sicherheit: Sicherheit;
  /** Warum diese Auswahl. Steht hier, damit man sie bestreiten kann. */
  readonly warum: string;
}

/**
 * Alle 56 Unterklassen aus dem laufenden Spielstand, absteigend nach Häufigkeit
 * geordnet — Warrior kommt 371 Mal vor, Aquatic ein einziges Mal.
 */
export const ZUORDNUNGEN: readonly Zuordnung[] = [
  { unterklasse: "Warrior", archetypen: ["Fighter", "Orc Warrior", "Barbarian", "Steelwind"], sicherheit: "offen",
    warum: "Der häufigste Nahkämpfer überhaupt und der unschärfste Begriff im Bestand — er sagt nur, dass jemand vorn steht." },
  { unterklasse: "Trickster", archetypen: ["Rogue", "Conjurer", "Astralwing"], sicherheit: "offen",
    warum: "List kann Klinge, Beschwörung oder Fernkampf heißen; die Karten trennen das, der Begriff nicht." },
  { unterklasse: "Guardian", archetypen: ["Blackguard", "Bullbreaker", "Frost Knight", "Matriarch"], sicherheit: "inhaltlich",
    warum: "Schützen ist eindeutig, die Bauart nicht: drei Panzer und eine Unterstützerin decken alle Wege ab." },
  { unterklasse: "Beast", archetypen: ["Thunderclaw", "Barbarian", "Reaver"], sicherheit: "inhaltlich",
    warum: "Tierhaft und im Nahkampf; Thunderclaw trägt das Motiv am deutlichsten." },
  { unterklasse: "Wayfarer", archetypen: ["Monk", "Hunter", "Steelwind"], sicherheit: "offen",
    warum: "Wanderer sagt etwas über die Herkunft, nichts über die Waffe." },
  { unterklasse: "Mage", archetypen: ["Archmage", "Fire Mage", "Ice Mage", "Lightning Mage", "Conjurer"], sicherheit: "offen",
    warum: "Die Karten kennen fünf Magierwege, unsere Unterklasse nur einen Namen — also alle fünf." },
  { unterklasse: "Destroyer", archetypen: ["Reaver", "Barbarian", "Voidfist"], sicherheit: "inhaltlich",
    warum: "Schaden ohne Rücksicht; alle drei sind DPS mit hohem Leben." },
  { unterklasse: "Knight", archetypen: ["Frost Knight", "Crusader", "Templar", "Blackguard"], sicherheit: "inhaltlich",
    warum: "Gepanzert und diszipliniert — die vier Ritterwege der Karten." },
  { unterklasse: "Isolated", archetypen: ["Hunter", "Rogue", "Necromancer"], sicherheit: "offen",
    warum: "Einzelgänger; die Karten kennen den Jäger, den Schleicher und den Beschwörer als solche." },
  { unterklasse: "Warlock", archetypen: ["Necromancer", "Reaper Mage", "Conjurer"], sicherheit: "inhaltlich",
    warum: "Dunkle Magie, die ruft oder zehrt." },
  { unterklasse: "Assassin", archetypen: ["Rogue", "Voidfist"], sicherheit: "inhaltlich",
    warum: "Rogue ist der einzige ASSASSIN der Karten; Voidfist steht als schneller Einzelziel-Töter daneben." },
  { unterklasse: "Bot", archetypen: ["Steelwind", "Fighter", "Crossbowman"], sicherheit: "offen",
    warum: "Maschinell; Steelwind und Crossbowman tragen Technik, Fighter die schlichte Bauart." },
  { unterklasse: "Servant", archetypen: ["Priest", "Matriarch", "Cleric"], sicherheit: "inhaltlich",
    warum: "Dienend heißt bei den Karten unterstützend." },
  { unterklasse: "Ambassador", archetypen: ["Priest", "Matriarch", "Templar"], sicherheit: "offen",
    warum: "Auftreten und Wort; im Kampf am ehesten Unterstützung oder geweihte Panzerung." },
  { unterklasse: "Undead", archetypen: ["Necromancer", "Reaper Mage"], sicherheit: "inhaltlich",
    warum: "Die beiden Totenwege der Karten." },
  { unterklasse: "Behemoth", archetypen: ["Bullbreaker", "Barbarian", "Orc Warrior"], sicherheit: "inhaltlich",
    warum: "Schiere Masse — Bullbreaker hat mit 210 das höchste Leben im ganzen Spiel." },
  { unterklasse: "Jungle", archetypen: ["Hunter", "Thunderclaw", "Barbarian"], sicherheit: "offen",
    warum: "Wildnis; Jäger, Bestie oder roher Nahkämpfer." },
  { unterklasse: "Agent", archetypen: ["Rogue", "Crossbowman", "Astralwing"], sicherheit: "offen",
    warum: "Verdeckt arbeitend; Klinge, Armbrust oder Distanz." },
  { unterklasse: "Lord", archetypen: ["Blackguard", "Crusader", "Templar"], sicherheit: "inhaltlich",
    warum: "Befehlend und gepanzert." },
  { unterklasse: "Swashbuckler", archetypen: ["Rogue", "Spellblade", "Steelwind"], sicherheit: "inhaltlich",
    warum: "Duellant mit leichter Klinge." },
  { unterklasse: "Apparition", archetypen: ["Reaper Mage", "Necromancer", "Astralwing"], sicherheit: "inhaltlich",
    warum: "Körperlos; die Karten führen das als Magie, nicht als Nahkampf." },
  { unterklasse: "Vigilante", archetypen: ["Rogue", "Steelwind", "Crusader"], sicherheit: "offen",
    warum: "Selbsternannt — vom Schleicher bis zum Eiferer ist alles belegbar." },
  { unterklasse: "Maniac", archetypen: ["Barbarian", "Reaver", "Voidfist"], sicherheit: "inhaltlich",
    warum: "Ohne Deckung nach vorn." },
  { unterklasse: "Hunter", archetypen: ["Hunter", "Bowman", "Crossbowman"], sicherheit: "namensgleich",
    warum: "Chris' eigenes Beispiel: der Name trifft, aber viele Jäger sind Fernkämpfer — also stehen Bogen und Armbrust daneben, bis das Bild entscheidet." },
  { unterklasse: "Royalty", archetypen: ["Templar", "Crusader", "Matriarch"], sicherheit: "offen",
    warum: "Herrschaft; geweiht, kämpfend oder führend." },
  { unterklasse: "Rebel", archetypen: ["Rogue", "Reaver", "Barbarian"], sicherheit: "offen",
    warum: "Gegen die Ordnung — sagt nichts über die Waffe." },
  { unterklasse: "Pet Master", archetypen: ["Conjurer", "Necromancer", "Orc Shaman"], sicherheit: "inhaltlich",
    warum: "Wer etwas mitbringt, das für ihn kämpft: die drei Rufer der Karten." },
  { unterklasse: "Augmented", archetypen: ["Steelwind", "Spellblade", "Voidfist"], sicherheit: "inhaltlich",
    warum: "Verstärkt — technisch, magisch oder körperlich." },
  { unterklasse: "Druid", archetypen: ["Orc Shaman", "Matriarch", "Priest"], sicherheit: "inhaltlich",
    warum: "Naturverbunden und heilend; alle drei sind SUPPORT." },
  { unterklasse: "Wraith", archetypen: ["Reaper Mage", "Necromancer"], sicherheit: "inhaltlich",
    warum: "Wie Undead, nur schmaler." },
  { unterklasse: "Shaman", archetypen: ["Orc Shaman", "Priest", "Ember Priest"], sicherheit: "namensgleich",
    warum: "Orc Shaman trifft den Namen; die beiden Priester decken den Fall ab, dass der Spieler kein Ork ist." },
  { unterklasse: "Spec Ops", archetypen: ["Crossbowman", "Rogue", "Bowman"], sicherheit: "inhaltlich",
    warum: "Ausgebildet und aus der Distanz." },
  { unterklasse: "Angel", archetypen: ["Templar", "Priest", "Cleric"], sicherheit: "inhaltlich",
    warum: "Geweiht — kämpfend oder heilend." },
  { unterklasse: "Alchemist", archetypen: ["Conjurer", "Ember Priest", "Archmage"], sicherheit: "offen",
    warum: "Mischt und wandelt; die Karten haben dafür keinen eigenen Weg." },
  { unterklasse: "Viking", archetypen: ["Barbarian", "Orc Warrior", "Reaver"], sicherheit: "inhaltlich",
    warum: "Schwerer Nahkampf ohne Rüstungsfixierung." },
  { unterklasse: "Amazoness", archetypen: ["Bowman", "Lancer", "Hunter"], sicherheit: "inhaltlich",
    warum: "Bogen und Speer — die Karten führen beides getrennt." },
  { unterklasse: "Ninja", archetypen: ["Rogue", "Voidfist", "Monk"], sicherheit: "inhaltlich",
    warum: "Schnell, leicht, ohne Rüstung." },
  { unterklasse: "Succubus", archetypen: ["Reaper Mage", "Necromancer", "Astralwing"], sicherheit: "inhaltlich",
    warum: "Zehrende Magie aus der Distanz." },
  { unterklasse: "Cleric", archetypen: ["Cleric", "Priest"], sicherheit: "namensgleich",
    warum: "Namenstreffer; Priest steht daneben, weil beide Karten sich neun Skills teilen." },
  { unterklasse: "Vampire", archetypen: ["Reaper Mage", "Necromancer", "Rogue"], sicherheit: "inhaltlich",
    warum: "Zehrend, dazu die schnelle Klinge." },
  { unterklasse: "Fallen Angel", archetypen: ["Reaper Mage", "Blackguard", "Astralwing"], sicherheit: "offen",
    warum: "Gefallen heißt geweiht UND dunkel — beides ist belegbar." },
  { unterklasse: "Pirate", archetypen: ["Rogue", "Crossbowman", "Steelwind"], sicherheit: "inhaltlich",
    warum: "Klinge und Schusswaffe nebeneinander." },
  { unterklasse: "Healer", archetypen: ["Priest", "Cleric", "Matriarch"], sicherheit: "inhaltlich",
    warum: "Die drei SUPPORT-Wege, die heilen — genau die Karten, die schon vorliegen." },
  { unterklasse: "Monk", archetypen: ["Monk", "Voidfist", "Priest"], sicherheit: "namensgleich",
    warum: "Namenstreffer; Voidfist als waffenloser Kämpfer, Priest als geistlicher Weg." },
  { unterklasse: "Whore", archetypen: ["Astralwing", "Reaper Mage"], sicherheit: "offen",
    warum: "Kein Kampfmotiv in den Karten; eingeordnet über die Distanzwege, die dem Bild am nächsten kommen." },
  { unterklasse: "God", archetypen: ["Templar", "Archmage", "Matriarch"], sicherheit: "offen",
    warum: "Göttlich sagt nichts über die Waffe — geweiht, mächtig oder führend." },
  { unterklasse: "Scout", archetypen: ["Bowman", "Hunter", "Goblin Archer"], sicherheit: "inhaltlich",
    warum: "Vorausgeschickt und schnell; Goblin Archer ist mit SPD 140 der schnellste Archetyp überhaupt." },
  { unterklasse: "Prime Evil", archetypen: ["Necromancer", "Reaper Mage", "Voidfist"], sicherheit: "inhaltlich",
    warum: "Das Böse an der Wurzel — die dunklen Wege der Karten." },
  { unterklasse: "Controller", archetypen: ["Lancer", "Ice Mage", "Conjurer", "Halberdier"], sicherheit: "inhaltlich",
    warum: "Trifft die Kartenrolle CONTROLLER — und zwar alle vier davon. Nicht namensgleich: CONTROLLER ist eine Rolle, kein Archetypname." },
  { unterklasse: "Drainer", archetypen: ["Reaper Mage", "Necromancer"], sicherheit: "inhaltlich",
    warum: "Zehren ist bei den Karten dunkle Magie." },
  { unterklasse: "Creature", archetypen: ["Thunderclaw", "Barbarian", "Orc Warrior"], sicherheit: "offen",
    warum: "Wie Beast, nur noch unbestimmter." },
  { unterklasse: "Strategist", archetypen: ["Halberdier", "Lancer", "Archmage"], sicherheit: "inhaltlich",
    warum: "Stellung und Reichweite statt Ansturm." },
  { unterklasse: "Executioner", archetypen: ["Reaver", "Blackguard", "Voidfist"], sicherheit: "inhaltlich",
    warum: "Ein schwerer Schlag statt vieler kleiner." },
  { unterklasse: "Engineer", archetypen: ["Crossbowman", "Steelwind", "Conjurer"], sicherheit: "inhaltlich",
    warum: "Gerät statt Muskel — Armbrust, Technik oder Beschwörung statt roher Kraft." },
  { unterklasse: "Aquatic", archetypen: ["Stormhorn", "Ice Mage"], sicherheit: "offen",
    warum: "Kommt genau einmal im ganzen Spielstand vor; Sturm und Eis sind die nächsten Motive." },

  // "Klasse" ist kein Spielbegriff, sondern ein Ueberbleibsel aus dem Datenimport —
  // fünf Spieler tragen es. Es bekommt bewusst KEINEN Archetyp: eine Zuordnung würde
  // einen Datenfehler in Spielinhalt verwandeln.
  { unterklasse: "Klasse", archetypen: [], sicherheit: "offen",
    warum: "Datenrest aus dem Import, kein Spielbegriff. Bleibt ohne Zuordnung, damit der Fehler sichtbar bleibt." },
];

/**
 * VERFEINERUNG AM BILD.
 *
 * Die Zuordnung oben gilt für eine UNTERKLASSE. Das Spielerbild sagt etwas über einen
 * EINZELNEN Spieler — und ist damit die stärkere Quelle, sobald es vorliegt. Chris:
 * "vielleicht kannst du die mit den Bildern noch mehr spezifizieren."
 *
 * Deshalb steht die Verfeinerung hier daneben und nicht in der Tabelle: sie überschreibt
 * die Vereinigung für genau diesen Spieler, ohne die allgemeine Regel anzufassen. Ein
 * anderer Hunter kann weiterhin eine Armbrust tragen.
 *
 * Die Bilder liegen in Chris' Dropbox unter "Mark VI Cardgame/Spieler/". Aus dieser
 * Sitzung heraus sind sie NICHT abrufbar — der Egress-Proxy blockt
 * dropboxusercontent.com —, sie kamen einzeln über den Chat. Wer hier etwas ändert,
 * braucht das Bild dazu.
 */
export interface Bildbefund {
  readonly spieler: string;
  /** Was auf dem Bild zu sehen ist. Beobachtung, keine Deutung. */
  readonly bild: string;
  /** Die Archetypen, die nach dem Bild übrig bleiben — ersetzt die Vereinigung. */
  readonly archetypen: readonly string[];
  /** Was das Bild ausschließt und warum. */
  readonly schliesstAus: string;
}

export const BILDBEFUNDE: readonly Bildbefund[] = [
  {
    spieler: "Cassandra",
    bild: "Rothaarige Elfe mit LANGBOGEN und Köcher, grüner Umhang, leichte Rüstung, Wald.",
    archetypen: ["Bowman", "Hunter"],
    schliesstAus:
      "Crossbowman: sie trägt einen Bogen, keine Armbrust. Genau die Frage, die Chris am Beispiel Hunter gestellt hat — hier ist sie beantwortet. Thunderclaw und Barbarian (aus Jungle) fallen weg: sie ist Fernkämpferin, kein Nahkämpfer.",
  },
  {
    spieler: "Draco",
    bild: "Schwere Schuppenpanzerung mit gehörntem Helm, große Streitaxt und Schild, Drache im Hintergrund.",
    archetypen: ["Blackguard", "Crusader", "Frost Knight", "Halberdier"],
    schliesstAus:
      "Bowman, Hunter und Goblin Archer (kamen aus der Unterklasse Scout): er ist voll gepanzerter Nahkämpfer mit Axt und Schild. Auch Reaver, Barbarian und Voidfist fallen weg — die tragen keine schwere Platte.",
  },
  {
    spieler: "Krag'Zul",
    bild: "Riesiger Koloss aus Kristallschollen, violette Energie in Brust und Rissen, unbewaffnet, Gewitterhimmel.",
    archetypen: ["Bullbreaker", "Lightning Mage", "Conjurer"],
    schliesstAus:
      "Orc Warrior und Barbarian: er ist kein Humanoider mit Waffe, sondern ein unbewaffneter Koloss. Die Unterklasse Mage zeigt sich als Energie im Körper, nicht als Stab — deshalb bleiben zwei Magierwege stehen, aber kein Stabträger.",
  },
  {
    spieler: "Rhyx'Tal",
    bild: "Massiges Steinwesen mit Echsenkopf und glühenden Augen, unbewaffnet, kauert in einer Höhle; an den Wänden gezeichnete Porträts, Kristalle ringsum.",
    archetypen: ["Bullbreaker", "Voidfist"],
    schliesstAus:
      "Lancer, Halberdier, Ice Mage, Conjurer und Necromancer: er führt keine Waffe und wirkt nichts — er schlägt mit den Händen. Die Zeichnungen an der Höhlenwand passen zur Unterklasse Isolated und zu den Eigenschaften Caring und Timid, machen ihn aber nicht zum Beschwörer.",
  },
  {
    spieler: "Jorund",
    bild: "Alter Mann mit grauem Haar und Vollbart, Fellumhang, Holzstab, am Feuer in einem verschneiten Dorf. Keine Rüstung, keine Klinge.",
    archetypen: ["Matriarch"],
    schliesstAus:
      "Blackguard, Bullbreaker, Frost Knight, Steelwind, Templar und Crusader: er trägt keine Rüstung. Rogue: keine Klinge, kein Schleicher. Übrig bleibt aus seinen Unterklassen (Vigilante, Royalty, Guardian) allein Matriarch — der einzige Weg dort, der ohne Panzer auskommt und über Charisma und Spirit wirkt, was zu seinen Werten passt (Charisma 85, Spirit 76, Power 10).\n\nBEFUND: Das Bild zeigt einen Stabträger, und die Karten haben dafür eigene Wege — Archmage, Priest, Orc Shaman. KEINER davon ist aus seinen drei Unterklassen erreichbar. Hier widersprechen sich Bild und Unterklassen; die Zuordnungstabelle für Vigilante, Royalty oder Guardian ist womöglich zu eng. Das gehört Chris vorgelegt, nicht still überschrieben.",
  },
  {
    spieler: "Seraph-11",
    bild: "Mechanischer Vogel aus Metall mit leuchtendem Kern im Rumpf, Nebel und Vollmond.",
    archetypen: ["Priest", "Cleric"],
    schliesstAus:
      "Blackguard, Bullbreaker und Frost Knight (kamen aus Guardian): keine Rüstung, keine Waffe, kein Panzer. Der leuchtende Kern passt zu den beiden Lichtwegen — und das sind genau die zwei Kits, die schon vorliegen.",
  },
];

const BEFUND_NACH_SPIELER = new Map(BILDBEFUNDE.map((b) => [b.spieler, b] as const));

export function bildbefundVon(spieler: string): Bildbefund | undefined {
  return BEFUND_NACH_SPIELER.get(spieler);
}

const NACH_UNTERKLASSE = new Map(ZUORDNUNGEN.map((z) => [z.unterklasse, z] as const));
const ARCHETYP_NACH_NAME = new Map(ARCHETYPES.map((a) => [a.name, a] as const));

export function zuordnungVon(unterklasse: string): Zuordnung | undefined {
  return NACH_UNTERKLASSE.get(unterklasse);
}

/**
 * Die Archetypen eines Spielers: die Vereinigung über alle seine Unterklassen.
 *
 * Reihenfolge bleibt stabil — erst die Archetypen der ersten Unterklasse, dann die
 * neuen der zweiten, und so fort. Damit steht der naheliegendste Archetyp vorn, und
 * zwei Aufrufe liefern nie eine andere Reihenfolge.
 */
export function archetypenFuer(unterklassen: readonly string[], spieler?: string): readonly Archetype[] {
  // Liegt ein Bild vor, gilt das Bild. Es ist die konkretere Quelle.
  const befund = spieler ? BEFUND_NACH_SPIELER.get(spieler) : undefined;
  if (befund) {
    return befund.archetypen
      .map((n) => ARCHETYP_NACH_NAME.get(n))
      .filter((a): a is Archetype => Boolean(a));
  }
  const gesehen = new Set<string>();
  const raus: Archetype[] = [];
  for (const u of unterklassen) {
    for (const name of NACH_UNTERKLASSE.get(u)?.archetypen ?? []) {
      if (gesehen.has(name)) continue;
      const a = ARCHETYP_NACH_NAME.get(name);
      if (!a) continue;
      gesehen.add(name);
      raus.push(a);
    }
  }
  return raus;
}

/** Wie viele Wege einem Spieler offenstehen — je mehr Unterklassen, desto breiter. */
export function poolBreite(unterklassen: readonly string[], spieler?: string): number {
  return archetypenFuer(unterklassen, spieler).length;
}

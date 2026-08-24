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
 * Die Bilder liegen in Chris' Dropbox unter "Mark VI Cardgame/Spieler/<Spielername>.jpg".
 * Sie SIND aus einer Agentensitzung heraus abrufbar (verifiziert): Dropbox-MCP
 * `list_folder`/`search`, dann `download_link` für eine Einweg-URL (600s gültig),
 * die URL per `curl` in eine lokale Datei geladen (nicht mit WebFetch anfassen — die
 * dl.dropboxusercontent.com-URLs sind nur per direktem Download nutzbar) und die Datei
 * mit dem Read-Tool angesehen. Wer hier etwas ändert, braucht das Bild dazu.
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

  // ===================================================================================
  // BATCH 1 — 22 Spieler, ausgewählt nach: Bild in der Dropbox vorhanden UND alle drei
  // Unterklassen als "offen" markiert (die unsichersten Fälle, wo ein Bildbefund am
  // meisten hilft). Zwei weitere Kandidaten (Cipher, Lyrion) wurden geprüft, aber NICHT
  // aufgenommen: ihre Bilder zeigen keinerlei Kampfausrüstung (Cipher: Hacker am
  // Rechner: Lyrion: Barde mit Laute) und liefern damit keine Verengung — ein Bildbefund
  // ohne Verengung wäre keiner.
  // ===================================================================================
  {
    spieler: "Meira",
    bild:
      "Katzenartiges Fellwesen (Beastfolk) in Kletterhaltung auf einem Ast, Kegelhut, leichte Stoffkleidung ohne Rüstung, Holzstab mit leuchtender goldener Kugel an der Spitze, Dschungel.",
    archetypen: ["Conjurer"],
    schliesstAus:
      "Fighter, Orc Warrior, Barbarian, Steelwind (aus Warrior): keine Rüstung, keine Nahkampfwaffe — sie trägt einen Zauberstab, keine Klinge. Hunter, Thunderclaw (aus Jungle): kein Bogen, kein elektrischer Effekt. Rogue, Astralwing (aus Trickster): keine Klinge bzw. keine umkreisenden Sterne, sondern eine einzelne leuchtende Kugel am Stab — das passt zum kontrollierenden Zauberer Conjurer.",
  },
  {
    spieler: "Yaezakura",
    bild:
      "Schwer gepanzerter Kämpfer in schwarzer Stachelrüstung mit rotem Helmbusch und Skelettmaske, hält einen Stab mit aufgespießten Schädeln, Schlachtfeld mit Feuer und Krähen im Hintergrund.",
    archetypen: ["Fighter", "Orc Warrior", "Barbarian"],
    schliesstAus:
      "Rogue, Steelwind (aus Vigilante): er trägt volle Platte, keine leichte Klinge oder Krummschwert für einen Schleicher. Hunter (aus Isolated): kein Bogen. Necromancer (aus Isolated): er trägt Schädel als Trophäen, beschwört aber nichts — kein Skelett, kein Zauber sichtbar. Crusader (aus Vigilante): die Optik ist finster und mit Totenköpfen behängt, nicht geweiht. Übrig bleiben die drei schweren Nahkämpfer aus Warrior.",
  },
  {
    spieler: "Princess Pride",
    bild:
      "Blonde Frau in goldener Ziererüstung (Brustpanzer, Schulterplatten, Handschuhe), roter Umhang, keine Waffe sichtbar, vor antiken Säulenruinen.",
    archetypen: ["Templar", "Crusader", "Matriarch"],
    schliesstAus:
      "Fighter, Orc Warrior, Barbarian, Steelwind (aus Warrior) und Rogue (aus Vigilante): die Rüstung ist golden-zeremoniell und herrschaftlich, nicht die schlichte oder wilde Bauart eines Haudegens oder Schleichers. Ohne sichtbare Waffe bleiben die drei geweiht-herrschaftlichen Wege aus Royalty offen.",
  },
  {
    spieler: "Robofighter",
    bild:
      "Massiver Kampfroboter mit riesiger Kanone am Arm, keine Klinge, Großstadt bei Nacht im Hintergrund.",
    archetypen: ["Crossbowman"],
    schliesstAus:
      "Steelwind (aus Bot/Agent) und Fighter, Orc Warrior, Barbarian, Rogue (aus Warrior/Agent): er kämpft mit einer schweren Feuerwaffe aus der Distanz, nicht mit Klinge oder bloßen Fäusten. Astralwing (aus Agent): keine Magie, das ist Technik. Übrig bleibt der einzige Fernkampf-Archetyp mit schwerem Gerät statt Bogen.",
  },
  {
    spieler: "Orinex",
    bild:
      "Goldener gepanzerter Konstrukt mit blau leuchtenden Energiekugeln in Brust, Schultern und Handschuhen, schwingt einen Hammer mit hellem Blitz-Energiekopf, Blitze im Hintergrund, Uhrwerk-Tempel.",
    archetypen: ["Lightning Mage"],
    schliesstAus:
      "Fire Mage, Ice Mage (aus Mage): keine Flammen, kein Frost, sondern deutlich sichtbare Blitze am Hammerkopf. Archmage (aus Mage/Alchemist): kein zyklisches Dreifach-Element zu sehen, nur eine einzelne elektrische Energie. Conjurer, Ember Priest (aus Alchemist/Trickster): keine Gravitations- oder Heilmagie erkennbar. Rogue, Astralwing (aus Trickster): keine Klinge, keine Sternbilder. Übrig bleibt der Blitzweg.",
  },
  {
    spieler: "Nightowl",
    bild:
      "Vermummter Mann im zerschlissenen Umhang mit Kapuze, hält einen Speer mit Metallspitze, Gewitter und Ruinen im Hintergrund, Regen.",
    archetypen: ["Hunter", "Rogue"],
    schliesstAus:
      "Monk (aus Wayfarer): er ist bewaffnet, kein waffenloser Kämpfer. Steelwind (aus Wayfarer): kein Krummschwert/Shuriken. Conjurer, Astralwing (aus Trickster): keine Magie sichtbar. Necromancer (aus Isolated): keine Totenbeschwörung. Weder Hunter (Bogen) noch Rogue (Klinge) bilden die tatsächliche Waffe exakt ab — er trägt einen Speer, den keiner seiner Kandidaten kennt —, aber sie sind die einzigen einzelgängerischen Nah-/Fernkampf-Lesarten, die überhaupt übrig bleiben. Diese Lücke ist Chris vorzulegen.",
  },
  {
    spieler: "Calawynn",
    bild:
      "Geflügelte Meerjungfrau/Fee mit durchscheinenden Schmetterlingsflügeln, weißem Haar, Fischschwanz, unter Wasser, keine Waffe, keine Rüstung, ruhige schwebende Haltung.",
    archetypen: ["Astralwing", "Monk"],
    schliesstAus:
      "Templar, Crusader, Matriarch (aus Royalty): keine Rüstung, kein Hammer. Hunter, Steelwind (aus Wayfarer): kein Bogen, keine Klinge. Reaper Mage (aus Whore): keine Geschütze oder Fernkampfwaffen sichtbar. Übrig bleiben nur die beiden waffenlosen/geflügelten Lesarten — das Bild zeigt aber keinerlei Kampfhaltung, nur ein schwebendes Porträt, die Verengung bleibt entsprechend unsicher.",
  },
  {
    spieler: "Impulse",
    bild:
      "Weiblicher Kampfroboter/Cyborg in weiß-schwarzer Panzerung mit oranger Energie, hält eine glühende Energieklinge in der Hand, zerstörte Sci-Fi-Stadt im Hintergrund.",
    archetypen: ["Steelwind", "Rogue", "Fighter"],
    schliesstAus:
      "Crossbowman (aus Bot/Agent): keine Fernkampfwaffe, sie kämpft mit einer Klinge. Conjurer, Astralwing (aus Trickster/Agent): keine Zaubermagie, die Klinge ist technisch-energetisch, nicht arkan. Übrig bleiben die drei klingenfähigen Nahkämpfer.",
  },
  {
    spieler: "Alaric",
    bild:
      "Zerlumpter bärtiger Mann mit Holzstab voller Anhänger (Federn, Knochen), hält eine leuchtende Kugel in der offenen Hand, Gürtel voller leuchtender Tränkefläschchen, Wald, freundlicher Blick.",
    archetypen: ["Conjurer", "Ember Priest", "Archmage"],
    schliesstAus:
      "Monk, Hunter, Steelwind (aus Wayfarer) und Rogue (aus Isolated): keine Kampfhaltung, keine Waffe außer dem Ritualstab, kein Bogen, keine Klinge. Necromancer (aus Isolated): kein Totenmotiv, die Szene ist warm und freundlich, nicht düster. Übrig bleiben die drei Zauberwege, die zu Tränken und offener Handmagie passen.",
  },
  {
    spieler: "Slither",
    bild:
      "Reptilienhafter Dämon mit Drachenschwanz, schwarz-roter Stachelrüstung mit roten Edelsteinen, roter Kapuze, glühenden Augen, hält eine einzelne gekrümmte rote Klinge, Ruinen.",
    archetypen: ["Rogue", "Steelwind"],
    schliesstAus:
      "Crusader (aus Vigilante): kein geweihtes Motiv, sondern dämonisch-finster. Fighter, Orc Warrior, Barbarian (aus Warrior): kein grobschlächtiger Bauart-Kämpfer, sondern eine schlanke Gestalt mit einer einzelnen gekrümmten Klinge. Hunter (aus Isolated): kein Bogen. Necromancer (aus Isolated): keine Totenbeschwörung, nur persönliche Rüstung. Übrig bleiben die beiden Klingenwege.",
  },
  {
    spieler: "Toasty",
    bild:
      "Kleiner Toaster-Panzerroboter auf Kettenlaufwerken, glühend rote Augen, Toastscheiben oben, hält ein einzelnes Messer in einer Klaue, Schrottplatz.",
    archetypen: ["Rogue", "Steelwind", "Fighter", "Barbarian"],
    schliesstAus:
      "Crossbowman (aus Bot): keine Fernkampfwaffe. Reaver (aus Rebel): keine Wurfäxte, nur ein einzelnes Messer. Conjurer, Astralwing (aus Trickster): keine Magie. Übrig bleiben die vier klingen-/nahkampffähigen Messerträger, unter denen das Bild allein nicht weiter entscheidet.",
  },
  {
    spieler: "Cardinal Richelieu",
    bild:
      "Pestarzt-Vogelmaske mit rotem Kardinalshut, schwarze Robe mit rotem Cape, Kreuzkette, hält eine Laterne und eine Schriftrolle, keine Waffe, Krypta/Kathedrale.",
    archetypen: ["Conjurer", "Ember Priest", "Archmage", "Necromancer"],
    schliesstAus:
      "Hunter (aus Isolated), Reaver, Barbarian (aus Rebel): keine Waffe, keine Kampfhaltung. Rogue (aus Isolated): keine Klinge. Übrig bleiben die vier robenbekleideten Zauber-/Totenwege, zwischen denen Laterne und schlichtes Kreuz nicht klar entscheiden — die Kryptenszene passt besonders gut zu Necromancer.",
  },
  {
    spieler: "Patience",
    bild:
      "Alter Halbelf mit weißem Bart, moosbewachsene Robe mit Pilzen an der Schulter, sitzt meditierend an einem Wasserfall, keine Waffe.",
    archetypen: ["Monk"],
    schliesstAus:
      "Hunter, Thunderclaw, Barbarian (aus Jungle): kein Bogen, keine Elektrizität, kein wilder Nahkämpfer. Steelwind, Rogue (aus Wayfarer/Isolated): keine Klinge. Necromancer (aus Isolated): kein Totenmotiv. Übrig bleibt der einzige waffenlose Weg.",
  },
  {
    spieler: "Radegas der Braune",
    bild:
      "Baumartiges Wesen aus Rinde und Wurzeln mit langem Bart, hält einen knorrigen Holzstab, füttert Vögel, Eichhörnchen daneben, Wald bei Nacht.",
    archetypen: ["Monk"],
    schliesstAus:
      "Hunter, Rogue, Necromancer (aus Isolated) sowie Thunderclaw, Barbarian (aus Jungle) und Steelwind (aus Wayfarer): kein Bogen, keine Klinge, keine Totenbeschwörung, kein elektrischer Effekt, kein Krummschwert. Der Stab wirkt wie ein Wanderstab, keine Kampfwaffe — am ehesten passt noch der waffenlose Monk.\n\nBEFUND: Das Bild zeigt eindeutig einen Naturgeist/Baummagier (Radagast-Motiv), aber KEIN Archetyp aus Isolated, Jungle oder Wayfarer bildet Naturmagie ab — dafür bräuchte es einen Weg wie Orc Shaman oder Conjurer, der aus seinen Unterklassen nicht erreichbar ist. Widerspruch, Chris vorzulegen.",
  },
  {
    spieler: "Pantina",
    bild:
      "Dunkelhäutige Elfe mit spitzen Ohren in dunklem Lederkorsett-Kleid, sitzt mit einem Dolch in der Hand, Wald bei Nacht.",
    archetypen: ["Steelwind", "Thunderclaw"],
    schliesstAus:
      "Astralwing, Reaper Mage (aus Whore): keine Magie sichtbar, sondern eine physische Klinge. Monk (aus Wayfarer): sie ist bewaffnet. Hunter (aus Jungle/Wayfarer): kein Bogen. Barbarian (aus Jungle): keine grobschlächtige Kampfhaltung, sondern eine einzelne präzise Klinge in ruhiger Pose. Übrig bleiben die beiden Klingenwege.",
  },
  {
    spieler: "Xandrix",
    bild:
      "Alter Zauberer mit grauem Haar und Bart, prunkvolle lila-goldene Robe, hält einen Kristallstab und eine geometrische leuchtende Kugel mit Sternsymbolen, Sternenhimmel-Hintergrund.",
    archetypen: ["Archmage", "Astralwing", "Conjurer"],
    schliesstAus:
      "Fire Mage, Ice Mage, Lightning Mage (aus Mage): kein spezifisches Element sichtbar, das Licht ist weiß-golden, nicht farblich elementar. Rogue (aus Trickster) und Reaver, Barbarian (aus Rebel): keine Klinge, kein grober Nahkampf, sondern eindeutig ein robenbekleideter Zauberer. Übrig bleiben die drei nicht-elementaren, kosmisch/arkan wirkenden Wege.",
  },
  {
    spieler: "Juggler",
    bild:
      "Vermummte Gestalt mit leuchtend blauen Augen unter der Kapuze, schwarzer Umhang über Lederrüstung, jongliert schwebende dunkle Kugeln und Dolche um sich herum, dunkle Gasse.",
    archetypen: ["Conjurer", "Necromancer", "Rogue"],
    schliesstAus:
      "Steelwind, Fighter, Crossbowman (aus Bot), Hunter (aus Isolated): die schwebenden Kugeln und Dolche wirken durch Magie kontrolliert, nicht geworfen oder geschossen. Archmage, Fire Mage, Ice Mage, Lightning Mage (aus Mage): kein spezifisches Element, nur dunkle Energie. Übrig bleiben die Wege, die entweder Objekte magisch kontrollieren (Conjurer, Necromancer) oder die schwebenden Dolche als geworfene Klingen lesen (Rogue).",
  },
  {
    spieler: "Udalf",
    bild:
      "Kahlköpfiger, muskulöser Mann mit Stammestüchern, hält einen Stab mit blau-weißer Flamme an der Spitze, glühende orange Risse auf der Haut, antiker Tempel.",
    archetypen: ["Archmage", "Fire Mage", "Ice Mage"],
    schliesstAus:
      "Lightning Mage (aus Mage): keine Blitze, die Hautrisse sehen eher wie Glut aus. Rogue (aus Trickster), Reaver, Barbarian (aus Rebel): keine Klinge, kein grober Nahkampf, sondern eindeutig ein Stabzauberer. Conjurer (aus Trickster): keine Gravitations-/Kontrollmagie erkennbar. Die Flammenfarbe ist uneindeutig zwischen Blau (frostnah) und den orangen Hautrissen (feuernah) — deshalb bleiben Fire Mage und Ice Mage beide stehen, dazu Archmage, dessen Karte ohnehin zwischen Feuer und Eis wechselt.",
  },
  {
    spieler: "Bruiser",
    bild:
      "Frau in voller Stahlplattenrüstung mit Helm und Schild, roter Umhang, Schlachtfeld mit weiteren Rittern.",
    archetypen: ["Fighter", "Orc Warrior"],
    schliesstAus:
      "Barbarian (aus Warrior): die diszipliniert getragene Vollrüstung mit Schild passt nicht zum wilden Nahkampf-Blender. Steelwind (aus Wayfarer): keine Klinge/Shuriken sichtbar. Monk (aus Wayfarer): sie ist schwer gepanzert, nicht waffenlos. Hunter, Rogue, Necromancer (aus Isolated): kein Bogen, keine Klinge, keine Totenmagie. Übrig bleiben die beiden Schild-Rüstungswege.",
  },
  {
    spieler: "Slugger",
    bild:
      "Violetthäutiger Alien-Humanoid mit großen schwarzen Augen, Lederjacke mit Patches, trägt eine massive stachelbewehrte Keule über der Schulter.",
    archetypen: ["Barbarian", "Fighter", "Orc Warrior"],
    schliesstAus:
      "Rogue (aus Rebel/Isolated) und Steelwind (aus Warrior): keine Klinge, sondern eine stumpfe Wuchtwaffe. Reaver (aus Rebel): dessen Kit ist auf Wurfäxte ausgelegt, nicht auf eine Keule. Hunter, Necromancer (aus Isolated): kein Bogen, keine Totenmagie. Übrig bleiben die drei schweren Wuchtwaffen-Nahkämpfer.",
  },
  {
    spieler: "Aerin",
    bild:
      "Bleichhäutige, spitzohrige Frau mit dunklem Lederkorsett und Metallverzierung, leuchtender Stirnstein, kühler Blick, Wald bei Nacht, keine Waffe sichtbar.",
    archetypen: ["Rogue", "Conjurer"],
    schliesstAus:
      "Reaver, Barbarian (aus Rebel): keine Waffe, keine grobe Kampfhaltung. Steelwind (aus Vigilante): keine Klinge sichtbar. Crusader (aus Vigilante): kein geweihtes Motiv, die Optik ist dunkel-elegant. Astralwing (aus Trickster): keine Sternbilder. Übrig bleiben die schleichend-dunkle Lesart (Rogue) und die durch den leuchtenden Stirnstein nahegelegte Magie-Lesart (Conjurer).",
  },
  {
    spieler: "Dorothy",
    bild:
      "Blonde spitzohrige Frau in blau-goldener Zierrüstung, lächelnd, streckt die Hand nach einem goldenen Hund aus, feine goldene Lichtpartikel in der Luft, Wald, keine Waffe.",
    archetypen: ["Monk", "Conjurer"],
    schliesstAus:
      "Hunter (aus Jungle/Wayfarer): der Hund ist kein Wildschwein-Begleiter, kein Bogen zu sehen. Steelwind (aus Wayfarer): keine Klinge. Fire Mage, Ice Mage, Lightning Mage, Archmage (aus Mage): keine elementspezifischen Effekte, nur diffuses goldenes Glitzern. Thunderclaw, Barbarian (aus Jungle): keine Elektrizität, keine grobe Kampfhaltung. Übrig bleiben die unbewaffnete Lesart (Monk) und die durch das Glitzern nahegelegte, unspezifische Zaubermagie (Conjurer).",
  },

  // ===================================================================================
  // BATCH 2 — priorisiert nach Chris' AKTIVEM Spielstand (new-game-1787123325719-swnjlk),
  // nicht nach der vollen Kartei: ERST sein eigenes Team "Vigilante Wranglers" (V-W),
  // DANACH Rest-Roster in der Reihenfolge aus roster-rest-missing.json. Ausgelassen:
  // Byrd und Orakelpfropf — ihre Bilder zeigen keinerlei Kampf-/Magie-Motiv (Zwiebel-
  // Hausangestellte mit Besen; Katze mit Plastikbecher auf dem Kopf) und liefern damit
  // keine Verengung.
  // ===================================================================================

  // --- Chris' eigenes Team "Vigilante Wranglers" (V-W) ---
  {
    spieler: "Xelara",
    bild:
      "Grauhäutige Alien-Diplomatin mit hoher, kahler Schädelform, schwarzem gegürtetem Ledergewand und Umhang, kein sichtbarer Waffengriff. Im Hintergrund leuchtet zweimal das Wort „DIPLOMACY“.",
    archetypen: ["Priest"],
    schliesstAus:
      "Matriarch, Templar, Blackguard, Bullbreaker, Frost Knight (aus Guardian): keine Platte, kein Hammer, keine Klinge — das Leder ist Robe, keine Rüstung. Sie steht unbewaffnet und redend da, das Bild selbst beschriftet sie als Diplomatin. Übrig bleibt aus Ambassador allein der unbewaffnete Support-Caster.",
  },
  {
    spieler: "Inefinna",
    bild:
      "Weißhaarige Kriegerin mit goldenem Strahlenkranz-Diadem, aufwendiger silber-goldener Plattenrüstung mit Schulterpanzern, hält ein großes Schwert mit beiden Händen vor sich, Augen geschlossen, helle Tempelhalle im Hintergrund.",
    archetypen: ["Matriarch", "Templar", "Crusader"],
    schliesstAus:
      "Rogue: keine Klinge im Verborgenen, sondern ein aufrecht präsentiertes Zweihandschwert samt voller Panzerung. Steelwind: kein Tech-Motiv, kein Krummschwert. Priest: sie trägt schwere Rüstung und ein Schwert statt unbewaffnet zu wirken — der Heiligenschein passt zu allen drei verbleibenden Paladin-Wegen, die Klinge entscheidet nicht zwischen ihnen.",
  },
  {
    spieler: "Johanna",
    bild:
      "Blonde Kriegerin in dunkler geschwärzter Plattenrüstung mit Pelzbesatz an der Schulter, riesiger verzierter Kriegshammer in der einen, Turmschild in der anderen Hand, Schneewald im Hintergrund.",
    archetypen: ["Matriarch", "Crusader", "Frost Knight"],
    schliesstAus:
      "Blackguard: sein Kit ist Peitsche und Schild, sie trägt Hammer und Schild. Templar: zu leicht und agil für dieses Bild — sie steht schwer gepanzert mit Turmschild, nicht sprungbereit. Bullbreaker ist an den Minotaurus gebunden, sie ist Mensch. Hammer plus Schild passt zu Matriarch und Crusader; der Schneewald lässt Frost Knight stehen.",
  },
  {
    spieler: "Gram",
    bild:
      "Riesiger drachenartiger Lavakoloss mit gehörntem, brennendem Kopf, geschuppter Magmahaut mit goldenen Schulterplatten, schwingt eine große Kriegsaxt, keine Deckung.",
    archetypen: ["Bullbreaker"],
    schliesstAus:
      "Blackguard: keine Peitsche, kein Schild. Frost Knight: das Bild ist durchgehend Feuer/Lava, das Gegenteil von Frost. Matriarch: kein Hammer, keine Support-Haltung — er greift mit der Axt an. Übrig bleibt aus Guardian nur der massige, formationsbrechende Koloss.",
  },
  {
    spieler: "Lava Golem",
    bild:
      "Menschengroßer Feuer-/Lavadämon mit Hörnern und glühenden Augen, geborstene Magmahaut, geballte Fäuste ohne Waffe, Arena-Kolosseum im Hintergrund.",
    archetypen: ["Bullbreaker", "Monk", "Orc Warrior"],
    schliesstAus:
      "Hunter: kein Fernkampf, er steht mitten in der Arena. Steelwind: kein Tech-Motiv, keine Klinge. Barbarian setzt eine geführte Waffe voraus (\"bleeding strikes\"), er hat keine — die drei verbleibenden Kandidaten kämpfen alle unbewaffnet mit den Fäusten oder durch schiere Masse.",
  },
  {
    spieler: "Krolach",
    bild:
      "Steinerner Elementarkoloss aus Fels, Wasserfällen und Eis, orange und blaue Kristalle im Rumpf eingelassen, keine Waffe, tost im Meer zwischen Klippen.",
    archetypen: ["Bullbreaker", "Frost Knight", "Voidfist"],
    schliesstAus:
      "Blackguard: keine Peitsche, kein Schild. Matriarch: kein Hammer, keine Support-Geste. Reaver und Barbarian setzen eine geführte Klinge oder Axt voraus, die hier fehlt. Übrig bleiben der massige Fels-Tank, der Frost/Wasser-Ritter und der unbewaffnete Void-Kämpfer — alle drei kommen ohne Waffe in der Hand aus.",
  },
  {
    spieler: "Lulu",
    bild:
      "Junge Frau im Wald auf einem Baumstamm sitzend, hält goldene, leicht schwebende Blätter in der Hand, leichte Stoffkleidung, keine Rüstung, keine Waffe.",
    archetypen: ["Orc Shaman", "Priest"],
    schliesstAus:
      "Matriarch: kein Hammer, keine Rüstung — ihre Geste ist Naturmagie, kein Kampfstand. Cleric operiert laut Kartentext näher an der Gefahr und mit mehr Rüstung als hier zu sehen; sie sitzt unbewaffnet und entspannt im Wald. Übrig bleiben die beiden reinen Zauberwege aus Druid und Healer.",
  },
  {
    spieler: "King Arlen Morgolor",
    bild:
      "Alter König mit weißem Vollbart, goldener Zackenkrone, schwerer gold-silberner Plattenrüstung mit hohen Schulterpanzern und rotem Umhang, Hände leer an der Seite, starre Frontalpose.",
    archetypen: ["Crusader", "Matriarch", "Fighter"],
    schliesstAus:
      "Orc Warrior: er ist Mensch, kein Ork, und seine Pose ist würdevoll statt brutal-stürmend. Barbarian und Steelwind setzen eine geführte Waffe voraus, die hier fehlt. Templar ist zu leicht und sprungbereit für diese massive, stehende Rüstung. Übrig bleiben die schweren, beschützenden Wege aus Warrior und Royalty.",
  },

  // --- Rest-Roster, in der Reihenfolge aus roster-rest-missing.json ---
  {
    spieler: "Lucky",
    bild:
      "Lächelnder Mann mit wildem dunklem Haar auf einem Jahrmarkt, mehrere Wurfmesser quer über der Brust gegürtet, hält einen Beutel Goldmünzen in der Hand.",
    archetypen: ["Rogue", "Steelwind"],
    schliesstAus:
      "Fighter, Orc Warrior, Barbarian (aus Warrior): kein Schwertkampf, kein Ansturm — er trägt nur kleine Wurfklingen und zählt Münzen. Conjurer, Astralwing: kein Magie-Motiv. Die Wurfmesser passen zum schnellen Klingenkämpfer und zum Distanz-Spezialisten mit Wurfwaffen.",
  },
  {
    spieler: "Terradon",
    bild:
      "Menschengroßer Lavakoloss mit geborstener Magmahaut und glühenden Rissen, geballte Fäuste ohne Waffe, Gebirgsschlucht im Hintergrund.",
    archetypen: ["Bullbreaker"],
    schliesstAus:
      "Blackguard: keine Peitsche, kein Schild. Frost Knight: durchgehend Feuer statt Frost. Matriarch: kein Hammer, keine Support-Haltung — er stürmt mit bloßen Fäusten. Übrig bleibt aus Guardian nur der massige, unbewaffnete Koloss.",
  },
  {
    spieler: "Clara",
    bild:
      "Eiskönigin mit gezackter goldener Krone, hält eine leuchtend blaue Eiskugel in der erhobenen Hand, Frostkristalle und Eiswände im Hintergrund.",
    archetypen: ["Ice Mage"],
    schliesstAus:
      "Fire Mage, Lightning Mage: falsches Element, ihre Magie ist durchgehend blau-eisig. Archmage zyklt Arkan/Feuer/Eis im Wechsel — hier ist nur Eis zu sehen. Conjurer: keine Gravitations- oder Fesseleffekte. Priest, Matriarch, Templar (aus Ambassador): sie greift offensiv mit einem Eisball an, keine Rüstung, keine Heilgeste.",
  },
  {
    spieler: "Arachna",
    bild:
      "Spinnenhybride mit menschlichem Oberkörper in dunkler Dornenrüstung, acht lange gepanzerte Spinnenbeine als Unterleib, Zackenkrone, Ruinen im Abendlicht, keine Waffe in den Händen.",
    archetypen: ["Necromancer", "Reaper Mage"],
    schliesstAus:
      "Orc Shaman: keine Totems, keine primal-tribale Ausstattung, sie wirkt herrschaftlich-finster statt schamanisch. Conjurer: keine Gravitations- oder Fesseleffekte zu sehen. Die monströse, dunkle Spinnengestalt passt zu den beiden Wegen dunkler Magie aus Warlock.",
  },
  {
    spieler: "Tavascron",
    bild:
      "Riesiger Transformer-artiger Kampfroboter mit Fahrzeugteilen im Körper, leuchtenden Bernstein-Lichtlinien, geballten Metallfäusten ohne Fernwaffe, brennende Stadt im Hintergrund.",
    archetypen: ["Steelwind", "Bullbreaker", "Fighter"],
    schliesstAus:
      "Crossbowman: keine Armbrust oder Fernwaffe verbaut. Orc Warrior, Barbarian: kein organisches Ork-Motiv, keine geführte Klinge — reine Maschine. Übrig bleiben die Tech-Lesart, die schiere Masse und der allroundtaugliche Muskelkoloss aus Bot und Behemoth.",
  },
  {
    spieler: "Catherine",
    bild:
      "Blonde Kriegerin in goldener Plattenrüstung, schwingt einen großen Kriegshammer über dem Kopf, Vogel-Wappenschild an der Seite, antike Ruinen im Sonnenlicht.",
    archetypen: ["Crusader"],
    schliesstAus:
      "Blackguard: sein Kit ist Peitsche, sie führt einen Hammer. Frost Knight: kein Frost-Motiv. Templar ist zu leicht und sprungbereit für die volle Plattenrüstung mit Turmschild. Cleric, Priest: sie kämpft frontal mit Hammer statt zu heilen. Übrig bleibt der schwere, hammerführende Frontkämpfer.",
  },
  {
    spieler: "Breeze",
    bild:
      "Junge Frau mit Brille hält ein aufgeschlagenes Zauberbuch, goldene arkane Lichtschlieren wirbeln um sie, gotische Torbögen im Hintergrund.",
    archetypen: ["Archmage"],
    schliesstAus:
      "Fire Mage, Ice Mage, Lightning Mage: keine der drei Elementfarben ist zu erkennen, nur reines goldenes Arkan-Licht. Conjurer: keine Gravitations- oder Fesseleffekte, sie liest aus einem Buch statt das Schlachtfeld zu formen. Übrig bleibt der vielseitige Arkan-Weg.",
  },
  {
    spieler: "Wu Tang",
    bild:
      "Baumartige Naturgestalt mit Geweihkrone aus Ästen, Rinden-Körper, geschlossene Augen in meditativer Haltung, Fische schweben ringsum in einem versunkenen Wald.",
    archetypen: ["Orc Shaman"],
    schliesstAus:
      "Thunderclaw, Barbarian, Orc Warrior (aus Creature): kein Ansturm, keine Aggression — sie steht reglos und meditiert. Conjurer, Necromancer: kein arkanes oder totes Motiv, ihre Magie ist eindeutig Natur/Erde. Übrig bleibt aus Pet Master der primal-naturverbundene Weg.",
  },
  {
    spieler: "Dyrth",
    bild:
      "Riesige schwarze Dämonengestalt mit Hörnern, weit ausgebreiteten Flügeln und leuchtend weißen Augen, umklammert schützend ein kleines Kind, mehrere Pfeile stecken in Körper und Flügeln.",
    archetypen: ["Bullbreaker", "Matriarch"],
    schliesstAus:
      "Blackguard: keine Peitsche, kein Schild. Frost Knight: kein Frost-Motiv. Reaper Mage, Astralwing: keine Fernkampf-Magie zu sehen, sie schirmt das Kind mit dem eigenen Körper ab. Übrig bleiben der massige Beschützer und der stützende, Verbündete abschirmende Weg aus Guardian und Fallen Angel.",
  },
  {
    spieler: "Pinkypie",
    bild:
      "Hexe mit großem Spitzhut, aufgerissene leuchtend blaue Augen, hält ein Grimoire mit Pentagramm auf, nächtliche Ruinen mit Wasserfällen im Hintergrund.",
    archetypen: ["Archmage"],
    schliesstAus:
      "Fire Mage, Ice Mage, Lightning Mage: keine passende Elementfarbe oder Effekt sichtbar, nur ein allgemeines Zauberbuch. Conjurer: keine Gravitations- oder Fesseleffekte. Übrig bleibt der vielseitige Arkan-Weg.",
  },
  {
    spieler: "Jihanna",
    bild:
      "Verletzte Elfe mit Tränen im Gesicht, hält zwei blutverschmierte Dolche im Rückhandgriff, zerschlissene leichte Rüstung, staubige Kulisse.",
    archetypen: ["Rogue"],
    schliesstAus:
      "Voidfist: sie kämpft mit geführten Klingen, nicht unbewaffnet. Übrig bleibt aus Assassin allein der Klingenkämpfer.",
  },
  {
    spieler: "Serena",
    bild:
      "Silberhaarige Kriegerin mit Diadem, hält ein einzelnes verziertes Langschwert kampfbereit über dem Kopf, fließende leichte Rüstung, Stadtkulisse.",
    archetypen: ["Rogue", "Fighter"],
    schliesstAus:
      "Spellblade: keine Feuer- oder Zaubereffekte an der Klinge. Conjurer, Astralwing: kein Magie-Motiv. Barbarian, Orc Warrior: ihre Haltung ist elegant-duellierend statt berserkerhaft. Steelwind: kein Krummschwert, keine Wurfsterne. Übrig bleiben der Klingenkämpfer und der allroundtaugliche Schwertkämpfer.",
  },
  {
    spieler: "Nocture",
    bild:
      "Formlose, rauchig-klauenartige Schattengestalt mit rotglühender Energie im Inneren, tastende Fangarme, eine winzige Menschenfigur davor zum Größenvergleich.",
    archetypen: ["Reaper Mage", "Necromancer"],
    schliesstAus:
      "Thunderclaw: die Energie ist rot-glühend, nicht elektrisch-blau. Reaver, Barbarian: keine geführte Axt oder Klinge, keine humanoide Gestalt. Voidfist: kein fassbarer Nahkämpfer-Körper. Übrig bleiben die beiden dunklen Magiewege, die zur körperlosen Erscheinung passen.",
  },
  {
    spieler: "Drop Dead",
    bild:
      "Blonde Kriegerin mit wütendem Blick, kämpft mit zwei Schwertern gleichzeitig, geschulterte Rüstungsteile, rauchiger Hintergrund.",
    archetypen: ["Rogue"],
    schliesstAus:
      "Voidfist: sie führt zwei Klingen, kämpft nicht unbewaffnet. Hunter: kein Fernkampf. Necromancer: kein dunkles Magie-Motiv. Übrig bleibt aus Assassin allein der Klingenkämpfer.",
  },
  {
    spieler: "Nachtschatten",
    bild:
      "Spitzohrige Frau in schwarzem Lederkostüm mit Fledermausmaske, lehnt entspannt auf einer Dachbrüstung vor Vollmond, keine sichtbare Waffe.",
    archetypen: ["Rogue", "Voidfist"],
    schliesstAus:
      "Steelwind: kein Krummschwert, keine Wurfsterne zu sehen. Crusader: keine Rüstung, kein Hammer — sie ist leicht und unbewaffnet. Übrig bleiben der schleichende Dieb und der unbewaffnete Nahkämpfer, zwischen denen das Bild nicht entscheidet.",
  },
  {
    spieler: "Erna Wellenlaut",
    bild:
      "Geflügelte, durchscheinende Fee spielt eine Silberflöte, sanftes Licht, keine Rüstung, keine Waffe.",
    archetypen: ["Priest", "Cleric"],
    schliesstAus:
      "Templar: keine Rüstung, kein Schwert. Lancer, Halberdier: keine Stangenwaffe. Ice Mage: kein Frost-Effekt. Conjurer: keine Gravitations- oder Fesselgeste, sie musiziert statt zu kontrollieren. Übrig bleiben die beiden reinen Support-Heilwege aus Angel.",
  },
  {
    spieler: "Xerathis",
    bild:
      "Grauhäutige Alien-Agentin in schwarzem Tech-Anzug mit leuchtenden Energieadern, Taktikgürtel mit Ausrüstung, futuristischer Raumschiffkorridor.",
    archetypen: ["Rogue"],
    schliesstAus:
      "Crossbowman: keine Armbrust. Astralwing: keine Sternbild-Magie, ihre Adern sind Tech, kein Himmelslicht. Priest, Matriarch, Templar (aus Ambassador): keine Rüstung, keine Heilgeste — der Taktikgürtel und der lautlose Korridor passen zur verdeckt operierenden Agentin.",
  },
  {
    spieler: "Alarm",
    bild:
      "Riesiger Kampfroboter mit rot leuchtendem Sirenenkopf und der Aufschrift „ALARM“, Klauenhände, zertrümmert eine brennende Stadt, ein roter Stöckelschuh statt eines Fußes.",
    archetypen: ["Steelwind", "Bullbreaker"],
    schliesstAus:
      "Fighter, Crossbowman: keine geführte Waffe oder Fernwaffe verbaut, nur Klauen. Blackguard: keine Peitsche, kein Schild. Frost Knight: kein Frost-Motiv. Matriarch: kein Hammer, keine Support-Geste. Übrig bleiben die Tech-Lesart aus Bot und die schiere zermalmende Masse aus Guardian.",
  },
  {
    spieler: "Aurora",
    bild:
      "Blasse Frau in schwarzer Spitzenrobe, blutige Träne im Gesicht, hält einen Kelch mit rotem Wein/Blut in der Hand, Flammenruinen im Hintergrund.",
    archetypen: ["Necromancer", "Reaper Mage"],
    schliesstAus:
      "Hunter, Rogue: keine Waffe, sie trinkt statt zu kämpfen. Die beiden dunklen Magiewege passen zum vampirischen, unbewaffneten Auftreten aus Vampire und Undead.",
  },
  {
    spieler: "Elyon",
    bild:
      "Geflügelter Ritter in schwarz-goldener Plattenrüstung mit Heiligenschein, führt ein langes Schwert und einen Schild, an dem eine Kette hängt.",
    archetypen: ["Blackguard", "Crusader", "Templar"],
    schliesstAus:
      "Priest, Cleric: er kämpft in voller Rüstung mit Schwert statt zu heilen. Rogue, Steelwind: keine Klinge im Verborgenen, keine Wurfsterne — offen geführtes Langschwert. Die Kette am Schild passt zum Zieh-Kit von Blackguard, das Schwert zu den beiden anderen Ritterwegen.",
  },
  {
    spieler: "Vorrak",
    bild:
      "Dunkler Kriegsgolem mit Schulterkanonen, glühend rotem Energiekern und roten Augen, geballte Metallfäuste ohne Handwaffe.",
    archetypen: ["Bullbreaker", "Orc Warrior", "Voidfist"],
    schliesstAus:
      "Blackguard: keine Peitsche, kein Schild. Frost Knight: kein Frost-Motiv. Matriarch: kein Hammer, keine Support-Geste. Reaver, Barbarian: keine geführte Axt oder Klinge. Übrig bleiben die drei unbewaffneten, kraftbasierten Wege aus Guardian, Destroyer und Behemoth.",
  },
  {
    spieler: "Lilly",
    bild:
      "Frau mit Augenklappe hält einen blutigen Dolch, Lederkorsage vor einer Kulisse aus rostigen Zahnrädern.",
    archetypen: ["Rogue"],
    schliesstAus:
      "Voidfist, Monk: sie kämpft mit einer geführten Klinge, nicht unbewaffnet. Übrig bleibt aus Ninja und Assassin allein der Klingenkämpfer.",
  },
  {
    spieler: "Elyssa Nightclaw",
    bild:
      "Echsenwesen in dunkler Kapuzenrüstung, hält einen kleinen Wurfdolch, geschwungener Schwanz, Ruinen bei Vollmond.",
    archetypen: ["Rogue"],
    schliesstAus:
      "Voidfist: sie führt eine Wurfklinge, nicht unbewaffnet. Orc Shaman, Matriarch, Priest (aus Druid): keine Naturmagie-Geste, keine Rüstung eines Heilers — sie ist eine bewaffnete Schleicherin. Übrig bleibt aus Assassin der Klingenkämpfer.",
  },
  {
    spieler: "Lava Golem",
    bild: "Riesiger Koloss aus geschmolzenem Lavagestein, gehörnter Dämonenkopf mit glühenden Augen, unbewaffnete Fäuste, Feuer und Arena im Hintergrund.",
    archetypen: ["Bullbreaker"],
    schliesstAus:
      "Monk, Hunter und Steelwind (aus Wayfarer): keine Klinge, kein Fernkampf, keine präzise Kampfkunst — nur rohe, unbewaffnete Wucht. Barbarian und Orc Warrior (aus Behemoth) fallen ebenfalls weg: er ist kein bewaffneter Humanoider, sondern ein unbewaffneter Elementar-Koloss — wie schon bei Krag'Zul und Rhyx'Tal bleibt dafür nur Bullbreaker übrig. Passt zu den Werten: Power 98 und Health 99 liegen beide nahe am Maximum, Intelligence 1 und Speed 1 schließen jede Magie- oder Fernkampf-Lesart aus.",
  },
  {
    spieler: "Inefinna",
    bild: "Weiße Priesterin mit goldenem Strahlenkranz, Augen geschlossen im Gebet, hält ein Schwert senkrecht vor sich wie eine Reliquie, golddurchwirkte Robe über silberner Verzierung, Tempelstufen im Hintergrund.",
    archetypen: ["Priest"],
    schliesstAus:
      "Rogue, Steelwind und Crusader (aus Vigilante): nichts an der Szene ist verdeckt, geworfen oder mit Kriegshammer bewaffnet — sie steht offen und andächtig, und Crusader führt ohnehin den Hammer statt das Schwert. Matriarch und Templar (aus Ambassador) fallen trotz Schwert ebenfalls weg: mit Power 2 und Health 2 ist sie keine Nah- oder Hybridkämpferin, das Schwert wirkt wie eine gesegnete Reliquie, kein Kampfgerät. Übrig bleibt Priest — reiner Support-Caster, passend zu Intelligence 84, Spirit 89 und Will 70.",
  },
  {
    spieler: "Lulu",
    bild: "Blonde Waldnymphe sitzt barfuß auf Baumwurzeln, lässt goldene Blätter schweben, leichte Wickelkleidung ohne Rüstung, keine Waffe, Wald im Gegenlicht.",
    archetypen: ["Priest"],
    schliesstAus:
      "Orc Shaman (aus Druid) fällt weg: sie ist kein Ork, so wie es die Shaman-Zuordnung schon für vergleichbare Fälle vorsieht. Matriarch (aus Druid und Healer) fällt weg: keine Rüstung, kein Hammer, und Power 2 passt nicht zu einer Nahkampf-Stützerin. Cleric (aus Healer) fällt ebenfalls weg: Cleric operiert laut Kartentext näher an der Gefahr, dafür sind Power 2 und Health 5 zu niedrig. Übrig bleibt Priest — reine Distanz-Unterstützung, passend zu Intelligence 86 und Spirit 88.",
  },
  {
    spieler: "Xelara",
    bild: "Grauhäutige Alien-Diplomatin mit länglichem Schädel und großen schwarzen Augen, schlichte dunkle Lederuniform ohne sichtbare Waffe, futuristische Halle mit der Aufschrift 'DIPLOMACY' im Hintergrund.",
    archetypen: ["Priest"],
    schliesstAus:
      "Blackguard, Bullbreaker und Frost Knight (aus Guardian): keine Peitsche, kein Schild, keine massige Statur, keine Eisausrüstung — und mit Health 15 fehlt jede Tank-Statur. Matriarch und Templar (aus Ambassador) fallen ebenfalls weg: kein Hammer, keine geweihte Panzerung, keine Kampf-Aggression zu sehen — die Szene zeigt reine Diplomatie, wie es die Aufschrift im Hintergrund selbst sagt. Übrig bleibt Priest, die 'Unterstützung'-Lesart von Ambassador, passend zu Charisma 87 und Spirit 84.",
  },

  // ===================================================================================
  // BATCH 3 — 30 Spieler. V-W (Chris' eigenes Team) war nach Batch 2 bereits vollständig
  // abgedeckt, also ging es direkt in den Rest der aktiven Liga: die kompletten
  // Rest-Kader von A-A (Armageddon Aftermath), B-B (Blazing Beasts) und B-P (Black
  // Panthers), dazu der Anfang von C-C (Cash Creators), in Teamreihenfolge.
  //
  // Auffällig oft zeigen die Bilder in dieser Welle keine Menschen, sondern Kreaturen,
  // Schiffe oder sogar ein ganzes Schwarmmonster ohne Waffe in der Hand — die Zuordnung
  // stützt sich dort auf Statur, Verhalten und Motiv statt auf Waffentyp. Wo auch das
  // nicht reicht (Aegirion ist ein Schiff, kein Charakter; Rok Kyl und Roddox Harthelm
  // widersprechen ihrer Servant-Unterklasse; Butterfly ist ein Drache, kein Wayfarer),
  // steht das explizit als Widerspruch für Chris.
  // ===================================================================================

  // --- Rest-Roster A-A (Armageddon Aftermath) ---
  {
    spieler: "Ralazar the Balanced",
    bild:
      "Muskulöser Mann in verzierter Lederrüstung mit Blattmuster-Brustpanzer, violetter Schal, kein sichtbares Schwert, ruhige disziplinierte Haltung vor einem Ruinenbogen.",
    archetypen: ["Fighter"],
    schliesstAus:
      "Orc Warrior, Barbarian (aus Warrior): kein Ork, keine wilde Berserker-Haltung — die Rüstung ist fein gearbeitet und diszipliniert getragen. Steelwind: kein Krummschwert-/Tech-Motiv. BEFUND: Archmage, Fire Mage, Ice Mage, Lightning Mage, Conjurer (aus Mage) finden im Bild keinerlei Deckung — kein Zaubereffekt, nur Rüstung. Die Unterklasse Mage bleibt unbestätigt, übrig bleibt der ruhige, ausbalancierte Nahkämpfer aus Warrior. Widerspruch, Chris vorzulegen.",
  },
  {
    spieler: "Byrnja",
    bild:
      "Blasses Mädchen mit weißblondem Bob, schwarzem Kleid mit weißem Kragen; ein abgeschnittener Tortenboden liegt wie eine Kopfhaube auf ihrem Schädel, eine fremde Hand schneidet mit einem Messer ein Stück heraus — surreales, unheimliches Bild ohne Rüstung oder Waffe in ihrer eigenen Hand.",
    archetypen: ["Reaper Mage", "Necromancer"],
    schliesstAus:
      "Priest, Matriarch, Cleric (aus Servant): keine Heil- oder Dienstgeste, keine Robe. Astralwing (aus Apparition): keine Sterne oder Himmelslicht. Die morbide, entkörperlichte Inszenierung passt zu den beiden dunklen Wegen aus Apparition.",
  },
  {
    spieler: "Elara",
    bild:
      "Silberhaarige Elfe im Wald, spannt einen Langbogen, Köcher mit Pfeilen und zwei Dolche am Gürtel, grüner Umhang, leichte Lederrüstung.",
    archetypen: ["Bowman", "Hunter"],
    schliesstAus:
      "Crossbowman: sie trägt einen Bogen, keine Armbrust — wie bei Cassandra ist damit Chris' eigenes Beispiel beantwortet.",
  },
  {
    spieler: "Aeon Flux",
    bild:
      "Weiblicher Cyborg in schwarzer Techrüstung mit spitzen Antennen-Ohren, führt eine pinke Energieklinge, futuristische Stadt.",
    archetypen: ["Steelwind", "Spellblade"],
    schliesstAus:
      "Rogue, Crossbowman, Bowman (aus Agent/Spec Ops): keine physische Klinge oder Fernkampfwaffe, sondern eine Energiewaffe. Astralwing: keine Sternbilder, das Leuchten ist technisch. Voidfist (aus Augmented): sie führt eine Waffe, kämpft nicht unbewaffnet. Übrig bleiben die beiden technisch-magischen Klingenwege.",
  },
  {
    spieler: "Mindtamer",
    bild:
      "Frau mit gläsernem Helm über einem leuchtenden Gehirn, kontrolliert mit erhobenen Händen schwebende Rauch-/Lichtfäden, unbewaffnet, Gewölbe.",
    archetypen: ["Conjurer"],
    schliesstAus:
      "Necromancer, Reaper Mage (aus Warlock): kein Totenmotiv, keine zehrende Magie — die Fäden werden telekinetisch gelenkt, nicht beschworen. Priest, Matriarch, Templar (aus Ambassador): keine Rüstung, keine Heilgeste, keine diplomatische Pose. Übrig bleibt der kontrollierende Zauberer, der zur Gedankenkontrolle im Namen passt.",
  },
  {
    spieler: "Tidesprinter",
    bild:
      "Blauhäutiger Wassermann/Meeresdämon mit Dreizack, schreiend, Schuppenschwanz, tost aus einem Strudel.",
    archetypen: ["Barbarian"],
    schliesstAus:
      "Rogue, Conjurer, Astralwing (aus Trickster): keine List oder Beschwörung, nur roher Frontalangriff. Fighter, Orc Warrior, Steelwind (aus Warrior): die wilde, ungebändigte Erscheinung mit offenem Maul passt zum Berserker, nicht zum disziplinierten oder technischen Kämpfer.",
  },
  {
    spieler: "Greenkraut",
    bild:
      "Riesiges baumartiges Wesen aus Rinde, trägt behutsam ein Vogelnest mit Küken in den Händen, orangene Blüte auf dem Kopf, Wald.",
    archetypen: ["Orc Shaman", "Bullbreaker"],
    schliesstAus:
      "Conjurer, Necromancer (aus Pet Master): kein Beschwörungseffekt, das Küken ist kein herbeigerufenes Vertrautes, sondern wird nur behütet. Matriarch, Priest (aus Druid): keine Heilgeste an Verbündeten. Barbarian, Orc Warrior (aus Behemoth): keine Aggression, kein Angriff. Übrig bleiben der naturverbundene Schamane für die pflegende Geste und der massige Koloss für die schiere Größe.",
  },

  // --- Rest-Roster B-B (Blazing Beasts) ---
  {
    spieler: "Tsubaki Cleaning",
    bild:
      "Kleines Wesen aus Rinde, Moos und Zweigen mit großen Kulleraugen, besprüht eine Farnpflanze aus einer Sprühflasche, Bonsai im Hintergrund, freundliches Lächeln.",
    archetypen: ["Orc Shaman"],
    schliesstAus:
      "Matriarch, Priest (aus Druid): keine Heil-/Support-Geste an Verbündeten. Hunter, Thunderclaw, Barbarian (aus Jungle): kein Bogen, keine Aggression, keine Kampfhaltung. Übrig bleibt der naturverbundene Weg, der zur pflanzenpflegenden Szene passt.",
  },
  {
    spieler: "Othrama",
    bild:
      "Insektoides schwarzes Wesen mit durchsichtigen Flügeln, glühend grünen Facettenaugen, langen Klauen, kauert im dunklen Regenwald.",
    archetypen: ["Thunderclaw", "Barbarian"],
    schliesstAus:
      "Hunter (aus Jungle): kein Bogen. Orc Warrior (aus Creature): kein Humanoider mit Waffe. Die tierisch-monströse Erscheinung mit Klauen und Fühlern passt zu den beiden Kandidaten, die in Jungle UND Creature zugleich auftauchen.",
  },
  {
    spieler: "Butterfly",
    bild:
      "Ein gewaltiger Drache mit kosmisch schillernden, sternenübersäten Flügeln fliegt in der Abenddämmerung über einen Dschungel.",
    archetypen: ["Hunter"],
    schliesstAus:
      "Monk, Steelwind (aus Wayfarer): kein Nahkampf, kein Kämpfer im eigentlichen Sinn erkennbar. BEFUND: Das Bild zeigt keinen humanoiden Kämpfer, sondern einen Drachen — keiner der drei Wayfarer-Archetypen (Monk, Hunter, Steelwind) bildet ein Flugwesen ab. Hunter bleibt als einzige Lesart stehen, die zumindest den wandernden, distanzierten Charakter von Wayfarer trägt, ist aber keine echte Verengung. Widerspruch, Chris vorzulegen.",
  },
  {
    spieler: "Myrkos",
    bild:
      "Mann mit Fliegerhaube und Schutzbrille, das halbe Gesicht von einer tentakelartigen Parasiten-Kreatur überwuchert, die sich um Hals und Rücken windet, stützt sich auf einen Gehstock, postapokalyptische Landstraße im Nebel.",
    archetypen: ["Voidfist"],
    schliesstAus:
      "Steelwind, Spellblade: keine Techrüstung, keine Klinge — der Stock ist eine Gehhilfe, keine Waffe. Die organische Verschmelzung mit dem Tentakelwesen liest sich als körperliche, waffenlose Veränderung; am ehesten passt der unbewaffnete Nahkämpfer.",
  },
  {
    spieler: "Mavra",
    bild:
      "Weibliche Orkin mit grüner Haut, zerrissenem rotem Top, schwingt eine Streitaxt, Vollmond mit mehreren Monden im Hintergrund.",
    archetypen: ["Orc Warrior", "Barbarian"],
    schliesstAus:
      "Fighter, Steelwind (aus Warrior): zu diszipliniert/technisch für die wilde, zornige Haltung. Thunderclaw, Reaver (aus Beast): kein Elektromotiv, keine zwei Waffen. Sie ist buchstäblich eine Orkin im Kampfrausch — beide Kandidaten, die in Warrior UND Beast zugleich Sinn ergeben, bleiben stehen.",
  },
  {
    spieler: "Murky",
    bild:
      "Sumpfmonster aus tropfendem Moos und Fäulnis, glühend grüne Augen, erhebt sich halb aus dunklem Wasser, keine Waffe.",
    archetypen: ["Barbarian"],
    schliesstAus:
      "Thunderclaw: kein elektrisches oder tierisch-elegantes Motiv, eher zerfließende Fäulnis. Reaver: keine geführte Waffe. Übrig bleibt der rohe, unbewaffnete Nahkämpfer.",
  },
  {
    spieler: "Leviathan",
    bild:
      "Gewaltiger östlicher Drache mit goldener Mähne, an Ketten gelegt, bäumt sich über tosender See vor Vollmond auf.",
    archetypen: ["Bullbreaker", "Thunderclaw"],
    schliesstAus:
      "Die Unterklassen-Liste ist für diesen Spieler leer (Datenlücke im Spielstand) — die Zuordnung stützt sich allein auf das Bild. Ein gekettetes drachenhaftes Kolossalwesen passt am ehesten zum massigen Tank (wie bei Krag'Zul/Terradon/Gram gehandhabt) und zum tierischen Kraftmotiv.",
  },

  // --- Rest-Roster B-P (Black Panthers) ---
  {
    spieler: "Node",
    bild:
      "Schlanker Cyborg mit digitalem Bildschirmkopf, sprintet mit cyanfarbenen Energieschlieren durch eine zerstörte Stadt, keine sichtbare Waffe.",
    archetypen: ["Steelwind", "Rogue"],
    schliesstAus:
      "Bullbreaker, Barbarian, Orc Warrior (aus Behemoth): keine massige Statur, sondern schlank und schnell. Crossbowman, Bowman (aus Bot/Agent): keine Fernkampfwaffe. Astralwing: keine Sternbilder, das Leuchten ist Technik. Übrig bleiben die beiden agilen, technisch-verdeckten Wege.",
  },
  {
    spieler: "Aegirion",
    bild:
      "Riesiges rostiges Frachtschiff mit Schornsteinen und Kranarmen, schwebt auf Antriebsdüsen über einer Stadt, Name „AEGIRION“ am Rumpf — kein humanoider Charakter zu sehen.",
    archetypen: ["Bullbreaker"],
    schliesstAus:
      "BEFUND: Kein Archetyp der Karten bildet ein Schiff ab. Von den verfügbaren Kandidaten aus Behemoth/Bot passt einzig der massige, kolossale Tank noch am ehesten zur schieren Größe — die feineren Bot-Lesarten (Steelwind, Fighter, Crossbowman, Rogue) setzen einen beweglichen Einzelkämpfer voraus, den dieses Bild nicht zeigt. Widerspruch, Chris vorzulegen.",
  },
  {
    spieler: "Starflame",
    bild:
      "Elfische Zauberin in schwarz-goldener Robe, hält einen Kristallstab, in der anderen Hand kreisen goldene Sternzeichen-Ringe, Sternenhimmel.",
    archetypen: ["Archmage", "Conjurer"],
    schliesstAus:
      "Fire Mage, Ice Mage, Lightning Mage (aus Mage): kein Element erkennbar, nur arkanes Sternenlicht. Necromancer, Reaper Mage (aus Warlock): kein Totenmotiv. Übrig bleiben die beiden Wege, die zum kosmisch-arkanen, kontrollierenden Auftreten passen.",
  },
  {
    spieler: "Starbound",
    bild:
      "Kolossales kristallines Sternenwesen mit leuchtendem Kern, umkreist von wirbelnden Energieringen, antike Ruinen.",
    archetypen: ["Astralwing"],
    schliesstAus:
      "Reaper Mage, Necromancer (aus Apparition): kein Totenmotiv, keine zehrende Magie — die Erscheinung ist sternenhaft-kristallin, nicht morbide. Steelwind, Fighter, Crossbowman (aus Bot): keine Maschine, kein Metall. Archmage, Fire Mage, Ice Mage, Lightning Mage, Conjurer (aus Mage): kein Element, kein Stab. Übrig bleibt der sternenumkreiste Weg aus Apparition, der zum kristallinen Kosmoswesen passt.",
  },
  {
    spieler: "Brightpaw",
    bild:
      "Majestätischer weißer Geisterwolf mit leuchtend blauen Runenmarkierungen und drittem Auge auf der Stirn, Lichtkranz, Zauberzeichen ringsum, Wald.",
    archetypen: ["Thunderclaw", "Matriarch"],
    schliesstAus:
      "Barbarian, Reaver (aus Beast): kein grober Nahkämpfer, sondern ein mystisches Tierwesen. Blackguard, Bullbreaker, Frost Knight (aus Guardian): keine Rüstung, kein Panzer. Übrig bleiben das tierische Motiv und die schützend-spirituelle Ausstrahlung, die zur Rolle als Wächter passt.",
  },
  {
    spieler: "Abysskraken",
    bild:
      "Gewaltiges gehörntes Tiefsee-Monster mit Tentakeln, Stachelpanzer und leuchtend blauen Energieadern, brüllt aus dem Wasser.",
    archetypen: ["Barbarian", "Bullbreaker", "Thunderclaw"],
    schliesstAus:
      "Reaver, Voidfist (aus Destroyer): keine geführte Waffe, keine bloßen Fäuste — er ist ein monströser Koloss, keine Kampfstil-Figur. Orc Warrior (aus Behemoth): kein Humanoider. Barbarian ist der einzige Archetyp, der in ALLEN drei Unterklassen-Listen auftaucht — dazu passen Bullbreaker für die schiere Masse und Thunderclaw für die elektrischen Adern.",
  },
  {
    spieler: "Kreischende Kogge",
    bild:
      "Zerfallenes Geisterschiff mit totenkopfförmigem Segel, grün schimmerndem Rumpf, Blitz im Sturm — kein Besatzungsmitglied sichtbar.",
    archetypen: ["Reaper Mage", "Necromancer"],
    schliesstAus:
      "Rogue, Crossbowman, Steelwind (aus Pirate): keine Figur, die eine Waffe führen könnte — es ist das Schiff selbst, das im Bild steht. Das Totenkopfsegel und das Geisterlicht passen zu den beiden Totenwegen aus Wraith.",
  },
  {
    spieler: "Greybeard",
    bild:
      "Alter, muskulöser bärtiger Mann mit Stammestätowierungen am Arm, stützt sich auf einen Wanderstab, Wald.",
    archetypen: ["Orc Shaman", "Barbarian"],
    schliesstAus:
      "Bullbreaker, Orc Warrior (aus Behemoth): kein Humanoider von übermenschlicher Größe, nur ein kräftiger alter Mann. Priest, Ember Priest (aus Shaman): keine geistliche Robe. Reaver (aus Viking): keine geführte Waffe. Die Stammestätowierungen passen zum primalen Schamanen, der massige Körperbau zum rohen Kämpfer.",
  },

  // --- C-C (Cash Creators), Anfang ---
  {
    spieler: "Tropfina",
    bild:
      "Leuchtende Pflanze mit tropfenbesetzten Blättern, wurzelt in einem glühenden türkisen Lichtbecken im Wasser, kein humanoider Körper.",
    archetypen: ["Priest", "Matriarch"],
    schliesstAus:
      "Cleric: keine Rüstung, kein Kampfstil erkennbar — die reine Naturheil-Ästhetik mit leuchtenden Tropfen passt eher zu den beiden lichtgebenden Support-Wegen.",
  },
  {
    spieler: "Roddox Harthelm",
    bild:
      "Muskulöser Stierkopf-Humanoide (Minotaurus) mit Nasenring, stützt sich ruhig auf einen einfachen Holzstab, grüne Wiese.",
    archetypen: ["Barbarian"],
    schliesstAus:
      "Thunderclaw, Reaver (aus Beast): kein elektrisches Motiv, keine zwei Waffen. Priest, Matriarch, Cleric (aus Servant): keine Robe, keine Heilgeste — der Holzstab ist eine Gehhilfe, kein Ritualgegenstand. BEFUND: Das ruhige, fast dienstbare Auftreten passt zu keinem der Beast-Kandidaten, und keiner der Servant-Kandidaten zeigt sich im Bild — übrig bleibt der körperlich stärkste Kandidat aus Beast als am wenigsten falsche Wahl. Widerspruch, Chris vorzulegen.",
  },
  {
    spieler: "Ironhoof",
    bild:
      "Riesiges brüllendes Reptilwesen mit gehörntem Kamm, scharfen Zähnen und Klauen, kauert vor einer Horde ähnlicher Kreaturen, Ödland.",
    archetypen: ["Barbarian", "Orc Warrior"],
    schliesstAus:
      "Fighter, Steelwind (aus Warrior): kein disziplinierter oder technischer Kämpfer, ein rohes Monster. Thunderclaw, Reaver (aus Beast): kein elektrisches Motiv, keine zwei geführten Waffen. Übrig bleiben die beiden wildesten Nahkampf-Lesarten.",
  },
  {
    spieler: "Babuschinka",
    bild:
      "Alte Hexe mit leuchtend blauen Augen, dunkler bestickter Robe, hält ein Bündel Geldscheine und zeigt anklagend mit dem Finger, Marktkulisse.",
    archetypen: ["Conjurer", "Necromancer"],
    schliesstAus:
      "Reaper Mage (aus Warlock): keine zehrende Magie sichtbar. Ember Priest, Archmage (aus Alchemist): kein Element, kein arkaner Effekt. Die manipulative, hexenhafte Erscheinung mit den leuchtenden Augen passt zu den Wegen, die dunkle Kontrolle über Zehrung stellen.",
  },
  {
    spieler: "Rok Kyl",
    bild:
      "Gehörntes reptilienartiges Monster mit aufgerissenem Maul und Klauen, brüllt inmitten einer Kreaturenhorde, unbewaffnet.",
    archetypen: ["Voidfist"],
    schliesstAus:
      "Priest, Matriarch, Cleric (aus Servant): keine Heil- oder Dienstgeste, ein reines Angriffsmonster. Monk, Priest (aus Monk): kein geistlicher/asketischer Habitus erkennbar. BEFUND: Weder das Servant- noch das Monk-Motiv ist im Bild wiederzufinden — übrig bleibt Voidfist als einziger Kandidat, der zumindest den unbewaffneten, mit bloßen Klauen kämpfenden Charakter trifft. Widerspruch, Chris vorzulegen.",
  },
  {
    spieler: "Omniclops",
    bild:
      "Massiger gehörnter Dämon mit violett leuchtender Brust, aggressive Haltung, dunkler Wald mit weiteren Kreaturen.",
    archetypen: ["Bullbreaker"],
    schliesstAus:
      "Priest, Matriarch, Cleric (aus Servant): keine Heil- oder Dienstgeste, ein aggressiver Dämon. Barbarian, Orc Warrior (aus Behemoth): kein Humanoider mit Waffe. Übrig bleibt der massige Tank als Lesart, die der schieren Größe am nächsten kommt.",
  },
  {
    spieler: "Enforcer",
    bild:
      "Geflügelter Krieger in goldener Plattenrüstung mit Kapuze, schwingt einen riesigen Kriegshammer, Heiligenschein, Kreuzsymbol auf der Robe.",
    archetypen: ["Crusader", "Templar"],
    schliesstAus:
      "Frost Knight (aus Knight): kein Frost-Motiv. Blackguard (aus Knight): kein finsteres Auftreten, sondern strahlend-geweiht. Monk, Voidfist, Priest (aus Monk): er ist voll gepanzert und bewaffnet, kein unbewaffneter oder rein geistlicher Kämpfer. Übrig bleiben die beiden geweihten Ritterwege.",
  },
  {
    spieler: "Melody",
    bild:
      "Frau mit rosa Haar und schwarzer Spitzenrobe, spielt Gitarre am Lagerfeuer, umgeben von durchscheinenden geisterhaften Gestalten mit leuchtenden Augen und vermummten Kapuzenfiguren, Wald bei Nacht.",
    archetypen: ["Necromancer", "Reaper Mage"],
    schliesstAus:
      "Priest, Matriarch, Templar (aus Ambassador): keine Rüstung, keine diplomatische Pose. Rogue (aus Vampire): keine Klinge. Die geisterhaften Gestalten, die sie umringen, wirken wie von ihr gerufen — das passt zu den beiden Totenwegen, die in Vampire UND Undead zugleich stehen.",
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

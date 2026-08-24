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

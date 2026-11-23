/**
 * MARKETING: STAMMDATEN (22.11., docs/design/marketing-22-11.md Abschnitte 2 und 3).
 *
 * Reine Tabellen, kein Code: Trait-Tabelle (Reichweite, Ton), Typ-Punkte von Klasse und Rasse, Klassenfarben, Team-Anteil-
 * Punkte der Traits und die 32 Fanprofile (mögen / meiden nur aus ECHTEN Rassen, Klassen und Traits; Start-Farbe aus
 * `data/source/team-identities.json`). Alle Gewichte sind Startwerte der Messung (`scripts/miss-marketing-saison.ts`).
 * Client-sicher: keine Node-Importe.
 */

/** Index in POW, SPE, MEN, SOC. */
export type FarbIndex = 0 | 1 | 2 | 3;
/** Fanfarbe: POW, SPE, MEN, SOC (Summe 20). */
export type Fanfarbe = [number, number, number, number];
export const FARB_NAMEN = ["POW", "SPE", "MEN", "SOC"] as const;

const TRAITS: Array<[string, number, number]> = [
  ["FanFavorite", 12, 1], ["Sexy", 9, 0.2], ["Eloquent", 7, 0.6], ["Cool", 6, 0.3], ["Fearless", 5, 0.2], ["FiredUp", 5, 0],
  ["Ambitious", 3, 0], ["Loyal", 3, 0.6], ["Caring", 3, 0.9], ["Altruistic", 3, 1], ["Fair", 3, 0.9], ["Motivated", 2, 0.3],
  ["Healthy", 1, 0.2], ["Resourceful", 1, 0], ["Flexible", 0, 0], ["Diligent", 0, 0.2], ["Disciplined", 0, 0.3], ["Relaxed", -1, 0.2],
  ["Scandalous", 10, -1], ["Diva", 8, -0.5], ["Renegade", 7, -0.8], ["Egomaniac", 6, -0.6], ["Feisty", 5, -0.5], ["Cruel", 5, -1],
  ["Gambler", 4, -0.4], ["Cheater", 4, -1], ["Vindictive", 3, -0.7], ["Devious", 3, -0.8], ["ColdBlooded", 3, -0.6],
  ["Manipulative", 2, -0.7], ["Obsessive", 1, -0.1], ["Mercenary", -2, -0.4], ["Paranoid", -2, -0.2], ["Lazy", -4, -0.2],
  ["FaintHearted", -4, 0], ["Timid", -6, 0.1],
];

/** Trait: Reichweite und Ton. Ton +1 = Liebling, -1 = Bösewicht. Schlüssel: kleingeschrieben, nur Buchstaben und Ziffern. */
export const TRAIT_TABELLE: Record<string, { name: string; reichweite: number; ton: number }> = Object.fromEntries(
  TRAITS.map(([name, reichweite, ton]) => [name.toLowerCase(), { name, reichweite, ton }]),
);

/** Klasse: Typ-Punkte. */
export const KLASSEN_TYP: Record<string, number> = {
  Bard: 8, Hero: 8, Badass: 8, Warlord: 5, Berserker: 4, Mage: 3, Rogue: 3, Sprinter: 3, Templar: 2, Charger: 2, Tank: 1, Tactician: 0, Overseer: 0,
};
/** Rasse: Typ-Punkte (Seltenheit im Pool). */
export const RASSEN_TYP: Record<string, number> = { Dragon: 6, Voidborn: 5, Divine: 4, Demon: 3, Alien: 3, Mutant: 3, Tauren: 2, Aqua: 2, Lizard: 2 };
/** Klassenfarbe (Index in POW, SPE, MEN, SOC), gespiegelt aus `CLASS_COLOR_MAP` in `lib/lineups/legacy-lineup-modifiers.ts`. */
export const KLASSEN_FARBE: Record<string, FarbIndex> = {
  Berserker: 0, Warlord: 0, Tank: 0, Sprinter: 1, Rogue: 1, Charger: 1, Mage: 2, Overseer: 2, Templar: 2, Bard: 3, Hero: 3, Badass: 3, Tactician: 3,
};

/** Team-Anteil, Baustein Persönlichkeit: wer dem Team mehr gibt (+), wer mehr für sich will (-). Summe begrenzt auf ±20. */
export const TRAIT_TEAM_ANTEIL: Record<string, number> = {
  loyal: 8, altruistic: 8, caring: 5, fair: 4, timid: 3, egomaniac: -10, diva: -8, mercenary: -8, ambitious: -4, manipulative: -4, renegade: -4, gambler: -3,
};
/** Moral-Zuschlag je Trait gewichtet: anderthalbfach bzw. halb. */
export const TRAIT_MORAL_GEWICHT: Record<string, number> = { diva: 1.5, egomaniac: 1.5, mercenary: 1.5, ambitious: 1.5, altruistic: 0.5, timid: 0.5 };

/** Schreibfehler im Pool: Das Marketing liest sie als die korrekte Schreibweise (Konzept Abschnitt 1). */
export const TRAIT_ALIAS: Record<string, string> = { maniupulative: "manipulative" };

export type FanListe = { rassen: string[]; klassen: string[]; traits: string[] };
export type FanProfilDaten = {
  name: string;
  manners: number;
  zielgruppe: string;
  farbeStart: Fanfarbe;
  mag: FanListe;
  meidet: FanListe;
};

/** Die 32 Fanprofile, Schlüssel = teamId. */
export const FANPROFILE: Record<string, FanProfilDaten> = {
  "C-S": { name: "Cold Steel", manners: 10, zielgruppe: "Ehrenfans", farbeStart: [2, 6, 6, 6], mag: { rassen: ["Human","Elf"], klassen: ["Hero","Templar","Sprinter"], traits: ["Fair","Disciplined","Loyal"] }, meidet: { rassen: ["Orc"], klassen: ["Berserker"], traits: ["Cheater","Cruel","Devious"] } },
  "G-G": { name: "Golden Gladiators", manners: 9, zielgruppe: "Heldenfans", farbeStart: [0, 6, 6, 8], mag: { rassen: ["Divine","Human"], klassen: ["Hero","Templar"], traits: ["Fair","Altruistic","Caring","FanFavorite"] }, meidet: { rassen: ["Demon"], klassen: [], traits: ["Cruel","Cheater","Scandalous"] } },
  "B-P": { name: "Black Panthers", manners: 8.5, zielgruppe: "Kennerpublikum", farbeStart: [6, 4, 7, 3], mag: { rassen: ["Human","Alien"], klassen: ["Rogue","Hero"], traits: ["Ambitious","Disciplined","Cool"] }, meidet: { rassen: [], klassen: [], traits: ["Lazy","FaintHearted"] } },
  "T-C": { name: "The Chantry", manners: 8.5, zielgruppe: "Gemeinde", farbeStart: [3, 0, 7, 10], mag: { rassen: ["Divine","Human"], klassen: ["Bard","Templar"], traits: ["Caring","Altruistic","Fair","Loyal"] }, meidet: { rassen: ["Demon"], klassen: ["Berserker"], traits: ["Cruel","Scandalous","Vindictive"] } },
  "N-W": { name: "Natures Wrath", manners: 8, zielgruppe: "Naturfreunde", farbeStart: [4, 4, 6, 6], mag: { rassen: ["Plant","Animal","Elf"], klassen: ["Tank","Mage"], traits: ["Caring","Loyal","Healthy"] }, meidet: { rassen: ["Construct","Demon"], klassen: [], traits: ["Cruel","Mercenary"] } },
  "W-L": { name: "Wrecking Legionnaires", manners: 8, zielgruppe: "Veteranen", farbeStart: [8, 2, 7, 3], mag: { rassen: ["Construct","Orc","Human"], klassen: ["Warlord","Berserker","Tank"], traits: ["Mercenary","Disciplined","Diligent"] }, meidet: { rassen: [], klassen: [], traits: ["FaintHearted","Lazy"] } },
  "M-S": { name: "Mortal Sin", manners: 7.5, zielgruppe: "Familienpublikum", farbeStart: [0, 0, 0, 20], mag: { rassen: ["Divine","Human"], klassen: ["Bard","Hero"], traits: ["Caring","Loyal","Relaxed","FanFavorite","Altruistic"] }, meidet: { rassen: [], klassen: ["Berserker"], traits: ["Diva","Devious","Egomaniac"] } },
  "S-S": { name: "Silver Soldiers", manners: 7.5, zielgruppe: "Technikfans", farbeStart: [7, 5, 6, 2], mag: { rassen: ["Construct"], klassen: ["Warlord","Tactician"], traits: ["Disciplined","Diligent","ColdBlooded"] }, meidet: { rassen: ["Plant","Animal"], klassen: [], traits: ["Lazy","Feisty"] } },
  "V-W": { name: "Vigilante Wranglers", manners: 7, zielgruppe: "Stadtviertel", farbeStart: [3, 0, 4, 13], mag: { rassen: ["Human","Elf"], klassen: ["Hero","Templar","Badass"], traits: ["Fearless","Fair","Altruistic","Cool"] }, meidet: { rassen: ["Demon"], klassen: [], traits: ["FaintHearted","Cruel","Cheater"] } },
  "C-C": { name: "Cash Creators", manners: 6.5, zielgruppe: "Geschäftsleute", farbeStart: [4, 4, 4, 8], mag: { rassen: ["Human","Goblin"], klassen: ["Bard","Tactician"], traits: ["Eloquent","Mercenary","Resourceful"] }, meidet: { rassen: [], klassen: ["Berserker"], traits: ["Lazy"] } },
  "U-A": { name: "Undercover Agents", manners: 6.5, zielgruppe: "Stille Kenner", farbeStart: [3, 12, 3, 2], mag: { rassen: ["Human","Construct"], klassen: ["Sprinter","Rogue","Overseer","Tactician"], traits: ["Disciplined","Cool","ColdBlooded","Resourceful"] }, meidet: { rassen: [], klassen: ["Berserker","Bard"], traits: ["Scandalous","Diva","Feisty"] } },
  "D-P": { name: "Death Peaches", manners: 6, zielgruppe: "Szene", farbeStart: [1, 7, 2, 10], mag: { rassen: ["Demon","Voidborn"], klassen: ["Bard","Rogue"], traits: ["Sexy","Manipulative","Diva"] }, meidet: { rassen: ["Divine","Construct"], klassen: ["Tank"], traits: ["Timid"] } },
  "R-C": { name: "Royal Court", manners: 6, zielgruppe: "Hofgesellschaft", farbeStart: [3, 3, 7, 7], mag: { rassen: ["Human","Elf","Dwarf"], klassen: ["Hero","Templar","Bard"], traits: ["Eloquent","Loyal","Fair"] }, meidet: { rassen: ["Demon","Goblin"], klassen: [], traits: ["Renegade","Scandalous"] } },
  "R-R": { name: "Riptide Rivers", manners: 5.5, zielgruppe: "Küstenvolk", farbeStart: [2, 10, 2, 6], mag: { rassen: ["Aqua","Lizard","Alien"], klassen: ["Sprinter","Overseer"], traits: ["Relaxed","Flexible","Cool"] }, meidet: { rassen: ["Construct"], klassen: [], traits: ["Obsessive"] } },
  "T-T": { name: "Terrible Teachers", manners: 5.5, zielgruppe: "Schülerschaft", farbeStart: [5, 5, 5, 5], mag: { rassen: ["Human","Elf"], klassen: ["Mage","Tactician"], traits: ["Diligent","Motivated","Ambitious","Caring"] }, meidet: { rassen: [], klassen: [], traits: ["Lazy","Diva"] } },
  "V-D": { name: "Vicious & Delicious", manners: 4.5, zielgruppe: "Amazonen-Anhang", farbeStart: [5, 7, 2, 6], mag: { rassen: ["Elf","Human","Animal"], klassen: ["Sprinter","Warlord"], traits: ["Fearless","Feisty","Sexy"] }, meidet: { rassen: ["Construct"], klassen: ["Tank"], traits: ["Timid","Lazy"] } },
  "P-S": { name: "Project Suicide", manners: 4, zielgruppe: "Außenseiter", farbeStart: [9, 1, 6, 4], mag: { rassen: ["Human","Mutant"], klassen: ["Mage","Tank"], traits: ["Obsessive","Paranoid","Diligent","Loyal"] }, meidet: { rassen: [], klassen: ["Bard"], traits: ["Diva","FaintHearted","Lazy"] } },
  "T-G": { name: "The Giants", manners: 4, zielgruppe: "Schaulustige", farbeStart: [16, 2, 2, 0], mag: { rassen: ["Tauren","Dragon","Orc"], klassen: ["Tank","Berserker","Charger"], traits: ["Fearless","Healthy"] }, meidet: { rassen: ["Gnom","Dwarf","Goblin"], klassen: ["Rogue"], traits: ["Timid","FaintHearted"] } },
  "B-B": { name: "Blazing Beasts", manners: 3, zielgruppe: "Rudel", farbeStart: [10, 10, 0, 0], mag: { rassen: ["Animal","Tauren","Dragon"], klassen: ["Berserker","Charger"], traits: ["Feisty","FiredUp"] }, meidet: { rassen: ["Construct"], klassen: ["Tactician"], traits: ["Timid"] } },
  "W-W": { name: "Wicked Wizards", manners: 3, zielgruppe: "Zirkel", farbeStart: [0, 0, 18, 2], mag: { rassen: ["Demon","Elf","Voidborn"], klassen: ["Mage","Tactician","Overseer"], traits: ["Obsessive","Manipulative","Ambitious"] }, meidet: { rassen: ["Animal","Tauren"], klassen: ["Berserker"], traits: ["Lazy"] } },
  "L-R": { name: "Last Ride", manners: 2.5, zielgruppe: "Totenkult", farbeStart: [6, 0, 11, 3], mag: { rassen: ["Human","Demon"], klassen: ["Mage","Tank"], traits: ["ColdBlooded","Fearless","Cruel"] }, meidet: { rassen: ["Divine"], klassen: ["Bard"], traits: ["FaintHearted","Caring"] } },
  "M-M": { name: "Mayhem Mavericks", manners: 2.5, zielgruppe: "Ultras", farbeStart: [7, 9, 0, 4], mag: { rassen: ["Orc","Tauren"], klassen: ["Berserker","Rogue","Warlord"], traits: ["Ambitious","Fearless","Egomaniac","Mercenary"] }, meidet: { rassen: [], klassen: ["Bard"], traits: ["Lazy","Timid","FaintHearted"] } },
  "S-C": { name: "Stronghold Crusaders", manners: 2.5, zielgruppe: "Eiferer", farbeStart: [12, 0, 3, 5], mag: { rassen: ["Human"], klassen: ["Templar","Warlord","Tank"], traits: ["Fearless","Obsessive","Cruel","Disciplined"] }, meidet: { rassen: [], klassen: ["Bard"], traits: ["FaintHearted","Relaxed","Caring"] } },
  "L-K": { name: "Lost Kingdom", manners: 1.5, zielgruppe: "Gefallener Adel", farbeStart: [6, 6, 8, 0], mag: { rassen: ["Human","Voidborn"], klassen: ["Mage","Templar","Warlord"], traits: ["ColdBlooded","Vindictive","Diva"] }, meidet: { rassen: ["Divine"], klassen: [], traits: ["Caring","Altruistic"] } },
  "P-C": { name: "Pirate Crew", manners: 1.5, zielgruppe: "Hafenkneipe", farbeStart: [1, 6, 6, 7], mag: { rassen: ["Human","Aqua","Dwarf"], klassen: ["Rogue","Badass"], traits: ["Gambler","Cheater","Renegade","Mercenary"] }, meidet: { rassen: [], klassen: ["Templar"], traits: ["Fair","Disciplined","Timid"] } },
  "R-L": { name: "Raging Lunatics", manners: 1.5, zielgruppe: "Chaoten", farbeStart: [8, 10, 0, 2], mag: { rassen: ["Animal","Plant","Tauren"], klassen: ["Charger","Berserker"], traits: ["Feisty","FiredUp","Renegade"] }, meidet: { rassen: ["Construct"], klassen: ["Tactician"], traits: ["Disciplined","Fair","Timid"] } },
  "V-V": { name: "Vigorous Vikings", manners: 1.5, zielgruppe: "Raubzug", farbeStart: [8, 8, 1, 3], mag: { rassen: ["Human","Dwarf"], klassen: ["Berserker","Warlord"], traits: ["Fearless","FiredUp","Feisty","Loyal"] }, meidet: { rassen: [], klassen: ["Bard","Tactician"], traits: ["Timid","FaintHearted"] } },
  "A-A": { name: "Armageddon Aftermath", manners: 1, zielgruppe: "Endzeit", farbeStart: [0, 18, 2, 0], mag: { rassen: ["Mutant","Voidborn"], klassen: ["Sprinter","Rogue"], traits: ["Renegade","Fearless"] }, meidet: { rassen: ["Divine"], klassen: ["Templar"], traits: ["Timid","Disciplined"] } },
  "D-L": { name: "Dire Legion", manners: 1, zielgruppe: "Hardliner", farbeStart: [10, 0, 0, 10], mag: { rassen: ["Human"], klassen: ["Warlord","Tank","Tactician"], traits: ["Disciplined","Loyal","ColdBlooded"] }, meidet: { rassen: ["Elf","Dwarf","Orc","Goblin","Demon","Animal","Construct","Alien"], klassen: [], traits: ["Renegade","Lazy"] } },
  "H-R": { name: "Hell Raisers", manners: 1, zielgruppe: "Bösewicht-Fans", farbeStart: [7, 8, 5, 0], mag: { rassen: ["Demon"], klassen: ["Berserker","Warlord"], traits: ["Cruel","Scandalous","Renegade","FiredUp"] }, meidet: { rassen: ["Divine"], klassen: ["Hero"], traits: ["Fair","Altruistic","Caring","Timid"] } },
  "N-N": { name: "Nunchuck Ninjas", manners: 1, zielgruppe: "Schattenfans", farbeStart: [0, 12, 5, 3], mag: { rassen: ["Human","Elf"], klassen: ["Sprinter","Rogue","Overseer"], traits: ["Devious","ColdBlooded","Disciplined"] }, meidet: { rassen: ["Tauren"], klassen: ["Tank"], traits: ["Fair","Caring"] } },
  "Z-H": { name: "Zero Heroes", manners: 1, zielgruppe: "Zocker", farbeStart: [6, 6, 4, 4], mag: { rassen: ["Lizard","Dragon"], klassen: ["Charger","Badass"], traits: ["Gambler","Ambitious","Fearless"] }, meidet: { rassen: [], klassen: [], traits: ["FaintHearted","Timid","Relaxed"] } },
};

import type { PlayerGeneratorAttributeName, PlayerGeneratorRoleIntent } from "@/lib/data/olyDataTypes";

export type PlayerGeneratorAxisKey = "pow" | "spe" | "men" | "soc";

export type PlayerGeneratorRoleProfile = {
  label: string;
  axisBias: Record<PlayerGeneratorAxisKey, number>;
  peakAttributes: PlayerGeneratorAttributeName[];
  secondaryPeakAttributes: PlayerGeneratorAttributeName[];
  weakAttributes: PlayerGeneratorAttributeName[];
  preferredClasses: string[];
  preferredSubclasses: string[];
  minPeakCount: number;
  spreadFloor: number;
  antiFlatBand: number;
  antiFlatLimit: number;
  roleSummary: string[];
};

export const darkSupportArchetypes = new Set(["undead", "demon", "construct"]);

export const playerGeneratorRoleProfiles: Record<PlayerGeneratorRoleIntent, PlayerGeneratorRoleProfile> = {
  offense: {
    label: "Offense",
    axisBias: { pow: 12, spe: 10, men: -4, soc: -6 },
    peakAttributes: ["power", "speed", "dexterity"],
    secondaryPeakAttributes: ["torment", "awareness", "determination"],
    weakAttributes: ["spirit", "charisma", "will"],
    preferredClasses: ["Rogue", "Berserker", "Sprinter", "Charger", "Warlord", "Badass"],
    preferredSubclasses: ["Assassin", "Warrior", "Executioner", "Spec Ops", "Hunter", "Ninja"],
    minPeakCount: 2,
    spreadFloor: 22,
    antiFlatBand: 8,
    antiFlatLimit: 8,
    roleSummary: [
      "Mindestens zwei klare Spitzenwerte im Angriff oder in explosiver Athletik.",
      "Support-Werte duerfen sichtbar abfallen.",
    ],
  },
  defense: {
    label: "Defense",
    axisBias: { pow: 10, spe: -2, men: 7, soc: -3 },
    peakAttributes: ["health", "stamina", "will", "determination"],
    secondaryPeakAttributes: ["power", "awareness"],
    weakAttributes: ["charisma", "torment", "spirit"],
    preferredClasses: ["Tank", "Templar", "Warlord", "Hero", "Overseer"],
    preferredSubclasses: ["Guardian", "Knight", "Warrior", "Behemoth", "Controller"],
    minPeakCount: 2,
    spreadFloor: 22,
    antiFlatBand: 8,
    antiFlatLimit: 8,
    roleSummary: [
      "Defensive Kernwerte muessen deutlich ueber dem Rest liegen.",
      "Mobilitaet oder Show duerfen sichtbar schwacher sein.",
    ],
  },
  support: {
    label: "Support",
    axisBias: { pow: -8, spe: 0, men: 10, soc: 14 },
    peakAttributes: ["spirit", "charisma", "awareness", "will"],
    secondaryPeakAttributes: ["determination", "intelligence"],
    weakAttributes: ["power", "health"],
    preferredClasses: ["Bard", "Overseer", "Mage", "Tactician", "Templar", "Hero"],
    preferredSubclasses: ["Healer", "Cleric", "Ambassador", "Strategist", "Angel", "Shaman"],
    minPeakCount: 3,
    spreadFloor: 18,
    antiFlatBand: 7,
    antiFlatLimit: 8,
    roleSummary: [
      "Mindestens drei Support-Werte muessen sichtbar ueber Durchschnitt liegen.",
      "Dark-Support darf Spirit gegen Intelligence, Will und Awareness tauschen, aber nicht komplett flach werden.",
    ],
  },
  allround: {
    label: "Allround",
    axisBias: { pow: 3, spe: 3, men: 3, soc: 3 },
    peakAttributes: ["power", "awareness", "determination", "speed"],
    secondaryPeakAttributes: ["will", "charisma"],
    weakAttributes: ["torment", "spirit"],
    preferredClasses: ["Hero", "Overseer", "Tactician", "Warlord", "Templar"],
    preferredSubclasses: ["Captain", "Strategist", "Scout", "Warrior", "Wayfarer"],
    minPeakCount: 1,
    spreadFloor: 12,
    antiFlatBand: 6,
    antiFlatLimit: 8,
    roleSummary: [
      "Ausgewogen, aber nie komplett flach.",
      "Mindestens eine erkennbare Spitze und eine erkennbare Schwaeche bleiben erhalten.",
    ],
  },
  specialist: {
    label: "Specialist",
    axisBias: { pow: 8, spe: 8, men: 4, soc: -8 },
    peakAttributes: ["power", "speed", "intelligence", "spirit"],
    secondaryPeakAttributes: ["dexterity", "torment", "will"],
    weakAttributes: ["health", "charisma", "determination"],
    preferredClasses: ["Rogue", "Mage", "Sprinter", "Bard", "Tank", "Tactician"],
    preferredSubclasses: ["Assassin", "Strategist", "Ninja", "Warlock", "Prime Evil"],
    minPeakCount: 2,
    spreadFloor: 26,
    antiFlatBand: 8,
    antiFlatLimit: 7,
    roleSummary: [
      "Zwei bis drei sehr hohe Kernwerte.",
      "Mehrere klare Schwaechen gehoeren bewusst dazu.",
    ],
  },
  chaos: {
    label: "Chaos",
    axisBias: { pow: 8, spe: 8, men: -2, soc: 8 },
    peakAttributes: ["power", "speed", "torment", "charisma"],
    secondaryPeakAttributes: ["intelligence", "awareness", "spirit"],
    weakAttributes: ["health", "will", "determination"],
    preferredClasses: ["Berserker", "Badass", "Mage", "Overseer", "Rogue"],
    preferredSubclasses: ["Maniac", "Prime Evil", "Trickster", "Succubus", "Rebel"],
    minPeakCount: 2,
    spreadFloor: 30,
    antiFlatBand: 9,
    antiFlatLimit: 7,
    roleSummary: [
      "Extreme Staerken und Schwaechen sind gewuenscht.",
      "Der Archetyp darf trotzdem nicht brechen.",
    ],
  },
};


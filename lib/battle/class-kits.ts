// ===================================================================================
// KLASSENKITS — welche Skills eine Klasse mitbringt.
//
// Wie das Archetypen-Verzeichnis ist diese Datei eine ABSCHRIFT. Jede Zahl steht so
// auf der Klassenkarte, die Chris geschickt hat. Wer hier etwas ändert, muss die
// Karte dazu haben. Beschreibungen bleiben im englischen Original — sie sind die
// Quelle, eine Übersetzung wäre schon eine Auslegung.
//
// WAS DIE ERSTEN ZWEI KARTEN VERRATEN
//
// Cleric und Priest teilen sich NEUN Skills (Medium Dash, Holy Light, Holy Shield,
// Lay On Hands, Chain Bond, Chain Heal, Desperate Prayer, Divine Transposition,
// Resurrection). Ein Kit ist also keine eigene Skill-Liste je Klasse, sondern eine
// AUSWAHL aus einem gemeinsamen Pool. Deshalb steht der Pool hier einmal und die
// Klassen verweisen nur darauf — sonst stünde Holy Light irgendwann in dreißig
// Fassungen da, die auseinanderdriften.
//
// Und jeder Skill trägt zwei unabhängige Marken:
//   - RARITAET  (Common / Uncommon / Rare) — wie selten er ist
//   - ZUGANG    (guaranteed / learnable)   — ob die Klasse ihn IMMER hat oder ihn
//                                            beim Stufenaufstieg lernen kann
// Beide Klassen haben genau ZWEI garantierte Skills, und einer davon ist bei beiden
// Medium Dash. Der andere ist der, der die Klasse ausmacht: Guided Hand beim Cleric,
// Magic Heal beim Priest. Das deckt sich mit dem, was die Eslabong-Entwickler
// veröffentlicht haben ("Fighters now start with only 1 ability on LVL1, so you can
// better customize them") — der Rest wird gewählt, nicht vergeben.
// ===================================================================================

/** Die Seltenheitsstufe, die rechts auf der Karte steht. */
export type Raritaet = "Common" | "Uncommon" | "Rare";

/** Ob die Klasse den Skill immer hat oder ihn erst lernen muss. */
export type Zugang = "guaranteed" | "learnable";

/**
 * Ein Skill, so wie die Karte ihn beschreibt.
 *
 * ALLE Zahlenfelder sind optional, weil die Karte selbst nur die nennt, die für
 * diesen Skill gelten. Ein fehlendes Feld heißt "die Karte sagt dazu nichts" — es
 * heißt NICHT null. Der Unterschied ist wichtig: Magic Heal nennt keine MP-Kosten,
 * und das ist eine Aussage über Magic Heal, keine Lücke in der Abschrift.
 */
export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly raritaet: Raritaet;
  /** Der Beschreibungstext der Karte, unübersetzt. */
  readonly text: string;

  /** Schaden an Gegnern. */
  readonly dmg?: number;
  /** Heilung als fester Betrag. */
  readonly heal?: number;
  /** Heilung als Anteil der maximalen Lebenspunkte des ZIELS, in Prozent. */
  readonly healMaxHpProzent?: number;
  /** Heilung, die auf den Zaubernden selbst zurückfällt. */
  readonly selbstHeal?: number;
  /** Schild, der Schaden schluckt, bevor er auf die Lebenspunkte geht. */
  readonly schild?: number;
  /** Reichweite in denselben Einheiten wie auf der Karte. */
  readonly range?: number;
  /** Rückstoß. */
  readonly knockback?: number;
  /** Wie lange die Wirkung anhält, in Sekunden. */
  readonly dauer?: number;
  /** Abklingzeit in Sekunden. */
  readonly cd?: number;
  /** Ansagezeit in Sekunden, bevor die Wirkung eintritt. */
  readonly castzeit?: number;
  /** Manakosten. */
  readonly mp?: number;
  /** Ausdauerkosten. */
  readonly sp?: number;
  /** Macht den Wirkenden für die Dauer unverwundbar. */
  readonly unverwundbar?: boolean;
  /**
   * Alles, was die Karte nennt, aber kein eigenes Feld verdient, weil es bisher nur
   * einmal vorkommt. Lieber hier sichtbar als stillschweigend weggelassen.
   */
  readonly sonst?: Readonly<Record<string, number | string | boolean>>;
}

/**
 * DER GEMEINSAME SKILL-POOL.
 *
 * Bisher aus zwei Karten gefüllt (Cleric, Priest). Jede weitere Karte fügt hier
 * Skills hinzu und trägt bei den geteilten nur den Verweis nach — sie darf einen
 * bestehenden Eintrag NICHT ändern. Weicht eine Karte bei einem geteilten Skill in
 * einer Zahl ab, ist das ein Befund und keine Kleinigkeit: dann hängen die Werte
 * doch an der Klasse, und diese ganze Datei ist falsch gebaut.
 */
export const SKILL_POOL: readonly Skill[] = [
  // --- Common ---------------------------------------------------------------------
  {
    id: "guided-hand",
    name: "Guided Hand",
    raritaet: "Common",
    text: "A sacred orb that follows your command. Heals allies or damages enemies. Highly maneuverable.",
    dmg: 30,
    heal: 26,
    range: 2600,
    knockback: 10,
    cd: 2,
    castzeit: 1,
    sp: 1,
  },
  {
    id: "magic-heal",
    name: "Magic Heal",
    raritaet: "Common",
    text: "A simple magic heal. No projectile and long range.",
    heal: 16,
    range: 1800,
    cd: 1,
    castzeit: 1,
  },
  {
    id: "medium-dash",
    name: "Medium Dash",
    raritaet: "Common",
    text: "Standard balanced Dash.",
    dauer: 0.3,
    unverwundbar: true,
    range: 130,
    cd: 4,
    sp: 20,
  },
  {
    id: "holy-light",
    name: "Holy Light",
    raritaet: "Common",
    text: "Heals a single ally with holy light.",
    heal: 30,
    range: 1200,
    cd: 11,
    castzeit: 0.6,
    mp: 40,
  },
  {
    id: "holy-shield",
    name: "Holy Shield",
    raritaet: "Common",
    text: "Surrounds allies with a protective shield that absorbs damage.",
    schild: 70,
    dauer: 10,
    cd: 8,
    castzeit: 0.8,
    mp: 40,
  },
  {
    id: "lay-on-hands",
    name: "Lay On Hands",
    raritaet: "Common",
    text: "A brief, warm touch that mends an ally's wounds. Close range.",
    healMaxHpProzent: 15,
    range: 130,
    cd: 9,
    castzeit: 0.1,
    mp: 25,
    sonst: { nurBeruehrung: true },
  },
  {
    id: "mend",
    name: "Mend",
    raritaet: "Common",
    text: "A swift blessing that mends a single ally instantly, healing for a % of his max health.",
    healMaxHpProzent: 15,
    range: 800,
    cd: 15,
    mp: 30,
  },
  {
    id: "shield-bash",
    name: "Shield Bash",
    raritaet: "Common",
    text: "Lunge forward and slam your shield into an enemy, stunning and knocking them back.",
    dmg: 22,
    range: 65,
    knockback: 400,
    cd: 10,
    castzeit: 0.1,
    sp: 20,
    // Die Karte nennt ZWEI Dauern: 0,2 s fuer den Ausfallschritt und 1,5 s fuer die
    // Betaeubung. `dauer` traegt den Schritt, die Betaeubung steht eigens da.
    dauer: 0.2,
    sonst: { betaeubungDauer: 1.5 },
  },

  // --- Uncommon -------------------------------------------------------------------
  {
    id: "chain-bond",
    name: "Chain Bond",
    raritaet: "Uncommon",
    text: "Focuses the chain healing energy into a single ally instead of letting it jump, pouring in a much stronger heal and echoing part of it back to restore the caster too.",
    heal: 30,
    selbstHeal: 15,
    range: 500,
    cd: 12,
    castzeit: 0.3,
    mp: 42,
  },
  {
    id: "chain-heal",
    name: "Chain Heal",
    raritaet: "Uncommon",
    text: "Channels healing energy that chains between nearby allies, restoring health to multiple targets.",
    heal: 15,
    selbstHeal: 19,
    range: 380,
    cd: 8,
    castzeit: 0.4,
    mp: 45,
    sonst: { sprungweite: 300, spruenge: 4 },
  },
  {
    id: "desperate-prayer",
    name: "Desperate Prayer",
    raritaet: "Uncommon",
    text: "Release an emergency prayer that repels nearby enemies and heals the caster once for every enemy pushed.",
    dmg: 5,
    heal: 15,
    range: 90,
    cd: 12,
    castzeit: 0.2,
    mp: 25,
  },
  {
    id: "divine-call",
    name: "Divine Call",
    raritaet: "Uncommon",
    text: "The angels recall an ally to your side, also healing them by a small amount.",
    heal: 20,
    cd: 12,
    castzeit: 0.5,
    mp: 40,
  },
  {
    id: "divine-light",
    name: "Divine Light",
    raritaet: "Uncommon",
    text: "Fires a larger bolt of holy light that pierces through everything, healing allies or damaging enemies depending on their faction.",
    dmg: 30,
    heal: 32,
    range: 1000,
    cd: 9,
    castzeit: 0.8,
    mp: 35,
    sp: 1,
  },
  {
    id: "divine-transposition",
    name: "Divine Transposition",
    raritaet: "Uncommon",
    text: "Swap positions with any nearby ally and heal them.",
    heal: 38,
    schild: 75,
    range: 380,
    cd: 16,
    castzeit: 0.1,
    sp: 40,
  },
  {
    id: "guiding-light",
    name: "Guiding Light",
    raritaet: "Uncommon",
    text: "Launches a slow-drifting mote of light that follows your cursor and heals everyone that it passes through.",
    heal: 34,
    range: 1880,
    cd: 8,
    castzeit: 0.2,
    mp: 35,
    sonst: { heilungJeGetroffenemVerbuendeten: 45, durchdringt: true },
  },

  // --- Rare -----------------------------------------------------------------------
  {
    id: "holy-step",
    name: "Holy Step",
    raritaet: "Rare",
    text: "Dash forward in a burst of holy light, gaining Blessed attacks.",
    range: 200,
    dauer: 6,
    cd: 13,
    mp: 20,
    sp: 20,
    sonst: { tempo: 500, schadenPlusProzent: 25 },
  },
  {
    id: "resurrection",
    name: "Resurrection",
    raritaet: "Rare",
    text: "Revives the closest fallen ally within cast AoE.",
    range: 500,
    cd: 24,
    castzeit: 2,
    mp: 35,
    sonst: { unverwundbarDauer: 1.5, wiederbelebungHpProzent: 35 },
  },
  {
    id: "sacred-mend",
    name: "Sacred Mend",
    raritaet: "Rare",
    text: "Channels sacred energy into a single ally, mending their wounds in proportion to their max HP.",
    healMaxHpProzent: 30,
    range: 800,
    cd: 20,
    castzeit: 1,
    mp: 45,
  },
  {
    id: "sanctuary",
    name: "Sanctuary",
    raritaet: "Rare",
    text: "Bathe all nearby allies in holy light, granting them regeneration.",
    range: 250,
    dauer: 8,
    cd: 20,
    castzeit: 1,
    mp: 70,
    sonst: { wirkung: "Regeneration", heilungJeSekunde: 8 },
  },
];

const POOL_NACH_ID = new Map(SKILL_POOL.map((s) => [s.id, s] as const));

/** Ein Eintrag im Kit einer Klasse: welcher Skill, und wie die Klasse an ihn kommt. */
export interface KitEintrag {
  readonly skillId: string;
  readonly zugang: Zugang;
}

export interface ClassKit {
  /** Kennung der Klasse, kleingeschrieben mit Bindestrich. */
  readonly id: string;
  /** Der Name, wie er auf der Karte steht. */
  readonly name: string;
  readonly eintraege: readonly KitEintrag[];
  /**
   * Wahr, wenn die Karte im Screenshot abgeschnitten war und noch Skills fehlen
   * können. Lieber hier vermerkt als später für vollständig gehalten.
   */
  readonly unvollstaendig?: boolean;
}

const g = (skillId: string): KitEintrag => ({ skillId, zugang: "guaranteed" });
const l = (skillId: string): KitEintrag => ({ skillId, zugang: "learnable" });

export const CLASS_KITS: readonly ClassKit[] = [
  {
    id: "cleric",
    name: "Cleric",
    eintraege: [
      g("guided-hand"),
      g("medium-dash"),
      l("holy-light"),
      l("holy-shield"),
      l("lay-on-hands"),
      l("shield-bash"),
      l("chain-bond"),
      l("chain-heal"),
      l("desperate-prayer"),
      l("divine-transposition"),
      l("guiding-light"),
      l("holy-step"),
      l("resurrection"),
      l("sanctuary"),
    ],
  },
  {
    id: "priest",
    name: "Priest",
    eintraege: [
      g("magic-heal"),
      g("medium-dash"),
      l("holy-light"),
      l("holy-shield"),
      l("lay-on-hands"),
      l("mend"),
      l("chain-bond"),
      l("chain-heal"),
      l("desperate-prayer"),
      l("divine-call"),
      l("divine-light"),
      l("divine-transposition"),
      l("resurrection"),
      l("sacred-mend"),
    ],
    // Die Liste bricht im Screenshot mitten in Sacred Mend ab. Was danach kommt,
    // weiß ich nicht — also steht es auch nicht drin.
    unvollstaendig: true,
  },
];

export function skillById(id: string): Skill | undefined {
  return POOL_NACH_ID.get(id);
}

export function kitById(id: string): ClassKit | undefined {
  return CLASS_KITS.find((k) => k.id === id);
}

/** Die Skills eines Kits, aufgelöst — in der Reihenfolge der Karte. */
export function skillsVonKit(kitId: string): readonly Skill[] {
  const kit = kitById(kitId);
  if (!kit) return [];
  return kit.eintraege.map((e) => POOL_NACH_ID.get(e.skillId)).filter((s): s is Skill => Boolean(s));
}

/** Die Skills, die eine Klasse IMMER hat — das, was sie ausmacht. */
export function garantierteSkills(kitId: string): readonly Skill[] {
  const kit = kitById(kitId);
  if (!kit) return [];
  return kit.eintraege
    .filter((e) => e.zugang === "guaranteed")
    .map((e) => POOL_NACH_ID.get(e.skillId))
    .filter((s): s is Skill => Boolean(s));
}

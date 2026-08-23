// ===================================================================================
// ARCHETYPEN — die Klassen, aus denen ein Kämpfer in der Battle Arena gebaut wird.
//
// Diese Datei ist eine ABSCHRIFT, keine Erfindung. Jede Zahl steht so auf der
// Klassenkarte, die Chris geschickt hat. Das ist bewusst so: der Entwurf der Arena
// hatte neun von achtzehn Spielerklassen falsch, weil ich sie gesetzt statt
// nachgeschlagen habe. Wer hier etwas ändert, muss die Karte dazu haben.
//
// Die Beschreibungen bleiben im englischen Original — sie sind die Quelle, und eine
// Übersetzung wäre schon eine Auslegung.
//
// Die Klassenkits (welche Skills eine Klasse hat) reicht Chris später nach. Bis dahin
// ist `kit` leer, und zwar sichtbar leer statt mit Platzhaltern gefüllt.
// ===================================================================================

/** Die Rolle, die auf der Karte über der Beschreibung steht. */
export type ArchetypeRole = "DPS" | "TANK" | "HYBRID" | "CONTROLLER" | "SUPPORT" | "ASSASSIN";

/**
 * Eine Wertespanne von der Karte, z. B. Leben 102–189.
 *
 * Was die beiden Enden BEDEUTEN, ist noch offen: ob sie Stufe 1 bis Höchststufe
 * meinen oder das schwächste bis stärkste Mitglied der Klasse. Für die Anbindung
 * unserer zwölf Attribute macht das den Unterschied, deshalb steht es hier als
 * offene Frage und nicht als stille Annahme.
 */
export type Spanne = readonly [min: number, max: number];

/**
 * Über ALLE Karten und alle vier Werte gilt: max = round(min × 13/7).
 * Bei 35 Archetypen treffen 132 von 140 Spannen das exakt; die acht Grenzfälle liegen
 * ausnahmslos genau eins daneben und erklären sich damit, dass die Karte den Startwert
 * auf eine ganze Zahl abschneidet, aber mit dem Kommawert rechnet.
 *
 * Das heißt: die Spanne ist KEINE Balance-Entscheidung je Klasse, sondern eine
 * gemeinsame Wachstumskurve. Eine Klasse unterscheidet sich nur durch ihren
 * Startwert — und durch ihr Kit.
 */
export const WACHSTUM = 13 / 7;

export interface Archetype {
  /** Kleingeschriebener Schlüssel, z. B. "bowman". */
  readonly id: string;
  /** Name wie auf der Karte. */
  readonly name: string;
  readonly role: ArchetypeRole;
  /** Originaltext der Karte. */
  readonly description: string;
  readonly hp: Spanne;
  readonly atk: Spanne;
  readonly def: Spanne;
  readonly spd: Spanne;
  /** Prozent, wie auf der Karte. */
  readonly stunResist: number;
  readonly knockbackResist: number;
  readonly mana: number;
  /** Je Sekunde. */
  readonly manaRegen: number;
  readonly stamina: number;
  /** Je Sekunde. */
  readonly staminaRegen: number;
  /** Klassenkit — kommt später von Chris. */
  readonly kit: readonly string[];
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: "archmage",
    name: "Archmage",
    role: "DPS",
    description:
      "The Archmage is an elite, high cost class with unparalleled versatility. They cycle Arcane, Fire, and Ice through a three-slot orb. Using Invoke reads the active trio to trigger a powerful spell matching the exact pattern. Each slotted element also grants a passive bonus: Arcane boosts Move Speed, Fire boosts Damage, and Ice boosts Defense.",
    hp: [126, 234],
    atk: [56, 104],
    def: [7, 13],
    spd: [105, 195],
    stunResist: 5,
    knockbackResist: 5,
    mana: 150,
    manaRegen: 30,
    stamina: 80,
    staminaRegen: 12,
    kit: [],
  },
  {
    id: "astralwing",
    name: "Astralwing",
    role: "DPS",
    description:
      "Vesperak astralwings create magical constellations around themselves and attack from behind their orbiting stars. While any constellation is active, their Lesser Star attack become much faster to cast. They are mid range damage dealers that provide sustained celestial barrage.",
    hp: [109, 202],
    atk: [84, 156],
    def: [11, 20],
    spd: [105, 195],
    stunResist: 10,
    knockbackResist: 10,
    mana: 100,
    manaRegen: 25,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "barbarian",
    name: "Barbarian",
    role: "DPS",
    description:
      "Barbarians are strong melee blenders built for messy fights. Barbarians spin through crowds, chase low-health targets with executes, and snowball pressure through bloodrage, bleeding strikes, and brutal close range disruption. They are at their best when enemies are too close together and too late to leave.",
    hp: [196, 364],
    atk: [70, 130],
    def: [14, 26],
    spd: [105, 195],
    stunResist: 20,
    knockbackResist: 50,
    mana: 100,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 30,
    kit: [],
  },
  {
    id: "blackguard",
    name: "Blackguard",
    role: "TANK",
    description:
      "The Blackguards are a whip and shield controllers who punish anyone entering their reach. Blackguards pull enemies out of position, slam and stun them, drain life, and survive behind dark barriers and retaliatory armor. With very high survivability, every pull, bash or barrier makes fighting on their terms harder to escape.",
    hp: [158, 293],
    atk: [70, 130],
    def: [59, 111],
    spd: [98, 182],
    stunResist: 20,
    knockbackResist: 30,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 25,
    kit: [],
  },
  {
    id: "bowman",
    name: "Bowman",
    role: "DPS",
    description:
      "Bowman is a steady ranged fighter with flexible pressure tools. Bowmen charge precise shots, spread arrows through cones and barrages, rain fire from above, apply burns or roots, and use sprint to keep distance. Their value comes from constant ranged pressure that never gives wounded targets room.",
    hp: [102, 189],
    atk: [77, 143],
    def: [7, 13],
    spd: [109, 202],
    stunResist: 0,
    knockbackResist: 0,
    mana: 100,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "bullbreaker",
    name: "Bullbreaker",
    role: "TANK",
    description:
      "The Bullbreaker is a massive minotaur tank who plows through enemy formations like bowling pins. The Bullbreaker's signature ability is their grab and throw, and while minotaurs are generally slow, they have plenty of mobility options in their arsenal to horn rush through lines and skewer multiple enemies. Bullbreakers have 40% natural stun resistance.",
    hp: [210, 390],
    atk: [70, 130],
    def: [56, 104],
    spd: [91, 169],
    stunResist: 40,
    knockbackResist: 40,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 20,
    kit: [],
  },
  {
    id: "cleric",
    name: "Cleric",
    role: "HYBRID",
    description:
      "Cleric is a battle-support healer who can operate closer to danger. Clerics guide a controllable holy orb, heal and resurrect allies, shield the team, step forward with blessed attacks, and stun enemies with shield bashes. They keep allies alive without giving enemies an easy support target to remove.",
    hp: [91, 169],
    atk: [70, 130],
    def: [42, 78],
    spd: [98, 182],
    stunResist: 5,
    knockbackResist: 5,
    mana: 120,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 20,
    kit: [],
  },
  {
    id: "conjurer",
    name: "Conjurer",
    role: "CONTROLLER",
    description:
      "The Conjurer is an arcane control mage who shapes the battlefield instead of summoning minions. They disrupt enemy positioning with repulsor beams, gravity wells, and polymorph hexes, while protecting allies with shields and tracking missiles. By pulling targets together or forcing them apart, they dictate exactly where and how the fight happens.",
    hp: [112, 208],
    atk: [70, 130],
    def: [18, 33],
    spd: [105, 195],
    stunResist: 0,
    knockbackResist: 0,
    mana: 100,
    manaRegen: 30,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "crossbowman",
    name: "Crossbowman",
    role: "DPS",
    description:
      "Crossbowman are tactical marksmen with heavier burst and more control than a standard archer. Crossbowmen lock targets with nets and traps, fire power bolts and different types of arbalest shots. Their weakness is the lack of mobility, but they compensate for it with their long-range firepower.",
    hp: [84, 156],
    atk: [70, 130],
    def: [21, 39],
    spd: [98, 182],
    stunResist: 0,
    knockbackResist: 5,
    mana: 100,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "crusader",
    name: "Crusader",
    role: "HYBRID",
    description:
      "Crusader is a heavy holy frontliner who protects while forcing enemies to respect his zone. Crusaders throw stunning hammers, call down holy lightning, charge, heal, revive, block projectiles with wards, swap-shield allies, and punish clustered targets. An hybrid class that can take part in almost every role.",
    hp: [140, 260],
    atk: [70, 130],
    def: [49, 91],
    spd: [98, 182],
    stunResist: 20,
    knockbackResist: 25,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 15,
    kit: [],
  },
  {
    id: "ember-priest",
    name: "Ember Priest",
    role: "HYBRID",
    description:
      "A hybrid of fire magic and sacred healing. The Ember Priest wields flame as both weapon and medicine, scorching enemies while keeping allies alive through the heat of battle. With their special resurrection spells and damage abilities,, these supports are a flexible class that every team needs.",
    hp: [102, 189],
    atk: [70, 130],
    def: [11, 20],
    spd: [105, 195],
    stunResist: 5,
    knockbackResist: 5,
    mana: 100,
    manaRegen: 28,
    stamina: 100,
    staminaRegen: 8,
    kit: [],
  },
  {
    id: "fighter",
    name: "Fighter",
    role: "TANK",
    description:
      "The Fighter is a flexible bruiser with answers for almost any brawl. Fighters mix charges, leaps, hooks, war cries, and different melee attacks to keep enemies pinned while adapting to the battle. Their strength is having the right kind of pressure for whatever the encounter becomes and having good all-around stats.",
    hp: [161, 299],
    atk: [70, 130],
    def: [49, 91],
    spd: [105, 195],
    stunResist: 15,
    knockbackResist: 30,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 25,
    kit: [],
  },
  {
    id: "fire-mage",
    name: "Fire Mage",
    role: "DPS",
    description:
      "Fire Mage is a destructive area caster who turns space into a hazard. Fire Mages pressure teams with burning waves, novas, flamethrowers, charged meteors, volcanic eruptions and explosive mobility. They excel at turning tightly packed groups into absolute chaos.",
    hp: [105, 195],
    atk: [70, 130],
    def: [11, 20],
    spd: [105, 195],
    stunResist: 0,
    knockbackResist: 5,
    mana: 100,
    manaRegen: 25,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "frost-knight",
    name: "Frost Knight",
    role: "HYBRID",
    description:
      "Frost Knights are a slow but heavy frost warrior built around setup and punishment. Frost Knights blanket enemies in slows, protect allies with frozen armor, then cash in with shatter strikes and ice shards that hit harder against slowed targets. Their slows do more than delay enemies, and they can fulfill different roles.",
    hp: [165, 306],
    atk: [70, 130],
    def: [42, 78],
    spd: [102, 189],
    stunResist: 20,
    knockbackResist: 25,
    mana: 100,
    manaRegen: 8,
    stamina: 100,
    staminaRegen: 22.5,
    kit: [],
  },
  {
    id: "goblin-archer",
    name: "Goblin Archer",
    role: "DPS",
    description:
      "Goblin Archer is a fragile but slippery disruptor who wins by making enemies waste time. Goblin Archers root, poison, slow, lure targets with coins, panic-fire odd projectiles, and roll backward when the fight gets too honest. They survive by turning every chase into a trap, a slow, or a wasted rotation.",
    hp: [77, 143],
    atk: [77, 143],
    def: [11, 20],
    spd: [140, 260],
    stunResist: 0,
    knockbackResist: 0,
    mana: 100,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "halberdier",
    name: "Halberdier",
    role: "CONTROLLER",
    description:
      "Halberdiers are disciplined polearm masters who dominate the midline. Many of their strikes grant Super Armor, letting them shrug off stuns and push straight through incoming hits, and their wide cleaves, hooking pulls, and crashing charges make them nightmares for enemies who try to close the gap.",
    hp: [165, 306],
    atk: [70, 130],
    def: [49, 91],
    spd: [105, 195],
    stunResist: 20,
    knockbackResist: 10,
    // Einziger Archetyp bisher, der nicht bei 100/100 startet.
    mana: 80,
    manaRegen: 7,
    stamina: 110,
    staminaRegen: 18,
    kit: [],
  },
  {
    id: "hunter",
    name: "Hunter",
    role: "DPS",
    description:
      "The Hunter believes every problem can be solved from a safe distance and preferably behind 300 pounds of angry Wild Boar. While his boar gets 25% of the hunter's stats, his arrows can also sail harmlessly over his companion's head. His traps cover the flanks, and if things go wrong, well... that's what the boar is for.",
    hp: [122, 228],
    atk: [63, 117],
    def: [28, 52],
    spd: [91, 169],
    stunResist: 0,
    knockbackResist: 0,
    mana: 100,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 12,
    kit: [],
  },
  {
    id: "ice-mage",
    name: "Ice Mage",
    role: "CONTROLLER",
    description:
      "Ice Mage is a control caster who wins by slowing the fight down. Ice Mages use frost bombs, waves, blizzards and freeze effects, with several abilities having bonus damage against slowed enemies. Ice Mages try to lock fights into favorable positions, while their control creates the cleanest kills when allies are ready to follow up.",
    hp: [98, 182],
    atk: [70, 130],
    def: [11, 20],
    spd: [112, 208],
    stunResist: 10,
    knockbackResist: 5,
    mana: 100,
    manaRegen: 25,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "lancer",
    name: "Lancer",
    role: "CONTROLLER",
    description:
      "Lancers are fast spear fighters who control the midline before enemies can settle. Their effective spears have a long lunge with heavy knockback. Blending phantom illusions with physical crowd control, they disrupt enemy advances using nets, javelins, and spear sweeps. They turn enemy movement into openings before the frontline ever fully forms.",
    hp: [151, 280],
    atk: [70, 130],
    def: [21, 39],
    spd: [115, 215],
    stunResist: 10,
    knockbackResist: 20,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 25,
    kit: [],
  },
  {
    id: "lightning-mage",
    name: "Lightning Mage",
    role: "DPS",
    description:
      "The Lightning Mage is a high-tempo, mid-range caster focused on instant impact and electrical pressure. They excel at chaining damage between targets, channeling disabling beams, blinking through danger, and punishing clustered teams with storms. While their reach is limited, most of their electrical strikes pass harmlessly through allies.",
    hp: [122, 228],
    atk: [70, 130],
    def: [18, 33],
    spd: [105, 195],
    stunResist: 5,
    knockbackResist: 5,
    mana: 100,
    manaRegen: 25,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "matriarch",
    name: "Matriarch",
    role: "SUPPORT",
    description:
      "Matriarchs are a paladin class built around sustain, disruption, and hammer control. Matriarchs keep allies alive with heals, shields, resurrection, and swaps while using heavy knockback and hammer strikes to break enemy formations. They stabilize broken fights and push the team back into formation.",
    hp: [140, 260],
    atk: [63, 117],
    def: [56, 104],
    spd: [98, 182],
    stunResist: 10,
    knockbackResist: 15,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 15,
    kit: [],
  },
  {
    id: "monk",
    name: "Monk",
    role: "DPS",
    description:
      "Monk is a precise martial fighter built around rapid strikes and a special kick dash. While Monks doesn't have heavy attacks, they chain palm and kick attacks with excelent parry and guard abilities. Monks use inner shields for protection and telekinesis spells to control and disrupt enemies.",
    hp: [154, 286],
    atk: [70, 130],
    def: [18, 33],
    spd: [115, 215],
    stunResist: 10,
    knockbackResist: 15,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    // Mit Abstand der hoechste Wert im Bestand — der naechste liegt bei 30.
    staminaRegen: 56.2,
    kit: [],
  },
  {
    id: "necromancer",
    name: "Necromancer",
    role: "CONTROLLER",
    description:
      "Necromancer is a summoner who turns death magic into constant battlefield pressure. Necromancers drain life, spread fear, and raise different types of skeletons: fighters, archers, and mages. Each skeleton is raised with 20% of the Necromancer's stats, so a stronger Necromancer means a stronger horde. Since summoning costs HP, they hide behind their undead frontline while the battle spirals out of control. Their strength comes from forcing enemies to waste time on summons while the real caster keeps the army growing.",
    hp: [81, 150],
    atk: [49, 91],
    def: [7, 13],
    spd: [102, 189],
    stunResist: 0,
    knockbackResist: 0,
    mana: 100,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 25,
    kit: [],
  },
  {
    id: "orc-shaman",
    name: "Orc Shaman",
    role: "SUPPORT",
    description:
      "Orc Shaman is a primal support-controller who makes chaotic fights favor his team. Shamans combine chain lightning, rejuvenation, bloodlust, spirit shields, hexes, fear, petrification, roots and earth magic to disrupt enemies while empowering allies. They make chaotic fights favor their side through buffs, fear and storm magic.",
    hp: [161, 299],
    atk: [70, 130],
    def: [7, 13],
    spd: [102, 189],
    stunResist: 10,
    knockbackResist: 10,
    mana: 100,
    manaRegen: 20,
    stamina: 100,
    staminaRegen: 15,
    kit: [],
  },
  {
    id: "orc-warrior",
    name: "Orc Warrior",
    role: "TANK",
    description:
      "Orc Warriors are brutal pressure fighters who win through impact and momentum. Orc Warriors have lots of lockdown abilities like charge, headbutt, hook, and rock throw. They also execute wounded enemies, enter bloodrage, and sustain through bleeding rend attacks. Their pressure demands an answer before their raw damage becomes a full problem for the other team.",
    hp: [196, 364],
    atk: [70, 130],
    def: [11, 20],
    spd: [102, 189],
    stunResist: 20,
    knockbackResist: 30,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 20,
    kit: [],
  },
  {
    id: "priest",
    name: "Priest",
    role: "SUPPORT",
    description:
      "Priest is a pure support caster who keeps the team alive through positioning and recovery. Priests heal single targets or chains, resurrect fallen allies, shield groups, grant sanctuary regeneration, recall allies, swap positions, and push enemies away when cornered. Their saves are strongest when timing turns a collapse into a second chance.",
    hp: [91, 169],
    atk: [70, 130],
    def: [11, 20],
    spd: [109, 202],
    stunResist: 0,
    knockbackResist: 0,
    mana: 120,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 20,
    kit: [],
  },
  {
    id: "reaper-mage",
    name: "Reaper Mage",
    role: "HYBRID",
    description:
      "The Reaper Mage is a long-range artillery mage built around beams, missiles, turrets, and catastrophic warheads. They excel at creating lethal lanes, defending against projectiles, and blinking in and out while making large areas unsafe to cross. Followers of The One, these mages are pure glass cannons with tremendous offensive potential.",
    hp: [88, 163],
    atk: [70, 130],
    def: [11, 20],
    spd: [105, 195],
    stunResist: 10,
    knockbackResist: 10,
    mana: 100,
    manaRegen: 25,
    stamina: 100,
    staminaRegen: 10,
    kit: [],
  },
  {
    id: "reaver",
    name: "Reaver",
    role: "DPS",
    description:
      "Reavers are barbarian skirmishers who dominate the mid-range with heavy, ricocheting, explosive, bleeding, and life-draining axes. Their throws build Momentum, granting 15% increased damage per stack for 3 seconds, up to 4 stacks. Hops and primal leaps keep them moving and empower their next attacks.",
    hp: [161, 299],
    atk: [70, 130],
    def: [18, 33],
    spd: [112, 208],
    stunResist: 10,
    knockbackResist: 15,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 20,
    kit: [],
  },
  {
    id: "rogue",
    name: "Rogue",
    role: "ASSASSIN",
    description:
      "Rogue is a fast assassin class built around mobility, slows, and sudden target access. They deal double damage from behind and dash roll constantly. Rogues blink behind enemies and finish enemies with bleeding cuts. They usually try to flank and are most dangerous when one isolated enemy loses track of the angle.",
    hp: [133, 247],
    atk: [77, 143],
    def: [11, 20],
    spd: [122, 228],
    stunResist: 5,
    knockbackResist: 0,
    mana: 100,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 30,
    kit: [],
  },
  {
    id: "spellblade",
    name: "Spellblade",
    role: "DPS",
    description:
      "Spellblade is a fire-rogue hybrid who turns melee openings into spell explosions. Spellblades mix rolls and shadow dashes with flame dashes, blazing blinks, echo strikes, fire barriers, novas, waves, and close-range breath attacks. They force opponents to respect melee range and spell range at the same time.",
    hp: [137, 254],
    atk: [77, 143],
    def: [35, 65],
    spd: [112, 208],
    stunResist: 10,
    knockbackResist: 10,
    mana: 100,
    manaRegen: 25,
    stamina: 100,
    staminaRegen: 25,
    kit: [],
  },
  {
    id: "steelwind",
    name: "Steelwind",
    role: "DPS",
    description:
      "Master of the flying steel. The Steelwind is a high risk and high reward specialist built around a scimitar and throwing big shuriken weapons. They have good ranged mid-range options, while their basic attacks leave targets to bleed out. To survive, they rely on a blade defense that shreds incoming projectiles, keeping them alive to deliver catastrophic damage to the team.",
    hp: [140, 260],
    atk: [70, 130],
    def: [28, 52],
    spd: [112, 208],
    stunResist: 10,
    knockbackResist: 10,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 28,
    kit: [],
  },
  {
    id: "stormhorn",
    name: "Stormhorn",
    role: "HYBRID",
    description:
      "Stormhorn is a minotaur shaman class who mixes elemental control with brute force. Stormhorns call lightning storms, place storm totems and tether enemies, while supporting allies with rejuvenation and volt shields. They use blood thunder magic to deal excellent damage amd have natural 20% bonus resistance to stuns.",
    hp: [154, 286],
    atk: [63, 117],
    def: [28, 52],
    spd: [98, 182],
    stunResist: 20,
    knockbackResist: 10,
    mana: 100,
    manaRegen: 15,
    stamina: 100,
    staminaRegen: 15,
    kit: [],
  },
  {
    id: "templar",
    name: "Templar",
    role: "HYBRID",
    description:
      "Templars are agile holy warriors who trade the Crusader's heavy armor and resilience for mobility and relentless offense. They dive into battle with Heavenly Jump and crush enemy with several AOE attacks. Faster, deadlier, and far less durable, Templars excel at breaking formations, turning holy power into pure aggression.",
    hp: [140, 260],
    atk: [77, 143],
    def: [11, 20],
    spd: [112, 208],
    stunResist: 0,
    knockbackResist: 20,
    mana: 100,
    manaRegen: 10,
    stamina: 100,
    staminaRegen: 20,
    kit: [],
  },
  {
    id: "thunderclaw",
    name: "Thunderclaw",
    role: "DPS",
    description:
      "Thunderclaw is a lightning duelist class built for pursuit, counters, and explosive windows. Thunderclaws have a special thunder dash, can pounce into stuns, mark enemies for delayed detonations, counter incoming hits, and overload basic attacks with electricity. Their speed turns small positioning errors into marks, shocks, and sudden collapse.",
    hp: [133, 247],
    atk: [70, 130],
    def: [28, 52],
    spd: [112, 208],
    stunResist: 15,
    knockbackResist: 20,
    mana: 100,
    manaRegen: 18,
    stamina: 100,
    staminaRegen: 22,
    kit: [],
  },
  {
    id: "voidfist",
    name: "Voidfist",
    role: "DPS",
    description:
      "As the dark counterpart to the traditional Monk, Voidfist is a martial controller who builds Void Marks on enemies before detonating them for a massive payoff. Also known as 'the tank killer', most of his skills apply these marks and allow the class to focus on bursting down high-priority targets.",
    hp: [154, 286],
    atk: [70, 130],
    def: [18, 33],
    spd: [112, 208],
    stunResist: 10,
    knockbackResist: 15,
    mana: 100,
    manaRegen: 5,
    stamina: 100,
    staminaRegen: 35,
    kit: [],
  },
];

const NACH_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

export function archetypeById(id: string): Archetype | undefined {
  return NACH_ID.get(id);
}

/**
 * Wo ein Spieler innerhalb der Spanne seiner Klasse landet, wenn `anteil` von 0
 * (unteres Ende) bis 1 (oberes Ende) läuft. Die Anbindung unserer zwölf Attribute
 * an diesen Anteil ist bewusst NICHT hier — solange offen ist, was die Enden der
 * Spanne bedeuten, wäre jede Formel dafür geraten.
 */
export function ausSpanne(spanne: Spanne, anteil: number): number {
  const a = Math.min(1, Math.max(0, anteil));
  return spanne[0] + (spanne[1] - spanne[0]) * a;
}

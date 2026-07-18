import type { PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import { getFatiguePerformancePenaltyPercent, getFatigueRiskLevel } from "@/lib/fatigue/fatigue-calibration";
import {
  officialDisciplineWeightLabels,
  officialDisciplineWeightMatrix,
  officialDisciplineWeightOrder,
  playerGeneratorAttributeKeys,
  type OfficialDisciplineWeightId,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";

export type MatchdayIntensityStage = "conserve" | "normal" | "push";

export type MatchdaySlotRoleWeightProfile = Partial<Record<PlayerGeneratorAttributeKey, number>>;

export type MatchdaySlotRoleKeyAttribute = {
  attribute: PlayerGeneratorAttributeKey;
  weightPct: number;
  baseWeightPct: number;
  deltaPct: number;
  emphasis: "primary" | "secondary" | "support";
};

export type MatchdaySlotRoleDefinition = {
  roleId: string;
  label: string;
  description: string;
  majorPositiveAttribute: PlayerGeneratorAttributeKey;
  minorPositiveAttribute: PlayerGeneratorAttributeKey;
  strainAttribute: PlayerGeneratorAttributeKey;
  fatigueProfile: "low" | "medium" | "high";
  classHints?: string[];
  riskLabel?: string;
  disciplineId?: OfficialDisciplineWeightId;
  baseWeightProfile?: MatchdaySlotRoleWeightProfile;
  slotWeightProfile?: MatchdaySlotRoleWeightProfile;
  keyAttributes?: MatchdaySlotRoleKeyAttribute[];
};

type SlotRoleTheme = {
  roleId: string;
  label: string;
  description: string;
  focus: PlayerGeneratorAttributeKey[];
  strain: PlayerGeneratorAttributeKey;
  fatigueProfile: MatchdaySlotRoleDefinition["fatigueProfile"];
  classHints?: string[];
  riskLabel?: string;
};

export type MatchdayProjectedPreview = {
  baseScore: number | null;
  roleModifier: number;
  intensityModifier: number;
  fatigueModifier: number;
  fatiguePenaltyPercent: number;
  rivalryPressureModifier: number;
  additionalFatigue: number;
  totalProjected: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  fatigueRisk: "niedrig" | "mittel" | "hoch";
  slotStrainLoad: "niedrig" | "mittel" | "hoch";
  strainRiskScore: number;
  warnings: string[];
};

const SLOT_PROFILE_MODIFIER_SCALE = 2.2;

const INTENSITY_CONFIG: Record<
  MatchdayIntensityStage,
  {
    label: string;
    scoreModifier: number;
    fatigueBase: number;
    additionalFatigueCap: number;
    rangeLowPercent: number;
    rangeHighPercent: number;
    strainLoadModifier: number;
  }
> = {
  conserve: { label: "Schonen", scoreModifier: -2, fatigueBase: 1, additionalFatigueCap: 5, rangeLowPercent: -0.02, rangeHighPercent: 0.01, strainLoadModifier: -1 },
  normal: { label: "Normal", scoreModifier: 0, fatigueBase: 3, additionalFatigueCap: 8, rangeLowPercent: -0.05, rangeHighPercent: 0.05, strainLoadModifier: 0 },
  push: { label: "Push", scoreModifier: 3, fatigueBase: 4, additionalFatigueCap: 11, rangeLowPercent: -0.03, rangeHighPercent: 0.07, strainLoadModifier: 2 },
};

const DISCIPLINE_ROLE_THEMES: Record<OfficialDisciplineWeightId, SlotRoleTheme[]> = {
  tdm: [
    roleTheme("vanguard", "Vanguard", "Oeffnet Teamfights mit Power und Health.", ["power", "health"], "stamina", "high", ["tank", "berserker"]),
    roleTheme("skirmisher", "Skirmisher", "Sucht schnelle Picks und haelt Tempo im Fight.", ["stamina", "spirit"], "health", "medium", ["hero", "charger"]),
    roleTheme("shotcaller", "Shotcaller", "Ordnet den Fight über Intelligence und Charisma.", ["charisma", "intelligence"], "power", "low", ["tactician", "bard"]),
    roleTheme("holdline", "Hold Line", "Stabilisiert knappe Phasen mit Health und Determination.", ["health", "determination"], "stamina", "medium", ["tank"]),
    roleTheme("rallypoint", "Rally Point", "Hebt Team-Momentum über Spirit und Charisma.", ["spirit", "charisma"], "power", "low", ["bard", "hero"]),
    roleTheme("breaker", "Breaker", "Bricht Widerstand mit Power und Torment.", ["power", "torment"], "awareness", "high", ["berserker", "renegade"]),
  ],
  "mini-dm": [
    roleTheme("frontliner", "Frontliner", "Nimmt Druck auf und stabilisiert den Einstieg.", ["health", "power"], "stamina", "high", ["tank", "berserker"]),
    roleTheme("finisher", "Finisher", "Schliesst Fights über Torment-Spitzen ab.", ["torment", "dexterity"], "will", "medium", ["rogue", "charger"]),
    roleTheme("trickfighter", "Trick Fighter", "Findet Winkel über Dexterity und Will.", ["dexterity", "will"], "health", "medium", ["rogue"]),
    roleTheme("ironguard", "Iron Guard", "Bleibt im Chaos stehen und frisst Druck.", ["health", "stamina"], "torment", "high", ["tank"]),
    roleTheme("chaosdriver", "Chaos Driver", "Erzwingt Tempo über Torment und Power.", ["torment", "power"], "stamina", "high", ["berserker", "renegade"]),
    roleTheme("lasthit", "Last Hit", "Braucht Nerven für den finalen Zugriff.", ["will", "torment"], "dexterity", "medium", ["hero"]),
  ],
  battlefield: [
    roleTheme("commander", "Commander", "Fuehrt grosse Situationen über Charisma und Intelligence.", ["charisma", "intelligence"], "health", "low", ["tactician", "bard"]),
    roleTheme("spotter", "Spotter", "Liest Lücken und Ziele über Awareness.", ["awareness", "intelligence"], "power", "low", ["overseer"]),
    roleTheme("siegecore", "Siege Core", "Drueckt Fronten mit Power und Torment.", ["power", "torment"], "health", "high", ["berserker"]),
    roleTheme("moraleanchor", "Morale Anchor", "Haelt Linien über Spirit und Charisma zusammen.", ["spirit", "charisma"], "torment", "medium", ["bard", "hero"]),
    roleTheme("fieldcontrol", "Field Control", "Kontrolliert Raum über Intelligence und Spirit.", ["intelligence", "spirit"], "power", "low", ["tactician"]),
    roleTheme("disruptor", "Disruptor", "Stoert gegnerische Plaene mit Torment und Awareness.", ["torment", "awareness"], "health", "medium", ["rogue", "renegade"]),
  ],
  gewichtheben: [
    roleTheme("poweropener", "Power Opener", "Setzt die Basis über maximale Power.", ["power", "health"], "stamina", "high", ["tank", "golem"]),
    roleTheme("safelift", "Safe Lift", "Sichert Punkte über Health und Determination.", ["health", "determination"], "power", "low", ["tank", "hero"]),
    roleTheme("pressurelift", "Pressure Lift", "Geht aggressiv in schwere Versuche.", ["charisma", "power"], "health", "high", ["hero", "berserker"]),
    roleTheme("technicallift", "Technical Lift", "Belohnt saubere Ausfuehrung über Dexterity und Speed.", ["dexterity", "speed"], "power", "medium", ["rogue"]),
    roleTheme("gripanchor", "Grip Anchor", "Haelt über Will und Determination, wenn es eng wird.", ["will", "determination"], "health", "medium", ["hero"]),
    roleTheme("finalattempt", "Final Attempt", "Lebt vom grossen Moment und Charisma.", ["charisma", "will"], "stamina", "medium", ["bard", "hero"]),
  ],
  climbing: [
    roleTheme("routereader", "Route Reader", "Findet die Linie über Determination und Awareness.", ["determination", "awareness"], "stamina", "low", ["overseer"]),
    roleTheme("gripspecialist", "Grip Specialist", "Braucht Dexterity und Power für harte Zuege.", ["dexterity", "power"], "health", "medium", ["rogue"]),
    roleTheme("paceclimber", "Pace Climber", "Haelt Tempo über Stamina und Speed.", ["stamina", "speed"], "will", "medium", ["sprinter"]),
    roleTheme("endurancewall", "Endurance Wall", "Klettert stabil über Stamina und Health.", ["stamina", "health"], "dexterity", "high", ["tank"]),
    roleTheme("dynamicmove", "Dynamic Move", "Sucht explosive Zuege über Speed und Dexterity.", ["speed", "dexterity"], "determination", "medium", ["charger"]),
    roleTheme("summitpush", "Summit Push", "Zieht den Schluss über Determination und Will.", ["determination", "will"], "stamina", "high", ["hero"]),
  ],
  staffel: [
    roleTheme("startrunner", "Start Runner", "Bringt die Staffel mit Speed in Position.", ["speed", "stamina"], "awareness", "medium", ["sprinter"]),
    roleTheme("tempolink", "Tempo Link", "Haelt Zwischenzeiten über Stamina und Spirit.", ["stamina", "spirit"], "speed", "medium", ["hero"]),
    roleTheme("batontech", "Baton Tech", "Sichert Wechsel über Awareness und Dexterity.", ["awareness", "dexterity"], "stamina", "low", ["rogue"]),
    roleTheme("curverunner", "Curve Runner", "Braucht Speed und Will für schwierige Abschnitte.", ["speed", "will"], "dexterity", "medium", ["sprinter"]),
    roleTheme("chaserunner", "Chase Runner", "Jagt Rückstände mit Spirit und Speed.", ["spirit", "speed"], "stamina", "high", ["charger"]),
    roleTheme("anchor", "Anchor", "Schliesst die Staffel über Spirit und Charisma.", ["spirit", "charisma"], "stamina", "medium", ["bard", "hero"]),
  ],
  "time-trial": [
    roleTheme("pacer", "Pacer", "Haelt die Linie über Dexterity und Speed.", ["dexterity", "speed"], "stamina", "medium", ["sprinter"]),
    roleTheme("linereader", "Line Reader", "Findet Sekunden über Intelligence und Awareness.", ["intelligence", "awareness"], "speed", "low", ["tactician"]),
    roleTheme("aerodrive", "Aero Drive", "Drueckt Geschwindigkeit über Speed.", ["speed", "dexterity"], "intelligence", "medium", ["sprinter"]),
    roleTheme("splitcontrol", "Split Control", "Kontrolliert Zwischenzeiten über Intelligence.", ["intelligence", "stamina"], "dexterity", "low", ["overseer"]),
    roleTheme("risksegment", "Risk Segment", "Nimmt Risiko über Dexterity und Torment.", ["dexterity", "torment"], "awareness", "high", ["rogue", "renegade"]),
    roleTheme("finishkick", "Finish Kick", "Holt den Schluss über Speed und Power.", ["speed", "power"], "stamina", "high", ["charger"]),
  ],
  spurt: [
    roleTheme("blockstart", "Block Start", "Explodiert aus dem Start über Speed und Determination.", ["speed", "determination"], "stamina", "high", ["sprinter"]),
    roleTheme("acceleration", "Acceleration", "Baut Tempo über Speed und Torment auf.", ["speed", "torment"], "health", "medium", ["charger"]),
    roleTheme("topspeed", "Top Speed", "Maximiert Endtempo über Speed und Will.", ["speed", "will"], "determination", "high", ["sprinter"]),
    roleTheme("lanecontrol", "Lane Control", "Bleibt sauber über Dexterity und Awareness.", ["dexterity", "awareness"], "speed", "low", ["rogue"]),
    roleTheme("drivephase", "Drive Phase", "Drueckt die Mitte über Determination und Power.", ["determination", "power"], "stamina", "medium", ["charger"]),
    roleTheme("photofinish", "Photo Finish", "Braucht Nerven und Torment für den letzten Meter.", ["torment", "will"], "speed", "medium", ["hero"]),
  ],
  tennis: [
    roleTheme("serve", "Serve", "Setzt Druck über Awareness und Spirit.", ["awareness", "spirit"], "stamina", "medium", ["hero"]),
    roleTheme("return", "Return", "Liest Aufschlaege über Intelligence und Awareness.", ["intelligence", "awareness"], "dexterity", "low", ["tactician"]),
    roleTheme("rallycontrol", "Rally Control", "Haelt Ballwechsel über Intelligence und Stamina.", ["intelligence", "stamina"], "spirit", "medium", ["overseer"]),
    roleTheme("netpressure", "Net Pressure", "Greift über Dexterity und Speed an.", ["dexterity", "speed"], "awareness", "medium", ["rogue"]),
    roleTheme("matchiq", "Match IQ", "Gewinnt Muster über Intelligence und Determination.", ["intelligence", "determination"], "stamina", "low", ["tactician"]),
    roleTheme("tiebreak", "Tiebreak Clutch", "Braucht Spirit und Awareness im Druckmoment.", ["spirit", "awareness"], "determination", "high", ["hero"]),
  ],
  hockey: [
    roleTheme("powerforward", "Power Forward", "Geht dahin, wo es weh tut.", ["power", "health"], "stamina", "high", ["tank", "charger"]),
    roleTheme("defensivewall", "Defensive Wall", "Schliesst Raeume über Health und Spirit.", ["health", "spirit"], "speed", "medium", ["tank"]),
    roleTheme("playmaker", "Playmaker", "Verbindet Linien über Power und Awareness.", ["awareness", "power"], "health", "medium", ["tactician"]),
    roleTheme("transition", "Transition Runner", "Dreht Tempo über Speed und Stamina.", ["speed", "stamina"], "power", "high", ["sprinter"]),
    roleTheme("slotfinisher", "Slot Finisher", "Schliesst Chancen über Power und Torment.", ["power", "torment"], "health", "medium", ["berserker"]),
    roleTheme("captainline", "Captain Line", "Hebt die Reihe über Spirit.", ["spirit", "awareness"], "stamina", "low", ["hero", "bard"]),
  ],
  showcase: [
    roleTheme("stagelead", "Stage Lead", "Traegt die Show über Charisma.", ["charisma", "spirit"], "determination", "medium", ["bard"]),
    roleTheme("crowdhook", "Crowd Hook", "Holt Publikum über Charisma und Showcase-Power.", ["charisma", "power"], "intelligence", "low", ["bard", "hero"]),
    roleTheme("styletech", "Style Tech", "Belohnt saubere Details über Determination und Dexterity.", ["determination", "dexterity"], "charisma", "medium", ["rogue"]),
    roleTheme("controlbeat", "Control Beat", "Fuehrt Rhythmus über Intelligence.", ["intelligence", "determination"], "power", "low", ["tactician"]),
    roleTheme("bigmoment", "Big Moment", "Lebt von Charisma und Spirit im Spotlight.", ["charisma", "spirit"], "determination", "medium", ["hero"]),
    roleTheme("finale", "Finale", "Setzt den Schlussakzent über Spirit.", ["spirit", "charisma"], "power", "medium", ["bard"]),
  ],
  "speed-schach": [
    roleTheme("openingprep", "Opening Prep", "Kommt über Intelligence und Awareness ins Spiel.", ["intelligence", "awareness"], "will", "low", ["tactician"]),
    roleTheme("patternread", "Pattern Read", "Erkennt Muster über Awareness und Intelligence.", ["awareness", "intelligence"], "speed", "low", ["overseer"]),
    roleTheme("clockpressure", "Clock Pressure", "Spielt Uhrdruck über Will und Speed.", ["will", "speed"], "intelligence", "medium", ["renegade"]),
    roleTheme("calculation", "Calculation Core", "Rechnet Linien über Intelligence.", ["intelligence", "determination"], "awareness", "low", ["tactician"]),
    roleTheme("endgame", "Endgame Anchor", "Bleibt stabil über Will und Determination.", ["will", "determination"], "speed", "medium", ["hero"]),
    roleTheme("gambit", "Gambit", "Sucht Chaos über Intelligence und Charisma.", ["intelligence", "charisma"], "will", "medium", ["renegade", "bard"]),
  ],
  "takeshis-castle": [
    roleTheme("gatecrash", "Gate Crash", "Oeffnet Hindernisse über Will und Determination.", ["will", "determination"], "health", "high", ["charger"]),
    roleTheme("balancerun", "Balance Run", "Bleibt sauber über Intelligence und Dexterity.", ["intelligence", "dexterity"], "will", "medium", ["rogue"]),
    roleTheme("trapreader", "Trap Reader", "Liest Fallen über Awareness und Intelligence.", ["awareness", "intelligence"], "determination", "low", ["overseer"]),
    roleTheme("ironwill", "Iron Will", "Beisst sich über Will durch.", ["will", "health"], "dexterity", "high", ["tank", "hero"]),
    roleTheme("chaosdodge", "Chaos Dodge", "Ueberlebt Unordnung über Charisma und Torment.", ["charisma", "torment"], "awareness", "medium", ["renegade"]),
    roleTheme("finalwall", "Final Wall", "Braucht Determination und Will im letzten Hindernis.", ["determination", "will"], "health", "high", ["hero"]),
  ],
  breaking: [
    roleTheme("powermove", "Power Move", "Drueckt schwere Moves über Will und Torment.", ["will", "torment"], "health", "high", ["berserker"]),
    roleTheme("footwork", "Footwork", "Sammelt Punkte über Health und Dexterity.", ["health", "dexterity"], "will", "medium", ["rogue"]),
    roleTheme("freezecontrol", "Freeze Control", "Haelt Kontrolle über Health und Determination.", ["health", "determination"], "torment", "medium", ["tank"]),
    roleTheme("musicality", "Musicality", "Findet Flow über Will und Determination.", ["will", "determination"], "power", "low", ["bard"]),
    roleTheme("battlenerve", "Battle Nerve", "Antwortet im Battle über Torment und Will.", ["torment", "will"], "health", "high", ["renegade"]),
    roleTheme("finaleset", "Finale Set", "Setzt den Abschluss über Power und Torment.", ["power", "torment"], "determination", "medium", ["hero"]),
  ],
  wettessen: [
    roleTheme("capacity", "Capacity", "Hat Grundvolumen über Health und Stamina.", ["health", "stamina"], "will", "high", ["tank"]),
    roleTheme("pacecontrol", "Pace Control", "Teilt Kraefte über Stamina und Intelligence ein.", ["stamina", "intelligence"], "health", "medium", ["tactician"]),
    roleTheme("ironstomach", "Iron Stomach", "Haelt Belastung über Health und Will.", ["health", "will"], "stamina", "high", ["tank"]),
    roleTheme("tablefocus", "Table Focus", "Bleibt klar über Determination und Intelligence.", ["determination", "intelligence"], "health", "low", ["overseer"]),
    roleTheme("secondwind", "Second Wind", "Kommt über Will und Stamina zurück.", ["will", "stamina"], "health", "medium", ["hero"]),
    roleTheme("finalbite", "Final Bite", "Zieht den Schluss über Determination und Torment.", ["determination", "torment"], "will", "high", ["renegade"]),
  ],
  basketball: [
    roleTheme("floorgeneral", "Floor General", "Fuehrt Possessions über Spirit und Intelligence.", ["spirit", "intelligence"], "speed", "low", ["tactician", "bard"]),
    roleTheme("rimpressure", "Rim Pressure", "Attackiert den Korb über Awareness und Speed.", ["awareness", "speed"], "spirit", "high", ["charger"]),
    roleTheme("perimeter", "Perimeter", "Schafft Winkel über Intelligence und Dexterity.", ["intelligence", "dexterity"], "power", "medium", ["rogue"]),
    roleTheme("helpdefense", "Help Defense", "Rotiert über Awareness und Spirit.", ["awareness", "spirit"], "speed", "medium", ["hero"]),
    roleTheme("clutchshot", "Clutch Shot", "Braucht Spirit und Charisma im Wurfmoment.", ["spirit", "charisma"], "awareness", "medium", ["bard", "hero"]),
    roleTheme("fastbreak", "Fast Break", "Läuft Punkte über Speed und Dexterity.", ["speed", "dexterity"], "stamina", "high", ["sprinter"]),
  ],
  football: [
    roleTheme("linepower", "Line Power", "Gewinnt Kontakt über Spirit und Torment.", ["spirit", "torment"], "health", "high", ["tank", "berserker"]),
    roleTheme("routeburst", "Route Burst", "Schafft Separation über Health und Will.", ["health", "will"], "awareness", "medium", ["sprinter"]),
    roleTheme("fieldread", "Field Read", "Liest Plays über Awareness und Determination.", ["awareness", "determination"], "torment", "low", ["tactician"]),
    roleTheme("ballhawk", "Ball Hawk", "Greift Chancen über Torment und Awareness.", ["torment", "awareness"], "health", "medium", ["rogue"]),
    roleTheme("redzone", "Red Zone", "Braucht Spirit und Power nahe der Linie.", ["spirit", "power"], "will", "high", ["hero"]),
    roleTheme("lockerleader", "Locker Leader", "Fuehrt über Spirit und Charisma.", ["spirit", "charisma"], "health", "low", ["bard", "hero"]),
  ],
  eiskunstlauf: [
    roleTheme("edgecontrol", "Edge Control", "Traegt Technik über Charisma und Dexterity.", ["charisma", "dexterity"], "awareness", "medium", ["rogue", "bard"]),
    roleTheme("jumpsetup", "Jump Setup", "Braucht Dexterity und Awareness für Spruenge.", ["dexterity", "awareness"], "determination", "high", ["hero"]),
    roleTheme("spingrace", "Spin Grace", "Sammelt Stil über Charisma und Spirit.", ["charisma", "spirit"], "dexterity", "medium", ["bard"]),
    roleTheme("programflow", "Program Flow", "Verbindet Elemente über Spirit und Intelligence.", ["spirit", "intelligence"], "speed", "low", ["tactician"]),
    roleTheme("crowdmoment", "Crowd Moment", "Hebt den Auftritt über Charisma.", ["charisma", "awareness"], "determination", "medium", ["bard"]),
    roleTheme("finalpose", "Final Pose", "Setzt den Abschluss über Spirit und Charisma.", ["spirit", "charisma"], "dexterity", "low", ["hero"]),
  ],
  fechten: [
    roleTheme("duelist", "Duelist", "Sauberer Kernslot für direkte Duelle.", ["dexterity", "speed"], "stamina", "medium", ["rogue", "sprinter"]),
    roleTheme("aggressor", "Aggressor", "Bringt Druck über Torment und Power.", ["torment", "power"], "awareness", "high", ["berserker", "charger"]),
    roleTheme("defender", "Defender", "Hält Duelle stabil und federt Gegenangriffe ab.", ["awareness", "health"], "speed", "medium", ["tank"]),
    roleTheme("technician", "Technician", "Gewinnt über Technik, Timing und Kontrolle.", ["dexterity", "awareness"], "torment", "low", ["overseer", "tactician"]),
    roleTheme("countertempo", "Counter Tempo", "Dreht Timing über speed und Intelligence.", ["speed", "intelligence"], "health", "medium", ["rogue"]),
    roleTheme("finaltouch", "Final Touch", "Schliesst enge Gefechte über Torment und Determination.", ["torment", "determination"], "awareness", "high", ["hero"]),
  ],
  "i-spy": [
    roleTheme("observer", "Observer", "Sieht Details über Intelligence und Torment.", ["intelligence", "torment"], "health", "low", ["overseer"]),
    roleTheme("patternlock", "Pattern Lock", "Verkettet Hinweise über Intelligence und Spirit.", ["intelligence", "spirit"], "speed", "low", ["tactician"]),
    roleTheme("socialread", "Social Read", "Liest Verhalten über Torment und Charisma.", ["torment", "charisma"], "intelligence", "medium", ["bard", "renegade"]),
    roleTheme("logicchain", "Logic Chain", "Baut Loesungen über Intelligence und Will.", ["intelligence", "will"], "torment", "low", ["tactician"]),
    roleTheme("quietmove", "Quiet Move", "Bewegt sich unauffaellig über Dexterity und Speed.", ["dexterity", "speed"], "awareness", "medium", ["rogue"]),
    roleTheme("reveal", "Reveal", "Setzt den Fund über Torment und Spirit um.", ["torment", "spirit"], "intelligence", "medium", ["hero"]),
  ],
};

const OFFICIAL_DISCIPLINE_TOKEN_MAP = new Map<string, OfficialDisciplineWeightId>();

for (const disciplineId of officialDisciplineWeightOrder) {
  OFFICIAL_DISCIPLINE_TOKEN_MAP.set(normalizeDisciplineToken(disciplineId), disciplineId);
  OFFICIAL_DISCIPLINE_TOKEN_MAP.set(normalizeDisciplineToken(officialDisciplineWeightLabels[disciplineId]), disciplineId);
}

OFFICIAL_DISCIPLINE_TOKEN_MAP.set("mini dm", "mini-dm");
OFFICIAL_DISCIPLINE_TOKEN_MAP.set("minidm", "mini-dm");
OFFICIAL_DISCIPLINE_TOKEN_MAP.set("schach", "speed-schach");
OFFICIAL_DISCIPLINE_TOKEN_MAP.set("speed schach", "speed-schach");
OFFICIAL_DISCIPLINE_TOKEN_MAP.set("takeshi", "takeshis-castle");
OFFICIAL_DISCIPLINE_TOKEN_MAP.set("takeshis castle", "takeshis-castle");
OFFICIAL_DISCIPLINE_TOKEN_MAP.set("eiskunst", "eiskunstlauf");

function roleTheme(
  roleId: string,
  label: string,
  description: string,
  focus: PlayerGeneratorAttributeKey[],
  strain: PlayerGeneratorAttributeKey,
  fatigueProfile: MatchdaySlotRoleDefinition["fatigueProfile"],
  classHints?: string[],
  riskLabel?: string,
): SlotRoleTheme {
  return { roleId, label, description, focus, strain, fatigueProfile, classHints, riskLabel };
}

function normalizeDisciplineToken(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function resolveOfficialDisciplineId(
  disciplineId: string | null | undefined,
  disciplineName: string | null | undefined,
) {
  return (
    OFFICIAL_DISCIPLINE_TOKEN_MAP.get(normalizeDisciplineToken(disciplineId)) ??
    OFFICIAL_DISCIPLINE_TOKEN_MAP.get(normalizeDisciplineToken(disciplineName)) ??
    null
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundWeight(value: number) {
  return Number(value.toFixed(2));
}

function getBaseWeightProfile(disciplineId: OfficialDisciplineWeightId): MatchdaySlotRoleWeightProfile {
  return { ...officialDisciplineWeightMatrix[disciplineId] };
}

function getPositiveAttributes(baseWeights: MatchdaySlotRoleWeightProfile) {
  return playerGeneratorAttributeKeys.filter((attribute) => (baseWeights[attribute] ?? 0) > 0);
}

function sortAttributesByWeight(baseWeights: MatchdaySlotRoleWeightProfile) {
  return getPositiveAttributes(baseWeights).sort((left, right) => (baseWeights[right] ?? 0) - (baseWeights[left] ?? 0));
}

function resolveThemeFocus(theme: SlotRoleTheme, baseWeights: MatchdaySlotRoleWeightProfile) {
  const focus = theme.focus.filter((attribute) => (baseWeights[attribute] ?? 0) > 0);
  if (focus.length > 0) {
    return focus;
  }
  return sortAttributesByWeight(baseWeights).slice(0, 2);
}

function addDelta(delta: MatchdaySlotRoleWeightProfile, attribute: PlayerGeneratorAttributeKey, amount: number) {
  delta[attribute] = (delta[attribute] ?? 0) + amount;
}

function distributeNegativeDelta(
  deltas: MatchdaySlotRoleWeightProfile,
  baseWeights: MatchdaySlotRoleWeightProfile,
  targetAttributes: PlayerGeneratorAttributeKey[],
  amount: number,
) {
  let remaining = amount;
  for (let attempt = 0; attempt < 4 && remaining > 0.001; attempt += 1) {
    const capacities = targetAttributes.map((attribute) => ({
      attribute,
      capacity: Math.max((baseWeights[attribute] ?? 0) + (deltas[attribute] ?? 0) - 0.75, 0),
    }));
    const totalCapacity = capacities.reduce((sum, entry) => sum + entry.capacity, 0);
    if (totalCapacity <= 0) {
      break;
    }

    let spent = 0;
    for (const entry of capacities) {
      if (entry.capacity <= 0) {
        continue;
      }
      const take = Math.min((remaining * entry.capacity) / totalCapacity, entry.capacity);
      addDelta(deltas, entry.attribute, -take);
      spent += take;
    }

    remaining = Math.max(remaining - spent, 0);
  }
  return remaining;
}

function buildInitialDelta(theme: SlotRoleTheme, baseWeights: MatchdaySlotRoleWeightProfile) {
  const deltas: MatchdaySlotRoleWeightProfile = {};
  const positiveAttributes = getPositiveAttributes(baseWeights);
  if (positiveAttributes.length <= 1) {
    return deltas;
  }

  const focusAttributes = resolveThemeFocus(theme, baseWeights).slice(0, 2);
  let positiveDelta = 0;

  focusAttributes.forEach((attribute, index) => {
    const base = baseWeights[attribute] ?? 0;
    const desired = index === 0 ? 5.5 : 3.5;
    const capped = clampNumber(desired, 0, Math.max(Math.min(base * 0.45, 7), 1.5));
    addDelta(deltas, attribute, capped);
    positiveDelta += capped;
  });

  const drainAttributes = positiveAttributes
    .filter((attribute) => !focusAttributes.includes(attribute))
    .sort((left, right) => (baseWeights[right] ?? 0) - (baseWeights[left] ?? 0));
  const remaining = distributeNegativeDelta(deltas, baseWeights, drainAttributes, positiveDelta);
  if (remaining > 0.001) {
    distributeNegativeDelta(deltas, baseWeights, positiveAttributes, remaining);
  }

  const deltaSum = positiveAttributes.reduce((sum, attribute) => sum + (deltas[attribute] ?? 0), 0);
  if (Math.abs(deltaSum) > 0.001) {
    const correctionTargets = positiveAttributes.filter((attribute) => !focusAttributes.includes(attribute));
    const correctionPool = correctionTargets.length > 0 ? correctionTargets : positiveAttributes;
    const correctionPerAttribute = deltaSum / correctionPool.length;
    correctionPool.forEach((attribute) => addDelta(deltas, attribute, -correctionPerAttribute));
  }

  return deltas;
}

function resolveSafeDeltaScale(
  baseWeights: MatchdaySlotRoleWeightProfile,
  slotDeltas: MatchdaySlotRoleWeightProfile[],
) {
  let scale = 1;
  for (const attribute of getPositiveAttributes(baseWeights)) {
    const accumulatedDelta = slotDeltas.reduce((sum, delta) => sum + (delta[attribute] ?? 0), 0);
    if (accumulatedDelta > 0) {
      scale = Math.min(scale, Math.max(((baseWeights[attribute] ?? 0) - 0.75) / accumulatedDelta, 0));
    }
  }
  return clampNumber(scale * 0.98, 0, 1);
}

function buildSlotWeightProfiles(
  disciplineId: OfficialDisciplineWeightId,
  selectedThemes: SlotRoleTheme[],
) {
  const baseWeights = getBaseWeightProfile(disciplineId);
  if (selectedThemes.length <= 1) {
    return [baseWeights];
  }

  const editableSlotDeltas = selectedThemes.slice(0, -1).map((theme) => buildInitialDelta(theme, baseWeights));
  const safeScale = resolveSafeDeltaScale(baseWeights, editableSlotDeltas);
  const scaledDeltas = editableSlotDeltas.map((delta) =>
    Object.fromEntries(
      Object.entries(delta).map(([attribute, value]) => [attribute, Number((value * safeScale).toFixed(6))]),
    ) as MatchdaySlotRoleWeightProfile,
  );

  const finalDelta = Object.fromEntries(
    getPositiveAttributes(baseWeights).map((attribute) => [
      attribute,
      -scaledDeltas.reduce((sum, delta) => sum + (delta[attribute] ?? 0), 0),
    ]),
  ) as MatchdaySlotRoleWeightProfile;
  const allDeltas = [...scaledDeltas, finalDelta];

  return allDeltas.map((delta) =>
    Object.fromEntries(
      getPositiveAttributes(baseWeights).map((attribute) => [
        attribute,
        roundWeight(Math.max((baseWeights[attribute] ?? 0) + (delta[attribute] ?? 0), 0)),
      ]),
    ) as MatchdaySlotRoleWeightProfile,
  );
}

function resolveKeyAttributes(
  baseWeights: MatchdaySlotRoleWeightProfile,
  slotWeights: MatchdaySlotRoleWeightProfile,
  focusAttributes: PlayerGeneratorAttributeKey[],
) {
  const entries = getPositiveAttributes(slotWeights)
    .map((attribute) => {
      const weightPct = slotWeights[attribute] ?? 0;
      const baseWeightPct = baseWeights[attribute] ?? 0;
      const deltaPct = weightPct - baseWeightPct;
      const focusIndex = focusAttributes.indexOf(attribute);
      const emphasis =
        focusIndex === 0 || deltaPct >= 3
          ? "primary"
          : focusIndex === 1 || deltaPct >= 1
            ? "secondary"
            : "support";
      return { attribute, weightPct, baseWeightPct, deltaPct: Number(deltaPct.toFixed(2)), emphasis } satisfies MatchdaySlotRoleKeyAttribute;
    })
    .sort((left, right) => {
      const emphasisScore = { primary: 3, secondary: 2, support: 1 };
      const leftScore = emphasisScore[left.emphasis];
      const rightScore = emphasisScore[right.emphasis];
      if (leftScore !== rightScore) return rightScore - leftScore;
      if (Math.abs(left.deltaPct) !== Math.abs(right.deltaPct)) return Math.abs(right.deltaPct) - Math.abs(left.deltaPct);
      return right.weightPct - left.weightPct;
    });

  return entries.slice(0, 4);
}

function resolveProfileAttribute(
  slotWeights: MatchdaySlotRoleWeightProfile,
  preferredAttributes: PlayerGeneratorAttributeKey[],
  fallbackIndex: number,
) {
  const preferred = preferredAttributes.find((attribute) => (slotWeights[attribute] ?? 0) > 0);
  if (preferred) {
    return preferred;
  }
  return sortAttributesByWeight(slotWeights)[fallbackIndex] ?? "power";
}

function buildGeneratedSlotRoles(
  disciplineId: OfficialDisciplineWeightId,
  requiredPlayers: number,
) {
  const slotCount = clampNumber(Math.round(requiredPlayers), 0, 6);
  const themes = DISCIPLINE_ROLE_THEMES[disciplineId].slice(0, slotCount);
  const baseWeights = getBaseWeightProfile(disciplineId);
  const slotProfiles = buildSlotWeightProfiles(disciplineId, themes);

  return themes.map((theme, index) => {
    const slotWeightProfile = slotProfiles[index] ?? baseWeights;
    const focusAttributes = resolveThemeFocus(theme, baseWeights);
    const keyAttributes = resolveKeyAttributes(baseWeights, slotWeightProfile, focusAttributes);
    const majorPositiveAttribute = keyAttributes[0]?.attribute ?? resolveProfileAttribute(slotWeightProfile, focusAttributes, 0);
    const minorPositiveAttribute = keyAttributes.find((entry) => entry.attribute !== majorPositiveAttribute)?.attribute ?? resolveProfileAttribute(slotWeightProfile, focusAttributes, 1);
    const strainAttribute = resolveProfileAttribute(slotWeightProfile, [theme.strain], 2);

    return {
      roleId: `${disciplineId}-${slotCount}-${theme.roleId}`,
      label: theme.label,
      description: theme.description,
      majorPositiveAttribute,
      minorPositiveAttribute,
      strainAttribute,
      fatigueProfile: theme.fatigueProfile,
      classHints: theme.classHints,
      riskLabel: theme.riskLabel ?? `Strain über ${theme.strain.toUpperCase()}`,
      disciplineId,
      baseWeightProfile: baseWeights,
      slotWeightProfile,
      keyAttributes,
    } satisfies MatchdaySlotRoleDefinition;
  });
}

function resolveRoleModifierValue(value: number | null | undefined, kind: "major" | "minor" | "strain") {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }

  if (kind === "major") {
    if (value >= 80) return 4;
    if (value >= 68) return 3;
    if (value >= 56) return 2;
    if (value >= 45) return 1;
    return 0;
  }

  if (kind === "minor") {
    if (value >= 78) return 2;
    if (value >= 60) return 1;
    return 0;
  }

  if (value <= 35) return -1;
  if (value <= 50) return -1;
  return 0;
}

function resolveWeightedAttributeScore(
  attributeStats: PlayerAttributeSheetStats | null | undefined,
  profile: MatchdaySlotRoleWeightProfile | null | undefined,
) {
  if (!attributeStats || !profile) {
    return null;
  }

  let score = 0;
  let totalWeight = 0;
  for (const attribute of playerGeneratorAttributeKeys) {
    const weight = profile[attribute] ?? 0;
    const value = attributeStats[attribute];
    if (weight <= 0 || value == null || !Number.isFinite(value)) {
      continue;
    }
    score += value * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return null;
  }
  return score / totalWeight;
}

function resolveProfileRoleModifier(
  role: MatchdaySlotRoleDefinition,
  attributeStats: PlayerAttributeSheetStats | null | undefined,
) {
  const baseScore = resolveWeightedAttributeScore(attributeStats, role.baseWeightProfile);
  const slotScore = resolveWeightedAttributeScore(attributeStats, role.slotWeightProfile);
  if (baseScore == null || slotScore == null) {
    return null;
  }
  return Number(clampNumber((slotScore - baseScore) * SLOT_PROFILE_MODIFIER_SCALE, -8.5, 8.5).toFixed(1));
}

function resolveSlotStrainLoad(fatigueProfile: MatchdaySlotRoleDefinition["fatigueProfile"], roleId: string) {
  const profileBase = fatigueProfile === "high" ? 2 : fatigueProfile === "medium" ? 1 : 0;
  const roleAdjustment =
    roleId.includes("aggressor") || roleId.includes("frontliner") || roleId.includes("poweropener")
      ? 1
      : roleId.includes("technician") || roleId.includes("routereader") || roleId.includes("openingprep")
        ? -1
        : 0;
  const total = Math.max(profileBase + roleAdjustment, 0);

  if (total >= 2) return "hoch" as const;
  if (total >= 1) return "mittel" as const;
  return "niedrig" as const;
}

function resolvePlayerStrainResistance(strainValue: number | null | undefined) {
  if (strainValue == null || !Number.isFinite(strainValue)) {
    return 0;
  }
  if (strainValue >= 85) return 4;
  if (strainValue >= 72) return 3;
  if (strainValue >= 58) return 2;
  if (strainValue >= 45) return 1;
  return 0;
}

function resolveCurrentFatigueFactor(currentFatigueCount: number) {
  if (currentFatigueCount >= 80) return 4;
  if (currentFatigueCount >= 65) return 3;
  if (currentFatigueCount >= 40) return 2;
  if (currentFatigueCount >= 20) return 1;
  return 0;
}

function resolveDisciplineSizeFatigueModifier(requiredPlayers: number | null | undefined, intensity: MatchdayIntensityStage) {
  if (intensity !== "push") {
    return 0;
  }

  const playerCount = Math.max(2, Math.min(6, Math.round(requiredPlayers ?? 0)));
  if (playerCount >= 6) return 3;
  if (playerCount >= 5) return 2;
  if (playerCount >= 4) return 1;
  return 0;
}

function resolveAdditionalFatigueFromRisk(
  fatigueProfile: MatchdaySlotRoleDefinition["fatigueProfile"],
  roleId: string,
  intensity: MatchdayIntensityStage,
  currentFatigueCount: number,
  strainValue: number | null | undefined,
  requiredPlayers: number | null | undefined,
  rivalryPressure = 0,
) {
  const config = INTENSITY_CONFIG[intensity];
  const slotStrainLoad = resolveSlotStrainLoad(fatigueProfile, roleId);
  const loadScore = slotStrainLoad === "hoch" ? 2 : slotStrainLoad === "mittel" ? 1 : 0;
  const rivalryLoad = intensity === "push" ? Math.max(0, Math.min(2, rivalryPressure)) : 0;
  const disciplineLoad = resolveDisciplineSizeFatigueModifier(requiredPlayers, intensity);
  const strainRiskScore =
    loadScore +
    config.strainLoadModifier +
    disciplineLoad +
    rivalryLoad +
    resolveCurrentFatigueFactor(currentFatigueCount) -
    resolvePlayerStrainResistance(strainValue);
  const riskCarry = strainRiskScore >= 4 ? 4 : strainRiskScore >= 2 ? 2 : strainRiskScore >= 1 ? 1 : 0;
  const uncappedAdditionalFatigue = Math.max(
    config.fatigueBase + loadScore + disciplineLoad + rivalryLoad + resolveCurrentFatigueFactor(currentFatigueCount) + riskCarry,
    1,
  );

  return {
    slotStrainLoad,
    strainRiskScore,
    additionalFatigue: Number(Math.min(uncappedAdditionalFatigue, config.additionalFatigueCap).toFixed(1)),
  };
}

export function getMatchdayIntensityConfig(intensity: MatchdayIntensityStage) {
  return INTENSITY_CONFIG[intensity];
}

/**
 * Applies a team captain's "Ruhepol" effect (rivalryPressureReductionPct) as a clean
 * multiplicative reduction to a raw rivalry-pressure load. Never goes below 0. Does not
 * change how the reduction magnitude itself is computed/clamped upstream (team-captain-service).
 */
export function applyCaptainRivalryPressureReduction(
  pressure: number,
  reductionPct: number | null | undefined,
): number {
  const safePressure = Number.isFinite(pressure) ? pressure : 0;
  const safeReductionPct = Math.max(0, Math.min(100, reductionPct ?? 0));
  return Math.max(0, Number((safePressure * (1 - safeReductionPct / 100)).toFixed(2)));
}

export function resolveSlotRolesForDiscipline(
  disciplineId: string | null | undefined,
  disciplineName: string | null | undefined,
  requiredPlayers: number | null | undefined,
): MatchdaySlotRoleDefinition[] {
  const slotCount = Math.max(Math.round(requiredPlayers ?? 0), 0);
  const officialDisciplineId = resolveOfficialDisciplineId(disciplineId, disciplineName);
  if (officialDisciplineId) {
    return buildGeneratedSlotRoles(officialDisciplineId, slotCount);
  }

  return Array.from({ length: slotCount }).map((_, index) => ({
    roleId: `generic-${index + 1}`,
    label: `Starter ${index + 1}`,
    description: "Fallback-Rolle bis eine echte Diszi-Rollenmatrix hinterlegt ist.",
    majorPositiveAttribute: "power" as const,
    minorPositiveAttribute: "speed" as const,
    strainAttribute: "stamina" as const,
    fatigueProfile: "medium" as const,
    riskLabel: "Fallback-Rolle",
    keyAttributes: [
      { attribute: "power" as const, weightPct: 40, baseWeightPct: 40, deltaPct: 0, emphasis: "primary" as const },
      { attribute: "speed" as const, weightPct: 30, baseWeightPct: 30, deltaPct: 0, emphasis: "secondary" as const },
      { attribute: "stamina" as const, weightPct: 30, baseWeightPct: 30, deltaPct: 0, emphasis: "support" as const },
    ],
  }));
}

export function calculateMatchdayProjectedPreview(input: {
  baseScore: number | null | undefined;
  role: MatchdaySlotRoleDefinition | null | undefined;
  attributeStats: PlayerAttributeSheetStats | null | undefined;
  currentFatigueCount: number | null | undefined;
  requiredPlayers?: number | null | undefined;
  intensity: MatchdayIntensityStage;
  knownModifierBonus?: number | null | undefined;
  revealVariance?: number | null | undefined;
  rivalryPressure?: number | null | undefined;
}) : MatchdayProjectedPreview {
  const baseScore = input.baseScore ?? null;
  const role = input.role ?? null;
  const attributeStats = input.attributeStats ?? null;
  const currentFatigueCount = input.currentFatigueCount ?? 0;
  const knownModifierBonus = input.knownModifierBonus ?? 0;
  const revealVariance = Math.max(input.revealVariance ?? 2, 0);
  const rivalryPressure = Math.max(0, Math.min(2, input.rivalryPressure ?? 0));

  if (!role || baseScore == null || !Number.isFinite(baseScore)) {
    return {
      baseScore,
      roleModifier: 0,
      intensityModifier: INTENSITY_CONFIG[input.intensity].scoreModifier,
      fatigueModifier: 0,
      fatiguePenaltyPercent: 0,
      rivalryPressureModifier: 0,
      additionalFatigue: 0,
      totalProjected: baseScore,
      rangeLow: baseScore,
      rangeHigh: baseScore,
      fatigueRisk: "niedrig",
      slotStrainLoad: "niedrig",
      strainRiskScore: 0,
      warnings: baseScore == null ? ["Projected Range ohne Base Score nicht möglich"] : ["Slotrolle fehlt"],
    };
  }

  const majorValue = attributeStats?.[role.majorPositiveAttribute] ?? null;
  const minorValue = attributeStats?.[role.minorPositiveAttribute] ?? null;
  const strainValue = attributeStats?.[role.strainAttribute] ?? null;

  const profileRoleModifier = resolveProfileRoleModifier(role, attributeStats);
  const fallbackRoleModifier =
    resolveRoleModifierValue(majorValue, "major") +
    resolveRoleModifierValue(minorValue, "minor") +
    resolveRoleModifierValue(strainValue, "strain");
  const roleModifier = profileRoleModifier ?? fallbackRoleModifier;

  const intensityConfig = INTENSITY_CONFIG[input.intensity];
  const fatiguePenaltyPercent = getFatiguePerformancePenaltyPercent(currentFatigueCount);
  const preFatigueScore = baseScore + roleModifier;
  const fatigueModifier = Number(((preFatigueScore * fatiguePenaltyPercent) / 100).toFixed(1));
  const fatigueAdjustedScore = preFatigueScore - fatigueModifier;
  const { slotStrainLoad, strainRiskScore, additionalFatigue } = resolveAdditionalFatigueFromRisk(
    role.fatigueProfile,
    role.roleId,
    input.intensity,
    currentFatigueCount,
    strainValue,
    input.requiredPlayers ?? null,
    rivalryPressure,
  );
  const rivalryPressureModifier = input.intensity === "push" ? rivalryPressure : 0;
  const totalProjected = Number((fatigueAdjustedScore + intensityConfig.scoreModifier + knownModifierBonus).toFixed(1));
  const fatigueRisk = getFatigueRiskLevel(currentFatigueCount);
  const warnings: string[] = [];

  if (input.intensity === "push" && (currentFatigueCount >= 65 || strainRiskScore >= 4)) {
    warnings.push("Push bei stark belastetem Spieler");
  }
  if (rivalryPressureModifier > 0) {
    warnings.push(`Rivalitaetsdruck: Push-Streuung +${rivalryPressureModifier}`);
  }
  if (strainValue != null && strainValue <= 45) {
    warnings.push(`Schwaches ${String(role.strainAttribute).toUpperCase()} erhöht Strain-Risiko`);
  }
  if (profileRoleModifier != null && profileRoleModifier <= -5) {
    warnings.push("Off-role: Slotprofil passt schwach zum Spieler");
  }
  if (profileRoleModifier != null && profileRoleModifier >= 5) {
    warnings.push("Starker Slot-Fit durch Playbook-Profil");
  }
  if (fatiguePenaltyPercent >= 15) {
    warnings.push(`Fatigue ${Math.round(currentFatigueCount)} kostet bereits ${Math.round(fatiguePenaltyPercent)}% Leistung`);
  }

  const rangeRiskSpread = fatigueRisk === "hoch" ? 2 : fatigueRisk === "mittel" ? 1 : 0;
  const rivalrySpread = input.intensity === "push" ? rivalryPressureModifier : 0;
  const baseRangeAnchor = Math.max(fatigueAdjustedScore + knownModifierBonus, 0);
  const rangeLow = Number(
    (
      totalProjected +
      baseRangeAnchor * intensityConfig.rangeLowPercent -
      rangeRiskSpread -
      rivalrySpread -
      revealVariance * 0.5
    ).toFixed(1),
  );
  const rangeHigh = Number(
    (
      totalProjected +
      baseRangeAnchor * intensityConfig.rangeHighPercent +
      rangeRiskSpread +
      rivalrySpread +
      revealVariance * 0.5
    ).toFixed(1),
  );

  return {
    baseScore,
    roleModifier,
    intensityModifier: intensityConfig.scoreModifier,
    fatigueModifier,
    fatiguePenaltyPercent,
    rivalryPressureModifier,
    additionalFatigue,
    totalProjected,
    rangeLow,
    rangeHigh,
    fatigueRisk,
    slotStrainLoad,
    strainRiskScore,
    warnings,
  };
}

export const SLOT_ROLE_RESOLVE_SCORING_ENABLED = true;

// "Ruhepol"-Kanal im echten Resolve-Score: Rivalitaetsdruck (nach Captain-Reduktion) zieht den
// Seiten-Score unter Push leicht runter. Bounded pro Rivalitaets-Einheit (rivalryPressure ∈ [0,2]),
// konsistent mit rivalryLoad/rivalryPressureModifier (beide push-only). Ein starker Captain reduziert
// rivalryPressure upstream (applyCaptainRivalryPressureReduction) und damit real diesen Abzug.
const RIVALRY_RESOLVE_SCORE_DRAG_PER_UNIT = 1;

export function calculateSideSlotRoleModifierTotal(input: {
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  entries: Array<{ playerId: string; slotIndex: number }>;
  rosterPlayers: Array<{ id: string; attributeStats?: PlayerAttributeSheetStats | null }>;
  disciplineScores: Array<{ playerId: string; disciplineId: string; score: number }>;
  intensity?: MatchdayIntensityStage;
  fatigueByPlayerId?: Record<string, { count: number; multiplier: number }> | null;
  requiredPlayers?: number | null;
  rivalryPressure?: number | null;
}): number {
  if (!SLOT_ROLE_RESOLVE_SCORING_ENABLED || input.entries.length === 0) {
    return 0;
  }

  const roles = resolveSlotRolesForDiscipline(
    input.disciplineId,
    input.disciplineId,
    input.requiredPlayers ?? input.entries.length,
  );
  const scoreByPlayer = new Map(input.disciplineScores.map((entry) => [`${entry.playerId}::${entry.disciplineId}`, entry.score]));
  const rosterById = new Map(input.rosterPlayers.map((player) => [player.id, player]));
  const intensity = input.intensity ?? "normal";

  const roleModifierTotal = input.entries.reduce((sum, entry) => {
    const role = roles[entry.slotIndex] ?? null;
    const rosterPlayer = rosterById.get(entry.playerId) ?? null;
    const baseScore = scoreByPlayer.get(`${entry.playerId}::${input.disciplineId}`) ?? null;
    const preview = calculateMatchdayProjectedPreview({
      baseScore,
      role,
      attributeStats: rosterPlayer?.attributeStats ?? null,
      currentFatigueCount: input.fatigueByPlayerId?.[entry.playerId]?.count ?? 0,
      requiredPlayers: input.requiredPlayers ?? input.entries.length,
      intensity,
      rivalryPressure: input.rivalryPressure ?? 0,
    });
    return sum + preview.roleModifier;
  }, 0);

  // Rivalitaetsdruck wirkt jetzt auch auf den echten Score (nicht nur auf die Lab-Streuung):
  // einmaliger, gedeckelter Seiten-Abzug unter Push. Default 0 → keine Verhaltensaenderung ohne Rivalen.
  const rivalryPressure = Math.max(0, Math.min(2, input.rivalryPressure ?? 0));
  const rivalryScoreDrag = intensity === "push" ? rivalryPressure * RIVALRY_RESOLVE_SCORE_DRAG_PER_UNIT : 0;

  return Number((roleModifierTotal - rivalryScoreDrag).toFixed(1));
}

import type { SponsorArchetype, SponsorCurveShape, SponsorRarity, SponsorTermSeasons } from "@/lib/data/olyDataTypes";
import { SPONSOR_CURVE_SHAPE_KEYS, SPONSOR_RARITIES, SPONSOR_RARITY_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
import {
  SPONSOR_V4_AXIS_KEYS, type SponsorV3CardKey, type SponsorV4AxisKey,
} from "@/lib/sponsor/sponsor-v3-model";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";

/** ENV-Zahl, die EXPLIZIT 0 erlaubt (0 = Feature aus), im Gegensatz zum "0→fallback"-Muster anderswo. */
function envNum(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Golden-Sponsor-Los (Abschnitt 2.2). Höchstens EIN Slot/Team kann golden werden. Wahrscheinlichkeit ist
 * underdog- (schwache Teams höher) + beliebtheits-gewichtet, mit Cooldown, hart gedeckelt bei P_MAX:
 *   p = clamp(BASE_P + UNDERDOG_W*underdogTerm(qr) + BELIEBTHEIT_W*beliebtheitTerm(v)
 *             − COOLDOWN_PENALTY*hadGoldenLastSeason, 0, P_MAX)
 * Alle Terme ENV-tunebar über OLY_SPONSOR_GOLDEN_*.
 */
export const GOLDEN_BASE_P = envNum("OLY_SPONSOR_GOLDEN_BASE_P", 0.03);
export const GOLDEN_UNDERDOG_W = envNum("OLY_SPONSOR_GOLDEN_UNDERDOG_W", 0.06);
export const GOLDEN_BELIEBTHEIT_W = envNum("OLY_SPONSOR_GOLDEN_BELIEBTHEIT_W", 0.05);
export const GOLDEN_COOLDOWN_PENALTY = envNum("OLY_SPONSOR_GOLDEN_COOLDOWN_PENALTY", 0.05);
export const GOLDEN_P_MAX = envNum("OLY_SPONSOR_GOLDEN_P_MAX", 0.12);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Schwache Teams → 1, stärkstes Team → 0. Nutzt die Liga-Position (1..teamCount). */
function underdogTerm(leaguePosition: number, teamCount: number): number {
  if (teamCount <= 1) {
    return 0;
  }
  return clamp01((leaguePosition - 1) / (teamCount - 1));
}

/** Beliebtheit ist auf [0.5, 1.5] geclampt, 1.0 = neutral. Nur der positive Überschuss zählt (0..0.5). */
function beliebtheitTerm(beliebtheit?: number | null): number {
  if (beliebtheit == null || !Number.isFinite(beliebtheit)) {
    return 0;
  }
  return clamp01(beliebtheit - 1);
}

export function getGoldenLuckProbability(input: {
  leaguePosition: number;
  teamCount: number;
  beliebtheit?: number | null;
  hadGoldenLastSeason?: boolean;
}): number {
  const p =
    GOLDEN_BASE_P +
    GOLDEN_UNDERDOG_W * underdogTerm(input.leaguePosition, input.teamCount) +
    GOLDEN_BELIEBTHEIT_W * beliebtheitTerm(input.beliebtheit) -
    GOLDEN_COOLDOWN_PENALTY * (input.hadGoldenLastSeason ? 1 : 0);
  return Math.max(0, Math.min(GOLDEN_P_MAX, p));
}

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * Golden-Los für ALLE Teams (generalisiert das frühere Bottom-only-`applyBottomGoldenLuck`). Würfelt
 * underdog-/beliebtheits-gewichtet mit Cooldown, ob GENAU EIN Slot golden wird. Golden ist KEIN eigener
 * Rarity-Sprung — der Slot behält seine rarity; die Rang-Payout-Aufwertung passiert in der Kalibrierung.
 */
function rollGoldenLuck(
  slotCount: number,
  goldenCardSlots: number[],
  input: {
    seasonId: string;
    teamId: string;
    leaguePosition: number;
    teamCount: number;
    beliebtheit?: number | null;
    hadGoldenLastSeason?: boolean;
  },
): { goldenCardSlots: number[] } {
  if (slotCount === 0) {
    return { goldenCardSlots };
  }
  const p = getGoldenLuckProbability({
    leaguePosition: input.leaguePosition,
    teamCount: input.teamCount,
    beliebtheit: input.beliebtheit,
    hadGoldenLastSeason: input.hadGoldenLastSeason,
  });
  if (p <= 0) {
    return { goldenCardSlots };
  }
  const luckRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-golden-card`);
  if (luckRoll >= p) {
    return { goldenCardSlots };
  }
  const slotIndex = Math.min(
    slotCount - 1,
    Math.floor(getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-golden-slot`) * slotCount),
  );
  const nextGolden = goldenCardSlots.includes(slotIndex) ? goldenCardSlots : [...goldenCardSlots, slotIndex];
  return { goldenCardSlots: nextGolden };
}

/**
 * Rarity-keyed demand multiplier — replaces the old per-star-tier `getDemandMultiplier`. Baked from the
 * legacy formula (`0.85 + starTier * 0.08`) through the star↔rarity correspondence used everywhere else
 * (gewöhnlich=★2, magisch=★3, selten=★4, legendär=★5), so the resulting numbers are unchanged:
 * gewöhnlich 1.01, magisch 1.09, selten 1.17, legendär 1.25.
 */
export function getDemandMultiplierForRarity(rarity: SponsorRarity): number {
  return 1.01 + SPONSOR_RARITIES[rarity].order * 0.08;
}

// ── Rarity + Kurven-Slate-Wurf ───────────────────────────────────────────────────────────────────────────

export type SponsorSlateEntry = {
  cardKey: SponsorV3CardKey;
  rarity: SponsorRarity;
  /** Nur bei Achsenkarten gesetzt — die Sache, fuer die dieser Sponsor zahlt. */
  axisKey?: SponsorV4AxisKey;
  /**
   * WO auf der Sponsor-Ligaleiter (sponsor-liga-leiter.ts) dieses Angebot sein Geld hat — jeder
   * Slot bekommt eine ANDERE Form (Ziehung ohne Zuruecklegen), sonst waere die Formwahl stumpf: fuenf
   * Angebote, aber nur eine tatsaechliche Kurve dahinter.
   */
  curveShape: SponsorCurveShape;
  /**
   * Vertragslaufzeit dieses Angebots (1/2/3 Saisons), je Slot gewuerfelt (Umsetzungsplan D). Mehrheit
   * einjaehrig, Mehrjahresvertraege als Minderheit — siehe die Laufzeit-Ziehung in `rollSponsorOfferSlate` unten.
   */
  termSeasons: SponsorTermSeasons;
};
export type SponsorSlateResult = { entries: SponsorSlateEntry[]; goldenCardSlots: number[] };

/**
 * KARTE -> LEGACY-ARCHETYP-EIMER.
 *
 * Der Marken- und der Sonderziel-Katalog sind nach den drei alten Archetypen verschlagwortet
 * (`security` / `performance` / `identity`). Diese Abbildung ist die EINZIGE Stelle, an der die
 * Kartenachse der Erzeugung diese Eimer noch beruehrt — sie ersetzt die frueher hier stehende
 * Kurven->Archetyp-Tabelle des V2-Modells. Sie passt inhaltlich: die Sicherheitskarte zieht
 * Sicherheits-Marken, die Ambitionskarte Leistungs-Marken.
 */
const SPONSOR_CARD_ARCHETYPE: Partial<Record<SponsorV3CardKey, SponsorArchetype>> = {
  basis: "identity",
  achse: "identity",
  // Altvertraege: die vier V3-Risikokarten behalten ihren Eimer.
  sicherheit: "security",
  ambition: "performance",
  sonderziel: "identity",
  ambition_ziel: "performance",
};

/**
 * ACHSE -> ARCHETYP-EIMER. Seit die Karten sich ueber die Achse unterscheiden statt ueber das
 * Risikoprofil, ist die Achse die inhaltlich passende Quelle fuer die Markenwahl: wer fuer Finanzen
 * zahlt, ist eine Sicherheits-Marke; wer fuer Kaderwert zahlt, eine Leistungs-Marke.
 */
const SPONSOR_AXIS_ARCHETYPE: Record<SponsorV4AxisKey, SponsorArchetype> = {
  wachstum: "performance",
  ausbau: "identity",
  soliditaet: "security",
  entwicklung: "identity",
  kaderpflege: "security",
};

/** Karte -> Archetyp-Eimer fuer Marken- und Sonderziel-Auswahl; die Achse hat Vorrang. */
export function mapSponsorCardToArchetype(
  cardKey: SponsorV3CardKey, axisKey?: SponsorV4AxisKey | null,
): SponsorArchetype {
  if (axisKey) return SPONSOR_AXIS_ARCHETYPE[axisKey] ?? "identity";
  return SPONSOR_CARD_ARCHETYPE[cardKey] ?? "identity";
}

/**
 * Angebots-Slate-Wurf: pro Slot eine RARITY (beliebtheits-gehoben Richtung höherer Rarity) und
 * GENAU EINE der fuenf Karten des Sponsormodells. Vollständig deterministisch über
 * getStableUnitHash (kein Math.random). Golden bleibt orthogonal und läuft über denselben
 * Golden-Los-Pfad wie zuvor.
 *
 * DIE KARTEN WERDEN NICHT MEHR GEWUERFELT. In V2 wuerfelte der Slate distinkte Kurvenformen — die
 * Auswahl war damit selbst schon eine Lotterie darueber, WELCHE Entscheidungen ein Team ueberhaupt
 * angeboten bekommt. In V3 sieht jedes Team dieselben fuenf Entscheidungen (Sicherheit / Basis /
 * Ambition / Sonderziel / Ambition+Ziel); gewuerfelt werden nur noch Marke, Rarity (= Groesse des
 * Hebels) und das Sonderziel.
 */
export function rollSponsorOfferSlate(input: {
  seasonId: string;
  teamId: string;
  qualityRank: SponsorTeamQualityRank;
  slotCount?: number;
  beliebtheit?: number | null;
  hadGoldenLastSeason?: boolean;
  teamCount?: number;
  /**
   * Achsen, die diesem Team ueberhaupt angeboten werden duerfen (Eligibility kommt vom Aufrufer, der
   * den Spielzustand hat). Fehlt die Liste, wird der volle Satz angenommen.
   */
  offerableAxes?: readonly SponsorV4AxisKey[];
}): SponsorSlateResult {
  const teamCount = input.teamCount ?? 32;

  // DER SLATE: EIN Basis-Slot plus je ein Slot pro Achse. Mehr Slots als 1 + verfuegbare Achsen kann
  // es nicht geben, sonst stuende dieselbe Entscheidung zweimal — und zwei Karten auf derselben
  // Achse waeren keine Wahl, sondern nur zwei Preise fuer dasselbe.
  const axisPool = (input.offerableAxes && input.offerableAxes.length > 0
    ? input.offerableAxes
    : SPONSOR_V4_AXIS_KEYS
  ).slice();
  const requestedSlotCount = input.slotCount ?? 5;
  // DIE SLOT-ZAHL HAENGT NICHT MEHR AN DEN ACHSEN. Sie tat es, solange jede Karte ausser der Basis
  // eine eigene Achse trug — zwei Karten auf derselben Achse waeren keine Wahl gewesen, sondern zwei
  // Preise fuer dasselbe. Seit die Gebaeude-Karten die zwei Leih-Ziele tragen (Frische, Achsen-Rang)
  // unterscheiden sie sich ueber Gebaeude, Groesse und Rarität; ein Team mit wenig bespielbaren
  // Achsen bekam sonst weniger Karten als die anderen, ausgerechnet ohne dass die Achsen noch etwas
  // entscheiden. Der `axisPool` bleibt fuer die Achsen-Zuordnung stehen (Altvertrags-Anzeige und die
  // Basis-Karte lesen sie weiter), deckelt aber nichts mehr.
  const slotCount = Math.max(1, requestedSlotCount);

  // Ziehung OHNE ZURUECKLEGEN ueber eine deterministische Sortierung: jede Achse bekommt einen
  // stabilen Wurf, sortiert wird danach. Eine Achse bleibt je Saison uebrig — das rotiert den Slate
  // von selbst, ohne dass eine Anti-Wiederholungsliste gepflegt werden muesste.
  //
  // Saison+Team stehen bewusst VOR der Achse im Seed — dieselbe Regel wie beim Kurvenform-Seed unten:
  // gebraucht wird Varianz ZWISCHEN VERSCHIEDENEN TEAMS bei GLEICHER Achse, und FNV-1a avalanched nur
  // NACH dem Zeichen, an dem sich zwei Seeds zum ersten Mal unterscheiden (siehe Kommentar beim
  // Rarity-Wurf unten). Mit der Achse vorne (kurzem, immer gleich langem Praefix je Achse) und
  // Saison/Team dahinter blieb die Achsen-REIHENFOLGE ueber alle Teams EINER Saison hinweg praktisch
  // IDENTISCH — gemessen: bei 12 Teams derselben Saison lieferten 10 von 12 exakt dieselbe Reihenfolge,
  // nur 2 abweichende Werte kamen ueberhaupt vor. Das rotiert zwar zwischen Saisons, aber nicht
  // zwischen Teams — und genau die Team-Varianz soll dieser Wurf liefern.
  const shuffledAxes = axisPool
    .map((key) => ({ key, roll: getStableUnitHash(`sponsor-achse:${input.seasonId}:${input.teamId}:${key}`) }))
    .sort((left, right) => left.roll - right.roll)
    .map((entry) => entry.key);

  // Dieselbe Ziehung-ohne-Zuruecklegen wie bei den Achsen, diesmal ueber die 11 Kurvenformen: jeder
  // Slot bekommt eine ANDERE Form, damit die fuenf Angebote fuenf verschiedene Stellen auf der
  // Ligaleiter zeigen (sponsor-liga-leiter.ts) statt fuenfmal dieselbe Verteilung mit anderem Namen.
  const shuffledCurveShapes = SPONSOR_CURVE_SHAPE_KEYS
    .map((shape) => ({ shape, roll: getStableUnitHash(`sponsor-curve:${input.seasonId}:${input.teamId}:${shape}`) }))
    .sort((left, right) => left.roll - right.roll)
    .map((entry) => entry.shape);

  // Rebalance (2026-07): KEIN qualitäts-rang-basierter Rarity-Deckel mehr. Früher deckelte der Team-
  // Qualitätsrang die maximale Rarity (die untere Liga-Hälfte saß hart auf `gewöhnlich`), sodass schwache
  // Teams praktisch nie ein selten/legendäres Angebot sahen und Top-Teams bevorzugt wurden. Jetzt zieht
  // JEDES Team — Tabellenführer wie Schlusslicht — aus DERSELBEN vollen Rarity-Verteilung
  // (gewöhnlich 50 / magisch 30 / selten 14 / legendär 6). Damit hat auch das schwächste Team die (kleine,
  // ~6 %/Slot) Chance auf ein legendäres Angebot; niemand wird über den Rang bestraft oder belohnt.
  // Beliebtheit bleibt als milder, VERDIENTER Aufwärts-Lift erhalten (nur nach oben, kein Rang-Malus).
  const beliebtheitLift = beliebtheitTerm(input.beliebtheit);
  const fallbackRarity = SPONSOR_RARITY_KEYS[0]!;
  const rarities: SponsorRarity[] = [];
  const candidates = [...SPONSOR_RARITY_KEYS];
  const weights = candidates.map(
    (r) => SPONSOR_RARITIES[r].drawWeight * (1 + beliebtheitLift * SPONSOR_RARITIES[r].order * 0.15),
  );
  const weightTotal = weights.reduce((sum, w) => sum + w, 0);
  for (let slot = 0; slot < slotCount; slot += 1) {
    // WICHTIG: Slot MUSS am Seed-Anfang stehen. FNV-1a avalanched nur nach dem variierenden Zeichen; ein
    // Suffix-Slot (`…:sponsor-rarity:${slot}`) unterscheidet die 5 Würfe nur in den niederwertigen Bits →
    // benachbarte Slots lagen exakt 16777619/2^32 ≈ 0.0039 auseinander, wodurch 94 % aller Slates komplett
    // EINFARBIG waren (jede Saison „5× dieselbe Rarity"). Slot vorne lässt ihn durch alle FNV-Runden laufen
    // → echte Intra-Slate-Varianz (einfarbige Quote fällt auf die statistische Erwartung ~8 %), die
    // Marginalverteilung pro Slot bleibt unverändert.
    const roll = getStableUnitHash(`sponsor-rarity:${slot}:${input.seasonId}:${input.teamId}`) * weightTotal;
    let acc = 0;
    let picked: SponsorRarity = candidates[candidates.length - 1] ?? fallbackRarity;
    for (let i = 0; i < candidates.length; i += 1) {
      acc += weights[i]!;
      if (roll < acc) {
        picked = candidates[i]!;
        break;
      }
    }
    rarities.push(picked);
  }

  // LAUFZEIT JE SLOT (Umsetzungsplan D): Mehrheit einjaehrig, Mehrjahresvertraege als Minderheit —
  // Gewichte 3:1:1 (1/2/3 Saisons) liefern im Erwartungswert ~3 einjaehrige, ~1 zweijaehrige und
  // ~1 dreijaehrige Karte pro Slate von fuenf.
  //
  // SEED-FALLE, ZUM DRITTEN MAL (siehe die Kommentare bei Rarity- und Achsen-Ziehung oben): hier
  // greifen BEIDE bisher getrennt behobenen Bugs gleichzeitig, weil dieser Wurf BEIDE Eigenschaften
  // braucht — Varianz ZWISCHEN DEN 5 SLOTS DESSELBEN Teams UND Varianz ZWISCHEN VERSCHIEDENEN TEAMS
  // derselben Saison:
  //   - Slot als SUFFIX (wie beim Achsen-/Kurvenform-Seed: `…:seasonId:teamId:slot`) behebt zwar die
  //     Team-Varianz, macht die 5 Slot-Rolls eines Teams aber wieder fast einfarbig (gemessen: ~93 %
  //     der Slates ziehen fuer alle 5 Slots dieselbe Laufzeit) — derselbe Fehler wie beim alten
  //     Rarity-Suffix-Seed, nur auf einer anderen Achse.
  //   - Slot als PRAEFIX gefolgt von NUR `teamId` (wie beim alten Rarity-Seed) behebt die Slot-Varianz,
  //     kollabiert aber die Team-Varianz: bei kurzen, sich nur in den letzten Zeichen unterscheidenden
  //     Team-IDs (z. B. "T-0".."T-11") avalanched FNV-1a nach dem letzten Unterschied kaum noch —
  //     gemessen: 25 von 60 Saisons zogen fuer ALLE 12 Teams exakt dieselbe Laufzeit in Slot 0.
  // Der Plan schlug `seasonId:teamId:slot` vor (das erste Muster) — nachgemessen bricht das an der
  // Slot-Varianz. Behoben mit Slot ZUERST, gefolgt von `teamId` UND `seasonId` (in dieser Reihenfolge):
  // die Team-ID divergiert fruehzeitig im String, und die nachfolgende Saison-ID liefert dahinter noch
  // genug FNV-Runden, um diese Divergenz sauber durchzuavalanchen — gemessen ueber 40 Saisons x 32
  // Teams: 0 Saisons mit einfarbiger Team-Verteilung in Slot 0 (3 verschiedene Laufzeiten ueblich),
  // UND die Slot-einfarbige Quote je Team faellt auf ~7,7 % (statistische Erwartung ~8 %).
  const TERM_SEASON_DRAW_WEIGHTS: Record<SponsorTermSeasons, number> = { 1: 3, 2: 1, 3: 1 };
  const termSeasonCandidates: SponsorTermSeasons[] = [1, 2, 3];
  const termWeights = termSeasonCandidates.map((term) => TERM_SEASON_DRAW_WEIGHTS[term]);
  const termWeightTotal = termWeights.reduce((sum, w) => sum + w, 0);
  const termSeasonsPerSlot: SponsorTermSeasons[] = Array.from({ length: slotCount }, (_, slot) => {
    const roll = getStableUnitHash(`sponsor-laufzeit:${slot}:${input.teamId}:${input.seasonId}`) * termWeightTotal;
    let acc = 0;
    let picked: SponsorTermSeasons = 1;
    for (let i = 0; i < termSeasonCandidates.length; i += 1) {
      acc += termWeights[i]!;
      if (roll < acc) {
        picked = termSeasonCandidates[i]!;
        break;
      }
    }
    return picked;
  });

  // KEIN VORSCHUSS-WURF MEHR. Hier wuerfelte der Slate frueher aus, welche Achsen-Slots einen Teil
  // ihrer Auszahlung schon bei Unterschrift zahlen. Sponsorgeld kommt jetzt ausnahmslos am
  // Saisonende (Begruendung: sponsor-v3-model.ts) — die Karten unterscheiden sich damit nur noch in
  // Achse, Rarity, Kurvenform und Laufzeit, und der Seed `sponsor-vorschuss:*` wird nicht mehr
  // gezogen.

  // Slot 0 traegt die Basis-Karte: der risikofreie Anker, gegen den jede Achse gemessen wird.
  const entries: SponsorSlateEntry[] = Array.from({ length: slotCount }, (_, slot) => {
    const curveShape = shuffledCurveShapes[slot]!;
    const termSeasons = termSeasonsPerSlot[slot] ?? 1;
    if (slot === 0) {
      return { cardKey: "basis" as SponsorV3CardKey, rarity: rarities[0] ?? fallbackRarity, curveShape, termSeasons };
    }
    return {
      cardKey: "achse" as SponsorV3CardKey,
      rarity: rarities[slot] ?? fallbackRarity,
      axisKey: shuffledAxes[slot - 1]!,
      curveShape,
      termSeasons,
    };
  });

  // Golden bleibt orthogonal zur Rarity: derselbe Golden-Los-Pfad (Wahrscheinlichkeit + Seeds), höchstens
  // EIN goldener Slot.
  const golden = rollGoldenLuck(
    slotCount,
    [],
    {
      seasonId: input.seasonId,
      teamId: input.teamId,
      leaguePosition: input.qualityRank.leaguePosition,
      teamCount,
      beliebtheit: input.beliebtheit,
      hadGoldenLastSeason: input.hadGoldenLastSeason,
    },
  );

  return { entries, goldenCardSlots: golden.goldenCardSlots };
}

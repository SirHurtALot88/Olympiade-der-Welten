import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { DEBUG_FORCE_PLAYER_VISIBILITY } from "@/lib/foundation/debug-player-visibility";
import { calculateTransfermarktFit } from "@/lib/market/transfermarkt-fit";
import {
  computeCandidateAxisTeamRankEstimates,
  computeCompositeTopSixAverage,
  computeTopSixAxisImpact,
  formatTeamRankEstimateLabel,
  TRANSFERMARKT_AXIS_KEYS,
  type TransfermarktAxisKey,
} from "@/lib/market/transfermarkt-roster-impact";
import { getScoutingProgressPercent } from "@/lib/scouting/scouting-reveal-state";

/**
 * SCOUT-URTEIL: Note 1+ bis 6, Empfehlung und kurzer Bericht für einen Wunschlisten-Spieler.
 *
 * Konzept: docs/design/scouting-ausbau-konzept-11-11.md. Kernentscheidung dort, Abschnitt 1: die
 * Note ist eine EIGENE Skala — das Urteil des Scouts „wie sehr empfehle ich ihn für DEIN Team, zu
 * DIESEM Preis" — und kein drittes Fähigkeitsmaß neben den CA/PO-Sternen. Ein 4-Sterne-Spieler
 * kann für einen Kader, der auf seiner Achse schon sechs Stärkere hat, eine 4 bekommen.
 *
 * Der Empfehlungswert (0..100) wird IMMER aus den echten Werten gerechnet; der Nebel betrifft nur
 * die ANZEIGE (Note als Spanne/ungefähr, vorsichtige Sätze) — so dreht sich die Note beim
 * Weiterscouten nicht, sie wird nur schärfer.
 */

/** Gewichte des Empfehlungswerts (Summe 100). Stellschraube, siehe Konzept Abschnitt 6. */
export const SCOUT_VERDICT_WEIGHTS = {
  skill: 35,
  gap: 20,
  price: 20,
  complement: 15,
  fit: 10,
} as const;

export type ScoutVerdictCriterionId = keyof typeof SCOUT_VERDICT_WEIGHTS | "potential";

export type ScoutVerdictTone = "positive" | "neutral" | "negative";

export type ScoutVerdictCriterion = {
  id: ScoutVerdictCriterionId;
  label: string;
  tone: ScoutVerdictTone;
  /** Ganzer Satz für den Bericht. */
  text: string;
  /** Kurzform für den Fazit-Satz („schließt unsere SOC-Lücke"). */
  short: string;
  /** 0..1, null = ohne Gewicht (Potenzial-Hinweis). */
  score: number | null;
};

export type ScoutGradeVisibility = "unknown" | "range" | "approx" | "exact";

export type ScoutRecommendationTone = "elite" | "good" | "neutral" | "warn" | "risk";

export type ScoutAxisComparisonRow = {
  axis: TransfermarktAxisKey;
  /** Nur bei voll gescoutetem Spieler gesetzt — vorher kein Leck verdeckter Werte. */
  value: number | null;
  teamTopAverage: number | null;
  /** „#3/12" bzw. unter Nebel „ca. #2–5/12"; null unter 25 %. */
  rankLabel: string | null;
};

export type ScoutVerdict = {
  playerId: string;
  scoutingPercent: number;
  visibility: ScoutGradeVisibility;
  /** Empfehlungswert 0..100 (aus echten Werten). */
  score: number;
  /** Genaue Note („2+"). Nur im UI zeigen, wenn visibility === "exact". */
  exactGrade: string;
  /** Was der Kreis zeigt: „?", „2–3", „≈2" oder „2+". */
  gradeDisplay: string;
  /** Ganze Note, an der Empfehlung und Ton hängen (bei Spanne die vorsichtigere); null = unbekannt. */
  displayWholeGrade: number | null;
  recommendation: string;
  recommendationTone: ScoutRecommendationTone;
  summary: string;
  criteria: ScoutVerdictCriterion[];
  axisComparison: ScoutAxisComparisonRow[];
};

const AXIS_LABEL: Record<TransfermarktAxisKey, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };

/** 16 Stufen, 6 Punkte je Stufe: 1+ ab 92 … 5− ab 8, darunter 6. */
const SCOUT_GRADE_STEPS: Array<{ label: string; min: number; whole: number }> = [
  { label: "1+", min: 92, whole: 1 },
  { label: "1", min: 86, whole: 1 },
  { label: "1−", min: 80, whole: 1 },
  { label: "2+", min: 74, whole: 2 },
  { label: "2", min: 68, whole: 2 },
  { label: "2−", min: 62, whole: 2 },
  { label: "3+", min: 56, whole: 3 },
  { label: "3", min: 50, whole: 3 },
  { label: "3−", min: 44, whole: 3 },
  { label: "4+", min: 38, whole: 4 },
  { label: "4", min: 32, whole: 4 },
  { label: "4−", min: 26, whole: 4 },
  { label: "5+", min: 20, whole: 5 },
  { label: "5", min: 14, whole: 5 },
  { label: "5−", min: 8, whole: 5 },
  { label: "6", min: Number.NEGATIVE_INFINITY, whole: 6 },
];

export function scoreToScoutGrade(score: number) {
  const safe = Number.isFinite(score) ? score : 0;
  const step = SCOUT_GRADE_STEPS.find((entry) => safe >= entry.min) ?? SCOUT_GRADE_STEPS[SCOUT_GRADE_STEPS.length - 1]!;
  return { label: step.label, whole: step.whole };
}

export function getScoutRecommendation(wholeGrade: number | null): { label: string; tone: ScoutRecommendationTone } {
  if (wholeGrade == null) return { label: "Noch kein Urteil", tone: "neutral" };
  if (wholeGrade <= 1) return { label: "Sofort holen", tone: "elite" };
  if (wholeGrade === 2) return { label: "Klare Empfehlung", tone: "good" };
  if (wholeGrade === 3) return { label: "Solide Option", tone: "neutral" };
  if (wholeGrade === 4) return { label: "Nur als Ergänzung", tone: "warn" };
  return { label: "Finger weg", tone: "risk" };
}

export function getScoutGradeVisibility(scoutingPercent: number, forceVisible = false): ScoutGradeVisibility {
  if (forceVisible || scoutingPercent >= 100) return "exact";
  if (scoutingPercent >= 60) return "approx";
  if (scoutingPercent >= 25) return "range";
  return "unknown";
}

function stableUnit(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * Was der Kreis zeigt. Die Spanne nimmt die ganze Note und einen Nachbarn, dessen Richtung je
 * Spieler fest ist (kein Flackern). Die Empfehlung folgt bei einer Spanne der Note, die näher an
 * der Mitte (3,5) liegt — der Scout legt sich vorsichtig fest.
 */
export function formatScoutGradeDisplay(input: {
  exactGrade: string;
  wholeGrade: number;
  visibility: ScoutGradeVisibility;
  playerId: string;
}): { display: string; wholeForLabel: number | null } {
  if (input.visibility === "unknown") return { display: "?", wholeForLabel: null };
  if (input.visibility === "exact") return { display: input.exactGrade, wholeForLabel: input.wholeGrade };
  if (input.visibility === "approx") return { display: `≈${input.wholeGrade}`, wholeForLabel: input.wholeGrade };
  const up = stableUnit(`${input.playerId}:scout-grade-range`) >= 0.5;
  let neighbor = up ? input.wholeGrade + 1 : input.wholeGrade - 1;
  if (neighbor < 1) neighbor = 2;
  if (neighbor > 6) neighbor = 5;
  const low = Math.min(input.wholeGrade, neighbor);
  const high = Math.max(input.wholeGrade, neighbor);
  const cautious = Math.abs(low - 3.5) < Math.abs(high - 3.5) ? low : high;
  return { display: `${low}–${high}`, wholeForLabel: cautious };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function mean(values: number[]) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function fmt(value: number, digits = 0) {
  return value.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtMoney(value: number) {
  return `${fmt(value, value % 1 === 0 ? 0 : 1)} Mio`;
}

function toneFromScore(score: number, high = 0.62, low = 0.38): ScoutVerdictTone {
  if (score >= high) return "positive";
  if (score <= low) return "negative";
  return "neutral";
}

function axisMean(player: Pick<Player, "coreStats">) {
  return mean(TRANSFERMARKT_AXIS_KEYS.map((axis) => player.coreStats?.[axis] ?? 0)) ?? 0;
}

export function buildScoutVerdict(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  /** Default: Bauphasen-Schalter DEBUG_FORCE_PLAYER_VISIBILITY (wie der Scouting-Report). */
  forceVisible?: boolean;
}): ScoutVerdict | null {
  const { gameState, teamId } = input;
  const player = gameState.players.find((entry) => entry.id === input.playerId) ?? null;
  if (!player) {
    return null;
  }
  const forceVisible = input.forceVisible ?? DEBUG_FORCE_PLAYER_VISIBILITY;
  const scoutingPercent = getScoutingProgressPercent(gameState, teamId, player.id);
  const visibility = getScoutGradeVisibility(scoutingPercent, forceVisible);
  const seen = visibility !== "unknown";
  const firm = visibility === "exact";
  const hedge = (text: string) => (firm ? text : `Erster Eindruck: ${text}`);

  const rosterIds = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
  const rosterPlayers = gameState.players.filter((entry) => rosterIds.has(entry.id) && entry.id !== player.id);
  const rosterAxes = rosterPlayers.map((entry) => entry.coreStats);
  const candidateAxes = player.coreStats;

  // ── Skill ────────────────────────────────────────────────────────────────────────────────────
  const exactRanks = computeCandidateAxisTeamRankEstimates(rosterAxes, candidateAxes, 100);
  const axisValues = TRANSFERMARKT_AXIS_KEYS.map((axis) => ({ axis, value: candidateAxes?.[axis] ?? 0 }));
  const best = [...axisValues].sort((left, right) => right.value - left.value)[0]!;
  const meanValue = mean(axisValues.map((entry) => entry.value)) ?? 0;
  const absoluteSkill = 0.6 * clamp01((best.value - 25) / 45) + 0.4 * clamp01((meanValue - 25) / 35);
  let relativeSkill: number | null = null;
  if (rosterPlayers.length >= 3 && exactRanks.length > 0) {
    const percentiles = exactRanks.map((rank) => 1 - (rank.bestRank - 1) / Math.max(1, rank.rosterSize - 1));
    relativeSkill = 0.6 * Math.max(...percentiles) + 0.4 * (mean(percentiles) ?? 0);
  }
  const skillScore = relativeSkill == null ? absoluteSkill : 0.5 * relativeSkill + 0.5 * absoluteSkill;
  // Anzeige-Ränge wie im Transfermarkt: unter Nebel als Spanne („ca. #2–5/12").
  const rankConfidence = firm ? 100 : scoutingPercent;
  const displayRanks = computeCandidateAxisTeamRankEstimates(rosterAxes, candidateAxes, rankConfidence);
  const bestRankLabel = formatTeamRankEstimateLabel(
    displayRanks.find((rank) => rank.axis === best.axis),
    rankConfidence,
  );
  const skillTone = toneFromScore(skillScore);
  const skillCriterion: ScoutVerdictCriterion = !seen
    ? {
        id: "skill",
        label: "Skill",
        tone: "neutral",
        text: "Noch zu wenig gesehen, um seine Klasse einzuschätzen.",
        short: "ist noch kaum gesehen",
        score: skillScore,
      }
    : {
        id: "skill",
        label: "Skill",
        tone: skillTone,
        text: hedge(
          `Stärkste Seite ist ${AXIS_LABEL[best.axis]}${firm ? ` (${fmt(best.value)})` : ""}${
            bestRankLabel && rosterPlayers.length > 0 ? ` — bei uns wäre das Rang ${bestRankLabel}` : ""
          }. ${
            skillTone === "positive"
              ? "Das ist echte Qualität."
              : skillTone === "negative"
                ? "Insgesamt eher schwach für unser Niveau."
                : "Ordentlich, aber kein Unterschiedsspieler."
          }`,
        ),
        short:
          skillTone === "positive"
            ? `ist auf ${AXIS_LABEL[best.axis]} richtig stark`
            : skillTone === "negative"
              ? "ist zu schwach für uns"
              : "ist ordentlich, aber kein Unterschiedsspieler",
        score: skillScore,
      };

  // ── Lücke ────────────────────────────────────────────────────────────────────────────────────
  const impact = computeTopSixAxisImpact(rosterAxes, candidateAxes, 6);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const playerMin = team?.rosterMinTarget ?? identity?.playerMin ?? null;
  const rosterBelowMin = playerMin != null && rosterPlayers.length < playerMin;
  const knownAxes = impact.filter((row) => row.before != null);
  const weakest = [...knownAxes].sort((left, right) => (left.before ?? 0) - (right.before ?? 0))[0] ?? null;
  let gapScore: number;
  let gapText: string;
  let gapShort: string;
  if (!weakest) {
    gapScore = 0.6;
    gapText = "Wir haben noch keinen Kader — jeder brauchbare Spieler füllt eine Lücke.";
    gapShort = "füllt unseren leeren Kader";
  } else {
    const gapDelta = weakest.delta ?? 0;
    gapScore = clamp01(gapDelta / 4);
    if (gapDelta >= 1) {
      gapText = `Schließt unsere größte Lücke: ${AXIS_LABEL[weakest.axis]}${
        firm ? ` (Top-6 Ø ${fmt(weakest.before ?? 0, 1)} → ${fmt(weakest.after ?? 0, 1)})` : ""
      }.`;
      gapShort = `schließt unsere ${AXIS_LABEL[weakest.axis]}-Lücke`;
    } else if (gapDelta > 0) {
      gapText = `Hilft auf unserer schwächsten Achse ${AXIS_LABEL[weakest.axis]} nur ein wenig.`;
      gapShort = `hilft auf ${AXIS_LABEL[weakest.axis]} nur wenig`;
    } else {
      gapText = `Hilft auf unserer schwächsten Achse ${AXIS_LABEL[weakest.axis]} nicht.`;
      gapShort = `hilft auf ${AXIS_LABEL[weakest.axis]} nicht`;
    }
    if (rosterBelowMin) {
      gapScore = Math.max(gapScore, 0.7);
      gapText = `Unser Kader liegt unter dem Minimum (${rosterPlayers.length}/${playerMin}) — er füllt auf jeden Fall eine Lücke. ${gapText}`;
      gapShort = "füllt unseren zu kleinen Kader auf";
    }
  }
  const gapCriterion: ScoutVerdictCriterion = !seen && !rosterBelowMin && weakest
    ? { id: "gap", label: "Lücke", tone: "neutral", text: "Ob er unsere Lücken schließt, kann ich noch nicht sagen.", short: "", score: gapScore }
    : { id: "gap", label: "Lücke", tone: toneFromScore(gapScore, 0.5, 0.15), text: seen ? hedge(gapText) : gapText, short: gapShort, score: gapScore };

  // ── Ergänzung ────────────────────────────────────────────────────────────────────────────────
  const compositeBefore = computeCompositeTopSixAverage(impact, "before");
  const compositeAfter = computeCompositeTopSixAverage(impact, "after");
  const compositeDelta = compositeBefore != null && compositeAfter != null ? compositeAfter - compositeBefore : null;
  const strongest = [...knownAxes].sort((left, right) => (right.before ?? 0) - (left.before ?? 0))[0] ?? null;
  let complementScore: number;
  let complementText: string;
  let complementShort: string;
  if (compositeDelta == null) {
    complementScore = 0.5;
    complementText = "Ohne Kader lässt sich noch nicht sagen, wie er ihn ergänzt.";
    complementShort = "";
  } else {
    complementScore = clamp01(compositeDelta / 2.5);
    const redundant = strongest != null && strongest.axis === best.axis && (strongest.delta ?? 0) <= 0;
    if (compositeDelta >= 1) {
      complementText = `Hebt unseren Top-6-Schnitt${firm ? ` um +${fmt(compositeDelta, 1)}` : " spürbar"} — sein Profil ergänzt uns gut.`;
      complementShort = "ergänzt unser Profil gut";
    } else if (redundant) {
      complementScore = Math.min(complementScore, 0.2);
      complementText = `Doppelt nur, was wir schon haben: ${AXIS_LABEL[best.axis]} ist ohnehin unsere Stärke, und dort käme er nicht in die Top 6.`;
      complementShort = "doppelt nur unsere Stärke";
    } else if (compositeDelta > 0) {
      complementText = "Würde unsere Top 6 nur am Rand bewegen — eher Kaderbreite als Verstärkung.";
      complementShort = "wäre eher Kaderbreite";
    } else {
      complementText = "Käme auf keiner Achse in unsere Top 6 — reine Kaderbreite.";
      complementShort = "käme nicht in unsere Top 6";
    }
  }
  const complementCriterion: ScoutVerdictCriterion = !seen
    ? { id: "complement", label: "Ergänzung", tone: "neutral", text: "Wie er zu unserem Kader passt, sehe ich erst nach mehr Spielen.", short: "", score: complementScore }
    : { id: "complement", label: "Ergänzung", tone: toneFromScore(complementScore, 0.4, 0.15), text: hedge(complementText), short: complementShort, score: complementScore };

  // ── Fit (Basisinfos, immer sichtbar) ─────────────────────────────────────────────────────────
  const fit = calculateTransfermarktFit(
    {
      race: player.race,
      alignment: player.alignment,
      subclasses: player.subclasses ?? [],
      traitsPositive: player.traitsPositive ?? [],
      traitsNegative: player.traitsNegative ?? [],
    },
    rosterPlayers.map((entry) => ({
      race: entry.race,
      alignment: entry.alignment,
      subclasses: entry.subclasses ?? [],
      traitsPositive: entry.traitsPositive ?? [],
      traitsNegative: entry.traitsNegative ?? [],
    })),
    { teamId },
  );
  const teamFit = fit.teamFit ?? 0;
  const fitScore = clamp01((teamFit + 5) / 25);
  const fitCriterion: ScoutVerdictCriterion =
    teamFit >= 10
      ? { id: "fit", label: "Fit", tone: "positive", text: `Passt gut zu uns (Fit ${fmt(teamFit, 1)}) — Rasse und Klasse sind bei uns gern gesehen.`, short: "passt gut zu uns", score: fitScore }
      : teamFit >= 0
        ? { id: "fit", label: "Fit", tone: "neutral", text: `Fit ${fmt(teamFit, 1)} — kein Problem, aber auch kein Bonus für die Harmonie.`, short: "", score: fitScore }
        : { id: "fit", label: "Fit", tone: "negative", text: `Passt schlecht zu uns (Fit ${fmt(teamFit, 1)}) — das kann die Harmonie kosten.`, short: "passt schlecht zu uns", score: fitScore };

  // ── Preis (Marktwert gegen vergleichbar starke Spieler) ──────────────────────────────────────
  const candidateMean = axisMean(player);
  const marketValue = typeof player.marketValue === "number" && Number.isFinite(player.marketValue) ? player.marketValue : null;
  const pricedPool = gameState.players.filter(
    (entry) => entry.id !== player.id && typeof entry.marketValue === "number" && Number.isFinite(entry.marketValue) && entry.marketValue > 0,
  );
  let peers = pricedPool.filter((entry) => Math.abs(axisMean(entry) - candidateMean) <= 4);
  if (peers.length < 5) peers = pricedPool.filter((entry) => Math.abs(axisMean(entry) - candidateMean) <= 8);
  const peerMedian = peers.length >= 3 ? median(peers.map((entry) => entry.marketValue)) : null;
  let priceCriterion: ScoutVerdictCriterion;
  if (marketValue == null || peerMedian == null || peerMedian <= 0) {
    priceCriterion = { id: "price", label: "Preis", tone: "neutral", text: "Zu wenige vergleichbare Spieler, um den Preis einzuordnen.", short: "", score: 0.5 };
  } else {
    const ratio = marketValue / peerMedian;
    const priceScore = clamp01(0.5 + (1 - ratio) * 1.25);
    const diffPct = Math.round(Math.abs(ratio - 1) * 100);
    const compare = `vergleichbar starke Spieler kosten im Schnitt ${fmtMoney(peerMedian)}`;
    priceCriterion =
      ratio <= 0.8
        ? { id: "price", label: "Preis", tone: "positive", text: `Günstig: ${fmtMoney(marketValue)}, ${compare} (−${diffPct} %).`, short: "ist günstig", score: priceScore }
        : ratio >= 1.25
          ? { id: "price", label: "Preis", tone: "negative", text: `Teuer: ${fmtMoney(marketValue)}, ${compare} (+${diffPct} %).`, short: "ist teuer", score: priceScore }
          : { id: "price", label: "Preis", tone: "neutral", text: `Fairer Preis: ${fmtMoney(marketValue)}, ${compare}.`, short: "", score: priceScore };
    if (team && Number.isFinite(team.cash) && marketValue > team.cash) {
      priceCriterion = {
        ...priceCriterion,
        text: `${priceCriterion.text} Aktuell übersteigt er unser Cash (${fmtMoney(team.cash)}).`,
      };
    }
  }

  // ── Potenzial (Hinweis, ohne Gewicht) ────────────────────────────────────────────────────────
  const potentialBand = gameState.playerPotential?.find((entry) => entry.playerId === player.id)?.potentialBand ?? null;
  const potentialCriterion: ScoutVerdictCriterion | null =
    potentialBand && (forceVisible || scoutingPercent >= 50)
      ? potentialBand === "elite" || potentialBand === "high"
        ? { id: "potential", label: "Potenzial", tone: "positive", text: hedge(`Da ist noch viel Luft nach oben (Potenzial ${potentialBand === "elite" ? "Elite" : "hoch"}).`), short: "hat viel Potenzial", score: null }
        : potentialBand === "low"
          ? { id: "potential", label: "Potenzial", tone: "negative", text: hedge("Viel mehr wird aus ihm nicht mehr."), short: "", score: null }
          : { id: "potential", label: "Potenzial", tone: "neutral", text: hedge("Etwas Entwicklung ist noch drin."), short: "", score: null }
      : null;

  // ── Empfehlungswert & Note ───────────────────────────────────────────────────────────────────
  const weighted =
    SCOUT_VERDICT_WEIGHTS.skill * skillScore +
    SCOUT_VERDICT_WEIGHTS.gap * gapScore +
    SCOUT_VERDICT_WEIGHTS.complement * complementScore +
    SCOUT_VERDICT_WEIGHTS.fit * fitScore +
    SCOUT_VERDICT_WEIGHTS.price * (priceCriterion.score ?? 0.5);
  const score = Math.round(Math.min(100, Math.max(0, weighted)) * 10) / 10;
  const exact = scoreToScoutGrade(score);
  const { display, wholeForLabel } = formatScoutGradeDisplay({
    exactGrade: exact.label,
    wholeGrade: exact.whole,
    visibility,
    playerId: player.id,
  });
  const recommendation = getScoutRecommendation(wholeForLabel);

  const criteria = [skillCriterion, gapCriterion, complementCriterion, fitCriterion, priceCriterion];
  if (potentialCriterion) criteria.push(potentialCriterion);

  // ── Fazit in der Stimme des Scouts ───────────────────────────────────────────────────────────
  const positives = criteria.filter((entry) => entry.tone === "positive" && entry.short).map((entry) => entry.short);
  const negatives = criteria.filter((entry) => entry.tone === "negative" && entry.short).map((entry) => entry.short);
  const join = (parts: string[]) => (parts.length <= 1 ? parts[0] ?? "" : `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`);
  let summary: string;
  if (wholeForLabel == null) {
    summary = `Ich habe ${player.name} erst ${scoutingPercent} % gescoutet — für ein Urteil ist es zu früh.${
      positives.length > 0 ? ` Was ich schon sagen kann: er ${join(positives.slice(0, 2))}.` : ""
    }`;
  } else if (wholeForLabel <= 2) {
    summary = `Ich würde ihn holen${positives.length > 0 ? ` — er ${join(positives.slice(0, 2))}` : ""}.${
      negatives.length > 0 ? ` Einziger Haken: er ${negatives[0]}.` : ""
    }`;
  } else if (wholeForLabel === 3) {
    summary = `Eine solide Option${positives.length > 0 ? `: er ${join(positives.slice(0, 2))}` : ""}.${
      negatives.length > 0 ? ` Aber er ${join(negatives.slice(0, 2))}.` : ""
    }`;
  } else {
    summary = `Ich rate ab${negatives.length > 0 ? ` — er ${join(negatives.slice(0, 2))}` : ""}.${
      positives.length > 0 ? ` Immerhin: er ${positives[0]}.` : ""
    }`;
  }
  if (seen && !firm && wholeForLabel != null) {
    summary = `${summary} (Stand ${scoutingPercent} % — das Bild wird noch schärfer.)`;
  }

  // ── Einordnung POW/SPE/MEN/SOC (Transfermarkt-Muster) ────────────────────────────────────────
  const axisComparison: ScoutAxisComparisonRow[] = TRANSFERMARKT_AXIS_KEYS.map((axis) => {
    const row = impact.find((entry) => entry.axis === axis);
    return {
      axis,
      value: firm ? candidateAxes?.[axis] ?? null : null,
      teamTopAverage: row?.before ?? null,
      rankLabel:
        seen && rosterPlayers.length > 0
          ? formatTeamRankEstimateLabel(
              displayRanks.find((entry) => entry.axis === axis),
              rankConfidence,
            )
          : null,
    };
  });

  return {
    playerId: player.id,
    scoutingPercent,
    visibility,
    score,
    exactGrade: exact.label,
    gradeDisplay: display,
    displayWholeGrade: wholeForLabel,
    recommendation: recommendation.label,
    recommendationTone: recommendation.tone,
    summary,
    criteria,
    axisComparison,
  };
}

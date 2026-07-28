// =====================================================================================
// Captain- und Formkarten-Einsatz je Team fuer die Spieltags-Wertung
// =====================================================================================
//
// Die Spieltags-Wertung zeigte bisher nur Punkte. Nicht sichtbar war, WIE ein Team in
// den Spieltag gegangen ist: mit oder ohne Captain, und mit welchen Formkarten. Genau
// das ist aber die interessante Frage beim Nachlesen eines Spieltags — z. B. wenn ein
// Team in einer 4er-Diszi den Captain verbrennt, oder mit negativer Form in eine
// Disziplin geht, in der es eigentlich fuehrt.
//
// WICHTIG — hier wird nichts neu berechnet. Alle Werte kommen 1:1 aus der Resolve-
// Preview, also aus dem, was im Spiel tatsaechlich angewandt wurde (die Preview liest
// ihrerseits die gespeicherten Draft-Modifier). Wuerde man den Captain oder die
// Formkarten hier neu bestimmen, zeigte die Wertung im Nachhinein womoeglich etwas
// anderes an als das, was der Spieltag gesehen hat.

/** Formkarten-Tendenz einer Seite — traegt die Aussage "positiv/negativ reingegangen". */
export type MatchdayFormTone = "positive" | "negative" | "neutral" | "none";

export type MatchdayTeamSideModifiers = {
  /** Kompakt-Label der gesetzten Karten, z. B. "R+3 · B-2" (×2 = Farbtreffer). */
  formCardLabel: string | null;
  /** Summierter Form-Beitrag zum Team-Score (Vorzeichen = Richtung). */
  formModifier: number | null;
  formTone: MatchdayFormTone;
  captainUsed: boolean;
  /** Name des eingesetzten Captains, sofern er in dieser Diszi aufgestellt war. */
  captainName: string | null;
  captainBonus: number | null;
};

export type MatchdayTeamModifiers = {
  d1: MatchdayTeamSideModifiers | null;
  d2: MatchdayTeamSideModifiers | null;
};

const EMPTY_SIDE: MatchdayTeamSideModifiers = {
  formCardLabel: null,
  formModifier: null,
  formTone: "none",
  captainUsed: false,
  captainName: null,
  captainBonus: null,
};

/** Minimal-Form der Preview-Felder, die hier gelesen werden (bewusst strukturell). */
type SideSource = {
  teamId: string;
  disciplineId: string;
  formCardLabel?: string | null;
  formModifier?: number | null;
  captainBonus?: number | null;
  captainStatus?: string | null;
  entries?: Array<{ playerName?: string | null; isCaptain?: boolean; captainBonus?: number | null }> | null;
};

function toneOf(formModifier: number | null | undefined, label: string | null | undefined): MatchdayFormTone {
  if (label == null || label.length === 0) return "none";
  if (formModifier == null) return "neutral";
  // Kleine Restbetraege sind Rundungsrauschen, keine Aussage.
  if (formModifier > 0.05) return "positive";
  if (formModifier < -0.05) return "negative";
  return "neutral";
}

function buildSide(source: SideSource): MatchdayTeamSideModifiers {
  const entries = source.entries ?? [];
  const captainEntry = entries.find((entry) => entry.isCaptain === true) ?? null;
  // Der Captain zaehlt als "genutzt", sobald er in dieser Diszi aufgestellt war —
  // auch wenn sein Bonus 0 ergibt. Genau das ist die Information, die interessiert
  // (Captain verbraucht, aber nichts gebracht). Fehlt der Eintrag, kann ein reiner
  // Team-Level-Effekt trotzdem einen Bonus getragen haben.
  const captainBonus = captainEntry?.captainBonus ?? source.captainBonus ?? null;
  const captainUsed = captainEntry != null || (captainBonus != null && Math.abs(captainBonus) > 0.05);

  const formCardLabel = source.formCardLabel ?? null;
  const formModifier = source.formModifier ?? null;

  return {
    formCardLabel,
    formModifier,
    formTone: toneOf(formModifier, formCardLabel),
    captainUsed,
    captainName: captainEntry?.playerName ?? null,
    captainBonus: captainUsed ? captainBonus : null,
  };
}

/**
 * Baut je Team die Captain-/Formkarten-Uebersicht fuer d1 und d2.
 *
 * Die Zuordnung laeuft ueber die Disziplin-ID (nicht ueber `disciplineSide` der
 * Preview), weil das Panel seine Seiten aus dem Spielplan des angezeigten Spieltags
 * kennt — so bleibt die Anzeige auch dann korrekt, wenn eine Preview mehr Disziplinen
 * enthaelt als der gerade betrachtete Spieltag.
 */
export function buildMatchdayTeamModifiers(input: {
  disciplinePreviews?: Array<{ disciplineId: string; teamResults?: SideSource[] | null }> | null;
  d1DisciplineId?: string | null;
  d2DisciplineId?: string | null;
}): Map<string, MatchdayTeamModifiers> {
  const byTeam = new Map<string, MatchdayTeamModifiers>();
  for (const preview of input.disciplinePreviews ?? []) {
    const side =
      preview.disciplineId === input.d1DisciplineId
        ? "d1"
        : preview.disciplineId === input.d2DisciplineId
          ? "d2"
          : null;
    if (side == null) continue;

    for (const teamResult of preview.teamResults ?? []) {
      const current = byTeam.get(teamResult.teamId) ?? { d1: null, d2: null };
      current[side] = buildSide(teamResult);
      byTeam.set(teamResult.teamId, current);
    }
  }
  return byTeam;
}

/** Kurzfassung fuer den Tooltip: was das Team an diesem Spieltag eingesetzt hat. */
export function describeMatchdaySideModifiers(side: MatchdayTeamSideModifiers | null): string {
  const value = side ?? EMPTY_SIDE;
  const parts: string[] = [];

  if (value.captainUsed) {
    const bonus = value.captainBonus == null ? null : `${value.captainBonus > 0 ? "+" : ""}${value.captainBonus.toFixed(1)}`;
    parts.push(
      value.captainName != null
        ? `Captain: ${value.captainName}${bonus ? ` (${bonus})` : ""}`
        : `Captain gesetzt${bonus ? ` (${bonus})` : ""}`,
    );
  } else {
    parts.push("Kein Captain");
  }

  if (value.formCardLabel != null) {
    const modifier =
      value.formModifier == null
        ? null
        : `${value.formModifier > 0 ? "+" : ""}${value.formModifier.toFixed(1)}`;
    parts.push(`Form: ${value.formCardLabel}${modifier ? ` (${modifier})` : ""}`);
  } else {
    parts.push("Keine Formkarte");
  }

  return parts.join(" · ");
}

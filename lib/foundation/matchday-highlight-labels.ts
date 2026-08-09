/**
 * Deutsche Klartexte für die Spieltags-Highlights — der Highlights-Block des
 * Spieltagsergebnisses zeigte vorher den rohen Enum-Namen UND den englischen
 * Engine-Satz wörtlich im Spieler-UI („BEST_PLAYER_DISCIPLINE — Top player in
 * Staffel").
 *
 * Muster wie in `preseason-blocker-labels.ts` (dort für die Blocker-Codes der
 * Preseason-Automatik): EINE Map für die bekannten Typen, und ein Fallback, der
 * NIE wieder rohen Code anzeigt — ein unbekannter Highlight-Typ wird als
 * generische deutsche Karte gerendert und per `console.warn` gemeldet, statt
 * als kaputter Enum-Name durchzurutschen.
 *
 * Die Rohdaten (`disciplineHighlights.highlightType`/`shortSummary`) bleiben
 * unangetastet — übersetzt wird erst beim Aufbereiten fürs Rendern. Der Satz
 * (value) wird aus dem gespeicherten `payload` gebaut (Spieler-/Teamnamen,
 * Scores), damit auch der Inhalt deutsch ist; nur wenn das Payload nichts
 * hergibt, bleibt der gespeicherte Kurztext als letzte Auskunft stehen.
 */

export type MatchdayHighlightDisplay = {
  /** Deutsche Kategorie-Überschrift (nie der rohe Enum-Name). */
  label: string;
  /** Deutscher Inhaltssatz aus dem Payload (Fallback: gespeicherter Kurztext). */
  value: string;
  /** Kurz-Glyphe fürs Badge der Karte. */
  glyph: string;
};

type HighlightLike = {
  highlightType: string;
  shortSummary?: string | null;
  payload?: Record<string, unknown> | null;
  disciplineName?: string | null;
};

function zahl(wert: unknown, nachkommastellen = 1): string | null {
  if (typeof wert !== "number" || !Number.isFinite(wert)) return null;
  return wert.toLocaleString("de-DE", {
    minimumFractionDigits: nachkommastellen,
    maximumFractionDigits: nachkommastellen,
  });
}

function text(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim() !== "" ? wert.trim() : null;
}

const HIGHLIGHT_TYPE_LABELS: Record<string, { label: string; glyph: string }> = {
  best_player_discipline: { label: "Bester Spieler", glyph: "MVP" },
  strongest_team_score: { label: "Stärkstes Team", glyph: "TOP" },
  closest_score_gap: { label: "Knappstes Duell", glyph: "DUE" },
  missing_lineup_warning: { label: "Ohne Aufstellung", glyph: "!" },
  injury_event: { label: "Verletzung", glyph: "+" },
};

export function formatMatchdayHighlight(highlight: HighlightLike): MatchdayHighlightDisplay {
  const payload = highlight.payload ?? {};
  const inDisziplin = highlight.disciplineName ? ` in ${highlight.disciplineName}` : "";
  const meta = HIGHLIGHT_TYPE_LABELS[highlight.highlightType];

  let value: string | null = null;
  switch (highlight.highlightType) {
    case "best_player_discipline": {
      const name = text(payload["playerName"]);
      const score = zahl(payload["finalPlayerScore"]);
      value = name ? `${name}${inDisziplin}${score ? ` — ${score} Score` : ""}` : null;
      break;
    }
    case "strongest_team_score": {
      const team = text(payload["teamName"]);
      const score = zahl(payload["score"]);
      value = team ? `${team}${inDisziplin}${score ? ` — ${score} Score` : ""}` : null;
      break;
    }
    case "closest_score_gap": {
      const teamA = text(payload["teamA"]);
      const teamB = text(payload["teamB"]);
      const gap = zahl(payload["gap"]);
      value =
        teamA && teamB
          ? `${teamA} gegen ${teamB}${inDisziplin}${gap ? ` — nur ${gap} Score Abstand` : ""}`
          : null;
      break;
    }
    case "missing_lineup_warning": {
      const team = text(payload["teamName"]);
      value = team ? `${team} trat${inDisziplin} ohne Einsatzliste an` : null;
      break;
    }
    case "injury_event": {
      const name = text(payload["playerName"]);
      value = name ? `${name} hat sich${inDisziplin} verletzt` : null;
      break;
    }
    default:
      value = null;
  }

  if (!meta && typeof console !== "undefined") {
    // NIE rohen Code anzeigen — derselbe Vertrag wie formatPreseasonBlockerLabel.
    console.warn(
      `[matchday-highlight] Highlight-Typ ohne deutsche Übersetzung: ${highlight.highlightType} — Eintrag in HIGHLIGHT_TYPE_LABELS ergänzen.`,
    );
  }

  return {
    label: meta?.label ?? "Spieltags-Moment",
    glyph: meta?.glyph ?? "★",
    // Letzter Rückfall ist der gespeicherte Kurztext (ein Satz, kein Code) —
    // besser eine englische Auskunft als gar keine.
    value: value ?? text(highlight.shortSummary) ?? "—",
  };
}

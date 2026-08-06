"use client";

import { useMemo } from "react";

import { NL_TONE_VAR, nlToneClass, type NlTone } from "@/components/foundation/new-look/nl-tones";

export type NlSparklineProps = {
  /** Werte-Reihe in zeitlicher Reihenfolge; nicht-numerische Einträge werden übersprungen. */
  points: number[];
  tone?: NlTone;
  /**
   * Beschriftung je Punkt, in derselben Reihenfolge wie `points` — z. B. „Saison 3 · 412,5".
   *
   * GEMELDET VON CHRIS: „mit nem Hover zb ne Liniendiagramm-Grafik oder so von dem Team sieht wie
   * die Entwicklung war." Ohne Beschriftung ist eine Sparkline eine Form ohne Zahlen: man sieht,
   * DASS es hoch ging, aber nicht von wo nach wo. Sind Labels da, bekommt jeder Punkt einen
   * Treffer-Bereich mit `<title>`; ohne bleibt die Grafik exakt wie bisher.
   */
  pointLabels?: string[];
  "aria-label"?: string;
  className?: string;
};

const SPARK_WIDTH = 120;
const SPARK_HEIGHT = 32;
const SPARK_PAD = 4;

function buildSparklineGeometry(points: number[]) {
  const values = (points ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) {
    return null;
  }

  const innerWidth = SPARK_WIDTH - SPARK_PAD * 2;
  const innerHeight = SPARK_HEIGHT - SPARK_PAD * 2;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = Math.max(maxValue - minValue, 1e-9);

  const coordinates = values.map((value, index) => ({
    x: SPARK_PAD + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth),
    y: SPARK_PAD + innerHeight - ((value - minValue) / valueSpan) * innerHeight,
  }));

  return {
    coordinates,
    polyline: coordinates.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
    last: coordinates[coordinates.length - 1],
  };
}

/**
 * Inline-Sparkline (handgerolltes SVG, viewBox-basiert) für kleine
 * Verlaufs-Hinweise in Chips, Karten und Tabellenzellen.
 */
export function NlSparkline({ points, tone = "accent", pointLabels, "aria-label": ariaLabel, className }: NlSparklineProps) {
  const geometry = useMemo(() => buildSparklineGeometry(points), [points]);

  if (!geometry) {
    return (
      <span className={["nl-sparkline", "is-empty", className ?? ""].filter(Boolean).join(" ")} aria-hidden="true">
        —
      </span>
    );
  }

  const stroke = NL_TONE_VAR[tone];
  return (
    <svg
      className={["nl-sparkline", nlToneClass(tone), className ?? ""].filter(Boolean).join(" ")}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel ?? "Verlauf"}
    >
      <polyline points={geometry.polyline} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={geometry.last.x} cy={geometry.last.y} r={2.5} fill={stroke} />
      {/*
        Treffer-Bereiche fuer den Hover. Sie sind bewusst groesser als der sichtbare Punkt (r=6 auf
        einer 120x32-Flaeche) — ein 2,5px-Punkt ist mit der Maus nicht zu treffen. `fill="transparent"`
        statt `opacity: 0`, weil ein vollstaendig transparentes Element sonst keine Zeigerereignisse
        bekaeme und der Hover nie ausloeste.
      */}
      {pointLabels && pointLabels.length > 0
        ? geometry.coordinates.map((point, index) =>
            pointLabels[index] ? (
              <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={6} fill="transparent">
                <title>{pointLabels[index]}</title>
              </circle>
            ) : null,
          )
        : null}
    </svg>
  );
}

export default NlSparkline;

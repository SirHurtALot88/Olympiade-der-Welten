"use client";

import { useEffect, useMemo, useRef } from "react";

import type { ScoutingReportData } from "@/lib/scouting/scouting-report-service";

/**
 * "Erkenntnis-Ladder" — visualisiert, wie tief das Scouting-Wissen zu EINEM
 * Spieler bereits reicht (nicht zu verwechseln mit der Team-weiten
 * "Fog of War"-Leiter in `ScoutingCenterV2NewLook`, die die Facility-Stufe
 * zeigt). Nutzt `report.effectiveScoutingLevel` (0–5, echte Formel:
 * facilityLevel + floor(certainty/25), siehe `facility-scout-pipeline-service`)
 * — dieselbe Skala wie die Team-Leiter, hier aber pro Spieler mit eigenen,
 * wissens-orientierten Labels.
 *
 * "Vorher → Nachher"-Reveal-Moment: die Komponente merkt sich (nur im
 * Client-Speicher, pro Spieler-ID) den zuletzt gesehenen Stand. Steigt die
 * Stufe/Intel% oder werden PO-Range/Traits enger bzw. sichtbar, wird das als
 * Diff-Zeile hervorgehoben statt nur den neuen Wert stumpf zu zeigen. Beim
 * allerersten Aufruf für einen Spieler gibt es (mangels Vorher-Wert) noch
 * keinen Reveal — degradiert bewusst graceful statt etwas zu erfinden.
 */

export type ScoutingKnowledgeLadderProps = {
  report: ScoutingReportData;
};

const NL_SCOUT_LADDER_STEPS = [
  { level: 0, label: "Gesichtet" },
  { level: 1, label: "Beobachtet" },
  { level: 2, label: "Analysiert" },
  { level: 3, label: "Vertieft" },
  { level: 4, label: "Durchleuchtet" },
  { level: 5, label: "Vollständig" },
] as const;

type NlScoutKnowledgeSnapshot = {
  effectiveScoutingLevel: number;
  certainty: number;
  poStarMin: number | null;
  poStarMax: number | null;
  visiblePositive: string[];
  visibleNegative: string[];
  hiddenPositiveCount: number;
  hiddenNegativeCount: number;
};

function buildSnapshot(report: ScoutingReportData): NlScoutKnowledgeSnapshot {
  return {
    effectiveScoutingLevel: report.effectiveScoutingLevel,
    certainty: report.certainty,
    poStarMin: report.poStarMin,
    poStarMax: report.poStarMax,
    visiblePositive: report.traits.visiblePositive,
    visibleNegative: report.traits.visibleNegative,
    hiddenPositiveCount: report.traits.hiddenPositiveCount,
    hiddenNegativeCount: report.traits.hiddenNegativeCount,
  };
}

function diffNewEntries(previous: string[], current: string[]): string[] {
  const previousSet = new Set(previous);
  return current.filter((entry) => !previousSet.has(entry));
}

export default function ScoutingKnowledgeLadder({ report }: ScoutingKnowledgeLadderProps) {
  // Ref statt State: die Snapshot-Historie soll den Vorher-Wert NICHT
  // sofort überschreiben, bevor der Diff für den aktuellen Render gelesen
  // wurde — daher Update im Effect, Lesen synchron beim Render.
  const snapshotsByPlayerIdRef = useRef<Map<string, NlScoutKnowledgeSnapshot>>(new Map());
  const current = useMemo(() => buildSnapshot(report), [report]);
  const previous = snapshotsByPlayerIdRef.current.get(report.playerId) ?? null;

  useEffect(() => {
    snapshotsByPlayerIdRef.current.set(report.playerId, current);
    if (snapshotsByPlayerIdRef.current.size > 64) {
      const oldestKey = snapshotsByPlayerIdRef.current.keys().next().value;
      if (oldestKey) {
        snapshotsByPlayerIdRef.current.delete(oldestKey);
      }
    }
  }, [report.playerId, current]);

  const hasAdvanced = previous != null && current.effectiveScoutingLevel > previous.effectiveScoutingLevel;
  const certaintyRose = previous != null && !hasAdvanced && current.certainty > previous.certainty;
  const newPositiveTraits = previous ? diffNewEntries(previous.visiblePositive, current.visiblePositive) : [];
  const newNegativeTraits = previous ? diffNewEntries(previous.visibleNegative, current.visibleNegative) : [];
  const previousPoSpan =
    previous?.poStarMin != null && previous?.poStarMax != null ? previous.poStarMax - previous.poStarMin : null;
  const currentPoSpan = current.poStarMin != null && current.poStarMax != null ? current.poStarMax - current.poStarMin : null;
  const poRangeNarrowed =
    previous != null && previousPoSpan != null && currentPoSpan != null && currentPoSpan < previousPoSpan;
  const traitsRevealedCount =
    previous != null ? Math.max(0, previous.hiddenPositiveCount - current.hiddenPositiveCount) +
      Math.max(0, previous.hiddenNegativeCount - current.hiddenNegativeCount) : 0;

  const showRevealMoment =
    hasAdvanced || certaintyRose || poRangeNarrowed || newPositiveTraits.length > 0 || newNegativeTraits.length > 0;

  return (
    <div className="nl-scout-ladder" data-testid="scouting-knowledge-ladder">
      <div className="nl-scout-ladder-rail" role="list" aria-label={`Erkenntnisstufe zu ${report.playerName}`}>
        {NL_SCOUT_LADDER_STEPS.map((step) => (
          <div
            key={step.level}
            role="listitem"
            className={`nl-scout-ladder-step${step.level <= current.effectiveScoutingLevel ? " is-reached" : ""}${
              step.level === current.effectiveScoutingLevel ? " is-current" : ""
            }`}
            title={`L${step.level} · ${step.label}`}
          >
            <span className="nl-scout-ladder-dot nl-tnum">{step.level}</span>
            <small>{step.label}</small>
          </div>
        ))}
      </div>
      <p className="nl-scout-ladder-meta muted">
        {report.isFullyScouted ? "Vollständig gescoutet — nichts mehr verdeckt." : `${report.certainty}% Intel · ${report.milestone}`}
      </p>

      {showRevealMoment ? (
        <div className="nl-scout-ladder-reveal" data-testid="scouting-knowledge-reveal">
          <span className="nl-scout-ladder-reveal-eyebrow">Neue Erkenntnis seit letztem Blick</span>
          {hasAdvanced && previous ? (
            <div className="nl-scout-ladder-reveal-row">
              <span>Erkenntnisstufe</span>
              <strong className="nl-tnum">
                L{previous.effectiveScoutingLevel} · {NL_SCOUT_LADDER_STEPS[previous.effectiveScoutingLevel]?.label} → L
                {current.effectiveScoutingLevel} · {NL_SCOUT_LADDER_STEPS[current.effectiveScoutingLevel]?.label}
              </strong>
            </div>
          ) : certaintyRose && previous ? (
            <div className="nl-scout-ladder-reveal-row">
              <span>Intel</span>
              <strong className="nl-tnum">
                {previous.certainty}% → {current.certainty}%
              </strong>
            </div>
          ) : null}
          {poRangeNarrowed && previous && previousPoSpan != null && currentPoSpan != null ? (
            <div className="nl-scout-ladder-reveal-row">
              <span>PO-Range</span>
              <strong className="nl-tnum">
                {previous.poStarMin?.toFixed(1)}–{previous.poStarMax?.toFixed(1)}★ → {current.poStarMin?.toFixed(1)}–
                {current.poStarMax?.toFixed(1)}★
              </strong>
            </div>
          ) : null}
          {newPositiveTraits.length > 0 ? (
            <div className="nl-scout-ladder-reveal-row">
              <span>Neue Stärken</span>
              <span className="nl-scout-ladder-reveal-traits">
                {newPositiveTraits.map((trait) => (
                  <span key={trait} className="nl-scout-ladder-trait-pill is-positive">
                    + {trait}
                  </span>
                ))}
              </span>
            </div>
          ) : null}
          {newNegativeTraits.length > 0 ? (
            <div className="nl-scout-ladder-reveal-row">
              <span>Neue Risiken</span>
              <span className="nl-scout-ladder-reveal-traits">
                {newNegativeTraits.map((trait) => (
                  <span key={trait} className="nl-scout-ladder-trait-pill is-negative">
                    − {trait}
                  </span>
                ))}
              </span>
            </div>
          ) : null}
          {traitsRevealedCount > 0 && newPositiveTraits.length === 0 && newNegativeTraits.length === 0 ? (
            <div className="nl-scout-ladder-reveal-row">
              <span>Traits</span>
              <strong className="nl-tnum">{traitsRevealedCount} weniger verdeckt</strong>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

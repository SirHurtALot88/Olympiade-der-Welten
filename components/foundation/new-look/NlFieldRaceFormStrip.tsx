"use client";

import { NlDeltaChip } from "@/components/foundation/new-look/NlDeltaChip";
import { NlSparkline } from "@/components/foundation/new-look/NlSparkline";
import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";
import type { FieldRaceLedgerEntry } from "@/lib/foundation/build-field-race-ledger";

export type NlFieldRaceFormStripProps = {
  /** Letzte bis zu 5 Spieltage eines Teams — chronologisch (ältester zuerst). */
  entries: FieldRaceLedgerEntry[];
  /** Insgesamt bereits gespielte Spieltage der Season (für die Frühphasen-Notiz). */
  playedMatchdayCount?: number;
  /** Kompaktere Variante (z. B. für die Home-Hero-Zeile). */
  compact?: boolean;
  className?: string;
};

function formatMovement(value: number): string {
  if (value === 0) return "±0";
  return `${value > 0 ? "+" : ""}${formatNlNumber(value, 0)}`;
}

/**
 * "Feld-Form-Strip" (Wave D · D1): kompakte Lese-Hilfe „wer ist heiß" für das
 * Multi-Team-Feldrennen. Pro Spieltag die Tagespunkte und die Rang-Bewegung
 * gegenüber dem Vor-Spieltag (`rankDeltaVsPrev`, ▲ = Plätze gutgemacht) plus
 * eine Mini-Sparkline des kumulativen Rangs (invertiert: oben = besser).
 *
 * Fog-of-War-sicher — liest nur öffentliche Tagespunkte/-ränge aus dem
 * bereits gebauten Feld-Rennen-Ledger, kein verstecktes Potential.
 *
 * Früh-/Leerzustand (0–1 gespielte Spieltage, z. B. S1/MD1): eine bewusste
 * „Noch keine Form"-Notiz statt einer leeren Box.
 */
export function NlFieldRaceFormStrip({
  entries,
  playedMatchdayCount,
  compact = false,
  className,
}: NlFieldRaceFormStripProps) {
  const classes = ["nl-form-strip", compact ? "is-compact" : "", className ?? ""].filter(Boolean).join(" ");

  if (entries.length <= 1) {
    const count = playedMatchdayCount ?? entries.length;
    return (
      <div className={`${classes} is-empty`} data-testid="nl-form-strip">
        <span className="nl-form-strip-label">Form</span>
        <span className="nl-form-strip-empty">
          Noch keine Form — erst {formatNlNumber(count, 0)} Spieltag{count === 1 ? "" : "e"}
        </span>
      </div>
    );
  }

  // Kumulativen Rang für die Sparkline invertieren (Rang 1 = am besten → oben).
  const rankSparkPoints = entries
    .map((entry) => entry.cumulativeRank)
    .filter((rank): rank is number => typeof rank === "number" && Number.isFinite(rank))
    .map((rank) => -rank);

  return (
    <div className={classes} data-testid="nl-form-strip" aria-label={`Form der letzten ${entries.length} Spieltage`}>
      <span className="nl-form-strip-label">Form · letzte {formatNlNumber(entries.length, 0)}</span>
      <ol className="nl-form-strip-days">
        {entries.map((entry) => (
          <li
            key={entry.matchdayId}
            className="nl-form-strip-day"
            title={
              `Spieltag ${entry.matchdayNumber}: ${formatNlNumber(entry.tagespunkte, 1)} Tagespunkte` +
              (entry.tagesrang != null ? ` · Tagesrang #${formatNlNumber(entry.tagesrang, 0)}` : "") +
              (entry.cumulativeRank != null ? ` · Gesamtrang #${formatNlNumber(entry.cumulativeRank, 0)}` : "") +
              (entry.rankDeltaVsPrev != null
                ? ` · ${formatMovement(entry.rankDeltaVsPrev)} Plätze ggü. Vor-Spieltag`
                : " · neu")
            }
          >
            <span className="nl-form-strip-md nl-tnum">S{formatNlNumber(entry.matchdayNumber, 0)}</span>
            <span className="nl-form-strip-pts nl-tnum">{formatNlNumber(entry.tagespunkte, 1)}</span>
            {entry.rankDeltaVsPrev != null ? (
              <NlDeltaChip
                value={entry.rankDeltaVsPrev}
                format={formatMovement}
                title="Rang-Bewegung gegenüber dem vorherigen Spieltag"
                className="nl-form-strip-delta"
              />
            ) : (
              <span className="nl-form-strip-new nl-tnum">neu</span>
            )}
          </li>
        ))}
      </ol>
      {rankSparkPoints.length >= 2 ? (
        <NlSparkline
          points={rankSparkPoints}
          tone="accent"
          className="nl-form-strip-spark"
          aria-label="Verlauf des Gesamtrangs (oben = besser)"
        />
      ) : null}
    </div>
  );
}

export default NlFieldRaceFormStrip;

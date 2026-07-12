"use client";

/**
 * Feature D5 "Karriere-Story-Header" ("Neuer Look", flag-gated, additiv).
 *
 * Kompakter Karriere-Story-Streifen, der den Bogen eines Spielers aus den
 * BEREITS ARCHIVIERTEN Saison-Metriken zusammenfasst — Peak-OVR-Saison,
 * größter Season-über-Season-Sprung, Longevity (Seasons gespielt) und der
 * letzte Trend. Alle Werte stammen read-time aus `data.historyRows`
 * (`PlayerDrawerHistoryRow` — gefüttert aus gespeicherten Season-Snapshots via
 * `buildPlayerDrawerDataFromGameState`); es wird nichts erfunden oder neu
 * persistiert.
 *
 * Fog-of-war: Dies ist das EIGENE Datenprofil des Spielers (archivierte,
 * bereits sichtbare Snapshot-Metriken) — es werden keine verborgenen
 * Potentiale fremder Teams offengelegt.
 *
 * Datenquelle je Feld (lib/foundation/player-detail-drawer.ts → PlayerDrawerHistoryRow):
 *   - Peak-OVR / Sprung / Trend / Longevity: `historyRows[].ovr`
 *   - Saison-Label: `historyRows[].seasonName` / `.seasonId`
 *   - "archiviert" vs. "live": `historyRows[].isActiveSeason`
 *
 * Nur archivierte Zeilen (`!isActiveSeason`) mit realem `ovr` zählen. Bei < 2
 * archivierten Seasons (z. B. Season 1 läuft) rendert ein sauberer
 * Leer-Zustand statt leerer/erfundener Kacheln.
 *
 * Styles: scratchpad `waveD-career.css` unter `.is-new-look .nl-career-story*`.
 */

import { NlDeltaChip, formatNlNumber } from "@/components/foundation/new-look";
import type { PlayerDrawerHistoryRow } from "@/lib/foundation/player-detail-drawer";

type CareerStorySeason = {
  seasonId: string | null;
  seasonName: string;
  ovr: number;
};

type CareerStory = {
  seasonsPlayed: number;
  peak: { seasonName: string; ovr: number };
  biggestJump: { seasonName: string; fromSeasonName: string; delta: number } | null;
  lastDelta: number | null;
  overallDelta: number;
  headline: string;
  first: CareerStorySeason;
  last: CareerStorySeason;
};

function roundOvr(value: number) {
  return Number(value.toFixed(1));
}

/**
 * Deterministische, rein datengetriebene Ein-Zeilen-Schlagzeile aus dem Bogen
 * der archivierten OVR-Reihe (1–100-Skala, s. `normalizePlayerOvr`). Reihenfolge
 * = Priorität; es wird ausschließlich aus realen Werten abgeleitet.
 */
function deriveHeadline(input: {
  ovrs: number[];
  peakIndex: number;
  biggestJumpIndex: number;
  overallDelta: number;
  lastDelta: number;
}): string {
  const { ovrs, peakIndex, biggestJumpIndex, overallDelta, lastDelta } = input;
  const n = ovrs.length;
  const lastIndex = n - 1;
  const min = Math.min(...ovrs);
  const max = Math.max(...ovrs);
  const range = max - min;
  const peakIsLast = peakIndex === lastIndex;
  const dropFromPeak = max - ovrs[lastIndex];

  // Spätzünder: deutlicher Gesamtanstieg mit dem größten Sprung in der zweiten
  // Karrierehälfte und aktuellem Peak.
  if (overallDelta >= 5 && biggestJumpIndex > lastIndex / 2 && peakIsLast) {
    return "Spätzünder";
  }
  // Weiterhin im Aufwind: aktueller Peak + spürbarer Gesamtanstieg.
  if (overallDelta >= 5 && peakIsLast) {
    return "Im Aufwind";
  }
  // Zenit überschritten: Peak lag früher, jüngster Trend abwärts, klar unter Peak.
  if (!peakIsLast && lastDelta < 0 && dropFromPeak >= 3) {
    return "Zenit überschritten";
  }
  // Konstanter Leistungsträger: enges Band über mehrere Seasons.
  if (range <= 3) {
    return n >= 4 ? "Konstanter Leistungsträger" : "Konstanter Verlauf";
  }
  // Wechselhafte Karriere: große Spannweite ohne klaren Gesamttrend.
  if (range >= 8 && Math.abs(overallDelta) < 3) {
    return "Wechselhafte Karriere";
  }
  if (overallDelta >= 2) {
    return "Aufstrebend";
  }
  if (overallDelta <= -2) {
    return "Im Rückgang";
  }
  return "Stabiler Verlauf";
}

/**
 * Baut die Karriere-Story aus den archivierten History-Zeilen. Liefert `null`,
 * wenn < 2 archivierte Seasons mit realem OVR vorliegen (→ Leer-Zustand).
 */
export function buildPlayerCareerStory(historyRows: PlayerDrawerHistoryRow[]): CareerStory | null {
  const archived = historyRows
    .filter(
      (row): row is PlayerDrawerHistoryRow & { ovr: number } =>
        !row.isActiveSeason && row.ovr != null && Number.isFinite(row.ovr),
    )
    .map((row) => ({ seasonId: row.seasonId, seasonName: row.seasonName, ovr: roundOvr(row.ovr) }));

  // History-Zeilen sind bereits chronologisch aufsteigend; defensiv nachsortieren.
  archived.sort((left, right) =>
    (left.seasonId ?? left.seasonName).localeCompare(right.seasonId ?? right.seasonName, "de", { numeric: true }),
  );

  if (archived.length < 2) {
    return null;
  }

  const ovrs = archived.map((season) => season.ovr);

  // Peak-OVR-Saison: höchster OVR; bei Gleichstand gewinnt die frühere Saison.
  let peakIndex = 0;
  for (let index = 1; index < archived.length; index += 1) {
    if (ovrs[index] > ovrs[peakIndex]) {
      peakIndex = index;
    }
  }

  // Größter Sprung: maximale Season-über-Season-OVR-Änderung (Zielsaison markiert).
  let biggestJumpIndex = 1;
  let biggestJumpDelta = ovrs[1] - ovrs[0];
  for (let index = 2; index < archived.length; index += 1) {
    const delta = ovrs[index] - ovrs[index - 1];
    if (delta > biggestJumpDelta) {
      biggestJumpDelta = delta;
      biggestJumpIndex = index;
    }
  }

  const lastDelta = roundOvr(ovrs[ovrs.length - 1] - ovrs[ovrs.length - 2]);
  const overallDelta = roundOvr(ovrs[ovrs.length - 1] - ovrs[0]);

  return {
    seasonsPlayed: archived.length,
    peak: { seasonName: archived[peakIndex].seasonName, ovr: archived[peakIndex].ovr },
    biggestJump: {
      seasonName: archived[biggestJumpIndex].seasonName,
      fromSeasonName: archived[biggestJumpIndex - 1].seasonName,
      delta: roundOvr(biggestJumpDelta),
    },
    lastDelta,
    overallDelta,
    headline: deriveHeadline({ ovrs, peakIndex, biggestJumpIndex, overallDelta, lastDelta }),
    first: archived[0],
    last: archived[archived.length - 1],
  };
}

export type PlayerCareerStoryHeaderProps = {
  historyRows: PlayerDrawerHistoryRow[];
};

export default function PlayerCareerStoryHeader({ historyRows }: PlayerCareerStoryHeaderProps) {
  const story = buildPlayerCareerStory(historyRows);

  if (!story) {
    // Leer-Zustand: sauberer Hinweis statt leerer/erfundener Kacheln.
    // Unterscheidet 0 archivierte Seasons (Season 1 läuft) von genau einer
    // (Kurve entsteht ab der zweiten Season).
    const activeSeasonName = historyRows.find((row) => row.isActiveSeason)?.seasonName ?? null;
    const archivedCount = historyRows.filter(
      (row) => !row.isActiveSeason && row.ovr != null && Number.isFinite(row.ovr),
    ).length;
    const message =
      archivedCount >= 1
        ? "Erst eine abgeschlossene Season — die Karriere-Kurve entsteht ab der zweiten."
        : `Noch keine Karriere-Historie${activeSeasonName ? ` — ${activeSeasonName} läuft` : ""}.`;
    return (
      <section
        className="is-new-look nl-career-story is-empty"
        data-testid="player-career-story-empty"
        data-new-look="true"
        aria-label="Karriere-Story"
      >
        <span className="nl-career-story-eyebrow">Karriere-Story</span>
        <p className="nl-career-story-empty-copy">{message}</p>
      </section>
    );
  }

  return (
    <section
      className="is-new-look nl-career-story"
      data-testid="player-career-story"
      data-new-look="true"
      aria-label="Karriere-Story"
    >
      <header className="nl-career-story-head">
        <span className="nl-career-story-eyebrow">Karriere-Story</span>
        <strong className="nl-career-story-headline">{story.headline}</strong>
        <span className="nl-career-story-sub">
          Von {formatNlNumber(story.first.ovr, 1)} auf {formatNlNumber(story.last.ovr, 1)} OVR über{" "}
          {story.seasonsPlayed} Seasons
        </span>
      </header>
      <div className="nl-career-story-tiles">
        <div className="nl-career-story-tile" data-testid="career-story-peak">
          <span className="nl-career-story-tile-label">Peak-OVR</span>
          <span className="nl-career-story-tile-value nl-tnum">{formatNlNumber(story.peak.ovr, 1)}</span>
          <span className="nl-career-story-tile-meta">{story.peak.seasonName}</span>
        </div>
        <div className="nl-career-story-tile" data-testid="career-story-jump">
          <span className="nl-career-story-tile-label">Größter Sprung</span>
          <span className="nl-career-story-tile-value">
            {story.biggestJump ? (
              <NlDeltaChip
                value={story.biggestJump.delta}
                title={`OVR-Sprung von ${story.biggestJump.fromSeasonName} auf ${story.biggestJump.seasonName}`}
              />
            ) : (
              "—"
            )}
          </span>
          <span className="nl-career-story-tile-meta">{story.biggestJump?.seasonName ?? "—"}</span>
        </div>
        <div className="nl-career-story-tile" data-testid="career-story-longevity">
          <span className="nl-career-story-tile-label">Seasons gespielt</span>
          <span className="nl-career-story-tile-value nl-tnum">{story.seasonsPlayed}</span>
          <span className="nl-career-story-tile-meta">
            {story.first.seasonName} – {story.last.seasonName}
          </span>
        </div>
        <div className="nl-career-story-tile" data-testid="career-story-trend">
          <span className="nl-career-story-tile-label">Letzter Trend</span>
          <span className="nl-career-story-tile-value">
            {story.lastDelta != null && story.lastDelta !== 0 ? (
              <NlDeltaChip value={story.lastDelta} title={`OVR-Δ der letzten archivierten Season (${story.last.seasonName})`} />
            ) : (
              <span className="nl-tnum">±0</span>
            )}
          </span>
          <span className="nl-career-story-tile-meta">{story.last.seasonName}</span>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useReducer, useRef } from "react";

import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";

type FoundationActivityStripProps = {
  activities: FoundationActivityItem[];
};

type StepHistoryEntry = { label: string; durationMs: number };

type ActivityTrack = {
  prevStats: Record<string, number>;
  prevCurrent: string | null;
  lastEventAt: number;
  history: StepHistoryEntry[];
};

function clampPct(pct: number) {
  return Math.max(0, Math.min(100, pct));
}

function parseLeadingNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatStepDuration(ms: number): string {
  if (ms < 0) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${(Math.round(seconds * 10) / 10).toString().replace(".", ",")}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.round(seconds % 60);
  return `${minutes}m ${restSeconds}s`;
}

/**
 * Beobachtet die laufenden Aktivitäten und baut clientseitig eine kurze Historie der
 * zuletzt abgeschlossenen Schritte auf: immer wenn ein Zähler steigt (Teams/Picks/…) oder
 * die aktuelle Teilaktion wechselt, wird ein Meilenstein mit der seither vergangenen Zeit
 * protokolliert. Serverseitig gibt es dafür keine Schritt-Historie — die Dauer ist also die
 * per Poll gemessene UI-Zeit (Näherung, aber gibt ein Gefühl fürs Tempo).
 */
function useActivityStepHistory(activities: FoundationActivityItem[]) {
  const tracks = useRef<Map<string, ActivityTrack>>(new Map());
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const now = Date.now();
    let changed = false;
    const live = new Set<string>();

    for (const activity of activities) {
      if (!activity.stats && !activity.currentLabel) continue;
      live.add(activity.id);

      const stats: Record<string, number> = {};
      for (const stat of activity.stats ?? []) {
        const value = parseLeadingNumber(stat.value);
        if (Number.isFinite(value)) stats[stat.label] = value;
      }
      const current = activity.currentLabel ?? null;
      const track = tracks.current.get(activity.id);

      if (!track) {
        tracks.current.set(activity.id, { prevStats: stats, prevCurrent: current, lastEventAt: now, history: [] });
        continue;
      }

      const parts: string[] = [];
      for (const [label, value] of Object.entries(stats)) {
        const prev = track.prevStats[label];
        if (prev != null && value > prev) {
          parts.push(label === "Teams" ? `Team fertig (${value})` : `+${value - prev} ${label}`);
        }
      }
      if (current && current !== track.prevCurrent) parts.push(current);

      if (parts.length > 0) {
        track.history = [{ label: parts.join(" · "), durationMs: now - track.lastEventAt }, ...track.history].slice(0, 8);
        track.lastEventAt = now;
        changed = true;
      }
      track.prevStats = stats;
      track.prevCurrent = current;
    }

    for (const id of [...tracks.current.keys()]) {
      if (!live.has(id)) {
        tracks.current.delete(id);
        changed = true;
      }
    }

    if (changed) bump();
  }, [activities]);

  return (id: string): StepHistoryEntry[] => tracks.current.get(id)?.history ?? [];
}

export default function FoundationActivityStrip({ activities }: FoundationActivityStripProps) {
  const getHistory = useActivityStepHistory(activities);

  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="foundation-activity-strip" data-testid="foundation-activity-strip" role="status" aria-live="polite">
      {activities.map((activity) => {
        const hasProgress = activity.progressPct != null && Number.isFinite(activity.progressPct);
        const pct = hasProgress ? clampPct(activity.progressPct as number) : null;
        // Reiche Aktion (mit aufgeschlüsselten Kennzahlen) → volle Zeile mit großem Balken.
        if (activity.stats && activity.stats.length > 0) {
          const history = getHistory(activity.id);
          return (
            <article
              key={activity.id}
              className={`foundation-activity-row is-${activity.tone}`}
              data-testid={`foundation-activity-chip-${activity.id}`}
              tabIndex={history.length > 0 ? 0 : undefined}
            >
              <div className="foundation-activity-row-head">
                <span className="foundation-activity-chip-indicator" aria-hidden="true" />
                <strong className="foundation-activity-row-title">{activity.label}</strong>
                {activity.currentLabel ? (
                  <span className="foundation-activity-row-current">{activity.currentLabel}</span>
                ) : null}
                <span className="foundation-activity-row-stats">
                  {activity.stats.map((stat) => (
                    <span
                      key={`${activity.id}-${stat.label}`}
                      className={`foundation-activity-stat${stat.tone === "warning" ? " is-warning" : stat.tone === "muted" ? " is-muted" : ""}`}
                    >
                      <b>{stat.value}</b>
                      <em>{stat.label}</em>
                    </span>
                  ))}
                </span>
                {history.length > 0 ? (
                  <span className="foundation-activity-row-histhint" aria-hidden="true">
                    ⏱ Verlauf
                  </span>
                ) : null}
                {activity.nextLabel ? (
                  <span className="foundation-activity-row-next">{activity.nextLabel}</span>
                ) : null}
              </div>
              {pct != null ? (
                <div className="foundation-activity-row-bar" aria-label={`${pct}%`}>
                  <span style={{ width: `${pct}%` }} />
                  <small>{pct}%</small>
                </div>
              ) : (
                <div className="foundation-activity-row-bar is-indeterminate" aria-hidden="true">
                  <span />
                </div>
              )}
              {activity.reasons && activity.reasons.length > 0 ? (
                <div className="foundation-activity-reasons">
                  <span className="foundation-activity-reasons-title">Grund</span>
                  <ul>
                    {activity.reasons.map((reason, index) => (
                      <li key={`${activity.id}-reason-${index}`}>{reason.replace(/:/g, " · ")}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {history.length > 0 ? (
                <div className="foundation-activity-history" role="tooltip">
                  <span className="foundation-activity-history-title">Zuletzt erledigt</span>
                  <ul>
                    {history.map((entry, index) => (
                      <li key={`${activity.id}-hist-${index}`}>
                        <span className="foundation-activity-history-label">{entry.label}</span>
                        <em className="foundation-activity-history-dur">{formatStepDuration(entry.durationMs)}</em>
                      </li>
                    ))}
                  </ul>
                  <span className="foundation-activity-history-note">Dauer ≈ live gemessen</span>
                </div>
              ) : null}
            </article>
          );
        }

        return (
          <article
            key={activity.id}
            className={`foundation-activity-chip is-${activity.tone}`}
            data-testid={`foundation-activity-chip-${activity.id}`}
            title={activity.detail ?? activity.label}
          >
            <span className="foundation-activity-chip-indicator" aria-hidden="true" />
            <span className="foundation-activity-chip-copy">
              <strong>{activity.label}</strong>
              {activity.detail ? <span>{activity.detail}</span> : null}
            </span>
            {pct != null ? (
              <span className="foundation-activity-chip-progress" aria-label={`${pct}%`}>
                <span style={{ width: `${pct}%` }} />
                <small>{pct}%</small>
              </span>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

"use client";

import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";

type FoundationActivityStripProps = {
  activities: FoundationActivityItem[];
};

function clampPct(pct: number) {
  return Math.max(0, Math.min(100, pct));
}

export default function FoundationActivityStrip({ activities }: FoundationActivityStripProps) {
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
          return (
            <article
              key={activity.id}
              className={`foundation-activity-row is-${activity.tone}`}
              data-testid={`foundation-activity-chip-${activity.id}`}
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

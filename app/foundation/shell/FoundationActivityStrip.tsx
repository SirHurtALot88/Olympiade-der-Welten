"use client";

import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";

type FoundationActivityStripProps = {
  activities: FoundationActivityItem[];
};

export default function FoundationActivityStrip({ activities }: FoundationActivityStripProps) {
  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="foundation-activity-strip" data-testid="foundation-activity-strip" role="status" aria-live="polite">
      {activities.map((activity) => (
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
          {activity.progressPct != null && Number.isFinite(activity.progressPct) ? (
            <span className="foundation-activity-chip-progress" aria-label={`${activity.progressPct}%`}>
              <span style={{ width: `${Math.max(0, Math.min(100, activity.progressPct))}%` }} />
              <small>{activity.progressPct}%</small>
            </span>
          ) : null}
        </article>
      ))}
    </div>
  );
}

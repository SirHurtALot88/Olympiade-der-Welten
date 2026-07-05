"use client";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
import type { LeagueLeaderCategory } from "@/lib/foundation/league-leaders-service";
import { joinClassNames } from "@/lib/foundation/tabs/foundation-page-module-helpers";

export interface LeagueLeadersClientProps {
  categories: LeagueLeaderCategory[];
  selectedTeamId: string | null;
  seasonLabel: string;
  returnContext?: { playerId: string; playerName: string } | null;
  onReturnToPlayer?: () => void;
  onOpenPlayer: (playerId: string) => void;
}

export default function LeagueLeadersClient({
  categories,
  selectedTeamId,
  seasonLabel,
  returnContext,
  onReturnToPlayer,
  onOpenPlayer,
}: LeagueLeadersClientProps) {
  return (
    <section
      className="panel league-leaders-panel"
      id="league-leaders"
      data-testid="foundation-league-leaders"
      aria-label="Liga-Leaders"
    >
      <div className="panel-header league-leaders-panel-header">
        <div className="stack">
          <TooltipHeading
            as="h2"
            tooltip="Top 5 ligaweit je Kategorie. Eigene Kader-Spieler sind hervorgehoben. Klick oeffnet das Spielerprofil."
          >
            Liga-Leaders
          </TooltipHeading>
          <p className="muted">{seasonLabel}</p>
          {returnContext && onReturnToPlayer ? (
            <button type="button" className="table-link-button league-leaders-back-link" onClick={onReturnToPlayer}>
              ← Zurück zu {returnContext.playerName}
            </button>
          ) : null}
        </div>
      </div>

      <div className="league-leaders-grid">
        {categories.map((category) => (
          <article
            key={category.id}
            id={`league-leaders-${category.id}`}
            className={`league-leaders-card is-${category.tone}`}
            data-testid={`league-leaders-card-${category.id}`}
          >
            <header className="league-leaders-card-head">
              <span>{category.label}</span>
            </header>
            <div className="league-leaders-list">
              {category.entries.length > 0 ? (
                category.entries.map((entry) => (
                  <button
                    key={`${category.id}-${entry.playerId}`}
                    type="button"
                    className={joinClassNames(
                      "league-leaders-row",
                      entry.teamId != null && entry.teamId === selectedTeamId && "is-own-team",
                    )}
                    onClick={() => onOpenPlayer(entry.playerId)}
                    title={`${entry.name} · ${entry.teamName} · Profil öffnen`}
                  >
                    <span className="league-leaders-row-rank">{entry.rank}</span>
                    <span className="league-leaders-row-player">
                      <strong>{entry.name}</strong>
                      <small>{entry.teamCode ?? entry.teamName}</small>
                    </span>
                    <span className="league-leaders-row-value">{entry.displayValue}</span>
                  </button>
                ))
              ) : (
                <p className="muted league-leaders-empty">Keine Werte</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

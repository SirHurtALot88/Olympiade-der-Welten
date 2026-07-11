"use client";

import { NlCard, NlMedalBadge, formatNlNumber, nlToneClass, type NlTone } from "@/components/foundation/new-look";
import type { LeagueLeadersClientProps } from "@/app/foundation/league-leaders-v2/LeagueLeadersClient";
import type { LeagueLeaderEntry, LeagueLeaderTone } from "@/lib/foundation/league-leaders-service";

/**
 * "Neuer Look" Liga-Leaders — Kategorie-Karten mit Leader-Podium (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `LeagueLeadersClient` fällt ohne Flag unverändert auf die bestehenden
 * Listen zurück. Konsumiert exakt dieselben Props/Daten (Kategorien,
 * `displayValue`, `onOpenPlayer`, Own-Team-Markierung).
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
 * - keine Spieler-Portraits (`LeagueLeaderEntry` trägt keine Portrait-URL,
 *   nur Name/Team) — stattdessen Initialen-Avatare,
 * - keine Rang-Bewegung/Trends (nicht in den Props vorhanden).
 */

const NL_LEADER_TONE_MAP: Record<LeagueLeaderTone, NlTone> = {
  total: "accent",
  pow: "pow",
  spe: "spe",
  men: "men",
  soc: "soc",
  mvs: "warn",
  ovr: "accent",
  training: "good",
};

function getLeaderInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function getLeaderBarPercent(entry: LeagueLeaderEntry, topValue: number): number {
  if (!Number.isFinite(entry.value) || entry.value <= 0 || topValue <= 0) {
    return 0;
  }
  return Math.max(4, Math.min(100, (entry.value / topValue) * 100));
}

export default function LeagueLeadersNewLook({
  categories,
  selectedTeamId,
  seasonLabel,
  returnContext,
  onReturnToPlayer,
  onOpenPlayer,
}: LeagueLeadersClientProps) {
  return (
    <section
      className="nl-leaders"
      id="league-leaders"
      data-testid="foundation-league-leaders"
      data-new-look="true"
      aria-label="Liga-Leaders"
    >
      <NlCard
        className="nl-leaders-header-card"
        eyebrow={seasonLabel}
        title="Liga-Leaders"
        actions={
          returnContext && onReturnToPlayer ? (
            <button type="button" className="nl-leaders-back" onClick={onReturnToPlayer}>
              ← Zurück zu {returnContext.playerName}
            </button>
          ) : null
        }
      >
        <p className="nl-leaders-hint">
          Top 5 ligaweit je Kategorie. Eigene Kader-Spieler sind hervorgehoben. Klick öffnet das Spielerprofil.
        </p>
      </NlCard>

      <div className="nl-leaders-grid">
        {categories.map((category) => {
          const tone = NL_LEADER_TONE_MAP[category.tone] ?? "accent";
          const leader = category.entries.length > 0 ? category.entries[0] : null;
          const topValue = leader != null && Number.isFinite(leader.value) ? leader.value : 0;
          const chasers = category.entries.slice(1);

          return (
            <article
              key={category.id}
              id={`league-leaders-${category.id}`}
              className={`nl-leaders-card ${nlToneClass(tone)}`}
              data-testid={`league-leaders-card-${category.id}`}
            >
              <header className="nl-leaders-card-head">
                <span className="nl-leaders-card-label">{category.label}</span>
              </header>

              {leader ? (
                <button
                  type="button"
                  className={`nl-leaders-hero${leader.teamId != null && leader.teamId === selectedTeamId ? " is-own-team" : ""}`}
                  onClick={() => onOpenPlayer(leader.playerId)}
                  title={`${leader.name} · ${leader.teamName} · Profil öffnen`}
                >
                  <span className="nl-leaders-hero-avatar" aria-hidden="true">
                    {getLeaderInitials(leader.name)}
                  </span>
                  <span className="nl-leaders-hero-copy">
                    <span className="nl-leaders-hero-rankline">
                      <NlMedalBadge kind="gold" title={`Rang 1 · ${category.label}`} />
                      <span className="nl-leaders-hero-name">{leader.name}</span>
                    </span>
                    <span className="nl-leaders-hero-team">{leader.teamCode ?? leader.teamName}</span>
                  </span>
                  <span className="nl-leaders-hero-value nl-tnum">{leader.displayValue}</span>
                </button>
              ) : (
                <p className="nl-leaders-empty">Keine Werte</p>
              )}

              {chasers.length > 0 ? (
                <div className="nl-leaders-list">
                  {chasers.map((entry) => (
                    <button
                      key={`${category.id}-${entry.playerId}`}
                      type="button"
                      className={`nl-leaders-row${entry.teamId != null && entry.teamId === selectedTeamId ? " is-own-team" : ""}`}
                      onClick={() => onOpenPlayer(entry.playerId)}
                      title={`${entry.name} · ${entry.teamName} · Profil öffnen`}
                    >
                      <span
                        className="nl-leaders-rowbar"
                        aria-hidden="true"
                        style={{ width: `${getLeaderBarPercent(entry, topValue)}%` }}
                      />
                      <span className="nl-leaders-row-rank nl-tnum">{entry.rank}</span>
                      <span className="nl-leaders-row-avatar" aria-hidden="true">
                        {getLeaderInitials(entry.name)}
                      </span>
                      <span className="nl-leaders-row-player">
                        <strong>{entry.name}</strong>
                        <small>{entry.teamCode ?? entry.teamName}</small>
                      </span>
                      <span
                        className="nl-leaders-row-value nl-tnum"
                        title={`${formatNlNumber(entry.value, 1)} von ${formatNlNumber(topValue, 1)} (Leader)`}
                      >
                        {entry.displayValue}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

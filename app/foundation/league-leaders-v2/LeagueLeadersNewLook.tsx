"use client";

import {
  NlCard,
  NlMedalBadge,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  type NlTone,
} from "@/components/foundation/new-look";
import type { LeagueLeadersClientProps } from "@/app/foundation/league-leaders-v2/LeagueLeadersClient";
import type { LeagueLeaderCategory, LeagueLeaderEntry, LeagueLeaderTone } from "@/lib/foundation/league-leaders-service";

/**
 * "Neuer Look" Liga-Leaders — Kategorie-Karten mit Leader-Podium (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `LeagueLeadersClient` fällt ohne Flag unverändert auf die bestehenden
 * Listen zurück. Konsumiert exakt dieselben Props/Daten (Kategorien,
 * `displayValue`, `onOpenPlayer`, Own-Team-Markierung).
 *
 * Die Einordnungs-Zeile pro Kategorie (Leader / Median / "Dein Bester")
 * ist komplett aus `category.entries` berechnet — inkl. des absoluten
 * `entry.rank` des besten eigenen Spielers, wenn er gelistet ist.
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
 * - keine Spieler-Portraits (`LeagueLeaderEntry` trägt keine Portrait-URL,
 *   nur Name/Team) — stattdessen Initialen-Avatare,
 * - keine Rang-Bewegung/Trends (nicht in den Props vorhanden),
 * - kein erfundener Rang außerhalb der gelisteten Einträge: ist kein eigener
 *   Spieler in `entries`, zeigt "Dein Bester" ehrlich "außerhalb Top N".
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

/** Median der gelisteten Top-Werte einer Kategorie (nur echte `entry.value`s). */
function getCategoryMedian(category: LeagueLeaderCategory): number | null {
  const values = category.entries
    .map((entry) => entry.value)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (values.length === 0) {
    return null;
  }
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

/** MVS/OVR werden ligaweit ganzzahlig ausgewiesen — Median entsprechend formatieren. */
function getCategoryStatDecimals(categoryId: string): number {
  return categoryId === "mvs" || categoryId === "ovr" ? 0 : 1;
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
          const median = getCategoryMedian(category);
          const statDecimals = getCategoryStatDecimals(category.id);
          // Bester eigener Spieler: erster Eintrag (nach Rang sortiert) des eigenen Teams.
          const ownBest =
            selectedTeamId != null
              ? category.entries.find((entry) => entry.teamId != null && entry.teamId === selectedTeamId) ?? null
              : null;

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

              {leader ? (
                <StatChipRow className="nl-leaders-stats" aria-label={`Einordnung ${category.label}`}>
                  <StatChip
                    label="Leader"
                    value={leader.displayValue}
                    tone={tone}
                    title={`#1 ${leader.name} (${leader.teamCode ?? leader.teamName})`}
                  />
                  {median != null ? (
                    <StatChip
                      label={`Median Top ${formatNlNumber(category.entries.length, 0)}`}
                      value={formatNlNumber(median, statDecimals)}
                      title={`Median der gelisteten Top-${formatNlNumber(category.entries.length, 0)}-Werte (${category.label})`}
                    />
                  ) : null}
                  {selectedTeamId != null ? (
                    ownBest ? (
                      <StatChip
                        label="Dein Bester"
                        value={ownBest.displayValue}
                        sub={`#${formatNlNumber(ownBest.rank, 0)} · ${ownBest.name}`}
                        tone="accent"
                        onClick={() => onOpenPlayer(ownBest.playerId)}
                        title={`${ownBest.name} · Rang ${formatNlNumber(ownBest.rank, 0)} in ${category.label} · Profil öffnen`}
                      />
                    ) : (
                      <StatChip
                        label="Dein Bester"
                        value="—"
                        sub={`außerhalb Top ${formatNlNumber(category.entries.length, 0)}`}
                        title={`Kein eigener Spieler unter den gelisteten Top ${formatNlNumber(category.entries.length, 0)} (${category.label})`}
                      />
                    )
                  ) : null}
                </StatChipRow>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

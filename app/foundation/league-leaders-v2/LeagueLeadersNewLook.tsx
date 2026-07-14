"use client";

import { useMemo, useState } from "react";

import {
  NlBarChart,
  NlCard,
  NlMedalBadge,
  NlRankingDrawer,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  type NlRankingDrawerRow,
  type NlTone,
} from "@/components/foundation/new-look";
import type { LeagueLeadersClientProps } from "@/app/foundation/league-leaders-v2/LeagueLeadersClient";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { LeagueLeaderCategory, LeagueLeaderEntry, LeagueLeaderTone } from "@/lib/foundation/league-leaders-service";
import { useFoundationStateOptional } from "@/lib/foundation/foundation-state-context";
import {
  buildLeagueRecordsHallOfFame,
  type LeagueRecordsHallOfFame,
} from "@/lib/foundation/league-records-hall-of-fame";
import {
  buildLeagueSeasonBests,
  buildOwnTeamLeaderboardFootprint,
  type LeagueSeasonBests,
  type OwnTeamLeaderboardFootprint,
} from "@/lib/foundation/league-season-bests";
import {
  buildLeagueAchievements,
  getLeagueAchievementGroupLabel,
  type LeagueAchievement,
  type LeagueAchievements,
} from "@/lib/foundation/league-achievements";

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
 * Spieler-Portraits werden über `entry.playerId` aufgelöst — derselbe
 * Mechanismus (`getPlayerPortraitBrowserUrl` + `BudgetedMediaImage`) wie in
 * der Spieler-Tabelle/dem Leader-Podium (siehe `FoundationPlayersTableNewLook`
 * / `FoundationPlayersLeaderPodium`). Ohne auflösbares Portrait (oder bei
 * Ladefehler) fällt jeder Avatar ehrlich auf die Initialen zurück.
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
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

/**
 * Avatar für eine Leader-/Rekord-Zeile: löst das Portrait über `playerId`
 * per `getPlayerPortraitBrowserUrl` auf — derselbe Mechanismus wie in
 * `FoundationPlayersTableNewLook`/`FoundationPlayersLeaderPodium`
 * (`BudgetedMediaImage`, "thumb"-Variante für die kleinen Kreis-Avatare).
 * Ohne auflösbares Portrait oder bei Ladefehler greift ehrlich der
 * Initialen-Fallback (`BudgetedMediaImage`/`OptimizedMediaImage`s eigener
 * `fallback`-Mechanismus).
 */
function LeaderAvatar({ playerId, name, className }: { playerId: string; name: string; className: string }) {
  const portraitSrc = getPlayerPortraitBrowserUrl(playerId, null, null, { variant: "thumb" });
  const initials = getLeaderInitials(name);
  return (
    <span className={className} aria-hidden="true">
      {portraitSrc ? (
        <BudgetedMediaImage
          className="nl-leaders-avatar-img"
          src={portraitSrc}
          alt={name}
          width={44}
          height={44}
          loading="lazy"
          fetchPriority="low"
          fallback={initials}
        />
      ) : (
        initials
      )}
    </span>
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

type NlLeagueLeadersSubTab = "leaders" | "records" | "achievements";

const NL_LEADERS_SUBTABS: Array<{ id: NlLeagueLeadersSubTab; label: string }> = [
  { id: "leaders", label: "Liga-Leaders" },
  { id: "records", label: "Rekorde & Hall of Fame" },
  { id: "achievements", label: "Erfolge" },
];

export default function LeagueLeadersNewLook({
  categories,
  selectedTeamId,
  seasonLabel,
  gameState,
  returnContext,
  onReturnToPlayer,
  onOpenPlayer,
}: LeagueLeadersClientProps) {
  const [subTab, setSubTab] = useState<NlLeagueLeadersSubTab>("leaders");

  // "Neuer Look" (#37, flag-gated, additiv): KPI-Ranking-Drawer statt voller
  // Navigation beim Klick auf die Leader/Median/"Dein Bester"-Chips einer
  // Kategorie — Zeilen kommen 1:1 aus `category.entries` (Top N ligaweit),
  // es wird keine neue Rangliste berechnet.
  const [rankingDrawerCategoryId, setRankingDrawerCategoryId] = useState<string | null>(null);
  const [rankingDrawerHighlightId, setRankingDrawerHighlightId] = useState<string | null>(null);

  function openCategoryRankingDrawer(categoryId: string, highlightPlayerId?: string | null) {
    setRankingDrawerCategoryId(categoryId);
    setRankingDrawerHighlightId(highlightPlayerId ?? null);
  }

  function closeCategoryRankingDrawer() {
    setRankingDrawerCategoryId(null);
    setRankingDrawerHighlightId(null);
  }

  const rankingDrawerCategory = useMemo(
    () => categories.find((category) => category.id === rankingDrawerCategoryId) ?? null,
    [categories, rankingDrawerCategoryId],
  );

  const rankingDrawerRows = useMemo<NlRankingDrawerRow[]>(() => {
    if (!rankingDrawerCategory) {
      return [];
    }
    const tone = NL_LEADER_TONE_MAP[rankingDrawerCategory.tone] ?? "accent";
    return rankingDrawerCategory.entries.map((entry) => ({
      id: entry.playerId,
      rank: entry.rank,
      name: entry.name,
      sub: entry.teamCode ?? entry.teamName,
      value: entry.value,
      displayValue: entry.displayValue,
      tone,
      isOwn: entry.teamId != null && entry.teamId === selectedTeamId,
    }));
  }, [rankingDrawerCategory, selectedTeamId]);

  // Optionaler Foundation-State: Rekorde/Hall-of-Fame brauchen den vollen
  // GameState (Season-Snapshots über alle archivierten Saisons). Fehlt der
  // Kontext (z. B. Isolation/Storybook), fällt die Sektion ehrlich auf den
  // "noch keine Rekorde"-Leerzustand zurück statt Fake-Daten zu zeigen.
  // GameState kommt bevorzugt als Prop aus dem Shell-Scope (verlässlich im
  // echten App-Pfad); der optionale Context dient nur als Fallback (Isolation).
  const foundationState = useFoundationStateOptional();
  const foundationGameState = gameState ?? foundationState?.gameState ?? null;
  const records = useMemo<LeagueRecordsHallOfFame | null>(
    () => (foundationGameState ? buildLeagueRecordsHallOfFame(foundationGameState) : null),
    [foundationGameState],
  );

  // D7 — In-Season-Bestwerte ("Saison-Bestwerte (laufend)"): seedet den Rekord-
  // Tab, damit er ab S1/MD1 lebt statt bis zur ersten archivierten Saison leer
  // zu bleiben. Rein aus öffentlichen Kategorie-Leadern + laufendem Kaderwert.
  const seasonBests = useMemo<LeagueSeasonBests>(
    () => buildLeagueSeasonBests({ categories, gameState: foundationGameState, selectedTeamId, seasonLabel }),
    [categories, foundationGameState, selectedTeamId, seasonLabel],
  );

  // D11 — Own-Team-Leaderboard-Footprint: Top-5-Slots + beste Platzierung des
  // Manager-Teams, rein aus den öffentlichen Ranglisten-Einträgen (fog-safe).
  const footprint = useMemo<OwnTeamLeaderboardFootprint>(
    () => buildOwnTeamLeaderboardFootprint({ categories, selectedTeamId }),
    [categories, selectedTeamId],
  );

  // D6 — Erfolge / Meilensteine: read-time aus gameState + Kategorien abgeleitet.
  const achievements = useMemo<LeagueAchievements>(
    () => buildLeagueAchievements({ gameState: foundationGameState, categories, selectedTeamId }),
    [foundationGameState, categories, selectedTeamId],
  );

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
        {footprint.hasTeam ? <OwnTeamFootprintSummary footprint={footprint} onOpenPlayer={onOpenPlayer} /> : null}
        <NlSubTabs
          items={NL_LEADERS_SUBTABS}
          activeId={subTab}
          onSelect={(id) => setSubTab(id as NlLeagueLeadersSubTab)}
          aria-label="Liga-Leaders Ansicht"
          className="nl-leaders-subtabs"
        />
      </NlCard>

      {subTab === "records" ? (
        <LeagueRecordsPanel records={records} seasonBests={seasonBests} onOpenPlayer={onOpenPlayer} />
      ) : subTab === "achievements" ? (
        <LeagueAchievementsPanel achievements={achievements} onOpenPlayer={onOpenPlayer} />
      ) : (
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
                  <LeaderAvatar playerId={leader.playerId} name={leader.name} className="nl-leaders-hero-avatar" />
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
                      <LeaderAvatar playerId={entry.playerId} name={entry.name} className="nl-leaders-row-avatar" />
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
                    onClick={() => openCategoryRankingDrawer(category.id, leader.playerId)}
                    title={`Rangliste ${category.label} — #1 ${leader.name} (${leader.teamCode ?? leader.teamName})`}
                  />
                  {median != null ? (
                    <StatChip
                      label={`Median Top ${formatNlNumber(category.entries.length, 0)}`}
                      value={formatNlNumber(median, statDecimals)}
                      onClick={() => openCategoryRankingDrawer(category.id)}
                      title={`Rangliste ${category.label} — Median der gelisteten Top-${formatNlNumber(category.entries.length, 0)}-Werte`}
                    />
                  ) : null}
                  {selectedTeamId != null ? (
                    ownBest ? (
                      <StatChip
                        label="Dein Bester"
                        value={ownBest.displayValue}
                        sub={`#${formatNlNumber(ownBest.rank, 0)} · ${ownBest.name}`}
                        tone="accent"
                        onClick={() => openCategoryRankingDrawer(category.id, ownBest.playerId)}
                        title={`Rangliste ${category.label} — ${ownBest.name} auf Rang ${formatNlNumber(ownBest.rank, 0)}`}
                      />
                    ) : (
                      <StatChip
                        label="Dein Bester"
                        value="—"
                        sub={`außerhalb Top ${formatNlNumber(category.entries.length, 0)}`}
                        onClick={() => openCategoryRankingDrawer(category.id)}
                        title={`Rangliste ${category.label} — kein eigener Spieler unter den gelisteten Top ${formatNlNumber(category.entries.length, 0)}`}
                      />
                    )
                  ) : null}
                </StatChipRow>
              ) : null}
            </article>
          );
        })}
      </div>
      )}

      <NlRankingDrawer
        open={rankingDrawerCategory != null}
        onClose={closeCategoryRankingDrawer}
        metricLabel={rankingDrawerCategory?.label ?? ""}
        metricKey={rankingDrawerCategory?.id}
        subtitle={seasonLabel}
        rows={rankingDrawerRows}
        highlightId={rankingDrawerHighlightId}
        onSelectRow={(row) => onOpenPlayer(row.id)}
      />
    </section>
  );
}

/**
 * "Rekorde & Hall of Fame" — Sub-Tab-Panel: ligaweite Superlative über alle
 * archivierten Saisons. Rein additiv, degradiert bei 0–1 Saisons Historie
 * ehrlich auf einen Leerzustand statt Platzhalterwerte zu zeigen.
 */
function LeagueRecordsPanel({
  records,
  seasonBests,
  onOpenPlayer,
}: {
  records: LeagueRecordsHallOfFame | null;
  seasonBests: LeagueSeasonBests;
  onOpenPlayer: (playerId: string) => void;
}) {
  const seasonBestsSection = <SeasonBestsSection seasonBests={seasonBests} onOpenPlayer={onOpenPlayer} />;

  // D7: Season-Bestwerte werden immer gezeigt (ab S1/MD1 lebendig). Der
  // All-Time-Teil erscheint erst, wenn mindestens eine Saison archiviert ist —
  // sonst bleibt ein ehrlicher Hinweis statt Platzhalterwerten.
  if (!records || !records.hasHistory) {
    return (
      <div className="nl-records" data-testid="nl-league-records">
        {seasonBestsSection}
        <NlCard className="nl-records-empty-card" title="All-Time-Rekorde & Hall of Fame">
          <p className="nl-records-empty-text">
            Noch keine All-Time-Rekorde — sobald die erste Saison archiviert ist, erscheinen hier ligaweite Bestmarken über alle Saisons.
          </p>
        </NlCard>
      </div>
    );
  }

  const topChampions = records.champions.slice(0, 5);
  const championBars = records.champions
    .filter((row) => row.gold > 0)
    .slice(0, 6)
    .map((row) => ({ label: row.teamCode, value: row.gold, tone: "warn" as NlTone }));
  const ppsBars = records.careerLeaderboard.slice(0, 6).map((row) => ({
    label: getLeaderInitials(row.playerName),
    value: row.totalPps,
    tone: "good" as NlTone,
  }));

  return (
    <div className="nl-records" data-testid="nl-league-records">
      {seasonBestsSection}
      <NlCard
        className="nl-records-champions-card"
        eyebrow={`${formatNlNumber(records.seasonCount, 0)} Saison${records.seasonCount === 1 ? "" : "en"} archiviert`}
        title="All-Time-Medaillenspiegel"
      >
        {topChampions.length > 0 ? (
          <>
            <ol className="nl-records-champions">
              {topChampions.map((row, index) => (
                <li key={row.teamId} className="nl-records-champion-row">
                  <span className="nl-records-champion-rank nl-tnum">{index + 1}</span>
                  <span className="nl-records-champion-name">
                    <strong>{row.teamName}</strong>
                    <small>
                      {row.teamCode} · {formatNlNumber(row.seasonsPlayed, 0)} Saison{row.seasonsPlayed === 1 ? "" : "en"}
                    </small>
                  </span>
                  <span className="nl-records-champion-medals">
                    {row.gold > 0 ? <NlMedalBadge kind="gold" count={row.gold} /> : null}
                    {row.silver > 0 ? <NlMedalBadge kind="silver" count={row.silver} /> : null}
                    {row.bronze > 0 ? <NlMedalBadge kind="bronze" count={row.bronze} /> : null}
                  </span>
                </li>
              ))}
            </ol>
            {championBars.length > 0 ? (
              <NlBarChart
                bars={championBars}
                format={(value) => formatNlNumber(value, 0)}
                aria-label="Titel je Team"
                className="nl-records-champions-chart"
              />
            ) : null}
          </>
        ) : (
          <p className="nl-records-empty-text">Noch keine abgeschlossene Saison mit Endstand.</p>
        )}
      </NlCard>

      <div className="nl-records-grid">
        <RecordCard
          label="Höchster Kaderwert"
          holder={records.peakSquadMarketValue ? records.peakSquadMarketValue.teamName : null}
          sub={
            records.peakSquadMarketValue
              ? `${records.peakSquadMarketValue.teamCode} · ${records.peakSquadMarketValue.seasonLabel}`
              : null
          }
          value={records.peakSquadMarketValue ? formatNlNumber(records.peakSquadMarketValue.value, 0) : null}
          tone="accent"
        />
        <RecordCard
          label="Rekord-Transferablöse"
          holder={records.recordTransferFee ? records.recordTransferFee.playerName : null}
          sub={
            records.recordTransferFee
              ? `${records.recordTransferFee.fromTeamName ?? "—"} → ${records.recordTransferFee.toTeamName ?? "—"} · ${records.recordTransferFee.seasonLabel}`
              : null
          }
          value={records.recordTransferFee ? formatNlNumber(records.recordTransferFee.amount, 0) : null}
          tone="warn"
          onClick={records.recordTransferFee ? () => onOpenPlayer(records.recordTransferFee!.playerId) : undefined}
        />
        <RecordCard
          label="Höchstes Board-Vertrauen"
          holder={records.highestBoardConfidence ? records.highestBoardConfidence.teamName : null}
          sub={
            records.highestBoardConfidence
              ? `${records.highestBoardConfidence.gmName} · ${records.highestBoardConfidence.seasonLabel}`
              : null
          }
          value={records.highestBoardConfidence ? formatNlNumber(records.highestBoardConfidence.value, 0) : null}
          tone="good"
        />
        <RecordCard
          label="Größter Marktwert-Sprung"
          holder={records.biggestMwJump ? records.biggestMwJump.playerName : null}
          sub={
            records.biggestMwJump
              ? `${formatNlNumber(records.biggestMwJump.fromValue, 0)} → ${formatNlNumber(records.biggestMwJump.toValue, 0)} · ${records.biggestMwJump.seasonLabel}`
              : null
          }
          value={records.biggestMwJump ? `+${formatNlNumber(records.biggestMwJump.delta, 0)}` : null}
          tone="spe"
          onClick={records.biggestMwJump ? () => onOpenPlayer(records.biggestMwJump!.playerId) : undefined}
        />
      </div>

      <NlCard className="nl-records-career-card" title="Karriere-Bestenliste" eyebrow="Über alle archivierten Saisons">
        <StatChipRow className="nl-records-career-stats" aria-label="Karriere-Rekordhalter">
          {records.careerAppearancesLeader ? (
            <StatChip
              label="Meiste Auftritte"
              value={formatNlNumber(records.careerAppearancesLeader.appearances, 0)}
              sub={records.careerAppearancesLeader.playerName}
              tone="accent"
              onClick={() => onOpenPlayer(records.careerAppearancesLeader!.playerId)}
              title={`${records.careerAppearancesLeader.playerName} öffnen`}
            />
          ) : null}
          {records.careerPpsLeader ? (
            <StatChip
              label="Karriere-PPs-Rekord"
              value={formatNlNumber(records.careerPpsLeader.totalPps, 1)}
              sub={records.careerPpsLeader.playerName}
              tone="good"
              onClick={() => onOpenPlayer(records.careerPpsLeader!.playerId)}
              title={`${records.careerPpsLeader.playerName} öffnen`}
            />
          ) : null}
          {records.careerMvpLeader ? (
            <StatChip
              label="Meiste MVP-Awards"
              value={formatNlNumber(records.careerMvpLeader.mvpTotal, 0)}
              sub={records.careerMvpLeader.playerName}
              tone="warn"
              onClick={() => onOpenPlayer(records.careerMvpLeader!.playerId)}
              title={`${records.careerMvpLeader.playerName} öffnen`}
            />
          ) : null}
        </StatChipRow>

        {records.careerLeaderboard.length > 0 ? (
          <>
            <NlBarChart
              bars={ppsBars}
              format={(value) => formatNlNumber(value, 0)}
              aria-label="Top Karriere-PPs"
              className="nl-records-career-chart"
            />
            <div className="nl-leaders-list nl-records-career-list">
              {records.careerLeaderboard.map((row, index) => (
                <button
                  key={row.playerId}
                  type="button"
                  className="nl-leaders-row"
                  onClick={() => onOpenPlayer(row.playerId)}
                  title={`${row.playerName} · Profil öffnen`}
                >
                  <span className="nl-leaders-row-rank nl-tnum">{index + 1}</span>
                  <LeaderAvatar playerId={row.playerId} name={row.playerName} className="nl-leaders-row-avatar" />
                  <span className="nl-leaders-row-player">
                    <strong>{row.playerName}</strong>
                    <small>
                      {row.teamName ?? "—"} · {formatNlNumber(row.appearances, 0)} Einsätze
                    </small>
                  </span>
                  <span className="nl-leaders-row-value nl-tnum">{formatNlNumber(row.totalPps, 1)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="nl-records-empty-text">Noch keine Karrieredaten aus abgeschlossenen Saisons.</p>
        )}
      </NlCard>
    </div>
  );
}

function RecordCard({
  label,
  holder,
  sub,
  value,
  tone,
  onClick,
  isOwn = false,
}: {
  label: string;
  holder: string | null;
  sub: string | null;
  value: string | null;
  tone: NlTone;
  onClick?: () => void;
  isOwn?: boolean;
}) {
  const hasData = holder != null && value != null;
  const bodyContent = (
    <>
      <span className="nl-records-card-value nl-tnum">{value}</span>
      <span className="nl-records-card-holder">{holder}</span>
      {sub ? <span className="nl-records-card-sub">{sub}</span> : null}
    </>
  );

  return (
    <article className={`nl-records-card ${nlToneClass(tone)}${isOwn ? " is-own-team" : ""}`}>
      <span className="nl-records-card-label">
        {label}
        {isOwn ? <span className="nl-records-own-tag">dein Team</span> : null}
      </span>
      {!hasData ? (
        <p className="nl-records-empty-text">Keine Daten</p>
      ) : onClick ? (
        <button type="button" className="nl-records-card-body is-interactive" onClick={onClick} title={`${holder} · Profil öffnen`}>
          {bodyContent}
        </button>
      ) : (
        <div className="nl-records-card-body">{bodyContent}</div>
      )}
    </article>
  );
}

/**
 * D11 — Own-Team-Leaderboard-Footprint: kompakte Zusammenfassung im Header,
 * wie viele Top-5-Slots das Manager-Team hält und was die beste Platzierung ist.
 * Rein aus den öffentlichen Ranglisten-Einträgen (fog-safe).
 */
function OwnTeamFootprintSummary({
  footprint,
  onOpenPlayer,
}: {
  footprint: OwnTeamLeaderboardFootprint;
  onOpenPlayer: (playerId: string) => void;
}) {
  const hasTop5 = footprint.top5SlotCount > 0;
  return (
    <StatChipRow className="nl-leaders-footprint" aria-label="Dein Team in den Ranglisten">
      <StatChip
        label="Dein Team"
        value={hasTop5 ? `${formatNlNumber(footprint.top5SlotCount, 0)}× Top-5` : "—"}
        sub={
          hasTop5
            ? `in ${formatNlNumber(footprint.categoriesWithTop5, 0)} von ${formatNlNumber(footprint.trackedCategories, 0)} Kategorien`
            : "noch kein Top-5-Eintrag"
        }
        tone={hasTop5 ? "good" : "neutral"}
      />
      {footprint.bestPlacement ? (
        <StatChip
          label="Beste Platzierung"
          value={`#${formatNlNumber(footprint.bestPlacement.rank, 0)}`}
          sub={`${footprint.bestPlacement.categoryLabel} · ${footprint.bestPlacement.playerName}`}
          tone="accent"
          onClick={() => onOpenPlayer(footprint.bestPlacement!.playerId)}
          title={`${footprint.bestPlacement.playerName} öffnen`}
        />
      ) : null}
      {footprint.leaderCount > 0 ? (
        <StatChip
          label="Liga-Anführer"
          value={`${formatNlNumber(footprint.leaderCount, 0)}× Rang 1`}
          tone="warn"
        />
      ) : null}
    </StatChipRow>
  );
}

/**
 * D7 — "Saison-Bestwerte (laufend)": ab S1/MD1 lebendige Bestmarken aus
 * öffentlichen/laufenden Daten (Kategorie-Leader + höchster Kaderwert). Klar von
 * den archivierten All-Time-Rekorden abgegrenzt.
 */
function SeasonBestsSection({
  seasonBests,
  onOpenPlayer,
}: {
  seasonBests: LeagueSeasonBests;
  onOpenPlayer: (playerId: string) => void;
}) {
  return (
    <NlCard
      className="nl-records-seasonbests-card"
      eyebrow={seasonBests.seasonLabel}
      title="Saison-Bestwerte (laufend)"
      data-testid="nl-league-season-bests"
    >
      {seasonBests.entries.length > 0 ? (
        <div className="nl-records-grid nl-records-seasonbests-grid">
          {seasonBests.entries.map((entry) => (
            <RecordCard
              key={entry.key}
              label={entry.label}
              holder={entry.holderName}
              sub={entry.holderSub}
              value={entry.displayValue}
              tone={entry.tone}
              isOwn={entry.isOwn}
              onClick={entry.playerId ? () => onOpenPlayer(entry.playerId as string) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="nl-records-empty-text">
          Noch keine laufenden Bestwerte — sobald Spielerwerte vorliegen, erscheinen hier die aktuellen Saison-Bestmarken.
        </p>
      )}
    </NlCard>
  );
}

/**
 * D6 — "Erfolge / Meilensteine": read-time aus gameState + Kategorien
 * abgeleitete Meilensteine des Manager-Teams. Erreichte zuerst (mit Haken und —
 * wo bekannt — Saison), offene gesperrt mit Ziel. Fog-safe: nur öffentliche
 * Metriken des eigenen Teams.
 */
function LeagueAchievementsPanel({
  achievements,
  onOpenPlayer,
}: {
  achievements: LeagueAchievements;
  onOpenPlayer: (playerId: string) => void;
}) {
  if (!achievements.hasTeam) {
    return (
      <NlCard className="nl-achievements-empty-card" title="Erfolge & Meilensteine">
        <p className="nl-records-empty-text">
          Wähle ein Manager-Team, um seine Erfolge und Meilensteine zu sehen.
        </p>
      </NlCard>
    );
  }
  if (!achievements.hasData) {
    return (
      <NlCard className="nl-achievements-empty-card" title="Erfolge & Meilensteine">
        <p className="nl-records-empty-text">Erfolge werden geladen …</p>
      </NlCard>
    );
  }

  const reached = achievements.achievements.filter((achievement) => achievement.state === "reached");
  const locked = achievements.achievements.filter((achievement) => achievement.state === "locked");

  return (
    <div className="nl-achievements" data-testid="nl-league-achievements">
      <NlCard
        className="nl-achievements-head-card"
        eyebrow={achievements.teamName ?? undefined}
        title="Erfolge & Meilensteine"
      >
        <p className="nl-records-empty-text nl-achievements-progress">
          {formatNlNumber(achievements.reachedCount, 0)} von {formatNlNumber(achievements.totalCount, 0)} Meilensteinen erreicht.
        </p>
        <div
          className="nl-achievements-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={achievements.totalCount}
          aria-valuenow={achievements.reachedCount}
          aria-label="Erreichte Meilensteine"
        >
          <span
            className="nl-achievements-progress-fill"
            style={{
              width: `${achievements.totalCount > 0 ? (achievements.reachedCount / achievements.totalCount) * 100 : 0}%`,
            }}
          />
        </div>
      </NlCard>

      {reached.length > 0 ? (
        <div className="nl-achievements-group">
          <h3 className="nl-achievements-group-title">Erreicht ({formatNlNumber(reached.length, 0)})</h3>
          <div className="nl-achievements-list">
            {reached.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} onOpenPlayer={onOpenPlayer} />
            ))}
          </div>
        </div>
      ) : null}

      {locked.length > 0 ? (
        <div className="nl-achievements-group">
          <h3 className="nl-achievements-group-title">Als Nächstes ({formatNlNumber(locked.length, 0)})</h3>
          <div className="nl-achievements-list">
            {locked.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} onOpenPlayer={onOpenPlayer} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AchievementRow({
  achievement,
  onOpenPlayer,
}: {
  achievement: LeagueAchievement;
  onOpenPlayer: (playerId: string) => void;
}) {
  const isReached = achievement.state === "reached";
  const interactive = isReached && achievement.playerId != null;
  const metaLine = isReached
    ? achievement.detail ?? achievement.progressLabel
    : achievement.progressLabel ?? achievement.targetLabel;

  const body = (
    <>
      <span className={`nl-achievement-icon ${nlToneClass(isReached ? achievement.tone : "neutral")}`} aria-hidden="true">
        {isReached ? "✓" : "🔒"}
      </span>
      <span className="nl-achievement-copy">
        <span className="nl-achievement-headline">
          <strong className="nl-achievement-label">{achievement.label}</strong>
          <span className="nl-achievement-group-tag">{getLeagueAchievementGroupLabel(achievement.group)}</span>
        </span>
        <span className="nl-achievement-desc">{achievement.description}</span>
        {metaLine ? <span className="nl-achievement-meta nl-tnum">{metaLine}</span> : null}
        {!isReached && achievement.targetLabel && achievement.targetLabel !== metaLine ? (
          <span className="nl-achievement-target">{achievement.targetLabel}</span>
        ) : null}
      </span>
      {isReached && achievement.contextLabel ? (
        <span className="nl-achievement-context">{achievement.contextLabel}</span>
      ) : null}
    </>
  );

  const className = `nl-achievement-row${isReached ? " is-reached" : " is-locked"}`;

  if (interactive) {
    return (
      <button
        type="button"
        className={`${className} is-interactive`}
        onClick={() => onOpenPlayer(achievement.playerId as string)}
        title="Spielerprofil öffnen"
      >
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

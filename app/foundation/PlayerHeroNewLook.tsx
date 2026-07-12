"use client";

/**
 * "Neuer Look" Spieler-Hero (flag-gated, additiv).
 *
 * Ersetzt — nur bei aktivem `useNewLook`-Flag — den Identitäts-/Ratings-Block
 * oben im Spieler-Drawer bzw. auf der Spielerprofil-Seite:
 * Portrait links, Name + Klasse/Rasse + Rolle, das Stat-Vokabular
 * (OVR / PPs / MVS / MW) als StatChips und das POW/SPE/MEN/SOC-Radar.
 * CA/PO werden bewusst NICHT hier dupliziert — die Sterne stehen bereits
 * in der Scouting-Karte darunter.
 *
 * Alle Werte kommen unverändert aus `PlayerDetailDrawerData`
 * (`buildPlayerDrawerDataFromGameState`); es werden keine Daten erfunden.
 * Styles: `app/globals.css` unter `.is-new-look .nl-player-hero*`.
 */

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlRadar,
  StatChip,
  StatChipRow,
  formatNlNumber,
  type NlRadarAxis,
} from "@/components/foundation/new-look";
import {
  getPlayerDisplaySalary,
  getRosterEntryDisplaySalary,
} from "@/app/foundation/foundation-page-client-exports";
import type { LeagueLeaderCategoryId } from "@/lib/foundation/league-leaders-service";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { formatLeaguePercentile } from "@/lib/foundation/player-league-heat";
import { useFoundationStateOptional } from "@/lib/foundation/foundation-state-context";

import ClassIcon from "./ClassIcon";
import RaceIcon from "./RaceIcon";

function buildHeroInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatHeroRank(rank: number | null | undefined) {
  return rank != null && Number.isFinite(rank) ? `#${formatNlNumber(rank, 0)}` : undefined;
}

/**
 * Sub-Zeile der Hero-StatChips: Liga-Rang, Liga-Perzentil (FM Data-Hub-Stil,
 * "Top 8%" — `formatLeaguePercentile`) und Trend-Delta (Vergleich zur
 * Vorsaison aus `ovrDelta`/`ppsDelta`/`mvsDelta`). Ohne reale Rang-/Delta-
 * Quelle fällt der jeweilige Teil einfach weg — es wird nichts erfunden.
 */
function formatHeroSub(
  rank: number | null | undefined,
  delta: number | null | undefined,
  poolSize: number | null | undefined,
) {
  const rankPart = formatHeroRank(rank);
  const percentilePart = formatLeaguePercentile(rank, poolSize) ?? undefined;
  const deltaPart =
    delta != null && Number.isFinite(delta) && delta !== 0
      ? `${delta > 0 ? "▲" : "▼"} ${formatNlNumber(Math.abs(delta), 1)}`
      : undefined;
  return [rankPart, percentilePart, deltaPart].filter(Boolean).join(" · ") || undefined;
}

function appendDeltaSource(baseTitle: string, deltaSourceLabel: string | null | undefined) {
  return deltaSourceLabel ? `${baseTitle} · ${deltaSourceLabel}` : baseTitle;
}

export type PlayerHeroNewLookProps = {
  data: PlayerDetailDrawerData;
  /** Bereits formatiertes Rollen-Label (formatRoleTag im Drawer), z. B. "Starter". */
  roleLabel: string;
  /** Echte CA/PO-Sterne (resolveCaPoDisplay im Drawer); ohne Werte kein Gauge. */
  caStars: number | null;
  poStars: number | null;
  isFreeAgent: boolean;
  onClose: () => void;
  onOpenLeagueLeaders?: (
    categoryId: LeagueLeaderCategoryId,
    returnContext?: { playerId: string; playerName: string },
  ) => void;
};

export default function PlayerHeroNewLook({
  data,
  roleLabel,
  isFreeAgent,
  onClose,
  onOpenLeagueLeaders,
}: PlayerHeroNewLookProps) {
  // Liga-Poolgröße für die Perzentil-Chips (#60 → Data-Hub): reale
  // Spielerzahl aus dem aktiven Save, kein geschätzter/erfundener Wert. Ohne
  // Foundation-Kontext (z. B. Storybook/Isolation) bleibt es bei `null` —
  // dann liefert `formatLeaguePercentile` schlicht kein Perzentil-Label.
  const foundationState = useFoundationStateOptional();
  const leaguePoolSize = foundationState?.gameState.players.length ?? null;

  // GEHALT-Chip (neben MW): reales Saison-Gehalt — Kader-Eintrag bevorzugt
  // (`getRosterEntryDisplaySalary`, gleiche Auflösung wie Kader-/Marktliste),
  // sonst Liga-Anzeigegehalt ohne Kaderbindung (`getPlayerDisplaySalary`).
  // Roster-Auflösung spiegelt `resolveRosterEntry` im Drawer-Builder:
  // `activePlayerId` (Kader-Eintrags-ID) hat Vorrang vor der reinen
  // Spieler-ID, damit z. B. Leihen/Duplikate im selben Kader-Scope bleiben.
  const rosterEntry = foundationState
    ? (data.activePlayerId
        ? (foundationState.gameState.rosters.find((entry) => entry.id === data.activePlayerId) ?? null)
        : (foundationState.gameState.rosters.find((entry) => entry.playerId === data.playerId) ?? null))
    : null;
  const heroPlayer = foundationState?.gameState.players.find((entry) => entry.id === data.playerId) ?? null;
  const heroSalary = rosterEntry
    ? getRosterEntryDisplaySalary(rosterEntry, heroPlayer)
    : getPlayerDisplaySalary(heroPlayer);

  const radarAxes: NlRadarAxis[] = (
    [
      ["pow", data.pow],
      ["spe", data.spe],
      ["men", data.men],
      ["soc", data.soc],
    ] as const
  )
    .filter((entry): entry is readonly [NlRadarAxis["key"], number] => entry[1] != null && Number.isFinite(entry[1]))
    .map(([key, value]) => ({ key, value }));

  // Vorsaison-Ghost (#12): Achswerte der letzten abgeschlossenen Saison aus den
  // realen Snapshot-History-Rows (gleiche Quelle wie die Delta-Berechnung im
  // Builder: erste nicht-aktive Zeile). NlRadar zeichnet den Ghost nur, wenn
  // alle vier Achswerte real vorliegen — bei nur einer gespielten Saison
  // erscheint schlicht kein Vergleichs-Polygon.
  const previousSeasonRow = data.historyRows.find((row) => !row.isActiveSeason) ?? null;
  const ghostAxes: NlRadarAxis[] = previousSeasonRow
    ? (
        [
          ["pow", previousSeasonRow.pow],
          ["spe", previousSeasonRow.spe],
          ["men", previousSeasonRow.men],
          ["soc", previousSeasonRow.soc],
        ] as const
      )
        .filter(
          (entry): entry is readonly [NlRadarAxis["key"], number] => entry[1] != null && Number.isFinite(entry[1]),
        )
        .map(([key, value]) => ({ key, value }))
    : [];
  const showGhost = ghostAxes.length === 4;
  const ghostLabel = showGhost && previousSeasonRow ? previousSeasonRow.seasonName : undefined;

  // Portal-Navigation: identisch zu den bestehenden KPI-Hero-Karten des
  // Drawers führen OVR/PPs/MVS über `onOpenLeagueLeaders` in die
  // Liga-Leaders-Spielerliste (nach der jeweiligen Kennzahl sortiert).
  // Ohne erreichbaren Handler (oder für MW, wofür es keinen gibt) gibt es kein
  // Portal-Ziel — dann `undefined` zurückgeben, damit der StatChip statisch
  // (kein Cursor/Hover-Lift/Pfeil/Fokus) rendert statt ein Portal ins Leere.
  const buildLeadersClick = (categoryId: LeagueLeaderCategoryId, rank: number | null) => {
    if (onOpenLeagueLeaders != null && !isFreeAgent && rank != null) {
      return () => onOpenLeagueLeaders(categoryId, { playerId: data.playerId, playerName: data.name });
    }
    return undefined;
  };

  // Radar-Achsen als Portale (#60): POW/SPE/MEN/SOC sind reale
  // Liga-Leaders-Kategorien — Klick auf ein Achsen-Label öffnet die nach
  // dieser Achse sortierte Leaders-Liste. Ohne Handler / für Free Agents
  // bleiben die Labels rein informativ.
  const handleRadarAxisClick =
    onOpenLeagueLeaders != null && !isFreeAgent
      ? (axisKey: NlRadarAxis["key"]) =>
          onOpenLeagueLeaders(axisKey, { playerId: data.playerId, playerName: data.name })
      : undefined;

  return (
    <section className="is-new-look nl-player-hero" data-testid="player-hero-new-look" data-new-look="true">
      <div className="nl-player-hero-identity">
        {data.portraitUrl ? (
          <BudgetedMediaImage
            className="nl-player-hero-portrait"
            src={data.portraitUrl}
            alt={data.name}
            width={160}
            height={160}
            loading="eager"
            fetchPriority="high"
            eager
          />
        ) : (
          <div className="nl-player-hero-portrait nl-player-hero-portrait-fallback" aria-hidden="true">
            {buildHeroInitials(data.name)}
          </div>
        )}
        <div className="nl-player-hero-copy">
          <span className="nl-player-hero-eyebrow">
            {data.transferStatus}
            {data.teamName ? ` · ${data.teamName}` : " · Kein aktives Team"}
            {data.teamCode ? ` · ${data.teamCode}` : ""}
          </span>
          <h2 className="nl-player-hero-name">{data.name}</h2>
          <div className="nl-player-hero-tags">
            <ClassIcon
              classNameValue={data.className}
              className="nl-player-hero-class-chip"
              iconClassName="nl-player-hero-class-icon"
            />
            <RaceIcon race={data.race} className="nl-player-hero-race-chip" iconClassName="nl-player-hero-race-icon" />
            <span className="nl-player-hero-role" title="Kader-Rolle">
              Rolle {roleLabel}
            </span>
          </div>
          <StatChipRow className="nl-player-hero-chips" aria-label="Spieler-Kennzahlen">
            <StatChip
              label="OVR"
              value={formatNlNumber(data.ovr, 1)}
              tone="accent"
              sub={formatHeroSub(data.ovrRank, data.ovrDelta, leaguePoolSize)}
              title={appendDeltaSource("Overall-Rating · öffnet die Liga-Leaders-Liste", data.ovrDeltaSourceLabel)}
              onClick={buildLeadersClick("ovr", data.ovrRank)}
            />
            <StatChip
              label="PPs"
              value={formatNlNumber(data.pps ?? data.ppsRating, 1)}
              tone="spe"
              sub={formatHeroSub(data.ppsRank, data.ppsDelta, leaguePoolSize)}
              title={appendDeltaSource("Performance-Punkte · öffnet die Liga-Leaders-Liste", data.ppsDeltaSourceLabel)}
              onClick={buildLeadersClick("pps", data.ppsRank)}
            />
            <StatChip
              label="MVS"
              value={formatNlNumber(data.mvs, 1)}
              tone="soc"
              sub={formatHeroSub(data.mvsRank, data.mvsDelta, leaguePoolSize)}
              title={appendDeltaSource(
                "Market Value Score: treibt Marktwert und Angebote — nicht der Marktwert selbst · öffnet die Liga-Leaders-Liste",
                data.mvsDeltaSourceLabel,
              )}
              onClick={buildLeadersClick("mvs", data.mvsRank)}
            />
            <StatChip
              label="MW"
              value={formatNlNumber(data.marketValue, 1)}
              tone="neutral"
              sub="Marktwert"
              title="Marktwert"
            />
            <StatChip
              label="GEHALT"
              value={formatNlNumber(heroSalary, 1)}
              tone="neutral"
              sub="pro Saison"
              title="Gehalt pro Saison"
            />
          </StatChipRow>
        </div>
      </div>
      <div className="nl-player-hero-charts">
        <NlRadar
          axes={radarAxes}
          max={100}
          showValues
          ghostAxes={showGhost ? ghostAxes : undefined}
          ghostLabel={ghostLabel}
          onAxisClick={handleRadarAxisClick}
          className="nl-player-hero-radar"
          aria-label={`Achsen-Radar für ${data.name}`}
        />
        {showGhost && ghostLabel ? (
          <p className="nl-player-hero-radar-legend" aria-label="Radar-Legende">
            <span className="nl-player-hero-radar-legend-item is-current">
              <span className="nl-player-hero-radar-legend-swatch" aria-hidden="true" />
              Aktuell
            </span>
            <span className="nl-player-hero-radar-legend-item is-ghost">
              <span className="nl-player-hero-radar-legend-swatch" aria-hidden="true" />
              {ghostLabel}
            </span>
          </p>
        ) : null}
      </div>
      <button className="nl-player-hero-close" type="button" onClick={onClose}>
        Schließen
      </button>
    </section>
  );
}

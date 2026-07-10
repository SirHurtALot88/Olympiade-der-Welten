"use client";

/**
 * "Neuer Look" Spieler-Hero (flag-gated, additiv).
 *
 * Ersetzt — nur bei aktivem `useNewLook`-Flag — den Identitäts-/Ratings-Block
 * oben im Spieler-Drawer bzw. auf der Spielerprofil-Seite:
 * Portrait links, Name + Klasse/Rasse + Rolle, das Stat-Vokabular
 * (OVR / PPs / MVS / MW) als StatChips, das POW/SPE/MEN/SOC-Radar und —
 * wenn echte CA/PO-Sterne vorliegen — ein kleines CA→PO-Gauge.
 *
 * Alle Werte kommen unverändert aus `PlayerDetailDrawerData`
 * (`buildPlayerDrawerDataFromGameState`); es werden keine Daten erfunden.
 * Styles: `app/globals.css` unter `.is-new-look .nl-player-hero*`.
 */

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlGauge,
  NlRadar,
  StatChip,
  StatChipRow,
  formatNlNumber,
  type NlRadarAxis,
} from "@/components/foundation/new-look";
import type { LeagueLeaderCategoryId } from "@/lib/foundation/league-leaders-service";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";

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
  return rank != null && Number.isFinite(rank) ? `#${formatNlNumber(rank, 0)} Liga` : undefined;
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
  caStars,
  poStars,
  isFreeAgent,
  onClose,
  onOpenLeagueLeaders,
}: PlayerHeroNewLookProps) {
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

  // Portal-Navigation: identisch zu den bestehenden KPI-Hero-Karten des
  // Drawers führen OVR/PPs/MVS über `onOpenLeagueLeaders` in die
  // Liga-Leaders-Spielerliste (nach der jeweiligen Kennzahl sortiert).
  // Ohne erreichbaren Handler (oder für MW, wofür es keinen gibt) bleibt der
  // Chip als Portal-Affordance klickbar, navigiert aber bewusst nirgendwohin.
  const buildLeadersClick = (categoryId: LeagueLeaderCategoryId, rank: number | null) => {
    if (onOpenLeagueLeaders != null && !isFreeAgent && rank != null) {
      return () => onOpenLeagueLeaders(categoryId, { playerId: data.playerId, playerName: data.name });
    }
    return () => {};
  };

  const showGauge = caStars != null && poStars != null && poStars > 0;

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
              sub={formatHeroRank(data.ovrRank)}
              title="Overall-Rating · öffnet die Liga-Leaders-Liste"
              onClick={buildLeadersClick("ovr", data.ovrRank)}
            />
            <StatChip
              label="PPs"
              value={formatNlNumber(data.pps ?? data.ppsRating, 1)}
              tone="spe"
              sub={formatHeroRank(data.ppsRank)}
              title="Performance-Punkte · öffnet die Liga-Leaders-Liste"
              onClick={buildLeadersClick("pps", data.ppsRank)}
            />
            <StatChip
              label="MVS · Ruhm"
              value={formatNlNumber(data.mvs, 1)}
              tone="soc"
              sub={formatHeroRank(data.mvsRank)}
              title="Market Value Score (Ruhm): treibt Marktwert und Angebote — nicht der Marktwert selbst · öffnet die Liga-Leaders-Liste"
              onClick={buildLeadersClick("mvs", data.mvsRank)}
            />
            <StatChip
              label="MW"
              value={formatNlNumber(data.marketValue, 1)}
              tone="neutral"
              sub="Marktwert"
              title="Marktwert"
              onClick={() => {}}
            />
          </StatChipRow>
        </div>
      </div>
      <div className="nl-player-hero-charts">
        <NlRadar
          axes={radarAxes}
          max={100}
          showValues
          className="nl-player-hero-radar"
          aria-label={`Achsen-Radar für ${data.name}`}
        />
        {showGauge ? (
          <NlGauge
            className="nl-player-hero-gauge"
            value={caStars}
            max={poStars}
            label="CA→PO"
            tone="accent"
            format={(value, max) => `${formatNlNumber(value, 1)}→${formatNlNumber(max, 1)}★`}
            title="Aktuelle Stärke (CA) im Verhältnis zum Potential (PO), in Sternen."
          />
        ) : null}
      </div>
      <button className="nl-player-hero-close" type="button" onClick={onClose}>
        Schliessen
      </button>
    </section>
  );
}

"use client";

/**
 * "Neuer Look" Spieler-Hero (flag-gated, additiv).
 *
 * Ersetzt — nur bei aktivem `useNewLook`-Flag — den Identitäts-/Ratings-Block
 * oben im Spieler-Drawer bzw. auf der Spielerprofil-Seite:
 * Portrait links, Name + Klasse/Rasse + Rolle, das Stat-Vokabular
 * (MW / GEHALT / VERTRAG) als StatChips und das POW/SPE/MEN/SOC-Radar.
 * CA/PO werden bewusst NICHT hier dupliziert — die Sterne stehen bereits
 * in der Scouting-Karte darunter. Aus demselben Grund (D4, Audit „Team"):
 * OVR/PPs/MVS erscheinen NICHT hier — sie stehen mit Rang, Vorsaison-Delta
 * und Liga-Leaders-Link bereits in der KPI-Kartenreihe direkt daneben
 * (`player-drawer-kpi-hero-grid`, siehe PlayerDetailDrawer). Eine dritte,
 * schwächer ausgestattete Kopie hier hätte nur zur „100 / 28,7 / —"-Drift
 * aus dem Audit geführt, ohne neue Information zu tragen.
 *
 * Alle Werte kommen unverändert aus `PlayerDetailDrawerData`
 * (`buildPlayerDrawerDataFromGameState`); es werden keine Daten erfunden.
 * Styles: `app/globals.css` unter `.is-new-look .nl-player-hero*`.
 */

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { getPlayerPortraitInitials } from "@/lib/data/mediaAssets";
import {
  NlRadar,
  StatChip,
  StatChipRow,
  formatNlMoney,
  type NlRadarAxis,
} from "@/components/foundation/new-look";
import {
  getPlayerDisplaySalary,
  getRosterEntryDisplaySalary,
} from "@/app/foundation/foundation-page-client-exports";
import { buildPlayerContractTileView } from "@/lib/foundation/player-contract-tile";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { LeagueLeaderCategoryId } from "@/lib/foundation/league-leaders-service";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import {
  getPlayerStarTier,
  getPlayerStarTierClassName,
  getPlayerStarTierLabel,
  isHoloPlayerStarTier,
} from "@/lib/foundation/player-star-tier";
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

export type PlayerHeroNewLookProps = {
  data: PlayerDetailDrawerData;
  /**
   * Voller GameState, optional durchgereicht vom Render-Ort (Profil-Seite/Drawer).
   * Wird bevorzugt vor dem Kontext genutzt: `gameState ?? foundationState?.gameState`.
   * `FoundationStateProvider` ist um `FoundationShellRouterBody` gemountet
   * (`FoundationPageClient.tsx`) und liefert innerhalb der Foundation-Shell einen
   * echten Wert; ausserhalb davon (Storybook/Isolation, ältere Standalone-
   * Render-Orte) bleibt `foundationState` `null` und dieses Prop der einzige Weg.
   */
  gameState?: GameState | null;
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
  gameState,
  roleLabel,
  isFreeAgent,
  onClose,
  onOpenLeagueLeaders,
}: PlayerHeroNewLookProps) {
  const foundationState = useFoundationStateOptional();
  // Prop zuerst (durchgereichter GameState), dann der Kontext als Fallback —
  // der liefert innerhalb der Foundation-Shell inzwischen einen echten Wert
  // (siehe `PlayerHeroNewLookProps.gameState`), aber nicht ausserhalb davon.
  const resolvedGameState = gameState ?? foundationState?.gameState ?? null;

  // GEHALT-Chip (neben MW): reales Saison-Gehalt.
  //
  // PRIMÄRQUELLE ist `data.salary` aus dem Drawer-Builder
  // (`buildPlayerDrawerDataFromGameState`) — dort wird der echte Kader-Eintrag
  // via `resolveRosterEntry` aufgelöst und das Gehalt aus derselben Economy
  // gezogen wie MW/Vertrag (jetzt aktuelles Saison-Gehalt zuerst, s.
  // `salary`-Feld im Builder). Das ist die zuverlässige Quelle für den
  // ANGEZEIGTEN Spieler und UNABHÄNGIG vom Client-`foundationState`-Kontext:
  // auf der Profil-Route ist `useFoundationStateOptional()` bzw. dessen
  // `rosters` je nach Mount-Scope null/leer, weshalb eine reine
  // Client-seitige Kader-Suche hier für gekaufte Spieler fälschlich "—"
  // ergab. `data.salary` ist für jeden rostierten (gekauften) Spieler
  // gesetzt → die harte Regel "Gehalt kann nicht '—' sein, wenn gekauft" hält.
  //
  // Sekundär (nur falls `data.salary` ausnahmsweise null ist, z. B. Isolation
  // ohne Builder-Economy): eigene Kader-Auflösung über `foundationState`,
  // sonst Liga-Anzeigegehalt ohne Kaderbindung (`getPlayerDisplaySalary`).
  const rosterEntry = resolvedGameState
    ? (resolvedGameState.rosters.find((entry) => entry.playerId === data.playerId) ?? null)
    : null;
  const heroPlayer = resolvedGameState?.players.find((entry) => entry.id === data.playerId) ?? null;
  const heroSalary =
    data.salary ??
    (rosterEntry ? getRosterEntryDisplaySalary(rosterEntry, heroPlayer) : getPlayerDisplaySalary(heroPlayer));

  // VERTRAG-Kachel: Restlaufzeit + Gehaltsverlauf. Quelle sind bewusst die
  // Drawer-Daten und nicht der selbst gesuchte `rosterEntry` — auf der
  // Profil-Route ist der Foundation-Kontext (und damit `rosters`) je nach
  // Mount-Scope leer, genau daran hing frueher schon die Gehaltsanzeige.
  // `contractLength` ist die VERBLEIBENDE Laufzeit (Saisonende-Tick zaehlt
  // herunter), die Staffel wird synchron mitgekuerzt.
  const contractTile = buildPlayerContractTileView({
    contractLength: data.contractLength ?? rosterEntry?.contractLength ?? null,
    yearlySalarySchedule: data.yearlySalarySchedule ?? rosterEntry?.yearlySalarySchedule ?? null,
  });

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

  // Radar-Achsen als Portale (#60): POW/SPE/MEN/SOC sind reale
  // Liga-Leaders-Kategorien — Klick auf ein Achsen-Label öffnet die nach
  // dieser Achse sortierte Leaders-Liste. Ohne Handler / für Free Agents
  // bleiben die Labels rein informativ.
  const handleRadarAxisClick =
    onOpenLeagueLeaders != null && !isFreeAgent
      ? (axisKey: NlRadarAxis["key"]) =>
          onOpenLeagueLeaders(axisKey, { playerId: data.playerId, playerName: data.name })
      : undefined;

  // Star-Tier fürs Hero-Portrait (#): dieselbe ligaweite Top-Riege wie im Kader,
  // in der Spielertabelle und an der Arena-Marke — ausschliesslich über den
  // OVR-Rang (siehe `getPlayerStarTier`), nicht mehr über die beste der drei
  // Kennzahlen. Ein Free Agent/Spieler ohne OVR-Rang (`ovrRank` `null`)
  // bekommt automatisch keine Stufe zurück, also auch keinen Rahmen — kein
  // Sonderfall nötig.
  const heroStarTier = getPlayerStarTier(data.ovrRank);
  const heroStarTierLabel = getPlayerStarTierLabel(heroStarTier);
  const heroPortraitClassName = [
    "nl-player-hero-portrait",
    "nl-star-frame",
    getPlayerStarTierClassName(heroStarTier),
    isHoloPlayerStarTier(heroStarTier) ? "is-star-holo" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="is-new-look nl-player-hero" data-testid="player-hero-new-look" data-new-look="true">
      <div className="nl-player-hero-identity">
        {data.portraitUrl ? (
          <BudgetedMediaImage
            className={heroPortraitClassName}
            src={data.portraitUrl}
            alt={data.name}
            // Ein Kuerzel fuer alle Ansichten: ohne `fallbackLabel` leitet OptimizedMediaImage es
            // aus dem Alt-Text ab und schreibt bei einteiligen Namen zwei Zeichen ("Umbros" ->
            // "UM"), waehrend das Portrait-Modell ueberall sonst "U" sagt.
            fallbackLabel={getPlayerPortraitInitials(data.name)}
            title={heroStarTierLabel ?? undefined}
            width={220}
            height={220}
            loading="eager"
            fetchPriority="high"
            eager
          />
        ) : (
          <div
            className={`${heroPortraitClassName} nl-player-hero-portrait-fallback`}
            title={heroStarTierLabel ?? undefined}
            aria-hidden="true"
          >
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
            {roleLabel ? (
              <span className="nl-player-hero-role" title="Kader-Rolle">
                Rolle {roleLabel}
              </span>
            ) : null}
          </div>
          <StatChipRow className="nl-player-hero-chips" aria-label="Spieler-Kennzahlen">
            {/* OVR/PPs/MVS stehen bewusst NICHT hier (D4, Audit „Team"): sie
                erscheinen bereits mit Rang, Vorsaison-Delta und
                Liga-Leaders-Link in der KPI-Kartenreihe direkt darunter
                (`player-drawer-kpi-hero-grid`) — eine zweite, schwächere
                Kopie hätte nur wieder auseinanderlaufen können. MW/GEHALT/
                VERTRAG bleiben hier, weil sie sonst nirgends stehen. */}
            <StatChip
              label="MW"
              value={formatNlMoney(data.marketValue)}
              tone="neutral"
              sub="Marktwert"
              title="Marktwert"
            />
            <StatChip
              label="GEHALT"
              value={formatNlMoney(heroSalary)}
              tone="neutral"
              sub="pro Saison"
              title="Gehalt pro Saison"
            />
            {/* Restlaufzeit. Ohne laufenden Vertrag (Free Agent) gibt es nichts
                zu zeigen — dann entfaellt die Kachel ganz, statt "—" zu zeigen. */}
            {contractTile.valueLabel ? (
              <StatChip
                label="VERTRAG"
                value={contractTile.valueLabel}
                tone={contractTile.isExpiring ? "accent" : "neutral"}
                sub={contractTile.subLabel ?? undefined}
                title={
                  contractTile.isExpiring
                    ? "Restlaufzeit: läuft am Saisonende aus"
                    : "Verbleibende Vertragslaufzeit"
                }
              />
            ) : null}
          </StatChipRow>
          {/* Gehaltsverlauf nur bei mehrjaehrigen Vertraegen: bei einer Saison
              steht der Betrag schon in der GEHALT-Kachel. */}
          {contractTile.schedule.length > 1 ? (
            <div className="nl-player-hero-contract-schedule" aria-label="Gehaltsverlauf je Vertragssaison">
              <span className="nl-player-hero-contract-schedule-label">Gehaltsverlauf</span>
              {contractTile.schedule.map((year, index) => (
                <span key={`${year.yearIndex}-${year.label}`} className="nl-player-hero-contract-year">
                  <span className="nl-player-hero-contract-year-label">{year.label}</span>
                  <span className="nl-player-hero-contract-year-value nl-tnum">{formatNlMoney(year.salary)}</span>
                  {index === 0 ? <span className="nl-player-hero-contract-year-now">laufend</span> : null}
                </span>
              ))}
            </div>
          ) : null}
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

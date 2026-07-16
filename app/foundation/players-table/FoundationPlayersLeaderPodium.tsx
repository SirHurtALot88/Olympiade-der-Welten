"use client";

/**
 * Leader-Podium — Seiten-Hero des Spieler-Verzeichnisses (additiv, "Neuer Look").
 *
 * Klassisches 1-2-3-Podest der aktuellen Auswahl (`rows`, dieselben bereits
 * Umfang-/Team-/Klassen-gefilterten Zeilen wie der Rest der Seite — siehe
 * `FoundationPlayersTableNewLook`), rankbar über eine Kennzahl-Segmentleiste
 * (OVR/PPs/MVS, Standard OVR). Platz 1 steht mittig auf dem höchsten Sockel,
 * 2 links, 3 rechts (CSS `order`, DOM-Reihenfolge bleibt 1→2→3 für
 * Screenreader).
 *
 * Klick auf Name/Team portalt exakt wie überall sonst in den Spieler-Drawer
 * bzw. das Teamprofil (dieselben Callback-Props). Hover auf das Portrait
 * zeigt denselben reichen Steckbrief-Hover wie die Tabellenzeile
 * (`FoundationPlayerPortraitPreview`, volle Dichte — Portrait, Name,
 * Team/Klasse/Rasse, OVR/PPs/MVS, Achsen-Orbit, CA/PO-Sterne) — bewusst KEINE
 * zweite, parallele Hover-Implementierung.
 *
 * Rein Lese-/Ableitungslogik aus `rows` (kein neuer Datenzugriff). Fog of
 * war für fremdes Potenzial über `getFoggedPoScoreRange`, geteilt mit
 * `FoundationPlayersTableNewLook.tsx` (siehe `foundation-players-fog-of-war.ts`) —
 * eigene (`team.humanControlled`) Spieler zeigen ihr echtes PO, fremde nur
 * einen unscharfen Bereich, nie eine konkrete Zahl.
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-podium-*`.
 */

import { useMemo, useState } from "react";

import { getPlayerPortraitModel } from "@/app/foundation/foundation-page-client-exports";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlCard,
  NlMedalBadge,
  formatNlNumber,
  nlToneClass,
  type NlMedalKind,
  type NlTone,
} from "@/components/foundation/new-look";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import type { FoundationPlayerScopeRow } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";

import { getFoggedPoScoreRange } from "@/app/foundation/players-table/foundation-players-fog-of-war";
import { computeCurrentAbilityScore } from "@/lib/scouting/current-ability-score";

type NlPodiumMetricKey = "ovr" | "pps" | "mvs";

const NL_PODIUM_METRICS: ReadonlyArray<{
  key: NlPodiumMetricKey;
  label: string;
  tone: NlTone;
  digits: number;
  title: string;
}> = [
  { key: "ovr", label: "OVR", tone: "accent", digits: 1, title: "Podium nach Overall-Rating" },
  { key: "pps", label: "PPs", tone: "spe", digits: 1, title: "Podium nach Performance-Punkten der Saison" },
  { key: "mvs", label: "MVS", tone: "soc", digits: 1, title: "Podium nach Market Value Score" },
];

/** Rohwert der gewählten Podium-Kennzahl für eine Zeile — `null`, wenn nicht bekannt (keine Erfindung). */
function getPodiumMetricValue(row: FoundationPlayerScopeRow, key: NlPodiumMetricKey): number | null {
  switch (key) {
    case "ovr":
      return row.playerOvr;
    case "pps":
      return row.playerPps;
    case "mvs":
      return row.playerMvs;
    default:
      return null;
  }
}

const NL_PODIUM_MEDAL_BY_RANK: Record<number, NlMedalKind> = { 1: "gold", 2: "silver", 3: "bronze" };

export type FoundationPlayersLeaderPodiumProps = {
  /** Dieselben (bereits Umfang-/Team-/Klassen-gefilterten) Zeilen wie der Rest der Seite. */
  rows: FoundationPlayerScopeRow[];
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  openTeamProfileById: (teamId: string) => void;
};

export default function FoundationPlayersLeaderPodium({
  rows,
  leaguePlayerHeatPools,
  openPlayerDrawerById,
  openTeamProfileById,
}: FoundationPlayersLeaderPodiumProps) {
  const [metric, setMetric] = useState<NlPodiumMetricKey>("ovr");
  const activeMetric = NL_PODIUM_METRICS.find((entry) => entry.key === metric) ?? NL_PODIUM_METRICS[0]!;

  const topThree = useMemo(() => {
    const withValue = rows
      .map((row) => ({ row, value: getPodiumMetricValue(row, metric) }))
      .filter(
        (entry): entry is { row: FoundationPlayerScopeRow; value: number } =>
          entry.value != null && Number.isFinite(entry.value),
      );
    withValue.sort((left, right) => right.value - left.value);
    return withValue.slice(0, 3).map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [rows, metric]);

  return (
    <NlCard
      className="nl-podium-card"
      eyebrow="Liga-Hero"
      title="Sieger-Podest"
      actions={
        <div className="nl-phub-metric-bar" role="group" aria-label="Podium-Kennzahl wählen">
          {NL_PODIUM_METRICS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`nl-phub-metric-btn ${nlToneClass(entry.tone)}${metric === entry.key ? " is-active" : ""}`}
              onClick={() => setMetric(entry.key)}
              aria-pressed={metric === entry.key}
              title={entry.title}
            >
              {entry.label}
            </button>
          ))}
        </div>
      }
    >
      {topThree.length === 0 ? (
        <p className="nl-phub-empty">Keine {activeMetric.label}-Daten in der aktuellen Auswahl.</p>
      ) : (
        <div className="nl-podium" role="list" aria-label={`Top ${topThree.length} der Auswahl nach ${activeMetric.label}`}>
          {topThree.map(({ row, value, rank }) => {
            const portrait = getPlayerPortraitModel(row.player);
            const playerOwned = row.team?.humanControlled ?? false;
            const medalKind = NL_PODIUM_MEDAL_BY_RANK[rank] ?? "bronze";
            return (
              <div key={row.player.id} className={`nl-podium-plinth is-rank-${rank}`} role="listitem">
                <div
                  className="nl-podium-portrait-wrap"
                  onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                >
                  <FoundationPlayerPortraitPreview
                    playerId={row.player.id}
                    name={row.player.name}
                    portraitUrl={portrait.previewSrc ?? portrait.src}
                    portraitInitials={portrait.initials}
                    playerOvr={row.playerOvr}
                    playerMvs={row.playerMvs}
                    playerPps={row.playerPps}
                    pow={row.player.coreStats.pow ?? null}
                    spe={row.player.coreStats.spe ?? null}
                    men={row.player.coreStats.men ?? null}
                    soc={row.player.coreStats.soc ?? null}
                    leagueHeatPools={leaguePlayerHeatPools}
                    variant="team"
                    context="teamGrid"
                    playerClassName={row.player.className}
                    subMeta={[row.team?.name ?? "Free Agent", row.player.className, row.player.race]
                      .filter(Boolean)
                      .join(" · ")}
                    previewDensity="full"
                    newLook
                    known={playerOwned}
                    // CA ist die absolute, peak-gewichtete Bewertung aus den Kernwerten —
                    // NICHT `row.playerOvr` (liga-relativ). Ein Liga-#1 mit mittelmäßigen
                    // Absolutwerten soll nicht als CA 100 / 5 Sterne erscheinen. Siehe
                    // `lib/scouting/current-ability-score.ts`.
                    caScore={computeCurrentAbilityScore(row.player.coreStats)}
                    {...(playerOwned
                      ? { poScore: row.player.potential ?? null }
                      : { poScoreRange: getFoggedPoScoreRange(row.player.potential ?? null) })}
                  >
                    {portrait.src ? (
                      <BudgetedMediaImage
                        className="nl-podium-portrait"
                        src={portrait.src}
                        alt={row.player.name}
                        width={72}
                        height={72}
                        loading="lazy"
                        fetchPriority="low"
                        fallback={
                          <span className="nl-podium-portrait nl-podium-portrait-fallback" aria-hidden="true">
                            {portrait.initials}
                          </span>
                        }
                      />
                    ) : (
                      <span className="nl-podium-portrait nl-podium-portrait-fallback" aria-hidden="true">
                        {portrait.initials}
                      </span>
                    )}
                  </FoundationPlayerPortraitPreview>
                  <span className="nl-podium-medal-slot">
                    <NlMedalBadge kind={medalKind} title={`Platz ${rank}`} />
                  </span>
                </div>
                <button
                  type="button"
                  className="nl-podium-name-btn"
                  onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                  title={`${row.player.name} öffnen`}
                >
                  {row.player.name}
                </button>
                {row.team ? (
                  <button
                    type="button"
                    className="nl-podium-team-btn"
                    onClick={() => openTeamProfileById(row.team!.teamId)}
                    title={`${row.team.name} öffnen`}
                  >
                    {row.team.name}
                  </button>
                ) : (
                  <span className="nl-podium-team-btn is-free-agent">Free Agent</span>
                )}
                <span className={`nl-podium-value nl-tnum ${nlToneClass(activeMetric.tone)}`}>
                  {formatNlNumber(value, activeMetric.digits)}
                  <small className="nl-podium-value-label">{activeMetric.label}</small>
                </span>
                <div className="nl-podium-riser" aria-hidden="true">
                  <span className="nl-podium-riser-rank nl-tnum">{rank}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </NlCard>
  );
}

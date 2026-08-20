"use client";

import { useMemo } from "react";

import type { AllTimeTableRow } from "@/lib/foundation/all-time-table";
// Zwei Module, weil die beiden Formatierer dort liegen — nicht ueber das Sammelmodul, das
// React-Bauteile mitzoege (siehe `ci:client-bundle-lint`).
import { formatNlMoney } from "@/components/foundation/new-look/nl-format";
import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";

/**
 * ALLE TEAMS IN EINER GRAFIK — mit genau einer hervorgehobenen Linie.
 *
 * GEMELDET VON CHRIS (`lcmgxx`, „Team · Ewige Tabelle"): „darunter soll eine Grafik für ALLE teams
 * in einem sein wo man so die changes sehen kann und ein team hervorgehoben wird wenn man es
 * anklickt - und mein eigenes standardmäßig das hervorgehobene ist!"
 *
 * WARUM NICHT 32 GLEICHWERTIGE LINIEN. Die Ewige Tabelle hatte bereits eine Verlaufskarte, aber
 * als Gitter aus 32 EINZELNEN Sparklines — man sieht dort jeden Verlauf für sich und keinen gegen
 * die anderen. Genau das ist Chris' „in einem". Umgekehrt sind 32 gleich starke Linien in einem
 * Bild unlesbar; deshalb trägt hier immer genau eine Linie die Farbe und den Vordergrund, alle
 * anderen liegen blass dahinter als Feld. Das beantwortet „wo stehe ich gegen die Liga" in einem
 * Blick, ohne dass man 32 Farben auseinanderhalten müsste.
 *
 * DIE HERVORHEBUNG IST EIN ZUSTAND DES ELTERNTEILS, kein eigener: die Ewige Tabelle kennt das
 * eigene Team ohnehin (`selectedTeamId`) und setzt es als Vorgabe. So bleibt „mein Team" die
 * Vorgabe, ohne dass dieses Bauteil eine zweite Meinung darüber hat, welches Team meines ist.
 *
 * KEINE ACHSENBESCHRIFTUNG IN ZAHLEN: die Spanne steht als Text über der Grafik. Eine Y-Achse mit
 * Ticks bei 32 Linien und wenigen Stützstellen kostet mehr Platz, als sie erklärt.
 */
export type AllTimeLeagueChartMetric = "mw" | "cash" | "points" | "rank";

export type AllTimeLeagueChartProps = {
  rows: AllTimeTableRow[];
  metric: AllTimeLeagueChartMetric;
  /** Das hervorgehobene Team. Die Ewige Tabelle setzt hier standardmässig das eigene. */
  highlightedTeamId: string | null;
  onHighlight: (teamId: string) => void;
};

const BREITE = 720;
const HOEHE = 240;
const RAND_LINKS = 12;
const RAND_RECHTS = 12;
const RAND_OBEN = 14;
const RAND_UNTEN = 28;

function wertFuer(season: AllTimeTableRow["seasons"][number], metric: AllTimeLeagueChartMetric): number | null {
  const roh =
    metric === "mw"
      ? season.marketValue
      : metric === "cash"
        ? season.cash
        : metric === "points"
          ? season.points
          : season.rank;
  return roh != null && Number.isFinite(roh) ? roh : null;
}

function formatiere(wert: number, metric: AllTimeLeagueChartMetric): string {
  if (metric === "rank") {
    return `#${formatNlNumber(wert, 0)}`;
  }
  if (metric === "points") {
    return formatNlNumber(wert, 1);
  }
  return formatNlMoney(wert);
}

export default function AllTimeLeagueChart({ rows, metric, highlightedTeamId, onHighlight }: AllTimeLeagueChartProps) {
  const modell = useMemo(() => {
    // Die Saison-Achse ist die VEREINIGUNG aller Teams, nicht die des ersten: ein Team, das eine
    // Saison ausgelassen hat, darf die Achse der anderen nicht verkuerzen.
    const saisonIds: string[] = [];
    const label = new Map<string, string>();
    for (const row of rows) {
      for (const season of row.seasons) {
        if (!label.has(season.seasonId)) {
          label.set(season.seasonId, season.seasonLabel);
          saisonIds.push(season.seasonId);
        }
      }
    }
    saisonIds.sort((links, rechts) => links.localeCompare(rechts, "de", { numeric: true }));

    const linien = rows
      .map((row) => {
        const punkte = saisonIds.map((seasonId) => {
          const season = row.seasons.find((entry) => entry.seasonId === seasonId) ?? null;
          return season ? wertFuer(season, metric) : null;
        });
        return { teamId: row.teamId, teamName: row.teamName, teamCode: row.teamCode, punkte };
      })
      .filter((linie) => linie.punkte.filter((wert) => wert != null).length >= 1);

    const alleWerte = linien.flatMap((linie) => linie.punkte.filter((wert): wert is number => wert != null));
    if (saisonIds.length === 0 || alleWerte.length === 0) {
      return null;
    }
    const min = Math.min(...alleWerte);
    const max = Math.max(...alleWerte);
    // Bei nur EINEM Wert (oder lauter gleichen) wäre die Spanne 0 und jede Linie läge auf dem Rand.
    const spanne = max - min || 1;
    const innenBreite = BREITE - RAND_LINKS - RAND_RECHTS;
    const innenHoehe = HOEHE - RAND_OBEN - RAND_UNTEN;

    const x = (index: number) =>
      RAND_LINKS + (saisonIds.length === 1 ? innenBreite / 2 : (index / (saisonIds.length - 1)) * innenBreite);
    // Beim Rang ist KLEINER besser — die Achse dreht, sonst zeigt ein Aufstieg nach unten.
    const y = (wert: number) => {
      const anteil = (wert - min) / spanne;
      const gedreht = metric === "rank" ? anteil : 1 - anteil;
      return RAND_OBEN + gedreht * innenHoehe;
    };

    return {
      saisonIds,
      labels: saisonIds.map((seasonId) => label.get(seasonId) ?? seasonId),
      min,
      max,
      linien: linien.map((linie) => ({
        ...linie,
        pfad: linie.punkte
          .map((wert, index) => (wert == null ? null : `${x(index)},${y(wert)}`))
          .filter((eintrag): eintrag is string => eintrag != null)
          .join(" "),
        letzterWert: [...linie.punkte].reverse().find((wert): wert is number => wert != null) ?? null,
      })),
      x,
      y,
    };
  }, [metric, rows]);

  if (!modell) {
    return <p className="nl-alltime-liga-hinweis">Für diese Kennzahl liegt noch kein Verlauf vor.</p>;
  }

  /**
   * EINE STÜTZSTELLE IST KEIN VERLAUF — und sie sähe aus wie ein Fehler. Eine `<polyline>` mit
   * genau einem Punkt zeichnet nichts; das Bild wäre leer bis auf den einen Kreis des
   * hervorgehobenen Teams. An den Spielständen ist das der Normalfall der ersten Saison: über die
   * fünf Abbilder gemessen tragen vier genau eine Saison und nur `1hf25q` zwei (dort dann 32 von
   * 32 Linien mit mindestens zwei Punkten). Statt einer leeren Fläche steht hier der Grund.
   */
  if (modell.saisonIds.length < 2) {
    return (
      <p className="nl-alltime-liga-hinweis" data-testid="nl-alltime-liga-zu-kurz">
        Der Liga-Verlauf braucht mindestens zwei Saisons — bisher liegt eine vor.
      </p>
    );
  }

  const hervorgehoben = modell.linien.find((linie) => linie.teamId === highlightedTeamId) ?? null;

  return (
    <div className="nl-alltime-liga" data-testid="nl-alltime-liga-chart">
      <p className="nl-alltime-liga-spanne nl-tnum">
        {formatiere(modell.min, metric)} bis {formatiere(modell.max, metric)}
        {metric === "rank" ? " · kleiner ist besser" : ""}
      </p>
      <svg
        className="nl-alltime-liga-svg"
        viewBox={`0 0 ${BREITE} ${HOEHE}`}
        role="img"
        aria-label={
          hervorgehoben
            ? `Liga-Verlauf, hervorgehoben: ${hervorgehoben.teamName}`
            : "Liga-Verlauf über alle Teams"
        }
        preserveAspectRatio="none"
      >
        {/* Das Feld: alle anderen Teams, blass. Sie sind der Vergleich, nicht der Inhalt. */}
        {modell.linien
          .filter((linie) => linie.teamId !== highlightedTeamId)
          .map((linie) => (
            <polyline key={linie.teamId} className="nl-alltime-liga-linie" points={linie.pfad} />
          ))}
        {/* Die hervorgehobene Linie zuletzt, damit sie ueber dem Feld liegt. */}
        {hervorgehoben ? (
          <>
            <polyline className="nl-alltime-liga-linie is-hervorgehoben" points={hervorgehoben.pfad} />
            {hervorgehoben.punkte.map((wert, index) =>
              wert == null ? null : (
                <circle
                  key={`${hervorgehoben.teamId}-${index}`}
                  className="nl-alltime-liga-punkt"
                  cx={modell.x(index)}
                  cy={modell.y(wert)}
                  r={3}
                >
                  <title>{`${modell.labels[index]}: ${formatiere(wert, metric)}`}</title>
                </circle>
              ),
            )}
          </>
        ) : null}
        {modell.labels.map((label, index) => (
          <text key={label} className="nl-alltime-liga-achse" x={modell.x(index)} y={HOEHE - 8} textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
      <div className="nl-alltime-liga-legende" role="group" aria-label="Team hervorheben">
        {modell.linien.map((linie) => (
          <button
            key={linie.teamId}
            type="button"
            className={`nl-alltime-liga-chip${linie.teamId === highlightedTeamId ? " is-hervorgehoben" : ""}`}
            onClick={() => onHighlight(linie.teamId)}
            title={
              linie.letzterWert != null
                ? `${linie.teamName} · zuletzt ${formatiere(linie.letzterWert, metric)}`
                : linie.teamName
            }
            aria-pressed={linie.teamId === highlightedTeamId}
          >
            {linie.teamCode}
          </button>
        ))}
      </div>
    </div>
  );
}

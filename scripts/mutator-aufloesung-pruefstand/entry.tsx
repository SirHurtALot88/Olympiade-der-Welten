import React from "react";
import { createRoot } from "react-dom/client";

import "@/app/globals.css";
import DisciplineStageResultTable, { type ResultTableRow } from "@/app/foundation/discipline-stage/arena/DisciplineStageResultTable";
import DisciplineStageSpieltagswertung from "@/app/foundation/discipline-stage/DisciplineStageSpieltagswertung";

// Prüfstand Mutator-Auflösung (22.11.): ECHTE Komponenten und ECHTES CSS, Daten SYNTHETISCH im Zuschnitt der
// Battle-Preview (Treffer je Spieler, keine Mutator-Punkte). `?vorher=1` entfernt die Treffer — so sah die Auflösung
// vor der Änderung aus (der alte Code kannte das Feld nicht, bei 0 Mutator-Punkten blieb die Zeile leer).
const params = new URLSearchParams(location.search);
const vorher = params.get("vorher") === "1";
const ansicht = params.get("ansicht") ?? "wertung";
const disziplin = params.get("diszi") ?? "basketball";

const TEAMS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const NAMEN = ["Death Peaches", "Nordlicht", "Riffhaie", "Kupferkrähen", "Mondwölfe", "Salzfüchse", "Eisbrecher", "Glutfalken"];
const SPIELER = ["Maru Kenji", "Lio Brandt", "Ava Okoro", "Tem Vasco", "Ilse Marek", "Juno Pak", "Rafe Holm", "Noa Sinn"];
const meta = new Map(TEAMS.map((id, i) => [id, { code: id.toUpperCase().repeat(3), name: NAMEN[i]!, logoUrl: null }]));

const trefferFuer = (t: number, s: number) => (vorher ? null : (t * 3 + s * 5) % 7 === 0 ? 2 : (t + s * 2) % 4 === 0 ? 1 : null);

const spielerListe = (t: number, anzahl: number) =>
  Array.from({ length: anzahl }, (_, s) => {
    const hits = trefferFuer(t, s);
    return {
      playerId: `${TEAMS[t % 8]}${s}`,
      name: SPIELER[(t + s) % SPIELER.length]!,
      pp: Number((1.2 + ((t * 7 + s * 3) % 10) / 4).toFixed(1)),
      score: 70 + ((t * 5 + s * 9) % 20),
      mutatorPp: null,
      mutatorHits: hits,
      mutatorForm: hits ? hits * 3.5 : null,
      isCaptain: s === 0,
    };
  });

const duell = (t: number) => {
  const g = t % 2 === 0 ? t + 1 : t - 1;
  return { art: "duell" as const, eigen: 74 + ((t * 7) % 13), gegner: 74 + ((g * 7) % 13), gegnerTeamId: TEAMS[g]! };
};
const gruppe = (t: number) => ({
  art: "gruppe" as const,
  platz: (t % 4) + 1,
  wert: 300 + t * 4.3,
  podId: t < 4 ? "p1" : "p2",
  teamIds: t < 4 ? TEAMS.slice(0, 4) : TEAMS.slice(4),
});

const bahn = disziplin === "zeitfahren";
const teamResults = TEAMS.map((id, t) => ({
  teamId: id,
  d1DisciplineId: bahn ? "zeitfahren" : "basketball",
  d1Points: [2, 0, 1, 2, 0, 1, 2, 0][t]!,
  d2DisciplineId: "battlefield",
  d2Points: [1, 2, 0, 2, 1, 0, 2, 1][t]!,
  totalPoints: 3,
  d1Ergebnis: bahn ? gruppe(t) : duell(t),
  d2Ergebnis: gruppe(t),
}));
const standings = TEAMS.map((id, t) => ({
  teamId: id,
  currentRank: t + 1,
  projectedRank: ((t + 3) % 8) + 1,
  currentPoints: 20 - t,
  projectedPoints: 23 - t,
  pointsDelta: 3,
}));

function Wertung() {
  const props = {
    teamResults,
    standings,
    d1: { disciplineId: bahn ? "zeitfahren" : "basketball", displayName: bahn ? "Zeitfahren" : "Basketball" },
    d2: { disciplineId: "battlefield", displayName: "Battlefield" },
    d1Revealed: true,
    d2Revealed: true,
    teamMetaById: meta,
    ownTeamId: "a",
    playersByTeam: new Map(TEAMS.map((id, t) => [id, { d1: spielerListe(t, bahn ? 3 : 5), d2: spielerListe(t + 3, 4) }])),
    humanLabelByTeam: new Map([["a", "Chris"]]),
  };
  return React.createElement(DisciplineStageSpieltagswertung as never, { ...props, anfangsAnsicht: "wertung" } as never);
}

function Ergebnis() {
  const slots = bahn ? 3 : 5;
  const rows: ResultTableRow[] = TEAMS.map((id, t) => ({
    rank: t + 1,
    code: id.toUpperCase().repeat(3),
    name: NAMEN[t]!,
    logoUrl: null,
    isOwn: t === 0,
    teamId: id,
    total: 412 - t * 9.4,
    slots: Array.from({ length: slots }, (_, s) => {
      const hits = trefferFuer(t, s);
      const net = 82 - t * 1.7 - s * 0.9;
      return {
        playerName: SPIELER[(t + s) % SPIELER.length]!,
        playerId: `${id}${s}`,
        net,
        slotRank: ((t + s) % 8) + 1,
        boniMali: 0,
        isBest: t === 0 && s === 1,
        calc: `80 + 3 Form − 1 Fatigue = ${net.toFixed(1)}`,
        pp: Number((1.1 + ((t + s) % 5) / 3).toFixed(1)),
        mutatorHits: hits,
      };
    }),
  }));
  const labels = bahn ? ["Etappe 1", "Etappe 2", "Etappe 3"] : ["Spielmacher", "Flügel", "Center", "Verteidiger", "Joker"];
  return <DisciplineStageResultTable rows={rows} slotLabels={labels} />;
}

createRoot(document.getElementById("wurzel")!).render(
  <div className="is-new-look" style={{ padding: 16, background: "#0b0f17", minHeight: "100vh" }}>{ansicht === "wertung" ? <Wertung /> : <Ergebnis />}</div>,
);

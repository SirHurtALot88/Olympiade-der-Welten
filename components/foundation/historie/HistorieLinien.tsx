"use client";

import { LEAGUE_SIZE } from "@/lib/season/league-split";

export type HistorieLinienSerie = {
  id: string;
  farbe: string;
  dick?: boolean;
  /** Ein Wert je Saison, `null` = Luecke. */
  werte: ReadonlyArray<number | null>;
};

/**
 * Verlaufs-Grafik des Mockups (`linien`): Linien je Team ueber die Saisons. Im Platz-Modus laeuft die Achse
 * von 1 bis 2 × Liga (Liga 2 ab 17) und eine gestrichelte Linie trennt die Ligen; sonst skaliert sie auf die Werte.
 */
export default function HistorieLinien({
  serien,
  platz = false,
  breite = 560,
  hoehe = 600,
  saisonLabels,
  laeuftLetzte = false,
}: {
  serien: readonly HistorieLinienSerie[];
  platz?: boolean;
  breite?: number;
  hoehe?: number;
  saisonLabels: readonly string[];
  laeuftLetzte?: boolean;
}) {
  const n = saisonLabels.length;
  if (n === 0 || serien.length === 0) return null;
  const links = platz ? 62 : 40;
  const rechts = 22;
  const oben = 18;
  const unten = 22;
  let mn = Number.POSITIVE_INFINITY;
  let mx = Number.NEGATIVE_INFINITY;
  for (const serie of serien) {
    for (const wert of serie.werte) {
      if (wert != null) {
        mn = Math.min(mn, wert);
        mx = Math.max(mx, wert);
      }
    }
  }
  if (!Number.isFinite(mn)) return null;
  const gesamt = LEAGUE_SIZE * 2;
  if (platz) {
    mn = 1;
    mx = gesamt;
  } else {
    const polster = (mx - mn) * 0.1 || 1;
    mn -= polster;
    mx += polster;
  }
  const X = (i: number) => (n === 1 ? (links + breite - rechts) / 2 : links + 18 + (i * (breite - links - rechts - 36)) / (n - 1));
  const Y = (wert: number) => {
    let anteil = (wert - mn) / (mx - mn);
    if (!platz) anteil = 1 - anteil;
    return oben + anteil * (hoehe - oben - unten);
  };
  const trenner = (Y(LEAGUE_SIZE) + Y(LEAGUE_SIZE + 1)) / 2;
  const achse: Array<[number, string, string]> = [
    [1, "Liga 1 · 1.", "#f0c35a"],
    [LEAGUE_SIZE, `${LEAGUE_SIZE}.`, ""],
    [LEAGUE_SIZE + 1, "Liga 2 · 1.", "#45B0C9"],
    [gesamt, `${LEAGUE_SIZE}.`, ""],
  ];
  return (
    <svg viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Verlauf über die Saisons">
      {platz ? (
        <>
          <rect x={links} y={oben} width={breite - links - rechts} height={trenner - oben} fill="rgba(240,195,90,.06)" />
          <rect x={links} y={trenner} width={breite - links - rechts} height={hoehe - unten - trenner} fill="rgba(69,176,201,.06)" />
          <line x1={links} x2={breite - rechts} y1={trenner} y2={trenner} stroke="rgba(244,230,196,.35)" strokeDasharray="4 4" />
          {achse.map(([wert, text, farbe]) => (
            <text
              key={wert}
              x={links - 6}
              y={Y(wert) + (wert === LEAGUE_SIZE ? 1 : wert === LEAGUE_SIZE + 1 ? 9 : 4)}
              textAnchor="end"
              style={farbe ? { fill: farbe, fontWeight: 700 } : undefined}
            >
              {text}
            </text>
          ))}
        </>
      ) : (
        [mn + (mx - mn) * 0.08, (mn + mx) / 2, mx - (mx - mn) * 0.08].map((wert) => (
          <g key={wert}>
            <line x1={links} x2={breite - rechts} y1={Y(wert)} y2={Y(wert)} stroke="rgba(244,230,196,.08)" />
            <text x={links - 6} y={Y(wert) + 4} textAnchor="end">
              {Math.round(wert)}
            </text>
          </g>
        ))
      )}
      {saisonLabels.map((label, i) => (
        <g key={label}>
          <line x1={X(i)} x2={X(i)} y1={oben} y2={hoehe - unten} stroke="rgba(244,230,196,.07)" />
          <text x={X(i)} y={hoehe - 6} textAnchor="middle">
            {label}
            {i === n - 1 && laeuftLetzte ? " läuft" : ""}
          </text>
        </g>
      ))}
      {[...serien].reverse().map((serie) => {
        let pfad = "";
        serie.werte.forEach((wert, i) => {
          if (wert == null) return;
          pfad += `${pfad ? "L" : "M"}${X(i).toFixed(1)} ${Y(wert).toFixed(1)}`;
        });
        return (
          <g key={serie.id}>
            <path
              d={pfad}
              fill="none"
              stroke={serie.farbe}
              strokeWidth={serie.dick ? 3.2 : 1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={serie.dick ? 1 : 0.75}
            />
            {serie.werte.map((wert, i) =>
              wert == null ? null : (
                <g key={i}>
                  <circle
                    cx={X(i)}
                    cy={Y(wert)}
                    r={serie.dick ? 4.5 : 2.6}
                    fill={i === n - 1 && laeuftLetzte ? "#0c1017" : serie.farbe}
                    stroke={serie.farbe}
                    strokeWidth={2}
                  />
                  {serie.dick ? (
                    <text x={X(i)} y={Y(wert) - 9} textAnchor="middle" style={{ fill: "#fff", fontWeight: 700, fontSize: 13 }}>
                      {platz ? `${wert > LEAGUE_SIZE ? wert - LEAGUE_SIZE : wert}.` : Math.round(wert).toLocaleString("de-DE")}
                    </text>
                  ) : null}
                </g>
              ),
            )}
          </g>
        );
      })}
    </svg>
  );
}

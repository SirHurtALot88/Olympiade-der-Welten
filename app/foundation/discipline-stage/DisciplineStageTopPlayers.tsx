"use client";

import PlayerStarFrame from "@/components/foundation/player-portrait-card/PlayerStarFrame";
import { getPlayerStarTier } from "@/lib/foundation/player-star-tier";

import { fmt1 } from "./stage-format";

export type DisciplineStageTopPlayer = {
  rank: number;
  name: string;
  teamCode: string;
  logoUrl: string | null;
  portraitUrl: string | null;
  score: number;
  /**
   * GESAMTE gutgeschriebene Player-Points: Anteil an den Team-Punkten PLUS
   * Mutator-Aufschlag — dieselbe Zahl, die der Saison-Ledger bucht (siehe
   * `resolveAwardedPlayerPoints`). Nicht `pointsAwarded` allein.
   */
  points: number | null;
  /** Darin ENTHALTENER Mutator-Aufschlag, nur zur Aufschluesselung. */
  mutatorPoints: number | null;
  isMvp: boolean;
  isOwn: boolean;
  /** Ligaweiter OVR-Rang — einzige Grundlage des Star-Tier-Rahmens, NICHT `rank` (der PP-Rang dieser Liste). */
  ovrRank: number | null;
};

export type DisciplineStageTopPlayersProps = {
  players: DisciplineStageTopPlayer[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  playerIdByRow?: (string | null)[];
  /**
   * Namen der Disziplinen, die in dieser Liste STECKEN (aufgedeckte Seiten des Spieltags).
   * Steht in der Ueberschrift, weil die Zahl daneben eine SUMME ueber genau diese Disziplinen
   * ist — ohne die Namen laesst sich einer summierten Zahl nicht ansehen, worueber summiert
   * wurde. Genau das war Chris' wiederkehrende Frage („zeigt noch immer 1 Diszi").
   */
  disciplineNames?: readonly string[] | null;
};

export default function DisciplineStageTopPlayers({ players, onOpenPlayer, playerIdByRow, disciplineNames }: DisciplineStageTopPlayersProps) {
  const disziplinen = (disciplineNames ?? []).filter((name) => name.trim().length > 0);
  return (
    <div style={{ background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 12, position: "sticky", top: 12 }}>
      <div
        data-testid="stage-top-players-heading"
        data-disciplines={disziplinen.join(" + ")}
        style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 8 }}
      >
        Top-Spieler · Player-Points des Spieltags
        {disziplinen.length > 0 ? ` · ${disziplinen.join(" + ")}` : ""}
      </div>
      {players.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--nl-mut)", fontStyle: "italic" }}>Noch keine Werte.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {players.map((p, index) => {
            const playerId = playerIdByRow?.[index] ?? null;
            const clickable = Boolean(onOpenPlayer && playerId);
            return (
              <div
                key={`${p.rank}-${p.name}-${p.teamCode}`}
                data-testid="stage-top-player-row"
                data-player-points={p.points == null ? "" : String(p.points)}
                onClick={clickable ? () => onOpenPlayer!(playerId!) : undefined}
                title={clickable ? "Spieler-Karte öffnen" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 6px",
                  borderRadius: 8,
                  fontVariantNumeric: "tabular-nums",
                  cursor: clickable ? "pointer" : "default",
                  background: p.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : "transparent",
                  border: p.isOwn ? "1px solid var(--nl-accent)" : "1px solid transparent",
                }}
              >
                <span style={{ width: 20, textAlign: "right", fontWeight: 800, color: "var(--nl-mut)", fontSize: 12.5 }}>{p.rank}</span>
                <PlayerStarFrame tier={getPlayerStarTier(p.ovrRank)} shape="circle" size="sm">
                  {p.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.portraitUrl} alt="" width={24} height={24} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flex: "none", border: "1px solid var(--nl-line)" }} />
                  ) : (
                    <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flex: "none", background: "var(--nl-bg)", border: "1px solid var(--nl-line)" }} />
                  )}
                </PlayerStarFrame>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.isMvp ? "⭐ " : ""}
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--nl-mut)", display: "flex", alignItems: "center", gap: 4 }}>
                    {p.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logoUrl} alt="" width={12} height={12} style={{ width: 12, height: 12, borderRadius: 3, objectFit: "cover", flex: "none" }} />
                    ) : null}
                    {p.teamCode}
                  </div>
                </div>
                {/*
                  NUR DIE PP — GEWÜNSCHT VON CHRIS: „bei den top players brauch ich gar nicht die
                  scores, sondern nur die PPs die sie in beiden Diszis gesammelt haben".
                  Der Score stand hier als zweite Zeile („(Score 142,8)") und war die groessere,
                  auffaelligere Zahl, obwohl er in dieser Liste nichts entscheidet: sortiert wird
                  nach PP, gebucht werden PP. Er bleibt weiterhin auf der Spielerkarte und in der
                  Spieltags-Wertung — hier ist er weg.
                  Ohne gebuchte Punkte steht „—" statt eines Ersatzwertes: eine Zahl, die dann der
                  Score waere, wuerde als PP gelesen.
                */}
                <div style={{ textAlign: "right" }}>
                  {p.points != null ? (
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--nl-accent)" }}>{fmt1(p.points)} PP</div>
                  ) : (
                    <div
                      title="Für diesen Spieler sind noch keine Player-Points gebucht."
                      style={{ fontSize: 14, fontWeight: 800, color: "var(--nl-mut)" }}
                    >
                      — PP
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

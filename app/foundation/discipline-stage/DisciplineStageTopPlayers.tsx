"use client";

export type DisciplineStageTopPlayer = {
  rank: number;
  name: string;
  teamCode: string;
  logoUrl: string | null;
  portraitUrl: string | null;
  score: number;
  points: number | null;
  isMvp: boolean;
  isOwn: boolean;
};

export type DisciplineStageTopPlayersProps = {
  players: DisciplineStageTopPlayer[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  playerIdByRow?: (string | null)[];
};

function fmt1(x: number): string {
  const v = Math.round(x * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function DisciplineStageTopPlayers({ players, onOpenPlayer, playerIdByRow }: DisciplineStageTopPlayersProps) {
  return (
    <div style={{ background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 12, position: "sticky", top: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 8 }}>
        Top-Spieler
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
                {p.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.portraitUrl} alt="" width={24} height={24} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flex: "none", border: "1px solid var(--nl-line)" }} />
                ) : (
                  <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flex: "none", background: "var(--nl-bg)", border: "1px solid var(--nl-line)" }} />
                )}
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
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--nl-accent)" }}>{fmt1(p.score)}</div>
                  {p.points != null ? <div style={{ fontSize: 10.5, color: "var(--nl-mut)" }}>{fmt1(p.points)} PP</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

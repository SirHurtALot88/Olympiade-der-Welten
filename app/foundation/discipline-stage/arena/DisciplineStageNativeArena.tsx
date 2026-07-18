"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Nativer Track-Nachbau der Staffel-Arena (Proof, ersetzt das iframe für Staffel).
// SVG/viewBox → pixelscharf auf jedem DPR, echte Tokens, App-Design-Tokens.
// Position auf dem Oval = kumulierte Punkte. Reveal Slot für Slot, worst-first.

export type NativeStageMod = { k: string; sign: 1 | -1; amt: number };
export type NativeStagePlayer = { val: number; name: string; portraitUrl: string | null; mods: NativeStageMod[] };
export type NativeStageTeam = {
  code: string;
  name: string;
  logoUrl: string | null;
  isOwn: boolean;
  players: NativeStagePlayer[];
};

export type DisciplineStageNativeArenaProps = {
  teams: NativeStageTeam[];
  slots: string[];
  onOpenPlayer?: ((playerId: string) => void) | null;
};

type LiveTeam = {
  idx: number;
  code: string;
  name: string;
  logoUrl: string | null;
  isOwn: boolean;
  players: NativeStagePlayer[];
  score: number;
  prevScore: number;
  thrownSlot: number;
  rank: number;
  roundStartRank: number;
  roundMedal: 0 | 1 | 2 | 3;
  glowUntil: number;
};

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
function fmt1(x: number): string {
  const v = round1(x);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function modSum(p: NativeStagePlayer): number {
  return p.mods.reduce((s, m) => s + m.sign * m.amt, 0);
}
function slotNet(team: NativeStageTeam, round: number): number {
  const p = team.players[round];
  if (!p) return 0;
  return Math.max(0, round1((p.val || 0) + modSum(p)));
}
function hueFor(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i += 1) h = (h * 31 + code.charCodeAt(i)) % 360;
  return h;
}

function rankTeams(teams: LiveTeam[]): void {
  const order = [...teams].sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  order.forEach((t, i) => {
    t.rank = i + 1;
  });
}

// Ampel: 1-3 grün, 4-6 gelb, 7-10 rot, ab 11 neutral
function ampel(rank: number): string {
  if (rank <= 3) return "var(--nl-good)";
  if (rank <= 6) return "var(--nl-warn)";
  if (rank <= 10) return "var(--nl-risk)";
  return "var(--nl-mut)";
}

export default function DisciplineStageNativeArena({ teams, slots }: DisciplineStageNativeArenaProps) {
  const slotCount = Math.max(1, slots.length);

  const initial = useMemo<LiveTeam[]>(() => {
    const live: LiveTeam[] = teams.map((t, idx) => ({
      idx,
      code: t.code,
      name: t.name,
      logoUrl: t.logoUrl,
      isOwn: t.isOwn,
      players: t.players,
      score: 0,
      prevScore: 0,
      thrownSlot: -1,
      rank: idx + 1,
      roundStartRank: idx + 1,
      roundMedal: 0,
      glowUntil: 0,
    }));
    rankTeams(live);
    return live;
  }, [teams]);

  const [live, setLive] = useState<LiveTeam[]>(initial);
  const [round, setRound] = useState(0); // nächste aufzudeckende Runde
  const [busy, setBusy] = useState(false);
  const [spotlight, setSpotlight] = useState<{ name: string; code: string; net: number; leg: string; isOwn: boolean; portraitUrl: string | null } | null>(null);
  const timers = useRef<number[]>([]);

  const reset = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setLive(initial.map((t) => ({ ...t })));
    setRound(0);
    setBusy(false);
    setSpotlight(null);
  }, [initial]);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const done = round >= slotCount;

  // Eine Runde aufdecken: alle Teams worst-first, mit kleinem Cascade-Delay.
  const advance = useCallback(() => {
    if (busy || done) return;
    const r = round;
    setBusy(true);
    setLive((prev) => prev.map((t) => ({ ...t, roundStartRank: t.rank, roundMedal: 0 })));

    // Reihenfolge: schlechteste zuerst (bestes Team = Höhepunkt zuletzt).
    const order = [...live].sort((a, b) => b.rank - a.rank).map((t) => t.idx);
    let best: { net: number; name: string; code: string; isOwn: boolean; portraitUrl: string | null } | null = null;

    order.forEach((teamIdx, i) => {
      const id = window.setTimeout(() => {
        setLive((prev) => {
          const next = prev.map((t) => ({ ...t }));
          const t = next.find((x) => x.idx === teamIdx);
          if (t) {
            const net = slotNet({ code: t.code, name: t.name, logoUrl: t.logoUrl, isOwn: t.isOwn, players: t.players }, r);
            t.prevScore = t.score;
            t.score = round1(t.score + net);
            t.thrownSlot = r;
            if (t.isOwn || (best && best.name)) t.glowUntil = Date.now() + 1400;
            const player = t.players[r];
            if (!best || net > best.net) {
              best = { net, name: player?.name ?? "—", code: t.code, isOwn: t.isOwn, portraitUrl: player?.portraitUrl ?? null };
            }
          }
          rankTeams(next);
          // Runden-Medaillen: echte Top-3 der Runde (Slot-Netto), nur auf aufgedeckte.
          const revealed = next.filter((x) => x.thrownSlot === r);
          const ranked = [...next]
            .map((x) => ({ x, net: slotNet({ code: x.code, name: x.name, logoUrl: x.logoUrl, isOwn: x.isOwn, players: x.players }, r) }))
            .sort((a, b) => b.net - a.net || a.x.code.localeCompare(b.x.code));
          next.forEach((x) => (x.roundMedal = 0));
          ranked.slice(0, 3).forEach((o, mi) => {
            if (o.x.thrownSlot === r) o.x.roundMedal = (mi + 1) as 1 | 2 | 3;
          });
          void revealed;
          return next;
        });
      }, i * 90);
      timers.current.push(id);
    });

    const endId = window.setTimeout(() => {
      if (best) {
        setSpotlight({ name: best.name, code: best.code, net: best.net, leg: slots[r] ?? `Slot ${r + 1}`, isOwn: best.isOwn, portraitUrl: best.portraitUrl });
      }
      setRound(r + 1);
      setBusy(false);
    }, order.length * 90 + 120);
    timers.current.push(endId);
  }, [busy, done, round, live, slots]);

  const quickSim = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setLive((prev) => {
      let next = prev.map((t) => ({ ...t }));
      for (let r = 0; r < slotCount; r += 1) {
        next.forEach((t) => {
          const net = slotNet({ code: t.code, name: t.name, logoUrl: t.logoUrl, isOwn: t.isOwn, players: t.players }, r);
          t.score = round1(t.score + net);
          t.thrownSlot = r;
        });
      }
      rankTeams(next);
      return next;
    });
    setRound(slotCount);
    setBusy(false);
    setSpotlight(null);
  }, [slotCount]);

  const maxScore = Math.max(1, ...live.map((t) => t.score));
  const minScore = Math.min(...live.map((t) => t.score));

  // Oval-Pfad: Länge messen, Tokens per getPointAtLength platzieren.
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  useLayoutEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
  }, []);

  const W = 1180;
  const H = 620;
  const ovalPath = useMemo(() => {
    const m = 70;
    const x0 = m;
    const y0 = m;
    const x1 = W - m;
    const y1 = H - m;
    const r = (y1 - y0) / 2;
    // Stadion: obere Gerade → rechter Halbkreis → untere Gerade → linker Halbkreis
    return `M ${x0 + r} ${y0} L ${x1 - r} ${y0} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} L ${x0 + r} ${y1} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`;
  }, []);

  const sorted = useMemo(() => [...live].sort((a, b) => a.rank - b.rank), [live]);

  function tokenPos(score: number): { x: number; y: number } {
    if (!pathRef.current || pathLen === 0) return { x: W / 2, y: 70 };
    // Feld über das Oval spreizen: Letzter am Start (~6%), Führender vorn (~92%).
    // Sonst kleben die Tokens bei eng beieinander liegenden Summen zusammen.
    const span = maxScore - minScore;
    const norm = span > 0 ? (score - minScore) / span : 0;
    const frac = 0.06 + norm * 0.86;
    const pt = pathRef.current.getPointAtLength(frac * pathLen);
    return { x: pt.x, y: pt.y };
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 640px", minWidth: 0, maxWidth: 1240 }}>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={advance}
            disabled={done}
            style={{ padding: "9px 18px", fontWeight: 800, fontSize: 13, border: 0, borderRadius: 10, cursor: done ? "default" : "pointer", color: "var(--nl-ink)", background: done ? "var(--nl-line)" : "var(--nl-accent)" }}
          >
            {done ? "✔ Disziplin gewertet" : `▶ Etappe ${round + 1} / ${slotCount} — ${slots[round] ?? ""}`}
          </button>
          <button type="button" onClick={quickSim} style={{ padding: "9px 14px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}>
            ⏩ Quick-Sim
          </button>
          <button type="button" onClick={reset} style={{ padding: "9px 14px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}>
            ↻ Neu
          </button>
          <span style={{ fontSize: 12.5, color: "var(--nl-mut)" }}>Position auf dem Oval = kumulierte Punkte</span>
        </div>

        {spotlight ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", marginBottom: 10, borderRadius: 12, border: "1.5px solid var(--nl-warn)", background: "color-mix(in srgb, var(--nl-warn) 12%, transparent)" }}>
            {spotlight.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spotlight.portraitUrl} alt="" width={34} height={34} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--nl-warn)" }} />
            ) : (
              <span aria-hidden style={{ fontSize: 22 }}>🌟</span>
            )}
            <div style={{ fontSize: 13.5 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: "var(--nl-warn)" }}>Bestwert · {spotlight.leg}</span>
              <div style={{ fontWeight: 800 }}>
                {spotlight.name} <span style={{ opacity: 0.8, fontWeight: 600 }}>· {spotlight.code}</span> <span style={{ color: "var(--nl-accent)" }}>+{fmt1(spotlight.net)}</span>
                {spotlight.isOwn ? <span style={{ color: "var(--nl-warn)" }}> · dein Team!</span> : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Oval-Track (SVG) */}
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--nl-line)", background: "var(--nl-bg)" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            <defs>
              {live.map((t) =>
                t.logoUrl ? (
                  <clipPath key={`clip-${t.code}`} id={`clip-${t.code}`}>
                    <circle cx={0} cy={0} r={t.isOwn ? 20 : 13} />
                  </clipPath>
                ) : null,
              )}
            </defs>
            {/* Bahn */}
            <path d={ovalPath} fill="none" stroke="var(--nl-panel)" strokeWidth={54} />
            <path ref={pathRef} d={ovalPath} fill="none" stroke="var(--nl-line)" strokeWidth={2} strokeDasharray="6 8" />
            {/* Tokens */}
            {sorted
              .slice()
              .reverse()
              .map((t) => {
                const pos = tokenPos(t.score);
                const r = t.isOwn ? 20 : 13;
                const hue = t.isOwn ? 28 : hueFor(t.code);
                const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
                return (
                  <g key={t.code} transform={`translate(${pos.x} ${pos.y})`} style={{ transition: "transform .6s cubic-bezier(.34,1.2,.4,1)" }}>
                    {t.glowUntil > Date.now() ? <circle r={r + 7} fill="none" stroke="var(--nl-warn)" strokeWidth={3} opacity={0.6} /> : null}
                    {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4 : 3} /> : null}
                    {t.logoUrl ? (
                      <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#clip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
                    ) : (
                      <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
                    )}
                    <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"} strokeWidth={t.isOwn ? 2.5 : 1.4} />
                    {t.isOwn ? <text y={r + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--nl-accent)">★ {t.code}</text> : null}
                  </g>
                );
              })}
          </svg>
        </div>
      </div>

      {/* Live-Ladder rechts */}
      <div style={{ flex: "0 0 300px", minWidth: 260, maxHeight: "calc(100vh - 200px)", overflowY: "auto", background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 8 }}>Rundenstand — live</div>
        {sorted.map((t) => (
          <div
            key={t.code}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 8, fontVariantNumeric: "tabular-nums", background: t.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : "transparent" }}
          >
            <span style={{ width: 22, textAlign: "right", fontWeight: 800, color: ampel(t.rank), fontSize: 12.5 }}>{t.rank}</span>
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt="" width={16} height={16} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flex: "none" }} />
            ) : (
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, flex: "none", background: `hsl(${hueFor(t.code)} 60% 52%)` }} />
            )}
            <span style={{ width: 44, fontWeight: 800, color: t.isOwn ? "var(--nl-accent)" : "inherit", fontSize: 12.5 }}>{t.code}</span>
            <span style={{ flex: 1, fontSize: 11.5, color: "var(--nl-mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
            <span style={{ fontWeight: 800, fontSize: 12.5 }}>{fmt1(t.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

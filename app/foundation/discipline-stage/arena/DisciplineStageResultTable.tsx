"use client";

import { fmt1, ampel } from "../stage-format";
import TeamMark from "./TeamMark";

// Detail-Ergebnistabelle nach dem Podest: pro Team eine Zeile, pro Slot eine
// Spalte (Spieler + Netto, farbcodiert, Slot-Bestwert markiert), plus Gesamt.
// Sortiert nach finalem Rang, eigenes Team hervorgehoben, horizontal scrollbar,
// sticky Kopf + Team-Spalte. (Fable-Spec End-Screen B.)

export type ResultSlotCell = {
  playerName: string;
  playerId?: string | null; // für Klick → Spieler-Drawer
  net: number;
  slotRank: number;
  boniMali: number; // Σ mods (Vorzeichen entscheidet Farbe)
  isBest: boolean; // höchstes Netto dieser Slot-Spalte
  calc: string; // "80 + 6 Mutator − 4 Fatigue = 82" (title/tooltip)
};
export type ResultTableRow = {
  rank: number;
  code: string;
  name: string;
  logoUrl: string | null;
  isOwn: boolean;
  total: number;
  slots: ResultSlotCell[];
};

export type DisciplineStageResultTableProps = {
  rows: ResultTableRow[];
  slotLabels: string[];
  onOpenPlayer?: ((playerId: string) => void) | null;
};

const HEAD: React.CSSProperties = {
  padding: "8px 10px",
  color: "var(--nl-mut)",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontWeight: 800,
  position: "sticky",
  top: 0,
  background: "var(--nl-panel)",
  zIndex: 3,
  borderBottom: "1px solid var(--nl-line)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

export default function DisciplineStageResultTable({ rows, slotLabels, onOpenPlayer }: DisciplineStageResultTableProps) {
  // Kumulierte Rang-Entwicklung je Etappe: für jede Spalte die Teams nach kumulierter Summe
  // BIS DAHIN ranken → Δ zur Vorspalte = in DIESER Etappe gewonnene/verlorene Ränge. Die
  // 1. Etappe hat keinen Vorwert (kein Pfeil). Ersetzt den alten boni/mali-▼ (der durch
  // Fatigue fast überall negativ war und keine Rang-Aussage hatte).
  const nSlots = slotLabels.length;
  const cumRank: number[][] = rows.map(() => new Array(nSlots).fill(0));
  {
    const cum = rows.map((r) => {
      const arr: number[] = [];
      let s = 0;
      for (let k = 0; k < nSlots; k += 1) {
        s += r.slots[k]?.net ?? 0;
        arr.push(s);
      }
      return arr;
    });
    for (let k = 0; k < nSlots; k += 1) {
      const ord = rows.map((_, i) => i).sort((a, b) => (cum[b]?.[k] ?? 0) - (cum[a]?.[k] ?? 0));
      ord.forEach((rowI, pos) => {
        cumRank[rowI]![k] = pos + 1;
      });
    }
  }
  return (
    <div
      data-oly-result
      style={{ background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 12, animation: "olyFadeSlideIn .5s ease" }}
    >
      <style>{`@keyframes olyFadeSlideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion: reduce){[data-oly-result]{animation:none!important}}`}</style>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800 }}>
          Detail-Ergebnis
        </span>
        <span style={{ fontSize: 12.5, color: "var(--nl-mut)" }}>Netto je Etappe · Slot-Rang farbcodiert · ★ = Etappenbester · Gesamt = Summe</span>
      </div>
      <div style={{ overflowX: "auto", overscrollBehaviorX: "contain", maxHeight: "min(62vh, 640px)", overflowY: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...HEAD, textAlign: "center", left: 0, zIndex: 4, width: 40 }}>#</th>
              <th style={{ ...HEAD, left: 40, zIndex: 4, minWidth: 170 }}>Team</th>
              {slotLabels.map((lbl, i) => (
                <th key={i} style={{ ...HEAD, minWidth: 92, textAlign: "right" }}>
                  {lbl}
                </th>
              ))}
              <th style={{ ...HEAD, minWidth: 72, textAlign: "right" }}>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => {
              const stickyBg = r.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, var(--nl-panel))" : "var(--nl-panel)";
              const rowBg = r.isOwn
                ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)"
                : ri % 2
                  ? "color-mix(in srgb, var(--nl-line) 25%, transparent)"
                  : "transparent";
              return (
                <tr
                  key={r.code}
                  style={{
                    background: rowBg,
                    boxShadow: r.isOwn ? "inset 3px 0 0 var(--nl-accent)" : undefined,
                    borderBottom: "1px solid color-mix(in srgb, var(--nl-line) 50%, transparent)",
                  }}
                >
                  <td style={{ padding: "6px 8px", textAlign: "center", position: "sticky", left: 0, background: stickyBg, fontWeight: 800, color: ampel(r.rank), zIndex: 1 }}>{r.rank}</td>
                  <td style={{ padding: "6px 8px", position: "sticky", left: 40, background: stickyBg, zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {r.logoUrl ? <TeamMark src={r.logoUrl} size={26} radius={6} isOwn={r.isOwn} medal={r.rank === 1 ? "gold" : r.rank === 2 ? "silver" : r.rank === 3 ? "bronze" : null} /> : null}
                      <span style={{ fontWeight: 800, fontSize: 12.5, color: r.isOwn ? "var(--nl-accent)" : "inherit" }}>{r.isOwn ? "★ " : ""}{r.code}</span>
                      <span style={{ color: "var(--nl-mut)", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{r.name}</span>
                    </div>
                  </td>
                  {r.slots.map((c, ci) => {
                    const nameClickable = Boolean(onOpenPlayer && c.playerId);
                    return (
                      <td key={ci} title={c.calc} style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 800, color: "var(--nl-ink)" }}>
                          {c.isBest ? <span style={{ color: "var(--nl-warn)" }}>★ </span> : null}
                          <span style={{ fontSize: 11, fontWeight: 800, color: ampel(c.slotRank), marginRight: 5 }}>#{c.slotRank}</span>
                          {/* Netto NEUTRAL (ink): früher nach Mod-Vorzeichen gefärbt → durch Fatigue
                              fast überall rot, wirkte als wären alle Werte schlecht. Farbcodierung
                              trägt der Slot-Rang (#N, ampel). Bonus/Malus steckt weiter im Tooltip (calc). */}
                          {fmt1(c.net)}
                          {/* Rang-Δ dieser Etappe: wie viele Ränge das Team seit der Vorrunde
                              gut-/schlechtgemacht hat. 1. Etappe = kein Vorwert → kein Pfeil. */}
                          {(() => {
                            if (ci === 0) return null;
                            const d = (cumRank[ri]?.[ci - 1] ?? 0) - (cumRank[ri]?.[ci] ?? 0);
                            if (d === 0) return null;
                            return d > 0 ? (
                              <span style={{ color: "var(--nl-good)", fontSize: 10, marginLeft: 4, fontWeight: 800 }}>▲{d}</span>
                            ) : (
                              <span style={{ color: "var(--nl-risk)", fontSize: 10, marginLeft: 4, fontWeight: 800 }}>▼{-d}</span>
                            );
                          })()}
                        </div>
                        <div
                          onClick={nameClickable ? () => onOpenPlayer!(c.playerId!) : undefined}
                          title={nameClickable ? "Spieler-Karte öffnen" : undefined}
                          style={{ fontSize: 10.5, color: nameClickable ? "var(--nl-ink)" : "var(--nl-mut)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110, cursor: nameClickable ? "pointer" : "default", textDecoration: nameClickable ? "underline dotted" : undefined }}
                        >
                          {c.playerName}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800, color: "var(--nl-accent)", fontSize: 14 }}>{fmt1(r.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

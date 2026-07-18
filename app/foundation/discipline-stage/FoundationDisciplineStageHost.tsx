"use client";

import { useEffect, useMemo, useState } from "react";

import { useFoundationGameState, useFoundationState } from "@/lib/foundation/foundation-state-context";
import {
  buildDisciplineStageModel,
  partialTotal,
  type DisciplineStageTeam,
} from "@/lib/foundation/discipline-stage/discipline-stage-data";

function hueFor(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i += 1) {
    h = (h * 31 + code.charCodeAt(i)) % 360;
  }
  return h;
}

export default function FoundationDisciplineStageHost() {
  const gameState = useFoundationGameState();
  const { selectedTeamId, activeManagerTeamId } = useFoundationState();
  const ownTeamId = activeManagerTeamId ?? selectedTeamId ?? null;

  const disciplines = useMemo(() => {
    // Bootstrap-/Teil-State: disciplines kann im Ladefenster (noch) fehlen.
    return [...(gameState?.disciplines ?? [])].sort(
      (a, b) => (a.displayOrder ?? a.originalOrder ?? 0) - (b.displayOrder ?? b.originalOrder ?? 0),
    );
  }, [gameState?.disciplines]);

  const defaultDisciplineId = useMemo(() => {
    if (disciplines.some((d) => d.id === "staffel")) {
      return "staffel";
    }
    return disciplines[0]?.id ?? "staffel";
  }, [disciplines]);

  const [disciplineId, setDisciplineId] = useState<string>(defaultDisciplineId);
  const [revealedSlots, setRevealedSlots] = useState<number>(0);

  const model = useMemo(
    () => buildDisciplineStageModel(gameState, disciplineId, ownTeamId),
    [gameState, disciplineId, ownTeamId],
  );

  // Beim Disziplinwechsel den Reveal zurücksetzen.
  useEffect(() => {
    setRevealedSlots(0);
  }, [disciplineId]);

  const rows = useMemo(() => {
    const withShown = model.teams.map((team) => ({ team, shown: partialTotal(team, revealedSlots) }));
    withShown.sort((a, b) => b.shown - a.shown || (a.team.shortCode ?? "").localeCompare(b.team.shortCode ?? ""));
    return withShown;
  }, [model.teams, revealedSlots]);

  const maxShown = rows.reduce((max, row) => Math.max(max, row.shown), 0);
  const ownRowIndex = rows.findIndex((row) => row.team.isOwn);
  const ownTeam: DisciplineStageTeam | undefined = model.teams.find((team) => team.isOwn);

  const done = revealedSlots >= model.slotCount;

  // Mini-Spotlight: bester Netto-Wert des zuletzt aufgedeckten Slots über ALLE Teams (auch KI).
  const spotlight = useMemo(() => {
    if (revealedSlots <= 0) {
      return null;
    }
    const slotIdx = revealedSlots - 1;
    let best: { playerName: string; shortCode: string; net: number; isOwn: boolean; portraitUrl: string | null } | null = null;
    for (const team of model.teams) {
      const slot = team.slots[slotIdx];
      if (!slot) {
        continue;
      }
      if (!best || slot.net > best.net) {
        best = { playerName: slot.playerName, shortCode: team.shortCode, net: slot.net, isOwn: team.isOwn, portraitUrl: slot.portraitUrl };
      }
    }
    return best;
  }, [model.teams, revealedSlots]);

  const panel: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 16,
  };

  // Bootstrap-/Teil-State: noch keine Disziplinen geladen → freundlicher Hinweis statt Crash/Leerlauf.
  if (disciplines.length === 0) {
    return (
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 40, textAlign: "center", opacity: 0.75 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Disziplin-Bühne</div>
        <div style={{ fontSize: 14 }}>
          Daten werden geladen … Falls dieser Hinweis bleibt, ist noch keine Saison mit Disziplinen aktiv.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: 20, color: "inherit" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7, fontWeight: 800 }}>
            Disziplin-Bühne · echte Save-Werte
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800 }}>{model.disciplineName}</h1>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4, maxWidth: 640 }}>
            Alle {model.teams.length} Teams mit den echten Top-{model.slotCount}-Spielern nach Disziplin-Wert.
            Netto pro Spieler = Wert − echtes Fatigue + Form (Tagesform). Klick deckt Slot für Slot auf, die
            Rangliste ordnet sich live.
          </div>
        </div>
        <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ opacity: 0.7, fontWeight: 700 }}>Disziplin</span>
          <select
            value={disciplineId}
            onChange={(event) => setDisciplineId(event.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: 14, fontWeight: 700 }}
          >
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16, ...panel }}>
        <button
          type="button"
          onClick={() => setRevealedSlots((count) => Math.min(count + 1, model.slotCount))}
          disabled={done}
          style={{
            fontWeight: 800,
            fontSize: 14,
            cursor: done ? "default" : "pointer",
            border: 0,
            borderRadius: 10,
            padding: "10px 20px",
            color: "#fff",
            background: done ? "rgba(255,255,255,0.15)" : "linear-gradient(180deg,#f0a35a,#e07a2b)",
          }}
        >
          {done ? "✔ Disziplin gewertet" : `▶ Slot ${revealedSlots + 1} aufdecken`}
        </button>
        <button
          type="button"
          onClick={() => setRevealedSlots(0)}
          style={{ fontWeight: 700, fontSize: 13, cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", borderRadius: 10, padding: "9px 15px" }}
        >
          ↻ Neu
        </button>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Slot <b>{revealedSlots}</b> / {model.slotCount}
        </div>
        {ownRowIndex >= 0 ? (
          <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800 }}>
            Dein Team: <span style={{ color: "#f0a35a" }}>Rang {ownRowIndex + 1}</span> / {rows.length}
          </div>
        ) : null}
      </div>

      {spotlight ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1.5px solid #e8c04a",
            background: "linear-gradient(90deg, rgba(232,192,74,0.18), rgba(232,192,74,0.04))",
          }}
        >
          {spotlight.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={spotlight.portraitUrl} alt="" width={34} height={34} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #e8c04a" }} />
          ) : (
            <span aria-hidden style={{ fontSize: 22 }}>🌟</span>
          )}
          <div style={{ fontSize: 13.5 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: "#e8c04a" }}>
              Spotlight · Slot {revealedSlots}
            </span>
            <div style={{ fontWeight: 800 }}>
              {spotlight.playerName}{" "}
              <span style={{ opacity: 0.8, fontWeight: 600 }}>· {spotlight.shortCode}</span>{" "}
              <span style={{ color: "#f0a35a" }}>+{spotlight.net}</span>
              {spotlight.isOwn ? <span style={{ color: "#e8c04a" }}> · dein Team!</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ ...panel, padding: 10 }}>
        {rows.map((row, index) => {
          const width = maxShown > 0 ? (row.shown / maxShown) * 100 : 0;
          const hue = row.team.isOwn ? 28 : hueFor(row.team.shortCode);
          return (
            <div
              key={row.team.teamId}
              title={`${row.team.name} — ${Math.round(row.shown)} Pkt`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "5px 8px",
                borderRadius: 8,
                background: row.team.isOwn ? "rgba(224,122,43,0.16)" : "transparent",
              }}
            >
              <span style={{ width: 24, textAlign: "right", fontWeight: 800, opacity: 0.8, fontVariantNumeric: "tabular-nums" }}>{index + 1}</span>
              {row.team.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.team.logoUrl}
                  alt=""
                  width={18}
                  height={18}
                  style={{ width: 18, height: 18, borderRadius: 4, flex: "none", objectFit: "cover", border: row.team.isOwn ? "2px solid #fff" : "none" }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{ width: 14, height: 14, borderRadius: "50%", flex: "none", background: `hsl(${hue} 60% 55%)`, border: row.team.isOwn ? "2px solid #fff" : "none" }}
                />
              )}
              <span style={{ width: 44, fontWeight: 800, color: row.team.isOwn ? "#f0a35a" : "inherit" }}>{row.team.shortCode}</span>
              <span style={{ flex: "0 0 180px", fontSize: 12.5, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.team.name}</span>
              <div style={{ flex: 1, height: 12, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${width}%`, background: `hsl(${hue} 60% 52%)`, borderRadius: 99, transition: "width .45s cubic-bezier(.34,1.2,.4,1)" }} />
              </div>
              <span style={{ width: 56, textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{Math.round(row.shown)}</span>
            </div>
          );
        })}
      </div>

      {ownTeam ? (
        <div style={{ ...panel, marginTop: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", opacity: 0.7, fontWeight: 800, marginBottom: 8 }}>
            Dein Team · {ownTeam.shortCode} · {ownTeam.name} — warum die Punkte fallen
          </div>
          {ownTeam.slots.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.7, fontStyle: "italic" }}>Keine aufstellbaren Spieler für diese Disziplin.</div>
          ) : (
            ownTeam.slots.map((slot) => {
              const revealed = slot.slotIndex < revealedSlots;
              return (
                <div
                  key={slot.playerId}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", opacity: revealed ? 1 : 0.35, fontVariantNumeric: "tabular-nums" }}
                >
                  <span style={{ width: 20, fontWeight: 800, opacity: 0.7 }}>{slot.slotIndex + 1}</span>
                  {slot.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slot.portraitUrl} alt="" width={24} height={24} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flex: "none", opacity: revealed ? 1 : 0.5 }} />
                  ) : (
                    <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flex: "none", background: "rgba(255,255,255,0.12)" }} />
                  )}
                  <span style={{ fontWeight: 700, flex: "0 0 140px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{slot.playerName}</span>
                  {revealed ? (
                    <span style={{ fontSize: 12.5, opacity: 0.9 }}>
                      <b>{slot.base}</b>
                      {slot.fatiguePenalty > 0 ? <span style={{ color: "#e2564a" }}> − {slot.fatiguePenalty} Fatigue</span> : null}
                      {slot.formSwing !== 0 ? (
                        <span style={{ color: slot.formSwing > 0 ? "#3fbf6f" : "#e2564a" }}>
                          {" "}
                          {slot.formSwing > 0 ? "+" : "−"} {Math.abs(slot.formSwing)} Form
                        </span>
                      ) : null}
                      {" = "}
                      <b style={{ color: "#f0a35a" }}>+{slot.net}</b>
                    </span>
                  ) : (
                    <span style={{ fontSize: 12.5, opacity: 0.6, fontStyle: "italic" }}>noch nicht aufgedeckt</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : null}

      <div style={{ marginTop: 16, fontSize: 11.5, opacity: 0.6, maxWidth: 720 }}>
        Prototyp · additive Disziplin-Bühne. Nutzt die echten Save-Daten (Disziplin-Wert, Fatigue, Form) —
        Captain/Push/Mutatoren folgen, sobald eine echte Aufstellung/ein Spieltag gekoppelt ist. Die bestehende
        Matchday-Arena bleibt unverändert.
      </div>
    </div>
  );
}

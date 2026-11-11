"use client";

import { useState } from "react";

import PlayerPixelSprite from "@/app/foundation/PlayerPixelSprite";
import { getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import { getDisciplineScene } from "@/lib/foundation/discipline-scenes";

/**
 * PIXEL-ARENA über der Disziplin-Bühne: der Hintergrund der laufenden Disziplin plus die eigene
 * Aufstellung als animierte PixelLab-Figuren.
 *
 * KEINE DEMOS MEHR (11.11., Chris: „KEINE DEMOS mehr! das soll nicht einfach abgespult werden!
 * das muss sauber simuliert sein durch unsere engine und das in JEDER disziplin"). Bis hierher
 * spielte dieser Kasten auf Klick eine selbstlaufende Demo-Seite (`public/szenen/…`) mit festen
 * Demo-Figuren ab, und schon das Standbild davor trug diese Figuren eingebrannt — beides ohne jede
 * Verbindung zum Spieltag. Jetzt zeigt er nur noch, was echt ist:
 *  - die saubere Kulisse (`variant.kulisse`, dieselbe Datei, die der Motor in der Battle Arena
 *    zeichnet — ohne Demo-Figuren),
 *  - darauf die echte eigene Aufstellung.
 * Gespielt wird nicht hier: im Battle Mode in der Battle Arena (echter Motor, echte Figuren, s.
 * tests/bahn-climbing-gezeigt-gleich-gebucht.test.ts), sonst auf der Bühne darunter.
 */

const MAX_SCENE_H = 420;
const STORAGE_KEY = "oly-pixel-arena-collapsed";

export type DisciplinePixelSceneProps = {
  disciplineId: string;
  ownTeamName?: string | null;
  ownPlayers?: Array<{ playerId: string | null; name: string }>;
  /** Kompakt (Vor-Anpfiff-Karten): kleinere Figuren, kein Erklärsatz, keine Varianten-Chips. */
  compact?: boolean;
};

export default function DisciplinePixelScene({ disciplineId, ownTeamName, ownPlayers = [], compact = false }: DisciplinePixelSceneProps) {
  const scene = getDisciplineScene(disciplineId);
  const [variantId, setVariantId] = useState<string | null>(null);
  // Die Arena rendert nur client-seitig (FoundationDisciplineStageHost) — der Speicher darf
  // deshalb direkt im Initialwert gelesen werden.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false; // Speicher gesperrt (privates Fenster) — dann einfach offen.
    }
  });
  const [shownDisciplineId, setShownDisciplineId] = useState(disciplineId);

  // Disziplinwechsel: zurück auf die erste Kulisse (Anpassung während des Renderns statt per Effekt).
  if (shownDisciplineId !== disciplineId) {
    setShownDisciplineId(disciplineId);
    setVariantId(null);
  }

  if (!scene) return null;
  // Nur Varianten mit sauberer Kulisse sind wählbar — ein Demo-Standbild ist keine Alternative.
  const kulissen = scene.variants.filter((x) => x.kulisse);
  const variant = kulissen.find((x) => x.id === variantId) ?? kulissen[0] ?? null;

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // egal
      }
      return next;
    });
  };

  const lineup = ownPlayers.filter((p) => p.playerId && getFigurSpriteForPlayer(p.playerId));
  const missing = ownPlayers.filter((p) => p.playerId && !getFigurSpriteForPlayer(p.playerId));
  const maxH = compact ? 200 : MAX_SCENE_H;
  const figurGroesse = compact ? 56 : 80;

  return (
    <section
      data-testid="discipline-pixel-scene"
      data-discipline={disciplineId}
      data-variant={variant?.id ?? ""}
      style={{
        marginBottom: compact ? 10 : 16,
        marginTop: compact ? 8 : 0,
        borderRadius: compact ? 10 : 14,
        border: "1px solid var(--nl-line)",
        background: "var(--nl-panel)",
        overflow: "hidden",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px" }}>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}
        >
          <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800 }}>
            Pixel-Arena
          </span>
          {compact ? null : <strong style={{ fontSize: 15 }}>{scene.title}</strong>}
          <span aria-hidden style={{ fontSize: 11, color: "var(--nl-mut)" }}>{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed && !compact && kulissen.length > 1 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist" aria-label="Arena-Kulisse">
            {kulissen.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={x.id === variant?.id}
                data-testid="pixel-scene-variant"
                onClick={() => setVariantId(x.id)}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  cursor: "pointer",
                  color: x.id === variant?.id ? "var(--nl-accent)" : "inherit",
                  background: x.id === variant?.id ? "color-mix(in srgb, var(--nl-accent) 14%, var(--nl-panel))" : "transparent",
                  border: `1px solid ${x.id === variant?.id ? "color-mix(in srgb, var(--nl-accent) 50%, var(--nl-line))" : "var(--nl-line)"}`,
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {!collapsed ? (
        <>
          <div
            data-testid="pixel-scene-kulisse"
            style={{
              position: "relative",
              width: "100%",
              maxHeight: maxH,
              aspectRatio: variant?.kulisse ? "1240 / 470" : undefined,
              backgroundColor: "var(--nl-bg)",
              backgroundImage: variant?.kulisse ? `url(${variant.kulisse})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              imageRendering: "pixelated",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {lineup.length > 0 ? (
              <div
                data-testid="pixel-scene-lineup"
                aria-label={ownTeamName ? `${ownTeamName} · Einsatz` : "Dein Einsatz"}
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  padding: "10px 10px 6px",
                  width: "100%",
                  background: "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--nl-bg) 70%, transparent) 100%)",
                }}
              >
                {lineup.map((p) => (
                  <div key={p.playerId!} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: compact ? 60 : 84 }}>
                    <PlayerPixelSprite playerId={p.playerId} size={figurGroesse} dir="east" anim="walk" cycleOnClick />
                    <span
                      style={{ fontSize: 11, fontWeight: 700, maxWidth: compact ? 60 : 84, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={p.name}
                    >
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {missing.length > 0 ? (
              <div style={{ fontSize: 11, color: "var(--nl-mut)" }}>Noch ohne Pixel-Figur: {missing.map((p) => p.name).join(", ")}</div>
            ) : null}
            {compact ? null : (
              <div style={{ fontSize: 11.5, color: "var(--nl-mut)" }}>
                {/* `scene.note` beschreibt die alte Demo-Seite (Zeitlupe, Ballphysik …) und bleibt deshalb weg. */}
                Oben die Kulisse und deine Aufstellung — gespielt und gewertet wird unten auf der Bühne.
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import PlayerPixelSprite from "@/app/foundation/PlayerPixelSprite";
import { getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import { getDisciplineScene } from "@/lib/foundation/discipline-scenes";

/**
 * PIXEL-ARENA über der Disziplin-Bühne: die neue Pixel-Art-Szene der laufenden Disziplin
 * (Standbild sofort, die selbstlaufende Szene auf Klick) plus die eigene Aufstellung als
 * animierte PixelLab-Figuren.
 *
 * Die Szenen-Dateien sind eigenständige Demo-Seiten (`public/szenen/…`, Konfiguration in
 * `lib/foundation/discipline-scenes.ts`). Sie tragen neben der Arena Entwickler-Erklärtexte.
 * Statt die Dateien umzuschreiben, zeigt das iframe nur den Arena-Ausschnitt: nach dem Laden
 * wird das größte Bild-/Canvas-Element der Seite gesucht (bzw. sein beschneidender Rahmen)
 * und das iframe so verschoben und skaliert, dass genau dieses Rechteck den Kasten füllt.
 * Das ist dieselbe Regel, mit der die Standbilder erzeugt wurden — Standbild und Szene
 * zeigen deshalb denselben Ausschnitt.
 */

const DEMO_VIEWPORT_W = 1440;
const MAX_SCENE_H = 620;
const STORAGE_KEY = "oly-pixel-arena-collapsed";

type FocusRect = { x: number; y: number; w: number; h: number; docH: number };

function measureFocus(doc: Document): FocusRect | null {
  const win = doc.defaultView;
  if (!win) return null;
  const media = [...doc.querySelectorAll("canvas, img, svg, video")]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter((o) => o.r.width >= 240 && o.r.height >= 120)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
  const el: Element | null =
    media[0]?.el ?? doc.getElementById("viewport") ?? doc.getElementById("stage") ?? doc.querySelector(".stage");
  if (!el) return null;
  let r = el.getBoundingClientRect();
  for (let p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
    const pr = p.getBoundingClientRect();
    if (win.getComputedStyle(p).overflow !== "visible" && pr.width * pr.height < r.width * r.height && pr.width >= 240) {
      r = pr;
      break;
    }
  }
  return {
    x: r.x + win.scrollX,
    y: r.y + win.scrollY,
    w: r.width,
    h: r.height,
    docH: Math.max(doc.documentElement.scrollHeight, r.y + win.scrollY + r.height),
  };
}

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
  const [playing, setPlaying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
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
  const [focus, setFocus] = useState<FocusRect | null>(null);
  const [boxW, setBoxW] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // Disziplinwechsel: zurück aufs Standbild der ersten Variante (Anpassung während des
  // Renderns statt per Effekt — kein Zwischenbild mit der alten Szene).
  if (shownDisciplineId !== disciplineId) {
    setShownDisciplineId(disciplineId);
    setVariantId(null);
    setPlaying(false);
    setFocus(null);
  }

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, [collapsed, scene]);

  const variant = scene ? scene.variants.find((x) => x.id === variantId) ?? scene.variants[0]! : null;

  const onFrameLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const apply = () => {
      const f = measureFocus(doc);
      if (f) setFocus(f);
    };
    apply();
    // Manche Szenen bauen ihr Bild erst nach dem ersten Frame auf.
    window.setTimeout(apply, 700);
  }, []);

  if (!scene || !variant) return null;

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
  // Breite füllen, aber nie höher als MAX_SCENE_H (hohe Szenen wie die Kletterwand werden
  // eingepasst und mittig gesetzt statt die halbe Seite zu belegen).
  const maxH = compact ? 260 : MAX_SCENE_H;
  const scale = focus && boxW > 0 ? Math.min(boxW / focus.w, maxH / focus.h) : 1;
  const sceneH = focus ? Math.round(focus.h * scale) : 0;
  const offsetX = focus && boxW > 0 ? Math.max(0, (boxW - focus.w * scale) / 2) : 0;

  return (
    <section
      data-testid="discipline-pixel-scene"
      data-discipline={disciplineId}
      data-variant={variant.id}
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
        {!collapsed && !compact && scene.variants.length > 1 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist" aria-label="Arena-Variante">
            {scene.variants.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={x.id === variant.id}
                data-testid="pixel-scene-variant"
                onClick={() => {
                  setVariantId(x.id);
                  setFocus(null);
                }}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  cursor: "pointer",
                  color: x.id === variant.id ? "var(--nl-accent)" : "inherit",
                  background: x.id === variant.id ? "color-mix(in srgb, var(--nl-accent) 14%, var(--nl-panel))" : "transparent",
                  border: `1px solid ${x.id === variant.id ? "color-mix(in srgb, var(--nl-accent) 50%, var(--nl-line))" : "var(--nl-line)"}`,
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
        ) : null}
        {!collapsed ? (
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {variant.demo ? (
              <button
                type="button"
                className="secondary-button inline-button"
                data-testid="pixel-scene-play"
                onClick={() => {
                  setPlaying((p) => !p);
                  setFocus(null);
                }}
              >
                {playing ? "■ Standbild" : "▶ Szene abspielen"}
              </button>
            ) : null}
            {playing && variant.demo ? (
              <button
                type="button"
                className="secondary-button inline-button"
                onClick={() => {
                  setFocus(null);
                  setReloadKey((k) => k + 1);
                }}
              >
                ↻ Neu
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {!collapsed ? (
        <>
          <div
            ref={boxRef}
            style={{
              position: "relative",
              width: "100%",
              height: playing && variant.demo ? (focus ? sceneH : Math.round(Math.min(boxW * 0.5625, maxH))) : undefined,
              background: "var(--nl-bg)",
              overflow: "hidden",
              lineHeight: 0,
            }}
          >
            {playing && variant.demo ? (
              <iframe
                key={`${variant.id}-${reloadKey}`}
                ref={frameRef}
                src={variant.demo}
                title={`${scene.title} — Pixel-Szene`}
                onLoad={onFrameLoad}
                scrolling="no"
                data-testid="pixel-scene-frame"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: DEMO_VIEWPORT_W,
                  height: focus ? focus.docH : 1100,
                  border: 0,
                  transformOrigin: "0 0",
                  transform: focus ? `translate(${offsetX}px, 0) scale(${scale}) translate(${-focus.x}px, ${-focus.y}px)` : undefined,
                  opacity: focus ? 1 : 0,
                  transition: "opacity 160ms ease",
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={variant.poster}
                alt={`${scene.title} — ${variant.label}`}
                data-testid="pixel-scene-poster"
                style={{ display: "block", width: "100%", height: "auto", maxHeight: maxH, objectFit: "contain", imageRendering: "pixelated" }}
              />
            )}
          </div>
          <div style={{ padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {lineup.length > 0 ? (
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 4 }}>
                  {ownTeamName ? `${ownTeamName} · Einsatz` : "Dein Einsatz"}
                </div>
                <div
                  data-testid="pixel-scene-lineup"
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    padding: "6px 10px 4px",
                    borderRadius: 10,
                    background: "linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--nl-line) 55%, transparent) 100%)",
                  }}
                >
                  {lineup.map((p) => (
                    <div key={p.playerId!} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: compact ? 60 : 84 }}>
                      <PlayerPixelSprite playerId={p.playerId} size={compact ? 56 : 80} dir="east" anim="walk" cycleOnClick />
                      <span style={{ fontSize: 11, fontWeight: 700, maxWidth: compact ? 60 : 84, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
                {missing.length > 0 ? (
                  <div style={{ fontSize: 11, color: "var(--nl-mut)", marginTop: 4 }}>
                    Noch ohne Pixel-Figur: {missing.map((p) => p.name).join(", ")}
                  </div>
                ) : null}
              </div>
            ) : null}
            {compact ? null : (
              <div style={{ fontSize: 11.5, color: "var(--nl-mut)" }}>
                {scene.note} Die Szene ist eine Vorschau der neuen Arena mit Demo-Figuren — gewertet wird weiter unten auf der Bühne.
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

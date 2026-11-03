"use client";

import { useMemo, useState, type CSSProperties } from "react";

import {
  FIGUR_ANIMATION_LABEL,
  figurAnimation,
  figurAnimationCycle,
  figurPoseUrl,
  figurStripUrl,
  getFigurSpriteForPlayer,
  type FigurAnimationKind,
  type FigurSprite,
} from "@/lib/data/figurenSprites";

/**
 * Die PixelLab-Figur eines Spielers — animiert, pixelgenau, ohne Canvas.
 *
 * Ein Animationsstreifen (`<name>-<dir>.png`, alle Bilder nebeneinander) liegt als
 * Hintergrund im Kasten und wird per CSS-`steps()` durchgeschoben. Das kostet keinen
 * JS-Takt, laeuft in jeder Liste beliebig oft und respektiert `prefers-reduced-motion`
 * (dann steht die Grundpose). West ist Ost gespiegelt — genau wie im PixelLab-Kanon.
 *
 * Kein Sprite fuer den Spieler (noch nicht gebaut)? Dann rendert die Komponente `fallback`
 * (Standard: nichts) — Aufrufer koennen so ohne Sonderfall einbinden.
 */

export type PlayerPixelSpriteProps = {
  playerId?: string | null;
  /** Alternativ direkt eine Figur (z. B. aus der Galerie). */
  sprite?: FigurSprite | null;
  /** Kantenlaenge des Kastens in px. Die Figur wird pixelgenau darauf skaliert. */
  size?: number;
  dir?: "south" | "east" | "west";
  /** Start-Animation; ohne passende Animation steht die Grundpose. `"pose"` = immer stehen. */
  anim?: FigurAnimationKind | "pose";
  /** Bilder pro Sekunde. */
  fps?: number;
  /** Klick wechselt durch Gehen → Aktion → Treffer → K.o. */
  cycleOnClick?: boolean;
  /** Kleines Etikett mit der laufenden Animation unter der Figur. */
  showLabel?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  fallback?: React.ReactNode;
};

export default function PlayerPixelSprite({
  playerId,
  sprite: spriteProp,
  size = 96,
  dir = "south",
  anim = "walk",
  fps = 10,
  cycleOnClick = false,
  showLabel = false,
  title,
  className,
  style,
  fallback = null,
}: PlayerPixelSpriteProps) {
  const sprite = useMemo(() => spriteProp ?? getFigurSpriteForPlayer(playerId), [spriteProp, playerId]);
  const cycle = useMemo(() => (sprite ? figurAnimationCycle(sprite) : []), [sprite]);
  const [cycleIndex, setCycleIndex] = useState<number | null>(null);

  if (!sprite) return <>{fallback}</>;

  const current =
    cycleIndex !== null
      ? cycle[cycleIndex % Math.max(cycle.length, 1)] ?? null
      : anim === "pose"
        ? null
        : figurAnimation(sprite, anim) ?? null;
  const stripDir = dir === "west" ? "east" : dir;
  const mirrored = dir === "west";
  const label = current ? FIGUR_ANIMATION_LABEL[current.kind] : "Pose";
  const canCycle = cycleOnClick && cycle.length > 0;

  const boxStyle: CSSProperties = {
    width: size,
    height: size,
    flex: "none",
    imageRendering: "pixelated",
    backgroundRepeat: "no-repeat",
    transform: mirrored ? "scaleX(-1)" : undefined,
    cursor: canCycle ? "pointer" : undefined,
  };
  if (current && current.frames > 1) {
    boxStyle.backgroundImage = `url(${figurStripUrl(sprite, current, stripDir)})`;
    boxStyle.backgroundSize = `${current.frames * 100}% 100%`;
    boxStyle.animation = `olyFigurStrip ${(current.frames / fps).toFixed(2)}s steps(${current.frames}, jump-none) infinite`;
  } else {
    const poseDir = dir === "west" ? "west" : dir;
    boxStyle.backgroundImage = `url(${figurPoseUrl(sprite, poseDir)})`;
    boxStyle.backgroundSize = "100% 100%";
    boxStyle.transform = undefined;
  }

  const tooltip =
    title ??
    (canCycle ? `Pixel-Figur · ${label} — Klick: nächste Animation` : `Pixel-Figur · ${label}`);

  return (
    <span
      className={["oly-figur-sprite", className].filter(Boolean).join(" ")}
      data-testid="player-pixel-sprite"
      data-figur={sprite.slug}
      data-figur-anim={current?.name ?? "pose"}
      title={tooltip}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, ...style }}
      onClick={
        canCycle
          ? (event) => {
              event.stopPropagation();
              setCycleIndex((prev) => {
                if (prev === null) {
                  const start = current ? cycle.findIndex((a) => a.name === current.name) : -1;
                  return start + 1;
                }
                return prev + 1;
              });
            }
          : undefined
      }
    >
      <span aria-hidden className="oly-figur-sprite-frame" style={boxStyle} />
      {showLabel ? (
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-mut)" }}>
          {label}
        </span>
      ) : null}
    </span>
  );
}

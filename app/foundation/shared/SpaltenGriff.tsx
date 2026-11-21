"use client";

import type { PointerEvent as ReaktPointerEvent } from "react";

import type { SpaltenDef, SpaltenLayout } from "./spalten-layout";

/** Ziehgriff an der rechten Kante eines Spaltenkopfs. Doppelklick = Standardbreite. */
export default function SpaltenGriff({ layout, def }: { layout: SpaltenLayout; def: SpaltenDef }) {
  if (def.fest) return null;
  const start = (e: ReaktPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const ziel = e.currentTarget;
    // Pixel je Einheit u messen (u ist ein CSS-Maß, kein Zahlenwert).
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:calc(10 * var(--u));height:0";
    ziel.parentElement?.appendChild(probe);
    const pxJeU = probe.getBoundingClientRect().width / 10 || 16;
    probe.remove();
    const x0 = e.clientX;
    const w0 = layout.breiten[def.id] ?? def.standard;
    try {
      ziel.setPointerCapture(e.pointerId);
    } catch {
      /* ältere Browser */
    }
    layout.setZiehend(def.id);
    const bewege = (ev: PointerEvent) => layout.setBreite(def.id, w0 + (ev.clientX - x0) / pxJeU);
    const ende = () => {
      ziel.removeEventListener("pointermove", bewege);
      ziel.removeEventListener("pointerup", ende);
      ziel.removeEventListener("pointercancel", ende);
      layout.setZiehend(null);
    };
    ziel.addEventListener("pointermove", bewege);
    ziel.addEventListener("pointerup", ende);
    ziel.addEventListener("pointercancel", ende);
  };
  return (
    <i
      className={`spg${layout.ziehend === def.id ? " an" : ""}`}
      role="separator"
      aria-orientation="vertical"
      title="Ziehen: Spaltenbreite ändern · Doppelklick: Standardbreite"
      data-testid={`spalten-griff-${def.id}`}
      onPointerDown={start}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        layout.setzeStandard(def.id);
      }}
    />
  );
}

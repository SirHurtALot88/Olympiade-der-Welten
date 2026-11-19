"use client";

/**
 * EINE KLICKREGEL für Draft und Transfermarkt (UX-Review 19.11., `docs/design/ux-review-draft-markt-19-11.md`):
 *
 *   Ein Klick wählt aus. Ein Klick auf das Ausgewählte öffnet das Profil.
 *   Wo es nichts auszuwählen gibt (eigener Kader, vergebene Spieler, Ticker), öffnet schon der erste Klick das Profil.
 *   Der Name ist die Abkürzung: wählt aus UND öffnet das Profil. Knöpfe in Zeilen ändern die Auswahl nicht.
 *   Tastatur: ↑/↓ bewegt die Auswahl, Enter öffnet das Profil, Esc schließt. Gepickt/gekauft wird nie per Taste.
 */
import { useEffect, useRef } from "react";

/** Der Kern der Regel: Klick auf das Ausgewählte → Profil, sonst → auswählen. */
export function klickAuswahlOderProfil(id: string, gewaehlt: string | null, waehle: (id: string) => void, profil: (id: string) => void): void {
  if (gewaehlt === id) profil(id);
  else waehle(id);
}

/** Name-Klick: wählt aus (wenn auswählbar) und öffnet das Profil. */
export function nameKlickAuswahlUndProfil(id: string, auswaehlbar: boolean, waehle: (id: string) => void, profil: (id: string) => void): void {
  if (auswaehlbar) waehle(id);
  profil(id);
}

/** Nächste Auswahl bei ↑/↓ in einer Liste. Ohne (oder mit unsichtbarer) Auswahl: ↓ = erste, ↑ = letzte Zeile. Am Rand bleibt sie stehen. */
export function naechsteAuswahl(ids: readonly string[], gewaehlt: string | null, richtung: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const i = gewaehlt ? ids.indexOf(gewaehlt) : -1;
  if (i < 0) return richtung === 1 ? ids[0]! : ids[ids.length - 1]!;
  return ids[Math.max(0, Math.min(ids.length - 1, i + richtung))]!;
}

export type TastenAktion = { art: "auswahl"; id: string } | { art: "profil"; id: string } | null;

/** Reine Entscheidung zu einer Taste (testbar): Tippen in Feldern und Strg/Alt/Meta-Kombinationen zählen nicht. */
export function entscheideTaste(
  e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; targetTag?: string | null; targetEditierbar?: boolean; targetIstKnopf?: boolean },
  ids: readonly string[],
  gewaehlt: string | null,
): TastenAktion {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  const tag = (e.targetTag ?? "").toLowerCase();
  if (e.targetEditierbar || tag === "input" || tag === "textarea" || tag === "select") return null;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const id = naechsteAuswahl(ids, gewaehlt, e.key === "ArrowDown" ? 1 : -1);
    return id ? { art: "auswahl", id } : null;
  }
  // Enter auf einem fokussierten Knopf/Link tut dessen eigene Sache (z. B. „Picken“), nie das Profil dahinter.
  if (e.key === "Enter" && gewaehlt && !e.targetIstKnopf && tag !== "a") return { art: "profil", id: gewaehlt };
  return null;
}

export function useListenTasten({
  ids,
  gewaehlt,
  waehle,
  profil,
  aktiv,
}: {
  ids: readonly string[];
  gewaehlt: string | null;
  waehle: (id: string) => void;
  profil: (id: string) => void;
  /** Aus, solange Profil, Dialog oder Vergleich offen sind. */
  aktiv: boolean;
}): void {
  const ref = useRef({ ids, gewaehlt, waehle, profil });
  useEffect(() => {
    ref.current = { ids, gewaehlt, waehle, profil };
  });
  useEffect(() => {
    if (!aktiv) return;
    function beiTaste(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      // Profil, Verhandlungstisch, Vergleich oder ein anderer Dialog ist offen: die Liste dahinter bleibt still.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      const aktion = entscheideTaste(
        {
          key: e.key,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          targetTag: el?.tagName ?? null,
          targetEditierbar: Boolean(el?.isContentEditable),
          targetIstKnopf: Boolean(el?.closest("button, [role=button]")),
        },
        ref.current.ids,
        ref.current.gewaehlt,
      );
      if (!aktion) return;
      e.preventDefault();
      if (aktion.art === "auswahl") {
        ref.current.waehle(aktion.id);
        // Zeile in Sicht halten.
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(`[data-player-id="${CSS.escape(aktion.id)}"]`)?.scrollIntoView?.({ block: "nearest" });
        });
      } else ref.current.profil(aktion.id);
    }
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [aktiv]);
}

/** Esc schließt einen Dialog (nur solange er offen ist). */
export function useEscSchliesst(offen: boolean, zu: () => void): void {
  const ref = useRef(zu);
  useEffect(() => {
    ref.current = zu;
  });
  useEffect(() => {
    if (!offen) return;
    function beiTaste(e: KeyboardEvent) {
      if (e.key === "Escape") ref.current();
    }
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [offen]);
}

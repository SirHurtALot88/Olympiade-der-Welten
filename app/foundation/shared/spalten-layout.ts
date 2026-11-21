"use client";

/**
 * Spaltenbreiten per Ziehen (Chris 19.11.): gemeinsamer Baustein für Transfermarkt-Liste und Draft-Brett.
 * Breiten stehen in Einheiten `u` (wie das übrige CSS der beiden Seiten), je Liste und Benutzer gespeichert.
 * Der Speicherweg ist localStorage mit Schlüssel je Benutzername (aus /api/auth/session, ohne Login "gast");
 * ein Fehler beim Lesen oder Schreiben fällt still auf die Standardbreiten zurück.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

export type SpaltenDef = {
  id: string;
  standard: number;
  min: number;
  max: number;
  /** Nimmt den Restplatz (1fr); die Breite ist dann die Mindestbreite. */
  flex?: boolean;
  /** Kein Ziehgriff. */
  fest?: boolean;
};

export type SpaltenBreiten = Record<string, number>;

const PRAEFIX = "oly-spalten-v1";

export function spaltenSchluessel(benutzer: string | null | undefined, liste: string): string {
  return `${PRAEFIX}:${(benutzer ?? "").trim() || "gast"}:${liste}`;
}

export function begrenzeBreite(def: SpaltenDef, w: number): number {
  if (!Number.isFinite(w)) return def.standard;
  return Math.round(Math.max(def.min, Math.min(def.max, w)) * 100) / 100;
}

export function standardBreiten(defs: SpaltenDef[]): SpaltenBreiten {
  return Object.fromEntries(defs.map((d) => [d.id, d.standard]));
}

/** Liest gespeicherte Breiten; unbekannte Spalten und Unsinn werden verworfen, Fehlendes bleibt Standard. */
export function ladeBreiten(schluessel: string, defs: SpaltenDef[], speicher?: Pick<Storage, "getItem"> | null): SpaltenBreiten {
  const basis = standardBreiten(defs);
  try {
    const roh = (speicher ?? window.localStorage).getItem(schluessel);
    if (!roh) return basis;
    const obj = JSON.parse(roh) as unknown;
    if (!obj || typeof obj !== "object") return basis;
    for (const d of defs) {
      const v = (obj as Record<string, unknown>)[d.id];
      if (typeof v === "number") basis[d.id] = begrenzeBreite(d, v);
    }
  } catch {
    return standardBreiten(defs);
  }
  return basis;
}

export function speichereBreiten(
  schluessel: string,
  breiten: SpaltenBreiten,
  speicher?: Pick<Storage, "setItem" | "removeItem"> | null,
  defs?: SpaltenDef[],
): void {
  try {
    const ziel = speicher ?? window.localStorage;
    const abweichend = defs ? defs.some((d) => breiten[d.id] !== d.standard) : true;
    if (!abweichend) ziel.removeItem(schluessel);
    else ziel.setItem(schluessel, JSON.stringify(breiten));
  } catch {
    /* Speicher gesperrt: das Layout gilt dann nur für diese Sitzung. */
  }
}

export function gridVorlage(defs: SpaltenDef[], breiten: SpaltenBreiten): string {
  return defs.map((d) => (d.flex ? `minmax(calc(${breiten[d.id]} * var(--u)), 1fr)` : `calc(${breiten[d.id]} * var(--u))`)).join(" ");
}

export function mindestBreiteU(defs: SpaltenDef[], breiten: SpaltenBreiten, luecke = 0.45, rand = 1.2): number {
  return Math.round((defs.reduce((s, d) => s + breiten[d.id], 0) + luecke * (defs.length - 1) + rand) * 100) / 100;
}

/** Zeilenhöhe-Untergrenze (in u) aus der Porträtbreite; unter der Standardbreite 0 (die Zeilen füllen wie bisher). */
export function zeilenMinU(portraitId: string, defs: SpaltenDef[], breiten: SpaltenBreiten): number {
  const d = defs.find((x) => x.id === portraitId);
  if (!d) return 0;
  const w = breiten[portraitId];
  return w > d.standard ? Math.round((w * 1.15 + 0.3) * 100) / 100 : 0;
}

export function useBenutzerName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let aktiv = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { user?: { username?: string } | null } | null) => {
        if (aktiv) setName(j?.user?.username ?? "gast");
      })
      .catch(() => {
        if (aktiv) setName("gast");
      });
    return () => {
      aktiv = false;
    };
  }, []);
  return name;
}

export type SpaltenLayout = {
  breiten: SpaltenBreiten;
  vorlage: string;
  minBreite: number;
  zeilenMin: number;
  angepasst: boolean;
  setBreite: (id: string, w: number) => void;
  setzeStandard: (id: string) => void;
  zuruecksetzen: () => void;
  /** Aktuell gezogene Spalte (für die Markierung des Griffs). */
  ziehend: string | null;
  setZiehend: (id: string | null) => void;
};

export function useSpaltenLayout(liste: string, defs: SpaltenDef[], portraitId = "por"): SpaltenLayout {
  const benutzer = useBenutzerName();
  const [breiten, setBreiten] = useState<SpaltenBreiten>(() => standardBreiten(defs));
  const [ziehend, setZiehend] = useState<string | null>(null);
  const schluessel = benutzer ? spaltenSchluessel(benutzer, liste) : null;

  // Nach dem Laden der Sitzung bzw. beim Benutzerwechsel den gespeicherten Stand holen (nie während des Server-Renders).
  useEffect(() => {
    if (schluessel) setBreiten(ladeBreiten(schluessel, defs));
  }, [schluessel, defs]);

  const schreibe = useCallback(
    (neu: SpaltenBreiten) => {
      if (schluessel) speichereBreiten(schluessel, neu, null, defs);
    },
    [schluessel, defs],
  );

  const setBreite = useCallback(
    (id: string, w: number) => {
      const d = defs.find((x) => x.id === id);
      if (!d) return;
      setBreiten((alt) => ({ ...alt, [id]: begrenzeBreite(d, w) }));
    },
    [defs],
  );
  // Gespeichert wird, wenn das Ziehen endet (ziehend wird null), nicht bei jedem Pixel.
  useEffect(() => {
    if (ziehend === null) schreibe(breiten);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ziehend]);

  const setzeStandard = useCallback(
    (id: string) => {
      const d = defs.find((x) => x.id === id);
      if (!d) return;
      const neu = { ...breiten, [id]: d.standard };
      setBreiten(neu);
      schreibe(neu);
    },
    [defs, breiten, schreibe],
  );
  const zuruecksetzen = useCallback(() => {
    const neu = standardBreiten(defs);
    setBreiten(neu);
    schreibe(neu);
  }, [defs, schreibe]);

  return useMemo(
    () => ({
      breiten,
      vorlage: gridVorlage(defs, breiten),
      minBreite: mindestBreiteU(defs, breiten),
      zeilenMin: zeilenMinU(portraitId, defs, breiten),
      angepasst: defs.some((d) => breiten[d.id] !== d.standard),
      setBreite,
      setzeStandard,
      zuruecksetzen,
      ziehend,
      setZiehend,
    }),
    [breiten, defs, portraitId, setBreite, setzeStandard, zuruecksetzen, ziehend],
  );
}

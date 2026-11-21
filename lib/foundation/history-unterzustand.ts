"use client";

/**
 * UNTERZUSTAENDE IN DER BROWSER-HISTORY (21.11.): Chris — „wenn ich den Zurück-Button an der Maus drücke oder vorwärts, will ich
 * zum vorherigen bzw. nächsten Screen. Wenn ich vom Draft ins Spielerprofil springe, will ich zurück drücken und wieder im Draft
 * landen.“
 *
 * Die Ansichten der Foundation (`setFoundationView`, Spielerprofil, Teamprofil …) schreiben ihren Zustand schon in die URL und
 * pushen Einträge. Was fehlte, sind die Zustände INNERHALB einer Seite, die nur als React-State lebten: das Spieler-Profilblatt und
 * der Reiter der Draft-Seite, ob die Draft-Seite offen oder verlassen ist. Maustaste 4/5 und Alt+Pfeil lösten dafür Browser-Back
 * aus — und sprangen damit aus der ganzen Seite heraus.
 *
 * Diese Datei legt solche Unterzustände unter `history.state["olySub:<schluessel>"]` ab. Reine Funktionen ohne React, damit sie
 * testbar sind; der Haken `useHistorienUnterzustand` unten verdrahtet sie mit einem useState.
 */
import { useEffect, useRef } from "react";

export const UNTERZUSTAND_PRAEFIX = "olySub:";

function kopf(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const zustand = window.history.state;
  return zustand && typeof zustand === "object" ? (zustand as Record<string, unknown>) : {};
}

export function leseUnterzustand<T>(schluessel: string): T | undefined {
  return kopf()[UNTERZUSTAND_PRAEFIX + schluessel] as T | undefined;
}

/** `modus` push = neuer Eintrag (Zurück führt zum vorigen Zustand); replace = nur diesen Eintrag beschriften. */
export function schreibeUnterzustand(schluessel: string, wert: unknown, modus: "push" | "replace"): void {
  if (typeof window === "undefined") return;
  const neu = { ...kopf(), [UNTERZUSTAND_PRAEFIX + schluessel]: wert };
  const adresse = window.location.href;
  if (modus === "push") window.history.pushState(neu, "", adresse);
  else window.history.replaceState(neu, "", adresse);
}

function gleich(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export type HistorienEntscheidung = "nichts" | "push" | "replace" | "zurueck";

/**
 * Was passiert, wenn der lokale Zustand `wert` vom Stand der History (`inHistorie`) abweicht? Rein, getestet.
 * - gleich: nichts (so verdoppelt weder ein Re-Render noch ein Popstate einen Eintrag)
 * - von leer nach belegt: neuer Eintrag
 * - von belegt nach leer: ein Schritt zurück, statt einen weiteren Eintrag zu stapeln
 * - belegt nach belegt: Eintrag ersetzen (Wechsel im Profil), oder mit `jedeAenderungPusht` (Reiter) neuer Eintrag
 */
export function entscheideHistorie(input: {
  wert: unknown;
  inHistorie: unknown;
  leer: unknown;
  jedeAenderungPusht?: boolean;
}): HistorienEntscheidung {
  const { wert, inHistorie, leer, jedeAenderungPusht } = input;
  if (gleich(wert, inHistorie)) return "nichts";
  if (jedeAenderungPusht) return "push";
  if (gleich(inHistorie, leer)) return "push";
  if (gleich(wert, leer)) return "zurueck";
  return "replace";
}

/**
 * Hält `wert` (ein useState der Seite) und die History in Gleichlauf. Popstate (Zurück/Vor, Maustasten 4/5) setzt den State auf
 * den Stand des Eintrags. Beim Mount werden Reste eines Eintrags nach Reload getilgt (der State startet leer).
 */
export function useHistorienUnterzustand<T>(
  schluessel: string,
  wert: T,
  setze: (neu: T) => void,
  optionen: { leer: T; jedeAenderungPusht?: boolean; aktiv?: boolean },
): void {
  const { leer, jedeAenderungPusht, aktiv = true } = optionen;
  const gestartet = useRef(false);
  const setzeRef = useRef(setze);
  setzeRef.current = setze;
  const leerRef = useRef(leer);
  leerRef.current = leer;

  useEffect(() => {
    if (!aktiv) return undefined;
    // Ein Reload behält history.state, der State der Seite startet aber leer: Rest tilgen statt später „zurück“ zu laufen.
    if (!gestartet.current) {
      gestartet.current = true;
      const rest = leseUnterzustand<T>(schluessel);
      if (rest !== undefined && !gleich(rest, wert)) schreibeUnterzustand(schluessel, leerRef.current, "replace");
    }
    const aufPopstate = () => {
      const eintrag = leseUnterzustand<T>(schluessel);
      setzeRef.current(eintrag === undefined ? leerRef.current : eintrag);
    };
    window.addEventListener("popstate", aufPopstate);
    return () => window.removeEventListener("popstate", aufPopstate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, aktiv]);

  useEffect(() => {
    if (!aktiv || !gestartet.current) return;
    const inHistorie = leseUnterzustand<T>(schluessel) ?? leerRef.current;
    const entscheidung = entscheideHistorie({ wert, inHistorie, leer: leerRef.current, jedeAenderungPusht });
    if (entscheidung === "push" || entscheidung === "replace") schreibeUnterzustand(schluessel, wert, entscheidung);
    else if (entscheidung === "zurueck") window.history.back();
  }, [wert, schluessel, aktiv, jedeAenderungPusht]);
}

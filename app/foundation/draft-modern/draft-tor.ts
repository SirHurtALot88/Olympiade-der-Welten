"use client";

/**
 * TOR DER DRAFT-SEITE (18.11.): entscheidet, ob die Shell an der Stelle des Schildes „Liga wird erstellt …“ die neue
 * Draft-Seite zeigt. Mit `OLY_LIGA_DRAFT_MODUS=block` (Rueckweg) gibt es keinen Draft-Zustand im Spielstand; die Probe
 * antwortet dann `ansicht: null` und alles bleibt wie heute (Schild, normale Ansichten).
 *
 * Die Entscheidung, wann überhaupt gefragt wird, steht in `istDraftKandidat` (rein, getestet): Liga im Aufbau
 * (`in_progress`/`failed`) ODER ein Draft dieser Saison, der noch nicht `fertig` ist — auch bei `ready` (Reload im
 * Nachzug, 18.11.: der Spieler muss wieder auf der Draft-Seite landen, solange er noch picken darf).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { leseUnterzustand, schreibeUnterzustand } from "@/lib/foundation/history-unterzustand";

import type { GameState } from "@/lib/data/olyDataTypes";

type DraftKandidatEingabe = {
  saveId: string;
  leagueSetupStatus: string | null;
  saisonId: string;
  ligaDraft: GameState["seasonState"]["ligaDraft"] | null | undefined;
};

/** Lohnt sich die Probe `GET /api/draft` für diesen Spielstand? (Die Antwort der Route entscheidet dann endgültig.) */
export function istDraftKandidat(eingabe: DraftKandidatEingabe): boolean {
  const { saveId, leagueSetupStatus, saisonId, ligaDraft } = eingabe;
  if (!saveId || saveId === "loading-save") return false;
  if (leagueSetupStatus === "in_progress" || leagueSetupStatus === "failed") return true;
  return ligaDraft != null && ligaDraft.saisonId === saisonId && ligaDraft.status !== "fertig";
}

type Urteil = { saveId: string; wert: "ja" | "nein"; schluessel: string; wartet?: boolean };

/**
 * Ein „ja“ gilt für den Spielstand, solange er geöffnet ist (kein Flackern, wenn sich der Draft-Status ändert). Ein
 * „nein“ gilt nur für die Lage, in der es gefällt wurde: legt der Server den Draft erst danach an (Status/Draft-Zustand
 * wechseln), wird neu gefragt statt ein altes „nein“ festzuhalten.
 */
export function urteilGilt(urteil: Urteil | null, saveId: string, schluessel: string): boolean {
  if (!urteil || urteil.saveId !== saveId) return false;
  return urteil.wert === "ja" || urteil.schluessel === schluessel;
}

const WIEDERHOLUNGEN = 3;
const WIEDERHOLUNG_MS = 2500;

export function useLigaDraftTor(input: { gameState: GameState; saveId: string; leagueSetupStatus: string | null }) {
  const { gameState, saveId, leagueSetupStatus } = input;
  const lokal = gameState.seasonState.ligaDraft;
  const kandidat = istDraftKandidat({ saveId, leagueSetupStatus, saisonId: gameState.season.id, ligaDraft: lokal });
  const schluessel = `${leagueSetupStatus ?? "-"}|${lokal?.saisonId ?? "-"}|${lokal?.status ?? "-"}`;
  const [urteil, setUrteil] = useState<Urteil | null>(null);
  const [verlassen, setVerlassen] = useState<string | null>(null);
  const [geoeffnet, setGeoeffnet] = useState<string | null>(null);
  const bekannt = urteilGilt(urteil, saveId, schluessel);

  useEffect(() => {
    if (!kandidat || bekannt) return undefined;
    let abgebrochen = false;
    let timer: number | null = null;
    const frage = async (versuch: number) => {
      try {
        const antwort = await fetch(`/api/draft?${new URLSearchParams({ saveId, vorschau: "0", verlauf: "1" }).toString()}`, { cache: "no-store" });
        if (antwort.ok) {
          const daten = (await antwort.json()) as { ansicht?: { wartetAufStart?: boolean } | null };
          if (!abgebrochen) setUrteil({ saveId, wert: daten.ansicht ? "ja" : "nein", schluessel, wartet: Boolean(daten.ansicht?.wartetAufStart) });
          return;
        }
      } catch {
        /* Netz weg oder Serverfehler: unten noch ein paar Mal nachfragen */
      }
      // Ein einzelner Fehlschlag darf die Draft-Seite nicht dauerhaft verhindern (Reload mitten im Nachzug).
      if (!abgebrochen && versuch < WIEDERHOLUNGEN) timer = window.setTimeout(() => void frage(versuch + 1), WIEDERHOLUNG_MS);
    };
    void frage(0);
    return () => {
      abgebrochen = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [kandidat, bekannt, saveId, schluessel]);

  // 19.11. (Chris: „erst seine office sachen klären dürfen“): steht der Draft noch auf der Startwahl, zeigt die Shell NICHT von
  // selbst die Draft-Seite, sondern das Office mit Hinweis; erst „Zum Draft“ (`oeffnen`) öffnet sie.
  const ja = bekannt && urteil?.wert === "ja";
  const aktiv = ja && verlassen !== saveId && (!urteil?.wartet || geoeffnet === saveId);
  const aktivRef = useRef(aktiv);
  aktivRef.current = aktiv;
  // 21.11. (Maus Zurück/Vor): der History-Eintrag, auf dem die Draft-Seite offen war, wird markiert. Zurück aus dem Office dorthin
  // öffnet den Draft wieder; Vor in den Eintrag ohne Marke (Office) schließt ihn wieder. Das Profilblatt/der Reiter hängen
  // am selben Eintrag (history-unterzustand.ts) und erben die Marke.
  useEffect(() => {
    if (aktiv && leseUnterzustand<string>("draftOffen") !== saveId) schreibeUnterzustand("draftOffen", saveId, "replace");
  }, [aktiv, saveId]);
  useEffect(() => {
    const aufPopstate = () => {
      const offen = leseUnterzustand<string>("draftOffen") === saveId;
      if (offen) setVerlassen((alt) => (alt === saveId ? null : alt));
      else if (aktivRef.current) setVerlassen(saveId);
    };
    window.addEventListener("popstate", aufPopstate);
    return () => window.removeEventListener("popstate", aufPopstate);
  }, [saveId]);
  // Hinweis „Draft wartet“: ein laufender Draft dieser Saison, die Seite ist gerade nicht offen.
  const hinweis = kandidat && ja && !aktiv;
  const schliessen = useCallback(() => setVerlassen(saveId), [saveId]);
  const oeffnen = useCallback(() => {
    setGeoeffnet(saveId);
    setVerlassen(null);
  }, [saveId]);
  return { aktiv, schliessen, oeffnen, hinweis };
}

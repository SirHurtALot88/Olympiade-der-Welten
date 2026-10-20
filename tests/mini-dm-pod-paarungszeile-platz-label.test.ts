import { describe, expect, it } from "vitest";

import { resolveMiniDmPodPlatzLabel, type SpieltagsMiniDmPod } from "@/lib/foundation/season-matchday-fixtures-overview";

/**
 * UI-FIX (20.10., Mini-DM-Anbindungs-Auftrag Punkt 7): die normale Spieltage-Paarungszeile
 * zeigte fuer ein Mini-DM-"Duell" zwischen zwei Teams aus UNTERSCHIEDLICHEN Pods bisher ein
 * taeuschendes `punkteHeim:punkteGast`-Ergebnis (z. B. "2:0"), als haetten die beiden Teams
 * gegeneinander gespielt -- sahen aber oft nicht einmal denselben Pod.
 *
 * GEGENPROBE (gedanklich, s. Dateikommentar an `resolveMiniDmPodPlatzLabel`): vor diesem Fix
 * berechnete die Zeile ihr Ergebnis aus `disziplin.punkteHeim`/`disziplin.punkteGast` (den
 * Liga-Punkten JE TEAM, 2/1/0/0 nach Pod-Platz) und haette z. B. "2:0" gezeigt, obwohl Heim
 * Erster in Pod A und Gast nur Dritter in Pod B war (siehe Fall unten) -- ein FALSCHES
 * Zwei-Team-Duell-Framing fuer zwei Teams, die nie gegeneinander antraten. Diese Tests pruefen
 * direkt gegen die neue, pure Ableitungsfunktion (keine Komponenten-Montage noetig).
 */

const POD_A: SpieltagsMiniDmPod = {
  podId: "pod-a",
  leagueTier: "liga1",
  disciplineId: "mini-dm",
  disciplineName: "Mini-DM",
  disciplineSide: "d1",
  gespielt: true,
  mitglieder: [
    { teamId: "heim", platz: 1, teamPoints: 2, wert: 8 },
    { teamId: "x", platz: 2, teamPoints: 1, wert: 6 },
    { teamId: "y", platz: 3, teamPoints: 0, wert: 4 },
    { teamId: "z", platz: 4, teamPoints: 0, wert: 2 },
  ],
};

const POD_B: SpieltagsMiniDmPod = {
  podId: "pod-b",
  leagueTier: "liga1",
  disciplineId: "mini-dm",
  disciplineName: "Mini-DM",
  disciplineSide: "d1",
  gespielt: true,
  mitglieder: [
    { teamId: "w", platz: 1, teamPoints: 2, wert: 9 },
    { teamId: "v", platz: 2, teamPoints: 1, wert: 7 },
    { teamId: "gast", platz: 3, teamPoints: 0, wert: 5 },
    { teamId: "u", platz: 4, teamPoints: 0, wert: 3 },
  ],
};

describe("resolveMiniDmPodPlatzLabel", () => {
  it("zeigt die ECHTE Pod-Platzierung beider Teams, nicht ein falsches Zwei-Team-Ergebnis", () => {
    const label = resolveMiniDmPodPlatzLabel(
      { gespielt: true, miniDmPodIdHeim: "pod-a", miniDmPodIdGast: "pod-b" },
      [POD_A, POD_B],
      "heim",
      "gast",
    );
    // Heim wurde 1. in Pod A, Gast nur 3. in Pod B -- NICHT "2:0" (das waeren ihre rohen
    // Liga-Punkte, die ein Zwei-Team-Duell vortaeuschen wuerden).
    expect(label).toBe("1./3.");
    expect(label).not.toContain(":");
  });

  it("zeigt beide Platzierungen auch, wenn Heim und Gast zufaellig im SELBEN Pod stehen", () => {
    const label = resolveMiniDmPodPlatzLabel(
      { gespielt: true, miniDmPodIdHeim: "pod-a", miniDmPodIdGast: "pod-a" },
      [POD_A, POD_B],
      "heim",
      "y",
    );
    expect(label).toBe("1./3.");
  });

  it("faellt bei einer Seite ohne Pod (Liga nicht durch 4 teilbar) auf '–' zurueck", () => {
    const label = resolveMiniDmPodPlatzLabel(
      { gespielt: true, miniDmPodIdHeim: "pod-a", miniDmPodIdGast: null },
      [POD_A, POD_B],
      "heim",
      "irgendwer",
    );
    expect(label).toBe("1./–");
  });

  it("zeigt den Gedankenstrich, solange die Disziplin noch nicht gewertet ist", () => {
    const label = resolveMiniDmPodPlatzLabel(
      { gespielt: false, miniDmPodIdHeim: "pod-a", miniDmPodIdGast: "pod-b" },
      [POD_A, POD_B],
      "heim",
      "gast",
    );
    expect(label).toBe("—");
  });
});

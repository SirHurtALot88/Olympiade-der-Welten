/**
 * GEMELDET AUS DEM SPIEL: "in der Inbox, wenn man Nachrichten zum Training hat, kommt man immer
 * woanders raus".
 *
 * Zwei Ursachen, beide in game-inbox-service:
 *
 * 1) VERWECHSELTE TABS. `trainingV2` heisst in der Navigation "Gebäude", der Trainingsplan lebt in
 *    `trainingCompact` ("Training"). Zwei Story-Cards zur Spielerentwicklung zeigten mit
 *    `panel: "season-end-development"` auf `trainingV2` — der Anker dieses Panels ist aber
 *    `foundation-training-compact` (resolveFoundationPanelAnchor). Also: falscher Tab, und der
 *    Scroll-Anker war dort gar nicht vorhanden. Dieselbe Verwechslung war an anderer Stelle schon
 *    einmal behoben worden (Trainingsmodus-Eintrag, mit genau diesem Kommentar) — die Story-Cards
 *    und die zwei Trainingslast-Eintraege wurden dabei uebersehen.
 *
 * 2) EIN ZIEL, DAS ES NICHT GIBT. Zwei Eintraege ("Hohes Verletzungsrisiko"/"Ermüdung beobachten"
 *    und "Hard-Training vs. Erholung") zeigten auf `targetView: "training"`. Diese View-Id steht im
 *    Typ, hat aber KEINEN Navigationseintrag — ein Alt-Bezeichner. Das Ziel war unerreichbar.
 *
 * Die Tests hier pruefen die REGEL, nicht die vier Zeilen: jedes Inbox-Ziel muss ein navigierbarer
 * View sein, und die Trainings-/Gebaeude-Panels muessen im jeweils richtigen Tab landen.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = fs.readFileSync(path.join(process.cwd(), "lib/foundation/game-inbox-service.ts"), "utf8");
const SHELL = fs.readFileSync(path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8");

/**
 * BEWUSST KEINE allgemeine "ist dieser View erreichbar?"-Pruefung.
 *
 * Naheliegend waere, jedes Ziel gegen die Nav-Gruppen oder gegen die Render-Zweige der Shell zu
 * pruefen. Beides traegt nicht: `market`, `cockpit`, `history` und `season` stehen in keiner
 * Nav-Gruppe und haben teils keinen eigenen `activeView === ...`-Zweig, sind aber ueber andere Wege
 * sehr wohl erreichbar. Ein falsches Kriterium waere schlimmer als keines — es wuerde vier gesunde
 * Ziele anschwaerzen und beim naechsten Umbau blind vertraut.
 *
 * Geprueft wird deshalb der eine Bezeichner, der nachweislich nirgends ankommt (`training`: kein
 * Nav-Eintrag UND kein Render-Zweig), plus die Panel-zu-Tab-Regel darunter.
 */
const LEGACY_DEAD_VIEW = "training";

/** (targetView, panel)-Paare, so wie sie im Quelltext stehen. */
function collectTargets(): { view: string; panel: string | null }[] {
  const out: { view: string; panel: string | null }[] = [];
  const withParams = /targetView:\s*"([^"]+)"[\s\S]{0,200}?targetParams:\s*\{([^}]*)\}/g;
  const seen = new Set<number>();
  for (const match of SOURCE.matchAll(withParams)) {
    seen.add(match.index ?? -1);
    const panel = /panel:\s*"([^"]+)"/.exec(match[2]!)?.[1] ?? null;
    out.push({ view: match[1]!, panel });
  }
  // Eintraege ohne targetParams ebenfalls einsammeln (fuer die Navigierbarkeits-Pruefung).
  for (const match of SOURCE.matchAll(/targetView:\s*"([^"]+)"/g)) {
    if (!seen.has(match.index ?? -2)) out.push({ view: match[1]!, panel: null });
  }
  return out;
}

/** Panels, die eindeutig zu genau einem Tab gehoeren. Genau hier ging es schief. */
const PANEL_HOME: Record<string, string> = {
  "training-plan": "trainingCompact",
  "season-end-development": "trainingCompact",
  facilities: "trainingV2",
};

describe("Inbox — jede Nachricht fuehrt zu ihrer eigenen Seite", () => {
  it("es gibt ueberhaupt Ziele zu pruefen", () => {
    expect(collectTargets().length).toBeGreaterThan(20);
  });

  it("der Alt-Bezeichner \"training\" wird nicht mehr als Ziel benutzt", () => {
    // Belegt, dass er wirklich nirgends ankommt: kein Render-Zweig in der Shell.
    expect(SHELL.includes(`activeView === "${LEGACY_DEAD_VIEW}"`)).toBe(false);
    const used = collectTargets().filter((entry) => entry.view === LEGACY_DEAD_VIEW);
    expect(
      used.length,
      `"${LEGACY_DEAD_VIEW}" hat weder Nav-Eintrag noch Render-Zweig — solche Ziele fuehren ins Leere`,
    ).toBe(0);
  });

  it("Trainings- und Gebaeude-Panels landen im jeweils richtigen Tab", () => {
    const wrong = collectTargets()
      .filter((entry) => entry.panel != null && PANEL_HOME[entry.panel] != null)
      .filter((entry) => entry.view !== PANEL_HOME[entry.panel!])
      .map((entry) => `panel "${entry.panel}" zeigt auf "${entry.view}" statt "${PANEL_HOME[entry.panel!]}"`);
    expect(wrong, `${wrong.length} Inbox-Ziele oeffnen den falschen Tab`).toEqual([]);
  });

  /**
   * Die Regel hinter der Verwechslung, damit sie benannt bleibt: `trainingV2` ist der GEBAEUDE-Tab.
   * Wer dort landet, weil er eine Trainingsnachricht angeklickt hat, ist falsch abgebogen.
   */
  it("trainingV2 wird nur fuer Gebaeude benutzt, nie fuer Trainingsinhalte", () => {
    const suspicious = collectTargets()
      .filter((entry) => entry.view === "trainingV2")
      .filter((entry) => entry.panel !== "facilities")
      .map((entry) => `trainingV2 mit panel "${entry.panel ?? "-"}"`);
    expect(suspicious, "trainingV2 ist der Gebaeude-Tab — Trainingsinhalte gehoeren nach trainingCompact").toEqual([]);
  });
});

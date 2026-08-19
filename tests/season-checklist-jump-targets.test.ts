import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveFoundationPanelScrollTarget } from "@/lib/foundation/tabs/foundation-page-module-helpers";

const CHECKLIST = readFileSync(join(process.cwd(), "lib/foundation/season-readiness-checklist.ts"), "utf8");

/**
 * ALLE QUELLEN, DIE EIN SPRUNGZIEL VERGEBEN — nicht nur die Checkliste.
 *
 * Der Test unten sah urspruenglich allein `season-readiness-checklist.ts` an. Das ist aber nur
 * EINE von drei Stellen, an denen `targetPanel` gesetzt wird; der Weiter-Knopf zieht seine Ziele
 * aus `game-flow-controller.ts` und `flow-blocker-routing.ts`. Der Sprung ans Saisonende
 * (`season-finale`) lief deshalb ausserhalb dieser Zusicherung — und war kaputt.
 *
 * Ein Test, der eine Fehlerklasse an einer von drei Stellen prueft, laesst zwei offen.
 */
const PANEL_QUELLEN = [
  "lib/foundation/season-readiness-checklist.ts",
  "lib/foundation/game-flow-controller.ts",
  "lib/foundation/flow-blocker-routing.ts",
] as const;

/** Alle `id="…"` aus den Foundation-Ansichten — die möglichen Sprungziele. */
function collectElementIds(): Set<string> {
  const ids = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".tsx")) continue;
      for (const match of readFileSync(full, "utf8").matchAll(/\sid="([a-z0-9-]+)"/g)) {
        ids.add(match[1]!);
      }
    }
  };
  walk(join(process.cwd(), "app/foundation"));
  return ids;
}

/**
 * „Der Button Saison vorbereiten bringt gar nichts und bringt mich auch nicht weiter."
 *
 * Die Saison-Checkliste schickt den Spieler über `targetPanel` an einen Anker. Landet der
 * Name bei keinem Element, holt `scrollToFoundationTarget` per `getElementById` ein `null`
 * und bricht **still** ab — die Ansicht wechselt, sonst passiert nichts. Von aussen nicht
 * von einem kaputten Knopf zu unterscheiden.
 *
 * Drei der vier Saisonende-Einträge zeigten auf Anker, die es nirgends gab:
 * "preseason-workflow" (Neue Saison vorbereiten) und "season-review" (Spielerentwicklung,
 * Saisonrückblick).
 */
describe("Saison-Checkliste: jeder Sprung landet irgendwo", () => {
  const elementIds = collectElementIds();

  it("löst die Ziele der Saisonende-Einträge auf ein existierendes Element auf", () => {
    const panels = [...CHECKLIST.matchAll(/targetPanel:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]!);
    // Absicherung gegen einen leeren Treffersatz — ein Test, der nichts prüft, ist schlimmer
    // als keiner.
    expect(panels.length).toBeGreaterThanOrEqual(3);

    const dead = panels.filter((panel) => !elementIds.has(resolveFoundationPanelScrollTarget({ panel, targetView: "cockpit" })));
    expect(dead).toEqual([]);
  });

  /**
   * Panels mit EIGENEM Navigationsweg brauchen keinen Anker aus der Zuordnung.
   *
   * `navigateToGameFlowStep` behandelt sie vor dem allgemeinen Zweig und kehrt frueh zurueck —
   * die Zuordnung wird fuer sie nie befragt. Sie hier als tot zu melden waere ein Fehlalarm.
   */
  const EIGENER_WEG = new Set(["season-briefing", "captain-picker", "sponsor-choice"]);

  /**
   * BEKANNTE LUECKEN — Sprungziele ohne Element, deren richtiger Anker noch nicht entschieden ist.
   *
   * Diese Liste ist keine Entschuldigung, sondern ein Riegel: taucht ein NEUES totes Ziel auf,
   * wird der Fall rot. Wird eines davon repariert, wird er ebenfalls rot und zwingt dazu, den
   * Eintrag hier zu streichen. Eine Luecke, die niemand mehr sieht, wird sonst dauerhaft.
   *
   * Warum sie hier stehen und nicht schon behoben sind: bei jedem waere zu entscheiden, WELCHES
   * Panel gemeint ist. Einen Anker zu raten waere derselbe Fehler noch einmal — er saehe dann nur
   * repariert aus. Notiert in `docs/AUDIT-INGAME-2026-08-19.md` unter A1.
   */
  const BEKANNT_TOT = ["finalize-transfers", "form-board", "resolve-lab"];

  /**
   * WAS DIESER TEST NICHT KANN — und das ist wichtig, weil er sonst falsche Sicherheit gibt.
   *
   * `collectElementIds` liest `id="…"` aus DATEIEN. Ob die Komponente, die diese id vergibt, im
   * Spiel ueberhaupt gerendert wird, sieht der Test nicht.
   *
   * Genau daran ist `board-objectives` aufgefallen: `#team-board-objectives` steht in
   * `FoundationTeamsDetailPanel.tsx` — die Datei existiert, die id existiert, der Test war gruen.
   * IM BROWSER GEMESSEN: die Teams-Ansicht rendert `FoundationTeamsNewLook`, und
   * `[data-testid="foundation-teams-view"]` taucht auch nach 60 Sekunden nicht auf. Die
   * New-Look-Ansicht kennt gar keine Board-Ziele. Der Sprung ist also tot, obwohl die Zusicherung
   * haelt.
   *
   * Ein Anker dafuer laesst sich nicht raten — er muesste erst irgendwo hin. Notiert unter A1 in
   * `docs/AUDIT-INGAME-2026-08-19.md`.
   */
  const TOT_TROTZ_VORHANDENER_ID = ["board-objectives"];

  it("prüft JEDE Quelle, die ein Sprungziel vergibt — nicht nur die Checkliste", () => {
    /*
     * Der Weiter-Knopf zieht seine Ziele aus dem Flow-Controller und der Blocker-Zuordnung.
     * Genau dort lag `season-finale`, das ans Saisonende sprang — ausserhalb der Zusicherung
     * darueber und deshalb unbemerkt kaputt. Ein Test, der eine Fehlerklasse an einer von drei
     * Stellen prueft, laesst zwei offen.
     */
    const alle = new Set<string>();
    for (const datei of PANEL_QUELLEN) {
      const quelle = readFileSync(join(process.cwd(), datei), "utf8");
      for (const treffer of quelle.matchAll(/targetPanel:\s*"([a-z0-9-]+)"/g)) {
        alle.add(treffer[1]!);
      }
    }
    // Wieder die Absicherung gegen einen leeren Treffersatz.
    expect(alle.size).toBeGreaterThanOrEqual(10);

    const tot = [...alle]
      .filter((panel) => !EIGENER_WEG.has(panel))
      .filter((panel) => !elementIds.has(resolveFoundationPanelScrollTarget({ panel, targetView: "cockpit" })))
      .sort();
    expect(tot).toEqual([...BEKANNT_TOT].sort());
  });

  it("die beiden am Weiter-Knopf reparierten Ziele landen auf einem echten Element", () => {
    /*
     * `season-finale` ist der Sprung ans Saisonende — der Fall, an dem Chris haengen blieb.
     * `formcards` zeigte auf `foundation-lineup`; das ist aber nur ein `data-testid`, die id
     * lautet `foundation-lineup-v2`.
     *
     * `board-objectives` steht bewusst NICHT hier: seine id existiert zwar in einer Datei, die
     * Komponente wird im Spiel aber nicht gerendert (siehe TOT_TROTZ_VORHANDENER_ID).
     */
    expect(TOT_TROTZ_VORHANDENER_ID).toContain("board-objectives");
    for (const panel of ["season-finale", "formcards"]) {
      const ziel = resolveFoundationPanelScrollTarget({ panel, targetView: "cockpit" });
      expect({ panel, ziel, existiert: elementIds.has(ziel) }).toEqual({ panel, ziel, existiert: true });
    }
  });

  it("der allgemeine Rückfall zeigt auf ein Element, das es gibt", () => {
    // Hier stand "foundation-home" — ein Name ohne Element. Jeder Sprung ohne eigene Zuordnung
    // fiel damit still aus.
    const rueckfall = resolveFoundationPanelScrollTarget({ panel: null, targetView: "unbekannte-ansicht" });
    expect(rueckfall).toBe("foundation-home-v2");
    expect(elementIds.has(rueckfall)).toBe(true);
  });

  it("kennt die beiden Namen, die vorher ins Leere liefen", () => {
    expect(resolveFoundationPanelScrollTarget({ panel: "preseason-workflow", targetView: "cockpit" })).toBe(
      "preseason-workflow",
    );
    expect(elementIds.has("preseason-workflow")).toBe(true);

    expect(resolveFoundationPanelScrollTarget({ panel: "season-review", targetView: "cockpit" })).toBe(
      "season-review-preview",
    );
    expect(elementIds.has("season-review-preview")).toBe(true);
  });
});

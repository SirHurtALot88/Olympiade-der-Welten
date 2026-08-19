import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getFoundationBreadcrumb } from "@/lib/foundation/foundation-breadcrumb";

/**
 * JEDE ANSICHT HAT GENAU EINE SEITENUEBERSCHRIFT — Befund D1 aus
 * `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * CHRIS: „ja mach mit D1 weiter."
 *
 * GEMESSEN im Browser, vorher: von 14 Ansichten hatten **13 gar keine `<h1>`**. Die einzige im
 * Spiel hiess „Football" — ein Disziplinname, keine Seitenueberschrift. Fuenf Ansichten
 * (Gebaeude, Transfermarkt, Finanzen, Leaders, Sponsoren) begannen bei `<h3>`, ohne dass darueber
 * je eine Stufe stand.
 *
 * NACHHER, ueber 21 Ansichten gemessen: jede genau eine `<h1>`, benannt nach der Ansicht, und die
 * fuenf Luecken sind zu (0 -> 3/9/9/2/4 `h2`).
 *
 * ZWEI ENTSCHEIDUNGEN, die dieser Test festhaelt:
 *
 * 1. Die Ueberschrift steht in der SHELL, nicht 19 Mal in den Ansichten. Der Name ist laengst
 *    bestimmt (`getFoundationBreadcrumb`) — ihn nachzutragen hiesse, 19 Stellen zu schaffen, die
 *    auseinanderlaufen koennen.
 * 2. Sie ist unsichtbar (`sr-only`). Optisch tragen die Ansichten ihren Titel bereits ueber
 *    Breadcrumb und Panel-Kopf; gefehlt hat nur die SEMANTIK.
 */

const root = process.cwd();

describe("D1 · Die Seitenüberschrift kommt aus einer Rechenstelle", () => {
  const shell = readFileSync(join(root, "app/foundation/shell/FoundationShell.tsx"), "utf8");
  const body = readFileSync(join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");

  it("die Shell rendert die h1 und nimmt sie aus dem Breadcrumb-Namen", () => {
    expect(shell).toContain('<h1 className="sr-only">{viewTitle}</h1>');
    expect(body).toContain("viewTitle={newLookBreadcrumbData?.view ?? null}");
  });

  it("der Name steht für jede Ansicht bereit — sonst bliebe die Überschrift leer", () => {
    for (const view of ["homeV2", "inboxV2", "lineup", "matchdayArena", "seasonV2", "teams", "marketV2"]) {
      const krume = getFoundationBreadcrumb(view as never);
      expect({ view, hatNamen: Boolean(krume?.view) }).toEqual({ view, hatNamen: true });
    }
  });

  it("Kartentitel sind Stufe 2, nicht 3 — sonst springt die Gliederung", () => {
    const karte = readFileSync(join(root, "components/foundation/new-look/NlCard.tsx"), "utf8");
    expect(karte).toContain('<h2 className="nl-card-title">');
    expect(karte).not.toContain('<h3 className="nl-card-title">');
  });
});

describe("D1 · Keine zweite h1 in den Ansichten der Shell", () => {
  /**
   * WARUM DIESER RIEGEL: mit der Shell-Ueberschrift wird jede `<h1>` in einer Ansicht zur ZWEITEN
   * Spitze — und zwei Spitzen sind keine Gliederung. Beim Bauen fielen vier solche auf
   * (Arena zweimal, Gebaeude, Transfermarkt-Verkauf) plus das HQ-Office.
   *
   * AUSNAHMEN, jede mit Grund:
   *  - `error.tsx`              — die Fehlerseite ERSETZT den Inhalt, sie ist dann das Dokument.
   *  - `season-briefing-title`  — Titel eines `role="dialog" aria-modal`, per `aria-labelledby`
   *                               verknuepft. Ein Dialog bringt seine eigene Spitze mit.
   *  - `legacy-resolve-lab`,
   *    `transfermarkt-lab`      — eigene Routen mit eigener `page.tsx`, nicht in der Shell.
   */
  const AUSNAHMEN = [
    "app/foundation/error.tsx",
    "app/foundation/legacy-resolve-lab/",
    "app/foundation/transfermarkt-lab/",
    "app/foundation/shell/FoundationShell.tsx",
  ];

  it("außer den begründeten Ausnahmen deklariert keine Ansicht ein eigenes h1", () => {
    const treffer: string[] = [];
    const walk = (dir: string) => {
      for (const eintrag of readdirSync(dir)) {
        if (eintrag === "node_modules" || eintrag === ".next") continue;
        const voll = join(dir, eintrag);
        if (statSync(voll).isDirectory()) {
          walk(voll);
          continue;
        }
        if (!eintrag.endsWith(".tsx")) continue;
        const rel = voll.replace(`${root}/`, "");
        if (AUSNAHMEN.some((a) => rel.startsWith(a))) continue;
        /*
         * KOMMENTARE RAUS, BEVOR GEPRUEFT WIRD.
         *
         * Beim ersten Anlauf meldete dieser Riegel `ManagerOfficeClient.tsx` — und der Treffer
         * war der Kommentar, mit dem die Demotion dort BEGRUENDET wird. Ein Riegel, den die
         * eigene Begruendung ausloest, ist wertlos; heute war das schon der zweite dieser Art
         * (siehe `tests/weiter-leiste-beschriftung.test.ts`).
         */
        const quelle = readFileSync(voll, "utf8")
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/[^\n]*/g, "");
        for (const zeile of quelle.split("\n")) {
          if (!zeile.includes("<h1")) continue;
          // Der Dialogtitel traegt seine eigene Kennung und ist als Ausnahme benannt.
          if (zeile.includes("season-briefing-title")) continue;
          treffer.push(`${rel}: ${zeile.trim().slice(0, 70)}`);
        }
      }
    };
    walk(join(root, "app/foundation"));
    walk(join(root, "components/foundation"));
    expect(treffer).toEqual([]);
  });
});

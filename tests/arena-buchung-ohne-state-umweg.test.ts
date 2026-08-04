/**
 * GEMELDET VON CHRIS: „obwohl alles gescored und berechnet ist und oben sogar steht es ist im
 * saisonstand drin kann ich den spieltag 2 nicht abschließen!" — auf dem Schirm stand
 * „Standings Apply fehlt noch für diesen Spieltag."
 *
 * URSACHE. `commitArenaDiscipline` wollte den Lauf ohne Tie-Stopp starten und tat das über
 * React-State:
 *
 *     setMatchdayAutoRunStopOnTie(false);
 *     const result = await runCockpitMatchdayAutoRun(true, side, false, shownPreview);
 *
 * Das kann nicht wirken. `runCockpitMatchdayAutoRun` liest die Schalter aus dem Closure des
 * aktuellen Renders; ein Setter unmittelbar davor plant nur den nächsten Render. Der Lauf sah
 * `stopOnTie` also weiter auf seinem Default `true` (use-foundation-page-state.ts).
 *
 * Sobald zwei Teams denselben Score oder dieselben projizierten Punkte hatten, meldete die
 * Standings-Preview `tie_groups_require_confirmed_policy`, der Auto-Run brach VOR
 * `executeStandingsApply` ab — und „Spieltag abschließen" prüft genau diesen Eintrag.
 *
 * Geprüft wird deshalb die Regel, nicht die verschobene Zeile:
 *
 *  1. Die Arena setzt die Lauf-Optionen nicht mehr über State, sondern übergibt sie.
 *  2. Sie übergibt `stopOnTie: false` — ein Gleichstand darf die Buchung nicht anhalten.
 *  3. Der Handler lässt Übergaben den Schaltern vorgehen, benutzt sie aber weiter als Default.
 *  4. Bleibt die Buchung trotzdem aus, nennt die Arena den Grund statt „bitte Cockpit prüfen".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const ARENA = readFileSync(join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8");
const HANDLERS = readFileSync(join(root, "lib/foundation/tabs/cockpit-matchday-handlers.ts"), "utf8");

/** Der Rumpf von `commitArenaDiscipline` — nur dort gilt die Regel. */
function commitArenaDisciplineBody() {
  const start = ARENA.indexOf("async function commitArenaDiscipline");
  expect(start, "commitArenaDiscipline nicht gefunden").toBeGreaterThanOrEqual(0);
  const end = ARENA.indexOf("async function finishMatchdayAndAdvance", start);
  expect(end, "finishMatchdayAndAdvance nicht gefunden").toBeGreaterThan(start);
  return ARENA.slice(start, end);
}

/**
 * Derselbe Rumpf ohne Kommentare.
 *
 * Nötig, weil die Erklärung über der Funktion den alten Aufruf ZITIERT — inklusive
 * `setMatchdayAutoRunStopOnTie(false)`. Ohne das Entfernen prüft der Test den Kommentar statt den
 * Code und schlägt an der eigenen Dokumentation fehl.
 */
function commitArenaDisciplineCode() {
  return commitArenaDisciplineBody()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("Die Arena bucht ohne den Umweg über React-State", () => {
  it("setzt die Lauf-Optionen nicht mehr per Setter direkt vor dem Lauf", () => {
    const body = commitArenaDisciplineCode();
    for (const setter of [
      "setMatchdayAutoRunStopOnTie",
      "setMatchdayAutoRunIncludeWarningLineups",
      "setMatchdayAutoRunOverwriteExistingLineups",
    ]) {
      expect(body, `${setter} wirkt in derselben Runde nicht — der Lauf liest den alten Wert`).not.toContain(
        setter,
      );
    }
  });

  it("übergibt sie stattdessen als Argument, mit stopOnTie: false", () => {
    const body = commitArenaDisciplineCode();
    expect(body).toContain("stopOnTie: false");
    expect(body).toContain("overwriteExistingLineups: false");
    expect(body).toContain("includeWarningLineups: false");
  });

  it("der Aufruf trägt die Optionen an fünfter Stelle", () => {
    // Sonst landen sie stillschweigend im falschen Parameter und wirken wieder nicht.
    const body = commitArenaDisciplineCode();
    expect(body).toMatch(/runCockpitMatchdayAutoRun\(\s*true,\s*side,\s*false,\s*shownPreview,\s*\{/);
  });
});

describe("Der Handler lässt Übergaben vorgehen — ohne die Cockpit-Schalter zu entwerten", () => {
  it("jede der drei Optionen fällt ohne Übergabe auf ihren Schalter zurück", () => {
    for (const [override, fallback] of [
      ["optionOverrides.includeWarningLineups", "matchdayAutoRunIncludeWarningLineups"],
      ["optionOverrides.overwriteExistingLineups", "matchdayAutoRunOverwriteExistingLineups"],
      ["optionOverrides.stopOnTie", "matchdayAutoRunStopOnTie"],
    ] as const) {
      expect(HANDLERS, `${override} überschreibt ${fallback} nicht sauber`).toContain(
        `${override} ?? ${fallback}`,
      );
    }
  });

  it("das Cockpit ruft weiterhin ohne Übergabe auf und behält damit seine Schalter", () => {
    const panel = readFileSync(join(root, "app/foundation/cockpit-v2/FoundationCockpitPanel.tsx"), "utf8");
    expect(panel).toContain("runCockpitMatchdayAutoRun(true)");
    expect(panel).toContain("runCockpitMatchdayAutoRun(false)");
  });
});

describe("Eine ausbleibende Buchung nennt ihren Grund", () => {
  it("die Arena liest die Blocker aus dem Lauf statt auf das Cockpit zu verweisen", () => {
    // „bitte Cockpit pruefen" bleibt als letzter Ausweg stehen, ist aber nicht mehr die einzige
    // Auskunft: genau diese Auskunftslosigkeit hat Chris' Fall so schwer auffindbar gemacht.
    const body = commitArenaDisciplineCode();
    expect(body).toContain("result?.blockingReasons");
    expect(body).toContain("step.blockingReasons");
    expect(body).toContain("formatCockpitReason");
  });
});

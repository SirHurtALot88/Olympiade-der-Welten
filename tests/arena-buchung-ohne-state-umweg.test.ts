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

/**
 * NACHTRAG — Chris hat den Cockpit-Weg probiert und einen Screenshot geschickt:
 * „9. Standings Apply · BLOCKIERT · incomplete_result:B-B", der Knopf „2. Standings lokal anwenden"
 * ausgegraut, Duplicate Schutz false, Planned Changes 32.
 *
 * Damit war die erste Vermutung (Gleichstand) für SEINEN Fall falsch: es blockiert eine
 * unvollständige Ergebniszeile von Team B-B — meist ein Spieler, der nach der abgegebenen
 * Aufstellung ausgefallen ist. Und beide Wege waren zu: der Auto-Run über den State-Bug, das
 * Cockpit, weil `runCockpitStandingsApply` nie `forceReplace` mitschickte.
 *
 * Deshalb holt „Spieltag abschließen" die Tabelle selbst nach — eng gefasst.
 */
describe("Ein hängender Spieltag holt die Tabelle selbst nach", () => {
  const ARENA_SRC = readFileSync(
    join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
    "utf8",
  );

  it("die Nachhol-Aktion greift nur, wenn AUSSCHLIESSLICH die Tabelle fehlt", () => {
    expect(ARENA_SRC).toContain(
      'firstReasons.every((reason) => reason === "standings_apply_missing_for_current_matchday")',
    );
  });

  it("sie prüft vorher im DryRun und bricht bei jedem anderen Grund ab", () => {
    expect(ARENA_SRC).toContain("runCockpitStandingsApply(false)");
    expect(ARENA_SRC).toContain("isRecoverableStandingsBlocker(reason)");
    expect(ARENA_SRC).toMatch(/if \(blockers\.length > 0 && !blockers\.every/);
  });

  it("behebbar sind Gleichstand und unvollständige Ergebniszeile — mehr nicht", () => {
    const start = ARENA_SRC.indexOf("function isRecoverableStandingsBlocker");
    const block = ARENA_SRC.slice(start, ARENA_SRC.indexOf("\n  }", start));
    expect(block).toContain('reason === "tie_groups_require_confirmed_policy"');
    expect(block).toContain('reason.startsWith("incomplete_result:")');
    // Gegenprobe: was Punkte doppelt zählen würde oder wo gar nichts gerechnet ist, bleibt draußen.
    expect(block, "eine fehlende Ergebniszeile darf nicht überfahren werden").not.toContain(
      'reason.startsWith("missing_result:")',
    );
    expect(block, "Doppel-Apply würde Punkte doppelt zählen").not.toContain("duplicate_apply");
    expect(block).not.toContain("stale_baseline_replace_not_supported");
  });

  it("der Wechsel wird höchstens einmal wiederholt", () => {
    const start = ARENA_SRC.indexOf("async function finishMatchdayAndAdvance");
    const body = ARENA_SRC.slice(start, ARENA_SRC.indexOf("\n  }\n", start));
    const advanceCalls = body.match(/runCockpitMatchdayAdvance\(true\)/g) ?? [];
    expect(advanceCalls.length, "mehr als zwei Anläufe wären ein Kreisel").toBe(2);
  });

  it("was überfahren wurde, steht in der Erfolgsmeldung", () => {
    // Sonst bucht das Spiel still über eine unvollständige Ergebniszeile hinweg.
    expect(ARENA_SRC).toContain("recoveryNote");
    expect(ARENA_SRC).toContain("Die Tabelle wurde nachgetragen trotz:");
  });

  it("das Cockpit kann forceReplace jetzt überhaupt mitschicken", () => {
    // Ohne das Flag blockiert `prepareStandingsApply` bei genau diesen Lagen — der Apply-Knopf war
    // deshalb dauerhaft ausgegraut, wie in Chris' Screenshot.
    expect(HANDLERS).toContain("runCockpitStandingsApply(execute: boolean, forceReplace = false)");
    expect(HANDLERS).toContain("forceReplace,");
  });
});

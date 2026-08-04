import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hasVisibleMutatorPoints, resolveAwardedPlayerPoints } from "@/lib/foundation/player-points-total";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * "Die PPs sollen nicht 0,2 (+0,6) fuer Mutatoren sein, sondern direkt einberechnet,
 * also 0,8 (+0,6)."
 *
 * Die Engine liefert zwei getrennte Groessen: `pointsAwarded` (Anteil an den
 * Team-Punkten, verteilt am finalen Score) und `mutatorPpsBonus` (die "0,3er", 1:1
 * gutgeschrieben). Der Saison-Ledger buchte seit jeher die SUMME
 * (`points = basePoints + mutatorPpsBonus`) — die Buehne zeigte aber nur den Anteil
 * und den Aufschlag daneben in Klammern. Die angezeigte Waehrung war damit eine
 * andere als die gebuchte.
 */
describe("Player-Points: Anteil + Mutator-Aufschlag sind EINE Zahl", () => {
  it("summiert Anteil und Aufschlag", () => {
    expect(resolveAwardedPlayerPoints({ pointsAwarded: 0.2, mutatorPpsBonus: 0.6 })).toBeCloseTo(0.8, 5);
    expect(resolveAwardedPlayerPoints({ pointsAwarded: 2, mutatorPpsBonus: 0 })).toBe(2);
    expect(resolveAwardedPlayerPoints({ pointsAwarded: 1.5, mutatorPpsBonus: null })).toBe(1.5);
  });

  it("haelt 'noch nicht gewertet' von 'null Punkte' auseinander", () => {
    // Ohne Anteil und ohne Aufschlag ist der Spieler schlicht noch nicht dran —
    // die Buehne zeigt dann "noch offen", nicht "0". Ein 0-Fallback wuerde den
    // Anti-Spoiler der Arena aushebeln.
    expect(resolveAwardedPlayerPoints({ pointsAwarded: null, mutatorPpsBonus: null })).toBeNull();
    expect(resolveAwardedPlayerPoints({ pointsAwarded: undefined, mutatorPpsBonus: 0 })).toBeNull();
    // Ein reiner Aufschlag ohne Anteil ist dagegen ein echtes Ergebnis.
    expect(resolveAwardedPlayerPoints({ pointsAwarded: null, mutatorPpsBonus: 0.3 })).toBeCloseTo(0.3, 5);
  });

  it("weist Kleinstbetraege nicht als Mutator-Anteil aus", () => {
    expect(hasVisibleMutatorPoints(0.6)).toBe(true);
    expect(hasVisibleMutatorPoints(-0.3)).toBe(true);
    expect(hasVisibleMutatorPoints(0.01)).toBe(false);
    expect(hasVisibleMutatorPoints(null)).toBe(false);
    expect(hasVisibleMutatorPoints(undefined)).toBe(false);
  });

  it("bucht der Ledger ueber denselben Helfer wie die Anzeige", () => {
    const ledger = read("lib/foundation/season-points-ledger.ts");
    expect(ledger).toContain("resolveAwardedPlayerPoints({ pointsAwarded: derivedPoints, mutatorPpsBonus })");
    // Keine zweite, handgerechnete Summe daneben.
    expect(ledger).not.toContain("roundValue(derivedPoints + mutatorPpsBonus, 4)");
  });

  it("zeigt Hover, Top-Spieler-Zeile und Spieltags-Wertung die Summe", () => {
    const arena = read("app/foundation/discipline-stage/DisciplineStageArena.tsx");
    // Top-Spieler-Zeile und Spieltags-Wertung ziehen beide durch den Helfer.
    expect(arena).toContain("points: resolveAwardedPlayerPoints({");
    expect(arena).toContain("pp: resolveAwardedPlayerPoints({");
    expect(arena).not.toContain("points: pp.pointsAwarded,");

    const preview = read("app/foundation/discipline-stage/DisciplineStageHoverPreview.tsx");
    expect(preview).toContain("const awardedPp");
    expect(preview).toContain("{fmt1(awardedPp)} PP");
    // Die Klammer ist jetzt Aufschluesselung, kein Zusatzposten.
    expect(preview).toContain("(inkl. ");
  });
});

/**
 * "Kannst du unter der Arena-Top-Player-Zeile, wenn verfuegbar, eine schmale Zeile
 * hinzufuegen, wo die Verletzungen aufgelistet werden?"
 */
describe("Arena: Verletzungs-Zeile unter den Top-Spielern", () => {
  const row = read("app/foundation/discipline-stage/DisciplineStageInjuryRow.tsx");
  const arena = read("app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx");

  it("rendert nichts, solange es keine Verletzten gibt", () => {
    expect(row).toContain("if (players.length === 0) return null;");
  });

  it("sitzt direkt unter der Top-Spieler-Zeile", () => {
    const topIndex = arena.indexOf("<DisciplineStageTopPlayersRow");
    const injuryIndex = arena.indexOf("<DisciplineStageInjuryRow");
    expect(topIndex).toBeGreaterThan(-1);
    expect(injuryIndex).toBeGreaterThan(topIndex);
  });

  it("speist sich NUR aus aufgedeckten Slots (kein Spoiler)", () => {
    // Gleiche Schleifengrenze wie `revealedPlayerIds`: bis einschliesslich thrownSlot.
    expect(arena).toContain("const revealedInjuredPlayers");
    expect(arena).toContain("for (let s = 0; s <= t.thrownSlot; s += 1)");
  });

  it("erkennt Verletzungen ueber den typisierten Flag mit Regex-Rueckfall", () => {
    expect(arena).toContain('m.injury === true || /verletz|injury/i.test(m.k)');
  });

  it("zaehlt nur Verletzungs-Abzuege in den Malus, nicht jeden negativen Mod", () => {
    // Sonst stuenden Fatigue und Intensitaet mit in der Zahl.
    expect(arena).toContain("injuryMods.filter((m) => m.sign < 0)");
  });

  it("sortiert eigenes Team zuerst, dann nach Schwere", () => {
    expect(arena).toContain("Number(right.isOwn) - Number(left.isOwn) || right.malus - left.malus");
  });
});

/**
 * "Nach D2 soll der Stand bleiben, damit man sich die Spieltagstabelle sauber
 * anschauen kann — wenn das nicht moeglich ist, mach den Spieltag-abschliessen-Button
 * wieder mit rein."
 *
 * Beides: der Auto-Run der Arena schaltet nicht mehr selbst weiter, und der Knopf ist
 * zurueck.
 */
describe("Spieltag: Abschluss ist wieder eine Entscheidung", () => {
  it("laesst die Arena nach D2 stehen statt automatisch weiterzuschalten", () => {
    const scope = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
    // Geprueft wird das dritte Argument (`advanceAfterCashApply: false`), nicht die exakte
    // Aufrufzeile. Die stand hier als Zeichenkette mit GENAU drei Argumenten und war schon rot,
    // bevor jemand sie gebraucht haette: die Arena reicht laengst zusaetzlich die gezeigte Preview
    // durch, seit dem Fix fuer Chris' blockierten Spieltag ausserdem die Lauf-Optionen. Ein Test,
    // der bei jedem neuen Parameter bricht, sagt nichts ueber die Regel, die er schuetzen soll.
    expect(scope).toMatch(/runCockpitMatchdayAutoRun\(\s*true,\s*side,\s*false\b/);
  });

  it("reicht die Option bis zum Service durch, Cockpit behaelt seinen Default", () => {
    const handlers = read("lib/foundation/tabs/cockpit-matchday-handlers.ts");
    expect(handlers).toContain("advanceAfterCashApply = true,");
    expect(handlers).toContain("advanceAfterCashApply,");
    // Der Service kennt die Option laengst — D1 nutzte sie schon (isPartialCommit).
    const service = read("lib/season/matchday-auto-run-service.ts");
    expect(service).toContain("params.options?.advanceAfterCashApply ?? true");
    const route = read("app/api/season/matchday-auto-run/route.ts");
    expect(route).toContain("advanceAfterCashApply: body.options?.advanceAfterCashApply ?? true");
  });

  it("bietet den expliziten Abschluss-Knopf in der Arena", () => {
    // Der Knopf lag in der "Spieltagsergebnis"-Sektion unter der Buehne. Die Sektion ist
    // entfernt (sie wiederholte Arena und Saisonstand), der Knopf wanderte in die Arena —
    // sonst waere der Spieltag aus dem normalen Spielverlauf nicht mehr abschliessbar.
    const arena = read("app/foundation/discipline-stage/DisciplineStageArena.tsx");
    expect(arena).toContain('data-testid="arena-finish-matchday"');
    expect(arena).toContain("Spieltag abschließen");

    const body = read("app/foundation/FoundationShellRouterBody.tsx");
    // Gegatet auf den Flow-Schritt: erst wenn beide Disziplinen gewertet sind.
    expect(body).toContain("canAdvanceMatchdayFromStep(matchdayAdvanceStep)");
    // Die Rueckmeldung (Start/Erfolg/Ablehnung) haelt `matchday-finish-button-wiring.test.ts`
    // fest — hier nur, dass der Knopf ueberhaupt am meldenden Wrapper haengt.
    expect(body).toContain("finishMatchdayAndAdvance()");
  });
});

/**
 * "Wenn man in der Spieler-Ansicht VK-Wert markiert, sieht man die + und -
 * Aenderungen kaum."
 *
 * Die aktive Sortierspalte hat einen HELLEN Hintergrund. Der Delta-Chip bringt im
 * Normalzustand nur eine 14-%-Toenung mit und traegt seine Bedeutung im farbigen
 * TEXT — beides gedacht fuer dunkles Panel. Auf dem Hellblau ging die Toenung unter,
 * und die bestehende Kontrastregel ueberschrieb zusaetzlich den gruen/roten Text mit
 * Dunkel. Uebrig blieb ein kaum sichtbarer Pfeil mit Zahl.
 */
describe("Spielerliste: Delta-Chips in der aktiven Sortierspalte", () => {
  const css = read("app/globals.css");
  const block = css.slice(
    css.indexOf("/* Delta-Chips (MW-/VK-/Gehalts-Entwicklung"),
    css.indexOf("Fix #5 — CA/PO gestapelt"),
  );

  it("gibt den Chips dort eine DECKENDE Flaeche statt einer Toenung", () => {
    // 14 % reichen auf Hellblau nicht — in der aktiven Spalte deckt der Chip.
    expect(block).toContain("color-mix(in srgb, var(--nl-good) 82%, #ffffff 18%)");
    expect(block).toContain("color-mix(in srgb, var(--nl-risk) 82%, #ffffff 18%)");
    // Kante gegen das Blau, sonst verschwimmt der Chip-Rand.
    expect(block).toContain("border-color: color-mix(in srgb, var(--nl-good)");
    expect(block).toContain("border-color: color-mix(in srgb, var(--nl-risk)");
  });

  it("haelt auch den neutralen ±0-Chip als Chip erkennbar", () => {
    expect(block).toContain("background: color-mix(in srgb, var(--heat-elite-text, #0b1220) 12%, transparent)");
    expect(block).toContain("border: 1px solid color-mix(in srgb, var(--heat-elite-text, #0b1220) 26%, transparent)");
  });

  it("beschraenkt das strikt auf die aktive Spalte", () => {
    // Inaktive Spalten behalten den dezenten Normalzustand — sonst schreit die
    // ganze Tabelle. Jede Regel des Blocks haengt an `td.is-active-sort`.
    const selectors = [...block.matchAll(/\n(\.is-new-look [^{]+)\{/g)].map(([, sel]) => sel.trim());
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector, selector).toContain("td.is-active-sort");
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const HOOK = readFileSync(
  join(REPO_ROOT, "lib/foundation/tabs/use-foundation-cross-tab-matchday-lineup.ts"),
  "utf8",
);

const ENSURE = HOOK.slice(
  HOOK.indexOf("const ensureAiLineupsForCurrentMatchday = useCallback("),
  HOOK.indexOf("useEffect(() => {", HOOK.indexOf("const ensureAiLineupsForCurrentMatchday = useCallback(")),
);

/**
 * Gemeldet als „die Teams haben keine Aufstellungen".
 *
 * KI-Aufstellungen entstehen ausschliesslich in `ensureAiLineupsForCurrentMatchday`. Der Lauf war
 * gegen Doppelausfuehrung mit einem Merker pro Spielstand+Spieltag+Team-Satz gesichert — gesetzt
 * VOR dem `fetch` und nie wieder entfernt. Damit galt jeder Fehlschlag als Erfolg:
 *
 *  - Netz weg oder Route wirft  -> `catch`, Merker bleibt, kein zweiter Versuch
 *  - Route lehnt ab (`payload.error`, `!response.ok`) -> Merker bleibt, kein zweiter Versuch
 *  - Abbruch beim Ansichtswechsel -> Merker bleibt, kein zweiter Versuch
 *
 * In allen drei Faellen standen die KI-Teams danach ohne Aufstellung da, ohne jede Meldung, bis
 * die Seite neu geladen wurde. Der geworfene Fehler half auch niemandem: der Aufrufer ist ein
 * Effect (`void ensure…`), die Ablehnung verpuffte als unbehandeltes Promise.
 */
describe("KI-Aufstellungen nachziehen", () => {
  it("merkt sich nur Laeufe, die tatsaechlich durchgekommen sind", () => {
    const marker = "aiLineupEnsureRunStartedRef.current.add(runKey)";
    expect(ENSURE).toContain(marker);

    // Der Merker steht hinter der Erfolgspruefung, nicht davor.
    const successGate = ENSURE.indexOf("if (response.ok && !payload.error) {");
    expect(successGate).toBeGreaterThan(-1);
    expect(ENSURE.indexOf(marker)).toBeGreaterThan(successGate);

    // Und nicht mehr vor dem Absenden.
    const fetchAt = ENSURE.indexOf("await fetch(`/api/lineups/legacy/ai-batch-apply");
    expect(ENSURE.indexOf(marker)).toBeGreaterThan(fetchAt);
  });

  it("wiederholt einen Fehlschlag, aber nicht endlos", () => {
    // Der Effect haengt an der Identitaet der Callback-Funktion. Ohne Deckel wuerde ein dauerhaft
    // ablehnender Server in einer Dauerschleife angefragt.
    expect(HOOK).toContain("export const AI_LINEUP_ENSURE_MAX_ATTEMPTS = 3;");
    expect(ENSURE).toContain("attempts >= AI_LINEUP_ENSURE_MAX_ATTEMPTS");
    expect(ENSURE).toContain("aiLineupEnsureAttemptsRef.current.set(runKey, trigger === \"manual\" ? 1 : attempts + 1)");
  });

  it("verbucht einen Abbruch von aussen nicht als Fehlversuch", () => {
    // `abort()` kommt vom Ansichtswechsel oder vom naechsten Lauf — nicht vom Server. Das darf
    // das Wiederholungsbudget nicht aufbrauchen.
    const abortRollbacks = ENSURE.match(/aiLineupEnsureAttemptsRef\.current\.set\(runKey, attempts\)/g) ?? [];
    expect(abortRollbacks.length).toBe(2);
  });

  it("meldet den Fehler, statt ihn ins Leere zu werfen", () => {
    expect(ENSURE).toContain("ai_lineup_ensure_failed");
    // Der alte Weiterwurf landete als unbehandelte Promise-Ablehnung im Nichts.
    const catchBlock = ENSURE.slice(ENSURE.indexOf("} catch (error) {"));
    expect(catchBlock).not.toContain("throw error;");
  });
});

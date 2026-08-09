/**
 * Wächter für die Rules-of-Hooks-Reparatur (August 2026).
 *
 * Anlass: `FoundationTeamsDetailPanel` hatte seinen `if (!active) return null;`
 * VOR den useState/useEffect-Aufrufen, `PlayerDetailDrawer` drei useMemo HINTER
 * seinem `if (!data) return null;`. Beides lief nur deshalb unfallfrei, weil die
 * Hosts die Bedingung praktisch nie an einer gemounteten Instanz kippen — eine
 * Landmine, kein laufender Fehler. Kippt die Bedingung doch einmal, wirft React
 * mit "Rendered more/fewer hooks than during the previous render".
 *
 * Diese Suite lintet genau die beiden historischen Sünder mit der echten
 * Projekt-Config (eslint.config.mjs) und besteht darauf, dass
 * `react-hooks/rules-of-hooks` dort nichts mehr findet. Gegenprobe gefahren:
 * Mit dem alten Stand der beiden Dateien meldet der erste Test 6 bzw. 3
 * Verstöße und fällt. Absichtlich nur diese zwei Dateien statt des ganzen
 * Repos: Der Volllauf dauert Minuten und gehört in `npm run lint`, nicht in
 * die Vitest-Schleife.
 */
import { describe, expect, it } from "vitest";

import { ESLint } from "eslint";

const REGEL = "react-hooks/rules-of-hooks";

/** Die beiden Dateien, in denen die 9 Bestands-Verstöße lagen. */
const HISTORISCHE_SUENDER = [
  "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx",
  "app/foundation/PlayerDetailDrawer.tsx",
];

describe("Rules of Hooks bleiben repariert", () => {
  it(
    "meldet in den beiden historischen Sünder-Dateien keinen einzigen Verstoß mehr",
    { timeout: 120_000 },
    async () => {
      const eslint = new ESLint({ cwd: process.cwd() });
      const ergebnisse = await eslint.lintFiles(HISTORISCHE_SUENDER);

      const verstoesse = ergebnisse.flatMap((ergebnis) =>
        ergebnis.messages
          .filter((meldung) => meldung.ruleId === REGEL)
          .map((meldung) => `${ergebnis.filePath}:${meldung.line}:${meldung.column} ${meldung.message}`),
      );

      expect(verstoesse).toEqual([]);
    },
  );

  it("hält die Regel in der Projekt-Config auf Fehler-Stufe", async () => {
    // Schutz gegen die bequeme "Lösung", die Regel einfach auf warn/off zu
    // drehen statt neue Verstöße zu reparieren: Die aufgelöste Config für eine
    // Client-Komponente muss die Regel als "error" (Severity 2) führen.
    const eslint = new ESLint({ cwd: process.cwd() });
    const config = await eslint.calculateConfigForFile(HISTORISCHE_SUENDER[0]);
    const eintrag = config.rules?.[REGEL];

    expect(eintrag).toBeDefined();
    const stufe = Array.isArray(eintrag) ? eintrag[0] : eintrag;
    expect([2, "error"]).toContain(stufe);
  });
});

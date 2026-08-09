import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { resolveFirstOpenFormPickCell } from "@/lib/foundation/resolve-first-open-form-cell";

describe("gameplay flow scan contract", () => {
  it("keeps a single form-card write path and flow deep-link into formplan", async () => {
    const [lineupText, foundationText, formBoardText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
        "utf8",
      ),
      // FoundationPageClient.tsx is now a thin wrapper; this wiring lives in
      // use-foundation-shell-router-body-scope.tsx.
      fs.readFile(
        path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
        "utf8",
      ),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/legacy-lineup-lab/FormBoardPanel.tsx"),
        "utf8",
      ),
    ]);

    expect(lineupText).not.toMatch(/updateModifier\([^)]*,\s*"primaryFormCardId"/);
    expect(lineupText).not.toMatch(/updateModifier\([^)]*,\s*"secondaryFormCardId"/);
    expect(lineupText).toContain("resolveFirstOpenFormPickCell");
    expect(lineupText).toContain("pendingFormBoardFocusRef");
    expect(lineupText).toContain("Formplan synchronisiert");
    /**
     * HIER STANDEN ZWEI ABSICHTLICH ROTE ZUSICHERUNGEN auf „Daten-Ansicht" und
     * `legacy-lineup-scoreboard-board-rows`, mit dem Verdacht auf einen echten Funktionsverlust.
     *
     * Nachgesehen (Audit, ausführlich in `tests/velo-ui-components.test.ts` begründet): Das Panel
     * lag im alten Look, der seit `ae590e4f` nicht mehr erreichbar war und mit `32683df8` entfernt
     * wurde. Seine Zahlen stehen heute in der Spieltags-Wertung der Arena und im „Daten"-Tab des
     * Spieltag-Ergebnisses. Kein Abriss, sondern eine Zusammenlegung.
     *
     * Geprüft wird jetzt, dass die Nachfolger da sind — sonst wäre der Inhalt doch verloren.
     */
    const matchdayPanelText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"),
      "utf8",
    );
    for (const spalte of ["Punkte", "Form", "Captain", "Mutator", "Gesamt"]) {
      expect(matchdayPanelText).toContain(spalte);
    }
    const resultNewLookText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/matchday-result-v2/MatchdayResultNewLook.tsx"),
      "utf8",
    );
    expect(resultNewLookText).toContain("cumulativePoints");
    expect(foundationText).toContain("getFormCardFlowStatus");
    // `formCardBlocker` ist beim Aufteilen des Scopes in die Cross-Tab-Schicht gewandert und stand
    // deshalb hier ins Leere. Die Aussage bleibt dieselbe — der Blocker wird verdrahtet —, nur die
    // Datei stimmt jetzt wieder.
    const crossTabLineupText = await fs.readFile(
      path.join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-matchday-lineup.ts"),
      "utf8",
    );
    expect(crossTabLineupText).toContain("formCardBlocker");
    expect(foundationText).toContain('targetPanel === "form-board"');
    expect(formBoardText).toContain("data-form-board-cell-id");
    expect(formBoardText).toContain("Plan → Entwurf");
  });

  it("resolves the first open form cell on the current matchday first", () => {
    const cell = resolveFirstOpenFormPickCell({
      schedule: [
        {
          matchdayId: "md-2",
          matchdayIndex: 2,
          discipline1: { disciplineId: "d1", category: "pow" },
          discipline2: null,
        },
        {
          matchdayId: "md-1",
          matchdayIndex: 1,
          discipline1: { disciplineId: "d1", category: "pow" },
          discipline2: { disciplineId: "d2", category: "spe" },
        },
      ],
      formCardPlanByKey: new Map([
        ["md-2:d1", { matchdayId: "md-2", disciplineSide: "d1", primaryFormCardId: "card-1" } as never],
      ]),
      currentMatchdayId: "md-1",
      getFormCardColorForCategory: () => "red",
    });

    expect(cell).toMatchObject({
      matchdayId: "md-1",
      disciplineSide: "d1",
      slot: "primary",
    });
  });

  it("wires prep performance markers for lineup, season and arena", async () => {
    const [lineupText, seasonText, packageText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
        "utf8",
      ),
      // SeasonStandingsV2Client.tsx is now a thin wrapper around SeasonStandingsNewLook.tsx.
      fs.readFile(
        path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "package.json"), "utf8"),
    ]);

    expect(packageText).toContain("@tanstack/react-virtual");
    // "LegacyLineupVirtualCardGrid" pinnte nur einen nie genutzten Import aus
    // der toten Geschwisterdatei LegacyLineupVirtualTableBody.tsx — beide sind
    // mit dem Dead-Code-Cleanup entfernt. Die echte Virtualisierung der
    // Spieler-Tabelle läuft über useRowVirtualWindow / expertPlayerTableVirtualWindow
    // (siehe Assertion unten), die davon unberührt bleibt.
    expect(lineupText).toContain("scheduleHoveredCandidate");
    expect(lineupText).toContain("expertPlayerTableVirtualWindow");
    /**
     * HIER STAND EINE ABSICHTLICH ROTE ZUSICHERUNG auf `standingsTableVirtualWindow`, mit dem
     * eigenen Zusatz, das könne auch eine gewollte Vereinfachung sein.
     *
     * Genau das ist es: Virtualisierung lohnt ab Zeilenzahlen, bei denen das Rendern spürbar wird.
     * Der Saisonstand ist durch die Ligagröße gedeckelt — 32 Zeilen. Dafür einen Virtualizer zu
     * halten kostet Komplexität ohne Gegenwert. Die echte Virtualisierung läuft weiter dort, wo sie
     * gebraucht wird: in der Spieler-Tabelle und der Einsatzliste (`expertPlayerTableVirtualWindow`,
     * eine Zeile darüber geprüft).
     *
     * Gesichert wird deshalb das, worauf es ankommt: dass die Virtualisierung dort NICHT
     * verschwunden ist, wo die Listen wirklich lang werden.
     */
    expect(lineupText).toContain("useRowVirtualWindow");
  });
});

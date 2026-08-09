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
    const [lineupText, playersTableText, packageText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
        "utf8",
      ),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/players-table/FoundationPlayersTableBody.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "package.json"), "utf8"),
    ]);

    // "LegacyLineupVirtualCardGrid" pinnte nur einen nie genutzten Import aus
    // der toten Geschwisterdatei LegacyLineupVirtualTableBody.tsx — beide sind
    // mit dem Dead-Code-Cleanup entfernt.
    expect(lineupText).toContain("scheduleHoveredCandidate");

    /**
     * HIER STAND EINE ABSICHTLICH ROTE ZUSICHERUNG auf `standingsTableVirtualWindow`, mit dem
     * eigenen Zusatz, das könne auch eine gewollte Vereinfachung sein.
     *
     * Genau das ist es: Virtualisierung lohnt ab Zeilenzahlen, bei denen das Rendern spürbar wird.
     * Der Saisonstand ist durch die Ligagröße gedeckelt — 32 Zeilen. Dafür einen Virtualizer zu
     * halten kostet Komplexität ohne Gegenwert. Diese Begründung stammt aus `main` und bleibt.
     *
     * NACHTRAG (Merge, Entscheidung Chris 2026-08-09): Ihr Zusatz nannte als Gegenbeispiel „die
     * Einsatzliste (`expertPlayerTableVirtualWindow`)". Das hat nie gestimmt — nachgemessen wurde
     * `visibleExpertPlayerRows` zwar berechnet, aber NIE gerendert, der Viewport-Ref hing an keinem
     * Element und `setIsExpertModeEnabled` hatte keinen Aufrufer. Dort lief keine Virtualisierung,
     * die man hätte sichern können; der Expertenmodus ist mit diesem Zweig ausgebaut.
     *
     * Die Aussage, die der Test schützen soll, bleibt aber richtig und wird deshalb nicht
     * gestrichen, sondern auf den Ort gezogen, wo die Virtualisierung TATSÄCHLICH läuft: die
     * Spieler-Tabelle. Das ist die einzige Liste im Spiel, die wirklich lang wird (rund 3000
     * Spieler), und sie ist auch die einzige verbliebene Nutzerin von `@tanstack/react-virtual`.
     */
    expect(packageText).toContain("@tanstack/react-virtual");
    expect(playersTableText).toContain("useVirtualizer");
  });
});

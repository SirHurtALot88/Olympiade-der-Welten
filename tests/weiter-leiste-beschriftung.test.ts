import { describe, expect, it } from "vitest";

import { deriveGlobalNextUi } from "@/lib/foundation/tabs/foundation-global-next-actions";
import type { GameInboxItem } from "@/lib/data/olyDataTypes";

/**
 * DIE BESCHRIFTUNG DER WEITER-LEISTE — Befund A3 aus `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * CHRIS: „mach dann mit A3 weiter."
 *
 * `deriveGlobalNextUi` lag in `foundation-global-next-actions.ts`, WORTGLEICH kopiert in
 * `use-foundation-shell-router-body-scope.tsx`. Importiert hat das Modul niemand — gelesen wurde
 * es nur als TEXT von `tests/game-inbox-ui-contract.test.ts`. Wer dort etwas reparierte, aenderte
 * am Spiel nichts, und der Vertragstest blieb trotzdem gruen.
 *
 * Seit die Leiste die Funktion wirklich benutzt, laesst sich ihr Verhalten pruefen statt nur
 * lesen. Diese Faelle halten fest, was der Knopf in den Lagen sagt, die im Audit auffielen.
 */

function inboxItem(overrides: Partial<GameInboxItem> = {}): GameInboxItem {
  return {
    itemId: "board_objectives_failed:C-C",
    title: "Board-Ziel verfehlt",
    description: "Formkarten-Ausbeute: Ligarang vor dem unteren Viertel",
    severity: "warning",
    status: "open",
    ...overrides,
  } as GameInboxItem;
}

function eingabe(overrides: Partial<Parameters<typeof deriveGlobalNextUi>[0]> = {}) {
  return {
    primaryInboxItem: null,
    gameFlowActionStep: { stepId: "prepare_season", label: "Season vorbereiten", status: "ready" as const, blockers: [] },
    cockpitBusyKey: null,
    seasonTransitionBusy: false,
    matchdayArenaBlockerSummary: { reasons: [] },
    transferWindowHint: { open: false, label: "" },
    ...overrides,
  };
}

describe("Weiter-Leiste: was der Knopf sagt", () => {
  it("nennt im Normalfall den Schritt und weist auf die Leertaste hin", () => {
    const ui = deriveGlobalNextUi(eingabe());
    expect(ui.globalNextLabel).toBe("Season vorbereiten");
    expect(ui.globalNextTitle).toBe("Leertaste: Weiter");
    expect(ui.globalNextDisabled).toBe(false);
  });

  it("haengt das offene Transferfenster an — der Hinweis gehoert in den Titel, nicht ins Label", () => {
    const ui = deriveGlobalNextUi(eingabe({ transferWindowHint: { open: true, label: "Verkaufsfenster" } }));
    expect(ui.globalNextTitle).toBe("Leertaste: Weiter · Verkaufsfenster");
    // Das Label bleibt der Schritt: der Knopf soll sagen, was er TUT.
    expect(ui.globalNextLabel).toBe("Season vorbereiten");
  });

  it("sperrt sich, solange eine Aktion laeuft — und sagt das auch", () => {
    for (const lage of [
      { cockpitBusyKey: "irgendwas" },
      { seasonTransitionBusy: true },
      { gameFlowActionStep: { stepId: "x", label: "L", status: "applying" as const, blockers: [] } },
    ]) {
      const ui = deriveGlobalNextUi(eingabe(lage));
      expect(ui.globalNextDisabled).toBe(true);
      expect(ui.globalNextTitle).toBe("Aktion läuft gerade.");
    }
  });

  it("nennt bei einem blockierten Schritt den Grund statt einer leeren Aufforderung", () => {
    const ui = deriveGlobalNextUi(
      eingabe({
        gameFlowActionStep: { stepId: "lineup", label: "Aufstellung", status: "blocked", blockers: ["lineup_missing"] },
      }),
    );
    expect(ui.globalNextStatusClass).toBe("is-blocked");
    // Der Titel traegt den uebersetzten Blocker, nicht den rohen Code.
    expect(ui.globalNextTitle).not.toBe("");
    expect(ui.globalNextTitle).not.toContain("lineup_missing");
  });

  it("laesst die Arena-Gruende vorgehen, wenn es welche gibt", () => {
    const ui = deriveGlobalNextUi(
      eingabe({
        gameFlowActionStep: { stepId: "arena", label: "Arena", status: "blocked", blockers: ["irgendein_code"] },
        matchdayArenaBlockerSummary: { reasons: ["Zwei Teams ohne Einsatzliste"] },
      }),
    );
    expect(ui.globalNextTitle).toContain("Zwei Teams ohne Einsatzliste");
  });

  it("bietet bei optionalen Gebaeude-Schritten das Ueberspringen an", () => {
    for (const stepId of ["matchday_facilities", "facilities"]) {
      const ui = deriveGlobalNextUi(
        eingabe({ gameFlowActionStep: { stepId, label: "Gebäude", status: "optional", blockers: [] } }),
      );
      expect(ui.globalNextTitle).toBe("Leertaste: optional prüfen oder überspringen");
    }
  });
});

describe("Weiter-Leiste: der Posteingang uebernimmt", () => {
  /**
   * GENAU DIESE LAGE stand im Audit als A2: der Knopf trug „Board-Ziel verfehlt: For…" —
   * einen ZUSTAND statt einer Handlung, dazu abgeschnitten. Der Weg dorthin fuehrt ueber
   * `primaryInboxItem.title`, das das Label des Schritts verdraengt.
   *
   * Der Fall haelt das heutige Verhalten fest, damit A2 eine messbare Ausgangslage hat — er
   * behauptet NICHT, dass es so richtig ist.
   */
  it("ersetzt Label und Titel durch den Posteingangs-Eintrag", () => {
    const ui = deriveGlobalNextUi(eingabe({ primaryInboxItem: inboxItem() }));
    expect(ui.globalNextLabel).toBe("Board-Ziel verfehlt");
    expect(ui.globalNextTitle).toBe(
      "Board-Ziel verfehlt: Formkarten-Ausbeute: Ligarang vor dem unteren Viertel",
    );
  });

  it("bleibt bedienbar, auch wenn gerade etwas laeuft — sonst haengt der Spieler fest", () => {
    const ui = deriveGlobalNextUi(eingabe({ primaryInboxItem: inboxItem(), seasonTransitionBusy: true }));
    expect(ui.globalNextDisabled).toBe(false);
  });

  it("faerbt sich nach der Dringlichkeit des Eintrags, nicht nach dem Schritt", () => {
    const stufen: Array<[GameInboxItem["severity"], string]> = [
      ["critical", "is-blocked"],
      ["warning", "is-warning"],
      ["info", "is-ready"],
    ];
    for (const [severity, klasse] of stufen) {
      expect(deriveGlobalNextUi(eingabe({ primaryInboxItem: inboxItem({ severity }) })).globalNextStatusClass).toBe(
        klasse,
      );
    }
  });
});

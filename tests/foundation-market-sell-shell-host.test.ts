import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import FoundationMarketSellShellHost, {
  type FoundationMarketSellShellHostProps,
} from "@/app/foundation/transfermarkt-v2/FoundationMarketSellShellHost";
import { describeSellPreviewIssue } from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";
import type { TransfermarktSellSummary } from "@/lib/foundation/tabs/use-market-sell-derivations";

/**
 * SSR-Rendertests der Zustandsmaschine des Verkaufs-Modals (Redesign in
 * Kaufmodal-Qualität). Deckt genau die Zustände ab, die im Screenshot-Bug
 * übereinander lagen: lädt / Transferfenster zu / Fehler / blockiert /
 * bereit / verkauft — mit der Zusage "genau EINE tragende Meldung pro
 * Zustand" statt drei gestapelter Banner.
 *
 * Muster wie tests/season-standings-new-look-columns.test.ts: react-dom/server
 * rendert die echte Komponente, geprüft wird das erzeugte Markup.
 */

function makeSummary(overrides: Partial<TransfermarktSellSummary> = {}): TransfermarktSellSummary {
  return {
    canSell: true,
    blockingReasons: [],
    warnings: [],
    player: { id: "player-1", name: "Sgt Dreadnought", className: "Krieger", race: "Ork" },
    team: { id: "team-cc", name: "Cash Creators", shortCode: "C-C" },
    activePlayer: {
      id: "roster-1",
      playerId: "player-1",
      status: "active",
      roleTag: "starter",
      contractLength: 2,
      salary: 4.2,
      purchasePrice: 18,
      currentValue: 23.2,
      joinedSeasonId: "season-1",
    },
    cashBefore: 100,
    cashAfter: 123.13,
    rosterBefore: 9,
    rosterAfter: 8,
    teamSalaryBefore: 40,
    teamSalaryAfter: 35.8,
    marketValueReference: 23.2,
    saleFactor: 1.224,
    salePrice: 28.37,
    buyoutCost: 5.24,
    netProceeds: 23.13,
    profit: 5.13,
    salaryReduction: 4.2,
    projectedReadinessAfterSell: "ready",
    coaching: null,
    ...overrides,
  };
}

function makeProps(overrides: Partial<FoundationMarketSellShellHostProps> = {}): FoundationMarketSellShellHostProps {
  return {
    readMetaSource: "sqlite",
    selectedTeam: null,
    marketSellPreview: null,
    marketSellSubject: {
      activePlayerId: "roster-1",
      playerId: "player-1",
      playerName: "Sgt Dreadnought",
      className: "Krieger",
      race: "Ork",
      portraitUrl: null,
    },
    marketSellBusy: false,
    marketSellError: null,
    marketSellSuccess: null,
    marketSellRiskAcknowledged: false,
    onMarketSellRiskAcknowledgedChange: () => {},
    playerRatingsById: new Map(),
    playerSeasonPerformanceMap: new Map(),
    derivationsInput: {
      gameState: {
        players: [],
        rosters: [],
        teams: [],
        transferHistory: [],
      } as never,
      selectedTeamId: "team-cc",
      getPlayerDisplayMarketValue: () => null,
      getRosterEntryDisplayMarketValue: () => null,
      getRosterEntryDisplaySalary: () => null,
      getPlayerDisplayMarketValueDelta: () => null,
      getRosterEntrySalaryDelta: () => null,
    },
    closeMarketSellModal: () => {},
    confirmTransfermarktSell: () => {},
    retryMarketSellPreview: () => {},
    ...overrides,
  };
}

function render(overrides: Partial<FoundationMarketSellShellHostProps> = {}) {
  return renderToString(React.createElement(FoundationMarketSellShellHost, makeProps(overrides)));
}

function countOccurrences(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

describe("FoundationMarketSellShellHost — Zustandsmaschine", () => {
  it("lädt: echter Skeleton statt leerer Strich-Kacheln, keine Fehler-Banner", () => {
    const html = render({ marketSellBusy: true });
    expect(html).toContain('data-testid="transfer-sell-preview-skeleton"');
    expect(html).toContain("Verkaufsvorschau lädt");
    // Kein gestapelter Fehler-/Leerzustand neben dem Skeleton:
    expect(html).not.toContain("transfer-sell-preview-error");
    expect(html).not.toContain("transfer-sell-window-closed");
    expect(html).not.toContain("Verkaufsvorschau konnte nicht geladen werden");
    // Keine KPI-Wand aus Strichen ohne Daten:
    expect(html).not.toContain("Netto-Erlös");
  });

  it("Transferfenster zu (phase_blocked): ruhiger Info-Zustand, kein roher Token, kein Fehler-Stapel", () => {
    const html = render({ marketSellError: "phase_blocked:sell_players:season_active" });
    expect(html).toContain('data-testid="transfer-sell-window-closed"');
    expect(html).toContain("Transferfenster geschlossen");
    expect(html).toContain("Saisonende");
    // Der rohe API-Token darf nie im UI landen:
    expect(html).not.toContain("phase_blocked");
    // Und der Zustand ist ein Info-Screen, kein Fehler:
    expect(html).not.toContain("transfer-sell-preview-error");
    expect(html).not.toContain("Verkaufsvorschau konnte nicht geladen werden");
    // Verkaufs-Knopf gesperrt, mit erklärender Zeile:
    expect(html).toContain('data-testid="transfer-sell-disabled-reason"');
    expect(html).toContain("Das Verkaufsfenster ist geschlossen");
  });

  it("Fehler: genau EINE Meldung (statt drei übereinander) plus Retry-Aktion", () => {
    const message = "Verkaufsvorschau konnte nicht geladen werden.";
    const html = render({ marketSellError: message });
    expect(html).toContain('data-testid="transfer-sell-preview-error"');
    // Die Meldung erscheint genau einmal — nicht als Banner + Pill + Empty-Hint:
    expect(countOccurrences(html, message)).toBe(1);
    expect(html).toContain('data-testid="transfer-sell-retry-button"');
    expect(html).toContain("Vorschau neu laden");
    expect(html).not.toContain("transfer-sell-window-closed");
  });

  it("blockiert mit Grund: der übersetzte Grund steht groß vorn, die Vorschau bleibt lesbar", () => {
    const html = render({
      marketSellPreview: makeSummary({
        canSell: false,
        blockingReasons: ["sell_only_at_season_end"],
      }),
    });
    expect(html).toContain('data-testid="transfer-sell-blocked-callout"');
    // Übersetzt, nicht als roher snake_case-Token:
    expect(html).toContain("Verkaufsfenster am Season-End");
    expect(html).not.toContain("sell_only_at_season_end");
    // Vorschau-Zahlen bleiben sichtbar (Netto-Erlös-KPI mit echtem Wert):
    expect(html).toContain("Netto-Erlös");
    expect(html).toContain("Team-Auswirkung");
    // Confirm gesperrt + Grund neben dem Button:
    expect(html).toContain('data-testid="transfer-sell-confirm-button"');
    expect(html).toMatch(/data-testid="transfer-sell-confirm-button"[^>]*disabled/);
    expect(html).toContain('data-testid="transfer-sell-disabled-reason"');
  });

  it("bereit: Entscheidungsvorlage mit KPIs, Vorher→Nachher und aktivem Primärbutton", () => {
    const html = render({ marketSellPreview: makeSummary() });
    expect(html).toContain("Netto-Erlös");
    expect(html).toContain("Verkaufspreis");
    expect(html).toContain("Faktor");
    expect(html).toContain("GuV");
    expect(html).toContain("Team-Auswirkung");
    expect(html).toContain("Aufstellung danach");
    // Redesign (docs/design/verkauf-popup.md Abschnitt 4, "zwei Klicks statt
    // Checkbox-Pflicht"): der erste Klick heißt jetzt "Verkaufen…" und öffnet
    // nur den lokalen Bestätigen-Schritt der Fußleiste — "Ja, endgültig
    // verkaufen" (der eigentliche Sell-Call) erscheint erst danach und ist per
    // SSR-String-Render nicht simulierbar (kein Klick-Handling ohne Hydration).
    // Die alte Erwartung "Endgültig verkaufen" beim ersten Render entfällt
    // deshalb bewusst.
    expect(html).toContain("Verkaufen…");
    expect(html).not.toContain("Ja, endgültig verkaufen");
    // Endgültigkeit steht ausdrücklich in der Konsequenzen-Zeile:
    expect(html).toContain('data-testid="transfer-sell-final-note"');
    expect(html).not.toMatch(/data-testid="transfer-sell-confirm-button"[^>]*disabled/);
    expect(html).not.toContain('data-testid="transfer-sell-disabled-reason"');
    expect(html).not.toContain('data-testid="transfer-sell-blocked-callout"');
  });

  it("Risiko-Bestätigung: Board-Warnung sperrt den Verkauf, bis die Checkbox gesetzt ist", () => {
    const coaching: NonNullable<TransfermarktSellSummary["coaching"]> = {
      doctrinePersona: "balanced",
      doctrineHint: "",
      strategyFitSummary: "Passt zur Linie.",
      sellDecisionLabel: "Halten",
      sellPriority: 2,
      sellIntentScore: 10,
      keepIntentScore: 80,
      reasonsToSell: [],
      reasonsToKeep: ["Leistungsträger"],
      coachingWarnings: [],
      boardTrustPolicy: "normal",
      boardTrustSmiley: ":|",
      boardReaction: {
        confidenceDelta: -10,
        severity: "critical",
        title: "Board ist alarmiert",
        description: "",
        gmNote: null,
        requiresStrongAcknowledgment: true,
      },
      gmName: "GM",
      gmArchetype: "star_chaser",
      gmPressureLevel: "stable",
      gmWarning: null,
      gmDetail: null,
      gmSoftBlockStarSell: false,
      replacementSlot: null,
      pricingPolicyNotes: [],
      soldPlayerSeasonBanNote: "1 Saison Rückkauf-Sperre.",
    };
    const withoutAck = render({ marketSellPreview: makeSummary({ coaching }) });
    expect(withoutAck).toContain('data-testid="transfer-sell-risk-ack"');
    expect(withoutAck).toMatch(/data-testid="transfer-sell-confirm-button"[^>]*disabled/);
    expect(withoutAck).toContain("Bitte bestätige zuerst die Board-/GM-Warnung");
    // Contract-Zusage: Auto-Empfehlung bleibt die Wortwahl (kein "AI-…").
    expect(withoutAck).toContain("Auto-Empfehlung");

    const withAck = render({ marketSellPreview: makeSummary({ coaching }), marketSellRiskAcknowledged: true });
    expect(withAck).not.toMatch(/data-testid="transfer-sell-confirm-button"[^>]*disabled/);
  });

  it("verkauft: Abschlussmoment mit Erlös-Zahlen, ohne Fehler- oder Ladezustand", () => {
    const html = render({
      marketSellPreview: makeSummary(),
      marketSellSuccess: "Sgt Dreadnought verkauft: Cash 100 → 123.",
    });
    expect(html).toContain('data-testid="transfer-sell-sold"');
    expect(html).toContain("Verkauf abgeschlossen");
    expect(html).toContain("Cash danach");
    expect(html).not.toContain("transfer-sell-preview-skeleton");
    expect(html).not.toContain("transfer-sell-preview-error");
  });

  it("Warnungen: Kader-Minimum wird zusätzlich als eigener Hinweis am Confirm markiert", () => {
    const html = render({
      marketSellPreview: makeSummary({ warnings: ["team_would_fall_under_7"] }),
    });
    expect(html).toContain('data-testid="transfer-sell-warnings"');
    expect(html).toContain("unter 7 Spieler");
    expect(html).toContain('data-testid="transfer-sell-roster-min-note"');
  });
});

describe("describeSellPreviewIssue — Einordnung der Preview-Fehler", () => {
  it("ordnet phase_blocked:sell_players:* als regulären Fensterzustand ein (kein Fehler)", () => {
    for (const phase of ["season_active", "season_completed", "transfer_buy_phase", "lineup_setup"]) {
      const issue = describeSellPreviewIssue(`phase_blocked:sell_players:${phase}`);
      expect(issue.kind).toBe("window_closed");
      expect(issue.title).toBe("Transferfenster geschlossen");
      expect(issue.message.length).toBeGreaterThan(10);
      expect(issue.message).not.toContain("phase_blocked");
    }
  });

  it("nennt beim laufenden Spielbetrieb das Saisonende als Öffnungszeitpunkt", () => {
    const issue = describeSellPreviewIssue("phase_blocked:sell_players:season_active");
    expect(issue.message).toContain("Saisonende");
    expect(issue.message).toContain("Spieltag 10");
  });

  it("lässt ausformulierte Fehlermeldungen unverändert und liefert einen nächsten Schritt", () => {
    const issue = describeSellPreviewIssue("Verkaufsvorschau konnte nicht geladen werden.");
    expect(issue.kind).toBe("error");
    expect(issue.message).toBe("Verkaufsvorschau konnte nicht geladen werden.");
    expect(issue.hint).toBeTruthy();
  });

  it("übersetzt Token-Fehler in Spieltext statt snake_case", () => {
    const issue = describeSellPreviewIssue("save_not_found");
    expect(issue.kind).toBe("error");
    expect(issue.message).not.toContain("_");
  });
});

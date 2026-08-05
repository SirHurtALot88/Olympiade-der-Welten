/**
 * GEMELDET: „wenn hier gesagt wird sponsoren + preisgeld dann training und dann kader, würde ich
 * erwarten dass wenn ich da drauf gehe auch meine verträge verlängern und spieler verkaufen kann!
 * sonst ist das n fehler im system"
 *
 * War es. Der Saisonabschluss-Bildschirm zaehlte vier Schritte auf und schickte zum Kader („Im
 * Kader kannst du verhandeln"). Am echten Spielstand in Phase `season_completed` gemessen:
 *
 *   renew_contract   GESPERRT   phase_blocked:renew_contract:season_completed
 *   sell_players     GESPERRT   phase_blocked:sell_players:season_completed
 *   buy_players      GESPERRT   phase_blocked:buy_players:season_completed
 *   set_training     GESPERRT   phase_blocked:set_training:season_completed
 *
 * Alle vier. Die Liste beschrieb einen Ablauf, den die Phase nicht zuliess — und zwar ohne es
 * zu merken, weil sie die Phase gar nicht las.
 *
 * Zwei Dinge fehlten: ein Weg vom Saisonende bis zur ersten Phase mit offenem Transferfenster
 * (vier Stationen), und die Bereitschaft der Liste, ueberhaupt nach der Phase zu fragen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GamePhase } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { getPhaseAfterStep, isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { SEASON_TRANSITION_STEPS } from "@/lib/season/season-transition-steps";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const panel = () => read("app/foundation/season-v2/FoundationSeasonFinalePanel.tsx");

/** Saisonende nachgestellt: letzter Spieltag gerechnet, Ergebnis liegt vor. */
const mkState = (phase: GamePhase) =>
  ({
    gamePhase: phase,
    season: { id: "s1", currentMatchday: 10, matchdayIds: Array.from({ length: 10 }, (_, i) => `md-${i + 1}`) },
    matchdayState: { matchdayId: "md-10", status: "resolved" },
    seasonState: { matchdayResults: [{ seasonId: "s1", matchdayId: "md-10" }] },
  }) as never;

describe("Saisonabschluss: die Checkliste verspricht nichts, was die Phase verbietet", () => {
  it("in season_completed ist WIRKLICH alles gesperrt, was die Liste anbot", () => {
    // Der gemeldete Zustand. Faellt eine dieser Sperren je weg, ist der Schritt „Transferfenster
    // öffnen" halb ueberfluessig — das soll auffallen, nicht stillschweigend passieren.
    const state = mkState("season_completed");
    for (const action of ["renew_contract", "sell_players", "buy_players", "set_training"] as const) {
      expect(evaluateGamePhaseAction(state, action).allowed, `${action} sollte gesperrt sein`).toBe(false);
    }
  });

  it("die erste Station oeffnet Verkaufen, Verlaengern und Training — aber NICHT Kaufen", () => {
    // Deshalb reicht EIN Schritt in der Liste: `preseason_management` schaltet Verhandeln,
    // Verkaufen und Training gemeinsam frei — es braucht keine drei Zeilen dafuer.
    const state = mkState("preseason_management");
    for (const action of ["renew_contract", "sell_players", "set_training"] as const) {
      expect(evaluateGamePhaseAction(state, action).allowed, `${action} sollte offen sein`).toBe(true);
    }

    // GEMELDET: „Man soll noch NICHT kaufen. Kaufen findet in S2 vor MD1 statt! Das muss sauber
    // getrennt sein". War es nicht: `preseason_management` stand in `TRANSFER_BUY_PHASES`, der
    // Knopf im Saisonabschluss schaltete genau dorthin, und die Zeile sagte es sogar laut
    // („verkaufen und kaufen sind freigeschaltet"). Ohne den Fix ist diese Zeile rot.
    const kauf = evaluateGamePhaseAction(state, "buy_players");
    expect(kauf.allowed, "Kaufen gehoert nicht ans Saisonende").toBe(false);
    expect(kauf.reason).toBe("phase_blocked:buy_players:preseason_management");
  });

  it("Kaufen oeffnet dort, wo Chris es haben will: neue Saison, vor dem 1. Spieltag", () => {
    // Der Weg, den die Checkliste selbst geht — verkaufen/verlaengern, dann „Neue Saison
    // starten". Danach steht der Spielstand auf `season_active` mit offenem Spieltag 1, und
    // GENAU dort geht das Kaufen auf (`isEarlySeasonTransferSetup`).
    const neueSaison = {
      gamePhase: "season_active",
      season: { id: "s2", currentMatchday: 1, matchdayIds: Array.from({ length: 10 }, (_, i) => `s2-md-${i + 1}`) },
      matchdayState: { matchdayId: "s2-md-1", status: "open" },
      seasonState: { matchdayResults: [] },
    } as never;

    expect(evaluateGamePhaseAction(neueSaison, "buy_players").allowed).toBe(true);
  });

  it("die beiden Fenster ueberlappen nirgends", () => {
    // „Das muss sauber getrennt sein" als Regel, nicht als Einzelfall: es darf KEINE
    // Saisonende-Phase geben, in der Kaufen und Verkaufen gleichzeitig offen sind.
    const beide: GamePhase[] = [];
    for (const step of SEASON_TRANSITION_STEPS) {
      const phase = getPhaseAfterStep(step);
      if (!phase) continue;
      const state = mkState(phase);
      if (
        evaluateGamePhaseAction(state, "buy_players").allowed &&
        evaluateGamePhaseAction(state, "sell_players").allowed
      ) {
        beide.push(phase);
      }
    }
    expect(beide, "Phasen mit gleichzeitig offenem Kauf- und Verkaufsfenster").toEqual([]);
  });

  it("die Liste liest die Regel, statt sie nachzubauen", () => {
    // Ein eigener Phasenvergleich in der Ansicht waere eine zweite Vorstellung davon, was
    // erlaubt ist — und genau daran koennte sie wieder etwas versprechen, das der Server
    // ablehnt. Sie fragt deshalb dieselbe Funktion wie die Route.
    const text = panel();
    expect(text).toContain('evaluateGamePhaseAction(gameState, "renew_contract")');
    expect(text).toContain("onOpenTransferWindow");
  });

  it("schickt nicht in den Kader, solange dort nichts geht", () => {
    // Der Kern der Meldung: ein Knopf, der irgendwohin fuehrt, wo die Handlung gesperrt ist.
    const text = panel();
    const zeile = text.slice(text.indexOf('key: "contracts"'), text.indexOf('key: "next-season"'));
    expect(zeile).toContain("sellWindowOpen ? { label: \"Zum Kader\"");
    expect(zeile).toContain("Verhandeln geht erst, wenn das Verkaufsfenster offen ist.");
  });

  it("die Zeile verspricht kein Kaufen mehr — und sagt, wann es dran ist", () => {
    // Die Beschriftung war der zweite Teil der Meldung: „Transferfenster öffnen" klang nach
    // allem auf einmal. Sie heisst jetzt nach dem, was sie wirklich aufmacht.
    const text = panel();
    const zeile = text.slice(text.indexOf('key: "transfer-window"'), text.indexOf('key: "contracts"'));
    expect(zeile).toContain('title: "Verkäufe & Verträge öffnen"');
    expect(zeile).not.toContain("verkaufen und kaufen sind freigeschaltet");
    expect(zeile).toContain("vor dem 1. Spieltag");
  });
});

describe("isSeasonEndPhase: der Bildschirm verschwindet nicht mitten im Ablauf", () => {
  it("kennt jede Station der Kette, nicht nur die ersten beiden", () => {
    // Vorher stand in der Router-Bedingung `season_completed || season_review` — die Liste war
    // also genau ab dem Moment weg, in dem der Spieler ueber den Rueckblick hinaus war und die
    // restlichen Schritte noch vor sich hatte.
    expect(isSeasonEndPhase("season_completed")).toBe(true);
    for (const step of SEASON_TRANSITION_STEPS) {
      const phase = getPhaseAfterStep(step);
      if (!phase) continue;
      expect(isSeasonEndPhase(phase), `Saisonende-Phase nicht erkannt: ${phase}`).toBe(true);
    }
  });

  it("haelt die laufende Saison heraus", () => {
    expect(isSeasonEndPhase("season_active")).toBe(false);
    expect(isSeasonEndPhase(null)).toBe(false);
    expect(isSeasonEndPhase(undefined)).toBe(false);
  });

  it("wird abgeleitet, nicht aufgezaehlt — sonst driftet sie mit der naechsten Station", () => {
    const quelle = read("lib/season/season-transition-chain.ts");
    expect(quelle).toContain("SEASON_TRANSITION_STEPS.map(getPhaseAfterStep)");
  });
});

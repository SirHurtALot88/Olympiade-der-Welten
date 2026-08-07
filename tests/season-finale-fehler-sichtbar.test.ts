/**
 * GEMELDET: „habe saisonwechsel prüfen gedrückt dann kam so ne meldung dass training etc
 * geschrieben wird ich hab ok gedrückt aber es passiert nix"
 * und danach: „nein die Funktionalität muss ohne Cockpit gegeben sein"
 *
 * BEFUND, am echten Spielstand nachgemessen: der Klick hatte NICHTS geschrieben. Der Abzug des
 * Servers stand vorher wie nachher auf Saison 1 / Spieltag 10 / `season_end_management`, mit
 * unveraendertem `updated_at`. Derselbe Ablauf gegen eine KOPIE desselben Spielstands rueckte
 * dagegen sauber auf Saison 2 vor — es lag also nicht an den Daten.
 *
 * URSACHE, mit Zeile: `runPreSeasonNextSeasonSetup` (`lib/foundation/tabs/cockpit-handlers.ts:305`)
 * legt jede Ablehnung in `preSeasonWorkflowError` ab. Der Router reicht das an das Cockpit weiter,
 * wo es als roter Text erscheint (`FoundationCockpitPanel.tsx:2704`) — an das Saisonfinale-Panel
 * aber nicht: dessen Props hatten ueberhaupt kein Fehlerfeld. Wer den Saisonwechsel auf der
 * dafuer gebauten Seite startete, bekam bei einer Ablehnung nichts zu sehen.
 *
 * Dazu kam ein fehlender Weg: `sponsor_choice` blockiert den Wechsel mit
 * `manual_sponsor_choice_pending` (`preseason-workflow-service.ts:1229`), doch die Schrittliste
 * kannte diesen Schritt nicht. Der Start scheiterte an etwas, das die Seite nicht erwaehnte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PANEL = read("app/foundation/season-v2/FoundationSeasonFinalePanel.tsx");
const BODY = read("app/foundation/FoundationShellRouterBody.tsx");
const CSS = read("app/globals.css");

describe("Saisonabschluss: der Knopf darf nicht stumm scheitern", () => {
  it("kennt das Panel ueberhaupt ein Fehlerfeld", () => {
    // Genau das fehlte: ohne diese Prop kann die Seite eine Ablehnung gar nicht ausdruecken.
    expect(PANEL).toContain("workflowError");
  });

  it("zeigt das Panel den Fehlertext auch an, nicht nur entgegennehmen", () => {
    // Eine Prop, die niemand rendert, waere derselbe stumme Knopf mit mehr Zeilen.
    expect(PANEL).toContain('data-testid="season-finale-error"');
    expect(PANEL).toMatch(/\{workflowError \?/);
    // Als Alarm ausgezeichnet, damit Vorlesewerkzeuge ihn nicht verschlucken.
    expect(PANEL).toContain('role="alert"');
  });

  it("reicht der Router den Fehler an die Seite durch", () => {
    // Der Wert lag im Router bereit und ging nur ans Cockpit — hier ist der zweite Empfaenger.
    expect(BODY).toContain("workflowError={preSeasonWorkflowError}");
  });

  it("nennt offene Blocker im Klartext statt als Servercode", () => {
    expect(PANEL).toContain('data-testid="season-finale-blockers"');
    expect(PANEL).toContain("manual_sponsor_choice_pending");
    // Der rohe Code allein waere wieder Cockpit-Sprache.
    expect(PANEL).toContain("Es fehlt noch eine Sponsorenwahl.");
    expect(BODY).toContain("workflowBlockingReasons={preSeasonWorkflowFeed?.blockingReasons ?? []}");
  });

  it("fuehrt bei offener Sponsorenwahl aus der Liste heraus zur Sponsorenseite", () => {
    // Chris' Vorgabe: „die Funktionalität muss ohne Cockpit gegeben sein".
    expect(PANEL).toContain('key: "sponsor-choice"');
    expect(PANEL).toContain("Zu den Sponsoren");
    expect(PANEL).toContain("onOpenSponsors");
    expect(BODY).toContain("onOpenSponsors={() => openPrizeFinanceView()}");
    expect(BODY).toContain("sponsorChoicePending");
  });

  it("zeigt den Sponsoren-Schritt nur, wenn wirklich eine Wahl aussteht", () => {
    // Sonst stuende dauerhaft ein Schritt in der Liste, der nichts zu tun hat.
    expect(PANEL).toMatch(/sponsorChoicePending > 0/);
  });

  it("sind Fehler und Blocker auch sichtbar gestaltet", () => {
    // Ohne Stil waere der Text ein grauer Absatz zwischen anderen grauen Absaetzen.
    expect(CSS).toContain(".nl-season-finale-error");
    expect(CSS).toContain(".nl-season-finale-blockers");
  });
});

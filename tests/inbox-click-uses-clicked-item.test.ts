/**
 * GEMELDET (Chris): „ich hatte auch oft dass ich zu training wollte über die inbox message und dann
 * zur team ansicht weitergeleitet wurde."
 *
 * Die Ziele der Inbox-Einträge waren korrekt — sie wurden nur nie gelesen. Der Klick-Handler bekam
 * die `itemId` der angeklickten Karte übergeben und warf sie weg (`_itemId`); nachgeschlagen wurde
 * stattdessen der gerade AUSGEWÄHLTE Eintrag, und ohne Auswahl der ERSTE der Liste.
 *
 * Drei Dinge mussten zusammenkommen, damit daraus zuverlässig ein falsches Ziel wird:
 *
 *   1. Die CTA-Knöpfe rufen `stopPropagation()` — ein Klick auf „Training öffnen" setzt die Auswahl
 *      also gar nicht erst auf die eigene Karte.
 *   2. Beim ersten Öffnen der Inbox ist nichts ausgewählt, es greift also der Rückfall auf Eintrag 0.
 *   3. Diese Liste ist NICHT nach Dringlichkeit sortiert. Kapitän, Sponsor und Vertragsauflösung —
 *      alle mit Ziel `teams` — stehen dort oft vor den Trainings-Einträgen.
 *
 * Der frühere Fix `e574215` konnte das nicht heilen: Er hat die Ziele in `game-inbox-service.ts`
 * berichtigt, also die Datenquelle. Der Fehler saß eine Ebene darüber.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type Eintrag = { itemId: string; targetView: string };

/** Die Regel aus dem reparierten Handler: der ANGEKLICKTE Eintrag zählt. */
function zielDesKlicks(eintraege: Eintrag[], geklickteId: string): string | null {
  return eintraege.find((eintrag) => eintrag.itemId === geklickteId)?.targetView ?? null;
}

/** Die alte Regel, zum Vergleich: der ausgewählte Eintrag, sonst der erste der Liste. */
function zielAlt(eintraege: Eintrag[], _geklickteId: string, ausgewaehlt: string | null): string | null {
  const id = ausgewaehlt ?? eintraege[0]?.itemId;
  return eintraege.find((eintrag) => eintrag.itemId === id)?.targetView ?? null;
}

/**
 * Die Reihenfolge bildet den echten Fall nach: `captain_missing` (Ziel `teams`) wird vor den
 * Trainings-Einträgen gebaut und steht deshalb vorn.
 */
const INBOX: Eintrag[] = [
  { itemId: "captain_missing", targetView: "teams" },
  { itemId: "sponsor_choice_missing", targetView: "teams" },
  { itemId: "training_missing", targetView: "trainingCompact" },
  { itemId: "player_fatigue_risk", targetView: "trainingCompact" },
];

describe("Inbox-Klick — der angeklickte Eintrag entscheidet", () => {
  /** DER GEMELDETE FEHLER, als Vorher-Nachher. */
  it("ein Trainings-Eintrag führt ins Training, nicht in die Team-Ansicht", () => {
    expect(zielDesKlicks(INBOX, "training_missing")).toBe("trainingCompact");
    // Die alte Regel bewies das Gegenteil: ohne Auswahl gewann Eintrag 0 — und der zeigt auf `teams`.
    expect(zielAlt(INBOX, "training_missing", null)).toBe("teams");
  });

  it("gilt für jeden Eintrag, nicht nur für den ersten", () => {
    for (const eintrag of INBOX) {
      expect(zielDesKlicks(INBOX, eintrag.itemId)).toBe(eintrag.targetView);
    }
  });

  /**
   * Der zweite Teil des Fehlers: Eine VORHER angeklickte andere Karte zog das Ziel mit sich. Wer
   * erst den Kapitän-Hinweis ansah und dann „Training öffnen" klickte, landete wieder im Kader.
   */
  it("eine zuvor ausgewählte andere Karte zieht das Ziel nicht mehr mit", () => {
    expect(zielDesKlicks(INBOX, "player_fatigue_risk")).toBe("trainingCompact");
    expect(zielAlt(INBOX, "player_fatigue_risk", "captain_missing")).toBe("teams");
  });

  it("ein unbekannter Eintrag navigiert gar nicht, statt irgendwohin", () => {
    expect(zielDesKlicks(INBOX, "gibt-es-nicht")).toBeNull();
  });
});

/**
 * Die Regel muss auch wirklich im gerenderten Handler stehen. Der bisherige Vertragstest prüfte nur,
 * ob der Name `FoundationShellRouterInboxV2` irgendwo im Quelltext vorkommt — das erfüllte schon die
 * tote Import-Zeile, und genau deshalb ist der Fehler durchgerutscht.
 */
describe("Inbox-Klick — die Regel steht im gerenderten Handler", () => {
  const body = readFileSync(join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8");

  it("der Handler benutzt die übergebene itemId", () => {
    expect(body).toContain("onRunChoice={(itemId, choiceId) => {");
    // Die Gegenprobe ist der eigentliche Test: der verworfene Parameter darf nicht zurückkommen.
    expect(body).not.toContain("onRunChoice={(_itemId");
  });

  it("der alte Rückfall auf den ersten Eintrag ist weg", () => {
    expect(body).not.toContain("inboxV2Items.find((item: InboxV2Item) => item.id === (inboxV2SelectedItemId");
  });

  /** Ohne `onOpenItem` wählt ein Klick auf die Karte nur aus, statt zu navigieren. */
  it("ein Klick auf die Karte selbst navigiert ebenfalls", () => {
    expect(body).toContain("onOpenItem={(itemId) => {");
  });
});

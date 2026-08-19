import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deriveGlobalNextUi } from "@/lib/foundation/tabs/foundation-global-next-actions";
import { isPrimaryInboxCandidate } from "@/lib/foundation/game-inbox-service";
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
    title: "Board-Ziel verfehlt: Formkarten-Ausbeute: Ligarang vor dem unteren Viertel",
    description: "Aktuell 12 · Ziel 8",
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
   * DAS WAR A2: der Knopf trug „Board-Ziel verfehlt: For…" — einen ZUSTAND statt einer Handlung,
   * dazu abgeschnitten. Er zog `primaryInboxItem.title`, und der ist absichtlich lang.
   *
   * Jetzt geht `ctaLabel` vor. Der Zustand bleibt im `title` des Knopfes, wo Platz dafuer ist.
   */
  it("nimmt den Handlungstext des Eintrags, nicht seinen Zustand", () => {
    const ui = deriveGlobalNextUi({
      ...eingabe(),
      primaryInboxItem: inboxItem({ ctaLabel: "Board-Ziele ansehen" }),
    });
    expect(ui.globalNextLabel).toBe("Board-Ziele ansehen");
    // Der Zustand geht nicht verloren — er steht im Tooltip.
    expect(ui.globalNextTitle).toBe(
      "Board-Ziel verfehlt: Formkarten-Ausbeute: Ligarang vor dem unteren Viertel: Aktuell 12 · Ziel 8",
    );
  });

  it("faellt auf den Titel zurueck, wenn ein Eintrag keinen Handlungstext hat — nie auf leer", () => {
    const ui = deriveGlobalNextUi(eingabe({ primaryInboxItem: inboxItem() }));
    expect(ui.globalNextLabel).toBe(
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

/**
 * DER RIEGEL: WER AUF DEN KNOPF KANN, BRAUCHT EINEN HANDLUNGSTEXT.
 *
 * `ctaLabel` war an 20 Eintraegen gesetzt und wurde von KEINER Anzeige gelesen — die Rechnung war
 * da, die Anzeige holte sie nicht ab. Zwei Eintraege hatten gar keinen, darunter ausgerechnet der
 * mit 74 Zeichen Titel, den Chris abgeschnitten auf dem Knopf sah.
 *
 * GEMESSEN am echten Spielstand (Season 1, Spieltag 10): 27 Eintraege koennen auf die Leiste.
 * Laengste Beschriftung vorher 74 Zeichen, nachher 20; der Median lag schon immer bei 15.
 *
 * Dieser Fall liest den Quelltext von `game-inbox-service.ts` und prueft jeden `createItem`-Block
 * mit einer waehlbaren Kategorie. Das ist eine Quelltext-Pruefung mit den bekannten Grenzen —
 * aber sie faengt den Fall, um den es geht: einen NEUEN Eintragsbauer ohne `ctaLabel`.
 */
describe("Jeder Eintrag, der auf die Weiter-Leiste kann, sagt was er tut", () => {
  /** Kategorien, die `isPrimaryInboxCandidate` unabhaengig von der Dringlichkeit durchlaesst. */
  const IMMER_WAEHLBAR = ["task", "warning", "sponsor", "training", "contract"];

  it("das Praedikat und die Kategorienliste hier sagen dasselbe", () => {
    // Ohne diese Kopplung koennte die Liste oben veralten und der Riegel unbemerkt aufgehen.
    for (const category of IMMER_WAEHLBAR) {
      const item = { status: "open", category, severity: "info" } as unknown as GameInboxItem;
      expect(isPrimaryInboxCandidate(item)).toBe(true);
    }
    expect(isPrimaryInboxCandidate({ status: "open", category: "news", severity: "info" } as never)).toBe(false);
    // Geschlossene Eintraege kommen nie auf den Knopf.
    expect(isPrimaryInboxCandidate({ status: "done", category: "task", severity: "critical" } as never)).toBe(false);
  });

  it("kein createItem-Aufruf mit waehlbarer Kategorie ohne ctaLabel", () => {
    const quelle = readFileSync(join(process.cwd(), "lib/foundation/game-inbox-service.ts"), "utf8");

    // Jeden `createItem({ … })`-Aufruf per Klammerzaehlung schneiden — eine Regex haelt bei
    // verschachtelten Objekten nicht.
    const bloecke: string[] = [];
    let index = quelle.indexOf("createItem({");
    while (index !== -1) {
      let tiefe = 0;
      let ende = index + "createItem(".length;
      for (; ende < quelle.length; ende += 1) {
        const zeichen = quelle[ende];
        if (zeichen === "(" || zeichen === "{") tiefe += 1;
        else if (zeichen === ")" || zeichen === "}") {
          tiefe -= 1;
          if (tiefe === 0) break;
        }
      }
      bloecke.push(quelle.slice(index, ende + 1));
      index = quelle.indexOf("createItem({", ende);
    }
    // Absicherung gegen einen leeren Treffersatz.
    expect(bloecke.length).toBeGreaterThanOrEqual(30);

    /*
     * KOMMENTARE RAUS, BEVOR GEPRUEFT WIRD — sonst prueft der Riegel gegen sich selbst.
     *
     * Erster Anlauf suchte das Wort `ctaLabel` irgendwo im Block. Die Gegenprobe (das echte
     * `ctaLabel` entfernen) blieb GRUEN: der erklaerende Kommentar daneben nennt das Feld
     * ebenfalls, und der Block enthielt den Namen damit weiter. Ein Riegel, den die eigene
     * Begruendung aufhaelt, ist keiner.
     *
     * Geprueft wird jetzt die ZUWEISUNG (`ctaLabel:`) in kommentarfreiem Quelltext.
     */
    const ohneKommentare = (block: string) =>
      block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    const ohne = bloecke
      .filter((block) => IMMER_WAEHLBAR.some((kategorie) => block.includes(`category: "${kategorie}"`)))
      .filter((block) => !/\bctaLabel\s*:/.test(ohneKommentare(block)))
      .map((block) => {
        const titel = /title:\s*([^\n]{0,70})/.exec(block);
        return titel ? titel[1]!.trim() : block.slice(0, 60);
      });

    expect(ohne).toEqual([]);
  });
});

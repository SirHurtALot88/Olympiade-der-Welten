/**
 * GEMELDET: „ich finde auch das verkaufsfenster sollte ggf als drawer oder so rein kommen schon
 * wenn man den spieler in der zeile anklickt, damit man auch bei spielern die man nicht verkaufen
 * will direkt sehen kann was das board dazu sagt!"
 *
 * Die Board-Bilanz („Verkaufen X · Halten Y" samt Dafür/Dagegen) war bis hierher nur zu sehen,
 * wenn man den Verkauf schon eingeleitet hatte — also genau bei den Spielern, bei denen man
 * ohnehin entschieden hatte. Für die Frage „soll ich den überhaupt abgeben?" war sie unerreichbar.
 *
 * Der Test hält die zwei Dinge fest, an denen so eine Ansicht erfahrungsgemäß scheitert:
 *
 *  1. Der Drawer rechnet NICHT selbst, sondern zeigt dieselbe Vorschau wie die Verkaufsseite und
 *     rendert sie mit derselben Komponente. (Sonst hätten wir wieder zwei Antworten auf eine
 *     Frage — genau das war der Buyout-Bug eine Meldung vorher.)
 *  2. Der Weg dahin ist verdrahtet: Zeile klickbar → Scope lädt → Drawer gemountet. Ohne das
 *     wäre der Drawer eine Komponente, die es könnte, und niemand, der sie öffnet.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const DRAWER = quelle("app/foundation/teams-v2/FoundationRosterSellPeekDrawer.tsx");
const PANEL = quelle("app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx");
const SCOPE = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const SELL_HOST = quelle("app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx");
const BOARD = quelle("app/foundation/transfermarkt-v2/TransferSellBoardBalance.tsx");

describe("Board-Bilanz: eine Komponente, zwei Orte", () => {
  it("die Verkaufsseite rendert die Bilanz nicht mehr selbst", () => {
    expect(SELL_HOST).toContain("<TransferSellBoardBalance");
    // Die Auszeichnung der Gründe steckt jetzt ausschließlich in der geteilten Komponente.
    expect(SELL_HOST).not.toContain('className="transfer-sell-reason is-for"');
    expect(BOARD).toContain('className="transfer-sell-reason is-for"');
  });

  it("der Drawer rendert dieselbe Komponente", () => {
    expect(DRAWER).toContain("<TransferSellBoardBalance");
  });

  it("die Risiko-Bestätigung bleibt beim Verkaufen und wandert nicht in den Drawer", () => {
    // Sie sperrt den Confirm-Button — im Drawer gibt es nichts zu bestätigen.
    expect(SELL_HOST).toContain('data-testid="transfer-sell-risk-ack"');
    expect(DRAWER).not.toContain("transfer-sell-risk-ack");
    expect(BOARD).not.toContain("transfer-sell-risk-ack");
  });
});

describe("Kader-Drawer: der Weg von der Zeile zur Einschätzung", () => {
  it("die Kaderzeile öffnet den Drawer statt des Verkaufs", () => {
    expect(PANEL).toContain("onRowClick={");
    expect(PANEL).toContain("openMarketSellPeek(");
  });

  it("Preview-Zeilen bleiben stumm — zu ihnen gibt es keinen Kaderspieler", () => {
    const klick = PANEL.slice(PANEL.indexOf("onRowClick={"), PANEL.indexOf("renderCell={renderNlContractCell}"));
    expect(klick).toContain('row.status !== "active"');
  });

  it("der Drawer ist in der Kaderansicht gemountet", () => {
    expect(PANEL).toContain("<FoundationRosterSellPeekDrawer");
  });

  it("der Scope holt die Einschätzung von derselben Route wie der Verkauf", () => {
    const laden = SCOPE.slice(
      SCOPE.indexOf("async function openMarketSellPeek("),
      SCOPE.indexOf("function closeMarketSellPeek("),
    );
    expect(laden).toContain('fetch("/api/transfermarkt/sell"');
    expect(laden).toContain("dryRun: true");
  });

  it("der Drawer benutzt einen EIGENEN Zustand, nicht den des Verkaufsdialogs", () => {
    // Teilten sich beide den Zustand, würde ein Klick auf eine Kaderzeile die halb ausgefüllte
    // Verkaufsseite darunter mit fremden Daten überschreiben.
    const laden = SCOPE.slice(
      SCOPE.indexOf("async function openMarketSellPeek("),
      SCOPE.indexOf("function closeMarketSellPeek("),
    );
    expect(laden).toContain("setMarketSellPeekPreview");
    expect(laden).not.toContain("setMarketSellPreview(");
    expect(laden).not.toContain("setFoundationPanel(");
  });

  it("ohne Verkaufsrecht am Team öffnet der Drawer gar nicht", () => {
    const laden = SCOPE.slice(
      SCOPE.indexOf("async function openMarketSellPeek("),
      SCOPE.indexOf("function closeMarketSellPeek("),
    );
    expect(laden).toContain("canManageTeamId(effectiveTeamId)");
  });

  it("führt aus dem Drawer weiter in den echten Verkauf", () => {
    expect(DRAWER).toContain('data-testid="roster-sell-peek-open-sell"');
    const uebergang = SCOPE.slice(
      SCOPE.indexOf("async function openMarketSellFromPeek("),
      SCOPE.indexOf("function closeMarketSellModal("),
    );
    expect(uebergang).toContain("closeMarketSellPeek()");
    expect(uebergang).toContain("openMarketSellModal(");
  });

  it("springt beim Übergang trotz Fokus-Rückgabe an den Anfang", () => {
    /**
     * Im Browser gemessen: nach dem Übergang stand die Seite wieder bei 966px, obwohl
     * `openMarketSellModal` an den Anfang scrollt. Die Fokusfalle des Drawers gibt den Fokus
     * beim Schließen an die geklickte Kaderzeile zurück, und der Browser scrollt die ins Bild —
     * erst nachdem React das Schließen committet hat, also NACH dem scrollTo. Der Sprung muss
     * deshalb der letzte sein, sonst ist der gemeldete Bug wieder da.
     */
    const uebergang = SCOPE.slice(
      SCOPE.indexOf("async function openMarketSellFromPeek("),
      SCOPE.indexOf("function closeMarketSellModal("),
    );
    expect(uebergang).toContain("requestAnimationFrame");
    expect(uebergang.indexOf("closeMarketSellPeek()")).toBeLessThan(uebergang.indexOf("requestAnimationFrame"));
  });

  it("rendert per Portal in die Shell — nicht in den Body und nicht an Ort und Stelle", () => {
    // An Ort und Stelle greift `position: fixed` nicht (transformierter Vorfahr); in
    // `document.body` fehlen `.is-new-look` und die Team-Farben (Inline-Style auf <main>).
    expect(DRAWER).toContain("createPortal(");
    expect(DRAWER).toContain('document.querySelector<HTMLElement>("main.foundation-shell")');
  });

  it("vergleicht wie der Verkaufsdialog den BRUTTO-Preis mit dem Marktwert", () => {
    // Derselbe Fix wie im Dialog: der Buyout hängt am Vertrag und gehört nicht in die Aussage
    // über den Wert des Spielers.
    expect(DRAWER).toContain("const aufschlag = brutto != null && marktwert != null ? brutto - marktwert : null;");
  });

  it("lässt sich mit Esc schließen und hält den Fokus", () => {
    expect(DRAWER).toContain('event.key === "Escape"');
    expect(DRAWER).toContain("useFocusTrap(open, panelRef)");
    expect(DRAWER).toContain('role="dialog"');
  });
});

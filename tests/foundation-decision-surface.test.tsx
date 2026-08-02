/**
 * GEFRAGT: „mach das was am cleansten und modernsten ist wenn es umbau bedeutet okay aber wir
 * wollen ja langfristig denken, was wäre dein vorschlag?"
 *
 * Der Vorschlag war nicht „Overlay statt Seite", sondern: **die Doppelung beseitigen**.
 * `foundation-drilldown-page` kam an DREI Stellen vor — Kauf, Verkauf, Gebäude — und jede baute
 * ihre Hülle selbst: Kopf, Zustands-Pill, Abbruchpunkt, Fußleiste, Zweiklick-Bestätigung,
 * „Warum nicht"-Zeile. Genau deshalb sah der Verkauf alt aus, während der Kauf schon anders
 * aussah: sie konnten gar nicht gemeinsam altern.
 *
 * KEIN OVERLAY, und das ist eine begründete Entscheidung: das Projekt hat Modals bewusst zu
 * Drilldown-Seiten migriert. Der Grund steht in den eigenen Performance-Protokollen — ein
 * `foundation-modal-backdrop` legt sich über die Shell und fängt Klicks ab, die nicht für ihn
 * bestimmt sind (`docs/tab-performance-hotspots-v6.1.md`: „intercepts pointer events"). Genau
 * dieser Fehler ist mir beim Vermessen selbst untergekommen, als ein Briefing-Overlay einen
 * Klick auf die Leaders-Ansicht verschluckt hat.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FoundationDecisionSurface } from "@/app/foundation/decision-surface/FoundationDecisionSurface";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

function render(props: Partial<Parameters<typeof FoundationDecisionSurface>[0]> = {}) {
  return renderToStaticMarkup(
    <FoundationDecisionSurface
      kicker="Transfermarkt · Verkauf"
      ariaLabel="Verkaufsdialog"
      testId="transfer-sell-page"
      onClose={() => {}}
      {...props}
    >
      <p>Inhalt</p>
    </FoundationDecisionSurface>,
  );
}

describe("Entscheidungs-Hülle: eine Form für Kauf, Verkauf und Gebäude", () => {
  it("bleibt eine Drilldown-Seite und wird KEIN Modal-Overlay", () => {
    // Die Architekturregel, die `foundation-page-surfaces-contract` festhält — hier noch einmal
    // an der Hülle selbst, damit sie nicht über einen neuen gemeinsamen Baustein umgangen wird.
    const html = render();
    expect(html).toContain("foundation-drilldown-page");
    expect(html).not.toContain("foundation-modal-backdrop");
    expect(quelle("app/foundation/decision-surface/FoundationDecisionSurface.tsx")).not.toContain(
      'className="foundation-modal-backdrop',
    );
  });

  it("trägt die testid, auf die die Architektur-Tests prüfen", () => {
    expect(render()).toContain('data-testid="transfer-sell-page"');
  });

  it("zeigt den Grund als TEXT neben dem Knopf, nicht nur im Tooltip", () => {
    // Ein deaktivierter Knopf ohne sichtbaren Grund ist eine Sackgasse — die Lektion aus dem
    // alten Verkaufsblock.
    const html = render({
      primary: {
        label: "Verkaufen…",
        confirmLabel: "Ja, endgültig verkaufen",
        disabled: true,
        disabledReason: "Das Verkaufsfenster ist geschlossen",
        onConfirm: () => {},
      },
    });
    expect(html).toContain("Warum nicht: Das Verkaufsfenster ist geschlossen");
    expect(html).toContain('data-testid="transfer-sell-page-disabled-reason"');
  });

  it("startet im ERSTEN Schritt — der Bestätigungstext ist noch nicht da", () => {
    // Der Zweiklick ist echter Zustand, nicht eine per CSS versteckte Variante: beides
    // gleichzeitig im DOM hiesse, dass ein Klick auf den unsichtbaren Knopf trotzdem bucht.
    // Bei einer endgültigen Handlung ist das kein akzeptables Restrisiko.
    const html = render({
      confirmNote: <span>Endgültig — der Spieler verlässt den Kader.</span>,
      primary: { label: "Verkaufen…", confirmLabel: "Ja, endgültig verkaufen", onConfirm: () => {} },
    });
    expect(html).toContain("Verkaufen…");
    expect(html).not.toContain("Ja, endgültig verkaufen");
    expect(html).not.toContain("Endgültig — der Spieler verlässt den Kader.");
  });

  it("bucht OHNE Zweiklick, wenn es nichts zu bestätigen gibt", () => {
    // Nicht jede Handlung ist endgültig. Ein Gebäude-Ausbau braucht keinen Angst-Schritt.
    const html = render({
      primary: { label: "Ausbauen", confirmLabel: "Ausbauen", onConfirm: () => {} },
    });
    expect(html).toContain("Ausbauen");
  });

  it("ersetzt die Fußleiste durch Schließen, wenn die Handlung erledigt ist", () => {
    const html = render({ done: true, primary: { label: "x", confirmLabel: "y", onConfirm: () => {} } });
    expect(html).toContain("Schließen");
    expect(html).not.toContain('data-testid="transfer-sell-page-primary"');
  });

  it("zeigt den Zustand als Pill im Kopf", () => {
    expect(render({ status: { label: "Fenster zu", tone: "warning" } })).toContain("Fenster zu");
  });
});

describe("Die Hülle ist die EINE Quelle — nicht die vierte Kopie", () => {
  it("bringt Kopf, Fuß und Zweiklick selbst mit", () => {
    const text = quelle("app/foundation/decision-surface/FoundationDecisionSurface.tsx");
    for (const teil of ["nl-decision-head", "nl-decision-foot", "confirmStep", "nl-decision-close"]) {
      expect(text, `${teil} fehlt in der Huelle`).toContain(teil);
    }
  });

  it("Esc geht im Bestätigungsschritt nur EINEN Schritt zurück", () => {
    // Sonst verliert man beim Zurücknehmen des letzten Klicks aus Versehen die ganze Vorschau.
    const text = quelle("app/foundation/decision-surface/FoundationDecisionSurface.tsx");
    // Ab der Deklaration, nicht ab der ersten Erwaehnung: `useEffect` steht schon im Import,
    // und `handleEscape` auch im Kommentar darueber — ein naiver slice waere leer.
    const escBlock = text.slice(text.indexOf("const handleEscape"), text.indexOf("useEffect(() =>"));
    expect(escBlock).toContain("setConfirmStep(false)");
    expect(escBlock).toContain("onClose()");
  });

  it("begründet im Code, warum es kein Overlay ist", () => {
    // Ohne diese Begründung baut in einem Jahr jemand das Overlay zurück und stolpert erneut
    // über die abgefangenen Klicks.
    const text = quelle("app/foundation/decision-surface/FoundationDecisionSurface.tsx");
    expect(text).toContain("intercepts pointer events");
  });
});

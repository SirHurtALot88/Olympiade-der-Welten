/**
 * Der Kauf war die DRITTE Kopie derselben Hülle — Kopf, Zustands-Pill, Fußleiste,
 * „Warum nicht"-Zeile, jeweils selbst gebaut. Genau diese Doppelung war der Grund, warum
 * Verkauf und Kauf unterschiedlich aussahen: sie konnten gar nicht gemeinsam altern.
 *
 * Diese Suite hält fest, dass der Kauf die Hülle wirklich BENUTZT und nicht bloß importiert,
 * und dass die eine Eigenschaft erhalten bleibt, die den Kauf von Verkauf und Ausbau
 * unterscheidet: er hat zwei Schritte, nicht einen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");
const host = () => quelle("app/foundation/transfermarkt-v2/FoundationMarketBuyShellHost.tsx");

describe("Kaufdialog sitzt auf der geteilten Entscheidungs-Hülle", () => {
  it("rendert die Hülle, statt sie nur zu importieren", () => {
    expect(host()).toContain("<FoundationDecisionSurface");
  });

  it("baut Kopf und Fußleiste nicht mehr selbst", () => {
    const text = host();
    for (const eigenbau of [
      "foundation-drilldown-header",
      "foundation-modal-actions",
      'className="foundation-drilldown-page',
    ]) {
      expect(text, `${eigenbau} ist noch Eigenbau`).not.toContain(eigenbau);
    }
  });

  it("behält die verdrahteten Testids — E2E-Skripte hängen daran", () => {
    const text = host();
    expect(text).toContain('testId="transfer-offer-page"');
    expect(text).toContain('buttonTestId: "transfer-buy-confirm-button"');
    expect(text).toContain('disabledReasonTestId: "transfer-buy-disabled-reason"');
  });

  /**
   * Der Grund, warum die Hülle überhaupt einen zweiten Knopf bekommen hat: „Verhandeln" ist
   * kein zweiter Hauptknopf, sondern ein vorgelagerter Schritt. Wäre es ein zweiter Primary,
   * könnte man den Abschluss vor der Annahme klicken.
   */
  it("hält die Reihenfolge: erst verhandeln, dann abschließen", () => {
    const text = host();
    expect(text).toContain("secondary={{");
    expect(text).toContain("Schritt 1: Verhandeln");
    expect(text).toContain("Schritt 2: Kauf final abschließen");
    // Der Abschluss bleibt gesperrt, solange keine Annahme vorliegt.
    expect(text).toContain('buyNegotiationOutcome?.status !== "accepted"');
  });

  it("zeigt keinen Zweiklick — der Kauf hat seinen Sicherheitsschritt schon im Ablauf", () => {
    // `confirmNote` schaltet in der Hülle den Zweiklick frei. Beim Kauf wäre er der DRITTE
    // Schritt hintereinander und damit reine Reibung: die Annahme der Gegenseite ist bereits
    // der Moment, in dem man innehält.
    expect(host()).not.toContain("confirmNote=");
  });

  it("meldet den Trotz-Aufschlag erst, wenn er gilt — keine Ankündigung vor dem Klick", () => {
    // Chris, 10.11.: „die warnung darf doch nicht auftauchen bevor ich verhandle!!! das macht es
    // ja sonst zu einfach". Sichtbar ist nur der schon festgeschriebene Aufschlag; was ein Klick
    // auslösen WÜRDE, verrät die Hülle nicht mehr.
    const text = host();
    expect(text).toContain('data-testid="transfer-buy-defiance-active"');
    expect(text).not.toContain('data-testid="transfer-buy-defiance-pending"');
    expect(text).not.toContain("buyPreview?.pendingDefianceSurchargePct");
  });
});

describe("Der Tooltip erklärt die Verhandlungsgedächtnisse an einer Stelle", () => {
  it("trägt Trotz und Erwiderung im Geschichts-Bündel, aber keinen angekündigten Trotz", () => {
    // Verteilt auf mehrere Ecken der Oberfläche wäre jedes einzeln ein Rätsel. Die Frage lautet
    // „warum ist seine Forderung anders als eben?" — und die hat genau eine Antwortstelle.
    // Der angekündigte Trotz (was ein Klick auslösen WÜRDE) ist seit 10.11. bewusst raus:
    // Verhandeln soll ein Risiko sein, keine Vorhersage.
    const text = quelle("lib/foundation/tabs/use-market-buy-derivations.ts");
    const block = text.slice(text.indexOf('id: "history"') - 2600, text.indexOf('id: "history"'));
    expect(block).toContain("buyPreview.defianceSurchargePct");
    expect(block).not.toContain("buyPreview.pendingDefianceSurchargePct");
    expect(block).toContain("concededFromLastCounter");
  });
});

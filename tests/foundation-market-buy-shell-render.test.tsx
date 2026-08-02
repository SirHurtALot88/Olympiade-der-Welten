/**
 * Der Kaufdialog hat seine Hülle abgegeben (Kopf, Zustands-Pill, Fußleiste, „Warum nicht"-Zeile)
 * und sitzt jetzt auf `FoundationDecisionSurface`. Quelltext-Prüfungen zeigen, dass die Hülle
 * BENUTZT wird — sie zeigen nicht, dass dabei etwas Sinnvolles herauskommt.
 *
 * Diese Suite rendert den Host wirklich und schaut ins Markup. Der Anlass ist konkret: beim
 * Umbau war die `<div>`-Bilanz kurzzeitig um eins daneben. Das war ein Übersetzungsfehler und
 * fiel auf — ein Fehler EINE Ebene tiefer (Fußleiste im Body, Knopf im falschen Zweig) hätte
 * genauso typgeprüft und wäre still geblieben.
 */
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import FoundationMarketBuyShellHost from "@/app/foundation/transfermarkt-v2/FoundationMarketBuyShellHost";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";

const VORSCHAU = {
  canBuy: true,
  blockingReasons: [],
  warnings: [],
  player: { id: "p1", name: "Umbros", className: "Bruiser", race: "Ork" },
  team: { id: "A-A", name: "Alpha", shortCode: "A-A" },
  expectedSalary: 14.72,
  baseExpectedSalary: 14.0,
  baseDemandSalary: 14.29,
  defianceSurchargePct: 0.03,
  pendingDefianceSurchargePct: 0.03,
  offeredSalary: 13.5,
  offerRatio: 0.917,
  contractLength: 3,
  contractShape: "balanced",
  demandBreakdown: [],
  negotiationScoreBreakdown: [],
  negotiationReasons: [],
  negotiationWarnings: [],
  negotiationBlockingReasons: [],
} as unknown as TransfermarktBuyPreview;

type HostProps = Parameters<typeof FoundationMarketBuyShellHost>[0];

function markup(overrides: Partial<HostProps> = {}) {
  const noop = () => {};
  return renderToStaticMarkup(
    <FoundationMarketBuyShellHost
      buyModalRef={{ current: null }}
      buyModalBodyRef={{ current: null }}
      source="sqlite"
      selectedTeam={null}
      selectedPlayer={{ playerId: "p1", name: "Umbros" } as never}
      buyModalWishlistEntry={null}
      selectedPortrait={null}
      selectedTeamCanManage
      selectedTeamId="A-A"
      buyPreview={VORSCHAU}
      previewBusy={false}
      previewError={null}
      buyBusy={false}
      buySuccess={null}
      buyNegotiationOutcome={null}
      contractLength={3}
      contractShape="balanced"
      offeredSalary={13.5}
      salaryEditedManually={false}
      derivationsInput={{} as never}
      onContractLengthChange={noop}
      onContractShapeChange={noop}
      onOfferedSalaryChange={noop}
      onSalaryEditedManuallyChange={noop}
      onBuyNegotiationOutcomeChange={noop}
      closeBuyModal={noop}
      negotiateBuy={noop}
      acceptCounterOffer={noop}
      confirmBuy={noop}
      resetBuyDemandFrame={noop}
      {...overrides}
    />,
  );
}

describe("Kaufdialog rendert auf der geteilten Hülle", () => {
  it("kommt als Drilldown-Seite heraus, nicht als Overlay", () => {
    const html = markup();
    expect(html).toContain("foundation-drilldown-page");
    expect(html).toContain("nl-decision-page");
    expect(html).toContain('data-testid="transfer-offer-page"');
    expect(html).not.toContain("foundation-modal-backdrop");
  });

  it("hat die Fußleiste der Hülle mit BEIDEN Schritten", () => {
    // Der eigentliche Grund für diese Suite: dass die Knöpfe im Markup landen und nicht in
    // einem Zweig hängenbleiben, der nie gerendert wird.
    const html = markup();
    expect(html).toContain("nl-decision-foot");
    expect(html).toContain("Schritt 1: Verhandeln");
    expect(html).toContain('data-testid="transfer-buy-confirm-button"');
    expect(html).toContain("Schritt 2: Kauf final abschließen");
  });

  it("sperrt den Abschluss, solange keine Annahme vorliegt", () => {
    const html = markup();
    const knopf = html.slice(html.indexOf('data-testid="transfer-buy-confirm-button"'));
    expect(knopf.slice(0, 200)).toContain("disabled");
  });

  it("gibt den Abschluss frei, sobald die Gegenseite angenommen hat", () => {
    const html = markup({
      buyNegotiationOutcome: { status: "accepted", tone: "success", title: "Angenommen", message: "ok" } as never,
    });
    const knopf = html.slice(html.indexOf('data-testid="transfer-buy-confirm-button"'));
    expect(knopf.slice(0, 200)).not.toContain("disabled");
  });

  it("zeigt den geltenden Trotz-Aufschlag mit BEIDEN Zahlen", () => {
    // Ohne die Ausgangsforderung daneben wäre die erhöhte Zahl für den Spieler nicht
    // nachvollziehbar — genau das war die Bedingung, unter der der Aufschlag gebaut wurde.
    const html = markup();
    expect(html).toContain('data-testid="transfer-buy-defiance-active"');
    // Gerundet wie überall im Markt (`formatTransfermarktCurrency`) — die Prüfung hängt an dem,
    // was der Spieler liest, nicht an der Rohzahl.
    expect(html).toContain("14,7 Mio statt 14,3 Mio");
    expect(html).toContain("+3 %");
  });

  it("kündigt einen NOCH NICHT geltenden Aufschlag getrennt an", () => {
    const html = markup({
      buyPreview: { ...VORSCHAU, defianceSurchargePct: 0, pendingDefianceSurchargePct: 0.03 } as TransfermarktBuyPreview,
    });
    expect(html).toContain('data-testid="transfer-buy-defiance-pending"');
    expect(html).not.toContain('data-testid="transfer-buy-defiance-active"');
  });

  it("verschweigt beides, wenn nichts vorgefallen ist", () => {
    const html = markup({
      buyPreview: { ...VORSCHAU, defianceSurchargePct: 0, pendingDefianceSurchargePct: 0 } as TransfermarktBuyPreview,
    });
    expect(html).not.toContain('data-testid="transfer-buy-defiance-active"');
    expect(html).not.toContain('data-testid="transfer-buy-defiance-pending"');
  });

  it("bleibt im Referenzmodus sichtbar, aber gesperrt", () => {
    const html = markup({ source: "prisma" });
    expect(html).toContain('data-testid="transfer-offer-page"');
    expect(html).toContain("nur Ansicht");
  });
});

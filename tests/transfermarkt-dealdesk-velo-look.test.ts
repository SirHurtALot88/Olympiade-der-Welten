/**
 * M1/M2 — Deal-Desk, Fensterstatus & Kaufdialog (Audit-Gruppe MARKT).
 *
 * Die drei Kernbefunde, die diese Suite dauerhaft festhält:
 *
 * 1. AUSWAHLBINDUNG (M2): Der Deal-Desk nannte keinen Spielernamen und rechnete nach einem
 *    Kandidatenwechsel mit dem VORHERIGEN Spieler weiter (Profil: Lotte Lance, Desk:
 *    Blacksmith). Reproduziert im Browser am 08.08.2026. Seitdem: Vorschau wird beim Wechsel
 *    sofort entwertet, ein Subjekt-Wächter verhindert das Rendern fremder Zahlen, und der
 *    Desk trägt den Namen des Kandidaten im Kopf.
 *
 * 2. ±0-VORSCHAU (M3): Bei blockiertem Deal klemmt der Server die `*After`-Felder auf
 *    „nichts passiert" (cashAfter = cashBefore …). Der Desk zeigte das als ±0 auf jeder
 *    Zeile, während daneben Ablöse 11,4 Mio stand. Die Anzeige läuft jetzt über GENAU EINE
 *    Ableitung (`buildTransfermarktDealReceipt`), die die „wenn der Kauf durchgeht"-Zahlen
 *    mit den Server-Formeln spiegelt und die Cash-Lücke ehrlich ausweist.
 *
 * 3. FENSTERSTATUS (M1): „Transferfenster geschlossen" + „kaufen ist offen" + „NUR ANSICHT"
 *    standen gleichzeitig in einem Banner. Der Status ist jetzt EIN strukturiertes Urteil.
 *
 * Dazu der Kaufdialog (M2): ein „Abbrechen", ein Primärknopf pro Schritt, „Gehalt p.a."
 * statt „Monatsgehalt", „Stört ihn" mit Umlaut, Gehaltsverteilung je Saison aus der EINEN
 * Server-Quelle (`buyPreview.yearlySalarySchedule`) — keine zweite Staffel-Rechnung im UI.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildTransfermarktDealReceipt,
  type TransfermarktDealReceiptPreview,
} from "@/lib/market/transfermarkt-deal-receipt";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const CLIENT = quelle("app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx");
const MARKUP = quelle("app/foundation/transfermarkt-v2/TransfermarktV2NewLook.tsx");
const BUY_HOST = quelle("app/foundation/transfermarkt-v2/FoundationMarketBuyShellHost.tsx");
const OFFER = quelle("app/foundation/contract-offer/ContractOfferClient.tsx");
const CSS = quelle("app/globals.css");

/* ------------------------------------------------------------------ */
/* Kassenzettel: eine Quelle, Formel-Spiegel kann nicht driften        */
/* ------------------------------------------------------------------ */

/** Blockierter Beispiel-Deal exakt nach Server-Semantik (After == Before). */
function blockierteVorschau(): TransfermarktDealReceiptPreview {
  return {
    canBuy: false,
    purchasePrice: 11.4,
    cashBefore: 7.1,
    cashAfter: 7.1,
    salary: 2.1,
    offeredSalary: 2,
    salaryBefore: 52.1,
    salaryAfter: 52.1,
    rosterBefore: 8,
    rosterAfter: 8,
    marketValueBefore: 224.1,
    marketValueAfter: 224.1,
    currentValue: 11.4,
  };
}

/** Derselbe Deal, wie ihn der Server bei canBuy=true liefern würde. */
function ausfuehrbareVorschau(): TransfermarktDealReceiptPreview {
  return {
    ...blockierteVorschau(),
    canBuy: true,
    cashAfter: Number((7.1 - 11.4).toFixed(2)),
    salaryAfter: Number((52.1 + 2).toFixed(2)),
    rosterAfter: 9,
    marketValueAfter: Number((224.1 + 11.4).toFixed(2)),
  };
}

describe("buildTransfermarktDealReceipt — der Kassenzettel des Deal-Desks", () => {
  it("blockierter Deal: die ±0-Klemme wird zur ehrlichen Hypothese", () => {
    const receipt = buildTransfermarktDealReceipt(blockierteVorschau());
    expect(receipt).not.toBeNull();
    expect(receipt!.executable).toBe(false);
    expect(receipt!.salaryAfterIfBought).toBe(54.1);
    expect(receipt!.rosterAfterIfBought).toBe(9);
    expect(receipt!.marketValueAfterIfBought).toBe(235.5);
    expect(receipt!.cashAfterIfBought).toBe(-4.3);
  });

  it("die Cash-Lücke rechnet gegen die Ablöse (das einzige, was der Kauf heute abbucht)", () => {
    const receipt = buildTransfermarktDealReceipt(blockierteVorschau());
    // 11,4 − 7,1 = 4,3 — exakt der Betrag, der dem insufficient_cash-Blocker fehlt.
    expect(receipt!.missingCash).toBe(4.3);
  });

  it("reicht das Cash, gibt es keine Lücke", () => {
    const receipt = buildTransfermarktDealReceipt({ ...ausfuehrbareVorschau(), cashBefore: 20, cashAfter: 8.6 });
    expect(receipt!.missingCash).toBeNull();
  });

  it("FORMEL-SPIEGEL-INVARIANTE: blockiert und ausführbar liefern für denselben Deal dieselben Zahlen", () => {
    // Damit kann die UI-Hypothese nie still von der Server-Rechnung wegdriften:
    // der ausführbare Zweig übernimmt die Server-After-Werte, der blockierte
    // spiegelt die Formeln — beide müssen identisch enden.
    const blockiert = buildTransfermarktDealReceipt(blockierteVorschau())!;
    const ausfuehrbar = buildTransfermarktDealReceipt(ausfuehrbareVorschau())!;
    expect(blockiert.cashAfterIfBought).toBe(ausfuehrbar.cashAfterIfBought);
    expect(blockiert.salaryAfterIfBought).toBe(ausfuehrbar.salaryAfterIfBought);
    expect(blockiert.rosterAfterIfBought).toBe(ausfuehrbar.rosterAfterIfBought);
    expect(blockiert.marketValueAfterIfBought).toBe(ausfuehrbar.marketValueAfterIfBought);
  });

  it("ausführbarer Deal: die Server-Werte werden unverändert übernommen (eine Quelle)", () => {
    const vorschau = ausfuehrbareVorschau();
    const receipt = buildTransfermarktDealReceipt(vorschau)!;
    expect(receipt.executable).toBe(true);
    expect(receipt.cashAfterIfBought).toBe(vorschau.cashAfter);
    expect(receipt.salaryAfterIfBought).toBe(vorschau.salaryAfter);
  });

  it("ohne Vorschau kein Zettel — keine erfundenen Zahlen", () => {
    expect(buildTransfermarktDealReceipt(null)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Auswahlbindung: Desk-Subjekt === ausgewählter Kandidat              */
/* ------------------------------------------------------------------ */

describe("Auswahlbindung — der Deal-Desk rechnet nie mit einem anderen Spieler", () => {
  it("Kandidatenwechsel entwertet die alte Vorschau sofort", () => {
    // Der Reset-Effekt auf [selectedPlayerId, selectedTeamId] muss die Vorschau
    // UND das Verhandlungsergebnis des vorherigen Spielers löschen.
    const effektStart = CLIENT.indexOf("M1-AUSWAHLBINDUNG");
    expect(effektStart).toBeGreaterThan(-1);
    const effekt = CLIENT.slice(effektStart, effektStart + 900);
    expect(effekt).toContain("setBuyPreview(null);");
    expect(effekt).toContain("setBuyNegotiationOutcome(null);");
    expect(effekt).toContain("[selectedPlayerId, selectedTeamId]");
  });

  it("Subjekt-Wächter: eine Vorschau mit fremder Spieler-Id wird nie gerendert", () => {
    expect(CLIENT).toContain("const boundBuyPreview = useMemo(");
    expect(CLIENT).toContain("buyPreview.player.id !== previewPlayerId");
    // Alle Desk-Zahlen und das Kauf-Modal hängen an der gebundenen Vorschau.
    expect(CLIENT).toContain("buildTransfermarktDealReceipt(boundBuyPreview)");
    expect(CLIENT).toContain("buyPreview: boundBuyPreview");
  });

  it("der Desk sagt, über wen er redet: Name + Herkunft im Kopf", () => {
    expect(MARKUP).toContain("nl-market-deal-who");
    expect(MARKUP).toContain('<strong className="nl-market-deal-who-name">{selectedPlayer.name}</strong>');
    expect(MARKUP).toContain("aus Kandidatenliste gewählt");
  });

  it("solange die Vorschau rechnet, sagt der Desk das — statt alte Zahlen zu zeigen", () => {
    expect(MARKUP).toContain("previewBusy");
    expect(MARKUP).toContain("rechnet…");
    expect(MARKUP).toContain("nl-market-deal-pending");
  });
});

/* ------------------------------------------------------------------ */
/* ±0-Vorschau: ehrliche Hypothese + Cash-Lücke                        */
/* ------------------------------------------------------------------ */

describe("Deal-Vorschau — Hypothese statt ±0", () => {
  it("die Vorher/Nachher-Zeilen sind als Hypothese beschriftet", () => {
    expect(MARKUP).toContain("Wenn der Kauf durchgeht");
  });

  it("Team-Marktwert heißt Team-MW — nicht dieselbe Abkürzung wie der Spieler-MW", () => {
    expect(MARKUP).toContain('label="Team-MW"');
    expect(BUY_HOST).toContain('label="Team-MW"');
  });

  it("die Cash-Lücke steht als Betrag im Desk und im Kauf-Modal", () => {
    expect(MARKUP).toContain("nl-market-deal-shortfall");
    expect(MARKUP).toContain("es fehlen {formatTransfermarktCurrency(previewMissingCash)}");
    expect(BUY_HOST).toContain("nl-market-deal-shortfall");
  });

  it("das Kauf-Modal nutzt DENSELBEN Kassenzettel wie der Deal-Desk", () => {
    expect(BUY_HOST).toContain("buildTransfermarktDealReceipt(buyPreview)");
    expect(BUY_HOST).toContain("dealReceipt?.salaryAfterIfBought");
    // Keine zweite Formel im Client: die alten Inline-Fallbacks sind raus.
    expect(CLIENT).not.toContain("previewCashBefore - previewPurchasePrice");
    expect(CLIENT).not.toContain("previewTeamSalaryBefore + previewAnnualSalary");
  });
});

/* ------------------------------------------------------------------ */
/* Fensterstatus: genau eine Aussage                                   */
/* ------------------------------------------------------------------ */

describe("Fensterstatus — ein Urteil statt drei Aussagen", () => {
  it("der Client liefert Ton + Titel + Badge + Detail als EIN Objekt", () => {
    expect(CLIENT).toContain("const marketWindowStatus: TransfermarktWindowStatus | null");
    expect(CLIENT).toContain('"Kauffenster offen"');
    expect(CLIENT).toContain('"Verkaufsfenster offen"');
    expect(CLIENT).toContain('"Transferfenster geschlossen"');
  });

  it("die Ansicht codiert keinen eigenen Fensterstatus mehr hart", () => {
    // Genau das war der Widerspruch: ein fixes „Transferfenster geschlossen" +
    // „nur Ansicht" über jedem Freitext — auch über „kaufen ist offen".
    // (Im erklärenden Kommentar dürfen die Worte stehen — nur nicht mehr als Markup.)
    expect(MARKUP).not.toContain("<strong>Transferfenster geschlossen</strong>");
    expect(MARKUP).not.toContain(">nur Ansicht<");
    const bannerRenders = MARKUP.match(/nl-market-window-status is-\$\{/g) ?? [];
    expect(bannerRenders).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Kaufdialog (M2)                                                     */
/* ------------------------------------------------------------------ */

describe("Kaufdialog — ein Abbrechen, ein Primärknopf pro Schritt", () => {
  it("das Angebots-Formular reicht Abbrechen/Senden nicht mehr doppelt herein", () => {
    expect(BUY_HOST).toContain("onSendOffer={null}");
    expect(BUY_HOST).toContain("onCancel={null}");
    // Das Formular rendert beide Knöpfe nur, wenn ein Handler übergeben wird.
    expect(OFFER).toContain("{onCancel ? (");
    expect(OFFER).toContain("{onSendOffer ? (");
    expect(OFFER).toContain("contract-offer-actions-note");
  });

  it('„Monatsgehalt“ ist Geschichte — das Feld trägt die echte Bezugsgröße', () => {
    // Der Begriff darf im erklärenden Kommentar stehen — nur nicht mehr als Label im Markup.
    expect(OFFER).not.toContain("<span>Monatsgehalt</span>");
    expect(OFFER).toContain("<span>Gehalt p.a. (Mio)</span>");
  });

  it('„Stört ihn“ hat seinen Umlaut', () => {
    expect(BUY_HOST).toContain("Stört ihn");
    expect(BUY_HOST).not.toContain("Stoert ihn");
  });

  it("die Wirkung von Abbrechen (Abbruch-Malus) steht VOR dem Klick im Gegenangebots-Banner", () => {
    expect(BUY_HOST).toContain("bricht die Verhandlung ab");
  });

  it("Gehaltsverteilung je Saison kommt aus der EINEN Server-Quelle — keine zweite Staffel-Rechnung", () => {
    expect(BUY_HOST).toContain("Gehaltsverteilung je Saison");
    expect(BUY_HOST).toContain("buyPreview.yearlySalarySchedule.map(");
    // Wiederverwendet, nicht neu gerechnet: keine eigene Staffel-Mathematik im Dialog.
    expect(BUY_HOST).not.toContain("calculateOpenBuyoutCost");
    expect(BUY_HOST).not.toContain("buildContractPreview");
  });
});

/* ------------------------------------------------------------------ */
/* Beidseitige Klassenprüfung der neuen Markup-Klassen                 */
/* ------------------------------------------------------------------ */

describe("Jede neue Klasse existiert beidseitig (Markup ↔ globals.css)", () => {
  const neueKlassen = [
    "nl-market-window-status",
    "nl-market-window-status-dot",
    "nl-market-window-status-copy",
    "nl-market-window-status-title",
    "nl-market-window-status-detail",
    "nl-market-window-status-badge",
    "nl-market-deal-who",
    "nl-market-deal-who-portrait",
    "nl-market-deal-who-copy",
    "nl-market-deal-who-name",
    "nl-market-deal-who-sub",
    "nl-market-deal-who-source",
    "nl-market-deal-section",
    "nl-market-deal-pending",
    "nl-market-deal-shortfall",
    "nl-market-advanced-toggle",
    "nl-market-advanced-title",
    "nl-market-advanced-count",
    "nl-market-advanced-caret",
    "nl-market-advanced-panel",
    "nl-market-candidate-numbers",
  ] as const;

  it.each([...neueKlassen])("%s: definiert in globals.css UND im Markup benutzt", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
    expect(MARKUP.includes(klasse) || BUY_HOST.includes(klasse)).toBe(true);
  });

  it("Ton-Varianten des Fensterstatus existieren für alle drei Urteile", () => {
    for (const variante of ["is-open", "is-sell", "is-closed"]) {
      expect(CSS).toMatch(new RegExp(`\\.nl-market-window-status\\.${variante}[\\s.,:{]`));
    }
  });

  it("die Abbrechen-Hinweis-Klasse des Angebots-Formulars existiert", () => {
    expect(OFFER).toContain("contract-offer-actions-note");
    expect(CSS).toContain(".contract-offer-actions-note");
  });

  it('„Deal prüfen“ ist Akzentfläche + --nl-accent-ink (gemessen: Akzent-Text auf Soft nur 4,09:1)', () => {
    const start = CSS.indexOf(".is-new-look .nl-market-primary-action,");
    const block = CSS.slice(start, CSS.indexOf("}", start));
    expect(block).toContain("background: var(--nl-accent-fill)");
    expect(block).toContain("color: var(--nl-accent-ink)");
    expect(block).not.toContain("color: var(--nl-accent)");
  });
});

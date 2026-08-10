/**
 * Paket W3 (Sponsoren-Umbau). Vier Audit-Befunde:
 *
 * 1. Liga-Übersicht: 32 Karten mit beidseitig gestutzten Namen ("Zero…" /
 *    "Jaguar La…") → sortierbare Tabelle mit vollen Team-/Sponsornamen
 *    (NlTable, geteiltes Primitiv).
 * 2. Modell-Jargon als Primärtext ("EV-NEUTRAL", "identity special",
 *    "Sponsorsystem V1 (alt)" als Pille) → Klartext bzw. stille Fußnote.
 * 3. Geldbeträge ohne Einheit (CASH/SAISON, Ø-Angebotswert, Liga-Spalte,
 *    Apron-Linien) → durchgängig `formatTransfermarktCurrency` ("… Mio").
 * 4. KPI "Ø-Angebotswert · N Angebote" blieb sichtbar, obwohl bei laufendem
 *    Vertrag gar keine Angebotskarten gerendert werden.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "app/foundation/sponsors-v2/FoundationSponsorsNewLook.tsx"),
  "utf8",
);
const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

function regel(selektor: string): string {
  const start = CSS.indexOf(`${selektor} {`);
  expect(start, `Regel fehlt: ${selektor}`).toBeGreaterThanOrEqual(0);
  return CSS.slice(start, CSS.indexOf("}", start));
}

describe("1: Liga-Übersicht ist eine sortierbare Tabelle mit vollen Namen", () => {
  it("nutzt das geteilte NlTable-Primitiv statt eines Karten-Rasters", () => {
    expect(SOURCE).toContain("<NlTable");
    expect(SOURCE).toContain("columns={leagueTableColumns}");
    expect(SOURCE).not.toContain("nl-sponsor-league-grid");
    expect(SOURCE).not.toContain("nl-sponsor-league-item");
  });

  it("Team-/Sponsorname-Spalten kürzen nicht per CSS (kein text-overflow: ellipsis)", () => {
    const teamname = regel(".is-new-look .nl-sponsor-league-teamname");
    const sponsorname = regel(".is-new-look .nl-sponsor-league-sponsorname");
    expect(teamname).not.toContain("text-overflow");
    expect(teamname).not.toContain("nowrap");
    expect(sponsorname).not.toContain("text-overflow");
    expect(sponsorname).not.toContain("nowrap");
  });

  it("Sortierung bleibt an sortLeagueSponsorRows/leagueSponsorSort gebunden", () => {
    expect(SOURCE).toContain("sortLeagueSponsorRows(leagueSponsorRows, leagueSponsorSort)");
    expect(SOURCE).toContain('onSort={(key) => setLeagueSponsorSort(key as LeagueSponsorSort)}');
  });

  it("die eigene Zeile bleibt markiert (is-current)", () => {
    expect(SOURCE).toContain('row.teamName === selectedTeamName ? "is-current"');
    expect(regel(".is-new-look .nl-sponsor-league-table.nl-table tbody tr.is-current td")).toContain(
      "--nl-accent",
    );
  });
});

describe("2: Modell-Jargon ist übersetzt", () => {
  it("'EV-neutral' ist raus, Klartext wie im freigegebenen Mockup", () => {
    // Der erklärende Code-Kommentar darf den historischen Begriff weiter
    // nennen — nur die tatsächlich gerenderte Ternary darf ihn nicht mehr
    // zurückgeben.
    expect(SOURCE).not.toContain('? "EV-neutral"');
    expect(SOURCE).toContain("ausgewogenes Bonus/Malus-Profil");
  });

  it("Vertrags-Varianten (z. B. identity_special) haben echte deutsche Labels statt roher Slugs", () => {
    expect(SOURCE).toContain("formatSponsorVariantLabel");
    expect(SOURCE).toContain("identity_special: ");
    expect(SOURCE).not.toContain("variantKey.replace(/_/g");
  });

  it("das Sponsorsystem-Badge ist eine stille Fußnote, keine umrandete Pille mehr", () => {
    const block = regel(".is-new-look .nl-sponsor-system-badge");
    expect(block).not.toContain("border:");
    expect(block).not.toContain("border-radius");
  });
});

describe("3: Geldbeträge tragen durchgängig eine Einheit", () => {
  it("die Seite nutzt formatTransfermarktCurrency statt des ungelabelten formatMoney-Props", () => {
    expect(SOURCE).toContain('import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract"');
    expect(SOURCE).toContain("const formatSponsorMoney = formatTransfermarktCurrency;");
  });

  it("kein Aufrufer im Sponsoren-Renderer nutzt noch das ungelabelte formatMoney-Prop", () => {
    // Die Prop heisst nach dem Fix `formatMoneyProp` und bleibt bewusst
    // ungenutzt (Vertrag unveraendert) — kein `formatMoney(...)`-Aufruf mehr.
    expect(SOURCE).not.toMatch(/[^.]formatMoney\(/);
  });
});

describe("4: Ø-Angebotswert-KPI verweist nicht auf unsichtbare Angebote", () => {
  it("avgOfferCashValue ist null, solange ein Vertrag aktiv ist", () => {
    const start = SOURCE.indexOf("const avgOfferCashValue = useMemo(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = SOURCE.slice(start, start + 300);
    expect(body).toContain("if (selectedTeamSponsorContract) return null;");
  });

  it("der Chip erklärt den leeren Zustand bei aktivem Vertrag statt nur '—' zu zeigen", () => {
    expect(SOURCE).toContain("Vertrag aktiv · neue Angebote zum Saisonende");
  });
});

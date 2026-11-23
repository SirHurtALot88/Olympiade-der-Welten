/**
 * MARKETING-SEITE (22.11., Bau nach docs/design/marketing-22-11.md Runde 3).
 *
 * Geprueft an der WIRKUNG: die Seite wird wirklich gerendert und im Ergebnis gelesen.
 *  - nur der EIGENE Kader (Mehrspieler: je Manager getrennt, nie ein fremdes Team), nie ein Spieler vom Markt
 *  - je Spieler die Zerlegung in drei Schritten, drei Reiter rechts, sortierbare Spalten
 *  - die Ansicht ist erreichbar (Routing-Liste, Navigation, Router) und lesend
 */
import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MarketingModern, { type MarketingKontextReiter } from "@/app/foundation/marketing/MarketingModern";
import type { GameState } from "@/lib/data/olyDataTypes";
import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { FOUNDATION_NAV_GROUPS } from "@/lib/foundation/foundation-nav-config";
import { FOUNDATION_VIEW_IDS, normalizeFoundationViewParam } from "@/lib/foundation/foundation-view-routing";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { stempleMarketingBeimAnlegen, stempleMarketingNachLaden } from "@/lib/marketing/marketing-regel";
import { marketingTeamUebersicht } from "@/lib/marketing/marketing-team";

function stand(): GameState {
  const gs = createFreshSeasonOneGameState();
  const used = new Set(gs.rosters.map((r) => r.playerId));
  const frei = gs.players.filter((p) => !used.has(p.id));
  let z = 0;
  const rosters = [...gs.rosters];
  for (const team of gs.teams.slice(0, 4)) {
    for (let i = 0; i < 8; i += 1) {
      const p = frei[(z++ * 41) % frei.length]!;
      rosters.push({ id: `ms-${team.teamId}-${i}`, teamId: team.teamId, playerId: p.id, contractLength: 2, salary: 8, upkeep: 8, purchasePrice: 10, currentValue: 10, roleTag: "bench", joinedSeasonId: gs.season.id });
    }
  }
  return stempleMarketingBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen({ ...gs, rosters }));
}

const render = (gs: GameState, teamId: string | null, startKontext: MarketingKontextReiter = "fan", startSpieler: string | null = null) =>
  renderToStaticMarkup(<MarketingModern gameState={gs} teamId={teamId} startKontext={startKontext} startSpieler={startSpieler} />);

describe("Marketing-Seite", () => {
  const gs = stand();
  const [A, B] = [gs.teams[0]!.teamId, gs.teams[1]!.teamId];

  it("zeigt nur den eigenen Kader: kein Spieler eines anderen Teams, auch nicht aus dem Pool", () => {
    const html = render(gs, A);
    const eigene = gs.rosters.filter((r) => r.teamId === A).map((r) => gs.players.find((p) => p.id === r.playerId)!);
    const fremde = gs.rosters.filter((r) => r.teamId !== A).map((r) => gs.players.find((p) => p.id === r.playerId)!);
    expect(eigene.length).toBeGreaterThan(0);
    for (const p of eigene) expect(html).toContain(`mk-zeile-${p.id}`);
    for (const p of fremde.slice(0, 40)) expect(html).not.toContain(`mk-zeile-${p.id}`);
    expect(html).not.toMatch(/Auf dem Markt/);
  });

  it("Mehrspieler: zwei Manager sehen je ihr Team, Fanprofil und Zahlen sind getrennt", () => {
    const a = render(gs, A);
    const b = render(gs, B);
    expect(a).not.toBe(b);
    const ua = marketingTeamUebersicht(gs, A);
    const ub = marketingTeamUebersicht(gs, B);
    expect(a).toContain(ua.profil.zielgruppe);
    expect(b).toContain(ub.profil.zielgruppe);
    for (const z of ub.zeilen) expect(a).not.toContain(`mk-zeile-${z.playerId}`);
  });

  it("die drei Schritte, die drei Reiter und die sortierbaren Spaltenkoepfe stehen da", () => {
    const html = render(gs, A);
    for (const t of ["1 · Reichweite", "2 · Passung zu den Fans", "3 · Team-Anteil", "Marketability", "Werbegeld", "ans Team", "an ihn"]) expect(html).toContain(t);
    for (const t of ["Fanprofil", "Spieler", "Verlauf"]) expect(html).toContain(t);
    expect(html.match(/aria-sort=/g)!.length).toBeGreaterThanOrEqual(8);
    expect(html).toContain("Dein Kader: wer wirbt, und warum?");
  });

  it("Reiter Spieler beantwortet die drei Fragen mit jedem Baustein des Team-Anteils", () => {
    const u = marketingTeamUebersicht(gs, A);
    const z = u.zeilen[0]!;
    const html = render(gs, A, "spieler", z.playerId);
    for (const t of ["Warum fällt er auf?", "Warum passt er zu deinen Fans?", "Wie viel davon bekommt das Team?", "Persönlichkeit", "Vertragslaufzeit", "Werbeklausel", "Moral", "Aushängeschild", "Teamerfolg"]) {
      expect(html).toContain(t);
    }
  });

  it("Reiter Fanprofil nennt Mögen und Meiden aus echten Rassen, Klassen, Traits und die Farbe der Fans", () => {
    const html = render(gs, A, "fan");
    expect(html).toContain("Fans mögen");
    expect(html).toContain("Fans meiden");
    expect(html).toContain("Farbe der Fans");
    for (const n of ["POW", "SPE", "MEN", "SOC"]) expect(html).toContain(n);
  });

  it("Reiter Verlauf zeigt die Regel und mindestens die Startzeile", () => {
    const html = render(gs, A, "verlauf");
    expect(html).toContain("Die Regel");
    expect(html).toMatch(/S\d+/);
  });

  it("ohne gueltige Regel (bestehender Spielstand) steht ein ehrlicher Hinweis, es wird nichts als gebucht ausgegeben", () => {
    const html = render(stempleMarketingNachLaden(stempleFinanzenJeSpieltagBeimAnlegen(createFreshSeasonOneGameState())), A);
    expect(html).toContain("mk-nicht-aktiv");
    expect(html).toContain("nächsten Saisonwechsel");
  });

  it("ohne Team: keine Zahlen, kein Absturz", () => {
    expect(render(gs, null)).toContain("Kein Team gewählt");
  });
});

describe("Marketing ist als Ansicht erreichbar", () => {
  it("steht in der Ansichts-Liste, hat einen Navigationspunkt unter Team und wird vom Router mit dem aktiven Team gerendert", () => {
    expect(FOUNDATION_VIEW_IDS).toContain("marketing");
    expect(normalizeFoundationViewParam("marketing")).toBe("marketing");
    const team = FOUNDATION_NAV_GROUPS.find((g) => g.id === "team")!;
    expect(team.items.some((i) => i.id === "marketing" && i.label === "Marketing")).toBe(true);
    const router = readFileSync("app/foundation/FoundationShellRouterBody.tsx", "utf8");
    expect(router).toContain('activeView === "marketing"');
    expect(router).toContain("<FoundationMarketingHost gameState={gameState} teamId={activeManagerTeamId} />");
    const typen = readFileSync("lib/foundation/tabs/foundation-page-types.ts", "utf8");
    expect(typen).toMatch(/\| "marketing"/);
  });

  it("die Seite schreibt nichts: kein fetch, kein POST", () => {
    const quelle = readFileSync("app/foundation/marketing/MarketingModern.tsx", "utf8") + readFileSync("app/foundation/marketing/FoundationMarketingHost.tsx", "utf8");
    expect(quelle).not.toMatch(/fetch\(|method:\s*"POST"/);
  });
});

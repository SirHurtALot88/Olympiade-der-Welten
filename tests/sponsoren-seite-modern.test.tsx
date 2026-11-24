/**
 * Sponsorenseite (24.11., Phase 4, Vorlage `public/mockups/sponsoren-modern-22-11.html`).
 * Wirkung statt Quelltext: die Seite wird wirklich gerendert (`renderToStaticMarkup`) und im Ergebnis gelesen.
 *  - jede der vier Ansichten geht auf, nichts vom alten Stil
 *  - Angebote: Passungszeile, drei Vertragsarten, Unterschreiben; mit Vertrag stattdessen die Vertragskarte
 *  - Scouting-Nebel: fremde Teams zeigen den Erwartungsrang nur als Viertel
 *  - die reinen Helfer (Nebel, Auszahlungsstufen, Faktor-Regler)
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SponsorenModern, { type SponsorenAnsicht } from "@/app/foundation/sponsors-v2/SponsorenModern";
import type { GameState } from "@/lib/data/olyDataTypes";
import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { stempleMedaillenBeimAnlegen } from "@/lib/medaillen/medaillen-regel";
import { stempleSponsorRegelBeimAnlegen } from "@/lib/resolve/sponsor-regel";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { auszahlungsZeilen, erwartungsAnzeige, topfBeiFaktor } from "@/lib/sponsors/sponsor-seite-modell";
import { sichereSponsorTopf } from "@/lib/sponsors/sponsor-topf-stichtag";
import { baueSponsorUebersicht } from "@/lib/sponsors/sponsor-uebersicht";

vi.setConfig({ testTimeout: 240_000 });

function spiel(): GameState {
  const gs = structuredClone(createSingleplayerGameState());
  gs.scenarioMeta = { ...(gs.scenarioMeta ?? {}), gameMode: "battle" } as GameState["scenarioMeta"];
  gs.seasonState.leagueByTeamId = Object.fromEntries(gs.teams.map((t, i) => [t.teamId, i < 16 ? "liga1" : "liga2"])) as never;
  return ensureSeasonSponsorOffers(stempleSponsorRegelBeimAnlegen(stempleMedaillenBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(gs))));
}

function render(gs: GameState, teamId: string, ansicht: SponsorenAnsicht, kannVerwalten = true) {
  const u = baueSponsorUebersicht(gs, teamId)!;
  return renderToStaticMarkup(
    <SponsorenModern
      gameState={gs}
      teamId={teamId}
      teamName="Testteam"
      uebersicht={u}
      kannVerwalten={kannVerwalten}
      onUnterschreiben={() => undefined}
      onTerminAntwort={() => undefined}
      meldung={null}
      beschaeftigt={null}
      startAnsicht={ansicht}
    />,
  );
}

describe("Sponsorenseite modern", () => {
  const ohne = spiel();
  const team = ohne.teams[3]!.teamId;
  const mit = sichereSponsorTopf(chooseSponsorOfferForAiTeams(ohne, Object.fromEntries(ohne.teams.map((t) => [t.teamId, { controlMode: "ai" }])) as never));

  it("ohne Vertrag: Angebote mit Passung, drei Vertragsarten und Unterschreiben; keine Seltenheitsstufe", () => {
    const html = render(ohne, team, "angebote");
    expect(html).toContain('data-testid="sponsoren-modern"');
    expect(html).toContain("Passung");
    expect(html).toContain(">Fest<");
    expect(html).toContain(">Prämie<");
    expect(html).toContain("Unterschreiben");
    expect(html).toContain("KI wählen lassen");
    expect(html).not.toContain("nl-");
    expect(html).not.toMatch(/gewöhnlich|legendär/);
  });

  it("mit Vertrag: Vertragskarte mit Grundbetrag groß je Saison und klein je Spieltag", () => {
    const html = render(mit, team, "vertrag");
    expect(html).toContain("Hauptsponsor");
    expect(html).toContain("Hochrechnung Saison");
    expect(html).toContain("je Spieltag");
    expect(html).toContain("Farb-Partner");
  });

  it("Liga-Vergleich: 16 Zeilen, alle Spalten sortierbar, fremde Erwartungsränge nur als Viertel", () => {
    const html = render(mit, team, "liga");
    expect((html.match(/<tr/g) ?? []).length).toBe(17);
    expect((html.match(/aria-sort=/g) ?? []).length).toBe(14);
    expect(html).toMatch(/\d–\d/);
    expect(html).toContain('data-testid="sponsoren-liga-eigen"');
  });

  it("Rechenansicht: vier Schritte, Regler, Liga-Bilanz", () => {
    const html = render(mit, team, "rechnung");
    expect(html).toContain("Was kostet die Liga?");
    expect(html).toContain('type="range"');
    expect(html).toContain("Liga-Bilanz");
  });

  it("ohne Verwaltungsrecht ist Unterschreiben gesperrt", () => {
    const html = render(ohne, team, "angebote", false);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Unterschreiben/);
  });
});

describe("Sponsorenseite: Helfer", () => {
  it("Nebel: eigenes Team exakt, fremdes als Viertel; Nebel aus macht alles exakt", () => {
    const gs = { scenarioMeta: {} } as Pick<GameState, "scenarioMeta">;
    expect(erwartungsAnzeige(gs, true, 2.4).exakt).toBe(true);
    expect(erwartungsAnzeige(gs, false, 6.2)).toMatchObject({ text: "5–8", sort: 5, exakt: false });
    expect(erwartungsAnzeige(gs, false, 15.7).text).toBe("13–16");
    expect(erwartungsAnzeige({ scenarioMeta: { scoutingNebelAus: true } } as never, false, 6.2).exakt).toBe(true);
  });

  it("Auszahlungsstufen: Erwartung hat Leistung 0, Rang 1 ist am besten", () => {
    const z = auszahlungsZeilen(60, 2.5, 2);
    expect(z.find((s) => s.erwartung)).toMatchObject({ rang: 2, leistung: 0, summe: 60 });
    expect(z[0]!.rang).toBe(1);
    expect(z[0]!.summe).toBeGreaterThan(z[z.length - 1]!.summe);
  });

  it("Faktor-Regler: derselbe Faktor ändert nichts, ein höherer hebt den Topf", () => {
    const r = { betriebsteil: 1000, kaderErsatz: 200, uebertrag: -10, topf: 1150, farbToepfe: { liga1: 48, liga2: 36 }, treueSumme: 0, hauptTopf: 1000, betriebsteilRoh: 1000, ligaMittelBeiErwartung: 0, schritte: [] };
    expect(topfBeiFaktor(r, 1, 1).differenz).toBe(0);
    expect(topfBeiFaktor(r, 1, 1.05).differenz).toBeCloseTo(60, 0);
  });
});

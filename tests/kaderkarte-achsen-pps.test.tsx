/**
 * GEMELDET VON CHRIS: „schau dass endlich die PPs von POW SPE MEN SOC hier angezeigt werden …
 * die PPs fehlen da immernoch, dafür hab ich schon nen Agent beauftragt aber das ist wohl nie
 * passiert."
 *
 * BEFUND, warum das zweimal versandet ist: die Kaderkarte bekam die PPs nie geliefert.
 * `FoundationPlayerPortraitCard` nimmt `pow/spe/men/soc` entgegen — das sind aber die
 * ATTRIBUTWERTE (29/35/60/63), und genau die rendert der Orbit-Ring. Wer nur an der Anzeige
 * suchte, fand vier Achsenzahlen und nichts zu reparieren; es waren bloß die falschen. Die
 * Saison-PPs je Achse liegen woanders (`PlayerRatingContractRow.ppPow/…` samt Ligarang).
 *
 * Deshalb prüft diese Datei BEIDES — und zwar getrennt:
 *
 *  1. Die Karte rendert die PPs, wenn sie sie bekommt, UND zeigt sie neben den Attributen
 *     statt an deren Stelle. (Verhalten)
 *  2. Der Weg dahin ist verdrahtet: Rating-Zeile → Kaderdaten → Aufrufer → Karte. (Kontrakt)
 *
 * Ohne (2) wäre (1) genau der Zustand, der schon zweimal für „gebaut" gehalten wurde: eine
 * Karte, die es könnte, und niemand, der ihr die Zahlen gibt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";

const root = process.cwd();

function renderCard(props: Partial<React.ComponentProps<typeof FoundationPlayerPortraitCard>> = {}) {
  return renderToString(
    <FoundationPlayerPortraitCard
      playerId="P-1"
      name="Ilvathra"
      portraitUrl={null}
      portraitInitials="IL"
      playerOvr={68.1}
      playerMvs={15.5}
      playerPps={14.4}
      pow={29}
      spe={35}
      men={60}
      soc={63}
      variant="team"
      newLook
      interactive={false}
      {...props}
    />,
  );
}

describe("Kaderkarte zeigt die Saison-PPs je Achse", () => {
  const axisPps = {
    pow: 8.2,
    powRank: 4,
    spe: 1.1,
    speRank: 187,
    men: 3.5,
    menRank: 42,
    soc: 1.6,
    socRank: 120,
  };

  it("rendert Wert und Ligarang je Achse", () => {
    const html = renderCard({ axisPps });
    expect(html).toContain("foundation-player-portrait-pps");
    expect(html).toContain("8,2");
    expect(html).toContain("#4");
    expect(html).toContain("#187");
  });

  it("ersetzt die Attributzeile NICHT — beide Achsenzeilen stehen nebeneinander", () => {
    // Der Kern des Befunds: PPs und Attribute sind zwei verschiedene Größen mit denselben
    // vier Namen. Verschwände beim Einbau der PPs der Attributwert, wäre der Fehler nur
    // umgedreht statt behoben.
    const html = renderCard({ axisPps });
    expect(html).toContain("foundation-player-portrait-orbit");
    expect(html).toContain(">29<");
    expect(html).toContain("8,2");
  });

  it("die Zeile steht IMMER — vor der ersten Wertung als ehrlicher Leerzustand mit Erklärung", () => {
    // Chris-Regel („PPs und MVS auch bei 0 beibehalten", bei 0/— wird erklärt, nicht
    // versteckt): Saisonstart heißt „—" plus „füllen sich ab Spieltag 1" — dieselbe
    // Formulierung wie an den PPs-/MVS-Chips derselben Karte, keine zweite erfinden.
    const html = renderCard({
      axisPps: { pow: null, powRank: null, spe: null, speRank: null, men: null, menRank: null, soc: null, socRank: null },
    });
    expect(html).toContain("foundation-player-portrait-pps");
    expect(html).toContain("PPs je Achse");
    expect(html).toContain("—");
    expect(html).toContain("füllen sich ab Spieltag 1");
  });

  it("null heißt noch-nichts-gewertet, 0 heißt 0-geholt — beide Zustände bleiben unterscheidbar", () => {
    // `null` = Aussage über die Liga (noch kein Spieltag gewertet) → „—" ohne Rang.
    // `0` mit Wertung = Aussage über den Spieler → „0" MIT Ligarang.
    const nullHtml = renderCard({
      axisPps: { pow: null, powRank: null, spe: null, speRank: null, men: null, menRank: null, soc: null, socRank: null },
    });
    expect(nullHtml).not.toContain("<em>#");
    const zeroHtml = renderCard({
      axisPps: { pow: 0, powRank: 344, spe: 0, speRank: 344, men: 0, menRank: 344, soc: 0, socRank: 344 },
    });
    expect(zeroHtml).toContain(">0<");
    expect(zeroHtml).toContain("<em>#344</em>");
    expect(zeroHtml).toContain("Liga-Rang 344");
  });

  it("nur ganz ohne axisPps-Verdrahtung gibt es keine Zeile (unverdrahtete Aufrufer)", () => {
    expect(renderCard()).not.toContain("foundation-player-portrait-pps");
  });

  it("die PPs-Zeile steht ZWISCHEN Kennzahlen und Attributzeile (Chris' Zeilenfolge)", () => {
    // „[OVR PPS MVS] — darunter die PPs je Achse — darunter wie bisher die stats."
    const html = renderCard({ axisPps });
    const statsAt = html.indexOf("foundation-player-portrait-stats");
    const ppsAt = html.indexOf("foundation-player-portrait-pps");
    const orbitAt = html.indexOf("foundation-player-portrait-orbit");
    expect(statsAt).toBeGreaterThanOrEqual(0);
    expect(ppsAt).toBeGreaterThan(statsAt);
    expect(orbitAt).toBeGreaterThan(ppsAt);
  });

  it("die PPs-Zeile trägt ihre Kopfzeile — zwei Größen unter denselben vier Kürzeln brauchen ein Etikett", () => {
    const html = renderCard({ axisPps });
    expect(html).toContain("foundation-player-portrait-pps-caption");
    expect(html).toContain("PPs je Achse");
  });
});

describe("OVR/PPs/MVS in EINER Zeile — der Rang klebt nicht mehr im Wert", () => {
  it("der Liga-Rang ist ein eigener Knoten (em) neben dem Wert, nicht in den Wert geklebt", () => {
    const html = renderCard({ ovrRank: 20, ppsRank: 344, mvsRank: 10 });
    // Wert und Rang getrennt: kein "68,1 · #20" mehr, sondern <em>#20</em> im Chip.
    expect(html).not.toContain("· #20");
    expect(html).toContain("<em>#20</em>");
    // Ränge sind bis dreistellig — auch #344 bleibt ein eigener Knoten statt Chip-Breite.
    expect(html).toContain("<em>#344</em>");
  });

  it("Wert + Rang stehen nebeneinander mit automatischem Rückfall (flex-wrap, beidseitig)", () => {
    // Chris: „rank neben punkte, wir wollen platz sparen" — inline, wo es passt
    // (gemessen: alle Echt- und Extremwerte bis hinunter zu 206 px Kartenbreite);
    // darunter rutscht NUR der Rang unter den Wert, statt abzureißen.
    const html = renderCard({ ovrRank: 20, ppsRank: 32, mvsRank: 10, axisPps: { pow: 8.2, powRank: 4, spe: 1.1, speRank: 187, men: 3.5, menRank: 42, soc: 1.6, socRank: 120 } });
    expect(html).toContain("foundation-player-portrait-metric-line");
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    expect(css).toMatch(/\.foundation-player-portrait-metric-line\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.foundation-player-portrait-metric-line\s*\{[^}]*flex-wrap:\s*wrap/);
  });

  it("bei genau drei Kennzahl-Chips schaltet das CSS den Umbruch ab (beidseitig)", () => {
    const html = renderCard({ ovrRank: 20, ppsRank: 32, mvsRank: 10 });
    expect(html).toContain('data-stat-count="3"');
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    expect(css).toContain('.foundation-player-portrait-stats[data-stat-count="3"]');
    expect(css).toMatch(/\.foundation-player-portrait-stats\[data-stat-count="3"\]\s*\{\s*flex-wrap:\s*nowrap/);
    // Beidseitige Absicherung der neuen Klassen/Knoten (CSS-Klassen fallen still durch):
    expect(css).toMatch(/\.foundation-player-portrait-pps-caption[\s.,:{[>)]/);
    expect(css).toMatch(/\.foundation-player-portrait-stat em[\s.,:{[>)]/);
  });
});

describe("Der Weg der PPs bis zur Karte ist durchgehend verdrahtet", () => {
  it("die Kaderdaten übernehmen die Achsen-PPs samt Rang aus der Rating-Zeile", () => {
    const builder = readFileSync(join(root, "lib/foundation/tabs/use-foundation-cross-tab-teams-roster.ts"), "utf8");
    expect(builder).toContain("axisPps:");
    for (const field of ["ppPow", "ppPowRank", "ppSpe", "ppSpeRank", "ppMen", "ppMenRank", "ppSoc", "ppSocRank"]) {
      expect(builder, `${field} wird nicht durchgereicht`).toContain(field);
    }
  });

  it("das Kader-Portrait-Raster gibt sie an die Karte weiter", () => {
    const view = readFileSync(join(root, "app/foundation/team-profile/TeamProfileNewLook.tsx"), "utf8");
    expect(view).toContain("axisPps={player.axisPps");
  });

  it("auch die Home-Top-6 bekommen die Achsen-PPs aus der Rating-Zeile", () => {
    // Chris' Screenshot war die HOME-Karte — ohne diese Verdrahtung wäre der Umbau
    // wieder nur „eine Karte, die es könnte, und niemand, der ihr die Zahlen gibt".
    const hook = readFileSync(join(root, "lib/foundation/tabs/use-home-v2-overview-derivations.ts"), "utf8");
    for (const field of ["ppPow", "ppPowRank", "ppSpe", "ppSpeRank", "ppMen", "ppMenRank", "ppSoc", "ppSocRank"]) {
      expect(hook, `${field} wird nicht durchgereicht`).toContain(field);
    }
    const home = readFileSync(join(root, "app/foundation/home-v2/HomeV2NewLook.tsx"), "utf8");
    expect(home).toContain("axisPps={player.axisPps");
  });

  it("die Teams-Portraitraster reichen sie über buildAxisPpsFromRating durch", () => {
    const teams = readFileSync(join(root, "app/foundation/teams-v2/FoundationTeamsNewLook.tsx"), "utf8");
    expect(teams).toContain("axisPps={buildAxisPpsFromRating(playerRatingsById?.get(player.id))}");
    const panel = readFileSync(join(root, "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8");
    expect(panel).toContain("axisPps={buildAxisPpsFromRating(ratings)}");
  });
});

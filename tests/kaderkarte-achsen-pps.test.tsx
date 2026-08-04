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

  it("ohne PPs-Daten bleibt die Zeile weg, statt vier Nullen zu zeigen", () => {
    // Saisonstart: noch kein Spieltag gewertet. Vier Nullen läsen sich wie ein Datenfehler.
    expect(renderCard()).not.toContain("foundation-player-portrait-pps");
    expect(
      renderCard({ axisPps: { pow: null, powRank: null, spe: null, speRank: null, men: null, menRank: null, soc: null, socRank: null } }),
    ).not.toContain("foundation-player-portrait-pps");
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
});

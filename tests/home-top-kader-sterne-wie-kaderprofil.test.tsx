import fs from "node:fs";
import path from "node:path";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { pickHomeTopPlayerStarFields, type HomeV2RosterTableRow } from "@/lib/foundation/tabs/home-v2-ui-helpers";

/**
 * Chris, 10.11.: „auf der Home Seite stimmen die CA/PO sterne nicht" — die Karten
 * „Top-Kader · Deine besten 6" zeigten andere PO-Sterne als dieselben Spieler im
 * Kaderprofil (Portraits).
 *
 * Am Live-Abbild nachgemessen (Samsuin): Kaderprofil PO 4–4,5★ (Sterne-Bridge,
 * Scouting-Level 5), Home dagegen `potentialRangeDisplay` 52–78 aus dem Trainings-
 * Forecast (ungescoutete Scout-Spanne) plus `known` fest auf true → die Karte malte
 * das MAXIMUM der Spanne als sicheren Stern: 5★. CA war auf beiden Seiten gleich.
 *
 * Fix: Home reicht die Sternfelder der Kaderzeile (`buildRosterCaPoStarFields`)
 * unverändert durch — dieselbe Quelle wie das Kaderprofil.
 */

const ROW: HomeV2RosterTableRow = {
  entry: { playerId: "p-samsuin", teamId: "T-1" } as HomeV2RosterTableRow["entry"],
  player: { id: "p-samsuin", name: "Samsuin" } as HomeV2RosterTableRow["player"],
  playerOvr: 60,
  playerMvs: 6,
  playerPps: 40,
  // So liefert `buildRosterCaPoStarFields` die Zeile für Samsuin am Live-Abbild.
  known: true,
  caStars: 3,
  poStarRange: { min: 4, max: 4.5 },
  caScore: 52.4,
  poScoreRange: { min: 52, max: 78 },
};

function abilityLabel(html: string): string {
  const match = html.match(/data-testid="foundation-player-portrait-ability-stars"[\s\S]*?aria-label="([^"]+)"/);
  if (!match) throw new Error("Sterne-Zeile nicht gerendert");
  return match[1]!;
}

function renderCard(starProps: Record<string, unknown>, variant: "home" | "team") {
  return abilityLabel(
    renderToString(
      <FoundationPlayerPortraitCard
        playerId="p-samsuin"
        name="Samsuin"
        portraitUrl={null}
        portraitInitials="SA"
        playerOvr={60}
        playerMvs={6}
        playerPps={40}
        pow={50}
        spe={60}
        men={50}
        soc={50}
        variant={variant}
        context={variant === "home" ? "teamGrid" : "roster"}
        newLook
        known
        {...starProps}
      />,
    ),
  );
}

describe("Home-Topkader zeigt dieselben CA/PO-Sterne wie das Kaderprofil", () => {
  it("dieselbe Kaderzeile ergibt auf Home und im Kaderprofil dasselbe Sterne-Label", () => {
    const home = pickHomeTopPlayerStarFields(ROW);
    const homeLabel = renderCard(
      {
        known: home.starsKnown,
        caStars: home.caStars,
        poStarRange: home.poStarRange,
        caScore: home.caScore,
        poScoreRange: home.poScoreRange,
      },
      "home",
    );
    // Prop-Satz exakt wie `TeamProfileNewLook` ihn übergibt.
    const kaderprofilLabel = renderCard(
      {
        known: ROW.known,
        caStars: ROW.caStars,
        poStarRange: ROW.poStarRange,
        caScore: ROW.caScore,
        poScoreRange: ROW.poScoreRange,
      },
      "team",
    );
    expect(homeLabel).toBe(kaderprofilLabel);
    expect(homeLabel).toContain("Potenzial 4,5 Sterne");
  });

  it("der alte Home-Pfad (Forecast-Spanne + known fest true) hätte 5★ gezeigt", () => {
    const alterPfad = renderCard({ known: true, caScore: 52.4, poScoreRange: { min: 52, max: 78 } }, "home");
    expect(alterPfad).toContain("Potenzial 5 Sterne");
  });

  it("der Fog-Status der Kaderzeile wird durchgereicht, nicht fest auf true gesetzt", () => {
    expect(pickHomeTopPlayerStarFields({ ...ROW, known: false }).starsKnown).toBe(false);
    const home = fs.readFileSync(path.join(process.cwd(), "app/foundation/home-v2/HomeV2NewLook.tsx"), "utf8");
    expect(home).toContain("known={player.starsKnown}");
    expect(home).not.toMatch(/\n\s+known\n/);
    const derivations = fs.readFileSync(
      path.join(process.cwd(), "lib/foundation/tabs/use-home-v2-overview-derivations.ts"),
      "utf8",
    );
    expect(derivations).not.toContain("forecast?.currentAbilityStars");
    expect(derivations).not.toContain("forecast?.potentialStars");
  });
});

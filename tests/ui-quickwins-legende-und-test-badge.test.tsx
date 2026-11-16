import fs from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CLASS_COLOR_LEGEND, getClassColorToken } from "@/app/foundation/classVisuals";
import PortraitFrameLegend from "@/components/foundation/player-portrait-card/PortraitFrameLegend";
import { FOUNDATION_NAV_GROUPS } from "@/lib/foundation/foundation-nav-config";
import { PLAYER_STAR_TIERS } from "@/lib/foundation/player-star-tier";

/**
 * Fable-UI/UX-Brainstorm 14.11., Vorschlag 9 (Farblegende für den Kaderkartenrand) und 13
 * („Battle Arena" als Testwerkzeug kenntlich machen).
 */

const ROOT = path.resolve(__dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

describe("Kartenrand-Legende", () => {
  it("nennt jede Klasse genau einmal, passend zur Farbe, die der Kartenrand wirklich trägt", () => {
    const alleKlassen = CLASS_COLOR_LEGEND.flatMap((eintrag) => eintrag.classes);
    expect(new Set(alleKlassen).size).toBe(alleKlassen.length);
    for (const eintrag of CLASS_COLOR_LEGEND) {
      expect(eintrag.classes.length).toBeGreaterThan(0);
      for (const klasse of eintrag.classes) {
        expect(getClassColorToken(klasse)).toBe(eintrag.token);
      }
    }
  });

  it("zeigt alle vier Star-Stufen mit den Schwellen aus player-star-tier und die Klassenstreifen", () => {
    const html = renderToStaticMarkup(<PortraitFrameLegend variant="teams" />);
    for (const stufe of PLAYER_STAR_TIERS) {
      expect(html).toContain(stufe.shortLabel);
      expect(html).toContain(`is-${stufe.tier}`);
    }
    for (const eintrag of CLASS_COLOR_LEGEND) {
      expect(html).toContain(`is-${eintrag.token}`);
    }
    expect(html).not.toContain("Top-6");
  });

  it("Home ergänzt den positionsbasierten Rand der eigenen Top-6, Teams nicht", () => {
    expect(renderToStaticMarkup(<PortraitFrameLegend variant="home" />)).toContain("Top-6");
  });

  it("hängt an Home (Top-Kader) und an der Teams-Kaderansicht", () => {
    expect(read("app/foundation/home-v2/HomeV2NewLook.tsx")).toContain('<PortraitFrameLegend variant="home" />');
    expect(read("app/foundation/teams-v2/FoundationTeamsNewLook.tsx")).toContain('<PortraitFrameLegend variant="teams" />');
  });
});

describe("Battle Arena in der Sidebar", () => {
  const item = FOUNDATION_NAV_GROUPS.flatMap((gruppe) => gruppe.items).find((eintrag) => eintrag.id === "battleArena");

  it("bleibt in der Navigation, trägt aber die Kennzeichnung Test und erklärt den Unterschied zur Arena", () => {
    expect(item).toBeDefined();
    // Das Label bleibt unverändert: Breadcrumb und Inbox-Zielnamen lesen es als Ansichtsnamen.
    expect(item?.label).toBe("Battle Arena");
    expect(item?.badge).toBe("Test");
    expect(item?.tooltip).toContain("Testwerkzeug");
    expect(item?.tooltip).toContain("„Arena“");
  });

  it("nur die Battle Arena trägt eine Kennzeichnung", () => {
    const mitBadge = FOUNDATION_NAV_GROUPS.flatMap((gruppe) => gruppe.items).filter((eintrag) => eintrag.badge);
    expect(mitBadge.map((eintrag) => eintrag.id)).toEqual(["battleArena"]);
  });

  it("die Sidebar rendert die Kennzeichnung", () => {
    expect(read("app/foundation/shell/FoundationSidebar.tsx")).toContain("foundation-sidebar-item-badge");
  });
});

describe("Inbox-Tonrand und Training-Chips (Nachmessung im Browser)", () => {
  const css = read("app/globals.css");

  it("der Tonrand der Inbox-Karten schlägt die Team-Theme-Regel `.nl-card { border-color }`", () => {
    // Ohne diese Regel war der linke Rand bei JEDER Karte der Team-Akzent (Spezifität 0,3,0 gegen 0,2,0).
    expect(css).toContain(".is-new-look[data-team-theme] .nl-inbox-card {\n  border-left-color: var(--nl-tone);");
    expect(css).toContain(".is-new-look[data-team-theme] .nl-inbox-card.is-critical");
  });

  it("Training: Vorschlag (Stern) und passt bereits (Haken) tragen verschiedene Farben", () => {
    expect(css).toContain(".is-new-look .nl-training-chip.is-class-match");
    const text = read("app/foundation/training-compact/TrainingCompactNewLook.tsx");
    expect(text).toContain('kind="signature"');
    expect(text).toContain('kind="match"');
  });

  it("Spielerprofil: MVS vor der ersten Wertung ohne erfundenen Rang", () => {
    expect(read("app/foundation/PlayerDetailDrawer.tsx")).toContain("rank: mvsAlsGuete(data.mvs) != null ? data.mvsRank : null");
  });
});

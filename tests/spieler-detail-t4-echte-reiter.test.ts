/**
 * Paket T4 (Spieler-Detail): Reiter-Klicks müssen zuverlässig scrollen, und
 * OVR/PPs/MVS stehen nur noch an einer Stelle statt doppelt.
 *
 * Befund D3 (Audit „Team"): die Reiter oben (Stats · Details · Vertrag …)
 * sind Scroll-Anker mit einem gemeinsamen `suppressScrollRef`-Flag zwischen
 * Klick-Navigation und Scroll-Beobachtung. Reproduziert am laufenden
 * Dev-Server (Playwright): nach einem schnellen Scroll durch mehrere
 * Sektionen blieb das Flag "true" hängen, der nächste Tab-Klick markierte
 * sich selbst als aktiv, scrollte aber nicht mehr — Seite und Reiter liefen
 * dauerhaft auseinander. Der Fix gibt dem expliziten Klick einen eigenen Ref,
 * der IMMER gewinnt, unabhängig vom Zustand des Beobachtungs-Flags.
 *
 * Befund D4: OVR/PPs/MVS erschienen zweimal in derselben Bildschirmhöhe
 * (Hero-StatChips direkt über der KPI-Kartenreihe, `player-drawer-kpi-hero-
 * grid`) — dieselben drei Zahlen, unterschiedlich gerahmt. Die Kartenreihe
 * hat mehr Kontext (Rang, Vorsaison-Delta, Liga-Leaders-Link) und bleibt die
 * einzige Quelle; die Hero-Zeile zeigt nur noch MW/Gehalt/Vertrag, was sonst
 * nirgends steht.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CLIENT = readFileSync(
  join(process.cwd(), "app/foundation/player-profile/PlayerProfileClient.tsx"),
  "utf8",
);
const HERO = readFileSync(join(process.cwd(), "app/foundation/PlayerHeroNewLook.tsx"), "utf8");
const DRAWER = readFileSync(join(process.cwd(), "app/foundation/PlayerDetailDrawer.tsx"), "utf8");

describe("D3: Tab-Klick gewinnt immer gegen ein hängendes Scroll-Beobachtungs-Flag", () => {
  it("führt einen eigenen Ref für explizite Klicks, unabhängig von suppressScrollRef", () => {
    expect(CLIENT).toContain("explicitSelectRef");
    expect(CLIENT).toContain("handleTabSelect");
  });

  it("der Klick-Handler markiert das Explizit-Flag VOR dem Tab-Wechsel", () => {
    const handler = CLIENT.slice(CLIENT.indexOf("const handleTabSelect"), CLIENT.indexOf("const handleTabSelect") + 200);
    expect(handler).toContain("explicitSelectRef.current = true;");
    expect(handler).toContain("onTabChange(id);");
  });

  it("NlSubTabs ruft den expliziten Handler auf, nicht mehr direkt onTabChange", () => {
    expect(CLIENT).toContain('onSelect={(id) => handleTabSelect(id as PlayerProfileTabId)}');
  });

  it("die Scroll-Effekt-Logik prüft das Explizit-Flag VOR dem Beobachtungs-Flag und scrollt in diesem Fall immer", () => {
    const effectStart = CLIENT.indexOf("useEffect(() => {\n    const explicit = explicitSelectRef.current;");
    expect(effectStart).toBeGreaterThanOrEqual(0);
    const effectBody = CLIENT.slice(effectStart, effectStart + 700);
    // Explizit-Zweig setzt suppressScrollRef zurück, statt sich von ihm stoppen zu lassen.
    expect(effectBody).toContain("if (explicit) {");
    expect(effectBody).toContain("suppressScrollRef.current = false;");
    // Danach folgt der scrollIntoView-Aufruf ohne weiteren Suppress-Check dazwischen,
    // der den Explizit-Fall erneut blockieren könnte.
    const scrollCallIndex = effectBody.indexOf("scrollIntoView");
    const secondSuppressCheckIndex = effectBody.indexOf("else if (suppressScrollRef.current)");
    expect(scrollCallIndex).toBeGreaterThan(secondSuppressCheckIndex);
  });
});

describe("D4: OVR/PPs/MVS stehen nur noch in der KPI-Kartenreihe, nicht mehr zusätzlich im Hero", () => {
  it("PlayerHeroNewLook zeigt keine OVR/PPs/MVS-StatChips mehr", () => {
    expect(HERO).not.toContain('label="OVR"');
    expect(HERO).not.toContain('label="PPs"');
    expect(HERO).not.toContain('label="MVS"');
  });

  it("PlayerHeroNewLook behält MW/Gehalt/Vertrag — die stehen sonst nirgends", () => {
    expect(HERO).toContain('label="MW"');
    expect(HERO).toContain('label="GEHALT"');
    expect(HERO).toContain('label="VERTRAG"');
  });

  it("die KPI-Kartenreihe im Drawer bleibt die einzige Quelle für OVR/PPs/MVS (Rang + Delta + Liga-Leaders-Link)", () => {
    expect(DRAWER).toContain("player-drawer-kpi-hero-grid");
    expect(DRAWER).toContain("headlineMetrics");
    expect(DRAWER).toContain("player-drawer-kpi-link-hint");
  });
});

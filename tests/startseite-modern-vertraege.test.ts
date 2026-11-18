/**
 * Verträge der neuen Startseite (HomeModern, 18.11.): Verdrahtung, beidseitige Klassen-Absicherung
 * (Markup ↔ home-modern.css) und die Entscheidungen des PM (keine erfundene Kassenkurve, nirgends
 * „Spiele", wo Duelle gemeint sind).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/home-v2/HomeModern.tsx");
const CSS = quelle("app/foundation/home-v2/home-modern.css");
const CLIENT = quelle("app/foundation/home-v2/HomeV2Client.tsx");
const SHELL = quelle("app/foundation/FoundationShellRouterBody.tsx");
const SCOPE = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const LOGIK = quelle("lib/foundation/startseite-modern.ts");

describe("Startseite modern: Verdrahtung", () => {
  it("HomeV2Client rendert die neue Seite, die Shell reicht die Daten durch", () => {
    expect(CLIENT).toContain("HomeModern");
    expect(SHELL).toContain("startseite: homeStartseiteModern");
    expect(SCOPE).toContain("baueStartseiteModern");
    expect(SCOPE).toContain("shouldBuildHomeV2Overview");
  });

  it("Wertung bleibt unberührt: die Logik importiert keine Wertungs-/Resolve-Motoren", () => {
    expect(LOGIK).not.toMatch(/from "@\/lib\/resolve\//);
    expect(LOGIK).not.toMatch(/from "@\/lib\/battle\/(?!arena-kulisse-anzeige)/);
  });
});

describe("Startseite modern: beidseitige Klassen-Absicherung", () => {
  const verwendet = new Set<string>();
  for (const m of MARKUP.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    for (const wort of `${m[1] ?? m[2] ?? ""}`.split(/\s+/)) {
      const k = wort.replace(/\$\{[^}]*\}/g, "");
      if (/^hm-[a-z0-9-]+$/.test(k)) verwendet.add(k);
    }
  }
  // dynamisch zusammengesetzte Klassen (Ampel, Papierform-Ton, Moral, Form)
  for (const k of ["hm-a", "hm-b", "hm-c", "hm-plus", "hm-minus", "hm-acht", "hm-null", "hm-u", "hm-n", "hm-x", "hm-g", "hm-h"]) verwendet.add(k);

  it("es gibt überhaupt Klassen (der Extraktor läuft nicht ins Leere)", () => {
    expect(verwendet.size).toBeGreaterThan(40);
  });

  it.each([...verwendet].sort())("%s ist in home-modern.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}(?![\\w-])`));
  });
});

describe("Startseite modern: Regieband des App-Rahmens", () => {
  it("Rang, Punkte, Ergebnisse und Form · Moral kommen per Slot ins Band, der Hauptknopf steht nur einmal (im Band)", () => {
    expect(MARKUP).toContain("<FoundationBandSlot>");
    expect(MARKUP).toContain("hm-bandkpis");
    expect(MARKUP).not.toContain("hm-haupt");
    expect(MARKUP).not.toContain('data-testid="hm-weiter"');
    expect(MARKUP).not.toContain("onContinue");
  });
});

describe("Startseite modern: Entscheidungen des PM", () => {
  it("Kasse: keine erfundene Kurve und kein Platzhaltertext; Betrag in Einheit C, Gehalt groß je Saison und klein je Spieltag", () => {
    expect(MARKUP).not.toContain("kurve-leer");
    expect(MARKUP).not.toContain("folgt mit dem neuen Finanzkonzept");
    expect(MARKUP).not.toContain("<polyline");
    expect(MARKUP).toContain("formatNlCoins");
    expect(MARKUP).not.toContain(" Mio");
    expect(MARKUP).toContain("je Spieltag");
  });

  it("S-U-N wird als Disziplin-Duelle beschriftet, nirgends als „Spiele“", () => {
    expect(MARKUP).toContain("Disziplin-Duelle");
    expect(MARKUP).toContain("duelleText");
    expect(MARKUP).not.toMatch(/\d+ Spiele\b|Spiele gewertet|gewertete Spiele/);
  });

  it("Disziplin-Kacheln sind nach Kaderstärke-Rang sortiert, Duellpunkte klein dazu", () => {
    expect(LOGIK).toContain("(a.rang ?? 999) - (b.rang ?? 999)");
    expect(MARKUP).toContain("`${d.punkte} / ${d.moeglich} Pkt`");
  });

  it("Papierform-Schwellen 55 / 45 Prozent", () => {
    expect(LOGIK).toContain("anteilProzent >= 55");
    expect(LOGIK).toContain("anteilProzent <= 45");
  });

  it("volle Fläche: Wurzelgröße folgt Breite und Höhe, die Seite füllt die Shell-Höhe", () => {
    expect(CSS).toMatch(/font-size:var\(--hm-u,clamp\(12\.5px,min\(/);
    expect(CSS).toMatch(/height:var\(--hm-h,calc\(100vh/);
    expect(MARKUP).toContain("ENTWURF_BREITE_REM");
    expect(MARKUP).toContain('setProperty("--hm-u"');
  });
});

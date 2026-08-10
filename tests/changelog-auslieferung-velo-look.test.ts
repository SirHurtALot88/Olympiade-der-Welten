/**
 * W6 · Changelog-Auslieferung (Audit „welt", Befund 1 + 2).
 *
 * Befund 1 (45–60s Ladezeit) — GEMESSEN, nicht gefixt: `FoundationChangelogHost` laedt keine
 * Daten nach (`CHANGELOG.json` ist ein Build-Time-Import, reines `useMemo`-Parsen/Gruppieren,
 * keine Netzwerk-Anfrage) und rendert bei warmem Dev-Server in ~3–5s (Playwright-Messung mit
 * `waitForSelector` statt fixem Sleep, Protokoll im PR). Die 45–60s waren die einmalige
 * Next-Dev-Kompilierung der riesigen gemeinsamen Modulkette dieser Route (u. a.
 * `use-foundation-shell-router-body-scope.tsx`, >12.000 Zeilen) — kein Datenweg-Bug dieser
 * Komponente. Deshalb hier keine Assertion "laedt schnell", sondern nur: keine Netzwerk-/
 * Fetch-Aufrufe im Datenweg der Komponente.
 *
 * Befund 2 (137+ Eintraege als eine 18.000-px-Scroll-Wand) — hier gefixt: nur die neueste Version
 * startet aufgeklappt, aeltere liegen hinter "Anzeigen"; eine Sprungleiste im Kopf springt zu jeder
 * Version und klappt sie dabei auf.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const HOST = quelle("app/foundation/changelog/FoundationChangelogHost.tsx");
const CSS = quelle("app/globals.css");

describe("Befund 1 — kein Datenweg-Bug: die Komponente selbst holt nichts nach", () => {
  it("kein fetch/axios/useEffect-Datennachladen — nur der Build-Time-JSON-Import", () => {
    expect(HOST).toContain('import changelogDatei from "@/data/changelog/CHANGELOG.json"');
    expect(HOST).not.toContain("fetch(");
    expect(HOST).not.toContain("useEffect");
  });

  it("Parsen/Gruppieren laeuft memoisiert, nicht bei jedem Render neu", () => {
    expect(HOST).toContain("useMemo(() => sortiereChangelog(parseChangelogDatei(changelogDatei)), [])");
  });
});

describe("Befund 2 — nur die neueste Version startet offen, Rest hinter 'Anzeigen'", () => {
  it("die Versionsuebersicht kommt aus EINER Quelle (gruppiereChangelogNachVersion auf der flachen Liste)", () => {
    expect(HOST).toContain("const versionsUebersicht = useMemo(");
    expect(HOST).toMatch(/gruppiereChangelogNachVersion\(eintraege\)\.map/);
  });

  it("der initiale ausgeklappt-Zustand enthaelt nur die neueste Version", () => {
    expect(HOST).toContain('const neuesteVersionSchluessel = versionsUebersicht[0]?.schluessel ?? "ohne-version"');
    expect(HOST).toContain("useState<Set<string>>(() => new Set([neuesteVersionSchluessel]))");
  });

  it("ein Abschnitt ohne eigenen Kopf (keine Versionsangabe im gesamten Gewicht) bleibt immer offen — kein unwiderrufliches Einklappen", () => {
    expect(HOST).toContain("const offen = zeigtKopf ? ausgeklappt.has(schluessel) : true;");
  });

  it("eingeklappte Abschnitte zeigen eine ehrliche Zahl statt zu verschwinden (Chris' 0-Regel sinngemäß: nichts wird versteckt ohne Hinweis)", () => {
    expect(HOST).toContain("nl-changelog-version-collapsed-hint");
    expect(HOST).toMatch(/\{anzahlEintraege\} Eintrag\{anzahlEintraege === 1 \? "" : "e"\} eingeklappt/);
  });
});

describe("Sprungleiste springt zu einer Version und klappt sie dabei auf", () => {
  it("Klick fuegt die Version zum ausgeklappt-Set hinzu und scrollt zum ersten Vorkommen", () => {
    expect(HOST).toContain("const springeZuVersion = useCallback((schluessel: string) => {");
    expect(HOST).toContain("scrollIntoView({ behavior: \"smooth\", block: \"start\" })");
  });

  it("der Anker haelt bei mehrfach vorkommender Version das OBERSTE Vorkommen (Set-once-Wache)", () => {
    expect(HOST).toContain("if (element && !versionsAnkerRef.current.has(schluessel))");
  });

  it("die Sprungleiste rendert nur, wenn es mehr als eine Version gibt", () => {
    expect(HOST).toContain("{versionsUebersicht.length > 1 ? (");
  });
});

describe("Jede neu benutzte Klasse existiert in globals.css", () => {
  const tokens = [
    "nl-changelog-sprungleiste",
    "nl-changelog-sprung-chip",
    "nl-changelog-sprung-anzahl",
    "nl-changelog-version-kopf",
    "nl-changelog-version-toggle",
    "nl-changelog-version-collapsed-hint",
  ];

  it.each(tokens)("%s ist in globals.css definiert und im Markup benutzt", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
    expect(HOST).toContain(klasse);
  });

  it("is-eingeklappt (Modifier auf nl-changelog-version) ist beidseitig abgesichert", () => {
    expect(CSS).toMatch(/\.nl-changelog-version\.is-eingeklappt/);
    expect(HOST).toContain('is-eingeklappt');
  });

  it("is-offen (Modifier auf den Sprung-Chip) ist beidseitig abgesichert", () => {
    expect(CSS).toMatch(/\.nl-changelog-sprung-chip\.is-offen/);
    expect(HOST).toContain('is-offen');
  });

  it("der offene Sprung-Chip nutzt --nl-accent-fill/--nl-accent-ink statt rohem Akzent als Textfarbe", () => {
    const block = CSS.slice(CSS.indexOf(".nl-changelog-sprung-chip.is-offen"), CSS.indexOf(".nl-changelog-sprung-chip.is-offen") + 200);
    expect(block).toContain("--nl-accent-fill");
    expect(block).toContain("--nl-accent-ink");
    expect(block).not.toMatch(/color:\s*var\(--nl-accent\)/);
  });
});

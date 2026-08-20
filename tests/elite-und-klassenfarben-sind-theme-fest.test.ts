/**
 * BEDEUTUNGSFARBEN KOMMEN NIE AUS DER VEREINSFARBE — an zwei Stellen, die Chris gemeldet hat.
 *
 * MELDUNG `8sbs35`: „Spieler mit 80er und 90er stats sind im depth chart gelb anstatt hellblau
 * markiert - bitte fixen! passend zu unseren formatierungen." Nach Rueckfrage seine Entscheidung:
 * „depth chart soll weiterhin hellblau faerben und nicht in team farben, das irritiert sonst,
 * beim training bitte auch die farben nicht mit team farben ueberschreiben wenn man eine klasse
 * waehlt."
 *
 * ZWEI DINGE STECKEN DARIN, UND SIE ZIEHEN IN VERSCHIEDENE RICHTUNGEN:
 *
 *  1. Hellblau JA — aber `--nl-accent` NEIN. `accent` IST die Vereinsfarbe. Eine Skala, die auch
 *     `risk` enthaelt, darf sie nie tragen: bei rotem Team-Theme saehen Spitze und Schlusslicht
 *     gleich aus. Genau dieser Fehler wurde in Paket F2 repariert, und deshalb war die
 *     Elite-Stufe zwischenzeitlich Gold. Die Loesung ist ein EIGENES, theme-festes Hellblau
 *     (`--nl-elite`) — Chris' Farbe, ohne die Regel zu brechen.
 *
 *  2. Gold war hier trotzdem falsch: #f6c750 lag direkt neben `warn` (#e0a53a), der Stufe 40–59
 *     im selben Raster. Elite und Mittelmass lasen sich als dieselbe Farbe — das ist das „gelb"
 *     aus der Meldung. Gold bleibt der RANG-Skala vorbehalten (`quartile-tone.ts`).
 *
 * DIESER TEST HAELT BEIDE GRENZEN. Ohne die zweite waere die naechstliegende „Reparatur" ein
 * Rueckfall auf `accent` — und damit der alte Fehler unter neuem Namen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NL_TONE_VAR } from "@/components/foundation/new-look/nl-tones";

const TEAM_PROFILE = readFileSync(join(process.cwd(), "app/foundation/team-profile/TeamProfileNewLook.tsx"), "utf8");
const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Der Rumpf von `getDepthRatingTone` — nur dort darf gemessen werden. */
const DEPTH_TONE_FN = (() => {
  const start = TEAM_PROFILE.indexOf("function getDepthRatingTone");
  return TEAM_PROFILE.slice(start, TEAM_PROFILE.indexOf("\n}", start) + 2);
})();

describe("Depth-Chart: Elite ist theme-festes Hellblau", () => {
  it("die Stufe ab 80 traegt den Ton `elite`", () => {
    expect(DEPTH_TONE_FN).toContain('if (rating >= 80) return "elite";');
  });

  it("NICHT `accent` — das waere die Vereinsfarbe in einer Skala mit `risk`", () => {
    // Der Rueckfall, gegen den dieser Test eigentlich steht.
    expect(DEPTH_TONE_FN).not.toContain('return "accent"');
  });

  it("und NICHT mehr `gold` — das lag zu nah an `warn` der Stufe darunter", () => {
    expect(DEPTH_TONE_FN).not.toContain('return "gold"');
  });

  it("`elite` ist hellblau und ein FESTER Wert, kein Theme-Ableger", () => {
    expect(NL_TONE_VAR.elite).toContain("--nl-elite");
    expect(NL_TONE_VAR.elite).toContain("#5b9bff");
    // Der Token selbst steht als Literal in der CSS, nicht als Verweis auf --nl-accent.
    expect(CSS).toContain("--nl-elite: #5b9bff;");
    expect(CSS).not.toContain("--nl-elite: var(--nl-accent");
  });

  it("die Ton-Klasse existiert und zeigt auf den Token", () => {
    expect(CSS).toContain(".is-new-look .nl-tone-elite {\n  --nl-tone: var(--nl-elite);\n}");
  });
});

describe("Training: die Klassenauswahl uebermalt die Klassenfarbe nicht", () => {
  /** Die Regel fuer den Balken der GEWAEHLTEN Klasse. */
  const AKTIV_FILL = (() => {
    const marker = ".is-new-look .nl-training-class-ranking-row.is-current .nl-training-class-ranking-fill {";
    const start = CSS.indexOf(marker);
    return start < 0 ? "" : CSS.slice(start, CSS.indexOf("}", start) + 1);
  })();

  it("der Balken der gewaehlten Klasse behaelt die Klassenfarbe", () => {
    expect(AKTIV_FILL).toContain("var(--nl-tone");
  });

  it("und traegt NICHT die Vereinsfarbe", () => {
    // Genau das stand hier: `background: var(--nl-accent);` — der linke Rahmen blieb blau
    // (Templar), der Balken daneben wurde teamrot.
    expect(AKTIV_FILL).not.toContain("--nl-accent");
  });

  it("der Hover ueber einer Klassenzeile toent neutral, nicht im Team", () => {
    const marker = ".is-new-look .nl-training-class-ranking.is-selectable .nl-training-class-ranking-row:hover:not(:disabled):not(.is-current) {";
    const start = CSS.indexOf(marker);
    const regel = start < 0 ? "" : CSS.slice(start, CSS.indexOf("}", start) + 1);
    expect(regel).not.toContain("--nl-accent");
    expect(regel).toContain("--nl-ink");
  });

  it("der Fokusring bleibt beim Akzent — Bedienhilfe, keine Bedeutungsfarbe", () => {
    // Bewusst NICHT mitgeaendert: er faerbt nichts ein, sondern zeigt nur, wo die Tastatur steht.
    const marker = ".is-new-look .nl-training-class-ranking.is-selectable .nl-training-class-ranking-row:focus-visible {";
    const start = CSS.indexOf(marker);
    const regel = start < 0 ? "" : CSS.slice(start, CSS.indexOf("}", start) + 1);
    expect(regel).toContain("--nl-accent");
  });
});

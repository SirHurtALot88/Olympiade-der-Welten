/**
 * DER HINWEIS BEIM RAUMSTART — was er sagt und was er NICHT behauptet.
 *
 * CHRIS: „dann bitte im koop auch noch oben anzeigen dass der draft gerade läuft damit man erstmal
 * 1-2 minuten wartet bevor man loslegt, wobei seinen sponsor picken und einkaufen könnte man
 * eigentlich ja schon".
 *
 * NACHGESEHEN STATT GEGLAUBT: das Banner gab es laengst und es erscheint auch im Raum (gemessen im
 * Browser, Raeume PKWX-M6JJ und W9A4-VQUW: `foundation-league-setup-banner` sichtbar, solange
 * `leagueSetupStatus === "in_progress"`). Falsch waren nur zwei Dinge daran.
 *
 * 1. DIE ZAHL. „Rund eine Minute" stand seit der ersten Fassung da. Gemessen: 126 s und 172 s in
 *    zwei ungestoerten Laeufen, 317 s mit dauernden Schreibvorgaengen nebenher. Eine Anzeige, die
 *    frueher fertig verspricht als sie wird, macht aus einem richtigen Zustand einen Fehlerverdacht.
 *
 * 2. WAS SCHON GEHT, stand nirgends. Gemessen im Raum waehrend des Drafts: Sponsorwahl und Kauf
 *    antworten beide mit 200/success.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schale = readFileSync(resolve(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
const stile = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("Der Draft-Hinweis nennt die gemessene Dauer", () => {
  it("verspricht nicht mehr „rund eine Minute“", () => {
    expect(schale, "gemessen wurden 126 s und 172 s, nicht 60 s").not.toContain("Das dauert rund eine Minute");
  });

  it("nennt stattdessen die Spanne, die wirklich gemessen wurde", () => {
    expect(schale).toContain("Das dauert ein bis zwei Minuten");
  });

  it("GEGENPROBE: das Banner selbst bleibt, es wurde nichts danebengebaut", () => {
    // Es gab es laengst — der Befund war nie „es fehlt ein Hinweis". Ein zweites Banner haette die
    // Anzeige doppelt gemacht und die Frage „welches stimmt jetzt" neu aufgeworfen.
    expect(schale).toContain('data-testid="foundation-league-setup-banner"');
    expect(schale).toContain("Liga wird erstellt … (KI-Teams werden befüllt)");
    expect(schale.split('data-testid="foundation-league-setup-banner"').length - 1, "genau zwei Zweige: laeuft / fehlgeschlagen").toBe(2);
  });
});

describe("Der Zusatz „was schon geht“ steht nur da, wo er gemessen wurde", () => {
  it("nennt Sponsorwahl und Einkauf", () => {
    expect(schale).toContain('data-testid="foundation-league-setup-banner-schon-moeglich"');
    expect(schale).toMatch(/Sponsor wählen und einkaufen geht bereits/);
  });

  it("haengt am Raum-Kontext — im Solo-Lauf wird nichts behauptet", () => {
    // Gemessen wurde im Raum. Denselben Satz im Solo-Fall anzuzeigen waere eine Behauptung ueber
    // einen Ablauf, den niemand nachgesehen hat — und genau dafuer gibt es hier die Regel.
    const zusatzStelle = schale.indexOf('data-testid="foundation-league-setup-banner-schon-moeglich"');
    const davor = schale.slice(Math.max(0, zusatzStelle - 400), zusatzStelle);
    expect(davor, "der Zusatz muss hinter einer roomContext-Bedingung stehen").toContain("{roomContext ? (");
  });
});

describe("Das Banner ist auch wirklich zu SEHEN", () => {
  /**
   * DER EIGENTLICHE BEFUND, und er stand nicht im Bauteil.
   *
   * Das Banner war die ganze Zeit im Baum — mit `display: none`. Die Regel
   * `.foundation-shell .transfer-callout.is-info` raeumt die Informations-Callouts der
   * Transfermarkt-Ansichten aus der Foundation-Schale und traf ueber die gemeinsame Klasse
   * `transfer-callout` auch das Fortschritts-Banner der Schale selbst. Im Browser nachgemessen:
   * `display: none`, Hoehe 0 — zwei Minuten lang kein Wort, genau wie gemeldet.
   *
   * Gepruefte Eigenschaft ist deshalb NICHT „es gibt ein Banner" (das gab es), sondern „die
   * Sammelregel erwischt es nicht mehr".
   */
  it("die Sammelregel fuer Info-Callouts erwischt das Schalen-Banner nicht mehr", () => {
    expect(stile).toContain(".foundation-shell .foundation-persistence-banner.transfer-callout.is-info");
    const sammelregel = stile.indexOf(".foundation-shell .transfer-callout.is-info");
    const ausnahme = stile.indexOf(".foundation-shell .foundation-persistence-banner.transfer-callout.is-info");
    expect(sammelregel, "beide Regeln muessen auffindbar bleiben").toBeGreaterThan(-1);
    expect(ausnahme, "die Ausnahme muss NACH der Sammelregel stehen, sonst gewinnt die Sammelregel").toBeGreaterThan(
      sammelregel,
    );
  });

  it("GEGENPROBE: die Sammelregel selbst bleibt bestehen", () => {
    // Sie einfach zu loeschen haette das Banner ebenfalls sichtbar gemacht — und nebenbei jeden
    // Info-Callout zurueckgeholt, den jemand bewusst aus der Schale geraeumt hat.
    expect(stile).toMatch(/\.foundation-shell \.transfer-callout\.is-info \{\s*display: none;/);
  });

  it("GEGENPROBE: der Fehlerfall war nie betroffen und bleibt es", () => {
    // Er traegt `is-warning`, nicht `is-info` — die Sammelregel hat ihn nie erwischt.
    expect(schale).toContain('data-league-setup-status="failed"');
    expect(stile).toMatch(/\.foundation-shell \.transfer-callout\.is-warning/);
  });
});

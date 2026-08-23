/**
 * ERFUNDENE STUFEN FALLEN LAUTLOS DURCH — und genau das ist passiert.
 *
 * `normalisiereChangelogGewicht` gibt für jeden unbekannten Wert `null` zurück. Das ist richtig
 * ("lieber null als geraten"), hat aber eine Kehrseite: wer statt `feinschliff` das Wort `klein`
 * schreibt, bekommt keinen Fehler. Der Eintrag landet im Reiter unter „Ohne Einstufung", der
 * Generator mahnt ihn in einer langen Liste an, und die Liste war lang genug, dass niemand mehr
 * hinsah.
 *
 * AM 23.08.2026 NACHGEZÄHLT: 47 der 400 Einträge trugen ein Wort, das der Quelltext gar nicht
 * kennt — `normal`, `wichtig`, `klein`, `mittel`, `gross`, `stoerend`, `hintergrund`,
 * `verbesserung`, `kosmetik`. Alle von mir, über drei Wochen. Dazu 26 Triage-Notizen mit einer
 * `schwere:`, die es im Typ nicht gibt (`schwere` ist `hoch | mittel | niedrig`).
 *
 * Der Reiter zeigte deshalb einen Abschnitt „Ohne Einstufung" mit über vierzig Zeilen, während die
 * vier Stufen darüber halb leer standen. Kein Test war rot, kein Typ war verletzt: beide Werte
 * sind im JSON bzw. in der Notiz freier Text.
 *
 * DIESER TEST PRÜFT DAS VOKABULAR, NICHT DIE EINSTUFUNG. Ob ein Fix wirklich `behebung` und nicht
 * `feinschliff` ist, kann kein Skript entscheiden. Dass jemand ein Wort benutzt, das nirgends
 * definiert ist, sehr wohl.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CHANGELOG_GEWICHTE } from "@/lib/changelog/changelog";

/** Die `schwere:`-Zeile der Triage-Notizen — der Typ in lib/bug-report/bug-report-triage.ts. */
const TRIAGE_SCHWEREN = ["hoch", "mittel", "niedrig"] as const;

type Fund = { datei: string; wert: string };

function leseGepflegteGewichte(): Fund[] {
  const ordner = join(process.cwd(), "data/changelog/eintraege");
  return readdirSync(ordner)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((name) => {
      const roh = JSON.parse(readFileSync(join(process.cwd(), "data/changelog/eintraege", name), "utf8")) as unknown;
      const eintraege = Array.isArray(roh) ? roh : [roh];
      return eintraege
        .map((eintrag) => (eintrag as { gewicht?: unknown }).gewicht)
        .filter((wert): wert is string => typeof wert === "string")
        .map((wert) => ({ datei: name, wert }));
    });
}

function leseTriageZeilen(schluessel: "gewicht" | "schwere"): Fund[] {
  const ordner = join(process.cwd(), "data/bug-reports/triage");
  return readdirSync(ordner)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .flatMap((name) => {
      const text = readFileSync(join(process.cwd(), "data/bug-reports/triage", name), "utf8");
      const treffer = new RegExp(`^${schluessel}:\\s*(\\S+)\\s*$`, "m").exec(text);
      return treffer ? [{ datei: name, wert: treffer[1] }] : [];
    });
}

describe("Changelog · das Vokabular der Stufen", () => {
  it("benutzt in den gepflegten Eintraegen nur die vier Stufen, die es gibt", () => {
    const erfunden = leseGepflegteGewichte()
      .filter((fund) => !(CHANGELOG_GEWICHTE as readonly string[]).includes(fund.wert))
      .map((fund) => `${fund.datei}: „${fund.wert}"`);
    // Fehlt das Feld ganz, ist das eine dokumentierte Luecke (README) und bleibt erlaubt. Ein
    // DAGEWESENES, aber unbekanntes Wort ist etwas anderes: da wollte jemand einstufen und hat
    // danebengegriffen — und merkt es nie.
    expect(erfunden, `Unbekannte Stufe. Erlaubt: ${CHANGELOG_GEWICHTE.join(", ")}`).toEqual([]);
  });

  it("benutzt in den Triage-Notizen dieselben vier Stufen", () => {
    const erfunden = leseTriageZeilen("gewicht")
      .filter((fund) => !(CHANGELOG_GEWICHTE as readonly string[]).includes(fund.wert))
      .map((fund) => `${fund.datei}: „${fund.wert}"`);
    expect(erfunden, `Unbekannte Stufe. Erlaubt: ${CHANGELOG_GEWICHTE.join(", ")}`).toEqual([]);
  });

  it("kennt bei `schwere:` nur hoch, mittel und niedrig — alles andere wird still zu null", () => {
    const erfunden = leseTriageZeilen("schwere")
      .filter((fund) => !(TRIAGE_SCHWEREN as readonly string[]).includes(fund.wert))
      .map((fund) => `${fund.datei}: „${fund.wert}"`);
    // `schwere` traegt den Rueckfall, wenn keine `gewicht:`-Zeile dasteht. Ein unbekanntes Wort
    // faellt deshalb doppelt aus: es stuft nicht ein UND es traegt nicht zurueck.
    expect(erfunden, `Unbekannte Schwere. Erlaubt: ${TRIAGE_SCHWEREN.join(", ")}`).toEqual([]);
  });

  it("laesst keinen Eintrag mehr ohne Einstufung stehen", () => {
    const changelog = JSON.parse(readFileSync(join(process.cwd(), "data/changelog/CHANGELOG.json"), "utf8")) as {
      eintraege: Array<{ gewicht: string | null; text: string }>;
    };
    const ohne = changelog.eintraege.filter((eintrag) => eintrag.gewicht == null).map((eintrag) => eintrag.text.slice(0, 70));
    // Das ist die Zahl, die Chris im Spiel sieht — der Abschnitt am Ende des Reiters. Am 23.08.
    // stand sie bei 47, jetzt bei 0. Faellt dieser Fall, ist ein neuer Eintrag ohne lesbare Stufe
    // dazugekommen; die drei Faelle darueber sagen dann meistens schon, welches Wort schuld ist.
    expect(ohne).toEqual([]);
  });
});

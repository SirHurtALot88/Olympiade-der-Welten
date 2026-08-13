/**
 * DIE EINSATZLISTE ZEIGT KEINE ROHEN FEHLERCODES.
 *
 * GEMELDET VON CHRIS mit Bildschirmfoto: über der Einsatzliste stand rot und kursiv
 * `lineup_draft_is_locked` — sonst nichts. Kein Grund, kein Ausweg, kein deutscher Satz.
 *
 * DAHINTER STECKT KEIN FEHLER, SONDERN EINE GEWOLLTE SPERRE (`matchday-lineup-lock.ts`): sobald
 * der Spieltag in der Arena gezeigt wurde, ist die Abgabe festgenagelt — sonst könnte man das
 * Ergebnis ansehen, hinausgehen, den Kapitän umsetzen und nachbessern, bis es passt. Die Sperre
 * bleibt also unangetastet; erklärt wird sie jetzt.
 *
 * DIESER TEST HÄLT ZWEIERLEI FEST: dass die bekannten Codes übersetzt werden, und dass die
 * Anzeige die Übersetzung auch WIRKLICH benutzt — ein Code, der nur in der Tabelle steht, aber
 * ungenutzt an der Oberfläche vorbeiläuft, wäre kein Fortschritt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  uebersetzeLineupFehler,
  uebersetzeLineupFehlerListe,
} from "@/lib/lineups/lineup-fehlertexte";

/** Alle Codes, die die Dienste in `legacy-lineup-local-service.ts` an die Oberflaeche geben. */
const CODES_AUS_DEM_DIENST = [
  "lineup_draft_is_locked",
  "lineup_matchday_is_not_active",
  "lineup_not_operationally_ready",
  "form_cards_season_is_not_active",
  "form_card_plan_matchday_missing",
  "form_card_plan_discipline_side_missing",
] as const;

describe("Einsatzliste: rohe Fehlercodes werden uebersetzt", () => {
  it("der gemeldete Code wird ein deutscher Satz, der den Grund nennt", () => {
    const text = uebersetzeLineupFehler("lineup_draft_is_locked");
    expect(text).not.toBe("lineup_draft_is_locked");
    expect(text).toMatch(/Arena/);
    expect(text).toMatch(/festgenagelt/);
  });

  it("KEIN Code aus dem Dienst bleibt unuebersetzt", () => {
    for (const code of CODES_AUS_DEM_DIENST) {
      const text = uebersetzeLineupFehler(code);
      expect(text, `${code} ist nicht uebersetzt`).not.toBe(code);
      // Ein Satz, kein zweiter Code: keine Unterstriche im Ergebnis.
      expect(text, `${code} liefert wieder einen Code`).not.toMatch(/_/);
    }
  });

  it("jeder Code aus dem Dienst ist auch wirklich in der Tabelle — Quelle gegen Tabelle", () => {
    // Faengt den Fall ab, dass jemand einen NEUEN Code einfuehrt und die Uebersetzung vergisst.
    const quelle = readFileSync(
      join(process.cwd(), "lib/lineups/legacy-lineup-local-service.ts"),
      "utf8",
    );
    const gefunden = new Set(
      [...quelle.matchAll(/errors(?::\s*\[|\.push\()\s*"([a-z0-9_]+)"/g)].map((treffer) => treffer[1]!),
    );
    expect(gefunden.size, "keine Codes in der Quelle gefunden — Test ist blind geworden").toBeGreaterThan(0);
    for (const code of gefunden) {
      expect(uebersetzeLineupFehler(code), `${code} fehlt in lineup-fehlertexte.ts`).not.toBe(code);
    }
  });

  it("unbekannte Meldungen werden durchgereicht statt verschluckt", () => {
    // Die Validierung liefert englische SAETZE — die sind unschoen, aber informativ.
    const satz = "Player p-1 is used more than once in matchday md-3.";
    expect(uebersetzeLineupFehler(satz)).toBe(satz);
  });

  it("die Listen-Fassung uebersetzt jeden Eintrag", () => {
    const texte = uebersetzeLineupFehlerListe(["lineup_draft_is_locked", "irgendwas anderes"]);
    expect(texte[0]).not.toBe("lineup_draft_is_locked");
    expect(texte[1]).toBe("irgendwas anderes");
  });

  it("die Oberflaeche benutzt die Uebersetzung an BEIDEN Anzeigestellen", () => {
    const ansicht = readFileSync(
      join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"),
      "utf8",
    );
    // Einmal die rote Statuszeile, einmal die Aufzaehlung im Leerzustand.
    const treffer = ansicht.match(/uebersetzeLineupFehlerListe\(errors\)/g) ?? [];
    expect(treffer.length).toBe(2);
    // Und nirgends mehr die rohe Ausgabe.
    expect(ansicht).not.toMatch(/\{errors\.join\(/);
    expect(ansicht).not.toMatch(/\{errors\.map\(/);
  });
});

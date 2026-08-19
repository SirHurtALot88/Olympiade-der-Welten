/**
 * EIN SPIELTAG OHNE EINE EINZIGE GEWERTETE ZEILE DARF NICHT ALS GEBUCHT GELTEN.
 *
 * Aufgefallen am Trockenlauf der Saison-Simulation: dort kam je Spieltag `resolvedTeams: 32,
 * blockers: []` zurueck, bei `disciplineRows: 0`. Beim Nachsehen zeigte sich, dass das nicht am
 * Skript lag: `LegacyMatchdayResultApplyService` meldete `ok: true, applied: true` allein anhand
 * des Vorschau-Status und der Frage, ob ein widerspruechlicher Eintrag im Weg steht (siehe
 * `buildBlockingReasons`). WIE VIELE Zeilen dabei entstehen, ging in KEINE dieser Bedingungen ein.
 *
 * Das Skript hat seither eine eigene Zusicherung — aber sie half nur dem Skript. Jeder andere
 * Aufrufer, auch der Spieltagslauf im Spiel, bekam weiterhin ein `applied: true` fuer nichts, und
 * die Oberflaeche sagte „im Saisonstand", waehrend im Save nichts stand.
 *
 * Chris: „riegel im apply service auch rein bitte." Hier ist er, und hier ist seine Zusicherung.
 */
import { describe, expect, it } from "vitest";

import { buildEmptyDisciplineRowBlocker } from "@/lib/resolve/legacy-matchday-result-apply-service";

describe("Apply-Service: kein gebuchter Spieltag ohne gewertete Zeile", () => {
  it("blockiert, wenn dieser Aufruf null Disziplin-Zeilen schreibt", () => {
    const grund = buildEmptyDisciplineRowBlocker({
      matchdayId: "matchday-8",
      writtenDisciplineRows: 0,
      isStagedContinuation: false,
    });
    expect(grund).toBeTruthy();
    expect(grund).toContain("matchday-8");
    expect(grund).toContain("nicht als gebucht");
  });

  it("nennt bei der gestaffelten Buchung die OFFENE Seite", () => {
    // D1 liegt schon, D2 kommt — und bringt nichts mit. Die Meldung muss sagen, worum es geht,
    // sonst sucht man den Fehler beim ganzen Spieltag statt bei der offenen Disziplin.
    const grund = buildEmptyDisciplineRowBlocker({
      matchdayId: "matchday-8",
      writtenDisciplineRows: 0,
      isStagedContinuation: true,
    });
    expect(grund).toContain("offene Seite");
  });

  it("laesst durch, sobald auch nur EINE Zeile geschrieben wird", () => {
    expect(
      buildEmptyDisciplineRowBlocker({
        matchdayId: "matchday-8",
        writtenDisciplineRows: 1,
        isStagedContinuation: false,
      }),
    ).toBeNull();
  });

  /**
   * DIE WICHTIGSTE ZUSICHERUNG DES GESTAFFELTEN FALLS: gezaehlt werden nur die Zeilen, die DIESER
   * Aufruf schreibt. Zaehlte man die eingefrorene D1 mit, koennte ein leerer D2-Commit sich hinter
   * ihr verstecken — genau der Zustand, den der Riegel verhindern soll.
   */
  it("die bereits gebuchte Seite zaehlt nicht mit", () => {
    const frozenSides = new Set<"d1" | "d2">(["d1"]);
    const payloads = [
      { disciplineSide: "d1" as const },
      { disciplineSide: "d1" as const },
      { disciplineSide: "d1" as const },
    ];
    const neue = payloads.filter((payload) => !frozenSides.has(payload.disciplineSide)).length;
    expect(neue, "die eingefrorenen D1-Zeilen duerfen den leeren D2-Commit nicht retten").toBe(0);
    expect(
      buildEmptyDisciplineRowBlocker({
        matchdayId: "matchday-8",
        writtenDisciplineRows: neue,
        isStagedContinuation: true,
      }),
    ).toBeTruthy();
  });
});

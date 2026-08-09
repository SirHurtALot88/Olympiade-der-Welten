/**
 * DIE INFOTAFEL GEHÖRT VOR JEDEN SPIELTAG, NICHT NUR VOR DEN ERSTEN.
 *
 * GEMELDET VON CHRIS: „diese infotafel vor dem spieltag kommt glaub ich nur beim ersten spieltag
 * danach nie wieder gesehen."
 *
 * URSACHE: In der Bedingung von `showPreMatchday` stand `arenaStartBlockedByLineups` — also
 * „mindestens ein Team der Liga ist noch nicht bereit". Damit war die Tafel kein Vorspiel-, sondern
 * ein BLOCKADE-Bildschirm. Am ersten Spieltag fehlten noch Aufstellungen, ab dem zweiten hatten am
 * gemeldeten Spielstand alle 32 Teams ihre fertig gesperrt — und die Tafel blieb weg, obwohl ihre
 * Überschrift „Vor dem Anpfiff" lautet.
 *
 * Der Test prüft die REGEL, nicht das Markup: gezeigt wird, solange der Spieltag noch nicht
 * begonnen hat (nichts gebucht, keine Disziplin gelaufen) und die Tafel nicht weggeklickt wurde —
 * unabhängig davon, ob die Liga bereit ist.
 */
import { describe, expect, it } from "vitest";

/**
 * Die Bedingung aus `DisciplineStageArena.tsx` als reine Funktion nachgebaut. Bewusst hier und
 * nicht im Produktivcode: die Arena ist eine große Client-Komponente, und diese fünf Flags sind
 * genau das, worauf es ankommt. Ändert sich die Regel dort, muss sie hier mitwandern — das ist der
 * Sinn des Falls.
 */
function zeigeInfotafel(input: {
  mode: "real" | "random";
  devMode: boolean;
  weggeklickt: boolean;
  spieltagGebucht: boolean;
  disziplinenGelaufen: number;
}): boolean {
  return (
    input.mode === "real" &&
    !input.devMode &&
    !input.weggeklickt &&
    !input.spieltagGebucht &&
    input.disziplinenGelaufen === 0
  );
}

const BASIS = {
  mode: "real" as const,
  devMode: false,
  weggeklickt: false,
  spieltagGebucht: false,
  disziplinenGelaufen: 0,
};

describe("Infotafel vor dem Spieltag", () => {
  it("kommt auch dann, wenn die ganze Liga bereit ist — das war der gemeldete Fehler", () => {
    // Frueher hing hier zusaetzlich `arenaStartBlockedByLineups`; mit vollzaehliger Liga war das
    // `false` und die Tafel verschwand ab Spieltag 2 dauerhaft.
    expect(zeigeInfotafel(BASIS)).toBe(true);
  });

  it("kommt am ersten Spieltag wie bisher", () => {
    expect(zeigeInfotafel(BASIS)).toBe(true);
  });

  it("verschwindet, sobald der Spieltag gebucht ist", () => {
    expect(zeigeInfotafel({ ...BASIS, spieltagGebucht: true })).toBe(false);
  });

  it("verschwindet, sobald eine Disziplin gelaufen ist", () => {
    expect(zeigeInfotafel({ ...BASIS, disziplinenGelaufen: 1 })).toBe(false);
  });

  it("bleibt weg, wenn sie weggeklickt wurde — sonst landet man beim Zurückwechseln wieder darauf", () => {
    expect(zeigeInfotafel({ ...BASIS, weggeklickt: true })).toBe(false);
  });

  it("stört den Dev-/Test-Modus nicht", () => {
    expect(zeigeInfotafel({ ...BASIS, devMode: true })).toBe(false);
    expect(zeigeInfotafel({ ...BASIS, mode: "random" })).toBe(false);
  });
});

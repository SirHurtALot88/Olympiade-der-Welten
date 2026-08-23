/**
 * DER SAISONFILTER DER TRANSFERHISTORIE MEINT DAS FENSTER, NICHT DEN ZEITSTEMPEL — UND ZWAR SCHON
 * AUF DEM SERVER.
 *
 * GEMELDET VON CHRIS, zweimal an einem Vormittag, von beiden Seiten desselben Fehlers:
 *
 *  - `wg919y` (08:01, „Markt · Historie"): „Alle Teams haben ihre Verkäufe hier in S2 getrackt, nur
 *    die von mir scheinen in S1 fest zu hängen und noch nicht angezeigt werden weil ich ja real in
 *    S1 verkaufe und die anderen teams beim saisonübergang! bitte so regeln dass spielerverkäufe am
 *    ende von S1 mit in die S2 auswertung kommen damit die tranfers sauber sind!"
 *  - `kn3o08` (08:10, dieselbe Seite): „die verkäufe sind alle in S1 noch drin NUR die von mir
 *    manuell nicht!!!"
 *
 * DIE REGEL GAB ES SCHON. `lib/foundation/transfer-window-zuordnung.ts` (seit `#459`) ordnet einen
 * Transfer vom LETZTEN Spieltag einer Saison dem Fenster der FOLGENDEN zu. Sie lief nur im
 * Browser — NACH dem Saisonfilter des Servers. Damit sah sie nie, was sie hätte hereinholen sollen:
 *
 *   Filter S2 → der Server gibt nur `seasonId === "season-2"` heraus. Chris' Verkäufe tragen
 *               `season-1` und kommen gar nicht erst an        → `wg919y`.
 *   Filter S1 → der Server gibt sie heraus, die Zuordnung im Browser schiebt sie nach S2 hinaus,
 *               und es kommt nichts nach                       → `kn3o08`.
 *
 * Eine Sortierung, die erst nach dem Zuschnitt greift, kann nur verlieren, nie gewinnen.
 *
 * AM ABBILD `hwz8fk` NACHGEZÄHLT (502 Einträge, Chronologie aus den Zeitstempeln):
 *
 *   07:27–07:44   3 Verkäufe von S-C (Chris)      → season-1, matchday-10
 *   07:51        96 contract_exit (KI)            → season-1, matchday-10
 *   07:53–08:10  60 KI-Bewegungen                 → season-2      ← der Saisonwechsel liegt hier
 *   08:15–08:22   4 manuelle Käufe                → season-2
 *
 * Es ist EIN Transferfenster, quer über den Saisonwechsel. Der Filter zerschnitt es:
 *
 *   Filter S2 vorher: 64 Käufe, **0** Verkäufe   ·  nachher: 64 Käufe, **3** Verkäufe
 *   Filter S1 vorher: 339 Käufe, 3 Verkäufe      ·  nachher: 339 Käufe, 0 Verkäufe
 *
 * ZU DEN ZWEI MELDUNGEN, die in ENTGEGENGESETZTE Richtungen zeigen: gefolgt bin ich `wg919y`, weil
 * dort eine Begründung mitsteht („weil ich ja real in S1 verkaufe und die anderen teams beim
 * saisonübergang") und weil es die Regel ist, die im Code schon dokumentiert war. Was in der
 * S1-Ansicht wie „die Verkäufe der anderen" aussieht, sind die 96 `contract_exit`-Zeilen —
 * auslaufende und aufgelöste Verträge, keine Verkäufe. Sie bleiben, wo sie sind.
 */
import { describe, expect, it } from "vitest";

import {
  ermittleFensterSaisonId,
  ermittleLetzteSpieltageJeSaison,
} from "@/lib/foundation/transfer-window-zuordnung";

/** Die gemessene Struktur aus `hwz8fk`, auf das Nötige eingedampft. */
const HISTORIE = [
  // Erst-Draft am Saisonstart — darf NIE wandern.
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `draft-${i}`,
    seasonId: "season-1",
    matchdayId: "matchday-1",
    phase: "manual_transfer_window",
    transferType: "buy" as const,
  })),
  // Chris' Verkäufe am letzten Spieltag der Saison 1.
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `sell-${i}`,
    seasonId: "season-1",
    matchdayId: "matchday-10",
    phase: "manual_transfer_window",
    transferType: "sell" as const,
  })),
  // Auslaufende Verträge, gleicher Spieltag, andere Phase.
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `exit-${i}`,
    seasonId: "season-1",
    matchdayId: "matchday-10",
    phase: "contract_renewal",
    transferType: "contract_exit" as const,
  })),
  // Die Käufe des neuen Fensters, schon unter der neuen Saison.
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `buy2-${i}`,
    seasonId: "season-2",
    matchdayId: "season-2-matchday-1",
    phase: "manual_transfer_window",
    transferType: "buy" as const,
  })),
];

const SPIELTAGE_PRO_SAISON = 10;

function fensterSaison(id: string): string {
  const letzte = ermittleLetzteSpieltageJeSaison(HISTORIE);
  const eintrag = HISTORIE.find((e) => e.id === id)!;
  return ermittleFensterSaisonId(eintrag, letzte, SPIELTAGE_PRO_SAISON);
}

/** Was ein Saisonfilter herausgibt, wenn er nach dem FENSTER schneidet. */
function ausgabe(seasonId: string) {
  const letzte = ermittleLetzteSpieltageJeSaison(HISTORIE);
  const drin = HISTORIE.filter(
    (e) => ermittleFensterSaisonId(e, letzte, SPIELTAGE_PRO_SAISON) === seasonId,
  );
  return {
    kaeufe: drin.filter((e) => e.transferType === "buy").length,
    verkaeufe: drin.filter((e) => e.transferType === "sell").length,
    exits: drin.filter((e) => e.transferType === "contract_exit").length,
  };
}

/** Der alte Zuschnitt, zum Vergleich — genau das, was Chris gesehen hat. */
function ausgabeAlt(seasonId: string) {
  const drin = HISTORIE.filter((e) => e.seasonId === seasonId);
  return {
    kaeufe: drin.filter((e) => e.transferType === "buy").length,
    verkaeufe: drin.filter((e) => e.transferType === "sell").length,
    exits: drin.filter((e) => e.transferType === "contract_exit").length,
  };
}

describe("Der Saisonfilter der Transferhistorie schneidet nach dem Fenster", () => {
  it("die Verkäufe vom Saisonende erscheinen in der FOLGENDEN Saison", () => {
    // Der Kern der Meldung `wg919y`. Vorher: 0 Verkäufe im S2-Filter.
    expect(ausgabeAlt("season-2").verkaeufe).toBe(0);
    expect(ausgabe("season-2").verkaeufe).toBe(3);
  });

  it("und sie stehen dort neben den Käufen, die sie bezahlt haben", () => {
    // „damit die transfers sauber sind" — beide Seiten desselben Fensters in einer Ansicht.
    const s2 = ausgabe("season-2");
    expect(s2.kaeufe).toBe(6);
    expect(s2.verkaeufe).toBe(3);
  });

  it("der Erst-Draft am Saisonstart wandert NICHT mit", () => {
    // Der Fall, an dem eine naive Regel zerbricht: die Draft-Käufe tragen dieselbe Phase und
    // liegen ebenfalls in Saison 1 — nur eben auf Spieltag 1.
    expect(fensterSaison("draft-0")).toBe("season-1");
    expect(ausgabe("season-1").kaeufe).toBe(5);
  });

  it("auslaufende Verträge bleiben bei ihrer Saison", () => {
    // Gleicher Spieltag wie die Verkäufe, aber `phase: "contract_renewal"`. Ein auslaufender
    // Vertrag ist kein Transfer und erzeugt keine Einnahme.
    expect(fensterSaison("exit-0")).toBe("season-1");
    expect(ausgabe("season-1").exits).toBe(4);
    expect(ausgabe("season-2").exits).toBe(0);
  });

  it("die Saison-1-Ansicht verliert genau diese drei Zeilen — nichts sonst", () => {
    // Die Gegenrichtung: der Eingriff darf nicht mehr wegnehmen, als er verschiebt.
    const alt = ausgabeAlt("season-1");
    const neu = ausgabe("season-1");
    expect(alt.verkaeufe - neu.verkaeufe).toBe(3);
    expect(neu.kaeufe).toBe(alt.kaeufe);
    expect(neu.exits).toBe(alt.exits);
  });

  it("kein Eintrag geht verloren und keiner erscheint doppelt", () => {
    const gesamt = ausgabe("season-1");
    const zweite = ausgabe("season-2");
    const summe =
      gesamt.kaeufe + gesamt.verkaeufe + gesamt.exits + zweite.kaeufe + zweite.verkaeufe + zweite.exits;
    expect(summe).toBe(HISTORIE.length);
  });
});

describe("Die Regel steht an beiden Lesestellen — nicht nur in der Liste", () => {
  /**
   * Warum das hier als Quelltext-Wache steht: der Fehler war NICHT die Regel, sondern dass sie an
   * einer Stelle fehlte. Zwei Leser derselben Historie mit zwei Saisonbegriffen erzeugen genau
   * wieder den gemeldeten Widerspruch — die Liste zeigt die Verkäufe unter S2, die Auswertung
   * daneben unter S1.
   */
  const LISTE = readFileSyncSicher("lib/market/transfermarkt-local-service.ts");
  const RECAP = readFileSyncSicher("lib/market/transfer-recap-service.ts");

  it("die Transferliste ordnet serverseitig nach dem Fenster", () => {
    expect(LISTE).toContain("ermittleFensterSaisonId");
    expect(LISTE).not.toMatch(/\.filter\(\(entry\) => \(input\.seasonId \? entry\.seasonId === input\.seasonId : true\)\)/);
  });

  it("die Transfer-Auswertung ebenso", () => {
    expect(RECAP).toContain("ermittleFensterSaisonId");
    expect(RECAP).not.toContain(".filter((entry) => entry.seasonId === seasonId)");
  });

  it("die Zuordnung wird über die VOLLE Historie gerechnet, nicht über das gefilterte Ergebnis", () => {
    // Sonst ist „höchster Spieltag einer Saison" nur so gut wie der Ausschnitt — davor warnt das
    // Modul selbst, und mit einem Seitenzuschnitt wäre der Fix wieder zufällig.
    for (const quelle of [LISTE, RECAP]) {
      expect(quelle).toContain("ermittleLetzteSpieltageJeSaison(gameState.transferHistory)");
    }
  });
});

function readFileSyncSicher(pfad: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require("node:path") as typeof import("node:path");
  return readFileSync(join(process.cwd(), pfad), "utf8");
}

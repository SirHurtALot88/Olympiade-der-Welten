/**
 * GEMELDET: „‚wishlist & scouting' füllt sich immer wieder mit spielern die ich schon entfernt habe"
 *
 * Die Ursache lag nicht in der Wunschliste. Ein Poller fragte alle 5 Sekunden den Serverstand ab, um
 * ein EINZIGES Feld zu erfahren (`leagueSetupStatus`) — und ersetzte dabei den kompletten lokalen
 * Zustand. Das Entfernen eines Eintrags lebt aber zunaechst nur lokal und wird erst nach 2500 ms
 * geschrieben. Faellt ein Tick in dieses Fenster, ist die Aenderung weg.
 *
 * Der Nachtreter macht es endgueltig: `loadSave` setzt die Autosave-Signatur auf den geladenen
 * Stand, BEVOR es ueberschreibt. Die verlorene Aenderung gilt damit als bereits gespeichert und wird
 * nie nachgeholt. Bei 2,5 Stunden Spielzeit sind das rund 1800 Gelegenheiten.
 *
 * Geprueft wird hier die REGEL, nach der der Poller den Zustand uebernimmt — als reine Funktion
 * nachgebaut. Der Effekt selbst haengt in einem 11.000-Zeilen-Client, der sich ohne halbe
 * Foundation-Shell nicht ausfuehren laesst; ein Test, der zur Haelfte aus Attrappe besteht, prueft
 * am Ende die Attrappe. Die Quelltext-Zusicherung unten haelt zusaetzlich fest, dass die Regel im
 * Client auch wirklich so steht.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type Zustand = {
  seasonState: { leagueSetupStatus?: "in_progress" | "ready" | "failed"; wunschliste: string[] };
  marke: string;
};

/**
 * Die Regel aus `pollLeagueSetupStatus`, 1:1 nachgebaut: laeuft der Draft noch, wird NUR das
 * Statusfeld uebernommen; ist er fertig, der ganze Stand.
 */
function uebernehmen(lokal: Zustand, vomServer: Zustand): Zustand {
  const nextStatus = vomServer.seasonState.leagueSetupStatus;
  if (nextStatus === "in_progress") {
    return lokal.seasonState.leagueSetupStatus === nextStatus
      ? lokal
      : { ...lokal, seasonState: { ...lokal.seasonState, leagueSetupStatus: nextStatus } };
  }
  return vomServer;
}

const LOKAL_MIT_ENTFERNTEM_SPIELER: Zustand = {
  seasonState: { leagueSetupStatus: "in_progress", wunschliste: ["spieler-b"] },
  marke: "lokal",
};
/** Der Server kennt die Entfernung noch nicht — sie wartet auf ihren Autosave. */
const SERVER_NOCH_ALT: Zustand = {
  seasonState: { leagueSetupStatus: "in_progress", wunschliste: ["spieler-a", "spieler-b"] },
  marke: "server",
};

describe("Liga-Poller — waehrend der Draft laeuft", () => {
  /** DER GEMELDETE FEHLER. Vorher kam hier der Serverstand zurueck, samt entferntem Spieler. */
  it("laesst eine noch nicht gespeicherte Entfernung stehen", () => {
    const ergebnis = uebernehmen(LOKAL_MIT_ENTFERNTEM_SPIELER, SERVER_NOCH_ALT);
    expect(ergebnis.seasonState.wunschliste).toEqual(["spieler-b"]);
    expect(ergebnis.seasonState.wunschliste).not.toContain("spieler-a");
  });

  it("ruehrt den lokalen Zustand gar nicht an, wenn sich der Status nicht bewegt hat", () => {
    // Gleiche Referenz zurueck: kein Neu-Rendern, kein Ueberschreiben, nichts.
    expect(uebernehmen(LOKAL_MIT_ENTFERNTEM_SPIELER, SERVER_NOCH_ALT)).toBe(LOKAL_MIT_ENTFERNTEM_SPIELER);
  });

  it("zieht einen geaenderten Status nach, ohne den Rest mitzunehmen", () => {
    const lokalOhneStatus: Zustand = {
      seasonState: { wunschliste: ["spieler-b"] },
      marke: "lokal",
    };
    const ergebnis = uebernehmen(lokalOhneStatus, SERVER_NOCH_ALT);
    expect(ergebnis.seasonState.leagueSetupStatus).toBe("in_progress");
    expect(ergebnis.seasonState.wunschliste).toEqual(["spieler-b"]);
    expect(ergebnis.marke).toBe("lokal");
  });
});

describe("Liga-Poller — wenn der Draft fertig ist", () => {
  /**
   * Die Gegenprobe, und sie ist genauso wichtig: Jetzt sind die Kader der ganzen Liga neu, und
   * genau darauf wartet der Spieler. Wuerde hier ebenfalls nur das Statusfeld uebernommen, bliebe
   * die Liga leer — der Fix haette einen schlimmeren Fehler eingebaut als den, den er behebt.
   */
  it("uebernimmt den vollstaendigen Serverstand", () => {
    const fertig: Zustand = {
      seasonState: { leagueSetupStatus: "ready", wunschliste: ["spieler-a", "spieler-b"] },
      marke: "server",
    };
    expect(uebernehmen(LOKAL_MIT_ENTFERNTEM_SPIELER, fertig)).toBe(fertig);
  });

  it("uebernimmt auch einen fehlgeschlagenen Draft vollstaendig", () => {
    const gescheitert: Zustand = {
      seasonState: { leagueSetupStatus: "failed", wunschliste: [] },
      marke: "server",
    };
    expect(uebernehmen(LOKAL_MIT_ENTFERNTEM_SPIELER, gescheitert)).toBe(gescheitert);
  });
});

describe("Liga-Poller — die Regel steht auch wirklich im Client", () => {
  it("uebernimmt bei laufendem Draft nur das Statusfeld", () => {
    const scope = readFileSync(
      join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    expect(scope).toContain('if (nextStatus === "in_progress") {');
    expect(scope).toContain("leagueSetupStatus: nextStatus }");
  });
});

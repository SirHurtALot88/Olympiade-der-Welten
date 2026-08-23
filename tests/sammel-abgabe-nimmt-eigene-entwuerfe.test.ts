/**
 * DIE SAMMEL-ABGABE GIBT MEINE AUFSTELLUNGEN AB (Paket 2 aus `docs/AUFSTELLUNG_MEHRERE_TEAMS_PLAN.md`).
 *
 * GEMELDET VON CHRIS: „ist im singleplayer auch integriert dass man mehrere teams am stueck
 * aufstellen kann und nur einmal das lineup abgeben bzw speichern muss?"
 *
 * Den Knopf gab es (Aufgabe #43) — er nahm nur fuer JEDES offene Team den KI-Vorschlag. Solange ein
 * Teamwechsel den Entwurf wegwarf, war das auch die einzige Moeglichkeit. Seit Paket 1 gibt es
 * eigene Entwuerfe, und ab da ist der Vorschlag die falsche Wahl.
 *
 * Zwei Eigenschaften werden gehalten:
 *
 * 1. EIGENE ARBEIT WIRD NIE STILL ERSETZT. Wo ein eigener Entwurf liegt, geht der eigene Entwurf.
 *
 * 2. DER KNOPF SAGT, WAS ER TUT. Bei gemischter Lage nennt er BEIDE Zahlen. Ein Knopf, der eine
 *    Aufstellung unwiderruflich festnagelt, darf ueber ihre Herkunft nicht schweigen — und
 *    „KI-Vorschlag" zu sagen, waehrend er die eigene Auswahl abgibt, waere genau falsch herum.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { istEigenerEntwurf, mischeSammelAbgabe } from "@/lib/lineups/sammel-abgabe-mischung";

const OHNE_EIGENE = () => false;
const ALLE_EIGENE = () => true;

describe("Die Mischung entscheidet je Team: eigener Entwurf vor KI-Vorschlag", () => {
  it("teilt die offenen Teams in genau zwei Gruppen — keins faellt zwischen die Stuehle", () => {
    const mischung = mischeSammelAbgabe({
      offeneTeamIds: ["P-S", "D-P", "M-M", "V-W"],
      hatEigenenEntwurf: (teamId) => teamId === "P-S" || teamId === "M-M",
    });

    expect(mischung.eigene).toEqual(["P-S", "M-M"]);
    expect(mischung.kiVorschlag).toEqual(["D-P", "V-W"]);
    expect([...mischung.eigene, ...mischung.kiVorschlag]).toHaveLength(4);
  });

  it("nennt bei gemischter Lage BEIDE Zahlen im Knopf", () => {
    const mischung = mischeSammelAbgabe({
      offeneTeamIds: ["P-S", "D-P", "M-M"],
      hatEigenenEntwurf: (teamId) => teamId !== "D-P",
    });

    expect(mischung.knopfText).toBe("2 eigene Aufstellungen + 1 KI-Vorschlag abgeben");
    expect(mischung.erklaerung).toContain("deine eigene Auswahl");
  });

  it("sagt kein Wort von KI, wenn gar keine KI im Spiel ist", () => {
    const mischung = mischeSammelAbgabe({ offeneTeamIds: ["P-S", "M-M"], hatEigenenEntwurf: ALLE_EIGENE });

    expect(mischung.knopfText).toBe("2 eigene Aufstellungen abgeben");
    expect(mischung.knopfText).not.toMatch(/KI/);
    expect(mischung.erklaerung).toContain("Kein KI-Vorschlag");
  });

  it("GEGENPROBE: ohne eigene Entwuerfe bleibt es beim bisherigen Satz", () => {
    // Der haeufigste Fall bleibt haeufig: wer die Teams gar nicht erst oeffnet, bekommt genau das,
    // was der Knopf seit Aufgabe #43 anbietet. Diese Aenderung nimmt nichts weg.
    const mischung = mischeSammelAbgabe({ offeneTeamIds: ["P-S", "D-P", "M-M", "V-W"], hatEigenenEntwurf: OHNE_EIGENE });

    expect(mischung.knopfText).toBe("4 offene mit KI-Vorschlag abgeben");
    expect(mischung.eigene).toEqual([]);
  });

  it("zaehlt auch in der Einzahl richtig", () => {
    expect(mischeSammelAbgabe({ offeneTeamIds: ["P-S"], hatEigenenEntwurf: ALLE_EIGENE }).knopfText).toBe(
      "1 eigene Aufstellung abgeben",
    );
    expect(
      mischeSammelAbgabe({ offeneTeamIds: ["P-S", "D-P"], hatEigenenEntwurf: (id) => id === "P-S" }).knopfText,
    ).toBe("1 eigene Aufstellung + 1 KI-Vorschlag abgeben");
  });

  it("GEGENPROBE: bei 0 offenen Teams wird erklaert, nicht stumm gezaehlt", () => {
    const mischung = mischeSammelAbgabe({ offeneTeamIds: [], hatEigenenEntwurf: ALLE_EIGENE });

    expect(mischung.knopfText).toBe("Alle Aufstellungen stehen");
    expect(mischung.erklaerung).toMatch(/stehen bereits/);
  });
});

describe("Was als eigener Entwurf zaehlt", () => {
  it("ein einziger besetzter Slot reicht — wer drei von sechs gesetzt hat, hat eine Meinung", () => {
    expect(
      istEigenerEntwurf([{ activePlayerId: null }, { activePlayerId: "ap-7" }, { activePlayerId: null }]),
    ).toBe(true);
  });

  it("GEGENPROBE: ein Entwurf ohne einen einzigen Spieler ist keiner", () => {
    // Sonst haette jedes einmal geoeffnete Team einen „eigenen Entwurf" — und bekaeme nie wieder
    // einen Vorschlag, obwohl gar nichts drinsteht.
    expect(istEigenerEntwurf([{ activePlayerId: null }, { activePlayerId: null }])).toBe(false);
    expect(istEigenerEntwurf([])).toBe(false);
  });
});

describe("Die Oberflaeche haelt sich an die Regel", () => {
  const quelltext = readFileSync(
    resolve(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
    "utf8",
  );

  it("der eigene Entwurf wird VOR dem KI-Vorschlag genommen — nicht danach zusammengefuehrt", () => {
    // Die Reihenfolge ist die Eigenschaft: liegt der eigene Entwurf vor, darf die Vorschlags-Route
    // fuer dieses Team gar nicht erst gefragt werden. Sonst haenge die Entscheidung an einer
    // Antwort, die kommen kann oder auch nicht.
    const eigenerZweig = quelltext.indexOf("const eigeneEintraege = eigeneEntwuerfeFuerOffeneTeams.get(teamId);");
    const vorschlagAufruf = quelltext.indexOf("/api/lineups/legacy/ai-preview?");
    expect(eigenerZweig, "der Zweig fuer eigene Entwuerfe muss es geben").toBeGreaterThan(-1);
    expect(vorschlagAufruf).toBeGreaterThan(eigenerZweig);
  });

  it("die Sperr-Rueckfrage behauptet nicht mehr pauschal 'mit dem KI-Vorschlag'", () => {
    // Der Dialog nagelt beides fest, eigene Aufstellung wie Vorschlag. Ein pauschaler Satz waere
    // fuer die eigenen schlicht gelogen — deshalb steht die Herkunft jetzt je Team in der Zeile.
    expect(quelltext).not.toContain("Aufstellungen mit dem KI-Vorschlag abgeben und für diesen Spieltag");
    expect(quelltext).toContain('? "deine Aufstellung"');
    expect(quelltext).toContain(': "KI-Vorschlag";');
  });

  it("die Beschriftung kommt aus der einen Quelle, nicht aus einer zweiten Zaehlung im Panel", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "app/foundation/legacy-lineup-lab/MyTeamsReadinessPanel.tsx"),
      "utf8",
    );
    expect(quelltext).toContain("sammelAbgabeKnopfText={sammelAbgabeMischung.knopfText}");
    expect(panel).toContain("sammelAbgabeKnopfText ??");
  });
});

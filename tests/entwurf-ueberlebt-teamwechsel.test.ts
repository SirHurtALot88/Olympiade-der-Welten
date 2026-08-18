/**
 * DER ENTWURF UEBERLEBT DEN TEAMWECHSEL (Paket 1 aus `docs/AUFSTELLUNG_MEHRERE_TEAMS_PLAN.md`).
 *
 * GEMELDET VON CHRIS: „bisher war es ja so wenn ich das team wechsel dass die seite aktualisiert
 * und die aufstellung weg ist."
 *
 * Zwei Dinge werden hier gehalten, und beide waren der Befund:
 *
 * 1. DIE TEAM-ID STEHT NICHT MEHR IM SCHLUESSEL, mit dem die Schale die Einsatzliste aufbaut. Das
 *    war die Ursache des Wegwerfens — und der Neuaufbau war ueberfluessig, weil der Client selbst
 *    auf ein geaendertes `defaultTeamId` reagiert.
 *
 * 2. DAS GEDAECHTNIS ENTSCHEIDET RICHTIG, was beim Laden gewinnt. Jede Pruefung unten haengt an
 *    einer Lage, in der das Falsche zu tun naheliegt: nach dem Speichern nochmal merken, den
 *    gespeicherten Draft beim ersten Oeffnen ueberdecken, oder einen Entwurf am falschen Spieltag
 *    wieder auftauchen lassen.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  entwurfSchluessel,
  erzeugeEntwurfGedaechtnis,
  type EntwurfOrt,
  type GemerkterEntwurf,
} from "@/lib/lineups/entwurf-gedaechtnis";

const ORT_A: EntwurfOrt = {
  saveId: "save-1",
  seasonId: "season-1",
  matchdayId: "matchday-3",
  teamId: "P-S",
  source: "sqlite",
};
const ORT_B: EntwurfOrt = { ...ORT_A, teamId: "D-P" };

const LEERE_SEITE = {
  primaryFormCardId: null,
  secondaryFormCardId: null,
  mutatorTrait1: null,
  mutatorTrait2: null,
  teamPowerId: null,
  intensity: "normal" as const,
};

function entwurf(spielerId: string, teamIntensity: GemerkterEntwurf["teamIntensity"] = "normal"): GemerkterEntwurf {
  return {
    selections: { "track::d1::0": spielerId },
    captains: { d1: spielerId, d2: "" },
    modifiers: { d1: { ...LEERE_SEITE }, d2: { ...LEERE_SEITE } },
    teamIntensity,
  };
}

describe("Die Team-ID steht nicht mehr im Aufbau-Schluessel der Einsatzliste", () => {
  const schale = readFileSync(resolve(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
  const schluesselZeile = schale.split("\n").find((zeile) => zeile.includes("clientKey={`lineup-")) ?? "";

  it("genau das war der Befund: mit der Team-ID darin baut React beim Wechsel alles neu auf", () => {
    expect(schluesselZeile, "die clientKey-Zeile der Einsatzliste muss auffindbar bleiben").not.toBe("");
    expect(schluesselZeile).not.toContain("activeManagerTeamId");
  });

  it("GEGENPROBE: Spielstand, Saison, Spieltag und Besitzer bleiben drin — dort ist der Neuaufbau richtig", () => {
    expect(schluesselZeile).toContain("activeSaveId");
    expect(schluesselZeile).toContain("gameState.season.id");
    expect(schluesselZeile).toContain("gameState.matchdayState.matchdayId");
    expect(schluesselZeile).toContain("effectiveActiveOwnerId");
  });

  it("das Team-Auswahlfeld macht die Arbeit nur noch einmal", () => {
    const client = readFileSync(
      resolve(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );
    // Vorher rief das Feld `props.onTeamChange` UND `loadContext` — die Schale meldete das neue
    // Team zurueck, der Effekt lud ein zweites Mal, und eine Ablehnung der Schale (unbekanntes
    // Team) waere uebergangen worden. Jetzt geht alles ueber einen Weg.
    expect(client).toContain("const wechsleTeam = useCallback(");
    expect(client).toContain("onChange={(event) => wechsleTeam(event.target.value)}");
  });
});

describe("Das Gedaechtnis fuer Entwuerfe entscheidet, was beim Laden gewinnt", () => {
  it("merkt den Entwurf beim Verlassen und gibt ihn beim Zurueckwechseln wieder heraus", () => {
    const gedaechtnis = erzeugeEntwurfGedaechtnis();
    const meiner = entwurf("spieler-7", "hoch");

    expect(gedaechtnis.merkeBeimVerlassen({ von: ORT_A, nach: ORT_B, entwurf: meiner })).toBe(true);

    // Zurueck zu A: die Ablage kennt nur den leeren Stand, das Gedaechtnis meine Auswahl.
    const gewaehlt = gedaechtnis.waehleBeimLaden(ORT_A, entwurf(""));
    expect(gewaehlt.herkunft).toBe("gedaechtnis");
    expect(gewaehlt.entwurf.selections["track::d1::0"]).toBe("spieler-7");
    expect(gewaehlt.entwurf.captains.d1).toBe("spieler-7");
    expect(gewaehlt.entwurf.teamIntensity, "auch die Intensitaet ist Teil des Entwurfs").toBe("hoch");
  });

  it("GEGENPROBE: beim ersten Oeffnen gewinnt der gespeicherte Draft aus der Ablage", () => {
    const gedaechtnis = erzeugeEntwurfGedaechtnis();

    const gewaehlt = gedaechtnis.waehleBeimLaden(ORT_A, entwurf("aus-der-ablage"));
    expect(gewaehlt.herkunft).toBe("ablage");
    expect(gewaehlt.entwurf.selections["track::d1::0"]).toBe("aus-der-ablage");
  });

  it("merkt NICHT, wenn dieselbe Ansicht sich selbst neu laedt", () => {
    // Genau das passiert nach dem Speichern (`loadContext(params, source)`). Wuerde hier gemerkt,
    // ueberdeckte der lokale Stand sofort wieder den frisch geholten Server-Stand — und ein
    // Entwurf, den der Server abgelehnt hat, saehe fuer immer wie der gueltige aus.
    const gedaechtnis = erzeugeEntwurfGedaechtnis();

    expect(gedaechtnis.merkeBeimVerlassen({ von: ORT_A, nach: ORT_A, entwurf: entwurf("lokal") })).toBe(false);
    expect(gedaechtnis.groesse()).toBe(0);
    expect(gedaechtnis.waehleBeimLaden(ORT_A, entwurf("vom-server")).herkunft).toBe("ablage");
  });

  it("merkt NICHT, solange gar nichts geladen ist", () => {
    const gedaechtnis = erzeugeEntwurfGedaechtnis();

    expect(gedaechtnis.merkeBeimVerlassen({ von: ORT_A, nach: ORT_B, entwurf: null })).toBe(false);
    expect(gedaechtnis.groesse()).toBe(0);
  });

  it("vergisst ein Team nach dem Schreiben — die Ablage hat dann die Wahrheit", () => {
    const gedaechtnis = erzeugeEntwurfGedaechtnis();
    gedaechtnis.merkeBeimVerlassen({ von: ORT_A, nach: ORT_B, entwurf: entwurf("alt") });

    gedaechtnis.vergiss(ORT_A);

    const gewaehlt = gedaechtnis.waehleBeimLaden(ORT_A, entwurf("frisch-geschrieben"));
    expect(gewaehlt.herkunft).toBe("ablage");
    expect(gewaehlt.entwurf.selections["track::d1::0"]).toBe("frisch-geschrieben");
  });

  it("vergisst alles, wenn ein Stapellauf viele Teams auf einmal geschrieben hat", () => {
    const gedaechtnis = erzeugeEntwurfGedaechtnis();
    gedaechtnis.merkeBeimVerlassen({ von: ORT_A, nach: ORT_B, entwurf: entwurf("alt-a") });
    gedaechtnis.merkeBeimVerlassen({ von: ORT_B, nach: ORT_A, entwurf: entwurf("alt-b") });
    expect(gedaechtnis.groesse()).toBe(2);

    gedaechtnis.vergissAlles();

    expect(gedaechtnis.groesse()).toBe(0);
    expect(gedaechtnis.waehleBeimLaden(ORT_A, entwurf("frisch")).herkunft).toBe("ablage");
    expect(gedaechtnis.waehleBeimLaden(ORT_B, entwurf("frisch")).herkunft).toBe("ablage");
  });

  it("haelt Entwuerfe getrennt — Team, Spieltag, Saison, Spielstand und Quelle sind verschiedene Orte", () => {
    // Der Spieltag laesst sich im Feld daneben wechseln, ohne dass die Ansicht neu aufgebaut wird.
    // Ein Entwurf fuer Spieltag 3 als Entwurf fuer Spieltag 4 auszugeben waere schlimmer als ihn
    // zu verlieren: er saehe wie eine bewusste Aufstellung aus.
    const orte: Array<[string, EntwurfOrt]> = [
      ["anderes Team", ORT_B],
      ["anderer Spieltag", { ...ORT_A, matchdayId: "matchday-4" }],
      ["andere Saison", { ...ORT_A, seasonId: "season-2" }],
      ["anderer Spielstand", { ...ORT_A, saveId: "save-2" }],
      ["andere Quelle", { ...ORT_A, source: "prisma" }],
    ];

    for (const [was, anderer] of orte) {
      expect(entwurfSchluessel(anderer), was).not.toBe(entwurfSchluessel(ORT_A));

      const gedaechtnis = erzeugeEntwurfGedaechtnis();
      gedaechtnis.merkeBeimVerlassen({ von: ORT_A, nach: anderer, entwurf: entwurf("nur-fuer-a") });
      expect(gedaechtnis.waehleBeimLaden(anderer, entwurf("eigener-stand")).herkunft, was).toBe("ablage");
    }
  });
});

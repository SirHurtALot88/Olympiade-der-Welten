/**
 * DIE KADER-ZIELGROESSE STEIGT UM EINS — GEDECKELT BEIM MAXIMUM 14.
 *
 * CHRIS' ENTSCHEIDUNG: „es soll +1 je team sein max 14 aber im team identity blatt".
 *
 * Das „aber im Blatt" ist der eigentliche Punkt: die Anhebung steht in
 * `data/source/team-identities.json`, nicht in einer Wanderung im Ladepfad. Das Blatt IST die
 * Zielgroesse — `buildResolvedTeamIdentities` baut die Identitaeten bei jedem Schreibvorgang aus
 * ihm neu auf, laufende Spielstaende ziehen also von selbst nach, und es gibt keinen zweiten Ort,
 * an dem eine zweite Wahrheit entstehen koennte.
 *
 * WARUM UEBERHAUPT ANHEBEN. Die Messung zu `ne85u5` (data/bug-reports/triage/) hat den
 * Ermuedungshaushalt auf eine Gleichung gebracht: Erholung bekommt nur, wer an einem Spieltag NICHT
 * eingesetzt wird. Bei einer Einsatzquote q gilt je Spieltag
 *
 *     Δ = q × Last − (1 − q) × Erholung        Gleichgewicht bei  q* = Erholung / (Last + Erholung)
 *
 * Mit den Produktionswerten (Last 16, Erholung 28) liegt q* bei 63,6 %. Die Einsatzquote ist keine
 * Einstellung, sondern folgt aus Spielplan und Kader: q = Spieltagsbedarf / Kadergroesse. Bei neun
 * Einsatzplaetzen heisst das
 *
 *     Kader 14 -> q = 64,3 %   (praktisch im Gleichgewicht)
 *     Kader 12 -> q = 75,0 %
 *     Kader 10 -> q = 90,0 %   (Δ = +11,6 je Spieltag, Deckel nach zehn Spieltagen)
 *
 * GEMESSEN, Blatt und wirksamer Wert (Blatt + GM-Zuschlag, geklemmt auf 8..14):
 *
 *     Blatt   vorher   9:1  10:14  11:8  12:6  13:2  14:1     Median 11
 *     Blatt   nachher       10:1  11:14  12:8  13:6  14:3     Median 12
 *     Wirksam vorher   8:2  9:3  10:7  11:9  12:4  13:5  14:2 Median 11
 *     Wirksam nachher       9:2  10:3  11:7  12:9  13:4  14:7 Median 12
 *
 * WAS DIESER TEST NICHT BEHAUPTET: dass jedes Team am Ende 14 anstrebt. Der General Manager
 * verschiebt das Blatt-Ziel weiterhin um bis zu ±2 (`playerOptDelta`), nach oben gedeckelt bei 14.
 * Das ist gewollt — die Persoenlichkeit bleibt sichtbar, der ganze Zug wandert nur einen Platz nach
 * oben.
 */
import { describe, expect, it } from "vitest";

import teamIdentitiesSource from "@/data/source/team-identities.json";
import type { TeamIdentity } from "@/lib/data/olyDataTypes";
import { DEFAULT_ROSTER_MAX, deriveRosterTargets } from "@/lib/foundation/roster-limits";

const identitaeten = teamIdentitiesSource as TeamIdentity[];

/**
 * Der Stand VOR der Anhebung, wie er ueber die gesamte Historie im Blatt stand. Er steht hier als
 * Zahlen und nicht als git-Abfrage: der Test soll die Anhebung festhalten, nicht die Versions-
 * geschichte nachschlagen — und ohne diese Basis koennte niemand pruefen, dass es wirklich GENAU
 * ein Platz mehr ist und nicht zwei.
 */
const BLATT_VOR_DER_ANHEBUNG: Record<string, number> = {
  "A-A": 12, "B-B": 11, "B-P": 9, "C-C": 13, "C-S": 10, "D-L": 14, "D-P": 10, "G-G": 11,
  "H-R": 12, "L-K": 12, "L-R": 11, "M-M": 10, "M-S": 12, "N-N": 10, "N-W": 11, "P-C": 11,
  "P-S": 10, "R-C": 12, "R-L": 10, "R-R": 10, "S-C": 10, "S-S": 10, "T-C": 12, "T-G": 11,
  "T-T": 13, "U-A": 11, "V-D": 10, "V-V": 10, "V-W": 10, "W-L": 10, "W-W": 11, "Z-H": 10,
};

/**
 * ZWEI TEAMS BEKAMEN SPAETER EINEN PLATZ MEHR — namentlich, nicht als Aufweichung der Regel.
 *
 * CHRIS: „kannst du die OPT spielerzahl von V-V und B-P um 1 erhoehen? die kacken im spiel voll ab
 * weil die nicht rotieren koennen"
 *
 * NACHGEMESSEN an seinem Spielstand (season-2, Spieltag 9), und der Befund ist deutlicher als die
 * Meldung: beide Teams standen bei acht Spielern, waehrend ein Spieltag ELF verlangt. Sie konnten
 * also nicht bloss nicht rotieren — sie konnten nicht einmal vollstaendig aufstellen.
 *
 *   Kadergroesse gegen Ligarang, alle 32 Teams:  Korrelation -0,72
 *   Die sieben Teams mit acht Spielern belegten die Raenge 19, 23, 27, 28, 29, 31, 32.
 *   B-P stand auf Rang 27, V-V auf Rang 28. An Geld lag es nicht: 40,5 bzw. 47,5 Mio Cash.
 *
 * Die Regel „genau ein Platz mehr" gilt weiterhin fuer die anderen 30 Teams — deshalb steht die
 * Ausnahme hier als benannte Liste und nicht als aufgeweichte Bedingung. Wer ein drittes Team
 * anhebt, ohne es hier einzutragen, faellt nach wie vor auf.
 */
const SPAETERE_EINZELANHEBUNGEN: Record<string, number> = {
  "B-P": 1,
  "V-V": 1,
};

describe("Kader-Zielgroesse im Blatt", () => {
  it("liegt bei jedem Team genau einen Platz ueber dem alten Stand — oder beim Maximum", () => {
    expect(identitaeten).toHaveLength(32);
    const abweicher: string[] = [];
    for (const identity of identitaeten) {
      const vorher = BLATT_VOR_DER_ANHEBUNG[identity.teamId];
      if (vorher == null) {
        continue;
      }
      const zuschlag = SPAETERE_EINZELANHEBUNGEN[identity.teamId] ?? 0;
      const erwartet = Math.min(vorher + 1 + zuschlag, DEFAULT_ROSTER_MAX);
      if (identity.playerOpt !== erwartet) {
        abweicher.push(`${identity.teamId}: ${vorher} -> ${identity.playerOpt}, erwartet ${erwartet}`);
      }
    }
    expect(abweicher, "Anhebung ist nicht genau ein Platz").toEqual([]);
  });

  it("hebt genau die beiden gemeldeten Teams einzeln an — und sonst keines", () => {
    // Die Gegenrichtung derselben Zusicherung: die Ausnahmeliste darf nicht unbemerkt wachsen.
    expect(Object.keys(SPAETERE_EINZELANHEBUNGEN).sort()).toEqual(["B-P", "V-V"]);
    const bp = identitaeten.find((identity) => identity.teamId === "B-P");
    const vv = identitaeten.find((identity) => identity.teamId === "V-V");
    expect(bp?.playerOpt).toBe(11);
    expect(vv?.playerOpt).toBe(12);
  });

  it("laesst kein Team ueber das Kader-Maximum klettern", () => {
    // Das ist die halbe Anweisung („max 14") und zugleich die Stelle, an der eine zweite Anhebung
    // auffiele: wer noch einmal +1 rechnet, bekaeme 15 und faellt hier.
    const zuHoch = identitaeten
      .filter((identity) => identity.playerOpt > DEFAULT_ROSTER_MAX)
      .map((identity) => `${identity.teamId}=${identity.playerOpt}`);
    expect(zuHoch).toEqual([]);
  });

  it("hat einen Median von 12", () => {
    // Chris' eigene Gegenrechnung zur Anweisung: „im team identity blatt median müsste dann 12
    // sein". Sie stimmt — und sie ist die knappste Zusicherung dafuer, dass die Anhebung wirklich
    // die ganze Liga erfasst hat und nicht nur ein paar Zeilen.
    // Nachgerechnet, dass die beiden Einzelanhebungen den Median NICHT verschieben: B-P wandert
    // von 10 auf 11 und V-V von 11 auf 12, die Verteilung wird dadurch bei 11 und 12 nur
    // umgeschichtet (11 bleibt 14-fach, 12 waechst von 8 auf 9). 16. und 17. Wert bleiben 12.
    const werte = identitaeten.map((identity) => identity.playerOpt).sort((a, b) => a - b);
    const median = (werte[werte.length / 2 - 1]! + werte[werte.length / 2]!) / 2;
    expect(median).toBe(12);
  });

  it("wird von der Kaderableitung unveraendert durchgereicht — nichts klemmt es herunter", () => {
    // `deriveRosterTargets` klammert playerOpt auf [playerMin, playerMax]. Stuende ein Blatt-Wert
    // ueber dem Maximum, faende man es hier — und nicht erst dann, wenn ein Team nie sein Ziel
    // erreicht.
    for (const identity of identitaeten) {
      const targets = deriveRosterTargets(null, identity);
      expect(targets.playerOpt, `${identity.teamId} wird heruntergeklemmt`).toBe(identity.playerOpt);
      expect(targets.playerMax).toBe(DEFAULT_ROSTER_MAX);
    }
  });

  it("GEGENPROBE: das Kader-Maximum ist wirklich 14 — sonst misst der Test sich selbst", () => {
    expect(DEFAULT_ROSTER_MAX).toBe(14);
  });

  it("laesst playerMin unberuehrt — es ist eine eigene Groesse", () => {
    // Das Kader-Minimum ist fix 8 fuer alle Teams (FIXED_ROSTER_MIN, siehe roster-limits.ts) und
    // hat mit dem Ziel nichts zu tun. Die Blatt-Werte stehen weiterhin gestreut da; wer sie
    // versehentlich mitzieht, faellt hier auf.
    const minima = new Set(identitaeten.map((identity) => identity.playerMin));
    expect(minima.size, "playerMin wurde eingeebnet — das war nicht der Auftrag").toBeGreaterThan(1);
  });
});

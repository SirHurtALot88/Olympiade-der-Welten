/**
 * DAS OPT-ZIEL DER TEAMS STEHT AUF DEM KADER-MAXIMUM.
 *
 * CHRIS' ANWEISUNG: „erhöhe bei allen teams das hinterlegte OPT auf max 14".
 *
 * WARUM 14 UND NICHT IRGENDEINE ZAHL. Die Messung zu `ne85u5` (data/bug-reports/triage/) hat den
 * Ermuedungshaushalt auf eine Gleichung gebracht: Erholung bekommt nur, wer an einem Spieltag NICHT
 * eingesetzt wird. Bei einer Einsatzquote q gilt je Spieltag
 *
 *     Δ = q × Last − (1 − q) × Erholung        Gleichgewicht bei  q* = Erholung / (Last + Erholung)
 *
 * Mit den Produktionswerten (Last 16, Erholung 28) liegt q* bei 63,6 %. Die Einsatzquote ist keine
 * Einstellung, sondern folgt aus Spielplan und Kader: q = Spieltagsbedarf / Kadergroesse. Bei neun
 * Einsatzplaetzen heisst das
 *
 *     Kader 14 -> q = 64,3 %   (praktisch genau im Gleichgewicht)
 *     Kader 12 -> q = 75,0 %   (Fatigue steigt jeden Spieltag)
 *     Kader 10 -> q = 90,0 %   (Δ = +11,6 je Spieltag, Deckel nach zehn Spieltagen)
 *
 * Vorher zielten die Teams laut Blatt auf 9 bis 14, im Mittel 11 — also dauerhaft an der
 * Gleichgewichtslinie vorbei. Genau das beschreibt Chris' Meldung `gsjplu` („die teams mit weniger
 * Spielern haben auch kaum Möglichkeiten zu rotieren"): bei 90 % Einsatzquote gibt es keine Bank,
 * auf die eine KI jemanden setzen koennte. Die Kader-Obergrenze steht seit jeher auf 14, mit Chris'
 * eigener Begruendung im Quelltext — „damit man theoretisch alles abdecken kann selbst mit 2
 * verletzungen". Das Ziel folgt ihr jetzt.
 *
 * WAS DIESER TEST NICHT BEHAUPTET: dass am Ende jedes Team 14 Spieler ANSTREBT. Der
 * General Manager verschiebt das Blatt-Ziel um bis zu ±2 (`playerOptDelta`), und nach oben ist bei
 * 14 gedeckelt — der Delta kann also nur noch nach unten wirken. Gemessen am Live-Abbild ergibt
 * das 26× 14, 4× 13, 2× 12 (Mittel 13,8) statt vorher 8 bis 14 (Mittel 11,0). Das ist gewollt: die
 * Persoenlichkeit des GM bleibt sichtbar, sie zielt nur nicht mehr unter die Gleichgewichtslinie.
 */
import { describe, expect, it } from "vitest";

import teamIdentitiesSource from "@/data/source/team-identities.json";
import type { TeamIdentity } from "@/lib/data/olyDataTypes";
import { DEFAULT_ROSTER_MAX, deriveRosterTargets } from "@/lib/foundation/roster-limits";

const identitaeten = teamIdentitiesSource as TeamIdentity[];

describe("Blatt-OPT der Teams", () => {
  it("steht bei allen 32 Teams auf dem Kader-Maximum", () => {
    expect(identitaeten).toHaveLength(32);
    const abweicher = identitaeten
      .filter((identity) => identity.playerOpt !== DEFAULT_ROSTER_MAX)
      .map((identity) => `${identity.teamId}=${identity.playerOpt}`);
    expect(abweicher, "Teams unter dem Kader-Maximum").toEqual([]);
  });

  it("wird von der Kaderableitung unveraendert durchgereicht — nichts klemmt es herunter", () => {
    // `deriveRosterTargets` klammert playerOpt auf [playerMin, playerMax]. Stuende das Blatt ueber
    // dem Maximum, faende man es hier — und nicht erst dann, wenn ein Team nie sein Ziel erreicht.
    for (const identity of identitaeten) {
      const targets = deriveRosterTargets(null, identity);
      expect(targets.playerOpt, `${identity.teamId} wird heruntergeklemmt`).toBe(DEFAULT_ROSTER_MAX);
      expect(targets.playerMax).toBe(DEFAULT_ROSTER_MAX);
    }
  });

  it("GEGENPROBE: das Kader-Maximum ist wirklich 14 — sonst misst der Test sich selbst", () => {
    // Ohne diese Zeile waere der Test tautologisch: er vergliche das Blatt mit einer Konstanten,
    // die sich mit ihm zusammen verschieben koennte.
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

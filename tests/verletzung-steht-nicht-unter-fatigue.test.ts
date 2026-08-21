/**
 * GEMELDET (`9ykeqt`, „Spieltag · Einsatzliste", Spielstand `swnjlk`, Saison 1, Spieltag 10):
 *
 *   „Wenn man einen Spieler nicht einsetzen kann steht da immer Riskant wegen Fatigue, aber der
 *    eigentliche Grund ist doch dass der spieler verletzt ist. Entsprchend sollte das auch
 *    angegeben sein +Icon!"
 *
 * DIE URSACHE, belegt: In `buildTeamdeckCandidateEntries` gab es den Verletzungs-Zweig schon —
 * aber er hing an `activeSlotCandidate.blockReason`, und diese Karte ist NUR befuellt, wenn gerade
 * ein Slot angeklickt ist (`activeSlotCandidateByActivePlayerId` bleibt ohne aktiven Slot leer).
 * Beim blossen Oeffnen der Einsatzliste — genau Chris' Lage, er hatte keinen Slot aktiv — fiel ein
 * verletzter Spieler deshalb durch bis zur Fatigue-Pruefung darunter und landete unter der
 * Ueberschrift „Riskant wegen Fatigue".
 *
 * Die Verletzung stand die ganze Zeit auf der Karte (`injuryStatus`, `availabilityBlocker`), sie
 * wurde an dieser Stelle nur nicht gefragt.
 *
 * GEPRUEFT WIRD DIE ZUSAGE: ein verletzter Spieler landet nie unter „Fatigue", sein Grund heisst
 * „Verletzt", und die Gruppe traegt ein Icon. Nicht geprueft wird die Schreibweise der Texte —
 * nur, dass „Fatigue" NICHT darin vorkommt und „Verletzt" schon.
 */
import { describe, expect, it } from "vitest";

import {
  buildTeamdeckCandidateEntries,
  buildTeamdeckCandidateGroups,
  getTeamdeckCandidateGroupMeta,
  isElevatedFatigue,
  type MatchdayRosterCard,
} from "@/lib/lineups/lineup-candidate-model";

/**
 * Eine Kaderkarte mit hoher Fatigue — ohne den Fix ist genau das der Grund, aus dem der Spieler
 * in der Fatigue-Gruppe landete. Die Verletzung kommt als Zusatz obendrauf.
 */
function karte(zusatz: Partial<MatchdayRosterCard> = {}): MatchdayRosterCard {
  return {
    id: "p-1",
    activePlayerId: "ap-1",
    portraitUrl: null,
    name: "Verletzter Spieler",
    teamName: "V-W",
    contractLength: 2,
    className: null,
    potential: null,
    discipline1Score: 50,
    discipline2Score: 50,
    appearances: 3,
    marketValue: 10,
    playerOvr: 60,
    playerPps: null,
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    traitsPositive: [],
    traitsNegative: [],
    injuryStatus: null,
    injuryRiskLabel: null,
    availabilityBlocker: null,
    demands: [],
    attributeStats: null,
    attributeRatings: null,
    discipline1Label: "D1",
    discipline2Label: "D2",
    selectedSides: [],
    topAttributesD1: [],
    topAttributesD2: [],
    fitLane: "flex",
    fitDelta: 0,
    // Ueber FATIGUE_UI_MEDIUM (40) — ohne den Fix greift genau dieser Zweig.
    fatigueCount: 70,
    captainEligible: false,
    ...zusatz,
  } as MatchdayRosterCard;
}

/** Chris' Lage: Einsatzliste offen, KEIN Slot angeklickt. */
function eintraegeOhneAktivenSlot(karten: MatchdayRosterCard[]) {
  return buildTeamdeckCandidateEntries({
    activeSlot: null,
    selections: {},
    activeSlotCandidateSummary: null,
    activeSlotCandidateByActivePlayerId: new Map(),
    matchdayRosterCards: karten,
    playerBestSlotSummaryByActivePlayerId: new Map(),
    context: null,
    focusedDisciplineSide: "d1",
    teamdeckFilterMode: "all",
    teamdeckSortMode: "top",
  });
}

describe("Ein verletzter Spieler steht nicht unter „Riskant wegen Fatigue“", () => {
  it("nennt die Verletzung als Grund, auch ohne angeklickten Slot", () => {
    const [eintrag] = eintraegeOhneAktivenSlot([karte({ injuryStatus: "injured" })]);
    expect(eintrag?.groupKey).toBe("injured");
    expect(eintrag?.shortReason).toBe("Verletzt");
    expect(eintrag?.detail).toContain("Verletzt");
    expect(eintrag?.detail).not.toContain("Fatigue");
  });

  it("erkennt auch den harten Ausfall ueber den Verfuegbarkeits-Blocker", () => {
    // Zwei Felder tragen dieselbe Aussage: `injuryStatus` den frisch gemeldeten Fall,
    // `availabilityBlocker` den harten Ausfall. Beide muessen zaehlen.
    const [eintrag] = eintraegeOhneAktivenSlot([karte({ availabilityBlocker: "player_injured_unavailable" })]);
    expect(eintrag?.groupKey).toBe("injured");
  });

  it("laesst „recovering“ weiter mitspielen — wer zurueck ist, darf ran", () => {
    // Die Grenze der Regel. Ein Genesender ist verfuegbar; ihn auszusortieren waere eine
    // Leistungsentscheidung, keine Verfuegbarkeitsfrage (so steht es auch in ai-lineup-freshness).
    const [eintrag] = eintraegeOhneAktivenSlot([karte({ injuryStatus: "recovering" })]);
    expect(eintrag?.groupKey).not.toBe("injured");
  });

  it("laesst den nur MUEDEN Spieler weiter in der Fatigue-Gruppe", () => {
    // Gegenprobe zur Gegenprobe: haette der Fix die Fatigue-Gruppe leergeraeumt, waere Chris'
    // urspruengliche Einteilung kaputt statt praeziser.
    const gesund = karte({ injuryStatus: "healthy" });
    expect(isElevatedFatigue(gesund.fatigueCount)).toBe(true);
    expect(eintraegeOhneAktivenSlot([gesund])[0]?.groupKey).toBe("fatigue");
  });

  it("gibt der Gruppe eine Ueberschrift mit Icon und ohne das Wort Fatigue", () => {
    // „+Icon!" stand woertlich in der Meldung.
    const meta = getTeamdeckCandidateGroupMeta("injured");
    expect(meta.label).toContain("Verletzt");
    expect(meta.label).not.toContain("Fatigue");
    expect(/\p{Extended_Pictographic}/u.test(meta.label)).toBe(true);
  });

  it("stellt die Verletzten-Gruppe VOR die Fatigue-Gruppe", () => {
    // Sonst stuende der schwerere Grund unter dem leichteren.
    expect(getTeamdeckCandidateGroupMeta("injured").order).toBeLessThan(
      getTeamdeckCandidateGroupMeta("fatigue").order,
    );
  });

  it("fuehrt die Gruppe auch wirklich in der Liste, sonst sieht sie niemand", () => {
    const gruppen = buildTeamdeckCandidateGroups({
      teamdeckCandidateEntries: eintraegeOhneAktivenSlot([karte({ injuryStatus: "injured" })]),
      showOnlyTopSlotCandidates: false,
      teamdeckFilterMode: "all",
    });
    const verletzt = gruppen.find((gruppe) => gruppe.key === "injured");
    expect(verletzt?.totalCount).toBe(1);
  });
});

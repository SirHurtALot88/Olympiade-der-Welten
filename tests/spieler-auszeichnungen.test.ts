import { describe, expect, it } from "vitest";

import { buildPlayerSeasonAwards, getAwardIcon, AWARD_FALLBACK_ICON } from "@/lib/foundation/player-season-awards";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * AUSZEICHNUNGEN IM SPIELERPROFIL — Ticket #41.
 *
 * CHRIS: „Dafür hätte ich gerne im Spielerprofil die Icons dass man auch später direkt sieht ah
 * der spieler gehört [dazu]."
 *
 * „Später" ist das entscheidende Wort und der Grund, warum es diesen Test gibt. Die
 * Auszeichnungen entstehen beim Saisonabschluss und wurden bis zu diesem Ticket NIRGENDS
 * abgelegt — mit dem Saisonwechsel waren sie weg. Ein Spieler konnte MVP gewesen sein, ohne dass
 * es eine Saison spaeter noch irgendwo stand.
 *
 * Geprueft wird die Lesestelle des Profils gegen einen Spielstand mit Schnappschuessen. Am echten
 * Live-Spielstand nachgemessen liefert dieselbe Kette drei Titel fuer Malagor (Player of the
 * Season, PPs King, MVP) — die Zahlen hier sind an diesem Fall gebaut.
 */

function spielstand(snapshots: unknown[]): GameState {
  return {
    season: { id: "season-2", name: "Season 2" },
    seasonState: { seasonSnapshots: snapshots },
    players: [],
    teams: [],
    rosters: [],
  } as never;
}

const S1 = {
  seasonId: "season-1",
  seasonName: "Season 1",
  seasonAwards: [
    { awardId: "mvp", label: "MVP", category: "player", winnerType: "player", winnerId: "p-malagor", winnerName: "Malagor", value: 100, reason: "OVR 100" },
    { awardId: "pps_king", label: "PPs King", category: "player", winnerType: "player", winnerId: "p-malagor", winnerName: "Malagor", value: 30.3, reason: "30.3 Season-PPs" },
    { awardId: "all_star_pow", label: "All-Star POW", category: "player", winnerType: "player", winnerId: "p-golem", winnerName: "Lava Golem", value: 16.6, reason: "16.6 POW-PPs" },
  ],
};

const S2 = {
  seasonId: "season-2",
  seasonName: "Season 2",
  seasonAwards: [
    { awardId: "most_improved_player", label: "Most Improved Player", category: "player", winnerType: "player", winnerId: "p-malagor", winnerName: "Malagor", value: 40, reason: "Feldposition 20 → 60" },
  ],
};

describe("Spielerprofil: Auszeichnungen aus abgeschlossenen Saisons", () => {
  it("findet alle Titel eines Spielers ueber mehrere Saisons", () => {
    const treffer = buildPlayerSeasonAwards(spielstand([S1, S2]), "p-malagor");
    expect(treffer.map((eintrag) => eintrag.awardId)).toEqual(["most_improved_player", "mvp", "pps_king"]);
  });

  it("stellt die NEUESTE Saison nach vorn — im Profil zaehlt zuerst, was er jetzt ist", () => {
    const treffer = buildPlayerSeasonAwards(spielstand([S1, S2]), "p-malagor");
    expect(treffer[0]?.seasonId).toBe("season-2");
  });

  it("gibt jedem Titel seinen Grund mit — ein Titel ohne Begruendung waere Dekoration", () => {
    const treffer = buildPlayerSeasonAwards(spielstand([S1]), "p-malagor");
    expect(treffer.every((eintrag) => eintrag.reason.length > 0)).toBe(true);
    expect(treffer.find((eintrag) => eintrag.awardId === "mvp")?.reason).toContain("OVR");
  });

  it("verwechselt Spieler nicht — jeder bekommt nur seine eigenen", () => {
    expect(buildPlayerSeasonAwards(spielstand([S1]), "p-golem").map((e) => e.awardId)).toEqual(["all_star_pow"]);
    expect(buildPlayerSeasonAwards(spielstand([S1]), "p-niemand")).toEqual([]);
  });

  /**
   * DER UNTERSCHIED, DER IM PROFIL SICHTBAR WERDEN MUSS: „hat nichts gewonnen" und „dieser
   * Spielstand kennt das Feld noch nicht" sind zwei verschiedene Aussagen. Beide liefern hier
   * eine leere Liste — die Anzeige blendet den Abschnitt dann ganz aus, statt eine leere Leiste
   * zu zeigen, die wie ein Ausfall aussaehe.
   */
  it("bleibt bei Bestandsspielstaenden ohne das Feld still", () => {
    const ohneFeld = spielstand([{ seasonId: "season-1", seasonName: "Season 1" }]);
    expect(buildPlayerSeasonAwards(ohneFeld, "p-malagor")).toEqual([]);
  });

  it("kommt mit einem Spielstand ganz ohne Schnappschuesse zurecht", () => {
    expect(buildPlayerSeasonAwards(spielstand([]), "p-malagor")).toEqual([]);
    expect(buildPlayerSeasonAwards({ season: { id: "season-1" }, seasonState: {} } as never, "p-malagor")).toEqual([]);
  });

  it("liefert ohne Spieler-Kennung nichts, statt irgendetwas zu raten", () => {
    expect(buildPlayerSeasonAwards(spielstand([S1]), "")).toEqual([]);
  });
});

describe("Auszeichnungs-Zeichen", () => {
  it("gibt jedem bekannten Titel sein eigenes Zeichen", () => {
    const bekannte = ["mvp", "all_star_pow", "all_star_spe", "all_star_men", "all_star_soc", "training_award", "most_improved_player"];
    const zeichen = bekannte.map(getAwardIcon);
    // Kein Titel darf auf den Rueckfall fallen …
    expect(zeichen).not.toContain(AWARD_FALLBACK_ICON);
    // … und keine zwei duerfen sich dasselbe teilen, sonst sagt das Zeichen nichts aus.
    expect(new Set(zeichen).size).toBe(bekannte.length);
  });

  it("gibt einem UNBEKANNTEN Titel einen Pokal statt gar nichts", () => {
    // Ein neuer Award soll sichtbar sein, bevor jemand ihn hier eintraegt — sonst verschwindet
    // er stillschweigend aus dem Profil.
    expect(getAwardIcon("irgendein_neuer_award")).toBe(AWARD_FALLBACK_ICON);
  });
});

/**
 * SCHRITT 8, ERSTER TEIL: DIE KI KAUFT NICHT MEHR BLIND.
 *
 * ZWEI FEHLER, und der zweite wurde erst durch die Behebung des ersten sichtbar:
 *
 *   1. DIE KI BEWERTETE DAS GEBÄUDE GAR NICHT. Alle Terme in `scoreOfferForAi` rechnen in Cash;
 *      eine Gebäude-Karte hat eine niedrigere Leiter (E1), war fuer die KI also schlicht die
 *      schlechtere Karte. Dass sie trotzdem oft eine nahm, lag am Achsen-Term — sie hat fuer den
 *      richtigen Preis das Falsche gekauft.
 *
 *   2. SIE BEWERTETE AUCH DIE HÖHE DER KARTE NICHT. Nach Behebung von (1) nahmen 26 von 32 Teams
 *      die groesste Gebäude-Karte, auch bei Kasse −30. Grund war nicht der neue Term: KEINER der
 *      bestehenden mass die absolute Auszahlung. Der Kurven-Term rechnet `fitValue − anchor`, also
 *      eine FORM. Solange alle Karten eines Slates denselben Erwartungswert hatten, war das genau
 *      richtig — die Hoehe war konstant. Seit eine Gebäude-Karte weniger zahlt und eine legendäre
 *      mehr, sah die KI den Nutzen des Gebäudes und nie seinen Preis.
 *
 * Diese Suite haelt beide Terme fest und misst das Ergebnis an der Kassenlage.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { SPONSOR_GEBAEUDE_LEIHE_AKTIV } from "@/lib/sponsor/sponsor-leih-slate";

/**
 * DER GEBAEUDE-SCHALTER STEHT AUF AUS (`SPONSOR_GEBAEUDE_LEIHE_AKTIV = false`, #512) — Chris:
 * „mach das mit dem Schalter deaktiviere Gebäude". Ohne Gebaeude-Karten hat dieser Block nichts
 * zu messen; er laeuft deshalb genau dann, wenn der Schalter wieder an ist, und meldet sonst
 * sichtbar „uebersprungen" statt dauerhaft rot zu stehen. Der Schalter ist ausdruecklich als
 * Schalter gebaut und nicht als Ausbau, damit beide Stellungen vergleichbar bleiben — diese
 * Faelle sind die Absicherung der EIN-Stellung.
 *
 * Was im AUS-Zustand gilt, prueft `tests/sponsor-angebot-mit-leihe.test.ts` im Block
 * „Der Gebaeude-Schalter — was seine Stellung zusichert".
 */
const mitLeiheDescribe = describe.skipIf(!SPONSOR_GEBAEUDE_LEIHE_AKTIV);

function waehle(base: GameState, cash: number) {
  const state = { ...base, teams: base.teams.map((team) => ({ ...team, cash })) } as GameState;
  const nachher = chooseSponsorOfferForAiTeams(state);
  let reineCash = 0;
  let gross = 0;
  let mittel = 0;
  let klein = 0;
  for (const team of nachher.teams) {
    const leihe = getTeamSponsorContract(nachher, team.teamId)?.sponsorLeihe;
    if (!leihe) {
      reineCash += 1;
      continue;
    }
    const stufe = leihe.stufenreihe[0] ?? 0;
    if (stufe >= 5) gross += 1;
    else if (stufe >= 3) mittel += 1;
    else klein += 1;
  }
  return { reineCash, gross, mittel, klein };
}

mitLeiheDescribe("Die KI wiegt Gebäude gegen Cash ab", () => {
  it("greift bei leerer Kasse deutlich seltener zur groessten Karte", () => {
    const base = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const klamm = waehle(base, -30);
    const reich = waehle(base, 100);

    // Gemessen: klamm 11 reine Cash-Karten und 6 grosse Gebäude; reich 0 und 6, dafuer 22 mittlere.
    // Geprueft wird die RICHTUNG, nicht die zweite Stelle — die haengt an den Team-Profilen.
    expect(klamm.reineCash, "klamme Teams meiden die volle Auszahlung").toBeGreaterThan(reich.reineCash);
    expect(klamm.reineCash).toBeGreaterThan(0);
    // Und die Liga faellt nicht geschlossen auf EINE Groesse — das war der Zustand, bevor die
    // Kartenhoehe in die Rechnung kam (26 von 32 auf „gross").
    const verteilung = [klamm.klein, klamm.mittel, klamm.gross].filter((anzahl) => anzahl > 0);
    expect(verteilung.length, "die ganze Liga auf einer Gebäudegroesse").toBeGreaterThan(1);
    expect(Math.max(klamm.klein, klamm.mittel, klamm.gross)).toBeLessThan(base.teams.length * 0.75);
  });

  it("waehlt bei voller Kasse ueberwiegend ein Gebäude, ohne die Cash-Karte totzulegen", () => {
    const base = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const reich = waehle(base, 100);
    /**
     * Wer Spielraum hat, soll ihn benutzen — sonst waere die ganze Gebäude-Seite tot.
     *
     * DIE SCHWELLE HAENGT AN DER SLATE-GROESSE, nicht am Urteil der KI. „Ueberwiegend" war an
     * fuenf Karten gemessen, von denen vier ein Gebaeude trugen. Seit #512 sind es drei Karten
     * und damit nur noch ZWEI Gebaeude-Plaetze — eine Liga-Mehrheit ist dann nicht mehr dasselbe
     * Signal. Gemessen mit eingeschaltetem Schalter: 22 von 32 bei fuenf Karten, 14 von 32 bei
     * drei. In beiden Faellen lebt die Gebaeude-Seite, und genau das ist die Zusage.
     */
    expect(reich.gross + reich.mittel + reich.klein).toBeGreaterThan(base.teams.length / 3);
    // Aber die reine Cash-Karte bleibt eine lebende Option. Gemessen 8 von 32; sie war
    // zwischenzeitlich bei 0, weil eine gewoehnliche Gebäude-Karte ladderseitig BESSER war als eine
    // gewoehnliche Cash-Karte — genau die Verzerrung, die der Grundfaktor jetzt verhindert.
    expect(reich.reineCash).toBeGreaterThan(0);
  });

  it("bewertet ein Gebäude nicht, das das Team selbst schon hoeher hat", () => {
    // Das Overlay rechnet `max(eigen, geliehen)`. Eine Leihe unterhalb des eigenen Bestands bringt
    // exakt nichts — sie darf die Wahl deshalb auch nicht bewegen.
    const base = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const alleAusgebaut: GameState = {
      ...base,
      seasonState: {
        ...base.seasonState,
        teamFacilities: Object.fromEntries(
          base.teams.map((team) => [
            team.teamId,
            {
              facilities: Object.fromEntries(
                ["training_center", "recovery_center", "scouting_office", "analytics_room", "fan_shop", "arena_upgrade", "academy", "specialist_wing"].map(
                  (facilityId) => [facilityId, { level: 5, enabled: true, conditionPct: 100 }],
                ),
              ),
            },
          ]),
        ),
      },
    } as GameState;

    const ohneNutzen = waehle(alleAusgebaut, 100);
    const mitNutzen = waehle(base, 100);
    // Ein Team, dem die Leihe nichts bringt, greift oefter zur vollen Auszahlung.
    expect(ohneNutzen.reineCash).toBeGreaterThan(mitNutzen.reineCash);
  });
});

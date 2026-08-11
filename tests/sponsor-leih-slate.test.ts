/**
 * WELCHE DER FUENF KARTEN EIN GEBAEUDE TRAEGT.
 *
 * Geprueft werden die Auflagen, die aus der Messung stammen — nicht die einzelnen Wuerfe:
 *
 *   1. Platz 1 bleibt reines Geld. Zwoelf von 32 Teams koennen sich keinen Cash-Verzicht leisten;
 *      ein Slate ohne reine Cash-Karte waere fuer die halbe Liga eine Scheinauswahl.
 *   2. Platz 2 ist der guenstigste Einstieg — immer Stufe 1, damit auch ein klammes Team ihn stemmt.
 *   3. Derselbe Spielstand ergibt zweimal dasselbe Angebot, verschiedene Teams verschiedene.
 *   4. Eine tote Karte (Gebaeude, das das Team laengst hoeher gebaut hat) wird nicht angeboten.
 */
import { describe, expect, it } from "vitest";

import { berechneCashVerzicht, type SponsorLeihRaritaet } from "@/lib/sponsor/sponsor-leihe";
import {
  EINSTIEG_VERZICHT_DECKEL,
  VERLEIHBARE_GEBAEUDE,
  verteileLeihgabenAufSlate,
} from "@/lib/sponsor/sponsor-leih-slate";

const FUENF: SponsorLeihRaritaet[] = ["gewoehnlich", "magisch", "selten", "magisch", "legendaer"];

function slate(teamId: string, raritaeten: readonly SponsorLeihRaritaet[] = FUENF, eigeneStufen?: Record<string, number>) {
  return verteileLeihgabenAufSlate({ seasonId: "season-3", teamId, raritaeten, eigeneStufen });
}

describe("Platzverteilung", () => {
  it("laesst Platz 1 immer reines Geld — die Karte fuer Teams ohne Spielraum", () => {
    for (const teamId of ["T-1", "M-M", "R-R", "C-C"]) {
      const karten = slate(teamId);
      expect(karten[0]!.leihe).toBeNull();
      expect(karten[0]!.verzichtErsteSaison).toBe(0);
    }
  });

  it("gibt allen uebrigen Plaetzen ein Gebaeude", () => {
    const karten = slate("T-1");
    expect(karten).toHaveLength(5);
    for (const karte of karten.slice(1)) {
      expect(karte.leihe).not.toBeNull();
      expect(karte.verzichtErsteSaison).toBeGreaterThan(0);
    }
  });

  it("haelt Platz 2 unter dem gemessenen Median-Spielraum — Stufe 1, kurze Laufzeit", () => {
    // Ueber alle Raritaeten und viele Teams, damit nicht ein glueckliches Gebaeude das Ergebnis traegt.
    for (const raritaet of ["gewoehnlich", "magisch", "selten", "legendaer"] as const) {
      for (let index = 0; index < 32; index += 1) {
        const einstieg = slate(`T-${index}`, ["gewoehnlich", raritaet, "selten", "magisch", "legendaer"])[1]!;
        expect(einstieg.leihe!.stufenreihe[0]).toBe(1);
        // Der Deckel ist die eigentliche Zusage: die Haelfte der Liga muss diese Karte stemmen koennen.
        expect(einstieg.verzichtErsteSaison).toBeLessThanOrEqual(EINSTIEG_VERZICHT_DECKEL);
      }
    }
  });

  it("nimmt die Laufzeit vom Aufrufer, wenn er eine mitgibt", () => {
    // Im Live-Pfad kommt sie aus dem Slate-Wurf (`entry.termSeasons`), nicht aus dieser Datei — die
    // Vorgabe hier ist nur der Rueckfall fuer Aufrufer ohne eigene Laufzeiten.
    const ohneVorgabe = verteileLeihgabenAufSlate({ seasonId: "season-3", teamId: "T-1", raritaeten: FUENF });
    expect(ohneVorgabe[1]!.leihe!.stufenreihe).toHaveLength(2);

    const mitVorgabe = verteileLeihgabenAufSlate({
      seasonId: "season-3",
      teamId: "T-1",
      raritaeten: FUENF,
      laufzeiten: [1, 1, 3, 2, 3],
    });
    expect(mitVorgabe[1]!.leihe!.stufenreihe).toHaveLength(1);
    expect(mitVorgabe[2]!.leihe!.stufenreihe).toHaveLength(3);
  });

  it("laesst den Einstieg NICHT zur teuersten Karte werden", () => {
    // Kein „billigste des Slates" — das waere nicht haltbar, weil eine legendaere Stufe-2-Karte
    // guenstiger sein kann als eine gewoehnliche Stufe-1-Karte. Aber der Einstieg darf nie das
    // Teuerste sein, sonst traegt der Name nicht.
    for (let index = 0; index < 32; index += 1) {
      const karten = slate(`T-${index}`);
      const andere = karten.slice(2).map((karte) => karte.verzichtErsteSaison);
      expect(karten[1]!.verzichtErsteSaison).toBeLessThan(Math.max(...andere));
    }
  });
});

describe("Zustand als Vertragsvariable", () => {
  it("leiht der gewoehnliche Sponsor Gebrauchtes, der legendaere Neuwertiges", () => {
    const karten = slate("T-1", ["gewoehnlich", "gewoehnlich", "magisch", "selten", "legendaer"]);
    const zustand = (index: number) => karten[index]!.leihe!.startZustandPct;

    expect(zustand(1)).toBeLessThan(zustand(2));
    expect(zustand(2)).toBeLessThan(zustand(3));
    expect(zustand(3)).toBeLessThan(zustand(4));
    expect(zustand(4)).toBe(100);
    // Die gewoehnliche Leihe startet UNTER der Wirkschwelle 80 — sie wirkt sofort spuerbar schwaecher.
    expect(zustand(1)).toBeLessThan(80);
  });
});

describe("Bestimmtheit", () => {
  it("ergibt zweimal dasselbe Angebot", () => {
    expect(slate("M-M")).toEqual(slate("M-M"));
  });

  it("streut ueber die Teams statt zu klumpen", () => {
    // Gemessen, nicht behauptet: ueber 32 Teams kommt jedes der acht Gebaeude mindestens einmal
    // vor, und keines traegt mehr als ein Viertel der Liga. Ein Slate, das ligaweit dasselbe
    // Gebaeude verleiht, waere eine Anzeige und keine Entscheidung.
    //
    // (Die `avalanche`-Mischung vor dem Modulo ist hier NICHT der Grund dafuer — bei acht Eimern
    // streut auch FNV-1a allein sauber, nachgemessen. Sie bleibt aus Gleichform mit den Formkarten
    // stehen, wo der Modulo ueber zwei Eimer lief und die Mischung tatsaechlich noetig war.)
    const zaehler = new Map<string, number>();
    for (let index = 0; index < 32; index += 1) {
      const facilityId = slate(`T-${index}`)[2]!.leihe!.facilityId;
      zaehler.set(facilityId, (zaehler.get(facilityId) ?? 0) + 1);
    }
    expect(zaehler.size).toBe(VERLEIHBARE_GEBAEUDE.length);
    expect(Math.max(...zaehler.values())).toBeLessThanOrEqual(8);
  });
});

describe("Tote Karten", () => {
  it("bietet kein Gebaeude an, das das Team selbst schon hoeher gebaut hat", () => {
    // Alles ausser Reha ist beim Team bereits auf Hoechststufe — die Leihe kann nur Reha sein.
    const eigene = Object.fromEntries(
      VERLEIHBARE_GEBAEUDE.filter((facilityId) => facilityId !== "recovery_center").map((facilityId) => [facilityId, 5]),
    );
    for (let index = 0; index < 16; index += 1) {
      const karten = slate(`T-${index}`, FUENF, eigene);
      for (const karte of karten.slice(1)) {
        expect(karte.leihe!.facilityId).toBe("recovery_center");
      }
    }
  });

  it("faellt auf den vollen Katalog zurueck, wenn das Team ueberall ausgebaut ist", () => {
    const alles = Object.fromEntries(VERLEIHBARE_GEBAEUDE.map((facilityId) => [facilityId, 5]));
    const karten = slate("T-1", FUENF, alles);
    // Kein Absturz, kein leerer Slot — die Karte ist dann eben schwach, aber sie existiert.
    for (const karte of karten.slice(1)) {
      expect(VERLEIHBARE_GEBAEUDE).toContain(karte.leihe!.facilityId);
    }
  });
});

describe("Der Preis der Karte", () => {
  it("steht in derselben Rechnung wie die Leihschicht", () => {
    const karte = slate("T-7")[3]!;
    expect(karte.verzichtErsteSaison).toBe(
      berechneCashVerzicht({
        facilityId: karte.leihe!.facilityId,
        stufe: karte.leihe!.stufenreihe[0]!,
        raritaet: karte.raritaet,
      }),
    );
  });
});

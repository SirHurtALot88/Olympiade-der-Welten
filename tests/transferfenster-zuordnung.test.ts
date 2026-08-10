/**
 * GEMELDET: „was hier noch falsch verknüpft ist bei den verkäufen ist der benchmark verkäufe aus
 * S1 am ende! daher müssten alle teams auch schon verkäufe haben" — auf dem Transferboard stand
 * bei jedem Team „Einnahmen 0,0 Mio".
 *
 * BEFUND: die 49 Verkaeufe liegen am letzten Spieltag von Saison 1, die 102 Kaeufe, die sie
 * bezahlt haben, am ersten von Saison 2. Ein Fenster, zwei Saison-IDs — das Board gruppierte nach
 * Saison und zerschnitt es.
 *
 * Die Zahlen unten sind am Live-Spielstand ausgezaehlt (`new-game-1785823388048-1hf25q`).
 */
import { describe, expect, it } from "vitest";

import {
  ermittleFensterSaisonId,
  ermittleLetzteSpieltageJeSaison,
  ordneNachTransferfenster,
  saisonNummer,
  spieltagNummer,
} from "@/lib/foundation/transfer-window-zuordnung";

const FENSTER = "manual_transfer_window";

/** Der echte Zuschnitt der Historie, auf die Feldanzahl eingedampft. */
const ECHTE_HISTORIE = [
  ...Array.from({ length: 329 }, () => ({
    seasonId: "season-1",
    matchdayId: "matchday-1",
    phase: FENSTER,
    art: "draft-kauf",
  })),
  ...Array.from({ length: 9 }, () => ({
    seasonId: "season-1",
    matchdayId: "matchday-1",
    phase: FENSTER,
    art: "manueller-kauf-s1",
  })),
  ...Array.from({ length: 54 }, () => ({
    seasonId: "season-1",
    matchdayId: "matchday-10",
    phase: "contract_renewal",
    art: "vertragsende",
  })),
  ...Array.from({ length: 47 }, () => ({
    seasonId: "season-1",
    matchdayId: "matchday-10",
    phase: FENSTER,
    art: "ki-verkauf",
  })),
  ...Array.from({ length: 2 }, () => ({
    seasonId: "season-1",
    matchdayId: "matchday-10",
    phase: FENSTER,
    art: "eigener-verkauf",
  })),
  ...Array.from({ length: 102 }, () => ({
    seasonId: "season-2",
    matchdayId: "season-2-matchday-1",
    phase: FENSTER,
    art: "kauf-s2",
  })),
];

function zaehleJeFenster(art: string) {
  const zuordnung = ordneNachTransferfenster(ECHTE_HISTORIE);
  const zaehler = new Map<string, number>();
  for (const [eintrag, fenster] of zuordnung) {
    if (eintrag.art !== art) continue;
    zaehler.set(fenster, (zaehler.get(fenster) ?? 0) + 1);
  }
  return zaehler;
}

describe("Spieltags- und Saisonnummern", () => {
  it("liest die Nummer aus beiden Schreibweisen", () => {
    // Saison 1 schreibt `matchday-10`, Saison 2 `season-2-matchday-1` — dieselbe Liga.
    expect(spieltagNummer("matchday-10")).toBe(10);
    expect(spieltagNummer("season-2-matchday-1")).toBe(1);
    expect(spieltagNummer(null)).toBeNull();
    expect(spieltagNummer("draft")).toBeNull();
  });

  it("liest die Saisonnummer", () => {
    expect(saisonNummer("season-2")).toBe(2);
    expect(saisonNummer(null)).toBeNull();
  });

  it("findet je Saison den hoechsten Spieltag", () => {
    const letzte = ermittleLetzteSpieltageJeSaison(ECHTE_HISTORIE);
    expect(letzte.get("season-1")).toBe(10);
    expect(letzte.get("season-2")).toBe(1);
  });
});

describe("Die Verkaeufe vom Saisonende gehoeren ins Fenster der Folgesaison", () => {
  it("die 47 KI-Verkaeufe wandern nach season-2", () => {
    expect(zaehleJeFenster("ki-verkauf").get("season-2")).toBe(47);
  });

  it("die 2 eigenen Verkaeufe wandern mit — gleiches Fenster, gleiche Behandlung", () => {
    expect(zaehleJeFenster("eigener-verkauf").get("season-2")).toBe(2);
  });

  it("die 102 Kaeufe der Saison 2 bleiben, wo sie sind", () => {
    expect(zaehleJeFenster("kauf-s2").get("season-2")).toBe(102);
  });
});

describe("Was NICHT wandern darf", () => {
  /**
   * DER FALL, DER ES BEINAHE KAPUTT GEMACHT HAETTE: der Erst-Draft liegt auf `matchday-1`. Wuerde
   * die Regel bloss „letzter vorkommender Spieltag" pruefen, ohne dass eine Saison ueberhaupt
   * gespielt wurde, waeren alle 329 Draft-Kaeufe nach Saison 2 gewandert.
   */
  it("der Erst-Draft aus Saison 1 bleibt in Saison 1", () => {
    expect(zaehleJeFenster("draft-kauf").get("season-1")).toBe(329);
    expect(zaehleJeFenster("draft-kauf").get("season-2")).toBeUndefined();
  });

  it("auch dann nicht, wenn eine Saison NUR Spieltag 1 kennt", () => {
    const nurDraft = [{ seasonId: "season-1", matchdayId: "matchday-1", phase: FENSTER }];
    const letzte = ermittleLetzteSpieltageJeSaison(nurDraft);
    expect(ermittleFensterSaisonId(nurDraft[0]!, letzte)).toBe("season-1");
  });

  it("deine eigenen Kaeufe aus Saison 1 bleiben in Saison 1", () => {
    expect(zaehleJeFenster("manueller-kauf-s1").get("season-1")).toBe(9);
  });

  it("auslaufende Vertraege bleiben bei ihrer Saison — kein Transfer, keine Einnahme", () => {
    // Liegen ebenfalls auf Spieltag 10, tragen aber `contract_renewal`.
    expect(zaehleJeFenster("vertragsende").get("season-1")).toBe(54);
    expect(zaehleJeFenster("vertragsende").get("season-2")).toBeUndefined();
  });

  /**
   * Die Transferliste laedt seitenweise. Ohne Untergrenze gaelte bei einer Teilseite, die bei
   * Spieltag 4 endet, der vierte Spieltag als Saisonabschluss — und mitten in der Saison verkaufte
   * Spieler waeren in die naechste Saison gewandert.
   */
  it("bei einer Teilseite wandert nichts, was den letzten Spieltag nicht erreicht", () => {
    const teilseite = [
      { seasonId: "season-1", matchdayId: "matchday-4", phase: FENSTER },
      { seasonId: "season-1", matchdayId: "matchday-2", phase: FENSTER },
    ];
    const letzte = ermittleLetzteSpieltageJeSaison(teilseite);
    // Ohne Wissen ueber die Spieltagszahl haelt der hoechste geladene Spieltag her — und irrt.
    expect(ermittleFensterSaisonId(teilseite[0]!, letzte)).toBe("season-2");
    // Mit den 10 Spieltagen der Liga bleibt er, wo er hingehoert.
    expect(ermittleFensterSaisonId(teilseite[0]!, letzte, 10)).toBe("season-1");
  });

  it("die echten Saisonende-Verkaeufe wandern auch MIT Untergrenze", () => {
    const zuordnung = ordneNachTransferfenster(ECHTE_HISTORIE, 10);
    let gewandert = 0;
    for (const [eintrag, fenster] of zuordnung) {
      if (eintrag.art === "ki-verkauf" && fenster === "season-2") gewandert += 1;
    }
    expect(gewandert).toBe(47);
  });

  it("ein Eintrag ohne Spieltag wandert nie", () => {
    const ohne = [
      { seasonId: "season-1", matchdayId: null, phase: FENSTER },
      { seasonId: "season-1", matchdayId: "matchday-10", phase: FENSTER },
    ];
    const letzte = ermittleLetzteSpieltageJeSaison(ohne);
    expect(ermittleFensterSaisonId(ohne[0]!, letzte)).toBe("season-1");
    expect(ermittleFensterSaisonId(ohne[1]!, letzte)).toBe("season-2");
  });
});

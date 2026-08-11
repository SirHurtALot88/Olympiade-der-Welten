/**
 * DAS LEIH-OVERLAY — was ein geliehenes Gebäude über dem eigenen Bestand bedeutet.
 *
 * Ein Sponsor STELLT ein Gebäude, er schenkt es nicht. Solange der Vertrag laeuft und die
 * Rangmarke haelt, wirkt das Team so, als haette es die geliehene Stufe. Faellt die Marke oder
 * endet der Vertrag, faellt es auf den EIGENEN Bestand zurueck — nie darunter.
 *
 * Chris zur Grundidee: „nur geliehen und dazu natürlich trotzdem sponsorengelder weil seine leute
 * muss man ja bezahlen" und „vllt hat man dann ziele wie über platz x bleiben damit manche gebäude
 * gelten".
 *
 * DER ZUSTAND IST VERTRAGSSACHE, nicht nur Buchhaltung. Chris: „bitte auch bedenken dass geliehene
 * gebäude übernommen werden aber ggf. abnutzung haben! das sollte auch bereits drin stehen wie gut
 * das gebäude noch ist so hast du noch eine variable mit der man spielen kann um unterschiedliche
 * verträge zu erzeugen". Zwei Sponsoren koennen also dasselbe Gebaeude auf derselben Stufe
 * anbieten und trotzdem verschieden wertvoll sein — der eine leiht neu, der andere gebraucht.
 *
 * Reine Funktionen, kein Schreiben in den Spielstand.
 */
import type { TeamFacilityCollection, TeamFacilityRecord } from "@/lib/data/olyDataTypes";
import type { FacilityId } from "@/lib/facilities/facility-catalog";
import {
  FACILITY_CONDITION_FULL,
  clampFacilityCondition,
  getFacilityEfficiencyPct,
} from "@/lib/facilities/facility-condition";

/** Was ein laufender Sponsorvertrag an Gebäude beisteuert. */
export type SponsorLeihgabe = {
  facilityId: FacilityId;
  /** Die in DIESER Saison geliehene Stufe. */
  stufe: number;
  /** Zustand der Leihgabe (0..100) — die Vertragsvariable. */
  zustandPct: number;
  /**
   * Ruht die Leihe gerade? Die Rangmarke schaltet das Gebäude scharf oder ab. Der Cash-Verzicht
   * laeuft dabei WEITER — das ist der Preis des Risikos und steht so auf der Karte.
   */
  ruht?: boolean;
};

export type LeihWirkung = {
  /** Die Stufe, mit der das Team tatsaechlich rechnet: das Beste aus eigen und geliehen. */
  effektiveStufe: number;
  /** Der Zustand, der zu dieser Stufe gehoert. */
  effektiverZustandPct: number;
  /** Wirkungsgrad in Prozent, aus dem Zustand abgeleitet. */
  effizienzPct: number;
  /** Kommt die wirksame Stufe vom Sponsor oder aus eigenem Bestand? */
  quelle: "eigen" | "geliehen";
};

/**
 * Die wirksame Stufe eines Gebäudes: das Maximum aus eigenem Bestand und aktiver Leihgabe.
 *
 * Bewusst `max` und nicht „Leihe ersetzt Bestand": wer selbst schon Stufe 4 gebaut hat und eine
 * Stufe-2-Leihe bekommt, darf dadurch nicht schlechter dastehen. Die Leihe ist ein Boden, keine
 * Decke.
 *
 * Ruht die Leihe (Rangmarke gerissen), zaehlt sie gar nicht — dann steht da der eigene Bestand,
 * auch wenn der 0 ist.
 */
export function berechneLeihWirkung(input: {
  eigen: Pick<TeamFacilityRecord, "level" | "conditionPct"> | null | undefined;
  leihgabe?: SponsorLeihgabe | null;
}): LeihWirkung {
  const eigeneStufe = Math.max(0, input.eigen?.level ?? 0);
  const eigenerZustand = clampFacilityCondition(input.eigen?.conditionPct);
  const leihe = input.leihgabe && !input.leihgabe.ruht ? input.leihgabe : null;

  if (!leihe || leihe.stufe <= eigeneStufe) {
    return {
      effektiveStufe: eigeneStufe,
      effektiverZustandPct: eigenerZustand,
      effizienzPct: eigeneStufe > 0 ? getFacilityEfficiencyPct(eigenerZustand) : 0,
      quelle: "eigen",
    };
  }

  const leihZustand = clampFacilityCondition(leihe.zustandPct);
  return {
    effektiveStufe: leihe.stufe,
    effektiverZustandPct: leihZustand,
    effizienzPct: getFacilityEfficiencyPct(leihZustand),
    quelle: "geliehen",
  };
}

/**
 * Legt die Leihgaben ueber den Gebäudebestand eines Teams und liefert eine Sammlung, die sich
 * ueberall wie der echte Bestand verhaelt.
 *
 * Damit muss keine einzige Wirkungsrechnung (Training, Erholung, Einnahmen) von der Leihe wissen —
 * sie sehen eine Sammlung und rechnen wie immer. Ohne Leihgaben kommt die Sammlung unveraendert
 * zurueck, es gibt also keinen zweiten Pfad, der auseinanderdriften koennte.
 */
export function legeLeihgabenUeberBestand(
  bestand: TeamFacilityCollection,
  leihgaben: readonly SponsorLeihgabe[],
): TeamFacilityCollection {
  const aktive = leihgaben.filter((leihgabe) => !leihgabe.ruht && leihgabe.stufe > 0);
  if (aktive.length === 0) {
    return bestand;
  }

  const facilities = { ...bestand.facilities };
  for (const leihgabe of aktive) {
    const eigen = facilities[leihgabe.facilityId];
    const wirkung = berechneLeihWirkung({ eigen, leihgabe });
    if (wirkung.quelle !== "geliehen") {
      continue;
    }
    facilities[leihgabe.facilityId] = {
      ...(eigen ?? { level: 0, enabled: false }),
      level: wirkung.effektiveStufe,
      enabled: true,
      conditionPct: wirkung.effektiverZustandPct,
      disabledReason: undefined,
    };
  }

  return { facilities };
}

/**
 * Der Zustand einer Leihgabe am Ende einer Saison — dieselbe Abnutzung wie bei eigenen Gebäuden.
 * Der Unterhalt gilt als bezahlt, weil ihn der Sponsor traegt; die Leihe verschleisst also im
 * langsameren der beiden Takte.
 */
export function altereLeihgabe(
  leihgabe: SponsorLeihgabe,
  verschleiss: number,
): SponsorLeihgabe {
  return {
    ...leihgabe,
    zustandPct: clampFacilityCondition(leihgabe.zustandPct - Math.max(0, verschleiss)),
  };
}

/** Anzeigehilfe: „Stufe 3 · geliehen · 76 % Zustand" — was auf der Karte steht. */
export function beschreibeLeihgabe(leihgabe: SponsorLeihgabe): string {
  const zustand = clampFacilityCondition(leihgabe.zustandPct);
  const zustandsText =
    zustand >= FACILITY_CONDITION_FULL ? "neuwertig" : `${Math.round(zustand)} % Zustand`;
  return leihgabe.ruht
    ? `Stufe ${leihgabe.stufe} · ruht · ${zustandsText}`
    : `Stufe ${leihgabe.stufe} · geliehen · ${zustandsText}`;
}

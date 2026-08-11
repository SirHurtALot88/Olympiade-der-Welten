/**
 * WAS AUF EINER GEBÄUDE-KARTE STEHT — eine Rechenstelle für die Anzeige, damit Karte und
 * Abrechnung nicht auseinanderlaufen können.
 *
 * Diese Datei rechnet NICHTS neu. Sie liest den bei Unterschrift eingefrorenen `sponsorLeihe`-Block
 * und formt ihn zu Zeilen. Jede Zahl darin stammt aus `sponsor-leihe.ts`, dieselbe Quelle, aus der
 * auch die Leiter ihren Verzicht bezieht — genau das ist die Absicherung gegen den Fehler, der in
 * diesem Projekt schon mehrfach vorkam: eine Anzeige, die etwas anderes ausrechnet als die Buchung.
 *
 * DIE VIER DINGE, DIE EIN SPIELER WISSEN MUSS, und mehr soll die Karte nicht zeigen:
 *
 *   1. WAS bekomme ich — Gebäude, Stufe, Zustand.
 *   2. WAS kostet es — der Cash-Verzicht dieser Saison, und dass er in der Leiter schon drin ist.
 *   3. WORAN hängt es — die Rangmarke, und dass der Verzicht auch bei gerissener Marke weiterläuft.
 *   4. WAS kommt danach — Stufenreihe über die Laufzeit und der Übernahmepreis am Ende.
 */
import type { SponsorLeihgabeRecord, SponsorOffer, SponsorOfferLeihe, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG_BY_ID, type FacilityId } from "@/lib/facilities/facility-catalog";
import { getFacilityEfficiencyPct, FACILITY_CONDITION_WARNING } from "@/lib/facilities/facility-condition";
import { berechneUebernahmepreis } from "@/lib/sponsor/sponsor-leihe";
import { beschreibeRangmarke, marktGehalten } from "@/lib/sponsor/sponsor-rangmarke";

export type SponsorLeihPresentation = {
  facilityId: string;
  /** Anzeigename aus dem Gebäudekatalog — nie die rohe ID. */
  facilityName: string;
  raritaet: string;
  /** Die Stufe DIESER Saison. */
  stufe: number;
  /** Stufe je Vertragsjahr, für die kleine Leiter auf der Karte. */
  stufenreihe: number[];
  zustandPct: number;
  /**
   * Wirkungsgrad in Prozent. Unter `FACILITY_CONDITION_WARNING` (80) fällt er ab — genau das macht
   * eine gebrauchte Leihe spürbar schwächer, ohne eine zweite Zahl zu erfinden.
   */
  wirkungsgradPct: number;
  /** Ist der Zustand schon unter der Wirkschwelle? Dann gehört ein Hinweis auf die Karte. */
  unterWirkschwelle: boolean;
  /** Cash-Verzicht dieser Saison. STECKT BEREITS IN DER LEITER — nie zusätzlich abziehen. */
  verzichtDieseSaison: number;
  verzichtJeSaison: number[];
  /** Was der Sponsor je Saison bereitstellt — die Gegenrechnung zum Verzicht. */
  leihwertDieseSaison: number;
  rangmarke: number | null;
  rangmarkenHaerte: "mild" | "hart" | null;
  /** Statuszeile: „aktiv · Platz 6 von Top 8" oder „ruht · 4 Plätze unter der Marke". */
  markenStatus: string | null;
  /** Ruht die Leihe gerade? Nur belegt, wenn es eine laufende Leihgabe im Spielstand gibt. */
  ruht: boolean;
  /** Was der Selbstbau der Endstufe kosten würde — der Vergleichsanker der Übernahme. */
  katalogkostenEndstufe: number;
  /** Geschätzter Übernahmepreis am Vertragsende, beim heutigen Zustand. */
  uebernahmepreisJetzt: number;
};

function facilityName(facilityId: string): string {
  return FACILITY_CATALOG_BY_ID[facilityId as FacilityId]?.label ?? facilityId;
}

/**
 * Die Anzeige einer Gebäude-Karte.
 *
 * `leihgabe` ist optional und nur bei einem LAUFENDEN Vertrag vorhanden — sie trägt den aktuellen
 * Zustand und den Ruhezustand. Für ein Angebot, das noch niemand unterschrieben hat, gibt es sie
 * naturgemäß nicht; dann zeigt die Karte den Anfangszustand der Karte.
 */
export function buildSponsorLeihPresentation(input: {
  leihe: SponsorOfferLeihe;
  leihgabe?: SponsorLeihgabeRecord | null;
  /** Aktueller Tabellenplatz — nur für die Statuszeile. */
  aktuellerRang?: number | null;
  /** Vertragsjahr (1-basiert). Ohne Angabe die erste Saison. */
  vertragsjahr?: number;
}): SponsorLeihPresentation {
  const { leihe } = input;
  const index = Math.max(0, Math.min(leihe.stufenreihe.length - 1, (input.vertragsjahr ?? 1) - 1));
  const stufe = input.leihgabe?.stufe ?? leihe.stufenreihe[index] ?? leihe.stufenreihe[0] ?? 0;
  const zustandPct = input.leihgabe?.zustandPct ?? leihe.startZustandPct;
  const wirkungsgradPct = getFacilityEfficiencyPct(zustandPct);
  const endstufe = leihe.stufenreihe[leihe.stufenreihe.length - 1] ?? stufe;

  return {
    facilityId: leihe.facilityId,
    facilityName: facilityName(leihe.facilityId),
    raritaet: leihe.raritaet,
    stufe,
    stufenreihe: leihe.stufenreihe,
    zustandPct,
    wirkungsgradPct,
    unterWirkschwelle: zustandPct < FACILITY_CONDITION_WARNING,
    verzichtDieseSaison: leihe.verzichtJeSaison[index] ?? leihe.verzichtJeSaison[0] ?? 0,
    verzichtJeSaison: leihe.verzichtJeSaison,
    leihwertDieseSaison: leihe.leihwertJeSaison[index] ?? leihe.leihwertJeSaison[0] ?? 0,
    rangmarke: leihe.rangmarke ?? null,
    rangmarkenHaerte: leihe.rangmarkenHaerte ?? null,
    markenStatus:
      leihe.rangmarke == null
        ? null
        : beschreibeRangmarke({ aktuellerRang: input.aktuellerRang ?? null, marke: leihe.rangmarke }),
    ruht:
      input.leihgabe?.ruht === true ||
      (leihe.rangmarke != null &&
        input.aktuellerRang != null &&
        !marktGehalten({ aktuellerRang: input.aktuellerRang, marke: leihe.rangmarke })),
    katalogkostenEndstufe: leihe.katalogkostenEndstufe,
    // Der Preis, wenn der Vertrag JETZT endete: angerechnet werden die bis hierher bereitgestellten
    // Stufen, abgezogen die Reparatur beim heutigen Zustand.
    uebernahmepreisJetzt: berechneUebernahmepreis({
      facilityId: leihe.facilityId as FacilityId,
      stufe: endstufe,
      gehalteneStufen: leihe.stufenreihe,
      zustandPct,
    }),
  };
}

/** Bequemer Einstieg für ein Angebot (noch nicht unterschrieben). */
export function buildLeihPresentationForOffer(offer: SponsorOffer): SponsorLeihPresentation | null {
  return offer.sponsorLeihe ? buildSponsorLeihPresentation({ leihe: offer.sponsorLeihe }) : null;
}

/** Bequemer Einstieg für einen laufenden Vertrag samt seiner Leihgabe im Spielstand. */
export function buildLeihPresentationForContract(input: {
  contract: TeamSponsorContract;
  leihgaben?: readonly SponsorLeihgabeRecord[];
  aktuellerRang?: number | null;
}): SponsorLeihPresentation | null {
  const leihe = input.contract.sponsorLeihe;
  if (!leihe) return null;
  const laufzeit = Math.max(1, input.contract.termSeasons ?? 1);
  const rest = Math.max(0, Math.min(laufzeit, input.contract.seasonsRemaining ?? laufzeit));
  return buildSponsorLeihPresentation({
    leihe,
    leihgabe: (input.leihgaben ?? []).find((eintrag) => eintrag.offerId === input.contract.offerId) ?? null,
    aktuellerRang: input.aktuellerRang ?? null,
    vertragsjahr: Math.max(1, laufzeit - rest + 1),
  });
}

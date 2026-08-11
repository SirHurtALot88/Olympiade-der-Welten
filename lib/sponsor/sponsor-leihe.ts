/**
 * DIE RECHENSCHICHT DER GEBÄUDE-LEIHE — reine Funktionen, kein Spielstand, keine Seiteneffekte.
 *
 * Grundlage: `docs/SPONSOREN_BAUVORLAGE.md`, Abschnitt −1 (die Entscheidungen vom 11.08. schlagen
 * die aeltere Fassung) und Abschnitt 4.
 *
 * DAS MODELL IN EINEM SATZ: Ein Sponsor zahlt entweder viel Cash und sonst nichts, oder weniger
 * Cash und stellt dafuer ein Gebaeude. Es wird NICHTS abgezogen — die Gebaeude-Karte hat schlicht
 * eine niedrigere Leiter. Chris: „Teams nehmen bewusst in kauf weniger cash zu bekommen um gute
 * gebäude zu leihen. Wenn sie auf das cash angewiesen sind brauchen sie den bestmöglichen Cash
 * Sponsor."
 *
 * WARUM RUECKWAERTS GERECHNET WIRD: Die Karte bietet eine konkrete Gebaeudestufe an, daraus folgt
 * der Verzicht — nicht umgekehrt. Rechnete man vom Verzicht zum Gebaeudewert, kaeme ein Betrag
 * zwischen zwei Stufen heraus, mit dem im Spiel niemand etwas anfangen kann.
 */
import {
  FACILITY_CATALOG_BY_ID,
  getFacilityLevelDefinition,
  type FacilityId,
} from "@/lib/facilities/facility-catalog";
import {
  calculateFacilityMaintenanceCost,
  clampFacilityCondition,
} from "@/lib/facilities/facility-condition";

/**
 * Die vier Raritaeten in Chris' Reihenfolge — gewöhnlich → magisch → selten → legendär.
 * Sie sind der UMWANDLUNGSKURS, nicht die Hoehe: „mach gewöhnlich 1,4 und ende bei legendär mit
 * 3,0 was umwandlung angeht". Die beiden Zwischenstufen sind geometrisch gestaffelt (Faktor ~1,29
 * je Stufe), damit jede Raritaet dasselbe relative Plus bringt und die absoluten Spruenge nach
 * oben groesser werden — eine seltene Karte soll sich deutlich anfuehlen, nicht nur ein bisschen.
 */
export const SPONSOR_LEIH_KURSE = {
  gewoehnlich: 1.4,
  magisch: 1.8,
  selten: 2.3,
  legendaer: 3.0,
} as const;

export type SponsorLeihRaritaet = keyof typeof SPONSOR_LEIH_KURSE;

/** Der Divisor der Leihwert-Formel — siehe `berechneLeihwert`. */
export const LEIHWERT_DIVISOR = 5;

function rundeAufZehntel(wert: number) {
  return Math.round(wert * 10) / 10;
}

/** Kumulierte Baukosten bis einschliesslich dieser Stufe — was der Selbstbau kosten wuerde. */
export function berechneKatalogkosten(facilityId: FacilityId, stufe: number): number {
  const eintrag = FACILITY_CATALOG_BY_ID[facilityId];
  if (!eintrag || stufe <= 0) return 0;
  let summe = 0;
  for (let ebene = 1; ebene <= Math.min(stufe, eintrag.maxLevel); ebene += 1) {
    summe += getFacilityLevelDefinition(facilityId, ebene)?.upgradeCost ?? 0;
  }
  return rundeAufZehntel(summe);
}

/**
 * WAS EINE SAISON LEIHE WERT IST.
 *
 * Fuer EINNAHMEGEBAEUDE (Fan Shop, Arena) ist die Frage trivial beantwortbar: ihr Nutzen steht
 * selbst in Cash im Katalog. Genau das wird genommen — nicht die Formel unten. Der Unterschied ist
 * nicht kosmetisch: bei der Arena liegt der Formelwert ueber dem echten Ertrag, eine Karte mit
 * Formelpreis waere dort ein Verlustgeschaeft und damit eine Karte, die niemand nehmen sollte.
 *
 * Fuer WIRKUNGSGEBAEUDE gibt es keinen Cash-Wert, nur Trainingsprozente und Erholungspunkte.
 * Dafuer die Naeherung `kumulierte Baukosten / 5 + Saison-Unterhalt`: was der Selbstbau kostet,
 * verteilt auf eine angenommene Nutzungsdauer, plus die laufenden Kosten, die der Sponsor traegt.
 * Geeicht am einzigen Gebaeude, das beides hat — Fan Shop Stufe 3: Formel 11,8 gegen echten
 * Katalog-Ertrag 11,7.
 *
 * Der Divisor 5 ist damit an EINEM Punkt geprueft und fuer die Wirkungsgebaeude eine Uebertragung,
 * keine Messung (siehe „Ungemessen" in der Bauvorlage).
 */
export function berechneLeihwert(facilityId: FacilityId, stufe: number): number {
  const definition = getFacilityLevelDefinition(facilityId, stufe);
  if (!definition) return 0;
  if (typeof definition.seasonIncome === "number") {
    return rundeAufZehntel(definition.seasonIncome);
  }
  return rundeAufZehntel(berechneKatalogkosten(facilityId, stufe) / LEIHWERT_DIVISOR + definition.seasonUpkeep);
}

/**
 * Der Cash-Verzicht dieser Karte je Saison: Leihwert geteilt durch den Kurs der Raritaet.
 *
 * Ein legendaerer Sponsor verlangt fuer dasselbe Gebaeude also WENIGER Cash als ein gewoehnlicher —
 * das ist der Sinn der Rarität. Sie macht die Karte nicht groesser, sondern das Geschaeft besser.
 */
export function berechneCashVerzicht(input: {
  facilityId: FacilityId;
  stufe: number;
  raritaet: SponsorLeihRaritaet;
}): number {
  const leihwert = berechneLeihwert(input.facilityId, input.stufe);
  if (leihwert <= 0) return 0;
  return rundeAufZehntel(leihwert / SPONSOR_LEIH_KURSE[input.raritaet]);
}

/**
 * DER UEBERNAHMEPREIS AM VERTRAGSENDE.
 *
 * Angerechnet wird, was der Sponsor BEREITGESTELLT hat — die Summe der Leihwerte aller gehaltenen
 * Saisons —, nicht was der Spieler gezahlt hat. Der Unterschied entscheidet ueber die Richtung des
 * ganzen Systems: rechnete man die gezahlten Verzichte an, bekaeme die seltenere Karte am Ende den
 * SCHLECHTEREN Preis (sie kostet ja weniger Verzicht). Die beste Karte waere die teuerste — genau
 * verkehrt herum.
 *
 * DER ZUSTAND WIRKT ALS REPARATURLAST, NICHT ALS PROZENTRABATT.
 *
 * Chris: „bei zustand 50 gilt das zwar für die aktuelle stufe aber der kaufpreis in summe für zb
 * stufe 4 ist ja deutlich höher sonst wäre der rabatt zu krass wenn man für 20 mio n gebäude stufe
 * 4 oder so kaufen könnte." Und frueher schon: „die upgrade stufen dort hin kosten natürlich immer
 * gleich viel."
 *
 * Der erste Entwurf multiplizierte den Restpreis mit dem Zustand — Reha Stufe 4 waere bei Zustand
 * 50 fuer 21,3 zu haben gewesen, bei einem Selbstbau von 77. Das ist zu billig, und es widerspricht
 * der eigenen Regel: die Stufen kosten, was sie kosten; abgenutzt ist nicht dasselbe wie „halb so
 * viele Stufen".
 *
 * Richtig ist der Abzug der REPARATUR, die der Kaeufer erbt — dieselbe Rechnung, die er auch
 * zahlen muesste, wenn er das Gebaeude schon haette (`calculateFacilityMaintenanceCost`). Damit
 * bleibt der Preis an die Bausubstanz gebunden und der Zustand kostet genau so viel, wie er
 * tatsaechlich kostet. Reha Stufe 4 bei Zustand 50: 42,6 − 5,3 = 37,3 statt 21,3.
 */
export function berechneUebernahmepreis(input: {
  facilityId: FacilityId;
  stufe: number;
  /** Die Stufen, die ueber die Laufzeit tatsaechlich geliehen waren — je Saison eine. */
  gehalteneStufen: readonly number[];
  /** Zustand des Gebaeudes bei der Uebergabe (0..100). */
  zustandPct: number;
}): number {
  const katalog = berechneKatalogkosten(input.facilityId, input.stufe);
  const angerechnet = input.gehalteneStufen.reduce(
    (summe, stufe) => summe + berechneLeihwert(input.facilityId, stufe),
    0,
  );
  const reparatur = calculateFacilityMaintenanceCost({
    facilityId: input.facilityId,
    level: input.stufe,
    conditionPct: clampFacilityCondition(input.zustandPct),
  });
  return rundeAufZehntel(Math.max(0, katalog - angerechnet - reparatur));
}

/**
 * Die Stufenreihe eines Leihvertrags: welche Stufe in welchem Vertragsjahr steht.
 *
 * Wer die Bedingung haelt, steigt auf. Wer sie reisst, PAUSIERT — die Stufe faellt nie zurueck.
 * Das ist die Regel aus dem Gebaeude-Konzept und der Grund, warum ein Mehrjahresvertrag auch nach
 * einem schwachen Jahr noch etwas wert ist.
 */
export function baueLeihStufenreihe(input: {
  startStufe: number;
  laufzeit: number;
  /** Je Saison: wurde die Rangmarke gehalten? Fehlende Eintraege gelten als gehalten. */
  gehalten?: readonly boolean[];
  maxStufe?: number;
}): number[] {
  const maxStufe = input.maxStufe ?? 5;
  const reihe: number[] = [];
  let stufe = Math.max(1, Math.min(input.startStufe, maxStufe));
  for (let jahr = 1; jahr <= Math.max(1, input.laufzeit); jahr += 1) {
    reihe.push(stufe);
    const gehalten = input.gehalten?.[jahr - 1] ?? true;
    if (gehalten && stufe < maxStufe) {
      stufe += 1;
    }
  }
  return reihe;
}

/**
 * Die vollstaendige Rechnung einer Gebaeude-Karte — das, was auf der Karte steht und was das
 * Settlement spaeter bucht. Eine Funktion, damit Anzeige und Abrechnung nie auseinanderlaufen
 * koennen; das war in diesem Projekt schon mehrfach die Fehlerquelle.
 */
export type SponsorLeihAngebot = {
  facilityId: FacilityId;
  raritaet: SponsorLeihRaritaet;
  kurs: number;
  stufenreihe: number[];
  /** Cash-Verzicht je Saison, passend zur Stufe DIESER Saison. */
  verzichtJeSaison: number[];
  /** Leihwert je Saison, passend zur Stufe dieser Saison. */
  leihwertJeSaison: number[];
  /** Was der Selbstbau der zuletzt erreichten Stufe kosten wuerde. */
  katalogkostenEndstufe: number;
};

export function baueLeihAngebot(input: {
  facilityId: FacilityId;
  raritaet: SponsorLeihRaritaet;
  startStufe: number;
  laufzeit: number;
  gehalten?: readonly boolean[];
}): SponsorLeihAngebot {
  const stufenreihe = baueLeihStufenreihe({
    startStufe: input.startStufe,
    laufzeit: input.laufzeit,
    gehalten: input.gehalten,
  });
  return {
    facilityId: input.facilityId,
    raritaet: input.raritaet,
    kurs: SPONSOR_LEIH_KURSE[input.raritaet],
    stufenreihe,
    verzichtJeSaison: stufenreihe.map((stufe) =>
      berechneCashVerzicht({ facilityId: input.facilityId, stufe, raritaet: input.raritaet }),
    ),
    leihwertJeSaison: stufenreihe.map((stufe) => berechneLeihwert(input.facilityId, stufe)),
    katalogkostenEndstufe: berechneKatalogkosten(input.facilityId, stufenreihe[stufenreihe.length - 1] ?? 0),
  };
}

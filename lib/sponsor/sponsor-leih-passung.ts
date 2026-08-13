/**
 * PASSUNG EINER GEBÄUDE-LEIHE ZU DIESEM TEAM — was das geliehene Gebäude fuer GENAU DIESES Team wert
 * ist, nicht was es allgemein kostet.
 *
 * Chris: „und es muss ja auch zum team passen wenn L-R nur kurze verträge macht und seine spieler
 * nicht behalten will, was machen die mit ner academy? ob das dann was bringt ist ja auch fraglich."
 *
 * DER BEFUND, DER DIESE DATEI AUSGELOEST HAT. `berechneLeihwert` (sponsor-leihe.ts) bepreist jedes
 * Nicht-Einnahmegebaeude mit `Katalogkosten / 5 + Unterhalt` — also mit dem, was der SELBSTBAU
 * kostet. Diese Zahl weiss nichts darueber, WELCHES Gebaeude es ist. In der KI-Bewertung
 * (`scoreOfferForAi`) stand sie bis hierher unveraendert als Nutzen im Score:
 *
 *     score += leihwertJeSaison[0] * uptime * wirkungsgrad * cashNutzbar
 *
 * Damit waren eine Academy und ein Analytics Room bei gleichem Leihwert fuer die KI dasselbe
 * Angebot. Gemessen an einem frischen Spiel (128 Gebaeude-Angebote): 15 davon Analytics Room und 17
 * Scouting Office — ein Viertel aller Gebaeude-Karten sind INFORMATIONSGEBAEUDE, deren Wirkung eine
 * KI-Mannschaft gar nicht abrufen kann.
 *
 * DIE REGEL DIESER DATEI: jeder Faktor unten wird aus dem NACHGELESENEN Effekt des Gebaeudes
 * abgeleitet (lib/facilities/facility-catalog.ts und die Stellen, die ihn anwenden) — nie aus einer
 * Vermutung darueber, was ein Gebaeude „eigentlich" tut. Wo ein Effekt fuer ein KI-Team schlicht
 * nicht existiert, steht das als Zahl da und nicht als Ausrede.
 *
 * WAS ZUM ZEITPUNKT DER WAHL UEBERHAUPT BEKANNT IST — nachgemessen, nicht angenommen: in einem neuen
 * Spiel unterschreiben die KI-Teams ihren Sponsor in `applyNewGameSetup`, und dort sind die KADER
 * NOCH LEER (gemessen: 1 Spieler in der ganzen Liga zum Zeitpunkt der 31 Unterschriften). Jede
 * kaderabhaengige Groesse ist in Saison 1 deshalb NICHT verfuegbar. Die Passung stuetzt sich darum
 * auf Identitaet, Strategieprofil und Beliebtheit — die stehen alle schon — und nimmt Kaderdaten nur
 * als ZUSATZ, wenn es sie gibt (ab Saison 2). Ein Faktor, der in Saison 1 still auf einen Default
 * faellt, waere genau in der Saison wirkungslos, um die es geht.
 *
 * Reine Arithmetik: kein GameState, keine IO, keine Zufallsquelle.
 */
import { getFacilityLevelDefinition } from "@/lib/facilities/facility-catalog";
import { DEVELOPMENT_ROUTE_BONUS_BASE_PCT, DEVELOPMENT_ROUTE_BONUS_MAX_PCT } from "@/lib/training/development-route-bonus";

/**
 * Median der Entwicklungs-Tendenz ueber die Liga, GEMESSEN an einem frischen Spiel (32 Teams,
 * `getTeamDevelopmentTendency`): min 0,00 · Median 0,18 · max 0,62. Der Normierer ist das Doppelte
 * des Medians, damit ein Median-Team bei 0,5 landet und die Passung fuer die Liga im Mittel bei 1
 * bleibt — diese Datei soll UNTERSCHEIDEN, nicht die Gebaeude pauschal abwerten.
 */
export const LEIH_ENTWICKLER_NORMIERER = 0.36;

/**
 * Median-Anteil der Academy-BERECHTIGTEN Spieler (Rating < 45, siehe `getAcademyDevelopmentBoostPct`
 * und `resolveLowTierGrade`), gemessen am selben Spielstand: 0,00 … 1,00, Median 0,77. Fuer alle
 * anderen Spieler ist der Academy-Bonus exakt 0 — deshalb ist das die einzige ehrliche Bezugsgroesse.
 */
export const LEIH_ACADEMY_MEDIAN_ANTEIL = 0.77;

/**
 * Rating-Grenze der Academy-Berechtigung. `resolveLowTierGrade` (organic-season-progression.ts) stuft
 * alles unter 45 als F/E/D ein, und nur dafuer gibt `getAcademyDevelopmentBoostPct` ueberhaupt einen
 * Bonus zurueck. Die Grenze wird dort bewusst inline gehalten (Zyklus-Vermeidung); hier steht sie als
 * benannte Konstante, damit die Passung nicht mit einer nackten 45 rechnet.
 */
export const ACADEMY_RATING_GRENZE = 45;

/**
 * WAS EIN SCOUTING OFFICE EINEM KI-TEAM WIRKLICH BRINGT.
 *
 * Nachgesehen statt geschaetzt: die einzige Stelle, an der eine KI-Entscheidung die Scouting-Guete
 * liest, ist `lib/ai/ai-market-plan-apply-service.ts` — `intelBonus = getPlayerScoutCertainty(...) / 20`
 * in der Rangfolge der Kaufkandidaten. Das sind hoechstens 5 Punkte in einer Rangfolge, deren uebrige
 * Terme zweistellig laufen, und es wirkt ueberhaupt nur, solange das Team noch kauft. Alles Weitere
 * (Wishlist-Slots, Reveal-Confidence, Spielerdetail-Ansicht) ist ANZEIGE fuer den Menschen.
 */
export const LEIH_SCOUTING_GRUNDWERT = 0.5;

/**
 * WAS EIN ANALYTICS ROOM EINEM KI-TEAM BRINGT: mechanisch nichts. Der Katalog sagt es selbst —
 * „Zeigt den Live-Fortschritt auf Sponsor-Achse und Board-Zielen — Auskunft, keine Leistung." Der
 * einzige Leser ist `lib/facilities/analytics-live-progress.ts`, und der beliefert die Oberflaeche.
 * Eine KI-Mannschaft braucht keine Anzeige ihres eigenen Fortschritts.
 *
 * NICHT 0, und der Rest ist begruendet, nicht gerundet: am Vertragsende kann das Team das geliehene
 * Gebaeude uebernehmen (`berechneUebernahmepreis` rechnet die bereitgestellten Leihwerte auf den
 * Kaufpreis an), und ein spaeter menschlich gesteuertes Team haette die Anzeige sehr wohl. Was
 * bleibt, ist Bausubstanz ohne laufende Wirkung.
 */
export const LEIH_INFO_OHNE_WIRKUNG = 0.25;

/** Untere und obere Klammer jeder Passung — sie darf gewichten, nie das Vorzeichen drehen. */
export const LEIH_PASSUNG_MIN = 0.2;
export const LEIH_PASSUNG_MAX = 1.3;

const clamp = (wert: number, min: number, max: number) => Math.min(max, Math.max(min, wert));

export type SponsorLeihPassungEingabe = {
  /**
   * Absichtlich `string` und nicht `FacilityId`: das Angebot im Spielstand
   * (`SponsorOfferLeihe.facilityId`) traegt den lockeren Typ, und ein unbekannter Schluessel aus
   * einem Altstand soll hier neutral (Faktor 1) durchlaufen statt den Aufrufer zum Casten zu zwingen.
   */
  facilityId: string;
  /** Stufe, die in DIESER Saison geliehen wird (`stufenreihe[0]`). */
  stufe: number;
  /** `getTeamDevelopmentTendency(...).score`, 0..1 — steht schon vor dem Draft. */
  entwicklerGrad: number;
  /** `profile.bias.longContractPreference`, 3..10. */
  langeVertraege: number;
  /** `profile.bias.shortContractPreference`, 3..10. */
  kurzeVertraege: number;
  /** `profile.bias.sellForProfitAggression`, 3..10. */
  verkaufsneigung: number;
  /** `profile.bias.rosterDepthPreference`, 3..10. */
  kaderTiefeNeigung: number;
  /** `computeTeamBeliebtheitFromGameState(...).value` — der reale Arena-Multiplikator. */
  beliebtheit: number;
  /** Anteil des Kaders mit Rating < 45. `null`, solange es keinen Kader gibt (Saison 1 vor dem Draft). */
  academyBerechtigtAnteil?: number | null;
  /** Offene Kaderplaetze (`playerOpt − Kadergroesse`), 0 ohne Kader. */
  kaderLuecke?: number;
};

/**
 * BLEIBT DER SPIELER LANGE GENUG, DASS ENTWICKLUNG ANKOMMT? 0 = durchreichen, 1 = binden.
 *
 * Genau die Groesse aus Chris' Satz, und sie steht im Strategieprofil, nicht im Kader — sie ist
 * deshalb auch vor dem Draft lesbar. Gemessene Spannen ueber 32 Teams: lang 3..8 (Median 6),
 * kurz 3..8 (Median 5), Verkauf 3..10 (Median 5); das Median-Team landet damit bei 0,6.
 */
export function sponsorLeihBindung01(input: {
  langeVertraege: number;
  kurzeVertraege: number;
  verkaufsneigung: number;
}): number {
  return clamp(
    0.5 + 0.1 * (input.langeVertraege - input.kurzeVertraege) - 0.08 * (input.verkaufsneigung - 5),
    0,
    1,
  );
}

/**
 * Der gemeinsame Faktor der drei ENTWICKLUNGSGEBAEUDE (Trainingszentrum, Academy, Specialist Wing).
 * Alle drei erhoehen dasselbe: das organische Trainingsbudget der EIGENEN Spieler
 * (`organic-season-progression.ts`). Wert hat das nur, wenn das Team entwickeln WILL und seine
 * Spieler behaelt.
 *
 * Die Groesse des Ausschlags (±25 %) folgt dem, was das Spiel selbst schon tut: in
 * `getFacilityTrainingModifierPct` addiert die Entwicklungs-Tendenz bis zu 15 Prozentpunkte auf
 * einen Level-Modifier von 14 bis 70 — also in derselben Groessenordnung. Ein groesserer Hebel waere
 * erfunden.
 */
export function sponsorLeihEntwicklungsFaktor(input: {
  entwicklerGrad: number;
  langeVertraege: number;
  kurzeVertraege: number;
  verkaufsneigung: number;
}): number {
  const entwickler01 = clamp(input.entwicklerGrad / LEIH_ENTWICKLER_NORMIERER, 0, 1);
  const bindung01 = sponsorLeihBindung01(input);
  return 0.75 + 0.5 * (0.5 * entwickler01 + 0.5 * bindung01);
}

/**
 * DIE PASSUNG, mit der die KI-Bewertung den Leihwert multipliziert.
 *
 * 1 heisst „dieser Gebaeudetyp trifft dieses Team so, wie der Leihwert es unterstellt". Darunter:
 * das Gebaeude erreicht dieses Team schlechter, als sein Preis sagt.
 */
export function sponsorLeihPassungFuerTeam(input: SponsorLeihPassungEingabe): number {
  const roh = passungRoh(input);
  return clamp(Number.isFinite(roh) ? roh : 1, LEIH_PASSUNG_MIN, LEIH_PASSUNG_MAX);
}

function passungRoh(input: SponsorLeihPassungEingabe): number {
  switch (input.facilityId) {
    // EINNAHMEGEBAEUDE — hier IST der Leihwert das Geld, `berechneLeihwert` nimmt `seasonIncome`
    // direkt aus dem Katalog. Der Fan Shop ist laut Katalog ausdruecklich flach („nicht
    // beliebtheitsskaliert"), also fuer jedes Team gleich viel wert.
    case "fan_shop":
      return 1;
    // Die Arena dagegen bucht `Basis × Beliebtheit` (facility-season-end-service.ts,
    // calculateFacilityIncome) — der Leihwert kennt die Basis, nicht den Faktor. Genau er steht hier.
    case "arena_upgrade":
      return clamp(input.beliebtheit, 0.5, 1.3);

    // ENTWICKLUNGSGEBAEUDE
    case "training_center":
      return sponsorLeihEntwicklungsFaktor(input);
    case "academy":
      // Der Academy-Bonus ist fuer Spieler ab Rating 45 EXAKT 0 (`getAcademyDevelopmentBoostPct`).
      // Ein Team ohne berechtigte Spieler leiht sich also ein Gebaeude ohne Wirkung. Ohne Kader
      // (Saison 1 vor dem Draft) gibt es dazu kein Urteil — dann bleibt der Anteil neutral.
      return (
        sponsorLeihEntwicklungsFaktor(input) *
        (input.academyBerechtigtAnteil == null
          ? 1
          : clamp(input.academyBerechtigtAnteil / LEIH_ACADEMY_MEDIAN_ANTEIL, 0, 1.2))
      );
    case "specialist_wing":
      // DER FLUEGEL IST EIN SONDERFALL, und zwar ein belegter: den Routenbonus von 8 % bekommt jedes
      // Team AUCH OHNE das Gebaeude (`getSpecialistWingFocusBonusPct` gibt bei Level 0
      // `DEVELOPMENT_ROUTE_BONUS_BASE_PCT` zurueck). Geliehen wird also nur der Aufschlag darueber:
      // Stufe 1 bringt 0 Prozentpunkte, Stufe 5 bringt 5. Bezahlt wird die Karte aber ueber die
      // vollen Baukosten. Der Rest (0,2) ist die gesetzte Fokusachse, nicht der Prozentsatz.
      return sponsorLeihEntwicklungsFaktor(input) * spezialistMarginalFaktor(input.stufe);

    // ROTATION — „+2 bis +12 Erholung" nuetzt dem, der rotieren muss. Dasselbe Signal, das der
    // Gebaeude-Architekt der KI schon benutzt (`rosterCount <= playerOpt` hebt, `>= playerOpt + 2`
    // senkt, ai-team-management-preview-service.ts): ein Team, das bewusst duenn faehrt, laeuft heiss.
    case "recovery_center": {
      const ausProfil = clamp(1.3 - 0.06 * input.kaderTiefeNeigung, 0.8, 1.15);
      const ausKader = Math.min(0.15, 0.05 * Math.max(0, input.kaderLuecke ?? 0));
      return ausProfil + ausKader;
    }

    // INFORMATIONSGEBAEUDE — siehe die Konstanten oben.
    case "scouting_office":
      return Math.min(1, LEIH_SCOUTING_GRUNDWERT + 0.06 * Math.max(0, input.kaderLuecke ?? 0));
    case "analytics_room":
      return LEIH_INFO_OHNE_WIRKUNG;

    default:
      return 1;
  }
}

function spezialistMarginalFaktor(stufe: number): number {
  const modifier = getFacilityLevelDefinition("specialist_wing", Math.round(stufe))?.modifierPct ?? DEVELOPMENT_ROUTE_BONUS_BASE_PCT;
  const spanne = DEVELOPMENT_ROUTE_BONUS_MAX_PCT - DEVELOPMENT_ROUTE_BONUS_BASE_PCT;
  if (!(spanne > 0)) return 1;
  return clamp((modifier - DEVELOPMENT_ROUTE_BONUS_BASE_PCT) / spanne, 0.2, 1);
}

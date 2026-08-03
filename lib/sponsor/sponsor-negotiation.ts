import type { SponsorNegotiationProfile, SponsorTermSeasons } from "@/lib/data/olyDataTypes";

/**
 * LEGACY-SHIM — Verhandlungs-Achse entfernt.
 *
 * Die Risiko-Profile „Sicher / Ausgewogen / Ambitioniert" (`safe` / `balanced` / `ambitious`) waren eine
 * Schein-Wahl: die garantierte Basis dominiert den kleinen Rang-Upside, auf den die Faktoren wirken, sodass
 * „Sicher" für die halbe Liga fast immer optimal war. Die Achse ist aus dem aktiven Spiel entfernt — neue
 * Angebote und Verträge tragen KEIN `negotiationProfile` mehr, und `balanced` ist ohnehin die Identität
 * (alle Faktoren 1.0, kein Ziel-Shift), also ist die Entfernung ökonomisch neutral.
 *
 * Diese Datei bleibt nur als READ-ONLY-Shim bestehen, damit das Settlement Alt-Verträge, die noch ein
 * gespeichertes `safe`/`ambitious`-Profil tragen, exakt wie vor dem Umbau abrechnen kann
 * (`sponsor-settlement-service.ts` liest `getSponsorProfileComponentFactors(contract.negotiationProfile)`).
 * Eine Saison nach Release — wenn keine solchen Verträge mehr laufen — kann die Datei ganz entfallen.
 */

/**
 * RENDITE-EROSION MEHRJAEHRIGER VERTRAEGE (Umsetzungsplan D). Der Index ist NICHT die gewaehlte
 * Gesamtlaufzeit, sondern das ERREICHTE Vertragsjahr (1 = Unterschriftssaison, 2 = erste gerollte
 * Folgesaison, 3 = zweite) — `advanceSponsorContractsForNewSeason` (sponsor-contract-lifecycle.ts)
 * liest bei jedem Rollen den Multiplikator fuer das NEU erreichte Jahr. Ein 1-Jahres-Vertrag erlebt
 * nur Jahr 1, ein 3-Jahres-Vertrag alle drei.
 *
 * Wirkt NUR auf den Wertungsanteil der Ligaleiter (den Teil oberhalb des nach Startrang eingefrorenen
 * Sockels), nicht auf den Sockel selbst — siehe `sponsor-contract-lifecycle.ts`.
 *
 * FRUEHERER STAND `{ 1: 1.0, 2: 1.0, 3: 0.92 }` hatte KEINE Zaehne fuer Zweijahresvertraege: Jahr 2
 * multiplizierte mit 1.0 (keine Erosion), sodass ein 2-Jahres-Vertrag denselben Erwartungswert wie
 * zwei aufeinanderfolgende 1-Jahres-Vertraege lieferte — PLUS die kostenlose Versicherung des
 * eingefrorenen Sockels. Ein Zweijahresvertrag war damit strikt besser als ein Einjaehriger, kein
 * Kompromiss.
 *
 * GEMESSEN (`scripts/sponsor-laufzeit-kalibrierung.ts`, deterministisch über den vollen Salary-Factor-
 * Bereich [0.82, 1.24]): mit `{ 1: 1.0, 2: 0.94, 3: 0.87 }` liegt der Erwartungswert eines
 * Dreijahresvertrags ueber drei Saisons robust UNTER dem dreier aufeinanderfolgender
 * Einjahresvertraege — siehe Skript-Ausgabe / PR-Text fuer die genauen Zahlen.
 */
const TERM_MULTIPLIERS: Record<SponsorTermSeasons, number> = {
  1: 1.0,
  2: 0.94,
  3: 0.87,
};

/** Multiplikator fuer das ERREICHTE Vertragsjahr (1..3), nicht fuer die gewaehlte Gesamtlaufzeit. */
export function getSponsorTermMultiplier(contractYear: SponsorTermSeasons) {
  return TERM_MULTIPLIERS[contractYear];
}

export type SponsorProfileComponentFactors = {
  baseMult: number;
  upsideMult: number;
  penaltyMult: number;
  targetShift: number;
};

/** Faktoren der Alt-Profile. Nur noch vom Settlement für Alt-Verträge gelesen; `balanced` = Identität. */
export const PROFILE_COMPONENT_FACTORS: Record<SponsorNegotiationProfile, SponsorProfileComponentFactors> = {
  safe: { baseMult: 1.05, upsideMult: 0.85, penaltyMult: 0.5, targetShift: 2 },
  balanced: { baseMult: 1.0, upsideMult: 1.0, penaltyMult: 1.0, targetShift: 0 },
  ambitious: { baseMult: 0.88, upsideMult: 1.25, penaltyMult: 2.0, targetShift: -1 },
};

export function getSponsorProfileComponentFactors(profile: SponsorNegotiationProfile): SponsorProfileComponentFactors {
  return PROFILE_COMPONENT_FACTORS[profile] ?? PROFILE_COMPONENT_FACTORS.balanced;
}

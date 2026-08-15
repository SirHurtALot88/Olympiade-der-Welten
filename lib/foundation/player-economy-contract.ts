import type { ContractYearSalary, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { contractShapeLabel } from "@/lib/foundation/contract-shape-label";
import {
  calculateMarketValueBonuses,
  deriveBaseMarketValueFromFinal,
} from "@/lib/player-formulas/market-value-engine";
import {
  calculateSalaryFromMarketValue,
  deriveSalaryMarketValueFromFinalSalary,
} from "@/lib/player-formulas/salary-engine";

type EconomyPlayer = {
  id?: string | null;
  marketValue?: number | null;
  salaryDemand?: number | null;
  displayMarketValue?: number | null;
  displaySalary?: number | null;
};

type EconomyRosterEntry = {
  salary?: number | null;
  negotiatedAnnualSalary?: number | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  contractLength?: number | null;
  contractShape?: "balanced" | "front_loaded" | "back_loaded" | null;
  yearlySalarySchedule?: ContractYearSalary[] | null;
};

/** Woher das Verhandlungs-Benchmark eines Vertrags stammt — fuer Migrations-Zaehlungen. */
export type NegotiatedAnnualSalarySource = "persisted" | "schedule_average" | "stored_salary" | "missing";

/**
 * DAS VERHANDLUNGS-BENCHMARK EINES VERTRAGS — die Bemessungsgrundlage der Apron-Abgabe.
 *
 * WARUM NICHT `resolveRosterContractSalaries().annualSalary`, obwohl das so heisst: es bevorzugt
 * `entry.salary`, und dieses Feld wird bei JEDEM Saisonwechsel von `advanceRosterContractSchedule`
 * mit der Jahr-1-Rate der Rest-Schedule ueberschrieben. Ein Jahr nach Unterschrift ist
 * `annualSalary` eines geformten Vertrags also die FORMABHAENGIGE Jahreszahlung — genau das
 * Schlupfloch, das die Apron nicht haben darf. Nachgemessen, nicht vermutet.
 *
 * REIHENFOLGE:
 *  1. Das persistierte Feld (`negotiatedAnnualSalary`) — bei Unterschrift geschrieben, danach
 *     unveraendert. Der Normalfall.
 *  2. Der Durchschnitt der GESPEICHERTEN Schedule. Das ist die MIGRATION fuer Bestandsvertraege:
 *     exakt fuer balanced und fuer frisch unterschriebene geformte Vertraege (volle Schedule),
 *     und die bestmoegliche Naeherung fuer einen mittendrin geformten Vertrag — dessen
 *     Rest-Schedule ist um die bereits gezahlten Jahre gekuerzt. Wie viele Vertraege davon
 *     betroffen sind, wird am Abbild gezaehlt und ausgewiesen.
 *  3. `entry.salary` — Vertraege ganz ohne Schedule (Einjahres- und Prisma-projizierte).
 */
export function resolveNegotiatedAnnualSalary(
  rosterEntry: EconomyRosterEntry | null | undefined,
): { value: number | null; source: NegotiatedAnnualSalarySource } {
  if (!rosterEntry) return { value: null, source: "missing" };

  const persisted = normalizeStoredEconomyValue(toFiniteNumber(rosterEntry.negotiatedAnnualSalary));
  if (persisted != null && persisted > 0) {
    return { value: roundTo2(persisted), source: "persisted" };
  }

  const schedule = rosterEntry.yearlySalarySchedule ?? [];
  if (schedule.length > 0) {
    const total = schedule.reduce(
      (sum, row) => sum + (normalizeStoredEconomyValue(toFiniteNumber(row.salary)) ?? 0),
      0,
    );
    return { value: roundTo2(total / schedule.length), source: "schedule_average" };
  }

  const stored = normalizeStoredEconomyValue(toFiniteNumber(rosterEntry.salary));
  if (stored == null) return { value: null, source: "missing" };
  return { value: roundTo2(stored), source: "stored_salary" };
}

export type RosterContractSalaries = {
  /** Cash obligation for the current contract year (schedule year 1). */
  currentSeasonSalary: number | null;
  /** Negotiated annual benchmark used for roster tables and market comparison. */
  annualSalary: number | null;
};

export function resolveRosterContractSalaries(
  rosterEntry: EconomyRosterEntry | null | undefined,
): RosterContractSalaries {
  if (!rosterEntry) {
    return { currentSeasonSalary: null, annualSalary: null };
  }

  const storedSalary = normalizeStoredEconomyValue(toFiniteNumber(rosterEntry.salary));
  const schedule = rosterEntry.yearlySalarySchedule ?? [];
  if (schedule.length === 0) {
    return { currentSeasonSalary: storedSalary, annualSalary: storedSalary };
  }

  const currentSeasonSalary =
    normalizeStoredEconomyValue(toFiniteNumber(schedule[0]?.salary)) ?? storedSalary;
  const scheduleTotal = schedule.reduce(
    (sum, row) => sum + (normalizeStoredEconomyValue(toFiniteNumber(row.salary)) ?? 0),
    0,
  );
  const scheduleAverage = schedule.length > 0 ? roundTo2(scheduleTotal / schedule.length) : null;
  const contractShape = rosterEntry.contractShape ?? "balanced";

  if (contractShape === "front_loaded" || contractShape === "back_loaded") {
    return {
      currentSeasonSalary,
      annualSalary: storedSalary ?? scheduleAverage ?? currentSeasonSalary,
    };
  }

  return {
    currentSeasonSalary,
    annualSalary: currentSeasonSalary ?? storedSalary ?? scheduleAverage,
  };
}

export type PlayerEconomyMarketValueSource =
  | "calculated_stored"
  | "imported_display"
  | "imported_raw"
  | "calculated_preview"
  | "active_current_value"
  | "active_purchase_price"
  | "missing_source";

export type PlayerEconomySalarySource =
  | "calculated_stored"
  | "imported_display"
  | "imported_raw"
  | "calculated_preview"
  | "active_contract"
  | "missing_source";

export type PlayerEconomyPurchasePriceSource =
  | "calculated_stored"
  | "calculated_preview"
  | "imported_display"
  | "imported_raw"
  | "active_purchase_price"
  | "active_current_value"
  | "missing_source";

export type PlayerEconomyContractLengthSource = "active_contract" | "missing_source";

export type PlayerEconomyStatus =
  | "calculated_ready"
  | "imported_ready"
  | "missing_market_value"
  | "missing_salary"
  | "generator_missing_engine"
  | "manual_draft_required";

export type PlayerEconomyContract = {
  playerId: string | null;
  marketValue: number | null;
  marketValueSource: PlayerEconomyMarketValueSource;
  salary: number | null;
  /** Negotiated annual salary for display; differs from salary on shaped contracts. */
  annualSalary: number | null;
  salarySource: PlayerEconomySalarySource;
  purchasePrice: number | null;
  purchasePriceSource: PlayerEconomyPurchasePriceSource;
  contractLength: number | null;
  contractLengthSource: PlayerEconomyContractLengthSource;
  baseMarketValue: number | null;
  salaryMarketValue: number | null;
  allrounderBonus: number | null;
  specialistBonus: number | null;
  expectedSalary: number | null;
  salaryBase: number | null;
  traitPercentSum: number | null;
  isImportedEconomy: boolean;
  economyStatus: PlayerEconomyStatus;
};

type ImportedMarketValueSource = Extract<PlayerEconomyMarketValueSource, "imported_display" | "imported_raw">;

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStoredEconomyValue(value: number | null | undefined) {
  const numericValue = toFiniteNumber(value);
  if (numericValue == null) {
    return null;
  }
  if (numericValue > 1000) {
    return roundTo2(numericValue / 100);
  }

  return numericValue;
}

/** Display-scale economy value (raw roster cents → game cash units). */
export function normalizeEconomyMoney(value: number | null | undefined): number | null {
  return normalizeStoredEconomyValue(value);
}

function resolveImportedMarketValueSource(player?: EconomyPlayer | null): ImportedMarketValueSource {
  if (toFiniteNumber(player?.displayMarketValue) != null) {
    return "imported_display";
  }
  if (toFiniteNumber(player?.marketValue) != null) {
    return "imported_raw";
  }
  return "imported_raw";
}

function isGeneratorDraftPlayer(playerId: string | null, player?: EconomyPlayer | null) {
  return Boolean(
    (playerId && playerId.startsWith("draft-")) ||
      (player?.id && player.id.startsWith("draft-")),
  );
}

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

function toGeneratorAttributes(player?: Player | EconomyPlayer | null) {
  const attributeStats = (player as Player | null)?.attributeSheetStats;
  if (!attributeStats) {
    return null;
  }
  const normalized = {
    power: toFiniteNumber(attributeStats.power),
    health: toFiniteNumber(attributeStats.health),
    stamina: toFiniteNumber(attributeStats.stamina),
    intelligence: toFiniteNumber(attributeStats.intelligence),
    awareness: toFiniteNumber(attributeStats.awareness),
    determination: toFiniteNumber(attributeStats.determination),
    speed: toFiniteNumber(attributeStats.speed),
    dexterity: toFiniteNumber(attributeStats.dexterity),
    charisma: toFiniteNumber(attributeStats.charisma),
    will: toFiniteNumber(attributeStats.will),
    spirit: toFiniteNumber(attributeStats.spirit),
    torment: toFiniteNumber(attributeStats.torment),
  };
  return Object.values(normalized).every((value) => value != null)
    ? (normalized as PlayerGeneratorAttributes)
    : null;
}

export function resolvePlayerEconomyContract(input: {
  playerId?: string | null;
  player?: EconomyPlayer | null;
  rosterEntry?: EconomyRosterEntry | null;
  baseMarketValueOverride?: number | null;
  salaryMarketValueOverride?: number | null;
}): PlayerEconomyContract {
  const player = input.player ?? null;
  const rosterEntry = input.rosterEntry ?? null;
  const playerId = input.playerId ?? player?.id ?? null;

  const storedCalculatedMarketValue = normalizeStoredEconomyValue(player?.marketValue);
  const storedCalculatedSalary = normalizeStoredEconomyValue(player?.salaryDemand);
  const legacyDisplayMarketValue = normalizeStoredEconomyValue(player?.displayMarketValue);
  const legacyDisplaySalary = normalizeStoredEconomyValue(player?.displaySalary);
  const rosterPurchasePriceRaw = toFiniteNumber(rosterEntry?.purchasePrice);
  const rosterPurchasePrice = normalizeStoredEconomyValue(rosterPurchasePriceRaw);
  /**
   * DERSELBE KAUFPREIS, ABER NUR WENN ER AUF DER ANZEIGE-SKALA STEHT.
   *
   * Alte Spielstaende halten Geldbetraege in Hundertsteln: `purchasePrice: 40000` meint 40,0.
   * `normalizeStoredEconomyValue` teilt bei Werten ueber 1000 zwar durch 100 — das trifft aber
   * nur EINE Skalen-Generation, aus 40000 wird 400 statt 40. Aus dem Rohwert allein laesst sich
   * die Skala nicht rekonstruieren; verlaesslich ist nur der mitgelieferte Anzeige-Marktwert als
   * Anker. Genau so haelt es `normalizeVisibleRosterMoney` (transfermarkt-sale-factor.ts) seit
   * jeher — hier steht die Regel lokal, weil ein Import von dort einen Ring baute.
   *
   * Deshalb gilt: ueber 1000 ist der Rohwert fuer die Kaufpreis-Kette unbrauchbar, und die faellt
   * auf den Marktwert zurueck. Das ist kein Rueckschritt, sondern die einzige belastbare Lesart
   * fuer solche Staende — `tests/transfermarkt-local-service.test.ts` haelt sie fest („equal entry
   * and exit values do not show fake profit").
   */
  const rosterPurchasePriceOnDisplayScale =
    rosterPurchasePriceRaw != null && rosterPurchasePriceRaw > 1000 ? null : rosterPurchasePrice;
  const rosterContractSalaries = resolveRosterContractSalaries(rosterEntry);
  const rosterSalary = rosterContractSalaries.currentSeasonSalary;
  const contractLength = toFiniteNumber(rosterEntry?.contractLength);
  const playerEntity = player as Player | null;
  const formulaSources = loadPlayerFormulaSources();
  const generatorAttributes = toGeneratorAttributes(playerEntity);
  const salaryMarketValueOverride = toFiniteNumber(input.salaryMarketValueOverride);
  const visibleFinalMarketValue = legacyDisplayMarketValue ?? storedCalculatedMarketValue ?? null;
  const baseMarketValue =
    input.baseMarketValueOverride ??
    (visibleFinalMarketValue != null
      ? deriveBaseMarketValueFromFinal({
          finalMarketValue: visibleFinalMarketValue,
          coreStats: playerEntity?.coreStats,
          disciplineRatings: playerEntity?.disciplineRatings,
        })
      : null);
  const fallbackFinalSalary = storedCalculatedSalary;
  const salaryMarketValueFromLegacySalary =
    salaryMarketValueOverride == null &&
    baseMarketValue == null &&
    fallbackFinalSalary != null &&
    generatorAttributes &&
    formulaSources.attributeSalaryModifiers &&
    formulaSources.traitSalaryFactors
      ? deriveSalaryMarketValueFromFinalSalary({
          finalSalary: fallbackFinalSalary,
          attributes: generatorAttributes,
          traitsPositive: playerEntity?.traitsPositive ?? [],
          traitsNegative: playerEntity?.traitsNegative ?? [],
          traitSalaryFactors: formulaSources.traitSalaryFactors,
          attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
        })
      : null;
  const salaryMarketValue = salaryMarketValueOverride ?? visibleFinalMarketValue ?? baseMarketValue ?? salaryMarketValueFromLegacySalary;
  const marketValueBonuses =
    baseMarketValue != null
      ? calculateMarketValueBonuses({
          baseMarketValue,
          coreStats: playerEntity?.coreStats,
          disciplineRatings: playerEntity?.disciplineRatings,
        })
      : null;
  const calculatedFinalMarketValue =
    baseMarketValue != null
      ? roundTo2(
          baseMarketValue +
            (marketValueBonuses?.allrounderBonus ?? 0) +
            (marketValueBonuses?.specialistBonus ?? 0),
        )
      : null;
  const salaryBreakdown =
    salaryMarketValue != null &&
    generatorAttributes &&
    formulaSources.attributeSalaryModifiers &&
    formulaSources.traitSalaryFactors
      ? calculateSalaryFromMarketValue({
          salaryMarketValue,
          attributes: generatorAttributes,
          traitsPositive: playerEntity?.traitsPositive ?? [],
          traitsNegative: playerEntity?.traitsNegative ?? [],
          traitSalaryFactors: formulaSources.traitSalaryFactors,
          attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
        })
      : null;

  const marketValue =
    calculatedFinalMarketValue ??
    storedCalculatedMarketValue ??
    legacyDisplayMarketValue ??
    rosterPurchasePrice ??
    null;
  const marketValueSource =
    calculatedFinalMarketValue != null
      ? "calculated_preview"
      : storedCalculatedMarketValue != null
        ? "calculated_stored"
        : legacyDisplayMarketValue != null
          ? resolveImportedMarketValueSource(player)
          : rosterPurchasePrice != null
            ? "active_purchase_price"
            : "missing_source";

  /**
   * KEIN IMPORTIERTES GEHALT MEHR — CHRIS: „keine import gehälter mehr nutzen nicht in tests und
   * nicht im gehalt, nur noch das berechnete!"
   *
   * Hier endete die Kette frueher auf `legacyDisplaySalary` (dem `displaySalary` aus der
   * Katalog-Ausleitung). Der Zweig ist entfernt: was gilt, ist der unterschriebene Vertrag, sonst
   * die Rechnung.
   *
   * WAS DAS AENDERT (an einem frischen Spielstand gemessen, alle 2.984 Spieler): NICHTS. Kein
   * einziger Spieler haengt am Import — 2.983 stehen auf `calculated_preview`, einer auf
   * `active_contract`. Und Import und Rechnung sind auf 0,00 identisch: die Katalogladung
   * materialisiert die berechnete Oekonomie ohnehin zuerst, `displaySalary` trug also nur eine
   * Kopie derselben Zahl. Der Zweig war ein stiller Rueckfall auf etwas, das es gar nicht mehr
   * gab.
   *
   * WAS ES KUENFTIG AENDERT: ein Spielstand, dessen Rechnung nicht laeuft (fehlende Attribute,
   * fehlende Formelquellen), bekommt jetzt `missing_salary` statt heimlich einer Importzahl. Das
   * ist der Sinn der Entscheidung — ein sichtbar leeres Feld ist reparierbar, eine stille
   * Ersatzzahl wird geglaubt.
   */
  const salary = rosterSalary ?? salaryBreakdown?.finalSalary ?? storedCalculatedSalary ?? null;
  const salarySource =
    rosterSalary != null
        ? "active_contract"
        : salaryBreakdown?.finalSalary != null
            ? "calculated_preview"
            : storedCalculatedSalary != null
              ? "calculated_stored"
              : "missing_source";

  /**
   * DER KAUFPREIS IST, WAS BEZAHLT WURDE — nicht ein Marktwert.
   *
   * WAS FALSCH WAR: die Kette begann mit ZWEI Marktwerten und erreichte den echten
   * `rosterPurchasePrice` erst an dritter Stelle. Ein berechneter Marktwert existiert aber
   * praktisch immer — also gewann er IMMER, und der gezahlte Preis kam nie zum Zug. Verraeterisch
   * ist die Quellen-Kennung: `"active_purchase_price"` war damit ein toter Zweig, obwohl die
   * Aufzaehlung ihn ausdruecklich vorsieht. Am Live-Abbild gemessen lieferten 326 von 336
   * Kadervertraegen einen anderen Wert als den gezahlten (im Mittel 0,40 daneben, bis 1,70),
   * Quelle ausnahmslos `calculated_preview`; nach der Umstellung sind es ueber alle fuenf
   * Live-Saves 0, Quelle durchgaengig `active_purchase_price`.
   *
   * WIE WEIT DAS REICHT — ehrlich abgegrenzt, weil hier zunaechst mehr behauptet stand: die
   * beiden Stellen, an denen Chris nachgesehen hat (Verkaufs-Modal und auslaufende Vertraege),
   * waren NICHT betroffen. Beide fragen ueber `normalizeVisibleRosterMoney(entry?.purchasePrice,
   * economy.purchasePrice)` zuerst den Kadereintrag und benutzen diesen Wert hier nur als
   * Rueckfall — siehe `buildContractExitValue` (contract-renewal-service) und
   * `use-market-sell-derivations`. Betroffen war, wer `economy.purchasePrice` DIREKT liest;
   * ausserdem greift der Rueckfall ueberall dort, wo kein Kadereintrag vorliegt (Free Agents),
   * und lieferte dann stillschweigend einen Marktwert unter dem Namen Kaufpreis.
   *
   * DIE REIHENFOLGE DER MARKTWERT-KETTE OBEN BLEIBT UNANGETASTET. Geaendert ist nur, dass der
   * gezahlte Preis hier zuerst gilt; die Marktwerte bleiben als Rueckfall fuer Bestands- und
   * Importstaende, in denen kein Kaufpreis hinterlegt ist. Dort aendert sich nichts.
   */
  const purchasePrice =
    rosterPurchasePriceOnDisplayScale ??
    calculatedFinalMarketValue ??
    storedCalculatedMarketValue ??
    legacyDisplayMarketValue ??
    null;
  const purchasePriceSource =
    rosterPurchasePriceOnDisplayScale != null
      ? "active_purchase_price"
      : calculatedFinalMarketValue != null
        ? "calculated_preview"
        : storedCalculatedMarketValue != null
          ? "calculated_stored"
          : legacyDisplayMarketValue != null
            ? resolveImportedMarketValueSource(player)
            : "missing_source";

  const contractLengthSource = contractLength != null ? "active_contract" : "missing_source";
  /**
   * Das GEHALT taucht hier nicht mehr auf: seit der Import-Zweig aus der Gehaltskette raus ist,
   * kann `salarySource` die beiden Import-Kennungen gar nicht mehr annehmen (s. oben). Die
   * Abfrage darauf waere ein toter Zweig, der behauptet, es gaebe ihn noch. Marktwert und
   * Kaufpreis kennen ihre Import-Quellen weiterhin — dort gilt die Entscheidung nicht.
   */
  const isImportedEconomy =
    marketValueSource === "imported_display" ||
    marketValueSource === "imported_raw" ||
    purchasePriceSource === "imported_display" ||
    purchasePriceSource === "imported_raw";

  let economyStatus: PlayerEconomyStatus = isImportedEconomy ? "imported_ready" : "calculated_ready";
  if (marketValue == null) {
    economyStatus = isGeneratorDraftPlayer(playerId, player) ? "generator_missing_engine" : "missing_market_value";
  } else if ((storedCalculatedSalary ?? rosterSalary ?? salaryBreakdown?.finalSalary) == null) {
    economyStatus = isGeneratorDraftPlayer(playerId, player) ? "generator_missing_engine" : "missing_salary";
  } else if (!player && !rosterEntry) {
    economyStatus = "manual_draft_required";
  }

  return {
    playerId,
    marketValue: marketValue != null ? roundTo2(marketValue) : null,
    marketValueSource,
    salary: salary != null ? roundTo2(salary) : null,
    annualSalary:
      rosterContractSalaries.annualSalary != null ? roundTo2(rosterContractSalaries.annualSalary) : salary != null ? roundTo2(salary) : null,
    salarySource,
    purchasePrice: purchasePrice != null ? roundTo2(purchasePrice) : null,
    purchasePriceSource,
    contractLength,
    contractLengthSource,
    baseMarketValue: baseMarketValue != null ? roundTo2(baseMarketValue) : null,
    salaryMarketValue: salaryMarketValue != null ? roundTo2(salaryMarketValue) : null,
    allrounderBonus: marketValueBonuses?.allrounderBonus ?? null,
    specialistBonus: marketValueBonuses?.specialistBonus ?? null,
    expectedSalary: salaryBreakdown?.finalSalary ?? storedCalculatedSalary ?? null,
    salaryBase: salaryBreakdown?.basisSalary ?? null,
    traitPercentSum: salaryBreakdown?.traitPercentSum ?? null,
    isImportedEconomy,
    economyStatus,
  };
}

export function formatContractShapeShortLabel(
  shape: EconomyRosterEntry["contractShape"] | null | undefined,
): string | null {
  if (shape === "front_loaded") {
    return "FL";
  }
  if (shape === "back_loaded") {
    return "BL";
  }
  return null;
}

export function formatContractShapeLabel(
  shape: EconomyRosterEntry["contractShape"] | null | undefined,
): string {
  return contractShapeLabel(shape, "—");
}

export function rosterSalariesDifferForDisplay(
  currentSeasonSalary: number | null | undefined,
  annualSalary: number | null | undefined,
): boolean {
  if (currentSeasonSalary == null || annualSalary == null) {
    return false;
  }
  return Math.abs(currentSeasonSalary - annualSalary) >= 0.01;
}

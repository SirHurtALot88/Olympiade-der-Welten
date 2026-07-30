import type { FormCardColor } from "@/lib/data/olyDataTypes";

/**
 * SAISONPLANUNG DER FORMKARTEN (KI)
 * ================================
 *
 * Anlass (Chris): „wieso haut W-L so starke karten raus in 2 sehr kleinen diszis? das fühlt
 * sich nach verschwendung an!" — plus der Wunsch, dass KI-Teams „vorab in der season die
 * formkarten planen um das große ganze im blick zu haben und nur kurzfristig 'umbuchen'".
 *
 * WARUM ein Plan und nicht noch eine Heuristik: Der Punktwert eines Karteneinsatzes ist
 * `Kartenwert × (Farbtreffer ? 2 : 1) × Kadergröße` (s. `calculateFormModifierForSide`).
 * Dieselbe +8 bringt in einer 6er-Disziplin mit Farbtreffer 96 Punkte und in einer 2er ohne
 * Farbtreffer 16 — Faktor 6. Die Frage „welche Karte wann?" ist damit keine Bewertungsfrage
 * pro Spieltag, sondern ein ZUORDNUNGSPROBLEM über die ganze Saison: n Karten auf m Slots,
 * jede Karte genau einmal.
 *
 * Der bisherige Weg (verworfen, stand in `ai-legacy-lineup-batch-apply-service`):
 * `estimateBestFutureFormCardValue` bewertete JEDE Karte einzeln gegen den besten noch
 * kommenden Slot. Das ist kein Plan, sondern n unabhängige Tagträume — alle Karten des Teams
 * reklamieren denselben 6er-Farbtreffer-Slot für sich. Folge im Zahlenbeispiel (10 Spieltage,
 * alle 20 Disziplinen, 12 Plus-/12 Minuskarten): an Spieltag 4 landeten `grün+8` UND `rot+2`
 * beide auf Gewichtheben (6er, rot) = 48 + 24, während Climbing (6er, GRÜN) am selben
 * Spieltag leer ausging — die grüne 8 hätte dort 96 statt 48 gebracht. Weil jede Karte nur
 * „irgendein guter Slot existiert noch" prüft, konkurriert nichts um denselben Slot.
 *
 * Dieses Modul löst stattdessen die Zuordnung explizit und einmal:
 *   1. Minuskarten zuerst — sie MÜSSEN gespielt werden (ungespielte Minuskarten kosten am
 *      Saisonende Tabellenpunkte, s. `form-card-penalty-service`). Die größte Minuskarte
 *      bekommt das billigste Versteck: kleine Disziplin, möglichst ohne Farbtreffer.
 *   2. Pluskarten auf die verbleibenden Primärplätze — die größte Karte auf den wertvollsten
 *      Slot (große Disziplin, Farbtreffer).
 *   3. Übrige Pluskarten auf Sekundärplätze neben einem positiven Primärplatz.
 *
 * Schritt 1 und 2 greifen ineinander statt sich zu behindern: Minuskarten wollen genau die
 * kleinen Slots, die Pluskarten ohnehin meiden. Die Sortierung „größter Betrag zuerst auf den
 * jeweils besten/billigsten freien Slot" ist für einen multiplikativen Wert (Kartenwert ×
 * Gewicht) die Paarung der Umordnungs-Ungleichung — mit dem Farbfaktor ist sie nicht mehr
 * beweisbar optimal, deshalb läuft anschließend ein Tauschdurchlauf (`improveByPairSwaps`).
 *
 * KEIN INFORMATIONSVORSPRUNG: Der Plan liest ausschließlich den Spielplan, die eigenen Karten
 * und die Kadergrößen — alles, was ein menschlicher Manager im Formkarten-Board auch sieht.
 * Keine gegnerischen Aufstellungen, keine gewürfelten Ergebnisse.
 *
 * DETERMINISMUS: kein `Math.random()`. Jede Sortierung hat eine vollständige Ordnung
 * (Tiebreak über Karten-/Slot-Schlüssel), der Tauschdurchlauf verbessert nur bei ECHTEM
 * Zugewinn und ist auf feste Runden gedeckelt. Gleiche Eingabe → gleicher Plan.
 *
 * NICHT PERSISTIERT — und das ist Absicht. Der Plan wird bei jedem Aufstellungslauf aus
 * (Restspielplan × noch unbenutzte Karten) neu abgeleitet. Damit ist das vom Nutzer
 * gewünschte „kurzfristig umbuchen" kein Sonderfall, sondern der Normalbetrieb: fällt ein
 * Spieler aus oder ist eine Karte anders verbraucht worden, ändert sich die Eingabe und der
 * nächste Plan ordnet die Restkarten neu zu. Ein persistierter Plan (wie die menschlichen
 * `FormCardPlanRecord`s) hätte dieselbe Zuordnung gebraucht PLUS eine Invalidierungslogik für
 * jede Abweichung — verworfen, weil die Ableitung deterministisch und billig ist (≈ 24 Karten
 * × 40 Slots).
 */

export type FormCardSeasonPlanCard = {
  id: string;
  value: number;
  color: FormCardColor;
};

export type FormCardSeasonPlanSlot = {
  /** 1-basierter Spieltag. Der aktuelle Spieltag gehört DAZU — er ist der erste planbare Slot. */
  matchdayIndex: number;
  matchdayId: string | null;
  disciplineSide: "d1" | "d2" | null;
  disciplineId: string | null;
  /** Farbe der Disziplin (Kategorie → Farbe). `null` = unbekannt, dann nie Farbtreffer. */
  color: FormCardColor | null;
  /** Kadergröße der Disziplin. `null` = unbekannt (s. `resolvePlanSlotPlayerCount`). */
  playerCount: number | null;
};

export type FormCardSeasonPlanEntry = {
  cardId: string;
  role: "primary" | "secondary";
  slot: FormCardSeasonPlanSlot;
  /** Kartenwert × Farbfaktor × Kadergröße — bei Minuskarten negativ. */
  expectedFormModifier: number;
};

export type FormCardSeasonPlan = {
  /** Zuordnung Karte → Slot. Nicht zugeordnete Karten fehlen hier (s. `unplacedCardIds`). */
  entryByCardId: Map<string, FormCardSeasonPlanEntry>;
  /** Karten, für die im Restspielplan kein Platz mehr war. */
  unplacedCardIds: string[];
  /** Summe aller `expectedFormModifier` — die Kennzahl, die der Plan maximiert. */
  expectedTotalFormModifier: number;
};

/**
 * Fallback-Kadergröße für Slots ohne bekannte Spielerzahl. Bewusst KEINE 0: „nichts erfunden"
 * heißt hier, dass eine unbekannte Kadergröße nicht so tut, als brächte die Karte gar nichts —
 * das würde jede Karte in den unbekannten Slot spülen. 4 ist die Mitte des Feldes (2..6) und
 * derselbe Wert, den der Aufstellungs-Layer als Ersatz benutzt.
 */
export const FORM_CARD_PLAN_FALLBACK_PLAYER_COUNT = 4;

export function resolvePlanSlotPlayerCount(slot: FormCardSeasonPlanSlot) {
  const raw = slot.playerCount;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) {
    return FORM_CARD_PLAN_FALLBACK_PLAYER_COUNT;
  }
  return raw;
}

/**
 * Der Punktwert EINES Karteneinsatzes in einem Slot — dieselbe Rechnung wie in
 * `calculateFormModifierForSide` (Farbgleichheit verdoppelt, dann mal Kadergröße). Bewusst
 * hier nachgebildet statt importiert: die Wertungsfunktion arbeitet auf `LineupDraftModifiers`
 * eines konkreten Spieltags, der Planer auf hypothetischen Paarungen. Ändert sich die REGEL,
 * muss sie an beiden Stellen geändert werden — dafür steht dieser Hinweis hier.
 */
export function formCardSlotValue(card: FormCardSeasonPlanCard, slot: FormCardSeasonPlanSlot) {
  const multiplier = slot.color != null && card.color === slot.color ? 2 : 1;
  return card.value * multiplier * resolvePlanSlotPlayerCount(slot);
}

/** Stabiler Schlüssel eines Slots — Tiebreak-Grundlage, damit die Zuordnung reproduzierbar ist. */
export function formCardPlanSlotKey(slot: FormCardSeasonPlanSlot) {
  return `${slot.matchdayIndex}|${slot.matchdayId ?? ""}|${slot.disciplineSide ?? ""}|${slot.disciplineId ?? ""}`;
}

type PlanCapacity = {
  slot: FormCardSeasonPlanSlot;
  key: string;
  primary: FormCardSeasonPlanCard | null;
  secondary: FormCardSeasonPlanCard | null;
};

function sortSlotsDeterministically(slots: FormCardSeasonPlanSlot[]): PlanCapacity[] {
  return [...slots]
    .map((slot) => ({ slot, key: formCardPlanSlotKey(slot), primary: null, secondary: null }))
    .sort((left, right) => {
      if (left.slot.matchdayIndex !== right.slot.matchdayIndex) {
        return left.slot.matchdayIndex - right.slot.matchdayIndex;
      }
      return left.key.localeCompare(right.key);
    });
}

/**
 * Kandidaten für den PRIMÄR-Platz. Die Reihenfolge der Kandidaten ist bei Wertgleichheit
 * entscheidend: bei zwei gleich guten Slots gewinnt der FRÜHERE Spieltag. Damit wandern Karten
 * nicht ohne Grund ans Saisonende, wo Verletzungen und Formeinbrüche den Plan ohnehin
 * überholen — „gleich gut, aber sicherer" schlägt „gleich gut, aber später".
 */
function pickBestFreePrimary(
  card: FormCardSeasonPlanCard,
  capacities: PlanCapacity[],
  compare: (candidateValue: number, bestValue: number) => boolean,
) {
  let best: PlanCapacity | null = null;
  let bestValue = 0;
  for (const capacity of capacities) {
    if (capacity.primary) continue;
    const value = formCardSlotValue(card, capacity.slot);
    if (best == null || compare(value, bestValue)) {
      best = capacity;
      bestValue = value;
    }
  }
  return best;
}

function pickBestFreeSecondary(card: FormCardSeasonPlanCard, capacities: PlanCapacity[]) {
  let best: PlanCapacity | null = null;
  let bestValue = 0;
  for (const capacity of capacities) {
    if (capacity.secondary) continue;
    // Ein Sekundärplatz OHNE Primärkarte wird nicht beplant: eine zweite Karte ohne erste ist im
    // Spieltags-Layer keine sinnvolle Anweisung — dann gehört die Karte auf den Primärplatz.
    // Neben einer MINUSKARTE ist der Sekundärplatz dagegen ausdrücklich erlaubt: die Wertung
    // summiert beide (`calculateFormModifierForSide`) und verbietet nur eine negative ZWEITE
    // Karte. Weil jeder Spieler eine Plus- und eine Minuskarte erzeugt und alle Minuskarten
    // gespielt werden müssen, sind die Primärplätze knapp — ohne diese Paarung verrottet der
    // halbe Pluskarten-Vorrat.
    if (!capacity.primary) continue;
    const value = formCardSlotValue(card, capacity.slot);
    if (best == null || value > bestValue) {
      best = capacity;
      bestValue = value;
    }
  }
  return best;
}

/**
 * Tauschdurchlauf: Mit dem Farbfaktor ist die gierige Paarung nicht mehr beweisbar optimal —
 * eine grüne 8 kann auf einem roten 6er landen, während eine rote 4 auf dem grünen 6er sitzt.
 * Ein Tausch der beiden bringt hier real Punkte. Der Durchlauf tauscht nur bei ECHTEM Zugewinn
 * und läuft höchstens `maxRounds` mal — damit terminiert er garantiert und bleibt deterministisch
 * (feste Iterationsreihenfolge über die stabil sortierten Kapazitäten).
 */
const PLAN_ROLES = ["primary", "secondary"] as const;

function improveByPairSwaps(capacities: PlanCapacity[]) {
  let improved = false;
  for (let leftIndex = 0; leftIndex < capacities.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < capacities.length; rightIndex += 1) {
      for (const leftRole of PLAN_ROLES) {
        for (const rightRole of PLAN_ROLES) {
          const left = capacities[leftIndex]!;
          const right = capacities[rightIndex]!;
          const leftCard = left[leftRole];
          const rightCard = right[rightRole];
          if (!leftCard || !rightCard) continue;
          // Ein Tausch darf die Sekundär-Regel nicht brechen: auf einem Sekundärplatz steht
          // nie eine Minuskarte (die Wertung warnt darüber, s. calculateFormModifierForSide).
          if (leftRole === "secondary" && rightCard.value < 0) continue;
          if (rightRole === "secondary" && leftCard.value < 0) continue;

          const current = formCardSlotValue(leftCard, left.slot) + formCardSlotValue(rightCard, right.slot);
          const swapped = formCardSlotValue(rightCard, left.slot) + formCardSlotValue(leftCard, right.slot);
          if (swapped > current) {
            left[leftRole] = rightCard;
            right[rightRole] = leftCard;
            improved = true;
          }
        }
      }
    }
  }
  return improved;
}

/**
 * Umzugs-Durchlauf: eine bereits platzierte Karte auf einen noch FREIEN Platz verschieben, wenn
 * der mehr bringt.
 *
 * Ohne diesen Durchlauf gewinnt die Phasenreihenfolge über den Wert: Phase 2 vergibt alle
 * Primärplätze, bevor Phase 3 überhaupt Sekundärplätze anfasst — eine `+7` landete deshalb auf
 * einem 3er-Primärplatz (21 Punkte), obwohl der Sekundärplatz neben der `+8` in der
 * farbgleichen 6er-Disziplin 84 Punkte gebracht hätte. Die Rolle ist kein Rang: was zählt, ist
 * `Kartenwert × Farbfaktor × Kadergröße`, und danach kann ein Sekundärplatz einen Primärplatz
 * klar schlagen.
 */
function improveByRelocation(capacities: PlanCapacity[]) {
  let improved = false;
  for (const source of capacities) {
    for (const role of PLAN_ROLES) {
      const card = source[role];
      if (!card) continue;
      // Einen Primärplatz mit Sekundärkarte nicht räumen — die zweite Karte stünde sonst allein
      // da, und ein Sekundärplatz ohne Primärplatz ist im Spieltags-Layer keine Anweisung.
      if (role === "primary" && source.secondary) continue;

      let bestTarget: PlanCapacity | null = null;
      let bestRole: "primary" | "secondary" = "primary";
      let bestValue = formCardSlotValue(card, source.slot);
      for (const target of capacities) {
        if (target === source) continue;
        const targetRole = !target.primary ? "primary" : !target.secondary ? "secondary" : null;
        if (!targetRole) continue;
        // Minuskarten gehören nie auf den Sekundärplatz.
        if (targetRole === "secondary" && card.value < 0) continue;
        const value = formCardSlotValue(card, target.slot);
        if (value > bestValue) {
          bestTarget = target;
          bestRole = targetRole;
          bestValue = value;
        }
      }
      if (bestTarget) {
        source[role] = null;
        bestTarget[bestRole] = card;
        improved = true;
      }
    }
  }
  return improved;
}

/**
 * Beide Verbesserungen abwechselnd bis zum Fixpunkt — ein Umzug macht einen Platz frei, der
 * einen Tausch lohnend machen kann, und umgekehrt. Beide verbessern nur bei ECHTEM Zugewinn,
 * die Rundenzahl ist gedeckelt: der Durchlauf terminiert garantiert und ist deterministisch.
 */
function improvePlan(capacities: PlanCapacity[], maxRounds = 4) {
  for (let round = 0; round < maxRounds; round += 1) {
    const swapped = improveByPairSwaps(capacities);
    const relocated = improveByRelocation(capacities);
    if (!swapped && !relocated) {
      return;
    }
  }
}

export function buildAiFormCardSeasonPlan(input: {
  /** Nur noch UNBENUTZTE Karten — verbrauchte Karten sind keine Planungsmasse mehr. */
  cards: FormCardSeasonPlanCard[];
  /** Alle noch spielbaren Disziplin-Seiten, inklusive der des aktuellen Spieltags. */
  slots: FormCardSeasonPlanSlot[];
}): FormCardSeasonPlan {
  const capacities = sortSlotsDeterministically(input.slots);
  const cards = input.cards.filter((card) => Number.isFinite(card.value) && card.value !== 0);

  // 1) Minuskarten: größter Betrag zuerst, weil die größte Minuskarte das beste Versteck
  //    braucht. `formCardSlotValue` ist hier negativ — „am wenigsten schlecht" heißt also
  //    GRÖSSTER Wert, und das ist derselbe Vergleich wie bei den Pluskarten.
  const negatives = [...cards]
    .filter((card) => card.value < 0)
    .sort((left, right) => left.value - right.value || left.id.localeCompare(right.id));
  for (const card of negatives) {
    const target = pickBestFreePrimary(card, capacities, (candidate, best) => candidate > best);
    if (target) {
      target.primary = card;
    }
  }

  // 2) Pluskarten auf die verbleibenden Primärplätze: größte Karte zuerst auf den wertvollsten
  //    freien Slot. Genau hier stirbt das alte „jede Karte träumt vom selben Slot" — der Slot
  //    ist nach der Zuteilung weg und die nächste Karte muss sich mit dem zweitbesten begnügen.
  const positives = [...cards]
    .filter((card) => card.value > 0)
    .sort((left, right) => right.value - left.value || left.id.localeCompare(right.id));
  const leftoverPositives: FormCardSeasonPlanCard[] = [];
  for (const card of positives) {
    const target = pickBestFreePrimary(card, capacities, (candidate, best) => candidate > best);
    if (target) {
      target.primary = card;
    } else {
      leftoverPositives.push(card);
    }
  }

  // 3) Übrige Pluskarten auf Sekundärplätze. Doppelbelegung ist Zweitverwertung, nicht Absicht:
  //    zwei Karten auf einer Seite bringen zusammen nicht mehr als dieselben zwei Karten auf zwei
  //    Seiten — sie sind nur die Notlösung, wenn die Karten sonst ungespielt verfallen.
  const stillUnplaced: FormCardSeasonPlanCard[] = [];
  for (const card of leftoverPositives) {
    const target = pickBestFreeSecondary(card, capacities);
    if (target) {
      target.secondary = card;
    } else {
      stillUnplaced.push(card);
    }
  }
  for (const card of negatives) {
    if (!capacities.some((capacity) => capacity.primary?.id === card.id)) {
      stillUnplaced.push(card);
    }
  }

  improvePlan(capacities);

  // Nachzügler: der Umzugs-Durchlauf kann Plätze freigeräumt haben, auf die eine bislang
  // unplatzierte Karte noch passt. Wer danach immer noch keinen Platz hat, bleibt ehrlich
  // ungeplant — im Spieltags-Layer heißt das „kein Anspruch, darf sofort fallen".
  const unplacedCardIds: string[] = [];
  for (const card of stillUnplaced) {
    const target =
      pickBestFreePrimary(card, capacities, (candidate, best) => candidate > best) ??
      (card.value > 0 ? pickBestFreeSecondary(card, capacities) : null);
    if (target) {
      if (!target.primary) {
        target.primary = card;
      } else {
        target.secondary = card;
      }
    } else {
      unplacedCardIds.push(card.id);
    }
  }

  const entryByCardId = new Map<string, FormCardSeasonPlanEntry>();
  let expectedTotalFormModifier = 0;
  for (const capacity of capacities) {
    for (const role of ["primary", "secondary"] as const) {
      const card = capacity[role];
      if (!card) continue;
      const expectedFormModifier = formCardSlotValue(card, capacity.slot);
      entryByCardId.set(card.id, { cardId: card.id, role, slot: capacity.slot, expectedFormModifier });
      expectedTotalFormModifier += expectedFormModifier;
    }
  }

  return {
    entryByCardId,
    unplacedCardIds: [...unplacedCardIds].sort((left, right) => left.localeCompare(right)),
    expectedTotalFormModifier,
  };
}

/**
 * Karten, die der Plan für GENAU diese Spieltags-Seite vorsieht — die Vorabsicht, die der
 * Aufstellungs-Layer umzusetzen versucht.
 */
export function getPlannedCardIdsForSlot(
  plan: FormCardSeasonPlan,
  matchdayIndex: number,
  disciplineSide: "d1" | "d2",
  /** Ohne Angabe: beide Rollen. Mit Angabe: nur Primär- bzw. nur Sekundärplatz. */
  role?: "primary" | "secondary",
) {
  const ids = new Set<string>();
  for (const entry of plan.entryByCardId.values()) {
    if (entry.slot.matchdayIndex !== matchdayIndex || entry.slot.disciplineSide !== disciplineSide) {
      continue;
    }
    if (role && entry.role !== role) {
      continue;
    }
    ids.add(entry.cardId);
  }
  return ids;
}

/**
 * Der ANSPRUCH einer Karte auf ihren geplanten Slot, abgezinst auf den aktuellen Spieltag.
 *
 * Das ist die Zahl, gegen die der Spieltags-Layer den Einsatz HIER UND JETZT abwägt. Drei Fälle
 * fallen dabei ohne Sonderbehandlung heraus:
 *   - Plan sieht die Karte auf DIESER Seite: Anspruch == Jetzt-Wert → sie wird gespielt.
 *   - Plan sieht sie auf der ANDEREN Seite desselben Spieltags: Anspruch ist der dortige
 *     (bessere) Wert, unabgezinst → sie bleibt hier liegen und fällt gleich nebenan.
 *   - Plan sieht sie später: Anspruch ist abgezinst → je ferner, desto eher wird sie doch
 *     jetzt gespielt.
 *
 * Die Abzinsung ist kein Zeitwert des Geldes, sondern Unsicherheit: ein Slot in acht Spieltagen
 * kann durch Verletzungen, Kaderwechsel oder Formkrisen entwertet sein. `null` als Rückgabe
 * heißt „kein Anspruch" — die Karte ist im Plan nicht untergebracht und darf sofort fallen.
 */
export const FORM_CARD_PLAN_FUTURE_DISCOUNT = 0.93;

export function getPlannedClaimValue(input: {
  plan: FormCardSeasonPlan;
  cardId: string;
  currentMatchdayIndex: number;
}): number | null {
  const entry = input.plan.entryByCardId.get(input.cardId);
  if (!entry) {
    return null;
  }
  const distance = Math.max(0, entry.slot.matchdayIndex - input.currentMatchdayIndex);
  return entry.expectedFormModifier * FORM_CARD_PLAN_FUTURE_DISCOUNT ** distance;
}

/**
 * EINSATZLISTE-REVAMP, PAKET 1 — reine Anzeige-Helfer (Slot-Kürzel, Slot-Farben, Gold-Rahmen).
 *
 * Konzept: docs/design/aufstellung-screen-rework-08-11.md (Fable, Abschnitte 5, 7, 8),
 * Architektur und Entscheidungen: docs/design/einsatzliste-revamp-architektur-08-11.md.
 *
 * NUR ANZEIGE. Nichts hier wird von Resolve, Arena-Adapter oder Motor gelesen; die Datei
 * importiert bewusst nichts aus dem Simulations- oder Matrixpfad. Sie bekommt fertige Zahlen
 * (Slot-Projektionen) und entscheidet nur, wie sie aussehen.
 */

/**
 * SECHS POSITIONSFARBEN — die Farbe hängt am Slot-Index (D1-1 … D1-6), nicht an der Rolle.
 * Sechs Farben lernt man an einem Abend; 20 Disziplinen x 6 Rollen wären 120.
 *
 * Index = `LegacyLineupLabSlot.slotIndex`, also genau die Zahl, die die Einsatzliste als
 * „D1-3" schon zeigt, und zugleich die Stelle in `DISCIPLINE_ROLE_THEMES` (bzw. in
 * `ROLE_THEME_IDS_BY_SLOT_COUNT` bei Battlefield), aus der der Arena-Adapter die Rolle
 * liest. Dieselbe Zahl auf beiden Seiten, ohne Übersetzung.
 *
 * Validiert mit der dataviz-Palettenprüfung (validate_palette.js, dunkles Thema, gegen
 * --nl-panel #131a26 und --nl-panel-2 #0f1621, benachbarte Paare): Helligkeitsband, Chroma,
 * CVD-Abstand 12,1, Normalsicht 17,8, Kontrast >= 3:1 — alles PASS. Über ALLE Paare (wichtig
 * für das spätere Mini-Feld, wo die Marken nicht in Reihe stehen) reicht es nicht; deshalb
 * steht das KÜRZEL immer daneben, die Farbe ist nie das einzige Merkmal. Bewusst abseits der
 * reservierten Töne: --nl-good (grün), --nl-warn/--nl-gold (gelb), --nl-risk (rot).
 * Nur Rand oder Kürzel-Chip, nie Flächenfüllung.
 */
export const EINSATZLISTE_SLOTFARBEN = [
  "#bd5e84", // 1 Rosé
  "#329cd4", // 2 Himmelblau
  "#a54f11", // 3 Rost
  "#8b53d4", // 4 Violett
  "#c97147", // 5 Kupfer
  "#b8479a", // 6 Pflaume
] as const;

export function slotFarbe(slotIndex: number): string {
  const n = EINSATZLISTE_SLOTFARBEN.length;
  const i = Number.isFinite(slotIndex) ? ((Math.trunc(slotIndex) % n) + n) % n : 0;
  return EINSATZLISTE_SLOTFARBEN[i]!;
}

/**
 * Grundregel wie im Arena-Board (`slotKuerzel` in battle-mode.engine.js): zwei Wörter ->
 * beide Anfangsbuchstaben („Hold Line" -> HL), ein Wort -> die ersten zwei Buchstaben.
 */
export function slotKuerzel(label: string): string {
  const woerter = label.trim().split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return "–";
  const roh = woerter.length >= 2 ? woerter[0]![0]! + woerter[1]![0]! : woerter[0]!.slice(0, 2);
  return roh.toUpperCase();
}

/**
 * Kürzel für ALLE Slots einer Disziplin, eindeutig. Die Grundregel kollidiert heute zweimal
 * (Staffel: Curve Runner / Chase Runner -> CR; Breaking: Standhalten / Steingesicht -> ST).
 * Der spätere Slot nimmt dann seinen ersten Buchstaben plus den nächsten noch freien
 * Buchstaben seines Labels (Chase Runner -> CH, Steingesicht -> SE). Deterministisch, ohne
 * Disziplin für Disziplin eine Liste zu pflegen.
 */
export function slotKuerzelFuerListe(labels: readonly string[]): string[] {
  const vergeben = new Set<string>();
  return labels.map((label) => {
    let kuerzel = slotKuerzel(label);
    if (vergeben.has(kuerzel)) {
      const buchstaben = label.replace(/[^\p{L}\p{N}]/gu, "");
      const erster = buchstaben[0] ?? "";
      for (const weiterer of buchstaben.slice(1)) {
        const kandidat = (erster + weiterer).toUpperCase();
        if (!vergeben.has(kandidat)) {
          kuerzel = kandidat;
          break;
        }
      }
    }
    vergeben.add(kuerzel);
    return kuerzel;
  });
}

/**
 * GOLDENER RAHMEN = OPTIMALE GESAMTZUTEILUNG DES KADERS.
 *
 * Chris 08.11. (zweite Antwort, nach der Sichtprüfung von F1): Gold richtet sich nach der
 * **besten Verteilung des ganzen Kaders**, nicht nach „Kader-Bester je Slot". Anlass: Im frischen
 * Spielstand war Tidesprinter in allen 12 Slots der Kader-Beste, konnte aber nur einen besetzen —
 * 11 von 12 Slots zeigten „Gold verschenkt", direkt neben „Bester Pick ✓". Gewünscht ist die
 * dynamische Lesart: Steht Tidesprinter optimal auf Slot X, vergibt Slot Y sein Gold an den
 * Besten unter den ÜBRIGEN Spielern.
 *
 * Das ist das Zuordnungsproblem (Maximum-Weight-Bipartite-Matching): Slots auf der einen Seite,
 * Spieler auf der anderen, Kante = Slotwert. Ein Spieler belegt höchstens EINEN Slot über beide
 * Disziplinen (dieselbe Regel wie `already_assigned_other_discipline` im Drag & Drop). Gelöst mit
 * der Ungarischen Methode, O(n³) bei n = max(Slots, Spieler) — bei 12 Slots und ~20 Spielern
 * ein paar tausend Schritte.
 *
 * Wert = `projectedScore` aus `playerBestSlotSummaryByActivePlayerId`, dieselbe Slot-Projektion,
 * die die Einsatzliste an Slot, Kader-Zeile und Drag-Vorschau zeigt.
 *
 * Das Gold-Kriterium selbst sitzt in `goldPruefung`: Ein besetzter Slot ist Gold, wenn es EINE
 * optimale Gesamtzuteilung gibt, die genau diesen Spieler hier hat (Fixierungsprüfung). Damit
 * kippt Gold nicht an Gleichständen (zwei gleich starke Spieler, die die Methode zufällig anders
 * herum verteilt hätte), und die Abweichung bekommt eine ehrliche Zahl: „diese Besetzung kostet
 * die Gesamtaufstellung 2,3".
 *
 * NUR ANZEIGE: Der KI-Vorschlag, Resolve und Motor lesen das nicht.
 */
export type Bestbesetzung = { id: string; name: string; wert: number };

export type SlotWerteJeSpieler = Iterable<
  [string, ReadonlyArray<{ slotKey: string; projectedScore: number | null }>]
>;

export type Zuteilung = {
  /** Slot -> Spieler der optimalen Zuteilung (null = kein Spieler mit Wert übrig). */
  jeSlot: Map<string, Bestbesetzung | null>;
  /** Spieler -> Slot der optimalen Zuteilung (nur zugeteilte Spieler). */
  slotVonSpieler: Map<string, string>;
  /** Summe der zugeteilten Slotwerte. */
  summe: number;
  /** Anzahl besetzter Slots (zuerst maximiert, dann die Summe). */
  besetzt: number;
};

type Wertetabelle = {
  slots: string[];
  spieler: Array<{ id: string; name: string }>;
  /** wert[slot][spieler], null = nicht einsetzbar. */
  wert: Array<Array<number | null>>;
};

const VERBOTEN = 1e9;
/** Bevorzugt „besetzt" vor „leer", unabhängig von der Werthöhe. */
const BESETZT_BONUS = 1e5;

/**
 * Ungarische Methode (Kuhn-Munkres, Potentialform) auf einer quadratischen Kostenmatrix,
 * minimiert. Liefert für jede Zeile die zugeordnete Spalte.
 */
function ungarisch(kosten: number[][]): number[] {
  const n = kosten.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0); // p[spalte] = zeile (1-basiert)
  const weg = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
    const benutzt = new Array<boolean>(n + 1).fill(false);
    do {
      benutzt[j0] = true;
      const i0 = p[j0]!;
      let delta = Number.POSITIVE_INFINITY;
      let j1 = 0;
      for (let j = 1; j <= n; j += 1) {
        if (benutzt[j]) continue;
        const cur = kosten[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          weg[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j += 1) {
        if (benutzt[j]) {
          u[p[j]!] = u[p[j]!]! + delta;
          v[j] = v[j]! - delta;
        } else {
          minv[j] = minv[j]! - delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = weg[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }
  const zeileZuSpalte = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j += 1) if (p[j]! > 0) zeileZuSpalte[p[j]! - 1] = j - 1;
  return zeileZuSpalte;
}

function baueWertetabelle(input: {
  slotKeys: Iterable<string>;
  slotWerteJeSpieler: SlotWerteJeSpieler;
  nameVon: (activePlayerId: string) => string;
  ausgeschlossen?: ReadonlySet<string>;
}): Wertetabelle {
  const slots = [...input.slotKeys];
  const slotIndex = new Map(slots.map((key, index) => [key, index] as const));
  const roh: Array<{ id: string; name: string; werte: Map<number, number> }> = [];
  for (const [id, eintraege] of input.slotWerteJeSpieler) {
    if (input.ausgeschlossen?.has(id)) continue;
    const werte = new Map<number, number>();
    for (const eintrag of eintraege) {
      const index = slotIndex.get(eintrag.slotKey);
      const wert = eintrag.projectedScore;
      if (index == null || wert == null || !Number.isFinite(wert)) continue;
      werte.set(index, wert);
    }
    if (werte.size > 0) roh.push({ id, name: input.nameVon(id), werte });
  }
  // Stabile Reihenfolge (Name, dann Id): bei Gleichstand entscheidet die Methode immer gleich,
  // sonst flackert das Gold zwischen Renders.
  roh.sort((a, b) => a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  return {
    slots,
    spieler: roh.map(({ id, name }) => ({ id, name })),
    wert: slots.map((_, s) => roh.map((spieler) => spieler.werte.get(s) ?? null)),
  };
}

function loese(tabelle: Wertetabelle, fixierung?: { spielerIndex: number; slotIndex: number }): Zuteilung {
  const { slots, spieler, wert } = tabelle;
  const n = Math.max(slots.length, spieler.length, 1);
  const kosten: number[][] = [];
  for (let s = 0; s < n; s += 1) {
    const zeile: number[] = [];
    for (let p = 0; p < n; p += 1) {
      if (s >= slots.length || p >= spieler.length) {
        zeile.push(0); // Platzhalter-Slot oder -Spieler: „leer"
        continue;
      }
      if (fixierung && (s === fixierung.slotIndex) !== (p === fixierung.spielerIndex)) {
        zeile.push(VERBOTEN);
        continue;
      }
      const w = wert[s]![p];
      zeile.push(w == null ? VERBOTEN : -(w + BESETZT_BONUS));
    }
    kosten.push(zeile);
  }
  const zuordnung = ungarisch(kosten);
  const jeSlot = new Map<string, Bestbesetzung | null>();
  const slotVonSpieler = new Map<string, string>();
  let summe = 0;
  let besetzt = 0;
  slots.forEach((key, s) => {
    const p = zuordnung[s] ?? -1;
    const w = p >= 0 && p < spieler.length ? wert[s]![p] : null;
    if (w == null || kosten[s]![p]! >= VERBOTEN) {
      jeSlot.set(key, null);
      return;
    }
    const sp = spieler[p]!;
    jeSlot.set(key, { id: sp.id, name: sp.name, wert: w });
    slotVonSpieler.set(sp.id, key);
    summe += w;
    besetzt += 1;
  });
  return { jeSlot, slotVonSpieler, summe, besetzt };
}

/** Optimale Gesamtzuteilung des Kaders auf die Slots (s. Kopfkommentar). */
export function optimaleZuteilung(input: {
  slotKeys: Iterable<string>;
  slotWerteJeSpieler: SlotWerteJeSpieler;
  nameVon: (activePlayerId: string) => string;
  /** Nicht einsetzbar (verletzt). */
  ausgeschlossen?: ReadonlySet<string>;
}): Zuteilung {
  return loese(baueWertetabelle(input));
}

export type GoldPruefung = {
  zuteilung: Zuteilung;
  /**
   * Kostet „Spieler P auf Slot S" die Gesamtaufstellung etwas? 0 = es gibt eine optimale
   * Zuteilung mit P auf S (Gold). > 0 = um so viel fällt das bestmögliche Gesamt, wenn P dort
   * festgenagelt wird. null = P hat in S keinen Wert (oder ist ausgeschlossen).
   */
  kostenVon: (activePlayerId: string, slotKey: string) => number | null;
};

/** Gleichstand-Toleranz für Gold: dieselbe Schwelle wie „Bester Pick ✓" (0,05). */
export const GOLD_TOLERANZ = 0.05;

/**
 * Baut die Zuteilung einmal und beantwortet danach „ist P auf S Gold?" per Fixierung (P fest auf
 * S, Rest optimal neu verteilt). Ergebnisse werden je Paar zwischengespeichert.
 */
export function goldPruefung(input: {
  slotKeys: Iterable<string>;
  slotWerteJeSpieler: SlotWerteJeSpieler;
  nameVon: (activePlayerId: string) => string;
  ausgeschlossen?: ReadonlySet<string>;
}): GoldPruefung {
  const tabelle = baueWertetabelle(input);
  const zuteilung = loese(tabelle);
  const spielerIndex = new Map(tabelle.spieler.map((sp, index) => [sp.id, index] as const));
  const slotIndex = new Map(tabelle.slots.map((key, index) => [key, index] as const));
  const cache = new Map<string, number | null>();
  const kostenVon = (activePlayerId: string, slotKey: string): number | null => {
    const cacheKey = `${activePlayerId}\u0000${slotKey}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    let ergebnis: number | null;
    const p = spielerIndex.get(activePlayerId);
    const s = slotIndex.get(slotKey);
    if (p == null || s == null || tabelle.wert[s]![p] == null) {
      ergebnis = null;
    } else if (zuteilung.jeSlot.get(slotKey)?.id === activePlayerId) {
      ergebnis = 0;
    } else {
      const fixiert = loese(tabelle, { spielerIndex: p, slotIndex: s });
      // Fällt durch die Fixierung ein Slot leer, fehlt sein ganzer Wert in der Summe — das ist
      // genau der Verlust, den diese Besetzung kostet.
      ergebnis = Math.max(0, Number((zuteilung.summe - fixiert.summe).toFixed(2)));
    }
    cache.set(cacheKey, ergebnis);
    return ergebnis;
  };
  return { zuteilung, kostenVon };
}

// ================================================================================================
// ±-SCHEMA (Rework-Konzept 6.1/6.2): eine Glyphen-Sprache für „Rolle“ und „Spieler in Rolle“.
// ================================================================================================

export type Glyphe = "++" | "+" | "·" | "−" | "−−";

/**
 * Was eine Rolle mit einem Attribut macht: Δ = Slot-Gewicht − Basis-Gewicht in Prozentpunkten
 * (`slotWeightProfile − baseWeightProfile`, beides auf der Rollendefinition). Schwellen wie
 * `resolveKeyAttributes` (primary ≥ 3, secondary ≥ 1), gespiegelt ins Negative — damit auch die
 * Abwertungen sichtbar werden, die `keyAttributes` verschweigt (Architektur 1.3, Nachtrag).
 */
export function rollenGlyphe(deltaPp: number): Glyphe {
  if (deltaPp >= 3) return "++";
  if (deltaPp >= 1) return "+";
  if (deltaPp > -1) return "·";
  if (deltaPp > -3) return "−";
  return "−−";
}

/**
 * Wie gut ein Spieler auf einen Slot passt: der Rollen-Aufschlag in Punkten (`roleModifier` der
 * Slot-Projektion). Dieselben Schwellen wie `passung()` im Arena-Motor (≥ 6 / ≥ 2 / ≥ −2), mit
 * einer fünften Stufe ≤ −6 nur für die Anzeige.
 */
export function passungsGlyphe(rollenAufschlag: number): Glyphe {
  if (rollenAufschlag >= 6) return "++";
  if (rollenAufschlag >= 2) return "+";
  if (rollenAufschlag >= -2) return "·";
  if (rollenAufschlag > -6) return "−";
  return "−−";
}

/** Ton einer Glyphe: positiv, neutral, negativ. */
export function glyphenTon(glyphe: Glyphe): "gut" | "neutral" | "schlecht" {
  return glyphe === "++" || glyphe === "+" ? "gut" : glyphe === "·" ? "neutral" : "schlecht";
}

// ================================================================================================
// TOOLTIP-DICHTE (Paket F4): auf den ersten Blick wenig Text, die Erklärung kommt beim Hovern.
// ================================================================================================

/**
 * Drei-Buchstaben-Kürzel eines Attributs für die dichte Rollenkarte. Der Attribut-Key ist immer
 * englisch (power, health, determination, stamina, speed, dexterity, awareness, intelligence,
 * will, charisma, spirit, torment) und in den ersten drei Buchstaben eindeutig — POW/HEA/DET/
 * STA/SPE/DEX/AWA/INT/WIL/CHA/SPI/TOR, keine Kollision. Der volle Name bleibt im Tooltip.
 */
export function attributKuerzel(key: string): string {
  return key.slice(0, 3).toUpperCase();
}

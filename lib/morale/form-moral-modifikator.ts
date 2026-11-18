/**
 * SPIELER-FORM + MORAL ALS KLEINER MODIFIKATOR AUF DIE ARENA-EIGNUNG (Prototyp, 17.11.,
 * docs/design/form-moral-17-11.md). STANDARD AUS.
 *
 * Chris am 17.11.: „können wir für die Spieler sowas wie Form + Moral mit in die Punkte
 * einfließen lassen?" Befund (Dokument oben): Moral ist gespeichert und fortgeschrieben, wirkt
 * aber nur im Legacy-PPS-Pfad (`legacy-score-engine.ts`); die Arena sieht sie nie. Eine
 * Spieler-Form gibt es nicht (`Player.form` steht überall auf 0, nie geschrieben).
 *
 * Diese Datei hält alles Reine an einem Ort, ohne schwere Importe (sie wird vom Arena-Adapter
 * gezogen, der auch im Browser-Bundle liegt):
 *
 *   1. `isFormMoralEnabled()`       der Schalter (Umgebungsvariable, Standard AUS)
 *   2. `calculateFormMoralSignal()` Form + Moral -> Prozent auf die Eignung, hart gedeckelt
 *   3. `advancePlayerForm()`        eine Form-Fortschreibung für EINEN Spieler und EINEN Spieltag
 *   4. `advancePlayerFormState()`   dieselbe, ligaweit aus dem Spielstand (Spieltagsabschluss)
 *   5. `buildFormMoralMultipliers()` Spieler-Id -> Multiplikator für ein Team (Arena-Adapter)
 *   6. `scaleArenaPlayerByMultiplier()` wendet den Multiplikator auf ein `ArenaSpieler`-Objekt an
 *
 * ALLES DETERMINISTISCH AUS DEM SPIELSTAND: keine Zufallsquelle, keine Uhr. Form entsteht aus den
 * bereits gebuchten `playerDisciplinePerformances` des Spieltags (Rang der Leistung gegen Rang der
 * Erwartung `baseValue`), Erschöpfung und Verletzung; Moral ist die gespeicherte
 * `playerMoraleState`-Zahl (die schon Einsatzzeit, Rolle, Training-Wunsch, Teamerfolg und
 * Kapitän enthält, s. `player-morale-service.ts`).
 *
 * WARUM AUF DIE ARENA-EIGNUNG UND NICHT IN DIE ENGINE: dieselbe Schicht wie Formkarten und
 * Intensität (Aufstellungs-/Kader-Adapter). Die Engine bleibt unangetastet; der Wertungs-
 * Fingerabdruck verschiebt sich nicht, solange der Schalter aus ist.
 */
import type { GameState, PlayerFormHistoryEntry, PlayerFormState, PlayerFormVerlaufEintrag, PlayerMoraleState } from "@/lib/data/olyDataTypes";

/** Neutralpunkt beider Skalen (0..100): Form und Moral liegen im Mittel bei 50. */
export const FORM_MORAL_NEUTRAL = 50;

/**
 * Dosis = Prozent Eignung JE FORM-STUFE (PM-Vorschlag 1,5 %). Form läuft in Stufen -2..+2, wirkt also
 * höchstens +-2 x Dosis; die Moral trägt zusätzlich höchstens +-`MORAL_ANTEIL` x Dosis. Bei 1,5 %:
 * Form +-3 %, Moral +-1 %, zusammen +-4 %.
 */
export const FORM_MORAL_STANDARD_DOSIS_PCT = 1.0;
export const MORAL_ANTEIL = 2 / 3;
/** Form-Punkte (0..100-Skala) je Stufe: 50 -> Stufe 0, 65 -> +1, 80 -> +2. */
export const FORM_PUNKTE_JE_STUFE = 15;
/** Ab dieser Abweichung vom Neutralpunkt ist die Moral voll ausgeschöpft. */
export const MORAL_SAETTIGUNG = 20;
/** Höchste Dosis, die der Schalter zulässt (Sicherung gegen Tippfehler). */
export const FORM_MORAL_MAX_DOSIS_PCT = 4;

export type FormMoralSignal = {
  form: number;
  /** Anzeige-Stufe -2..+2 (ganzzahlig); `formStufeStetig` ist der ungerundete Wert. */
  formStufe: number;
  formStufeStetig: number;
  morale: number;
  formPct: number;
  moralePct: number;
  /** Summe, hart gedeckelt. */
  modifierPct: number;
  multiplier: number;
};


function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function istZahl(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Im Browser-Bundle kann `process` fehlen; dann gilt der Standard (AUS). */
function lieseUmgebung(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

/**
 * Schalter. Seit 18.11. STANDARD AN (Fortschreibung UND Wirkung); `OLY_FORM_MORAL=0` schaltet ab.
 * Ohne die Variable (der Normalfall, auch in jedem Test) ist die Funktion `false` und jeder
 * Aufrufer verhält sich Zeichen für Zeichen wie vor dem 17.11.
 */
export function isFormMoralEnabled(env: Record<string, string | undefined> = lieseUmgebung()): boolean {
  const roh = (env.OLY_FORM_MORAL ?? "").trim().toLowerCase();
  // SCHARF (18.11.): Standard AN. Abschalten mit OLY_FORM_MORAL=0 (oder aus/off/false).
  return !(roh === "0" || roh === "aus" || roh === "off" || roh === "false");
}

/** Form (0..100) -> ungerundete Stufe -2..+2. */
export function formToStufeStetig(form: number | null | undefined): number {
  const f = istZahl(form) ? clamp(form, 0, 100) : FORM_MORAL_NEUTRAL;
  return clamp((f - FORM_MORAL_NEUTRAL) / FORM_PUNKTE_JE_STUFE, -2, 2);
}

/** Anzeige-Stufe: ▼▼ -2, ▼ -1, – 0, ▲ +1, ▲▲ +2 (ab +2 "heiß"). */
export function formToStufe(form: number | null | undefined): number {
  const stufe = Math.round(formToStufeStetig(form));
  return stufe === 0 ? 0 : stufe;
}

export const FORM_STUFEN_ANZEIGE: Record<number, string> = { [-2]: "▼▼", [-1]: "▼", 0: "–", 1: "▲", 2: "▲▲" };

/** Dosis aus `OLY_FORM_MORAL_DOSIS` (Prozent je Stufe, 0..4), sonst der Standard. */
export function resolveFormMoralDosisPct(env: Record<string, string | undefined> = lieseUmgebung()): number {
  const roh = Number(env.OLY_FORM_MORAL_DOSIS);
  return Number.isFinite(roh) && roh >= 0 ? clamp(roh, 0, FORM_MORAL_MAX_DOSIS_PCT) : FORM_MORAL_STANDARD_DOSIS_PCT;
}

/**
 * Form (0..100, 50 neutral) und Moral (0..100, 50 neutral) -> Prozent auf die Eignung.
 * Form wirkt STETIG (kein Stufensprung, sonst entstünden künstliche Rangbindungen): eine Stufe = 15
 * Form-Punkte = `dosisPct`. Moral sättigt bei +-20 Punkten und trägt höchstens `MORAL_ANTEIL x dosisPct`.
 * Fehlende Werte zählen neutral.
 */
export function calculateFormMoralSignal(input: {
  form?: number | null;
  morale?: number | null;
  dosisPct?: number;
}): FormMoralSignal {
  const dosis = clamp(input.dosisPct ?? FORM_MORAL_STANDARD_DOSIS_PCT, 0, FORM_MORAL_MAX_DOSIS_PCT);
  const form = clamp(istZahl(input.form) ? input.form : FORM_MORAL_NEUTRAL, 0, 100);
  const morale = clamp(istZahl(input.morale) ? input.morale : FORM_MORAL_NEUTRAL, 0, 100);
  const stetig = formToStufeStetig(form);
  const formPct = stetig * dosis;
  const moralePct = clamp((morale - FORM_MORAL_NEUTRAL) / MORAL_SAETTIGUNG, -1, 1) * MORAL_ANTEIL * dosis;
  const deckel = (2 + MORAL_ANTEIL) * dosis;
  const modifierPct = round(clamp(formPct + moralePct, -deckel, deckel), 3);
  return {
    form: round(form, 1),
    formStufe: formToStufe(form),
    formStufeStetig: round(stetig, 2),
    morale: round(morale, 1),
    formPct: round(formPct, 3),
    moralePct: round(moralePct, 3),
    modifierPct,
    multiplier: round(1 + modifierPct / 100, 5),
  };
}


// --- Fortschreibung --------------------------------------------------------------------------

/** Wie stark ein Einsatz die Form zieht (Anteil der Lücke zum Ziel). */
export const FORM_LERN_RATE = 0.3;
/** Rückfall zum Neutralpunkt je Spieltag ohne Einsatz. */
export const FORM_RUHE_RUECKFALL = 0.15;
/** Rang-Residuum (Leistung minus Erwartung, -1..+1), ab dem das Ziel voll ausschlägt. */
export const FORM_RESIDUUM_SAETTIGUNG = 0.22;
/** Erschöpfung ab diesem Wert drückt das Ziel; bei 100 um `FORM_ERSCHOEPFUNG_MAX`. */
export const FORM_ERSCHOEPFUNG_SCHWELLE = 60;
export const FORM_ERSCHOEPFUNG_MAX = 15;
export const FORM_VERLETZUNG_ABZUG = 10;
/** Laenge des gespeicherten Form-Verlaufs je Spieler (eine Saison hat 32 Spieltage). */
export const FORM_VERLAUF_MAX = 40;

/**
 * Saisonwechsel: Form zur Mitte zuruecksetzen (neue Saison, neues Blatt), Verlauf leeren; Einsatzzaehler
 * bleibt. Reine Funktion; ohne Liste kommt `undefined` zurueck (Feld bleibt dann weg).
 */
export function resetPlayerFormForNewSeason(zeilen: PlayerFormState[] | undefined): PlayerFormState[] | undefined {
  if (!zeilen) return undefined;
  return zeilen.map((z) => ({ ...z, form: FORM_MORAL_NEUTRAL, verlauf: [] }));
}

export type FormAdvanceInput = {
  /** Vorherige Form, fehlt -> Neutralpunkt. */
  form?: number | null;
  /** Hat der Spieler diesen Spieltag gespielt? */
  eingesetzt: boolean;
  /** Leistung minus Erwartung als Perzentil-Unterschied (-1..+1); nur bei Einsatz gesetzt. */
  residuum?: number | null;
  /** Erschöpfung nach dem Spieltag (0..100). */
  erschoepfung?: number | null;
  verletzt?: boolean;
};

/**
 * Ein Schritt der Form-Fortschreibung. Gespielt: die Form wandert um `FORM_LERN_RATE` auf ein Ziel
 * zu, das aus dem Rang-Residuum kommt (besser als erwartet -> Ziel über 50) und bei hoher
 * Erschöpfung gedrückt wird. Nicht gespielt: Rückfall zur Mitte (Rost und Erholung zugleich).
 * Verletzt: fester Abzug. Reine Funktion.
 */
export function advancePlayerForm(input: FormAdvanceInput): number {
  return advancePlayerFormDetail(input).form;
}

/** Wie `advancePlayerForm`, nennt zusaetzlich die Bremse (fuer Verlauf und Begruendung). */
export function advancePlayerFormDetail(input: FormAdvanceInput): {
  form: number;
  bremse: { art: "erschoepfung" | "verletzung"; punkte: number } | null;
} {
  let bremse: { art: "erschoepfung" | "verletzung"; punkte: number } | null = null;
  const vorher = clamp(istZahl(input.form) ? input.form : FORM_MORAL_NEUTRAL, 0, 100);
  let nachher: number;
  if (input.eingesetzt) {
    const residuum = clamp(istZahl(input.residuum) ? input.residuum : 0, -1, 1);
    let ziel = FORM_MORAL_NEUTRAL + FORM_MORAL_NEUTRAL * clamp(residuum / FORM_RESIDUUM_SAETTIGUNG, -1, 1);
    const erschoepfung = istZahl(input.erschoepfung) ? clamp(input.erschoepfung, 0, 100) : 0;
    if (erschoepfung > FORM_ERSCHOEPFUNG_SCHWELLE) {
      const abzug = ((erschoepfung - FORM_ERSCHOEPFUNG_SCHWELLE) / (100 - FORM_ERSCHOEPFUNG_SCHWELLE)) * FORM_ERSCHOEPFUNG_MAX;
      ziel -= abzug;
      bremse = { art: "erschoepfung", punkte: round(abzug, 1) };
    }
    nachher = vorher + FORM_LERN_RATE * (clamp(ziel, 0, 100) - vorher);
  } else {
    nachher = vorher + FORM_RUHE_RUECKFALL * (FORM_MORAL_NEUTRAL - vorher);
  }
  if (input.verletzt) {
    nachher -= FORM_VERLETZUNG_ABZUG;
    bremse = { art: "verletzung", punkte: FORM_VERLETZUNG_ABZUG };
  }
  return { form: round(clamp(nachher, 0, 100), 1), bremse };
}

/** Perzentil 0..1 je Eintrag (höher = besser), Bindungen mitteln. */
function perzentile(werte: number[]): number[] {
  const n = werte.length;
  if (n === 1) return [0.5];
  const sortiert = werte.map((wert, index) => ({ wert, index })).sort((a, b) => a.wert - b.wert);
  const ergebnis = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sortiert[j + 1].wert === sortiert[i].wert) j++;
    const mittel = (i + j) / 2 / (n - 1);
    for (let k = i; k <= j; k++) ergebnis[sortiert[k].index] = mittel;
    i = j + 1;
  }
  return ergebnis;
}

/**
 * Rang-Residuum je Spieler für EINEN Spieltag aus den gebuchten Leistungszeilen: je Disziplin das
 * Perzentil der tatsächlichen Leistung (`finalPlayerScore`) minus das Perzentil der Erwartung
 * (`baseValue`, die Eignung). Ein Spieler in zwei Disziplinen bekommt den Mittelwert. Disziplinen
 * mit weniger als drei Teilnehmern liefern kein Residuum (Rang aus zwei Werten ist Rauschen).
 */
export type MatchdayLeistungDetail = {
  residuum: number;
  /** Perzentile 0..100 der Disziplin mit dem groesseren Abstand. */
  leistungPerz: number;
  erwartungPerz: number;
  disziplinId: string;
};

export function buildMatchdayLeistungDetails(
  performances: Array<{ playerId: string; disciplineId: string; baseValue: number; finalPlayerScore: number; formSystematisch?: number | null }>,
): Map<string, MatchdayLeistungDetail> {
  const jeDisziplin = new Map<string, typeof performances>();
  for (const zeile of performances) {
    const liste = jeDisziplin.get(zeile.disciplineId);
    if (liste) liste.push(zeile);
    else jeDisziplin.set(zeile.disciplineId, [zeile]);
  }
  const summen = new Map<string, { summe: number; anzahl: number; best: MatchdayLeistungDetail | null }>();
  for (const [disziplinId, zeilen] of jeDisziplin) {
    if (zeilen.length < 3) continue;
    const erwartung = perzentile(zeilen.map((z) => (istZahl(z.baseValue) ? z.baseValue : 0)));
    // Review-Befund 4 (Selbstverstaerkung): die Leistung wird OHNE den systematischen Form-Anteil
    // (Form-Multiplikator + flacher Kartenwert inkl. Farbtraeger/Form-Hebel) verglichen; der Tagesform-
    // Zufall (+-4) bleibt drin — er ist das, was die Form messen soll. Aeltere Zeilen: finalPlayerScore.
    const leistung = perzentile(
      zeilen.map((z) => (istZahl(z.finalPlayerScore) ? z.finalPlayerScore - (istZahl(z.formSystematisch) ? z.formSystematisch : 0) : 0)),
    );
    zeilen.forEach((zeile, index) => {
      const eintrag = summen.get(zeile.playerId) ?? { summe: 0, anzahl: 0, best: null };
      const abstand = leistung[index] - erwartung[index];
      eintrag.summe += abstand;
      eintrag.anzahl += 1;
      if (!eintrag.best || Math.abs(abstand) > Math.abs(eintrag.best.residuum)) {
        eintrag.best = {
          residuum: abstand,
          leistungPerz: Math.round(leistung[index] * 100),
          erwartungPerz: Math.round(erwartung[index] * 100),
          disziplinId,
        };
      }
      summen.set(zeile.playerId, eintrag);
    });
  }
  return new Map(
    [...summen].map(([playerId, { summe, anzahl, best }]) => [
      playerId,
      { ...(best as MatchdayLeistungDetail), residuum: summe / anzahl },
    ]),
  );
}

export function buildMatchdayResiduals(
  performances: Array<{ playerId: string; disciplineId: string; baseValue: number; finalPlayerScore: number }>,
): Map<string, number> {
  return new Map([...buildMatchdayLeistungDetails(performances)].map(([id, d]) => [id, d.residuum]));
}

/**
 * Form-Fortschreibung ligaweit für den soeben abgerechneten Spieltag. Ruft man sie zweimal für
 * denselben Spieltag auf, bleibt die zweite Fassung stehen (`lastMatchdayId`), die Form wird nicht
 * doppelt gezogen. Reine Funktion über den Spielstand; liefert die neue Liste.
 */
export function advancePlayerFormState(
  gameState: GameState,
  matchdayId: string,
  /** Nur fuer Nachfuehrung vergangener Spieltage (Skript): Verletzung/Erschoepfung von DAMALS statt dem heutigen Stand. */
  historisch?: { verletzt: Set<string>; erschoepfung: Map<string, number> },
  /**
   * REGEL E (Training je Spieltag, Chris 18.11.): Formabzug durch Trainings-Ueberlastung, Spieler-Id ->
   * Punkte (> 0). Kommt aus `ueberlastungsAbzuegeFuerSpieltag` (lib/training/spieltag-training.ts) und wird
   * NACH dem normalen Schritt abgezogen und im Verlauf als `u` gezeigt. Fehlt die Map: kein Abzug.
   */
  ueberlastung?: ReadonlyMap<string, number> | null,
): PlayerFormState[] {
  const seasonId = gameState.season.id;
  const vorhandene = new Map((gameState.playerFormState ?? []).map((zeile) => [zeile.playerId, zeile]));
  const ergebnisse = gameState.seasonState.matchdayResults ?? [];
  const ergebnisIds = new Set(
    ergebnisse.filter((e) => e.seasonId === seasonId && e.matchdayId === matchdayId).map((e) => e.id),
  );
  const leistungen = (gameState.seasonState.playerDisciplinePerformances ?? []).filter((p) =>
    ergebnisIds.has(p.matchdayResultId),
  );
  const details = buildMatchdayLeistungDetails(leistungen);

  const eingesetzt = new Set(leistungen.map((p) => p.playerId));
  const verfuegbarkeit = new Map((gameState.seasonState.playerAvailabilityState ?? []).map((v) => [v.playerId, v]));
  const spielerFatigue = new Map(gameState.players.map((p) => [p.id, p.fatigue]));

  const ergebnis: PlayerFormState[] = [];
  const gesehen = new Set<string>();
  for (const roster of gameState.rosters) {
    if (gesehen.has(roster.playerId)) continue;
    gesehen.add(roster.playerId);
    const alt = vorhandene.get(roster.playerId);
    if (alt && alt.lastMatchdayId === matchdayId && alt.lastSeasonId === seasonId) {
      ergebnis.push(alt);
      continue;
    }
    const verf = verfuegbarkeit.get(roster.playerId);
    const verletzt = historisch ? historisch.verletzt.has(roster.playerId) : verf != null && verf.injuryStatus !== "healthy";
    const detail = details.get(roster.playerId);
    const spielte = eingesetzt.has(roster.playerId);
    const { form: formOhneUeberlastung, bremse } = advancePlayerFormDetail({
      form: alt?.form,
      eingesetzt: spielte,
      residuum: detail?.residuum ?? 0,
      erschoepfung: historisch ? historisch.erschoepfung.get(roster.playerId) ?? 0 : verf?.fatigue ?? spielerFatigue.get(roster.playerId) ?? 0,
      verletzt,
    });
    const ueberlastungsAbzug = Math.max(0, ueberlastung?.get(roster.playerId) ?? 0);
    const form = ueberlastungsAbzug > 0 ? round(clamp(formOhneUeberlastung - ueberlastungsAbzug, 0, 100), 1) : formOhneUeberlastung;
    // Verlauf: nur die laufende Saison (beim Saisonwechsel wird er geleert), hoechstens FORM_VERLAUF_MAX Eintraege,
    // KOMPAKT gespeichert (nur gesetzte Felder).
    const neueSaison = !alt || alt.lastSeasonId !== seasonId;
    const bisher = neueSaison ? [] : (alt?.verlauf ?? []);
    const eintrag: PlayerFormVerlaufEintrag = { m: matchdayId, f: form };
    if (spielte) eintrag.e = 1;
    if (spielte && detail) {
      eintrag.l = detail.leistungPerz;
      eintrag.x = detail.erwartungPerz;
      eintrag.d = detail.disziplinId;
    }
    if ((spielte || verletzt) && bremse) eintrag.b = { a: bremse.art === "verletzung" ? "v" : "e", p: bremse.punkte };
    if (ueberlastungsAbzug > 0) eintrag.u = ueberlastungsAbzug;
    if (bisher.length === 0) eintrag.v = round(clamp(istZahl(alt?.form) ? alt.form : FORM_MORAL_NEUTRAL, 0, 100), 1);
    ergebnis.push({
      playerId: roster.playerId,
      teamId: roster.teamId,
      form,
      lastSeasonId: seasonId,
      lastMatchdayId: matchdayId,
      appearances: (alt?.appearances ?? 0) + (spielte ? 1 : 0),
      verlauf: [...bisher, eintrag].slice(-FORM_VERLAUF_MAX),
    });
  }
  return ergebnis;
}

// --- Wirkung auf die Arena-Eignung -----------------------------------------------------------

/**
 * Spieler-Id -> Signal für ein Team. Liest NUR gespeicherte Zahlen (`playerFormState`,
 * `playerMoraleState`), rechnet nichts neu und braucht keine schweren Dienste. Spieler ohne
 * gespeicherte Werte bekommen Multiplikator 1 und tauchen nicht in der Map auf.
 */
export function buildFormMoralMultipliers(
  gameState: GameState,
  teamId: string,
  dosisPct: number = resolveFormMoralDosisPct(),
): Map<string, FormMoralSignal> {
  const form = new Map((gameState.playerFormState ?? []).map((zeile) => [zeile.playerId, zeile.form]));
  const moral = new Map<string, number>();
  for (const zeile of (gameState.playerMoraleState ?? []) as PlayerMoraleState[]) {
    if (zeile.teamId === teamId) moral.set(zeile.playerId, zeile.morale);
  }
  const ergebnis = new Map<string, FormMoralSignal>();
  for (const roster of gameState.rosters) {
    if (roster.teamId !== teamId) continue;
    const f = form.get(roster.playerId);
    const m = moral.get(roster.playerId);
    if (f == null && m == null) continue;
    ergebnis.set(roster.playerId, calculateFormMoralSignal({ form: f, morale: m, dosisPct }));
  }
  return ergebnis;
}

/**
 * Wendet einen Multiplikator auf Eignungen UND Attribute eines Arena-Spielers an (Eignung ist die
 * gewichtete Summe der Attribute, beide müssen sich gemeinsam bewegen, sonst widersprechen sich
 * die Kanäle im Motor). Gedeckelt bei 100, unten bei 0. Multiplikator 1 gibt das Objekt
 * unverändert zurück (gleiche Referenz).
 */
export function scaleArenaPlayerByMultiplier<
  T extends { d: Record<string, number>; a: Record<string, number> },
>(spieler: T, multiplier: number): T {
  if (!istZahl(multiplier) || multiplier === 1) return spieler;
  const skaliere = (wert: number) => round(clamp(wert * multiplier, 0, 100), 2);
  return {
    ...spieler,
    d: Object.fromEntries(Object.entries(spieler.d).map(([k, v]) => [k, skaliere(v)])),
    a: Object.fromEntries(Object.entries(spieler.a).map(([k, v]) => [k, skaliere(v)])),
  };
}

/**
 * Spieler-Form als Multiplikator fuer die Legacy-Wertung (nur Form, die Moral wirkt dort schon ueber
 * `buildPlayerMoralePerformanceMap`). Leer/`null` ohne aktiven Schalter oder ohne gespeicherte Form.
 */
export function buildFormWirkungMap(
  gameState: GameState | null | undefined,
  playerIds: string[],
  regeln?: { formMoral: boolean; dosisPct: number } | null,
): Record<string, { multiplier: number; modifierPct: number }> | null {
  // `regeln` (aus dem Lineup-Kontext, Review-Befund 3) schlaegt die Umgebungsvariablen.
  const aktiv = regeln ? regeln.formMoral : isFormMoralEnabled();
  const dosisPct = regeln ? regeln.dosisPct : resolveFormMoralDosisPct();
  if (!gameState || !aktiv) return null;
  const form = new Map((gameState.playerFormState ?? []).map((z) => [z.playerId, z.form]));
  const ergebnis: Record<string, { multiplier: number; modifierPct: number }> = {};
  for (const id of playerIds) {
    const f = form.get(id);
    if (f == null) continue;
    const signal = calculateFormMoralSignal({ form: f, morale: null, dosisPct });
    // Moral neutral (50) -> moralePct 0; nur die Form zaehlt.
    ergebnis[id] = { multiplier: round(1 + signal.formPct / 100, 5), modifierPct: signal.formPct };
  }
  return Object.keys(ergebnis).length > 0 ? ergebnis : null;
}

/** Kompakten Verlauf in die lesbare Form bringen (vorher aus dem Vor-Eintrag, Saison aus der Zeile). */
export function entpackeFormVerlauf(zeile: Pick<PlayerFormState, "verlauf" | "lastSeasonId"> | null | undefined): PlayerFormHistoryEntry[] {
  const liste = zeile?.verlauf ?? [];
  return liste.map((e, i) => ({
    seasonId: zeile!.lastSeasonId,
    matchdayId: e.m,
    form: e.f,
    vorher: i > 0 ? liste[i - 1].f : e.v ?? FORM_MORAL_NEUTRAL,
    eingesetzt: e.e === 1,
    leistungPerz: e.l ?? null,
    erwartungPerz: e.x ?? null,
    disziplinId: e.d ?? null,
    bremse: e.b ? { art: e.b.a === "v" ? ("verletzung" as const) : ("erschoepfung" as const), punkte: e.b.p } : null,
    ueberlastung: e.u ?? null,
  }));
}

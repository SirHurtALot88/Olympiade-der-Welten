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
import type { GameState, PlayerFormState, PlayerMoraleState } from "@/lib/data/olyDataTypes";

/** Neutralpunkt beider Skalen (0..100): Form und Moral liegen im Mittel bei 50. */
export const FORM_MORAL_NEUTRAL = 50;

/**
 * Dosis = Prozent Eignung JE FORM-STUFE (PM-Vorschlag 1,5 %). Form läuft in Stufen -2..+2, wirkt also
 * höchstens +-2 x Dosis; die Moral trägt zusätzlich höchstens +-`MORAL_ANTEIL` x Dosis. Bei 1,5 %:
 * Form +-3 %, Moral +-1 %, zusammen +-4 %.
 */
export const FORM_MORAL_STANDARD_DOSIS_PCT = 1.5;
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
 * Schalter. `OLY_FORM_MORAL=1` (oder "an"/"on"/"true") schaltet Fortschreibung UND Wirkung ein.
 * Ohne die Variable (der Normalfall, auch in jedem Test) ist die Funktion `false` und jeder
 * Aufrufer verhält sich Zeichen für Zeichen wie vor dem 17.11.
 */
export function isFormMoralEnabled(env: Record<string, string | undefined> = lieseUmgebung()): boolean {
  const roh = (env.OLY_FORM_MORAL ?? "").trim().toLowerCase();
  return roh === "1" || roh === "an" || roh === "on" || roh === "true";
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
  const vorher = clamp(istZahl(input.form) ? input.form : FORM_MORAL_NEUTRAL, 0, 100);
  let nachher: number;
  if (input.eingesetzt) {
    const residuum = clamp(istZahl(input.residuum) ? input.residuum : 0, -1, 1);
    let ziel = FORM_MORAL_NEUTRAL + FORM_MORAL_NEUTRAL * clamp(residuum / FORM_RESIDUUM_SAETTIGUNG, -1, 1);
    const erschoepfung = istZahl(input.erschoepfung) ? clamp(input.erschoepfung, 0, 100) : 0;
    if (erschoepfung > FORM_ERSCHOEPFUNG_SCHWELLE) {
      ziel -= ((erschoepfung - FORM_ERSCHOEPFUNG_SCHWELLE) / (100 - FORM_ERSCHOEPFUNG_SCHWELLE)) * FORM_ERSCHOEPFUNG_MAX;
    }
    nachher = vorher + FORM_LERN_RATE * (clamp(ziel, 0, 100) - vorher);
  } else {
    nachher = vorher + FORM_RUHE_RUECKFALL * (FORM_MORAL_NEUTRAL - vorher);
  }
  if (input.verletzt) nachher -= FORM_VERLETZUNG_ABZUG;
  return round(clamp(nachher, 0, 100), 1);
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
export function buildMatchdayResiduals(
  performances: Array<{ playerId: string; disciplineId: string; baseValue: number; finalPlayerScore: number }>,
): Map<string, number> {
  const jeDisziplin = new Map<string, typeof performances>();
  for (const zeile of performances) {
    const liste = jeDisziplin.get(zeile.disciplineId);
    if (liste) liste.push(zeile);
    else jeDisziplin.set(zeile.disciplineId, [zeile]);
  }
  const summen = new Map<string, { summe: number; anzahl: number }>();
  for (const zeilen of jeDisziplin.values()) {
    if (zeilen.length < 3) continue;
    const erwartung = perzentile(zeilen.map((z) => (istZahl(z.baseValue) ? z.baseValue : 0)));
    const leistung = perzentile(zeilen.map((z) => (istZahl(z.finalPlayerScore) ? z.finalPlayerScore : 0)));
    zeilen.forEach((zeile, index) => {
      const eintrag = summen.get(zeile.playerId) ?? { summe: 0, anzahl: 0 };
      eintrag.summe += leistung[index] - erwartung[index];
      eintrag.anzahl += 1;
      summen.set(zeile.playerId, eintrag);
    });
  }
  return new Map([...summen].map(([playerId, { summe, anzahl }]) => [playerId, summe / anzahl]));
}

/**
 * Form-Fortschreibung ligaweit für den soeben abgerechneten Spieltag. Ruft man sie zweimal für
 * denselben Spieltag auf, bleibt die zweite Fassung stehen (`lastMatchdayId`), die Form wird nicht
 * doppelt gezogen. Reine Funktion über den Spielstand; liefert die neue Liste.
 */
export function advancePlayerFormState(gameState: GameState, matchdayId: string): PlayerFormState[] {
  const seasonId = gameState.season.id;
  const vorhandene = new Map((gameState.playerFormState ?? []).map((zeile) => [zeile.playerId, zeile]));
  const ergebnisse = gameState.seasonState.matchdayResults ?? [];
  const ergebnisIds = new Set(
    ergebnisse.filter((e) => e.seasonId === seasonId && e.matchdayId === matchdayId).map((e) => e.id),
  );
  const leistungen = (gameState.seasonState.playerDisciplinePerformances ?? []).filter((p) =>
    ergebnisIds.has(p.matchdayResultId),
  );
  const residuen = buildMatchdayResiduals(leistungen);
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
    const verletzt = verf != null && verf.injuryStatus !== "healthy";
    const form = advancePlayerForm({
      form: alt?.form,
      eingesetzt: eingesetzt.has(roster.playerId),
      residuum: residuen.get(roster.playerId) ?? 0,
      erschoepfung: verf?.fatigue ?? spielerFatigue.get(roster.playerId) ?? 0,
      verletzt,
    });
    ergebnis.push({
      playerId: roster.playerId,
      teamId: roster.teamId,
      form,
      lastSeasonId: seasonId,
      lastMatchdayId: matchdayId,
      appearances: (alt?.appearances ?? 0) + (eingesetzt.has(roster.playerId) ? 1 : 0),
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

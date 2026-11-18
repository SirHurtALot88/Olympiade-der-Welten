/**
 * NACH DEM SPIELTAG (18.11., Vorlage: Ansicht 4 in public/mockups/form-moral-modern-17-11.html).
 *
 * Reine Ableitungen aus gespeicherten Daten, keine zweite Rechnung: Form-Meldungen kommen aus
 * `baueFormMeldungen` (Form-Verlauf), das Ergebnis je Disziplin aus den gebuchten `disciplineResults`,
 * Moral aus `playerMoraleState` (gespeicherter Wert und gespeicherte Gruende), Erschoepfung aus
 * `Player.fatigue`. Fehlt ein Wert, bleibt der Teil leer statt etwas zu erfinden ("gezeigt = gebucht").
 *
 * Bekannte Luecke: ein Vorher-Wert der Moral wird nirgends gespeichert (der Stand wird je Spieltag
 * ueberschrieben). Die Moral-Tafel zeigt deshalb den heutigen Wert und den staerksten gespeicherten
 * Grund mit seiner Punktwirkung, nicht "vorher -> nachher".
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import {
  FORM_ERSCHOEPFUNG_SCHWELLE,
  FORM_LERN_RATE,
  FORM_MORAL_NEUTRAL,
  FORM_RUHE_RUECKFALL,
  FORM_VERLETZUNG_ABZUG,
  formToStufe,
} from "@/lib/morale/form-moral-modifikator";
import { moralStufe } from "@/lib/morale/moral-anzeige";
import { FORM_STUFEN_WORT, baueFormMeldungen, formBegruendung, type FormMeldung } from "@/lib/lineups/form-moral-anzeige";

export type SpieltagsDisziplin = {
  side: "d1" | "d2";
  disciplineId: string;
  name: string;
  art: "duell" | "pod" | "platz";
  ausgang: "sieg" | "remis" | "niederlage" | null;
  /** Grosses Wort im Reiter: "Sieg", "Remis", "Niederlage", "Platz 3". */
  wort: string;
  /** Zeile darunter: "412 : 396", "von 4", "gegen X". */
  detail: string;
  gegnerName: string | null;
  teamPunkte: number | null;
};

/** Verletzt: nicht einsetzbar, solange die gespeicherte Sperre laeuft (Anzeige; die Spielregel liegt in der Wertung). */
export type VerletzungsStand = { nichtEinsetzbar: boolean; nochSpieltage: number | null };

export type SpielerPp = {
  /** Player Points dieses Spieltags (Summe der gebuchten Zeilen, wie der Saison-Ledger). */
  pp: number;
  rangTag: number;
  vonTag: number;
  /** Saison-PP bis einschliesslich dieses Spieltags und Rang darin. */
  ppSaison: number;
  rangSaison: number;
  vonSaison: number;
};

export type FormAnteil = { id: "leistung" | "mitte" | "erschoepfung" | "verletzung"; label: string; wert: number };

export type FormZeile = FormMeldung & {
  /** Alle Anteile, die zusammen den Wert ergeben (ganze Zahlen, Summe = gerundeter Wert). */
  anteile: FormAnteil[];
  /** Satz fuer die Spalte "Warum" (bei Verletzung nach Einsatz: Leistung UND Abzug). */
  warum: string;
  verletzung: VerletzungsStand | null;
  pp: SpielerPp | null;
  disziplinName: string | null;
  /** Kurzzeile unter dem Namen: "Basketball +19", "kein Einsatz", "verletzt". */
  kurz: string;
  /** Erschoepfung, die an diesem Spieltag gebremst hat (0 = keine Bremse). */
  erschoepfungBremse: number;
  /** Kopfzeile der Bauchbinde. */
  kopf: string;
  titel: string;
};

export type MoralZeile = {
  playerId: string;
  name: string;
  moral: number;
  wort: string;
  grund: string | null;
  /** Veraenderung seit dem Spieltag davor (`vorher`), sonst Punktwirkung des staerksten Grundes, `null` ohne beides. */
  delta: number | null;
  /** Gespeicherter Wert vor diesem Spieltag; `null` bei Staenden ohne das Feld. */
  vorher: number | null;
};

export type HeissKaltEintrag = { playerId: string; name: string; form: number; formPct: number | null };

export type SpieltagsHinweis = { id: string; text: string; namen: string[] };

export type NachDemSpieltag = {
  matchdayId: string;
  disziplinen: SpieltagsDisziplin[];
  form: FormZeile[];
  moral: MoralZeile[];
  heiss: HeissKaltEintrag[];
  kalt: HeissKaltEintrag[];
  hinweise: SpieltagsHinweis[];
};

const FORM_STUFE_HEISS = 1;
const FORM_STUFE_KALT = -1;
const MORAL_UNZUFRIEDEN_BIS = 40;
const MORAL_GRUND_MIN = 1;

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(".", ","));

/** "Kati, Aerin und Gram" */
export function nameListe(namen: readonly string[]): string {
  if (namen.length <= 1) return namen[0] ?? "";
  return `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
}

/** Ergebnis je Disziplin des eigenen Teams aus den GEBUCHTEN Zeilen (Sieg/Remis/Niederlage bzw. Platz). */
export function baueSpieltagsDisziplinen(
  gameState: GameState | null | undefined,
  teamId: string,
  matchdayId: string,
): SpieltagsDisziplin[] {
  if (!gameState) return [];
  const ergebnis = (gameState.seasonState.matchdayResults ?? []).find(
    (r) => r.seasonId === gameState.season.id && r.matchdayId === matchdayId && r.status === "preview_applied",
  );
  if (!ergebnis) return [];
  const zeilen = (gameState.seasonState.disciplineResults ?? []).filter((z) => z.matchdayResultId === ergebnis.id);
  const teamName = (id: string) => gameState.teams.find((t) => t.teamId === id)?.name ?? id;
  const dName = (id: string) => gameState.disciplines.find((d) => d.id === id)?.name ?? id;
  const eigene = zeilen.filter((z) => z.teamId === teamId).sort((a, b) => a.disciplineSide.localeCompare(b.disciplineSide));
  return eigene.map((z): SpieltagsDisziplin => {
    const gleiche = zeilen.filter((x) => x.disciplineSide === z.disciplineSide);
    const name = dName(z.disciplineId);
    const punkte = typeof z.teamPoints === "number" ? z.teamPoints : null;
    if (z.miniDmPod) {
      return { side: z.disciplineSide, disciplineId: z.disciplineId, name, art: "pod", ausgang: null, wort: `Platz ${z.miniDmPod.platz}`, detail: "von 4", gegnerName: null, teamPunkte: punkte };
    }
    if (z.opponentTeamId) {
      const gegner = zeilen.find((x) => x.teamId === z.opponentTeamId && x.disciplineSide === z.disciplineSide) ?? null;
      const gegnerPunkte = typeof gegner?.teamPoints === "number" ? gegner.teamPoints : null;
      let ausgang: SpieltagsDisziplin["ausgang"] = null;
      if (punkte != null && gegnerPunkte != null) ausgang = punkte > gegnerPunkte ? "sieg" : punkte < gegnerPunkte ? "niederlage" : "remis";
      else if (z.duellSeiten) ausgang = z.duellSeiten[0] > z.duellSeiten[1] ? "sieg" : z.duellSeiten[0] < z.duellSeiten[1] ? "niederlage" : "remis";
      const wort = ausgang === "sieg" ? "Sieg" : ausgang === "niederlage" ? "Niederlage" : ausgang === "remis" ? "Remis" : "Ergebnis";
      const stand = z.duellSeiten ? `${fmt(z.duellSeiten[0])} : ${fmt(z.duellSeiten[1])}` : "";
      return { side: z.disciplineSide, disciplineId: z.disciplineId, name, art: "duell", ausgang, wort, detail: stand || `gegen ${teamName(z.opponentTeamId)}`, gegnerName: teamName(z.opponentTeamId), teamPunkte: punkte };
    }
    return { side: z.disciplineSide, disciplineId: z.disciplineId, name, art: "platz", ausgang: null, wort: `Platz ${z.rank}`, detail: `von ${gleiche.length}`, gegnerName: null, teamPunkte: punkte };
  });
}

/**
 * Zerlegt die Formaenderung eines Spieltags in ihre Anteile, nach derselben Reihenfolge wie
 * `advancePlayerFormDetail`: erst Leistung (gespielt) bzw. Zug zur Mitte (nicht gespielt), dann der
 * Verletzungsabzug. Die Erschoepfungsbremse wirkt auf das Ziel, ihr Anteil ist `LERN_RATE * Abzug`.
 * Was die Modelle nicht erklaeren (Begrenzung auf 0..100, Rundung) landet im Hauptanteil, damit die
 * Summe immer genau der gebuchten Aenderung entspricht.
 */
export function zerlegeFormAenderung(m: Pick<FormMeldung, "vorher" | "nachher" | "eingesetzt" | "bremse">): FormAnteil[] {
  const delta = m.nachher - m.vorher;
  const verletzt = m.bremse?.art === "verletzung";
  const roh: FormAnteil[] = [];
  if (m.eingesetzt === false) {
    const mitte = verletzt ? FORM_RUHE_RUECKFALL * (FORM_MORAL_NEUTRAL - m.vorher) : delta;
    roh.push({ id: "mitte", label: "Zug zur Mitte", wert: mitte });
    if (verletzt) roh.push({ id: "verletzung", label: "Verletzt (Formabzug)", wert: delta - mitte });
  } else {
    const erschoepfung = m.bremse?.art === "erschoepfung" ? -FORM_LERN_RATE * m.bremse.punkte : 0;
    const verletzung = verletzt ? -FORM_VERLETZUNG_ABZUG : 0;
    roh.push({ id: "leistung", label: "Leistung gegen Erwartung", wert: delta - erschoepfung - verletzung });
    if (erschoepfung !== 0) roh.push({ id: "erschoepfung", label: "Erschöpfung", wert: erschoepfung });
    if (verletzung !== 0) roh.push({ id: "verletzung", label: "Verletzt (Formabzug)", wert: verletzung });
  }
  // Ganze Zahlen; die Rundungsdifferenz geht an den groessten Anteil, damit Summe == Math.round(delta).
  const ziel = Math.round(delta);
  const ganz = roh.map((x) => ({ ...x, wert: Math.round(x.wert) }));
  const rest = ziel - ganz.reduce((a, x) => a + x.wert, 0);
  if (rest !== 0) {
    const gross = ganz.reduce((best, x, i) => (Math.abs(roh[i].wert) > Math.abs(roh[best].wert) ? i : best), 0);
    ganz[gross].wert += rest;
  }
  const sichtbar = ganz.filter((x) => x.wert !== 0);
  return sichtbar.length > 0 ? sichtbar : [ganz[0]];
}

/** Eine Form-Meldung als Zeile: Disziplin, Kurzzeile, Kopf und Titel der Bauchbinde. */
export function formZeile(m: FormMeldung, disziplinName: (id: string) => string | null, stand: VerletzungsStand | null = null, pp: SpielerPp | null = null): FormZeile {
  const dn = m.disziplinId ? disziplinName(m.disziplinId) : null;
  const erschoepfungBremse = m.bremse?.art === "erschoepfung" ? m.bremse.punkte : 0;
  let kurz: string;
  const dauer = stand?.nochSpieltage != null ? ` (noch ${stand.nochSpieltage} ${stand.nochSpieltage === 1 ? "Spieltag" : "Spieltage"})` : "";
  const sperre = stand?.nichtEinsetzbar ? `nicht einsetzbar${dauer}` : null;
  if (m.bremse?.art === "verletzung") {
    const leistung = m.eingesetzt !== false && dn && m.abstand != null ? `${dn} ${m.abstand > 0 ? "+" : m.abstand < 0 ? "\u2212" : "\u00b1"}${Math.abs(m.abstand)} \u00b7 ` : "";
    kurz = `${leistung}verletzt${sperre ? ` \u00b7 ${sperre}` : ""}`;
  }
  else if (m.eingesetzt === false) kurz = "kein Einsatz";
  else if (dn && m.abstand != null) kurz = `${dn} ${m.abstand > 0 ? "+" : m.abstand < 0 ? "−" : "±"}${Math.abs(m.abstand)}`;
  else kurz = dn ?? "Einsatz";
  const kopf = m.stufeNachher > m.stufeVorher ? "Form gestiegen" : m.stufeNachher < m.stufeVorher ? "Form gefallen" : m.delta > 1 ? "Form leicht gestiegen" : m.delta < -1 ? "Form leicht gefallen" : "Form unverändert";
  const titel =
    m.stufeNachher === m.stufeVorher
      ? `${m.name} bleibt ${FORM_STUFEN_WORT[m.stufeNachher]}`
      : `${m.name}: von ${FORM_STUFEN_WORT[m.stufeVorher]} auf ${FORM_STUFEN_WORT[m.stufeNachher]}`;
  // Verletzt: Sperre vor Formabzug. Nach einem Einsatz steht zuerst die Leistung (formBegruendung nennt sonst nur den Abzug).
  let warum = m.grund;
  if (m.bremse?.art === "verletzung") {
    const sperrSatz = `Verletzt: ${sperre ?? "ausgefallen"}. Die Form verliert zusätzlich ${m.bremse.punkte} Punkte.`;
    const leistungsSatz =
      m.eingesetzt !== false && m.leistungPerz != null && m.erwartungPerz != null
        ? `${formBegruendung({ seasonId: "", matchdayId: "", form: m.nachher, vorher: m.vorher, eingesetzt: true, leistungPerz: m.leistungPerz, erwartungPerz: m.erwartungPerz, disziplinId: m.disziplinId }, dn)} `
        : "";
    warum = `${leistungsSatz}${sperrSatz}`;
  }
  return { ...m, anteile: zerlegeFormAenderung(m), warum, verletzung: stand, pp, disziplinName: dn, kurz, erschoepfungBremse, kopf, titel };
}

/** Wer ist heiss, wer kalt: aus der Form NACH dem Spieltag (Stufe +1/+2 bzw. -1/-2), staerkste Ausschlaege zuerst. */
export function baueHeissKalt(zeilen: readonly FormMeldung[], anzahl = 3): { heiss: HeissKaltEintrag[]; kalt: HeissKaltEintrag[] } {
  const eintrag = (m: FormMeldung): HeissKaltEintrag => ({ playerId: m.playerId, name: m.name, form: m.nachher, formPct: null });
  const heiss = zeilen.filter((m) => formToStufe(m.nachher) >= FORM_STUFE_HEISS).sort((a, b) => b.nachher - a.nachher).slice(0, anzahl).map(eintrag);
  const kalt = zeilen.filter((m) => formToStufe(m.nachher) <= FORM_STUFE_KALT).sort((a, b) => a.nachher - b.nachher).slice(0, anzahl).map(eintrag);
  return { heiss, kalt };
}

/**
 * Moral der eigenen Spieler: gespeicherter Wert, Wert vor dem Spieltag (additives Feld `vorher`) und staerkster
 * gespeicherter Grund. Mit Vorwert zaehlt, wer sich bewegt hat (>= 0,5 Punkte), groesste Bewegung zuerst.
 * Staende ohne Vorwert zeigen wie bisher die staerksten Gruende ohne vorher -> nachher.
 */
export function baueMoralZeilen(gameState: GameState | null | undefined, teamId: string, matchdayId?: string, limit = 12): MoralZeile[] {
  if (!gameState) return [];
  const namen = new Map(gameState.players.map((p) => [p.id, p.name]));
  const eigene = new Set(gameState.rosters.filter((r) => r.teamId === teamId).map((r) => r.playerId));
  const zeilen: MoralZeile[] = [];
  for (const z of gameState.playerMoraleState ?? []) {
    if (!eigene.has(z.playerId)) continue;
    const grund = [...(z.reasons ?? [])].filter((r) => Math.abs(r.valueDelta) >= MORAL_GRUND_MIN).sort((a, b) => Math.abs(b.valueDelta) - Math.abs(a.valueDelta))[0] ?? null;
    // Der Vorwert gilt nur, wenn er zu DIESEM Spieltag gehoert (sonst waere es die Bewegung eines anderen Tages).
    const vorher = z.vorher && (!matchdayId || z.vorher.matchdayId === matchdayId) ? z.vorher.morale : null;
    zeilen.push({
      playerId: z.playerId,
      name: namen.get(z.playerId) ?? z.playerId,
      moral: z.morale,
      wort: moralStufe(z.morale).wort,
      grund: grund?.label ?? null,
      delta: vorher != null ? Number((z.morale - vorher).toFixed(1)) : grund ? grund.valueDelta : null,
      vorher,
    });
  }
  const mitVorher = zeilen.some((z) => z.vorher != null);
  return zeilen
    .filter((z) => (mitVorher ? z.vorher != null && Math.abs(z.delta ?? 0) >= 0.5 : z.delta != null))
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, limit);
}

/** "Was jetzt zu tun ist": nur Saetze, die ein gespeicherter Wert wirklich traegt. */
export function baueHinweise(input: {
  form: readonly FormZeile[];
  moral: readonly MoralZeile[];
  kalt: readonly HeissKaltEintrag[];
}): SpieltagsHinweis[] {
  const hinweise: SpieltagsHinweis[] = [];
  const dauerText = (liste: readonly FormZeile[]) => {
    const tage = liste.map((z) => z.verletzung?.nochSpieltage).filter((x): x is number => x != null);
    if (tage.length === 0) return "";
    const max = Math.max(...tage);
    return liste.length > 1 ? ` (bis zu ${max} ${max === 1 ? "Spieltag" : "Spieltage"})` : ` (noch ${max} ${max === 1 ? "Spieltag" : "Spieltage"})`;
  };
  const viele = (namen: readonly string[]) => namen.length > 1;
  const muede = input.form.filter((z) => z.erschoepfungBremse > 0 && z.nachher <= z.vorher + 0.05);
  if (muede.length > 0) {
    const namen = muede.map((z) => z.name);
    hinweise.push({
      id: "erschoepfung",
      namen,
      text: `${nameListe(namen)} ${viele(namen) ? "sind" : "ist"} erschöpft (über ${FORM_ERSCHOEPFUNG_SCHWELLE}) und ${viele(namen) ? "rutschen" : "rutscht"} ab. Eine Pause hilft doppelt: weniger Last, und die Form erholt sich.`,
    });
  }
  const verletzt = input.form.filter((z) => z.bremse?.art === "verletzung");
  if (verletzt.length > 0) {
    const namen = verletzt.map((z) => z.name);
    hinweise.push({
      id: "verletzung",
      namen,
      text: `${nameListe(namen)} ${viele(namen) ? "sind" : "ist"} verletzt und nicht einsetzbar${dauerText(verletzt)}. Die Form verliert zusätzlich ${FORM_VERLETZUNG_ABZUG} Punkte.`,
    });
  }
  const bereitsGenannt = new Set([...muede, ...verletzt].map((m) => m.playerId));
  const kalteOhneMuede = input.kalt.filter((k) => !bereitsGenannt.has(k.playerId));
  if (kalteOhneMuede.length > 0) {
    const namen = kalteOhneMuede.map((k) => k.name);
    hinweise.push({
      id: "kalt",
      namen,
      text: `${nameListe(namen)} ${viele(namen) ? "sind" : "ist"} kalt: nicht auf Schlüsselplätze setzen, bis die Form zurück ist.`,
    });
  }
  const unzufrieden = input.moral.filter((z) => z.moral < MORAL_UNZUFRIEDEN_BIS && (z.delta ?? 0) < 0 && z.grund != null);
  if (unzufrieden.length > 0) {
    const namen = unzufrieden.map((z) => z.name);
    const grund = unzufrieden[0].grund;
    hinweise.push({
      id: "moral",
      namen,
      text: `Bei ${nameListe(namen)} liegt die Moral unter ${MORAL_UNZUFRIEDEN_BIS}${grund ? ` (${grund})` : ""}. Das drückt auf den Wert, solange der Grund bleibt.`,
    });
  }
  return hinweise;
}

/** Wie lange ein Spieler noch gesperrt ist, aus der gespeicherten Verfuegbarkeit (`getPlayerAvailabilityView`, naechster Spieltag). */
export function verletzungsStand(gameState: GameState, playerId: string, teamId: string): VerletzungsStand | null {
  const naechster = gameState.matchdayState.matchdayId;
  if (!naechster) return null;
  const sicht = getPlayerAvailabilityView(gameState, playerId, teamId, naechster);
  if (!sicht.isUnavailable) return { nichtEinsetzbar: false, nochSpieltage: null };
  const ids = gameState.season.matchdayIds ?? [];
  const bis = sicht.injuryUntilMatchday ? ids.indexOf(sicht.injuryUntilMatchday) : -1;
  const jetzt = ids.indexOf(naechster);
  return { nichtEinsetzbar: true, nochSpieltage: bis >= 0 && jetzt >= 0 && bis >= jetzt ? bis - jetzt + 1 : null };
}

const ppRunde = (x: number) => Number(x.toFixed(2));

/** Rang (Wettkampf-Rang: Gleichstand teilt den Platz) von `wert` in `werte` (hoeher = besser). */
function rangIn(werte: readonly number[], wert: number): number {
  return 1 + werte.filter((w) => ppRunde(w) > ppRunde(wert)).length;
}

/**
 * Player Points der eigenen Spieler an diesem Spieltag, ihr Rang an diesem Spieltag unter allen Spielern mit
 * gebuchtem PP und ihr Saison-PP-Rang (bis einschliesslich dieses Spieltags). Quelle ist derselbe Saison-Ledger,
 * den Saisonstand und Spieltagsergebnis lesen (`points` = Anteil + Mutator-Bonus): keine zweite PP-Rechnung.
 */
export function baueSpielerPp(gameState: GameState | null | undefined, teamId: string, matchdayId: string): Map<string, SpielerPp> {
  const aus = new Map<string, SpielerPp>();
  if (!gameState) return aus;
  const ledger = buildSeasonPointsLedger(gameState, gameState.season.id);
  const ids = gameState.season.matchdayIds ?? [];
  const index = ids.indexOf(matchdayId);
  const tag = new Map<string, number>();
  const saison = new Map<string, number>();
  for (const e of ledger.pointEntries) {
    const i = e.matchdayId ? ids.indexOf(e.matchdayId) : -1;
    if (index >= 0 && i > index) continue;
    saison.set(e.playerId, (saison.get(e.playerId) ?? 0) + e.points);
    if (e.matchdayId === matchdayId) tag.set(e.playerId, (tag.get(e.playerId) ?? 0) + e.points);
  }
  const tagWerte = [...tag.values()];
  const saisonWerte = [...saison.values()];
  const eigene = new Set(gameState.rosters.filter((r) => r.teamId === teamId).map((r) => r.playerId));
  for (const [playerId, pp] of tag) {
    if (!eigene.has(playerId)) continue;
    const ppS = saison.get(playerId) ?? pp;
    aus.set(playerId, { pp: ppRunde(pp), rangTag: rangIn(tagWerte, pp), vonTag: tagWerte.length, ppSaison: ppRunde(ppS), rangSaison: rangIn(saisonWerte, ppS), vonSaison: saisonWerte.length });
  }
  return aus;
}

export function baueNachDemSpieltag(
  gameState: GameState | null | undefined,
  teamId: string | null | undefined,
  matchdayId: string,
): NachDemSpieltag | null {
  if (!gameState || !teamId) return null;
  const disziplinName = (id: string) => gameState.disciplines.find((d) => d.id === id)?.name ?? null;
  const meldungen = baueFormMeldungen(gameState, teamId, matchdayId, (id) => disziplinName(id));
  const pp = baueSpielerPp(gameState, teamId, matchdayId);
  const form = meldungen.map((m) =>
    formZeile(m, disziplinName, m.bremse?.art === "verletzung" ? verletzungsStand(gameState, m.playerId, teamId) : null, pp.get(m.playerId) ?? null),
  );
  const { heiss, kalt } = baueHeissKalt(meldungen);
  const moral = baueMoralZeilen(gameState, teamId, matchdayId);
  const hinweise = baueHinweise({ form, moral, kalt });
  return { matchdayId, disziplinen: baueSpieltagsDisziplinen(gameState, teamId, matchdayId), form, moral, heiss, kalt, hinweise };
}

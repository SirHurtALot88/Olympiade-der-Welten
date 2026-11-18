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
import { FORM_ERSCHOEPFUNG_SCHWELLE, formToStufe } from "@/lib/morale/form-moral-modifikator";
import { moralStufe } from "@/lib/morale/moral-anzeige";
import { FORM_STUFEN_WORT, baueFormMeldungen, type FormMeldung } from "@/lib/lineups/form-moral-anzeige";

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

export type FormZeile = FormMeldung & {
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
  /** Punktwirkung des staerksten Grundes (`valueDelta`), `null` ohne Grund. */
  delta: number | null;
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

/** Eine Form-Meldung als Zeile: Disziplin, Kurzzeile, Kopf und Titel der Bauchbinde. */
export function formZeile(m: FormMeldung, disziplinName: (id: string) => string | null): FormZeile {
  const dn = m.disziplinId ? disziplinName(m.disziplinId) : null;
  const erschoepfungBremse = m.bremse?.art === "erschoepfung" ? m.bremse.punkte : 0;
  let kurz: string;
  if (m.bremse?.art === "verletzung") kurz = "verletzt";
  else if (m.eingesetzt === false) kurz = "kein Einsatz";
  else if (dn && m.abstand != null) kurz = `${dn} ${m.abstand > 0 ? "+" : m.abstand < 0 ? "−" : "±"}${Math.abs(m.abstand)}`;
  else kurz = dn ?? "Einsatz";
  const kopf = m.stufeNachher > m.stufeVorher ? "Form gestiegen" : m.stufeNachher < m.stufeVorher ? "Form gefallen" : m.delta > 1 ? "Form leicht gestiegen" : m.delta < -1 ? "Form leicht gefallen" : "Form unverändert";
  const titel =
    m.stufeNachher === m.stufeVorher
      ? `${m.name} bleibt ${FORM_STUFEN_WORT[m.stufeNachher]}`
      : `${m.name}: von ${FORM_STUFEN_WORT[m.stufeVorher]} auf ${FORM_STUFEN_WORT[m.stufeNachher]}`;
  return { ...m, disziplinName: dn, kurz, erschoepfungBremse, kopf, titel };
}

/** Wer ist heiss, wer kalt: aus der Form NACH dem Spieltag (Stufe +1/+2 bzw. -1/-2), staerkste Ausschlaege zuerst. */
export function baueHeissKalt(zeilen: readonly FormMeldung[], anzahl = 3): { heiss: HeissKaltEintrag[]; kalt: HeissKaltEintrag[] } {
  const eintrag = (m: FormMeldung): HeissKaltEintrag => ({ playerId: m.playerId, name: m.name, form: m.nachher, formPct: null });
  const heiss = zeilen.filter((m) => formToStufe(m.nachher) >= FORM_STUFE_HEISS).sort((a, b) => b.nachher - a.nachher).slice(0, anzahl).map(eintrag);
  const kalt = zeilen.filter((m) => formToStufe(m.nachher) <= FORM_STUFE_KALT).sort((a, b) => a.nachher - b.nachher).slice(0, anzahl).map(eintrag);
  return { heiss, kalt };
}

/** Moral der eigenen Spieler: gespeicherter Wert plus staerkster gespeicherter Grund, groesste Wirkung zuerst. */
export function baueMoralZeilen(gameState: GameState | null | undefined, teamId: string, limit = 12): MoralZeile[] {
  if (!gameState) return [];
  const namen = new Map(gameState.players.map((p) => [p.id, p.name]));
  const eigene = new Set(gameState.rosters.filter((r) => r.teamId === teamId).map((r) => r.playerId));
  const zeilen: MoralZeile[] = [];
  for (const z of gameState.playerMoraleState ?? []) {
    if (!eigene.has(z.playerId)) continue;
    const grund = [...(z.reasons ?? [])].filter((r) => Math.abs(r.valueDelta) >= MORAL_GRUND_MIN).sort((a, b) => Math.abs(b.valueDelta) - Math.abs(a.valueDelta))[0] ?? null;
    zeilen.push({
      playerId: z.playerId,
      name: namen.get(z.playerId) ?? z.playerId,
      moral: z.morale,
      wort: moralStufe(z.morale).wort,
      grund: grund?.label ?? null,
      delta: grund ? grund.valueDelta : null,
    });
  }
  return zeilen
    .filter((z) => z.delta != null)
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
      text: `${nameListe(namen)} ${viele(namen) ? "sind" : "ist"} verletzt, die Form wandert zur Mitte, bis ${viele(namen) ? "sie" : "er"} zurück ${viele(namen) ? "sind" : "ist"}.`,
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
  const unzufrieden = input.moral.filter((z) => z.moral < MORAL_UNZUFRIEDEN_BIS && (z.delta ?? 0) < 0);
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

export function baueNachDemSpieltag(
  gameState: GameState | null | undefined,
  teamId: string | null | undefined,
  matchdayId: string,
): NachDemSpieltag | null {
  if (!gameState || !teamId) return null;
  const disziplinName = (id: string) => gameState.disciplines.find((d) => d.id === id)?.name ?? null;
  const meldungen = baueFormMeldungen(gameState, teamId, matchdayId, (id) => disziplinName(id));
  const form = meldungen.map((m) => formZeile(m, disziplinName));
  const { heiss, kalt } = baueHeissKalt(meldungen);
  const moral = baueMoralZeilen(gameState, teamId);
  const hinweise = baueHinweise({ form, moral, kalt });
  return { matchdayId, disziplinen: baueSpieltagsDisziplinen(gameState, teamId, matchdayId), form, moral, heiss, kalt, hinweise };
}

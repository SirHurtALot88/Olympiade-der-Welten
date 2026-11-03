import type { GameState } from "@/lib/data/olyDataTypes";
import type {
  DisciplineTeamResolvePreview,
  LegacyMatchdayResolvePreview,
} from "@/lib/resolve/legacy-matchday-resolve-types";
import { baueFixtureIndex, findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";

/**
 * SPIELTAGS-ANSICHT DER BATTLE ARENA (02.11.) — reine Entscheidungslogik, kein React.
 *
 * Bis hierher fuehrte "Arena starten" im normalen Spieltagsablauf zur Disziplin-Buehne, deren
 * Pixel-Szene selbst sagte: "Vorschau mit Demo-Figuren — gewertet wird weiter unten auf der
 * Buehne". Die echte Battle Arena (der Motor mit den PixelLab-Figuren) stand nur als eigener
 * Entwurfsreiter daneben und buchte nichts — obwohl die gebuchten Zahlen in einem Battle-Save
 * laengst aus genau diesem Motor kommen (Hintergrund-Vorlauf, `lib/battle/arena-vorlauf-service.ts`).
 *
 * Diese Datei beantwortet fuer die Buehne EINE Frage: Ist das, was fuer DIESE Disziplin an DIESEM
 * Spieltag gebucht wird, ein Motor-Spiel, das sich in der Arena zeigen laesst — und wenn ja, welches?
 *
 *  - `resolutionSource === "arena"`: ein Zwei-Team-Duell aus dem Vorlauf. Gezeigt wird das Fixture
 *    des eigenen Teams in FIXTURE-ORIENTIERUNG (Heim = `fixture.homeTeamId`), denn genau so laeuft
 *    der zaehlende Lauf (`bereiteFixturesVor()` in arena-headless-runner.ts: SQUAD = Heim). Wer die
 *    Seiten vertauscht, bekommt mit derselben Saat ein anderes Spiel.
 *  - `resolutionSource === "mini_dm_pod"` mit Motor-Quelle (`"ffa"` Mini-DM/Battlefield, `"bahn"`
 *    Takeshi/Staffel): ein Vier-Team-Pod aus dem Motor. Die Arena sucht ihn fuer das eigene Team.
 *  - alles andere (`"pps"`, `"pps_duell"` = PPS-Duell-Bruecke, PPS-Pod, kein Snapshot, Vorlauf
 *    laeuft noch): KEIN Motor-Spiel gebucht. Die Arena wuerde dort ein Spiel zeigen, das nicht
 *    zaehlt — sie zeigt dann keins, sondern nur die gebuchte Wertung (die alte Buehne ist im
 *    Battle Mode abgeschaltet, s. docs/design/battle-arena-spieltag-anbindung-02-11.md).
 *
 * Die Wertung selbst wird hier nicht beruehrt: alles liest nur den Snapshot, den die Buehne ohnehin
 * zeigt und bucht.
 */

export type ArenaSpieltagAnsicht = {
  /** Die Disziplin, die der Motor zeigt. */
  disciplineId: string;
  /** Heim-/Gastteam in Fixture-Orientierung (beim Pod: eigenes Team / irgendein zweites). */
  heimTeamId: string;
  gastTeamId: string;
  /** Bezugsteam fuer die Pod-Suche — immer das eigene Team. */
  podTeamId: string;
};

export type ArenaSpieltagEntscheidung = ArenaSpieltagAnsicht & {
  art: "duell" | "pod";
  eigeneZeile: DisciplineTeamResolvePreview;
  gegnerZeile: DisciplineTeamResolvePreview | null;
};

/** Dieselbe Pruefung wie `istMotorPodQuelle()` (lib/resolve/mini-dm-pod-resolve.ts) — dort mit
 *  schweren Referenz-Importen, die hier im Client-Bundle nichts verloren haben. */
export function istMotorPodQuelleClient(quelle: string | null | undefined): boolean {
  return quelle === "ffa" || quelle === "bahn";
}

export function bestimmeArenaSpieltagAnsicht(input: {
  gameState: Pick<GameState, "seasonState">;
  matchdayId: string | null | undefined;
  disciplineId: string | null | undefined;
  ownTeamId: string | null | undefined;
  preview: LegacyMatchdayResolvePreview | null | undefined;
}): ArenaSpieltagEntscheidung | null {
  const { gameState, matchdayId, disciplineId, ownTeamId, preview } = input;
  if (!matchdayId || !disciplineId || !ownTeamId || !preview) return null;
  if (preview.matchdayId && preview.matchdayId !== matchdayId) return null;
  const disziplin = preview.disciplinePreviews.find((eintrag) => eintrag.disciplineId === disciplineId);
  if (!disziplin) return null;
  const eigeneZeile = disziplin.teamResults.find((zeile) => zeile.teamId === ownTeamId);
  if (!eigeneZeile) return null;

  const fixture = baueFixtureIndex(findeSpieltagsFixtures(gameState, matchdayId)).get(ownTeamId) ?? null;

  if (eigeneZeile.resolutionSource === "arena") {
    const gegnerId = eigeneZeile.opponentTeamId ?? null;
    if (!fixture || !gegnerId) return null;
    const paar = new Set([fixture.homeTeamId, fixture.awayTeamId]);
    if (!paar.has(ownTeamId) || !paar.has(gegnerId)) return null;
    return {
      art: "duell",
      disciplineId,
      heimTeamId: fixture.homeTeamId,
      gastTeamId: fixture.awayTeamId,
      podTeamId: ownTeamId,
      eigeneZeile,
      gegnerZeile: disziplin.teamResults.find((zeile) => zeile.teamId === gegnerId) ?? null,
    };
  }

  if (eigeneZeile.resolutionSource === "mini_dm_pod" && istMotorPodQuelleClient(eigeneZeile.miniDmPod?.quelle)) {
    const pod = eigeneZeile.miniDmPod;
    const zweites =
      (fixture ? (fixture.homeTeamId === ownTeamId ? fixture.awayTeamId : fixture.homeTeamId) : null) ??
      pod?.teamIds.find((teamId) => teamId !== ownTeamId) ??
      null;
    if (!zweites) return null;
    return {
      art: "pod",
      disciplineId,
      heimTeamId: ownTeamId,
      gastTeamId: zweites,
      podTeamId: ownTeamId,
      eigeneZeile,
      gegnerZeile: null,
    };
  }

  return null;
}

/**
 * Die eigene Wertungszeile (und die des Duellgegners) fuer EINE Disziplin, unabhaengig davon, ob
 * sie aus dem Motor kommt. Fuer die Battle-Mode-Arena, wenn KEIN Motor-Spiel gebucht ist
 * (PPS-Duell-Bruecke, PPS-Pod): dann zeigt sie statt der alten Buehne nur, was gebucht wird.
 */
export function findeEigeneWertungsZeilen(input: {
  preview: LegacyMatchdayResolvePreview | null | undefined;
  disciplineId: string | null | undefined;
  ownTeamId: string | null | undefined;
}): Pick<ArenaSpieltagEntscheidung, "art" | "eigeneZeile" | "gegnerZeile"> | null {
  const { preview, disciplineId, ownTeamId } = input;
  if (!preview || !disciplineId || !ownTeamId) return null;
  const disziplin = preview.disciplinePreviews.find((eintrag) => eintrag.disciplineId === disciplineId);
  const eigeneZeile = disziplin?.teamResults.find((zeile) => zeile.teamId === ownTeamId);
  if (!disziplin || !eigeneZeile) return null;
  if (eigeneZeile.miniDmPod) return { art: "pod", eigeneZeile, gegnerZeile: null };
  const gegnerId = eigeneZeile.opponentTeamId ?? null;
  return {
    art: "duell",
    eigeneZeile,
    gegnerZeile: gegnerId ? disziplin.teamResults.find((zeile) => zeile.teamId === gegnerId) ?? null : null,
  };
}

/**
 * Warum fuer diese Disziplin KEIN Motor-Spiel gezeigt wird -- in Worten, fuer die Battle-Mode-Arena.
 * `"vorlauf"`: der Hintergrund-Vorlauf rechnet noch; `"bruecke"`: die Disziplin ist in Battle Mode
 * (noch) nicht arena-gewertet (PPS-Duell-Bruecke bzw. PPS-Pod); `"offen"`: noch keine Wertung da.
 */
export function grundOhneMotorSpiel(input: {
  zeilen: Pick<ArenaSpieltagEntscheidung, "eigeneZeile"> | null;
  vorlaufLaeuft: boolean;
}): "vorlauf" | "bruecke" | "offen" {
  if (input.vorlaufLaeuft) return "vorlauf";
  if (!input.zeilen) return "offen";
  return "bruecke";
}

export type GebuchtesArenaErgebnis = {
  /** Aus Sicht des eigenen Teams; `null` beim Pod (dort zaehlt der Platz). */
  ausgang: "sieg" | "remis" | "niederlage" | null;
  text: string;
};

function fmt(wert: number): string {
  return Number.isInteger(wert) ? String(wert) : wert.toFixed(1).replace(".", ",");
}

/** Was fuer das eigene Team gebucht ist — in Worten, fuer die Zeile unter der Arena. */
export function beschreibeGebuchtesArenaErgebnis(
  entscheidung: Pick<ArenaSpieltagEntscheidung, "art" | "eigeneZeile" | "gegnerZeile">,
  teamName: (teamId: string) => string,
): GebuchtesArenaErgebnis {
  const eigen = entscheidung.eigeneZeile;
  const punkte = typeof eigen.teamPoints === "number" ? eigen.teamPoints : null;
  const punkteText = punkte != null ? ` · ${fmt(punkte)} Pkt.` : "";
  if (entscheidung.art === "pod") {
    const platz = eigen.miniDmPod?.platz ?? null;
    return { ausgang: null, text: `${teamName(eigen.teamId)}: Platz ${platz ?? "?"} von 4${punkteText}` };
  }
  const gegner = entscheidung.gegnerZeile;
  const seiten = Array.isArray(eigen.duellSeiten) ? eigen.duellSeiten : null;
  // Ausgang ueber die gebuchten Team-Punkte beider Seiten (deckt den kg-Tiebreak im Gewichtheben ab,
  // wo der Seitenstand gleich, das Duell aber entschieden ist); ohne Gegnerzeile ueber den Seitenstand.
  const gegnerPunkte = typeof gegner?.teamPoints === "number" ? gegner.teamPoints : null;
  let ausgang: GebuchtesArenaErgebnis["ausgang"] = null;
  if (punkte != null && gegnerPunkte != null) {
    ausgang = punkte > gegnerPunkte ? "sieg" : punkte < gegnerPunkte ? "niederlage" : "remis";
  } else if (seiten) {
    ausgang = seiten[0] > seiten[1] ? "sieg" : seiten[0] < seiten[1] ? "niederlage" : "remis";
  }
  const wort = ausgang === "sieg" ? "Sieg" : ausgang === "niederlage" ? "Niederlage" : ausgang === "remis" ? "Remis" : "Ergebnis";
  const gegnerName = eigen.opponentTeamId ? teamName(eigen.opponentTeamId) : "Gegner";
  const stand = seiten ? ` ${fmt(seiten[0])} : ${fmt(seiten[1])}` : "";
  return { ausgang, text: `${wort} gegen ${gegnerName}${stand}${punkteText}` };
}

/**
 * Passt der Sieger, den der Motor am Ende gezeigt hat (0 = Heim, 1 = Gast, null = kein Sieger),
 * zum gebuchten Ausgang? `null`, wenn sich das nicht pruefen laesst (Pod, kein Ausgang).
 *
 * WARUM DIESE PRUEFUNG UEBERHAUPT: die zuschaubare Wiedergabe tickt mit (1/60)/ZEIT_DEHNUNG, der
 * zaehlende Lauf mit 1/60. Fuer die Buehnen-Disziplinen ist das gleichgueltig (gemessen bitgleich),
 * auf der Bahn (Spurt, Climbing, Takeshi) weicht der Endstand in Einzelfaellen ab — gemessen 1 von
 * 12 Saaten mit anderem Sieger bei Climbing. Die Wertung bleibt die gebuchte; die Arena sagt es dann.
 */
export function zeigtArenaDenGebuchtenSieger(
  entscheidung: ArenaSpieltagEntscheidung,
  gebucht: GebuchtesArenaErgebnis,
  gezeigterSieger: 0 | 1 | null,
): boolean | null {
  if (entscheidung.art !== "duell" || gebucht.ausgang == null) return null;
  const eigenIstHeim = entscheidung.eigeneZeile.teamId === entscheidung.heimTeamId;
  const gezeigt: GebuchtesArenaErgebnis["ausgang"] =
    gezeigterSieger == null ? "remis" : (gezeigterSieger === 0) === eigenIstHeim ? "sieg" : "niederlage";
  return gezeigt === gebucht.ausgang;
}

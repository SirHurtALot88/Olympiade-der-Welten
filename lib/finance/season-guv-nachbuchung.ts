/**
 * DIE GESPEICHERTE GuV NACH DER BUCHUNG NACHZIEHEN.
 *
 * GEMELDET VON CHRIS an der Historie von L-K: „warum so viel minus in der aktiven season?" Die
 * Zeile wies −33,4 aus, die tatsächlich gebuchten Bewegungen ergaben −18,8.
 *
 * BEFUND — die Zeile ist zu früh eingefroren. `writeLocalCashPrizeApply`
 * (`cash-prize-apply-service.ts`) schreibt `standings[team].guv` und `.guvPosten` aus
 * `resolveSeasonGuvByTeam`, und zwar VOR den eigentlichen Buchungen. Am Abbild `1hf25q` gemessen,
 * Saison 2, alles innerhalb von 16 Sekunden:
 *
 *   18:08:28.587  cashPrizeApply — schreibt guvPosten   ← die eingefrorene Hochrechnung
 *   18:08:29.110  Sponsor-Abrechnung gebucht
 *   18:08:29.224  Apron-Abrechnung gebucht
 *   18:08:44.841  Vorstandsziele gebucht
 *
 * Danach wurde die Zeile nie wieder angefasst. Sie behauptete deshalb dauerhaft „Apron:
 * Hochrechnung, noch nicht gebucht" und liess ihn aus der Summe, und sie trug bei den
 * Vorstandszielen den Vorschauwert (+3,0), wo −1,0 gebucht wurde.
 *
 * WARUM NEU ABLEITEN UND NICHT EINZELNE POSTEN FLICKEN. `resolveSeasonGuvByTeam` liest inzwischen
 * bei JEDEM Posten den Beleg, sobald es einen gibt: Sponsor über `getSeasonSponsorCashByTeam`
 * (gebuchte Logs plus projizierter Rest), Vorstandsziele über `getObjectiveCashByTeam`, Apron über
 * `getApronCashByTeam`. Nach der Buchung ist ein frischer Aufruf damit die vollständige Wahrheit —
 * und das Ergebnis ist per Konstruktion dieselbe Zahl, die die Oberfläche zeigt, wenn sie live
 * rechnet statt aus dem Spielstand zu lesen. Genau diese Doppelung war das Problem.
 *
 * IDEMPOTENT: die Funktion leitet nur ab und vergleicht, bevor sie schreibt. Zweimal laufen ändert
 * nichts.
 *
 * MITTEN IN DER SAISON IST DER AUFRUF NICHT MEHR SINNLOS. Hier stand: „NUR NACH DER BUCHUNG
 * AUFRUFEN. Mitten in der Saison wäre der Aufruf harmlos, aber sinnlos: dann steht in beiden Zeilen
 * dieselbe Hochrechnung." Das galt, solange beide Zeilen überhaupt existierten. Nachgemessen war
 * genau das nicht der Fall: in sechs der sieben Live-Spielstände gab es die gespeicherte Zeile gar
 * nicht, und die GuV-Spalte im Saisonstand blieb dauerhaft leer. Seit `zieheSaisonstandGuvNachSpieltag`
 * (unten) hängt die Ableitung deshalb auch am Spieltag.
 */

import type { GameState, StandingRecord } from "@/lib/data/olyDataTypes";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { isSeasonEndRosterPhase } from "@/lib/season/season-end-roster-window";

export type StandingsGuvNachbuchungResult = {
  gameState: GameState;
  /** Teams, deren Zeile sich wirklich geändert hat. Leer = nichts nachzuziehen. */
  geaenderteTeams: string[];
};

/** Zwei Postenlisten sind gleich, wenn Betrag, Zählen und Notiz aller Zeilen gleich sind. */
function postenGleich(links: StandingRecord["guvPosten"], rechts: StandingRecord["guvPosten"]): boolean {
  if (!Array.isArray(links) || !Array.isArray(rechts) || links.length !== rechts.length) {
    return false;
  }
  return links.every((eintrag, index) => {
    const anderer = rechts[index];
    return (
      anderer != null &&
      eintrag.key === anderer.key &&
      eintrag.amount === anderer.amount &&
      eintrag.counted === anderer.counted &&
      (eintrag.note ?? null) === (anderer.note ?? null)
    );
  });
}

/**
 * Leitet `guv` und `guvPosten` im Saisonstand aus der gemeinsamen Rechnung neu ab. Persistiert
 * NICHTS — das bleibt beim Aufrufer, der seine eigene Save-Führung hat.
 *
 * HIER STAND EIN RIEGEL: „Teams ohne gespeicherte Postenliste bleiben unberührt: die Liste entsteht
 * bei der Saisonende-Buchung, und wo sie fehlt, gab es diese Buchung nicht." Er ist weg, auf Chris'
 * Ansage vom 23.08. („ja bau die drei hovers so und die guv nachbuchung auch").
 *
 * WARUM ER FALSCH WAR — nachgemessen an den sieben Live-Spielständen: nur EINER (`1hf25q`,
 * abgeschlossen) trägt überhaupt `guv`/`guvPosten`. In den sechs laufenden Ständen, Chris' eigenem
 * `swnjlk` eingeschlossen, blieb die GuV-Spalte im Saisonstand deshalb dauerhaft LEER — während das
 * Team-Profil daneben eine eigene, unvollständige Zahl zeigte. Der Riegel schützte also nicht vor
 * einer falschen Zahl, er verhinderte die richtige.
 *
 * WAS EINE GuV MITTEN IN DER SAISON IST, und warum sie trotzdem hingehört: eine Hochrechnung. Die
 * Posten sagen das selbst — `note` trägt bei Apron und Vorstandszielen den Rang, auf den
 * hochgerechnet wurde. Eine beschriftete Hochrechnung ist besser als eine leere Zelle neben einer
 * unbeschrifteten Hochrechnung anderswo.
 */
export function zieheSaisonstandGuvNach(gameState: GameState): StandingsGuvNachbuchungResult {
  const standings = gameState.seasonState.standings ?? {};
  if (Object.keys(standings).length === 0) {
    return { gameState, geaenderteTeams: [] };
  }

  const frisch = resolveSeasonGuvByTeam(gameState);
  const geaenderteTeams: string[] = [];
  const naechsteStandings: Record<string, StandingRecord> = {};

  for (const [teamId, standing] of Object.entries(standings)) {
    const neu = frisch.get(teamId) ?? null;
    if (neu == null) {
      naechsteStandings[teamId] = standing;
      continue;
    }
    if (standing.guv === neu.guv && postenGleich(standing.guvPosten, neu.posten)) {
      naechsteStandings[teamId] = standing;
      continue;
    }
    naechsteStandings[teamId] = { ...standing, guv: neu.guv, guvPosten: neu.posten };
    geaenderteTeams.push(teamId);
  }

  if (geaenderteTeams.length === 0) {
    return { gameState, geaenderteTeams: [] };
  }

  return {
    gameState: { ...gameState, seasonState: { ...gameState.seasonState, standings: naechsteStandings } },
    geaenderteTeams,
  };
}

/**
 * DASSELBE NACHZIEHEN, ABER NUR IM SAISONENDE-FENSTER — der Haken für die laufenden Buchungen.
 *
 * GEMELDET VON CHRIS: „Die GuV im Saisonstand und die im Finanzen-Reiter weichen voneinander ab!
 * […] die zuletzt bearbeitete müsste die korrekte sein - die sollen nicht unterschiedlich sein."
 *
 * `zieheSaisonstandGuvNach` lief bis hierher NUR am Saisonende (`season-completion-service`,
 * `season-end-tail-settlement`). Danach handelt man aber weiter: verkaufen, verlängern, auflösen
 * sind im ganzen Saisonende-Fenster offen (`SEASON_END_ROSTER_PHASES`), und jede dieser Buchungen
 * verschiebt Gehälter und damit die GuV. Die gespeicherte Zeile veraltete ab da wieder — während
 * der Saisonstand live rechnet und sofort die neue Zahl zeigte.
 *
 * Am Live-Abbild ist das exakt sichtbar: im gemeldeten Save (`hwz8fk`, `season_end_management`)
 * weicht GENAU EIN Team ab — S-C, das von Chris geführte. Die 31 KI-Teams, die dort nicht
 * gehandelt haben, stimmen. Im abgeschlossenen `1hf25q` sind es 32 von 32, weil dieser Stand die
 * Nachbuchung noch gar nicht gesehen hat.
 *
 * WARUM NICHT BEIM LESEN NEU RECHNEN — gemessen, nicht vermutet: `resolveSeasonGuvByTeam` kostet
 * auf einem warmen Spielstand rund 85 ms für 32 Teams, auf einem FRISCHEN beim ersten Aufruf 334
 * Sekunden (die Sponsor-Angebote entstehen dabei erstmalig). In den Tabellenaufbau gehört das
 * nicht; ein erster Versuch dort trieb `analytics-live-fortschritt` von 17,58 s über 180 s.
 * Einmal je Buchung ist dagegen bezahlbar — auf den echten Saisonende-Ständen 40 bis 140 ms.
 *
 * NUR NOCH EIN RIEGEL MACHT DEN AUFRUF ANDERNORTS ZUM NICHTSTUN: die Phase. Außerhalb des
 * Saisonende-Fensters kehrt diese Funktion sofort um.
 *
 * Der zweite Riegel ist weg. Er lautete: „`zieheSaisonstandGuvNach` selbst lässt Teams ohne
 * gespeicherte Postenliste unberührt. Die Liste entsteht erst bei der Saisonende-Buchung; wo sie
 * fehlt, gab es diese Buchung nicht." Genau der hielt die GuV-Spalte in jedem laufenden Spielstand
 * leer — siehe den Kopfkommentar von `zieheSaisonstandGuvNach`. Für die laufende Saison hängt die
 * Ableitung jetzt an `zieheSaisonstandGuvNachSpieltag`.
 *
 * IDEMPOTENT wie die zugrunde liegende Funktion: zweimal laufen ändert nichts.
 */
export function zieheSaisonstandGuvNachImSaisonendfenster(gameState: GameState): GameState {
  if (!isSeasonEndRosterPhase(gameState)) {
    return gameState;
  }
  try {
    return zieheSaisonstandGuvNach(gameState).gameState;
  } catch {
    // Eine Buchung darf an der Nachbuchung nicht scheitern. Schlaegt die Ableitung auf einem
    // unvollstaendigen Stand fehl, bleibt die gespeicherte Zeile stehen — wie bisher.
    return gameState;
  }
}

/**
 * DASSELBE NACHZIEHEN, ABER NACH JEDER SPIELTAGS-BUCHUNG — ohne Phasen-Riegel.
 *
 * Chris am 23.08.: „ja bau die drei hovers so und die guv nachbuchung auch." Der Anlass war, dass
 * die GuV-Spalte im Saisonstand in seinem laufenden Spielstand LEER ist, weil `guv`/`guvPosten` dort
 * nie geschrieben wurden — die gab es bisher erst am Saisonende.
 *
 * WARUM AN DIESER STELLE UND NICHT BEIM LESEN: `resolveSeasonGuvByTeam` an den sieben Live-Ständen
 * gemessen — erster Aufruf 0,6 bis 1,4 Sekunden für 32 Teams, danach 17 bis 67 ms. Einmal je
 * Spieltag ist das bezahlbar; im Tabellenaufbau wäre es das nicht, und ein früherer Versuch dort
 * trieb `analytics-live-fortschritt` von 17,6 s über 180 s. (Der Kopfkommentar oben nennt 334
 * Sekunden — die galten für einen FRISCHEN Spielstand, in dem die Sponsor-Angebote erstmalig
 * entstehen, nicht für einen laufenden.)
 *
 * Der Spieltags-Haken ist derselbe Punkt, an dem `zieheSaisonstandPunkteNach` schon hängt: einmal je
 * Spieltag, nicht einmal je Klick.
 *
 * IDEMPOTENT und ausfallsicher wie die Saisonende-Variante: schlägt die Ableitung auf einem
 * unvollständigen Stand fehl, bleibt die gespeicherte Zeile stehen. Eine Spieltags-Buchung darf an
 * der Nachbuchung nicht scheitern.
 */
export function zieheSaisonstandGuvNachSpieltag(gameState: GameState): GameState {
  try {
    return zieheSaisonstandGuvNach(gameState).gameState;
  } catch {
    return gameState;
  }
}

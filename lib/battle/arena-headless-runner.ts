import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";

import { buildArenaTeam, type ArenaSpieler } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import {
  buildArenaAufstellung,
  buildArenaAufstellungBeide,
  type ArenaAufstellung,
} from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { seedZuZahl } from "@/lib/battle/arena-seed";

/**
 * HEADLESS-RUNNER FUER window.__arena.spieleFeldspiel() (Plan Abschnitt 3.4, PR 6 von 9).
 *
 * WARUM PLAYWRIGHT UEBERHAUPT: die Arena-Engine (public/mockups/battle-mode.engine.js) ist
 * untrennbar an DOM/Canvas gekoppelt (`new Image()`, `document.createElement("canvas")` schon
 * beim Modul-Laden, s. Plan Fund 5) — ein reiner Node-Import scheitert an
 * "document is not defined", bevor ueberhaupt simuliert wird. Echter Chromium ist deshalb der
 * einzige heute verfuegbare Weg, denselben Simulationskern serverseitig aufzurufen, den PR 5
 * ueber `window.__arena.spieleFeldspiel(fd, saat)` freigelegt hat.
 *
 * ARCHITEKTUR-ENTSCHEIDUNG (Plan Abschnitt 3.4 vs. 5.4 — HIER ENTSCHIEDEN, nicht mehr offen):
 * Der urspruengliche Plan-Entwurf (Abschnitt 3.4) schlug einen dauerhaft warmgehaltenen
 * Browser-Singleton vor (ein `Browser`-Objekt ueber die Lebensdauer des Node-Prozesses). Chris
 * tendierte selbst dazu ("davon habe ich keine Ahnung", bat aber um eine zweite Meinung),
 * Fables Gegen-Empfehlung (Abschnitt 5.4) argumentiert klar fuer ON-DEMAND und wird hier
 * umgesetzt:
 *   - Der Matchday-Resolve laeuft automatisch im Hintergrund (kein Nutzer wartet live davor,
 *     s. das bereits etablierte `kickoffLeagueSetupDraft()`-Muster) — ob er 5 oder 20 Sekunden
 *     braucht, ist irrelevant fuer die UX.
 *   - Ein dauerhaft idler Chromium kostet 200-400 MB RAM rund um die Uhr auf einem Server, der
 *     bereits App + SQLite + Crons traegt, und ist selbst das instabilste Stueck Software dort
 *     (Memory-Leaks, Zombie-Prozesse) — braucht eigene Health-Checks/Neustart-Logik.
 *   - "Prozess existiert nicht" ist der robusteste Ruhezustand.
 * Diese Datei startet also PRO AUFRUF (bzw. pro Batch von Fixtures) einen frischen Browser und
 * schliesst ihn danach hart in einem `finally`-Block, auch bei Fehlern — KEIN modulweiter
 * Singleton, der ueber Aufrufe hinweg warmgehalten wird. Das ist bewusst eine EMPFEHLUNG
 * (Fables, gegen Chris' anfaengliches Bauchgefuehl), keine bereits von Chris abgenommene
 * Entscheidung — siehe PR-Beschreibung. Der Umstieg auf "dauerhaft warm" waere spaeter eine
 * reine Lifecycle-Aenderung an `runArenaFixtures()` (Browser-Erzeugung/-Schliessung nach aussen
 * verlagern), kein struktureller Umbau.
 *
 * BATCHING INNERHALB EINES page.evaluate()-AUFRUFS (Plan Abschnitt 3.4, "nicht 8 einzelne
 * evaluate()-Aufrufe"): die Engine haelt ihren Kader (SQUAD/OPP) als modulinternen Zustand,
 * eingelesen genau EINMAL beim Laden aus `window.__olyArenaKader` (s.
 * battle-mode.engine.js, "BRUECKE ZUR ECHTEN APP") — es gibt keinen exponierten Weg, SQUAD/OPP
 * nach dem Laden von aussen auszutauschen. Fuer mehrere FIXTURES MIT UNTERSCHIEDLICHEN ECHTEN
 * KADERN in einem einzigen Seitenaufruf uebernimmt der Browser-seitige Code deshalb GENAU DAS
 * MUSTER, das `FoundationBattleArenaHost.tsx` fuer einen Team-Wechsel im interaktiven Host
 * bereits einsetzt (nicht neu erfunden): `window.__olyArenaKader` frisch setzen, die alte
 * `window.__arena`-Instanz verwerfen, ein neues `<script src="battle-mode.engine.js">`
 * einhaengen und auf das Fertig-Signal (`window.__arena` erscheint) warten. Das laeuft
 * vollstaendig BROWSERSEITIG in einer Schleife innerhalb EINES `page.evaluate()`-Aufrufs ab —
 * amortisiert den IPC-Overhead zwischen Node und Chromium ueber alle Fixtures eines Batches,
 * genau wie im Plan gefordert. Die ERSTE Aufstellung wird bereits VOR der Navigation per
 * `page.addInitScript()` gesetzt (Plan Abschnitt 3.3b) — die normale, erste Skript-Ausfuehrung
 * beim Seitenaufbau uebernimmt dafuer den ersten Fixture-Durchlauf, ohne ihn zusaetzlich im
 * Browser-Loop neu einzuhaengen.
 */

const STANDARD_CHROMIUM_EXECUTABLE_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/**
 * TIMEOUT-BUDGET AUS DER MESSUNG ABLEITEN, NICHT RATEN (Opus-Auflage, Plan Abschnitt 9 Punkt 1).
 * Deckt NUR das Warten auf `window.__arena` ab — einmal beim Seitenaufbau, dann je weiterem
 * Fixture nach dem Neu-Einhaengen des Motors (s. `wartenAufMotor()` in
 * `simuliereFixturesImBrowser()` unten). Die eigentliche Simulation (`spieleFeldspiel()`/...) ist
 * SYNCHRONER Browser-JS ohne eigenes Timeout -- dieser Wert begrenzt also "startet/laedt der Motor
 * ueberhaupt", nicht "wie lange darf das ganze Batch dauern". Per ENV konfigurierbar, damit die
 * echte CX23-Zahl aus der Live-Abnahme (Plan Abschnitt 6.3) ohne Deploy-Wartezeit eingetragen
 * werden kann, bevor sie im Code als neuer Standard landet.
 */
const STANDARD_SEITEN_TIMEOUT_MS = (() => {
  const raw = process.env.OLY_ARENA_SEITEN_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20_000;
})();

/**
 * OPUS-REVIEW B2 (kritisch): GESAMT-TIMEOUT fuer den ganzen Lauf, nicht nur fuer das Warten auf
 * `window.__arena` (`STANDARD_SEITEN_TIMEOUT_MS` deckt wie oben dokumentiert NUR das Laden/
 * Neueinhaengen des Motors ab, NICHT das synchrone `spieleFeldspiel()`/... selbst, das danach ohne
 * jedes eigene Timeout rechnet). Haengt eine Simulation (Motor-Bug, Endlosschleife im Rezept),
 * blieb das zugehoerige Promise in `runArenaFixtures()` fuer immer offen -- und mit ihm der globale
 * Chromium-Semaphor (`arena-vorlauf-service.ts`), der JEDEN weiteren Vorlauf ALLER Saves blockiert,
 * nicht nur den haengenden. Das Gesamt-Budget ist deshalb grosszuegig (Plan 3.1 nennt es explizit
 * "Gesamt-Timeout"), per ENV konfigurierbar, bis die echte CX23-Messung (Plan 6.3) eine engere Zahl
 * liefert -- 180s deckt selbst eine Liga mit 16 Fixtures bei einem Vielfachen der lokal gemessenen
 * 10-18s je Disziplin (beide Ligen) komfortabel ab.
 */
const STANDARD_GESAMT_TIMEOUT_MS = (() => {
  const raw = process.env.OLY_ARENA_GESAMT_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180_000;
})();

/**
 * FUND (nachgemessen, nicht vermutet): `spieleFeldspiel(fd, saat)` reicht `saat` unveraendert an
 * den internen PRNG durch (`seed=(seed*1664525+1013904223)>>>0`, battle-mode.engine.js Z. 7646).
 * Das ist eine Linear-Congruential-Formel, die einen NUMERISCHEN Startwert braucht. Ein
 * nicht-numerischer STRING (z.B. das im Plan Abschnitt 3.3c vorgeschlagene Seed-Schema
 * `${saveId}:${seasonId}:${matchdayId}:arena:${homeTeamId}:${awayTeamId}`) macht `seed*1664525`
 * zu `NaN`, und `NaN>>>0` ist `0` -- JEDER nicht-numerische String-Seed kollabiert also auf
 * denselben internen Startwert 0 und liefert BITGENAU DASSELBE Ergebnis, unabhaengig vom
 * eigentlichen Seed-Text. Nachgemessen: `"seed-eins"` und `"seed-zwei"` ergeben beide `0`.
 *
 * Das ist kein Fehler in diesem Runner, sondern eine Eigenschaft von PR 5's `saat`-Parameter,
 * die PR 7 (Seed-Schema aus Abschnitt 3.3c) sonst still ausgehebelt haette -- deshalb hier
 * geloest, nicht dort wiederholt. `runArenaFixtures()` nimmt weiterhin `string | number` als
 * Seed entgegen (passend zum geplanten Schema), haesht einen String-Seed aber VOR der Uebergabe
 * an `spieleFeldspiel()` deterministisch auf eine 32-Bit-Zahl (FNV-1a -- einfach, stabil,
 * unabhaengig von Laufzeit-/Node-Versionsdetails). Ein bereits numerischer Seed (wie in
 * scripts/miss-arena-spielefeldspiel.mjs, PR 5s eigener Abnahme) bleibt unveraendert
 * durchgereicht.
 *
 * A3-NACHTRAG (docs/pm-briefings/opus-synthese-echtzeit-vs-rundenbasiert-19-09.md 5.3): die
 * Hash-Funktion selbst (`seedZuZahl()`) wohnt seitdem in `lib/battle/arena-seed.ts` -- byte-
 * identisch hierher verschoben, nicht neu geschrieben -- damit `FoundationBattleArenaHost.tsx`
 * (Client-Bundle) sie importieren kann, ohne die Playwright-/`node:fs`-Importe dieser Datei
 * mitzuziehen. Dieser Runner importiert sie von dort zurueck (s. Datei-Kopf-Import), statt eine
 * eigene Kopie zu behalten -- EINE Funktion, zwei Aufrufer, s. dortiger Kommentar.
 */
/**
 * BUEHNEN-DUELL-CHASSIS (Gewichtheben-Produktivierung, S6, docs/design/
 * gewichtheben-produktivierung.md): `window.__arena.spieleFeldspiel()` kennt nur
 * `FELDSPIEL_ART`-Disziplinen (Ballbesitz-Feldspiel, aktuell Basketball) -- es liefert fuer jede
 * andere Disziplin bereits heute `null`, nie einen falschen Wert, weil es `FELDSPIEL_ART[fd]`
 * selbst prueft. Gewichtheben laeuft ueber ein STRUKTURELL ANDERES Chassis (Buehnen-Duelle je
 * Slot, s. `baueHebenDuelle()` in battle-mode.engine.js) und braucht deshalb den eigenen
 * Einstiegspunkt `spieleBuehneHeben()`.
 *
 * NUR DIESE MENGE ENTSCHEIDET, WELCHE BROWSER-FUNKTION AUFGERUFEN WIRD -- keine
 * If/Else-Kette auf einzelne Disziplins-IDs. Eine kuenftige Disziplin mit demselben
 * Buehnen-Duell-Chassis (keine ist aktuell geplant) braucht hier nur einen weiteren Eintrag,
 * keine neue Verzweigung. Bewusst GETRENNT von `ARENA_RESOLVED_DISCIPLINE_IDS`
 * (battle-mode-arena-team-points.ts): jene Menge sagt "wird ueberhaupt arena-aufgeloest", diese
 * hier sagt "mit welchem Chassis" -- zwei unabhaengige Fragen (eine dritte Feldspiel-Disziplin
 * koennte arena-aufgeloest werden, ohne dieses Chassis zu brauchen, und umgekehrt).
 */
export const ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["gewichtheben"]);

/**
 * PRODUKTIVIERUNGSWELLE 1 (docs/design/speed-schach-showcase-produktivierung.md, 06.09.):
 * zweite Buehnen-Chassis-Menge, GENAU DASSELBE Muster wie `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`
 * direkt darueber -- nur fuer `BUEHNE_ART[d].duell` statt `.heben` (`window.__arena.
 * spieleBuehneDuell()`, battle-mode.engine.js). Speed-Schach war der erste Eintrag; I-Spy
 * (ebenfalls `duell:true` im Motor) war NICHT enthalten -- kein Auftrag dafuer in jener
 * Welle, s. PM-Briefing 06.09. Abschnitt 4 (nur Speed-Schach/Staffel/Showcase bestanden UND
 * beauftragt).
 *
 * PRODUKTIVIERUNGSWELLE 2 (docs/pm-briefings/opus-overseer-plan-naechste-disziplinen-09-09.md,
 * 09.09.): TENNIS und FECHTEN kommen hinzu -- beide tragen `duell:true` in `BUEHNE_ART`
 * (battle-mode.engine.js, nachgesehen an den Zeilen `label:"Tennis"`/`label:"Fechten"`), beide
 * haben die Rangtreue-Schranke kaderfest bestanden (0,825 bzw. 0,816, s. PM-Briefing
 * Abschnitt 2) und beide brauchen deshalb GENAU DAS BESTEHENDE Duell-Chassis -- kein Byte neuer
 * Motor-Code, exakt der "nur ein weiterer Eintrag"-Fall, den der Kommentar oben vorhersagt.
 *
 * I-SPY GEHOERT NICHT (MEHR) IN DIESE MENGE: der Absatz, der hier stand ("traegt ebenfalls
 * `duell:true`, rho 0,684"), ist seit dem Schatzsuche-Umbau (21.09.) doppelt ueberholt —
 * `BUEHNE_ART["i-spy"]` traegt `schatzsuche:true` statt `duell:true`, und `spieleBuehneDuell()`
 * liefert dafuer `null`. Seit der Kalibrierrunde 3 (27.10., Task #197) laeuft I-Spy ueber
 * `ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS` (s. dort).
 */
export const ARENA_BUEHNE_DUELL_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
  "speed-schach",
  "tennis",
  "fechten",
]);

/**
 * DRITTE BUeHNEN-CHASSIS-MENGE (Produktivierungswelle 1): fuer die sechs "Auftritt"-Buehnen
 * (`BUEHNE_ART[d]` ohne `.heben` UND ohne `.duell`) -- Showcase war der erste Eintrag.
 * `window.__arena.spieleBuehneAuftritt()` liest denselben summenbasierten Seitenstand, den
 * `updateHudBuehne()`s eigener Nicht-Heben-Nicht-Duell-Zweig bereits live anzeigt.
 *
 * PRODUKTIVIERUNGSWELLE 2 (s. Kommentar bei `ARENA_BUEHNE_DUELL_DISCIPLINE_IDS`):
 * EISKUNSTLAUF, BREAKING und WETTESSEN kommen hinzu -- alle drei ohne `.heben`/`.duell` in
 * `BUEHNE_ART` (nachgesehen), alle drei kaderfest ueber der Schranke (0,875 / 0,869 / 0,845).
 *
 * EISKUNSTLAUFS `duett:true` IST KEIN CHASSIS-FLAG (nachgesehen, nicht angenommen): es steuert
 * in `bauBuehne()` die automatische Paarung bei gerader Feldgroesse (PR #859) und laesst den
 * Auftritts-Charakter der Wertung unberuehrt -- `BUEHNE_ART.eiskunstlauf` traegt weder `.heben`
 * noch `.duell`, `spieleBuehneAuftritt()` ist damit der richtige und einzige Einstiegspunkt.
 * Die Namensaehnlichkeit `duett`/`duell` ist die eine Falle dieser Welle; sie ist hier
 * ausdruecklich benannt, damit ein kuenftiger Leser sie nicht fuer einen Copy-Paste-Fehler haelt.
 *
 * BREAKING WIEDER RAUS (22.09., Gauntlet-Umbau): `BUEHNE_ART.breaking` traegt jetzt
 * `gauntlet:true` (Chris' Vorgabe -- Slot 1 gegen Slot 1, der Sieger bleibt mit seinem
 * aktuellen HP-Stand im Ring, s. `public/mockups/battle-mode.engine.js`). Eine Summenwertung
 * (was `spieleBuehneAuftritt()` liefert) bildet "wer uebrig bleibt scored einen Punkt" nicht
 * ab -- ein Team koennte mit weniger Ueberlebenden trotzdem die hoehere Punktsumme haben.
 * Breaking laeuft deshalb ab hier ueber `ARENA_BUEHNE_GAUNTLET_DISCIPLINE_IDS`/
 * `spieleBuehneGauntlet()` (s.u.), das einzige Chassis, das ueber ein `.gauntlet`-Flag geht.
 *
 * I-SPY DAZU (27.10., Task #197, docs/design/organisch-tdm-battlefield-ispy-27-10.md): die
 * Schatzsuche (`BUEHNE_ART["i-spy"].schatzsuche`) traegt weder `.heben` noch `.duell` noch
 * `.gauntlet` — `spieleBuehneAuftritt()` ist laut Motor-Kommentar dort ausdruecklich auch ihr
 * Einstiegspunkt ("Schatzsuche laeuft technisch ueber spieleBuehneAuftritt()"). Der Seitenstand
 * ist die Summe der eigenen Fundpunkte (`u.summe`), dieselbe Zahl, die die Buehne live zeigt.
 * Seit der Kalibrierrunde 3 besteht I-Spy beide Pflichtkriterien (rho 0,817/0,811, Pp 14,6/15,0).
 */
export const ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
  "showcase",
  "eiskunstlauf",
  "wettessen",
  "i-spy",
]);

/**
 * FUENFTE BUeHNEN-CHASSIS-MENGE (22.09., Gauntlet-Umbau): fuer `BUEHNE_ART[d].gauntlet` --
 * bisher nur Breaking. `window.__arena.spieleBuehneGauntlet()` liest den Seitenstand als
 * Ueberlebenden-Zaehlung (`u.raus`), nicht als Punktsumme oder Duell-/Brettzaehlung -- ein
 * eigenes, viertes Muster neben Heben/Duell/Auftritt, s. Kommentar am Motor-Einstiegspunkt
 * selbst (battle-mode.engine.js) fuer die volle Herleitung.
 */
export const ARENA_BUEHNE_GAUNTLET_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
  "breaking",
]);

/**
 * VIERTE CHASSIS-MENGE, UND DAS ERSTE MAL FUER EIN GANZES CHASSIS STATT EINER BUEHNEN-
 * UNTERART (docs/pm-briefings/opus-plan-feinschliff-vier-disziplinen-09-10.md, Abschnitt 6.1/
 * 6.3a): die BAHN (`BAHN_ART`-Disziplinen, `window.__arena.spieleBahn()`) teilt mit der Buehne
 * keine einzige Zustandsvariable (LAEUFER statt TEILNEHMER, stepSpurt statt stepBuehne) --
 * deshalb eine eigene Menge und eine eigene Browser-Funktion, kein Eintrag in einer der drei
 * Buehnen-Mengen oben.
 *
 * VIER DER VIER BAHNEN BESTANDEN: Staffel (rho 0,915), Takeshi's Castle (0,861),
 * Time-Trial (0,828), SPURT (0,894, s.u.) -- der Dispatch ist fuer alle Bahn-Disziplinen
 * identisch (`MOTOREN[bd]` wird fuer jede `BAHN_ART`-Disziplin in derselben Schleife
 * registriert). CLIMBING BLEIBT AUSSEN VOR: rho 0,790 je Spiel, 0,010 unter der
 * 0,80-Schranke -- dieselbe Regel, die I-Spy (0,684) aus `ARENA_BUEHNE_DUELL_DISCIPLINE_IDS`
 * draussen haelt, obwohl es technisch nur eine Zeile waere.
 *
 * SPURT JETZT ENTHALTEN (Produktionsanbindung 14.09., loest Opus-Review PR #881 Fund F1
 * auf): der Fund war real -- `BAHN_ART.spurt.jeSeite` war 4, waehrend die Saison fuer JEDE
 * Disziplin gleichverteilt 2..6 Laeufer je Seite wuerfelt
 * (`buildSeasonPlayerCountByDiscipline()`, season-discipline-schedule.ts) -- die einzige der
 * vier Bahnen, bei der Motor-Feldgroesse und Saison-Maximalfeldgroesse auseinanderfielen.
 * Gegen den echten Spielstand gemessen (`runArenaFixtures()`, 32 Teams, 64 Fixtures) fuehrte
 * das in ALLEN 64 Fixtures zu einem Boxscore mit zu wenigen Eintraegen (512 statt 768) UND in
 * 4 von 64 Fixtures zu einem Team, das seine Aufstellung gar nicht angewendet bekam (4 gegen 2
 * statt 4 gegen 4).
 *
 * DER FIX (public/mockups/battle-mode.engine.js, `BAHN_ART.spurt`): `jeSeite` 4 -> 6, dieselbe
 * Feldgroesse wie die anderen drei Bahnen, plus die zwei Slots (drivephase/photofinish), die
 * `lib/lineups/matchday-slot-roles.ts` fuer Spurt bereits fuehrte (`scripts/
 * generiere-arena-daten.ts` zieht sie jetzt mit, s. dortige `SLOT_ZAHL_UEBERSCHREIBUNG`).
 * Kaderfest (n=24) gemessen: rho/Spiel 0,894 (Spannweite 0,138, Saison 0,916) bei jeSeite 6 --
 * BESSER als vorher bei jeSeite 4 (0,871/0,236/0,905), s. docs/design/
 * spurt-offene-fragen-plus-optik-plan-05-09.md Abschnitt 3.3 fuer die Vorabmessung. Die PPS-
 * Referenz (`data/generated/spurt-pps-referenz.json`) wurde mit dem reparierten Motor neu
 * gezogen -- die alte Datei war bei n=4..6 auf denselben 512 Boxscore-Eintraegen je 64
 * Fixtures eingefroren, s. deren `hinweis`-Feld vor dieser PR.
 */
export const ARENA_BAHN_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
  "staffel",
  "takeshis-castle",
  "time-trial",
  "spurt",
  // CLIMBING-KALIBRIERUNG (16.09., docs/design/climbing-kalibrierung-16-09.md): fuenfte und
  // letzte Bahn-Disziplin. Bestand die Rangtreue-Schranke bis hierhin nicht (rho 0,782 je
  // Spiel kaderfest, s. Kommentar an `ARENA_RESOLVED_DISCIPLINE_IDS` in
  // battle-mode-arena-team-points.ts) und stand deshalb bewusst draussen; die eigene
  // Rezeptkalibrierung (BAHN_ART.climbing.rezept.STEHEN) hebt sie auf 0,834.
  "climbing",
]);

export type ArenaFixtureInput = {
  homeTeamId: string;
  awayTeamId: string;
  /** Deterministischer Seed, s. Plan Abschnitt 3.3c: `${saveId}:${seasonId}:${matchdayId}:arena:${homeTeamId}:${awayTeamId}`. */
  seed: string | number;
};

export type ArenaFixtureBoxscoreEintrag = {
  name: string;
  wert: number;
  /**
   * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): die echte Spieler-ID, sofern `name`
   * eindeutig einem Kadermitglied aus HEIM ODER GAST dieses Duells zugeordnet werden konnte.
   * `null` bei Namens-Kollision (zwei Spieler desselben Duells mit identischem Namen — der Motor
   * selbst fuehrt Boxscore-Werte NUR nach Namen, s. `battle-mode.engine.js`
   * `wert:()=>{...o[u.n]=...}`, ein kollidierender Name ueberschreibt dort bereits den Wert des
   * anderen Spielers) oder wenn der Name in keinem der beiden geladenen Kader auftaucht. Ein
   * Aufrufer, der `playerId` fuer eine Zuordnung braucht, MUSS mit `null` umgehen, statt zu raten
   * (s. `battle-mode-arena-team-points.ts`, das bei `null` fuer das GANZE Duell auf den
   * PPS-Pfad zurueckfaellt).
   */
  playerId: string | null;
  /** Welche Seite `playerId` gehoert — nur gesetzt, wenn `playerId` gesetzt ist. */
  side: "home" | "away" | null;
  /**
   * TORWART-KENNZEICHNUNG (Hockey-Produktivierung, docs/design/hockey-produktivierung.md):
   * direktes Passthrough von `window.__arena.spieleFeldspiel()`s `torwart`-Feld (s.
   * battle-mode.engine.js), das seinerseits nur fuer Hockey je `true` wird
   * (`bestimmeTorwaerter()` setzt `u.torwart` ausserhalb von Hockey nie). Fuer jede andere
   * Feldspiel-Disziplin (Basketball, Football, ...) bleibt dieses Feld `false` -- unveraendertes
   * Verhalten dort. Grund: Hockeys Torwart hat eine strukturell andere Wertverteilung als seine
   * Feldspieler (gemessen, s. scripts/ziehe-hockey-pps-referenz.ts), `battle-mode-arena-team-
   * points.ts` braucht dieses Feld, um beide Rollen getrennt gegen ihre je eigene PPS-Referenz zu
   * normieren. Optional (statt `boolean`), damit bestehende Test-Fixtures ohne dieses Feld
   * (Basketball/Gewichtheben, vor dieser Aenderung geschrieben) unveraendert kompilieren --
   * `undefined` bedeutet dasselbe wie `false` fuer jeden Aufrufer, der dieses Feld liest.
   */
  torwart?: boolean;
};

/**
 * "SPIEL DES TAGES" — DREI MOMENTE (Task #31 Paket 1, docs/design/fable-ideen-feldspiel-30-09.md
 * Abschnitt 2.1, Klasse A): direktes Passthrough von `window.__arena.spieleFeldspiel()`s neuem
 * `momente`-Feld (s. `berechneFeldspielMomente()`, battle-mode.engine.js) — reine Nachlese aus dem
 * Ereignisprotokoll des bereits gelaufenen Fixtures, kein neuer `rr()`-Wurf. `teamId` ersetzt hier
 * das rohe `seite` (0/1) des Motors, aufgeloest ueber `fixture.homeTeamId`/`awayTeamId` -- derselbe
 * Grund, aus dem `ArenaFixtureBoxscoreEintrag.side` schon "home"/"away" statt 0/1 traegt. `null` nur
 * dann, wenn der Motor fuer diesen Moment keinen Spieler nennen konnte (sollte an einem echten
 * Fixture nicht vorkommen, s. Motor-Kommentar). NUR fuer das Feldspiel-Chassis gesetzt -- jedes
 * andere Chassis (Buehne/Bahn) liefert dieses Feld nie, weil nur `spieleFeldspiel()` es befuellt.
 */
export type ArenaMomentEintrag = {
  typ: "fuehrungswechsel" | "fuehrungswechselEntscheidend" | "entscheidend" | "turnover";
  teamId: string | null;
  spieler: string | null;
};

export type ArenaFixtureResult = {
  homeTeamId: string;
  awayTeamId: string;
  /** Punktestand [heim, gast] — direkt aus `spieleFeldspiel()`/`spieleBuehneHeben()`s `seiten`-Feld. */
  seiten: [number, number];
  boxscore: ArenaFixtureBoxscoreEintrag[];
  /**
   * NUR fuer das Buehnen-Duell-Chassis gesetzt (s. `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`): die
   * kumulierte Zweikampf-Kilogrammsumme je Seite [heim, gast] -- Grundlage fuer den Gesamt-kg-
   * Tiebreak bei einem Duellgleichstand (Fable-Empfehlung 9.1, battle-mode-arena-team-points.ts).
   * `undefined` fuer jedes Feldspiel-Chassis (Basketball) — unveraendertes Verhalten dort.
   */
  gesamtKg?: [number, number];
  /** S. `ArenaMomentEintrag` — nur fuer das Feldspiel-Chassis gesetzt, sonst `undefined`. */
  momente?: ArenaMomentEintrag[];
};

/**
 * Ordnet jeden Boxscore-Namen genau einem Spieler zu — NUR, wenn der Name in GENAU EINEM der
 * beiden geladenen Kader (HEIM+GAST zusammen) genau einmal vorkommt. Zwei Spieler mit
 * identischem Namen im selben Duell (theoretisch moeglich, s. `player-generator-service.ts`,
 * das keine Eindeutigkeit erzwingt; nachgemessen an einem echten `live-save`-Abbild kam das nicht
 * vor, s. docs/design/boxscore-an-pps.md) werden ABSICHTLICH auf `null` abgebildet, statt zu
 * raten, wer von beiden gemeint ist.
 */
function baueEindeutigeNamenZuordnung(
  heim: ArenaSpieler[],
  gast: ArenaSpieler[],
): Map<string, { playerId: string; side: "home" | "away" }> {
  const vorkommen = new Map<string, number>();
  for (const spieler of [...heim, ...gast]) {
    vorkommen.set(spieler.n, (vorkommen.get(spieler.n) ?? 0) + 1);
  }
  const zuordnung = new Map<string, { playerId: string; side: "home" | "away" }>();
  for (const spieler of heim) {
    if (vorkommen.get(spieler.n) === 1) zuordnung.set(spieler.n, { playerId: spieler.id, side: "home" });
  }
  for (const spieler of gast) {
    if (vorkommen.get(spieler.n) === 1) zuordnung.set(spieler.n, { playerId: spieler.id, side: "away" });
  }
  return zuordnung;
}

export type RunArenaFixturesOptions = {
  /**
   * s. `buildArenaTeam()` in arena-kader-adapter.ts: die kompakte Initial-Payload streift
   * `attributeSheetStats` bei jedem Spieler ausser dem eigenen Team. Wer echte Kaderdaten aus
   * mehreren Teams braucht (jeder Matchday-Resolve), muss die vollstaendigen Boegen hier
   * durchreichen, sonst faellt fast der ganze Kader fremder Teams aus `buildArenaTeam()` raus.
   */
  attributeSheetOverrides?: ReadonlyMap<string, Player["attributeSheetStats"]>;
  /** Override fuer Tests/andere Umgebungen; Default ist der feste Server-Pfad. */
  chromiumExecutablePath?: string;
  /** Wie lange auf `window.__arena` je Fixture gewartet wird, bevor der Lauf abbricht. */
  seitenTimeoutMs?: number;
  /**
   * OPUS-REVIEW B2: GESAMT-Budget fuer den kompletten Lauf (Laden + ALLE Fixtures synchron
   * gerechnet) -- anders als `seitenTimeoutMs` deckt das auch eine haengende Simulation ab, nicht
   * nur das Laden. Ueberschreitung schliesst den Browser hart und wirft, der Aufrufer
   * (`battle-mode-arena-team-points.ts`) fuer Warnungen/`arena-vorlauf-service.ts` fuer `ArenaAusfall`.
   */
  gesamtTimeoutMs?: number;
  /**
   * MUTATOR ORGANISCH (29.09., lib/battle/battle-mutator-organisch.ts): der ECHTE Spieltagswurf
   * dieser Disziplin-Seite (`rollMatchdayMutatorTraitsForSide()`, zwei Traits aus dem 36er-Pool,
   * fuer alle Teams gleich). Er faehrt als `window.__olyArenaKader.mutatoren` in die Engine, die
   * getroffene Spieler daraufhin mit hoeheren Attributen antreten laesst. Weggelassen -> `[]`,
   * also AUSDRUECKLICH kein Mutator — nie der engine-eigene Ersatzwurf: ein Lauf ohne echten Wurf
   * (Referenzziehungen, Tests) soll niemanden zufaellig besser machen.
   */
  mutatoren?: readonly string[];
  /**
   * NACHTKONZEPT-SCHALTER (04.10.): Startwerte fuer `BUEHNE_FLAGS` in battle-mode.engine.js
   * (z. B. `{ wettessenMauer: 2 }`). Faehrt als `window.__olyBuehneFlags` in JEDE neu
   * eingehaengte Engine-Instanz (die Engine wird je Fixture neu geladen, ein nachtraeglich
   * gesetzter Schalter ginge verloren). Nur fuer Messungen/Referenzziehungen wie
   * scripts/ziehe-buehne-pps-referenz.ts --flags=...; weggelassen -> Engine-Standard.
   */
  buehneFlags?: Readonly<Record<string, number>>;
};

export type VorbereitetesFixture = {
  homeTeamId: string;
  awayTeamId: string;
  /** Bereits durch `seedZuZahl()` normalisiert -- das ist der Wert, der an `spieleFeldspiel()` geht. */
  seed: number;
  heim: ArenaSpieler[];
  gast: ArenaSpieler[];
  /**
   * Die Aufstellung beider Seiten, Spielername -> {d, slot}. Leer, wenn fuer den Spieltag
   * kein Entwurf vorliegt — dann faellt der Motor auf seine Reihum-Vergabe zurueck und
   * verhaelt sich wie vor dieser Aenderung.
   */
  aufstellung: ArenaAufstellung;
};

/**
 * NETZWERK-ABRIEGELUNG (PPS-Skalierung, 03.09., gefunden beim Bau von
 * scripts/ziehe-basketball-pps-referenz.ts): diese Datei simuliert rein rechnerisch (Canvas/DOM
 * nur als Motor-Abhaengigkeit, s. Kopfkommentar), sie braucht KEIN einziges echtes
 * Netzwerk-Request. Chromium selbst versucht trotzdem welche (Google-Hintergrunddienste beim
 * Start, plus `battle-mode.html`s Google-Fonts-Stylesheet) -- in einer Umgebung mit
 * Proxy-Allowlist (s. CLAUDE.md, "Agenten kommen an den Server NICHT heran") liest Chromium
 * `HTTPS_PROXY` aus der Prozessumgebung und haengt an jedem dieser Requests, bis der jeweilige
 * Chromium-interne Timeout greift -- nachgemessen: ein einzelner `runArenaFixtures()`-Aufruf
 * blieb dadurch wiederholt weit ueber 100 s haengen, obwohl die eigentliche Simulation
 * (20 Fixtures) in Sekunden fertig ist. `--proxy-server=direct://` ignoriert die Umgebungs-
 * `HTTPS_PROXY` (kein Warten auf einen Tunnel, der fuer diese Hosts ohnehin abgelehnt wuerde),
 * `--host-resolver-rules=MAP * 0.0.0.0` laesst jeden Hostnamen sofort auf eine tote Adresse
 * aufloesen (sofortiges ECONNREFUSED statt DNS-/Tunnel-Wartezeit). `file://`-Navigation
 * (die einzige, die dieser Runner macht) ist von beidem unberuehrt.
 */
// DOCKER-/dev-shm-ABSICHERUNG (E1, Plan Abschnitt 4.1/F11): Dockers Standard-`/dev/shm` ist 64 MB,
// bekanntermassen zu knapp fuer Chromium (Crash statt sauberer Fehlermeldung). Das Produktions-
// Compose setzt zusaetzlich `shm_size: "256m"` (doppelte Absicherung, PR E1) -- dieses Flag hier
// greift unabhaengig davon auch lokal/in CI, wo niemand `shm_size` setzt.
//
// RAM-SPARFLAGS (Nachtrag 25.10., PR 1270 "E1"): Chris bleibt beim CX23 (3,8 GB RAM gesamt,
// s. PR-Beschreibung) -- jede Einsparung an der Chromium-Last zaehlt direkt. Echt gemessen im CI-
// Job `arena-image-chromium-probe` (`.github/workflows/ci.yml`, Schritt "RAM-Sparflags messen"),
// nicht geschaetzt -- die konkrete MB-Zahl steht im CI-Log und in der PR-Beschreibung.
//
// `--disable-gpu`: entfernt den separaten GPU-Prozess. Risikofrei fuer diese Seite, weil
// `public/mockups/battle-mode.engine.js` (die einzige Seite, die dieser Runner laedt) KEIN WebGL
// nutzt -- im gesamten Motor kommt der String "webgl" kein einziges Mal vor, jede Canvas-Nutzung
// ist `getContext("2d")` fuer Sprite-/Pixel-Arbeit (teils mit `willReadFrequently:true`, ein
// Hinweis an den Browser, der ohnehin Richtung Software-Rendering zielt). Ohne GPU-Beduerfnis
// kein Funktionsverlust, nur ein Prozess weniger.
//
// `--no-zygote`: entfernt den Zygote-Hilfsprozess (nur fuer schnelles Forken WEITERER
// Renderer-Prozesse gedacht). Dieser Runner oeffnet pro Lauf genau EINEN Browser mit genau EINER
// Page und haengt den Motor zwischen den Fixtures in dieselbe Page neu ein (`haengeMotorNeuEin()`
// unten) -- es wird nie ein zweiter Renderer nachtraeglich geforkt, der Zygote-Prozess ist damit
// toter Ballast.
//
// BEWUSST NICHT dabei: `--single-process`. Chromium/Puppeteer/Playwright stufen dieses Flag
// selbst als Debug-/Testwerkzeug ein, nicht fuer Produktionsbetrieb -- bekannt fuer Haenger/
// Abstuerze gerade in sandboxlosen Containern (hier zusaetzlich sandboxlos, weil Playwright beim
// `channel:"chromium"`-Start ohnehin automatisch `--no-sandbox` anhaengt, s. PR-Beschreibung). Im
// CI-Vergleich lief es zwar durch (`about:blank`, keine echte Last), aber OHNE eine echte
// Mehrfach-Fixture-Lastprobe mit dem tatsaechlichen Canvas-/Pixel-Motor ist das Stabilitaetsrisiko
// nicht seriös einzuschaetzen -- der zusaetzliche RSS-Gewinn gegenueber `--disable-gpu` +
// `--no-zygote` steht im CI-Log, aber als Datenpunkt, nicht als Freigabe.
const ARENA_NETZWERK_ABRIEGELUNG_ARGS = [
  "--proxy-server=direct://",
  "--host-resolver-rules=MAP * 0.0.0.0",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-zygote",
];

/**
 * Exportiert (PR 3, K1): der Chromium-Selbsttest (`lib/battle/arena-chromium-selftest.ts`, Opus-
 * Auflage "`/api/health` darf nicht bei jedem Aufruf Chromium starten") braucht GENAU dieselben
 * Launch-Optionen wie der echte Arena-Lauf — sonst koennte der Selbsttest "ok" melden, waehrend
 * der echte Lauf an einer anderen Pfad-/Argument-Kombination scheitert, oder umgekehrt.
 *
 * REIHENFOLGE DER PFAD-ERMITTLUNG (E1, Plan Abschnitt 4.1): `executablePathOverride` (explizite
 * Test-/Messskript-Injektion) VOR `OLY_ARENA_CHROMIUM_EXECUTABLE` (die Umgebungsvariable, die das
 * Produktions-Image setzt, sobald Chromium dort unter der von Playwright 1.60 erwarteten Revision
 * 1223 statt der hier hartkodierten lokalen 1194 liegt) VOR dem hartkodierten lokalen Standard.
 * Ohne eine der beiden faellt `existsSync()` unten durch und `channel: "chromium"` greift (CI-
 * Runner-Fall, unveraendert).
 */
export function ermittleChromiumLaunchOptions(executablePathOverride?: string) {
  const kandidat = executablePathOverride || process.env.OLY_ARENA_CHROMIUM_EXECUTABLE || STANDARD_CHROMIUM_EXECUTABLE_PATH;
  if (kandidat && existsSync(kandidat)) {
    return { headless: true, executablePath: kandidat, args: ARENA_NETZWERK_ABRIEGELUNG_ARGS };
  }
  // Ohne festen Pfad (z.B. auf dem CI-Runner) loest Playwright den Standard-"chromium"-
  // Browsertyp im Headless-Betrieb seit v1.49 auf die separat installierte "Chromium Headless
  // Shell" auf, nicht auf das normale Chromium-Binary. Der CI-Workflow installiert per
  // `npx playwright install chromium` aber nur Letzteres -- ohne `channel: "chromium"` bricht
  // der Launch hier mit "Executable doesn't exist at .../chromium_headless_shell-.../..." ab,
  // obwohl Chromium selbst vorhanden ist. `channel: "chromium"` erzwingt das normale Binary.
  return { headless: true, channel: "chromium" as const, args: ARENA_NETZWERK_ABRIEGELUNG_ARGS };
}

/**
 * Baut fuer jedes Fixture beide Kader ueber den bestehenden, unveraenderten Adapter
 * (`buildArenaTeam`, Plan Fund 12) — server-seitig, VOR dem Browser-Start, damit der Browser
 * selbst nichts vom App-Datenmodell wissen muss.
 *
 * Ein Fixture, bei dem BEIDE Seiten keinen einzigen einsatzfaehigen Spieler stellen, ist ein
 * Datenfehler (nicht die in Plan 5.3 entschiedene "Unterzahl antreten lassen"-Situation, die
 * NUR eine Seite betrifft) — der Lauf bricht dafuer kontrolliert ab, statt ein 0:0 zwischen
 * zwei leeren Feldern zu erzeugen.
 */
export function bereiteFixturesVor(
  gameState: GameState,
  fixtures: ArenaFixtureInput[],
  attributeSheetOverrides?: ReadonlyMap<string, Player["attributeSheetStats"]>,
): VorbereitetesFixture[] {
  return fixtures.map((fixture) => {
    const heim = buildArenaTeam(gameState, fixture.homeTeamId, attributeSheetOverrides);
    const gast = buildArenaTeam(gameState, fixture.awayTeamId, attributeSheetOverrides);
    // Die Aufstellung des Spieltags wird hier mit vorbereitet, aus demselben Grund wie die
    // Kader: server-seitig, VOR dem Browser-Start. Ohne Entwurf bleibt sie leer.
    const aufstellung = buildArenaAufstellungBeide(
      gameState,
      fixture.homeTeamId,
      fixture.awayTeamId,
      gameState.matchdayState?.matchdayId ?? null,
    );
    if (heim.length === 0 && gast.length === 0) {
      throw new Error(
        `arena-headless-runner: weder ${fixture.homeTeamId} noch ${fixture.awayTeamId} stellen einen einsatzfaehigen Kader (fehlende Attribut-Boegen?).`,
      );
    }
    return { ...fixture, seed: seedZuZahl(fixture.seed), heim, gast, aufstellung };
  });
}

/**
 * Genau das Format, das `window.__arena.spieleFeldspiel()` im Browser roh liefert — OHNE
 * `playerId`/`side` (s. `ArenaFixtureBoxscoreEintrag`): der Motor selbst kennt nur Namen, die
 * Node-seitige Zuordnung auf echte Spieler-IDs passiert ERST NACH dem `page.evaluate()`-Aufruf
 * (s. `baueEindeutigeNamenZuordnung()` im Aufrufer unten). `torwart` fehlt im rohen Objekt ganz,
 * wenn `false` (s. battle-mode.engine.js, `spieleFeldspiel()`) -- deshalb optional hier.
 */
type RoherBrowserBoxscoreEintrag = { name: string; wert: number; torwart?: boolean };
/** Rohform von `ArenaMomentEintrag` vor der `teamId`-Aufloesung (s. dort): `seite` ist hier noch 0/1. */
type RoherBrowserMomentEintrag = { typ: ArenaMomentEintrag["typ"]; seite: 0 | 1; spieler: string | null };
export type RoherBrowserFixtureErgebnis = {
  disziplin: string;
  seiten: [number, number];
  boxscore: RoherBrowserBoxscoreEintrag[];
  gesamtKg?: [number, number];
  /** Nur fuer `spieleFeldspiel()` gesetzt, s. `ArenaMomentEintrag`. */
  momente?: RoherBrowserMomentEintrag[];
};

/**
 * Laeuft im Browser-Kontext (per `page.evaluate()` serialisiert) — darf deshalb nur auf seine
 * Argumente und Browser-globale (`window`, `document`) zugreifen, keine Closures aus Node.
 *
 * Fixture 0 nutzt den bereits ueber `page.addInitScript()` gesetzten Kader und die dadurch
 * beim normalen Seitenaufbau geladene Motor-Instanz unveraendert (kein erneutes Einhaengen).
 * Ab Fixture 1 wird nach dem Muster aus `FoundationBattleArenaHost.tsx` neu eingehaengt: alte
 * `window.__arena`-Instanz verwerfen, `window.__olyArenaKader` auf den naechsten Kader setzen,
 * frisches `<script src="battle-mode.engine.js">` anhaengen, auf `window.__arena` warten.
 */
async function simuliereFixturesImBrowser(payload: {
  // `seed` ist hier bereits eine Zahl -- die Normalisierung nicht-numerischer String-Seeds
  // (s. `seedZuZahl()`-Kommentar oben) passiert VOR dem Sprung in den Browser-Kontext.
  fixtures: {
    heim: ArenaSpieler[];
    gast: ArenaSpieler[];
    seed: number;
    aufstellung: ArenaAufstellung;
  }[];
  disziplin: string;
  /** Der Spieltagswurf, s. `RunArenaFixturesOptions.mutatoren` — fuer jedes Fixture derselbe. */
  mutatoren: string[];
  // Welche Browser-Funktion je Fixture aufgerufen wird -- s. `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`
  // / `ARENA_BUEHNE_DUELL_DISCIPLINE_IDS` / `ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS` /
  // `ARENA_BUEHNE_GAUNTLET_DISCIPLINE_IDS` / `ARENA_BAHN_DISCIPLINE_IDS` oben. NUR diese Weiche
  // entscheidet, keine Disziplins-ID-Kenntnis im Browser-Code selbst.
  chassis: "feldspiel" | "buehneHeben" | "buehneDuell" | "buehneAuftritt" | "buehneGauntlet" | "bahn";
  timeoutMs: number;
}): Promise<Array<RoherBrowserFixtureErgebnis | null>> {
  const fenster = window as unknown as {
    __arena?: {
      spieleFeldspiel: (fd: string, saat: number) => RoherBrowserFixtureErgebnis | null;
      spieleBuehneHeben: (bd: string, saat: number) => RoherBrowserFixtureErgebnis | null;
      spieleBuehneDuell: (bd: string, saat: number) => RoherBrowserFixtureErgebnis | null;
      spieleBuehneAuftritt: (bd: string, saat: number) => RoherBrowserFixtureErgebnis | null;
      spieleBuehneGauntlet: (bd: string, saat: number) => RoherBrowserFixtureErgebnis | null;
      spieleBahn: (bd: string, saat: number) => RoherBrowserFixtureErgebnis | null;
    };
    __olyArenaKader?: unknown;
  };

  const wartenAufMotor = async (frist: number) => {
    const start = Date.now();
    while (typeof fenster.__arena === "undefined") {
      if (Date.now() - start > frist) {
        throw new Error("arena-headless-runner: window.__arena wurde nicht rechtzeitig bereit.");
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const haengeMotorNeuEin = (kader: {
    heim: ArenaSpieler[];
    gast: ArenaSpieler[];
    aufstellung: ArenaAufstellung;
  }) => {
    fenster.__olyArenaKader = {
      heim: kader.heim,
      gast: kader.gast,
      aufstellung: kader.aufstellung,
      mutatoren: payload.mutatoren,
    };
    delete fenster.__arena;
    document.querySelectorAll("script[data-oly-headless-engine]").forEach((el) => el.remove());
    const script = document.createElement("script");
    script.src = "battle-mode.engine.js";
    script.setAttribute("data-oly-headless-engine", "1");
    document.body.appendChild(script);
  };

  await wartenAufMotor(payload.timeoutMs);

  const ergebnisse: Array<RoherBrowserFixtureErgebnis | null> = [];
  for (let i = 0; i < payload.fixtures.length; i += 1) {
    const fixture = payload.fixtures[i];
    if (i > 0) {
      haengeMotorNeuEin(fixture);
      await wartenAufMotor(payload.timeoutMs);
    }
    if (!fenster.__arena) {
      throw new Error(`arena-headless-runner: window.__arena fehlt bei Fixture ${i}.`);
    }
    ergebnisse.push(
      payload.chassis === "buehneHeben"
        ? fenster.__arena.spieleBuehneHeben(payload.disziplin, fixture.seed)
        : payload.chassis === "buehneDuell"
        ? fenster.__arena.spieleBuehneDuell(payload.disziplin, fixture.seed)
        : payload.chassis === "buehneAuftritt"
        ? fenster.__arena.spieleBuehneAuftritt(payload.disziplin, fixture.seed)
        : payload.chassis === "buehneGauntlet"
        ? fenster.__arena.spieleBuehneGauntlet(payload.disziplin, fixture.seed)
        : payload.chassis === "bahn"
        ? fenster.__arena.spieleBahn(payload.disziplin, fixture.seed)
        : fenster.__arena.spieleFeldspiel(payload.disziplin, fixture.seed),
    );
  }
  return ergebnisse;
}

/**
 * WELCHES CHASSIS (= welche `window.__arena`-Funktion) eine Disziplin braucht — NUR ueber die
 * Mengen oben entschieden, keine Disziplins-ID-Kenntnis anderswo. Ausgelagert (Quick-Sim, 27.10.),
 * damit der Chromium-Runner und `arena-node-runner.ts` GARANTIERT dieselbe Weiche nehmen; die
 * Logik ist unveraendert die vorherige Inline-Kette in `runArenaFixtures()`.
 */
export type ArenaChassis = "feldspiel" | "buehneHeben" | "buehneDuell" | "buehneAuftritt" | "buehneGauntlet" | "bahn";

export function waehleArenaChassis(disziplin: string): ArenaChassis {
  return ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS.has(disziplin)
    ? "buehneHeben"
    : ARENA_BUEHNE_DUELL_DISCIPLINE_IDS.has(disziplin)
    ? "buehneDuell"
    : ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS.has(disziplin)
    ? "buehneAuftritt"
    : ARENA_BUEHNE_GAUNTLET_DISCIPLINE_IDS.has(disziplin)
    ? "buehneGauntlet"
    : ARENA_BAHN_DISCIPLINE_IDS.has(disziplin)
    ? "bahn"
    : "feldspiel";
}

/** Motor-Einstieg je Chassis — fuer Fehlermeldungen und als Gegenprobe zu `arena-node-motor.mjs`. */
export const ARENA_CHASSIS_MOTOR_EINSTIEG: Readonly<Record<ArenaChassis, string>> = {
  feldspiel: "spieleFeldspiel",
  buehneHeben: "spieleBuehneHeben",
  buehneDuell: "spieleBuehneDuell",
  buehneAuftritt: "spieleBuehneAuftritt",
  buehneGauntlet: "spieleBuehneGauntlet",
  bahn: "spieleBahn",
};

/**
 * Rohe Motor-Ergebnisse -> `ArenaFixtureResult[]` (Spieler-IDs, Seiten, Team-IDs der Momente).
 * Ausgelagert (Quick-Sim, 27.10.) aus `runArenaFixtures()`, unveraendert — der Node-Runner
 * (`arena-node-runner.ts`) bereitet seine Rohdaten mit GENAU dieser Funktion auf, damit beide Wege
 * dasselbe Ergebnisformat liefern, nicht nur ein aehnliches.
 */
export function baueArenaFixtureErgebnisse(
  vorbereitet: VorbereitetesFixture[],
  rohErgebnisse: Array<RoherBrowserFixtureErgebnis | null>,
  disziplin: string,
  chassis: ArenaChassis,
): ArenaFixtureResult[] {
  // Review-Fund (PR #776): die Fehlermeldung unten muss die TATSAECHLICH aufgerufene
  // Browser-Funktion nennen -- vor der Chassis-Weiche stand hier "spieleFeldspiel"
  // hartkodiert, obwohl derselbe Codepfad seit der Gewichtheben-Produktivierung auch
  // "spieleBuehneHeben" aufruft. Ein Fehler im Buehnen-Pfad haette damit faelschlich auf die
  // falsche Funktion gezeigt und beim Debuggen eines echten Produktionsfehlers in die Irre
  // gefuehrt.
  const aufgerufeneFunktion = ARENA_CHASSIS_MOTOR_EINSTIEG[chassis];
  return rohErgebnisse.map((ergebnis, index) => {
    if (!ergebnis) {
      throw new Error(
        `arena-headless-runner: ${aufgerufeneFunktion}("${disziplin}", ...) lieferte null fuer Fixture ${index} (${vorbereitet[index].homeTeamId} vs. ${vorbereitet[index].awayTeamId}) — unbekannte Disziplin?`,
      );
    }
    // Namenszuordnung PRO FIXTURE (nicht global): derselbe Name in zwei VERSCHIEDENEN
    // Fixtures desselben Batches ist unproblematisch (jedes Duell hat sein eigenes Kader-Paar),
    // nur eine Kollision INNERHALB dieses einen Duells zaehlt.
    const zuordnung = baueEindeutigeNamenZuordnung(vorbereitet[index].heim, vorbereitet[index].gast);
    const boxscore: ArenaFixtureBoxscoreEintrag[] = ergebnis.boxscore.map((eintrag) => {
      const treffer = zuordnung.get(eintrag.name);
      return {
        name: eintrag.name,
        wert: eintrag.wert,
        playerId: treffer?.playerId ?? null,
        side: treffer?.side ?? null,
        torwart: !!eintrag.torwart,
      };
    });
    // "SPIEL DES TAGES" (Task #31 Paket 1, s. `ArenaMomentEintrag`): `seite` 0/1 wird hier,
    // genau wie `side` bei der Boxscore oben, auf die echte `teamId` dieses Fixtures aufgeloest.
    const momente: ArenaMomentEintrag[] | undefined = ergebnis.momente?.map((moment) => ({
      typ: moment.typ,
      teamId: moment.seite === 0 ? vorbereitet[index].homeTeamId : vorbereitet[index].awayTeamId,
      spieler: moment.spieler,
    }));
    return {
      homeTeamId: vorbereitet[index].homeTeamId,
      awayTeamId: vorbereitet[index].awayTeamId,
      seiten: ergebnis.seiten,
      boxscore,
      ...(ergebnis.gesamtKg ? { gesamtKg: ergebnis.gesamtKg } : {}),
      ...(momente ? { momente } : {}),
    };
  });
}

async function schliesseBrowserHart(browser: Browser) {
  // Playwright schliesst den Chromium-Prozess mit `browser.close()` normalerweise sauber;
  // ein zweiter, erzwungener Versuch ist hier bewusst NICHT eingebaut — ein Fehlschlag von
  // `close()` selbst wuerde ohnehin nur denselben Fehler ein zweites Mal werfen. Der
  // `finally`-Block im Aufrufer sorgt dafuer, dass dieser Aufruf auch bei einem Fehler mitten
  // in der Simulation garantiert stattfindet (kein Zombie-Prozess, Plan Abschnitt 5.4).
  await browser.close();
}

/**
 * Fuehrt eine Menge von Arena-Fixtures (typischerweise ein Spieltag/eine Liga, s. Plan
 * Abschnitt 3.3c: 8 Fixtures) headless aus und liefert fuer jedes ein Ergebnis zurueck.
 *
 * NOCH NICHT AN DIE ECHTE RESOLVE-PIPELINE ANGEBUNDEN (das ist PR 7/8) — dieser Service ist
 * bewusst eigenstaendig aufrufbar und testbar, ohne dass ein "Spieltag simulieren"-Klick ihn
 * schon ausloest.
 */
export async function runArenaFixtures(
  gameState: GameState,
  fixtures: ArenaFixtureInput[],
  disziplin: string,
  options: RunArenaFixturesOptions = {},
): Promise<ArenaFixtureResult[]> {
  if (fixtures.length === 0) return [];

  const vorbereitet = bereiteFixturesVor(gameState, fixtures, options.attributeSheetOverrides);
  const seitenPfad = path.resolve(process.cwd(), "public", "mockups", "battle-mode.html");
  if (!existsSync(seitenPfad)) {
    throw new Error(`arena-headless-runner: battle-mode.html nicht gefunden unter ${seitenPfad}.`);
  }
  const timeoutMs = options.seitenTimeoutMs ?? STANDARD_SEITEN_TIMEOUT_MS;
  const gesamtTimeoutMs = options.gesamtTimeoutMs ?? STANDARD_GESAMT_TIMEOUT_MS;
  const mutatoren = [...(options.mutatoren ?? [])].map((trait) => String(trait).trim()).filter(Boolean);

  const browser = await chromium.launch(ermittleChromiumLaunchOptions(options.chromiumExecutablePath));
  // OPUS-REVIEW B2: `schliesseEinmal()` ist von AUSSEN (dem Timeout-Wettlauf unten) UND von INNEN
  // (dem `finally` des eigentlichen Laufs) erreichbar -- der Schutz verhindert einen doppelten
  // `browser.close()`-Aufruf, wenn beide fast gleichzeitig greifen.
  let browserGeschlossen = false;
  const schliesseEinmal = async () => {
    if (browserGeschlossen) return;
    browserGeschlossen = true;
    await schliesseBrowserHart(browser).catch(() => {
      // Ein Fehler beim (zweiten) Schliessen ist hier kein neuer Befund -- der Browser ist in
      // jedem Fall nicht mehr erreichbar, genau das war das Ziel.
    });
  };

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const gesamtTimeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      void schliesseEinmal().then(() => {
        reject(
          new Error(
            `arena-headless-runner: Gesamt-Timeout (${gesamtTimeoutMs}ms) ueberschritten fuer "${disziplin}" -- Browser hart geschlossen, kein haengender Prozess.`,
          ),
        );
      });
    }, gesamtTimeoutMs);
  });

  const lauf = (async (): Promise<ArenaFixtureResult[]> => {
    try {
    const page: Page = await browser.newPage();
    // TSX/ESBUILD-KOMPATIBILITAET (PPS-Skalierung, 03.09., gefunden beim Bau von
    // scripts/ziehe-basketball-pps-referenz.ts): `tsx` -- der Loader, mit dem JEDES Skript in
    // scripts/ per `npx tsx` laeuft -- transformiert JEDE Datei mit esbuilds `keepNames:true`
    // (fest verdrahtet in tsx selbst, nicht abschaltbar). Das schreibt eine benannte
    // Funktion/Arrow-Const zu `x = /* @__PURE__ */ __name(x, "x")` um -- AUCH innerhalb von
    // `simuliereFixturesImBrowser` unten, deren eigene Hilfsfunktionen (`wartenAufMotor`,
    // `haengeMotorNeuEin`) genau solche benannten Consts sind. `page.evaluate()` uebertraegt die
    // Funktion aber nur als TEXT (`.toString()`) in den Browser -- der `__name`-Aufruf reist mit,
    // die Helper-Definition selbst nicht. Ergebnis: JEDER tsx-getriebene Aufruf von
    // `runArenaFixtures()` schlug mit "ReferenceError: __name is not defined" fehl, bevor auch
    // nur ein Fixture simuliert wurde. Ueber Next.js/Webpack (Produktivpfad) und Vitest (die
    // gesamte bestehende Testsuite) trat das nie auf, weil beide anders buendeln -- weshalb es
    // bislang unbemerkt blieb: keine bestehende Datei ruft diese Funktion ueber `tsx` auf. Ein
    // Identitaets-Shim ist ueberall harmlos, auch dort, wo `__name` nie aufgerufen wird.
    await page.addInitScript(() => {
      const fenster = window as unknown as { __name?: (fn: unknown, name?: string) => unknown };
      if (typeof fenster.__name !== "function") {
        fenster.__name = (fn) => fn;
      }
    });
    // BUEHNEN-FLAGS (s. `buehneFlags` in RunArenaFixturesOptions): ein Fensterwert ueberlebt das
    // Neu-Einhaengen der Engine je Fixture. Ohne Option wird nichts gesetzt.
    if (options.buehneFlags) {
      await page.addInitScript((flags) => {
        (window as unknown as { __olyBuehneFlags?: unknown }).__olyBuehneFlags = flags;
      }, { ...options.buehneFlags });
    }
    // Erstes Fixture VOR der Navigation setzen (Plan Abschnitt 3.3b) — der normale
    // Seitenaufbau (battle-mode.html haengt battle-mode.engine.js selbst per <script src> ein)
    // liest diesen Kader dann beim allerersten Motor-Start, kein zusaetzliches Einhaengen noetig.
    await page.addInitScript((kader) => {
      (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
    }, {
      heim: vorbereitet[0].heim,
      gast: vorbereitet[0].gast,
      aufstellung: vorbereitet[0].aufstellung,
      mutatoren,
    });

    await page.goto(pathToFileURL(seitenPfad).href);

    const chassis = waehleArenaChassis(disziplin);
    const rohErgebnisse = await page.evaluate(simuliereFixturesImBrowser, {
      fixtures: vorbereitet.map(({ heim, gast, seed, aufstellung }) => ({
        heim,
        gast,
        seed,
        aufstellung,
      })),
      disziplin,
      mutatoren,
      chassis,
      timeoutMs,
    });

    return baueArenaFixtureErgebnisse(vorbereitet, rohErgebnisse, disziplin, chassis);
    } finally {
      await schliesseEinmal();
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  })();

  return Promise.race([lauf, gesamtTimeoutPromise]);
}

/**
 * MINI-DM-POD-RUNNER (mini-dm-spielplan-verankerung, 14.09.) — wiring von
 * `lib/season/mini-dm-pod-schedule.ts`s 4-Team-Pods an den bereits fertigen, bislang nur ueber
 * `window.__arena.miniDmFfaEvent()` per Testschnittstelle erreichbaren FFA-Kampfmotor
 * (`spieleMiniDmFfaEvent()`/`baueMiniDmFfaRunde()`, battle-mode.engine.js, "vier Rollenrunden").
 *
 * BEWUSST NICHT ueber `runArenaFixtures()`/`ARENA_TEAM_POINTS`/`ARENA_RESOLVED_DISCIPLINE_IDS`
 * verdrahtet — Mini-DMs eigentliche Liga-Tabellenpunkte kommen weiterhin unveraendert aus dem
 * generischen, liga-weiten PPS-Renn-Scoring (Chris' ausdrueckliche Ausklammerung fuer diese
 * Runde: rho 0,256 kaderfest liegt weit unter der 0,80-Schranke, ein separates, groesseres
 * Validitaetsproblem). Dieser Runner liefert ausschliesslich einen ECHTEN, simulierten
 * Boxscore je Pod fuer Praesentationszwecke (z. B. die N-generische Buehne,
 * `DisciplineStageNativeArena.tsx`) — kein Aufrufer bucht sein Ergebnis heute in die
 * Saisontabelle.
 *
 * STRUKTURELL EINFACHER als `runArenaFixtures()`: `spieleMiniDmFfaEvent(vierTeams, saat, platz)`
 * nimmt die vier Kader als EXPLIZITE Funktionsargumente entgegen (kein Umweg ueber
 * `window.__olyArenaKader`/SQUAD/OPP wie beim 2-Team-Chassis) — ein Pod-Batch braucht deshalb
 * NUR EINEN Motor-Ladevorgang fuer die gesamte Seite, kein Neu-Einhaengen von
 * `<script src="battle-mode.engine.js">` je Pod (s. `simuliereFixturesImBrowser` oben).
 *
 * AUFSTELLUNG (20.10., PR A der Mini-DM-Anbindung): vorher stellte `spieleMiniDmFfaEvent()` die
 * vier Kaempfer je Team SELBST nach absteigender Mini-DM-Eignung zusammen (`aufstellung: {}`
 * fest verdrahtet) — die Aufstellung des Managers wurde ignoriert. Dieser Runner baut jetzt je
 * Team denselben `place` wie die anderen Arena-Disziplinen (`buildArenaAufstellung()`, EIN Team
 * statt `buildArenaAufstellungBeide()`s Zwei-Team-Merge — ein Pod-Teilnehmer kennt nur seinen
 * EIGENEN Kader, keine Namenskollision mit den drei anderen Teams moeglich) und reicht ihn als
 * dritten, optionalen Parameter durch. Ein Team ohne Lineup-Entwurf (oder ohne Eintrag fuer eine
 * bestimmte Mini-DM-Rolle) faellt WEITERHIN auf den alten Eignungs-Reihum zurueck — s.
 * `mdffaGesetzteRolle()`/"gesetzt vs. frei" in battle-mode.engine.js.
 *
 * MUTATOREN: `options.mutatoren` — derselbe Spieltagswurf, den andere Arena-Fixtures ueber
 * `RunArenaFixturesOptions.mutatoren` bekommen (fuer das GESAMTE Batch gleich, s. dort) — statt
 * des bisher hart verdrahteten `mutatoren: []`. Der Aufrufer liefert ihn (z. B.
 * `resolveMatchdayMutatorTraitsForDiscipline({...}, disciplineId: MINI_DM_DISCIPLINE_ID)`); ohne
 * Option bleibt das Verhalten wie vorher (leerer Wurf).
 *
 * Bleibt WEITERHIN Praesentationszweck (s. Kopfkommentar oben, unveraendert) — kein Aufrufer
 * bucht dieses Ergebnis heute in die Saisontabelle, das bleibt PR B vorbehalten.
 */
export type MiniDmFfaPodFixtureInput = {
  podId: string;
  teamIds: readonly [string, string, string, string];
  /** Deterministischer Seed, s. `seedZuZahl()`-Kommentar oben — derselbe FNV-1a-Weg wie bei
   *  `runArenaFixtures()`, damit ein String-Seed nicht auf 0 kollabiert. */
  seed: string | number;
};

export type MiniDmFfaPodBoxscoreEintrag = {
  slotId: string;
  name: string;
  playerId: string | null;
  teamId: string | null;
  /** Pod-lokaler Team-Index 0..3, s. `MiniDmPod.teamIds`-Reihenfolge in mini-dm-pod-schedule.ts. */
  podSide: number;
  rundenPlatz: number;
  rundenPunkte: number;
  beitrag: number;
};

export type MiniDmFfaPodTeamResult = {
  teamId: string;
  podSide: number;
  rundenPunkteSumme: number;
  beitragSumme: number;
  eventPlatz: number;
  /** Chris' ausdrueckliche Uebersteuerung [2,1,0,0] (Summe 3, s. Kopfkommentar) — REIN
   *  informativ aus diesem Runner heraus, wird von KEINEM heutigen Aufrufer in die
   *  Saisontabelle gebucht. */
  ligaPunkte: number;
};

export type MiniDmFfaPodFixtureResult = {
  podId: string;
  teamIds: readonly [string, string, string, string];
  teams: MiniDmFfaPodTeamResult[];
  boxscore: MiniDmFfaPodBoxscoreEintrag[];
};

type RoherMiniDmFfaRundenTeamEintrag = {
  side: number;
  n: string;
  eig: number;
  beitrag: number;
  rundenPlatz: number;
  rundenPunkte: number;
  hp: number;
  max: number;
  down: boolean;
};
type RoherMiniDmFfaRunde = { slotId: string; seed: number; dauer: number; teams: RoherMiniDmFfaRundenTeamEintrag[] };
export type RoherMiniDmFfaEventErgebnis = {
  saat: number;
  runden: RoherMiniDmFfaRunde[];
  teams: Array<{ side: number; rundenPunkteSumme: number; beitragSumme: number; eventPlatz: number; ligaPunkte: number }>;
};

export type RunMiniDmFfaPodFixturesOptions = {
  attributeSheetOverrides?: ReadonlyMap<string, Player["attributeSheetStats"]>;
  chromiumExecutablePath?: string;
  seitenTimeoutMs?: number;
  /** Der Spieltagswurf (20.10., PR A) — s. Kopfkommentar oben, `RunArenaFixturesOptions.mutatoren`
   *  fuer dieselbe Bauart bei den 2-Team-Disziplinen. Ohne Option: leerer Wurf, wie bisher. */
  mutatoren?: string[];
  /** `false` (20.10., PR A): jedes Team spielt den alten reinen Eignungs-Reihum, selbst wenn ein
   *  Lineup-Entwurf existiert — fuer Aufrufer, die (noch) bewusst das Vorher-Verhalten wollen
   *  (z. B. eine Vergleichsmessung). Default `true`. */
  aufstellungBeachten?: boolean;
  /**
   * `k` (PR 5 des 6-PR-Opus-Plans 21.10., "Vorlauf-Verdrahtung") — durchgereicht als Feld von
   * `optionen` an `window.__arena.miniDmFfaEvent()`/`spieleMiniDmFfaEvent()` (battle-mode.engine.js,
   * PR 2 #1302): die Kadergroesse 2..6 des Spielplan-Slots dieses Spieltags,
   * `MINI_DM_FFA_SLOTS_JE_K[k]` spielt dann genau `k` Runden mit den k-spezifischen Rollenprofilen
   * statt der festen vier. OHNE `k` EXAKT der alte Vierer-Pfad fuer die ROLLENAUSWAHL
   * (`mdffaRollenFuerK(null)`).
   *
   * ACHTUNG (OPUS-REVIEW B1, Blocker-Fix): `k` alleine ist NICHT mehr "byte-identisch ohne
   * Option" -- `runMiniDmFfaPodFixtures()` setzt seit diesem Fix IMMER zusaetzlich
   * `optionen.formSaat` (je Pod auf dessen eigenen `seed`), unabhaengig von `k`. Das ist
   * ABSICHTLICH: ohne eigene Formkarten je Pod bevorzugte der Motor strukturell die beiden
   * Bootstrap-Teams (gemessen 192/200 bzw. 181/200 Events gegen einen attributgleichen Klon an
   * anderer Pod-Position, s. Kommentar an der Aufrufstelle unten) -- ein Fehler, keine
   * Kompatibilitaet, die es zu bewahren galt.
   */
  k?: number;
  /**
   * OPUS-REVIEW, PR 5 (Lesepfad-Robustheit, nicht blockierend): explizit uebergebener Spieltag fuer
   * `buildArenaAufstellung()` unten -- ohne dieses Feld liest diese Funktion `gameState.matchdayState
   * ?.matchdayId` selbst, UNABHAENGIG vom `matchdayId`, das der Aufrufer (`runMiniDmFfaMatchday()`,
   * mini-dm-ffa-matchday.ts) fuer Hash/Teilnahme/Seed tatsaechlich verwendet. In der Praxis sind
   * beide Werte heute immer gleich (`matchdayState.matchdayId` ist der aktuell offene Spieltag, und
   * nur der wird vorlaeufig aufgeloest) -- aber EIN impliziter Lesepfad weniger ist robuster, falls
   * ein kuenftiger Aufrufer (z.B. ein Nachtrag/Resolve fuer einen VERGANGENEN Spieltag) die beiden
   * einmal auseinanderlaufen laesst. Gesetzt, gewinnt dieses Feld; `undefined` laesst das
   * Lese-Verhalten exakt wie vor diesem Fix (byte-identisch fuer jeden bestehenden Aufrufer, der es
   * nicht setzt).
   */
  matchdayId?: string | null;
};

/**
 * Ordnet jeden Boxscore-Namen EINES Teams genau einem Spieler zu — nur, wenn der Name in GENAU
 * EINEM Kadereintrag DIESES Teams vorkommt (analog `baueEindeutigeNamenZuordnung` oben, aber pro
 * einzelnem Pod-Team statt pro Heim/Gast-Paar, weil ein Pod-Kaempfer im rohen Ergebnis bereits
 * sein `side`/Team explizit traegt — anders als beim 2-Team-Chassis muss hier nichts ueber
 * mehrere Kader hinweg disambiguiert werden).
 */
function baueEindeutigeNamenZuordnungFuerTeam(kader: ArenaSpieler[]): Map<string, string> {
  const vorkommen = new Map<string, number>();
  for (const spieler of kader) {
    vorkommen.set(spieler.n, (vorkommen.get(spieler.n) ?? 0) + 1);
  }
  const zuordnung = new Map<string, string>();
  for (const spieler of kader) {
    if (vorkommen.get(spieler.n) === 1) zuordnung.set(spieler.n, spieler.id);
  }
  return zuordnung;
}

/**
 * Laeuft im Browser-Kontext (s. `simuliereFixturesImBrowser`-Kommentar oben zu denselben
 * Einschraenkungen: nur Argumente + Browser-Globale, keine Node-Closures).
 */
async function simuliereMiniDmFfaPodsImBrowser(payload: {
  pods: Array<{ teams: ArenaSpieler[][]; seed: number; platzJeTeam: ArenaAufstellung[]; optionen?: { k?: number; formSaat?: number } }>;
  timeoutMs: number;
}): Promise<Array<RoherMiniDmFfaEventErgebnis | null>> {
  const fenster = window as unknown as {
    __arena?: {
      miniDmFfaEvent: (
        vierTeams: ArenaSpieler[][],
        saat: number,
        platzJeTeam?: ArenaAufstellung[],
        optionen?: { k?: number; formSaat?: number },
      ) => RoherMiniDmFfaEventErgebnis | null;
    };
  };

  const start = Date.now();
  while (typeof fenster.__arena === "undefined") {
    if (Date.now() - start > payload.timeoutMs) {
      throw new Error("arena-headless-runner: window.__arena wurde nicht rechtzeitig bereit.");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return payload.pods.map((pod) => fenster.__arena!.miniDmFfaEvent(pod.teams, pod.seed, pod.platzJeTeam, pod.optionen));
}

/**
 * Kader und Aufstellung je Pod-Team, VOR dem Motor-Start — ausgelagert (Quick-Sim, 27.10.) aus
 * `runMiniDmFfaPodFixtures()`, unveraendert, damit `arena-node-runner.ts` dieselben Eingaben baut.
 */
export function bereiteMiniDmPodsVor(
  gameState: GameState,
  pods: MiniDmFfaPodFixtureInput[],
  options: Pick<RunMiniDmFfaPodFixturesOptions, "attributeSheetOverrides" | "aufstellungBeachten" | "matchdayId"> = {},
) {
  // AUFSTELLUNG (20.10., PR A) — je Team EIN `place` (buildArenaAufstellung(), kein Merge noetig,
  // s. Kopfkommentar). `aufstellungBeachten: false` haelt bewusst beim alten Verhalten (leere
  // `place`-Objekte -> reiner Eignungs-Reihum im Motor, s. `mdffaGesetzteRolle()`).
  const aufstellungBeachten = options.aufstellungBeachten ?? true;
  // OPUS-REVIEW, PR 5: `options.matchdayId` gewinnt, wenn der Aufrufer ihn explizit setzt (s.
  // Kommentar an `RunMiniDmFfaPodFixturesOptions.matchdayId`) -- `undefined` laesst exakt den alten
  // Lesepfad (`gameState.matchdayState?.matchdayId`), byte-identisch fuer jeden bestehenden Aufrufer.
  const matchdayId = options.matchdayId !== undefined ? options.matchdayId : gameState.matchdayState?.matchdayId ?? null;
  const vorbereitet = pods.map((pod) => ({
    ...pod,
    seed: seedZuZahl(pod.seed),
    kaderJeTeam: pod.teamIds.map((teamId) => buildArenaTeam(gameState, teamId, options.attributeSheetOverrides)),
    platzJeTeam: aufstellungBeachten
      ? pod.teamIds.map((teamId) => buildArenaAufstellung(gameState, teamId, matchdayId))
      : pod.teamIds.map(() => ({}) as ArenaAufstellung),
  }));

  const einsatzfaehig = vorbereitet.map((pod) => pod.kaderJeTeam.every((kader) => kader.length > 0));
  return { vorbereitet, einsatzfaehig };
}

export type VorbereiteterMiniDmPod = ReturnType<typeof bereiteMiniDmPodsVor>["vorbereitet"][number];

/**
 * Rohe `miniDmFfaEvent()`-Ergebnisse -> `MiniDmFfaPodFixtureResult[]` (je Pod an seiner Position,
 * `null` fuer nicht einsatzfaehige Pods) — ausgelagert (Quick-Sim, 27.10.), unveraendert.
 * `rohErgebnisse` enthaelt NUR die laufbaren Pods, in ihrer Reihenfolge.
 */
export function baueMiniDmPodErgebnisse(
  vorbereitet: VorbereiteterMiniDmPod[],
  einsatzfaehig: boolean[],
  rohErgebnisse: Array<RoherMiniDmFfaEventErgebnis | null>,
): Array<MiniDmFfaPodFixtureResult | null> {
  let laufbarIndex = 0;
  return vorbereitet.map((pod, index) => {
    if (!einsatzfaehig[index]) {
      return null;
    }
    const ergebnis = rohErgebnisse[laufbarIndex]!;
    laufbarIndex += 1;
    if (!ergebnis) {
      return null;
    }

    const namenJeTeam = pod.kaderJeTeam.map((kader) => baueEindeutigeNamenZuordnungFuerTeam(kader));
    const boxscore: MiniDmFfaPodBoxscoreEintrag[] = ergebnis.runden.flatMap((runde) =>
      runde.teams.map((eintrag) => ({
        slotId: runde.slotId,
        name: eintrag.n,
        playerId: namenJeTeam[eintrag.side]?.get(eintrag.n) ?? null,
        teamId: pod.teamIds[eintrag.side] ?? null,
        podSide: eintrag.side,
        rundenPlatz: eintrag.rundenPlatz,
        rundenPunkte: eintrag.rundenPunkte,
        beitrag: eintrag.beitrag,
      })),
    );
    const teams: MiniDmFfaPodTeamResult[] = ergebnis.teams.map((eintrag) => ({
      teamId: pod.teamIds[eintrag.side] ?? "",
      podSide: eintrag.side,
      rundenPunkteSumme: eintrag.rundenPunkteSumme,
      beitragSumme: eintrag.beitragSumme,
      eventPlatz: eintrag.eventPlatz,
      ligaPunkte: eintrag.ligaPunkte,
    }));

    return { podId: pod.podId, teamIds: pod.teamIds, teams, boxscore };
  });
}

/**
 * Fuehrt eine Menge Mini-DM-Pods (typischerweise alle Pods eines Mini-DM-Spieltags, s.
 * `getMiniDmPodsForMatchday()`) headless aus und liefert je Pod einen echten, simulierten
 * Boxscore — PRAESENTATIONSZWECK, s. Kopfkommentar oben. Ein Pod, dessen Team KEINEN einzigen
 * einsatzfaehigen Kader stellt (fehlende Attribut-Boegen, leeres Roster), wird NICHT geworfen,
 * sondern als `null` an derselben Position zurueckgegeben — anders als `runArenaFixtures()`
 * (das bei EINEM leeren Kader auf eine 1-gegen-0-Notaufstellung ausweicht), weil
 * `spieleMiniDmFfaEvent()` selbst hart abbricht, sobald ein Team keinen Mini-DM-Kaempfer stellt,
 * und ein einzelner unvollstaendiger Pod (z. B. ein frisch angelegtes Team ohne Kader) den Rest
 * des Batches nicht mitreissen soll.
 */
export async function runMiniDmFfaPodFixtures(
  gameState: GameState,
  pods: MiniDmFfaPodFixtureInput[],
  options: RunMiniDmFfaPodFixturesOptions = {},
): Promise<Array<MiniDmFfaPodFixtureResult | null>> {
  if (pods.length === 0) return [];

  const { vorbereitet, einsatzfaehig } = bereiteMiniDmPodsVor(gameState, pods, options);

  const seitenPfad = path.resolve(process.cwd(), "public", "mockups", "battle-mode.html");
  if (!existsSync(seitenPfad)) {
    throw new Error(`arena-headless-runner: battle-mode.html nicht gefunden unter ${seitenPfad}.`);
  }
  const timeoutMs = options.seitenTimeoutMs ?? STANDARD_SEITEN_TIMEOUT_MS;
  const laufbarePods = vorbereitet.filter((_, index) => einsatzfaehig[index]);
  if (laufbarePods.length === 0) {
    return vorbereitet.map(() => null);
  }

  const browser = await chromium.launch(ermittleChromiumLaunchOptions(options.chromiumExecutablePath));
  try {
    const page: Page = await browser.newPage();
    // Derselbe tsx/esbuild-`__name`-Shim wie bei `runArenaFixtures()` oben — noetig, weil
    // `page.evaluate()` Funktionen nur als Text ueberträgt (s. Kommentar dort).
    await page.addInitScript(() => {
      const fenster = window as unknown as { __name?: (fn: unknown, name?: string) => unknown };
      if (typeof fenster.__name !== "function") {
        fenster.__name = (fn) => fn;
      }
    });
    // `window.__olyArenaKader` MUSS beim Laden irgendeinen validen 2-Team-Kader tragen (s.
    // "BRUECKE ZUR ECHTEN APP" in battle-mode.engine.js), sonst wartet das Modul auf ein Signal,
    // das hier nie kommt — `miniDmFfaEvent()` selbst LIEST diesen Wert nirgends (Kader kommen als
    // explizite Funktionsargumente), er dient ausschliesslich dem Bootstrap.
    const bootstrapPod = laufbarePods[0]!;
    await page.addInitScript(
      (kader) => {
        (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
      },
      // `mutatoren` (20.10., PR A): `options.mutatoren` statt des bisher hart verdrahteten `[]` —
      // derselbe Bootstrap-Weg, ueber den auch die 2-Team-Disziplinen ihren Spieltagswurf lesen
      // (s. Kopfkommentar). Die mini-dm-eigene `aufstellung` hier bleibt leer (bootstrap-seitig
      // ungenutzt, `miniDmFfaEvent()` bekommt die echte je Pod als expliziten Funktionsparameter).
      {
        heim: bootstrapPod.kaderJeTeam[0],
        gast: bootstrapPod.kaderJeTeam[1],
        aufstellung: {},
        mutatoren: options.mutatoren ?? [],
      },
    );

    await page.goto(pathToFileURL(seitenPfad).href);

    const rohErgebnisse = await page.evaluate(simuliereMiniDmFfaPodsImBrowser, {
      // `formSaat` (OPUS-REVIEW B1, PR 5 des 6-PR-Plans 21.10., Blocker-Fix): IMMER gesetzt, je
      // Pod auf dessen EIGENEN `seed` -- s. ausfuehrlicher Kommentar an `spieleMiniDmFfaEvent()`s
      // `optionen.formSaat` (battle-mode.engine.js). OHNE das zog die globale `FORMKARTE` (einmalig
      // beim Seiten-Bootstrap, nur fuer die beiden via `window.__olyArenaKader` geladenen Teams --
      // hier `laufbarePods[0]`s Team 0/1) Formkarten fuer hoechstens ZWEI von bis zu 32 Teams je
      // Spieltag; jedes andere Team (inkl. Team 2/3 des ERSTEN Pods selbst) bekam `formVon() = 0`
      // -- eine strukturelle, mit echtem Chromium gemessene Bevorzugung (192/200 bzw. 181/200
      // Events gegen einen attributgleichen Klon an anderer Pod-Position, s. PR-Bericht). Denselben
      // `seed` wie fuer die Rundenfolge zu nehmen (statt eines zweiten, unabhaengigen Saat-Stroms)
      // folgt demselben Muster wie beim Zweier-Duell (s. `arena-eingabe-hash.ts`-Kommentar:
      // "Formkarten seit 15.10. in die Saat gekoppelt").
      pods: laufbarePods.map((pod) => ({
        teams: pod.kaderJeTeam,
        seed: pod.seed,
        platzJeTeam: pod.platzJeTeam,
        optionen: { ...(options.k != null ? { k: options.k } : {}), formSaat: pod.seed },
      })),
      timeoutMs,
    });

    return baueMiniDmPodErgebnisse(vorbereitet, einsatzfaehig, rohErgebnisse);
  } finally {
    await schliesseBrowserHart(browser);
  }
}

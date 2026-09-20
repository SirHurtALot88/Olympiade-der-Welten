/**
 * ARENA_RESOLVED_DISCIPLINE_IDS — eigene Datei ohne Fremd-Importe (A3-Nachtrag, docs/pm-
 * briefings/projektmanager-plan-kampfmodell-umsetzung-20-09.md §3.2), aus demselben Grund wie
 * `arena-seed.ts` daneben: `FoundationBattleArenaHost.tsx` ("use client", Browser-Bundle) muss
 * wissen, ob die aktuell gezeigte Disziplin arena-aufgeloest ist, OHNE dafuer
 * `lib/resolve/battle-mode-arena-team-points.ts` zu importieren — jene Datei zieht ueber
 * `arena-headless-runner.ts` Playwright/`node:fs`/`node:net` etc. mit, die in einem Next.js-
 * Client-Bundle nicht aufloesbar sind (`Module not found: Can't resolve 'fs'/'dns'/'net'/'tls'/
 * 'http2'`). Diese Datei ist deshalb bewusst der EINE Ort fuer diese Menge; `battle-mode-arena-
 * team-points.ts` re-exportiert sie von hier, damit bestehende Importe unveraendert weiterlaufen.
 *
 * Arena-aufgeloeste Disziplinen (Plan Abschnitt 3.2, Option a, seit der Gewichtheben-
 * Produktivierung erweitert). JEDER Code-Pfad, der wissen muss "wird dieser Spieltag arena-
 * aufgeloest", prueft Mitgliedschaft in DIESER Menge -- nie einen Disziplins-Literal-Vergleich
 * (`=== "basketball"` o.ae.) direkt. Ein Eintrag hier reicht NICHT allein: eine neue Disziplin
 * braucht zusaetzlich einen Eintrag in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` (individuelle PPs) und,
 * falls sie ein anderes Chassis als Feldspiel/Buehnen-Heben braucht, Motor-Anbindung in
 * `arena-headless-runner.ts`.
 *
 * PRODUKTIVIERUNGSWELLE 1 (docs/design/speed-schach-showcase-produktivierung.md, 06.09.):
 * Speed-Schach und Showcase sind die vierte und fuenfte Arena-aufgeloeste Disziplin -- ueber
 * ZWEI NEUE Buehnen-Chassis (`ARENA_BUEHNE_DUELL_DISCIPLINE_IDS`/`ARENA_BUEHNE_AUFTRITT_
 * DISCIPLINE_IDS`, arena-headless-runner.ts), nicht ueber das bestehende Feldspiel-/Buehnen-
 * Heben-Chassis. STAFFEL WAR IN DIESER WELLE NOCH NICHT DABEI (Stand 06.09.) -- der Grund von
 * damals ist SEIT PR #827 UEBERHOLT und wird hier korrigiert statt stehen gelassen: der
 * Kommentar sprach von einem `bahnTeamstand()`-Befund `{seiten:[...], gewertet:false}` fuer
 * Staffel. NACHGESEHEN (10.09., Audit Abschnitt 4.1, docs/design/
 * gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md): das stimmt seit PR #827 fuer KEINE
 * der fuenf Bahnen mehr -- `bahnTeamstand()` liefert fuer Staffel `wertung:"etappe"` mit
 * `gewertet:true` (Rang der Etappenleistung je Laeufer aus `bahnRangliste()`), fuer Takeshi's
 * Castle `wertung:"burg"`/`gewertet:true` (burgwertung), fuer Spurt/Time-Trial/Climbing
 * `wertung:"rang"`/`gewertet:true`. Der eigentliche Blocker war nie die fehlende Wertung,
 * sondern ACHSE 2 (kein Arena-Chassis fuer die Bahn) -- s. `ARENA_BAHN_DISCIPLINE_IDS`
 * (arena-headless-runner.ts) und `spieleBahn()` (battle-mode.engine.js). Mit der Bahn-
 * Produktivierung (10.09., Ziel 3) faellt dieser Blocker fuer Staffel/Spurt/Takeshi's
 * Castle/Time-Trial weg -- alle vier stehen jetzt unten in `ARENA_RESOLVED_DISCIPLINE_IDS`.
 *
 * PRODUKTIVIERUNGSWELLE 2 (docs/pm-briefings/opus-overseer-plan-naechste-disziplinen-09-09.md,
 * 09.09.): EISKUNSTLAUF, BREAKING, WETTESSEN, TENNIS und FECHTEN -- die sechste bis zehnte
 * arena-aufgeloeste Disziplin. Damit laeuft die HAELFTE des Feldes ueber die Arena statt ueber
 * den alten PPS-Rang-Pfad.
 *
 * WARUM GENAU DIESE FUENF, UND WARUM DAS EINE REINE KONFIGURATIONSAENDERUNG IST. Zwei
 * unabhaengige Achsen muessen erfuellt sein, und beide sind es hier nachweislich:
 *
 *  1. RANGTREUE BESTANDEN. Alle fuenf liegen kaderfest ueber der 0,80-Schranke aus CLAUDE.md
 *     (`data/generated/rangtreue-basislinie.json`, 24 Spiele je Kader-Variante, Median ueber
 *     fuenf echte Team-Paarungen): Eiskunstlauf 0,875 · Breaking 0,869 · Wettessen 0,845 ·
 *     Tennis 0,825 · Fechten 0,816. Sie sind damit die fuenf am hoechsten bewerteten
 *     Disziplinen des Feldes, die die Schranke bestehen UND noch nicht angeschlossen waren.
 *  2. CHASSIS EXISTIERT BEREITS. Keine der fuenf braucht eine neue Motor-Funktion: Eiskunstlauf/
 *     Breaking/Wettessen laufen ueber `spieleBuehneAuftritt()` (Showcases Chassis aus Welle 1),
 *     Tennis/Fechten ueber `spieleBuehneDuell()` (Speed-Schachs Chassis). Das ist EXAKT der Fall,
 *     den der Kommentar oben vorhersagt -- "eine reine Konfigurationsaenderung (Eintrag hier plus
 *     eigene PPS-Referenz/Kurvenkonstanten) statt eines zweiten Sonderfalls". Der Diff dieser
 *     Welle an `public/mockups/battle-mode.engine.js` ist deshalb LEER.
 *
 * BAHN-PRODUKTIVIERUNG (10.09., docs/pm-briefings/opus-plan-feinschliff-vier-disziplinen-09-10.md
 * Abschnitt 6): STAFFEL (rho 0,915, die beste des Feldes), TAKESHI'S CASTLE (0,861) und
 * TIME-TRIAL (0,828) sind die elfte bis dreizehnte arena-aufgeloeste Disziplin -- ueber das NEUE
 * Bahn-Chassis (`ARENA_BAHN_DISCIPLINE_IDS`, arena-headless-runner.ts,
 * `window.__arena.spieleBahn()`), das ERSTE MAL fuer ein ganzes Chassis statt einer Buehnen-
 * Unterart. Der Dispatch ist fuer diese drei identisch (`MOTOREN[bd]` wird fuer jede `BAHN_ART`-
 * Disziplin in derselben Schleife registriert, battle-mode.engine.js) -- ein `spieleBahn()`, das
 * nur Takeshi bediente, haette kuenstlich verengt werden muessen.
 *
 * SPURT JETZT DABEI, DER OPUS-REVIEW-FUND F1 IST BEHOBEN (Produktionsanbindung 14.09.): am
 * 10.09. bestand rho 0,871 die Schranke, ABER `BAHN_ART.spurt.jeSeite` war 4 statt 6 -- die
 * einzige der vier Bahnen, bei der Motor-Feldgroesse und Saison-Maximalfeldgroesse
 * auseinanderfielen (die Saison wuerfelt fuer JEDE Disziplin gleichverteilt 2..6 Laeufer je
 * Seite, `buildSeasonPlayerCountByDiscipline()`). Gegen den echten Spielstand gemessen
 * (`runArenaFixtures()`, 32 Teams, 64 Fixtures) fuehrte das in ALLEN 64 Fixtures zu einem
 * Boxscore mit zu wenigen Eintraegen (512 statt 768) UND in 4 von 64 Fixtures zu einem Team,
 * das seine Aufstellung nicht angewendet bekam (4 gegen 2 statt 4 gegen 4) -- echte
 * Punkteverzerrung, kein kosmetischer Fehler.
 *
 * DER FIX: `BAHN_ART.spurt.jeSeite` 4 -> 6 (public/mockups/battle-mode.engine.js), dieselbe
 * Feldgroesse wie die anderen drei Bahnen, plus die zwei fehlenden Slots (drivephase/
 * photofinish, `lib/lineups/matchday-slot-roles.ts` fuehrte sie schon). Kaderfest (n=24)
 * gemessen: rho/Spiel 0,894 (Spannweite 0,138, Saison 0,916) -- BESSER als vorher bei jeSeite
 * 4 (0,871/0,236/0,905). Die PPS-Referenz unten wurde GEGEN DEN REPARIERTEN MOTOR neu gezogen
 * (die alte Datei war bei n=4..6 auf denselben 512 Boxscore-Eintraegen je 64 Fixtures
 * eingefroren, s. deren `hinweis`-Feld vor dieser PR).
 *
 * FOOTBALL-VORARBEIT (PPS-Referenz gezogen 15.09.), ABER **NICHT PRODUKTIV GESCHALTET** --
 * ACHSE 2 (eigener `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintrag, `scripts/ziehe-football-pps-
 * referenz.ts`, `data/generated/football-pps-referenz.json`) ist fertig und unten eingetragen,
 * aber ACHSE 1 (Rangtreue) ist zwischenzeitlich WIEDER GERISSEN. Der Korridor-Refit Runde 2
 * (14.09., docs/pm-briefings/opus-review-pr-884-football-runde1-09-10.md) hatte rho je Spiel auf
 * 0,516 -> 0,813 gehoben, ueber der 0,80-Schranke -- DIESE MESSUNG GALT VOR PR #934. #934
 * ("eine Wahrheit" fuer Footballs Gewichtsquelle: Kaderbildschirm-Anzeige, KI-Kauf UND
 * Minispiel-Rezept lesen jetzt DENSELBEN Wert) hat densselben Fund behoben, den Hockey/
 * Basketball/Buehne/Bahn schon hatten (`p.d[disziplin] || 0` fehlte), UND DAMIT rho je Spiel
 * (kaderfest, `node scripts/miss-alle-disziplinen.mjs 24 football`) auf 0,722 GESENKT -- unter
 * die Schranke. Root Cause (Review-Konsens): die jetzt erstmals wirklich einkoppelnden Slot-
 * Rollen-Ziele auf power/health/speed/torment verstaerken den Slot-Bonus-Effekt im Feldspiel-
 * Chassis staerker, als der Korridor-Refit vorausgesetzt hatte. Football laeuft ueber DASSELBE
 * Feldspiel-Chassis wie Basketball/Hockey (`spieleFeldspiel()`, `FELDSPIEL_ART.football` existiert
 * bereits im Motor) -- kein neuer Dispatch, keine neue Verzweigung in `ppsAusArenaImpact()`.
 * ANDERS ALS HOCKEY braucht Football KEINE eigene Rolle mit eigener Wertformel: der Football-Plan
 * sieht bewusst keinen Kicker-Slot vor (Field Goals laufen ueber eine feste Distanzformel), und
 * der Passer wird motor-intern pro Snap per gewichteter Verlosung gezogen
 * (`fkLos(off,"PASSGENAUIGKEIT")`), nicht ueber einen fest zugewiesenen Aufstellungs-Slot wie
 * Hockeys Torwart -- die Referenz-Ziehung braucht deshalb nur die besten n nach Football-Eignung,
 * genau wie Basketballs Skript (s. `scripts/ziehe-football-pps-referenz.ts` Kopfkommentar fuer
 * die volle Begruendung). DIE REFERENZ UND DER `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-EINTRAG BLEIBEN
 * BEWUSST STEHEN -- das ist die Vorarbeit fuer den Moment, in dem eine dedizierte Football-
 * Balance-Runde rho unter der neuen, einzig wahren Gewichtsquelle wieder ueber 0,80 bringt
 * (Ansatzpunkt: Slot-Bonus-Staerke fuer Football reduzieren, oder Rezept C neu fitten). Bis
 * dahin steht Football unten ABSICHTLICH NICHT in `ARENA_RESOLVED_DISCIPLINE_IDS` -- ein
 * Eintrag in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` OHNE Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`
 * ist der Normalzustand fuer eine vorbereitete, aber noch nicht produktiv geschaltete Disziplin
 * (die Querpruefung in `battle-mode-arena-team-points.ts` prueft nur die Richtung "resolved -> hat
 * Konfig", nie umgekehrt, s. dortiger Kommentar) und aendert am Laufzeitverhalten nichts:
 * `loeseArenaImpactKonfigAuf()` wird fuer eine nicht-resolved Disziplin nie mit ihrer
 * `disciplineId` aufgerufen.
 *
 * CLIMBING-KALIBRIERUNG (16.09., docs/design/climbing-kalibrierung-16-09.md): Climbing stand
 * bis hierhin bewusst draussen (rho 0,782 je Spiel kaderfest, 0,010 unter der 0,80-Schranke) --
 * derselbe Fall wie Football unten, nur mit dem billigeren Ausgang. `scripts/messe-arena-
 * einfluss.mjs climbing 48` zeigte 35 Pp Abweichung zur Matrix: Stamina/Determination/Speed
 * liefen 5-7 Pp ueber ihrem Matrixgewicht, waehrend WILL (Matrix 8) mit 2,3 % praktisch tot las
 * und HEALTH (Matrix 10) mit 4,8 % nur gut halb so viel wie sein Gewicht brachte.
 * `scripts/sondiere-feldspiel-subskills.mjs climbing` fand die Ursache: ROBUST -- wo genau
 * diese beiden Attribute mit 24/32 % ihr groesstes Zuhause hatten -- traegt mechanisch 0,0 %
 * (sein einziger Kanal, das 0,3-Gewicht in der Reserve-Obergrenze neben STEHENs 0,7, ist zu
 * schwach, um je zu zaehlen), waehrend STEHEN mit 30 % der schwerste aller sieben Sub-Skills
 * ist. Einziger Eingriff: `BAHN_ART.climbing.rezept.STEHEN` nimmt WILL/HEALTH statt eines
 * Teils von Stamina/Determination auf (public/mockups/battle-mode.engine.js) -- Abweichung zur
 * Matrix 35 -> 19,4 Pp, rho je Spiel kaderfest **0,782 -> 0,834** (Spannweite 0,191 -> 0,209,
 * Saison 0,839 -> 0,860). Alle uebrigen neunzehn Disziplinen bit-identisch nachgemessen (reine
 * Sub-Skill-Gewichtsverschiebung innerhalb eines einzelnen Bahn-Rezepts, kein gemeinsamer
 * Bahn-Code beruehrt). Eigene PPS-Referenz gezogen (`scripts/ziehe-buehne-pps-referenz.ts
 * climbing`, `chassis:"bahn"`, `katalogStandardgroesse` 6 aus dataAdapter.ts) -- derselbe
 * Dispatch wie die anderen vier Bahnen, `ARENA_BAHN_DISCIPLINE_IDS` in arena-headless-
 * runner.ts erweitert.
 *
 * WER BEWUSST DRAUSSEN BLEIBT, und aus welchem Grund:
 *  - FOOTBALL (rho 0,722 je Spiel, s. oben): Rangtreue seit #934 NICHT mehr bestanden -- 0,078
 *    unter der 0,80-Schranke aus CLAUDE.md. Config/Referenz sind fertig, der Eintrag hier fehlt
 *    bewusst, bis eine Balance-Runde rho wieder ueber 0,80 gebracht hat.
 *  - I-SPY (0,684), BASKETBALLs Nachbarn im "knapp"-Feld, BATTLEFIELD/TDM/MINI-DM
 *    (0,251/0,253/0,094): ACHSE 1 fehlt -- sie bestehen ihre eigene Abnahme nicht.
 */
export const ARENA_RESOLVED_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
  "basketball",
  "gewichtheben",
  "hockey",
  "speed-schach",
  "showcase",
  // Produktivierungswelle 2 (09.09.), s. Kommentar oben.
  "eiskunstlauf",
  "breaking",
  "wettessen",
  "tennis",
  "fechten",
  // Bahn-Produktivierung (10.09., Ziel 3), s. Kommentar oben.
  "staffel",
  "takeshis-castle",
  "time-trial",
  // Spurt-Produktionsanbindung (14.09.): Feldgroessen-Fund F1 behoben, s. Kommentar oben.
  "spurt",
  // Climbing-Kalibrierung (16.09.): eigene Rezeptkalibrierung hebt rho ueber die Schranke,
  // s. Kommentar oben.
  "climbing",
  // Football BEWUSST NICHT HIER (15.09.): rho je Spiel seit #934 bei 0,722, unter der 0,80-
  // Schranke -- Config/Referenz sind vorbereitet (s. ARENA_IMPACT_KONFIG_JE_DISZIPLIN in
  // battle-mode-arena-team-points.ts), der Produktiv-Eintrag folgt erst nach einer Balance-Runde,
  // s. Kommentar oben.
]);

/**
 * ZWEI MENGEN SEIT DER PPS-DUELL-BRUECKE (16.10., docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md):
 *
 *  - `ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS` (weiter unten, frueher `ARENA_RESOLVED_DISCIPLINE_IDS`):
 *    die Disziplinen, deren Motor an die Arena-Pipeline ANGESCHLOSSEN ist — Chassis-Dispatch im
 *    Headless-Runner, PPS-Referenz, Impact-Konfig. Die gesamte Herleitung unten (Wellen,
 *    Kalibrierungen) beschreibt diese Menge.
 *  - `ARENA_RESOLVED_DISCIPLINE_IDS` (ganz unten): die Teilmenge, deren Arena-Ergebnis in einem
 *    Battle-Save TATSAECHLICH zaehlt. Nur wer die Pflichtabnahme aus CLAUDE.md besteht (rho je Spiel
 *    > 0,80 UND Pp-Abweichung ≤ 25 in zwei Saatstroemen, Tabelle data/generated/disziplin-abnahme.json)
 *    oder fuer das verfehlte Kriterium auf Chris' Ausnahmeliste steht (`ARENA_ABNAHME_AUSNAHMEN`, je Kriterium), darf hier stehen
 *    — `tests/disziplin-abnahme-guard.test.ts` schlaegt sonst fehl. Jede angeschlossene, aber nicht
 *    abgenommene Disziplin laeuft in Battle Mode ueber die PPS-Duell-Bruecke (2/1/0 aus dem
 *    PPS-Score desselben Fixtures), nie mehr ueber die Rangtabelle.
 *
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
 * FOOTBALL-NACHTRAG (14.10., docs/design/football-kickoff-slot-plan-14-10.md, vier gemergte
 * Schritte: Kicker/Punter-Slot #1225, QB-Slot #1226, Kickoff-Return #1227 -- Konsistenz-Audit
 * 25.10., Opus-Review): DIE 0,722 IM ABSATZ OBEN IST NICHT MEHR DER AKTUELLE STAND, auch wenn sie
 * dort als historische Tatsache (Stand #934, 15.09.) weiter richtig steht. Nach den drei Schritten
 * (je kaderfest gemessen, `scripts/miss-alle-disziplinen.mjs 48 football` UND
 * `scripts/messe-arena-einfluss.mjs football`, zwei unabhaengige Saatstroeme) steht Football
 * zuletzt bei **rho 0,807 je Spiel** (Median, n=48, rho Saison 0,902) -- WIEDER UEBER der
 * 0,80-Schranke. **Der Blocker ist seither Pp, nicht mehr rho** -- aber die am 14.10. gemessene
 * Pp-Abweichung (64,6/61,7, zwei Stroeme) war selbst UNGUELTIG: sie verglich gegen
 * `BASIS_JE_DISC.football`, und das ist seit PR #934 der Spiel-Eignungs-Override
 * (`spiel-eignung-overrides.ts`), nicht die gesperrte Matrix -- Football ist die einzige der
 * zwanzig Disziplinen mit dieser Abweichung (Task #196, 25.10., `PP_MATRIX_JE_DISC` in
 * `battle-mode.engine.js` behebt das fuer alle Pp-Messwerkzeuge). FRISCH KORRIGIERT GEGEN DIE
 * ECHTE MATRIX: Pp-Abweichung **121,0/120,1** -- NOCH WEITER ueber der 25-Pp-Schranke als vorher
 * berichtet, nicht naeher daran. spirit (Matrixgewicht 25, mechanisch 0 %) ist die groesste
 * Einzelabweichung; sechs der zwoelf Matrixattribute (awareness, will, spirit, intelligence,
 * charisma, stamina) tragen weiterhin mechanisch praktisch nichts bei (s. `stand-aller-
 * disziplinen.md` Abschnitt 14 fuer die volle Attributtabelle und die Begruendung, warum keine
 * neue Rezeptkalibrierung versucht wurde -- der einzige Hebel mit genug Gewicht, TEAMGEIST, ist
 * im aktuellen Rezept bereits nachweislich gescheitert). Football steht deshalb WEITERHIN nicht
 * unten in `ARENA_RESOLVED_DISCIPLINE_IDS`. `data/generated/disziplin-abnahme.json` (Schluessel
 * "football") haelt den korrigierten Stand (25.10.) jetzt fest; die frueher kursierenden Zahlen
 * (0,722/47,3 hier, 0,818/47,3 in frueheren Doku-Stellen, UND die 64,6/61,7 vom selben Tag) sind
 * alle ueberholt.
 *
 * BASKETBALL-NACHTRAG (18.10., PR #1289 "Give-and-Go-Schneiden", Task #123 -- Konsistenz-Audit
 * 25.10.): dieselbe Verschiebung wie bei Football, nur in die andere Richtung. Vorher 0,795 je
 * Spiel (16.10., unter der Schranke), nach PR #1289 **rho 0,810** (n=12 statt der sonst ueblichen
 * 24/48 -- wiederholte Browser-Abstuerze in dieser Session, s. PR-Text -- deshalb schwaecher
 * abgesichert als der Standardumfang, aber die einzige vorliegende Nachmessung) -- Rangtreue
 * besteht jetzt. **Pp verbesserte sich deutlich (43,0/44,7 -> 25,9/30,1), bleibt aber ueber der
 * 25-Pp-Schranke** -- der Blocker fuer Basketball ist seither Pp, nicht mehr rho.
 * `data/generated/disziplin-abnahme.json` (Schluessel "basketball") haelt diesen Stand (Commit
 * f6098377) fest; die 0,795 unten im Mengen-Kommentar war der Stand VOR dieser PR.
 *
 * BASKETBALL-NACHTRAG 2 (25.10., Task #194 Teil 2, docs/design/stand-aller-disziplinen.md
 * Abschnitt 17): letzter Blocker (Pp) geschlossen, OHNE ABWEHR oder LAUFTEMPO anzufassen -- der
 * Hebel war ZWEITCHANCE (torment/speed runter, awareness hoch, spirit hoch, isoliert von ABWEHR
 * gedreht, s. Kommentar dort in `public/mockups/battle-mode.rezepte.js`). Pp 25,9/30,1 -> 22,9/
 * 17,6 (beide Stroeme unter der 25-Schranke). rho dabei NICHT nur gehalten, sondern verbessert:
 * miss-feldspiel-rangtreue.mjs 0,832/0,825 -> 0,877/0,883, miss-alle-disziplinen.mjs (kaderfamilie-
 * Median, 5 Kader, n=24) 0,832. Basketball ist deshalb seit dieser Runde vollstaendig gewertet --
 * das macht Basketball zur VIERZEHNTEN Disziplin in `ARENA_RESOLVED_DISCIPLINE_IDS`, NICHT "20/20":
 * sechs Disziplinen bleiben weiterhin draussen (Football, Hockey, I-Spy, Battlefield, TDM, Mini-DM
 * -- s. die Liste "WER BEWUSST DRAUSSEN BLEIBT" unten). Die urspruengliche PR-Beschreibung von
 * Task #194 Teil 2 behauptete faelschlich "20/20"; das ist eine unabhaengig gepruefte Korrektur
 * (Opus-Review 26.10., s. docs/design/stand-aller-disziplinen.md).
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
 * WER BEWUSST DRAUSSEN BLEIBT, und aus welchem Grund (zuletzt nachgezogen 25.10.,
 * Konsistenz-Audit -- volle Zahlen/Quellen je Disziplin in data/generated/disziplin-abnahme.json):
 *  - FOOTBALL: rho 0,807 je Spiel (14.10., s. FOOTBALL-NACHTRAG oben) -- bestanden, NICHT mehr die
 *    0,722 von #934 (15.09.). **Blocker ist jetzt Pp**, nicht rho: Pp-Abweichung 64,6/61,7, WEIT
 *    ueber der 25-Pp-Schranke (sechs der zwoelf Matrixattribute tragen mechanisch praktisch nichts
 *    bei). Config/Referenz sind fertig, der Eintrag hier fehlt bewusst, bis eine eigene
 *    Pp-Rezeptrunde das behebt.
 *  - I-SPY (0,750, 15.10., docs/design/stand-aller-disziplinen.md Abschnitt 11 -- NICHT mehr die
 *    laengst ueberholte 0,684 aus der allerersten Produktivierungswelle): ACHSE 1 fehlt weiterhin,
 *    0,05 unter der 0,80-Schranke; Pp (13,6) bestand schon laenger.
 *  - BATTLEFIELD (0,399, 15.10.) und TDM (0,324, 07.10.) -- NICHT mehr 0,251/0,253, die Zahlen aus
 *    der allerersten Produktivierungswelle (05.09., ueberholt von mehreren seitherigen Messrunden,
 *    u. a. Domination-Layer 22.09. und V9-Handwerk-Versuch 07.10.): ACHSE 1 fehlt bei beiden klar.
 *  - MINI-DM: kein Mitglied dieser Chassis-Menge und wird es nie (eigener Pod-Resolve-Pfad, s.
 *    MINI_DM_FFA_VORLAUF_AKTIV unten) -- strukturell aussen, nicht "durchgefallen". Die alte
 *    0,094 hier war die FFA-Variante VOR dem 13.10./21.10.-Umbau und nicht mehr aussagekraeftig:
 *    das feste 4-Team-Chassis besteht (rho je Runde 0,80, 13.10.), die neue variable-k-FFA-
 *    Spieler-Ebene (rhoJeEvent) besteht dagegen bei KEINEM k=2..6 (0,608-0,686, 24.10.) -- s.
 *    disziplin-abnahme.json Schluessel "mini-dm"/"mini-dm-ffa" fuer beide Zahlen.
 *  - BASKETBALL: ab dieser Zeile NICHT mehr in dieser Liste, s. BASKETBALL-NACHTRAG 2 oben --
 *    Task #194 Teil 2 (25.10.) hat den letzten Blocker (Pp) geschlossen und Basketball steht
 *    seitdem in `ARENA_RESOLVED_DISCIPLINE_IDS` (als vierzehnte Disziplin, nicht als zwanzigste).
 *  - HOCKEY: ab dieser Zeile NICHT mehr in dieser Liste als eigener Absatz, s. den Inline-
 *    Kommentar direkt bei `ARENA_RESOLVED_DISCIPLINE_IDS` unten -- Chris' Ausnahme deckt nur rho,
 *    Pp (38,5/81,5, frisch gemessen 25.10.) verletzt die 25-Schranke weiterhin klar.
 */
export const ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
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
  // Football BEWUSST NICHT HIER: rho bestand zwischenzeitlich NICHT (0,722 seit #934, 15.09.),
  // besteht seit den Kickoff/QB/Kicker-Slot-Schritten (14.10.) aber WIEDER (0,807) -- der Blocker
  // ist seither Pp (64,6/61,7, weit ueber 25), nicht mehr rho, s. FOOTBALL-NACHTRAG im Kommentar
  // oben. Config/Referenz sind vorbereitet (s. ARENA_IMPACT_KONFIG_JE_DISZIPLIN in
  // battle-mode-arena-team-points.ts), der Produktiv-Eintrag folgt erst nach einer eigenen
  // Pp-Rezeptrunde.
]);

/** Die zwei Pflichtkriterien aus CLAUDE.md: Rangtreue (rho je Spiel > 0,80) und Budget-Methode (Pp ≤ 25). */
export type AbnahmeKriterium = "rho" | "pp";

export type AbnahmeAusnahme = {
  /** GENAU die Kriterien, die Chris abgenommen hat — jedes andere prueft der Waechter normal weiter. */
  deckt: readonly AbnahmeKriterium[];
  begruendung: string;
};

/**
 * CHRIS' AUSDRUECKLICH BESTAETIGTE AUSNAHMEN von der Pflichtabnahme, JE KRITERIUM (Projektaufsicht
 * 16.10.): eine Ausnahme deckt nur das, was Chris tatsaechlich abgenommen hat. Nur mit Zitat/Quelle,
 * neue Eintraege und neue Kriterien NUR mit Chris' Bestaetigung.
 *
 * HOCKEY: Chris hat die Rangtreue abgenommen — vor dem 21.09., also bevor die Pp-Pruefung Pflicht
 * wurde. Eine Pp-Ausnahme gibt es nicht. NACHGEHOLT (Task #195, 25.10.): die fruehere Pp-Zahl (39,4)
 * war aus der Doku uebernommen und nur mit n=6 gemessen (Chromium-Abstuerze bei n≥12). Die frische
 * Messung (n=24, zwei Saatstroeme) lief diesmal durch — der Absturz war ein DOM-Leck in der
 * Messsonde selbst (`messLaufStumm()`-Fix, `public/mockups/battle-mode.engine.js`), kein Problem der
 * Hockey-Mechanik — ERGEBNIS: 38,5 / 81,5 Pp, die 25-Pp-Schranke bleibt auf BEIDEN Stroemen klar
 * verletzt (s. `data/generated/disziplin-abnahme.json`, Eintrag "hockey", fuer die volle
 * Attribut-Diagnose). Hockey steht deshalb weiterhin NICHT in `ARENA_RESOLVED_DISCIPLINE_IDS` und
 * spielt ueber die PPS-Duell-Bruecke, bis eine Rezeptkalibrierung Pp unter die Schranke bringt oder
 * Chris die Pp-Ausnahme ausdruecklich gibt.
 */
export const ARENA_ABNAHME_AUSNAHMEN: ReadonlyMap<string, AbnahmeAusnahme> = new Map([
  [
    "hockey",
    {
      deckt: ["rho"],
      begruendung:
        "CLAUDE.md, Abschnitt 'Die Abnahme jeder Disziplin': Chris hat die Feldspieler-Rangtreue von Hockey " +
        "ausdruecklich abgenommen (Star Rang 1 in 58 %, erste zwei 78 %, kaderfest; docs/design/hockey-opus-review-nhl.md 5.3). " +
        "Gilt NUR fuer rho — eine Pp-Ausnahme hat Chris nie gegeben.",
    },
  ],
]);

/**
 * DIE DISZIPLINEN, DEREN ARENA-ERGEBNIS IN EINEM BATTLE-SAVE ZAEHLT (s. Kopfkommentar). Jeder
 * Eintrag MUSS in `ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS` stehen UND laut
 * data/generated/disziplin-abnahme.json bestehen (oder in `ARENA_ABNAHME_AUSNAHMEN` stehen) —
 * erzwungen von tests/disziplin-abnahme-guard.test.ts. Stand 16.10.: Messwerte und Begruendung je
 * Disziplin in docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md Abschnitt 3 -- seither
 * zweimal einzeln nachgezogen (Football 14.10., Basketball 18.10., s. "WER BEWUSST DRAUSSEN
 * BLEIBT" im Kommentar oben); aktuellster Stand je Disziplin immer in
 * data/generated/disziplin-abnahme.json.
 */
/**
 * MINI-DM-FFA-VORLAUF-SCHALTER (PR 5 des 6-PR-Opus-Plans 21.10., "Vorlauf-Verdrahtung", 24.10.).
 *
 * Mini-DM laeuft NICHT ueber dieses generische Chassis-Set — es hat einen eigenen Pod-Resolve-Pfad
 * (`lib/resolve/mini-dm-pod-resolve.ts`, vier Teams statt eines Zweier-Duells, 2-1-0-0 statt
 * Sieg/Unentschieden/Niederlage) und wird deshalb hier NIEMALS eingetragen (s.
 * `tests/disziplin-abnahme-guard.test.ts`, "Mini-DM ist NICHT arena-gewertet"). Dieser Schalter ist
 * der Mini-DM-eigene Analog-Schalter dazu: `lib/battle/arena-vorlauf-service.ts` prueft ihn, um zu
 * entscheiden, ob ein Mini-DM-Spieltag echte FFA-Rohdaten bekommt (`MiniDmFfaPodRohdaten`, ueber
 * `lib/resolve/mini-dm-ffa-matchday.ts` -> `berechneMiniDmPodOverrides({ ffaRohdatenByPodId })`,
 * mini-dm-pod-resolve.ts PR 4) oder beim bisherigen PPS-Pod-Pfad bleibt.
 *
 * CHRIS' ENTSCHEIDUNG (24.10., per Rueckfrage auf PR 3s ehrlichen Befund
 * `data/generated/disziplin-abnahme.json` Schluessel "mini-dm-ffa"): die Spieler-Ebene-Rangtreue
 * (rho je Event, die CLAUDE.md-massgebliche Zahl) liegt bei JEDEM k=2..6 unter 0,80 (0,608-0,686) —
 * schlechter als das bereits live geschaltete Hockey (0,670). TROTZDEM werden ALLE k=2..6
 * verdrahtet, weil CLAUDE.md ("Die Abnahme jeder Disziplin", Abschnitt zu Star-/Paartreue bei
 * kleinem n) genau diesen Fall vorwegnimmt: eine Saison hat je Disziplin nur eine Handvoll Spiele,
 * die nackte Rangkorrelation ist bei kleinem n die UNEHRLICHERE Abnahme. Mini-DMs Stern-/Paartreue
 * ist durchweg GUT (Star Rang 1 76-81 %, erste zwei 93-95 %, Paare ab 15 Punkten Abstand 99 %
 * richtig, bei jedem k) — vergleichbar mit Hockeys bereits von Chris abgenommener Star-Rangtreue
 * (58 %/78 %, `ARENA_ABNAHME_AUSNAHMEN` oben). Diese Faelle sind nicht identisch (Hockeys Ausnahme
 * deckt nur `rho`, Mini-DM steht nicht einmal in `ARENA_RESOLVED_DISCIPLINE_IDS` und braucht deshalb
 * keinen Eintrag in jener Map), aber dieselbe Begruendung trifft hier zu — Chris hat sie fuer
 * Mini-DM ausdruecklich bestaetigt, nicht diese PR von sich aus angewendet.
 *
 * NORMALER ROLLOUT-SCHALTER, wie jede andere Disziplin beim Scharfschalten einen hatte (hier ein
 * eigener Boolean statt eines Mengen-Eintrags, weil Mini-DM kein Chassis-Set-Mitglied ist/wird):
 * `false` faellt sofort und vollstaendig auf den bisherigen PPS-Pod-Pfad zurueck (Rollback in einer
 * Zeile, kein Deploy-Wettlauf) — `berechneMiniDmPodOverrides()` behandelt fehlende
 * `ffaRohdatenByPodId` ohnehin schon immer als "kein FFA-Ergebnis fuer diesen Pod", s. dortiger
 * Kommentar.
 */
export const MINI_DM_FFA_VORLAUF_AKTIV = true;

export const ARENA_RESOLVED_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
  "gewichtheben",
  "speed-schach",
  "showcase",
  "eiskunstlauf",
  "breaking",
  "wettessen",
  "tennis",
  "fechten",
  "staffel",
  "takeshis-castle",
  "time-trial",
  "spurt",
  "climbing",
  // BASKETBALL (Task #194 Teil 2, 25.10., s. BASKETBALL-NACHTRAG 2 im Kopfkommentar): letzter
  // Blocker (Pp 25,9/30,1) auf 22,9/17,6 gesenkt, rho dabei verbessert statt nur gehalten --
  // bestanden auf beiden Pflichtkriterien, deshalb ab jetzt gewertet.
  "basketball",
  // HOCKEY BEWUSST NICHT HIER (25.10., Task #195): Chris' Ausnahme deckt nur rho. Pp ist jetzt frisch
  // gemessen (n=24, zwei Saatstroeme: 38,5 / 81,5) — die 25-Pp-Schranke bleibt klar verletzt, s.
  // Kopfkommentar und ARENA_ABNAHME_AUSNAHMEN. Bis zu einer Rezeptkalibrierung oder Chris' Pp-Freigabe
  // ueber die PPS-Duell-Bruecke.
]);

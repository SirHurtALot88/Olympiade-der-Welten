# Gesamtstand-Audit — sind von allen zwanzig Disziplinen die aktuellen Versionen live? (13.10.)

Auftrag Chris, 13.10., wörtlich: „prüfe dass von allen diszis dann auch die aktuellen versionen
drin sind". Reine Lesepruefung, kein Code geaendert. Gegenstand: fuer alle zwanzig Disziplinen
pruefen, ob das, was als „validiert" dokumentiert ist, auch tatsaechlich *lauffaehig und wirksam*
ist — nicht hinter einem vergessenen QA-Schalter, nicht nur auf einem nie gemergten Branch, und
nicht durch eine Doku, die den Code ueberholt hat.

**Kurzfassung der Reihenfolge, in der dieses Dokument das liest:** (a) der Fund, der alles
andere relativiert — Battle Mode vs. Manager Mode; (b) Disziplin-fuer-Disziplin-Tabelle; (c)
Schalter- und Doku-Drift-Funde im Detail; (d) Branches/Worktrees, die echte, nie gemergte Arbeit
tragen.

---

## (a) Der wichtigste Befund: ALLE sieben echten Spielstaende laufen im Manager Mode — strukturell, nicht durch Chris' Wahl

**Nachgemessen, nicht vermutet.** Frisches `live-save`-Abbild gezogen (`git fetch origin
live-save`, Commit `216c17ae…`, 13.10. 08:50 UTC — am selben Tag wie dieser Audit, Spiegel also
nicht veraltet, s. CLAUDE.md „Zuerst pruefen"; `bug-reports` ebenfalls frisch, 08:52 UTC). Alle
sieben Zeilen aus `game_metadata.payload_json` einzeln gelesen:

| save_id | `scenarioMeta.gameMode` | angelegt (real) | zuletzt aktualisiert (real) |
|---|---|---|---|
| new-game-1784747079649-n90y4m | **fehlt (= „manager")** | 22.07.2026 | 26.07.2026 |
| new-game-1785412846578-h0z7cl | **fehlt** | 30.07.2026 | 30.07.2026 |
| new-game-1785823388048-1hf25q | **fehlt** | 04.08.2026 | 11.08.2026 |
| new-game-1786465783606-0kalpx | **fehlt** | 11.08.2026 | 13.08.2026 |
| new-game-1786626914058-hwz8fk | **fehlt** | 13.08.2026 | 14.08.2026 |
| save-1786699040510-89rv3s | **fehlt** | 14.08.2026 | 14.08.2026 |
| new-game-1787123325719-swnjlk | **fehlt** | 19.08.2026 | 23.08.2026 |

`resolveGameMode()` (`lib/season/game-mode.ts`) übersetzt ein fehlendes Feld unbedingt nach
`"manager"`. Damit sind **alle sieben** Spielstände Manager-Mode-Saves — **0 von 7**, nicht nur
„die meisten".

**Das ist kein Zufall, den Chris haette anders treffen koennen — es ist strukturell
unmoeglich, dass irgendeiner dieser sieben Saves Battle Mode ist.** Alle sieben wurden
zwischen dem 22.07. und 19.08.2026 angelegt. Der Battle-Mode-Spielwahl-Schalter
(`docs/design/battle-mode-spielmodus-plan.md`, der `new-game-mode-picker` im Anlege-Assistenten,
`app/api/new-game/route.ts` Zeile 19-22) kam laut Git-Historie erst am **26.09.2026** ins Projekt
(`git log --diff-filter=A -- docs/design/battle-mode-spielmodus-plan.md` → `15322d26`, 26.09.).
Zu dem Zeitpunkt, als jeder der sieben Saves angelegt wurde, gab es die Option „Battle Mode"
im Spiel **noch gar nicht** — Chris hat nicht „Manager Mode gewaehlt", er hatte keine Wahl, weil
das Feature erst fuenf bis neun Wochen spaeter existierte. Keiner der sieben Saves wurde seither
neu angelegt oder migriert (letztes `updated_at` unter den sieben: 23.08.2026).

**Die Konsequenz fuer die Produktionsanbindung ist radikal.** `isBattleModeArenaEligible`
(`lib/resolve/legacy-matchday-resolve-engine.ts:347`, `Boolean(base.gameState &&
isBattleModeSave(base.gameState))`) ist die EINE Weiche, die entscheidet, ob ein Arena-Ergebnis
den alten PPS-Rang-Pfad ueberhaupt ersetzen darf (`:765-773`). Sie ist fuer jeden der sieben Saves
`false`. Das bedeutet: **die gesamte `ARENA_RESOLVED_DISCIPLINE_IDS`-Menge
(`lib/battle/arena-resolved-disciplines.ts`) — alle fuenfzehn dort gelisteten Disziplinen,
nicht nur Staffel — hat heute auf Chris' Ergebnisse exakt null Wirkung**, unabhaengig davon, wie
gut jede einzelne kalibriert ist. Basketball, Gewichtheben, Hockey, Speed-Schach, Showcase,
Eiskunstlauf, Breaking, Wettessen, Tennis, Fechten, Staffel, Takeshi's Castle, Time-Trial, Spurt
und Climbing laufen in jedem seiner sieben Saves exakt auf dem alten PPS-Rang-Pfad, egal was ihr
Arena-Motor im Hintergrund an Boxscores produziert.

**Das ist kein neuer Fund dieses Audits — er war in Stuecken schon da, nur nie projektweit
zusammengezogen:**
- **09.09.** (`docs/pm-briefings/opus-review-pr-867-produktivierungswelle-2-09-09.md`, Abschnitt 0
  und Tafelzeile „Battle-Mode-Nutzung im Live-Save"): unabhaengiger Review bestaetigt bereits
  „0 von 7 Saves haben `gameMode:"battle"`" — zu dem Zeitpunkt galt das erst fuer die ersten
  fuenf arena-aufgeloesten Disziplinen (Eiskunstlauf/Breaking/Wettessen/Tennis/Fechten) plus
  Basketball/Hockey/Gewichtheben.
- **12.10.** (`docs/design/stand-aller-disziplinen.md` Zeilen 50-61, Achtzehnter Nachtrag,
  unabhaengiges Review zu PR #1172): derselbe Befund, diesmal konkret an Staffels neuem
  Paar-Bonus-Badge aufgehaengt — „wirkt heute an keinem einzigen Live-Spielstand (alle sieben
  laufen im Manager Mode)", mit dem Zusatz „dasselbe gilt seit PR #1154 schon fuer O2 ‚Marke und
  Zug'" und „dieselbe Einschraenkung, die in der Tabelle unten bei fast jeder Disziplin als
  ‚nicht im echten Spielstand' steht".
- **Dieser Audit (13.10.)** bestaetigt es am frischen Spiegel **fuer alle fuenfzehn**
  `ARENA_RESOLVED_DISCIPLINE_IDS`-Mitglieder zugleich, nicht nur fuer die eine Disziplin, bei der
  es zuletzt an einem UI-Badge auffiel — und zeigt, dass die Ursache nicht Chris' Entscheidung,
  sondern das Alter der Saves relativ zum Feature-Start ist.

**Was das heisst, fuer die Prioritaet jeder weiteren Produktions-Arbeit:** Rangtreue-Kalibrierung
je Disziplin bleibt wichtig fuer den Tag, an dem Battle Mode wirklich genutzt wird (neue Saves,
oder eine kuenftige Migration bestehender Saves) — aber **heute, fuer Chris' sieben laufenden
Spielstaende, aendert keine noch so gute Disziplin-Kalibrierung irgendein Ergebnis.** Der
hoechste Hebel liegt nicht in weiteren Pp-/rho-Feinschliff-Runden einzelner Disziplinen, sondern
in der Frage, *wie* ein bestehender Manager-Mode-Save jemals in den Battle Mode kommen soll (neue
Option beim naechsten Saisonstart? Migrationspfad fuer einen laufenden Save? Chris' Entscheidung,
nicht Teil dieses Audits).

---

## (b) Disziplin fuer Disziplin

Quelle rho/Pp, wo nicht anders vermerkt: `docs/design/stand-aller-disziplinen.md`, Zwoelfter
Nachtrag (26.09., komplette Neumessung) fuer die Pp-Spalte, Dreizehnter Nachtrag (29.09., rho
jetzt MIT Mutator-Wurf wie im Spiel) fuer rho, soweit nicht durch eine spaetere, disziplin-eigene
Nachmessung ueberholt (dann ist diese jeweils genannt). „Resolved" = Mitgliedschaft in
`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/battle/arena-resolved-disciplines.ts`) — s. Abschnitt (a):
unabhaengig davon heute ohne Wirkung auf jeden der sieben Saves.

| Disziplin | Resolved? | rho/Spiel (aktuell) | Pp (aktuell) | Anmerkung |
|---|:---:|---:|---:|---|
| Basketball | Ja | 0,756 | 33,4 (VERLETZT) | Einzige Disziplin, die noch ueber den alten Legacy-Pfad OHNE Arena-Abhaengigkeit lief, bevor Battle Mode ueberhaupt existierte — bleibt trotzdem vom (a)-Befund betroffen, sobald ein Battle-Mode-Save existiert. Pp-Verletzung erst am 26.09. entdeckt (VORHER nie gemessen). |
| Hockey | Ja | 0,640 (alle 12) / 0,725 (Feldspieler, Chris' eigene Abnahme) | 39,4 (VERLETZT, n klein) | Chris hat die Feldspieler-Rangtreue ausdruecklich abgenommen (CLAUDE.md). Pp-Messung bei n=6 statt 24 (Chromium-Abstuerze) — Zahl mit Vorsicht lesen. |
| Gewichtheben | Ja | 0,836 | 29,1 (VERLETZT, Regression seit 27.09.) | `docs/design/gewichtheben-pp-regression-befund-01-10.md`: der echte n=48-Wert liegt strukturell auf der 25-Pp-Schranke (2 von 5 Stroemen drueber), nicht bei den fruehen 19,1 — Nachmessung bestaetigt, kein Code seit 27.09. veraendert `wert()`. Dedizierte Kalibrierrunde offen. |
| Speed-Schach | Ja | 0,898 (Flag aus/Stufe1 bit-identisch) / 0,909 (Stufe 2, **seit PR #1154 Standard**) | 17,3/18,3 (bestanden) | S. Abschnitt (c): Doku beschreibt Stufe 2 noch als „hinter Flag AUS". |
| Showcase | Ja | 0,835 | 28,4/29,3 (VERLETZT, WAGNIS-Fix-Nebenwirkung) | Fertigstellungsgrad 91 % (`gesamtstand-…-09-10.md`, 15. Nachtrag). |
| Eiskunstlauf | Ja | 0,866 | 20,2/20,2 (bestanden) | — |
| Breaking | Ja | 0,808 | 14,3/13,9 (bestanden) | Speicherleck in der Messung behoben (15. Nachtrag). |
| Wettessen | Ja | 0,866 (Flag aus) / 0,910 (K1+K2, **seit PR #1154 Standard**) | 13,6/14,7 (bestanden, Flag-aus-Basis) | S. Abschnitt (c): Doku beschreibt K1+K2 noch als „hinter Flag AUS". |
| Tennis | Ja | 0,813 | 53,9/56,4 (VERLETZT, WAGNIS-Fix-Nebenwirkung) | Fertigstellungsgrad 89 % (Achtzehnter Nachtrag, `gesamtstand-…`). |
| Fechten | Ja | 0,860 | 40,6/42,1 (VERLETZT, WAGNIS-Fix-Nebenwirkung) | — |
| Staffel | Ja | 0,933 (n=48/96, nach Tempo-Kanal-Fix 06.10. + Marke/Zug jetzt Standard) | 21,1/22,0 (06.10., bestanden) → 20,9/21,6 bzw. 22,2/21,5 (O7, 11.10.) | Sentinel vigilante-armageddon jetzt 0,845 (vorher 0,756/0,698). Beste Rangtreue im Feld. O7 „Eingespielte Paare" ohne Schalter aktiv (11.10., Klasse S). |
| Takeshi's Castle | Ja | 0,871 (Mutator) / 0,883 (13.09.-Fund `fallenKoennen`) | 36,4 (VERLETZT, n klein) | — |
| Time-Trial | Ja | 0,923 | 22,8 (bestanden, nah an der Schranke) | — |
| Spurt | Ja | 0,880 (Flag aus) / 0,910 (S-N1+S-N2, **seit PR #1154 Standard**) | 11,4 (bestanden, Flag-aus-Basis) / 18,7 / 15,6 (Paket) | S. Abschnitt (c): Doku-Zeile beschreibt Paket noch als „Standard aus". |
| Climbing | Ja | 0,791 (Mutator-Einzelsatz) / 0,801 (gepaart ueber 6 Saatsaetze, 29.09.) | 16,4/16,9 (bestanden) | Steht laut Dreizehntem Nachtrag selbst „auf der Schranke" — kein Blocker, aber kein Puffer. |
| **Football** | **Nein** | 0,722 (15.09., Stand nach Spiel-Eignung-Override, so im Code zitiert) / **0,818** (26.09., frische Neumessung, kein Football-PR dazwischen) | **47,3 (klar VERLETZT)** | **Drift-Fund, s. (c):** der Code-Kommentar in `arena-resolved-disciplines.ts` nennt als Ausschlussgrund eine rho-Zahl (0,722), die eine spaetere, vollstaendigere Neumessung (26.09.) nicht mehr bestaetigt (0,818, bestanden). Der Ausschluss selbst bleibt trotzdem richtig — nur aus einem anderen, im Code gar nicht genannten Grund: Pp 47,3 verletzt die seit 21.09. verbindliche ≤25-Schranke aus CLAUDE.md klar. |
| I-Spy | Nein | 0,750 (n=48, Ist-Stand nach zwei verworfenen Konzeptrunden P1/I-2k) | 13,6 (bestanden) | rho bleibt unter 0,80 — Pp ist kein Blocker hier, Konzept ist es. |
| Mini-DM | Nein | 0,595/0,643 (Saison, mit P1 Zusammenhalt-als-Handwerk, **seit 07.10. Standard**) | 55,6/43,9 (07.10., VERLETZT, aber deutlich kleiner als vorher 77,9/85,2) | Gemessen wird weiterhin das 4-gegen-4, nicht das FFA. |
| TDM | Nein | 0,324/0,247 (unveraendert — P1 gebaut, aber `persHandwerk:[]` bleibt leer) | 51,4 (VERLETZT) | Mit P1 gemessen 0,416/0,432 — **absichtlich nicht eingeschaltet**, weil die Pflicht-Pp-Messung (Kriterium F) wegen Messmaschinen-Last nicht fertig wurde. Kein stiller Rueckstand — dokumentiert als offen. |
| Battlefield | Nein | 0,399/0,391 (unveraendert, gleicher Grund wie TDM) | 54 (VERLETZT, mit P1/V9 sogar schlechter: 62,8/85,4) | Abbruchregel korrekt angewendet (`persHandwerk:[]` nach Pp-Verletzung). |

---

## (c) Stale-Schalter und Doku/Code-Drift — im Detail

### c.1 — Vier Nachtkonzept-Pakete sind bereits Standard **an**, drei Doku-Stellen sagen noch „Standard aus"

PR **#1154** („Konsolidierung: sechs Nachtkonzept-Disziplinen live schalten", Commit `de7a54d9`,
06.10.) hat genau das getan, was CLAUDE.md als Konvention verlangt: validierte Pakete, die
zunaechst hinter einem Default-aus-QA-Schalter gebaut wurden, nach Chris' Freigabe auf
Standard-an umgestellt. Nachgezaehlt im heutigen Code:

- `public/mockups/battle-mode.engine.js:33509` — `let staffelMarkeZug={aktiv:**true**, …}`
- `public/mockups/battle-mode.engine.js:33525` — `let spurtSaeule={aktiv:**true**, …}`
- `public/mockups/battle-mode.engine.js:16143` — `const BUEHNE_FLAGS={speedSchachUhr:**2**,
  wettessenMauer:**2**}` (Stufe 1+2 bzw. K1+K2, nicht nur „an")

Das ist korrekt und entspricht genau dem Muster, das CLAUDE.md fuer Staffels
`staffelMarkeZug` schon als Beispiel nennt. **Was NICHT nachgezogen wurde: drei Stellen in
`docs/design/stand-aller-disziplinen.md`, obwohl PR #1154 denselben Dateinamen selbst schon
392 Zeilen lang bearbeitet hat** (nur an anderer Stelle — ein neuer Nachtrag oben, nicht die
bestehenden Abschnitte unten):

1. **Zeile 1453**, Abschnittsueberschrift: „## 8. Speed-Schach: … Stufe 1 + 2 — gebaut, **hinter
   Flag AUS** (Nachtrag 04.10.)" — der Flag steht seit 06.10. auf 2, nicht auf 0.
2. **Zeile 1502**, Abschnittsueberschrift: „## 9. Wettessen: … (K1 + K2) — gebaut, **hinter Flag
   AUS** (Nachtrag 04.10.)" — derselbe Fall, K1+K2 ist seit 06.10. Standard.
3. **Zeile 1374**, Staffel-Zeile der 5b-Tabelle: „Paket O2 ‚Marke und Zug' hinter QA-Schalter
   (**Standard aus**)" — seit #1154 Standard an (das Dokument wusste das bereits oben in Zeile 55
   des Achtzehnten Nachtrags, hat die aeltere Zeile 1374 aber nicht korrigiert).
4. **Zeile 1376**, Spurt-Zeile derselben Tabelle: „Paket S-N1+S-N2 … hinter QA-Schalter gebaut
   (**Standard aus**, bit-identisch)" — ebenfalls seit #1154 Standard an.

Dieselbe Veraltung sitzt **auch im Code selbst**, nicht nur in der Doku: der Kommentarblock
direkt ueber `BUEHNE_FLAGS` (`battle-mode.engine.js:16127-16140`) sagt woertlich „Solange alle
auf 0 stehen (**jeder echte Spielstand**), laeuft JEDE Zeile der Buehne bit-identisch zu vorher"
— zwei Zeilen darueber steht `{speedSchachUhr:2, wettessenMauer:2}`. Kein Verhaltensfehler (der
Code tut, was die Werte sagen, nicht was der Kommentar sagt), aber ein Kommentar, der sich selbst
widerspricht und jeden kuenftigen Leser in die Irre fuehrt.

**Praktische Tragweite, s. Abschnitt (a): null fuer Chris' sieben Saves heute** — Buehnen-
Disziplinen sind ohnehin nur ueber den Arena-Pfad erreichbar, der in jedem Manager-Mode-Save
abgeschaltet bleibt. Trotzdem lohnt sich die Korrektur: die naechste Person (oder der naechste
Agent), die anhand dieser Doku einschaetzt „ist das noch experimentell", liest etwas, das dem
Code seit einer Woche nicht mehr entspricht.

### c.2 — Football: richtige Entscheidung, falsch begruendet

`lib/battle/arena-resolved-disciplines.ts` begruendet Footballs Ausschluss ausschliesslich mit
einer rho-Zahl vom 15.09. (0,722, nach dem Spiel-Eignung-Override unter die 0,80-Schranke
gefallen). Die eigene Projekt-Doku zeigt zehn Tage spaeter (Zwoelfter Nachtrag, 26.09.,
`stand-aller-disziplinen.md` Zeilen 441-444) eine frische, vollstaendige Neumessung mit **0,818**
— bestanden — ohne dass zwischen den beiden Messungen irgendeine Football-PR gemergt wurde. Die
Doku selbst ordnet den Sprung nicht einer Codeaenderung zu, sondern nennt ihn einen Fall von
„eine Tabelle, die nur bei Bedarf einzelne Zeilen nachzieht, veraltet leise" — dieselbe Doku
weiss also um die eigene Unsicherheit bei dieser Zahl.

**Der Ausschluss selbst bleibt trotzdem richtig** — nur aus einem Grund, den der Code-Kommentar
gar nicht nennt: dieselbe Nachmessung vom 26.09. (Pp-Tabelle, Zeile 478) zeigt Football bei
**47,3 Pp**, fast doppelt so hoch wie die seit 21.09. verbindliche ≤25-Schranke aus CLAUDE.md.
Football faellt heute an der Pp-Pflichtpruefung durch, nicht (mehr nachweisbar) an rho. Wer
`arena-resolved-disciplines.ts` liest, erfaehrt davon nichts — der Kommentar zitiert eine
rho-Zahl, die durch eine spaetere, im selben Projekt gefuehrte Messung ueberholt ist, und
verschweigt den tatsaechlich aktuellen, mandatorischen Blocker. Empfehlung fuer eine kuenftige
Pflege-Runde (nicht Teil dieses Audits): den Kommentar auf den Pp-Befund umstellen, bevor jemand
Football allein aufgrund der veralteten rho-Zahl fuer „fast fertig" haelt.

### c.3 — Kein weiterer Fund dieser Art

Keine andere stichprobenhaft gepruefte Disziplin zeigt denselben Widerspruch zwischen einem
Code-Standardwert und seiner eigenen Beschreibung. TDM/Battlefield/Mini-DM sind im Code UND in
der Doku konsistent als „gebaut, aber (TDM/Battlefield) bewusst nicht eingeschaltet" bzw.
(Mini-DM) „eingeschaltet" dokumentiert — das ist die Abbruchregel aus CLAUDE.md korrekt
angewendet, kein Drift.

---

## (d) Branches und Worktrees — eine fokussierte Pruefung

`git branch -a` listet **1113** Referenzen, davon ueber 1000 `worktree-agent-*`-Branches —
das sind Session-Artefakte einzelner Agenten-Laeufe, keine Feature-Arbeit, und wurden nicht
einzeln geprueft. Von den uebrigen ~50 benannten Branches wurde eine Stichprobe mit
`git log origin/main..<branch>` gegen den heutigen `origin/main`-Stand geprueft (enthaelt der
Branch Commits, die NICHT Vorfahren von `main` sind — und falls ja: ist der Inhalt trotzdem
schon unter einem anderen Commit-Hash auf `main`, z. B. durch Squash-Merge).

**Ergebnis: fast alle geprueften Branches sind Ueberreste bereits gemergter PRs**, nachgewiesen
per Commit-Message-Grep gegen `origin/main` (Squash-Merge aendert den Hash, nicht den Text):

| Branch | Enthaelt | Bereits auf `main` als |
|---|---|---|
| `staffel-o7-eingespielte-paare-11-10` | O7-Paar-Bonus | `555f0b1e` (#1172, HEAD von `origin/main`) |
| `team-feier-staffel-paket-11-10` | Staffel-Jubelszenen | `cef7138b` (#1170) |
| `arena-persoenlichkeit-p1-paket-07-10` | Mini-DM/TDM/Battlefield P1 | `51d2d458` (#1168) |
| `feldspiel-b2a-freiwurf-paket-07-10` | Basketball-Freiwurf-Kanal | `52bd6c1c` (#1164) |
| `gewichtheben-paket2-mannschaftstaktik` | Gewichtheben G1+G4 | `d9338505` |
| `gewichtheben-pp-befund-01-10` | Pp-Diagnose-Doku | `9ecdd857` |
| `climbing-kalibrierung-tempospanne-01-10` | Climbing-Rezept-Fix | `6fe5f0c6` |
| `fix-flaky-chromium-zombie-tests` | Test-Infra-Fix | `9d7f641c` (#1156) |
| `feldspiel-f1-b1-task33` | Football-EPA (verworfen) + Basketball-B1 | `4df164ae` (#1149) |
| `nachtkonzept-mini-dm-03-10` (und sieben weitere `nachtkonzept-*-03-10`) | reine Konzept-Docs | je ein eigener gemergter Commit (Stichprobe: `12bf7a01`, #1145) |
| `broadcast-paket-abc-06-10` | Broadcast A/B/C | `091ce7d2` (#1155) |
| `tdm-broadcast-paket-07-10` | TDM-Ticker-Fix | `ac863426` (#1157) |
| `time-trial-broadcast-paket-07-10` | Time-Trial-Ticker-Fix | `cae900ac` (#1159) |
| `schach-fechten-broadcast-paket-07-10` | Schach/Fechten-Ticker-Fix | `9a2ffd27` (#1160) |
| `takeshi-ticker-paket-07-10` | Takeshi-Ticker-Fix | `42947814` (#1161) |
| `feldspiel-hc-torwartpass-paket-07-10` | Hockey-Torwartpass (Review) | explizit „NICHT mergen" im eigenen Commit-Text |
| `i-spy-kennerblick-paket-07-10` | I-2k „Kennerblick" | explizit „Diagnose-Commit, NICHT mergen" (verworfen, s. Tabelle oben) |

Diese Branches koennen bedenkenlos geloescht werden (Chris' Entscheidung, nicht Teil dieses
Audits) — sie tragen keine verlorene Arbeit, nur alte Zwischenstaende bereits gelandeter PRs.

**Eine Ausnahme gefunden, die eine zweite Pruefung wert ist:** `wegc-6v6-vergleich-05-10`
(und sein frueherer Zwischenstand `visual-fix-sandsack-05-10`, derselbe Commit-Strang). Zwoelf
Commits zu Gewichthebens Sandsack-Finale („Weg C": parallele Traeger-Stationen,
Sechser-Vergleich, eigene Trage-Pose), **keiner davon ist Vorfahre von `origin/main`**, und
keiner taucht unter anderem Namen in `origin/main`s Historie auf (nachgeprueft per Commit-Text-
Grep UND per Code-Grep: `grep -c "wegC\|Jutesack" battle-mode.engine.js` auf `origin/main` → 0).
Die meisten dieser Commits sind ausdruecklich als Messvarianten gekennzeichnet („hinter Flag,
standardmaessig AUS", „Messvariante, kein Spielpfad") — bewusst experimentell, kein Anspruch auf
sofortiges Live-Schalten. **Zwei Commits sind aber explizit „Klasse A"** — die projekteigene
Kennzeichnung fuer „kein Schalter noetig, sicher zu mergen":

- `bf1403e4` — „Gewichtheben Sandsack-Finale Weg C, Stufe 1: echte Trage-Pose (6 Last-Stufen,
  Gelenk-Rig, Klasse A)"
- `9c679869` — „Gewichtheben Sandsack-Finale Trage-Pose: Jutesack statt ‚Kuchen', kein Schild
  beim Tragen (Klasse A)"

Beide sind reine Praesentations-Fixes (Trage-Pose/-Requisite), nach Projekt-Konvention also ohne
Rangtreue-Risiko. Sie wirken fertig, referenzartig dokumentiert und nie gemergt. Empfehlung:
jemand mit Kontext zu diesem Branch sollte kurz pruefen, ob diese zwei Commits (nicht der ganze
Messvarianten-Strang) cherry-gepickt werden sollten — dieser Audit bewertet das nicht selbst,
da nicht klar ist, ob der Branch seit dem 05.10. aus einem bekannten Grund zurueckgestellt wurde.

**Drei weitere, zur Zeit DIESES Audits aktiv belegte Worktrees** (`agent-ad22673e…`,
`agent-ae4de0647…`, `mini-dm-ffa-gewichtung-int-spirit`, alle als `locked` markiert) wurden nicht
angefasst — sie gehoeren zu parallel laufenden Sitzungen, nicht zu vergessener Arbeit. Zwei
`detached HEAD`-Checkouts unter dem Scratchpad-Pfad eines fremden Sessions-Verzeichnisses
(`b2ahc-basis`/`b2ahc-nach`) liegen ausserhalb der eigentlichen Branch-Liste und sind vermutlich
Referenzkopien eines frueheren Vergleichslaufs, kein Repo-Fund.

---

## Zusammenfassung

1. **Battle Mode ist fuer Chris' sieben echte Saves heute irrelevant — strukturell, nicht durch
   Wahl.** Alle fuenfzehn `ARENA_RESOLVED_DISCIPLINE_IDS`-Disziplinen haben null Wirkung auf
   seine aktuellen Ergebnisse. Das war in Teilen schon am 09.09. und am 12.10. dokumentiert, hier
   zum ersten Mal projektweit an allen fuenfzehn gleichzeitig bestaetigt.
2. **Vier Nachtkonzept-Pakete (Staffel O2, Speed-Schach Stufe 2, Wettessen K1+K2, Spurt
   S-N1+S-N2) sind seit PR #1154 (06.10.) korrekt auf Standard-an umgestellt** — nur drei
   Textstellen in `stand-aller-disziplinen.md` und ein Code-Kommentar in
   `battle-mode.engine.js` wurden dabei nicht nachgezogen und sagen noch „Standard aus".
3. **Footballs Ausschluss aus der Produktion ist weiterhin richtig, aber im Code falsch
   begruendet** (zitiert eine ueberholte rho-Zahl statt des tatsaechlichen, aktuellen
   Pp-Blockers).
4. **Keine verlorene, fertige Produktions-Arbeit in den ~50 echten Feature-Branches** — mit einer
   Ausnahme (`wegc-6v6-vergleich-05-10`/`visual-fix-sandsack-05-10`, zwei unflagged
   Praesentations-Commits zu Gewichthebens Sandsack-Trage-Pose), die eine kurze menschliche
   Entscheidung verdient.

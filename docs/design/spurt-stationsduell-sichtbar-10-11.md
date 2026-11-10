# Spurt: Stationsduell sichtbar, mit Sieger und PP-Bonus (10.11.)

Anlass, Chris per Screenshot: „hier steht immer was von duellen, die sieht man aber gar nicht".
Danach die Vorgabe für die Lösung: „Gewonnene duelle können für die Spieler auch in die PPs mit
beitragen, bringen dem team aber keine zusätzlichen punkte fürs scoring".

## Vorher

Die S-N5-Tafel (`public/mockups/battle-mode.engine.js`) erschien, sobald ein Heim- und ein
Gastläufer gleichzeitig an derselben Station standen (Abstand < 0,03 Strecke). Sie zeigte
„DUELL · SEIL" und zwei **unabhängige** Balken: die Rest-Stationszeit jedes Läufers
(`u.huerde/u.stationDauer`). Es gab keinen Sieger und keine Wirkung. Optisch waren das zwei
Countdowns nebeneinander, kein Duell.

Zwei Nebenbefunde:
- Der Kommentar sagte „nur mit QA-Schalter `spurtSaeule`", aber `spurtSaeule.aktiv` steht
  standardmäßig auf `true`. Die Tafel lief also live.
- Die Tafel saß 58 px über der höheren der beiden Bahnen. Bei Duellen auf den oberen Bahnen lag
  sie damit unter der Anzeigetafel (im Standbild nachgemessen: „DUELL · HÜRDE · TECHNIK" halb hinter
  „19 · 36 · 0:19").

## Nachher

**Siegerermittlung.** Ein Stationsduell gewinnt, wer die Station **zuerst verlässt**. Es gibt
keinen zweiten Würfel. Entscheidend ist die Station selbst: ihre Dauer hängt am Sub-Skill des
Stationstyps (`hindernisTypen`). Hinzu kommen Ankunftszeit und Kriechanteil:

| Station | entscheidender Sub-Skill |
|---|---|
| Hürde, Strohballen | TECHNIK |
| Balken, Wassergraben | WENDIGKEIT |
| Palisade, Seil, Mauer | WUCHT |

Am Seil gewinnt also, wer Zugkraft hat. Verlassen beide die Station im selben Schritt,
entscheidet zuerst, wer tiefer unter 0 gerutscht ist, also im Schritt früher frei war. Danach
entscheidet der höhere Stations-Sub-Skill, zuletzt gewinnt Heim. Die Paarung erfolgt greedy:
Jeder Heimläufer an einer Station bekommt den nächsten freien Gastläufer derselben Station
(< 0,03). Ein Läufer steht in höchstens einem offenen Duell. Wer verliert und noch an der Station
steht, kann vom nächsten Ankömmling erneut gefordert werden.

**Was man sieht** (alles mit vorhandenen Mitteln, kein neues PixelLab-Asset):
- **Tauzieh-Tafel** statt zweier Balken: ein Balken, Heim links in Orange, Gast rechts in Blau.
  Der Zeiger startet in der Mitte und wandert über die Duelldauer zum Läufer, der vorn liegt
  (weniger Rest-Stationszeit). Beim Ausgang steht er also beim Sieger. Kippt das Duell, weil ein
  Rempler die Station verlängert, kippt auch der Zeiger. Kopfzeile:
  „DUELL · SEIL · WUCHT". Der Name des Vorne-Liegenden ist in seiner Teamfarbe gesetzt.
- **Ort der Tafel:** rechts neben der Station auf halber Höhe zwischen den Duellanten, in die
  Spielfläche geklemmt. Zwei dünne Linien in Teamfarbe führen zu den beiden Läufern.
- **Sprites:** Der Vorne-Liegende schiebt sich bis zu 6 px nach vorn, der andere wird
  zurückgedrückt (Muster `buehneTauziehVersatz`). Dazu ein leichtes Ringen. Beide wechseln in
  die vorhandene Stoßpose (`lunge`, dieselbe wie beim Rempler): der Vorne-Liegende öfter, der
  Sieger beim Ausgang einmal kurz.
- **Ausgang:** Am Sieger blitzt ein Ring in seiner Teamfarbe auf. 1,6 s lang steht dann die Tafel
  „NAME GEWINNT DAS DUELL" / „SEIL · gegen NAME · +Duell-PP". Im Ticker erscheint eine Zeile
  „X gewinnt das Duell am Seil gegen Y.".

Im Standbild geprüft (Live-Rennen, Arena-Reiter): Tafeln und Siegerzeilen sind auf den oberen
wie den unteren Bahnen sichtbar.

## PP-Bonus

- **Motor:** `spieleBahn("spurt", …)` liefert je Boxscore-Eintrag zusätzlich `duelle`, die Zahl
  der gewonnenen Stationsduelle. `wert` und `seiten` bleiben unverändert.
- **Runner** (`lib/battle/arena-headless-runner.ts`): Er reicht `duelle` durch. Das Feld ist
  optional und fehlt bei jeder anderen Disziplin.
- **Gutschrift** (`lib/resolve/battle-mode-arena-team-points.ts`):
  `computeIndividualBoxscorePpsFromFixtureResults()` addiert nach der Impact-Kurve
  `ppsAusStationsduellen()`. Je Sieg gibt es **0,1 PP**, gedeckelt bei **0,5 PP** je Rennen
  (`SPURT_STATIONSDUELL_PPS_JE_SIEG` / `_MAX`). Ohne Bonus bleibt der Wert bitgleich, es wird nicht
  zweimal gerundet. Das Maximum liegt bei 5,5 + 0,5 = 6,0, also in Chris' Rahmen „max 5–6".
- **Gemessen** (40 Saaten, 6 gegen 6): 29–39 Duelle je Rennen, im Mittel 33,5. Je Läufer sind es
  0–6 Siege, im Mittel 2,8. Der Deckel greift ab dem fünften Sieg. Der Bonus beträgt im Mittel
  etwa 0,28 PP und bleibt damit ein Zusatz, kein eigener Weg zur Spitze.
- **Team-Wertung:** `computeArenaTeamPointsFromFixtureResults()` liest nur `seiten`. Der neue
  Test `tests/spurt-stationsduell-pps.test.ts` hält fest, dass Team-Punkte mit und ohne Duelle
  gleich sind.

## Garantie: Scoring unverändert

Die Buchhaltung (`stationsDuellSchritt()`, am Anfang von `stepSpurt`) **liest** nur
`u.huerde`, `u.stationIdx`, `u.pos` und `u.fertig`. Sie ruft kein `rr()` auf und schreibt
**nichts** am Läufer. Der Zustand liegt in einer `WeakMap` neben dem Läufer. Deshalb bleibt
sogar das serialisierte Rennprotokoll (`rennFertig`) zeichengleich.

- `node scripts/pruefe-wertung-fingerabdruck.mjs` lief auf `origin/main` (972b970cb) und auf dem
  Branch, in zwei parallelen Worktrees. Ergebnis: **alle 69 Einträge identisch**, GESAMT
  `a6493301291e` auf beiden Seiten. Das gilt auch für `spiele spurt 1/7/42` und damit für die
  Rennordnung.
- `spieleBahn("spurt", saat)` über 40 Saaten: `seiten` und jedes `[name, wert]` sind
  vorher und nachher gleich. Neu ist nur das Feld `duelle`.

## Offen

- Eine eigene Duell-Animation (Ziehen am Seil, Schulter an Schulter an der Mauer) wäre noch
  deutlicher, bräuchte aber neue PixelLab-Animationen. Dafür ist Chris' Freigabe nötig. Der
  jetzige Stand nutzt nur Versatz, die vorhandene Stoßpose, den Aufblitz-Ring und Text.
- Die PPs der Spurt-Referenz (`data/generated/spurt-pps-referenz.json`) wurden nicht neu gezogen.
  Der Bonus sitzt außerhalb der Kurve, die Referenz bleibt deshalb gültig.

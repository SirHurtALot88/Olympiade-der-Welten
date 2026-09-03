# Football: Live-Motor-Migration (erste Runde, keine Rezept-Kalibrierung)

Stand: Branch `claude/football-live-migration`, abgezweigt von `origin/main` (48a0a707) plus
cherry-gepickter Football-Assets-Commit (1dc93484, `claude/football-assets`), 03.09.2026.
Auftragsgrundlage: `docs/design/football-rollout-plan.md` (Fable-Recherche). `engine.js` meint
`public/mockups/battle-mode.engine.js`. **Reine Motor-Arbeit — `lib/`/`app/` unangetastet**,
Produktions-Anschluss ist ausdruecklich ein spaeterer Schritt (wie Basketballs Boxscore-Anschluss).

Analog zu Hockeys eigener Migration: **Struktur zuerst, Kalibrierung spaeter.** Alle Zahlen
unten (Rezeptgewichte, Wahrscheinlichkeitskonstanten, Yards-Formeln) sind PLATZHALTER, keine
Messwerte — genau der Zustand, in dem Hockeys erste Kurve war, bevor `scripts/miss-hockey-*`
sie eingemessen hat.

---

## 0. Ergebnis vorab

**Football hat jetzt einen Live-Motor** (Downs, Line of Scrimmage, Formationen, Snap-
Standphase, eigene Erfolgskurve) statt des alten Vorab-Pfads (48 unabhaengige Zwei-Personen-
Duelle ohne Feldstand). Gemessen (`node scripts/miss-alle-disziplinen.mjs 24 football
basketball hockey`, kaderfest, 5 Kader-Varianten):

| Disziplin | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| basketball | 0,757 | 0,102 | 0,923 | 0,231 |
| hockey | 0,589 | 0,292 | 0,748 | 0,105 |
| **football (neu, live)** | **0,305** | 0,321 | **0,448** | 0,448 |
| football (vorab, vor dieser Runde) | 0,345 | — | 0,699 | — |

**Basketball und Hockey sind bit-fuer-Median unveraendert** — die harte Regressionsgrenze aus
dem Auftrag haelt. **Football selbst ist NICHT besser geworden, gemessen an der Kopfzahl** —
0,305 gegen vorher 0,345 je Spiel, 0,448 gegen 0,699 Saison. Das ist ehrlich zu berichten, nicht
zu beschoenigen: anders als bei Hockeys erster Live-Runde (die von Anfang an über dem Vorab-Stand
lag) bewegt sich Footballs Kopfzahl in dieser Runde RUECKWAERTS. Abschnitt 5 ordnet ein, warum,
und was das für die naechste Runde bedeutet. Strukturell ist die Migration trotzdem der richtige
Schritt — der Vorab-Pfad ist laut eigenem Motorkommentar seit dem 25.08. als Sackgasse markiert
("ein Rezept, das gegen die Vorab-Mechanik eingemessen wird, ist nach der Migration wertlos"),
und die neue Struktur (Downs, echte Formationen, eigene Kurve) ist die einzige, auf der eine
kuenftige Kalibrierungsrunde ueberhaupt sinnvoll aufsetzen kann.

**Zwei echte Bugs unterwegs gefunden und behoben** (Abschnitt 4) — einer davon nur durch die von
Chris ausdruecklich verlangte visuelle Pruefung im echten UI, nicht durch die Rangtreue-Zahl
allein: die haette den Fehler nie gezeigt, weil er nur die Spielfigur-Position betraf, nicht die
Spielmechanik.

---

## 1. live-Block: Downs statt Schussuhr

`FELDSPIEL_ART.football.live` (engine.js:3759 ff.) traegt `perioden:4, periodenDauer:70,
periodenPause:1.0, schussuhr:6, periodeWort:"Viertel"` — dieselben Feldnamen wie Basketball/
Hockey (generischer `LIVE()`-Block, `spieldauerVon()` liest `perioden*periodenDauer` unveraendert
fuer alle drei). Zusaetzlich ein `downs`-Unterobjekt (`max:4, distanz:10, feldLaenge:100,
startSpot:75, fgReichweite:38, puntNetto:40, xpQuote:0.95`) — das Down/Distance-Konzept, das der
Football-Plan (Abschnitt B.2 Punkt 2) statt einer reinen Schussuhr fordert. `schussuhr` selbst
ist fuer Football aktuell nur Datenhaltung (kein Code liest es), vorgesehen fuer eine kuenftige
Play-Clock-Verschaerfung (spaetere Runde).

## 2. Zonenmodell

`bodenFeldspiel()`s Football-Zweig (engine.js ~8368, unveraendert) zeichnet Endzonen bei
`W*0.04-0.13`/`W*0.87-0.96` und das Spielfeld dazwischen. `FIELD()` (engine.js:5711) und
`fkLosX(side,spot)` erheben genau diese Zeichen-Konstanten zur mechanischen Wahrheit — dieselbe
`korbXVon()`-Lehre wie beim Basketballkorb (eine Referenz fuer Zeichnung UND Mechanik, sonst
laufen sie irgendwann auseinander). `spot` = Yards bis zum gegnerischen Ziel der angreifenden
Seite (0 = Touchdown, 100 = eigene Torlinie), `fkClamp()` haelt Formationspositionen im
gezeichneten Feld (Analogon zu `haltePuckImFeld()`).

**Elf reale Positionen auf sechs Slots** (Football-Plan A.3/B.3, dort als offene Frage benannt):
zwei Offense-Formationen und zwei Defense-Fronten, gewaehlt nach Down/Distance
(`waehleFormationOffense`/`waehleFormationDefense`, engine.js ~5768), mit realen NFL-Quellen
(WebSearch waehrend dieser Runde, keine Vermutung):

- **Offense „eng"** (I-Formation-artig): QB dicht unter Center, ein Running Back dahinter
  gestapelt, Tight End eng an der Line, zwei nur maessig gespreizte WRs — kompakt, laufbetont.
- **Offense „weit"** (Shotgun/Spread-artig): QB 5-7 Yards zurueckversetzt ("the quarterback
  stands further back, often five to seven yards off the line of scrimmage", [Shotgun formation
  – Wikipedia](https://en.wikipedia.org/wiki/Shotgun_formation)), Receiver ueber die volle
  Feldbreite gespreizt (Spread-Idee).
- **Defense „basis"** (4-3-artig): vier Down Lineman, zwei Linebacker mittlerer Tiefe — real vier
  Lineman + drei Linebacker ([4–3 defense – Wikipedia](https://en.wikipedia.org/wiki/4%E2%80%933_defense)),
  hier auf sechs Slots gekuerzt.
- **Defense „nickel"** (Nickel-artig): nur zwei Lineman vorn, dafuer zwei Defensive Backs weit
  UND tief — "a nickel defense ... uses five defensive backs, of whom the fifth is known as a
  nickelback ... counters offenses with many passing plays" ([Nickel defense –
  Wikipedia](https://en.wikipedia.org/wiki/Nickel_defense)).

`SLOTS_FOOTBALL_OFF`/`SLOTS_FOOTBALL_DEF` (engine.js:5752/5764) definieren beide als
`{tiefe,breite}`-Tabellen (Tiefe = Abstand zur Line auf der eigenen Seite, Breite = seitlicher
Versatz von der Feldmitte) — angewandt in `starteSnap()`.

## 3. Eigener `kurve`-Block — kein `KURVE_BASKETBALL`-Erbe

`FELDSPIEL_ART.football.kurve` (engine.js ~3843) traegt dieselbe Datenstruktur wie Hockeys Kurve
(`base/geoBonus/radien/skillMittel/steil/korrektur/skillTerme`), aber **eigene Bedeutung je
Feld**: die vier Tiers sind keine Distanz-zu-Ziel-Ringe (ein Football-Pass hat kein festes Ziel
wie ein Korb), sondern **Pass-Tiefen** — `dunk` = Checkdown/Screen hinter der Line, `nah`/`mit`/
`fern` = kurzer/mittlerer/tiefer Pass. `waehleFootballTier(down,toGo)` waehlt die Tiefe (fuer
unbenannte Zuege), `resolvePass()` ruft danach dieselben drei generischen Funktionen
(`lageBasisFuer`/`skillTeilFuer`/`steilerMake`) wie jede andere Feldspiel-Disziplin, mit
`skillTerme:[{feld:"PASSGENAUIGKEIT",koeff:0.0060},{feld:"TEAMGEIST",koeff:0.0020}]` — derselbe
Mechanismus wie Basketballs/Hockeys Kurve, andere Sub-Skills.

**Laufspielzuege nutzen die Kurve bewusst NICHT** (`resolveLauf()`, engine.js:5806): ein Lauf ist
real eine kontinuierliche Yards-Verteilung um einen fertigkeitsabhaengigen Mittelwert (zengm
`truncGauss`-Formel als Referenz, Football-Plan A.3/B.4), keine Treffer/Fehltreffer-
Wahrscheinlichkeit — eine zweite, kleinere Formel statt eines erzwungenen zweiten Kurve-Blocks,
wie der Plan es selbst als moegliche Konsequenz benennt ("Football braucht deshalb nicht nur
einen eigenen kurve-Block ... sondern moeglicherweise eine andere STRUKTUR").

`radien` bleibt aus Struktur-Konsistenz stehen, hat fuer Football aber keine geometrische
Bedeutung (`klassifiziereWurfdistanz()` wird von Football nie aufgerufen — Football hat kein
physisches "Wurfziel", die Tier-Wahl kommt aus Down/Distance, nicht aus einer Entfernung).

## 4. Snap-Standphase und Spielzug-Aufloesung

`fsLive.phase` bekommt einen dritten Wert (`"snap"`) neben Basketballs `"freiwurf"` und dem
generischen `"laufend"`/`"viertelpause"` — genau die Naht, die der Motorkommentar bei
`initFeldspielLive` schon 2025-08 vorgesehen hatte ("Football (Snap-Formation), Hockey (Bully)
und Tennis (Aufschlag) brauchen exakt dieselbe Struktur"). `bewegeSpielerLive`s `stehtStill`-Zweig
(engine.js ~7882) ist dafuer um eine Zeile erweitert (`fsLive.phase==="freiwurf"||
fsLive.phase==="snap"`) — wirkungslos fuer Basketball/Hockey/Tennis, die "snap" nie setzen.

**Ablauf je Snap** (`starteSnap()`/`stepSnapPhase()`, engine.js:6025/6065): `formation` (0,9s,
Formation steht) -> `zug` (0,8-1,6s je Spielzug-Typ, s. u.) -> `nach` (0,6s Ergebnis-Anzeige) ->
naechster Snap ODER Possession-Wechsel ueber das UNVERAENDERTE `naechsterAngriff()`/
`starteViertelpause()` (Quartalsgrenze, Endstand-Feed — alles generisch wiederverwendet, kein
football-eigener Code dafuer noetig).

**Fuenf sichtbar unterschiedliche Spielzug-Typen** (Chris' Zusatzauftrag, 03.09.: "verschiedene
Zug-Typen mit unterschiedlichen Bewegungsmustern"), gewaehlt nach Down/Distance
(`waehlePlayCall()`, grob an der realen NFL-Tendenz orientiert, Football-Plan A.1):

| Typ | Ausloesung | Ball-Animation |
|---|---|---|
| `lauf` | kurze/mittlere Distanz | niedrig, leichter Schlenker, direkt zum Laufziel |
| `screen` | Kurzdistanz | sehr flacher, kurzer Bogen leicht hinter die Line und zurueck |
| `kurz`/`mittel` | Standard-Down | ansteigend hohe/lange Parabel (wie Basketballs Freiwurf-Flug) |
| `tief` | 3./4. Versuch und lang | hoher, langer Bogen (Deep Ball) |
| `fg`/`punt` | 4. Versuch, s. u. | hoher Kick-Bogen zum Ziel |

Jeder Spielzug loest **zweistufig** auf, wie real (Football-Plan A.2/A.3, fehlte dem Vorab-Pfad
komplett): erst Sack- bzw. Fumble-Chance, DANACH erst Completion/Interception bzw. Laufweite.
`vollziehFootballErgebnis()` (engine.js:5947) wendet das Ergebnis an — Yards, Down/Distance-
Fortschreibung, Touchdown (+6, dann ein XP-Wurf mit 95% Erfolgschance), Turnover (Interception/
Fumble, mit einer echten Recovery-Chance statt eines Dekrets — real ~55-60% Fumbles landen bei
der Defense), Turnover-on-Downs, und ein 4.-Versuch-Entscheid (`waehleVierterVersuch`: Field Goal
in Reichweite, sonst bei kurzer Distanz ein Go-For-It, sonst Punt). Field-Goal-Chance folgt einer
distanzabhaengigen Formel, keinem Spielerattribut (Football-Plan D: "heute kein Kicker-Slot").

Possession-Wechsel laufen ueber `fkNaechsterSpot` (ein Modul-State, der den neuen Feldstand vor
`naechsterAngriff()` setzt) statt einer neuen Parameter an der generischen Funktion — die soll
fuer alle vier Feldspiel-Disziplinen unveraendert bleiben.

## 5. Sub-Skills

Acht Rollen statt der von Basketball geerbten sieben (`AUFBAU`/`ABSCHLUSS`/`TECHNIK`/
`ZWEITCHANCE`/`ABWEHR`/`TEAMGEIST`/`AUSDAUER`), umgesetzt nach dem Football-Plan-Vorschlag
(Abschnitt D): `PASSGENAUIGKEIT`, `LAUFKRAFT`, `PASSSCHUTZ`, `ABWEHR_PASS`, `ABWEHR_LAUF`,
`BALLSICHERHEIT`, `TEAMGEIST`, `AUSDAUER`. Kein FIELD-GOAL-GENAUIGKEIT-Eintrag (der Plan selbst:
kein Kicker-Slot bei sechs Feldspielern). `TURNOVER-ANFAELLIGKEIT` aus dem Plan wurde bewusst als
`BALLSICHERHEIT` umgesetzt (Vorzeichen gedreht, hoeher=besser wie jeder andere Sub-Skill im Motor
— ein einzelner „hoeher=schlechter"-Sub-Skill waere eine Falle fuer die naechste automatische
Rezept-Kalibrierung).

**Neunter, disziplinuebergreifend erwarteter Key nachgezogen: `LAUFTEMPO`** — s. Abschnitt 4 der
Bugs unten. Alle Gewichte sind Platzhalter, nicht Sinkhorn-ausgeglichen; alle neun
Matrix-Attribute (spirit/torment/health/awareness/will/determination/power/stamina/charisma)
kommen mindestens einmal vor.

`feldspielWert()` (engine.js ~5514) bekommt einen eigenen football-Zweig statt des generischen
Fallbacks (der Yards komplett unsichtbar gemacht haette): an Standard-Fantasy-Football-Scoring
angelehnt (1 Punkt je 10 Lauf-/Fangyards, 1 Punkt je 25 Passyards, 6 je Touchdown, Abzuege fuer
Turnover) statt einer erfundenen Formel.

## 6. Assets

`public/sprites/football/ball_football.png` (Kenney Sports Pack, CC0, aus dem Cherry-Pick von
`claude/football-assets`) wird jetzt gezeichnet: derselbe gemessene Handpunkt-Mechanismus wie
Basketballs Ballfuehrer-Fix (`docs/design/sprite-handpunkte.md`, `BK_HAND_LINKS/RECHTS`) traegt
auch einen getragenen Football (beide sitzen auf demselben LPC-Koerper-Sprite). Ohne geladenes
Bild bleibt ein Vektor-Rueckfall (brauner Football, weisser Naht-Strich). Die drei Helm-Sprites
(`helmet_white1-3.png`) sind geladen (`FK_TEILE`, engine.js ~13245) und liegen fuer eine
kuenftige Overlay-Zeichenfunktion (analog zu `zeichneHockeyschlaeger()`) bereit — werden diese
Runde noch nicht gezeichnet.

---

## 7. Zwei Bugs unterwegs gefunden — einer nur durch die Sichtpruefung

**Bug A — Absturz bei degenerierter Unterzahl.** `resolvePass()` waehlt den Receiver ueber
`gewichtetesLos(off.filter(u=>u!==passer),...)`; bei 1v1 bleibt nach Abzug des Passers niemand
uebrig, `gewichtetesLos([])` gibt `Array[-1]` = `undefined` zurueck, und
`scripts/miss-feldspiel-rangtreue.mjs` stuerzte beim ersten `e.spieler.id`-Zugriff ab. Behoben:
faengt notgedrungen selbst, wenn niemand sonst da ist.

**Bug B — eingefrorenes/zerstoertes Spielfeld, nur durch echtes Hinschauen gefunden.** Chris'
Zusatzauftrag verlangte ausdruecklich eine visuelle Pruefung im echten UI (lokaler HTTP-Server
auf `public/`, Playwright-Screenshots, mit Bildverstehen betrachtet — nicht nur Zahlen gelesen).
Die ersten Screenshots zeigten: alle zwoelf Spieler standen bewegungslos an ihrer
Vorab-Ruheposition, ZWEI davon mit sichtbar korrupten (abseits liegenden) Koordinaten. Ursache,
per Playwright-Konsolen-Instrumentierung eingegrenzt: `bewegeSpielerLive()`s Bewegungsformel
(`tempoPx = 230 + (u.LAUFTEMPO-50)*0.70 ...`) liest `u.LAUFTEMPO` fuer **jede** Feldspiel-
Disziplin, nicht nur Basketball — ein achter, generisch erwarteter Rezept-Key
(`battle-mode.rezepte.js`, Basketball UND Hockey fuehren ihn beide,
`LAUFTEMPO:{speed:52,stamina:32,dexterity:16}`), den das neue Football-Rezept schlicht nicht
hatte. `u.LAUFTEMPO` war `undefined`, `tempoPx` wurde `NaN`, und `u.x+=NaN` zerstoerte die
Position dauerhaft, sobald ein Spieler sein Ziel wechselte (bei manchen Spielern sofort sichtbar
als `NaN`-Koordinate, bei anderen nur als scheinbar „eingefrorene" alte Position — je nachdem, ob
der erste Zielwechsel schon vor oder erst nach dem Messzeitpunkt lag). Behoben: `LAUFTEMPO`
zum Football-Rezept nachgezogen, 1:1 dieselben Gewichte wie Basketball/Hockey (Lauftempo ist eine
physische, keine football-spezifische Eigenschaft).

**Nachgezogen, dieselbe Sichtpruefung, kein Absturz, aber sichtbar falsch:** mit der ersten
Formationsskala standen sich der naechste Offense- und der naechste Defense-Spieler nur 10-16px
gegenueber — im Screenshot ein Klumpen aus zwoelf ueberlappenden Figuren, keine zwei erkennbaren
Formationen. Zwei Korrekturen: (1) die Tiefen-Skala beider Formationstabellen grosszuegiger
gesetzt (naechster O-Mann mindestens 24px, naechster D-Mann mindestens 30px von der Line), (2)
Spieler werden beim Betreten der Snap-Standphase HART auf ihre Formationsposition gesetzt statt
dorthin zu laufen — bei Basketballs Freiwurf-Wiederanlauf (lokale Neuaufstellung) macht das
normale Lauftempo (~230px/s) den Unterschied nicht sichtbar, bei Football kann die Line of
Scrimmage aber von einem Down zum naechsten um hunderte Pixel wandern, und der naechste Snap kam
(alle 2,4-3,2s) regelmaessig, bevor irgendjemand sein Ziel erreicht hatte — ein Spielfeld-weiter
Nachlauf-Klumpen statt zweier stehender Formationen. **Ehrlich eingeordnet, kein „gelöst und
fertig":** die Formationen sind jetzt sichtbar zweigeteilt und ueber die Feldbreite gespreizt
(Screenshots in dieser Session gepruft, nicht im Repo abgelegt), aber enger/ueberlappender als
ein sauberes Formations-Diagramm — gute naechste Fein-Politur-Arbeit, kein Blocker fuer diese
Runde.

## 8. Verworfener Ansatz, mit Zahlen — fester Depth Chart statt Zug-fuer-Zug-Los

Erster Versuch: EIN QB/RB/PassRusher/RunStopper je Team, einmal je Spiel gezogen (der
naheliegende „echte Football hat einen Depth Chart"-Ansatz). Gemessen SCHLECHTER als die
dynamische Zug-fuer-Zug-Auswahl: 0,167 je Spiel / 0,280 Saison gegen 0,305/0,448. Grund,
nachgemessen statt vermutet: `ABWEHR_PASS`/`ABWEHR_LAUF` mischen beide aus
torment/power/health, `PASSGENAUIGKEIT`/`LAUFKRAFT` teilen sich `awareness`/`power`/`health` —
ein fester Depth Chart kuert deshalb oft DIESELBE Person zu QB UND RB bzw. zu PassRusher UND
RunStopper. Auf sechs Spieler blieben so real nur zwei bis drei je Seite ueberhaupt mit einer
Ballberuehrung, der Rest stand bei EXAKT null — schlechter fuer die Rangtreue als die
Zug-fuer-Zug-Streuung (`gewichtetesLos`), bei der jeder der sechs eine von null verschiedene
Chance behaelt. Verworfen, nicht eingebaut — dokumentiert, damit die naechste Runde denselben
Weg nicht noch einmal geht.

## 9. Was als Naechstes fehlt (ausdruecklich NICHT Teil dieser Runde)

1. **Rezept-Feinkalibrierung.** Alle acht Sub-Skill-Gewichte und alle Wahrscheinlichkeits-
   konstanten (Sack-/Fumble-/Interception-Chancen, Yards-Mittelwerte, `kurve.skillMittel`/
   `steil`/`korrektur`) sind ungemessene Platzhalter. Der naechste Schritt ist derselbe wie bei
   Hockey: `scripts/miss-hockey-skillmittel.mjs`-artige Werkzeuge fuer Football bauen,
   `skillMittel` aus dem echten Kader messen, `steil`/`korrektur` gegen reale NFL-Quoten fitten
   (Completion-Quote 65,3%, Yards/Attempt 7,1 — beide bereits im Rollout-Plan A.1 zitiert).
2. **Warum die Kopfzahl NICHT gestiegen ist, gezielt untersuchen.** Zwei Kandidaten, beide noch
   nicht durchgemessen: (a) die Ereignisdichte pro Spieler ist trotz Downs vermutlich niedriger
   als im dichten Vorab-Pfad (48 garantierte Zuege gegen ~15-25 tatsaechlich kreditierte
   Ballberuehrungen je Team ueber ein ganzes Spiel), was laut CLAUDE.md die Verlaesslichkeit
   drueckt, nicht die Validitaet — pruefbar mit `scripts/miss-feldspiel-rangtreue.mjs` bei
   verdoppelter Spielzeit; (b) die MATRIX-zu-Sub-Skill-Abbildung (Abschnitt 5) ist komplett
   ungetestet und koennte die eigentliche Validitaets-Bremse sein — genau der Fall, den CLAUDE.md
   als "arbeite an der Validitaet, nicht an der Uhr" beschreibt.
3. **Produktions-Anschluss.** Wie bei Basketballs Boxscore-Anschluss ein separater, spaeterer
   Schritt — `lib/`/`app/` sind in dieser Runde bewusst unangetastet geblieben.
4. **Helm-Overlay.** Sprites liegen bereit (`FK_TEILE`), eine Zeichenfunktion analog zu
   `zeichneHockeyschlaeger()` fehlt noch.
5. **Visuelle Formations-Politur.** Abschnitt 7 (Bug B, Nachtrag) — Formationen sind sichtbar
   zweigeteilt, aber enger als ein sauberes Diagramm.

---

## Anhang: Quellen dieser Runde

- `en.wikipedia.org/wiki/Shotgun_formation` — QB-Tiefe 5-7 Yards, Spread-Nutzung.
- `en.wikipedia.org/wiki/4%E2%80%933_defense` — vier Lineman, drei Linebacker (SAM/MIKE/WILL).
- `en.wikipedia.org/wiki/3%E2%80%934_defense` — drei Lineman, vier Linebacker (Referenz, nicht
  umgesetzt — nur Basis-4-3 und Nickel wurden gebaut).
- `en.wikipedia.org/wiki/Nickel_defense` — fuenf Defensive Backs, Passverteidigungs-Zweck.
- `throwdeeppublishing.com/blogs/football-glossary/the-complete-guide-to-offensive-football-formations`
  — Formations-Uebersicht (I-Formation-Grundidee).
- `docs/design/football-rollout-plan.md` — Auftragsgrundlage dieser Runde (zengm `GameSim.football`
  als Formel-Referenz, NFL-Referenzzahlen, Sub-Skill-Diskussionsvorschlag).

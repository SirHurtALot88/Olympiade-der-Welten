# Mini-DM-Nachtkonzept (03.10.): „Der letzte Stand“ — Schlagwechsel statt Gerangel, Menge aus der Eignung, Finisher als Ereignis

Konsultation, keine Umsetzung. **Kein Code im Repo geändert.** Alle Zahlen stammen aus Messungen
außerhalb des Repos: an einer Kopie von `public/mockups/battle-mode.engine.js` (Stand `68563962`,
bis `main` `eda92a77` an Motor und Werkzeugen unverändert) und an einem eigenen, kleinen
Konzeptmodell. Beides lief auf den zehn echten Kadern der Kaderfamilie
(`data/generated/kaderfamilie-live-save.json`). Methode zum Wiederholen: Anhang A.

Chris' Auftrag (02.10./03.10.), wörtlich: „so müssen wir denken wie man mit einfachen methoden das
spiel etwas interaktiver gestalten kann und das auch nen gewissen impact haben kann“ und „denk gern
um die ecke, hol infos aus dem internet und probier dich aus“. Mini-DM ist eine der neun
ereignisarmen Disziplinen aus `manager-risiko-interaktivitaet-konzept-02-10.md` (PR #1118):
„kein Kampfbild, nur schrittweise Ergebnisauflösung“.

Gelesen und vorausgesetzt: `CLAUDE.md`, PR-#1118-Dokument, `stand-aller-disziplinen.md`,
`arena-zielwahl-opus-empfehlung-02-10.md`, `tdm-pp-rezeptrunde-diagnose-02-10.md`,
`fable-ideen-arena-ispy-30-09.md` (M-1 bis M-5), im Motor `ARENA_ART["mini-dm"]`, `aufEignung()`,
`baueEinheit()`, `MANAREZEPT`, `beitragVon`, `MOTOREN`, `einflussVon()`, `baueMiniDmFfaRunde()`,
`spieleMiniDmFfaEvent()`.

---

## 0. Die Empfehlung in sechs Sätzen

1. **Die 115 Pp sind eine einzelne, verrauschte Ziehung, und sie messen das falsche Format.**
   Neu gemessen, je Strom n = 24, liegt das 4-gegen-4 bei **73,4 / 74,5 Pp**. Einzelne n=6-Stücke
   streuen von 40 bis 111. Das **4-Team-FFA, das Chris tatsächlich entschieden hat**, wurde
   erstmals vermessen. Es liegt bei **15,6 / 14,8 Pp** und besteht die Pflichtprüfung schon heute.
2. **Das 4-gegen-4 verletzt die Schranke über drei Kanäle, die sich im Code benennen lassen.**
   Das Mana-Rezept speist Spirit und Intelligence (Matrix 0) mit zusammen rund 15 %. Das Tempo
   speist Dexterity mit 24 % statt 10 %. Und der Wertmaßstab „Anteil am Beitrag“ bestraft das
   Einstecken: Health liest 0 %, mit negativem Rohgewinn, Will 1 %, die Matrix gibt beiden
   zusammen 34.
3. **Das eigentliche Problem des gespielten Formats ist die Rangtreue, nicht Pp.** Erstmals am
   echten FFA gemessen: rho je Runde **0,40 / 0,42**. Der Eignungsbeste einer Runde gewinnt sie in
   49 / 51 % der Fälle, Paare mit mindestens 15 Punkten Abstand ordnet der Motor zu 83 % richtig.
4. **Kern des Konzepts:** Jede FFA-Runde wird ein Schlagwechsel in Takten, ohne Laufgeometrie.
   Jeder Kämpfer greift je Takt einmal an. Jedes Matrixattribut hat genau einen benannten Kanal,
   die **Menge kommt aus der Eignung, die Form aus dem Attributprofil**, nach demselben Prinzip wie
   `aufEignung()`. Dazu kommen ein Bruchpunkt mit Finisher-Duell (Primär- und Nebenweg auf beiden
   Seiten), Vergeltung als Zielregel, ein schließender Ring und eine Wertung nach
   Kampfrichter-Art.
5. **Im Modell, beide Saatströme:** rho je Runde 0,58–0,66 statt 0,40–0,42, Paare ≥ 15 zu
   92–95 % richtig statt 83 %, Star gewinnt 59–64 % statt 49–51 %, Team-rho 0,76–0,81 statt
   0,61–0,63, **Pp 11–15**. Die Manager-Haltung (Angreifen/Absichern) ist darin rho-neutral, der
   Joker kippt den Event-Sieger in 14–15 % der Events. **0,80 je Runde erreicht keine Variante
   in Chris' Format.** Die Grenze liegt beim FFA selbst (Abschnitt 1.5) und in der Frage, was
   „ein Spiel“ hier misst (Abschnitt 1.6).
6. **Klasse:** Der Kern ist **M** und braucht Chris' Zustimmung. Ticker-Zeilen im heutigen
   Enthüllungstakt sind **A\***, ein Takt-für-Takt-Reveal mit längerer Sendezeit ist **T**. Das
   Messwerkzeug „FFA statt 4-gegen-4 in die Abnahme“ ändert kein Spielverhalten, aber die
   offizielle Zahl, und gehört deshalb trotzdem vor Chris.

---

## 1. Problemrahmen

### 1.1 Was gespielt wird und was gemessen wird

Chris' Sonderregel (06.09., im Motor bei `MINI_DM_FFA_*` dokumentiert): **vier Teams, je ein
Kämpfer, vier Runden je Rolle (Frontliner, Finisher, Trick Fighter, Iron Guard), Elimination ohne
Respawn, Rundenpunkte 4-3-2-1, Liga 2-1-0-0.** Gebaut ist das als `baueMiniDmFfaRunde()` und
`spieleMiniDmFfaEvent()`, angezeigt als Live-Reveal (Karten je Runde, 900 ms Pause), nicht als
Kampfbild.

Die offiziellen Sonden (`miss-alle-disziplinen.mjs`, `messe-arena-einfluss.mjs`) laufen dagegen
über `MOTOREN["mini-dm"]`. Das ist das generische 4-gegen-4 aus `build()`, das so nicht gespielt
wird. Opus hat das am 26.09. als P0 benannt („FFA in die Sonde“), Fable am 30.09. als
Voraussetzung jeder Mini-DM-Idee. Gemessen hatte das FFA bisher niemand. Diese Runde holt das nach
(1.3).

### 1.2 Die 115-Pp-Analyse: neu gemessen, drei Kanäle

`einflussVon("mini-dm", 6, 15, versatz)` lief in acht unabhängigen Stücken. Strom A hat die
Versätze 0, 1 000 003, 2 000 003, 3 000 003, Strom B 10 000 000 bis 13 000 003. Die Rohgewinne
wurden je Strom gemittelt und dann wie in `einflussVon()` positiv normiert. Das ergibt je Strom
n = 24.

| Attribut | Matrix | Strom A Anteil | Strom B Anteil | Rohgewinn A / B |
|---|---:|---:|---:|---:|
| torment | 24 | 30,4 % | 27,4 % | +0,605 / +0,589 |
| dexterity | 10 | **24,0 %** | **23,5 %** | +0,478 / +0,505 |
| stamina | 16 | 12,7 % | 23,0 % | +0,252 / +0,494 |
| power | 16 | 15,1 % | 12,1 % | +0,302 / +0,260 |
| spirit | **0** | **8,6 %** | **6,4 %** | +0,172 / +0,137 |
| intelligence | **0** | **7,7 %** | **6,9 %** | +0,154 / +0,149 |
| will | 14 | **1,5 %** | **0,6 %** | +0,030 / +0,014 |
| health | 20 | **0 %** | **0 %** | **−0,090 / −0,142** |
| **Pp** | | **73,4** | **74,5** | |

Die acht Einzelstücke (n = 6) lasen 69,6 / 40,1 / 86,4 / 110,8 und 81,2 / 75,9 / 74,4 / 78,5.
**Die 115 aus dem Zwölften Nachtrag (n = 24, ein Strom) liegen am oberen Rand dieser Streuung.**
Die Verletzung ist echt, aber halb so groß wie dokumentiert. Das Muster ist in beiden Strömen
dasselbe und lässt sich drei Stellen im Code zuordnen:

1. **Mana-Leck.** `MANAREZEPT = {spirit:45, intelligence:35, will:20}` speist in jeder
   Arena-Disziplin den Mana-Vorrat für die Kit-Skills. Die Mini-DM-Matrix bepreist Spirit und
   Intelligence mit null, gemessen tragen sie zusammen 13–16 %. Kein bisheriges Dokument nennt
   diesen Kanal. Er sitzt im geteilten Chassis, betrifft also vermutlich auch TDM (Spirit 12,
   Intelligence 6) und Battlefield, dort aber bepreist.
2. **Tempo außerhalb der Normierung.** Dasselbe wie bei TDM und Battlefield: `aufEignung()`
   normiert LP, ANG und VER, nicht TMP und AUS. Das Mini-DM-Rezept setzt Dexterity mit 40 in TMP
   (Marschtempo, Abklingzeiten). Gemessen: 24 % bei Matrixgewicht 10.
3. **Der Wertmaßstab bestraft Einstecken.** Das ist der Mini-DM-eigene Teil. Gemessen wird der
   Anteil an `beitragVon = Schaden + Heilung + Schild + 0,4·erlitten + 140·KO-Anteil`. Wer zäher
   wird, verlängert seinen Kampf und füllt damit vor allem die Schadenskonten der Gegner. Health
   liest deshalb in beiden Strömen einen **negativen** Rohgewinn, Will fast null. Die Matrix sagt
   dagegen: „hier wird geschlagen **und eingesteckt**“ (health 20 + will 14 = 34 %). Das ist
   kein Rezeptfehler, den eine fünfte Kalibrierrunde beheben könnte. Der Maßstab belohnt
   Austeilen, die Matrix belohnt beides.

### 1.3 Das gespielte Format, erstmals gemessen (Opus P0)

Scratch-Sonde über `window.__arena.miniDmFfaRunde()`: 20 deterministisch gezogene Vierergruppen
aus den zehn echten Kadern, je sechs Saaten, also 120 Events mit 480 Runden je Strom. Die Kämpfer
werden je Rolle nach Eignung gestellt wie in `spieleMiniDmFfaEvent()`. Pp nach derselben
Budget-Methode: Attribut +15 bei einem Kämpfer, Eignung um Gewicht·15/100 mit, dieselbe
Rundensaat, Gewinn im Anteil am Rundenbeitrag. 288 Kämpfer-Proben je Strom.

| Größe | Strom A | Strom B |
|---|---:|---:|
| rho je Runde (4 Kämpfer, Mittel) | 0,398 | 0,417 |
| rho je Event (16 Kämpfer, Mittel / Median) | 0,363 / 0,367 | 0,367 / 0,347 |
| Star der Runde gewinnt sie (Zufall 25 %) | 48,8 % | 51,0 % |
| Paare ≥ 15 Punkte richtig geordnet | 82,6 % | 82,8 % |
| Paare 5–15 Punkte richtig | 66,5 % | 67,4 % |
| Paare < 5 Punkte richtig | 50,0 % | 49,7 % |
| Team-rho (Eventplatz gegen Team-Eignung) | 0,627 | 0,612 |
| Kämpfer, die die Runde nicht überstehen | 74,3 % | 74,4 % |
| Rundendauer | 20,7 s | 20,7 s |
| **Pp (FFA)** | **15,6** | **14,8** |

FFA-Anteile (A / B, Matrix in Klammern): torment 29,3 / 27,5 (24), stamina 18,1 / 17,8 (16),
power 16,4 / 15,6 (16), health 14,3 / 14,7 (20), will 13,3 / 12,3 (14), dexterity 8,6 / 12,0
(10). Spirit und Intelligence lesen im FFA null. Warum das Mana-Leck dort nicht greift, ist nicht
geprüft. Die naheliegende Vermutung: Kurze Eins-gegen-eins-gegen-eins-gegen-eins-Gefechte kommen
selten an die manalastigen Skills.

### 1.4 Was daraus folgt

- **Pp ist für das gespielte Format kein akutes Problem**, wohl aber für die offizielle Zahl.
  Solange die Abnahme das 4-gegen-4 misst, steht in `stand-aller-disziplinen.md` eine Verletzung
  für ein Format, das niemand spielt. Paket P0 (Abschnitt 5) korrigiert die Messgrundlage, nicht
  das Spiel.
- **Die drei Kanäle aus 1.2 bleiben trotzdem echte Befunde für das Chassis.** Das Mana-Leck und
  TMP treffen TDM und Battlefield mit. Der Maßstab-Befund gilt für jede Arena-Disziplin, deren
  Matrix „einstecken“ hoch bepreist.
- **Die Rangtreue ist der bindende Mangel** (CLAUDE.md: rho vor Pp). 0,40 je Runde und
  83 % bei Paaren mit klarem Abstand liegen deutlich unter Hockey (99 % bei ≥ 15).
- **Das Bild fehlt.** Das FFA zeigt keinen Kampf, sondern vier Ergebniskarten. Ein Moment, in dem
  „etwas passiert“, existiert in der Anzeige nicht.

### 1.5 Woher die fehlende Rangtreue kommt: zwei getrennte Verluste

Die Ursache war im Motor nicht direkt zu zerlegen (deterministischer Nahkampf, Geometrie,
Persönlichkeit, Ecken). Deshalb wurde sie am Konzeptmodell (Abschnitt 3, Anhang A) eingegrenzt,
mit 40 Wiederholungen je Gruppe, damit Rauschen die Validität nicht drückt. Gemessen ist die
**Validität je Runde**, also das rho der über 40 Saaten gemittelten Rundenanteile gegen die
Eignung.

| Konzeptmodell, Spreizung ×2 | FFA | Jeder gegen jeden (6 Duelle) |
|---|---:|---:|
| echte Attributprofile | 0,555 | 0,395 |
| alle sechs Attribute := Eignung | 0,770 | **0,945** (Paare ≥ 15: 99,5 %) |

Zwei Verluste, unabhängig voneinander:

- **Verlust 1, Profil statt Summe.** Baut man den Kampf direkt auf Rohattribute, belohnt er
  *Begegnungen von Profilen* (mein Angriff gegen deine Zähigkeit), nicht die gewichtete Summe,
  die die Matrix verlangt. Das kostet hier 0,2 bis 0,55 Validität. Der Motor kennt die Antwort
  längst, nämlich `aufEignung()`: „Die Rezepte geben die FORM, die Eignung gibt die MENGE.“ Im
  FFA wirkt dieses Prinzip heute nur auf LP, ANG und VER, nicht auf Tempo, Ausdauer, Mana und
  Wertmaßstab.
- **Verlust 2, die Steuer des FFA.** Selbst mit perfekten Eingaben verliert das Vier-gegen-alle
  rund 0,2 Validität gegenüber dem Jeder-gegen-jeden. Wer wen trifft und wer den Angeschlagenen
  eines Dritten erledigt, ordnet mit. Das ist der „Königsmacher“, den die Spieldesign-Literatur
  als nicht vollständig lösbar beschreibt (Abschnitt 2.2).

### 1.6 Warum „rho je Spiel über 16 Kämpfer“ das FFA strukturell unterschätzt

Ein Event besteht aus vier getrennten Rollenrunden. Der vierte Mann eines Teams kämpft nur gegen
die anderen vierten Männer und kann dort 40 % des Rundenbeitrags holen, während der Star von
Runde 1 gegen drei Stars 25 % holt. Ein rho über alle 16 vergleicht Anteile aus verschiedenen
Wettbewerben. Am Modell mit perfekten Eingaben (Jeder gegen jeden, Attribute := Eignung) liegt die
Validität **je Runde bei 0,945, über die 16 Kämpfer des Events aber nur bei 0,690.** Keine Mechanik
kann diese Obergrenze überwinden. Die ehrliche Abnahme für das FFA ist **je Runde**: Star,
Paartreue mit Abstand, rho der vier. Genau diese Abnahme lässt CLAUDE.md ausdrücklich zu („die
ehrlichere Abnahme fragt deshalb nach dem Star und nach der Paartreue mit Abstand“). Die
Entscheidung darüber liegt bei Chris (Frage 1 in Abschnitt 7).

---

## 2. Recherche: Was Deathmatch-Formate spannend macht

### 2.1 Arena-Duell (Quake, Unreal Tournament): der Stapel als sichtbare Ressource

- „Controlling key items is the fundamental skill of any arena shooter. Keep your stack full while
  denying your opponent a fair fight.“ und „Every Quake duel revolves around two key items: the
  mega-health and the big armor“ — Dignitas,
  https://dignitas.gg/articles/blogs/Quake/11424/how-to-master-quake-spawn-timers-controlling-mega-and-armor
- Unreal Tournament „Last Man Standing“: „All players start the game with the same number of lives
  […] When a player dies he loses one life.“ Zum Scheitern des Modus: „camping significantly raises
  the odds of winning and leads to pretty boring gameplay“ — The Liandri Archives,
  https://unrealarchive.org/wikis/the-liandri-archives/Last_Man_Standing.html

**Übertragung:** Im Duell ist der Stapel aus Leben und Rüstung das, was der Zuschauer liest. Im
Text heißt das: ein sichtbarer **Stand** je Kämpfer und ein benannter Moment, in dem er bricht.
Last Man Standing zeigt die Kehrseite. Wenn Überleben allein zählt, gewinnt das Verstecken. Die
Wertung muss Wirkung bezahlen, nicht nur Dasein.

### 2.2 Battle Royale (Apex, Fortnite) und das FFA-Grundproblem

- Respawn zur Season 18: „Hiding and avoiding firefights isn't a rewarding way to play Apex
  Legends.“ Gegenmittel: Ring-Timings und höherer Ringschaden — PCGamesN,
  https://www.pcgamesn.com/apex-legends/stop-hiding-ratting
- Ringschaden je Runde 3 / 4 / 10 / 15 / 20 / 25, „Ring 6 is the last ring. It will slowly close
  over 100 seconds“ — Apex Legends Wiki, https://apexlegends.wiki.gg/wiki/Ring
- Königsmacher und Leader-Bashing: „A player who knows they will lose effectively chooses who will
  win, usually by attacking one of the remaining players.“ In der zitierten Umfrage galten
  Kingmaking (42 %) und Leader-Bashing (23 %) als die schlimmsten Probleme. Gegenmittel laut
  Artikel: verdeckte Information, Punkte auch für Platz 2 und 3, weniger direkte Eingriffe in
  fremde Ergebnisse — Skeleton Code Machine,
  https://www.skeletoncodemachine.com/p/is-kingmaking-cursed

**Übertragung:** Der Ring ist das Battle-Royale-Bild für „es muss jetzt enden“ und gehört als
Taktgeber in jede FFA-Runde. Er erzwingt ein Ende in fester Sendezeit. Gegen den Königsmacher
hilft, was der Artikel nennt. Mini-DM hat Rundenpunkte für alle vier Plätze schon (4-3-2-1).
Neu käme eine Zielregel dazu, die Angriffe an den Angreifer bindet (Vergeltung, Fables M-3). Sie
ist im Modell leicht rangtreue-positiv (Abschnitt 4.3).

### 2.3 Kampfsport-Framing (UFC, Boxen, Gladiatoren): Wertung, Finish, Aufgabe

- MMA-Kampfrichter (Unified Rules): Bewertet werden wirksame Schläge und Griffe, wirksame
  Aggressivität und Kontrolle der Kampffläche, in dieser Rangfolge. „Effective striking is judged
  by determining the number of legal strikes landed by a contestant and the significance of such
  legal strikes.“ Zitiert nach der Suchzusammenfassung zu
  https://abcboxing.com/Unified_Rules_of_MMA_Judging_Criteria.pdf (das PDF selbst war maschinell
  nicht lesbar) und https://sportsnaut.com/ufc/how-ufc-scoring-works-the-10-point-system-and-more/
- Boxen, die Verkündung als Spannungsmoment: „The first surprise came when ring announcer Michael
  Buffer announced that there was a split decision, and the biggest surprise came in the reading of
  the scores.“ — ESPN zu Bradley vs. Pacquiao,
  https://africa.espn.com/boxing/story/_/id/8032414/timothy-bradley-beats-manny-pacquiao-controversial-split-decision
- Gladiatoren: *pugnare ad digitum*, gekämpft „until the defeated gladiator raised his finger (or
  his hand or whole arm)“. *Stans missus*: „a draw, with both 'sent away standing.'“ —
  Archaeology, https://archaeology.org/issues/online/features/the-language-of-the-arena/

**Übertragung:** Die Rundenwertung wird eine **Kampfrichterwertung**: wirksame Treffer nach
Wucht, ein Bonus für das Finish und ein kleiner Betrag fürs Stehenbleiben. Das Ende eines
Kämpfers ist keine LP-Null, sondern eine **Aufgabe** („gibt auf“, *ad digitum*). Das passt zu
einem Text, der kein Bild hat. Der Reveal der Rundenwertung ist die Verkündung.

### 2.4 Kampfspiele: Finish und Comeback als benannte Momente

- Street Fighter IV: „The Revenge Gauge fills when one takes damage from their opponent“. Ultra
  Combos werden „towards the end of the round, either as a flashy finishing move or as a comeback
  mechanic“ eingesetzt — https://en.wikipedia.org/wiki/Street_Fighter_IV (über die
  Suchzusammenfassung)
- Mortal Kombat: „Prompted by the announcer saying 'Finish Him' or 'Finish Her', players have a
  short time window to execute a Fatality“ — https://en.wikipedia.org/wiki/Fatality_(Mortal_Kombat)
  (über die Suchzusammenfassung)

**Übertragung:** Ein **Bruchpunkt** („angeschlagen“) kündigt das Ende an, der **Finisher** ist
ein eigener Wurf mit eigenem Ausgang (gelingt oder wird überstanden). Das sind die zwei Zeilen,
die ein Zuschauer im Ticker sucht. Das Revenge-Prinzip gibt dem, der einsteckt, einen
Gegenschlag. Es ist optional, im Modell aber leicht rangtreue-positiv.

### 2.5 Textbasierte Battle Royales

Der BrantSteele Hunger Games Simulator ist rein textbasiert. Laut Beschreibung erzählt er aus
einer Teilnehmerliste „randomized“ Ereignisse, Todesraten und Arena-Ereignisse sind einstellbar.
Quellen: Suchzusammenfassung,
https://birdietalk-productions.fandom.com/wiki/BrantSteele_Hunger_Games_Simulator?oldid=6212,
und https://brantsteele.net/hungergames/disclaimer.php („purely an act of random fiction“).
**Übertragung, und zugleich Warnung:** Text trägt ein Battle Royale, wenn jede Zeile ein Ereignis
mit Folge ist. Der Simulator ist aber reiner Zufall. Mini-DM braucht dieselbe Erzählform mit
eignungstreuer Mechanik darunter, sonst ist es eine Lotterie mit Ticker.

### 2.6 Bewusst nicht übernommen

- **Royal-Rumble-Einstieg** (Teilnehmer kommen im 90-s- oder 2-min-Takt dazu, z. B.
  https://www.sescoops.com/article/wwe-royal-rumble-match-rules-explained): Bei vier Kämpfern
  hieße das, Startreihenfolge gleich Vorteil, also eine neue Lotterie wie die Ecken-Lotterie, die
  gerade erst ausgemittelt wurde.
- **Item- und Ausrüstungskontrolle** (Quake): bräuchte Raum und Laufwege, also genau die
  Geometrie, die dieses Konzept herausnimmt.

---

## 3. Das Konzept: „Der letzte Stand“

### 3.1 Die Idee in einem Absatz

Jede der vier FFA-Rollenrunden bleibt ein Vier-gegen-alle mit einem Leben, wie Chris es entschieden
hat. Sie läuft aber nicht mehr als Gerangel auf einem Sandplatz, sondern als **Schlagwechsel in
höchstens zwölf Takten**. In jedem Takt wählt jeder noch stehende Kämpfer ein Ziel und schlägt
einmal zu. Ob er trifft und wie hart, entscheiden benannte Kanäle, und jedes der sechs
Matrixattribute hat genau einen davon. Wer unter den Bruchpunkt fällt, ist **angeschlagen**. Der
nächste Treffer auf ihn wird ein **Finisher-Duell**: Der Angreifer setzt nach (Torment, ersatzweise
Power), der Angeschlagene beißt sich durch (Will, ersatzweise Health). Gelingt der Finisher, gibt er
auf. Gelingt er nicht, steht er mit zweitem Atem wieder. Ab Takt 9 zieht der Ring zu und frisst
Ausdauer. Gewertet wird wie von Kampfrichtern: Wucht der Treffer, ein Bonus fürs Finish, ein kleiner
Betrag je überstandenem Takt. Jeder Takt ist eine Tickerzeile, jeder Bruchpunkt und jeder Finisher
ein Ereignis.

### 3.2 Die Bausteine

**K1 — Schlagwechsel-Takt statt Laufgeometrie.** Er entfernt drei Quellen eignungsfremder Varianz
auf einmal: das Tempo (TMP, Kanal 2 aus 1.2), die Ecken- und Rückzugsgeometrie (Ecken-Lotterie,
`u.side===0`) und die Laufwege der Persönlichkeit (Zusammenhalt und Bindung, s. die
Opus-Empfehlung vom 02.10.). Die Persönlichkeit bleibt als **Zielneigung** erhalten (Schwächsten,
Bedrohung, Spitze, Nächsten). Das ist genau der Kanal, den die Opus-Zerlegung als harmlos für die
Rangtreue gemessen hat.

**K2 — Ein Kanal je Attribut, Menge aus der Eignung, Form aus dem Profil.**

| Attribut | Matrix | Primärkanal | Nebenweg |
|---|---:|---|---|
| torment | 24 | Wucht je Treffer („peinigen“) | Finisher setzen (primär) |
| health | 20 | Stand (Lebenspunkte) | Finisher überstehen (Nebenweg, ×0,6) |
| power | 16 | Wucht je Treffer („roher Hieb“) | Finisher setzen (Nebenweg, ×0,6) |
| stamina | 16 | Ermüdung ab Takt 5 | Ring aushalten |
| will | 14 | Finisher überstehen (primär) | — |
| dexterity | 10 | Treffer landen („Winkel finden“) | — |

Die Formeln lesen **nicht die Rohattribute**, sondern `a' = E + κ·(a − E)`. Dabei ist E die
matrixgewichtete Eignung des Kämpfers; im Motor wäre das `eigWert`, also mit Slot-Aufschlag,
Formkarte und Mutator. κ ist der Formanteil. Ein Lava Golem bleibt zäh, ein Peiniger bleibt hart,
aber *wie viel* einer insgesamt ist, sagt die Eignung. Das ist `aufEignung()`, konsequent auf
**alle** Kanäle angewandt, ohne Tempo, Ausdauer oder Mana außerhalb der Normierung. Abschnitt 1.5
zeigt, warum genau das die Rangtreue trägt. Abschnitt 4.4 zeigt, wo κ seine Grenze hat (≤ 0,5).

**K3 — Bruchpunkt und Finisher, mit Primär- und Nebenweg auf beiden Seiten.** Das ist Chris'
Mehrwege-Leitlinie im Kampf. Ein Peiniger setzt den Finisher über Torment, ein Kraftprotz über
Power, etwas schlechter. Ein Sturkopf übersteht ihn über Will, ein Koloss über Health, ebenfalls
etwas schlechter. Fables Idee, Will und Stamina einen Weg beim „Stehenbleiben“ zu geben (30.09.),
bekommt hier ihren mechanischen Ort. Zugleich ist das die direkte Antwort auf Kanal 3 aus 1.2:
**Einstecken wird ein eigener Weg zum Erfolg**, nicht nur ein Zeitgewinn für die Gegner.

**K4 — Vergeltung als erste Zielregel** (Fables M-3, hier konkret): Wer im letzten Takt getroffen
wurde, schlägt mit Wahrscheinlichkeit 0,6 auf seinen Angreifer zurück, sonst nach seiner Neigung.
Das bremst das Ganging und bindet Angriffe an Ereignisse statt an Sympathie. Im Modell: rho je
Runde +0,01 bis +0,04, Pp −3 bis −5 (Abschnitt 4.3).

**K5 — Der Ring** (Fables M-4, hier mechanisch): Ab Takt 9 verliert jeder Stand in wachsenden
Stufen (5 / 9 / 14 / 20), gemindert durch Stamina. Er garantiert ein Ende spätestens nach Takt 12,
also eine feste Sendezeit je Runde. Im Modell ist er rho-neutral (0,583 / 0,615 ohne gegen
0,580 / 0,615 mit). Er ist ein Takt- und Bildgeber, kein Rangtreue-Hebel.

**K6 — Zorn, optional** (Revenge Gauge): Eingesteckter Schaden füllt eine Leiste, voll gibt es
einen sicheren Gegenschlag mit Wucht ×1,6. Im Modell leicht positiv (rho je Runde
0,627 / 0,643 statt 0,580 / 0,615, Pp 13,3 / 11,0). Optional, weil es ein drittes Element im
Ticker ist. Ob das Bild das trägt, entscheidet die Sichtprüfung.

**K7 — Kampfrichterwertung als `wert()`**: `Wucht der Treffer + 25 je Finish (15 bei Aufgabe durch
Schaden) + 2 je überstandenem Takt + 4 je überstandenem Finisher`. Die Rundenpunkte 4-3-2-1 und die
Liga 2-1-0-0 bleiben unverändert, sie folgen aus diesem Rang. Gegenüber `beitragVon` zählt das
Überstehen eines Finishers ausdrücklich. Das ist der Wert, den die Matrix mit health und will
bepreist.

**K8 — Haltung als Manager-Hebel** (PR #1118, Chris' Gewichtheben-Gedanke auf den Kampf
übertragen): je Kämpfer **Angreifen / Normal / Absichern**.
- Angreifen: Wucht +10 %, eigene Deckung −10 %, versucht den Finisher schon ab 45 % Stand. Ein
  missglückter Finisher kostet einen Gegentreffer.
- Absichern: Wucht −8 %, Deckung +12 %, setzt erst ab 20 % nach.
- Die KI-Vorgabe ist deterministisch aus dem Kader: Wer mehr Finisher- als Zähigkeitswerte hat,
  greift an.
- Gemessen (4.3): rangtreue-neutral, Pp in der Schranke, und es tut genau, was Chris beschreibt.
  „Alle Angreifen“ hebt die Ausfallquote von 57 % auf 70 % und verkürzt die Runde, „alle
  Absichern“ senkt sie auf 46 %. Mehr Risiko heißt: übertrifft sich oder bricht ein.

**K9 — Der Joker** (Fable M-2, als „Mini-DM Paket 4“ vorgemerkt): unverändert übernommen. Jedes
Team verdoppelt die Rundenpunkte einer Rolle. Er ist die eine Aufstellungsentscheidung je Event,
mit einer richtigen Antwort, die vom Kader abhängt. Gemessen (4.3): Er kippt den Event-Sieger in
14,2 / 15,0 % der Events, also unter Fables Lotterie-Schwelle von 25 %, und kostet 0,02–0,05
Team-rho. Ein echter, aber kein beliebiger Hebel.

### 3.3 Wie es sich liest: eine Runde aus dem Modell

Gruppe 1, Runde „Frontliner“, Konzeptmodell mit Zorn, je Rolle der Eignungsbeste:

```
T3: Abyssalfin ist angeschlagen (Bruchpunkt)
T4: Broxingar setzt den Finisher — Abyssalfin gibt auf
T5: Tidesprinter ist angeschlagen (Bruchpunkt)
T6: Tidesprinter übersteht den Finisher von Vorrak
T6: Broxingar ist angeschlagen (Bruchpunkt)
T7: Tidesprinter ist angeschlagen (Bruchpunkt)
T7: Broxingar setzt den Finisher — Tidesprinter gibt auf
T8: Vorrak setzt den Finisher — Broxingar gibt auf
Vorrak (Eignung 73,5) 132 Wertungspunkte, steht · Tidesprinter (64,2) 122 · Broxingar (49,3) 103 · Abyssalfin (38,5) 31
```

Acht Ereigniszeilen in einer Runde: ein überstandener Finisher, ein Außenseiter, der dem
Zweitbesten das Licht ausbläst, und der Favorit, der am Ende steht. Die Rangfolge der Wertung
entspricht hier exakt der Eignung, obwohl der Ausgang unterwegs offen aussah. Im Mittel des Modells
gibt es je Runde rund 22 Treffer, 4,3 Bruchpunkte und 3,8 Finisher-Versuche. Das sind die Zeilen,
die dem heutigen Reveal fehlen.

### 3.4 Die größere Alternative: „Kreis der Vier“ (jeder gegen jeden)

Dieselben Bausteine, aber jede Rollenrunde wird statt des Vier-gegen-alle aus **sechs kurzen
Duellen** (je höchstens sechs Takte) gebildet. Jeder Kämpfer bestreitet drei. Das eliminiert den
Königsmacher (Verlust 2 aus 1.5) vollständig. Im Modell: rho je Runde **0,72 / 0,73**, Paare
≥ 15 zu **98,5 / 98,4 %** richtig (Hockey-Niveau), Team-rho 0,87 / 0,89, Pp 23,1 / 25,0, also auf
der Schranke, mit kleinerem Stand-Bonus 21,5 / 23,7. **Aber:** Das ist nicht mehr Chris'
„1v1v1v1, Elimination ohne Respawn“, sondern ein Rundenturnier mit doppelter Ereigniszahl. Es ist
ein Formateingriff (M plus T) und wird hier nur als Option für Chris dokumentiert, nicht empfohlen.

---

## 4. Experiment: was das Modell zeigt und was nicht

### 4.1 Hauptvergleich (gleiche Kader, gleiche Gruppenziehung, gleiche Kennzahlen)

| | Motor-FFA heute | Konzept FFA, Rohattribute ×2 | **Konzept FFA, Form/Menge ×3** | Konzept FFA, Form/Menge ×4 | Konzept „Kreis“, Form/Menge ×3 |
|---|---|---|---|---|---|
| rho je Runde | 0,398 / 0,417 | 0,403 / 0,391 | **0,580 / 0,615** | 0,662 / 0,663 | 0,724 / 0,728 |
| rho je Event (16) | 0,363 / 0,367 | 0,327 / 0,329 | 0,479 / 0,499 | — | 0,565 / 0,577 |
| Star gewinnt Runde | 48,8 / 51,0 % | 42 / 39 % | **59 / 61 %** | 64 / 63 % | 61 / 61 % |
| Paare ≥ 15 richtig | 82,6 / 82,8 % | 82,6 / 83,0 % | **91,8 / 93,0 %** | 95,1 % | 98,5 / 98,4 % |
| Paare 5–15 richtig | 66,5 / 67,4 % | 63,2 / 61,9 % | 73,8 % | 79,6 % | 84,9 % |
| Team-rho | 0,627 / 0,612 | 0,60 / 0,54 | **0,76 / 0,79** | 0,80 / 0,81 | 0,87 / 0,89 |
| Pp | 15,6 / 14,8 | 45,2 / 51,4 | **11,1 / 13,8** | 12,5 / 14,9 | 23,1 / 25,0 |

Werte als Strom A / Strom B. Wo nur eine Zahl steht, ist es Strom A. 120 Events je Strom für die
Rangtreue, Pp gepaart über 384 Kämpfer-Proben je Strom. „Spreizung ×k“ skaliert alle sieben
Kanalkoeffizienten gemeinsam. Sie verschiebt die Stärke des Eignungssignals gegen den Würfel,
nicht die Gewichtung.

### 4.2 Was die Spalten sagen

- **Rohattribute ×2 gegen Form/Menge ×3** ist der Kern des Befunds. Dieselbe Takt-Mechanik ohne
  Form/Menge-Trennung ist nicht besser als der Motor und verletzt Pp (45–51). Mit der Trennung
  steigen alle fünf Rangtreue-Größen, und Pp fällt auf 11–14. **Die Takt-Mechanik allein trägt
  nichts, die konsequente Normierung trägt.**
- **Mehr Spreizung hilft bis zu einem Punkt.** ×4 bringt +0,05 bis +0,08 rho je Runde, ohne Pp zu
  verletzen. Der Preis ist Vorhersehbarkeit: Der Star gewinnt dann zwei von drei Runden. Wo genau
  „spannend“ in „entschieden“ kippt, ist eine Geschmacksfrage für Chris' Sichtprüfung, keine
  Messfrage.
- **Die Verlässlichkeit ist hier der Engpass, nicht die Uhr.** 20 statt 12 Takte bringen nichts
  (0,571 / 0,588). Das bestätigt die CLAUDE.md-Regel „mehr Ereignisse helfen fast nie“ auch für
  dieses Format.

### 4.3 Varianten auf der Hauptkonfiguration (Form/Menge ×3)

| Variante | rho je Runde | Star | Team-rho | Pp | Ausfallquote | Takte | Finisher-Versuche |
|---|---|---|---|---|---:|---:|---:|
| Haltung alle Normal (Basis) | 0,580 / 0,615 | 59 / 61 % | 0,76 / 0,79 | 11,1 / 13,8 | 57 % | 11,5 | 3,8 |
| Haltung KI-Vorgabe aus dem Kader | 0,576 / 0,621 | 55 / 61 % | 0,73 / 0,76 | 19,4 / 9,0 | 58 % | 11,3 | 3,6 |
| Extremfall alle Angreifen | 0,602 / 0,617 | 60 / 62 % | 0,78 / 0,77 | 12,2 / 19,7 | 70 % | 10,3 | 4,7 |
| Extremfall alle Absichern | 0,603 / 0,583 | 57 / 59 % | 0,75 / 0,78 | 9,1 / 18,0 | 46 % | 11,9 | 2,7 |
| mit Zorn-Gegenschlag (K6) | 0,627 / 0,643 | 63 / 60 % | 0,77 / 0,80 | 13,3 / 11,0 | 64 % | 10,9 | 3,8 |
| ohne Ring | 0,583 / 0,615 | 59 / 61 % | 0,76 / 0,79 | 11,1 / 13,8 | 59 % | 11,5 | 3,9 |
| ohne Vergeltung | 0,573 / 0,577 | 59 / 62 % | 0,75 / 0,73 | 16,4 / 16,0 | 56 % | 11,5 | 3,9 |
| 20 statt 12 Takte | 0,571 / 0,588 | 62 / 61 % | 0,75 / 0,76 | 11,4 / 13,3 | 72 % | 14,1 | 4,9 |

Joker (K9), Team-rho ohne → mit: 0,760 / 0,790 → 0,738 / 0,737. Er kippt den Event-Sieger in
14,2 / 15,0 % der Events.

Die Designregeln aus PR #1118 gelten auch hier. **Normal** ist die Basis. **Kein Knopf ist immer
besser**: Angreifen und Absichern liegen in der Rangtreue innerhalb von ±0,03 um Normal und
verschieben vor allem Ausfallquote und Rundenlänge. Die **Extremfälle** „alle Angreifen“ und „alle
Absichern“ verletzen weder rho noch Pp.

### 4.4 Der Formanteil κ: wie viel Profil verträgt die Matrix?

| κ (FFA, ×3) | rho je Runde | Star | Team-rho | Pp |
|---|---|---|---|---|
| 0,2 | 0,594 / 0,626 | 60 / 65 % | 0,74 / 0,79 | 12,1 / 13,6 |
| **0,3** | **0,580 / 0,615** | **59 / 61 %** | **0,76 / 0,79** | **11,1 / 13,8** |
| 0,5 | 0,560 / 0,566 | 52 / 56 % | 0,74 / 0,74 | 18,7 / 17,2 |
| 0,7 | 0,543 / 0,513 | 50 / 46 % | 0,71 / 0,69 | 33,6 / 32,5 |

κ ≤ 0,5 hält die Schranke, κ = 0,7 bricht sie. Je mehr das Profil statt der Eignung entscheidet,
desto mehr misst der Kampf Begegnungen statt der Summe (1.5). **Empfehlung κ = 0,3:** Das Profil
bleibt im Ticker lesbar (wer zäh ist, übersteht Finisher, wer peinigt, setzt sie), ohne die
Rangtreue zu verschieben.

### 4.5 Ehrliche Grenzen dieses Experiments

- **Es ist ein Modell, nicht der Motor.** Es kennt keine Formkarten, Mutatoren, Slot-Aufschläge,
  Skills und Archetypen. Die Zielneigung kommt aus einem Namens-Hash statt aus `leitePers()`. Im
  Motor gingen Slot, Form und Mutator über `eigWert` in die Menge E ein. Das ist dieselbe Stelle
  wie heute in `aufEignung()`. Das Prinzip sollte also tragen, die genauen Zahlen müssen am Motor
  neu gemessen werden.
- **Die Vergleichbarkeit ist eine der Kennzahlen, nicht der Mechanik.** Motor-FFA und Modell liefen
  auf denselben zehn Kadern, derselben Gruppenziehung, mit derselben Einsatzregel (Rolle i bekommt
  den i-tbesten) und denselben Kennzahlen. Das Modell ist aber einfacher als der Motor. Seine
  absolute Höhe ist eine Richtung, kein Versprechen.
- **Die Kalibrierung lief nicht nach der Budget-Methode.** Die Kanalkoeffizienten sind von Hand
  gesetzt, und Pp liegt bereits ohne Kalibrierschleife bei 11–15. Eine Kalibrierung brächte also
  wenig. Sie ist im Modell in Sekunden möglich, im Motor kostet ein Arena-Pp-Lauf Minuten bis
  Stunden (TDM ~785 s je Lauf, Mini-DM-4v4 ~75 s). Ein Takt-Kern wäre ein zusätzlicher Gewinn:
  Die Pflichtprüfung würde billig.
- **Die drei 4v4-Kanäle (1.2) sind gemessen, ihre Behebung im 4v4 nicht.** Für TDM und Battlefield
  folgt aus dem Mana-Befund nur ein Prüfauftrag (Abschnitt 6).

---

## 5. Klasse und Pakete

Klassen wie in den Fable-Papieren vom 30.09.: **A** = reine Anzeige, rho bit-identisch. **A\*** =
Anzeige mit eigener Buchhaltung, Ergebnis unverändert, Zufallskette nachweislich unberührt. **B** =
echte Mechanik, Normal bit-identisch, braucht Zustimmung und kaderfeste rho- und Pp-Messung. **M** =
neue Kernmechanik einer Disziplin. **T** = Sendezeit oder Spielablauf, braucht Chris' ausdrückliche
Zustimmung und wird nicht ohne sie gebaut. Klasse C verwende ich nicht.

| Paket | Inhalt | Klasse | Aufwand | Voraussetzung |
|---|---|---|---|---|
| **P0** | Die Mini-DM-Abnahme misst das FFA: `MOTOREN["mini-dm"]` beziehungsweise eine eigene Sonde auf `spieleMiniDmFfaEvent`, Abnahme je Runde (Star, Paartreue, rho der vier), Pp über das FFA. Die Scratch-Sonden dieser Runde sind die Vorlage. | Messwerkzeug, kein Spielverhalten (A\*-artig). Ändert die offizielle Zahl, deshalb Chris fragen. | klein | Frage 1 |
| **P1** | Kern „Der letzte Stand“: K1 Takt, K2 Kanäle mit Form/Menge (κ = 0,3), K3 Bruchpunkt/Finisher, K4 Vergeltung, K5 Ring, K7 Kampfrichterwertung. Als **eigene Runden-Funktion neben** `baueMiniDmFfaRunde`. Das geteilte Arena-Chassis (TDM, Battlefield) bleibt dadurch strukturell unberührt. | **M** | mittel | P0, Frage 2 |
| **P2** | Haltung Angreifen/Normal/Absichern je Kämpfer (K8), KI-Vorgabe aus dem Kader, über das Grundgerüst aus PR #1118 (Zeile 0) | B (auf P1) | klein | P1, Grundgerüst #1118 |
| **P3** | Joker (K9), wie als „Mini-DM Paket 4 (M-2)“ vorgemerkt | M (unverändert vorgemerkt) | klein | P0, besser nach P1 |
| **P4a** | Ticker im **heutigen** Reveal-Takt: Jede Rundenkarte zeigt nach dem Aufdecken drei bis vier Ereigniszeilen (Bruchpunkt, Finisher, Aufgabe), aus dem bereits fertig berechneten Ergebnis. Keine längere Sendezeit. | A\* | klein | P1 |
| **P4b** | Takt-für-Takt-Reveal (eine Zeile je Takt, Ring als Bild, „Finish him“-Moment mit Pause, Wertungsverkündung als Split-Decision-Moment) | **T**, nur mit Chris' ausdrücklicher Zustimmung | mittel | P1, Frage 4 |
| P5 | optional: Zorn-Gegenschlag (K6) | B (auf P1) | klein | Sichtprüfung |
| Opt. | „Kreis der Vier“ statt Vier-gegen-alle (3.4) | **M + T** (Formateingriff) | mittel | nur auf Chris' Wunsch |

**Was dieses Konzept bewusst nicht anfasst:** die Eignungsmatrix (gesperrt, an keiner Stelle
berührt), Chris' 4-3-2-1 / 2-1-0-0 und die vier Rollen, das 4-gegen-4-Chassis von TDM und
Battlefield, die Zielneigungen der Persönlichkeiten.

---

## 6. rho- und Pp-Risiko

- **rho:** Im Modell steigen alle fünf Größen deutlich. **0,80 je Runde erreicht in Chris'
  Format keine Variante** (bestenfalls 0,66 bei ×4). Das FFA kostet nach 1.5 strukturell rund 0,2
  Validität, bei vier Kämpfern je Runde mit oft kleinen Eignungsabständen (28 % der Paare liegen
  unter 5 Punkten). Was erreichbar aussieht, ist die „ehrlichere Abnahme“: Paare ≥ 15 zu 92–95 %
  richtig, der Star gewinnt 59–64 % der Runden (Hockey: 58 % Rang 1, kaderfest). Wenn Chris 0,80
  je Runde verlangt, führt der Weg nur über den „Kreis der Vier“ (0,72–0,73), und auch der liegt
  noch darunter.
- **Pp:** Im Modell 11–15 ohne Kalibrierung, und strukturell gut begründet: Ohne Tempo und Mana
  gibt es keinen Kanal außerhalb der Normierung. Das Risiko liegt bei κ (4.4) und beim
  Stand-Bonus der Wertung (K7). Beides sind Zahlen, keine Formeln, und am Motor schnell zu prüfen.
- **Isolationsrisiko gering:** P1 ist eine eigene Runden-Funktion. TDM und Battlefield laufen
  weiter über `build()` und `stepSim()`. Der Nachweis wäre `miss-alle-disziplinen.mjs 24`
  bit-identisch für die übrigen 19.
- **Nebenbefund für TDM und Battlefield** (nicht Teil dieses Konzepts): `MANAREZEPT` speist dort
  Spirit, Intelligence und Will in jedem Fall mit, unabhängig von der Disziplinmatrix. Zur
  Erinnerung, dieselbe Messung für TDM (`tdm-pp-rezeptrunde-diagnose-02-10.md`) las Spirit
  einmal +5,6 und einmal −10,4. Das Mana-Leck ist ein plausibler, ungeprüfter Kandidat für diese
  Unruhe. Es lohnt sich als eigener, kleiner Prüfauftrag.
- **Sichtrisiko:** Ein Schlagwechsel ohne Laufbild ist im FFA kein Verlust, denn ein Bild gibt es
  dort heute nicht. Er wäre aber ein Verlust, wenn Chris später doch eine Vier-Ecken-Animation
  will. Dann braucht die Animation eine Choreografie aus den Takten (wer wen trifft), nicht
  umgekehrt. Das ist machbar, weil jeder Takt ein festes Ereignis ist.

---

## 7. Offene Fragen an Chris

1. **Abnahme:** Darf die Mini-DM-Abnahme künftig das FFA messen, das gespielt wird, und **je
   Runde** abnehmen (Star gewinnt, Paare mit Abstand richtig, rho der vier) statt ein rho über
   16 Kämpfer aus vier verschiedenen Rollenrunden? Damit fiele die heutige Pp-Verletzung weg
   (FFA: 15 Pp), und rho würde ehrlich gemessen (heute 0,40 je Runde).
2. **Kern:** Darf jede FFA-Runde ein Schlagwechsel in höchstens zwölf Takten werden, mit
   Bruchpunkt, Finisher (setzen über Torment oder Power, überstehen über Will oder Health) und
   Ring, statt des heutigen Gerangels auf dem Sandplatz? Format, Rollen, Rundenpunkte und
   Ligapunkte blieben gleich.
3. **Haltung:** Soll der Manager je Kämpfer „Angreifen / Normal / Absichern“ setzen können? Im
   Modell rangtreue-neutral; Angreifen heißt mehr Finisher und mehr Aufgaben auf beiden Seiten.
4. **Sendezeit (Klasse T):** Soll der Reveal Takt für Takt laufen, mit „Finish him“-Pause und
   Verkündung der Wertung, also länger als heute? Oder bleibt der heutige Kartentakt, mit drei
   bis vier Ereigniszeilen je Karte?
5. **Spreizung:** Wie vorhersehbar darf Mini-DM sein? Bei ×3 gewinnt der Eignungsbeste rund 60 %
   der Runden, bei ×4 rund zwei Drittel.
6. **Option „Kreis der Vier“:** Wäre jeder gegen jeden in sechs kurzen Duellen je Rolle für dich
   noch „Mini-DM“? Das ist die einzige Variante, die in die Nähe von 0,80 kommt (0,72–0,73), aber
   sie ist nicht mehr dein 1v1v1v1.

---

## Anhang A — Methode (zum Wiederholen, kein Skript im Repo)

Alle Skripte lagen im Scratch-Verzeichnis neben einer Kopie von `public/mockups/`, `scripts/` und
`data/generated/`, mit Link auf das `node_modules` des Haupt-Checkouts. Nichts davon ist committet.

1. **4v4-Pp:** `window.__arena.einflussVon("mini-dm", 6, 15, versatz)` über Playwright (gleiche
   Startsequenz wie `messe-arena-einfluss.mjs`, ohne AudioContext, `setTimeout` während des
   Aufrufs stillgelegt). Acht Stücke: Versätze 0 / 1 000 003 / 2 000 003 / 3 000 003 (Strom A)
   und 10 000 000 / 11 000 003 / 12 000 003 / 13 000 003 (Strom B). Die Rohgewinne wurden je Strom
   gemittelt und wie in `einflussVon()` positiv normiert. Rund 75 s je Lauf. Stückweise, weil
   parallel laufende Browser in der geteilten Umgebung einmal gemeinsam beendet wurden.
2. **FFA-Rangtreue:** `window.__arena.miniDmFfaRunde(vier, rolle, saat)` auf den zehn Kadern der
   Kaderfamilie (Skills wie `mitKit`). 20 Vierergruppen aus einem festen LCG (Saat 99991), je sechs
   Event-Saaten `7001 + versatz + g·7919 + i·104729`, Rundensaat wie in `spieleMiniDmFfaEvent`.
   Eignung = `p.d["mini-dm"]`, Wert = Anteil am Rundenbeitrag. Rund 3,5 min je Strom.
3. **FFA-Pp:** wie 2., je Runde und Kämpfer jedes der zwölf Attribute +15 (gedeckelt bei 100),
   `p.d["mini-dm"]` um Δ·Gewicht/100 mit (entspricht `hebungRoh` + `eigHebung`), gleiche
   Rundensaat, Gewinn im Rundenanteil. Je Strom drei Stücke à sechs Gruppen.
4. **Konzeptmodell:** reines Node-Skript, Mechanik wie in Abschnitt 3.2. Zufall je (Saat,
   Kämpferplatz, Takt, Zweck) aus einem Hash, damit die Pp-Messung gepaart bleibt. Gruppenziehung
   und Einsatzregel wie in 2. Kennzahlen: rho je Runde und Event, Star, Paartreue nach
   Eignungsabstand, Team-rho, Verlässlichkeit (rho der Wertvektoren zweier Saaten derselben
   Gruppe), Validität (rho der über 40 Saaten gemittelten Anteile), Pp nach der Budget-Methode
   (8 Gruppen × 3 Saaten × 4 Runden × 4 Kämpfer je Strom). Grundkoeffizienten: Wucht Torment
   0,42 / Power 0,30, Treffer Dexterity 0,16, Stand Health 0,40, Finisher-Abwehr Will 0,34
   (Health-Nebenweg ×0,6), Finisher setzen Torment 0,34 (Power-Nebenweg ×0,6), Ausdauer 0,9,
   Bruchpunkt 30 %, alle mit der Spreizung ×k skaliert. Laufzeit des ganzen Modells: Sekunden.

**Nicht gemessen:** das Konzept am echten Motor, Pp bei n = 48, die Ursache, warum das Mana-Leck
im FFA nicht greift, die Wirkung des Mana-Lecks in TDM und Battlefield, eine Sichtprüfung des
Tickers.

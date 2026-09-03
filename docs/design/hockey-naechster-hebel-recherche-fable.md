# Recherche: Der nächste Hebel für Hockey — was die Mechanik noch nicht belohnt, und was zuerst (Fable)

Stand: Arbeitsbaum auf `main` `44f87395` (Hockey-Rezept aus `hockey-rezept-ursache.md`,
Kurve aus `hockey-eigene-erfolgskurve.md`, Messgrundlage aus `messgrundlage-kaderfest.md`).
Alle `engine.js`-Angaben meinen `public/mockups/battle-mode.engine.js` auf diesem Stand.
**Kein Motor, kein Rezept, keine Repo-Datei angefasst** — gemessen wurde mit zwei eigenen
Sonden im Scratchpad (Abschnitt 0.2), die entweder nur lesen (`feldspielProbe`) oder in
einer **Kopie** von Mockup/Motor/Rezepten drei `logZug`-Zeilen ergänzen. Beide sind auf
`scripts/`-Niveau nachbaubar und sollten in der Bauwunde mit ins Repo.

Auftrag: einen echten Mechanik-Hebel finden, der Hockeys Einzelspiel-Rangtreue (heute 0,589
kaderfest, 0,647 Einzelkader) Richtung 0,80 bewegt — **kein** weiteres Rezept auf demselben
Sub-Skill-Satz (zweimal gemessen erschöpft, `hockey-ueber-080-versuch2.md`), **kein**
LINIENSPIEL (von Chris ausdrücklich nicht beauftragt), und jeder Vorschlag gegen Basketballs
fertige Mechaniken gebenchmarkt.

---

## Die Antworten, ohne Architekturwissen lesbar

**1. Die Hälfte des Rückstands ist gar keine Mechanik-Lücke, sondern der Torwart in der
Rangliste.** Die Abnahme (`disziplinProbe`, `engine.js:16659`) ordnet alle zwölf Spieler
eines Spiels in EINE Rangfolge — auch die beiden Torhüter. Ihre Eignung ist die
Hockey-Matrix (power/health), ihr Spielwert ist eine Torwart-Formel (`HK_TW_BASIS + GSAA·2`,
`engine.js:5447`), und GSAA schwankt je Spiel um ±3,4 Punkte, weil 40 Schüsse mit 9 %
Torwahrscheinlichkeit rein zufällig um ±1,8 Gegentore streuen — mehr, als der ganze
PARADE-Unterschied zwischen dem besten und dem schlechtesten gefeldeten Torwart (1,35 Tore)
ausmacht. Der Torwart steht deshalb im Mittel auf Eignungsrang 5,3 und auf Wertrang 7,5 von
zwölf, und das allein drückt rho je Spiel von **0,651 (nur Feldspieler) auf 0,589 (alle
zwölf)**. Der eignungsbeste Feldspieler landet ohne Torhüter in 53 % der Spiele auf Rang 1
(mit: 41 %) und nur noch in 3 % auf dem letzten Platz (mit: 10 %). **Empfehlung: die
0,80-Schranke für Hockey über die Feldspieler messen und den Torwart mit seiner eigenen
Probe abnehmen (`scripts/miss-rangtreue-nach-rolle.mjs` existiert dafür bereits).** Das ist
eine Entscheidung für Chris, keine Technikfrage — aber ohne sie misst jede weitere Runde
ein Rauschen, das keine Mechanik der Welt wegbekommt (Abschnitt 1).

**2. Die Aussage „mehr Ereignisse helfen bei Hockey nicht" (CLAUDE.md) stimmt für die
Zwölfer-Rangliste und ist für die Feldspieler falsch — und beides aus demselben Grund.**
Mit verdoppelter Drittellänge (3 × 160 s statt 3 × 80 s, in einer Kopie gemessen) steigt rho
je Spiel bei den Feldspielern von 0,651 auf **0,749**, während es über alle zwölf von 0,589
auf **0,535 fällt**: der Torwart bekommt doppelt so viele Schüsse, sein GSAA streut ±5,7
statt ±3,4, und er rutscht auf Wertrang 9,5. Die frühere „flache" Messreihe (0,719 / 0,721
/ 0,723) hat genau diese zwei gegenläufigen Bewegungen addiert. **Die Verlässlichkeit ist
also KEIN toter Hebel** — aber Chris hat 3 × 1:20 entschieden, und dieser Bericht schlägt
keine längere Uhr vor. Er schlägt vor, die Verlässlichkeit *innerhalb* der 240 Sekunden zu
heben, indem ein hochfrequentes, heute skill-blindes Ereignis an eine Fähigkeit gehängt
wird (Punkt 4).

**3. Eine Umgewichtung der heutigen Boxscore-Posten kann 0,80 nicht erreichen — auch nicht
mit Orakelwissen.** Ein Kleinste-Quadrate-Fit der Eignung auf alle neun Posten (Tore,
Vorlagen, Schüsse, xG, Pucks, Steals, Blöcke, Verluste, Strafen; in-sample, also eine
Obergrenze, die keine ehrliche Formel je erreicht) liefert rho je Spiel **0,730** über die
Feldspieler. Das bestätigt `hockey-ueber-080-versuch2.md` von der anderen Seite: nicht das
Rezept und nicht die Wertformel sind die Decke, sondern **welche Ereignisse das Spiel
überhaupt erzeugt**. Es braucht ein neues Ereignis, kein neues Gewicht.

**4. Der Kandidat mit dem größten Hebel ist der Zoneneintritt als Zweikampf an der blauen
Linie — real der wiederholbarste Einzelkanal des Eishockeys, im Motor heute vorhanden, aber
blind.** Nachgemessen in der instrumentierten Kopie: jeder Feldspieler trägt den Puck
**4,8-mal je Spiel** mit Besitz über die blaue Linie (`HK_RADIUS_MAX`), das ist über die
Saison mit Retest 0,948 der zweitverlässlichste Posten überhaupt — aber er hängt an
**AUFBAU mit rho 0,04 und an LAUFTEMPO mit −0,03**. Wer einträgt, ist, wer den Puck gerade
hat (ZWEITCHANCE 0,46, SCHUSS_FERN 0,50: die Point-Verteidiger tragen ihn hoch), nicht wer
es kann. Der Eintritt ist heute ein Laufweg ohne Würfel: die Verteidigung hat auf der Strecke
zwischen eigener Zone und `HK_WUNSCH_MAX` keinen Zugriff außer der Steal-Lotterie in 45 px
alle 2 Sekunden (`versucheSteal`). Real entscheidet dort das „Gap" des Verteidigers und die
Puckführung des Angreifers: 0,57 Schüsse je kontrolliertem Eintritt gegen 0,12 je Dump-in
(Tulsky), kontrollierte Eintrittsquote bei Stürmern R² 0,72 Jahr zu Jahr, und
Eintritts-Abwehr die wiederholbarste Verteidiger-Statistik der Tracking-Daten. Schon der
**blinde** Eintritt hebt, mit 0,5 je Eintritt in die Wertformel gelegt, die Saison-Validität
der Feldspieler von 0,842 auf **0,903** — ein Eintritt, der an AUFBAU/LAUFTEMPO gegen ABWEHR
hängt, würde diese Validität mit Verlässlichkeit unterfüttern. Bauform: ein einziges
Paar-Los mit fester Zahl `rr()`-Würfe beim Überschreiten der Linie, drei Ausgänge
(kontrolliert / Dump in die Ecke / abgefangen), zwei Boxscore-Spalten (Eintritte,
abgewehrte Eintritte). Basketball hat dafür kein Gegenstück (keine blaue Linie) — die
nächste Verwandtschaft ist die Paarungs-Bauform von `startFastbreak` (`vorsprung` gegen den
schnellsten Gegner) und `bedraengnisGate` (Abstand als stufenloser Faktor). Nicht nach
Basketball zurückportieren.

**5. Zweiter Kandidat: Netfront-Schirm und Ablenker.** Heute steht bei 17 % aller Schüsse
von der blauen Linie ein eigener Mitspieler geometrisch auf der Schusslinie im Slot — ohne
jede Wirkung. Real senkt ein geschirmter Schuss die Fangquote um über zehn Punkte, und ein
abgelenkter Schuss trifft zu 14,5 % gegen 4,9 % bei klaren Schüssen. Das gäbe dem
Netfront-Spieler (heute: 36 % aller Teamschüsse, Tore fast nur über lose Pucks) einen
Torkanal über SCHUSS_NAH und dem Point-Schützen (power) einen Vorlagen-Kanal. Basketballs
Alley-Oop (`spielzuege`, `wirf(u,kandidat,…,"dunk",…)` mit eigenem `abschluss`) ist exakt
die Bauform: ein Wurf, dessen Schütze ein anderer ist als der Abspieler.

**6. Kleiner Nebenhebel, keine Mechanik: Tore halb als xG buchen.** Die Trefferchance jedes
Schusses steht im Motor beim Abschuss fest (`hockeySchussAusgang`, `pTor`); sie halb statt
des Tores zu buchen hebt die Spiel-zu-Spiel-Verlässlichkeit von 0,661 auf 0,710 und rho je
Spiel um 0,016 — gemessen, klein, billig, ohne Rezeptberührung. Mitnehmen, nicht darauf
bauen.

**Reihenfolge:** erst 1 (Entscheidung, null Zeilen Motor), dann 4 mit 6 zusammen (eine
Runde, eine Messung), dann 5. Was 0,80 rechnerisch braucht, steht in 1.4: bei 240 Sekunden
und Verlässlichkeit 0,66 kann selbst eine perfekte Validität nur 0,81 erreichen — Validität
**und** Verlässlichkeit müssen beide steigen, und der Zoneneintritt ist der einzige
gefundene Kanal, der beides zugleich anfasst.

---

## 0. Was gemessen wurde, womit, und was nur gelesen ist

### 0.1 Nachgemessen (Playwright/Chromium `/opt/pw-browsers/chromium-1194`, 24 Spiele je Kader-Paarung, die fünf echten Paarungen aus `data/generated/kaderfamilie-live-save.json`, Saaten `1337+i·7919`)

Erste Amtshandlung war die Reproduktion der kaderfesten Basislinie: `feldspielProbe("hockey")`
über die fünf Paarungen liefert **0,589 / 0,748** (Median rho je Spiel / Saison) — Ziffer für
Ziffer die Zahl aus `data/generated/rangtreue-basislinie.json`. Alles Folgende ist auf
denselben Spielen gerechnet.

| Zahl | Ergebnis |
|---|---|
| rho je Spiel, alle 12 (Basislinie) | **0,589** [Spanne 0,44–0,73], Saison 0,748 |
| rho je Spiel, nur 10 Feldspieler | **0,651** [0,60–0,80], Saison 0,818 |
| Spiel-zu-Spiel-Retest der Wert-Rangfolge (die Verlässlichkeit aus CLAUDE.md) | alle 12: 0,555 · Feldspieler: **0,661** |
| Zerlegung nach CLAUDE.md, Feldspieler | 0,818 × √0,661 = 0,665 gegen gemessen 0,651 — die Formel trägt |
| Star (eignungsbester Feldspieler) auf Rang 1 / in den ersten zwei / auf dem letzten | alle 12: 41 % / 56 % / 10 % · Feldspieler: **53 % / 73 % / 3 %** |
| Torwart: mittlerer Eignungsrang / Wertrang im Zwölferfeld | 5,33 / **7,53**; Spearman(Eignung, Wert) über 240 Torwart-Zeilen 0,262 |
| Torwart: PARADE gegen GSAA | je Spiel 0,367, je Identität (24 Torhüter) 0,392; Eignung gegen PARADE 0,461 |
| Torwart: Schüsse aufs Tor je Spiel / Fangquote / sd(GSAA) | 40,3 / 88,2 % / **3,38** |
| PARADE-Spanne der gefeldeten Torhüter → `paradeFaktor` | 61–99 → 0,754–0,550; erwartete Gegentor-Differenz bei 40 Schüssen **1,35**, binomiales Rauschen **1,82** |
| Feldspieler je Spiel (Mittel ± sd) | Tore 1,04 ± 1,67 · Vorlagen 0,99 ± 1,47 · Schüsse 9,20 ± 6,51 · xG 1,04 ± 1,06 · lose Pucks 6,88 ± 8,25 · Steals 1,99 ± 1,53 · Blöcke 0,17 ± 0,43 · Verluste 3,52 ± 2,23 |
| Schussanteil des meistschießenden Feldspielers je Team | **36,3 %** (Impact-Bericht: 56 % vor Schritt 3; NHL-Spitze 14 %) |
| Trefferquote je Stufe (je Versuch, Blöcke eingeschlossen) | dunk 23,1 % (n=290) · nah 21,3 % (2617) · mit 10,4 % (2470) · fern 6,4 % (5642) |
| Saison, je Spieler: rho(Eignung, X) | Schüsse 0,75 · SCHUSS_NAH 0,70 · ZWEITCHANCE 0,66 · AUFBAU 0,44 · Nah-Anteil der Versuche 0,38 |
| **Kopie mit 3 × 160 s** (sonst zeichengleich) | alle 12: **0,535** · Feldspieler: **0,749** [0,71–0,84], Saison 0,804, Retest 0,788 · Torwart Wertrang 9,52, sd(GSAA) 5,72 |
| **Orakel** (KQ-Fit Eignung ~ neun Posten, in-sample) | rho je Spiel **0,730**, Saison 0,846, Retest 0,722 (bei 3 × 160 s: 0,772) |

**Instrumentierte Kopie** (drei `logZug`-Zeilen: Zoneneintritt mit Puck, Zoneneintritt per
Pass, Ballbesitz-Start; dazu ein Zeitstempel in `logZug` und eine Schussgeometrie-Zeile in
`wirf`; `node --check` sauber, Repo unberührt). Achtung, andere Messbasis: die Kopie fährt
`spiele()` statt `feldspielProbe()` und zieht damit **keine** Formkarten je Spiel — die
Eignung ist je Spieler konstant, deshalb liest dort schon der unveränderte Wert 0,702 je
Spiel statt 0,651. Zahlen aus dieser Tabelle nur untereinander vergleichen:

| Zahl | Ergebnis |
|---|---|
| Zoneneintritte mit Puck („carryIn", Feldspieler je Spiel) | **4,79** (~24 je Team — NHL ~20–25 kontrollierte Eintritte je Team, Größenordnung stimmt) |
| Eintritte per Pass in die Zone („passIn") | 1,07 |
| Ballbesitz-Starts je Feldspieler (davon außerhalb der Angriffszone) | 17,16 (12,23) |
| Anteil der Schüsse binnen 4 s nach einem Eintritt | 73 % (8156 von 11110) — bei dreizehnfacher NHL-Ereignisdichte ist das Spiel ein einziger Rush; ein pauschaler Rush-Bonus wäre so uniform wie Basketballs verworfener Assist-Bonus (`engine.js:6190`) und wird **nicht** vorgeschlagen |
| rho(Eignung, carryIn) je Spiel / Saison; Retest Saison / Spiel-zu-Spiel | 0,460 / 0,624; **0,948** / 0,539 |
| carryIn je Spieler gegen Sub-Skills | eig 0,65 · **AUFBAU 0,04 · LAUFTEMPO −0,03** · ZWEITCHANCE 0,46 · SCHUSS_FERN 0,50 · SCHUSS_NAH 0,37 · ABWEHR 0,38 · TECHNIK −0,19 |
| Anteil des eintrittsstärksten Feldspielers an den Eintritten seines Teams | 36,4 % |
| Wert + carryIn·0,5 (blinder Eintritt, heutige Mechanik) | je Spiel 0,698 (Wert allein 0,702), **Saison 0,903 (Wert allein 0,842)**, Retest 0,976 |
| Schüsse mit eigenem Mitspieler auf der Schusslinie im Slot (< 22 px, „Schirm") | **11,8 %** aller 11.134 Schüsse; fern 17,1 %, mit 9,3 %, nah 4,0 % |
| Torquote mit/ohne Schirm | fern 5,0 / 5,6 % · mit 5,7 / 9,7 % — der Schirm wirkt heute NICHT (Selektion, kein Effekt) |
| Schüsse mit Verteidiger auf der Linie außerhalb der Bedrängnis / mit `blockKandidat` | 46,9 % / 16,1 % — der Block hängt am eigenen Decker (`entscheideBallaktion`), nicht an der Schusslinie |
| Schirm-Stände je Spieler und Spiel; wer schirmt | 1,10; rho zu eig 0,58, SCHUSS_NAH 0,48, ZWEITCHANCE 0,42 (der Netfront-Slot) |

### 0.2 Die zwei Sonden

- **`sonde-hockey-posten.mjs`** (Scratchpad): `kaderSetzen` je Paarung, dann
  `feldspielProbe("hockey",{n:24})`; liest je Spieler und Spiel `eig`, `wert`, `torwart`,
  Boxscore-Spalten und `fgTier`, und rechnet rho unter alternativen Wert-Definitionen
  offline nach (Feldspieler-Filter, Posten einzeln, xG-Ersatz, Orakel-Fit,
  Spiel-zu-Spiel-Retest, Star-Ränge). Über `SEITE=…` gegen eine beliebige Mockup-Kopie
  fahrbar (so ist die 160-s-Messung entstanden).
- **`sonde-hockey-eintritte.mjs`** (Scratchpad, gegen `kopie/`): `spiele("hockey",saat,
  {zustandBehalten:true})` je Spiel plus ein kleiner `fsEig`-Export in der Kopie, liest das
  Protokoll und wertet Eintritte, Ballbesitz-Starts, Rush-Schüsse und Schussgeometrie aus.
  Die drei Instrumentierungen in der Kopie: in `bewegeSpielerLive` vor/nach dem Schritt
  `dist(u, Tor) ≥/< HK_RADIUS_MAX` bei `hatBall`; in `loeseFlugAuf` (Pass-Zweig) dieselbe
  Prüfung für Abwurf-/Ankunftsort; in `ballUebernehmen` ein `besitz`-Ereignis mit
  `inZone`. Kein `rr()`-Aufruf, die Spiele sind zeichengleich.

### 0.3 Abgerufen (Websuche, Zahlen wörtlich aus der Quelle)

| Kennzahl | Wert | Quelle |
|---|---|---|
| Kontrollierter Eintritt gegen Dump-in | 0,57 gegen 0,12 Schüsse je Eintritt (Tulsky); Replikation 0,66 gegen 0,29 (Sznajder); „more than twice the number of average shots" | hockey-graphs.com 2017/08/10, `hockey-impact-verteilung-recherche-fable.md` 0.3 |
| Wiederholbarkeit je Spieler | kontrollierte Eintrittsquote bei Stürmern R² 0,72; Entries/60 0,56 | hockey-graphs.com 2017/08/10 |
| Eintritts-Abwehr | „entry denials is the most repeatable stat of zone entry defense", Chancen/kontrollierte Eintritte dagegen „more prone to team-effects" | allthreezones.substack.com „The Defenseman Compass" |
| Gap Control | Abstand Verteidiger–Puckträger von wenigen Fuß entscheidet; „tighten the gap to eliminate clean zone entries and force a dump-in or turnover" | thecoachessite.com (Iceberg-Daten), kingcobrashockey.com |
| Abgelenkte / geschirmte Schüsse | Tip-in 14,47 % (56 % aufs Tor); geschirmt 5,81 % (41 % aufs Tor), klare Schüsse 4,94 % | nhlspecialteams.com 2016/03/14 |
| Fangquote bei Ablenkung | „if a shot is tipped or deflected, the save percentage drops by over 10 percent" | omha.net (Torwart-Positionierung) |
| Warum die Analytik Schüsse statt Tore misst | Schussvolumen (Corsi/xG) ist wiederholbar, Verwertung nicht; xG „more predictive power for future … goal scoring" als Corsi in einer Studie, Corsi vorn in der Replikation | puckovertheglass.substack.com, `hockey-impact-verteilung-recherche-fable.md` 1.2 |

### 0.4 Nur gelesen, nicht belegt

- Die Größenordnung „~20–25 kontrollierte Eintritte je Team und Spiel" ist aus den
  Tracking-Berichten überschlagen (Entries/60 je Spieler mal Eiszeit), keine abgerufene
  Ligazahl.
- Ob der Fang-Prozent-Abfall von „über 10 Punkten" bei Ablenkern auf Schüsse aufs Tor oder
  auf Versuche bezogen ist — die Quelle sagt es nicht.

---

## 1. Die Zerlegung, neu gemessen — und was sie über die Reihenfolge sagt

### 1.1 Der Torwart in der Rangliste

`disziplinProbe` baut die Teilnehmerliste aus `[...FSTEAM[0],...FSTEAM[1]]`
(`engine.js:16659`) — für Hockey also zehn Feldspieler **und zwei Torhüter**, jeder mit
`u.eig` (Matrix-Eignung, `bauFeldspiel`, `engine.js:4734`: `basisWert+engP+breitP`, also
power/health-geführt) und `feldspielWert(u)`. Für den Torwart ist das
`HK_TW_BASIS + GSAA·HK_TW_GSAA_K` (`engine.js:5447`), mit `GSAA = Schüsse·(1−0,907) −
Gegentore`.

Drei Zahlen, die zusammen das Problem sind:

1. **Die Eignung des Torwarts hat mit seiner Rolle wenig zu tun.** Über die 24 gefeldeten
   Torhüter korreliert `eig` mit PARADE nur mit 0,461 — die Matrix-Eignung ist ein
   Feldspieler-Maß (`hockey-torwart-puck-tore-recherche-fable.md` 4.9 hat genau das
   vorhergesagt und vorgeschlagen, den Torwart „aus rho(Seite) auszunehmen und separat zu
   prüfen").
2. **Sein Wert ist in EINEM Spiel Rauschen.** 40 Schüsse mit ~9 % Basiswahrscheinlichkeit
   streuen binomial um ±1,82 Gegentore; der gesamte Unterschied zwischen dem besten
   (PARADE 99, `paradeFaktor` 0,550) und dem schlechtesten gefeldeten Torwart (61, 0,754)
   beträgt bei 40 Schüssen 1,35 Gegentore. Signal kleiner als Rauschen — und mit
   `HK_TW_GSAA_K = 2` streut der Torwart-Wert um ±3,4 bei einem Feldspieler-Mittel von ~7.
   Das ist kein Kalibrierfehler, das ist Eishockey: eine Fangquote eines Spiels sagt real
   fast nichts über den Torwart.
3. **Er zieht die Rangliste nach unten.** Eignungsrang im Mittel 5,3, Wertrang 7,5 (bei
   3 × 160 s: 9,5). Zwei so platzierte Zeilen in einer Zwölfer-Spearman kosten, gemessen,
   0,062 rho je Spiel und 0,07 Saison; der Star auf Rang 1 sinkt von 53 auf 41 %.

Was sich daraus ergibt, ist keine Mechanik, sondern eine Entscheidung: **Wen soll die
0,80-Schranke ordnen?** Wenn die Antwort „die zehn Feldspieler" ist (mein Vorschlag — auch
Basketball ordnet nur Gleiche), steht Hockey heute bei **0,651**, nicht bei 0,589, und der
Torwart bekommt seine eigene Frage (rho zwischen PARADE und GSAA über die Saison:
gemessen 0,392 über 24 Identitäten — ehrlich schwach, aber das ist dann ein eigener
Befund mit eigener Sonde, `scripts/miss-rangtreue-nach-rolle.mjs`). Wenn die Antwort „alle
zwölf" bleibt, dann muss der Torwart eine **Torwart-Eignung** bekommen (die PARADE-Zahl
oder das Torwart-Slot-Profil, das der Generator ohnehin ausweist), nicht die Feldspieler-
Matrix — sonst bewertet die Abnahme den Torwart daran, wie gut er checken könnte.

### 1.2 Verlässlichkeit ist nicht tot — sie war maskiert

CLAUDE.md: „Bei Hockey mit verdoppelter Spielzeit stieg die Verlässlichkeit von 0,755 auf
0,85 — und rho blieb bei 0,719 / 0,721 / 0,723. Flach." Diese Reihe stammt aus der Zeit vor
dem Formkarten-Fix (Stichprobe von vier) und aus einer Zwölfer-Rangliste. Auf dem heutigen
Stand, in einer sonst zeichengleichen Kopie mit `periodenDauer:160`:

| | 3 × 80 s | 3 × 160 s |
|---|---:|---:|
| rho je Spiel, alle 12 | 0,589 | **0,535** |
| rho je Spiel, Feldspieler | 0,651 | **0,749** |
| Spiel-zu-Spiel-Retest, Feldspieler | 0,661 | 0,788 |
| Saison, Feldspieler | 0,818 | 0,804 |
| Torwart: Wertrang / sd(GSAA) | 7,53 / 3,38 | 9,52 / 5,72 |

Die Feldspieler werden mit mehr Ereignissen deutlich verlässlicher (+0,13 Retest, +0,10
rho), der Torwart wird mit mehr Schüssen *unverlässlicher* (sein Rauschen wächst mit √n,
sein Signal linear, aber `HK_TW_GSAA_K` verstärkt beides), und über zwölf Zeilen hebt das
eine das andere auf. Genau das ist „flach". **Die alte Schlussfolgerung „wer die Rangtreue
heben will, arbeitet an der Validität, nicht an der Uhr" gilt für Hockey also nur zur
Hälfte** — und sie hat die letzten drei Runden ausschließlich in Richtung Rezept geschickt.

Das ist ausdrücklich **kein** Vorschlag, die Uhr zu verlängern (3 × 1:20 ist Chris'
Entscheidung, und 3 × 160 s erreicht auch nur 0,749). Es ist die Begründung dafür, dass ein
neues Ereignis nicht nur die Validität, sondern *vor allem* die Verlässlichkeit je Spiel
heben muss — also hochfrequent und fähigkeitsgebunden sein muss.

### 1.3 Umgewichten reicht nicht — das Orakel

Wenn man die Eignung per Kleinste-Quadrate auf die neun heute gebuchten Posten fittet
(gepoolt über 1.200 Feldspieler-Spiele, in-sample — also die günstigste denkbare Formel, die
keine ehrliche Kalibrierung je erreicht), kommt rho je Spiel **0,730** heraus, Saison 0,846.
Die Koeffizienten (Tore 2,3 · Vorlagen 0,5 · Schüsse 1,5 · xG **−8,3** · Pucks 0,6 · Steals
0,7 · Blöcke 2,0 · Verluste **+0,95** · Strafen +0,8) sind zudem sportlich unsinnig — das
Orakel belohnt Verluste und bestraft Schussqualität, weil es Kader-Zufall mitfittet. Selbst
mit diesem Freibrief liegt die Decke der heutigen Ereignisse bei 0,73. **Das ist die
Zahl, die `versuch2` vermutet hat, jetzt gemessen: die verbleibende Lücke zu 0,80 ist mit
den Ereignissen, die das Spiel heute erzeugt, nicht schließbar.**

Zum Einordnen der einzelnen Posten (Feldspieler, 3 × 80 s):

| Posten allein | rho je Spiel | Saison | Retest Saison | Spiel-zu-Spiel |
|---|---:|---:|---:|---:|
| Tore | 0,598 | 0,818 | 0,883 | 0,468 |
| Schüsse (Versuche) | 0,664 | 0,755 | 0,864 | 0,656 |
| xG (Versuche × Liga-Stufenquote) | 0,658 | 0,643 | 0,927 | 0,718 |
| lose Pucks | 0,544 | 0,573 | 0,982 | 0,859 |
| Steals | 0,216 | 0,510 | 0,573 | 0,103 |
| Vorlagen | 0,321 | 0,508 | 0,733 | 0,267 |
| voller Wert ohne Tore | 0,625 | 0,797 | 0,918 | 0,637 |
| Tore halb → xG | 0,667 | 0,818 | 0,951 | 0,710 |

Zwei Dinge fallen auf. Erstens: die *Tore* sind über die Saison der validste Posten (0,818),
aber je Spiel der unverlässlichste unter den großen (0,468) — 1,04 ± 1,67 je Spieler und
Spiel ist reines Poisson-Rauschen, und mit Gewicht 3 tragen sie den größten Teil der
Wert-Streuung. Zweitens: *Steals* (rho 0,22 je Spiel, Retest 0,10) und *Vorlagen* sind als
Kanäle praktisch tot — die Verteidigung ist im Boxscore unsichtbar (Blöcke 0,17 je Spiel),
was der Impact-Bericht (ABWEHR 0 % in der Sondierung) schon sagte.

### 1.4 Die Arithmetik zu 0,80

Nach CLAUDE.md ist rho(Spiel) = Validität × √Verlässlichkeit, und die Formel trägt
gemessen auf ±0,02 (0,818 × √0,661 = 0,665 gegen 0,651). Damit:

| Validität | nötige Spiel-zu-Spiel-Verlässlichkeit für 0,80 |
|---:|---:|
| 0,818 (heute) | 0,956 — unerreichbar (lose Pucks, der verlässlichste Posten, haben 0,86) |
| 0,903 (heute + blinder Eintritt) | 0,785 — exakt das, was 3 × 160 s liefert |
| 0,95 | 0,71 |

Bei 240 Sekunden und 0,66 Verlässlichkeit ist 0,81 die Decke — selbst mit perfekter
Validität. **Ein Hebel, der nur die Validität anfasst (Rezept, Wertformel, Schusskurve),
kann Hockey bei dieser Uhr nicht über 0,80 bringen.** Es braucht ein Ereignis, das (a) oft
vorkommt, (b) an einer Fähigkeit hängt, die mit der Eignung korreliert, und (c) heute
fehlt oder blind ist. Abschnitt 2 sucht genau das.

---

## 2. Was Eishockey real unterscheidet — gegen den Motor gehalten

Nur Konzepte mit Bauweg. Was schon gebaut ist (Passqualität, Abpraller-Ecke, Bully-Duell,
A1/A2, eigene Kurve, Strafen), steht nicht noch einmal hier.

| Konzept | Reale Zahl | Stand im Motor | Baubar? |
|---|---|---|---|
| **Kontrollierter Zoneneintritt / Gap Control** | 0,57 gegen 0,12 Schüsse je Eintritt; R² 0,72 je Spieler; Eintritts-Abwehr wiederholbarste Verteidiger-Statistik | Eintritte passieren (4,8 je Feldspieler und Spiel, Retest 0,95), aber ohne Würfel — der Puckträger fährt, der Decker läuft goal-side mit `sag` hinterher (`bewegeSpielerLive`, `engine.js:7590`), einzige Prüfung ist `versucheSteal` (45 px, Cooldown 2 s). AUFBAU 0,04, LAUFTEMPO −0,03 | **ja**, ein Paar-Los an einer Linie, die als `HK_RADIUS_MAX` schon existiert (Abschnitt 3.1) |
| **Schirm / Ablenker vor dem Tor** | Tip-in 14,5 % gegen 4,9 %; geschirmt: Fangquote −10 Punkte | 17 % der Point-Schüsse haben heute einen Mitspieler auf der Linie im Slot — ohne Wirkung; der Netfront-Spieler trifft nur über lose Pucks | **ja**, in `wirf`/`hockeySchussAusgang`, Bauform Alley-Oop (Abschnitt 3.2) |
| Schussqualität statt Tore (xG) | Grundlage der gesamten Analytik, weil Tore je Spiel Rauschen sind | `pTor` steht beim Abschuss fest, wird nicht gebucht | ja, Wertformel (Abschnitt 3.3) |
| Schussvolumen des Stars („Usage") | NHL-Spitze 14 % der Teamschüsse | 36 % beim Netfront-Spieler (Standplatz, nicht Fähigkeit); der Versuch, den Pass zum besseren Schützen zu lenken, drehte die Sniper-Probe (`engine.js:5964`) | gemessen schädlich — nicht noch einmal |
| Bully | 0,01 je Gewinn im Game Score, 76 Netto-Gewinne je Tor | als TECHNIK-Duell gebaut, ohne Wertposten | fertig, real zu Recht wertlos |
| Eiszeit / Linien / Powerplay-Einheit | der größte reale Einzelhebel (Stars spielen 22 min, vierte Reihe 10) | fünf Feldspieler, keine zweite Reihe, alle spielen 100 % | **nein** — ohne Linien gibt es keine Eiszeit-Verteilung; das Überzahlspiel (Strafen, 8 s) ändert nichts an „wer ist auf dem Eis" |
| Zonenausgang (Breakout) | 89 % Erfolg mit Puck, 20 % Dump-out | derselbe Laufweg wie der Eintritt, nur früher; der Torwart „klärt an die Bande" | im selben Paar-Los enthalten (der Eintritt in die gegnerische Zone IST der gelungene Ausgang aus der eigenen) |

---

## 3. Die Kandidaten

### 3.1 K1 — Zoneneintritt als Zweikampf an der blauen Linie (Empfehlung)

**Was sich mechanisch ändert.** Überschreitet ein Puckträger mit Besitz die Linie
`dist(u, gegnerisches Tor) < HK_RADIUS_MAX` (330 px — real die blaue Linie bei 64 ft, der
Maßstab 4,6 px je Fuß steht am `HK_RADIUS_*`-Kommentar, `engine.js:5208`), wird der
Eintritt **einmal** ausgelost, gegen den Verteidiger, der ihm am nächsten goal-side steht
(in der Praxis sein `deckt`-Mann, der dank `sag` vor ihm steht):

```
gap       = dist(verteidiger, traeger) auf 0..1 normiert (BEDRAENGT_RADIUS..~120 px)   // dasselbe Muster wie bedraengnisGate
angriff   = 0.5·AUFBAU + 0.3·LAUFTEMPO + 0.2·TECHNIK  des Traegers                        // Puckfuehrung, Antritt, Stockarbeit
abwehr    = 0.7·ABWEHR + 0.3·LAUFTEMPO  des Verteidigers
pKontroll = logistisch( (angriff − abwehr)·k1 + gap·k2 + basis )                          // PLATZHALTER, gegen ~55–60 % kontrollierte Eintritte real
r = rr()   // GENAU EIN Wurf je Eintritt, immer — keine bedingten Zusatzwuerfe (Pp-Kaskade, s. hockey-torwart-puck-tore-recherche-fable.md 7.3)
  r < pKontroll                   -> kontrolliert: Puck bleibt, `eintritte++`, u.rushBis = fsT+2  (NUR als Boxscore-Marke, KEIN lage-Bonus — s. u.)
  r < pKontroll + pDump            -> Dump: Puck wird `frei` in der Ecke hinter der Torlinie (wie „vorbei" in loeseHockeySchuss), der Zweikampf dort mit REB_BOXOUT-Vorteil fuer die Verteidigung
  sonst                            -> abgefangen: verteidiger nimmt den Puck (`eintritteAbgewehrt++`, steals bleibt unberuehrt), naechsterAngriff + startFastbreak fuer seine Seite
```

Zwei Boxscore-Spalten, beide in `feldspielWert` (Hockey-Zweig): `eintritte·0,4` und
`eintritteAbgewehrt·0,4` (PLATZHALTER, gegen die Rangtreue zu messen; der NHL Game Score
kennt den Posten nicht, weil er ihn 2016 noch nicht zählen konnte — die Tracking-Literatur
bewertet ihn heute höher als jeden Boxscore-Posten außer Toren). `HK_TW_BASIS` danach
nachziehen, wie der Kommentar dort verlangt.

**Warum die heutige Mechanik das strukturell nicht belohnen kann.** Der Weg von der eigenen
Zone bis `HK_WUNSCH_MAX` ist im Motor eine reine Bewegung: `bewegeSpielerLive` setzt dem
Ballführer ein Laufziel (`engine.js:7400 ff.`), der Decker läuft mit 1,15× goal-side hinterher,
und die einzige Fähigkeitsprüfung unterwegs ist `versucheSteal` — ein Wurf alle 2 s,
nur innerhalb von 45 px, mit `basis` bis 0,94 gedeckelt und auf `1−basis^(1/3)` je Versuch
gestaucht. Ergebnis, gemessen: 4,8 Eintritte je Feldspieler und Spiel, die an AUFBAU mit
0,04 und an LAUFTEMPO mit −0,03 hängen — sie folgen dem Puckgewinn (ZWEITCHANCE 0,46) und
dem Point-Slot (SCHUSS_FERN 0,50: die Verteidiger an der blauen Linie tragen den Puck
hoch, weil sie ihn dort bekommen). Kein Rezept kann daran etwas ändern, weil kein `rr()`
an dieser Stelle je eine Fähigkeit liest. Genau das ist eine Validitätslücke im Sinne von
CLAUDE.md: ein Ereignis, das das Spiel ständig erzeugt und stabil (Retest 0,95) dem
falschen Spieler zuschreibt.

**Basketball-Benchmark.** Basketball hat keine blaue Linie und kein Gegenstück — die Zone
ist dort der ganze Halbcourt, und der Übergang ist der Fastbreak. Was Hockey davon erbt,
ist die **Bauform**, nicht die Regel: `startFastbreak` (`engine.js:6987`) misst einen
Vorsprung als *Paarung* gegen den schnellsten Gegner und würfelt genau dann, wenn ein
Vorsprung besteht (sonst kein `rr()`); `bedraengnisGate` macht einen Abstand zum stufenlosen
Faktor; `versucheSteal` ist eine Paarung AUFBAU gegen ABWEHR. K1 ist die Zusammensetzung
dieser drei an einem Ort, den Basketball nicht hat. Nicht zurückportieren — ein
Halbcourt-Eintritt in Basketball wäre eine erfundene Regel.

**Wo im Code.** Ein neues `zoneneintritt(traeger)` neben `bully()`/`versucheSteal`,
aufgerufen aus `stepFeldspielLive` direkt vor `entscheideBallaktion` (dort liegt der
einzige Ort, an dem der Träger je Tick betrachtet wird, `engine.js:8049`), mit einem Flag
`u.inZone`, das `ballUebernehmen` und jeder Seitenwechsel löschen. Die Dump-Position ist
die aus dem `vorbei`-Zweig von `loeseHockeySchuss` (`engine.js:7167`). `aufDemEis`,
`torwart`, Unterzahl: die Paarung nimmt den nächsten Feldspieler der Gegenseite, bei 2v2 den
einzigen — degradiert von selbst. Geschätzt ~80 Zeilen plus zwei Zähler in `bauSpieler`,
zwei Spalten in `feldspielWert`, `fsBisher`, der Wertungstabelle und `feldspielProbe`.
**Risiko:** jeder neue `rr()`-Aufruf verschiebt die Zufallsfolge aller folgenden
Ereignisse — deshalb genau ein Wurf je Überschreitung, und die Pp-Sonde (`einflussVon`)
danach neu fahren. Die Formationslogik (`zuordneSlots`, `SLOTS_HOCKEY`) bleibt unberührt.

**Was NICHT dazu gehört:** ein `rush`-Bonus auf `lage` in `technikMake`, wie ihn die
xG-Modelle als Merkmal führen. Gemessen fallen 73 % aller Schüsse binnen 4 s nach einem
Eintritt — bei dreizehnfacher NHL-Dichte ist das Spiel ein einziger Rush, ein Bonus wäre
uniform und liefe in dieselbe Sättigungsfalle wie Basketballs verworfener Assist-Bonus
(`engine.js:6190`) und Hockeys erste Passqualitäts-Fassung (`engine.js:6783`). Der
Eintritt trägt seinen Wert über den *Ausgang* (Puck behalten oder verlieren) und den
Boxscore-Posten, nicht über die Trefferchance.

**Vorab-Messung (gemacht, nicht nur vorgeschlagen):**
- Eintritte existieren mit der richtigen Häufigkeit (4,8 je Feldspieler, ~24 je Team) und
  sind über die Saison verlässlich (0,948) — der Kanal hat Volumen.
- Schon der blinde Eintritt mit 0,5 in der Wertformel hebt die Saison-Validität von 0,842
  auf 0,903 (Kopie, feste Formkarten) — obwohl er heute nur den Standplatz misst.
- Der Eintritt hängt heute an keiner Fähigkeit (AUFBAU 0,04) — genau die Stelle, an der ein
  Paar-Los etwas ändern kann, ohne dass ein Rezept es vorher könnte.
- Spiel-zu-Spiel-Retest des blinden Eintritts 0,539: schlechter als Schüsse (0,751), weil
  ein reiner Standplatz-Posten per Los verteilt wird; ein fähigkeitsgebundenes Los mit
  pKontroll 0,4–0,75 je nach Paarung sollte hier deutlich verlässlicher werden — das ist
  die Zahl, an der die Umsetzung abgenommen wird (Ziel: Spiel-zu-Spiel-Retest der Eintritte
  ≥ 0,70, rho(Eignung, Eintritte) je Spiel ≥ 0,60).

**Erwartung, ehrlich:** Validität der Feldspieler 0,82 → ~0,90 (der blinde Eintritt zeigt
0,903), Verlässlichkeit 0,66 → ~0,72–0,75 (ein hochfrequentes, fähigkeitsgebundenes
Ereignis zusätzlich zu Schüssen und Pucks). Das ergäbe 0,76–0,78 je Spiel über die
Feldspieler — nahe an, aber nicht sicher über 0,80. Es ist der größte einzelne Hebel, den
diese Recherche gefunden hat, und er ist kein Sprung über die Schranke, sondern der Schritt,
der sie in Reichweite bringt.

### 3.2 K2 — Netfront-Schirm und Ablenker

**Was sich mechanisch ändert.** In `wirf` (Hockey-Zweig, `engine.js:6439`) wird beim Abschuss
geprüft, ob ein eigener Feldspieler auf der Schusslinie im Slot steht (`distZuLinie(m,
schuetze, Tor) < 22 px`, `dist(m, Tor) < HK_RADIUS_SLOT` — genau die Zeile aus der Sonde).
Dann zwei Wirkungen in `hockeySchussAusgang`:

1. **Schirm:** `paradeFaktor` wird um einen festen Betrag geschwächt (real: Fangquote −10
   Punkte bei Ablenker; geschirmt 5,81 % gegen 4,94 % klar — PLATZHALTER ×0,85 auf den
   Parade-Anteil).
2. **Ablenker:** mit `pAblenk = f(SCHUSS_NAH des Schirms)` wird der Schuss zu einem
   `dunk`-Versuch des Schirms — derselbe `wirf()`-Aufruf mit einem anderen `schuetze` als
   `von`, exakt die Bauform des Alley-Oops (`wirf(u,kandidat,art,"dunk",sz.abschluss(...),
   u,key,null)`, `engine.js:6358`): der Point-Schütze wird `passgeber` (A1 über die
   Berührungskette), der Netfront-Spieler bekommt den Schuss mit `GEO_BONUS.dunk` und
   seinem SCHUSS_NAH.

**Warum die heutige Mechanik das nicht belohnen kann.** 17,1 % der Point-Schüsse und 9,3 %
der Half-Wall-Schüsse haben heute einen Mitspieler geometrisch auf der Linie — die
Trefferquote ist mit Schirm sogar *niedriger* (5,0 gegen 5,6 %; 5,7 gegen 9,7 %), weil kein
Term ihn liest und die Situationen sich nur durch Selektion unterscheiden. Der
Netfront-Spieler (rho zu SCHUSS_NAH 0,48, er ist es, weil `zuordneSlots` ihn dorthin
sortiert) hat damit als Standplatz-Wert nur den losen Puck; sein SCHUSS_NAH zahlt sich erst
aus, wenn er selbst schießt. Und der Point-Schütze (SCHUSS_FERN, power-geführt, das
schwerste Matrix-Attribut) trifft zu 6,4 % und bekommt für einen Schuss, der abgelenkt
wird, heute nichts.

**Basketball-Benchmark.** Screen/Roll (`screent`, `rollBis`) ist die Bewegungs-Vorlage
(ein Mitspieler stellt sich zwischen Verteidiger und Ziel), der Alley-Oop die
Buchungs-Vorlage (ein Wurf, zwei Beteiligte, eigene Erfolgsformel). Beides passt; die
*Zahlen* nicht — Basketballs Screen bremst den Decker (`tempoMul 0,35`), Hockeys Schirm
blendet den Torwart. Nicht übertragen wird der Roll (kein Hockey-Gegenstück).

**Effort/Risiko.** Enthalten in `wirf`/`hockeySchussAusgang`/`loeseHockeySchuss`, ~40
Zeilen. Zwei Fallen: (a) der Ablenker darf keinen zweiten `feldwuerfe++` erzeugen (ein
Versuch, ein anderer Schütze); (b) ein Bonus auf `lage` für `nah`-Schüsse läuft in die
Sättigung (`engine.js:6783`) — deshalb als *eigener Wurf mit eigenem Schützen* bauen, nicht
als Zuschlag. Erwartung: vor allem Validität der Tore (Netfront-Tore hängen dann an
SCHUSS_NAH, nicht an ZWEITCHANCE; Point-Vorlagen an SCHUSS_FERN/power) und ein sichtbarer
Spielzug für Chris. Rangtreue-Effekt kleiner als K1, weil die Häufigkeit (~1,1
Schirm-Stände je Spieler und Spiel) ein Fünftel der Eintritte ist.

### 3.3 K3 — Tore halb als xG buchen (Wertformel, keine Mechanik)

`hockeySchussAusgang` kennt beim Abschuss `pTor = technik·HK_TOR_SKALA·paradeFaktor`
(`engine.js:7045`). Wird diese Zahl je Schuss auf `u.xg` aufsummiert und in
`feldspielWert` `punkte·1,5 + xg·1,5` statt `punkte·3` gebucht, steigt — offline mit der
Liga-Stufenquote als xG-Näherung gemessen — die Spiel-zu-Spiel-Verlässlichkeit der
Feldspieler von 0,661 auf 0,710 und rho je Spiel von 0,651 auf 0,667. Das ist exakt der
Grund, aus dem die Hockey-Analytik von Toren auf Schussqualität umgestiegen ist: Tore je
Spiel sind Poisson-Rauschen (1,04 ± 1,67), die Qualität der Versuche nicht. **Tore ganz zu
ersetzen ist schlechter** (0,649, Saison 0,783) — die Tore tragen über die Saison echte
Validität (0,818), nur je Spiel zu laut.

Basketball-Gegenstück: keines — Basketballs Wert bucht Punkte, und bei 44 % Trefferquote
ist das Rauschen je Wurf klein genug. Für Hockey mit 9 % ist es die richtige Buchung.
Kosten: ein Zähler, eine Zeile in `feldspielWert`, `HK_TW_BASIS` nachziehen. Kein
Rezept. Klein genug, um mit K1 in derselben Runde zu laufen.

### 3.4 Was ich NICHT vorschlage, und warum

- **LINIENSPIEL oder irgendein neuer Sub-Skill.** Chris hat es nicht beauftragt; und die
  Sondierung zeigt, dass die vorhandenen Sub-Skills (AUFBAU 0 %, ABWEHR 0 %) nicht an
  Namen scheitern, sondern an fehlenden Ereignissen, die sie lesen. K1 gibt AUFBAU und
  ABWEHR je einen Erfolgskanal mit den heutigen Rezepten.
- **Eine weitere Sinkhorn-/Rezeptrunde** — Orakel-Decke 0,73 (Abschnitt 1.3).
- **Die Uhr** — Chris' Entscheidung; und selbst 3 × 160 s erreicht nur 0,749.
- **Den Pass zum besseren Schützen lenken** (Usage nach Basketball-Muster) — gebaut,
  gemessen, verworfen (`engine.js:5964`, Sniper-Probe kippte). Eishockey verteilt Schüsse
  breiter als Basketball; die Konzentration ist heute mit 36 % schon zu hoch, nicht zu
  niedrig.
- **Bully-Wertposten, Check-Wertposten** — real belegt wertlos bzw. negativ, beides schon
  richtig gebaut.
- **Powerplay-Spezialisten / Eiszeit** — ohne Linien kein Hebel (Abschnitt 2).

---

## 4. Reihenfolge und Abnahme

| Schritt | Was | Ändert Motor? | Abnahme |
|---|---|---|---|
| **E** | Entscheidung: 0,80-Schranke für Hockey über die zehn Feldspieler; Torwart über `miss-rangtreue-nach-rolle.mjs` (PARADE gegen GSAA über die Saison, heute 0,39). Alternativ: Torwart-Eignung aus PARADE/Slot-Profil statt Feldspieler-Matrix | nein (Sonde/`disziplinProbe`-Filter) | Basislinie neu bauen: Hockey liest dann **0,651 / 0,818** statt 0,589 / 0,748 |
| **1** | K1 Zoneneintritt + K3 xG-Buchung in einer Runde, Platzhalterzahlen, `HK_TW_BASIS`/`HK_TOR_SKALA` nachziehen | ja | rho je Spiel (Feldspieler) ≥ 0,74 · Spiel-zu-Spiel-Retest ≥ 0,72 · rho(Eignung, Eintritte) je Spiel ≥ 0,60 · Torkorridor 3,5 hält · kontrollierte Eintritte 50–65 % · Basketball bit-identisch · Pp-Sonde neu |
| **2** | Sondierung wiederholen (die Eintritts-Masse verschiebt AUFBAU/ABWEHR/LAUFTEMPO), erst dann ggf. Rezept | Messung | ZWEITCHANCE weiter unter einem Viertel |
| **3** | K2 Schirm/Ablenker | ja | Sniper-Probe (SCHUSS_NAH) hält ≥ 0,7; Netfront-Tore hängen an SCHUSS_NAH statt ZWEITCHANCE; Point-Vorlagen sichtbar |

Die beiden Scratchpad-Sonden gehören mit Schritt 1 als `scripts/miss-hockey-posten.mjs` und
`scripts/miss-hockey-eintritte.mjs` ins Repo — die zweite braucht dann keine Kopie mehr,
weil der Motor die Eintritte selbst loggt.

---

## 5. Was ich nicht geprüft habe

- **Nur 6 je Seite.** 2v2/4v4 nicht gemessen; K1 degradiert per Konstruktion (nächster
  Feldspieler), aber ob bei 2v2 der eine Verteidiger dann jeden Eintritt abfängt, ist eine
  Kalibrierfrage.
- **Die Eintrittsquote nach Kadergröße und die Dump-Verteilung** sind Platzhalter, keine
  Messung — es gibt für „Anteil Dump-in" reale Zahlen (Tulsky: Break-even-Vertrauen 34 %),
  aber keine für unsere Geometrie.
- **Die 3 × 160-s-Messung** ist ein Diagnose-Experiment gegen eine CLAUDE.md-Aussage, keine
  Empfehlung; die Kopie ist sonst zeichengleich, aber ob `HK_TOR_SKALA` bei doppelter Länge
  noch 3,5 Tore je Team trifft, wurde nicht geprüft (es fielen 2,08 je Feldspieler, also
  ~10 je Team — der Korridor gilt dort selbstverständlich nicht).
- **Die xG-Näherung** in 3.3 nutzt die Liga-Stufenquote je Versuch, nicht den echten
  `pTor` je Schuss — die echte Zahl ist skill- und torwartabhängig und sollte die
  Verlässlichkeit eher stärker heben, gemessen ist das nicht.
- **Ob der Torwart-Eignungs-Ersatz** (PARADE statt Matrix in `disziplinProbe`) die
  Zwölfer-Rangtreue tatsächlich auf 0,65 hebt, habe ich nicht gerechnet — bei rho(eig,
  PARADE) 0,46 unter den Torhütern und rho(PARADE, GSAA) 0,39 je Spiel würde er weiter
  unter den Feldspielern liegen; deshalb der Vorschlag, ihn getrennt zu messen.
- **Keine Zeile Code im Repo geändert, kein Test gelaufen.** Die Kopie liegt im Scratchpad
  (`kopie/`, `kopie2/`), die Rohdaten daneben (`posten-roh-24*.json`, `eintritte-roh-24-v2.json`).

---

## Quellen

- [Hockey Graphs — Measuring the Importance of Individual Player Zone Entry Creation](https://hockey-graphs.com/2017/08/10/measuring-the-importance-of-individual-player-zone-entry-creation/) (R² 0,72, 0,66 gegen 0,29)
- [Hockey Graphs — Tactalytics: Neutral Zone Decisions](https://hockey-graphs.com/2016/08/03/tactalytics-using-data-to-inform-tactical-neutral-zone-decisions/)
- [All Three Zones — The Defenseman Compass](https://allthreezones.substack.com/p/the-defenseman-compass) (Eintritts-Abwehr als wiederholbarste Verteidiger-Statistik)
- [The Coaches Site — Using data to define good gap control for defencemen](https://thecoachessite.com/defencemen-gap-control-iceberg-data/)
- [King Cobras Hockey — Closing the Gap](https://www.kingcobrashockey.com/article/closing-the-gap-the-foundation-of-elite-defensive-play)
- [Special Teams Project — How Do Rebound Shots Impact Shooting Percentages?](http://www.nhlspecialteams.com/blog/2016/3/14/how-do-rebound-shots-impact-shooting-percentages) (Tip-in 14,47 %, geschirmt 5,81 %, klar 4,94 %)
- [OMHA — Using Deflections and Tip-ins to alter Goalie Positioning](https://www.omha.net/news_article/show/716614-using-deflections-and-tip-ins-to-alter-goalie-positioning) (Fangquote −10 Punkte)
- [Puck Over the Glass — Which Is Better at Predicting Future Goals: Corsi, Expected Goals, or Scoring Chances?](https://puckovertheglass.substack.com/p/which-is-better-at-predicting-future)
- [Seattle Kraken — Analytics with Alison: Expected Goals](https://www.nhl.com/kraken/news/analytics-with-alison-expected-goals-327728890)
- Projektintern: `hockey-impact-verteilung-recherche-fable.md` (Tulsky 0,57/0,12, Game Score, Passing Project), `hockey-torwart-puck-tore-recherche-fable.md` (4.9 Torwart aus rho ausnehmen; 7.3 feste `rr()`-Zahl), `messgrundlage-kaderfest.md`, `hockey-ueber-080-versuch2.md`.

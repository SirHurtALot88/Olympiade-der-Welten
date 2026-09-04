# Hockey: Opus-Review mit NHL-Recherche

Chris, wörtlich: „Für Hockey gameplay opus nhl Research + git code". Also beides — die echte
Eishockey-Analytik gegen unsere Mechanik gehalten, und der **tatsächliche Git-Diff** gelesen,
nicht die Beschreibung davon.

Stand: `main` `18cd2cf2`. Gegengelesen wurden `docs/design/hockey-zufriedenstellend.md`,
`hockey-naechster-hebel-recherche-fable.md`, `hockey-zoneneintritt-umsetzung.md`,
`messgrundlage-kaderfest.md` und Hockeys Abschnitt in `stand-aller-disziplinen.md`; im Code
`feldspielWert()`, `hockeySchussAusgang()`, `loeseHockeySchuss()`, `bestimmeTorwaerter()`, die
Torwart-Markierung in `disziplinProbe` und die drei neuen Helfer in
`scripts/lib/rangtreue-messung.mjs` — plus der Commit `35d9e43a` und seine Korrektur `1d56cf07`
Zeile für Zeile per `git show`.

**Der Motor ist am Ende dieser Runde Zeichen für Zeichen der `main`-Stand** (`git diff` auf
`public/mockups/battle-mode.engine.js` leer, `node --check` sauber). Alle Zahlen unten, die
eine Änderung betreffen, stammen aus Experimenten, die anschließend vollständig zurückgenommen
wurden. Dieser PR ändert nur diese eine Datei hier.

---

## Das Urteil, bevor die Begründung kommt

**Ja, Hockey ist „erstmal zufriedenstellend" — aber nicht ganz aus den Gründen, die im
Abschlussbericht stehen, und es liegt ein echter Fund darunter, der nicht teuer ist.**

1. **K3 ist analytisch sauber gebaut und die Behauptungen halten der Nachprüfung stand.**
   „Kein neuer `rr()`-Wurf, keine Verschiebung" ist nicht nur behauptet, sondern nachweisbar:
   in jedem meiner Torwart-Experimente blieben die Feldspieler-Zahlen **ziffernidentisch**
   (0,719 / 0,818 bei n=24, 0,714 / 0,776 bei n=48) — das geht nur, wenn die Zufallsfolge
   wirklich unangetastet ist. Und die Erwartungswert-Treue stimmt gemessen: über 1200
   Feldspieler-Spiele stehen `punkte` 1,038 gegen `xg` 1,044.

2. **Die Feldspieler-only-Messung entspricht der echten Analytik-Praxis** — Evolving-Hockey
   führt Skater und Torhüter in getrennten GAR-Tabellen mit unterschiedlichen Komponenten,
   niemand ordnet Torhüter und Feldspieler in einer Boxscore-Rangliste. Die Entscheidung ist
   richtig. **Sie deckt aber einen echten Fehler zu**, siehe Punkt 3.

3. **Der Fund dieser Runde: zwei veraltete Torwart-Konstanten setzen JEDEN Torwart um 4,84
   Wertpunkte unter den Feldspieler-Schnitt — arithmetisch, nicht sportlich.** Gemessen, nicht
   vermutet (Abschnitt 2). Genau das ist die Situation, vor der der Kommentar an
   `HK_TW_BASIS` seit Monaten warnt. Korrigiert man beide Konstanten auf die heute gemessenen
   Werte, steigt die Zwölferzahl von **0,618 auf 0,669** (n=24) bzw. **0,613 auf 0,655**
   (n=48) — gleiches Vorzeichen bei beiden Stichprobengrößen, und die Feldspieler-Zahl bleibt
   bit-identisch. Das ist kein neues Rezept und kein neuer Würfel, sondern das Nachziehen von
   zwei Zahlen, die der Code selbst als nachziehpflichtig ausweist.

4. **Zwei analytisch besser begründete xG-Varianten gebaut und gemessen — beide flach.** Die
   echte Analytik rechnet xG *torwartunabhängig* und auf *allen ungeblockten Versuchen*
   (Fenwick). Beides habe ich eingebaut und gemessen: −0,004 bzw. −0,005 auf die
   Feldspieler-Rangtreue. **K3 ist in dieser Bauform ausgereizt** — die verbleibende Lücke
   liegt nicht in der xG-Definition.

5. **Die 0,80-Schranke ist für Eishockey KEINE Realismus-Schranke, sondern eine Spielbau-
   Schranke — und wir sind längst weit über dem, was echtes Eishockey liefert.** Eine
   Poisson-Simulation eines echten NHL-Spiels mit echten Raten, bewertet mit dem echten NHL
   Game Score, liefert **rho 0,40 je Spiel** bei einer Spiel-zu-Spiel-Verlässlichkeit von
   **0,14** (Abschnitt 5). Unser Motor steht bei 0,719 bei einer Verlässlichkeit von 0,755.
   **Unser Eishockey ist je Spiel rund doppelt so rangtreu wie die NHL.**

---

## 0. Was gemessen wurde, womit, und was nur gelesen ist

### 0.1 Eigene Messungen (Playwright/Chromium, kaderfest, die fünf echten Paarungen aus `data/generated/kaderfamilie-live-save.json`)

| Befehl | Ergebnis |
|---|---|
| `node scripts/miss-alle-disziplinen.mjs 24 hockey basketball` | Basislinie reproduziert, Ziffer für Ziffer: hockey 0,618 [0,247] / 0,748 [0,126], Feldspieler 0,719 [0,182] / 0,818 [0,259]; basketball 0,757 [0,102] |
| `node scripts/miss-alle-disziplinen.mjs 48 hockey` | 0,613 [0,228] / 0,741 [0,175], Feldspieler 0,714 [0,167] / 0,776 [0,231] |
| `node scripts/miss-hockey-korridor.mjs 24` | Tore je Team 4,13 · Schüsse aufs Tor 37,8 · **Fangquote 89,1 %** · Strafen 2,8 |
| eigene Sonde über `feldspielProbe`, 5 Paarungen × 24 Spiele | Feldspieler-Wert im Mittel **9,13** (sd 8,95) · Torwart-Wert **4,29** (sd 6,76) · `punkte` 1,038 gegen `xg` 1,044 · Torwart 40,3 Schüsse, **Fangquote 87,1 %** |
| dieselbe Sonde, Star-Ränge | Eignungsbester Feldspieler auf Wertrang 1 in **58 %**, in den ersten zwei in **78 %**, auf dem letzten Rang in **0 %**; ohne Scorerpunkt in 5 % der Spiele |
| eigene Sonde über `disziplinProbe`, Torwart-Markierung | 24 Spiele einer Paarung tragen **vier verschiedene Torwart-Paarungen**; fünf Spieler waren mal Torwart, mal Feldspieler |
| **Experiment 1** (zurückgenommen): `HK_TW_REF` 0,907→0,891 | alle 12: 0,618→**0,637**, Saison 0,748→0,783; Feldspieler unverändert |
| **Experiment 2** (zurückgenommen): `HK_TW_REF`→0,871 **und** `HK_TW_BASIS` 7,16→9,13 | n=24 alle 12: 0,618→**0,669** [0,247→0,181], Saison 0,748→**0,832**; n=48 alle 12: 0,613→**0,655**; Feldspieler in beiden Fällen **ziffernidentisch** |
| **Experiment 3** (zurückgenommen): xG torwartunabhängig gebucht | Feldspieler 0,719→**0,715**, alle 12 0,618→0,616 |
| **Experiment 4** (zurückgenommen): xG auf ALLEN ungeblockten Versuchen (Fenwick), mit `(1−HK_VORBEI)` normiert | Feldspieler 0,719→**0,714**, alle 12 0,618→0,616 |
| **NHL-Vergleichssimulation** (eigenes Skript, keine Motordatei berührt) | rho je Spiel **0,395** · Verlässlichkeit **0,140** · wahre Validität 0,927 · Star auf Rang 1 in **31 %** · Star ohne Scorerpunkt in **33 %** der Spiele |

### 0.2 Die NHL-Vergleichssimulation, offengelegt

Zehn Feldspieler einer NHL-Mannschaft (sechs Stürmer, vier Verteidiger), Raten je Spiel in
realer Größenordnung (Topline-Stürmer 0,38 Tore / 0,34 erste Vorlagen / 3,3 Schüsse aufs Tor
/ 0,5 Blöcke, vierte Reihe 0,07 / 0,07 / 1,3 / 0,7, erstes Verteidigerpaar 0,07 / 0,24 / 1,9 /
1,9), jeder Posten Poisson-gezogen, bewertet mit dem **echten NHL Game Score**
(0,75·G + 0,7·A1 + 0,55·A2 + 0,075·SOG + 0,05·BLK, Luszczyszyn 2016). 20.000 Spiele.
Talentrangfolge fest vorgegeben, Spearman gegen sie gerechnet — dieselbe Rechnung, die
`auswerten()` bei uns macht.

**Klare Einschränkung:** die Talentrangfolge ist von mir gesetzt, nicht aus Daten geschätzt,
und mein Kader spielt gegen einen einzigen Torwart, während unsere Rangliste zehn Spieler aus
ZWEI Mannschaften ordnet. Die Zahl ist ein belastbarer Größenordnungs-Anker, keine Ligastatistik.
Die Eingaben stehen oben vollständig, damit jeder sie nachrechnen kann.

### 0.3 Abgerufen (Zahlen wörtlich aus der Quelle)

| Kennzahl | Wert | Quelle |
|---|---|---|
| MoneyPuck-xG-Modell: Merkmale | 15 Variablen (Distanz, Winkel, Schusstyp, Zeit seit letztem Ereignis, Tempo, Ort des Vorereignisses, Über-/Unterzahl); **Torwart-Identität ist KEIN Merkmal**, Schützen-Fähigkeit ausdrücklich auch nicht | moneypuck.com/about.htm |
| Evolving-Hockey-xG-Modell | **nur ungeblockte Versuche (Fenwick)**; Schützen-Talent wurde getestet und vom Algorithmus verworfen („never used in any decision tree"); Torwart-Identität nicht enthalten | evolving-hockey.com Blog |
| GAR/WAR: Trennung Skater/Torwart | getrennte Tabellen und getrennte Komponentenlisten (Skater: EVO, EVD, PPO, SHD, Take, Draw — Torwart: EVD, SHD, Take, Draw) | evolving-hockey.com Glossar |
| GSAx gegen GSAA | „Goals Saved Above Expected (GSAx) and Goals Saved Above Average (GSAA) are two very different stats that should not be used interchangeably. One of them is the best goalie stat out there right now, the other is relatively useless." | JFresh Hockey |
| GSAx-Definition | erwartete Gegentore (Summe der xG aller Schüsse aufs Tor) minus tatsächliche Gegentore | Tape to Tape / Data Driven Hockey |
| Torwart-Verlässlichkeit | Fangquote Jahr zu Jahr r = **0,296**; „only 30 percent of the difference … actually belongs to the goalie himself"; **stabilisiert erst nach rund 3.000 Schüssen** auf 50 % Signal; ein überdurchschnittlicher Torwart ist im Folgejahr nur zu 59,2 % wieder überdurchschnittlich | Neil Paine |
| Liga-Fangquote heute | **89,6 %** (2025-26, eine Woche vor Saisonende) — erstes Mal unter 90 % seit 1993-94 | TSN (Travis Yost) |
| Tore je Spiel | 6,1 je Spiel (beide Mannschaften zusammen), also ~3,05 je Team | NHL.com, Halbzeitbilanz 2024-25 |
| Scorerpunkte-Spitze | Kucherov 121 Punkte, **1,55 je Spiel** — der Ligabestwert | theScore / StatMuse |
| Verteidiger-Spitze | Makar 92 Punkte (1,17 je Spiel) gegen Kucherovs 121 — der beste Verteidiger liegt bei rund drei Vierteln des besten Stürmers | quanthockey / NHL.com |
| Game Score in EINEM Spiel | „Game Score is NOT a reflection on a player as a whole. **One game simply doesn't provide enough of a look** at all that a player can do." | NHL.com / Seattle Kraken |
| Bully-Wert | 0,013–0,015 Tore je gewonnenem Bully; 76,5 Netto-Gewinne für ein Tor Differenz | JHU Engineering Magazine, theleafsnation |
| Zoneneintritt | kontrolliert 0,57 gegen Dump-in 0,12 Schüsse je Eintritt; Break-even-Vertrauen 34 % | Tulsky (MIT Sloan 2013), Hockey Graphs |
| Zufallsanteil | rund **38 %** der Tabellenstreuung einer NHL-Saison ist Glück; Obergrenze eines perfekten Modells daher ~62 % | Hockey Graphs, „What Makes a Stat Good" |

---

## 1. Der Code, wie er wirklich dasteht

### 1.1 K3 im echten Diff (`git show 35d9e43a`)

Der Commit fasst drei Eingriffe an, alle klein und alle an der richtigen Stelle:

```js
// hockeySchussAusgang — pTor faehrt auf JEDEM Rueckgabewert mit
if(rr()<pBlock)return {ausgang:"geblockt",blocker:blockKandidat,torwart:null,pTor:0};
if(rr()<HK_VORBEI)return {ausgang:"vorbei",torwart:null,pTor:0};
...
if(rr()<pTor)return {ausgang:"tor",torwart:tw,pTor};

// loeseHockeySchuss — eine Zeile, ganz oben, vor jeder Verzweigung
schuetze.xg=(schuetze.xg||0)+(hk.pTor||0);

// feldspielWert, Hockey-Feldspieler
return u.punkte*1.5+u.xg*1.5+u.assists1*2+...   // vorher u.punkte*3
```

**Nachgeprüft, nicht geglaubt:**

- *„Kein neuer `rr()`-Aufruf, keine Verschiebung der bestehenden."* Beim Lesen richtig — die
  drei Würfe stehen unverändert. Der stärkere Beweis fiel nebenbei ab: in den Experimenten 1
  und 2, die ausschließlich die Torwart-Konstanten anfassen, blieben die Feldspieler-Zahlen
  **ziffernidentisch** (n=24: 0,719 [0,182] / 0,818 [0,259]; n=48: 0,714 [0,167] / 0,776
  [0,231]). Wäre irgendwo eine Zufallsfolge verschoben, wäre das unmöglich.
- *„Im Erwartungswert identisch zu einem Tor."* Stimmt und ist jetzt gemessen: über 1200
  Feldspieler-Spiele der Kader-Familie steht `punkte` bei 1,038 und `xg` bei 1,044 — 0,6 %
  auseinander, weit innerhalb des Standardfehlers. Das ist mathematisch auch zwingend:
  `pTor` ist genau die Wahrscheinlichkeit, mit der derselbe Schuss zum Tor wird, und `xg`
  bleibt bei geblockt/vorbei auf 0.
- **Daraus folgt eine Entwarnung, die im Bericht fehlt:** `HK_TW_BASIS` musste wegen K3
  **nicht** nachgezogen werden, obwohl die Recherche (3.3) das als Kostenpunkt aufführte —
  K3 lässt den Feldspieler-Mittelwert unverändert. Das gehört in den Bericht, weil der
  Kommentar an `HK_TW_BASIS` sonst als verletzt gelesen wird. (Er ist trotzdem verletzt,
  nur aus einem anderen Grund — Abschnitt 2.)

### 1.2 Die Torwart-Markierung und die drei Helfer

`disziplinProbe` hängt `torwart:!!u.torwart` an die Feldspiel-Teilnehmerliste und
`...(u.torwart?{torwart:true}:{})` an die Spielerzeile; `hatTorwart()` prüft auf
`t.torwart === true`, `ohneTorwart()` filtert je Spiel. Sauber additiv, für jede andere
Disziplin ein No-op — Basketball war in jeder meiner Messungen bit-identisch (0,757 [0,102]).
Der `feldOnlyZusatz()`-Einstieg in `disziplinMessen` ist an beiden Rückgabepfaden gesetzt
(Kader-Familie und Einzelkader), das ist leicht zu übersehen und hier richtig gemacht.

### 1.3 Der fremde Gewichtheben-Hunk — geprüft, in Ordnung

`35d9e43a` hat einen unfertigen Gewichtheben-Hunk aus einer parallel laufenden Session
mitgenommen (`HEBEN_TAGESMAX_ANSAGE_K` plus die `tagesmax`-Formel), dessen Kommentar „auf 0
gehalten" sagte, während der Wert auf 0,0045 stand. `1d56cf07` hat ihn vollständig entfernt,
`575b6ddd` hat ihn später mit eigener Messung und stimmigem Kommentar bewusst wieder
eingeführt. **Auf `main` ist das heute konsistent** (nachgelesen an Zeile 10003–10017). Kein
offener Befund, aber die Prozessnotiz bleibt: ein `git add -p` oder wenigstens ein
`git diff --stat` vor dem Commit hätte das gefangen, und beim nächsten Mal steht der fremde
Hunk vielleicht in einer Zeile, die niemandem auffällt.

---

## 2. Der Befund: zwei veraltete Torwart-Konstanten

### 2.1 Was dasteht und was gemessen ist

```js
const HK_TW_REF=0.907, HK_TW_BASIS=7.16, HK_TW_GSAA_K=2.0;
```

Der Kommentar direkt darüber sagt selbst, was diese beiden Zahlen sein müssen:

> „HK_TW_BASIS ist der GEMESSENE Mittelwert der Feldspieler-Impacts und muss nach JEDER
> Aenderung der Wertformel nachgezogen werden — sonst faellt der Torwart aus der Rangfolge,
> ohne dass sich an ihm etwas geaendert haette."

> „HK_TW_REF MUSS dieser eigenen Liga folgen — sonst sieht JEDER Torwart im Schnitt besser aus
> als er ist."

Gemessen auf der kaderfesten Bank (fünf echte Paarungen, 24 Spiele je Paarung, 1200
Feldspieler- und 240 Torwart-Zeilen):

| Größe | im Code | heute gemessen | Differenz |
|---|---:|---:|---:|
| Mittelwert der Feldspieler-Werte (`HK_TW_BASIS`) | 7,16 | **9,13** | −1,97 |
| Fangquote der eigenen Liga (`HK_TW_REF`) | 0,907 | **0,871** (Kader-Familie) / 0,891 (Einzelkader) | GSAA-Mittel **−1,44** Tore |

Die Rechnung geht exakt auf: `HK_TW_BASIS + GSAA·HK_TW_GSAA_K` = 7,16 + (−1,44)·2 = **4,28**,
und der gemessene Torwart-Mittelwert ist **4,29**. Der Feldspieler-Mittelwert liegt bei 9,13.

**Jeder Torwart in jedem Spiel startet damit 4,84 Wertpunkte unter dem Feldspieler-Schnitt —
0,54 Feldspieler-Standardabweichungen — bevor er einen einzigen Puck gesehen hat.** Das ist
kein Eishockey-Rauschen, das ist Arithmetik. Und es ist genau der Zustand, den der Kommentar
als Fehlerbild beschreibt: „der Torwart faellt aus der Rangfolge, ohne dass sich an ihm etwas
geaendert haette."

Zur Herkunft, fair: der Drift ist **nicht** von K3 verursacht (K3 ist mittelwertneutral,
Abschnitt 1.1), sondern von den Runden davor — der eigenen Erfolgskurve und der
Passqualitäts-/Abprallerkette, die die Fangquote und den Feldspieler-Mittelwert bewegt haben.
Die K3-Runde hätte ihn nur gefunden, wenn sie die zwei Zahlen nachgerechnet hätte, statt sich
darauf zu verlassen, dass K3 selbst mittelwertneutral ist. Beides ist wahr.

### 2.2 Was das Nachziehen bringt (gemessen, danach zurückgenommen)

`HK_TW_REF` 0,907 → 0,871 und `HK_TW_BASIS` 7,16 → 9,13:

| | Basislinie n=24 | korrigiert n=24 | Basislinie n=48 | korrigiert n=48 |
|---|---:|---:|---:|---:|
| rho je Spiel, alle 12 | 0,618 [0,247] | **0,669 [0,181]** | 0,613 [0,228] | **0,655 [0,193]** |
| rho Saison, alle 12 | 0,748 [0,126] | 0,832 [0,259] | 0,741 [0,175] | 0,741 [0,238] |
| rho je Spiel, Feldspieler | 0,719 [0,182] | **0,719 [0,182]** | 0,714 [0,167] | **0,714 [0,167]** |
| rho Saison, Feldspieler | 0,818 [0,259] | **0,818 [0,259]** | 0,776 [0,231] | **0,776 [0,231]** |

**Ehrlich gelesen:**

- Die Bewegung je Spiel (+0,051 bei n=24, +0,042 bei n=48) ist **kleiner als die
  Kader-Spannweite** und damit nach der Projekt-Faustregel formal „von Null nicht
  unterscheidbar". Aber die Faustregel schützt vor Kader-Ziehungsglück, und hier ist die
  Feldspieler-Seite **bit-identisch** — die gesamte Bewegung entfällt nachweislich auf die zwei
  Torwart-Zeilen, es gibt also nichts zu verwechseln. Das ist ein anderer Fall als eine
  Rezeptdrehung.
- **Das Vorzeichen hält bei n=24 UND n=48** und die Größenordnung auch — genau die Prüfung,
  an der der Zoneneintritt gescheitert ist. Es gibt hier auch keinen Grund, warum sie kippen
  sollte: die Korrektur ist deterministisch, sie würfelt nichts.
- Die Saisonzahl steigt bei n=24 deutlich (0,748 → 0,832, über die Schranke), bei n=48
  **gar nicht** (0,741 → 0,741). **Die Saison-Aussage ist damit NICHT belegt** und sollte
  nicht behauptet werden. Die Einzelspiel-Aussage ist es.
- Die Spannweite je Spiel schrumpft in beiden Stichproben (0,247→0,181 und 0,228→0,193) —
  das ist der erwartete Effekt, wenn eine systematische Verzerrung verschwindet.

Die genauen Zielwerte gehören vor einem Commit noch einmal frisch gezogen (mein 9,13/0,871
stammt aus einer eigenen Sonde über `feldspielProbe`, nicht aus einem Repo-Werkzeug), und die
Basislinie in `data/generated/rangtreue-basislinie.json` muss danach neu gebaut werden, sonst
piepst das CI-Gate in die falsche Richtung. Beides ist Handarbeit von Minuten, kein Projekt.

### 2.3 Warum die echte Analytik hier zustimmt

`GSAA = Schüsse·(1−Liga-Fangquote) − Gegentore` misst die erwarteten Gegentore **allein an der
Zahl der Schüsse**. Damit wird ein Torwart, der viele schwere Schüsse hält, genauso bewertet
wie einer, der viele leichte hält. Die Eishockey-Analytik hat genau diesen Posten längst
ersetzt, und der Satz dazu ist ungewöhnlich deutlich:

> „Goals Saved Above Expected (GSAx) and Goals Saved Above Average (GSAA) are two very
> different stats that should not be used interchangeably. **One of them is the best goalie
> stat out there right now, the other is relatively useless.**" — JFresh Hockey

GSAx ist erwartete Gegentore (Summe der xG aller Schüsse aufs Tor) minus tatsächliche
Gegentore. **Unser Motor rechnet die dafür nötige Zahl seit K3 bereits aus** — `pTor` steht bei
jedem Schuss fest. Für einen Torwart-GSAx bräuchte es nur eine torwartunabhängige Variante
davon (ohne `paradeFaktor`, sonst hebt sich das Signal selbst auf) und einen Zähler `xgGegen`
am Torwart. **Kein neuer `rr()`-Wurf, keine Mechanikänderung** — dieselbe Bauform wie K3, nur
auf der anderen Seite des Tors. Das ist der ehrlichere Weg als „Torwart aus der Messung
nehmen", und die Recherche selbst nennt rho(PARADE, GSAA) mit 0,39 als „ehrlich schwach".

**Ein zweiter Grund, den Torwart trotzdem getrennt zu messen, bleibt bestehen und ist real:**
die Torwart-Bewertung ist in EINEM Spiel auch in der NHL Rauschen. Die Fangquote korreliert von
Jahr zu Jahr nur mit **0,296**, nur „30 percent of the difference … actually belongs to the
goalie himself", und sie stabilisiert erst nach rund **3.000 Schüssen** auf halb Signal, halb
Glück. Bei unseren 40 Schüssen je Spiel ist das Verhältnis rund 1,3 % Signal. Kein Rezept der
Welt ändert das — die Trennung von Skater- und Torwart-Bewertung bleibt richtig, auch nachdem
die Konstanten stimmen.

---

## 3. Frage (a): Ist „Tor halb binär, halb xG" analytisch vertretbar?

### 3.1 Was die echte Analytik macht — und was sie NICHT macht

Kein reales xG-Modell mischt xG 50:50 mit dem binären Ausgang. xG ist dort eine durchgehende
Wahrscheinlichkeit, und die Modelle sind ausdrücklich so gebaut, dass sie **weder den Schützen
noch den Torwart kennen**:

- **MoneyPuck**: 15 Merkmale, alle situativ (Distanz, Winkel, Schusstyp, Zeit und Ort des
  Vorereignisses, Tempo, Über-/Unterzahl). Torwart-Identität ist kein Merkmal; die
  Schussfähigkeit des Schützen ausdrücklich auch nicht.
- **Evolving-Hockey**: dasselbe Bild, plus zwei Zusatzbefunde — es werden **nur ungeblockte
  Versuche** gerechnet (Fenwick, weil die Koordinate eines geblockten Schusses am Blocker
  aufgenommen wird), und ein Schützen-Talent-Merkmal wurde getestet und vom Algorithmus
  **verworfen**: „This variable … was never used in any decision tree that was generated."

Wer G und xG nebeneinander sehen will, bekommt in der echten Analytik **zwei Spalten** (G und
ixG), nicht eine Summe.

### 3.2 Wir weichen an zwei Stellen ab — beide gemessen, beide folgenlos

**Abweichung 1: unser `pTor` enthält den `paradeFaktor` des gegnerischen Torwarts.**

```js
const paradeFaktor=tw?1-Math.max(0,Math.min(0.45,(tw.PARADE-20)*0.0060)):1;  // 1,00 bis 0,55
const pTor=Math.max(0.01,Math.min(0.60,technik*HK_TOR_SKALA*paradeFaktor));
```

Theoretisch ist das ein echter Konfundierer: alle fünf Feldspieler einer Mannschaft bekommen
denselben Faktor, alle fünf der anderen einen anderen — bis zu 45 % Unterschied auf einen
Posten, der rund ein Fünftel der Wertmasse trägt, und zwar aus einem Grund, der mit keinem
Feldspieler etwas zu tun hat. Genau deshalb lassen MoneyPuck und Evolving-Hockey den Torwart
aus dem Modell.

**Gemessen: praktisch folgenlos.** Ich habe `pTor` für die Buchung durch einen neutralen
Ligadurchschnitts-Torwart ersetzt (Faktor 0,70, so gewählt, dass der Mittelwert erhalten
bleibt — geprüft: `xg` 1,044 vorher wie nachher). Feldspieler-rho 0,719 → **0,715**, alle 12
0,618 → 0,616. Innerhalb der Spannweite, also nichts. Der Grund ist plausibel: die gefeldeten
Torhüter liegen in PARADE selten weit auseinander, und dieselbe Verzerrung steckt ohnehin
schon in `punkte`.

**Abweichung 2: wir buchen xg nur auf Schüsse, die AUFS TOR kamen.** Ein Elftel aller
ungeblockten Versuche fällt vorher durch `HK_VORBEI = 0,11` — eine **feste, fähigkeitsblinde**
Wahrscheinlichkeit. Diese Ausdünnung ist reines Rauschen ohne Informationsgewinn, und die
echten Modelle rechnen deshalb auf Fenwick, also auf allen ungeblockten Versuchen.

**Gemessen: ebenfalls folgenlos.** Die `pTor`-Berechnung enthält keinen `rr()`-Aufruf, sie lässt
sich also über den Vorbei-Wurf ziehen, ohne die Zufallsfolge zu verschieben; gebucht wird dann
`pTor·(1−HK_VORBEI)` auf jeden ungeblockten Versuch, wodurch der Erwartungswert erhalten bleibt
(geprüft: `xg` 1,045). Feldspieler-rho 0,719 → **0,714**.

### 3.3 Urteil

**Die 50/50-Aufteilung ist als *Vereinfachung* vertretbar, aber sie ist nicht aus der
xG-Literatur begründbar — sie ist ein Schrumpf-Schätzer, und als solcher sollte sie im Bericht
auch stehen.** Was K3 tatsächlich tut, ist statistisch das, was die Analytik mit Schussquoten
seit jeher macht: einen verrauschten Beobachtungswert (Tor, ja/nein) zur Hälfte gegen seinen
Erwartungswert schrumpfen, weil der Erwartungswert der bessere Schätzer der Fähigkeit ist.
Dass die Trefferquote je Schuss in unserem Motor mit ~10 % ähnlich niedrig ist wie in der NHL
(Liga-Fangquote 89,6 %), macht das Argument sogar stärker als in Basketball.

Was die 50/50 aber NICHT ist: kalibriert. Weder 1,5/1,5 noch irgendein anderes Verhältnis wurde
gegen Alternativen durchgemessen — die Recherche hat nur „ganz statt halb" verglichen (0,649,
schlechter). Ein Sweep über das Verhältnis (etwa 1,0/2,0 und 2,0/1,0) ist **billig, ohne
`rr()`-Risiko und ohne Rezeptberührung** und wäre die naheliegendste nächste Feinjustage.
Erwartung ehrlich: klein.

---

## 4. Frage (b): Ist „nur Feldspieler" ein sauberer Weg?

### 4.1 Ja — genau so trennt es die echte Analytik auch

Evolving-Hockeys GAR führt Skater und Torhüter in **getrennten Tabellen mit unterschiedlichen
Komponenten** (Skater: EVO, EVD, PPO, SHD, Take, Draw — Torwart: EVD, SHD, Take, Draw). Sie
landen am Ende auf derselben Tor-Skala, damit man sie *vergleichen* kann, aber sie werden mit
zwei verschiedenen Modellen berechnet. Niemand ordnet Torhüter und Feldspieler nach einem
gemeinsamen Boxscore. Der Split ist also nicht nur zulässig, er ist Standard.

Und der Grund, den der Bericht nennt, ist real: eine Fangquote aus EINEM Spiel sagt fast
nichts. 0,296 Jahr-zu-Jahr-Korrelation, 30 % Signalanteil über eine ganze Saison, 3.000 Schüsse
bis zur Hälfte Signal.

### 4.2 Aber: der Split verdeckt hier etwas, das kein Eishockey-Phänomen ist

Der Bericht begründet die Zwölfer-Lücke damit, dass Torwart-Varianz „ein reales
Eishockey-Phänomen (ist), das keine Rezeptrunde beheben kann oder sollte". Das stimmt für die
**Streuung**. Es stimmt nicht für den **Mittelwert** — und der Mittelwert ist hier um 4,84
Punkte verschoben (Abschnitt 2). Rauschen macht die Torwart-Position in der Rangliste
*unvorhersagbar*; die zwei veralteten Konstanten machen sie *systematisch niedrig*. Das erste
ist Eishockey, das zweite ist ein Zahlendreher, den der Split unsichtbar macht.

**Empfehlung: beides tun.** Split behalten (er ist Standard und beantwortet die richtige Frage)
UND die Konstanten nachziehen (weil die Zwölferzahl das CI-Gate ist und ein Gate, das eine
Arithmetik-Verzerrung misst, das falsche absichert).

### 4.3 Zwei Sachen an der Messbank, die nicht stimmen

**(a) Der Torwart wechselt auf der Messbank von Spiel zu Spiel.** Nachgemessen: über 24 Spiele
EINER Kader-Paarung treten **vier verschiedene Torwart-Paarungen** auf, und **fünf** Spieler
waren mal Torwart und mal Feldspieler. Der Grund steht in `bestimmeTorwaerter()`: es zählt nur
eine echte Manager-Zuweisung (`u.slotGesetzt`), und `data/generated/kaderfamilie-live-save.json`
trägt **überhaupt keine Slot-Felder** (nachgesehen: `n, c, r, sub, tp, tn, d, groesse, a`). Auf
der Bank greift also immer der PARADE-Rückfall — und weil je Spiel nur sechs aus einem 8- bis
14-Mann-Kader auflaufen, ist der beste PARADE-Wert mal dieser, mal jener.

Das hat zwei Folgen:

- Die Begründung im Bericht, das CI-Gate müsse bei zwölf bleiben, „weil ein echtes
  Chris-Spiel tatsächlich zwei Torhüter mitfeldet", trägt nur halb: ein echtes Chris-Spiel
  feldet zwei **feste** Torhüter aus der Aufstellung. Die Bank feldet zwei rotierende. Das
  Gate misst also eine Situation, die es im Spiel nicht gibt.
- Die **Saisonzahl** über alle zwölf mittelt für fünf Spieler Werte, die aus zwei
  strukturell verschiedenen Formeln stammen (Torwartformel in den einen Spielen,
  Feldspielerformel in den anderen). Die Einzelspielzahl ist davon nicht betroffen — je Spiel
  wird sauber gerechnet.

Behebbar mit einer Zeile in `scripts/ziehe-kader-familie.ts` (Slot-Rollen mitziehen) oder
einem `opt.torwartFest` in der Sonde. Kein Motoreingriff.

**(b) Die Feldspieler-Zeile druckt „Teiln. 12", nicht 10.** `teilnehmerFeld` kommt aus
`auswerten().teilnehmer`, und das ist `agg.size` — die Zahl **verschiedener Namen über die
Saison**, nicht die Zahl der je Spiel geordneten Spieler. Weil der Torwart rotiert, taucht
jeder der zwölf irgendwann als Feldspieler auf. Rechnerisch harmlos, aber die Zeile
„davon nur Feldspieler … 12" liest sich wie „es wurde gar nichts gefiltert" und untergräbt
genau die Zahl, auf der der Bericht steht. Zwei Zeilen: den Median der Teilnehmerzahl **je
Spiel** ausweisen statt die Namenszahl über die Saison.

### 4.4 Der nächste Split, den die echte Analytik nahelegt

Die Analytik vergleicht Verteidiger mit Verteidigern, nicht mit Stürmern — der beste
Verteidiger der letzten Saison kam auf 92 Punkte, der beste Stürmer auf 121, und ein
Drittpaar-Verteidiger auf einen Bruchteil davon. Position, nicht nur Talent, bestimmt den
Boxscore.

Unser Motor hat dafür ein direktes Gegenstück, und es ist gemessen: die Trefferquote hängt
massiv am **Standplatz** — nah 21,3 %, mit 10,4 %, fern 6,4 % (Recherche 0.1). Wen
`zuordneSlots` an die blaue Linie stellt, der schießt zu 6,4 %; wer im Slot steht, zu 21,3 %.
Das ist unser F/D-Problem. **Eine Rangtreue-Zeile je Slot-Gruppe wäre der natürliche nächste
Split — dieselbe Bauform wie `feldOnlyZusatz()`, nur nach `slotId` statt nach `torwart`.**
Reine Messung, null Motorrisiko, und sie beantwortet die Frage, die heute niemand stellt: ordnet
die Mechanik innerhalb einer Rolle richtig, oder ordnet sie nur Rollen?

---

## 5. Frage (c): Ist rho ~0,72 je Spiel plausibel — und ist 0,80 die richtige Schranke?

### 5.1 Was echtes Eishockey in EINEM Spiel liefert

| Größe | echte NHL (simuliert, Abschnitt 0.2) | unser Hockey (gemessen) |
|---|---:|---:|
| rho je Spiel, 10 Feldspieler | **0,395** | **0,719** |
| Spiel-zu-Spiel-Verlässlichkeit | **0,140** | 0,755 (CLAUDE.md) |
| Validität (Saison) | 0,927 | 0,818 |
| Eignungsbester auf Wertrang 1 | **31 %** | **58 %** |
| Eignungsbester ohne Scorerpunkt | **33 %** | **5 %** |
| Ereignisdichte (Schüsse aufs Tor je Minute und Team) | 0,49 | **9,45** (19-fach) |

Die Größenordnung deckt sich mit dem, was die Analytiker selbst sagen. Der beste Scorer der
NHL kam letzte Saison auf **1,55 Punkte je Spiel** — er ist also in rund einem Fünftel seiner
Spiele punktlos, während ein Viertlinien-Stürmer in gut einem Viertel seiner Spiele trifft.
Und die NHL-eigene Erklärseite zum Game Score schreibt es hin:

> „Game Score is NOT a reflection on a player as a whole. **One game simply doesn't provide
> enough of a look at all that a player can do.**"

Dazu kommt die harte Obergrenze der Sportart: rund **38 %** der Tabellenstreuung einer ganzen
82-Spiele-Saison sind Glück. Eine Sportart, in der eine ganze Saison zu über einem Drittel
Zufall ist, ordnet in einem einzelnen Spiel nichts sauber.

### 5.2 Was daraus folgt

**Die 0,80-Schranke in EINEM Spiel ist für Eishockey keine Realismus-Schranke — sie ist eine
Spielbau-Schranke.** Chris' Begründung dafür ist völlig richtig und hat mit Realismus nichts zu
tun: bei zwei Hockeyspielen je Saison muss der Spieler *sehen*, dass seine Kaderarbeit gewirkt
hat. Eine Rangtreue, die sich erst über zwanzig Spiele einstellt, existiert für ihn nicht.

Aber es heißt eben auch: **wir sind bereits weit jenseits des Realismus, und wir haben das mit
der 19-fachen NHL-Ereignisdichte gekauft.** 0,719 je Spiel gegen die realen 0,40 — unser
Eishockey ist ungefähr doppelt so rangtreu je Spiel wie das echte. Die nächsten 0,08 sind nicht
„Hockey realistischer machen", sie sind „Hockey noch unrealistischer machen, weil das Spiel es
braucht". Das ist eine legitime Entscheidung — sie sollte nur bewusst als solche getroffen
werden, statt als Qualitätsmangel gebucht zu werden.

### 5.3 Die Zahlen in CLAUDE.md für Hockey sind veraltet

Nebenbefund, aber er betrifft die Grundlage: CLAUDE.md führt für Hockey „rho je Spiel 0,670,
Validität 0,874, Star auf Rang 1 79 %, in den ersten zwei 94 %". Auf der heutigen kaderfesten
Bank messe ich **0,618 (alle 12) / 0,719 (Feldspieler)**, Validität 0,748 / 0,818, und
**Star auf Rang 1 58 %, in den ersten zwei 78 %, auf dem letzten Rang 0 %**. Die 79/94 stammen
aus der Einzelkader-Zeit und sind zu optimistisch; das „nie auf dem letzten Platz" hält
dagegen (0 %). Wer die 0,80-Debatte auf CLAUDE.mds Zahlen führt, führt sie auf zu guten Zahlen.

**Vorschlag zur Abnahme, den CLAUDE.md selbst schon anlegt:** die ehrlichere Frage ist „steht
der Star oben und werden Paare mit Abstand richtig geordnet", nicht „wie hoch ist die nackte
Rangkorrelation über alle Paare". Für Hockey heißt das heute: 58 % Rang 1, 78 % Top zwei, 0 %
Letzter. Der letzte Wert ist der wichtigste und er ist perfekt — **der Spieler wird nie erleben,
dass sein bester Mann Schlusslicht ist.** Wenn Chris eine Schranke will, die für Eishockey
gleichzeitig streng und erreichbar ist, ist das die richtige Größe, nicht rho.

---

## 6. Frage (d): Welcher Hebel ist noch offen, ohne die RNG-Kaskade?

Die Lehre aus `hockey-zoneneintritt-umsetzung.md` ist präzise und richtig: ein **neuer
`rr()`-Wurf, der 40–50-mal je Spiel fällt**, verschiebt die Zufallsbahn aller folgenden
Ereignisse, und bei n=24 dominiert diese Kaskade die Messung. Das ist kein Einwand gegen
Zoneneintritte, sondern gegen *neue hochfrequente Würfel bei dieser Stichprobengröße*. Alles
unten respektiert das.

### H1 — Die zwei Torwart-Konstanten nachziehen (Abschnitt 2)

Gemessen, Vorzeichen bei n=24 und n=48 stabil, Feldspieler bit-identisch, kein Würfel.
**Sofort machen.** Danach `data/generated/rangtreue-basislinie.json` neu bauen.

### H2 — Torwart auf GSAx statt GSAA (Abschnitt 2.3)

Der beste Torwart-Posten der echten Analytik, und die Zahl dafür liegt seit K3 schon vor.
Bauform identisch zu K3: ein Zähler, eine Zeile, **kein neuer `rr()`**. Abnahme über
`scripts/miss-rangtreue-nach-rolle.mjs` (heute 0,39). Erwartung ehrlich: er hebt die
Torwart-Validität, nicht die Feldspieler-Rangtreue — aber er hebt die Zwölferzahl, weil der
Torwart dann aus dem richtigen Grund oben oder unten steht.

**Wichtiges Detail:** das dafür gebuchte xG muss **ohne** `paradeFaktor` gerechnet werden.
Nimmt man `pTor` wie es ist, steckt die Torwartgüte schon im Erwartungswert und GSAx hebt sich
selbst auf — genau der Fehler, den MoneyPuck und Evolving-Hockey mit der torwartfreien
Modellierung vermeiden.

### H3 — Deterministische Wechsel (Eiszeit), ohne einen einzigen neuen Würfel

Der mit Abstand größte reale Hebel, den wir nicht haben: in der NHL spielt der Star 22 Minuten
und die vierte Reihe 10. Das ist der Hauptgrund, warum Boxscore-Produktion überhaupt mit
Talent korreliert. Bei uns stehen alle fünf Feldspieler **100 % der Zeit** auf dem Eis.

Zwei Dinge folgen daraus, die im Projekt bisher nicht ausgesprochen sind:

1. **Die beiden wiederholbarsten Skater-Statistiken der echten Analytik sind bei uns
   strukturell unbenutzbar.** On-Ice-Corsi (CF/CA) und GF/GA stehen mit je 0,05 und 0,15 im
   NHL Game Score. Bei uns sind sie für alle fünf Feldspieler einer Mannschaft **identisch** —
   es gibt keine Wechsel, also ist jede On-Ice-Größe eine Mannschaftskonstante mit null
   Informationsgehalt über den einzelnen Spieler. Das erklärt die gemessene Orakel-Decke von
   0,73 besser als jede Rezeptdiskussion: uns fehlen nicht Gewichte, uns fehlen die zwei
   Kanäle, aus denen die echte Analytik den Großteil ihres Signals zieht.
2. **Eine Schichtrotation braucht keinen einzigen `rr()`-Aufruf.** Ein fester Wechselplan
   („alle 20 Sekunden rotiert der sechste Feldspieler ein, Reihenfolge aus der Aufstellung")
   ist deterministisch. Damit fehlt ihm genau die Eigenschaft, an der der Zoneneintritt
   gescheitert ist. Er hebt gleichzeitig Validität (mehr Eiszeit für die, die der Manager
   vorne aufstellt) **und** Verlässlichkeit (der Star sammelt mehr Ereignisse je Spiel), und
   er macht On-Ice-Größen individuell.

**Zwei ehrliche Vorbehalte.** Erstens ist das eine Mechanik, kein Gewicht — es ist der
teuerste Vorschlag in diesem Bericht und braucht eine eigene Runde mit Vorher/Nachher bei n=24
und n=48. Zweitens, und wichtiger: **die Eiszeit darf nicht aus `eig` kommen**, sonst ist die
Rangtreue-Messung zirkulär (wir würden messen, dass wir dem Eignungsbesten mehr Eiszeit geben).
Sie muss aus der **Aufstellungsreihenfolge des Managers** kommen — was gleichzeitig genau die
Kaderarbeit sichtbar macht, um die es Chris bei der Einzelspiel-Schranke geht.

### H4 — Rangtreue je Slot-Gruppe messen (Abschnitt 4.4)

Reine Messung, null Risiko, dieselbe Bauform wie der Torwart-Split.

### H5 — Das Verhältnis in `punkte·1,5 + xg·1,5` durchsweepen (Abschnitt 3.3)

Billig, kein Würfel, kein Rezept. Erwartung klein, aber es ist die einzige Zahl an K3, die nie
gegen Alternativen gemessen wurde.

### Was ich ausdrücklich NICHT vorschlage

- **Einen Bully-Wertposten.** Real gemessen 0,013–0,015 Tore je gewonnenem Bully, 76,5
  Netto-Gewinne für ein Tor. Der Motor führt das Bully als TECHNIK-Duell ohne Wertposten —
  das ist zu Recht so und deckt sich mit der Literatur.
- **Den Zoneneintritt-Zweikampf ein drittes Mal.** Die Diagnose bleibt richtig, die Bauform
  bleibt falsch für n=24.
- **Die Uhr.** Wir haben bereits die 19-fache NHL-Ereignisdichte je Minute. Mehr Ereignisse
  sind keine Antwort mehr auf irgendetwas.
- **Eine weitere Rezeptrunde.** Orakel-Decke 0,73 mit den heutigen Posten, dreimal
  unabhängig bestätigt.

---

## 7. Was mir am Code auffiel (alles am echten Diff geprüft)

| # | Fund | Schwere |
|---|---|---|
| 1 | `HK_TW_REF=0.907` und `HK_TW_BASIS=7.16` gegen gemessene 0,871 und 9,13 — beide Kommentare verlangen das Nachziehen ausdrücklich, beide sind seit mehreren Runden nicht nachgezogen. Wirkung: −4,84 Wertpunkte auf jeden Torwart, gemessen (Abschnitt 2) | **echter Befund** |
| 2 | Der Torwart-Zweig von `feldspielWert` bucht weiterhin `u.punkte*3`, der Feldspieler-Zweig seit K3 `punkte*1.5+xg*1.5`. Die beiden Zweige sind sich jetzt uneinig darüber, was ein Tor wert ist. Praktisch folgenlos (Torhüter schießen fast nie), aber es ist eine Inkonsistenz, die beim nächsten Nachziehen stolpert | klein |
| 3 | `teilnehmerFeld` druckt 12 statt 10, weil `auswerten().teilnehmer` die Namenszahl über die Saison ist, nicht die Zahl je Spiel (Abschnitt 4.3b) | kosmetisch, aber irreführend |
| 4 | Der Torwart rotiert auf der Messbank (vier Paarungen über 24 Spiele), weil die Kader-Familie keine Slot-Felder trägt. Betrifft die Saisonzahl über alle zwölf und die Begründung des CI-Gates (Abschnitt 4.3a) | mittel, Messbank |
| 5 | `hockeySchussAusgang` gibt bei „vorbei" einmal `pTor:0` (früher Wurf, Schuss kam nie aufs Tor) und einmal `pTor` (leeres Tor, Schuss war auf dem Weg) zurück. Beides ist für die xg-Bilanz richtig, aber derselbe `ausgang`-String trägt zwei verschiedene Bedeutungen — einen Kommentar wert, bevor jemand darüber stolpert | kosmetisch |
| 6 | `35d9e43a` enthielt einen fremden Gewichtheben-Hunk; `1d56cf07` hat ihn sauber entfernt, `main` ist heute konsistent. Kein offener Befund, Prozessnotiz (Abschnitt 1.3) | erledigt |
| 7 | `hatTorwart`/`ohneTorwart`/`feldOnlyZusatz`, die `torwart`-Markierung und der `feldOnlyZusatz`-Einstieg an **beiden** Rückgabepfaden von `disziplinMessen`: sauber, additiv, korrekt no-op für alle anderen Disziplinen. Basketball in jeder meiner Messungen bit-identisch (0,757 [0,102]) | kein Befund |

---

## 8. Was ich NICHT geprüft habe

- **Ob 9,13 und 0,871 die richtigen neuen Konstanten sind.** Sie kommen aus meiner eigenen
  Sonde über `feldspielProbe` mit der Kader-Familie, nicht aus einem Repo-Werkzeug. Der
  Einzelkader liest 89,1 % statt 87,1 % — vor einem Commit muss festgelegt werden, welche Bank
  maßgeblich ist (mein Vorschlag: die Kader-Familie, weil die Abnahme dort läuft).
- **Die Wirkung von H1 auf die CI-Basislinie.** Sie muss neu gebaut werden, das habe ich nicht
  getan.
- **H2, H3, H4, H5** sind Vorschläge mit Begründung, keine Messungen. H3 (Wechsel) ist eine
  echte Mechanik und könnte in der Umsetzung Überraschungen haben, die ich nicht sehe.
- **Die visuelle Seite.** Der Abschlussbericht hat vier Screenshots ohne Befund; ich habe das
  nicht wiederholt.
- **`npm test` / `tsc`.** Ich habe nur `node --check` gefahren, weil am Ende kein Motorcode
  geändert ist.
- **Die Trefferquoten je Distanzstufe gegen echte NHL-xG-Werte gehalten.** Unsere 21,3 % im
  Slot gegen 6,4 % von der blauen Linie sehen der realen Spreizung ähnlich (Tip-in 14,5 %
  gegen klare Schüsse 4,9 %), aber ich habe keine echte NHL-xG-Verteilung je Zone abgerufen und
  dagegen gerechnet.

---

## 9. Schlussurteil für Chris

**Ist Hockey „erstmal zufriedenstellend"? Ja.** Der Abschlussbericht ist ehrlich, K3 hält der
Nachprüfung stand, der Feldspieler-Split ist genau das, was die echte Analytik auch macht, und
die visuelle Seite ist ohne Befund. Nichts davon musste ich zurücknehmen.

**Zwei Einschränkungen, die ich dir trotzdem hinlege:**

1. **Ein Fund liegt darunter, und er ist billig.** Zwei Torwart-Konstanten sind veraltet und
   drücken jeden Torwart um 4,84 Punkte unter den Feldspieler-Schnitt. Nachziehen bringt die
   Zwölferzahl von 0,618 auf 0,669 (n=24) und von 0,613 auf 0,655 (n=48), ohne einen einzigen
   Feldspieler-Wert zu bewegen. Das ist kein Rezept, kein Würfel und kein Risiko — es ist das
   Nachrechnen von zwei Zahlen, die der Code selbst als nachziehpflichtig markiert.
2. **Die 0,80-Schranke ist für Eishockey ein Spielbau-Ziel, kein Realismus-Ziel — und wir sind
   schon weit darüber hinaus.** Echtes Eishockey liefert in einem Spiel rho ≈ 0,40; wir liefern
   0,719. Der eignungsbeste Feldspieler steht bei uns in 58 % der Spiele oben und **in 0 % der
   Spiele unten**; in der NHL wäre er in einem Drittel der Spiele punktlos. Die restlichen 0,08
   sind erreichbar, aber sie kosten eine echte Mechanik (Wechsel/Eiszeit), und sie machen das
   Spiel *unrealistischer*, nicht realistischer. Das ist deine Entscheidung, keine technische.

**Wenn du nur eine Sache aus diesem Bericht machst: zieh die zwei Torwart-Konstanten nach.**
Wenn du zwei machst: dann noch GSAx statt GSAA für den Torwart — die Zahl dafür rechnet der
Motor seit K3 ohnehin schon aus.

---

## Die Tabelle

| NHL-Fundstelle | was das für unsere Mechanik heißt | Handlungsempfehlung |
|---|---|---|
| **GSAx gegen GSAA**: „one of them is the best goalie stat out there right now, the other is relatively useless" (JFresh) | Unser `HK_TW_BASIS + GSAA·2` ist die verworfene Variante; die für GSAx nötige Zahl (`pTor`) rechnet der Motor seit K3 schon aus | **ja** — H2, kein neuer `rr()`, gleiche Bauform wie K3 |
| **GSAA misst gegen die eigene Liga-Fangquote** — läuft die Referenz weg, verschiebt sich der Nullpunkt | `HK_TW_REF=0,907` gegen gemessene 0,871; `HK_TW_BASIS=7,16` gegen gemessene 9,13. Zusammen −4,84 Punkte auf jeden Torwart | **ja, zuerst** — gemessen 0,618→0,669 (n=24), 0,613→0,655 (n=48), Feldspieler bit-identisch |
| **MoneyPuck/Evolving-Hockey: xG kennt weder Torwart noch Schützen** | Unser `pTor` trägt den `paradeFaktor` des gegnerischen Torhüters in die Schützen-Bilanz | **nein** — gebaut und gemessen: 0,719→0,715, folgenlos. Nur für H2 (GSAx) zwingend nötig |
| **Evolving-Hockey rechnet xG auf ungeblockten Versuchen (Fenwick), nicht nur auf Schüssen aufs Tor** | Unser `HK_VORBEI=0,11` ist fähigkeitsblind und dünnt die xg-Buchung um ein Elftel aus | **nein** — gebaut und gemessen: 0,719→0,714, folgenlos |
| **Kein reales Modell mischt xG 50:50 mit dem binären Tor; die Analytik zeigt G und ixG als zwei Spalten** | K3s 1,5/1,5 ist kein xG-Modell, sondern ein Schrumpf-Schätzer — vertretbar, aber nie gegen Alternativen kalibriert | **vielleicht später** — H5, ein billiger Sweep über das Verhältnis |
| **GAR/WAR führt Skater und Torhüter in getrennten Tabellen mit getrennten Komponenten** | Der Feldspieler-only-Split entspricht der Standardpraxis | **ja, beibehalten** — aber nicht als Ersatz für H1 |
| **Fangquote: r = 0,296 Jahr zu Jahr, 30 % Signal, 3.000 Schüsse bis halb Signal** | Bei 40 Schüssen je Spiel ist unser Torwart-Wert zu ~1 % Signal — die Streuung ist echtes Eishockey und nicht behebbar | **nein** — nichts zu tun, aber der Split bleibt begründet |
| **Kucherov 1,55 Punkte je Spiel; Game Score: „One game simply doesn't provide enough of a look"; 38 % der Saisonstreuung ist Glück** | Echtes Eishockey liefert je Spiel rho ≈ 0,40 bei Verlässlichkeit 0,14; wir liefern 0,719 bei 0,755 | **nein** — 0,80 ist ein Spielbau-Ziel; die Schranke bewusst so benennen |
| **Ice Time: Star 22 min, vierte Reihe 10 min — der größte reale Produktions-Hebel; On-Ice-Corsi und GF/GA stehen im Game Score** | Bei uns spielen alle fünf 100 %, also sind alle On-Ice-Größen Mannschaftskonstanten — die zwei wiederholbarsten Skater-Kanäle sind unbenutzbar | **vielleicht später** — H3; ein DETERMINISTISCHER Wechselplan braucht keinen neuen `rr()` und umgeht damit genau das, woran K1 scheiterte |
| **Verteidiger scoren strukturell weniger als Stürmer (92 gegen 121 an der Spitze); die Analytik vergleicht innerhalb der Position** | Bei uns bestimmt der Slot die Trefferquote (nah 21,3 %, fern 6,4 %) — dasselbe Problem, nur mit Standplätzen statt Positionen | **ja** — H4, eine Rangtreue-Zeile je Slot-Gruppe, reine Messung |
| **Bully: 0,013–0,015 Tore je Gewinn, 76,5 Gewinne für ein Tor** | Unser Bully ist ein TECHNIK-Duell ohne Wertposten | **nein** — richtig so, deckt sich mit der Literatur |
| **Zoneneintritt: kontrolliert 0,57 gegen 0,12 Schüsse; Break-even 34 %** | Die Diagnose der Recherche stimmt; die Bauform (neuer Würfel, 40–50× je Spiel) ist für n=24 untauglich | **nein** — nicht in dieser Bauform; H3 greift dieselbe Lücke ohne Würfel an |

---

## Quellen

- [MoneyPuck — About / Model Documentation](https://moneypuck.com/about.htm) (15 xG-Merkmale, Torwart- und Schützen-Identität ausdrücklich nicht enthalten)
- [Evolving-Hockey — A New Expected Goals Model for Predicting Goals in the NHL](https://evolving-hockey.com/blog/a-new-expected-goals-model-for-predicting-goals-in-the-nhl/) (nur ungeblockte Versuche; Schützen-Talent getestet und verworfen)
- [Evolving-Hockey — Goals Above Replacement (Glossar)](https://evolving-hockey.com/glossary/goals-above-replacement/) (getrennte Komponenten für Skater und Torhüter)
- [JFresh Hockey — GSAx gegen GSAA](https://x.com/JFreshHockey/status/1234590266029477892) („the best goalie stat out there right now" gegen „relatively useless")
- [Tape to Tape — Why Save Percentage Isn't Enough: A Guide to GSAx](https://tapetotapemk.substack.com/p/why-save-percentage-isnt-enough-a)
- [Neil Paine — A Hot Goalie Isn't a Better Goalie](https://neilpaine.substack.com/p/a-hot-goalie-isnt-a-better-goalie) (r = 0,296; 30 % Signal; 3.000 Schüsse; 59,2 %)
- [TSN, Travis Yost — NHL save percentages hit lowest level in 30 years](https://www.tsn.ca/nhl/article/nhl-save-percentages-hit-lowest-level-in-30-years/) (Liga-Fangquote 89,6 %)
- [NHL.com / Seattle Kraken — Evaluating Single Game Performances Using Game Score](https://www.nhl.com/kraken/news/evaluating-single-game-performances-using-game-score-330146096) („One game simply doesn't provide enough of a look")
- [NHL.com — Halfway Mark: 2024-25 NHL Season](https://www.nhl.com/news/halfway-mark-2024-25-nhl-season) (6,1 Tore je Spiel)
- [theScore — Stat leaders, select award winners finalized for 2024-25](https://www.thescore.com/nhl/news/3268277) (Kucherov 121 Punkte, 1,55 je Spiel)
- [QuantHockey — NHL Defensemen Scoring Leaders 2024-25](https://www.quanthockey.com/nhl/seasons/2024-25-nhl-defensemen-stats.html) (Makar 92 Punkte)
- [Hockey Graphs — Behind the Numbers: What Makes a Stat Good](https://hockey-graphs.com/2017/12/01/behind-the-numbers-what-makes-a-stat-good/) (38 % der Tabellenstreuung ist Glück)
- [Hockey Graphs — Measuring the Importance of Individual Player Zone Entry Creation](https://hockey-graphs.com/2017/08/10/measuring-the-importance-of-individual-player-zone-entry-creation/)
- [Eric Tulsky — Using Zone Entry Data To Separate Offensive, Neutral, And Defensive Zone Performance (MIT Sloan)](http://hockeyanalytics.com/Research_files/Using%20Zone%20Entry%20Data%20To%20Separate%20Offensive,%20Neutral,%20And%20Defensive%20Zone%20Performance.pdf)
- [JHU Engineering Magazine — Probing the Importance of Faceoffs](https://engineering.jhu.edu/magazine-archive/2023/11/probing-the-importance-of-faceoffs/) (0,015 Tore je Bully-Gewinn)
- [The Leafs Nation — How important are faceoffs in hockey?](https://theleafsnation.com/news/how-important-are-faceoffs-in-hockey) (76,5 Netto-Gewinne je Tor)
- [Puck Over the Glass — Which Is Better at Predicting Future Goals: Corsi, Expected Goals, or Scoring Chances?](https://puckovertheglass.substack.com/p/which-is-better-at-predicting-future)
- Projektintern: `hockey-zufriedenstellend.md`, `hockey-naechster-hebel-recherche-fable.md`,
  `hockey-zoneneintritt-umsetzung.md`, `messgrundlage-kaderfest.md`,
  `stand-aller-disziplinen.md` Abschnitt 1a, `CLAUDE.md`.

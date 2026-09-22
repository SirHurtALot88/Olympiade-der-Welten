# I-Spy Schatzsuche — zweiter Opus-Gegencheck: strukturelle rho-Reserve und Chris' Karten-Randomizer (22.09.)

Der erste Gegencheck (`docs/design/i-spy-opus-gegencheck-21-09.md`) prüfte das **Konzept vor dem
Bau**. Dieser hier prüft den **gebauten Motor**: vier PRs (Grundmechanik/Rezept, Sichtbarkeit/
Reaktion, Bühnenbild/Bewegung/Lupe, Ton) plus die Kalibrierrunde vom 22.09. sind auf `main`; I-Spy
steht kaderfest bei rho je Spiel 0,730 und verfehlt die 0,80-Schranke damit als einzige Bühne.

Zwei Fragen, getrennt beantwortet:

1. **Wo steckt noch strukturelle rho-Reserve** — Verlässlichkeit oder Validität?
2. **Trägt Chris' neue Idee** („vor allem auch mit assets verschiedenen maps unterschiedlichen
   Orten für die assets wo sie spawnen — gewichteter randomizer")?

Alle Zahlen sind selbst gemessen, kaderfest über die Fünfer-Familie aus
`data/generated/kaderfamilie-live-save.json` (live-save „Oly New Game Custom 19.8.2026"), 24 Spiele
je Paarung, sofern nicht anders angegeben. `engine.js` meint `public/mockups/battle-mode.engine.js`,
Stand `main` 22.09. (Commit `021e1d91`). Die Messvarianten wurden als **Kopien** der Engine gebaut,
gemessen und wieder entfernt — an `main` wurde nichts geändert; dieses Dokument ist die einzige
Datei, die bleibt.

---

## 0. Fazit vorweg

| # | Frage | Urteil | Zahl |
|---|---|---|---|
| A | Ist Verlässlichkeit oder Validität der Engpass? | **Eindeutig die Verlässlichkeit.** I-Spys Validität (rho Saison 0,902) ist die **zweitbeste** aller gemessenen Bühnen; seine Verlässlichkeit (0,655) ist die **schlechteste von allen**, schlechter als Hockeys 0,755. | s. 1.1 |
| B | Hilft „mehr Ereignisse" (mehr Ticks)? | **Nein — die Hockey-Lehre gilt hier wörtlich.** 8 → 16 Ticks hebt die Verlässlichkeit 0,655 → 0,734 und rho bewegt sich um **+0,021** (Kader-Spannweite 0,221). Flach. | s. 1.2 |
| C | Gibt es einen Interaktionseffekt, den die Kalibrierrunden noch nicht angefasst haben? | **Ja, und er ist der größte Einzelposten: der Reaktions-/Läufer-Kanal (S-c + R-2 + K-D) kostet rho.** Dosis-Wirkungs-Kurve über vier Stufen, paarweise monoton: Reaktion **aus** +0,029, halbiert +0,012, Ist-Stand 0, **immer** −0,024. | s. 2 |
| D | Zweiter Interaktionseffekt | **Ja: die Nachfüllfolge hebelt die kalibrierte Rätselart-Verteilung aus.** Sie gilt nur in Tick 0. Bis Tick 7 driftet die liegende Punktmasse von 41,9/35,5/22,6 auf **39,8/28,1/32,1 %**; tatsächlich vergeben werden über das Spiel **44,7/32,0/23,3 %** gegen den Anspruch 37,6/36,5/25,9. | s. 3 |
| E | Dritter Befund: Chris' Mehrwege-Leitlinie ist mechanisch fast tot | Der Nebenweg wird in **3,71 %** aller Züge genutzt. Der Punktabschlag 0,65 verlangt, dass der Nebenweg **mehr als 1,54-mal** so gut ist wie der Primärweg — das kommt kaum vor. | s. 4 |
| F | **Chris' gewichteter Randomizer** | **Ergebnisoffen geprüft, gemessen, und klar zu verwerfen — in der Form „zufällige Spawn-Orte".** Prototyp gebaut (spiegelsymmetrisch, Multimenge unverändert, deterministisch aus der Saat): rho **0,730 → 0,680**, paarweise **5 von 5 Paarungen schlechter**; Budget-Pp **10,8 → 27,8** (über der 25er-Schranke); Spiegeltest **53,5:46,5 → 66,5:33,5** (Korridor 45–55 gerissen). | s. 5 |
| G | Was stattdessen für Vielfalt/Wiederspielwert? | **Vielfalt ins Bild, nicht in die Mechanik** (drei Raumthemen über dieselben Koordinaten) plus **Vielfalt über die Truhen-Identität statt über die Position** (Mehrwege-Paarung je Saat rotieren). Kostet rho nichts, weil keine Zahl sich bewegt. | s. 5.5 |
| H | Erreicht irgendeine Einzelmaßnahme die 0,80? | **Nein.** Bester gemessener Stapel (Reaktion aus + Punkte als Erwartungswert + Spüren als Abschlag statt Tor): rho **0,766**, Kader-Spannweite 0,221 → **0,144**. Die Schranke bleibt ~0,035 entfernt. | s. 6 |

**Die eine Zahl, die am meisten entscheidet.** Die Zerlegung `rho(Spiel) = rho(Saison) · √Verlässlichkeit`
(CLAUDE.md), rückwärts gerechnet als `Verlässlichkeit = (rho(Spiel)/rho(Saison))²`, im Vergleich
aller gemessenen Bühnen:

| Disziplin | rho je Spiel | rho Saison (Validität) | **Verlässlichkeit** |
|---|---:|---:|---:|
| showcase | 0,895 | 0,930 | **0,926** |
| wettessen | 0,876 | 0,930 | **0,887** |
| speed-schach | 0,897 | 0,965 | **0,864** |
| gewichtheben | 0,851 | 0,937 | **0,825** |
| Hockey (CLAUDE.md, Feldspieler) | 0,712 | 0,820 | **0,755** |
| **i-spy** | **0,730** | **0,902** | **0,655** |

(Bühnen bei n=48 je Paarung gemessen, i-spy zusätzlich bei n=24 — die Tabellenzeile oben ist der
n=24-Stand, der auch in `miss-alle-disziplinen.mjs` steht; bei n=48 liest i-spy 0,716/0,839, also
Verlässlichkeit 0,728. Die Reihenfolge ändert sich dadurch nicht: i-spy ist in jeder Ablesung die
unzuverlässigste Bühne und zugleich eine der validesten.)

**Das dreht die übliche Diagnose um.** CLAUDE.md liest die zwei Spalten so: „Ist die Saisonzahl hoch
und die Einzelspielzahl niedrig, belohnt die Mechanik das Richtige, aber zu laut — dann fehlen
EREIGNISSE, nicht Rezepte." Genau dieser Fall liegt vor. **Und trotzdem hilft die Uhr nicht** (B),
weil die Lautstärke nicht aus zu wenigen Ereignissen kommt, sondern aus **drei Kanälen, die einem
Spieler große Beträge nach Kriterien zuteilen, die nicht seine eigene Eignung sind.** Das ist die
eigentliche Nachricht dieses Gegenchecks: **die nächste I-Spy-Runde ist keine Zahlen-Kalibrierung
mehr, sondern eine Kanal-Entscheidung.**

---

## 1. Teil 1 — die Zwei-Größen-Rechnung, nachgerechnet

### 1.1 Der Ist-Stand, verifiziert

```
node scripts/miss-alle-disziplinen.mjs 24 i-spy
i-spy   buehne   12   rho je Spiel 0.730 (Spw 0.221)   rho Saison 0.902 (Spw 0.168)   knapp
```

Daraus `Verlässlichkeit = (0,730/0,902)² = 0,655`.

Die Aufgabenstellung nannte 0,591 — das ist `rho(Spiel)²/rho(Saison)`. Die Formel aus CLAUDE.md
lautet `rho(Spiel) = rho(Saison)·√Verlässlichkeit`, also `Verlässlichkeit = (rho(Spiel)/rho(Saison))²`.
Gegenprobe an Hockey: (0,712/0,820)² = 0,754 gegen die in CLAUDE.md genannten 0,755 — die Formel
trägt. **0,655, nicht 0,591**, ist die richtige Zahl. An der Diagnose ändert das nichts, an der
Rechnung „wie weit ist es noch" schon: für rho 0,80 bei Validität 0,902 braucht es
`(0,80/0,902)² = 0,787` Verlässlichkeit — ein Sprung von 0,655 auf 0,787, also **+0,13**,
nicht +0,12 oder +0,20.

Zur zweiten Abnahme (CLAUDE.md, „die ehrlichere Abnahme fragt nach dem Star und nach der
Paartreue"):

```
node scripts/miss-star-paartreue.mjs 24 i-spy
Star Rang1 40.8%   Top2 60.0%   Letzter 0.0%   Paartreue(>=15) 93.0% (n=3271)
G1*: (a) rho Saison>=0,85 OK  (b) Star Rang1>=50%+Top2>=75% NEIN  (c) nie Letzter OK  (d) Paartreue>=95% NEIN
```

Zum Vergleich Hockey (CLAUDE.md): Star Rang 1 **58 %**, Top 2 **78 %**. I-Spy liegt mit 40,8/60,0
**unter** der Disziplin, die das Projekt als Negativbeispiel führt. Die „ehrlichere" Abnahme rettet
I-Spy also nicht — sie bestätigt den Befund aus einer zweiten Richtung.

**Eine Paarung trägt die halbe Spannweite.** `piratecrew-raginglunatics` liest rho 0,577, Star Rang 1
16,7 %, und hat nur **284** Spielerpaare mit ≥ 15 Eignungspunkten Abstand — gegen 834/853 bei den
mittleren Paarungen. Das ist ein Kader, in dem nach CLAUDE.mds eigenem Maßstab wenig zu ordnen ist
(„Paare unter zwei Punkten Abstand kann kein Motor der Welt ordnen"). Ohne diese Paarung läge der
Median bei ~0,73 statt 0,730 — der Median bewegt sich nicht, aber die **Spannweite 0,221** ist zu
großen Teilen diese eine Paarung. **Für jede künftige Kalibrierung heißt das: paarweise vergleichen,
nicht Mediane.** Alle Vergleiche unten sind deshalb paarweise (gleiche Paarung, gleiche Saaten).

### 1.2 Die Uhr: gemessen, und sie ist es nicht

| Variante | rho je Spiel (Median) | rho Saison | Verlässlichkeit | paarweises Δ rho | Paarungen besser |
|---|---:|---:|---:|---:|---:|
| **Ist-Stand `main`** | **0,730** | 0,902 | 0,655 | — | — |
| 12 Ticks statt 8 (mit Reaktion aus) | 0,767 | 0,839 | 0,836 | +0,041 | 4/5 |
| **16 Ticks statt 8** | **0,737** | 0,860 | 0,734 | **+0,021** | 4/5 |
| 16 Ticks + Reaktion aus | 0,765 | 0,832 | 0,846 | +0,054 | 5/5 |
| 24 Ticks + Reaktion aus | 0,762 | 0,867 | 0,772 | +0,063 | 5/5 |

Die Verdopplung der Ereigniszahl hebt die Verlässlichkeit um **+0,079** (0,655 → 0,734) und kostet
zugleich **0,042 Validität** (0,902 → 0,860). Netto bleibt **+0,021 rho** — ein Zehntel der
Kader-Spannweite. Das ist exakt die Hockey-Kurve aus CLAUDE.md („Verlässlichkeit 0,755 → 0,85 und
rho blieb bei 0,719 / 0,721 / 0,723"). **Die Uhr ist auch in I-Spy kein Hebel**, obwohl die Diagnose
„zu wenig Ereignisse" hier auf den ersten Blick passt.

Warum die Validität bei mehr Ticks fällt, ist nachvollziehbar und ein eigener kleiner Befund: mehr
Ticks heißt mehr Nachfüll-Durchläufe, und die Nachfüllfolge zieht die Rätselart-Verteilung von ihrem
kalibrierten Startzustand weg (Abschnitt 3). Wer die Tickzahl anfassen will, muss vorher das
Nachfüllen reparieren.

### 1.3 Wo die Varianz wirklich sitzt — drei Isolationsmessungen

Jede dieser Varianten lässt den `rr()`-Verbrauch unverändert und fasst genau einen Kanal an.

| Variante | rho je Spiel | rho Saison | Verlässlichkeit | paarweises Δ | Paarungen besser |
|---|---:|---:|---:|---:|---:|
| Ist-Stand | 0,730 | 0,902 | 0,655 | — | — |
| **Punkte = Erwartungswert** (Ausgang bleibt gewürfelt, nur die Auszahlung ist geglättet) | 0,752 | 0,895 | 0,706 | **+0,027** | **5/5** |
| **Keine Fundort-Konkurrenz** (`belegt` abgeschaltet, jeder nimmt unabhängig sein EV-Maximum) | 0,660 | 0,867 | 0,579 | **−0,065** | 0/5 |
| **Jeder sieht alles** (Spürwurf ohne Wirkung) | 0,636 | 0,741 | 0,737 | −0,030 | 2/5 |
| Punktwerte flacher: 10/20/35 statt 10/25/60 | 0,715 | 0,853 | 0,702 | −0,037 | 1/5 |
| Punktwerte sehr flach: 10/18/28 | 0,703 | 0,846 | 0,691 | −0,042 | 2/5 |

Drei Dinge fallen daraus, und alle drei sind für die parallel laufende Kalibrierrunde relevant:

- **Das Knackwürfeln ist NICHT der Engpass.** Selbst eine vollständig deterministische Auszahlung
  (der Spieler bekommt immer den Erwartungswert seines Versuchs) bringt nur **+0,027** und hebt die
  Verlässlichkeit gerade auf 0,706 — weit unter den 0,787, die für die Schranke nötig wären.
  **Das ist das gesamte Budget, das im Würfel steckt.** Wer dort weiter kalibriert (2RN, Teilpunkte,
  Fortschritt), holt sich höchstens diese 0,027, und der größte Teil davon ist schon gehoben
  (`ISPY_TEILPUNKTE_ANTEIL=0.40` tut genau das).
- **Die Fallhöhe 10/25/60 ist kein Fehler, sondern Signal.** Beide Abflachungen verschlechtern rho,
  paarweise, beide Male. Der Tresor ist der Kanal, über den der Star sich absetzt (Konzept 1.4:
  „der Tresor lohnt sich für den Starken vierfach"). **Punktwerte abflachen ist keine Reserve,
  sondern ein Rückschritt** — anders, als Konzept 6.2 („Deshalb gehört der Punktwert-Abstand zu den
  ersten Kalibrierschrauben") vermutete. Dieser Satz im Konzept ist gemessen widerlegt.
- **Die Konkurrenz um Fundorte trägt rho, sie kostet ihn nicht.** Ohne `belegt` bricht rho um 0,065
  ein. Die kalibrierte Reihenfolge (`ISPY_REIHENFOLGE_NERVEN_ANTEIL=0.3`, also 30 % NERVEN + 70 %
  mittlere Knack-Kompetenz) ist ein **Eignungskanal**, kein Rauschkanal. Die Kalibrierrunde vom
  22.09. hat hier das Richtige getan.

---

## 2. Der Interaktionseffekt, den noch niemand angefasst hat: S-c + R-2 + K-D kostet rho

### 2.1 Die Dosis-Wirkungs-Kurve

`ISPY_REAKTION_BASIS`/`ISPY_REAKTION_TEAMGEIST_K` (`engine.js:14495`) steuern, wie oft eine Seite auf
einen sichtbaren fremden Fund reagiert. Vier Stufen, alles andere unverändert, `rr()`-Verbrauch
identisch (der Wurf wird in jeder Variante gezogen):

| Reaktionsrate | rho je Spiel | rho Saison | Verlässlichkeit | paarweises Δ rho | Paarungen besser |
|---|---:|---:|---:|---:|---:|
| **0 %** (`BASIS=0`, `K=0`) | **0,752** | **0,916** | 0,674 | **+0,029** | 4/5 |
| ~30 % (`BASIS=0,15`, `K=0,003`) | 0,721 | 0,902 | 0,640 | +0,012 | 3/5 |
| **60 % (Ist-Stand)** | 0,730 | 0,902 | 0,655 | 0 | — |
| 100 % (`BASIS=1`, `K=0`) | 0,700 | 0,867 | 0,652 | −0,024 | **0/5** |

Gemessen: in 60,2 % aller Seiten-Ticks feuert die Reaktion, **4,82 Läufer je Seite je Spiel**
(Korridor 6.4 nennt 3–5 — der Ist-Stand liegt an der Oberkante). Kein einziger Läufer-Wurf verpuffte
mangels Kandidaten.

Die Kurve ist **monoton** und über vier Stützstellen konsistent: mehr Reaktion, weniger Rangtreue.
Zwischen „aus" und „immer" liegen **0,052 rho** — das ist fast das Doppelte dessen, was die gesamte
Kalibrierrunde vom 22.09. gebracht hat (0,700 → 0,730), und es zeigt in die andere Richtung.

Die Sternmessung bestätigt es unabhängig:

| | Ist-Stand | Reaktion aus |
|---|---:|---:|
| Star auf Rang 1 | 40,8 % | 41,7 % |
| Star in den ersten zwei | 60,0 % | **70,0 %** |
| Paartreue (≥ 15 Punkte Abstand) | 93,0 % | **93,8 %** |
| rho Saison | 0,902 | **0,916** |

### 2.2 Warum der Kanal kostet — drei Ursachen, aus dem Code gelesen

**(a) Der Läufer bekommt einen Zug mit hohem Einsatz geschenkt, zugeteilt von fremder Hand.**
Im Läufer-Zweig (`engine.js:14752-14780`) wird der Spürwurf gezogen und **verworfen** (`rr();` ohne
Auswertung, Kommentar: „der Laeufer sucht nicht selbst"). Er steht also ohne Sichtprüfung an einer
Truhe, die per Konstruktion die wertvollste sichtbare der Gegenseite war — meist ein Tresor (60
Punkte). **Ob er diesen Zug bekommt, hängt an zwei Dingen, die beide nicht seine Eignung sind:**
am Reaktionswurf seiner Seite und daran, **ob die GEGNERISCHE Seite im Vortick zufällig einen
sichtbaren Fund produziert hat.** Der zweite Teil ist reines Fremdrauschen — das ist per Definition
ein Verlässlichkeits-Fresser: derselbe Spieler bekommt in Spiel A drei solche Züge und in Spiel B
keinen, ohne dass sich an ihm etwas geändert hätte.

**(b) Das Tor ist ein schwacher Kanal.** `pReaktion = 0,30 + Ø TEAMGEIST · 0,006`, und TEAMGEIST ist
`{spirit:55, charisma:25, awareness:20}`. Spirit korreliert auf dem Abnahmekader mit **r = +0,194**
zur I-Spy-Eignung (erster Gegencheck, Abschnitt 0). Der Kanal verteilt also 60-Punkte-Chancen nach
einem Attribut, das mit der Disziplin-Eignung fast nichts zu tun hat — und zwar als **Seitenmittel**,
nicht individuell. Das ist exakt die Fehlerklasse, an der Takeshis `lesenBonus` gescheitert ist
(erster Gegencheck: „TECHNIK r 0,60, 0,883 → 0,847").

**(c) „Bestgeeignet" wird oft nicht geliefert.** Die Kandidatenliste schließt aus, wer im Vortick
einen Tresor bearbeitet hat (`!u._arbeitetTresor`, `:14683`) — also typischerweise genau den
Bestgeeigneten, weil er über die EV-Wahl (F2) ohnehin am Tresor steht. Gegenprobe: die Sperre
entfernen, damit **immer** der Bestgeeignete läuft — rho 0,721, paarweise **−0,002**. **Nichts.**
Ursache (c) ist also real, aber klein; (a) und (b) dominieren.

Eine vierte, milde Variante — der Läufer muss die Truhe erst mit seiner eigenen
SPÜRSINN-Wahrscheinlichkeit „erfassen" (Faktor `sichtP` auf die Knackchance statt geschenktem
Zugriff) — misst 0,712, paarweise −0,004. Auch das repariert (a) nicht, weil die **Zuteilung** das
Problem ist, nicht die Chance.

### 2.3 Empfehlung zu Abschnitt 2

**Nicht einfach löschen** — die Reaktion ist Chris' ausdrücklicher Wunsch aus der Sprachnachricht
(„das gegnerische Team schickt seinen besten Spieler dahin") und trägt einen großen Teil der
Erzählung. Aber sie muss aufhören, **Punkte** zuzuteilen. Drei Wege, in dieser Reihenfolge zu
messen:

1. **Der Läufer bekommt Information, keinen Zug.** Er macht seinen eigenen, normalen Zug (Spürwurf,
   F2-Wahl), aber die gemeldete Truhe gilt für ihn in diesem Tick als **gesehen** (Stufe 3 ohne
   Wurf sichtbar) — sie ist damit ein zusätzliches *Angebot* in seiner EV-Wahl, kein zugewiesenes
   Ziel. Wer sie ohnehin nicht knacken kann, wählt sie nicht. Das hält den Ticker („Draco sieht den
   Jubel und eilt zum Salon"), den Bühnenbild-Zweig (`r.reaktion`, `stepSchatzsuche()` `:16197`) und
   K-D unverändert und nimmt dem Kanal seine Zuteilungsmacht. **Erwartung: rho zwischen 0,73 und
   0,75, mit intakter Erzählung.** Das ist die einzige Variante, die ich nicht selbst gemessen habe
   (sie braucht eine echte Umbaustelle, kein Ein-Zeilen-Patch) — sie ist deshalb der erste
   Messauftrag der nächsten Runde, nicht eine fertige Empfehlung.
2. **Das TEAMGEIST-Tor fallen lassen** und die Reaktion deterministisch machen (jeder sichtbare
   Fund löst genau eine Reaktion aus, Läufer-Deckel bleibt). Nimmt (b) heraus. Gemessen als
   „100 %" oben: −0,024 — also **nur zusammen mit (1) sinnvoll**, nicht für sich.
3. **Wenn (1) nicht trägt: Reaktionsrate halbieren** (`BASIS=0,15`, `K=0,003`, gemessen +0,012)
   statt den Kanal ganz abzuschalten. Kleiner Gewinn, volle Erzählung, eine Zeile.

Was in jedem Fall in den Rezeptkommentar gehört, nach dem Takeshi-Muster „BEWUSST NICHT GESETZT,
weil gemessen schädlich": die Dosis-Wirkungs-Tabelle aus 2.1. Sie ist der erste harte Beleg dafür,
dass dieser Kanal etwas kostet, und ohne sie wird die Frage in sechs Wochen erneut gestellt.

---

## 3. Der zweite Interaktionseffekt: die Nachfüllfolge hebelt die Kalibrierung aus

### 3.1 Der Befund

`ISPY_NACHFUELL_FOLGE = [2,1,3,2,1,2]` mit `folgePos = idx % 6` (`engine.js:14548`, `:14628`,
`:14825`). Die Folge ist **positionsindiziert und artblind**: welche Stufe nachrückt, hängt nur am
Fundort-Index, nicht an der Rätselart. Gemessen (Sonde in einer instrumentierten Engine-Kopie, 120
Spiele = 24 × 5 Paarungen, 11 197 Züge):

**Punktmasse der liegenden Truhen je Tick** (Mittel über alle Seiten und Spiele):

| Tick | Logik | Verhör | Mechanik |
|---:|---:|---:|---:|
| 0 | **41,9 %** | **35,5 %** | **22,6 %** |
| 1 | 44,2 | 31,2 | 24,6 |
| 2 | 41,5 | 31,7 | 26,8 |
| 3 | 39,4 | 33,1 | 27,5 |
| 4 | 39,2 | 32,3 | 28,5 |
| 5 | 39,1 | 31,2 | 29,8 |
| 6 | 39,1 | 30,2 | 30,7 |
| 7 | **39,8** | **28,1** | **32,1** |

Tick 0 ist exakt das im ersten Gegencheck (Abschnitt 3.4/T5) durchgerechnete und in den
Engine-Kommentar geschriebene Layout. **Ab Tick 1 gilt es nicht mehr.** Über das ganze Spiel
tatsächlich **vergeben** werden:

| Rätselart | vergebene Punkte | Matrix-Anspruch (1.5) | Abweichung |
|---|---:|---:|---:|
| Logik | **44,7 %** | 37,6 % | **+7,1 Pp** |
| Verhör | **32,0 %** | 36,5 % | **−4,5 Pp** |
| Mechanik | **23,3 %** | 25,9 % | −2,6 Pp |

Die Ursache ist im Code direkt abzulesen. Der **Logik-Tresor** steht auf `idx 2`, also `folgePos 2`,
also `FOLGE[2] = 3`: **er wird nach dem Knacken sofort wieder ein Tresor.** Der **Verhör-Tresor**
steht auf `idx 7`, also `folgePos 1`, also `FOLGE[1] = 1`: **er wird nach dem Knacken eine
10-Punkte-Notiz.** Das ist keine Absicht, das ist ein Nebenprodukt von `idx % 6` bei einem Layout,
in dem die beiden Tresore die Indizes 2 und 7 haben.

### 3.2 Derselbe Mechanismus bricht die Spiegelpaare

Die fünf Spiegelpaare aus `ISPY_BLOECKE` bekommen durch `idx % 6` **unterschiedliche**
Nachfüllphasen:

| Spiegelpaar | Indizes | `folgePos` | erste Nachfüllstufe links / rechts |
|---|---|---|---|
| Notizen y=0,30 | 0 / 4 | 0 / 4 | **2 / 1** |
| Akten y=0,18 | 1 / 3 | 1 / 3 | **1 / 2** |
| Notizen y=0,62 | 5 / 9 | 5 / 3 | 2 / 2 |
| Akten y=0,80 | 6 / 8 | 0 / 2 | **2 / 3** |
| Türen y=0,85 | 10 / 11 | 4 / 5 | **1 / 2** |

Vier von fünf Paaren füllen asymmetrisch nach. Der Engine-Kommentar bei `ISPY_BLOECKE`
(`:14560-14561`) sagt ausdrücklich „Immer GANZE Spiegelpaare (nie eine Haelfte), damit der
Spiegeltest bei jeder Kadergroesse strukturell symmetrisch bleibt" — das gilt für den **Startzustand**
und ab Tick 1 nicht mehr. Praktisch ist der Schaden heute klein, weil die Nähe (`naeher`) nur
dritter Tie-Break ist:

```
node scripts/miss-arena-buehne-spiegel.mjs 200 i-spy
Siege links 107, rechts 93 — Punktestand links 1100,18, rechts 1092,11 — Abweichung 0,7 %
```

53,5:46,5 liegt im Korridor 45–55. **Aber es ist eine latente Schwäche**, und Abschnitt 5 zeigt, was
passiert, wenn man sie belastet.

### 3.3 Reparatur — und warum sie für sich allein nichts bringt

Gemessen wurde die naheliegende Reparatur: **jede Position kehrt beim Nachfüllen auf ihre
Ursprungsstufe zurück** (`t.stufeAktuell = t.urStufe`).

| Variante | rho je Spiel | rho Saison | Verlässlichkeit | paarweises Δ | Paarungen besser |
|---|---:|---:|---:|---:|---:|
| Ist-Stand | 0,730 | 0,902 | 0,655 | — | — |
| Nachfüllen positionstreu | 0,727 | 0,804 | **0,818** | +0,011 | 3/5 |

Die Verlässlichkeit springt von 0,655 auf **0,818** — der größte Einzelsprung in dieser ganzen
Messreihe. Und die Validität fällt gleichzeitig von 0,902 auf 0,804, weil ein statischer Raum den
Spielern immer dieselbe Auswahl vorlegt und die EV-Wahl damit ihre Unterscheidungskraft verliert.
Netto: **nichts** (+0,011, innerhalb des Rauschens).

**Das ist trotzdem ein wichtiges Ergebnis, kein Nullergebnis:** es zeigt, dass die Nachfüll-Chaotik
nicht „nur Rauschen" ist, sondern ein echter Validitätskanal — und dass man sie durch einen
**gesteuerten** Kanal ersetzen muss, nicht durch Stillstand. Die richtige Reparatur ist deshalb
**nicht** „immer dieselbe Stufe", sondern **„art-eigene Nachfüllfolgen, deren Punktmasse je Art über
die acht Ticks konstant auf 37,6/36,5/25,9 bleibt"**: die Abwechslung bleibt erhalten, die
Kalibrierung gilt in jedem Tick statt nur im ersten. Das ist eine Datenzeile und eine kleine
Zuweisungsregel, kein Mechanikumbau — und es ist die Voraussetzung dafür, dass die Tickzahl (1.2)
überhaupt erst ein sauberer Hebel wird.

**Empfehlung:** In die laufende Kalibrierrunde aufnehmen, aber als **Verteilungs-Reparatur**
formuliert, nicht als Parametersuche: die Nachfüllfolge je Rätselart so wählen, dass die
Punktmassen-Anteile in jedem Tick innerhalb von ±3 Pp um 37,6/36,5/25,9 bleiben. Gemessen wird mit
der Tick-Tabelle aus 3.1 (die Sonde dafür ist zwanzig Zeilen und gehört nach dem
`showcaseActProbe`-Muster an `window.__arena`).

---

## 4. Dritter Befund: die Mehrwege-Leitlinie ist mechanisch fast tot

CLAUDE.md führt seit dem 21.09. „mehrere Wege zum Erfolg" als **projektweite Design-Leitlinie**, und
I-Spy ist der Präzedenzfall, an dem sie entstanden ist. Gemessen im gebauten Motor:

**Der Nebenweg wird in 415 von 11 197 Zügen genutzt — 3,71 %.**

Der Grund steht in `ispyBesterWeg()` (`:14604-14611`) und ist Arithmetik: der Nebenweg wird nur
gewählt, wenn `p_neben · 0,65 > p_primär`, also wenn er **mehr als das 1,54-fache** der
Primärchance liefert. Bei einer Knackformel, die zwischen 0,08 und 0,95 klemmt und deren Spannweite
über den realistischen Sub-Skill-Bereich rund Faktor 2–3 beträgt, ist das ein enges Fenster. Dazu
kommt, dass es den Nebenweg nur auf Stufe 3 **und** nur an den zwei fest gepaarten Tresor-Positionen
gibt (`truhe.stufeAktuell!==3||!truhe.neben`).

Gemessen, was eine großzügigere Auslegung bringt — Nebenweg auch auf Stufe 2, Punktfaktor 0,80 statt
0,65, alle vier Akten-Paare mit einer Nebenweg-Paarung versehen:

| Variante | rho je Spiel | rho Saison | Verlässlichkeit | paarweises Δ | Paarungen besser |
|---|---:|---:|---:|---:|---:|
| Ist-Stand | 0,730 | 0,902 | 0,655 | — | — |
| Mehrwege auf Stufe 2, Faktor 0,80 | 0,709 | 0,839 | 0,714 | **−0,008** | 2/5 |

**rho-neutral** (−0,008 liegt weit innerhalb der Spannweite 0,221, 2/5 Paarungen besser). Das ist die
eigentliche Nachricht: **die Leitlinie kostet nichts.** Sie wird heute nur nicht eingelöst.

**Empfehlung:** Nebenwege ausweiten (Stufe 2 mit, Punktfaktor auf 0,75–0,80) und die Nutzungsquote
als **eigene Korridor-Kennzahl** führen, neben Knackquote und Tresor-Anteil (Konzept 6.4). Zielwert
als Vorschlag: **10–20 % der Züge über den Nebenweg** — genug, dass ein Spieler ohne das native
Attribut sichtbar „seine eigene Herangehensweise" hat, wenig genug, dass der Primärweg die Regel
bleibt („Primärweg schlägt Nebenweg", Konzept 1.6). Ohne so eine Zahl ist die Leitlinie eine
Absichtserklärung, die im Motor nicht nachweisbar ist — und nach CLAUDE.mds eigener Logik („die
Matrix zu sperren heißt auch: jede Mechanik muss die Gewichte tatsächlich durchreichen") ist genau
das der Punkt, an dem es sonst schiefgeht.

Nebenbefunde aus derselben Sonde, für die Korridor-Tabelle (Konzept 6.4):

| Kennzahl | gemessen | Zielkorridor | |
|---|---:|---|---|
| Knackquote gesamt | 73,1 % (Stufe 1: 85,0 %, Stufe 2: 73,6 %, Stufe 3: 57,5 %) | 50–60 % | **über Korridor** |
| Anteil Tresor-Punkte am Stand | 43,3 % | 30–45 % | Oberkante |
| Züge ohne Ziel („nichts gesehen") | 2,80 % | — | unkritisch |
| Reaktionen je Seite je Spiel | 4,82 | 3–5 | Oberkante |
| Heim:Gast im Spiegeltest | 53,5:46,5 (0,7 % Punktabweichung) | 45:55–55:45 | im Korridor |

---

## 5. Teil 2 — Chris' gewichteter Randomizer für die Spawn-Orte

### 5.1 Was geprüft wurde

Chris' Wortlaut: „vor allem auch mit assets verschiedenen maps unterschiedlichen Orten für die assets
wo sie spawnen — gewichteter randomizer". Das ist mehr als der im Konzept (2.1, Zeile 440–443)
verworfene Vorschlag „drei Räume" — dort war es **dieselbe Multimenge in drei festen Anordnungen**,
hier ist es eine **gezogene Zuordnung**, wo welche Fundort-Art erscheint.

Gebaut wurde die **konservativste denkbare Fassung** — bewusst so, damit ein negatives Ergebnis nicht
an schlechter Umsetzung liegt:

- Die **Multimenge bleibt exakt**: dieselben zwölf Truhen (4 Notizen, 6 Akten, 2 Tresore, 5 Logik /
  3 Verhör / 4 Mechanik). Die matrixproportionale Punktmasse im Startzustand ist damit **per
  Konstruktion unverändert** — ein „gewichteter" Randomizer im strengsten Sinn.
- Die **Positionen bleiben** (dieselben zwölf x/y-Koordinaten); gezogen wird nur, **welcher Inhalt
  an welcher Position liegt**.
- Gezogen wird **blockweise**: die fünf Spiegelpaar-Inhalte werden untereinander permutiert, die
  zwei Mittelachsen-Inhalte untereinander. Ein Spiegelpaar wird nie aufgetrennt.
- **Beide Seiten bekommen dasselbe Layout** (eine Ziehung in `baueSchatzsuche()`, an beide
  `ispyBaueRaum()`-Aufrufe durchgereicht).
- **Deterministisch aus der Saat**, fester `rr()`-Verbrauch (6 Züge, Fisher-Yates mit fester
  Schleifenlänge) — Handbuch-Falle 17 eingehalten.

### 5.2 Frage 1 — technische Machbarkeit

**Unproblematisch, und die Architektur trägt es bereits.** `ispyBaueRaum(art, teilnehmer)`
(`:14622`) liest `art.fundorte` genau einmal und baut daraus den veränderlichen Truhen-Zustand. Ein
Randomizer ist eine Funktion `ispyZieheLayout(art) → fundorte[]`, die in `baueSchatzsuche()` **vor**
den beiden `ispyBaueRaum()`-Aufrufen läuft und ihr Ergebnis an beide durchreicht — rund 15 Zeilen,
keine Änderung an `stepBuehne()`, `wert()`, `disziplinProbe()`.

Drei Randbedingungen sind Pflicht, keine davon ist teuer:

1. **Deterministisch aus der Saat, mit festem `rr()`-Verbrauch.** Ja — Handbuch-Falle 17. Ein
   Fisher-Yates mit *fester* Schleifenlänge (immer `n−1` Züge, auch wenn ein Tausch entfällt).
2. **Ein Layout für beide Seiten.** Zwei getrennte Ziehungen würden den Spiegeltest sofort
   zerstören, weil die Seiten den Raum ohnehin nicht teilen (jede Seite hat seit PR 1 ihre eigene
   Kopie — `engine.js:14613-14621`).
3. **Der Bühnenbild-Zweig muss nachziehen.** `bodenSchatzsuche()` (`:16721`) und
   `ispyFundortXY()`/`zeichneSchatzsuche()` lesen heute `art.fundorte` **direkt** und würden ein
   gezogenes Layout nicht sehen: die Möbel stünden falsch. Das gezogene Layout muss also irgendwo
   liegen, wo der Zeichenzweig es findet. Das ist die einzige echte Umbaustelle und der Grund,
   warum die Aufwandsschätzung unten nicht bei „ein halber Tag" landet.

### 5.3 Frage 2 — rho-Wirkung, gemessen

| Variante | rho je Spiel | Spw | rho Saison | Verlässlichkeit | paarweises Δ | Paarungen besser |
|---|---:|---:|---:|---:|---:|---:|
| Ist-Stand | 0,730 | 0,221 | 0,902 | 0,655 | — | — |
| **Randomizer (wie 5.1)** | **0,680** | 0,263 | 0,825 | 0,679 | **−0,073** | **0/5** |
| Randomizer + positionstreues Nachfüllen | 0,689 | 0,252 | 0,872 | 0,624 | −0,033 | 1/5 |

Einzelwerte je Paarung, Ist-Stand gegen Randomizer:

| Paarung | Ist-Stand | Randomizer | Δ |
|---|---:|---:|---:|
| vigilante-armageddon | 0,798 | 0,757 | −0,041 |
| coldsteel-direlegion | 0,728 | 0,591 | **−0,137** |
| goldengladiators-silversoldiers | 0,735 | 0,681 | −0,054 |
| mortalsin-natureswrath | 0,730 | 0,680 | −0,050 |
| piratecrew-raginglunatics | 0,577 | 0,494 | −0,083 |

**Fünf von fünf Paarungen schlechter, mittleres Δ −0,073.** Das ist der konsistenteste negative
Befund der ganzen Messreihe — konsistenter als jeder positive.

**Warum, mechanisch.** Die Aufgabe vermutete zwei mögliche Wirkrichtungen; gemessen ist es die
schlechte, und der Grund ist Abschnitt 3: die Position eines Fundorts ist im Motor **nicht neutral**.
Sie bestimmt über `folgePos = idx % 6`, **welche Nachfüllfolge** dieser Fundort bekommt. Der
Randomizer würfelt damit nicht bloß die Optik, sondern **welche Rätselart in diesem Spiel den
nachwachsenden Tresor erbt** — in Spiel A bleibt Logik acht Ticks lang tresorstark, in Spiel B
Verhör. Das ist Varianz zwischen Spielen, die mit der Eignung keines Spielers etwas zu tun hat, und
sie trifft mit 60 Punkten den größten Einzelbetrag im Spiel. Ein Logik-Spezialist wird dadurch
spielweise zum Star oder zur Randfigur, ohne dass sich an ihm etwas geändert hat.

Der Gegenbeweis steckt in der zweiten Zeile: mit positionstreuem Nachfüllen (also ohne den
Phasen-Lotterie-Effekt) schrumpft der Schaden von −0,073 auf −0,033 — **aber er verschwindet nicht.**
Der Rest kommt aus dem `naeher`-Tie-Break (`:14794`) und aus `ispyAktiveFundorte()`, das bei kleinen
Kadern die Blöcke nach Punktmasse auswählt und bei gezogenem Layout jedes Spiel eine andere Wahl
trifft.

**Es gibt keinen gegenläufigen Positionsbias, der das aufwiegen würde.** Die im Auftrag genannte
Möglichkeit — „ein Fundort ist strukturell immer zuerst erreichbar und verzerrt das Ergebnis" —
besteht in dieser Mechanik nicht: es gibt **keine Wegzeiten**. `naeher` ist der **dritte** Tie-Break
nach Erwartungswert und Knackchance und greift praktisch nie; die Bewegung zum Fundort ist reine
Präsentation (`stepSchatzsuche()`, Phase `gehen`). Alle zwölf Fundorte sind für alle Spieler in
jedem Tick gleich erreichbar. Der Bias, den der Randomizer heilen sollte, existiert nicht — der
Bias, den er verursacht, ist gemessen.

### 5.4 Frage 3 — Budget-Pp

```
node scripts/messe-arena-einfluss.mjs i-spy 12 public/mockups/battle-mode.html   →  10,8 Pp
node scripts/messe-arena-einfluss.mjs i-spy 12 public/mockups/bm-v4zufall.html   →  27,8 Pp
```

| Attribut | Matrix | Ist-Stand | Δ | Randomizer | Δ |
|---|---:|---:|---:|---:|---:|
| intelligence | 18 | 19,7 % | +1,7 | 23,1 % | **+5,1** |
| torment | 17 | 16,3 % | −0,7 | 15,1 % | −1,9 |
| spirit | 13 | 10,1 % | −2,9 | 7,6 % | **−5,4** |
| will | 12 | 12,3 % | +0,3 | 17,2 % | **+5,2** |
| charisma | 9 | 8,5 % | −0,5 | 6,0 % | −3,0 |
| determination | 8 | 10,5 % | +2,5 | 10,7 % | +2,7 |
| speed | 8 | 7,8 % | −0,2 | 5,1 % | −2,9 |
| dexterity | 8 | 9,0 % | +1,0 | 7,9 % | −0,1 |
| awareness | 5 | 4,8 % | −0,2 | 5,9 % | +0,9 |
| health | 2 | 1,2 % | −0,8 | 1,4 % | −0,6 |

**Ja, die Matrix-Proportionalität ist gefährdet — und sie ist in der gemessenen Fassung bereits
gerissen** (27,8 Pp gegen die 25er-Schranke). Und zwar nicht zufällig in irgendeine Richtung,
sondern systematisch: **Logik gewinnt (intelligence +5,1, will +5,2), Verhör verliert
(spirit −5,4, charisma −3,0).** Das ist derselbe Mechanismus wie in 5.3 — der Logik-Tresor sitzt
heute auf der Position mit der guten Nachfüllphase, und der Randomizer verteilt diesen Vorteil
nicht gleichmäßig um, sondern macht ihn zur Lotterie, deren Gewinner über die Saaten hinweg nicht
gleichverteilt ist.

Zwei Einschränkungen, die ich benenne statt zu verschweigen: (i) n = 12 ist nach dem Kopfkommentar
von `messe-arena-einfluss.mjs` **systematisch zu günstig** — die wahren Werte liegen für **beide**
Fassungen höher (die PR-Beschreibung der Kalibrierrunde nennt für den Ist-Stand 18,4 bei n=48 und
14,5 bei n=96); (ii) die Aussagekraft liegt im **paarweisen** Vergleich bei identischem n, nicht im
Absolutwert. Der paarweise Vergleich ist eindeutig: **die Abweichung verzweieinhalbfacht sich.**

Nebenbefund, der Gutes berichtet: der Ist-Stand liest bei n=12 nur **10,8 Pp**, und **power und
stamina lesen exakt 0 %** — die Regel „kein power in irgendeinem Sub-Skill" (erster Gegencheck,
Abschnitt 2.2) hält im gebauten Motor.

### 5.4b Der Spiegeltest — der härteste Einzelbefund

```
node scripts/miss-arena-buehne-spiegel.mjs 200 i-spy <datei>
Ist-Stand:   Siege links 107, rechts  93   Punkte 1100,18 / 1092,11   Abweichung 0,7 %
Randomizer:  Siege links 133, rechts  67   Punkte 1128,30 / 1101,35   Abweichung 2,4 %
```

**66,5 : 33,5.** Der Korridor ist 45–55 (Konzept 6.4). Bei 200 Läufen ist eine Abweichung von 33
Siegen vom Erwartungswert **4,7 Standardfehler** — das ist kein Rauschen.

Das ist umso bemerkenswerter, als beide Seiten **dasselbe** gezogene Layout bekommen. Die Asymmetrie
entsteht trotzdem, weil (a) die Nachfüllphasen innerhalb eines Spiegelpaars verschieden sind (3.2)
und (b) `naeher` die Heimseite zu kleinen x, die Gastseite zu großen x zieht. Im festen Layout heben
sich beide Effekte fast auf (0,7 %); sobald die Inhalte wandern, tun sie es nicht mehr. **Der
Randomizer belastet genau die latente Schwäche aus 3.2, und sie bricht.**

### 5.5 Frage 4 — Aufwand

| Posten | Aufwand |
|---|---|
| `ispyZieheLayout()` + Durchreichen an beide `ispyBaueRaum()`-Aufrufe | ~0,5 Tag |
| Bühnenbild/Bewegung nachziehen (`bodenSchatzsuche()`, `ispyFundortXY()`, `zeichneSchatzsuche()` lesen `art.fundorte` direkt) | ~0,5–1 Tag |
| Sicht-QA (`sondenLauf()`, deterministische Screenshots) über mehrere gezogene Layouts statt eines | ~0,5 Tag |
| Kaderfeste Abnahme (rho, Star/Paartreue, Spiegel, Budget-Pp) **plus** die Gegenmessungen, die die gemessenen Schäden beheben müssten | **≥ 2 Tage, offen** |
| Wenn drei benannte Räume dazukommen (Archiv/Werkstatt/Salon als Bühnenbild) | +1 Tag |

**Grobschätzung 2,5–3 Tage für den Bau — plus eine offene Reparaturschleife**, weil die
Abnahme in der gemessenen Fassung an zwei Schranken scheitert (Pp 27,8 > 25; Spiegel 66,5:33,5
außerhalb 45–55) und rho um 0,073 fällt. Das ist die ehrliche Zahl: nicht „eine PR wie die anderen",
sondern eine PR **mit einem Abbruchkriterium**, und nach dem heutigen Messstand fällt sie hinein.

### 5.6 Frage 5 — eigene Meinung und Gegenvorschlag

**Urteil: die Idee schadet in der Form „zufällige Spawn-Orte" — und sie löst ein Problem, das I-Spy
gar nicht hat.**

Das ist kein Reflex gegen Chris' Idee, sondern das Gegenteil: ich habe sie in ihrer günstigsten
Fassung gebaut (Multimenge unverändert, Spiegelpaare zusammen, ein Layout für beide Seiten) und sie
ist in **drei unabhängigen Abnahmen** durchgefallen — rho (5/5 Paarungen), Budget-Pp (10,8 → 27,8),
Spiegel (0,7 % → 2,4 %, 66,5:33,5). Das Konzept hatte den Vorläufer der Idee schon einmal als
„bewegt gemessen nur innerhalb der Kader-Spannweite" abgelegt; die gewichtete Fassung ist nicht
neutral, sie ist schädlich.

**Der eigentliche Punkt: Chris will Vielfalt und Wiederspielwert. Die sitzen nicht in der Position.**
Ein Spieler sieht in diesem Spiel **keine** Karte im eigentlichen Sinn — es gibt keine Wege, keine
Distanzen, keine Reihenfolge des Erreichens. Zwölf Punkte auf einer Draufsicht, alle jederzeit für
alle verfügbar. **Position ist in I-Spy reine Optik mit einem unsichtbaren mechanischen
Nebeneffekt** (der Nachfüllphase) — also genau die Größe, deren Zufälligmachen keinen Spielwert
schafft und die verborgene Kalibrierung zerstört.

Drei Gegenvorschläge, die dasselbe Ziel erreichen, jeder rho-neutral oder besser:

1. **Vielfalt ins Bild, nicht in die Mechanik — und das ist tatsächlich Chris' „verschiedene
   Maps".** Drei Raumthemen (Archiv / Werkstatt / Salon) über **denselben zwölf Koordinaten und
   demselben Inhalt**, per Saat gewählt: andere Boden- und Wandfarbe, andere Möbel-Primitive, andere
   Ticker-Wörter („entschlüsselt die Karteikarte" / „bricht den Werkzeugschrank auf" / „bringt den
   Gast zum Reden"). **rho-Wirkung exakt null, weil keine gemessene Zahl sich bewegt**, nachweisbar
   als bit-identische Messung wie bei PR 3 und PR 4. Aufwand ~1 Tag, reine `boden*`/`zeichne*`-Arbeit,
   kein Asset-Download nötig (Primitive, wie der ganze Rest). **Das ist die Variante, die ich Chris
   vorschlagen würde**, und sie liefert den Wiedersehenswert, den Takeshis `kurse[]` liefern.
2. **Vielfalt über die Truhen-Identität statt über die Position** — der Randomizer, den die Mechanik
   tatsächlich verträgt: **welche Mehrwege-Paarung** ein Tresor in diesem Spiel trägt, per Saat aus
   den drei möglichen Paarungen gezogen (LOGIK+FINGERFERTIGKEIT / LOGIK+MENSCHENKENNTNIS /
   FINGERFERTIGKEIT+MENSCHENKENNTNIS — die dritte ist im Motor heute ungenutzt, `:13370-13371`
   nennt sie „fuer eine spaetere Runde offen"). Das ist eine offene Frage aus Konzept 1.6/8, sie
   erzeugt echte spielerische Abwechslung („heute komme ich an diesen Tresor ran, letztes Mal
   nicht"), und sie greift **nicht** in Position oder Punktmasse ein. Zusammen mit Abschnitt 4
   (Nebenwege auch auf Stufe 2) wird daraus ein Kanal, der die Mehrwege-Leitlinie aus CLAUDE.md
   sichtbar macht. **Gemessen ist die Ausweitung rho-neutral (−0,008, 2/5 Paarungen besser);** die
   Saat-Rotation der Paarung ist zusätzlich zu messen, aber sie bewegt weniger als die Ausweitung.
3. **Wenn Chris auf wandernden Fundorten besteht: zuerst die Position mechanisch neutral machen.**
   Der Randomizer wird erst dann bewertbar, wenn `folgePos` **nicht mehr am Index hängt** (3.3) und
   der `naeher`-Tie-Break seitenneutral ist. Beides sind die Reparaturen aus Abschnitt 3, beide sind
   ohnehin sinnvoll. Danach ist der Randomizer wahrscheinlich rho-neutral statt rho-schädlich —
   aber „neutral" ist auch dann noch alles, was er sein kann, weil es in dieser Mechanik keinen
   Positionseffekt gibt, den er zum Guten wenden könnte. **Reihenfolge: erst 3.3, dann neu messen,
   dann entscheiden.**

---

## 6. Was zusammen erreichbar ist — und was nicht

Alle Maßnahmen gestapelt, die einzeln paarweise positiv gemessen haben:

| Stapel | rho je Spiel | **Spannweite** | rho Saison | Verlässlichkeit | paarweises Δ | Paarungen besser |
|---|---:|---:|---:|---:|---:|---:|
| Ist-Stand | 0,730 | 0,221 | 0,902 | 0,655 | — | — |
| Reaktion aus | 0,752 | 0,252 | 0,916 | 0,674 | +0,029 | 4/5 |
| Reaktion aus + Punkte = Erwartungswert | 0,767 | 0,228 | 0,916 | 0,701 | +0,042 | 5/5 |
| Reaktion aus + 16 Ticks | 0,765 | 0,242 | 0,832 | 0,846 | +0,054 | 5/5 |
| Reaktion aus + 24 Ticks | 0,762 | 0,213 | 0,867 | 0,772 | +0,063 | 5/5 |
| **Reaktion aus + EV-Punkte + Spüren als Abschlag** | **0,766** | **0,144** | 0,811 | **0,892** | **+0,071** | **5/5** |

(„Spüren als Abschlag": der Spürwurf ist kein Tor mehr, das eine Stufe pro Tick binär sichtbar macht,
sondern ein Faktor `sicht(s)` auf Erwartungswert **und** Knackchance. SPÜRSINN wirkt gleich stark,
nur stetig statt sprunghaft.)

Drei Schlüsse:

- **Keine Kombination erreicht 0,80.** Der beste Stapel landet bei 0,766 und lässt 0,034 offen. Die
  parallel laufende Zahlen-Kalibrierung kann diese Lücke nicht schließen — sie bewegte zuletzt
  0,030 bei einer Kader-Spannweite von 0,221.
- **Die Kader-Spannweite lässt sich halbieren** (0,221 → 0,144). Das ist für die *Messbarkeit* fast
  wichtiger als der Median: bei 0,144 wird eine Rezeptänderung von 0,03 überhaupt erst von Null
  unterscheidbar, und CLAUDE.md macht genau das zur Bedingung.
- **Validität und Verlässlichkeit tauschen sich gegeneinander ein.** Der beste Stapel hebt die
  Verlässlichkeit von 0,655 auf **0,892** — den besten Wert aller gemessenen Bühnen — und zahlt
  0,091 Validität dafür. Das Produkt bleibt hängen. **Wer 0,80 will, muss eine Maßnahme finden, die
  die Verlässlichkeit hebt, OHNE die Validität zu belasten** — und das Einzige in dieser Messreihe,
  was das andeutungsweise tut, ist „Reaktion aus" (Verlässlichkeit +0,019 **und** Validität +0,014).

**Meine Einschätzung zur Gesamtlage, offen gesagt.** I-Spy ist die breiteste Matrix aller zwanzig
Disziplinen (zehn Attribute, das schwerste mit Gewicht 18). Der erste Gegencheck hat gemessen, dass
davon nur zwei Attribute stark mit der Eignung laufen (intelligence r=0,650, will r=0,627) und zwei
matrixschwere praktisch gar nicht (torment r=0,038, spirit r=0,194). Eine Mechanik, die
matrixtreu **und** trennscharf sein soll, muss auf diesem Kader ein Drittel ihres Gewichts an
Attribute hängen, die die Eignungsrangfolge nicht mittragen. **Dass I-Spy 0,902 Validität erreicht,
ist unter diesen Bedingungen bereits ein starkes Ergebnis** — und dass die Einzelspielzahl darunter
bleibt, ist nicht dasselbe Problem wie bei Hockey. Es ist wert, Chris die Frage vorzulegen, ob für
I-Spy die **Star-/Paartreue-Abnahme** (CLAUDE.md: „die ehrlichere Abnahme") die primäre Schranke
sein sollte — mit Zielwerten Star Top 2 ≥ 75 % und Paartreue ≥ 95 %, die 70,0 % / 93,8 % heute
knapper verfehlen als rho die 0,80. Das ist eine **Frage**, keine Empfehlung, die Schranke
aufzuweichen: die Entscheidung gehört Chris, und sie gehört gestellt, bevor noch zwei
Kalibrierrunden 0,03 hinterherjagen.

---

## 7. Empfehlungen, nach Priorität

| # | Maßnahme | Erwartung | Aufwand | Status |
|---|---|---|---|---|
| 1 | **Reaktionskanal umbauen: der Läufer bekommt INFORMATION statt eines zugeteilten Zuges** (2.3, Weg 1). Die gemeldete Truhe gilt für ihn als gesehen, er wählt weiter nach F2. | rho +0,02 bis +0,03, Erzählung und Bühnenbild unverändert | ~1 Tag | zu messen |
| 2 | **Nachfüllfolge je Rätselart, Punktmasse in JEDEM Tick auf 37,6/36,5/25,9 ± 3 Pp** (3.3). | Verlässlichkeit ↑, Kalibrierung gilt wieder; Voraussetzung für jeden Tickzahl-Hebel | ~0,5 Tag + Sonde | zu bauen |
| 3 | **Chris' Randomizer nicht bauen** — stattdessen drei Raumthemen über denselben Koordinaten (5.6, Vorschlag 1). | rho exakt null (bit-identisch nachweisbar), voller Wiederspielwert | ~1 Tag | Entscheidung Chris |
| 4 | **Nebenwege ausweiten (Stufe 2 mit, Faktor 0,75–0,80) + Nutzungsquote als Korridor-Kennzahl 10–20 %** (4). | rho-neutral (gemessen −0,008), löst die CLAUDE.md-Leitlinie endlich ein | ~0,5 Tag | zu bauen |
| 5 | **Punktwerte NICHT abflachen** — im Rezeptkommentar als gemessen schädlich festhalten (1.3). Konzept 6.2 („erste Kalibrierschraube") ist damit widerlegt. | verhindert eine Runde in die falsche Richtung | Kommentarzeile | sofort |
| 6 | **Knackquote in den Korridor bringen**: 73,1 % gegen Zielkorridor 50–60 % (4). | offen — vermutlich rho-neutral, aber der Korridor ist eine Abnahme | ~0,5 Tag | zu messen |
| 7 | **Chris die Frage zur primären Schranke vorlegen** (6, letzter Absatz): rho ≥ 0,80 oder Star-/Paartreue für I-Spy? | verhindert zwei ergebnislose Kalibrierrunden | eine Nachricht | Entscheidung Chris |

**Was ausdrücklich NICHT empfohlen wird:** die Tickzahl anfassen (1.2, +0,021 bei doppelter
Spielzeit), die Punktwerte abflachen (1.3), die Fundort-Konkurrenz lockern (1.3, −0,065), den
Läufer-Deckel/die Tresor-Sperre am Läufer lösen (2.2c, −0,002), und die Spawn-Orte zufällig machen
(5, −0,073 bei 0/5 Paarungen).

---

## Quellen (gemessen oder gelesen, nicht vermutet)

- `public/mockups/battle-mode.engine.js`, Stand `main` 22.09. (`021e1d91`): `BUEHNE_ART["i-spy"]`
  `:13262-13409` (Rezept `:13342-13350`, `fundorte[]` `:13386-13399`); `baueSchatzsuche()`
  `:14832-14856`; `ispySeiteTick()` `:14660-14830` (Reaktionswurf `:14664`, Läufer-Auswahl
  `:14677-14690`, Reihenfolge `:14735-14738`, Läufer-Zweig `:14752-14783`, normaler Zug
  `:14784-14820`, Nachfüllen `:14821-14828`); `ispyBaueRaum()` `:14622-14644`; `ispyBesterWeg()`
  `:14604-14611`; `ispyAktiveFundorte()`/`ISPY_BLOECKE` `:14550-14590`; Konstanten `:14495-14548`;
  `bodenSchatzsuche()` `:16721`; `stepSchatzsuche()` `:16170`; `zeichneSchatzsuche()` `:17309`;
  `bauBuehne()`/`setz()` `:13664-13755`; `disziplinProbe()` `:32788`.
- Gemessen mit: `scripts/miss-alle-disziplinen.mjs 24 i-spy`;
  `scripts/miss-star-paartreue.mjs 24 i-spy`; `scripts/messe-arena-einfluss.mjs i-spy 12 <datei>`;
  `scripts/miss-arena-buehne-spiegel.mjs 200 i-spy <datei>`; sowie einer eigenen
  Verlässlichkeits-/Varianz-Zerlegung und einer instrumentierten Engine-Kopie (Zähler für Züge je
  Stufe/Art, Nebenwegnutzung, Reaktionen, Punktmasse je Tick) über `window.__arena.disziplinProbe`.
  Kader-Familie: `data/generated/kaderfamilie-live-save.json` (live-save „Oly New Game Custom
  19.8.2026", gezogen 2026-09-03), fünf Paarungen, 24 Spiele je Paarung, sofern nicht anders
  angegeben.
- **Alle Messvarianten waren Kopien** (`public/mockups/bm-*.engine.js` / `bm-*.html`), gemessen und
  nach der Messung entfernt. An `main` wurde nichts geändert.
- `docs/design/i-spy-schatzsuche-konzept-21-09.md` (vollständig);
  `docs/design/i-spy-opus-gegencheck-21-09.md` (vollständig, insbesondere Abschnitt 0 —
  Attribut/Eignungs-Korrelationen — und 3.4/3.6);
  `CLAUDE.md` („Die Abnahme jeder Disziplin", „Die Eignungsmatrix ist gesperrt");
  `scripts/lib/rangtreue-messung.mjs`; `docs/design/messgrundlage-kaderfest.md` (Spannweiten-Regel).

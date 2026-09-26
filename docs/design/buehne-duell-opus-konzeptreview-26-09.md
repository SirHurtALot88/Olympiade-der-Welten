# Bühnen-Duell: Konzept-Gegencheck Speed-Schach, Fechten, Tennis (Opus, 26.09.)

**Auftrag:** Unabhängiger Gameplay-/Taktik-Gegencheck der drei Disziplinen, die sich das
Bühnen-Duell-Chassis teilen (`ARENA_BUEHNE_DUELL_DISCIPLINE_IDS`). Frage ist nicht, ob die Zahlen
stimmen — alle drei bestehen rho (Speed-Schach 0,908, Fechten 0,826, Tennis 0,825) —, sondern ob
die Mechanik die taktischen **Entscheidungen** echter Sportarten abbildet oder im Kern ein
Attributsvergleich mit Themen-Beschriftung ist.

**Art des Dokuments:** reines Konzept. Kein Code, keine Rezeptänderung, keine Messung am Motor.
Stand des Codes: `origin/main` @ `254a56c5`. Zeilenangaben beziehen sich auf
`public/mockups/battle-mode.engine.js` in diesem Stand.

**Rahmen, der für jeden Vorschlag gilt (CLAUDE.md):** die Gewichtsmatrix bleibt gesperrt; jede
neue Mechanik muss rho über 0,80 in **einem** Spiel halten **und** die Pp-Abweichung ≤ 25
bestehen. Kein Vorschlag hier ist abgenommen. Wo ein Vorschlag rho gefährden kann, steht es dabei.

---

## 0. Die Antwort in sechs Sätzen

1. **Alle drei sind heute im Kern derselbe abstrakte Attributsvergleich.** Jeder Teilnehmer
   würfelt seine 9–10 Durchgänge allein, bevor sein Gegner überhaupt feststeht; erst danach wird
   die Differenz gebildet. Es gibt keine Wechselwirkung, keinen Spielzustand, keine Entscheidung.
2. **Tennis und Speed-Schach sind mechanisch dieselbe Maschine** mit anderen Rezeptgewichten und
   anderen Wörtern; Fechten unterscheidet sich nur durch 9 statt 10 Durchgänge und einen
   Trefferzähler, der das Ergebnis nicht entscheidet.
3. **Die neue Nahansicht (PR #1025) macht die Lücke sichtbarer, nicht kleiner:** je näher die
   Kamera heranfährt, desto deutlicher sieht man, dass beide Tennisspieler denselben Ballwechsel
   „gewinnen", dass ein Fechter mit weniger Treffern das Gefecht gewinnt, und dass auf dem
   Schachbrett Morphys Opernpartie läuft, egal wer gewinnt.
4. **Die Saat für echte Taktik liegt schon im Repo:** die Slot-Rollen heißen bereits *Serve,
   Return, Net Pressure, Tiebreak Clutch* (Tennis), *Aggressor, Defender, Counter Tempo,
   Technician* (Fechten), *Opening Prep, Clock Pressure, Gambit, Endgame Anchor* (Schach) — sie
   wirken aber nur als flacher Attributszuschlag von höchstens ±8,5, nicht als Spielstil.
5. **Ein Vorbild für einen zustandsabhängigen Paar-Rechner steht im selben Chassis:**
   `baueHebenDuelle()`/`hebeUebung()` (Gewichtheben) lässt den Heber auf den Duellstand reagieren
   (Eröffnungslast, kühner Versuch). Genau dieses Muster fehlt den drei Duellen.
6. **Priorität:** Tennis zuerst (größte Lücke: kein Aufschlag, kein Nullsummen-Punkt, keine
   Zählhierarchie), dann Fechten (billiger Konsistenzfix plus Aktionsrad), dann Speed-Schach
   (Uhr als echte Ressource) — Speed-Schach ist von den dreien heute am ehesten „gut genug".

---

## 1. Was das Chassis tatsächlich rechnet (gilt für alle drei)

### 1.1 Der Durchgangs-Rechner

`bauBuehne()` → `setz()` (Zeilen 14089–14168). Für jeden Teilnehmer **einzeln**, im Moment seiner
Aufstellung, also bevor der Gegner zugeordnet ist:

```
ermued  = 1 − max(0, 60 − AUSDAUER) · 0,0035 · (ri / (rundenN−1))
basis   = (20 + GRUNDLAGE · 0,7) · max(0,4, ermued)
erfolg  = min(0,94, 0,15 + TECHNIK · 0,0055 + NERVEN · 0,0035)
Erfolg:   punkte = basis + SPITZENMOMENT · 0,35 · (0,4 + WAGNIS · 0,006)
sonst:    punkte = basis · failAbzug (0,55)
immer:    punkte += PUBLIKUM · 0,12
```

Danach (Zeilen 14191–14218) werden Brett i Heim und Brett i Gast gepaart und die laufende
Differenz der Punkte als `verlauf`/`vorteil` gespeichert. Ein Brett gewinnt, wer am Ende
`vorteil > 0` hat; das Team gewinnt über die Zahl gewonnener Bretter
(`spieleBuehneDuell`, Zeile 34486). Der Spielerwert für rho ist die **eigene** Punktsumme
(`MOTOREN[bd].wert`, Zeile 33734).

### 1.2 Was daraus folgt

| Eigenschaft einer echten Duell-Sportart | im Chassis vorhanden? |
|---|---|
| Der Gegner beeinflusst, ob meine Aktion gelingt | **nein** — mein Würfel kennt ihn nicht |
| Ein Punkt/Treffer/Zug ist Nullsumme (einer gewinnt, einer verliert) | **nein** — beide würfeln unabhängig |
| Spielzustand (Stand, Uhr, Aufschlag, Stellung) verändert Entscheidungen | **nein** — nur die lineare Ermüdung hängt am Rundenindex |
| Wahl zwischen Handlungsalternativen (Stil, Risiko, Tempo) | **nein** — es gibt nur „Erfolg ja/nein" |
| Verschiedene Spielertypen gewinnen auf verschiedenen Wegen | **nur als Rezeptmischung** — sieben Rollen werden addiert, nicht gewählt |

Das ist keine Kritik an der Entscheidung, *so* anzufangen: `tennis-fechten-rollout-plan.md` A.5
und `arena-duell-recherche-fable.md` 3.4 haben das „naive" Duell ausdrücklich als ersten Schritt
für die Abnahmezahl gewählt und den interaktiven Paar-Rechner als „Ausbaustufe für das
Spielgefühl" zurückgestellt (`fechten-aufwertungsplan-17-09.md` 5.3, Frage 6). Dieses Dokument
ist die Stelle, an der diese Ausbaustufe fällig wird.

Das Chassis bildet in Wahrheit ein **Nebeneinander zweier Solo-Leistungen** ab — wie zwei
Golfer im Matchplay oder zwei Heber an derselben Hantel. Für Gewichtheben und Wettessen ist das
treffend. Für Schach, Fechten und Tennis — die drei am stärksten *interaktiven* Sportarten des
ganzen Katalogs — ist es die schwächste denkbare Passung.

### 1.3 Nachbildung: wie oft die Anzeige der eigenen Logik widerspricht

Eigene Nachbildung der Formel aus 1.1 (Skript im Scratchpad, nicht im Repo; synthetische
Sub-Skills um 60 ± 10, 20 000 Paarungen, **nicht** der echte Motor und **nicht** die
Kaderfamilie — die Größenordnung zählt, nicht die Nachkommastelle):

| Befund | Häufigkeit (Nachbildung) |
|---|---:|
| Fechten: Gefecht-Sieger nach Vorteil ≠ Sieger nach Treffern | **11,4 %** der Gefechte |
| Fechten: Treffergleichstand am Ende (Sieger trotzdem nach Punkten) | 17,4 % |
| Tennis: am selben Ballwechsel-Index „gewinnen" **beide** den Ballwechsel | **46,7 %** |
| Tennis: am selben Index gewinnt **keiner** | 9,8 % |
| Speed-Schach: Uhr läuft ab (≥ 9 von 10 Zügen schwach) | 0,13 % — und selbst dann ohne Folge |
| Speed-Schach: Remis (exakt gleiche Punktsumme) | 0,24 % |
| mittlere Erfolgsquote je Durchgang | 68,7 % |

### 1.4 Die Slot-Rollen versprechen Stile, die es nicht gibt

`lib/lineups/matchday-slot-roles.ts` (Zeilen 161–168, 192–199, 262–269) beschreibt sechs Rollen
je Disziplin mit Texten wie „Greift über Dexterity und Speed an" (Net Pressure) oder „Spielt
Uhrdruck über Will und Speed" (Clock Pressure). Mechanisch ist ein Slot nur
`slotAufschlag()` (Zeile 5459): die Differenz zweier gewichteter Attributsmittel, mal 2,2,
gekappt auf ±8,5, als Zuschlag auf die betroffenen Attribute. Ein „Net-Pressure"-Spieler geht nie
ans Netz, ein „Gambit"-Spieler opfert nie etwas, ein „Defender" pariert nicht öfter als ein
„Aggressor". **Das ist der größte ungenutzte Hebel für „mehrere Wege zum Erfolg"** — die Namen,
die Chris schon sieht, müssten nur Verhalten bekommen (Abschnitt 5).

### 1.5 Die Brettpaarung ist weder Regel noch Entscheidung

`mine` kommt aus `inDisc()` (Zeile 21306), also in **Kaderreihenfolge**, nicht nach Eignung und
nicht nach Slot. Brett 1 Heim trifft Brett 1 Gast, egal wer das ist. Im echten
Mannschaftsschach gilt eine feste Brettreihenfolge nach Spielstärke; im Davis Cup spielen die
Nummern 1 gegeneinander. Die Duett-Fusion bei Eiskunstlauf sortiert bereits ausdrücklich nach
`eig` (Zeile 14261) — die Duelle tun es nicht.

---

## 2. Speed-Schach

### 2.1 Bestandsaufnahme

**Mechanik:** 10 Züge je Spieler, jeder ein unabhängiger Würfel „findet den starken Zug" /
„verliert Zeit am Zug". Rezept (Zeile 13618) folgt der Matrix sauber: intelligence und awareness
tragen GRUNDLAGE/TECHNIK/SPITZENMOMENT, will/determination/speed tragen NERVEN/AUSDAUER.

**Uhr:** `schachUhrWert()` (Zeile 16805) startet bei 180 s und zieht 8 s für einen starken, 20 s
für einen schwachen Zug ab. Sie ist reine Anzeige: sie **folgt** dem Würfel, sie **beeinflusst**
ihn nie. Sie fällt praktisch nie (Nachbildung 0,13 %), und wenn doch, hat das keine Folge.

**Brett:** `SCHACH_PARTIEN` (Zeile 20321) — Brett i spielt eine von sechs historischen Partien
(Opernpartie, Unsterbliche, …), unabhängig vom Ergebnis. Heim ist immer Weiß. Die
Speed-Schach-Recherche (`speed-schach-fable-recherche-12-09.md` 3.3) nennt das ehrlich
„Kulisse": die Uhr-Sekunden und `!`/`?!` sind wahr, die Stellung ist plausibel.

**Was schon gut ist:**
- Das Rezept bildet ab, was Blitzschach verlangt (Mustererkennung + Rechnen vor Tempo), und die
  Rangtreue ist mit 0,908 die beste der drei.
- Die Uhr erzählt die richtige Richtung: wer schwächer spielt, verliert auch mehr Zeit.
- Die Recherche vom 12.09. hat recht: **ein Schachmotor wäre der falsche Aufwand.** Das Ziel ist
  nicht, Züge zu berechnen, sondern die *Ereignisse* einer Blitzpartie abzubilden.
- Mannschaftskampf mit mehreren Brettern ist ein echtes, reales Format (Recherche 12.09., 1.1).

### 2.2 Was fehlt — gemessen an echtem Blitz-/Bulletschach

1. **Zeit ist keine Ressource.** Im Blitz ist die Kernentscheidung *jedes* Zuges: wie lange denke
   ich nach? Mehr Zeit → besserer Zug, aber näher an der Zeitnot. Heute kostet ein Zug Zeit,
   *weil* er schwach war; nie ist ein Zug schwach, *weil* Zeit fehlte.
2. **Die Zeitnot-Schwelle fehlt.** Real kippt der Zusammenhang zwischen Stellung und Ergebnis
   unterhalb von etwa 10–30 s Restzeit scharf; unter 5 s spielt bei starken Spielern die
   Stellung kaum noch eine Rolle (jk_182, Lichess-Blog, schon in der Recherche vom 12.09.
   zitiert). Genau dieser Knick ist *das* Drama des Blitzschachs — und er existiert nur als
   Illustration.
3. **Schach ist nicht additiv.** Eine Partie wird nicht durch die Summe von zehn guten Zügen
   gewonnen, sondern oft durch **einen** Patzer oder **eine** Taktik (Gabel, Fesselung, Spieß,
   Abzug). Das Punktsummen-Modell ist das am wenigsten schachartige Element des Ganzen.
4. **Keine Partiephasen.** Eröffnung (Vorbereitung), Mittelspiel (Taktik), Endspiel (Technik der
   Verwertung) verlangen verschiedene Stärken; heute sind alle zehn Züge gleichartig.
5. **Kein Remis.** 0,24 % sind kein Schach; Remis ist ein normales Ergebnis, besonders zwischen
   Gleichstarken.
6. **Kein Opfer, keine Initiative.** „Materialopfer für Tempo" hat keinen Ort, obwohl die Slot-
   Rolle *Gambit* existiert.
7. **Farben ohne Bedeutung und ohne Wechsel.** Heim ist immer Weiß; im Mannschaftskampf wechseln
   die Farben brettweise, und Weiß hat einen kleinen, realen Anzugsvorteil.

### 2.3 Vorschläge (priorisiert, nur Konzept)

**S1 — Die Uhr wird eine Ressource (Kern-Vorschlag).**
Jeder Zug verbraucht Denkzeit, die aus dem Spieler kommt, nicht aus dem Ergebnis:
- *Qualität je Sekunde* aus intelligence/awareness (wer besser rechnet, braucht weniger Zeit
  für denselben Zug),
- *Zeitverbrauch* aus speed (Bullet-Hände),
- *Zeitnot-Schwelle*: unterhalb einer Restzeit steigt die Patzerchance steil; will/determination
  dämpfen den Anstieg (die Rolle „Clock Pressure" bekommt hier ihren Sinn),
- *Zeitüberschreitung* = Brett verloren.

Eine einfache Taktikregel für den simulierten Spieler: *wer in der Stellung zurückliegt, aber mehr
Zeit hat, spielt schneller und komplizierter* — genau die reale Blitz-Praxis („Züge, die die
Stellung verkomplizieren, lohnen sich gegen einen Gegner in Zeitnot"). Damit entsteht ein
**Nebenweg**: ein schneller Spieler mit mittlerer intelligence kann einen stärkeren Rechner über
die Uhr schlagen — genau das Primär-/Nebenweg-Muster der Design-Leitlinie.
*rho-Risiko:* mittel. Die Zeitnot-Schwelle ist ein Nichtlinearitäts- und damit Rauschhebel; der
Spielerwert sollte die Zugqualität messen, nicht nur das Brettergebnis.

**S2 — Die Stellungsbewertung ist Zustand, nicht Summe.**
Der Bewertungsbalken existiert bereits in `zeichneSchach()`. Er wird zur eigentlichen Größe: jeder
Halbzug verschiebt ihn (klein bei normalen Zügen, groß bei zwei benannten Ereignissen):
- **Taktik** (Gabel/Fesselung/Spieß/Abzug, awareness-getrieben, im Ticker mit Namen),
- **Patzer** (steigt in Zeitnot, sinkt mit will/determination).
Überschreitet der Balken eine Schwelle, ist das Brett entschieden (Aufgabe/Matt); steht er am
Ende nahe null, ist es **Remis**. Die Bühnen-Anzeige, die heute schon „Vorteil" heißt, bekäme
damit ihre echte Bedeutung.

**S3 — Drei Phasen statt zehn gleichartiger Züge.**
Züge 1–3 Eröffnung (Vorbereitung: intelligence + awareness; Slot *Opening Prep*), 4–7
Mittelspiel (Taktik: awareness; *Pattern Read*, *Calculation Core*), 8–10 Endspiel (Verwertung:
will + determination; *Endgame Anchor*). Das ist die billigste Variante: die sieben Rezeptrollen
bleiben, nur ihr Gewicht wechselt mit der Phase. Macht die Slot-Rollen erstmals zu Zeitpunkten.

**S4 — Gambit als Wagnis-Entscheidung.**
Ein Spieler mit Slot *Gambit* (oder im Rückstand) kann Bewertung gegen **Initiative** tauschen:
kurzfristig schlechter stehen, dafür steigt in den nächsten Zügen die Patzerchance des Gegners —
besonders, wenn dieser in Zeitnot ist. Nebenweg für charisma/speed-Typen.

**S5 — Brettreihenfolge und Farben nach Mannschaftskampf-Regel (billig).**
Bretter nach Eignung ordnen (stärkster an Brett 1, wie im Mannschaftsschach), Farben brettweise
wechseln (Brett 1/3/5 Heim Weiß, 2/4/6 Gast Weiß). Ein kleiner Anzugsvorteil für Weiß ist
optional — er wäre realistisch, bringt aber ein Rauschen, das nichts mit Eignung zu tun hat.

**S6 — Kulisse an das Ergebnis koppeln (niedrige Priorität).**
Die gezeigte Partie so wählen, dass die Farbe des Siegers auch am Brett gewinnt (Auswahl aus
einem größeren Partienpool nach Ausgang). Rein zeichnerisch, rho-neutral.

**Einordnung:** Speed-Schach ist von den dreien die ehrlichste Kulisse und die sauberste Zahl.
Wenn nur eine der drei Disziplinen in dieser Runde *nicht* angefasst wird, dann diese. Wird sie
angefasst, dann S1 (+ S5), weil die Uhr das eine ist, was Blitzschach von Schach unterscheidet.

---

## 3. Fechten

### 3.1 Bestandsaufnahme

**Mechanik:** 9 Gänge in drei Perioden (`rundenN:9`, Zeile 13924), jeder Fechter würfelt jeden
Gang unabhängig „setzt den Treffer" / „kommt zu spät". Rezept (Zeile 13965) torment/dexterity/
awareness in GRUNDLAGE und TECHNIK, speed in SPITZENMOMENT/WAGNIS/AUSDAUER.

**Waffe:** bewusst **Degen**, damit keine Vorfahrtsregel nötig ist (Kopfkommentar Zeile 13886,
`tennis-fechten-rollout-plan.md` C.2). Das ist **sportlich legitim**: Degen kennt real keine
Vorfahrt, Doppeltreffer zählen für beide.

**Trefferstand:** `u.treffer` zählt die eigenen Erfolgs-Gänge, wird angezeigt („Treffer 5:4",
Kopfzeile Zeile 18403), entscheidet aber **nichts** — das Gefecht entscheidet `vorteil`, die
Punktdifferenz (Zeile 15878 ff.). Punkte gibt es auch für „kommt zu spät" (`basis · 0,55` plus
PUBLIKUM).

**Präsentation:** `stepFechten()` (Zeile 16878) animiert Ausfall, Erholung und eine **Parade des
Gegners, wenn der Angreifer scheitert** — abgeleitet, nicht gerechnet. Tauzieh-Versatz schiebt den
Führenden sichtbar vor.

**Was schon gut ist:** Chassis-Wahl (1 gegen 1 statt Arena), die Degen-Entscheidung, die
Perioden-Gliederung (FIE-Analogie), der Tauzieh-Versatz als Führungsbild, ein Rezept, das die
Matrix (torment vor dexterity vor speed/awareness) trägt.

### 3.2 Was fehlt — gemessen an echtem Degenfechten

1. **Der Stand widerspricht sich selbst.** Im Fechten *ist* der Trefferstand das Ergebnis. Heute
   gewinnt in rund jedem neunten Gefecht der Fechter mit **weniger** Treffern (Nachbildung 1.3:
   11,4 %), und bei Trefferstand-Gleichstand (17,4 %) entscheiden unsichtbare Punkte. Das ist
   der auffälligste Einzelfehler der drei Disziplinen, und die neue Nahansicht zeigt ihn groß.
2. **Kein Aktionsduell.** Ein Gang besteht real aus einer Phrase, in der *einer* die Initiative
   hat und der andere reagiert. Die realen Anteile im Degen: 44,9 % offensive, 33,0 % defensive,
   22,1 % gegenoffensive Aktionen, und ein Drittel der Gegenangriffe trifft
   (Tarragó & Iglesias 2016, zitiert in `arena-duell-recherche-fable.md` 3.2). Heute greifen beide
   Fechter in jedem Gang unabhängig an; die „Parade" ist nur das Spiegelbild eines Fehlwurfs.
3. **Keine Finte, kein Tempowechsel, keine Distanz.** Die klassische Fechttaktik ist ein
   Kreislauf: der einfache Angriff wird durch Parade-Riposte beantwortet, die Parade durch die
   Finte (zusammengesetzter Angriff), der zusammengesetzte Angriff ist anfällig für den
   Gegenangriff (Wikipedia, *Fencing tactics*), der Gegenangriff wird durch den entschlossenen
   Angriff bzw. Contre-temps (zweite Absicht) bestraft. Genau dieses „Schere-Stein-Papier mit
   Attributen" macht Fechten taktisch — es fehlt vollständig.
4. **Keine standabhängige Taktik.** Die typischste Degen-Taktik überhaupt: **wer führt, sucht den
   Doppeltreffer** (beide Punkte zählen, der Vorsprung bleibt, die Zeit läuft ab), wer
   zurückliegt, muss sie vermeiden und selbst angreifen. Dazu: Dichte und Wirksamkeit der
   Aktionen steigen in den letzten 10 Sekunden (Tarragó & Iglesias).
5. **Vorfahrt: bewusst nicht vorhanden — und das ist richtig.** Die Frage „hat Fechten einen
   Prioritätsmechanismus?" ist für den Degen mit **nein** korrekt beantwortet. Die einzige Stelle,
   an der der Degen Priorität kennt, ist der Gleichstand nach Ablauf der Zeit: eine
   Zusatzminute, Priorität per Los, bei ausbleibendem Treffer gewinnt der Fechter mit Priorität.

### 3.3 Vorschläge (priorisiert, nur Konzept)

**F1 — Treffer sind der Stand (billig, sofort).**
Das Gefecht gewinnt, wer mehr Treffer hat. Bei Gleichstand: Zusatzgang mit Priorität per Los
(die echte Degen-Regel, s. 3.2 Punkt 5) — damit hat Fechten auch einen, sportlich richtigen,
Prioritätsmoment. Die Punkte bleiben als **Aktionsqualität** der Messwert für rho (sie messen,
wie gut ein Fechter gefochten hat, nicht wer gewonnen hat); im Ticker/der Tabelle heißen sie
dann auch so, statt als „Vorteil" mit dem Trefferstand zu konkurrieren. Ein „kommt zu spät" ist
dann kein Punktgewinn mehr, sondern eine schwächere Aktion.
*rho-Risiko:* gering, solange `wert()` die eigene Aktionsqualität bleibt; nur der
Brettausgang ändert sich. Das Brettergebnis selbst wird etwas lauter (Treffer sind gröber als
Punkte) — für die Teamwertung zu prüfen, nicht für rho.

**F2 — Jeder Gang ist ein Aktionsduell (Kern-Vorschlag).**
Je Gang:
1. *Initiative* — wer die Distanz kontrolliert und die Phrase eröffnet (speed + awareness).
2. *Aktionswahl* beider Fechter aus vier Aktionen, jede mit ihrem Attribut-Primärweg:
   | Aktion | trägt vor allem | schlägt | wird geschlagen von |
   |---|---|---|---|
   | einfacher Angriff | speed, torment | Gegenangriff (mit Contre-temps) | Parade-Riposte |
   | Finte / zusammengesetzter Angriff | dexterity, intelligence | Parade-Riposte | Gegenangriff |
   | Parade-Riposte | awareness, dexterity | einfacher Angriff | Finte |
   | Gegenangriff (Stoß ins Tempo) | speed, torment | Finte | einfacher Angriff |
3. *Auflösung* als logistische Chance aus der Attributsdifferenz der gewählten Aktionen plus
   einem **kleinen** Passungsbonus aus der Tabelle; im Degen ist ein beidseitiger Treffer
   (Doppeltreffer) möglich, wenn beide offensiv handeln.

Die Aktionswahl kommt aus zwei Quellen: der **Slot-Rolle als Neigung** (*Aggressor* →
einfacher Angriff, *Technician* → Finte, *Defender* → Parade, *Counter Tempo* → Gegenangriff,
*Final Touch* → Endphasen-Druck) und dem **Lesen des Gegners** (awareness: wer dieselbe Aktion
wiederholt, wird berechenbar, der Gegner stellt sich darauf ein — „zweite Absicht").
Das ist der direkte Anschluss an `arena-duell-recherche-fable.md` 3.4 (Paar-Rechner mit
Elo-artiger Kurve) — nur mit Aktionen statt eines einzigen Angriff-gegen-Abwehr-Vergleichs.
*rho-Risiko:* mittel bis hoch. Ein Schere-Stein-Papier-Anteil ist per Definition eignungsfremdes
Rauschen; der Passungsbonus muss klein bleiben, damit das Attribut entscheidet und die Wahl nur
kippt, wenn die Attribute nah beieinander liegen (dort, wo CLAUDE.md sagt, dass ohnehin kein
Motor ordnen kann). Pp-Prüfung besonders auf speed und torment, die dann in zwei Aktionen sitzen.

**F3 — Standabhängige Taktik (billig, sobald F1 steht).**
Führender Fechter: defensiver, Doppeltreffer willkommen. Zurückliegender: mehr Angriffe, mehr
Risiko. In der letzten Periode steigt die Aktionsdichte (mehr, aber riskantere Aktionen). Genau
das Muster von Gewichthebens „kühnem Versuch" (Zeile 14496 ff.), nur je Gang statt je Versuch.
Macht den Tauzieh-Versatz zu einer Geschichte statt zu einer Anzeige.

**F4 — Waffenart (niedrigste Priorität, eher nicht).**
Florett und Säbel mit echter Vorfahrt wären nur mit F2 sinnvoll (man muss wissen, wer die
Aktion eröffnet hat). Säbel wäre ein speed-Spektakel, Florett ein Technikduell — beides würde
den Einfluss der Attribute gegenüber der gesperrten Matrix verschieben und damit die
Pp-Abnahme belasten. Empfehlung: Degen bleiben lassen, Vorfahrt nur als Gleichstands-Regel (F1).

---

## 4. Tennis

### 4.1 Bestandsaufnahme

**Mechanik:** 10 „Ballwechsel" je Spieler, unabhängig gewürfelt: „gewinnt den Ballwechsel" /
„vergibt den Punkt". Rezept (Zeile 13871) nach der Kalibrierung vom 07.09. auf die Matrix
nachgezogen (intelligence/awareness/spirit vorn, stamina in AUSDAUER).

**Präsentation:** `stepTennis()` (Zeile 16994) spielt bei **jeder** Enthüllung den Ton
„aufschlag" und dann „ass" oder „netz"; `zeichneTennis()` lässt den Ball zum Gegner fliegen
(Erfolg) oder auf halber Strecke liegen bleiben (Fehlschlag). Jeder Ballwechsel wird also als
Aufschlag dargestellt, den nur einer der beiden spielt.

**Was schon gut ist:** der Chassis-Wechsel weg vom Feldspiel (Tennis ist real ein alternierendes
1-gegen-1), die Rezeptkalibrierung, die neue Nahansicht mit Ballflug, die Slot-Rollen, die
schon genau die richtigen Tennis-Begriffe tragen.

### 4.2 Was fehlt — gemessen an echtem Tennis

1. **Der Punkt ist keine Nullsumme.** Im Tennis gewinnt jeden Punkt genau einer. Heute
   „gewinnen" an fast jedem zweiten Ballwechsel-Index beide (Nachbildung 1.3: 46,7 %), an jedem
   zehnten keiner. Das ist mit der neuen Nahansicht direkt zu sehen.
2. **Kein Aufschlag.** Der Aufschlagvorteil ist *die* Grundstruktur des Tennis: auf der ATP-Tour
   werden Aufschlagspiele auf Hartplatz zu etwa 78–81 % gehalten, auf Rasen 82–85 %, auf Sand
   74–77 %; Breakbälle werden im Schnitt zu rund 40 % verwandelt (s. Quellen). Heute gibt es
   weder Aufschläger noch Rückschläger — obwohl der Ton „aufschlag" bei jedem Durchgang läuft und
   Slots *Serve* und *Return* heißen.
3. **Keine Zählhierarchie.** Punkt → Spiel → Satz verstärkt kleine Punktvorteile zu klaren
   Matchergebnissen und erzeugt die großen Momente (Breakball, Satzball, Tiebreak). Heute gibt es
   nur eine laufende Punktdifferenz.
4. **Keine großen Punkte.** Real sind Punkte fast, aber nicht ganz unabhängig: an wichtigen
   Punkten gewinnt der Aufschläger seltener, und schwächere Spieler sind davon stärker betroffen;
   ein gewonnener Punkt erhöht leicht die Chance auf den nächsten (Klaassen & Magnus 2001,
   ~90 000 Wimbledon-Punkte). Der NERVEN-Kanal wirkt heute auf jeden Punkt gleich — also auf
   keinen besonders.
5. **Keine Spielstile.** Grundlinie (Zermürbung, lange Ballwechsel), Serve-and-Volley bzw.
   Netzangriff (kurz, riskant), Konter/Passierschlag, Aufschlagspiel — keiner davon existiert.
   AUSDAUER (stamina) wirkt nur über die lineare Ermüdung und hat keinen Ort, an dem lange
   Ballwechsel sie fordern.
6. **Keine Risikoentscheidung.** Erster Aufschlag riskant, zweiter sicher, Doppelfehler — die
   einfachste echte Tennis-Entscheidung fehlt.

Tennis ist damit von den dreien die Disziplin mit dem **größten Abstand zwischen Sport und
Mechanik**: Schach hat wenigstens eine Uhr, die in die richtige Richtung erzählt, Fechten hat
Trefferzähler und Perioden — Tennis hat nur ein Wort.

### 4.3 Vorschläge (priorisiert, nur Konzept)

**T1 — Nullsummen-Punkt mit Aufschlag (Kern-Vorschlag).**
Jeder Ballwechsel gehört beiden. Der Aufschläger wechselt nach Tennisregel. Die Chance des
Aufschlägers, den Punkt zu gewinnen, startet bei einem realistischen Grundwert (Tour: knapp zwei
Drittel der Aufschlagpunkte) und verschiebt sich mit der Differenz *Aufschlag-Stärke des
Aufschlägers* gegen *Return-Stärke des Rückschlägers* (Slots *Serve* / *Return* bekommen damit
ihre Bedeutung). Der Spielerwert für rho bleibt die eigene Leistung, **nicht** die bloße Zahl
gewonnener Punkte — siehe Abschnitt 5.3, warum das hier besonders wichtig ist.
*rho-Risiko:* hoch, wenn man naiv „gewonnene Punkte" als Wert nimmt (dann hängt jeder Wert am
Gegner). Mit einer gegnerbereinigten Leistungszahl beherrschbar — muss gemessen werden.

**T2 — Match-Tiebreak als Format (passt fast zufällig perfekt).**
Heute spielt jedes Brett 20 Durchgänge (10 je Spieler) in 60 s. Ein **Match-Tiebreak** (bis 10,
zwei Punkte Vorsprung, Aufschlagwechsel nach dem ersten Punkt, dann alle zwei Punkte — real im
Doppel und in vielen Turnierformaten als Entscheidungssatz im Einsatz) hat genau diese Länge.
Er bringt Aufschlagwechsel, Mini-Breaks, Matchbälle und ein natürliches Ende. Wer mehr
Zählhierarchie will: ein Kurzsatz im Fast4-Stil (bis 4 Spiele, Tiebreak bei 3:3, No-Ad) — das
wäre länger und braucht mehr Durchgänge, bringt dafür echte Breakbälle.
*rho-Risiko:* gering für den Spielerwert (er liest weiter die Leistung je Punkt), mittel für
das Brettergebnis (Zählformate verstärken Glück bei knappen Paaren — und zugleich Eignung bei
klaren Paaren, was CLAUDE.md' „Star und Paartreue mit Abstand" eher hilft).

**T3 — Große Punkte (billig, sobald T1/T2 stehen).**
Nur an Breakbällen, Satz-/Matchbällen und im Tiebreak-Ende wirkt NERVEN (spirit/awareness, Slot
*Tiebreak Clutch*) auf die Punktchance, dort aber deutlich. Mit dem realen Befund: der
Aufschläger verliert an wichtigen Punkten etwas Vorteil, schwache Nerven verlieren mehr. Das
macht aus einem heute unsichtbaren Kanal den spannendsten Moment des Brettes.

**T4 — Ballwechsel-Wege als Primär-/Nebenweg (größerer Ausbau).**
Jeder Punkt endet über einen von drei Wegen:
- **Aufschlagpunkt** (Ass/unretourniert — awareness/spirit, Slot *Serve*),
- **Netzangriff** (kurz, riskant — dexterity/speed, Slot *Net Pressure*; Gegenmittel:
  Passierschlag über awareness/dexterity),
- **Grundlinien-Ballwechsel** (lang, zermürbend — intelligence/stamina, Slot *Rally Control*;
  hier wirkt AUSDAUER endlich dort, wo sie hingehört: lange Ballwechsel ermüden).
Welcher Weg versucht wird, folgt aus Slot-Neigung und dem Gegner (gegen einen schwachen
Passierschläger lohnt das Netz). Ein Spieler ohne Aufschlag kann so über Return und Grundlinie
gewinnen — genau die Design-Leitlinie „jeder ist in irgendwas gut".
*rho-Risiko:* mittel; Pp-Prüfung besonders für stamina (Matrixgewicht 12), das heute nur schwach
wirkt und dann an einem Weg hängt.

**T5 — Aufschlag-Risiko (klein, optional).**
Erster Aufschlag riskant, zweiter sicher, Doppelfehler als eigenes Ereignis (WAGNIS-Kanal).
Schöne Tickerzeile, geringer Mehrwert gegenüber T1–T4.

---

## 5. Gemeinsamer Unterbau: was alle drei brauchen

### 5.1 Ein optionaler Paar-Rechner im Duell-Chassis

Alle Kern-Vorschläge (S1/S2, F2, T1) brauchen dasselbe: je Durchgang eine Funktion, die **beide**
Kontrahenten und den **Spielzustand** kennt (Uhr / Trefferstand / Aufschläger und Zählstand) und
daraus das Ereignis bestimmt. `baueHebenDuelle()` (Zeile 14598) ist die Vorlage im selben
Chassis: eigener Zweig hinter einer Weiche (`art.heben`), Paare werden erst gebildet, dann
gemeinsam durchgerechnet. Die heutige generische Schleife bleibt für alles, was sie nicht
braucht (Wettessen, Showcase …). Es ist eine zweite Zeile im Bühnen-Chassis, kein fünfter Motor
(so schon `arena-duell-recherche-fable.md` 3.4).

### 5.2 Slot-Rollen werden Spielstile

Die Slot-Rolle liefert heute einen Attributszuschlag. Zusätzlich sollte sie eine **Neigung** im
Paar-Rechner setzen (welche Aktion/welcher Weg bevorzugt wird). Die Namen existieren, Chris sieht
sie schon, und sie beschreiben schon genau die realen Stile. Das ist der billigste Weg zu „mehrere
Wege zum Erfolg" für alle drei Disziplinen auf einmal — und er ändert die Matrix nicht.

### 5.3 Leistungsmaß und Duellausgang trennen

Der heutige rho-Erfolg beruht darauf, dass `wert()` die **eigene** Punktsumme liest, die vom
Gegner unabhängig ist (Kommentar Zeile 33720 ff.: rho mit Vorteil 0,54, mit eigenen Punkten
0,95). Jede echte Interaktion macht die eigene Leistung gegnerabhängig — das ist der Grund, warum
das Projekt den Paar-Rechner bisher zurückgestellt hat. Konzeptioneller Ausweg, der im Schach
seit Jahrzehnten Standard ist: **Leistung relativ zur Erwartung gegen diesen Gegner**
(Turnierleistung / Performance-Rating). Ein Spieler, der gegen einen Starken knapp verliert, hat
gut gespielt; einer, der gegen einen Schwachen knapp gewinnt, nicht. Konkret: der Spielerwert
misst die Qualität der eigenen Aktionen **bereinigt um die Stärke des Gegners in diesem Duell**,
der Duellausgang entsteht interaktiv. Ob das rho hält, ist offen und muss mit
`scripts/miss-alle-disziplinen.mjs` und `messe-arena-einfluss.mjs` (Pp) nachgewiesen werden —
dieses Dokument behauptet keine Zahl.

### 5.4 Brettpaarung nach Eignung (billig)

Wie bei der Duett-Fusion: beide Seiten nach `eig` sortieren, Brett 1 = die Stärksten. Das ist
Mannschaftsschach-Regel und Davis-Cup-Logik, macht die Brettergebnisse lesbarer („Spitzenbrett")
und hebt eher die Paartreue. Präsentationsneutral, aber nicht rho-neutral für das Brettergebnis —
zu messen.

### 5.5 Primär-/Nebenweg-Übersicht

| Disziplin | Primärweg (Matrix-Schwerpunkt) | Nebenweg(e) nach diesem Konzept |
|---|---|---|
| Speed-Schach | Rechnen und Muster (intelligence, awareness) | Uhrdruck (speed, will): Gegner in Zeitnot spielen; Gambit (speed, charisma): Initiative statt Material; Endspieltechnik (will, determination) |
| Fechten | Druck und Technik (torment, dexterity) | Parade-Riposte (awareness); Gegenangriff ins Tempo (speed); Finte (dexterity, intelligence) |
| Tennis | Spielintelligenz und Übersicht (intelligence, awareness, spirit) | Aufschlag (awareness, spirit); Netzangriff (dexterity, speed); Grundlinien-Zermürbung (stamina); Clutch an großen Punkten (spirit) |

Heute gibt es keinen dieser Nebenwege als Weg — nur als Summanden im selben Rezept.

---

## 6. Priorisierung

| Rang | Vorschlag | Disziplin | Aufwand | Gewinn fürs Spielgefühl | rho-/Pp-Risiko |
|---:|---|---|---|---|---|
| 1 | **F1** Treffer sind der Stand (+ Prioritätsminute) | Fechten | klein | hoch — behebt einen sichtbaren Widerspruch | gering |
| 2 | **T1 + T2** Nullsummen-Punkt, Aufschlag, Match-Tiebreak | Tennis | mittel–groß | sehr hoch — Tennis bekommt seine Grundstruktur | hoch ohne 5.3, mittel mit |
| 3 | **5.1 + 5.3** Paar-Rechner mit gegnerbereinigtem Spielerwert | alle | groß (einmalig) | Voraussetzung für 2, 5, 6, 7 | Kernfrage, zuerst messen |
| 4 | **5.2** Slot-Rollen als Stil-Neigung | alle | mittel | hoch — „mehrere Wege" für alle drei | mittel |
| 5 | **F2 + F3** Aktionsrad + standabhängige Taktik | Fechten | mittel | hoch | mittel–hoch |
| 6 | **S1** Uhr als Ressource mit Zeitnot-Schwelle | Speed-Schach | mittel | hoch — das Blitz-Merkmal | mittel |
| 7 | **T3** große Punkte | Tennis | klein (nach T1/T2) | hoch | gering–mittel |
| 8 | **S2 + S3** Bewertung als Zustand, Partiephasen, Remis | Speed-Schach | mittel | mittel | mittel |
| 9 | **5.4 / S5** Brettpaarung nach Eignung, Farbwechsel | alle / Schach | klein | mittel | zu messen |
| 10 | **T4** Ballwechsel-Wege | Tennis | groß | hoch | mittel |
| 11 | S4, S6, T5, F4 | — | klein–mittel | gering | — |

**Empfohlene Reihenfolge der Arbeit:** F1 allein vorweg (klein, eigenständig, ohne Paar-Rechner
machbar). Dann eine Mess-Vorstudie zu 5.3 an einer Nachbildung — ob ein gegnerbereinigter
Spielerwert rho im interaktiven Modell hält, entscheidet, ob T1/F2/S1 überhaupt gebaut werden
können. Erst danach Tennis (T1+T2+T3), dann Fechten (F2+F3), dann Speed-Schach (S1).

---

## 7. Ehrliche Gesamteinschätzung

- **Speed-Schach — „gut genug", mit einem klaren nächsten Schritt.** Mechanisch ein Würfel je Zug,
  aber die sauberste Zahl, das passendste Rezept und die ehrlichste Kulisse. Das eine, was fehlt,
  ist die Uhr als Entscheidung.
- **Fechten — solide Grundlage, ein echter Fehler, keine Taktik.** Chassis und Waffenwahl sind
  richtig. Der Widerspruch zwischen Trefferstand und Sieger ist der auffälligste Einzelfehler der
  drei und leicht zu beheben. Das Aktionsrad würde Fechten zur taktisch reichsten der drei
  Disziplinen machen.
- **Tennis — die größte Lücke.** Das Wort „Tennis" und ein fliegender Ball, darunter kein
  Aufschlag, kein Nullsummen-Punkt, keine Zählung, keine großen Punkte, keine Stile. Die gute
  Nachricht: das echte Format (Match-Tiebreak) passt nahezu exakt in die vorhandene Spiellänge.

Alle drei bestehen die Abnahme, und keiner dieser Befunde ist ein Grund, sie zurückzunehmen. Die
Frage des Auftrags — „bildet die Mechanik echte taktische Entscheidungen ab?" — ist für alle
drei heute mit **nein** zu beantworten; die Vorschläge oben zeigen, wo das mit dem kleinsten
Eingriff anfängt.

---

## Quellen

Im Repo gelesen: `public/mockups/battle-mode.engine.js` (Zeilen wie angegeben),
`lib/lineups/matchday-slot-roles.ts`, `docs/design/speed-schach-fable-recherche-12-09.md`,
`docs/design/tennis-fechten-rollout-plan.md` (A.5–A.7, C.1–C.3),
`docs/design/arena-duell-recherche-fable.md` (3.1–3.4), `docs/design/fechten-aufwertungsplan-17-09.md`
(5.3), `docs/design/fechten-punkte-mehrrunden-konzept-14-09.md`, `docs/design/stand-aller-disziplinen.md`.

Extern:
- Tennis-Haltequoten und Breakball-Verwertung: [TonysPicks, „Reading Hold Percentages After a Service Break" (2026)](https://www.tonyspicks.com/2026/05/27/live-tennis-in-play-reading-hold-percentages-after-a-service-break/), [My Tennis Expert, „Tennis Stats Explained"](https://mytennisexpert.com/tour/stats/) — Sekundärquellen, als Größenordnung verwendet
- Aufschlag-Effektivität: [ATP Tour, „Insights: Serve Effectiveness"](https://www.atptour.com/en/news/insights-serve-effectiveness)
- Wichtige Punkte / Nicht-Unabhängigkeit: [Klaassen & Magnus (2001), „Are Points in Tennis Independent and Identically Distributed?", JASA 96(454)](https://www.tandfonline.com/doi/abs/10.1198/016214501753168217), [PDF](http://www.janmagnus.nl/papers/JRM057.pdf)
- Blitz, Uhr und Stellung: [jk_182, „How the Evaluation and Clock impact Results of Blitz Games", Lichess](https://lichess.org/@/jk_182/blog/how-the-evaluation-and-clock-impact-results-of-blitz-games/I2kRp2sk)
- Anzugsvorteil: [Wikipedia, „First-move advantage in chess"](https://en.wikipedia.org/wiki/First-move_advantage_in_chess)
- Fechten, Vorfahrt und Aktionen: [Wikipedia, „Priority (fencing)"](https://en.wikipedia.org/wiki/Priority_(fencing)), [Wikipedia, „Fencing tactics"](https://en.wikipedia.org/wiki/Fencing_tactics), [Wikipedia, „Attack (fencing)"](https://en.wikipedia.org/wiki/Attack_(fencing)), [Wikipedia, „Riposte"](https://en.wikipedia.org/wiki/Riposte)
- Degen-Aktionsanteile (Tarragó & Iglesias 2016) und Gefechtsstruktur (FIE): übernommen aus `arena-duell-recherche-fable.md` 0.3/3.1/3.2, dort mit Quellen

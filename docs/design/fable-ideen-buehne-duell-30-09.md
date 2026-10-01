# Bühnen-Duell — Fable-Ideen zu Speed-Schach, Fechten, Tennis (30.09.)

**Reines Ideendokument, kein Code, keine Produktionsdatei geändert.** Auftrag von Chris: frisch auf
die drei Eins-gegen-eins-Disziplinen schauen und eigene Ideen einbringen — als Gameplay, nicht nur
als Präsentation. `engine.js` meint `public/mockups/battle-mode.engine.js` (Stand `main`, 30.09.).

**Rahmen, der für jede Idee unten gilt (CLAUDE.md):** die Eignungsmatrix
(`lib/player-generator/official-discipline-weights.ts`) bleibt für alle zwanzig Disziplinen
unangetastet; rho je Einzelspiel muss über 0,80 bleiben (angestrebt 0,85); die Pp-Abweichung
muss ≤ 25 bleiben; „mehrere Wege zum Erfolg" wird mitgedacht. Jede Idee trägt eine Marke:
**Klasse A** = reine Anzeige, rho/Pp per Konstruktion unberührt; **Klasse B** = echte
Mechanik-Änderung, braucht Chris' Zustimmung und eine Messrunde vor dem Merge. Nichts hier ist
abgenommen, nichts ist gemessen — es sind Vorschläge.

Dieses Dokument **wiederholt nicht**, was `docs/design/buehne-duell-opus-konzeptreview-26-09.md`
(Branch `buehne-duell-konzeptreview-26-09`: S1–S6, F1–F4, T1–T5, Paar-Rechner 5.1, gegner-
bereinigter Spielerwert 5.3, Slot-Rollen als Stil 5.2) und
`docs/design/broadcast-optik-buehne-duell-27-09.md` (Branch `broadcast-buehne-duell-recherche-27-09`,
Trefferlampen, Eval-Graph, Hawk-Eye, FIE-Tafel …) schon vorgeschlagen haben. Wo ich darauf aufbaue,
steht der Verweis; wo ich bewusst eine andere Richtung aufmache, steht das Warum.

---

## Kurzfassung

1. **Der Kern-Widerspruch der drei Disziplinen lässt sich umgehen statt lösen.** Das Opus-Review
   nennt als Kernfrage, ob ein gegnerbereinigter Spielerwert (5.3) rho hält, wenn die Mechanik
   interaktiv wird — „zuerst messen". Ich schlage vor, gar nicht erst dorthin zu gehen: **die
   Leistungsschicht bleibt solo, nur die Ergebnisschicht wird interaktiv.** Jeder Spieler würfelt
   wie heute seine Durchgänge für sich (`u.summe` bleibt Zeichen für Zeichen der Messwert für rho,
   das Rezept bleibt der Messwert für Pp), aber **wer den Punkt / das Gefecht / das Brett gewinnt,
   entsteht erst aus dem Vergleich beider Solo-Leistungen** — Punkt für Punkt, nicht als
   Gesamtdifferenz. Das ist exakt die Gewichtheben-Regel („380 kg gehoben, auch wenn er verliert")
   und exakt das, was F1 für Fechten am 26.09. schon getan hat. Alle Klasse-B-Ideen unten folgen
   diesem Prinzip; ihr rho-/Pp-Risiko ist deshalb per Konstruktion null, zu messen bleiben nur
   Spiegelsymmetrie und Teamwertung (Abschnitt 1.2).
2. **Drei Sportarten, drei echte Mannschaftsformate.** Heute sind alle drei „sechs Bretter
   parallel, Bretter gewonnen zählen". Das ist für Schach richtig (Mannschaftsschach), für die
   anderen beiden geliehen. Fechten hat real die **Staffel** (kumulierter Trefferstand, Anker
   zuletzt — genau das Aufhol-Drama, das Chris am Breaking-Gauntlet wollte), Tennis hat real
   **Davis Cup** (Einzel plus Doppel als Entscheider). Wenn die Formate verschieden sind, fühlen
   sich die drei Disziplinen verschieden an, ohne dass ein Rezept angefasst wird.
3. **Meine drei stärksten Ideen:** die **Fechtstaffel** (F-F1), der **Nullsummen-Punkt durch
   Vergleich mit Aufschlag-Handicap** für Tennis (T-F1) und **Davis-Cup-Doppel** über die schon
   vorhandene Duett-Fusion (T-F2). **Speed-Schach halte ich für rund** — zwei kleine Dinge, mehr
   nicht (Abschnitt 4).

---

## 1. Was schon existiert und entschieden ist

### 1.1 Stand der Zahlen (korrigiert gegenüber dem Gesamtstand)

`docs/design/stand-aller-disziplinen.md` (Zwölfter Nachtrag, 26.09.) führt Tennis und Fechten noch
als Pp-VERLETZT. Das ist überholt: Commit `908bdda3` („Buehne Pp-Fix", 27.09.) liegt auf `main`
und ist in den Motor-Kommentaren bei `BUEHNE_ART.tennis`/`.fechten` („PP-FIX 27.09.") dokumentiert.

| Disziplin | rho je Spiel | Pp-Abweichung (2 Saatströme) | Stand |
|---|---:|---:|---|
| Speed-Schach | 0,906 | 17,3 / 18,3 | beide Schranken bestanden |
| Fechten | 0,832 (nach Pp-Fix; 0,825 im Gesamtstand) | **20,3 / 20,3** (vorher 40,6 / 42,1) | beide bestanden, rho-Puffer dünn |
| Tennis | 0,827 (nach Pp-Fix; 0,821 im Gesamtstand) | **9,8 / 6,2** (vorher 53,9 / 56,4) | beide bestanden, rho-Puffer dünn |

Der Gesamtstand sollte diese drei Zeilen nachziehen — reine Dokupflege, nicht Teil dieses
Dokuments.

### 1.2 Was das Chassis heute rechnet — in einem Absatz

`bauBuehne()` → `setz()` (`engine.js:14741 ff.`): jeder Teilnehmer würfelt seine `rundenN`
Durchgänge **allein**, bevor sein Gegner feststeht (Erfolgschance aus TECHNIK/NERVEN/WAGNIS,
Punkte aus GRUNDLAGE/SPITZENMOMENT/PUBLIKUM). Danach paart der `art.duell`-Block (`:14861 ff.`)
Brett i Heim gegen Brett i Gast und bildet `verlauf[]`/`vorteil` als laufende Punktdifferenz. Der
Spielerwert für rho ist `u.summe` (eigene Punkte, `MOTOREN[bd].wert()`), **nicht** der Vorteil —
diese Trennung ist der Grund, warum alle drei rho bestehen. Seit F1 (26.09.) entscheidet bei
Fechten der Trefferstand (`gefechtSieg`, `:14911 ff.`) das Brett, bei Gleichstand ein vorab
gezogenes Prioritäts-Los; Speed-Schach und Tennis entscheiden weiter über `vorteil`.

Das heißt für jede Klasse-B-Idee unten: solange sie **nach** `setz()` ansetzt (im Paarungsblock
oder in `spieleBuehneDuell()`), **kein `rr()` zieht** und `u.summe`/`u.runden[].punkte` nicht
verändert, sind `miss-alle-disziplinen.mjs` und `messe-arena-einfluss.mjs` per Konstruktion
bit-identisch. Trotzdem beide vorher/nachher fahren (Projektregel). **Was sich ändert und deshalb
gemessen werden muss:** `scripts/miss-arena-buehne-spiegel.mjs` (Heim:Gast nahe 50:50), die
Teamwertung in `spieleBuehneDuell()` (`lib/battle/arena-headless-runner.ts`), und die ehrlichere
Abnahme aus CLAUDE.md (Star auf Rang 1, Paartreue mit Abstand) — die kann sich über das
Brettergebnis verschieben, auch wenn rho es nicht tut.

### 1.3 Was das Opus-Review und die Broadcast-Recherche schon abgedeckt haben

| Bereich | Schon vorgeschlagen (26./27.09.) | Wo ich anders abbiege |
|---|---|---|
| Tennis | T1 Nullsummen-Punkt mit Aufschlag über einen Paar-Rechner; T2 Match-Tiebreak; T3 große Punkte; T4 drei Ballwechsel-Wege; T5 Aufschlag-Risiko | T1 **ohne** Paar-Rechner und ohne 5.3 (T-F1); ein Team-Format statt sechs Einzel (T-F2); Belag als Spieltagsvariable (T-F3) |
| Fechten | F1 Treffer sind der Stand (umgesetzt); F2 Aktionsrad (Schere-Stein-Papier); F3 standabhängige Taktik; F4 Waffenart | Staffel statt sechs Bahnen (F-F1); Mensur/Bahnende als Regel (F-F2); Aktionsrad zurückstellen — Begründung in 3.3 |
| Speed-Schach | S1 Uhr als Ressource; S2 Bewertung als Zustand; S3 Phasen; S4 Gambit; S5 Brettordnung/Farben; S6 Kulisse | Remis als Mannschaftstaktik (S-F1); „das letzte Brett entscheidet"-Regie (S-F2); S1 ausdrücklich **nicht** vor Tennis/Fechten |
| alle | 5.1 Paar-Rechner; 5.2 Slots als Stil; 5.3 gegnerbereinigter Wert; 5.4 Brettpaarung nach Eignung | Leistungs-/Ergebnisschicht trennen statt 5.3 (Kurzfassung 1); 5.4 nur für Schach, bei Fechten/Tennis ist die Reihenfolge Chris' Entscheidung (Abschnitt 5.1) |

---

## 2. Tennis — die größte Lücke, deshalb die meisten Ideen

Matrix Tennis: intelligence 22, awareness 20, spirit 18, stamina 12, dexterity 12, determination 6,
speed 6, charisma 4. Slots: Serve, Return, Rally Control, Net Pressure, Match IQ, Tiebreak Clutch.

### T-F1 — Der Punkt gehört dem Besseren dieses Ballwechsels (Klasse B, Aufwand klein–mittel)

**Idee.** Heute „gewinnen" an fast jedem zweiten Ballwechsel-Index beide (Opus-Nachbildung 46,7 %),
weil beide unabhängig würfeln. Der einfachste Nullsummen-Punkt braucht keinen Paar-Rechner: im
Paarungsblock (`:14875 ff.`) wird je Durchgang r **verglichen**, wer die höheren Punkte
(`a.runden[r].punkte` gegen `b.runden[r].punkte`) hat — der bekommt den Punkt, der andere nicht.
Das ist nichts anderes als die Diskretisierung des `verlauf[]`, den der Block heute ohnehin
rechnet, nur Punkt für Punkt statt als Summe. `u.summe`, `runden[].punkte`, `rr()`-Verbrauch:
unverändert. Bei Punktgleichheit entscheidet der gespeicherte Wurfabstand (`erfolg − wurf`, der
Wert, den `knapp` heute schon binär aus `wurf` ableitet, `:14825/14832` — er müsste nur als Zahl
auf dem Rundeneintrag mitgeführt werden, ein `viz`-artiges Feld nach dem `knapp`-Muster), damit
nie ein zweiter Würfel nötig wird.

**Aufschlag als Handicap im Vergleich, nicht im Wurf.** Der Aufschläger wechselt nach
Match-Tiebreak-Regel (Punkt 1 Spieler A, danach alle zwei Punkte; Brett 1 beginnt Heim, Brett 2
Gast, … — Spiegelsymmetrie). Beim Vergleich bekommt der Aufschläger einen festen Zuschlag `h`
auf seine Rundenpunkte, so gewählt, dass er rund 62–65 % der Aufschlagpunkte gewinnt (ATP-Tour:
knapp zwei Drittel, s. Opus-Review 4.2 Punkt 2). Damit existiert „Aufschlag halten" und „Break"
als Ereignis — und der Slot *Serve* (awareness/spirit, `matchday-slot-roles.ts:162`) wirkt
erstmals dort, wo er heißt: sein Attributzuschlag hebt die Rundenpunkte genau in den Runden, in
denen der Spieler aufschlägt. Kein neuer Attributkanal, keine Pp-Bewegung.

**Zählung ohne Remis.** `rundenN` 10 → **13** (ungerade: kein Gleichstand möglich), Brettsieger
ist, wer zuerst 7 Punkte hat — ein Tiebreak bis 7 mit dem einzigen Unterschied, dass die
Zwei-Punkte-Vorsprung-Regel entfällt (bei 13 Runden ist 7 immer erreichbar und immer
entscheidend). Alle 13 Runden werden wie immer vollständig gerechnet; die Enthüllung stoppt
narrativ beim siebten Punkt (dieselbe Krücke wie Fechten-Konzept Option 3 und die
Matt-Erkennung im Schach). `rundenDauer` 60/(13·6·2) ≈ 0,385 s. Mehr Runden helfen der Bühne
nachweislich (Eiskunstlauf/Breaking, Spearman-Brown ohne RNG-Kaskade), rho sollte also eher
steigen; **`data/generated/tennis-pps-referenz.json` muss neu gezogen werden** (dieselbe Pflicht
wie im Fechten-Aufwertungsplan 5.2 Punkt 4 — die rohe Summe wächst um 30 %).

**Warum es zu Tennis passt.** Tennis ist die Sportart, in der man mehr Punkte gewinnen und
trotzdem das Match verlieren kann — die „Leist"-Spalte darf dem Brettergebnis widersprechen, das
ist hier kein Fehler, sondern das Wesen des Sports. Die neue Nahansicht (PR #1025) zeigt dann
endlich einen Ballwechsel, den genau einer gewinnt.

**Was zu messen ist.** Spiegel (Aufschlag-Startseite alterniert je Brett), Teamwertung
(Bretter gewonnen wie heute), Star/Paartreue über das Brettergebnis. Das Opus-Review warnt vor
T1 wegen 5.3 — dieses Risiko entfällt hier, weil `wert()` weiter `u.summe` liest.

### T-F2 — Davis Cup: vier Einzel und ein Doppel (Klasse B, Aufwand mittel)

**Idee.** Sechs Spieler je Seite passen exakt auf das Davis-Cup-Format: **vier Einzel plus ein
Doppel** (zwei Spieler), fünf „Rubber", Team gewinnt bei drei. Das Doppel ist real der Entscheider
des Formats und die Heimat des Netzspiels — Slots *Net Pressure* (dexterity/speed) und *Serve*
(awareness/spirit) bilden das Doppelpaar, die vier übrigen (Return, Rally Control, Match IQ,
Tiebreak Clutch) die Einzel. Wer das Doppel spielt, ist damit **Chris' Nominierungsentscheidung**
über die Aufstellung — die einzige echte Tennis-Kapitänsentscheidung, und sie kostet keinen Würfel.

**Wie das Doppel rechnet.** Die Duett-Fusion (`art.duett`, `:14975 ff.`, Eiskunstlauf) ist die
Vorlage: zwei `runden[]` werden **auf Rundenebene** linear fusioniert (0,8a + 0,2b), Teamsumme
bleibt exakt erhalten, rho-Verhalten ist bei Eiskunstlauf gemessen (0,878). Das Doppelpaar
Heim spielt gegen das Doppelpaar Gast als ein Brett — mit T-F1 als Nullsummen-Punkt, sonst wie
heute über `vorteil`. Eine echte Doppel-Mechanik (Aufschläger wechselt innerhalb des Paars,
Netzspieler vs. Grundlinienspieler) wäre eine Ausbaustufe, nicht Voraussetzung.

**Skalierung auf 2..6.** `buildSeasonPlayerCountByDiscipline()` würfelt je Saison 2–6 Spieler je
Seite. Regel: bei n ≥ 3 bilden die letzten zwei Aufstellungsplätze das Doppel (n−2 Einzel + 1
Doppel), bei n = 2 gibt es nur das Doppel, bei n = 1 nur ein Einzel. Ungleiche Seiten (Heim 5,
Gast 6) nach dem Unterzahl-Muster von `duellBretter` (`:14874`) — Rubber-Zahl = kleinere Seite.

**Warum es zu Tennis passt.** Tennis ist die einzige der drei, deren Mannschaftsformat real ein
*gemischtes* ist (Einzel und Doppel sind verschiedene Spiele). Mannschaftsschach ist sechs Bretter,
Fechtstaffel ist ein kumuliertes Gefecht — Davis Cup ist das dritte, eigene Muster. Damit hört
Tennis auf, „Speed-Schach mit Ball" zu sein.

**Was zu messen ist.** Team-Ergebnis best-of-5 statt Bretter-Mehrheit (Spiegel!), rho bei
jeSeite 2 (dann ist die ganze Seite ein Doppel — Tennis lag dort früher bei 0,833). Zu
entscheiden: ob die fusionierten Punkte je Doppelspieler den Spielerwert bilden (wie bei
Eiskunstlauf) oder die unfusionierten (rho-identisch zu heute) — ich würde die unfusionierten
nehmen, weil ein Doppelspieler nicht für seinen Partner bewertet werden soll.

### T-F3 — Belag je Spieltag: Hart, Sand, Rasen (Klasse B, Aufwand klein–mittel, erst nach T4)

**Idee.** Real ändert der Belag, welcher Weg zum Punkt sich lohnt: Rasen belohnt Aufschlag und
Netz (Haltequote 82–85 %), Sand belohnt Grundlinie und Ausdauer (74–77 %), Hartplatz ist neutral
(78–81 %; Zahlen aus dem Opus-Review 4.2). Wenn Tennis die drei Ballwechsel-Wege aus T4
(Aufschlagpunkt / Netzangriff / Grundlinie) bekommt, ist der Belag die natürliche
Spieltagsvariable: je Spieltag deterministisch aus der Saat gezogen, für beide Seiten gleich, und
er verschiebt nur die **Gewichtung zwischen den drei Wegen** — nicht die Attribute in den Wegen.
Präzedenz im Projekt: Takeshis drei Kurse, Time-Trials Geländezonen. Ein stamina-schwerer Kader
glänzt auf Sand, ein Netzspieler auf Rasen — „mehrere Wege zum Erfolg" über die Saison hinweg,
nicht nur innerhalb eines Spiels.

**Ehrlich zum Risiko.** Pp wird über viele Spiele gemessen, dort mitteln sich die Beläge aus;
rho je Spiel ist auf einem extremen Belag aber gegen eine *feste* Eignung gemessen und sinkt dort
zwangsläufig. Deshalb: Belag-Spanne klein halten (± wenige Prozentpunkte auf die Wegwahl), und
**nur** bauen, wenn T4 existiert — ohne Wege gibt es nichts zu verschieben. Im Bild ist der Belag
dagegen sofort Klasse A: die Broadcast-Recherche will ohnehin „Platz zeichnen" — drei Farben statt
einer sind gratis.

### T-F4 — Ballwechsel-Länge und Break-Moment (Klasse A, Aufwand klein, nur mit T-F1)

Die Rundenpunkte tragen bereits eine Zahl, die sich als **Schlagzahl des Ballwechsels** lesen
lässt (hohe Punkte beider Seiten = langer Ballwechsel; `ermued` aus AUSDAUER macht späte Runden
kürzer). Ein „Ballwechsel: 14 Schläge"-Zähler in der Nahansicht plus ein „BREAK!"-Banner, wenn der
Rückschläger den Punkt gewinnt, machen T-F1 lesbar. Broadcast-Vorschlag „Ballwechsel-Leiste" wird
dann vom ehrlichen Ersatz zur echten Anzeige.

---

## 3. Fechten — ein eigenes Mannschaftsformat und Chris' Tauzieh-Bild als Regel

Matrix Fechten: torment 25, dexterity 20, speed 16, awareness 15, power 10, determination 6,
health 4, intelligence 4. Slots: Duelist, Aggressor, Defender, Technician, Counter Tempo,
Final Touch.

### F-F1 — Die Fechtstaffel (Klasse B, Aufwand klein–mittel)

**Idee.** Das olympische Mannschaftsfechten ist keine Reihe paralleler Einzelgefechte, sondern
eine **Staffel**: die Gefechte laufen nacheinander auf einer Bahn, der Trefferstand wird
**kumuliert** (real 3 gegen 3, neun Gefechte, Ziel 45, jedes Gefecht bis zum nächsten Vielfachen
von 5), und der letzte Fechter — der Anker — kann einen Rückstand von zehn Treffern drehen oder
einen Vorsprung verspielen. Das ist wörtlich das Drama, das Chris am 22.09. für Breaking bestellt
hat („so kann zb ein starker spieler auf slot 6 noch mal richtig aufholen") — nur dass es hier
das *reale* Format der Sportart ist, keine Übertragung.

**Bühnen-Fassung.** Paarung bleibt Slot i gegen Slot i (der bestehende `art.duell`-Block), aber:

1. **Enthüllung sequentiell statt verschränkt.** `buehneQueue` zeigt heute Durchgang 1 aller
   Bahnen, dann Durchgang 2 … (Broadcast-Recherche Abschnitt 1). Für Fechten: Gefecht 1 komplett
   (alle 9 Gänge beider Fechter), dann Gefecht 2, … — das Startreihenfolge-Muster, das
   Eiskunstlauf (`:14991 ff.`) und Breaking (Cypher) schon nutzen, dort ausdrücklich als
   rho-neutral nachgewiesen (Reihenfolge bereits berechneter Einträge). Gesamtdauer identisch.
2. **Teamstand = kumulierte Treffer**, nicht „Bahnen gewonnen". `spieleBuehneDuell()` zählt für
   Fechten Σ`u.treffer` je Seite (die Zahl, die F1 ohnehin je Gefecht bildet); Gleichstand am
   Ende → Prioritäts-Los auf Teamebene (real: Zusatzminute mit Priorität, dieselbe Regel wie F1,
   nur einmal je Spiel statt je Gefecht). Die Ziel-Vielfachen (5 · Gefechtsnummer) sind
   Erzählrahmen im Ticker, keine Abbruchbedingung — alle 9 Gänge werden immer gerechnet,
   Verlässlichkeit bleibt.
3. **Reihenfolge = Chris' Aufstellung.** Slot 1 eröffnet, Slot 6 ist Anker. Das ist eine echte
   Aufstellungsentscheidung mit realem Vorbild (Anker = stärkster oder nervenstärkster Fechter,
   Eröffner = der, der keinen Rückstand aufbaut) und gibt dem Slot *Final Touch* („schließt enge
   Gefechte über Torment und Determination") seinen Ort, ohne dass sein Rezeptzuschlag angefasst
   wird. Für die KI-Seite: stärkste Eignung zuletzt (reale Praxis), damit der Vorteil nicht
   einseitig bei Chris liegt.

**Warum das kein zweiter Gauntlet ist.** Breakings Gauntlet drückte rho zunächst auf 0,707, weil
ein früh ausgeschiedener Kämpfer seine *Ereignisse* verlor (Gambler's Ruin). In der Staffel ficht
**jeder genau seine 9 Gänge**, nichts wird abgeschnitten; geteilt ist nur der Stand, nicht die
Zahl der Würfe. `u.summe` bleibt bit-identisch, rho auch. Was sich ändert, ist die Teamwertung —
und die ist in `spieleBuehneDuell()` ein Zähler, kein Rezept.

**Was verloren geht, ehrlich.** Die Übersicht „sechs Bahnen nebeneinander" (Mini-Bahnen „Bahn 3 ·
4:2") wird zu einer Bahn mit Warteschlange. Die Nahansicht aus PR #1025 fokussiert ohnehin eine
Bahn; die anderen fünf Fechter stehen dann sichtbar an der Bande und warten — sportlich richtig,
und eine Einladung für die „Spieler-Kamera" aus der Broadcast-Recherche. Die reale 3-gegen-3-
Variante mit neun Gefechten (jeder gegen jeden) wäre eine spätere Ausbaustufe mit 27 Gängen je
Fechter — mehr Ereignisse, mehr Verlässlichkeit, aber dreifache Dauer; nicht für den ersten
Schritt.

### F-F2 — Die Mensur: das Tauzieh-Bild wird Regel (Klasse B, Aufwand klein)

**Idee.** Chris' Auftrag vom 22.09. („der gewinnende spieler [soll] den anderen immer weiter
zurück drängen") ist heute als `buehneTauziehVersatz()` (`:14585`) reine Anzeige. Im echten
Degenfechten ist das Zurückdrängen eine **Regel**: wer mit beiden Füßen die hintere Endlinie
überschreitet, gibt dem Gegner einen Treffer. Vorschlag: je Paar ein Zustand `mensur` ∈ [−1, +1],
der sich je Gang aus der Rundenpunkt-Differenz (dieselbe Zahl, die `verlauf[]` heute bildet)
verschiebt; überschreitet er die Grenze, zählt **ein Treffer für den Drängenden** (nur in
`u.treffer`/`gefechtSieg`, nicht in `u.summe`), beide gehen an die En-garde-Linien zurück
(`mensur = 0`, wie real nach jedem Treffer). Kalibrierziel: selten — höchstens ein bis zwei
Bahnende-Treffer je Gefecht, sonst überlagert es das Fechten.

**Warum es zu Fechten passt — und zur Matrix.** Torment ist mit 25 das schwerste Attribut und
sitzt mit 29 % in GRUNDLAGE, dem einzigen Kanal, der **jeden** Gang zählt, unabhängig vom
Erfolgswurf (`:14812`). GRUNDLAGE ist also mechanisch schon „der Druck, der immer da ist" — die
Mensur macht diesen Druck erstmals sichtbar folgenreich: ein Fechter, der Gang für Gang die
höhere Basis hat, aber im Erfolgswurf Pech, drängt trotzdem und holt sich am Bahnende den Treffer.
Das ist ein **Nebenweg**: Druck (torment/power in GRUNDLAGE) neben Technik (der Erfolgswurf aus
TECHNIK/NERVEN). Ein Fechter mit 80 Torment und mittlerer Dexterity gehört laut Matrix zu den
Besseren — und hat mit der Mensur einen eigenen Weg, das zu zeigen.

**Zwei Varianten, ehrlich unterschieden.**
- **A (rho-/Pp-neutral per Konstruktion):** die Verschiebung liest nur die fertige
  Rundenpunkt-Differenz. Kein neuer Attributkanal, `messe-arena-einfluss.mjs` sieht nichts.
- **B (torment-spezifisch):** die Verschiebung gewichtet zusätzlich den Torment-Anteil beider
  Fechter. Dann trägt Torment über einen zweiten Kanal — Pp muss neu gemessen werden (Torment
  liegt heute bei 27–28 % gegen Matrix 25, s. Fechten-Aufwertungsplan 2.2, Luft ist da, aber
  wenig). Ich würde mit A anfangen.

**Was zu messen ist.** Spiegel (die Bahn-Geometrie hat eine Heim-links-Konvention), Häufigkeit
der Bahnende-Treffer, Verschiebung von Star/Paartreue über `gefechtSieg`. Die Anzeige existiert
schon — der Versatz müsste nur `mensur` statt `verlauf[aktuell]` lesen.

### F-F3 — Warum ich das Aktionsrad (Opus F2) zurückstellen würde

Das Review nennt es selbst: ein Schere-Stein-Papier-Anteil ist „per Definition eignungsfremdes
Rauschen", und Fechtens rho-Puffer ist mit 0,03 über der Schranke der dünnste der drei. Ein
Aktionsrad braucht außerdem den Paar-Rechner (5.1) und damit die 5.3-Frage — genau das, was
Kurzfassung 1 umgeht. Die Staffel (F-F1) und die Mensur (F-F2) geben Fechten Taktik (Reihenfolge,
Anker, Druck) und ein eigenes Gesicht, ohne einen Würfel hinzuzufügen. Wenn Chris das Rad später
trotzdem will, ist der Weg über die Ergebnisschicht offen: die Aktionswahl als *Lesebonus im
Vergleich* (awareness gegen die Wiederholung derselben Slot-Neigung), nicht als eigener Wurf.

### F-F4 — Perioden-Pause als Bild (Klasse A, Aufwand klein)

Die Perioden existieren (`rundenN:9`, „PERIODE BEENDET"). Was fehlt, ist die reale
Minute Pause: beide Fechter an der Bande, Maske ab, Zwischenstand groß, ein Satz im Ticker
(„Führt 4:2 — sucht in Periode 2 den Doppeltreffer" / „Liegt zurück — muss angreifen"). Das ist
Opus F3 als **Erzählung** statt als Mechanik: der Satz liest nur `u.treffer` beider Seiten. Kostet
nichts, gibt der Periodenstruktur, die Chris am 14.09. bestellt hat, ein Gesicht.

---

## 4. Speed-Schach — rund; zwei kleine Dinge

Matrix Speed-Schach: intelligence 28, awareness 21, determination 14, will 14, speed 10,
dexterity 7, charisma 6. rho 0,906, Pp 17–18, sauberste Zahl der drei, ehrlichste Kulisse.

Ich schließe mich dem Review an: **wenn eine der drei nicht angefasst wird, dann diese.** S1 (Uhr
als Ressource) ist die richtige *nächste* Idee, aber sie braucht den Paar-Rechner und bringt einen
Nichtlinearitäts-Hebel in die Disziplin mit der besten Zahl — das würde ich nicht vor Tennis und
Fechten tun. Zwei Dinge, die ohne Paar-Rechner gehen und Speed-Schach als *Mannschafts*schach
ernster nehmen:

### S-F1 — Remis als Mannschaftstaktik (Klasse B, Aufwand klein, rho-neutral per Konstruktion)

Remis kommt heute zu 0,24 % vor — kein Schach. Real ist Remis im Mannschaftskampf eine
**Entscheidung**: wer im Endspiel ausgeglichen steht und dessen Team den Kampf schon führt, nimmt
das Remis; wer zurückliegt, spielt weiter. Regel ohne Würfel: ab Zug 8 (Endspiel), wenn
|`verlauf[aktuell]`| unter einer Schwelle liegt **und** das Team dieses Bretts nach den bereits
entschiedenen Brettern führt oder gleichauf liegt, endet das Brett als Remis (½). Die restlichen
Züge werden gerechnet, nicht gezeigt. Teamstand als Brettpunkte **1 · ½ · 0** (die
Mannschafts-Leiste aus der Broadcast-Recherche bekommt echte Halbe), Sieg bei über der Hälfte,
bei Gleichstand Berliner Wertung (Brett 1 zählt mehr) — die reale Tiebreak-Regel. `u.summe`
unberührt; zu messen: Teamwertung und Spiegel.

### S-F2 — „Das letzte Brett entscheidet" (Klasse A, Aufwand klein)

Im Mannschaftsschach enden Bretter zu verschiedenen Zeiten, und die Spannung liegt auf dem
letzten offenen. Heute laufen alle sechs im Gleichtakt bis Zug 10. Regie-Regel ohne
Mechanikänderung: ist ab Zug 6 der Rückstand eines Bretts größer als das, was die verbleibenden
Züge maximal drehen können (obere Schranke aus `basis + SPITZENMOMENT·0,35·Wagnisfaktor + PUBLIKUM`,
spoilerfrei, weil sie kein zukünftiges Ergebnis liest), zeigt das Brett „gibt auf", verschwindet
aus der Rotation, und die Kamera bleibt bei den offenen Brettern. Das erzeugt „2½:2½, Brett 4
entscheidet" — den einen Moment, den jede Olympiade-Übertragung hat. Rein Enthüllung, `rr()` nie,
`summe` unberührt.

### Zu S5 / 5.4 (Brettreihenfolge nach Eignung): ja — hier, und nur hier

Für Schach ist die Reihenfolge nach Stärke eine **Regel** (Bretter in absteigender Spielstärke,
für die Saison fixiert), also gehört Sortierung nach `eig` in den Motor, wie es die Duett-Fusion
schon tut. Für Fechten (Staffel) und Tennis (Davis-Cup-Nominierung) ist die Reihenfolge dagegen
die **Entscheidung** des Kapitäns — dort sollte Chris' Aufstellung gelten, nicht eine Sortierung.
Das ist der eine Punkt, an dem ich 5.4 nicht pauschal für alle drei übernehmen würde.

---

## 5. Querschnitt

### 5.1 Die Aufstellung wird je Disziplin eine andere Entscheidung

| Disziplin | Was Chris mit der Reihenfolge entscheidet | reales Vorbild |
|---|---|---|
| Speed-Schach | nichts (Sortierung nach Stärke ist Regel) — seine Entscheidung ist die Slot-Wahl | Olympiade-Brettordnung |
| Fechten | Eröffner und Anker der Staffel | olympisches Mannschaftsfechten |
| Tennis | wer das Doppel spielt, wer Einzel 1 | Davis Cup |

Damit tragen die Slot-Rollen, die heute nur ein Attributzuschlag von höchstens ±8,5 sind
(Review 1.4), zum ersten Mal eine **positionale** Bedeutung — ohne dass ihr Rezeptzuschlag
angefasst wird. Das ist die billigste Form von 5.2 („Slot-Rollen werden Spielstile").

### 5.2 Messplan für jede Klasse-B-Idee

1. `node scripts/miss-alle-disziplinen.mjs 24 <disziplin>` vorher/nachher — muss bit-identisch
   sein, wenn die Idee nur die Ergebnisschicht berührt (sonst wurde mehr geändert als geplant).
2. `node scripts/messe-arena-einfluss.mjs <disziplin> 24` — dito (gestückelt 4 × n=6, s.
   Commit `908bdda3`, wegen des Chromium-OOM).
3. `node scripts/miss-arena-buehne-spiegel.mjs` — Heim:Gast nahe 50:50; bei Aufschlag-Start,
   Bahn-Geometrie und Staffelreihenfolge die eigentliche Gefahrenstelle.
4. Teamwertung in `spieleBuehneDuell()` gegen den echten Spielstand (`runArenaFixtures()`), wenn
   sich die Seitenwertung ändert (Staffel, Davis Cup, Brettpunkte mit ½).
5. Star/Paartreue mit Abstand über das **Brettergebnis** (nicht nur über `summe`), weil dort die
   Ideen wirken.
6. PPS-Referenz neu ziehen, wo `rundenN` sich ändert (T-F1).

### 5.3 Was ich bewusst nicht vorschlage

- **Keinen Paar-Rechner in dieser Runde** (5.1/5.3) — die Ideen oben kommen ohne ihn aus. Sollte
  Chris später S1/F2/T4 wollen, ist die Mess-Vorstudie aus dem Review der richtige erste Schritt.
- **Keine Waffenart-Wahl** (F4) — Degen bleibt, aus denselben Gründen wie im Review.
- **Kein Elo-Bonus/Malus** im Spielerwert — `arena-duell-recherche-fable.md` 4.3 hat das
  entschieden, und Kurzfassung 1 braucht es nicht.

---

## 6. Priorität und Aufwand

| Rang | Idee | Disziplin | Klasse | Aufwand | Was es bringt | Risiko |
|---:|---|---|---|---|---|---|
| 1 | **T-F1** Nullsummen-Punkt durch Vergleich, Aufschlag-Handicap, 13 Runden / bis 7 | Tennis | B | klein–mittel | Tennis bekommt Punkt, Aufschlag, Break, Ende — ohne Paar-Rechner | rho/Pp per Konstruktion null; Spiegel, PPS-Referenz |
| 2 | **F-F1** Fechtstaffel | Fechten | B | klein–mittel | eigenes Mannschaftsformat, Anker-Drama, Aufstellung als Entscheidung | rho/Pp null; Teamwertung, Spiegel |
| 3 | **T-F2** Davis Cup mit Doppel | Tennis | B | mittel | drittes eigenes Format, Nominierung als Entscheidung | Duett-Vorlage gemessen; jeSeite 2 prüfen |
| 4 | **F-F2** Mensur (Variante A) | Fechten | B | klein | Chris' Tauzieh-Bild wird Regel, Torment sichtbar | rho/Pp null; Häufigkeit kalibrieren |
| 5 | **S-F1** Remis als Mannschaftstaktik | Speed-Schach | B | klein | echtes Remis, Brettpunkte 1/½/0 | rho null; Teamwertung |
| 6 | **S-F2** letztes Brett entscheidet | Speed-Schach | A | klein | Regie-Spannung | keins |
| 7 | **F-F4** Perioden-Pause als Bild | Fechten | A | klein | Perioden bekommen ein Gesicht | keins |
| 8 | **T-F4** Ballwechsel-Länge, Break-Banner | Tennis | A | klein | macht T-F1 lesbar | keins |
| 9 | **T-F3** Belag je Spieltag | Tennis | B | klein–mittel | Wege lohnen sich saisonal verschieden | rho je Spiel mittel; nur nach T4 |
| — | F-F2 Variante B (torment-spezifisch) | Fechten | B | klein | stärkerer Nebenweg | Pp neu messen |

**Empfohlene Reihenfolge:** T-F1 zuerst (größte Lücke, kleinster Eingriff, und alles Weitere für
Tennis setzt darauf auf), dann F-F1 (das Format, das die drei am deutlichsten voneinander trennt),
dann T-F2 und F-F2 in einer Runde (beide klein, beide nur Ergebnisschicht), Speed-Schach zuletzt.

## 7. Offene Fragen an Chris

1. **Darf das Brettergebnis der „Leist"-Spalte widersprechen?** Alle Klasse-B-Ideen setzen darauf
   (Gewichtheben-Regel). Für Fechten ist es seit F1 so; für Tennis wäre es neu und im Sport normal.
2. **Fechtstaffel: sechs Gefechte à 9 Gänge (60 s) oder das reale 3-gegen-3 mit neun Gefechten
   (länger, mehr Ereignisse)?** Ich empfehle sechs für den Anfang.
3. **Tennis-Doppel: wer nominiert die KI-Seite?** Vorschlag: die zwei mit der höchsten
   Net-Pressure-/Serve-Passung, damit der Vorteil nicht einseitig bei Chris liegt.
4. **Remis im Schach: nur bei Führung/Gleichstand des Teams, oder auch als „Sicherheits-Remis"
   bei Rückstand?** Real nimmt ein zurückliegendes Team kein Remis; ich würde es so lassen.
5. **Belag (T-F3): pro Spieltag ausgewürfelt oder als sichtbare Heim-Eigenschaft je Team
   („Heimplatz Sand")?** Letzteres wäre spielerisch interessanter (Kaderbau gegen den eigenen
   Belag), aber eine Saison-Datenmodell-Frage, die über den Motor hinausgeht.

## Quellen

Im Repo: `public/mockups/battle-mode.engine.js` (`BUEHNE_ART["speed-schach"]` :14107,
`.tennis` :14293, `.fechten` :14417, `setz()` :14741, `art.duell`-Paarung :14861–14933, Duett-Fusion
:14975, `buehneTauziehVersatz` :14585), `lib/lineups/matchday-slot-roles.ts` (:161–168, :192–199,
:262–269), `lib/player-generator/official-discipline-weights.ts`,
`docs/design/buehne-duell-opus-konzeptreview-26-09.md` (Branch), `docs/design/broadcast-optik-
buehne-duell-27-09.md` (Branch), `docs/design/tennis-fechten-rollout-plan.md`,
`docs/design/tennis-fechten-buehne-umsetzung.md`, `docs/design/fechten-punkte-mehrrunden-konzept-
14-09.md`, `docs/design/fechten-aufwertungsplan-17-09.md`, `docs/design/tennis-feinschliff-
recherche-21-09.md`, `docs/design/speed-schach-fable-recherche-12-09.md`,
`docs/design/arena-duell-recherche-fable.md`, `docs/design/stand-aller-disziplinen.md`, Commit
`908bdda3` (Pp-Fix 27.09.), CLAUDE.md.

Sport-Referenzen (allgemein bekannte Formate, hier nur zur Einordnung, keine neuen Zahlen):
olympisches Mannschaftsfechten als Staffel (3 gegen 3, 9 Gefechte, Ziel 45, Anker); Davis Cup
(vier Einzel, ein Doppel, best of 5); Match-Tiebreak / Satz-Tiebreak-Zählung; Degen-Endlinienregel
(Überschreiten der hinteren Grenze = Treffer für den Gegner); Mannschaftsschach-Brettpunkte
1/½/0 mit Berliner Wertung. Aufschlag- und Belag-Quoten aus dem Opus-Review 4.2 übernommen.

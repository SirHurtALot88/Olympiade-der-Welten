# I-Spy: Knacken als Balken, Ortswahl, Schubsen (Knack-Motor V2, 17.11.)

Chris am 17.11. (Spracheingabe, wörtlich): „schubsen tacklen etc bitte auch einbauen, das kann ja die
rho noch mal verändern und sollte drin sein fürs messen. Unterlegene Spieler suchen sich dann lieber
einen neuen Ort an dem sie rätseln können und 3 Sterne knacken soll länger dauern als 1 Stern knacken,
hoffe das berücksichtigst du -> und ein Spieler der besser ist füllt den Balken zum Knacken dann
deutlich schneller, wenn es ihm liegt."

Kurz: Alle vier Punkte sind jetzt Teil der Wertung, nicht nur der Darstellung. rho je Spiel steigt von
**0,776 auf 0,845** (n=48, kaderfest), Pp liegt bei **16,4 / 14,0** (vorher 14,6 / 15,0). Der
Wertungs-Fingerabdruck bewegt sich absichtlich, und zwar nur in den drei I-Spy-Einträgen:
**GESAMT e80babacb68c → b47c1228ac2c** (gemessen auf dem Stand vor #1549; auf dem heutigen main siehe Nachtrag am Ende). Der alte Motor bleibt als Messschalter
(`window.__arena.ispyMotor("alt")`) erhalten und rechnet bit-identisch wie vorher.

Code: `public/mockups/battle-mode.engine.js`, Block „I-SPY KNACK-MOTOR V2“ (`ISPY_V2`,
`ispyV2Waehle`, `ispyV2Kontakt`, `ispyV2Fortschritt`) und `baueSchatzsuche()`.

---

## 1. IST-Analyse (Stand origin/main 0c39221f)

**(a) Knackdauer nach Sternen.** Es gab keine Dauer. Jeder Tick war ein einzelner Knackwurf mit
`p = clamp(0,08; 0,95; 0,15 + 0,011·K − 0,22·(Stufe−1) + Fortschritt)` (`ispyKnackChance`). Ein
Tresor dauerte nur über die kleinere Chance „länger“: bei K=60 rechnerisch 1,2 / 1,7 / 2,7 Versuche
für 1/2/3 Sterne, bei K=85 nur 1,05 / 1,2 / 1,55. Außerdem wählte jeder Spieler jeden Tick neu
(`ispySeiteTick`, EV-Sortierung), er blieb also nie an einer Truhe. Ein Fehlversuch gab trotzdem
55 % des Punktwerts (`ISPY_TEILPUNKTE_ANTEIL`), am Tresor also 25 Punkte je Tick, auch ohne Erfolg.

**(b) Füllrate nach Attribut.** Auch die gab es nur als Bild. Der Verweilbalken
(`ispyVerweilFortschritt`) lief in einem Tick von 0 bis 100 %, und der Unterschied „stark/schwach“
war eine einzige Schwelle (`ISPY_VIZ_STARK_SCHWELLE = 60`: Ende bei 60 % statt 80 % der Bildzeit).
Mechanisch wirkte der Sub-Skill nur über die Chance `p`, die bei 0,95 gedeckelt ist. Ab K≈73 knackt
jeder eine Notiz gleich schnell. Primär- und Nebenweg gab es schon (`ispyBesterWeg`, Nebenweg mit
65 % Punktwert an den beiden Tresoren).

**(c) Ortswahl.** Es gab keine. Mangels Verweilen gab es nichts zu verlassen. Der einzige
Ausweichmechanismus war „belegt“: ein Teamkollege, der in der NERVEN-/Kompetenz-Reihenfolge früher
dran war, nahm die Truhe für diesen Tick weg. Persönlichkeit spielte in I-Spy keine Rolle.

**(d) Schubsen.** Es gab nur die Darstellung. Seit 16.11. stehen beide Teams in einer Halle an
Doppelmöbeln (PR #1533). `ispyStandXY()` sagt im Kommentar ausdrücklich: „SCHUBSEN (später …)“. Das
Kontakt-Konzept (`kontakt-persoenlichkeit-16-11.md` 4.4, 6.1) sah für I-Spy „nur Theater“ vor, weil
rho damals unter der Schranke lag. `fable-kontakt-interaktionen-16-11.md` Abschnitt 4 skizzierte
zusätzlich Weg B (Kontestation) als Messversuch. Im Motor gab es keine Zeile Kontakt-Code für I-Spy.
`BUEHNE_ART["i-spy"].kontakt` war `null` ohne Wirkung. Die Messskripte konnten Kontakt deshalb nicht
mitmessen. Der Schalter `--kontakt=` existiert (`scripts/lib/rangtreue-messung.mjs`), griff in
I-Spy aber ins Leere.

## 2. Ist / Soll / gebaut

| Punkt | Ist (bis 17.11.) | Soll (Auftrag) | Gebaut (V2) |
|---|---|---|---|
| Knackdauer | ein Wurf je Tick, Stufe senkt nur `p` | 3★ spürbar länger als 1★ (Start 1 : 1,8 : 3) | Aufwand je Truhe 0,6 / 1,08 / 1,8 Tempo-Einheiten (1 : 1,8 : 3). Gemessen 1,0–1,6 / 1,3–1,8 / 2,0–3,0 Züge je geknackter Truhe |
| Füllrate | Bild mit einer Schwelle bei K=60 | besserer Spieler, dem es liegt, deutlich schneller | Tempo = (K_eff/50)^1,3. Primär-Sub-Skill 80 statt 50: 1,55-mal so schnell. Eigener Paradeweg gegen schwächsten Weg (80 vs. 40): 1,7-mal |
| Primär-/Nebenweg | Nebenweg 65 % Punkte | beibehalten, „mehrere Wege“ | unverändert 65 % Punkte, jetzt mit eigenem Tempo je Weg; der für den Spieler lohnendere Weg gewinnt |
| Ortswahl | Neuwahl jeden Tick | Unterlegene suchen sich einen neuen Ort; Persönlichkeit | Ortswert = erwartete Punkte je Tick (Restaufwand, Laufweg, Restzeit). Stärkere Teamkollegen dürfen übernehmen. Haftfaktor aus der Persönlichkeit; Verdrängte müssen den Ort wechseln |
| Schubsen | nur geplant (Theater) | Kontakt-Konzept Stufen 1–3, eigener Strom, Schutzregeln, **aktiv in Produktion** | `ispyV2Kontakt`, Stufen 1–3 scharf (`ISPY_KONTAKT_STANDARD`), alle neuen Würfe aus `kontaktRr()`, abschaltbar für gepaarte Messung |
| Darstellung | Balken über einen Tick | echter Balken | Balken zeigt `r.fv → r.fn` (echter Truhenstand), Glut am Fach folgt dem Balkenstand. Stoß-Versatz und Schwebetext beim Schubser. Tickerzeilen nennen Balkenstand, Ortswechsel und Schubser |

## 3. Formeln

Alle Werte stehen in `ISPY_V2` / `ISPY_KONTAKT` und lassen sich für Messungen über
`window.__arena.ispyParameter({v2:{…},kontakt:{…}})` setzen.

**Aufwand.** `E(Stufe) = {1:1,0; 2:1,8; 3:3,0}[Stufe] · 0,6`. Der Fortschritt bleibt an der Truhe
(seitengebunden), bis sie geknackt ist, auch wenn der Spieler wechselt.

**Tempo je Zug.**

    K_eff   = 0,6 · K_Weg + 0,4 · (LOGIK + MENSCHENKENNTNIS + FINGERFERTIGKEIT + 3·SPUERSINN) / 6
    tempo   = clamp(0,12; 4; (K_eff / 50)^1,3) · Ermüdung
    Δ       = tempo · (0,85 + 0,3·w) · (0,65 wenn neu angekommen) · Kontaktfaktor
              w = (rr()+rr())/2, derselbe Wurf wie bisher; Ermüdung unverändert (AUSDAUER)

`K_Weg` ist der Sub-Skill des gewählten Wegs (Primär: native Rätselart; Nebenweg nur an Tresoren mit
`neben`). Der Kompetenzanteil ist kalibriert, nicht erfunden (Abschnitt 4): ohne ihn gewannen
Spezialisten zu viel gegen den Eignungsbesten.

**Überschuss.** Bleibt nach dem Knacken Tempo übrig, fließt es in die nachgefüllte Truhe am selben
Ort, höchstens 90 % von deren Aufwand. Ohne diese Regel verfiel gerade beim Starken an kleinen Truhen
Zeit, und „doppelt so schnell“ wäre unsichtbar geblieben.

**Punkte.** Spur-Punkte `0,7 · Punktwert · Weg-Faktor · ΔAnteil` je Zug, die restlichen 30 % beim
Knacken. Die Summe je Truhe ist der volle Punktwert (10 / 25 / 45, Nebenweg 65 %). Ganzzahlig; der
Rundungsrest wird je Spieler mitgeführt.

**Ortswert** (`ispyWert`): mit Restaufwand `R`, Laufweg `l` (0 am eigenen Ort, sonst 0,35) und
Restzeit `T`:

    t_nötig = R/tempo + l
    Wert    = PW · (0,7·R/E + 0,3) / max(1, t_nötig)        wenn t_nötig ≤ T
    Wert    = PW · 0,7 · tempo/E · (T−l)/T                    sonst (nur noch Spur-Punkte)

Gewählt wird in der bestehenden Reihenfolge (30 % NERVEN + 70 % Kompetenz, unverändert). Der eigene,
angefangene Ort wird mit `1 + 0,4·(100 − aw)/100` multipliziert. Damit bleibt ein Draufgänger
(aw 20) mit +32 % trotzig, ein Opportunist (aw 65) wechselt mit +14 % früh, ein Schleicher (aw 90)
mit +4 % fast sofort. Traits verschieben `aw` wie im Kontakt-Konzept. Ein stärkerer Teamkollege darf
eine angefangene Truhe übernehmen (ihr Balken bleibt); der Unterlegene muss weiter. Kein neuer Wurf.

**Schubsen** (`ispyV2Kontakt`, je Doppelmöbel, an dem in diesem Zug beide Seiten arbeiten):

1. Der Drängler ist der mit der höheren Kontaktbereitschaft `kb`, bei Gleichstand der Ankommende,
   sonst Los (`kontaktRr`). Opfer in der Schonfrist (2 Züge nach einem Treffer) sind tabu. In den
   letzten 2 Zügen gibt es keinen Kontakt.
2. Er will mit `kontaktRr() < kb/100`. Seine Aussicht ist `p = D_A/(D_A+D_V)` mit
   `D = DURCHSETZEN` (neuer Sub-Skill: torment 65, spirit 20, will 15, nur Matrix-Attribute). Unter
   `pMin` lässt er es (Stufe 2).
3. Das Opfer weicht mit `kontaktRr() < min(0,95; aw/100 · 2p)` aus. Der Unterlegene weicht also eher.
   Es zahlt dann 20 % dieses Zugs und muss den Ort wechseln; der Drängler zahlt 10 %.
4. Sonst wird das Duell mit `kontaktRr() < p` entschieden:
   - **Treffer:** das Opfer verliert `60 % · h` dieses Zugs (`h = 0,75 + ha/200`) und wird
     verdrängt; der Drängler zahlt 10 %. Ab dem 4. Treffer je Spiel wirkt er nur halb und verdrängt
     nicht mehr (Deckel).
   - **Foul** (Stufe 3, `kontaktRr() < 0,04·(ha/50)·((100−di)/50)`): der Drängler verliert 80 %, das
     Opfer nichts.
   - **Hänger** (abgewehrt, `|p−0,5| < 0,06`): beide verlieren 30 %.
   - **Abgeprallt:** der Drängler verliert `50 % · h` (Mini-Stun).

Die Währung ist nur Zeit, also der Fortschritt dieses Zugs. Kontakt kostet nie Punkte und nie einen
schon erarbeiteten Balken (Schutzregel 1). Zähler laufen über `kontaktZaehle` (WeakMap) und sind über
`ispyProbe` lesbar. Standard ist `ISPY_KONTAKT_STANDARD = {stufe:3}`.
`kontaktFlags({"i-spy":{stufe:0}})` bzw. `--kontakt=i-spy:0` schaltet ab.

**Zufall.** `rr()` zieht je Seite und Zug den Reaktionswurf und je Teilnehmer und Zug genau drei
Werte (Sicht, zweimal Zufall), unabhängig von jedem Ausgang. Jeder neue Wurf kommt aus `kontaktRr()`.
Die anderen 19 Disziplinen sind bit-identisch (Abschnitt 6).

## 4. Kalibrierung (Gittersuche, kaderfest, n=96 wo nicht anders vermerkt)

| Schritt | Kontakt | rho je Spiel | Saison | Befund |
|---|---|---:|---:|---|
| erster Entwurf (Exp. 1,6, Aufwand ×1, ±50 % Zufall, Inhaber hält Truhe, kein Überschuss; n=24) | an | 0,377 | 0,517 | ohne Kontakt 0,427. Inhaber blieb nach dem Knacken an „seinem“ Ort kleben, die Rätselart des Orts entschied |
| Inhaberschaft endet beim Knacken (n=24) | aus | 0,663 | 0,692 | — |
| Stärkerer Teamkollege darf übernehmen (n=24, Exp. 1,0) | aus | 0,728 | 0,832 | Inhaber-Reservierung kostet Validität |
| Gitter Aufwand 0,6–1,0 / Zufall / Teilanteil, ohne Überschuss | aus | 0,72–0,76 | 0,83–0,92 | Plateau; Zufallsbreite fast wirkungslos |
| + Überschuss in die nächste Truhe, Aufwand 0,6 | aus | 0,804 | 0,916 | Quantisierung war der Verlässlichkeitsfresser |
| + Kompetenzanteil 0,4 (Exp. 1,0, Aufwand 0,5) | an | 0,848 | 0,909 | Star Rang 1 45,0 %, Top 2 69,6 % |
| + SPÜRSINN 1-fach in der Kompetenz | an | 0,847 | 0,944 | Star 50,0 / 72,1 % |
| **gewählt:** Exp. 1,3, Aufwand 0,6, Kompetenzanteil 0,4, SPÜRSINN 3-fach | an | **0,852** | 0,923 | Star 53,5 / 79,2 %, Paartreue 98,8 % |
| zum Vergleich: Inhaber hält Truhe (Exp. 1,0, Aufwand 0,5, Kompetenz 0,4) | an | 0,798 | 0,874 | verworfen |
| zum Vergleich: Kontakt-Dosis 2 (Stand SPÜRSINN 1-fach) | an | 0,854 | 0,902 | Spannweite 0,129 statt 0,092, keine Verbesserung |

Star- und Paarwerte dieser Tabelle stammen aus der Kalibriersonde (gleiche Rohdaten wie
`miss-star-paartreue.mjs`, Rang ohne Gleichstandsregel); die Abnahmezahlen in Abschnitt 5 kommen aus
den offiziellen Skripten.

Pp (`messe-arena-einfluss.mjs i-spy 48`, Ströme 0 / 10 000 000) der Kandidaten:

| Kandidat | Pp | Bemerkung |
|---|---|---|
| Kompetenz ohne SPÜRSINN | 10,3 / — | Star zu schwach (45 / 70 %) |
| SPÜRSINN 1-fach, DURCHSETZEN torment 50 / will 25 / determination 25 | 13,8 / 16,4 | determination +2,0/+2,8 |
| SPÜRSINN 1-fach, DURCHSETZEN torment 65 / spirit 20 / will 15 | 12,7 / 14,9 | Star 49,6 / 71,0 % |
| **SPÜRSINN 3-fach (gewählt)** | **16,4 / 14,0** | dritter Strom (20 000 000): 19,2 (alt: 21,8) |
| SPÜRSINN 3-fach, DURCHSETZEN torment 55 / speed 25 / spirit 20 | 18,3 / 27,3 | verworfen |
| SPÜRSINN 2-fach | 14,0 / 22,5 | verworfen |

Zur Einordnung: die Pp-Zahl streut je Saatstrom um ±5 bis ±10 bei praktisch gleicher Mechanik. Die
gewählte Fassung besteht auf beiden Abnahmeströmen und auf einem dritten; die Rangfolge der
Attribute bleibt stabil. intelligence liegt wie im alten Motor rund +4 bis +6 über der Matrix,
speed rund −3 darunter.

## 5. Abnahme: alt / neu

Kaderfamilie 15.11. (`data/generated/kaderfamilie-live-save.json`), Median über 5 Paarungen.

| Größe | alt (main 0c39221f) | neu (V2, Kontakt an) | neu, Kontakt aus (gepaart) |
|---|---:|---:|---:|
| rho je Spiel, n=24 | 0,779 (Spannw. 0,212) | **0,853** (0,080) | — |
| rho je Spiel, n=48 | 0,776 (0,199) | **0,845** (0,088) | 0,866 (0,092) |
| rho Saison, n=48 | 0,888 | 0,923 | 0,944 |
| Star auf Rang 1, n=24 / n=48 | 45,0 / 47,5 % | 45,8 / **51,7 %** | — / 50,0 % |
| Star in den ersten zwei, n=24 / n=48 | 75,0 / 76,7 % | 78,3 / **78,8 %** | — / 74,6 % |
| Star auf dem letzten Rang | 0 % | 0 % | 0 % |
| Paartreue ≥ 15 Punkte, n=48 | 94,9 % | **98,6 %** | 98,7 % |
| Pp, Strom 0 / 10 000 000 | 14,6 / 15,0 | **16,4 / 14,0** | — |
| Pp, dritter Strom 20 000 000 | 21,8 | 19,2 | — |
| Kadergröße 2 / 3 / 4 / 5 je Seite (n=24) | 0,767 / 0,787 / 0,747 / 0,770 | 0,900 / 0,855 / 0,885 / 0,870 | — |
| Spiegeltest 480 Läufe (Heim:Gast) | 247 : 231 | 236 : 243 | — |

**Kontakt gepaart.** Kontakt kostet rho 0,021 (0,866 → 0,845). Je Paarung sind es −0,006, −0,001,
−0,006, +0,013 und −0,021, also 4 von 5 innerhalb −0,03 (Kriterium A des Kontakt-Konzepts).
Star Rang 1 und Top 2 steigen mit Kontakt (50,0 → 51,7 %, 74,6 → 78,8 %).

**Dynamik** (Diagnose-Sonde `ispyProbe`, 40 Spiele je Paarung, je Paarung ein Wert):

| Größe | Werte über die 5 Paarungen |
|---|---|
| Züge je geknackter Truhe, 1★ (Primär-Sub-Skill ≥ 65 / ≤ 45) | 1,02–1,04 / 1,32–1,65 |
| Züge je geknackter Truhe, 2★ | 1,29–1,59 / 1,52–1,77 |
| Züge je geknackter Truhe, 3★ | 1,99–2,19 / 2,06–3,00 |
| Schubser je Spiel: Treffer / ausgewichen / abgeprallt / Hänger / Foul | 2,7–11,1 / 2,3–25,2 / 0,7–5,3 / 0,4–5,3 / 0–1,4 |
| Verdrängt je Spiel (Ortswechsel erzwungen) | 3,9–34,5 |
| Kontaktsaldo gegen Eignung (Spearman) | +0,16 / +0,43 / +0,17 / −0,27 / +0,01 |

Der Rechenwert für die reine Arbeitszeit (Aufwand/Tempo, ohne Teamkollegen und Laufweg): K_eff 70 →
0,4 / 0,7 / 1,2 Züge; K_eff 50 → 0,6 / 1,1 / 1,8; K_eff 35 → 1,0 / 1,7 / 2,9. Gemessen fällt das
Verhältnis kleiner aus, weil ein Zug die kleinste Einheit ist. Eine Notiz dauert für jeden mindestens
einen Zug; der Vorsprung des Starken steckt dann im Überschuss, der in die nächste Truhe fließt.

**Persönlichkeit, kontrafaktisch** (alle Spieler auf einen Typ gezwungen, `kontaktPersZwang`, zwei
Paarungen je 40 Spiele). Freiwillige Wechsel je Spieler und Spiel, Anteil der Züge am selben Ort:

| Typ (Haftfaktor) | coldsteel-direlegion | mortalsin-natureswrath |
|---|---|---|
| Bollwerk (+34 %) | 5,5 · 20,8 % | 6,2 · 23,0 % |
| Draufgänger (+32 %) | 5,8 · 19,4 % | 6,2 · 22,4 % |
| Duellant (+24 %) | 5,9 · 19,1 % | 6,6 · 21,3 % |
| Opportunist (+14 %) | 6,1 · 17,2 % | 7,0 · 18,0 % |
| Schleicher (+4 %) | 6,7 · 16,7 % | 7,7 · 17,9 % |

Die Ordnung ist in beiden Paarungen monoton. Der Effekt ist mit rund 20 % gewollt klein, damit er
die Rangtreue nicht verbiegt. Mit echten Persönlichkeiten überdecken Rolle und Sub-Skills ihn in
der Einzelstatistik.

## 6. Wertungs-Fingerabdruck

`node scripts/pruefe-wertung-fingerabdruck.mjs`:

- vorher (origin/main): **GESAMT e80babacb68c (75 Einträge)**
- nachher: **GESAMT b47c1228ac2c (75 Einträge)**
- `diff`: nur die Zeilen 37–39 (`spiele i-spy 1|7|42`) und die GESAMT-Zeile; alle anderen 72
  Einzel-Hashes sind identisch.
- Gegenprobe: dieselbe Datei mit `ISPY_MOTOR="alt"` ergibt wieder **e80babacb68c**, Zeile für Zeile
  identisch. Der neue Sub-Skill DURCHSETZEN und die Probe-Felder berühren den alten Pfad nicht.

Nachgezogen: `CLAUDE.md` (Abschnitt Fingerabdruck), Kopfkommentar von
`scripts/pruefe-wertung-fingerabdruck.mjs`, `data/generated/disziplin-abnahme.json` (Eintrag
i-spy und Beobachtungsliste), `docs/design/stand-aller-disziplinen.md` (34. Nachtrag),
`tests/disziplin-abnahme-guard.test.ts`. Den Test belegt eine Bisektion: der alte Test gegen die
neue Tabelle scheitert genau an `expected 0.845 to be less than 0.8` im I-Spy-Fall. Showcase ist
dort unverändert. Die PPS-Referenz `data/generated/i-spy-pps-referenz.json` ist neu gezogen
(`ziehe-buehne-pps-referenz.ts i-spy` gegen das live-save-Abbild vom 17.11.): der Median des rohen
Werts bei 6 je Seite fiel von 747 auf 561,5. Die Punkteskala hat sich verschoben, ohne neue Ziehung
wäre die individuelle PPS verzerrt.

## 7. Darstellung (ohne Wertungswirkung)

- **Verweilbalken.** Er zeigt `r.fv → r.fn`, den echten Truhenstand vor und nach dem Zug. Ein
  Tresor braucht sichtbar mehrere Züge, ein Starker füllt ihn je Zug weiter.
- **Glut am Fach.** Sie folgt dem Balkenstand der Truhe statt der Fehlserie.
- **Schubser.** Schwebetext am Fach („weggeschubst!“, „weicht aus“, „hält stand“, „Gerangel“,
  „Foul!“) und ein kurzer Stoß-Versatz vom Standplatz weg. Es gibt keine neue Pose und keine
  PixelLab-Bestellung.
- **Reaktion ohne Fund.** Ein Zug ohne Knacken ist Fortschritt: kein Kopfschütteln und kein
  Fehl-Ton mehr, außer der Zug brachte unter 15 % Balken.
- **Ticker.** „X arbeitet am Tresor (Logik, Stufe 3): 40 % → 72 % — schubst Y weg. +9“, dazu
  „sucht sich einen besseren Ort“ bzw. „weicht aus“ bei Ortswechseln. Notizen und Akten stehen nur
  noch im Protokoll. Ein Führungswechsel zählt nur bei einem geknackten Tresor als großer Moment.
  `verify-i-spy-ticker-paket-07-10.mjs` misst 29,1 Zeilen/min (Schranke 30, alt ebenfalls 29,1);
  ohne diese Filter waren es 34,7. `verify-ispy-fallakte-02-10.mjs` läuft ohne Seitenfehler.

## 8. Risiken

1. **Pp streut je Saatstrom stark.** Kleine Rezeptvarianten derselben Mechanik lagen zwischen 12,7
   und 27,3 je Strom. Die Abnahme besteht (16,4 / 14,0, dritter Strom 19,2), aber der Abstand zur
   25 ist auf einem ungünstigen Strom nicht groß. Vor einer weiteren Rezeptänderung drei Ströme
   messen.
2. **Kontaktsaldo gegen Eignung ist nicht überall positiv.** Die Werte je Paarung sind +0,43 bis
   −0,27, Median +0,16. Kriterium K des Kontakt-Konzepts („≥ 0“) hält im Median, nicht in jeder
   Paarung. Der Duellwert DURCHSETZEN liest zu 65 % torment (Matrix 17); Kontaktbereitschaft und
   Ausweichen kommen aus der Persönlichkeit, nicht aus der Eignung.
3. **Kontakthäufigkeit schwankt je Kader stark** (2,7 bis 11 Treffer je Spiel), je nachdem, wie
   viele Draufgänger am selben Ort zusammentreffen. Der Deckel (3 volle Treffer je Opfer) und die
   Schonfrist begrenzen das je Opfer, nicht je Spiel.
4. **Die Zugzahl ist die kleinste Einheit.** Das Verhältnis 1★ : 3★ liegt gemessen bei etwa 1 : 2
   Zügen, nicht 1 : 3. Die volle Arbeitszeit-Relation 1 : 1,8 : 3 steckt im Aufwand und ist am
   Balken sichtbar; in ganzen Zügen wird sie abgerundet. Größere Aufwände (Skala 0,7–1,0) kosteten
   gemessen 0,01–0,07 rho.
5. **Persönlichkeitswirkung auf die Ortswahl ist klein** (rund 20 % zwischen den Extremen). Das ist
   gewollt, damit sie die Rangtreue nicht verbiegt, im Spiel aber nur in der Summe sichtbar.
6. **Die Raumwahl (I-1) wurde nicht nachgemessen.** Standard bleibt Werkstatt; „auto“ mit dem neuen
   Motor ist nicht gemessen.
7. **Die PPS-Referenz stammt aus einem neueren Spielstand** als die alte (31.10. statt 19.8.). Das
   ist für diesen Schritt beabsichtigt (frischester Stand), verschiebt die Referenz aber zusätzlich
   zur Mechanik.

## 9. Offene Fragen an Chris

1. Soll ein Teamkollege eine angefangene Truhe übernehmen dürfen (gebaut, weil es Rangtreue bringt:
   0,848 gegen 0,798), oder soll der Inhaber sie halten (`inhaber:true`)?
2. Reicht „3★ dauert etwa doppelt so viele Züge, der Balken zeigt dreimal so viel Arbeit“, oder
   sollen Tresore auch in ganzen Zügen dreimal so lange dauern (kostet rho, s. Risiko 4)?
3. Kontakt ist scharf (Stufe 3 inklusive Foul und Hänger). Soll es in I-Spy bei Stufe 3 bleiben,
   oder nur Stufe 1–2 (gemessen 0,800 bzw. 0,805 bei einem früheren Kalibrierstand gegen 0,808 mit
   Stufe 3, also kein Unterschied)?

## 10. Nachmessen

    node scripts/miss-alle-disziplinen.mjs 48 i-spy
    node scripts/miss-alle-disziplinen.mjs 48 i-spy --kontakt=i-spy:0
    node scripts/miss-star-paartreue.mjs 48 i-spy
    node scripts/messe-arena-einfluss.mjs i-spy 48
    node scripts/messe-arena-einfluss.mjs i-spy 48 --saat-versatz=10000000
    node scripts/pruefe-wertung-fingerabdruck.mjs
    node scripts/miss-arena-buehne-spiegel.mjs 480 i-spy
    node scripts/verify-i-spy-ticker-paket-07-10.mjs

Den alten Motor zum Vergleich ruft man im Browser über `window.__arena.ispyMotor("alt")` auf.
Messskripte kennen dafür keinen Schalter; man nimmt eine Kopie der Seite mit `ISPY_MOTOR="alt"` und
übergibt sie über `OLY_SEITE` bzw. das Pfadargument.


## Nachtrag beim Aufsetzen auf main (17.11., nach #1549)

Die Arbeit wurde auf den Stand nach „Kontakt im klassischen Spurt scharf“ (#1549, GESAMT `7c9257b4435c`) neu aufgesetzt.
Kombinierter Fingerabdruck dort: **GESAMT d09e10bb872c (75 Einträge)**. Gegenüber `7c9257b4435c` ändern sich nur die drei
`spiele i-spy`-Zeilen (`1bc2c9096773`, `2eda83dcc23c`, `a9caf1fa6ad7` für 1/7/42); `spiele spurt 1` (`870e28b88ab3`) und
`spiele spurt 7` (`3732ee6cd899`) stehen unverändert auf den Werten von #1549. Rückweg: `window.__arena.ispyMotor("alt")`
ergibt `7c9257b4435c`.

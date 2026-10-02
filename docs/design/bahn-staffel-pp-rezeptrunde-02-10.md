# Bahn-Staffel: Pp-Kalibrierungsrunde (Task #40, 02.10.)

## Auftrag und erster Befund: die zitierte Quelle stimmt nicht, die Zahl schon

Der Auftrag berief sich auf einen "Fünfzehnter Nachtrag 02.10." in
`docs/design/stand-aller-disziplinen.md` und auf PR #1109 als Beleg dafür, dass Staffels
Pp-Abweichung von 61,9 bereits zuverlässig bei n=48 gemessen sei. Beides stimmt nicht:

- `stand-aller-disziplinen.md` geht nur bis zum **Dreizehnten** Nachtrag (29.09.); es gibt
  keinen Fünfzehnten. Die dort dokumentierte Staffel-Pp-Zahl ist **60,4 bei n=24**, explizit
  als "strukturell unsicher" markiert, mit der eigenen Empfehlung des Mess-Skripts, mit
  n=144 statt n=24 zu messen (Abschnitt "Staffel/Takeshi's Castle", Zwölfter Nachtrag).
- PR #1109 ("Bahn: Alternativ-Rechner 'Was hätte der andere Plan gebracht?'", Task #27) hat
  mit einer Pp-Messung nichts zu tun — es ist der Alternativ-Rechner für die Bahn-HUD.

Trotzdem: **die Zahl 61,9 selbst ist real.** Bestätigungsmessung auf dem aktuellen `main`
(nach #1109/#1115/#1116/#1119/#1120/#1121, Commit `83bfa315`):

| Messung | Wert |
|---|---|
| Pp, n=48, Saat 1 | **61,9** |
| Pp, n=48, Saat 2 (Versatz 10.000.000) | **61,9** |
| Pp, n=144 | 62,9 |
| rho/Spiel, n=24 (kaderfest, Median über 5 Paarungen) | 0,898 |
| rho/Spiel, n=48 | 0,888 |

Die alte "strukturell unsicher"-Warnung galt der Messmethodik von vor dem 26.09.
(Mutator-Umbau/je-Lauf-Ziehung); inzwischen ist die Zahl über n=48/144 und zwei Saatströme
stabil auf ±1 Pp. Die Aufgabe selbst (Rezeptkalibrierung) ist also berechtigt, auch wenn
ihre Begründung im Prompt falsch zitiert war.

## Ursache

`BAHN_ART.staffel`s Menge-aus-Eignung-Skalierung (gated hinter `art.staffel`, getrennt von
Takeshis/Climbings `art.mengeAusEignung`) bildete den Normierungsnenner `m` bisher nur aus
zwei der sieben Sub-Skills:

```js
const m = 0.73*w.ANTRITT + 0.27*w.ENDTEMPO;   // nur Speed/Spirit/Stamina/Will
const f = m>0 ? eigW/m : 1;
for (const k in w) w[k] = Math.round(Math.max(1, Math.min(100, w[k]*f)));
```

`eigW` (der Zähler) ist über die volle, gesperrte Matrix gewichtet (neun Attribute:
Speed 24, Stamina 16, Spirit 16, Awareness 12, Charisma 10, Dexterity 8, Will 8,
Determination 4, Health 2). `ANTRITT`/`ENDTEMPO` (der Nenner) lesen aber nur
Speed/Spirit/Stamina/Will — Awareness, Dexterity, Charisma, Determination und Health
sitzen NUR im Zähler. Jede Änderung an einem der vier gemeinsamen Attribute kürzt sich in
`f = eigW/m` grossteils weg; jede Änderung an einem der fünf nur-im-Zähler-Attribute wird
dagegen ungedämpft durchgereicht. Gemessen: Awareness 21,2 % (Matrix 12), Dexterity 15,8 %
(Matrix 8), Determination 10,4 % (Matrix 4) — alle drei weit über ihrem Matrixgewicht —
während Speed (8,9 % gegen Matrix 24) und Spirit (3,5 % gegen Matrix 16), die beiden
höchstgewichteten Attribute der Disziplin, durch die Zähler/Nenner-Kürzung am stärksten
gedämpft werden.

## Fix (gewählt)

`m` ist jetzt wie bei Takeshi/Climbing (`art.mengeAusEignung`) das **gleichgewichtete
Mittel aller sieben Sub-Skills** statt nur der zwei Tempo-Werte — ein eigenes `if`, nicht
derselbe Gate, damit Spurt/Zeitfahren/Climbing/Takeshi unberührt bleiben. Dann sitzt jedes
Attribut, das in irgendeinem Sub-Skill vorkommt, auch im Nenner, und die Kürzung trifft
alle neun matrixrelevanten Attribute ähnlich statt nur vier.

```js
const ks = Object.keys(w);
const m = ks.reduce((s,k) => s+w[k], 0) / ks.length;
```

## Vorher/Nachher

| Attribut | Matrix | Vorher (n=48, Saat 1 / Saat 2) | Nachher (n=48, Saat 1 / Saat 2) |
|---|---:|---:|---:|
| speed | 24 | 8,9 / 8,8 | 34,7 / 35,4 |
| stamina | 16 | 12,7 / 12,8 | 23,6 / 24,7 |
| spirit | 16 | 3,5 / 4,0 | 14,6 / 15,1 |
| awareness | 12 | 21,2 / 20,8 | 7,6 / 7,4 |
| charisma | 10 | 11,6 / 12,4 | 3,1 / 2,2 |
| dexterity | 8 | 15,8 / 16,1 | 4,9 / 3,7 |
| will | 8 | 13,9 / 12,8 | 6,9 / 7,0 |
| determination | 4 | 10,4 / 10,9 | 4,5 / 4,4 |
| health | 2 | 1,9 / 1,5 | 0 / 0 |
| **Pp-Abweichung** | | **61,9 / 61,9** | **37,7 / 41,1** |

| Kennzahl | Vorher | Nachher |
|---|---:|---:|
| rho/Spiel, n=24 (Median, kaderfest) | 0,898 | 0,893 |
| Spannweite, n=24 | 0,081 | 0,208 |
| rho/Spiel, n=48 (Median) | 0,888 | 0,895 |
| Spannweite, n=48 | 0,092 | 0,222 |
| rho Saison, n=24 / n=48 | 0,944 / 0,944 | 0,923 / 0,930 |

rho bleibt in beiden n deutlich über der 0,80-Schranke und bewegt sich innerhalb des
Kaderrauschens (die Spannweite wächst, der Median bleibt im selben Band) — die
Kalibrierung ist aus rho-Sicht neutral bis leicht positiv.

**Ziel <=25 Pp nicht erreicht.** 37,7/41,1 ist eine Verbesserung um rund 38 % gegenüber
61,9, aber keine vollständige Schliessung. Siehe "Weitere Versuche" unten für die
Diagnose, warum, und was eine Folgerunde bräuchte.

## Weitere Versuche (verworfen, dokumentiert)

**(a) Gewichtetes statt gleichgewichtetes Mittel.** Ein per nicht-negativen kleinsten
Quadraten gelöstes Gewichtsset für die sieben Sub-Skills (Ziel: `m`s eigene
Attribut-Zusammensetzung an die Matrix-Anteile annähern; Gewichte
`{ANTRITT:0.271,ENDTEMPO:0.128,TECHNIK:0.165,WENDIGKEIT:0.121,STEHEN:0.106,WUCHT:0.170,
ROBUST:0.039}`) verschlechterte auf **47,3/50,1 Pp**. `m`s eigene Attributzusammensetzung
ist kein guter Stellvertreter für den tatsächlich simulierten Einfluss — siehe (c).

**(b) Speed aus WENDIGKEIT/WUCHT entfernen** (um Speed aus ANTRITT/ENDTEMPO von
Awareness/Dexterity/Charisma in WENDIGKEIT/WUCHT zu entkoppeln, kombiniert mit dem
gleichgewichteten Mittel): verschlechterte auf **50,3/49,2 Pp**. Speed kommt im
Original-Rezept über VIER der sieben Sub-Skills herein; das senkt (nicht hebt) seine
Präsenz im Nenner `m` gegenüber seinem Matrixgewicht im Zähler — es schwächt die Dämpfung
auf Speed, statt sie zu stärken. Gegenteil der erwarteten Richtung.

**(c) Rezeptanteile direkt umschichten** (Speed/Stamina-Anteile in ANTRITT/ENDTEMPO/
STEHEN/ROBUST senken, Awareness/Dexterity/Charisma/Health/Determination-Anteile in
TECHNIK/WENDIGKEIT/STEHEN/ROBUST erhöhen, alles innerhalb bestehender Sub-Skills, kein
neues Attribut): **42,0 Pp**, ebenfalls schlechter — UND gegenläufig: Dexterity und
Charisma sanken trotz höherem Rezeptanteil (2,6/2,8 % bzw. 2,2/1,8 % gegen vorher 4,9/3,7
bzw. 3,1/2,2 %).

**Gemeinsamer Befund aller drei verworfenen Versuche:** TECHNIK (Wechsel) und WENDIGKEIT
(Kurve) wirken nur über den **Schnitt zweier Läufer** (`(u.TECHNIK+naechster.TECHNIK)/2`)
und nur an den höchstens zwei von fünf Wechseln bzw. der eigenen Kurve, an denen ein
einzelner Läufer beteiligt ist — eine strukturelle Verdünnung, die ANTRITT/ENDTEMPO (die
GANZE eigene Etappe, kein Teampartner-Schnitt) nicht kennen. Dazu kommt: die
Wechsel-/Kurven-Konstanten (`WECHSEL_MAX/K/MIN/PATZER/PATZER_K`, `KURVE_ANTEIL/KOSTEN/
WENDIG`) sind im Code explizit als "PLATZHALTER, bis die Bahn-Recherche eigene Zahlen
liefert" markiert — ihre Spannweite wurde nie gegen Pp eingemessen. Eine Rezept- oder
Nenner-Umschichtung innerhalb der bestehenden Kanäle kann diese strukturelle Verdünnung
nicht auflösen; sie bräuchte entweder eine Neukalibrierung dieser Platzhalter-Konstanten
(eigene Messrunde) oder eine Mechanik-Änderung, die über reine Rezeptkalibrierung
(Klasse A) hinausgeht.

## Isolationsnachweis: Spurt/Zeitfahren/Klettern/Takeshi unberührt

`art.staffel` ist ein eigenes Gate, getrennt von `art.mengeAusEignung` (Climbing/Takeshi)
und von Spurt/Zeitfahren (die keins von beiden setzen). Die Änderung steht ausschliesslich
innerhalb des `if(art.staffel){...}`-Blocks. Bit-identische Bestätigung, `miss-alle-
disziplinen.mjs 24` vor/nach auf demselben Kaderfamilien-Abbild:

| Disziplin | rho/Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| time-trial | 0,923 (unverändert) | 0,067 | 0,902 | 0,063 |
| takeshis-castle | 0,898 (unverändert) | 0,062 | 0,986 | 0,021 |
| spurt | 0,880 (unverändert) | 0,154 | 0,939 | 0,105 |
| climbing | 0,837 (unverändert) | 0,125 | 0,881 | 0,117 |

Alle vier Zeilen sind vor und nach der Änderung exakt gleich (bit-identisch über alle vier
Messgrössen).

## Abnahme

- `node --check public/mockups/battle-mode.engine.js`: grün.
- rho/Spiel n=24: 0,893 (>0,80). rho/Spiel n=48: 0,895 (>0,80). Beide innerhalb des
  Kaderrauschens gegenüber der Basis (0,898/0,888).
- Pp n=48, zwei Saatströme: 37,7 / 41,1 (Ziel <=25 NICHT erreicht, aber deutliche
  Verbesserung von 61,9/61,9).
- Isolationsnachweis time-trial/spurt/takeshis-castle/climbing: bit-identisch vor/nach.
- `npx vitest run`: s. PR-Beschreibung für die Zahl dieser Runde.

## Ehrliches Fazit

Dies ist eine **Teilverbesserung, kein abgeschlossener Fix**. rho bleibt sicher über der
Schranke und verbessert sich sogar leicht; Pp sinkt um 38 %, bleibt aber über dem Ziel.
Die Diagnose (TECHNIK/WENDIGKEIT sind durch Team-Mittelung und Ein-von-fünf-Beteiligung
strukturell verdünnt, ihre Zeitkosten-Konstanten sind unkalibrierte Platzhalter) ist der
Hinweis für die nächste Runde, nicht nur für diese: eine dedizierte Messung dieser
WECHSEL_*/KURVE_*-Konstanten gegen Pp (nach demselben Muster wie Spurts `huerdePreis`
1,00 -> 1,45) ist der wahrscheinlichste nächste Schritt, um unter 25 zu kommen, geht aber
über eine reine Rezeptkalibrierung hinaus.

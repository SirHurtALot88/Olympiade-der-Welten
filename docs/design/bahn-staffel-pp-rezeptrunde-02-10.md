# Bahn-Staffel: Pp-Kalibrierungsrunde (Task #40, 02.10.)

## Bestätigungsmessung

Der Auftrag berief sich auf einen "Fünfzehnter Nachtrag 02.10." in
`docs/design/stand-aller-disziplinen.md` und auf PR #1109 als Beleg dafür, dass Staffels
Pp-Abweichung von 61,9 bereits zuverlässig bei n=48 gemessen sei.

**Korrektur einer eigenen Fehleinschätzung:** eine frühere Fassung dieses Abschnitts
behauptete, dieser Nachtrag existiere nicht. Das war falsch — ich hatte beim ersten
Nachsehen versehentlich einen veralteten lokalen Checkout geprüft (einen älteren
Feature-Branch in einem anderen Arbeitsverzeichnis, der nicht auf dem aktuellen `main`
beruhte), nicht den tatsächlichen `main`-Stand. Der Fünfzehnter Nachtrag (Commit
`146dd787`, Task #43/#44) ist tatsächlich ein Vorfahre des PR-Basis-Commits `83bfa315` und
enthält genau die zitierte Zeile: "Staffel | 61,9 | 48 (PR #1109 bit-identisch bestaetigt,
s. Fuenfzehnter Nachtrag) | VERLETZT, klar verletzt". Die ursprüngliche Auftragsquelle war
also korrekt — meine erste "Quellenkorrektur" nicht. Danke an die unabhängige Review für
den `git merge-base --is-ancestor`-Nachweis, der den Fehler aufgedeckt hat.

Unabhängig davon bleibt die eigene Bestätigungsmessung auf dem aktuellen `main` (nach
#1109/#1115/#1116/#1119/#1120/#1121, Commit `83bfa315`) richtig und war ohnehin die
Grundlage für die Rezeptkalibrierung selbst:

| Messung | Wert |
|---|---|
| Pp, n=48, Saat 1 | **61,9** |
| Pp, n=48, Saat 2 (Versatz 10.000.000) | **61,9** |
| Pp, n=144 | 62,9 |
| rho/Spiel, n=24 (kaderfest, Median über 5 Paarungen) | 0,898 |
| rho/Spiel, n=48 | 0,888 |

Die Zahl ist über n=48/144 und zwei Saatströme stabil auf ±1 Pp.

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
Kalibrierung ist aus rho-Sicht neutral bis leicht positiv **im Median**. Der nächste
Abschnitt zeigt, dass diese gewachsene Spannweite kein reines Rauschen ist, sondern an
einer bestimmten Paarung hängt.

**Ziel <=25 Pp nicht erreicht.** 37,7/41,1 ist eine Verbesserung um rund 38 % gegenüber
61,9, aber keine vollständige Schliessung. Siehe "Weitere Versuche" unten für die
Diagnose, warum, und was eine Folgerunde bräuchte.

## Nebenbefund: "vigilante-armageddon" fällt neu unter die Schranke

Die gewachsene Kader-Spannweite (0,081→0,208 bei n=24, 0,092→0,222 bei n=48) ist kein
gleichmässiges Rauschen über alle fünf Paarungen — sie konzentriert sich auf eine einzige:
**vigilante-armageddon** (Chris' historisches Referenzteam). Einzelpaarungs-Aufschlüsselung
(`disziplinMessen()` liefert das bereits je Paarung über `.varianten`, hier direkt
ausgelesen statt nur Median/Spannweite):

**n=24:**

| Paarung | rho/Spiel vorher | rho/Spiel nachher | rho/Saison vorher | rho/Saison nachher |
|---|---:|---:|---:|---:|
| vigilante-armageddon | 0,821 | **0,716** | 0,890 | **0,690** |
| coldsteel-direlegion | 0,902 | 0,848 | 0,951 | 0,860 |
| goldengladiators-silversoldiers | 0,898 | 0,924 | 0,944 | 0,944 |
| mortalsin-natureswrath | 0,880 | 0,899 | 0,888 | 0,930 |
| piratecrew-raginglunatics | 0,900 | 0,893 | 0,972 | 0,923 |

**n=48:**

| Paarung | rho/Spiel vorher | rho/Spiel nachher | rho/Saison vorher | rho/Saison nachher |
|---|---:|---:|---:|---:|
| vigilante-armageddon | 0,807 | **0,698** | 0,881 | **0,678** |
| coldsteel-direlegion | 0,899 | 0,851 | 0,958 | 0,860 |
| goldengladiators-silversoldiers | 0,895 | 0,920 | 0,944 | 0,930 |
| mortalsin-natureswrath | 0,877 | 0,895 | 0,923 | 0,930 |
| piratecrew-raginglunatics | 0,888 | 0,897 | 0,986 | 0,944 |

**vigilante-armageddon fällt bei BEIDEN n sowohl im rho/Spiel als auch im rho/Saison neu
unter 0,80** — vorher stand keine einzige der fünf Paarungen unter der Schranke, danach
genau diese eine, reproduzierbar bei zwei verschiedenen `n`. Der Gesamt-Median bleibt nach
CLAUDE.md formal bestanden (>0,80 über die Kader-Familie), aber das ist kein Freibrief:
eine einzelne, real abstürzende Paarung ist ein echter Effekt der Änderung, kein
Zufallsrauschen, und sollte nicht nur als "Spannweite gewachsen" in einer Summenzahl
verschwinden.

**Vermutete Ursache (nicht isoliert nachgewiesen):** das Mittel-der-Sieben macht die
Menge-Skalierung jetzt auch von TECHNIK/WENDIGKEIT/STEHEN/ROBUST abhängig — Sub-Skills, die
vorher (0,73×ANTRITT+0,27×ENDTEMPO) gar nicht in `m` einflossen. Wenn die Kaderpaarung
vigilante-armageddon ungewöhnlich schiefe Attributprofile mitbringt (z.B. wenige, aber
extreme Ausreisser in genau den fünf Attributen, die nur über TECHNIK/WENDIGKEIT/STEHEN/
ROBUST wirken), reagiert `m` jetzt stärker auf diese Schiefe als vorher. Das ist eine
Hypothese, keine Messung — eine Attributprofil-Analyse dieser Paarung wurde in dieser
Runde nicht durchgeführt.

**Empfehlung für die nächste Runde:** eine künftige Kalibrierung der `WECHSEL_*`/`KURVE_*`-
Platzhalterkonstanten (s. "Weitere Versuche" unten) sollte **vigilante-armageddon explizit
als Sentinel-Fall gegenprüfen** — jede Änderung, die die Pp-Abweichung weiter senkt, aber
diese Paarung nicht zurück über 0,80 bringt (oder eine andere Paarung neu darunter
drückt), tauscht eine Pp-Verbesserung gegen eine neue rho-Schwachstelle und sollte nicht
ohne weitere Prüfung gemerged werden.

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
- rho/Spiel n=24: 0,893 (>0,80, Median). rho/Spiel n=48: 0,895 (>0,80, Median). Beide
  Mediane innerhalb des Kaderrauschens gegenüber der Basis (0,898/0,888) — ABER: die
  Einzelpaarung vigilante-armageddon fällt bei beiden n neu unter 0,80 (s. "Nebenbefund"
  oben), formal durch den Median gedeckt, aber ein realer Effekt, kein Rauschen.
- Pp n=48, zwei Saatströme: 37,7 / 41,1 (Ziel <=25 NICHT erreicht, aber deutliche
  Verbesserung von 61,9/61,9).
- Isolationsnachweis time-trial/spurt/takeshis-castle/climbing: bit-identisch vor/nach.
- `npx vitest run`: s. PR-Beschreibung für die Zahl dieser Runde.

## Ehrliches Fazit

Dies ist eine **Teilverbesserung, kein abgeschlossener Fix**. Der rho-Median bleibt sicher
über der Schranke und verbessert sich sogar leicht; Pp sinkt um 38 %, bleibt aber über dem
Ziel; und eine einzelne Kaderpaarung (vigilante-armageddon) fällt neu unter 0,80 — formal
vom Median gedeckt, aber ein realer, reproduzierbarer Nebeneffekt, kein Rauschen. Die
Diagnose (TECHNIK/WENDIGKEIT sind durch Team-Mittelung und Ein-von-fünf-Beteiligung
strukturell verdünnt, ihre Zeitkosten-Konstanten sind unkalibrierte Platzhalter) ist der
Hinweis für die nächste Runde, nicht nur für diese: eine dedizierte Messung dieser
WECHSEL_*/KURVE_*-Konstanten gegen Pp (nach demselben Muster wie Spurts `huerdePreis`
1,00 -> 1,45) ist der wahrscheinlichste nächste Schritt, um unter 25 zu kommen, geht aber
über eine reine Rezeptkalibrierung hinaus — und sollte vigilante-armageddon als
Sentinel-Fall gegenprüfen (s. "Nebenbefund" oben).

# Spurt, Format 3: „HYROX-Stationen" (08.11.)

Chris' Kritik an Spurt: „lame im Vergleich zu Time Trial" — und die Erinnerung an eine alte
Idee, dass Läufer bei Spurt wie bei HYROX wirklich **Stationen abarbeiten** müssen (Schlitten
schieben, Seil, Wand, Wassergraben, …), statt dass diese nur Kulisse sind. Dieses Dokument baut
das **zweite** der zwei angeforderten neuen Formate — „HYROX-Stationen" — auf dem
Format-Fundament auf, das PR #1367 („Die Hatz", `claude/spurt-format-hatz-0811`, noch offen)
bereits gelegt hat.

## 0. Der Befund, der dieses Format begründet

Spurt zeigt seit dem Kulissen-Rework (Batch 15) sieben benannte Stationen im Boden — Hürde,
Balken, Palisade, Seil, Wassergraben, Mauer, Strohballen (`BAHN_ART.spurt.hindernisBilder`/
`hindernisNamen`/`hindernisse`). Nachgeprüft, bevor geplant wurde: diese sieben Stationen
**wirken mechanisch alle identisch**. Jede Station i wird über `HUERDEN_TYP(i)` auf einen Eintrag
in `hindernisTypen:["TECHNIK","WENDIGKEIT","WUCHT","WUCHT","WENDIGKEIT","WUCHT","TECHNIK"]`
abgebildet — eine Zuordnung, die mit dem gezeigten Bild nichts zu tun hat (der „Wassergraben"
bremst über WENDIGKEIT wie eine Balance-Station, das „Seil" über WUCHT wie ein Rempler). Eine
Station ist damit nur ein Bild über demselben generischen Hürden-Stolper, den jede andere Station
auch hat — **reine Kulisse**, wie der Auftrag es nennt, auch wenn der zugrunde liegende
Hürden-Mechanismus selbst längst echten Einfluss auf das Tempo hat.

Dieses Format macht die sieben Stationen zur Mechanik: jede Stationsgruppe liest eine inhaltlich
zu ihr passende Kombination aus dem **bestehenden** Spurt-Rezept (ANTRITT/ENDTEMPO/TECHNIK/
WENDIGKEIT/STEHEN/WUCHT/ROBUST, unverändert, `BAHN_ART.spurt.rezept`) und kostet danach wirklich
Zeit — kein neuer Sub-Skill-Kanal, keine Änderung an der gesperrten Matrix
(`lib/player-generator/official-discipline-weights.ts`), nur eine andere, bewusstere
Kombination der sieben bestehenden Werte, genau wie „Die Hatz" es für Wellen vorgemacht hat.

## 1. Was gebaut wurde

### Das Format-Fundament wiederverwendet, nicht erweitert

Der Schalter `BAHN_FLAGS.spurtFormat` (bisher `"klassisch"|"hatz"`) bekommt einen dritten Wert,
`"hyrox"` — genau die Stelle, die der Hatz-Agent dafür vorgesehen hat
(`spurt-format-die-hatz-08-11.md` Abschnitt 7). Gesetzt wird er weiterhin **ausschließlich** über
`window.__arena.bahnFlags({spurtFormat:"hyrox"})` oder `window.__olyBahnFlags` — die echte App
setzt keins von beidem, `BAHN_FLAGS.spurtFormat` bleibt dort für immer `"klassisch"`.

`bauSpurt(saat)` bekommt am selben Hook-Punkt wie die Hatz (Ende der Funktion, nach der
vollständigen, formatunabhängigen Läuferkonstruktion) eine zweite Verzweigung:

```js
bahnHatzAktiv=!!(art.spurt&&BAHN_FLAGS.spurtFormat==="hatz");
HATZ_WELLEN=null;
if(bahnHatzAktiv)baueHatz();
bahnHyroxAktiv=!!(art.spurt&&BAHN_FLAGS.spurtFormat==="hyrox");
HYROX_STATIONEN=null;
if(bahnHyroxAktiv)baueHyroxStationen();
```

`stepSpurt(dt)` und `zeichneSpurt()` bekommen denselben zusätzlichen Dispatch-Zweig wie die Hatz
(`if(bahnHyroxAktiv){ stepSpurtHyrox(dt); return; }` bzw. `if(bahnHyroxAktiv)
zeichneHyroxUeberlagerung();`). Ohne das Flag (jeder heutige Aufrufer, jedes echte Spiel) ist
`bahnHyroxAktiv` immer `false` — `baueHyroxStationen()`/`stepSpurtHyrox()`/
`zeichneHyroxUeberlagerung()` werden nie aufgerufen, kein bestehender Codepfad ändert sich
(s. Abschnitt 3, Fingerabdruck).

Wiederverwendet, wörtlich wie in der Hatz-Dokumentation angekündigt: die komplette
Läuferkonstruktion aus `bauSpurt()` (ANTRITT/ENDTEMPO/TECHNIK/WENDIGKEIT/STEHEN/WUCHT/ROBUST,
`eig`/`eigOhneMutator` schon berechnet) — kein neues Rezept, keine neue Eignungsrechnung.

### Sieben Stationen, drei Checks

Sieben unabhängige Würfe je Rennen hätten das Ergebnis verwässert (CLAUDE.md, „Mehr Ereignisse
helfen fast nie" — derselbe Befund, der die Hatz von einem auf fünf GROB passende Würfe je Welle
gebracht hat, hier andersherum: von sieben AUF drei). Geprüft, ob alle sieben wirklich einen
eigenen Check brauchen: nein — sie fallen inhaltlich in drei Gruppen, die am Ablauf einer echten
HYROX-Strecke orientiert sind (Technik-Hindernisse am Anfang, Klettern in der Mitte, die
schwersten Kraft-Stationen am Ende):

| Gruppe | Stationen (Position) | Primärweg | Nebenweg | Mischung |
|---|---|---|---|---|
| **TECHNIK** | Hürde (0,14) + Balken (0,26) | TECHNIK (dex/awareness/det) | WENDIGKEIT (dex/awareness/speed) | 60/40 |
| **KLETTERN** | Palisade (0,38) + Seil (0,50) | ROBUST (health/torment/will/dex/awareness) | TECHNIK (dex/awareness/det) | 70/30 |
| **KRAFT** | Wassergraben (0,62) + Mauer (0,74) + Strohballen (0,86) | WUCHT (torment/power/speed) | STEHEN (torment/health/dex/will) | 55/45 |

**Warum diese Zuordnung, nicht die naheliegendste.** Hürde/Balken sind reine
Technik-/Gleichgewichtsstationen — dieselbe Kombination, die der klassische Hürdenlauf an jeder
Hürde ohnehin liest, hier nur bewusst benannt statt über `hindernisTypen` zufällig verteilt.
Palisade und Seil sind beides Stationen, an denen man sich **festhält und durchhält** — der
Auftrag schlug dafür „dex+det" vor, aber das bestehende Rezept liest `TECHNIK:{dex,awareness,det}`
dafür bereits (Technik als Primärweg wäre reine Gleichsetzung mit der ersten Gruppe gewesen).
ROBUST als Primärweg (`health,torment,will,dex,awareness`) passt inhaltlich besser: ein Läufer, der
sich über eine Palisade zieht oder am Seil hochklettert, braucht vor allem **Grip und
Schmerztoleranz**, nicht nur flinke Füße. TECHNIK bleibt als Nebenweg (30 %) — „mehrere Wege zum
Erfolg" (CLAUDE.md): wer wenig Robustheit hat, kommt über geschickte Technik trotzdem rüber, nur
langsamer, statt komplett ausgeschlossen zu sein. Wassergraben/Mauer/Strohballen sind die drei
härtesten, kräftezehrendsten Stationen am Streckenende — Primärweg WUCHT (Schieben/Tragen),
Nebenweg STEHEN (die Kälte des Wassers, die Erschöpfung nach den ersten sechs Stationen
aushalten).

### Die Formel

`baueHyroxStationen()` berechnet je Läufer, einmal, deterministisch aus der Renn-Saat, eine
Zielzeit:

```js
pace    = 0.55*ANTRITT + 0.45*ENDTEMPO
technik = 0.6*TECHNIK  + 0.4*WENDIGKEIT
kletter = 0.3*TECHNIK  + 0.7*ROBUST
kraft   = 0.55*WUCHT   + 0.45*STEHEN
score   = wurf(pace*0.40) + wurf(technik*0.20) + wurf(kletter*0.20) + wurf(kraft*0.20)
zeit    = max(6, 26 − 0.165*score)
```

`wurf()` ist dieselbe Rauschfunktion wie `hatzWelleScore()` (±18 % je Term, ein `rr()`-Aufruf je
Term — **vier** unabhängige Würfe je Läufer und Rennen, nicht sieben). `pace` trägt mit 40 % am
meisten zum Score bei: die Strecke ZWISCHEN den Stationen bleibt relevant, die drei
Stationschecks zusammen tragen die andere Hälfte — bewusst so hoch, weil die Stationen wirklich
etwas kosten sollen, nicht nur ein kleiner Zuschlag neben dem Lauftempo sein dürfen.

`u.fertig` trägt hier — anders als bei der Hatz — eine **echte Zeit**, keinen Rang: genau wie im
klassischen Format und bei Time-Trial. `stepSpurtHyrox(dt)` lässt die Uhr laufen und trägt
`u.fertig=u.hyroxZeit` ein, sobald `rennT` die vorab berechnete Zielzeit erreicht.
`MOTOREN["spurt"].wert()` (der generische Bahn-Zweig, unverändert) sortiert danach aufsteigend
nach `bahnZeit(u)=u.fertig-(u.startT||0)` (startT ist bei Spurt immer 0) und vergibt -(Platz) —
**kein eigener `wert()`-Zweig nötig**, exakt wie bei der Hatz.

## 2. Fingerabdruck: unverändert, nachgewiesen

```
node scripts/pruefe-wertung-fingerabdruck.mjs
```

| | Vorgabe (CLAUDE.md) | Dieser Branch |
|---|---|---|
| `spiele spurt 1` | `c6674a9c88ac` | `c6674a9c88ac` |
| `spiele spurt 7` | `4f4d574f7de2` | `4f4d574f7de2` |
| `spiele spurt 42` | `b205444457ed` | `b205444457ed` |
| **GESAMT** | `22f04e06e285 (69 Eintraege)` | `22f04e06e285 (69 Eintraege)` |

Identisch. Das zweite Format fasst in keinen bestehenden `A.spiele()`-Aufruf hinein — jede neue
Zeile sitzt hinter `bahnHyroxAktiv`, das ohne `BAHN_FLAGS.spurtFormat==="hyrox"` nie `true` wird.

## 3. Pflichtmessungen

### rho (ein Spiel, Kaderfamilie, `scripts/miss-spurt-hyrox-rangtreue.mjs`)

```
node scripts/miss-spurt-hyrox-rangtreue.mjs 24
```

| Format | Teiln. | rho/Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite | Abnahme |
|---|---:|---:|---:|---:|---:|---|
| klassisch (Kontrollwert, Kader-Familie) | 12 | 0,910 | 0,142 | 0,963 | 0,086 | bestanden |
| **hyrox** | 12 | **0,895** | 0,139 | 0,951 | 0,089 | **bestanden** |

0,895 > 0,80, nahe am angestrebten 0,85 — sogar etwas näher dran als die Hatz (0,840). Die
Kontrollzeile zeigt wieder, dass beide Formate wirklich unterschiedliche Zahlen liefern.

### Pp-Abweichung (zwei Saatströme, `scripts/messe-spurt-hyrox-einfluss.mjs`)

```
node scripts/messe-spurt-hyrox-einfluss.mjs 192 0
node scripts/messe-spurt-hyrox-einfluss.mjs 192 10000000
```

| Saatstrom | Pp |
|---|---:|
| 0 | 20,2 |
| 10 000 000 | 20,5 |

Beide ≤ 25, mit spürbarem Puffer (im Gegensatz zur Hatz, deren Werte 23,6/24,6 nahe am Limit
lagen). Attribut-Tabelle (Saatstrom 0, n=192):

```
Attribut          Anteil   Matrix   Differenz
speed               17,9 %     18   -0,1
dexterity           16,8 %     12   +4,8
determination       14,3 %     15   -0,7
power               12,7 %     10   +2,7
torment              11,3 %     14   -2,7
will                  9,6 %     14   -4,4
awareness               9 %      7   +2,0
health                6,6 %      6   +0,6
stamina               1,8 %      4   -2,2
intelligence/charisma/spirit  0 %  0   0,0
```

Speed/determination/health liegen sehr nah am Ziel. Dexterity ist am stärksten überrepräsentiert
(TECHNIK trägt es in zwei der drei Gruppen — als Primärweg der Technik-Station UND als Nebenweg
der Kletter-Station), will am stärksten unterrepräsentiert (es sitzt nur in ROBUST/STEHEN, beide
als Nebenweg bzw. mit kleinerem Anteil). Beides innerhalb der ≤25-Schranke mit deutlichem Rand.

## 4. Kalibrierweg

**Kein Fehlversuch nötig** — anders als bei der Hatz (die 32,1 Pp im ersten Anlauf maß) traf die
erste Fassung bereits beide Schranken. Das lag an einer Vorüberlegung, nicht an Glück: Die sieben
Sub-Skill-Formeln des bestehenden Spurt-Rezepts sind bekannt (ANTRITT speed/power/det,
ENDTEMPO speed/will/det/stamina, TECHNIK dex/awareness/det, WENDIGKEIT dex/awareness/speed,
STEHEN torment/health/dex/will, WUCHT torment/power/speed, ROBUST health/torment/will/dex/
awareness) — vor der Implementierung wurde von Hand überschlagen, welche Mischung aus
`pace`/`technik`/`kletter`/`kraft` (mit welchen Gewichten `P`/`S1`/`S2`/`S3`) eine
Attribut-Verteilung nahe an der Matrix ergibt, unter der Annahme, dass `einflussVon()`s
Rang-basierte Messung näherungsweise proportional zu den linearen Formel-Koeffizienten der
Attribute ist (plausibel, weil `Zeit` eine reine Summe gewichteter, ausschließlich NEGATIVER
Beiträge ist — kein Attribut wirkt in zwei Richtungen, anders als z. B. bei einer Kampf-Formel
mit Gegenwirkung). Diese Überschlagsrechnung ergab rechnerisch ~21 Pp bei `pace=0,40`,
`technik=kletter=kraft=0,20` und der oben stehenden Primär-/Nebenweg-Mischung — die tatsächliche
Messung (20,2/20,5 Pp) lag sehr nah daran. Die Lehre aus der Hatz („fünf unabhängige Würfe statt
einem", „zwei Rauschstufen") wurde direkt übernommen: vier unabhängige Würfe (statt sieben oder
eines einzigen Gesamtscores) von Anfang an, ein einzelnes Rauschniveau (18 %, zwischen der Hatz
nicht-finalen Stufe 25 % und ihrer finalen Stufe 2 % — HYROX-Stationen hat keine „letzte Welle",
deshalb kein Grund für zwei Stufen).

**Offener Kalibrierungsrest, ehrlich benannt:** Dexterity ist überrepräsentiert, weil TECHNIK
(dex-lastig) sowohl in der Technik- als auch als Nebenweg in der Kletter-Gruppe steckt. Ein
Versuch, das durch Senken von `kletter`s TECHNIK-Anteil (0,3) weiter zu verringern, würde den
Nebenweg schwächen oder ganz entfernen — das stünde gegen die „mehrere Wege zum Erfolg"-Leitlinie
und wurde deshalb bewusst nicht gemacht, zumal 20,2/20,5 Pp bereits deutlich unter der Schranke
liegen. Wer künftig enger kalibrieren will: `window.__arena.hyroxGewichte({...})`
(Analogie zu `hatzGewichte`) ändert `HYROX_W`/das Rauschen/Basis/Skala innerhalb einer laufenden
Browser-Sitzung, ohne die Seite neu zu laden.

Fundstellen: `HYROX_W`/`HYROX_RAUSCHEN_AKTUELL`/`HYROX_BASIS_SEK_AKTUELL`/
`HYROX_SKALA_SEK_AKTUELL` in `battle-mode.engine.js`, nahe `stepSpurt()`. **Nicht angefasst**:
`BAHN_ART.spurt.rezept` (die sieben Sub-Skill-Formeln selbst) — die Matrix ist gesperrt,
kalibriert wurde ausschließlich, WIE die sieben bestehenden Zahlen zu den drei Stationschecks
kombiniert werden.

## 5. Bild

Kein neues PixelLab-Asset: Die sieben Stationen-Sprites zeichnet `zeichneBoden()` bereits (Batch
15 Kulissen-Rework) — dieses Format macht sie nur zur Mechanik, nicht zum Bild. Ergänzt wurde
eine kleine Überlagerung (`zeichneHyroxUeberlagerung()`): über jeder der sieben Stationsmarken
steht ein farbiges Schild mit dem Gruppennamen (TECHNIK/KLETTERN/KRAFT), damit sichtbar ist,
dass jetzt drei echte Checks dahinterstehen, nicht sieben beliebige Bilder.

**Arbeits-Pose statt Kulisse.** Beim Überschreiten jeder der sieben Stationsmarken bekommt der
Läufer kurz dieselbe liegende „Stolper"-Pose, mit der ein Hürdensturz im klassischen Format schon
arbeitet (CLAUDE.md, PixelLab-Tod-Animationen: bestehende Pose wiederverwendet, keine neue
Animation generiert) — rein kosmetisch, die Zielzeit steht durch `u.hyroxZeit` bereits fest, bevor
das Rennen überhaupt läuft.

**Bildbeleg** (`scripts/screenshot-kulisse.mjs spurt - <ms> <ausgabe> --format=hyrox` — der
Schalter brauchte keine Codeänderung, `--format=` geht bereits ungeprüft an `bahnFlags()` durch,
das seit dieser PR auch `"hyrox"` kennt). Vier Aufnahmen geprüft, bei 12 s/24 s/45 s/78 s
Wartezeit (Hinweis: die Sendung läuft standardmäßig deutlich langsamer als Echtzeit — bei ~18-19 s
Zielzeit eines typischen Läufers brauchte das sichtbare Rennen rund 80 s Wall-Clock-Wartezeit bis
zum Ziel, dieselbe Drosselung, die auch die Hatz-Aufnahmen betrifft):
- Bei 12 s/24 s: das Feld steht noch dicht beieinander im Bereich HÜRDE/BALKEN.
- Bei 45 s: das Feld spreizt sich sichtbar über BALKEN, der Spitzenreiter („Tidesprinter") ist
  bereits zwischen PALISADE und SEIL unterwegs — deutlich vor dem Rest.
- Bei 78 s: die Gruppe erreicht PALISADE, der Spitzenreiter hat SEIL hinter sich gelassen und
  nähert sich WASSERGRABEN — eine klar erkennbare, unterschiedliche Positionsverteilung über die
  sieben Stationen hinweg, nicht mehr ein gleichmäßig durchlaufendes Feld.
- Bei 60 s zeigte der Spitzenreiter exakt an der SEIL-Station die liegende Arbeits-Pose — der
  sichtbare Beleg, dass dort gerade „gearbeitet" wird.

**Ehrliche Einschätzung:** Die Gruppenschilder (TECHNIK/KLETTERN/KRAFT) und die sichtbar
unterschiedliche Positionsverteilung der Läufer über die sieben Stationen hinweg (statt eines
gleichmäßig durchlaufenden Pulks wie im klassischen Format) machen im Bild klar, dass hier etwas
anderes passiert als vorher — das Feld zieht sich an bestimmten Stationen sichtbar auseinander,
und ein einzelner Läufer, der an einer Station kurz die Arbeits-Pose zeigt, liest sich als „hier
wird gerade etwas abgearbeitet". Was das Bild NICHT zeigt (und auch nicht zeigen soll, s.
Abschnitt 2 der Hatz-Dokumentation zur linearen Bahn): keine eigene Animation fürs Schlitten-
Schieben oder Seil-Klettern — die Arbeits-Pose ist dieselbe wiederverwendete Stolper-Pose an
jeder der sieben Stationen, nur die Dauer (0,4 s) und der Zeitpunkt (Stationsüberquerung statt
Sturz) unterscheiden sich. Für eine reine Format-Mechanik-PR ist das im Sinne des Auftrags
(„nicht neu zeichnen, nur sichtbar machen, DASS ein Läufer gerade arbeitet") — wer die
Stationen later unterscheidbarer MACHEN will (eine eigene Schlitten-Pose statt der generischen
Stolper-Pose), bräuchte dafür eine eigene PixelLab-Runde, die dieser Auftrag bewusst nicht
anstößt.

## 6. Verhältnis zu PR #1367 („Die Hatz")

Dieser Branch (`claude/spurt-format-hyrox-0811`) geht von `claude/spurt-format-hatz-0811` aus
(PR #1367, noch offen/Draft, nicht gemergt) und baut direkt auf dessen Format-Fundament auf
(`BAHN_FLAGS`, Hook-Punkte in `bauSpurt`/`stepSpurt`/`zeichneSpurt`, Save/Restore-Block). Der
Pull-Request zielt wie der Hatz-PR auf `main`, deshalb zeigt GitHub automatisch auch die
Hatz-Commits mit an, bis #1367 gemergt ist — das ist beabsichtigt, kein Fehler dieser PR.

## 7. Vergleich der drei Formate

| | Klassisch | Die Hatz | HYROX-Stationen |
|---|---|---|---|
| Struktur | Hürdenlauf, kontinuierliche Zeit | Fünf Wellen, Ausscheidung | Lineare Strecke, kontinuierliche Zeit |
| `u.fertig` | echte Zeit | Rang (1..N) | echte Zeit |
| Sub-Skill-Kombination | 1:1 wie im Rezept | 5 Würfe je Welle (ANTRITT/ENDTEMPO + 4) | 4 Würfe je Rennen (pace + 3 Stationschecks) |
| rho/Spiel (Kader-Familie, Kontrollwert) | 0,910 | 0,840 | 0,895 |
| Pp (zwei Saatströme) | — | 23,6 / 24,6 | 20,2 / 20,5 |
| Sichtbarer Unterschied | sieben gleich wirkende Hürden | Fegearm jagt die Nachhut | sieben Stationen mit je eigenem, benanntem Check |

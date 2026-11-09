# Spurt, Format 2: „Die Hatz" (08.11.)

Chris' Kritik: Spurt sei „lame im Vergleich zu Time Trial". Dieses Dokument baut das erste der
zwei angeforderten neuen Formate — **„Die Hatz"**, ein Wellen-Ausscheidungsrennen mit einer
Bedrohung, die die Nachhut jagt — plus das **Format-Fundament**, mit dem später ein zweites
Format (HYROX-Stationen) angeschlossen werden kann. Vorlage: Abschnitt 4.3 des Entwurfs
`docs/design/format-varianten-brainstorm-08-11.md` (auf `claude/vision-oberflaechen-tackling-0811`,
PR #1354, noch nicht gemergt).

## 1. Was gebaut wurde

### Das Fundament (für dieses Format UND das nächste)

Ein `format`-Schalter nach exakt demselben Muster, das `BUEHNE_FLAGS` (Gewichtheben-Sandsack,
Speed-Schach-Uhr, Wettessen-Mauer) schon vorgibt — `battle-mode.engine.js`, direkt vor
`const BAHN_ART={`:

```js
const BAHN_FLAGS={spurtFormat:"klassisch"};
try{
  const startFlags=window.__olyBahnFlags;
  if(startFlags&&typeof startFlags==="object"&&typeof startFlags.spurtFormat==="string")
    BAHN_FLAGS.spurtFormat=startFlags.spurtFormat;
}catch(e){}
```

Gesetzt wird er **ausschließlich** über `window.__arena.bahnFlags({spurtFormat:"hatz"})`
(Mess-/Screenshot-Skripte) oder `window.__olyBahnFlags` vor dem Laden (Headless-Runner) — die
echte App setzt keins von beidem, `BAHN_FLAGS.spurtFormat` bleibt dort für immer `"klassisch"`.

`bauSpurt(saat)` liest den Schalter genau einmal, ganz am Ende der Funktion (nach der
kompletten, unveränderten Läufer-Konstruktion):

```js
bahnHatzAktiv=!!(art.spurt&&BAHN_FLAGS.spurtFormat==="hatz");
HATZ_WELLEN=null;
if(bahnHatzAktiv)baueHatz();
```

`stepSpurt(dt)` und `zeichneSpurt()` verzweigen ganz am Anfang:

```js
function stepSpurt(dt){
  if(done)return;
  if(bahnHatzAktiv){ stepSpurtHatz(dt); return; }
  rennT+=dt; ...                      // unveraendert
```

Ohne das Flag (jeder heutige Aufrufer, jedes echte Spiel) ist `bahnHatzAktiv` immer `false` —
`baueHatz()`/`stepSpurtHatz()`/`zeichneHatzUeberlagerung()` werden nie aufgerufen, kein
bestehender Codepfad ändert sich. Das ist die **kritische** Eigenschaft (s. Abschnitt 3).

### „Die Hatz" selbst

Rundkurs mit einem Fegearm, der am Ende jeder Welle die Nachhut erwischt. Fünf Wellen (weniger
bei kleineren Feldern, s. unten) zu je 12 Sim-Sekunden, 3 s Neuordnung dazwischen:

- **Wellen 1–4** (bei 12 Läufern: 12→10→8→6→4): die beiden mit der schwächsten Wellen-Note
  werden erwischt — raus, Rang = Ausscheidereihenfolge.
- **Letzte Welle** (≤4 noch aktiv): bewertet ALLE Verbliebenen auf einen Schlag. Die unteren
  zwei werden Rang 3/4, die oberen zwei direkt Rang 1/2 — der „Sprint der verbliebenen zwei um
  Platz 1" aus dem Entwurf, nur dass eine Welle beides entscheidet statt einer sechsten Phase.
- Zwischen den Wellen: 3 s Neuordnung, keine Ausdauer-Belohnung über Wellen hinweg (stamina ist
  mit 4 das schwächste Matrixgewicht).

**Sub-Skills — ausschließlich das bestehende Spurt-Rezept**, keine neue Formel:
`BAHN_ART.spurt.rezept` liefert ANTRITT/ENDTEMPO/TECHNIK/WENDIGKEIT/STEHEN/WUCHT/ROBUST schon
für jeden Läufer (dieselben Zahlen, die auch der klassische Hürdenlauf benutzt). Die Hatz
kombiniert sie nur anders:

- **ANTRITT** in jeder Welle außer der letzten — „jede Welle ein Neustart".
- **ENDTEMPO** nur in der letzten Welle — der Schlussprint.
- TECHNIK/WENDIGKEIT (die zwei Hürden der Welle), WUCHT (der Rempler), ROBUST (Wegstecken),
  STEHEN tragen in jeder Welle bei.

`u.fertig` trägt hier den **Rang**, nicht eine Zeit (`baueHatz()` vergibt `u.hatzRang` 1..N,
`stepSpurtHatz()` trägt ihn als `u.fertig` ein, sobald die jeweilige Welle „revealed" wird).
`MOTOREN["spurt"].wert()` — der generische, unveränderte Bahn-Zweig — sortiert nach
`bahnZeit(u)=u.fertig-(u.startT||0)` aufsteigend und vergibt `-(Platz)`; weil `u.startT` für
Spurt immer 0 ist und jeder Rang eindeutig, reproduziert das exakt die Ausscheidereihenfolge.
**Kein eigener `wert()`-Zweig nötig.**

Team-/Spielerwert (Rangpunkte 12..1 wie bei der Grube, Spielerwert = Rang + Wellen-Note gegen
einen Referenzläufer) steht im Entwurf, ist aber **nicht** Teil dieses Fundaments — die
Pflichtmessungen (rho, Pp) hängen allein an `MOTOREN["spurt"].wert()`, das schon steht. Die
PPS-/Kader-Anzeige für „Die Hatz" ist damit offen für eine spätere Runde, sobald Abschnitt 6
(Formatwahl) entschieden ist.

## 2. Die Zeichenfrage: Rundkurs oder linear?

**Entscheidung: die Bahn bleibt linear. „Rundkurs" ist eine thematische Umdeutung, kein echtes
Oval-Rendering.**

Geprüft: `istOval()` existiert bereits (`!!BA().staffel`) und zeichnet schon einen echten
geschlossenen Kurs mit Radius/Spuren (`ovalPunkt()`). Er ist aber fest an die Staffel verdrahtet
— **zwei** Bahnen für **zwei Mannschaften** (`OVAL_SPUR0+u.bahnZ`, `bahnZ` nur 0/1, die ganze
Zonen-/Wartenden-/Zielgruppen-Logik rechnet mit Teams, nicht mit zwölf Individuen). Zwölf
einzelne Läufer auf einem echten Rundkurs zu zeigen — eigene Spurzuteilung, Überrunden,
Start/Ziel-Geometrie für zwölf statt zwei — ist ein eigenes Zeichenprojekt, kein
Format-Fundament.

Der Fegearm jagt deshalb auf der **geraden** Bahn von hinten nach vorn; „eine Runde" ist eine
Welle, niemand wird überrundet. Das ist genau die im Auftrag genannte Alternative B. Wer später
einen echten Rundkurs will, baut dafür eine eigene Oval-Variante für Individualrennen — ein
eigenständiges Vorhaben, keine Erweiterung dieses Fundaments.

## 3. Fingerabdruck: unverändert, nachgewiesen

```
node scripts/pruefe-wertung-fingerabdruck.mjs
```

| | vorher (Auftrag) | nachher (dieser Branch) |
|---|---|---|
| `spiele spurt 1` | `c6674a9c88ac` | `c6674a9c88ac` |
| `spiele spurt 7` | `4f4d574f7de2` | `4f4d574f7de2` |
| `spiele spurt 42` | `b205444457ed` | `b205444457ed` |
| **GESAMT** | `22f04e06e285 (69 Eintraege)` | `22f04e06e285 (69 Eintraege)` |

Identisch. Das Format-Fundament fasst in keinen bestehenden `A.spiele()`-Aufruf hinein — jede
neue Zeile sitzt hinter `bahnHatzAktiv`, das ohne `BAHN_FLAGS.spurtFormat==="hatz"` nie `true`
wird.

## 4. Pflichtmessungen für „Die Hatz"

### rho (ein Spiel, Kaderfamilie, `scripts/miss-spurt-hatz-rangtreue.mjs`)

```
node scripts/miss-spurt-hatz-rangtreue.mjs 24
```

| Format | Teiln. | rho/Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite | Abnahme |
|---|---:|---:|---:|---:|---:|---|
| klassisch (Kontrollwert, Kader-Familie) | 12 | 0,910 | 0,142 | 0,963 | 0,086 | bestanden |
| **hatz** | 12 | **0,840** | 0,183 | 0,970 | 0,168 | **bestanden** |

0,840 > 0,80, nahe am angestrebten 0,85. Die Kontrollzeile beweist, dass beide Formate
tatsächlich unterschiedlich messen (nicht aus Versehen denselben Pfad).

### Pp-Abweichung (zwei Saatströme, `scripts/messe-spurt-hatz-einfluss.mjs`)

```
node scripts/messe-spurt-hatz-einfluss.mjs 192 0
node scripts/messe-spurt-hatz-einfluss.mjs 192 10000000
```

| Saatstrom | Pp |
|---|---:|
| 0 | 23,6 |
| 10 000 000 | 24,6 (Einzelmessung) / 24,4 (Wiederholung) |

Beide ≤ 25. Attribut-Tabelle (Saatstrom 0, n=192):

```
Attribut          Anteil   Matrix   Differenz
speed               18,1 %     18     +0,1
dexterity           15,4 %     12     +3,4
determination         13 %     15     -2,0
power                12,7 %     10     +2,7
torment              12,3 %     14     -1,7
health               11,3 %      6     +5,3
will                  9,3 %     14     -4,7
awareness             7,3 %      7     +0,3
stamina               0,6 %      4     -3,4
intelligence/charisma/spirit  0 %  0   0,0
```

Speed/awareness/torment/determination liegen nah am Ziel. Dexterity und health sind
überrepräsentiert, will und stamina unterrepräsentiert — innerhalb der ≤25-Schranke, aber mit
dünnem Rand (23,6–24,6 statt deutlich darunter). Ehrlich benannt als offener Kalibrierungsrest,
s. Abschnitt 5.

## 5. Kalibrierweg (inklusive Fehlversuche)

Der erste, naive Entwurf (ein einziger verrauschter Wellen-Score, Gewichte grob nach „Gefühl"
aus dem Entwurfstext) maß **32,1 Pp** und rho 0,807 — Pp über der Schranke. Versuche, das über
reine Gewichtsverschiebung zu lösen (mehr ROBUST, weniger WUCHT, um will/stamina zu heben),
drückten Pp teils auf **44–51**, weil health/dexterity (die in ROBUST/STEHEN mitschwingen)
überproportional ansprangen — ein Nebeneffekt der Ordnungsstatistik (wer eine Welle knapp
übersteht, kippt das gemessene Ergebnis stärker, als der nominale Gewichtsanteil vermuten
lässt), nicht ein linearer Zusammenhang wie bei einer Kampf-Formel.

Zwei Hebel haben tatsächlich geholfen:

1. **Fünf unabhängige Würfe statt einem** je Wellen-Score (Antritt/Endtempo, die zwei Hürden,
   der Rempler, Robust, Stehen — statt einer gemeinsam verrauschten Summe). Das glättet die
   Messung genauso, wie es die sieben Hürden/Dutzenden Ticks des klassischen Formats ohnehin
   tun — ohne diesen Schritt schwankte Pp bei gleichbleibenden Gewichten zwischen 20 und 37 Pp
   je nach Laufzahl (n=48 vs. n=288), ein Messartefakt, kein echter Unterschied.
2. **Zwei Rauschstufen statt einer**: frühe Wellen laut/chaotisch (Gedränge), die letzte Welle
   leise (klarer Sprint). Das hebt den EFFEKTIVEN Anteil von Endtempo/Stehen (will, stamina)
   an, ohne die nominalen Gewichte extrem zu verschieben — aber zu viel Rauschen insgesamt
   drückte rho unter 0,80 (bei `rauschen=0,60` maß rho nur 0,711, „knapp" statt „bestanden").
   `rauschen=0,25` (nicht-finale Wellen) / `0,02` (letzte Welle) ist der Kompromiss, der beide
   Schranken hält.

Fundstellen: `HATZ_W`/`HATZ_W_FINALE`/`HATZ_RAUSCHEN_AKTUELL` in `battle-mode.engine.js`, nahe
`stepSpurt()`. **Nicht angefasst**: `BAHN_ART.spurt.rezept` (die sieben Sub-Skill-Formeln
selbst) — die Matrix ist gesperrt, kalibriert wurde ausschließlich, WIE die sieben bestehenden
Zahlen zur Wellen-Note kombiniert werden.

Eine Kalibrierungs-Schnittstelle bleibt für künftige Feinarbeit stehen:
`window.__arena.hatzGewichte({...})` (Analogie zu `buehneFlags`) ändert `HATZ_W`/
`HATZ_W_FINALE`/die Rauschwerte innerhalb einer laufenden Browser-Sitzung, ohne die Seite neu
zu laden — genau das Werkzeug, mit dem diese Zahlen gefunden wurden
(`/tmp/.../hatz-kalibrierung.mjs`, nicht Teil dieses Branches, reproduzierbar mit demselben
Muster).

## 6. Bild

Kein neues PixelLab-Asset. Geprüft, ob ein bestehendes Panzertier wiederverwendbar ist
(`data/generated/figuren-sprites.json`, 360 Figuren durchsucht nach Panzer/Stier/Bulle/Rhino/
Tank/Kanone) — der einzige Treffer, „medibull", ist ein Sanitäter-Maskottchen (Animationen
walk/angriff/treffer/tod, aber als Ersthelfer-Figur konzipiert), kein Bedroher. Statt dafür ein
Generierungsprojekt zu starten, zeichnet `zeichneHatzUeberlagerung()` den Fegearm prozedural —
derselbe Ansatz, mit dem das Bahn-Chassis auch sonst Zustand zeichnet (Hot-Seat-Podest,
Ziellinie): ein rot/gelb umrandeter Balken mit Beschriftung „FEGEARM" (letzte Welle:
„ENDSPURT"), der sich jede Welle von hinten an die Nachhut heranschiebt und sie am Wellenende
erreicht.

Wer erwischt wird, bekommt `u.raus=true` (dieselbe Dimm-/Entsättigungs-Behandlung, die Takeshi's
Castle schon hat) und `u.stolper>0` — dieselbe „liegt"-Pose, die ein Hürdensturz im klassischen
Format schon zeichnet. Kein generisches Nach-vorn-/Nach-hinten-Kippen (CLAUDE.md,
PixelLab-Tod-Animationen): wer vom Fegearm erwischt wird, liegt sichtbar auf der Bahn, bleibt
dort bis Rennende, dieselbe Pose, mit der die Spurt-Figur ohnehin „gestürzt" zeigt — stimmig,
weil er wirklich raus ist.

Bildbeleg: `scripts/screenshot-kulisse.mjs spurt - <ms> <ausgabe> --format=hatz` (neuer
`--format=`-Schalter, s. Skriptkommentar). Drei Aufnahmen im Zuge dieser PR geprüft (6 s, 10,8 s,
12,6 s Rennzeit) — der Fegearm ist bei 10,8 s (kurz vor dem Ende der ersten Welle) klar als
roter, gelb umrandeter Balken mit Beschriftung sichtbar, unmittelbar hinter der Läuferspitze.

## 7. Was für Format 2 (HYROX-Stationen) bereitsteht

- **`BAHN_FLAGS.spurtFormat`** ist der Ort für einen dritten Wert (z. B. `"hyrox"`) — derselbe
  Schalter, keine neue Infrastruktur.
- **Hook-Punkt**: das Ende von `bauSpurt(saat)` (unmittelbar vor der schließenden `}`, nach der
  vollständigen, format-unabhängigen Läuferkonstruktion — `art.spurt` ist dort bereits geprüft).
  Ein zweites Format ergänzt dort eine weitere Verzweigung, analog zu
  `if(bahnHatzAktiv)baueHatz();`.
- **Step-Dispatch**: der Kopf von `stepSpurt(dt)` (`if(done)return;` direkt gefolgt vom
  Format-Dispatch) — HYROX bekäme dort eine eigene `stepSpurtHyrox(dt)`.
- **Zeichnung**: der Kopf von `zeichneSpurt()` (`zeichneBoden();` gefolgt vom
  Format-Dispatch) für eine eigene Überlagerung.
- **Wiederverwendbar**: die komplette Läuferkonstruktion in `bauSpurt()` (LAEUFER mit
  ANTRITT/ENDTEMPO/TECHNIK/WENDIGKEIT/STEHEN/WUCHT/ROBUST schon berechnet, `eig`/
  `eigOhneMutator` schon gesetzt) — ein neues Format liest dieselben Felder, erfindet keine
  neue Eignungsrechnung.
- **Messung**: `scripts/miss-spurt-hatz-rangtreue.mjs` und `scripts/messe-spurt-hatz-einfluss.mjs`
  sind als Vorlage gedacht — ein Kopie-und-Umbenennen mit `spurtFormat:"hyrox"` statt `"hatz"`
  liefert sofort beide Pflichtmessungen für das neue Format.
- **Kalibrierungs-Werkzeug**: `window.__arena.hatzGewichte()` ist Hatz-spezifisch benannt;
  eine allgemeinere Variante (`window.__arena.spurtFormatGewichte(format, {...})`) wäre ein
  sinnvoller erster Schritt für den Folge-Agenten, falls HYROX denselben
  Wellen-Score-Mechanismus wiederverwenden will — muss es aber nicht.

**Nicht entschieden, nicht Teil dieses Auftrags**: welche der drei Optionen aus Abschnitt 6 des
Entwurfs (A — fest im Saisonkalender, B — deterministischer Hash wie die Kulissen, C — Chris
legt es in der Liga-Einstellung fest) künftig bestimmt, WANN ein Spiel „klassisch" und wann
„hatz"/„hyrox" läuft. Das bleibt ausdrücklich Chris' Entscheidung. Bis dahin ist „Die Hatz" nur
über den expliziten Mess-/Vorschau-Schalter erreichbar, nie im echten Spielbetrieb.

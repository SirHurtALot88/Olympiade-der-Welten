# Opus-Plan 10.09.: Feinschliff an vier Disziplinen (Gewichtheben · Eiskunstlauf · Takeshi · Breaking)

**Auftrag von Chris (woertlich, 10.09.):** „kannst du dich dann noch um gewichtheben assets kümmern
und dass die entsprechend genutzt werden. dann eiskusntlauf movement. und takeshi assets + gameplay
verbessern. breaking benötigt wohl auch noch assets und movement. Bitte durch opus alles planen
lassen und dann durchführen das ist die heutige session. hör erst auf wenn du da auch überall min
>90 bist! wir müssen nun feinschliff der diszis hin bekommen. balancing ist im ersten step noch
nicht so wichtig bis alle assets usw korrekt sind"

**Grundlage:** `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` (Audit von
heute, auf `main` als `c56fffd7`). Dessen Abschnitt 0 haelt die Rubrik, Abschnitt 2 die Begruendung
je Disziplin.

**Stand beim Schreiben:** `main` = `c56fffd7`. Kein Produktionscode geaendert; dieser Plan und vier
Sicht-QA-Screenshots sind der gesamte Inhalt dieses PRs.

**Dieses Dokument ist eine Bauanweisung, kein Diskussionspapier.** Jeder Abschnitt 4–7 ist so
geschrieben, dass ein Implementierungs-Agent ohne Rueckfrage anfangen kann: Datei, Zeile, Funktion,
Vorgehen, Abnahme.

---

## 0. Die Kurzfassung — und die eine unbequeme Zahl

Sechs Achsen sind beauftragt. Fuenf davon sind mit gewoehnlicher Bauarbeit ueber 90 % zu bringen.
Eine Sache steht dem bei DREI davon im Weg, und sie steht nicht im Auftrag:

> **Die Assets-Achse hat ohne TON eine harte Decke bei 80 %.**
> A4 (20 Punkte, „Ton, Musik, Kulisse") wird in der Rubrik-Anwendung des Audits praktisch als
> „Ton" vergeben: Hockey hat mit `eisflaeche()` eine voellig eigene, aufwendige Kulisse und bekam
> trotzdem **0 von 20** — „**Kein Ton** — das kostet die vollen 20 Punkte" (Audit Abschnitt 2,
> Hockey). Basketball ist die einzige Disziplin mit A4 = 20 und die einzige mit `public/sound/`.
> A1 + A2 + A3 sind zusammen 80. **80 < 90.**

Damit gilt fuer die drei Assets-Ziele (Gewichtheben, Takeshi, Breaking): **entweder es entsteht in
dieser Session eine Ton-Schicht, oder das Ziel „>90 % Assets" ist arithmetisch unerreichbar.** Das
ist keine Meinung, das ist die Rubrik.

Der Plan loest das mit **PR 0** (Abschnitt 3): einer generischen `sfx(disziplin, ereignis)`-Schicht,
deren Toene **prozedural per WebAudio erzeugt** werden statt aus Dateien zu kommen — weil in dieser
Umgebung keine Audio-Dateien beschaffbar sind (der Umgebungs-Proxy laesst nur GitHub/npm durch,
s. CLAUDE.md). Das ist zugleich Prioritaet 2 des Audits („der einzige Rueckstand, der jede Disziplin
gleich hart trifft ... zahlt sofort zwanzigfach").

Alles Weitere in einem Satz je Ziel:

| Ziel | Achse | heute | Weg | erwartet |
|---|---|--:|---|--:|
| Gewichtheben | Assets | 60 % | Hantel AN DIE HAND (Muster `zeichneHockeyschlaeger`), Requisiten-Tabelle statt Zufallswaffe, eigene Hebebuehne `bodenHeben()`, Ton | **95 %** |
| Eiskunstlauf | Movement | 60 % | echte Gleitbewegung: praesentationale Kuer-Zustandsmaschine in `stepBuehne()` hinter `art.duett` + Kufenspur/Hebefigur-FX | **95 %** |
| Takeshi | Gameplay | 67 % | **`spieleBahn()` — das vierte Chassis. Und zwar fuer ALLE VIER Bahnen auf einmal** (Begruendung 6.1) | **97 %** |
| Takeshi | Assets | 60 % | `takeshi.tsx` von 273 auf Mockup-Niveau (Gelaendezonen, Fallenbilder, Fallen-FX), Ton | **95 %** |
| Breaking | Assets | 65 % | `breaking.tsx` vom duennsten Feld auf ein echtes Cypher-Feld, Etiketten-Kollisionen weg, Ton | **95 %** |
| Breaking | Movement | 55 % | **echte Cypher-Mechanik**: wer dran ist, tritt in die Mitte, tanzt, geht zurueck (`stepBuehne`-Zweig hinter `art.cypher`) | **95 %** |

Nebenwirkung, die niemand extra bezahlen muss: der Bahn-Anschluss hebt **Staffel 67 → 97**,
**Spurt 67 → 97**, **Time-Trial 62 → 92** mit. Der Projektdurchschnitt steigt dadurch von 65 % auf
rund **71 %**, und 14 von 20 Disziplinen sind produktionsangeschlossen statt 10.

---

## 1. Die Rubrik rueckwaerts gerechnet — was „>90 %" konkret verlangt

### 1.1 Die Dekomposition ist eindeutig, nicht geraten

Das Audit nennt je Achse nur die Summe. Die Zerlegung laesst sich aber aus der Rubrik (Abschnitt 0)
und den Begruendungen (Abschnitt 2) eindeutig rekonstruieren — hier an drei Faellen gegengeprueft,
die alle exakt aufgehen:

| Prueffall | Rechnung | Audit |
|---|---|--:|
| Takeshi Gameplay | G1 40 (rho 0,861 ≥ 0,85) + G2 **0** (kein Anschluss) + G3 15 + G4 12 (Bahn) | **67** ✓ |
| Staffel / Spurt Gameplay | 40 + 0 + 15 + 12 | **67** ✓ |
| Time-Trial Gameplay | G1 35 (rho 0,828 in 0,80–0,85) + 0 + 15 + 12 | **62** ✓ |
| Climbing Gameplay | G1 22 (rho 0,790 in 0,70–0,80) + 0 + 15 + 12 | **49** ✓ |
| Hockey Assets | A1 30 + A2 25 + A3 25 + A4 **0** | **80** ✓ |
| Basketball Assets | 30 + 25 + 25 + 20 | **100** ✓ |

Das gibt die Dekomposition der sechs beauftragten Achsen:

| Achse | A1/M1/G1 | A2/M2/G2 | A3/M3/G3 | A4/M4/G4 | Summe |
|---|--:|--:|--:|--:|--:|
| Gewichtheben Assets | 30 | 25 | **5** | **0** | 60 |
| Eiskunstlauf Movement | 35 | **0** | 25 | **0** | 60 |
| Takeshi Assets | **15** | 25 | **20** | **0** | 60 |
| Takeshi Gameplay | 40 | **0** | 15 | 12 | 67 |
| Breaking Assets | **20** | 25 | **20** | **0** | 65 |
| Breaking Movement | 35 | **0** | 20 | **0** | 55 |

(Fettgedruckt = die Luecke. Bei Gewichtheben Assets ist auch die Lesart A1 20 / A3 15 moeglich —
der Plan schliesst beide Lesarten, indem er A1 UND A3 vollstaendig bedient.)

### 1.2 Woraus „>90" jeweils zusammengesetzt sein MUSS

- **Assets (30/25/25/20):** A1+A2+A3 = 80. Ueber 90 geht nur mit **A4 ≥ 11**. → Ton.
- **Movement (35/25/25/15):** M1+M2+M3 = 85. Ueber 90 geht nur mit **M4 ≥ 6**. → eigene Posen/FX
  an den Sprites. M2 („eigene Bewegungs-/Schrittlogik, `step*`-Sonderfaelle, Zustandsmaschine")
  ist bei Eiskunstlauf und Breaking heute **0** und in beiden Faellen die groesste Einzelposition.
- **Gameplay (40/30/15/15):** Takeshi hat 40+15+12 = 67. **G2 (30) ist die einzige offene
  Position** und allein den Ausschlag wert: 67 → 97.

### 1.3 Was das fuer die Aufteilung heisst

Drei der sechs Achsen (alle Assets-Achsen) haengen an EINER gemeinsamen Sache, die keine von ihnen
allein bauen kann. Zwei der sechs (Eiskunstlauf/Breaking Movement) brauchen beide einen Zweig in
DERSELBEN Funktion (`stepBuehne()`). Genau deshalb steht vor den vier Zielen ein **PR 0**, der beides
einmal bereitstellt (Abschnitt 3) — sonst kollidieren drei bis vier Agenten in denselben Zeilen.

---

## 2. Sicht-QA — was heute wirklich auf dem Schirm steht

Das Audit sagt selbst (Abschnitt 7, Punkt 1): **„Keine Sicht-QA … alle Aussagen ueber Optik und
Bewegung stammen aus gelesenem Zeichencode."** Fuer diesen Plan wurden vier Screenshots gemacht
(Playwright, `public/mockups/battle-mode.html`, echte Kader). Sie liegen in diesem PR und sind
Pflichtlektuere vor der Umsetzung:

| Datei | Was man sieht |
|---|---|
| `docs/design/sicht-qa-10-09-gewichtheben.png` | Die Hantel schwebt **neben und ueber** dem Heber, nicht in seinen Haenden. Zwei winzige Figuren auf dem generischen dunklen Buehnenboden. „173 kg" liegt **auf** dem Sprite. Der wartende Gegner hat gar keine Hantel. |
| `docs/design/sicht-qa-10-09-eiskunstlauf.png` | **Es gibt kein Eis.** Die Kuer laeuft auf `bodenBuehne()` — dunkelviolettes Podest mit Scheinwerferkegeln. Sechs Paare stehen in einem 3×2-Raster und bewegen sich nicht. Die untere Reihe schneidet in die Podestkante. |
| `docs/design/sicht-qa-10-09-breaking.png` | Der Cypher steht (Ringe, Zonen, Kern) — aber vier Tokens **stapeln sich** im Zentrum uebereinander und ueber der SURVIVOR-Schrift, Namen laufen in die Zonen-Etiketten, eine Figur haengt halb aus dem Bild. Alle in Lauf-Grundpose, **kein einziger Move**. |
| `docs/design/sicht-qa-10-09-takeshis-castle.png` | Das mit Abstand beste Bild der vier: echte Serpentinenroute, Wasser, Gelaendekacheln, Fahnen-Sternmarken, Burgpunkte-Kopfzeile, mitfahrende Kamera. Schwaeche: die Laeufer klumpen, ihre Beschriftungen liegen uebereinander. |

**Zwei Befunde daraus, die den Audit korrigieren bzw. ergaenzen:**

1. **Der Zufallswaffen-Vorwurf trifft Gewichtheben im Mockup NICHT** (Audit Abschnitt 2,
   Gewichtheben: „der Heber traegt weiterhin seine Zufalls-Kosmetikwaffe"). Nachgesehen:
   `zeichneHeben()` ruft `zeichneSprite(ctx,u,x,y,**true**)` (`battle-mode.engine.js:12103`), und
   der vierte Parameter `feldspiel` sperrt jede Waffenebene — `:2717-2720` und `:2842-2845` sind
   auf `!feldspiel` gegated, `feuerwaffe` (`:2577`) ebenso. Im Screenshot ist entsprechend keine
   Waffe zu sehen. **Der Befund war eine Code-Lesung ohne Bild.** Die Aufgabe bleibt trotzdem
   bestehen, nur mit anderer Begruendung: die Ausnahme haengt heute an einem positionalen vierten
   Parameter an EINER Aufrufstelle statt an der Disziplin (s. 4.2) — und ein Heber ohne Waffe ist
   immer noch ein Heber **ohne Hantel in der Hand**, was Chris' eigentliche Beschwerde war
   („da ist gar kein gewicht als asset was die spieler versuchen zu stämmen").
2. **Die Bahn ist der Ort, an dem der Zufallswaffen-Bug wirklich sitzt.** `feuerwaffe` (`:2577`)
   ist `!feldspiel && FEUERWAFFEN.includes(...)`, und `:2837` zeichnet sie **unabhaengig von jeder
   Pose**, solange die Figur steht. Auf der Bahn ist `feldspiel` falsch → **ein Takeshi-Laeufer mit
   Schrotflinten-Kosmetik traegt sie den ganzen Parcours entlang.** Im Screenshot war zufaellig kein
   Feuerwaffen-Traeger im Feld; der Code-Pfad ist aber offen. Das gehoert in Ziel 3b (s. 6.5).

*Reproduzieren:* das Skript aus `scripts/screenshot-gewichtheben.mjs` ist die Vorlage; PR 0 macht
daraus `scripts/screenshot-disziplin.mjs <disziplin> [wartenMs] [datei]` (s. 3.4).

---

## 3. PR 0 — Fundament (muss ZUERST gemerged sein)

Klein, mechanisch, und ausdruecklich **verhaltensneutral**. Er existiert nur, damit die vier
Ziel-PRs danach parallel laufen koennen, ohne dieselben Zeilen anzufassen. Ein Agent, ~1–2 h.

### 3.1 Ton-Schicht: `sfx(disziplin, ereignis, vol)` neben `bkSfx()`

**Datei:** `public/mockups/battle-mode.engine.js`, direkt neben dem Basketball-Block `:16044-16086`.

**Was NICHT passiert:** `bkSfx()`/`bkLoop*` bleiben Zeichen fuer Zeichen stehen. Basketball ist
produktiv, vertont und abgenommen — kein Umbau, keine Migration. `bkVolume`/`bkMuted`/`bkPegel()`
(`:16055-16057`) werden **wiederverwendet**, damit der eine Regler in der UI weiterhin alles regelt.

**Was entsteht:**

```
TON_KATALOG = {                         // je Disziplin eine kleine Tabelle
  gewichtheben: { ansage:{...}, stange_hoch:{...}, gueltig:{...}, ungueltig:{...},
                  scheiben_fall:{...}, publikum:{loop:true, ...} },
  eiskunstlauf: { kufe:{...}, sprung:{...}, landung:{...}, sturz:{...}, publikum:{loop:true,...} },
  breaking:     { beat:{loop:true,...}, freeze:{...}, powermove:{...}, abbruch:{...} },
  "takeshis-castle": { falle:{...}, sturz:{...}, platsch:{...}, tor:{...}, publikum:{loop:true,...} }
}
function sfx(disziplin, ereignis, vol)  // Einschuss
function tonLoopStart(disziplin) / tonLoopStop()
```

**Erzeugung: prozedural, kein Dateiabruf.** Ein kleiner Synth auf `AudioContext`:
`OscillatorNode` (Sinus/Dreieck/Saegezahn) + ein einmalig gebauter Rausch-`AudioBuffer` +
`BiquadFilterNode` + `GainNode`-Huellkurve (Attack/Decay). Fuenf Bausteine reichen fuer den ganzen
Katalog:

| Baustein | Parameter | benutzt fuer |
|---|---|---|
| `klick(f, dauer)` | kurzer gefilterter Rauschimpuls | Kufenschlag, Beat-Hi-Hat |
| `schlag(f0, f1, dauer)` | Sinus mit Frequenz-Abfall | Hantel-Aufsetzer, Sturz, Falle |
| `metall(f, dauer)` | zwei leicht verstimmte Rechtecke + Bandpass | Scheibenklirren, Stangen-Klack |
| `rauschen(bandMitte, dauer, huell)` | gefiltertes Rauschen | Platsch, Eiskufe, Publikums-Rauschen (Loop) |
| `ton(f, dauer)` | reiner Sinus mit weicher Huelle | Ansage-Gong, Torsignal |

**Warum prozedural und nicht Dateien:** Agenten kommen in dieser Umgebung an keine Audio-Quelle
(CLAUDE.md: Proxy laesst nur GitHub/npm durch, alles andere `403 CONNECT tunnel failed`). Die
Alternative waere, Chris um 20+ Dateien zu bitten — das ist eine Woche Wartezeit fuer eine Session,
die heute fertig werden soll. **Der Weg zurueck bleibt offen:** jeder Katalogeintrag darf statt
`{synth:...}` ein `{datei:"/sound/<disziplin>/<name>.mp3"}` tragen; `sfx()` bevorzugt dann die Datei
und faellt nur auf den Synth zurueck. Wer spaeter echte Aufnahmen einspielt, aendert Tabellenzeilen,
keinen Code.

**Autoplay-Sperre:** derselbe Weg wie bei Basketball — der `AudioContext` wird beim ersten
`#play`-Klick per `ctx.resume()` freigeschaltet (`:20777-20785`, wo `bkLoopStart()` schon haengt).
Ein `sfx()`-Aufruf vor der ersten Nutzergeste ist ein stiller No-Op, nie ein Fehler
(`try{...}catch(e){}` wie `bkSfx`).

**Regressionsschutz:** `sfx()` darf **niemals** `rr()` (`:13913`) anfassen und **niemals** auf
`u`/`TEILNEHMER`/`LAEUFER` schreiben. Es liest Argumente und `buehneT`/`rennT`, sonst nichts.

### 3.2 Requisiten-Tabelle statt der drei Waffen-Sonderzeilen

**Datei:** `public/mockups/battle-mode.engine.js:2569-2577`.

Heute stehen dort drei ad-hoc-Zeilen:

```js
const fechtenWaffe=istBuehne(disc)&&buehneDisc==="fechten";
const keineBuehnenWaffe=istBuehne(disc)&&(buehneDisc==="eiskunstlauf"||buehneDisc==="breaking");
const waffeEffektiv=fechtenWaffe?"schwert":(keineBuehnenWaffe?null:b.waffe);
```

Das wird EINE Tabelle **ueber alle Chassis**, nicht nur ueber die Buehne:

```js
// null  = keine Waffenebene · "schwert"/... = erzwungene Waffe · undefined = Kosmetik behalten
const DISZIPLIN_WAFFE={ fechten:"schwert", eiskunstlauf:null, breaking:null,
                        gewichtheben:null, tennis:null, showcase:null, wettessen:null,
                        "i-spy":null,
                        // BAHN: niemand laeuft einen Hindernisparcours mit Sturmgewehr.
                        spurt:null, staffel:null, "time-trial":null, climbing:null,
                        "takeshis-castle":null };
const aktiveDisc = istBuehne(disc)?buehneDisc : istBahn(disc)?bahnDisc : null;
const erzwungen  = aktiveDisc!=null ? DISZIPLIN_WAFFE[aktiveDisc] : undefined;
const waffeEffektiv = erzwungen===undefined ? b.waffe : erzwungen;
```

**Warum PR 0 und nicht Ziel 1:** sonst editieren Ziel 1 (Gewichtheben) und Ziel 3b (Bahn) dieselben
drei Zeilen. Danach ist jede weitere Disziplin **eine Tabellenzeile**.

**Abnahme (harte Anforderung):** Fechten, Eiskunstlauf und Breaking muessen danach
**bit-identische** rho-Werte liefern (die Tabelle bildet ihr heutiges Verhalten 1:1 ab). Fuer die
fuenf Bahnen und Gewichtheben aendert sich am Bild etwas, an der Rechnung nichts — die
Waffenauswahl fliesst in keine Formel ein. Beleg: `waffeEffektiv` wird nur an `:2576/2577/2717-2720/
2837/2842-2845` gelesen, alles Zeichenpfade.

### 3.3 Ein Bewegungs-Einstiegspunkt in `stepBuehne()`

**Datei:** `public/mockups/battle-mode.engine.js:11566-11648`.

Genau **eine** neue Zeile, direkt vor `if(buehneZeiger>=buehneQueue.length)done=true;` (`:11647`):

```js
buehnenBewegung(dt);   // rein praesentational, s. Vertrag unten
```

plus eine leere Dispatcher-Funktion daneben:

```js
function buehnenBewegung(dt){
  const art=BB();
  if(art.duett && typeof stepKuer==="function"){ stepKuer(dt,art); return; }   // Ziel 2
  if(art.cypher && typeof stepCypher==="function"){ stepCypher(dt,art); return; } // Ziel 4
}
```

**Der Vertrag, der ueber allem steht** (als Kommentar dort hinterlegen, woertlich):

> Eine `buehnenBewegung`-Implementierung darf **ausschliesslich neue, praesentationale Felder** auf
> `u` schreiben (Praefix `viz`), **niemals** `u.summe`, `u.runden`, `u.aktuell`, `u.vorteil`,
> `u.zweikampf`, `u.lunge`, `buehneAkt`, `buehneZeiger`, `done`. Sie darf **niemals `rr()`
> aufrufen** — `rr()` (`:13913`) ist ein linearer Kongruenzgenerator mit EINEM globalen Zustand;
> ein zusaetzlicher Zug daraus verschiebt jede spaetere Ziehung und aendert damit die Rangtreue
> jeder Buehnen-Disziplin. Wer Streuung braucht, nimmt einen reinen Hash aus `u.id`.
> `disziplinProbe()`/`miss-alle-disziplinen.mjs` durchlaufen diese Funktion **mit** — die
> Rangtreue-Neutralitaet ist deshalb keine Hoeflichkeit, sondern Bedingung.

**Abnahme:** mit der leeren Dispatcher-Funktion muessen ALLE zehn Buehnen-Disziplinen
ziffernidentisch messen wie vorher.

### 3.4 `scripts/screenshot-disziplin.mjs`

Generalisierung von `scripts/screenshot-gewichtheben.mjs` (28 Zeilen):
`node scripts/screenshot-disziplin.mjs <disziplin> [wartenMs] [ausgabe]`. Die drei bestehenden
`screenshot-*.mjs` bleiben unangetastet (sie sind in PR-Beschreibungen referenziert). Jeder der vier
Ziel-PRs legt seinen Vorher/Nachher-Screenshot damit in `docs/design/` ab — Chris sieht das
Ergebnis, ohne den Server anzufassen.

**PR-0-Umfang gesamt:** ~250 Zeilen neu, ~6 Zeilen ersetzt, null Formelaenderung.

---

## 4. Ziel 1 — Gewichtheben, **Assets 60 % → 95 %**

**Rubrik-Luecke:** A3 (5/25) und A4 (0/20). A1/A2 sind voll oder fast voll; der Plan haertet sie
trotzdem, weil die zweite mögliche Lesart A1 mit 20 bewertet.

### 4.1 A2/A4-Kulisse — eine echte Hebebuehne statt des Allzweck-Podests (`bodenHeben()`)

**Datei:** `battle-mode.engine.js`, neue Funktion neben `bodenBuehne()` (`:11700-11715`); Aufruf in
`zeichneBuehne()` (`:11717-11718`): `bodenBuehne()` durch
`if(BB().heben)bodenHeben(); else if(...) ... else bodenBuehne();` ersetzen — **eine Zeile**, exakt
das Muster, mit dem `art.heben/schach/cypher/duett` (`:11724-11732`) schon dispatchen.

Inhalt, alles Canvas-Primitiven (kein neues Bild noetig, `boden_stein.png`/`deko_holz.png` aus
`public/sprites/arena/` optional als Kachel):

- **Wettkampfplattform**: helles Quadrat mit Kante, mittig, in der Bildebene der Heber.
- **Drei Kampfrichterlampen** ueber der Plattform — weiss/rot je nach `zug.r.gueltig`. Das ist die
  IWF-Geste, die es heute nur als „✓ gültig"-Text gibt (`:12174`).
- **Anzeigetafel** oben rechts: Uebung (Reißen/Stoßen), Versuch 1–3, angesagte kg. Liest
  ausschliesslich `letzterHebenZug` — dieselben Daten wie die Textkarte (`:12163-12200`).
- **Kreide-/Magnesia-Kiste** und Hantelstaender am Rand; **Publikumssilhouetten** im Dunkeln.

### 4.2 A3 — die Hantel gehoert IN DIE HAENDE (`zeichneHantel()` + `HEBEN_HAND`)

Das ist der Kern des Auftrags („dass die entsprechend genutzt werden") und der Fund aus dem
Screenshot: die Hantel wird heute als freistehende Primitive **irgendwo im Bild** gezeichnet
(`:12134-12156`) — `bx` folgt zwar dem aktiven Heber, `by` interpoliert zwischen `y+40` und `y-58`,
aber nichts davon ist an der Figur verankert.

**Vorbild, das es im Repo schon gibt:** `zeichneHockeyschlaeger()` (`:311-360`) + `HOCKEY_HAND`
(`:305-310`) + die Aufrufstelle in `zeichneSprite()` (`:2866-2877`). Die Handpunkte sind am
Sprite-Blatt **ausgemessen**, nicht geschaetzt (`docs/design/sprite-handpunkte.md`).

**Umsetzung:**

1. **`HEBEN_HAND[4]`** — je Blickrichtung (0 hinten, 1 links, 2 vorn, 3 rechts) die Zellkoordinate
   der greifenden Hand. Fuer die Ueberkopf-Pose („shoot", die `zeichneHeben` ohnehin erzwingt) ist
   das eine ANDERE Hoehe als `HOCKEY_HAND`. **Nicht raten:** dieselbe Methode wie
   `sprite-handpunkte.md`, mit `window.__arena.renderProbe(name,"shoot",true,dir,lunge,256)`
   (`:22099`) einen 256er-Ausschnitt ziehen und den Handpunkt ablesen. Das Ergebnis als eigenen
   Abschnitt in `sprite-handpunkte.md` dokumentieren.
2. **`HEBEN_PHASEN`** — analog zu `HOCKEY_PHASEN` (`:264-290`), vier Zustaende mit Stangenhoehe
   relativ zur Hand und Neigung:
   `boden` (Stange am Boden, Heber gebueckt) → `zug` (Umsetzen, Stange auf Brusthoehe) →
   `hoch` (Streckung ueber Kopf, Arme durch) → `abwurf` (Stange faellt, Scheiben prallen).
3. **`zeichneHantel(ctx,x,y,s,richtung,phase,kg)`** — Stange als Linie durch den Handpunkt,
   Scheibenpaare als Ellipsen, **Scheibengroesse/-anzahl aus `kg`** (schwerere Last = mehr/dickere
   Scheiben; heute sind es immer vier gleich grosse Punkte). Perspektive wie beim Schlaeger:
   Profil = volle Laenge, Front/Ruecken = verkuerzt.
4. **Aufrufstelle** in `zeichneSprite()` neben `:2866`:
   ```js
   if(feldspiel&&istHeben()&&!u.down){ const hp=HEBEN_HAND[r]||HEBEN_HAND[2];
     zeichneHantel(ctx,x-32*Z+hp.x*Z,y-46*Z+hp.y*Z,Z,r,hebePhase(u),u._vizKg||0); }
   ```
   `istHeben()` neu neben `istHockey()`/`istFootball()` (`:6241-6242`) — **aber gegen `buehneDisc`
   und mit `istBuehne(disc)`-Vorpruefung**, exakt wie es der Kommentar bei `:2562-2568` fuer die
   Buehne verlangt (`buehneDisc` bleibt nach einem Buehnen-Match stehen; `istBuehne(disc)`
   bestaetigt, dass GERADE eine Buehne laeuft).
5. **Beide Heber tragen eine Stange, nicht nur der aktive.** Der wartende Gegner haelt sie in
   `boden`-Phase. Heute hat er gar keine (Screenshot).
6. Die alte freistehende Hantel (`:12116-12156`) **entfaellt**; die Phasenfolge kommt weiterhin aus
   `buehneAkt/art.rundenDauer` — kein zweiter Zeitgeber, kein neues Motorfeld ausser `u._vizKg`
   (praesentational, s. Vertrag 3.3).

### 4.3 A1 — `barbell.tsx` disziplinecht statt kosmetisch

**Datei:** `app/foundation/discipline-stage/arena/disciplines/barbell.tsx` (468 Z.).

Die Datei ist besser als ihr Ruf — Plattenturm, kg-Achse, GEFORDERT-Latte, Kampfrichter-Lampe,
rAF-Glide sind da. Was fehlt, damit sie „eigene, nicht generische Feld-Datei" **sichtbar** einloest:

- **Reißen/Stoßen als zwei Phasen** in der Kopfzeile statt einer namenlosen Last.
- **Drei-Versuche-Tafel** je Team (○/✓/✗) unter dem Team-Code — die einzige Information, die
  Gewichtheben von jeder anderen Zaehldisziplin unterscheidet und die heute komplett fehlt.
- **Weiss/rot statt ⚪/🔴** als echte Lampenreihe (drei Lampen, wie 4.1).
- **Scheiben in IWF-Farben** (rot 25, blau 20, gelb 15, gruen 10) statt `hsl(hue …)` nach Team —
  die Teamfarbe traegt schon der Token-Rahmen.

**Ausdruecklich NICHT in diesem PR:** die 150–400-kg-Remap durch literale Zweikampf-Kilogramm zu
ersetzen. Das ist in `docs/design/gewichtheben-produktivierung.md` Abschnitt 5.1 mit einem exakten
Rezept beschrieben (`individualBoxscoreKgByPlayerId` parallel zu `individualBoxscorePpsByPlayerId`
durch `buildLegacyMatchdayResolvePreview()` reichen), braucht aber einen neuen Datenpfad durch
`DisciplineStageArena.tsx` (~2000 Zeilen, alle zwanzig Disziplinen) und ist eine Design-Frage an
Chris, keine Asset-Frage. **Es zaehlt fuer A1 nicht** — A1 fragt nach der Feld-Datei, nicht nach der
Zahlenquelle. Als Folge-Ticket notieren.

### 4.4 A4 — Ton

Aus dem Katalog (3.1): `ansage` (Gong bei neuem Duell), `stange_hoch` (Metall, beim Uebergang
`zug`→`hoch`), `gueltig` (heller Doppelton), `ungueltig` (Buzzer), `scheiben_fall` (Metall+Rausch,
beim Abwurf), `publikum` (Loop, leise). Aufrufstellen: **nur** in `zeichneHeben()`/`bodenHeben()`
und im `BB().heben`-Zweig von `stepBuehne()` (`:11604-11629`) — **nie** in einer Formel.

### 4.5 Erwartetes Ergebnis

A1 30 (4.3) + A2 25 (bestand, gehaertet durch 4.1) + A3 25 (4.2) + A4 15 (4.4) = **95 %**.
A4 mit 15 statt 20 angesetzt, weil ein synthetisiertes Publikum keine Aufnahme ist — ehrlich
gerechnet, nicht schoengerechnet.

### 4.6 Abnahme

- `node scripts/miss-alle-disziplinen.mjs 24 gewichtheben` → Median **≥ 0,84** (heute 0,854;
  Spannweite 0,265, also ist alles ueber 0,80 im Rauschen unauffaellig). Aenderungen sind
  praesentational; eine Abweichung um mehr als das Rauschen ist ein **Fehler**, kein Ergebnis.
- `node scripts/screenshot-disziplin.mjs gewichtheben 4000 docs/design/gewichtheben-nachher-10-09.png`
  — sichtbar: Stange in den Haenden, drei Lampen, Plattform, keine ueberlappende Schrift.
- `npx tsc --noEmit` + die bestehenden Vitest-Suites (`barbell.tsx` hat mit
  `resolveBarbellGlideStart()` bereits eine getestete Exportfunktion — nicht brechen).

---

## 5. Ziel 2 — Eiskunstlauf, **Movement 60 % → 95 %**

**Rubrik-Luecke:** M2 (0/25) und M4 (0/15). M1 (`zeichneDuett`) und M3 (`eiskunst.tsx` mit
`useTokenGlide` + Choreografie-Route, `:80-116`) sind erfuellt.

### 5.1 M2 — die Kuer-Zustandsmaschine (`stepKuer()`)

**Datei:** `battle-mode.engine.js`, neue Funktion; angeschlossen ueber den Dispatcher aus PR 0 (3.3),
gegated auf `art.duett` (`BUEHNE_ART.eiskunstlauf:10703`). **Kein anderer Buehnen-Achter traegt
dieses Flag** (Kommentar `:10700-10702`) — die Exklusivitaet ist im Code schon dokumentiert.

Heute positioniert `zeichneDuett()` (`:11822-11916`) die Paare auf festen Rasterplaetzen
(`x=90+(W-180)*i/(gruppen.length-1)`, `y=H*0.32` bzw. `H*0.66`) und zeichnet eine statische
Eisspur-Ellipse (`:11859-11864`). **Das ist das Reihenbild, das der Audit meint.**

Neu: jedes Paar bekommt eine **eigene Bahn ueber die Flaeche**, gefahren aus einer
Programm-Zustandsmaschine. Nur neue `viz*`-Felder:

```
u.vizX, u.vizY      Position auf dem Eis (Bildkoordinaten)
u.vizRi             Fahrtrichtung (Bogenmass)
u.vizPhase          "einlauf" | "gleiten" | "pirouette" | "hebung" | "wurf" | "schlusspose"
u.vizPhaseT         Restzeit der Phase
u.vizSpur[]         Ringpuffer der letzten ~60 Positionen (die Kufenspur)
```

**Programmablauf**, an die vorhandene Taktung gekoppelt — kein zweiter Zeitgeber:

- Grundfahrt ist eine **Lissajous-Figur** ueber die Eisflaeche: `x = cx + a·sin(ω₁t + φ)`,
  `y = cy + b·sin(ω₂t)`, wobei `φ`, `ω₁`, `ω₂` **deterministisch aus `u.id` gehasht** werden
  (kein `rr()`!). Jedes Paar faehrt damit eine eigene, wiedererkennbare, sich nie wiederholende
  Kurve — genau das, was `eiskunst.tsx:80-109` in der React-Buehne bereits tut (dort ueber
  `hash(t.code)`), hier zum ersten Mal auch im Motor.
- Wird ein Durchgang enthuellt (`u.lunge` springt in `stepBuehne` auf 0,5, `:11581`), wechselt
  `vizPhase` in ein **Element**: `pirouette` (Paar dreht auf der Stelle, Radius geht gegen 0),
  `hebung` (Partnerin steigt am Partner hoch — vertikaler Versatz), `wurf` (Partnerin fliegt einen
  Bogen und landet 40 px weiter). Welches Element: `u.aktuell % 3` — deterministisch, kein Zufall.
- **Erfolg/Fehlschlag sind sichtbar**, direkt aus `u.runden[u.aktuell].ereignis` gegen
  `art.erfolgWort` („landet sauber") / `art.failWort` („stürzt") — genau die Unterscheidung, die
  `zeichneBreaking()` (`:12655-12657`) fuer sich schon liest. Sturz = Figur geht in `hurt`-Pose,
  bleibt kurz liegen, faehrt an. Sauber = weiter, mit Eisstaub.
- Nach dem letzten Durchgang: `schlusspose` in der Mitte, Fahrt stoppt.

**Rangtreue-Neutralitaet:** `stepKuer()` liest `dt`, `buehneT`, `u.id`, `u.aktuell`, `u.lunge`,
`u.runden[u.aktuell].ereignis` und schreibt nur `viz*`. Kein `rr()`, kein `u.summe`.

### 5.2 M1-Haertung + A2-Nebengewinn — `bodenEis()`

Der Screenshot zeigt den eigentlichen Skandal: **Eiskunstlauf laeuft auf einem violetten Nachtklub-
Podest.** Es gibt im Repo schon eine fertige Eisflaeche: `eisflaeche()` (`:9992`), heute nur fuer
Hockey. `bodenEis()` uebernimmt Idee und Farbwelt (nicht den Hockey-Aufbau: keine blaue Linie, kein
Bully-Kreis) — Eisoval mit Bande, goldene Bandenkante, Kampfgericht-Tisch, Zuschauerraenge,
Scheinwerferkegel von oben. Angeschlossen an derselben einen Zeile wie `bodenHeben()` (4.1).

Das ist formal Assets (A2/A4-Kulisse), nicht Movement — aber ohne Eis ist die schoenste Gleitkurve
nicht als Gleiten lesbar, und Eiskunstlauf steigt dadurch bei Assets von 70 auf ~85 mit.

### 5.3 M3-Haertung in `zeichneDuett()`

- `zeichneDuett()` positioniert nicht mehr per Raster, sondern liest `u.vizX/u.vizY`
  (Rueckfall auf das alte Raster, solange `vizX==null` — so bleibt die Funktion auch dann korrekt,
  wenn `stepKuer` nie gelaufen ist, z. B. im ersten Frame).
- **Kufenspur**: `u.vizSpur` als ausblendender heller Streckenzug — das gemeinsame Requisit des
  Paares, statt der heute statischen Doppelellipse (`:11859-11863`).
- **Tiefensortierung**: Paare nach `vizY` sortiert zeichnen, sonst laufen sie durcheinander, sobald
  sie sich frei bewegen. (Der heutige Rastercode braucht das nicht — der neue schon.)
- Etiketten: die untere Reihe schneidet heute in die Podestkante (Screenshot). Beschriftung an
  `vizY` haengen und am unteren Rand nach oben klappen.

### 5.4 M4 — eigene Posen/FX

- **Eisstaub** bei Landung/Pirouette: kurzlebige helle Partikel am Kufenpunkt (`zeichnePartikel
  Effekt` existiert bereits, `:2885`).
- **Hebefigur**: Partnerin mit vertikalem Versatz + „shoot"-Pose (Arme hoch) — dieselbe Weiche
  `zeichneSprite(...,true)`, die `zeichneDuett` schon nutzt (`:11870`).
- **Sturz**: `u.down`-artige `hurt`-Pose. **Achtung:** `u.down` ist ein Kampf-Feld; hier ein
  eigenes `u.vizSturz` verwenden und in `zeichneSprite()` NICHT `u.down` setzen (das wuerde in
  andere Zweige lecken).

### 5.5 Erwartetes Ergebnis

M1 35 + M2 25 + M3 25 + M4 10 = **95 %**. M4 mit 10 statt 15, weil es keine neuen Sprite-Blaetter
gibt (keine echte Schlittschuh-Ebene, keine Kostuem-Ebene) — die Posen kommen aus dem vorhandenen
Baukasten.

### 5.6 Abnahme

- `node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf` → **≥ 0,87** (heute 0,885, Spannweite
  0,094 — das ist die ENGSTE Spannweite im Feld, hier faellt jede echte Verschiebung sofort auf).
  **Und, wichtiger:** ein Kontrolllauf ueber `showcase wettessen tennis fechten breaking
  speed-schach i-spy gewichtheben` muss **ziffernidentisch** zur Basislinie sein — sie teilen sich
  `stepBuehne()`.
- Screenshot-Serie ueber 8 s (3 Aufnahmen), die zeigt, dass sich die Paare **bewegt haben**.

---

## 6. Ziel 3 — Takeshi's Castle: **Gameplay 67 % → 97 %** und **Assets 60 % → 95 %**

### 6.1 Die Entscheidung: ALLE VIER Bahnen anschliessen, Climbing nicht

**Ja — `spieleBahn()` wird gleich fuer alle vier bestandenen Bahn-Disziplinen gebaut.** Begruendung,
in der Reihenfolge ihrer Wichtigkeit:

1. **Der Dispatch ist fuer alle vier buchstaeblich derselbe.** Das Chassis heisst nicht
   „Takeshi", es heisst „Bahn": `MOTOREN[bd]` wird fuer **jede** `BAHN_ART`-Disziplin in einer
   einzigen Schleife registriert (`:21276-21374`), `bahnTeamstand()` (`:15782-15835`) dispatcht
   intern schon ueber `wertung:"rang"|"etappe"|"burg"`. Ein `spieleBahn()`, das nur Takeshi
   bediente, muesste kuenstlich verengt werden.
2. **Die vorgelagerte Designfrage ist beantwortet** — Audit 4.1: seit PR #827 traegt **jede** der
   fuenf Bahnen einen echten Wertungsmodus, `gewertet:false` betrifft keine mehr. Der Blocker in
   `battle-mode-arena-team-points.ts:159-167` ist stale.
3. **Der Grenzaufwand je zusaetzlicher Disziplin ist eine Mengenzeile, ein Konfigblock und eine
   gezogene Referenz** — exakt der Fall, den der Kopfkommentar dort seit der Gewichtheben-
   Produktivierung ankuendigt („eine reine Konfigurationsaenderung").
4. **Der Hebel ist der groesste im Projekt.** Vier Disziplinen mit rho 0,828–0,915 gehen in einem
   Zug von 67/67/67/62 auf 97/97/97/92. 14 von 20 produktiv statt 10. Audit-Prioritaet 1.

**Climbing bleibt draussen.** rho 0,790 — 0,010 unter der Schranke. Es waere technisch **eine
Zeile**, und genau deshalb ist es der wichtige Nicht-Eintrag: dieselbe Regel, die I-Spy (0,684)
draussen haelt, obwohl es `duell:true` traegt („die beiden Achsen duerfen nicht deshalb vermischt
werden, weil eine davon billig zu erfuellen waere", PM-Briefing 09.09.). **Im PR ausdruecklich
schriftlich begruenden**, sonst liest es der naechste als Vergessen.

### 6.2 G2 — `spieleBahn()` im Motor

**Datei:** `battle-mode.engine.js`, neuer Eintrag in `window.__arena` direkt nach
`spieleBuehneAuftritt()` (`:22077-22090`). Vorbild ist Zeile fuer Zeile dieses Geschwister —
plus der `stumm`-Rahmen, den `bahnLauf()` (`:22389-22408`) schon vorbildlich setzt.

```js
// VIERTES CHASSIS. Eigener Einstiegspunkt statt einer Erweiterung von spieleBuehneAuftritt()
// — aus demselben Grund, den spieleBuehneHeben() fuer spieleFeldspiel() nennt (:21968-21975):
// ein produktiver, getesteter Pfad bleibt unangefasst. Bahn teilt mit der Buehne keine einzige
// Zustandsvariable (LAEUFER statt TEILNEHMER, stepSpurt statt stepBuehne).
spieleBahn:(bd,saat)=>{
  if(typeof BAHN_ART==="undefined"||!BAHN_ART[bd])return null;
  const M=MOTOREN[bd]; if(!M)return null;
  const g=M.sichern(); if(M.vorher)M.vorher();
  stumm=true;
  try{ M.bau(saat); M.lauf(); } finally { stumm=false; }
  const st=bahnTeamstand();
  const namen=M.namen();
  const punkteVonName=new Map(LAEUFER.map(u=>[u.n, st.punkte?(st.punkte.get(u.id)??0):0]));
  const boxscore=namen.map(n=>({name:n, wert:punkteVonName.get(n)??0}));
  const seiten=[st.seiten[0], st.seiten[1]];
  M.zurueck(g);
  return {disziplin:bd, seiten, boxscore};
},
```

**Die einzige nicht offensichtliche Entscheidung darin — und sie ist wichtig:**
der Boxscore-Wert kommt aus **`bahnTeamstand().punkte`**, nicht aus `MOTOREN[bd].wert()`.

- `MOTOREN[bd].wert()` liefert fuer drei der vier Wertungsmodi **negative** Zahlen: `-(platz+1)`
  fuer `rang` (`:21370-21371`) und `-(etappenZeit)+wechselKonto` fuer Staffel (`:21334-21337`).
  Die Impact-Kurve `ppsAusArenaImpact()` rechnet `max(0, I)/I_krass` — **jeder** Bahn-Laeufer
  bekaeme 0 PPs.
- `bahnTeamstand().punkte` ist die **ordnungsidentische, nicht-negative Zwillingsgroesse**:
  fuer `rang` sortiert `bahnRangliste()` (`:15745-15764`) nach genau demselben `bahnZeit()`, das
  auch `wert()` sortiert, und vergibt `N-i` (also 1…N); fuer `etappe` sortiert sie nach
  `bahnLeistung()` (`:15723`) — der **identischen Formel**, an der `wert()` misst; fuer `burg` ist
  `punkte` sogar wortgleich `burgwertung(u)` (`:15813` gegen `:21363`).
- Und es ist **die Zahl, die das Spiel dem Zuschauer zeigt** (HUD, Kader, Endstand-Overlay lesen
  alle `bahnTeamstand()`) — dasselbe Prinzip „kein zweiter Rechenweg", mit dem
  `spieleBuehneAuftritt()` `u.summe` liest.

**Pflicht-Invariante fuer den Umsetzer (Test schreiben):** ueber ≥ 200 Saaten je Bahn muss die
Spearman-Rangkorrelation zwischen `MOTOREN[bd].wert()` und `bahnTeamstand().punkte` **exakt 1,0**
sein. Wenn nicht, misst die Produktion etwas anderes als die Rangtreue-Sonde.

**Zweite Pflicht-Invariante:** `spieleBahn(d,saat).seiten` muss fuer dieselbe Saat **elementweise
gleich** `bahnLauf(d,saat).seiten` sein. `bahnLauf()` ist die bereits vertraute Sonde; das ist ein
Goldstandard-Abgleich, den keine der drei bestehenden Chassis-Anbindungen hatte.

### 6.3 G2 — die Node-Seite

**a) `lib/battle/arena-headless-runner.ts`** — vierte Chassis-Menge nach demselben Muster wie
`:102 / :127 / :150`:

```ts
export const ARENA_BAHN_DISCIPLINE_IDS: ReadonlySet<string> =
  new Set(["staffel","spurt","takeshis-castle","time-trial"]);
```
plus je eine Zeile in: der Chassis-Union und -Aufloesung (`:517-526`), dem Browser-Payload-Typ
(`:387-394`, `spieleBahn` ergaenzen), dem Aufruf-Dispatch (`:438-443`) und dem Funktionsnamen fuer
die Fehlermeldung (`:544-551`). **`ArenaFixtureResult.seiten` bleibt `[number, number]`** — Takeshis
Burgpunkte sind Kommazahlen (4,0 : 6,3 im Screenshot), das ist zulaessig und gewollt.

**b) `lib/resolve/battle-mode-arena-team-points.ts`** — vier Eintraege in
`ARENA_RESOLVED_DISCIPLINE_IDS` (`:201-213`), vier `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Bloecke
(`:508-630`), vier Referenz-Importe. Die beiden Fail-Fast-Querpruefungen (`:229-244`, `:646-656`)
ziehen automatisch mit — **die neue Chassis-Menge muss in die erste Liste (`:229-233`) eingetragen
werden**, sonst prueft sie die Bahn nicht.

`katalogStandardgroesse` — **einzeln in `lib/data/dataAdapter.ts` nachgesehen**, nicht kopiert
(genau die Falle, vor der der Kommentar `:574-578` warnt):

| Disziplin | `Discipline.playerCount` | Fundstelle |
|---|--:|---|
| `staffel` | **3** | `dataAdapter.ts:63` |
| `spurt` | **2** | `dataAdapter.ts:59` |
| `takeshis-castle` | **4** | `dataAdapter.ts:68` |
| `time-trial` | **4** | `dataAdapter.ts:58` |

Keine ist 6. Die naheliegende Falle waere `BAHN_ART[d].jeSeite` — das ist die MOTOR-Feldgroesse und
hier der falsche Wert.

`max`/`anteilMitte` unveraendert 5,5 / 0,25 uebernehmen, mit **eigenen Konstanten statt Alias**
(dieselbe begruendete Wiederholung wie in Welle 1/2, `:376-381`).

Zusaetzlich: den stale gewordenen Staffel-Kommentar `:159-167` durch den korrigierten Befund aus
Audit 4.1 ersetzen. Er sagt heute das Gegenteil der Wahrheit.

**c) `scripts/ziehe-buehne-pps-referenz.ts`** — **erweitern statt kopieren.** Das Skript ist bereits
generisch (`DISZIPLINEN`-Tabelle `:88-125`, Motorfunktions-Weiche `:309`). Noetig: vier Eintraege mit
`chassis:"bahn"` und in `:309` `konfig.chassis === "bahn" ? "spieleBahn" : …`. Datei umbenennen auf
`ziehe-arena-pps-referenz.ts`? **Nein** — der Name steht in der Provenienz (`hinweis`) der schon
gezogenen JSONs und in mehreren Kommentaren; nur den Kopfkommentar erweitern.

**Laufzeitwarnung, ehrlich:** `FIXTURES_ZIEL = 60` je Feldgroesse × 5 Feldgroessen × 4 Disziplinen
= **1200 Fixtures**, bei 4–7 s je Fixture (Browser-Neustart je Fixture) **80–140 Minuten reine
Rechenzeit**. Das ist der groesste Einzelposten dieser Session. Vorgehen: `--feldgroesse=<n>`
je Feldgroesse **synchron nacheinander** (nicht im Hintergrund — genau das ist in dieser Sitzung
schon zweimal schiefgegangen), danach `--merge`. Wenn die Zeit nicht reicht: **lieber weniger
Disziplinen vollstaendig anschliessen als alle vier mit halber Stichprobe** — die Referenzen aus
Welle 1/2 sind methodisch vergleichbar gezogen, und das soll so bleiben.

### 6.4 G4 — die restlichen 3 Punkte (12 → 15)

Audit 3.3: `gastGesetzt` steht in allen vier Baufunktionen (Bahn: `:17880-17881`), aber
„**Nicht verifiziert** ist, ob damit auch die Feldgroessen-Wirkung selbst stimmt". Das ist billig
nachzuholen — `disziplinMessen()` nimmt bereits ein `jeSeite`-Argument
(`scripts/lib/rangtreue-messung.mjs:147-154`):

```
for n in 2 3 4 5 6: miss jede der vier Bahnen mit jeSeite=n
```
Abnahme: (a) die tatsaechliche Teilnehmerzahl je Seite entspricht `n`, (b) rho bleibt bei jeder
Feldgroesse ueber 0,80. Ergebnis als kleine Tabelle in den PR und in
`docs/design/stand-aller-disziplinen.md`. **Wenn eine Feldgroesse durchfaellt, ist das ein Fund, kein
Misserfolg** — dann bleibt G4 bei 12 und Takeshi Gameplay bei 97 statt 100.

### 6.5 Assets 60 → 95

**A1 (15 → 30) — `takeshi.tsx` (273 Z.) auf Mockup-Niveau.** Das Mockup ist die Vorlage, nicht
umgekehrt: `bodenTakeshiRoute()` (`:16351`, 171 Z., fuenf Gelaendezonen, Tuempel, Burgmauer, Tor)
und `zeichneFalleTakeshi()` (`:16230`, 120 Z., zehn Fallenbilder). Was in die `.tsx` gehoert:

- **Die fuenf Gelaendezonen** entlang des `bandD`-Pfads (`takeshi.tsx:40`) statt drei generischer
  Etiketten — Schlamm, Wasser, Stein, Eis, Wiese, mit passenden Fuellungen.
- **Die zehn Fallenbilder** aus `BAHN_ART["takeshis-castle"].fallenBild` (`:17253`:
  `labyrinth/eis · steine/walzen · tuer/seilwand · brueckenball/schlamm · raeder/spitzen`) als
  SVG-Symbole an ihren Streckenpositionen. Die vorhandenen PNGs
  (`public/sprites/arena/falle_fass|spitzen|strickleiter|tuer|walze.png`) sind **nicht** nutzbar,
  weil `.tsx` reines SVG rendert — als Pfade nachzeichnen, im Stil der schon vorhandenen
  `logs()`/`castle()`-Helfer (`takeshi.tsx:104-132`).
- **Fallen-Reaktion**: das Mockup hat `fallenAusgang()` (Nachwackeln bei Durchbruch, gruenes Gluehen
  bei sauber) — in der `.tsx` als kurzer CSS-/SMIL-Impuls, wenn ein Token die Falle passiert.
- **Auffaecherung**: die Laeufer klumpen (Screenshot). `lane`-Versatz von `(t.laneIdx % 5) - 2`
  (`:58`) auf eine breitere Verteilung + Etikett nur fuer Hover/Trio.

**A3 (20 → 25):** die Bahn-Zeile in der Requisiten-Tabelle aus PR 0 (3.2) — kein Laeufer traegt
mehr Schrotflinte oder Axt (Befund 2 aus Abschnitt 2). Zusaetzlich: ein **Kopftuch/Stirnband** als
Requisit waere schoen, ist aber ohne neues Sprite-Blatt nicht drin — **nicht einplanen**.

**A4 (0 → 15):** Ton aus dem Katalog — `falle` (Holzschlag), `sturz`, `platsch` (Wasser),
`tor` (Gong an der Burg), `publikum` (Loop). Aufrufstellen in `stepSpurt()`s Takeshi-Zweigen
(dort, wo `fallenAusgang`/`nervenKosten` schon buchen) — **rein additiv, keine Formelzeile**.

**Ergebnis:** A1 30 + A2 25 + A3 25 + A4 15 = **95 %**.

### 6.6 Abnahme Ziel 3

- **Vor** jeder Aenderung Basislinie ziehen: `node scripts/miss-alle-disziplinen.mjs 24 staffel
  spurt takeshis-castle time-trial climbing` — **alle fuenf**, weil sie sich `stepSpurt()`/
  `bauSpurt()` teilen. Nach der Aenderung ziffernidentisch (der Anschluss aendert am Motorlauf
  nichts; `spieleBahn()` ist additiv).
- Die zwei Pflicht-Invarianten aus 6.2 als echte Testdatei.
- Die Feldgroessen-Matrix aus 6.4.
- `node scripts/pruefe-pps-referenz-frische.ts` nach dem Ziehen.
- `npx tsc --noEmit`, Vitest gruen (die Fail-Fast-Querpruefungen in
  `battle-mode-arena-team-points.ts` werfen beim Modul-Laden — ein vergessener Konfigblock faellt
  sofort in JEDEM Test auf, das ist gewollt).

---

## 7. Ziel 4 — Breaking: **Assets 65 % → 95 %** und **Movement 55 % → 95 %**

**Rubrik-Luecke:** A1 (20/30), A4 (0/20); M2 (0/25), M4 (0/15), M3 nur teilweise (20/25).

### 7.1 M2 — der Cypher wird echt (`stepCypher()`)

`cypher:true` (`:10742`) ist laut eigenem Kommentar (`:10733-10741`) **„Rein zeichnerisch"**. Der
Screenshot zeigt genau, was das kostet: zwoelf Tanzende stehen bewegungslos auf ihrem
Score-Radius, vier davon **stapeln sich uebereinander** im Zentrum, Namen laufen in die
Zonen-Etiketten.

Die Loesung liegt in der Sportart selbst, und sie repariert das Layout gleich mit:
**in einem echten Cypher tanzt immer genau EINER in der Mitte.** Der Rest steht im Ring. Genau das
bildet die vorhandene Warteschlange schon ab — `buehneQueue`/`buehneZeiger` (`:11571-11572`)
bestimmen bereits, **wessen** Durchgang gerade enthuellt wird.

`stepCypher(dt, art)` (Dispatcher aus PR 0, gegated auf `art.cypher`):

```
u.vizR, u.vizA       Radius und Winkel im Ring (statt der reinen Score-Position)
u.vizPhase           "ring" | "eintritt" | "throwdown" | "freeze" | "rueckzug"
u.vizPhaseT
u.vizMove            0..3, deterministisch aus (u.id + u.aktuell) — Toprock/Footwork/Powermove/Freeze
```

- **Grundzustand `ring`:** alle auf dem AEUSSEREN Ring, gleichmaessig verteilt, mit einer langsamen
  gemeinsamen Rotation (`vizA += ω·dt`) und einem kleinen Wippen im Takt (`sin(buehneT·2π·bpm/60)`).
  **Damit ist das Stapelproblem strukturell weg** — der Radius traegt nicht mehr den Score.
- Wird ein Durchgang enthuellt (`u.lunge=0.5`, `:11581`): `eintritt` (0,15 s, Gleiten zur Mitte) →
  `throwdown` (0,25 s, Move) → `freeze` **oder** `rueckzug`, je nach
  `u.runden[u.aktuell].ereignis === art.erfolgWort` („setzt den Move") bzw. `art.failWort`
  („Move bricht ab") → zurueck auf `ring`.
- **Wo bleibt der Score sichtbar?** Nicht mehr im Radius (der ist jetzt Choreografie), sondern in
  der **Ring-Reihenfolge**: der Fuehrende steht dem Zentrum am naechsten auf der Sichtachse, und
  behaelt die Krone (`:12699-12701`). Das ist ehrlicher als heute — heute behauptet der Radius eine
  Praezision, die im Gedraenge ohnehin nicht ablesbar ist.

Vertrag aus 3.3 gilt unveraendert: nur `viz*`, kein `rr()`, keine Formel.

### 7.2 M4 — Move-Posen und FX

Ohne neue Sprite-Blaetter, aus dem vorhandenen Baukasten:

| Move | Umsetzung |
|---|---|
| Toprock | `walk`-Zyklus, Blickrichtung wechselt im Takt |
| Footwork | Figur tief gesetzt (y-Versatz nach unten), schnellerer Zyklus |
| Powermove | Figur um ihren Fusspunkt **rotiert** (`ctx.rotate` um den Bodenpunkt) — Windmill |
| Freeze | Ein Frame eingefroren, leicht gekippt, mit goldenem Standbild-Ring (der Ring existiert schon, `:12658-12663`) |

Dazu: **Bodenstaub** beim Powermove, **Riss-Flash** beim Abbruch (existiert schon, `:12664-12677` —
kuenftig an die Mitte statt an den Ringplatz gebunden), **Schatten-Streckung** unter der Figur.

### 7.3 A1 (20 → 30) — `breaking.tsx` ist die duennste Feld-Datei aller zwanzig (187 Z.)

Was fehlt, damit sie „eigene, nicht generische Feld-Datei" voll einloest:

- **Cypher-Boden**: Linoleum-Kreis mit Nahtlinien statt eines reinen Verlaufs.
- **DJ-Pult / Boombox / Lautsprecher** am Rand — die Kulisse, die die Disziplin benennt.
- **Battle-Bracket-Leiste** oben (wer gegen wen, welche Runde) aus `sorted`/`rt` — Breaking ist ein
  K.-o.-Format, und das ist heute nirgends zu sehen.
- **Beat-Puls**: die vorhandene Druckwelle (`:133-139`) auf ein festes BPM-Raster legen, statt
  frei laufender 2,6 s — dann pulsiert das Feld im Takt des Tons aus 3.1.
- **Etiketten-Kollision**: die vier Zonen-Etiketten (`:104-106`) stehen mittig ueber dem Ring und
  kollidieren mit Tokens (Screenshot). Auf die 12-Uhr-Achse setzen oder nur bei Hover zeigen.

### 7.4 A4 (0 → 15) — Ton

`beat` (Loop, das Rueckgrat der Disziplin — perkussives Muster aus `klick`+`schlag` auf festem BPM),
`freeze` (kurzer Stopp-Akzent), `powermove` (Rauschsweep), `abbruch` (dumpfer Schlag). Der Beat
ist gleichzeitig der Taktgeber fuer 7.1/7.3 — **eine** Zahl (`BREAKING_BPM`), aus der Bewegung,
Puls und Ton dieselbe Zeitbasis ziehen.

### 7.5 Erwartetes Ergebnis

- **Assets:** A1 30 + A2 25 + A3 25 + A4 15 = **95 %**
- **Movement:** M1 35 + M2 25 + M3 25 + M4 10 = **95 %**

### 7.6 Abnahme

- `node scripts/miss-alle-disziplinen.mjs 24 breaking` → **≥ 0,85** (heute 0,869, Spannweite 0,125).
- Kontrolllauf ueber alle uebrigen neun Buehnen — ziffernidentisch (geteiltes `stepBuehne()`).
- Screenshot-Serie ueber 8 s: sichtbar **eine** Figur in der Mitte je Moment, keine Ueberlappung,
  keine abgeschnittene Figur am Bildrand.

---

## 8. Verifikation — der gemeinsame Pflichtteil

Jeder der fuenf PRs (0 + vier Ziele) legt im PR-Text ab:

1. **Kaderfeste rho-Messung der GETEILTEN Chassis-Geschwister**, nicht nur der eigenen Disziplin:
   - `stepBuehne()`-Familie (Ziel 1, 2, 4 und PR 0): `gewichtheben speed-schach showcase
     eiskunstlauf breaking wettessen tennis fechten i-spy`
   - `stepSpurt()`-Familie (Ziel 3): `staffel spurt takeshis-castle time-trial climbing`
   - `zeichneSprite()`-Familie (PR 0, Ziel 1): zusaetzlich `basketball hockey football` — die
     Requisiten-Tabelle liegt in einer Funktion, die alle vier Chassis durchlaufen.

   Befehl (SYNCHRON, blockierend, hohes Timeout — nicht im Hintergrund):
   ```sh
   node scripts/miss-alle-disziplinen.mjs 24 <disziplinen ...>
   ```
   Richtwert aus dem Audit: ~34 s je Disziplin bei n=24; in dieser Sitzung nachgemessen mit n=8
   ueber vier Disziplinen: ~2 min gesamt.

2. **Die Toleranzregel, damit niemand Rauschen fuer Regression haelt:** eine Verschiebung, die
   kleiner ist als die eigene Spannweite der Disziplin, ist **nicht unterscheidbar**
   (`docs/design/messgrundlage-kaderfest.md`). Spannweiten heute: Gewichtheben 0,265 · Breaking
   0,125 · Takeshi 0,130 · Eiskunstlauf **0,094**. Nur bei Eiskunstlauf ist die Messung scharf
   genug, um eine echte kleine Verschiebung zu sehen — dort besonders genau hinsehen.
   **Chris' Vorgabe gilt:** Balancing ist in diesem Schritt nachrangig; verboten sind nur echte
   Regressionen unter die 0,80-Schranke.

3. **Slot-Invariante:** `window.__arena.feldspielSubskills(d)` (`:21910`) bzw. der
   `namenVon`/`sichern`/`zurueck`-Rahmen — nach jedem neuen Einstiegspunkt muss der Motorzustand
   unveraendert sein. Konkret: zweimal `spieleBahn("spurt",1337)` hintereinander muss zweimal
   dasselbe Ergebnis liefern (`M.zurueck(g)` raeumt korrekt auf).

4. **Playwright-Sichtcheck** ueber `scripts/screenshot-disziplin.mjs` (PR 0), Vorher/Nachher in
   `docs/design/` abgelegt. Fuer Bewegung: **drei** Aufnahmen mit Abstand, sonst ist „bewegt sich"
   nicht belegt.

5. `npx tsc --noEmit` und die Vitest-Suites (nur Ziel 3 aendert TypeScript).

---

## 9. Reihenfolge, Aufteilung, Kollisionsmatrix

### 9.1 Wer fasst was an

| | `engine.js` Zeichnen | `engine.js` `stepBuehne` | `engine.js` `:2569-2577` | `engine.js` `window.__arena` | `.tsx` | `lib/` + `scripts/` |
|---|---|---|---|---|---|---|
| **PR 0** | Ton-Block `:16044+` | **die eine Dispatcher-Zeile** | **die Tabelle** | — | — | `screenshot-disziplin.mjs` |
| Ziel 1 Gewichtheben | `zeichneHeben` `:12061-12226`, neu `bodenHeben`, neu `zeichneHantel` `~:311` | — | — | — | `barbell.tsx` | — |
| Ziel 2 Eiskunstlauf | `zeichneDuett` `:11822-11916`, neu `bodenEis` | **`stepKuer()` (eigene Funktion)** | — | — | (`eiskunst.tsx`, optional) | — |
| Ziel 3 Takeshi | `bodenTakeshiRoute` `:16351`, `zeichneFalleTakeshi` `:16230` | — | — | **`spieleBahn()` `~:22090`** | `takeshi.tsx` | `arena-headless-runner.ts`, `battle-mode-arena-team-points.ts`, `ziehe-buehne-pps-referenz.ts`, 4× JSON |
| Ziel 4 Breaking | `zeichneBreaking` `:12561-12704` | **`stepCypher()` (eigene Funktion)** | — | — | `breaking.tsx` | — |

**Nach PR 0 ueberschneidet sich keine Zelle.** Die beiden einzigen echten Kollisionspunkte
(`stepBuehne`-Einstieg und die Waffenzeilen) sind genau die, die PR 0 vorwegnimmt. Die Ziel-PRs
fuegen jeweils **eine neue Funktion an einer neuen Stelle** ein — das ist das bewaehrte Muster
dieses Projekts („jede neue Mechanik hinter einem eigenen, exklusiven Flag in einem neuen
Dispatcher-Zweig, keine gemeinsame Logik anfassen"), hier zum vierten (`duett`), fuenften
(`cypher`) und ersten Mal fuer ein ganzes Chassis (`bahn`).

### 9.2 Reihenfolge

```
              ┌─ Ziel 1  Gewichtheben Assets      (Agent A)
              ├─ Ziel 2  Eiskunstlauf Movement    (Agent B)
   PR 0  ─────┤
  (merge!)    ├─ Ziel 4  Breaking Assets+Movement (Agent C)
              └─ Ziel 3  Takeshi Gameplay+Assets  (Agent D)  ← startet SOFORT parallel zu PR 0
```

- **PR 0 muss gemerged sein**, bevor A, B, C anfangen. Er ist klein; Ziel ist „innerhalb der ersten
  Stunde".
- **Ziel 3 (Agent D) darf sofort starten**, parallel zu PR 0 — es beruehrt weder `stepBuehne()`
  noch die Waffenzeilen. Und es muss frueh starten: die PPS-Referenzen sind 80–140 Minuten reine
  Rechenzeit (6.3), das ist der kritische Pfad der Session.
- **Agent D teilt sich intern in zwei:** D1 (Gameplay/Anschluss, TypeScript + Referenzen) und
  D2 (`takeshi.tsx` Assets). D2 ist eine reine `.tsx`-Aufgabe ohne jede Beruehrung mit D1.
- **Rebase-Regel:** jeder Ziel-PR rebased vor dem Merge auf `main` und laesst danach seine
  Chassis-Geschwister-Messung **noch einmal** laufen. Zwei praesentationale Zweige in derselben
  Datei koennen sich textuell sauber mergen und trotzdem zusammen etwas anderes tun.

### 9.3 Was ausdruecklich NICHT in diese Session gehoert

| Sache | warum nicht |
|---|---|
| Climbing anschliessen | rho 0,790 unter der Schranke (6.1) |
| I-Spy anschliessen | rho 0,684, ausdruecklich mit Regressionstest festgehalten |
| `barbell.tsx` auf literale kg | eigener Datenpfad durch 2000 Zeilen geteilten Code + Designfrage an Chris (4.3) |
| Fechten kalibrieren, Football-Rezept, Arena-Messbudget | Audit-Prioritaeten 5–8, keine der beauftragten Achsen |
| Ton fuer die uebrigen 15 Disziplinen | die Schicht entsteht in PR 0; sie zu FUELLEN ist je Disziplin eine eigene kleine Runde |
| `zieheFormkarten`, Rezepte, Matrizen | Chris: „balancing ist im ersten step noch nicht so wichtig" |

---

## 10. Ehrliche Einschaetzung — wo >90 % sicher ist und wo nicht

**Sicher erreichbar (hohe Zuversicht):**

- **Takeshi Gameplay 67 → 97.** Reine, bekannte Bauarbeit nach einem dreimal erprobten Muster.
  Das einzige Risiko ist **Zeit**, nicht Machbarkeit: die PPS-Referenzen sind 80–140 Minuten
  Browserzeit. Wenn die Zeit knapp wird, ist die richtige Reaktion, **weniger Bahnen vollstaendig**
  anzuschliessen (Takeshi zuerst, es ist beauftragt), nicht die Stichprobe zu kuerzen.
- **Eiskunstlauf Movement 60 → 95.** M2 ist reine, RNG-freie Praesentationsmechanik; das Muster
  (eigener Flag, eigener Zweig) ist im selben Dispatcher dreimal vorexerziert.
- **Breaking Movement 55 → 95.** Dito — und die Cypher-Regel („einer in der Mitte") loest das
  Ueberlappungsproblem als Nebeneffekt mit.

**Erreichbar, aber mit einer Bedingung, die Chris kennen muss:**

- **Alle drei Assets-Achsen (Gewichtheben, Takeshi, Breaking) haengen an der Ton-Schicht.**
  Ohne sie ist die ehrliche Decke **80 %**, nicht 90 % — und zwar bei allen dreien, egal wie gut
  die Optik wird. Mit prozeduralem WebAudio-Ton setze ich A4 bei **15 von 20** an, nicht bei 20:
  ein synthetisiertes Publikum ist keine Aufnahme, und ich will die Zahl nicht schoenrechnen.
  **Falls Chris synthetischen Ton nicht als „Ton" gelten laesst, sind die drei Assets-Ziele in
  dieser Session nicht erreichbar** — dann ist der bestmoegliche Schritt Assets **80 %** ueberall
  (A1+A2+A3 voll) plus eine fertige, leere Ton-Schicht, in die er spaeter Dateien legt. Das ist die
  eine Stelle, an der ich keine Zusage gebe, die ich nicht halten kann.

**Wo ich zusaetzlich Zweifel habe, klein aber real:**

1. **M4 (Posen/FX) setze ich bei 10 von 15 an**, nicht bei 15 — bei Eiskunstlauf wie bei Breaking.
   Echte disziplineigene Posen brauchten neue Sprite-Blaetter (Schlittschuhe, Kostuem, Windmill-
   Zyklus); die gibt es nicht und sie sind nicht in einer Session zu zeichnen. Mit 10 kommt
   Movement auf 95 — die Rechnung traegt. Faellt M4 auf 5, sind es 90, also gerade noch „min >90"
   nicht mehr. **Das ist der engste Puffer im ganzen Plan.** Wer hier spart, verfehlt das Ziel.
2. **`takeshi.tsx` auf Mockup-Niveau** (6.5) ist die groesste reine Zeichenarbeit im Plan:
   273 → geschaetzt 550–650 Zeilen SVG, zehn Fallensymbole von Hand als Pfade. Das ist machbar,
   aber es ist Handarbeit ohne Abkuerzung — die PNGs aus `public/sprites/arena/` helfen der
   `.tsx` nicht, weil sie reines SVG rendert.
3. **Die Rubrik ist eine Einstufung, keine Messung** (Audit Abschnitt 7, Punkt 3). „95 %" heisst
   „nach derselben offengelegten Regel wie am 10.09. eingestuft". Ein anderer Gutachter kaeme auf
   andere Zahlen. Was sich nicht verschiebt: Hantel in der Hand statt daneben, Eis statt
   Nachtklubpodest, ein Tanzender in der Mitte statt vier uebereinander, und vier Bahnen im echten
   Spiel statt in keinem.

**Was diese Session NICHT verspricht:** dass die vier Disziplinen danach „fertig" sind. Sie sind
dann auf ihren beauftragten Achsen ueber 90 % nach der Rubrik von heute. Ton bleibt fuer 15 weitere
Disziplinen offen, Climbing und I-Spy bleiben unter der Schranke, Football und die drei
Arena-Disziplinen bleiben die grossen Rezept-Baustellen.

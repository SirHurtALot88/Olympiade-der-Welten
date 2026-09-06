# Zeitfahren von Grund auf: keine Hindernisse, Einzelstart, Zwischenzeiten — Recherche (06.09.)

Stand: `101505e8` (HEAD von `origin/main` am 06.09.2026, PR #827 gemergt — Endstand-Overlay für
Staffel/Takeshi). Alle Zeilenangaben meinen `public/mockups/battle-mode.engine.js` auf diesem
Stand. Alle Messungen liefen in einem eigenen `git worktree` gegen echte Kaderdaten
(`data/generated/kaderfamilie-live-save.json`, fünf Team-Paarungen aus dem `live-save`-Abbild) mit
`node scripts/miss-alle-disziplinen.mjs [n] time-trial` — demselben Skript und derselben
Kaderfamilie, die `docs/design/stand-aller-disziplinen.md` führt. Der Motor auf `main` ist
**nicht** angefasst; dieser PR trägt ausschließlich diese Datei.

Chris' Auftrag, wörtlich (06.09.): „time trial wie gesagt keine hindernisse und ein zeitfahren wo
man alle spieler einzeln sieht wie sie auf einer strecke fahren, überleg dir mal wie man das
darstellen könnte — vllt auch ne andere perspektive und wo man eingebettet die zeiten der anderen
hat die man versucht zu schlagen mit so 2 chrono zwischnezeiten wie beim zeitfahren und dann der
endzeit im ziel und der diff dazwischen und dann gibts einige die mehr reserven haben hinten was
raus holen mit ihrer ausdauer etc manche die fast sind aber denen die puste ausgeht, manchmal wirds
auch etwas hügelig oder so wo dann andere stats noch rein spielen usw bitte sauber ausarbeitne und
umsetzen".

---

## 0. Ergebnis vorab

1. **Der heutige Zustand ist nicht das, was Chris beschreibt.** Time-Trial hat neun „Hindernisse"
   (`hindernisse:[0.10 … 0.90]`, `hindernisWort:"Kurve"`) mit **echtem Sturzrisiko** — dieselbe
   Technik/Wucht/Stolper-Mechanik wie die Hürden im Spurt, nur mit dem Wort „Kurve" statt „Hürde".
   Alle zwölf Läufer starten gemeinsam bei `rennT=0` und laufen nebeneinander auf zwölf Spuren wie
   im Spurt — optisch ist Time-Trial von einem Massenstart-Sprint nicht zu unterscheiden. Das ist
   genau das, was Chris „keine Hindernisse" und „einzeln sehen" korrigieren will.
2. **Die Rangtreue besteht heute komfortabel: 0,867 je Spiel, 0,909 Saison** (n=24, kaderfest,
   Spannweite 0,050/0,056 — bestanden, s. `docs/design/stand-aller-disziplinen.md` Zeile 521).
   Der Grund dafür ist genau die Mechanik, die weg soll: neun echte Zufallsentscheidungen
   (Technik-Wurf je Kurve) sind neun unabhängige Stichproben derselben Fähigkeit, und das glättet
   Rauschen (Zuverlässigkeit; CLAUDE.md). Wer die Kurven ersatzlos streicht, verliert diesen
   Glättungseffekt — **das ist der zentrale Befund dieser Recherche**, nachgemessen, nicht vermutet.
3. **Fünf Rezept-Kandidaten wurden gebaut und kaderfest gemessen** (Abschnitt 3). Ein reines
   „nur Ausdauer, keine Hügel" fällt knapp durch (0,798). Hügel allein mit einem bestehenden
   Sub-Skill als Bergfähigkeit tragen knapp (0,811, dünner Puffer). Ein **neuer** Kletter-Substat
   (Power/Stamina/Determination) macht es **schlechter** (0,790) — Determination steckt gar nicht
   in der Time-Trial-Matrix, ein neues Attribut ohne Matrixbezug schadet der Rangtreue mehr, als es
   Fiktion gewinnt. **Empfehlung: Hügel + technische Kurvenabschnitte, beide ohne Sturzrisiko,
   beide über bestehende Sub-Skills (ENDTEMPO fürs Bergauf, WENDIGKEIT für Kurve/Abfahrt)** — 0,824
   bis 0,834 je nach Streckenanteil, kaderfest bestanden, aber mit spürbar dünnerem Puffer als
   heute (Abschnitt 3.5).
4. **Nebenbefund, der Chris' eigene Fiktion trifft:** ohne Hindernisse hat ein Zeitfahren fast
   **keinen** Zufall mehr übrig — dieselbe Kaderpaarung liefert bei jedem Rennen praktisch dieselbe
   Reihenfolge (rho je Spiel ≈ rho Saison, Zuverlässigkeit ≈ 1,0). Das ist unrealistisch (jedes
   echte Zeitfahren hat Tagesform, Wind, einen verschätzten Antritt) und macht ein wiederholtes
   Rennen langweilig. Eine kleine Tagesform-Schwankung (±1,5–3 % Tempo, einmal je Rennen gezogen)
   bringt einen Rest Zufall zurück und bleibt kaderfest bestanden (0,816–0,822), kostet aber
   sichtbar Puffer — ein Dreh-Regler, den Chris braucht, nicht eine Zahl, die die Recherche
   festlegen kann (Abschnitt 3.6).
5. **Die Präsentation ist unabhängig von der Rangtreue lösbar, weil Time-Trial-Läufer sich nie
   beeinflussen** (`schatten:false, tackle:false` — bestätigt, unverändert): jeder fährt seine
   eigene, von allen anderen unabhängige Zeitreihe. Ein Einzelstart mit gestaffelten Startzeiten
   ist **billig**, weil `u.startT` als generisches Feld bereits existiert (heute nur von der
   Staffel benutzt) und `tempoVon()` es bereits generisch liest (Zeile 16528). Das Einzige, was
   sich an der Wertung ändern muss: der Rang muss nach **eigener Laufzeit** (`fertig - startT`)
   sortieren statt nach Zieluhrzeit (`fertig`) — sonst kippt die Reihenfolge, sobald Starts
   versetzt sind. Das ist eine Umbenennung, keine neue Formel (Abschnitt 4.2).
6. **Für die Zwischenzeiten-Anzeige gibt es noch nichts** — kein Checkpoint-Konzept, keine
   Speicherung von Zwischenzeiten, kein Diff-Panel. Empfehlung: zwei Checkpoints bei 40 % und 76 %
   der Strecke, an den Übergängen der Geländezonen platziert (Ende von Anstieg+Abfahrt), Diff
   gegen den bis dahin schnellsten Läufer im Feld — dieselbe Logik, die `bahnRangliste()` für den
   vorläufigen Punktestand schon einmal gebaut hat (Abschnitt 4.3).
7. **Empfohlene Reihenfolge:** zuerst das Rezept (Abschnitt 3, betrifft rho, braucht
   Isolationsnachweis wie jeder Motor-Patch), danach Einzelstart + Zeitrechnung (klein, aber
   berührt die Wertung), danach das Zwischenzeiten-Panel (rein optisch, kein Risiko), zuletzt
   optional eine Streckenvisualisierung mit sichtbaren Hügeln (Abschnitt 5).

---

## 1. Ist-Zustand

### 1.1 Chassis und Konfiguration

Time-Trial ist eine von fünf `BAHN_ART`-Disziplinen, die sich einen Motor teilen (`stepSpurt`,
`tempoVon`, `zeichneSpurt`, `bauSpurt`) — Spurt, Staffel, Time-Trial, Climbing, Takeshi's Castle.
Die Konfiguration (Zeile 15527–15584):

```js
"time-trial":{
  technikBasis:0.20, technikSpanne:0.0060, wuchtBasis:0.12, wuchtSpanne:0.0085,
  wendigErholt:0.0050,
  wuchtKraft:16, wuchtZeit:0.16, stolperGrund:0.75, stolperSpanne:0.90, stolperKraft:6,
  kraftBasis:290, kraftSpanne:2.7,
  label:"Time-Trial", jeSeite:6, hindernisse:[0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80,0.90],
  hindernisWort:"Kurve", boden:"#3c3f45", schatten:false, tackle:false,
  grundTempo:96, tempoSpanne:0.82,
  wertung:"rang",
  rezept:{
    ANTRITT:    {speed:48,power:30,dexterity:22},
    ENDTEMPO:   {speed:42,stamina:34,intelligence:24},
    TECHNIK:    {intelligence:40,dexterity:34,awareness:26},
    WENDIGKEIT: {dexterity:44,awareness:38,speed:18},
    STEHEN:     {stamina:46,intelligence:30,awareness:24},
    WUCHT:      {torment:40,dexterity:32,awareness:28},
    ROBUST:     {awareness:30,dexterity:26,stamina:24,intelligence:20}
  },
  plaene:{
    gleich:  {tempo:0.93, sucht:0, ab:0.75},   // Gleichmaß
    negativ: {tempo:0.88, sucht:0, ab:0.55},   // Negativ-Split
    attacke: {tempo:1.00, sucht:0, ab:0.60}    // Attacke
  }
}
```

Matrix (Eignungsgewicht, `BASIS_JE_DISC["time-trial"]`, Zeile 3469): `dexterity:25, speed:22,
intelligence:18, stamina:15, awareness:12, power:5, torment:3`.

### 1.2 „Kurve" ist ein Hindernis mit Sturzrisiko, kein Streckenmerkmal

`hindernisse:[0.10 … 0.90]` sind neun feste Streckenpunkte; an jedem läuft (Zeile 16619 ff., mit
`HUERDEN_N()` = dieselbe Liste, `hindernisWort:"Kurve"` nur als Anzeigetext) exakt dieselbe
Prüfung wie an einer Spurt-Hürde:

1. **Technik-Wurf** (`technikBasis+TECHNIK·technikSpanne`, gedeckelt bei 0,97): gelingt er, „sauber
   drüber" — kostet nichts.
2. Misslingt er: **Wucht-Wurf** (`wuchtBasis+WUCHT·wuchtSpanne`): gelingt er, „bricht durch" —
   kostet Reserve und 0,16 s Zeitstrafe (`wuchtZeit`).
3. Misslingt auch der: **Sturz** — `stolperGrund+(1−TECHNIK/100)·stolperSpanne` Sekunden
   Zeitstrafe (0,75–1,65 s bei Technik 0, günstiger mit WENDIGKEIT), plus Reservekosten
   (`stolperKraft`).

Bei Technik-Sub-Skill 70 gelingen laut Kopfkommentar „62 % sauber" — 38 % der neun Kurven kosten
also etwas, und der Kommentar selbst nennt das Wort, das Chris nicht will: „Wer die Linie verpasst,
kann noch RISIKO nehmen … Das kostet Reserve und geht manchmal schief." Das ist ein Fall-Risiko an
neun festen Streckenpunkten, exakt die Hindernis-Semantik, die Takeshi's Castle für Fallen benutzt
— nur ohne Ausscheiden (`nervenKosten` ist für Time-Trial nicht gesetzt).

### 1.3 Alle Läufer starten gemeinsam, Massenstart-Optik

`bauSpurt()` setzt für Time-Trial kein `startT` (nur die Staffel tut das, `art.staffel`-Zweig,
Zeile 16325 ff.); alle zwölf Läufer beginnen bei `rennT=0` auf zwölf parallelen Spuren
(`bahnZ:bahn`, `bahn=i*2`/`i*2+1`). `zeichneSpurt()` zeichnet sie exakt wie im Spurt: Figur auf
eigener Spur, Name und Plan über dem Kopf, Kraftreserve-Balken darunter, Kamera zoomt automatisch
auf das gesamte noch laufende Feld (`kameraUpdate`, Zeile 16205). **Es gibt keine Kameraführung, die
einen einzelnen Läufer isoliert, keine Zwischenzeit-Erfassung und kein Vergleichs-Panel** — das
bestätigt eine Volltextsuche nach „Zwischenzeit"/„split" im gesamten Motor (keine Treffer außer
zwei Fähigkeitsnamen, die nichts mit dem Rennen zu tun haben).

### 1.4 Die Wertung ist bereits sauber (05.–06.09. erledigt)

`wertung:"rang"` (PR #804/#827, `docs/design/time-trial-einzelzeitfahren-wertung-plan-05-09.md`):
alle Läufer beider Seiten in einer Rangliste nach Zielzeit, Platz 1 bekommt N Punkte, Teamstand ist
die Summe, Gleichstand bleibt Unentschieden. `renderEndstandBahn()` (Zeile 18576) zeigt am Ende ein
Overlay mit Läufer/Platz/Zeit/Punkte je Seite. **Daran ändert diese Recherche nichts** — die
Punktewertung bleibt, was sie ist; nur die Zeit, nach der sortiert wird, muss bei gestaffeltem
Start zur eigenen Laufzeit werden (Abschnitt 4.2).

### 1.5 Rendering-Grundlagen der Bahn-Familie — was wiederverwendbar ist

| Baustein | Wo | Heute genutzt von | Für Time-Trial wiederverwendbar? |
|---|---|---|---|
| Gerade Bahn, N Spuren, automatischer Zoom auf das Feld (`kameraUpdate`, Zeile 16205) | Spurt, Staffel, **Time-Trial**, Climbing | alle außer Takeshi | Ja, unverändert für die Team-Gesamtansicht |
| „Route"-Modus: gewundener Pfad mit Catmull-Rom-Kurve, 2D-Kamera folgt einer Bounding-Box der Laufenden (`routeXY`, `kameraUpdate`-Zweig `istRoute()`, Zeile 16176/16205) | nur Takeshi's Castle (`route:[[…]]`, zwölf Wegpunkte als Bruchteile von Breite/Höhe) | — | **Ja, mit neuem Wegpunkt-Layout**: derselbe Mechanismus kann eine Strecke zeichnen, die sichtbar auf- und absteigt (Wegpunkte mit wechselnder y-Höhe an den Hügel-Zonen) — macht „hügelig" zum ersten Mal SICHTBAR, nicht nur eine Zahl im Reserve-Balken |
| Auswahl-Marke an einem Läufer (`bahnWahl`, Ring+Strich am Boden, Zeile 17043 ff., für die Rennplan-Ansage) | alle Bahnen | — | Ja: derselbe Selektions-Mechanismus kann „diesen Läufer fokussieren" statt „diesem Läufer einen neuen Plan geben" bedeuten |
| Endstand-Overlay, generische Tabelle (Läufer/Platz/Zeit/Punkte, `renderEndstandBahn`, Zeile 18576) | alle fünf Bahnen | — | Ja: zusätzliche Spalten „ZZ1"/„ZZ2" sind eine Erweiterung derselben Tabelle, kein neues Overlay |
| Kraftreserve-Balken unter der Figur (`zeichneSpurt`, „schmaler Balken unter den Fuessen") | alle Bahnen | — | Ja, unverändert — zeigt die Ausdauer-Reserve, genau das, was Chris mit „mehr Reserven haben" meint |
| Schwebetexte am Läufer (`schwebe()`, verankert an `_laeufer`) | alle Bahnen | „stolpert", „bricht durch", „eingebrochen" | Für die neue Mechanik: „im Anstieg" / „gewinnt auf der Abfahrt" statt Sturz-Texte |

Es gibt **keine** Einzelkamera, die auf einen Läufer zoomt und den anderen ausblendet — das wäre
neu (Abschnitt 4.1).

---

## 2. Warum „keine Hindernisse" die Rangtreue kostet — die Mechanik dahinter

CLAUDE.md, das Produkt-Gesetz dieses Projekts: `rho(ein Spiel) = rho(Saison) × Wurzel(Verlässlichkeit)`.
Verlässlichkeit hängt an der Ereigniszahl — **mehr unabhängige Stichproben derselben Fähigkeit
glätten Zufallsrauschen**. Die neun Kurven-Würfe sind genau das: neun unabhängige Ziehungen, die
Technik/Wucht abfragen. Nachgemessen an der heutigen Mechanik (kaderfest, n=24):

| | rho je Spiel | rho Saison | implizite Verlässlichkeit (Quotient²) |
|---|---:|---:|---:|
| Heute (neun Kurven mit Sturzrisiko) | 0,867 | 0,909 | 0,91 |

Eine Verlässlichkeit von 0,91 ist schon hoch — Time-Trial ist mit neun Ereignissen je Rennen
dichter besetzt als die meisten anderen Bahnen. Wer die Kurven ersatzlos streicht, streicht diese
neun Ereignisse. Was übrig bleibt, ist ein fast **deterministischer** Ablauf: `tempoVon()` ist eine
reine Funktion aus Sub-Skills, Plan und Streckenanteil, ohne einen einzigen `rr()`-Aufruf. Für
dieselbe Aufstellung liefert praktisch **jede Saat dasselbe Ergebnis** — gemessen an den
Kandidaten unten liegt rho je Spiel und rho Saison fast immer auf derselben Zahl (Verlässlichkeit
≈ 1,0, Abschnitt 3.6). Die Frage ist deshalb nicht „wie bauen wir die Kurven nach", sondern **„womit
ersetzen wir die Ereigniszahl, ohne Fallrisiko zu erfinden"** — und das ist eine Validitätsfrage
(entscheidet die neue Mechanik das Richtige?), keine Verlässlichkeitsfrage mehr.

---

## 3. Rezept-Kandidaten — gebaut und kaderfest gemessen

### 3.1 Gemeinsamer Unterbau: ein generischer „Gelände"-Hook

Für alle fünf Kandidaten wurde derselbe kleine, generische Mechanismus gebaut (Diff in Anhang A),
der **keine** der bestehenden vier anderen Bahnen berührt (nur aktiv, wenn `BA().gelaende`
gesetzt ist):

```js
function gelaendeAn(pos){                 // welche Zone, wie stark (0..1, Rand bis Mitte)
  const zn=BA().gelaende; if(!zn)return null;
  for(const z of zn){ if(pos>=z.von&&pos<=z.bis){
    const mitte=(z.von+z.bis)/2, halb=(z.bis-z.von)/2||1;
    return {art:z.art, staerke:1-Math.abs(pos-mitte)/halb};
  }}
  return null;
}
function gelaendeFaktor(u){               // Tempo-Multiplikator, GLATT, kein Ja/Nein-Wurf
  const z=gelaendeAn(u.pos); if(!z)return 1;
  const A=BA();
  if(z.art==="steigung"){ const skill=skillLesen(u,A.bergSkill||"BERG");
    return 1-Math.max(0,(A.bergKosten??0.16)*z.staerke*(1-skill/100)); }
  if(z.art==="abfahrt"){ const skill=skillLesen(u,A.abfahrtSkill||"WENDIGKEIT");
    return 1+(A.abfahrtBonus??0.08)*z.staerke*(skill/100); }
  if(z.art==="kurve"){ const skill=skillLesen(u,A.kurveSkill||"WENDIGKEIT");
    return 1-Math.max(0,(A.kurveKosten??0.10)*z.staerke*(1-skill/100)); }
  return 1;
}
```

Wichtig: **kein `rr()`, kein Sturz, kein Ausscheiden.** Eine Zone kostet Tempo stetig, an ihrem
Rand null, in ihrer Mitte am meisten — wie ein echtes Streckenprofil, nicht wie eine Falle. Ergänzt
um einen Reserve-Mehrverbrauch am Anstieg (`gelaendeZehrFaktor`, dieselbe Idee wie `steigung` bei
Climbing, nur zonal statt über die ganze Strecke).

### 3.2 Die fünf Kandidaten

Alle mit `hindernisse:[]` (keine Kurven-Hindernisse mehr), kaderfest gemessen,
`node scripts/miss-alle-disziplinen.mjs 24 time-trial`, live-save-Kaderfamilie:

| # | Kandidat | Bergskill (Anstieg) | Abfahrt/Kurve-Skill | rho je Spiel | Spannw. | rho Saison | Spannw. | Abnahme |
|---|---|---|---|---:|---:|---:|---:|---|
| **K0** | *(Ist-Zustand, zum Vergleich)* neun Kurven mit Sturzrisiko | — | — | **0,867** | 0,050 | 0,909 | 0,056 | bestanden, komfortabel |
| K1 | Nur Ausdauer — keine Hügel, kein Gelände, reine Ebene | — | — | 0,798 | 0,094 | 0,811 | 0,105 | **knapp durchgefallen** |
| K2 | Zwei Hügel (Anstieg+Abfahrt), Bergfähigkeit = bestehendes ENDTEMPO | ENDTEMPO | WENDIGKEIT | 0,811 | 0,093 | 0,811 | 0,058 | bestanden, dünn |
| K3 | Zwei Hügel, **neuer** Substat BERG (power/stamina/determination, ersetzt TECHNIK) | BERG (neu) | WENDIGKEIT | 0,790 | 0,089 | 0,790 | 0,133 | **durchgefallen** |
| K4 | Zwei Hügel, Bergfähigkeit = bestehendes STEHEN | STEHEN | WENDIGKEIT | 0,797 | 0,106 | 0,795 | 0,098 | **knapp durchgefallen** |
| **K5** | Zwei Hügel **+ drei technische Kurvenzonen** (kein Sturz), Bergfähigkeit ENDTEMPO, Kurve/Abfahrt WENDIGKEIT | ENDTEMPO | WENDIGKEIT | **0,824** | 0,087 | 0,811 | 0,067 | **bestanden** (n=48: 0,827/0,076) |

Bei n=48 (doppelte Stichprobe je Kader-Paarung, zur Kontrolle) bleibt K5 stabil: 0,827/0,076 je
Spiel, 0,811/0,063 Saison — kein Zufallsausschlag von n=24.

### 3.3 Warum K1/K4 knapp scheitern und K3 schlechter ist als K1

- **K1 (reine Ebene) verliert, weil Dexterity (Matrixgewicht 25, das höchste) keinen Kanal mehr
  hat.** WENDIGKEIT (dexterity 44/awareness 38/speed 18) diente bisher nur der Sturz-Erholung
  (`wendigErholt`) — ohne Stürze ist sie tot. TECHNIK (intelligence 40/dexterity 34/awareness 26)
  ebenso. Zwei von sieben Sub-Skills, die zusammen 37 % der Matrix abdecken, fallen komplett aus.
- **K4 (STEHEN als Bergfähigkeit)** verdoppelt die Rolle von Ausdauer (STEHEN trägt schon die
  Ermüdung, jetzt zusätzlich die Hügel) und **fügt keinen neuen Kanal hinzu** — Dexterity/Awareness
  bleiben tot, deshalb bleibt es bei ~0,80.
- **K3 (neuer BERG-Substat) ist schlechter als K1**, obwohl es mechanisch mehr tut. Der Grund:
  `determination` kommt in der Time-Trial-Matrix **überhaupt nicht vor** (Matrix: dexterity, speed,
  intelligence, stamina, awareness, power, torment). Ein Sub-Skill, der zu einem Drittel aus einem
  matrixfremden Attribut besteht, drückt Rangtreue, statt sie zu heben — dieselbe Lehre wie beim
  Klettern-Kapitel der Bahn-Recherche vom 02.09.: **neue Attribute ohne Matrixbezug sind ein
  Verlustgeschäft**, so plausibel die Fiktion („Bergfahren braucht Kraft und Willen") auch klingt.
- **K5 gewinnt, weil es Dexterity/Awareness über WENDIGKEIT einen echten, aber realistischen
  Kanal zurückgibt** — technische Kurven und Abfahrten sind genau die Stellen, an denen
  Radsport-Zeitfahren tatsächlich Fahrtechnik statt reiner Leistung verlangen (s.
  `docs/design/bahn-disziplinen-recherche-fable.md` Abschnitt 3.2: „in der Kurve ist die Leistung
  null", Zignoli 2021) — und das **ohne** Sturzrisiko, weil der Verlust stetig statt binär ist.

### 3.4 Streckenanteil hügelig/technisch — ein Dreh-Regler, kein Fixwert

K5 wurde mit zwei Streckenanteilen gemessen:

| Streckenprofil | Anteil Hügel+Kurve an der Strecke | rho je Spiel (n=24) | Spannw. | rho je Spiel (n=48) |
|---|---:|---:|---:|---:|
| moderat: 2 Kurvenzonen (7 %) + 2 Hügel (12 %+6 %) | 57 % | 0,824 | 0,087 | 0,827 |
| ausgedehnt: 3 Kurvenzonen (13 %) + 2 Hügel (12 %+6 %) | 74 % | 0,834 | 0,067 | 0,837 |

Mehr Streckenanteil mit Terrain-Effekt hebt rho leicht UND senkt die Spannweite (mehr Fläche, auf
der Sub-Skills statt reiner Ebene entscheiden, glättet die Kaderabhängigkeit) — aber 74 % der
Strecke „ereignisreich" ist kaum noch ein „manchmal hügelig", wie Chris es beschreibt, sondern ein
Rundkurs mit ständigem Geländewechsel. **Das ist eine Fiktionsfrage, keine Rechenfrage** — Abschnitt
6, Frage 1.

### 3.5 Der Puffer ist dünner als heute, auch bei K5 — ehrlich gesagt

K0 (Ist-Zustand) hat 0,067 Puffer über der Schranke bei nur 0,050 Kaderrauschen — ein robuster
Abstand. K5 (moderat) hat 0,024 Puffer bei 0,087 Kaderrauschen: **der Puffer ist kleiner als das
Rauschen selbst.** Nach der Regel aus `docs/design/messgrundlage-kaderfest.md` heißt das: eine
einzelne Kader-Ziehung, die 0,79 statt 0,824 zeigt, wäre von Rauschen nicht zu unterscheiden — man
kann heute nicht sagen, K5 bestehe „sicher", nur „im Median". Vor einer Umsetzung braucht es
entweder das ausgedehnte Profil (0,834/0,067, etwas robuster) oder eine weitere Kalibrierungsrunde
mit mehr Kader-Varianten, wie sie jede andere Disziplin vor der Abnahme durchlaufen hat.

### 3.6 Nebenbefund: ohne Hindernisse ist ein Zeitfahren fast deterministisch

Auffällig an allen fünf Kandidaten: rho je Spiel und rho Saison liegen fast auf derselben Zahl
(K2: 0,811/0,811; K4: 0,797/0,795; K5 bei n=48: 0,827/0,811) — anders als beim Ist-Zustand (0,867
gegen 0,909, ein Abstand von 0,042). Der Grund: `gelaendeFaktor`/`tempoVon` enthalten **keinen**
`rr()`-Aufruf mehr — für eine feste Aufstellung ist das Rennergebnis nahezu unabhängig von der Saat.
**Dieselben zwölf Läufer liefern bei jedem Zeitfahren praktisch dieselbe Reihenfolge und denselben
Abstand.** Das ist rechnerisch unproblematisch (es drückt rho nicht), aber es widerspricht Chris'
eigener Fiktion („manche haben mehr Reserven … manchmal wirds hügelig" impliziert Überraschung,
nicht Wiederholung) und macht ein zweites Zeitfahren derselben Paarung witzlos.

Test: eine einmal je Rennen gezogene Tagesform-Schwankung (`formTag = 1 + (rr()−0,5)·2·Anteil`,
multipliziert auf `tempoVon`) — der einzige verbliebene Zufall:

| Tagesform-Spanne | rho je Spiel (n=48) | Spannw. | rho Saison (n=48) | implizite Verlässlichkeit |
|---:|---:|---:|---:|---:|
| 0 % (K5, s.o.) | 0,827 | 0,076 | 0,811 | ≈ 1,02 (Rundungsrauschen) |
| ±1,5 % | 0,822 | 0,085 | 0,818 | ≈ 0,99 |
| ±3 % | 0,816 | 0,095 | 0,825 | ≈ 0,97 |

Alle drei bestehen (>0,80), der Puffer schrumpft aber mit jedem Prozentpunkt Zufall. **±1,5 %** ist
ein vernünftiger Startwert: genug, damit dieselbe Paarung nicht jedes Mal identisch ausgeht, wenig
genug, um die Schranke nicht zu gefährden — aber das ist ein Gefühlswert, kein Messergebnis, und
gehört auf den Prüfstand einer echten Playtesting-Runde (Abschnitt 6, Frage 2).

---

## 4. Präsentation: Einzelstart, Kamera, Zwischenzeiten

### 4.1 Warum die Präsentation von der Rangtreue entkoppelt ist

Time-Trial hat `schatten:false, tackle:false` — kein Läufer beeinflusst einen anderen. Jede
Zeitreihe `pos(t)` ist unabhängig von den anderen elf. Das heißt: **wie das Rennen gezeigt wird,
ändert nichts daran, was simuliert wird.** Man kann alle zwölf weiterhin gemeinsam auf derselben
Rennuhr `rennT` simulieren (unverändertes Timing, keine neue Messung nötig) und trotzdem so
**zeigen**, als führe jeder für sich — das ist reine Präsentationsarbeit, kein Motor-Risiko.

### 4.2 Einzelstart — billig, weil `startT` schon existiert

`tempoVon()` liest bereits `u.startT||0` generisch (Zeile 16528: „JEDER HAT SEINE EIGENE
ANFAHRT" — für die Staffel gebaut, aber nicht staffelspezifisch geschrieben). Ein gestaffelter
Start für Time-Trial ist deshalb eine Zeile in `bauSpurt()`:

```js
if(d==="time-trial") L.startT = idx * STAGGER;   // z.B. 6-8s Abstand, wie ein echtes Startrampen-Feld
```

**Aber:** Die Wertung sortiert heute nach `u.fertig` (absolute Rennuhr-Zeit). Mit gestaffeltem
Start würde ein später gestarteter, tatsächlich schnellerer Läufer eine spätere `fertig`-Zeit
haben als ein früh gestarteter Langsamer — die Rangliste würde nach Startreihenfolge kippen, nicht
nach Leistung. Die Korrektur ist eine **Umbenennung, keine neue Formel**: überall, wo `u.fertig`
für die Wertung gelesen wird (`bahnRangliste()`, `MOTOREN["time-trial"].wert()`), muss
`u.fertig − (u.startT||0)` stehen — die **eigene** Laufzeit, nicht der Uhrzeitpunkt. Weil kein
gemeinsamer, zeitabhängiger Zufall im Spiel ist (keine Windschatten, kein sich änderndes Gelände
über die Rennuhr), ist die Rangordnung nach eigener Laufzeit **identisch** mit der Rangordnung, die
ein gleichzeitiger Start liefern würde — analytisch, nicht nur vermutet. Trotzdem: wie jeder
Wertungs-Patch dieses Projekts braucht das einen Isolationsnachweis (vorher/nachher-Vergleich der
Ränge bei festen Saaten, wie in `time-trial-einzelzeitfahren-wertung-plan-05-09.md` Abschnitt 4.1
vorexerziert), bevor es auf `main` geht — es fasst `bahnRangliste()` an, auch wenn das Ergebnis
sich nicht ändern sollte.

**Aufwand: klein.** Eine neue Konfigurationszahl (Startabstand), eine Zeile in `bauSpurt`, eine
Umbenennung an zwei bis drei Lesestellen, ein Isolationsnachweis.

### 4.3 Kamera: Einzelläufer-Fokus statt Feld-Zoom

`kameraUpdate()` zoomt heute auf eine Bounding-Box aller **noch laufenden** Läufer
(`LAEUFER.filter(u=>u.fertig==null)`). Für „einen einzeln sehen" reicht eine zweite Betriebsart:
dieselbe Funktion, aber die Quelle ist **ein** Läufer statt aller aktiven — der Zoom zieht dann eng
auf ihn, wie ein Kamerawagen, der neben dem Fahrer herfährt. Auswahl über denselben Mechanismus,
der heute schon für die Rennplan-Ansage existiert (`bahnWahl`, Ring-Marke am Boden) — ein Klick auf
einen Läufer in der Kaderleiste fokussiert ihn, ein zweiter Klick (oder „nächster Läufer") gibt die
Feldansicht zurück oder wechselt zum nächsten.

**Andere Perspektive, wie von Chris angeregt:** die „Route"-Infrastruktur (Zeile 16176 ff.), heute
nur für Takeshi's Castle mit zwölf Wegpunkten `[[fx,fy], …]` als Bruchteile von Breite/Höhe
benutzt, kann eine **sichtbar** auf- und absteigende Strecke zeichnen — die Wegpunkte an den
Hügel-Zonen bekommen einfach eine andere y-Koordinate (höher = weiter oben im Bild = optisch „den
Berg hinauf", exakt wie ein Höhenprofil, das oft in echten Radsport-Übertragungen eingeblendet
wird). Das macht „manchmal wirds hügelig" zum ersten Mal **sichtbar**, nicht nur eine Zahl im
Reserve-Balken. Aufwand: mittel (ein neues Wegpunkt-Array + Farbzonen wie bei Takeshis
Geländezonen, kein neuer Code — dieselbe `routeXY`/`kameraUpdate`-Maschine).

**Was NICHT nötig ist:** eine echte 3D-Perspektive oder Seitenansicht. Die Route-Draufsicht mit
Höhenandeutung ist der günstigste Weg zu „andere Perspektive, die Hügel zeigt" und nutzt
bestehenden Code vollständig.

### 4.4 Das Zwischenzeiten-Panel

**Zwei Checkpoints, an den Geländeübergängen platziert:** ZZ1 bei 40 % der Strecke (Ende von
Anstieg+Abfahrt 1), ZZ2 bei 76 % (Ende von Anstieg+Abfahrt 2) — nicht willkürlich, sondern genau
dort, wo ein Zuschauer fragt „hat er den Vorsprung vom Berg auf der Abfahrt gehalten?". Ziel ist der
dritte, natürliche Punkt.

**Diff gegen wen:** Empfehlung ist der **bis dahin schnellste Läufer im Feld** an genau diesem
Checkpoint (nicht ein fester Rivale) — das ist dieselbe Logik, die `bahnRangliste()` für den
vorläufigen Punktestand bereits eingeführt hat („vorläufig, aber ehrlich", Abschnitt 3.5 des
05.09.-Plans): ein Läufer, der als Fünfter startet, sieht beim ersten Checkpoint den Rückstand auf
den bis dahin Schnellsten, nicht auf einen Platzhalter. Das ist zugleich fictionally korrekt: echte
Zeitfahr-Übertragungen zeigen „+0:12 auf die aktuelle Bestzeit", nicht auf einen beliebigen Gegner.

Panel-Vorschlag, im Stil des bestehenden Endstand-Overlays (Tabelle Läufer/Platz/Zeit/Punkte,
`renderEndstandBahn`, Zeile 18576) — als Erweiterung derselben Tabelle, nicht als neues Overlay:

```
 Johanna — Negativ-Split
 ZZ1 (40 %)   12,4 s   +0,6 s hinter Bestzeit (Tidesprinter)
 ZZ2 (76 %)   19,8 s   +0,3 s hinter Bestzeit  ← Rückstand verkleinert (Ausdauer trägt)
 Ziel         24,1 s   +0,2 s hinter Bestzeit → Platz 2
```

Live während des Rennens: dieselbe Zeile aktualisiert sich, sobald der fokussierte Läufer einen
Checkpoint passiert (Speicherung: ein Array `u.zwischenzeiten=[]`, das `stepSpurt` beim
Positions-Übergang füllt — dieselbe Technik wie die neun Hindernis-Übergänge heute schon prüfen,
nur ohne die Sturz-Logik dahinter). Aufwand: mittel — zwei neue Datenfelder je Läufer, eine
Prüfschleife analog der heutigen Hindernisschleife (aber ohne Würfel), eine HTML-Erweiterung der
bestehenden Endstand-Tabelle plus ein kleines Live-Panel für den fokussierten Läufer.

### 4.5 „Reserven, die hinten was rausholen" und „denen geht die Puste aus" — teilweise schon da

Die Ermüdungsformel (`mued`, Zeile 16538, unverändert in allen Kandidaten) senkt ab 45 % Strecke
das Tempo umso mehr, je niedriger STEHEN ist — das ist bereits „wem geht die Puste aus". Der
Negativ-Split-Plan (`tempo:0.88` bis 55 % Streckenanteil, dann `1.0`) ist bereits „hält Reserven
für hinten" als Strategiewahl. Was fehlt, ist nicht Mechanik, sondern **Sichtbarkeit**: der
Reserve-Balken existiert (Zeile 17043, „Kraftreserve als schmaler Balken unter den Füßen"), aber
niemand liest ihn während eines 10-Sekunden-Rennens auf zwölf Spuren gleichzeitig. Im
Einzelläufer-Fokus (4.3) wird genau dieser Balken zum Hauptelement — Chris' „Reserven"-Satz ist
also größtenteils ein Präsentations-, kein Rezeptproblem.

---

## 5. Priorisierte Empfehlung

| Schritt | Was | Aufwand | Berührt rho? | Voraussetzung für |
|---|---|---|---|---|
| **1** | Rezept: Hindernisse raus, Hügel+Kurvenzonen rein (K5, Abschnitt 3), Tagesform-Dreh­regler | mittel (≈60 Zeilen Motor, ein `BAHN_ART`-Eintrag) | **Ja — braucht Isolationsnachweis + weitere Kalibrierung** (Puffer ist dünn, 3.5) | alles Weitere: die Präsentation zeigt, was das Rezept liefert |
| **2** | Einzelstart + Wertung auf eigene Laufzeit umstellen | klein | Nein (analytisch rangordnungserhaltend), aber Wertungscode angefasst → Isolationsnachweis Pflicht | 3, 4 |
| **3** | Kamera-Fokus auf einen Läufer (bestehende Auswahl-Marke wiederverwenden) | mittel | Nein | 4 |
| **4** | Zwischenzeiten-Panel (2 Checkpoints + Diff zur Bestzeit + Endzeit-Diff) | mittel | Nein | — |
| **5 (optional)** | Route-Perspektive mit sichtbarem Höhenprofil (Wegpunkte umbauen wie bei Takeshi) | mittel | Nein | — |

**Reihenfolge-Begründung:** Schritt 1 ist der einzige, der die Abnahmezahl bewegt und deshalb zuerst
feststehen muss — alles danach (Kamera, Panel, Route) baut auf den Streckenzonen auf, die Schritt 1
definiert (Checkpoints liegen an den Geländeübergängen). Schritte 2–4 sind rein optisch bzw.
umbenennend und können unabhängig vom endgültigen Rezept-Feintuning starten, sobald die
Zonenpositionen feststehen. Schritt 5 ist ein Nice-to-have, das den größten Beitrag zum
„es fühlt sich neu an"-Eindruck leistet, aber am wenigsten dringend ist.

---

## 6. Offene Fragen an Chris

1. **Streckenanteil.** 57 % der Strecke hügelig/technisch (K5 moderat, rho 0,824, Puffer dünn) oder
   74 % (K5 ausgedehnt, rho 0,834, robusterer Puffer, aber kaum noch „mal hügelig")? Eine dritte
   Option (mehr, kleinere Zonen statt weniger, große) ist ungeprüft und könnte den Kompromiss
   verbessern — reine Rechenarbeit, kein Vorabentscheid nötig, aber eine Richtung von Chris hilft.
2. **Tagesform-Zufall.** 0 / 1,5 / 3 % Tempo-Schwankung — alle drei bestehen kaderfest, aber der
   Puffer schrumpft mit jedem Prozentpunkt. Das ist ein Spielgefühl-Dreh­regler (soll dieselbe
   Paarung im Zeitfahren jedes Mal fast identisch ausgehen oder nicht?), keine Messfrage.
3. **Gegen wen zeigt die Diff-Anzeige?** Empfehlung „bis dahin schnellster im Feld" (Abschnitt
   4.4) — Alternativen wären „direkter Gegenspieler auf demselben Slot" (pacer gegen pacer) oder
   „eigene Bestzeit/PB aus früheren Rennen" (bräuchte Speicherung über ein Rennen hinaus, deutlich
   mehr Aufwand). Fiktion und Aufwand sprechen für die Empfehlung, aber es ist Chris' Entscheidung.
4. **Wie schaut man sich zwölf Läufer „einzeln" an?** Automatisch der Reihe nach durchschalten wie
   eine TV-Übertragung (bei ~10–20 s je Lauf sind zwölf Läufer 2–4 Minuten), frei wählbar per Klick,
   oder nur die eigenen sechs plus den gegnerischen Spitzenreiter zeigen und den Rest überspringen?
   Das ist eine reine UX-Frage ohne Rechenanteil.
5. **Bleibt die Rang-Punkte-Wertung (Platz 1 = N Punkte) unverändert**, auch wenn jetzt die eigene
   Laufzeit statt der Uhrzeit zählt? Das ist keine neue Frage — Chris hat sie am 06.09. für den
   Ist-Zustand schon entschieden (Gleichstand bleibt Unentschieden, kein Zeitsummen-Tiebreak,
   `time-trial-einzelzeitfahren-wertung-plan-05-09.md` Abschnitt 3.3) — nur als Reminder, dass
   Schritt 2 diese Entscheidung nicht neu aufmacht, sondern nur die Zeitbasis dahinter korrigiert.

---

## Anhang A — Probe-Code (nicht Teil dieses PRs, Nachweis in einem `git worktree`)

Alle Zahlen in Abschnitt 3 kommen aus echten `node scripts/miss-alle-disziplinen.mjs`-Läufen gegen
einen editierten Motor in einem separaten `git worktree` (Basis `origin/main` `101505e8`) — nicht
aus einer Schätzung. Kern des generischen Gelände-Hooks (vollständig in Abschnitt 3.1); die
BAHN_ART-Konfiguration für Kandidat K5 (moderates Streckenprofil, ±1,5 % Tagesform):

```diff
-      label:"Time-Trial", jeSeite:6, hindernisse:[0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80,0.90],
+      label:"Time-Trial", jeSeite:6, hindernisse:[],
+      gelaende:[{von:0.08,bis:0.15,art:"kurve"},
+                {von:0.22,bis:0.34,art:"steigung"},{von:0.34,bis:0.40,art:"abfahrt"},
+                {von:0.46,bis:0.53,art:"kurve"},
+                {von:0.58,bis:0.70,art:"steigung"},{von:0.70,bis:0.76,art:"abfahrt"},
+                {von:0.85,bis:0.92,art:"kurve"}],
+      bergSkill:"ENDTEMPO", bergKosten:0.22, bergZehr:1.1,
+      abfahrtSkill:"WENDIGKEIT", abfahrtBonus:0.08,
+      kurveSkill:"WENDIGKEIT", kurveKosten:0.16, tagesform:0.015,
```

`tempoVon()` (Zeile 16522) und die Reserve-Verbrauchsformel (Zeile ~16697, `zehr`) bekommen je eine
zusätzliche Multiplikation (`*gelaendeFaktor(u)*(u.formTag||1)` bzw. `*gelaendeZehrFaktor(u.pos)`),
`formTag` wird einmal je Läufer beim Aufbau gezogen (`bauSpurt`, `setz()`). Für Kandidat K3 (in
Abschnitt 3.2/3.3 verworfen) wurde probeweise `TECHNIK:{intelligence:40,dexterity:34,awareness:26}`
zu `BERG:{power:40,stamina:34,determination:26}` umbenannt und `bergSkill:"BERG"` gesetzt — dieser
Teil ist **nicht** im empfohlenen K5-Rezept enthalten (TECHNIK bleibt dort ungenutzt, dieselbe
Situation wie WUCHT bei der Staffel vor ihrer Reparatur, s.
`docs/design/bahn-disziplinen-recherche-fable.md` Abschnitt 1.5 — ein offener Anschlusspunkt,
kein Fehler dieser Runde).

Isolationsnachweis für die anderen vier Bahnen: `hindernisse`/`gelaende`/`formTag` werden nur
gelesen, wenn `BA().gelaende` bzw. `BA().tagesform` gesetzt ist — für Spurt, Staffel, Climbing,
Takeshi's Castle (keins von beiden gesetzt) bleiben `gelaendeFaktor`/`u.formTag` bei `1`, die
Multiplikation ist wirkungslos. Nicht per Vollmessung nachgewiesen (das wäre Teil der
Umsetzungsrunde, nicht dieser Recherche), aber am Code ersichtlich: beide neuen Funktionen sind
reine `if(BA().feld)`-Wächter ohne Rückwirkung auf bestehende Pfade.

## Anhang B — Messbefehle

```sh
git worktree add <pfad> origin/main
cd <pfad> && ln -s <repo>/node_modules node_modules   # Playwright/Chromium aus dem Hauptcheckout
# BAHN_ART["time-trial"] wie in Anhang A editieren, dann:
node scripts/miss-alle-disziplinen.mjs 24 time-trial
node scripts/miss-alle-disziplinen.mjs 48 time-trial   # Kontrollmessung, doppelte Stichprobe
```

Kader-Quelle in beiden Fällen: `live-save (Oly New Game Custom 19.8.2026, 09:08:45)`, dieselbe
Datei, die `docs/design/stand-aller-disziplinen.md` für alle zwanzig Disziplinen führt.

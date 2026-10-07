# Team-Publikum und Feiermomente — Konzept für alle Disziplinen (30.09.)

Chris' Idee, wörtlich: „die anderen Modelle vom Team dann dahin stellt und dass die quasi so die
Zuschauer sind und dass die dann mitfeiern und dann steigt da so Feuerwerk oder Konfetti auf, wenn
einer die Runde gewinnt". Sein Folgeauftrag: „wir wollen ja action und keine langweiligen
Disziplinen" — also disziplinübergreifend, nicht nur Gewichtheben.

Das hier ist ein Konzeptpapier für einen Build-Agenten. Alle Zeilennummern beziehen sich auf
`public/mockups/battle-mode.engine.js` im Stand `origin/main` **802d90c** (30.09.). Nach jedem
Merge verschieben sie sich — die Funktionsnamen sind der verlässliche Anker, die Zeilen nur die
Suchhilfe.

---

## 0. Kurzfassung

- **Ein gemeinsamer Baukasten, sechs dünne Adapter.** Ein Modul (`teamFeier…`, Abschnitt 2) kennt
  vier Stufen (klein / mittel / groß / Finale), zeichnet Hüpfer, Konfetti in Teamfarbe, Feuerwerk,
  einen Teamfarben-Lichtblitz und ein kurzes Bildwackeln. Jede Disziplin liefert nur zwei Dinge:
  **wer ist Publikum** und **wo fällt der Auslöser**.
- **Gewichtheben ist der Idealfall** und kommt zuerst: zehn der zwölf Heber stehen die ganze Sendung
  über ungenutzt in `TEILNEHMER` und werden heute nur als Textzeile am unteren Rand gezeigt. Der
  Auslöser (Kampfrichterlampen schalten) ist schon als Zustandswechsel in `stepHeben()` da.
- **Breaking ist fast geschenkt:** der Zuschauerring aus zehn Sprites existiert bereits, der
  Auslöser (`letzterGauntletBruch`) auch. Rund 15 Zeilen.
- **Staffel** hat ihr Publikum schon im Bild (die wartenden Läufer im Innenfeld), drei Auslöser
  sind schon als Flanken erkannt (Übergabe, Führungswechsel, Ziel).
- **Time-Trial, Spurt, Speed-Schach** brauchen eine Teambank im Bildschirmraum bzw. eine
  Kiebitz-Gruppe, weil die Kamera zoomt oder die Spieler gerade selbst spielen. Später.
- **Alles bleibt Klasse A/A\*:** kein `rr()`, keine Attributrechnung, keine Wertung. Ein
  Zeitstempel je Ereignis, Streuung nur über `cypherHash()`. rho/Pp müssen bit-identisch bleiben.
- **Ehrlich:** Die Feiern heilen das *Bild* (Tabelle 6.2 im Audit: Standbild) und den Ton der
  Sendung, nicht die *Banner*-Lücken (Tabelle 6.1). Hockeys „88 s ohne Banner" löst das nicht.

---

## 1. Korrekturen am Auftrag und Befunde, die das Design bestimmen

### 1.1 Korrekturen

1. **`docs/design/f1-broadcast-audit-runde-2-30-09.md` existiert nicht im Repo** — weder auf `main`
   noch auf einem der geprüften Remote-Zweige (`broadcast-*-30-09`, `broadcast-runde-2-26-09`,
   `ui-bewegungs-audit-26-09`). Der Motor zitiert es dreimal (Z. 14805, 19012, 24753), also lag es
   dem Audit-Agenten lokal vor und wurde nie committet. **Verifiziert aus Motor-Kommentaren**:
   Gewichtheben „95 % der Sendezeit Standbild, bis zu 30 s ohne sichtbare Änderung (Tabelle 6.2)"
   (Z. 23326) und Staffel/Spurt/Time-Trial „17–22 s vollständige Stille (Tabelle 6.1)" (Z. 28862,
   29436). **Nicht verifizierbar**, nur aus dem Auftrag übernommen: Staffel 85 s ohne Banner,
   Time-Trial 23,5 s Standbild, Speed-Schach 76 % stehende Bilder, Hockey 88 s ohne Banner.
   → Wer das Audit-Dokument hat, sollte es committen; sonst misst die nächste Runde ins Leere.
2. **Der „Kampf-Ring" mit den zehn Zuschauern ist nicht das Kampf-Chassis**, sondern
   `zeichneBreaking()` (Z. 24179, Bühne-Auftritt, `art.cypher`/`art.gauntlet`); die Zuschauer stehen
   bei Z. 24324–24343. Das Kampf-Chassis (TDM/Battlefield, `draw()` ab Z. 36558) hat keinen
   Zuschauerring.
3. **Gewichtheben ist Bühne-Chassis** (`bauBuehne` → `baueHebenDuelle`, Z. 15608), nicht Kampf.

### 1.2 Fünf Befunde, ohne die der Bau schiefgeht

| # | Befund | Beleg | Folge fürs Design |
|---|---|---|---|
| B1 | **Die Sprite-Uhr `t` läuft auf Bühne und Bahn nie.** `stepSim()` kehrt für Bühne/Bahn vor `t+=dt` zurück. Jede zusätzlich gezeichnete Figur steht dort im selben Einzelbild. | Z. 27811–27817; Kommentar Z. 35330ff | Bewegung muss als **Zeichen-Versatz** kommen (Hüpfer in y), nicht über die Gehanimation. |
| B2 | **Die vorhandene Jubelpose `u.vizJubel` (→ `ani="shoot"`) wirkt nur bei LPC-Figuren.** Der `b.reiherMech`-Zweig (Z. 3486–3576) und der `b.vollbild`-Zweig (Z. 3578–3813) kehren vorher mit `return` zurück und ignorieren sie — das betrifft die 65 Vollbild-Kreaturen. | Z. 3884–3889 | **Primäre Animation = Hüpfer** (wirkt auf alle drei Zeichenpfade). Die Arme-hoch-Pose ist Zugabe nur für LPC. |
| B3 | **`buehneT` friert bei `done` ein** (`stepBuehne` kehrt vor `buehneT+=dt` zurück), und **Sim-Zeit ist gedehnt**: 1 Sim-Sekunde = `ZEIT_DEHNUNG[disc]` echte Sekunden (Staffel 14,65, Spurt 11,14, Gewichtheben 4). Ein 2-s-Fenster in `rennT` wäre in der Staffel 29 s lang. | Z. 16828–16829, 37142ff, `loop()` Z. 37217 | **Feier-Uhr = `jetztMs()`** (Z. 26066): echte Millisekunden, läuft nach `done` weiter, im Sonden-Modus deterministisch (`sondenSimMs`). Kein `zeitFaktor()`-Fallstrick. |
| B4 | **Das Endstand-Overlay deckt die Bühne im selben Frame zu, in dem `done` fällt.** `#endstand` ist `position:absolute; inset:0` über `.arenaraum`; `updateHudBuehne()` zeigt es sofort (Z. 19107–19111). Bei Gewichtheben fällt `done` schon bei der *Enthüllung* des letzten Versuchs (Z. 17254) — die letzte Hebung samt Lampen läuft unsichtbar hinter dem Overlay. | Z. 19096–19112, 29333ff; `battle-mode.css` `.endstand` | Ohne kurzen **Endstand-Nachlauf** ist das Finale (und das letzte Duell) nie zu sehen. Siehe 2.6. |
| B5 | **`css()` ruft `getComputedStyle` bei jedem Aufruf.** | Z. 26092 | Teamfarben **einmal pro Frame** lesen, nicht je Konfettistück. |

Zwei Randbefunde: `stumm` (Z. 26803) ist während aller Rangtreue-Messungen gesetzt
(`stepSimStumm`, Z. 27742) — jede Auslösefunktion kehrt deshalb als Erstes bei `stumm` zurück, wie
`feed()` es vormacht. Und die Bahn übergibt `zeichneSprite()` schon heute ein **Stellvertreter-Objekt**
statt des echten Läufers (`parcSpriteArg`, Z. 35941) — dasselbe Muster nimmt die Teambank, damit
kein Zeichenaufruf ein Feld am echten `u` hinterlässt.

---

## 2. Der gemeinsame Baukasten

Einmal bauen, auf Modulebene (Nachbarschaft von `wettessenEndeSeit`/`showcaseSaumSeit`,
Z. 19182ff). Reine Anzeige-Buchhaltung.

### 2.1 Zustand und Auslösen

```js
// TEAM-FEIER (Konzept team-publikum-feiermomente-konzept-30-09.md). Reine Anzeige:
// kein rr(), keine Rueckwirkung auf wert()/rezept/Wertung. Uhr = jetztMs() (Befund B3).
let teamFeiern=[];            // hoechstens 4 Eintraege {seite,stufe,seitMs,nr,anker}
let teamFeierNr=0;            // Saat fuer cypherHash, deterministisch je Spiel
const TEAM_FEIER_STUFEN={
  klein: {dauer:600,  hops:1,amp:6, pose:false,konfetti:0, blitz:false,wackel:0,feuerwerk:0},
  mittel:{dauer:1200, hops:2,amp:9, pose:true, konfetti:16,blitz:false,wackel:0,feuerwerk:0},
  gross: {dauer:2400, hops:3,amp:12,pose:true, konfetti:40,blitz:true, wackel:3,feuerwerk:0},
  finale:{dauer:3500, hops:4,amp:12,pose:true, konfetti:60,blitz:true, wackel:4,feuerwerk:3}
};
function teamFeierAusloesen(seite,stufe,anker){
  if(stumm)return;                                   // Messpfad: nie
  if(seite!==0&&seite!==1)return;                     // Remis/unklar: keine Feier
  const jetzt=jetztMs();
  // Dosis: eine laufende, gleich starke oder staerkere Feier derselben Seite wird nicht
  // ueberschrieben, eine schwaechere wird ersetzt. Verhindert Doppelfeuer (z.B. Zieleinlauf
  // Platz 1 + Hot-Seat-Wechsel im selben Frame).
  const rang=s=>["klein","mittel","gross","finale"].indexOf(s);
  const laufend=teamFeiern.find(f=>f.seite===seite&&jetzt-f.seitMs<TEAM_FEIER_STUFEN[f.stufe].dauer);
  if(laufend&&rang(laufend.stufe)>=rang(stufe))return;
  teamFeiern=teamFeiern.filter(f=>f!==laufend);
  teamFeiern.push({seite,stufe,seitMs:jetzt,nr:++teamFeierNr,anker:anker||null});
  if(teamFeiern.length>4)teamFeiern.shift();
}
```

`anker` ist ein Bildschirmpunkt `{x,y}` (Konfetti-Ursprung) oder `null` (dann die Bank der Seite,
s. 2.3). **In `reset()` (Z. 39180) zurücksetzen:** `teamFeiern=[]; teamFeierNr=0;` — dieselbe
N1-Falle, die `showcaseSaumSeit`/`eisBandeSeit` dort schon dokumentieren (Z. 39249ff).

### 2.2 Hüpfer und Pose für jede Figur, die Publikum ist

```js
function teamFeierHaltung(u){             // -> {dy, pose, sackt}
  const jetzt=jetztMs(); let dy=0,pose=false,sackt=0;
  for(const f of teamFeiern){
    const S=TEAM_FEIER_STUFEN[f.stufe], alter=jetzt-f.seitMs;
    if(alter<0||alter>S.dauer)continue;
    if(f.seite===u.side||f.seite===u.seite){
      // leichter Phasenversatz je Figur, sonst huepft der Block wie EIN Brett
      const versatz=(cypherHash(u.id|0,f.nr)%100)/100*0.18;
      const p=Math.max(0,Math.min(1,alter/S.dauer-versatz));
      const ausklingen=1-Math.max(0,(p-0.75)/0.25);
      dy=Math.min(dy,-Math.abs(Math.sin(p*Math.PI*S.hops))*S.amp*ausklingen);
      pose=pose||S.pose;
    } else if(f.stufe==="gross"||f.stufe==="finale"){
      sackt=Math.max(sackt,3*Math.max(0,1-alter/700));   // die Gegenseite "raunt" (vgl. hebenDroop Z. 19821)
    }
  }
  return {dy:dy+sackt,pose,sackt};
}
```

`u.side` (Bühne) und `u.seite` (Bahn) sind beide abgedeckt. Die Pose wird nie an `u` geschrieben,
sondern über ein Stellvertreter-Objekt an `zeichneSprite()` übergeben (2.3).

**Pose-Vorbehalt:** `vizJubel` wählt das `shoot`-Blatt (13 Bilder, ursprünglich ein Bogenschuss).
Welches Einzelbild als „Arme hoch" liest, ist nicht vermessen — der Build-Agent wählt es per
Screenshot und fixiert es über `vizAniPhase:k/13` (Z. 3924: `zyklus=u.vizAniPhase*n`). Wirkt nur bei
LPC-Figuren (B2); Vollbild-Kreaturen hüpfen nur. Wenn kein Bild überzeugt: Pose weglassen, der
Hüpfer allein trägt.

### 2.3 Die Teambank (für Disziplinen ohne sichtbares Publikum)

```js
// liste: TEILNEHMER/LAEUFER-Objekte; rect: {x0,x1,fussY}; skala ~0.6
function zeichneTeambank(liste,seite,rect,skala){
  const c=seite===0?FEIER_FARBE.home:FEIER_FARBE.away;   // pro Frame gecacht (B5)
  liste.forEach((u,i)=>{
    const x=rect.x0+(rect.x1-rect.x0)*(liste.length>1?i/(liste.length-1):0.5);
    const h=teamFeierHaltung(u), fussY=rect.fussY;
    ctx.fillStyle=c; ctx.globalAlpha=0.18;
    ctx.beginPath(); ctx.ellipse(x,fussY,11,4,0,0,6.2832); ctx.fill(); ctx.globalAlpha=1;
    const arg={...u,lunge:0,down:false,vx:0,vy:0,
               vizJubel:h.pose||undefined, vizAniPhase:h.pose?JUBEL_BILD/13:undefined};
    ctx.save(); ctx.translate(x,fussY); ctx.scale(skala,skala); ctx.translate(-x,-fussY);
    zeichneSprite(ctx,arg,x,fussY-19+h.dy);     // 19 = Sprite-Fuss-Versatz wie in zeichneBreaking
    ctx.restore();
  });
}
```

Muster exakt wie der Breaking-Zuschauerring (Z. 24325–24335: Fußschatten-Ellipse, 0,72-Skalierung
um den Fußpunkt). **Wichtig:** `zeichneSprite(ctx,arg,x,y)` **ohne** viertes Argument aufrufen —
mit `feldspiel=true` zeichnet sie bei Gewichtheben eine Hantel an jede Bankfigur (Z. 3513, 3637).
Waffen werden für alle hier betroffenen Disziplinen ohnehin über `DISZIPLIN_WAFFE` (Z. 2471)
entfernt.

### 2.4 Effekte: Konfetti, Feuerwerk, Blitz

Eine Funktion `zeichneTeamFeierEffekte()`, am **Ende** jeder betroffenen Chassis-Zeichenfunktion
aufgerufen (vor den Schwebetexten, damit Zahlen lesbar bleiben):

- **Konfetti** (mittel/groß/Finale): `S.konfetti` Rechtecke 5×8 px wie beim Gold-Buzzer
  (Z. 22410–22417), aber **aus dem Anker nach oben geworfen und fallend** statt von oben
  rieselnd: `x=ax+vx·τ`, `y=ay−vy·τ+0,5·g·τ²` mit `vx,vy` aus `cypherHash(f.nr*7919+f.seite,i)`
  (`vx∈[−140,140]`, `vy∈[180,320]` px/s, `g=520`), Drehung `((h>>5)%628)/100 + τ·(h%7)`, Alpha
  ab 70 % der Dauer ausblenden. **Farbe: 65 % Teamfarbe, 20 % Teamfarbe mit `globalAlpha 0.6`
  (hellere Tönung), 15 % `#fff6d0`** — genau Chris' Punkt: es soll nach *Team*jubel aussehen, nicht
  nach Zufallskonfetti. Keine Hash-Farbwahl aus drei Fantasietönen wie beim Gold-Buzzer.
- **Feuerwerk** (nur Finale): `S.feuerwerk` Bursts, zeitversetzt um 0 / 350 / 700 ms, Mittelpunkt
  über der Siegerbank bzw. oberem Bilddrittel (`x` aus Hash, `y∈[0,12H, 0,3H]`). Je Burst 28
  Punkte radial (`winkel=i/28·2π`, `r=τ·(150+h%60)`, Schwerkraft `+0,5·260·τ²`), Radius 2 px,
  Teamfarbe mit weißem Kern (erst weiß 120 ms, dann Teamfarbe), Ausblenden über 1,2 s. Reine
  `arc()`-Aufrufe, keine Assets.
- **Lichtblitz** (groß/Finale): radialer Verlauf in Teamfarbe vom Anker aus, Alpha 0,35 → 0 über
  500 ms — Vorbild ist der Gold-Buzzer-Verlauf (Z. 22403–22405), nur in Teamfarbe statt Gold.
- **Teamfarben lesen:** `FEIER_FARBE={home:css("--home"),away:css("--away")}` einmal am Anfang
  von `zeichneTeamFeierEffekte()` bzw. der Chassis-Zeichenfunktion (B5).

### 2.5 Bildwackeln

In `draw()` (Z. 36558) vor dem Chassis-Dispatch: bei laufender groß/Finale-Feier
`ctx.save(); ctx.translate(dx,dy)` mit `dx=A·sin(alter·0,09)·abkling`,
`dy=A·sin(alter·0,13)·abkling`, `abkling=max(0,1−alter/350)`; nach dem Dispatch `ctx.restore()`.
Da `draw()` für Bühne/Bahn/Feldspiel früh mit `return` aussteigt, die drei Zeilen dort in
`{ctx.save();…;zeichneBuehne();ctx.restore();return;}` umbauen. Kein `Math.random`. Das HTML-Bug
wackelt nicht mit (DOM) — gewollt, der Score bleibt ruhig lesbar.

### 2.6 Endstand-Nachlauf (Voraussetzung für jedes Finale)

In `updateHudBuehne()` (Z. 19107) und `updateHudBahn()` (Z. 29333) beim ersten `done`-Frame nur
`endeSeitMs=jetztMs()` merken und das Finale auslösen; `renderEndstandBuehne()`/-`Bahn()` erst
aufrufen, wenn `jetztMs()-endeSeitMs>=ENDSTAND_NACHLAUF_MS` (Vorschlag 3500). Die Sieger-Feedzeile
bleibt sofort. `endeSeitMs` in `reset()` auf `null`.

**Einordnung:** Klasse A (keine Wertung berührt), aber es verschiebt den *Ablauf* um 3,5 s — Punkt 22
(Anpfiff-Countdown) wurde für so etwas als Klasse T eingestuft. **Vor dem Bau kurz von Chris
abnicken lassen.** Nebenwirkung, die für den Nachlauf spricht: die letzte Hebung im Gewichtheben ist
heute überhaupt nicht zu sehen (B4). Falls Chris ablehnt: Finale entfällt, alle anderen Stufen
bleiben unberührt. Einziger bekannter Verbraucher des Overlays in Skripten:
`scripts/screenshot-broadcast-hud.mjs` — dort ggf. Wartezeit anpassen.

**Gebaut am 07.10.** (Chris' Freigabe zusammen mit D7/A4, s.
`broadcast-d7-a4-fable-empfehlung-02-10.md` Abschnitt 6): `endstandVormerken()`/
`endstandNachlaufPruefen()` in `updateHudBuehne()`, `updateHudBahn()` und — zusätzlich, weil es
seit 30.09. dasselbe Einmal-Muster hat — `updateHudFeldspiel()`. 3,5 s über `jetztMs()`, Sieger-
Feedzeile sofort, Stufe „finale" für den Sieger, Score-Bug bleibt im Nachlauf stehen, A3-Wischer
deckt den Übergang zum Overlay. Sonden-Schalter `window.__arena.endstandNachlauf(false)` stellt
das alte Verhalten her (Overlay im selben Frame, kein „finale"); gesetzt in allen Skripten, die die
Ticker-Dichte bis zum Endstand zählen oder per `sondenLauf()` den Endstand fotografieren.

---

## 3. Die Disziplinen

Legende Aufwand: S ≤ 30 Zeilen, M ≤ 80, L > 80 (ohne Baukasten).

### 3.1 Gewichtheben — der Idealfall

| | |
|---|---|
| Chassis | Bühne, `art.heben`; Zeichnung `bodenHeben()` Z. 19795 + `zeichneHeben()` Z. 23303 |
| Publikum vorhanden? | **Ja, ungenutzt.** 6 Duelle nacheinander, je Seite 6 Heber (`jeSeite:6`, Z. 14021). Aktiv sind nur die zwei des Duells `aktivNr` (Z. 23309–23311); die übrigen **zehn** stehen heute nur als Text „1. Name – Name / wartet / 1:0 für …" bei `H*0.90` (Z. 23624–23647). |
| Heute | 26 dunkle Kreise als Publikum mit 5-px-Sprung bei „hoch" (H3, Z. 19810–19827), Ausbruch-Ton (Z. 23533). Das reicht messbar nicht (95 % Standbild). |

**Publikum:** je Seite eine Teambank mit den fünf nicht aktiven Hebern
(`TEILNEHMER.filter(u=>u.side===s&&u.duellNr!==aktivNr)`, nach `duellNr` sortiert). Platz: links und
rechts neben der Plattform (Plattform `W/2±0,23W` = x 335–905, Z. 19829): **Heimbank
`{x0:40,x1:300,fussY:H*0.74}`, Gastbank `{x0:W-300,x1:W-40,fussY:H*0.74}`**, Skala 0,62. Oberhalb
liegt rechts die Anzeigetafel (y 64–162, Z. 19864), unterhalb die Duell-Textzeile bei `H*0.90` —
beides frei. Per Screenshot (`scripts/screenshot-gewichtheben.mjs`) bestätigen. Zeichnen in
`zeichneHeben()` direkt nach der Duell-Kopfzeile, **vor** den beiden Hebern.

**Auslöser — der Lampen-Moment, nicht die Enthüllung.** Das Ergebnis wird in `stepBuehne()` bei
Z. 16864 enthüllt, aber erst beim Phasenwechsel `zug → hoch|ablage` sichtbar (Lampen, Versuchstafel
und Ton hängen daran, Spoiler-Regel H1/H2.2). Deshalb der Haken in **`stepHeben()`, Z. 18275–18280**,
direkt nach `u.vizPhase=(r&&r.gueltig)?"hoch":"ablage"`:

```js
hebenFeierAmUrteil(u,r,art);   // neu; liest nur, schreibt nur teamFeiern
```

mit dieser Logik (alles reines Lesen):

| Ereignis | Bedingung | Stufe, Seite |
|---|---|---|
| Gültiger Versuch | `r.gueltig` | klein, `u.side` |
| Kühner Versuch geglückt | `r.kuehn&&r.punktesieg` | mittel, `u.side` |
| **Duell entschieden** | `u.aktuell+1>=art.rundenN` **und** Gegner (`TEILNEHMER.find(x=>x.duellNr===u.duellNr&&x.side!==u.side)`) ebenfalls `aktuell+1>=art.rundenN` | **groß** für `u.duellGewonnen?u.side:(gegner.duellGewonnen?gegner.side:null)`, Anker Mitte Plattform |
| Spiel entschieden | erster `done`-Frame in `updateHudBuehne()` (2.6) | **Finale** für `buehneSieger()` (Z. 39017, existiert) |

Die Duell-Bedingung greift genau einmal: beim zweiten der beiden Heber im sechsten Versuch (die
Reihenfolge innerhalb einer Runde wechselt nach Last, Z. 15668–15674, deshalb die Prüfung *beider*
Zähler). `duellGewonnen` ist vorberechnet (Z. 15661), wird hier aber erst im Moment der letzten
Lampe gelesen — nicht früher.

**Zusätzlich, ohne neuen Auslöser:** die eigene Bank klatscht beim Antritt des eigenen Hebers mit —
dieselbe Wippe wie die Silhouetten (`klatschWippe`, Z. 19814), nur auf die Bank der Seite von
`letzterHebenZug.u` angewandt. Damit bewegt sich bei **jedem** der 72 Versuche etwas Menschliches
im Bild, nicht nur bei den sechs Duell-Entscheidungen.

**Frequenz:** 72 Versuche in ~7,4 min → Klatschen + (bei gültig) Hüpfer alle ~6 s; sechs große
Partys (~alle 74 s); ein Finale.

**Klasse:** A. `stepHeben()` ist laut Vertrag (Z. 17257–17269, 18296ff) präsentationaler Pfad;
`stepWettessen()` setzt dort bereits die Modulvariable `wettessenEndeSeit` (Z. 18850) — Präzedenz.
**Aufwand:** M (Bank + Haken + Klatsch-Übertrag ~60 Zeilen).

### 3.2 Breaking (Gauntlet) — fast geschenkt

| | |
|---|---|
| Chassis | Bühne-Auftritt, `art.cypher`/`art.gauntlet`, `zeichneBreaking()` Z. 24179 |
| Publikum vorhanden? | **Ja, gezeichnet.** Zehn Nicht-Duellanten als Ring, Skala 0,72, Fußschatten, Krone für den Punktbesten (Z. 24324–24343), danach Vignette (Z. 24355–24366). |
| „Runde gewonnen" | Ein Ertragender gibt auf: `r.hpNach<=0`. Erkannt bei **Z. 16878** (`letzterGauntletBruch={u,r,bruchT:buehneT}`) und Z. 17183–17185 (`feed(... "scheidet aus — Kampf N geht an ...")`). |

**Auslöser:** an Z. 16878 ergänzen: `if(r.hpNach<=0)teamFeierAusloesen(1-u.side,"gross",null);` —
**die Seite des Gegners feiert**, `u` ist der, der bricht. **Publikum:** in der bestehenden
Ring-Schleife (Z. 24333–24334) nur den Zeichenpunkt versetzen:
`const h=teamFeierHaltung(u); zeichneSprite(ctx,u,o.x,o.y+h.dy);` (Pose hier weglassen, um `u`
nicht anzufassen, oder über `{...u,vizJubel:true}` übergeben). Die Gegenseite sackt über `h.sackt`.

**Tonalität:** Breaking ist Folter/Survival (CLAUDE.md), keine Show. Deshalb Stufe „groß" **ohne
Konfetti-Bunt**: Konfettifarbe hier nur Teamfarbe + Gold (`#f2d75a`, die Survivor-Farbe von
Z. 24250), eher „Funkenregen" als Papierschnipsel. Effekte **nach** der Vignette zeichnen, sonst
dunkelt sie sie ab; die hüpfenden Zuschauer bleiben bewusst unter der Vignette (der Ring tritt
zurück, die Mitte bleibt vorn).

**Klasse:** A\* (ein Aufruf im Sim-Pfad `stepBuehne`, kehrt bei `stumm` sofort zurück, schreibt nur
Anzeige-Zustand — dieselbe Einordnung wie die Banner-Drossel in PR #1081). **Aufwand:** S (~15 Zeilen).

### 3.3 Staffel — Publikum steht schon im Innenfeld

| | |
|---|---|
| Chassis | Bahn, Oval (`istOval()`), `zeichneSpurt()` Z. 35820, `ovalPunkt()` Z. 33355; keine Kamera (Z. 33510) |
| Publikum vorhanden? | **Ja, gezeichnet.** Immer läuft nur einer je Team (`if(BA().staffel&&!u.aktiv)continue`, Z. 34276); die anderen fünf stehen im Innenfeld an ihrer Wechselzone (Z. 33394–33418), gedimmt auf 0,72 und skaliert 0,88 (Z. 35875–35888). |

**Auslöser** (alle drei als Flanken schon vorhanden):

| Ereignis | Stelle | Stufe |
|---|---|---|
| Saubere Übergabe | `stepStaffel()` Z. 35384–35392 (Flanke `u.durch&&!u.vizDurchGesehen`, dort läuft schon `sfx("staffel","uebergabe")`) | klein, `u.seite`; bei `u.gestolpert>0` (Fehlwechsel) stattdessen **keine** Feier für `u.seite` — die sackt über `sackt`, dazu klein für `1-u.seite` |
| Führungswechsel | `updateHudBahn()` Z. 29137–29140 (`staffelFuehrendeSeite` wechselt) | mittel, `d.seite` |
| Team im Ziel | `stepStaffel()` Z. 35399–35401 (Flanke `vizZielGesehen`, Schlussläufer) | **groß**, wenn der Schlussläufer der Gegenseite noch nicht `fertig` ist (Sieger), sonst klein |
| Rennen entschieden | `updateHudBahn()` erster `done`-Frame (2.6) | Finale, Sieger aus `stand.seiten` (Z. 29335f.) |

**Bild:** In `zeichneSpurt()` den Hüpfer in den bestehenden Transform einrechnen
(Z. 35983: `ctx.translate(x,y+16-parcHop-huerdeHop)` → `…-huerdeHop+feierDy`), nur für Figuren mit
`!u.aktiv`. Während einer eigenen Feier die Dimmung aufheben (Z. 35888: `wartet?0.72:1` →
`wartet&&!feiertGerade?0.72:1`), sonst verpufft der Jubel im Grau. Konfetti-Anker: `laeuferXY()` des
auslösenden Läufers.

**Anfeuern ohne Ereignis** (füllt die langen Strecken): wartende Teamkollegen an der Wechselzone,
der sich der eigene aktive Läufer nähert (`ovalAnteil()`-Abstand zur Zone < 0,12 Runde), wippen mit
3 px bei 3 Hz — reines Lesen von `ovalAnteil`/`ovalAmZiel` (Z. 33367, 33416). Das ist die
„Welle", die mit dem Läufer ums Oval wandert.

**Frequenz:** 2 × 5 Übergaben in ~180 s → alle ~18 s pro Team, versetzt ~alle 9 s eine sichtbare
Teamreaktion; dazu das Anfeuern durchgehend. **Klasse:** A (`stepStaffel` ist `bahnBewegung`-Pfad,
Vertrag Z. 35248ff; `updateHudBahn` ist HUD). **Aufwand:** M.

### 3.4 Time-Trial — Teambank im Bildschirmraum

| | |
|---|---|
| Chassis | Bahn, Einzelstart (`BA().startAbstand`), Einzelkamera auf `bahnFokus` (Z. 33557–33565) |
| Publikum vorhanden? | **Ja, aber außerhalb des Bildes.** Wartende (`startT>rennT`, `u.vizRampe>0`, Z. 35648) stehen an der Startrampe, Fertige am Hot-Seat-Podest (Z. 35866–35871). Die Kamera fährt eng neben einem Fahrer — beide Gruppen sind meist nicht im Bild. |

**Publikum:** Teambank im **Bildschirmraum** (nach der Läuferschleife, vor `zeichneStreckenband()`
Z. 36420): alle Teammitglieder, die gerade **nicht** fahren
(`u.fertig!=null || (u.startT||0)>rennT`). Das Streckenband liegt beim Zeitfahren unten
(`by=H-13`, Z. 36434) → Bänke `fussY:H-34`, Heim `x 30–250`, Gast `x W-250–W-30`, Skala 0,55.
`laeuferXY()` liefert schon Bildschirmkoordinaten, es gibt keinen Kamera-Transform zurückzusetzen.
Per Screenshot gegen die DOM-Teamkarten prüfen.

| Ereignis | Stelle | Stufe |
|---|---|---|
| Neuer Hot Seat (neue Bestzeit im Ziel) | `updateHudBahn()` Z. 29239–29245 | **groß**, `hs.u.seite` |
| Zwischenzeit-Bestzeit | `updateHudBahn()` bei `u.vizZzFlash={…neueBest…}` (Z. ~29283–29288) | klein, `u.seite`, nur bei `neueBest` |
| Zieleinlauf Rang ≤ 3 | `stepSpurt()` Z. 35177–35183 | mittel (die Dosis-Regel 2.1 verhindert Doppelfeuer mit dem Hot Seat) |
| Rennen entschieden | `updateHudBahn()` `done` (2.6) | Finale |

**Ohne Ereignis:** die Bank klatscht in den letzten 3 Zuschau-Sekunden vor dem Start eines eigenen
Fahrers (`bahnSpanneAnzeige(u.vizRampe)<3`, dieselbe Umrechnung wie der „Start in"-Countdown,
Z. 36190–36194) — genau die Startphase, in der laut Auftrag das 23,5-s-Standbild liegt.

**Klasse:** A (HUD) bzw. A\* für den einen Aufruf in `stepSpurt()`. **Aufwand:** M (Bank ist
Baukasten, Haken sind je eine Zeile).

### 3.5 Speed-Schach — Kiebitze statt Bank

| | |
|---|---|
| Chassis | Bühne-Duell, `zeichneSchach()` Z. 23773; Fokusbrett groß, fünf Mini-Bretter bei `H*0.80` (Z. 24100) |
| Publikum vorhanden? | **Nein, alle zwölf spielen gleichzeitig.** Nur die zwei am Fokusbrett sind Sprites (Z. 24058–24064). Fertige Spieler werden erst gegen Ende frei — laut Motor-Kommentar werden „fast alle parallel laufenden Bretter erst kurz vor Schluss fertig" (Commit 7de4475). |

**Publikum, realistisch gedacht:** Wer im Mannschaftsschach fertig ist, steht auf und schaut bei
den Kollegen zu. Also eine **Kiebitz-Gruppe** je Seite neben dem Fokusbrett: alle Spieler der Seite,
deren Brett entschieden ist (`fertig(u)` Z. 23777 für beide des Bretts), per `zeichneTeambank`,
Skala 0,55, links außerhalb des Bewertungsbalkens (`bx-42`, Z. 23969) bzw. rechts außerhalb der
Zugliste (`bx+bw+34`, Z. 24091) — Positionen per Screenshot festlegen, der Platz ist knapp.

| Ereignis | Stelle | Stufe |
|---|---|---|
| Brett entschieden | `stepBuehne()` Z. 17097–17119 (Gate `brettGegnerFertig`, feuert genau einmal je Brett) | mittel für `v>0?u.side:v<0?1-u.side:null` (Remis: keine Feier). **Nur für `BB().schach`** — Tennis/Fechten teilen die Stelle, s. 3.8 |
| Match entschieden | `zeichneSchach()` Z. 23863 (`alleFertig&&siegSeite!=null&&!schachMattGehoert`, dort fällt schon der Matt-Ton) bzw. 2.6 | Finale, `siegSeite` |

**Ehrlich:** Das hilft der Schlussphase, nicht der Mitte. Die 76 % stehenden Bilder liegen im
Mittelspiel, in dem kein Brett entschieden wird. Ein Auslöser „Vorteil kippt" (`vorteilKipptBig`,
Z. 16987) wäre möglich (klein, ohne Konfetti), ist aber schon banner-gedrosselt, weil er oft kippt —
nur als Option, erst nach Sichtprobe. **Klasse:** A\*. **Aufwand:** M.

### 3.6 Spurt — kein Publikum während des Rennens

| | |
|---|---|
| Chassis | Bahn gerade, Massenstart, Feld-Kamera (Zoom 1,4×→3,3×, `ui-bewegungs-audit-26-09.md`) |
| Publikum vorhanden? | **Nein.** Alle zwölf laufen gleichzeitig. Frei werden nur die Fertigen (rechts neben der Ziellinie, Z. 36257–36259) — und die sind bei engem Zoom oft nicht im Bild. |

**Abgespeckte Variante:** Teambank im Bildschirmraum (wie Time-Trial, aber oben rechts/links, weil
das Streckenband hier oben liegt, Z. 36434), gefüllt nur mit Fertigen — leer bis zum ersten
Zieleinlauf. Auslöser: Zieleinlauf in `stepSpurt()` Z. 35208–35210 → Platz 1 **groß**, Platz 2–3
mittel, jeweils `u.seite`, Anker = Ziellinie über `laeuferXY(u)`. Führungswechsel
(`updateHudBahn()` Z. 29251–29253) nur als klein — ohne Menschen im Bild bleibt davon ein
Teamfarben-Randschimmer (Muster `showcaseSaumSeit`, Z. 19337f.).

**Ehrlich:** Spurts Problem ist laut Bewegungs-Audit der Massenstart-Klumpen und der Zoomsprung,
nicht fehlender Jubel. Die Feier bringt hier wenig — Priorität niedrig. **Klasse:** A/A\*.
**Aufwand:** S (wenn TT-Bank steht).

### 3.7 Kurz: die übrigen Disziplinen

- **Hockey/Basketball/Football (Feldspiel):** `size:6` (Z. 4765–4767), alle sechs auf dem Feld,
  **keine Bank**. Tore/Körbe haben schon Jubeltext (Z. 11349–11355, 11523–11527). Eine Torjubel-
  Traube wäre ein reiner Zeichen-Versatz der sechs Feldspieler + Konfetti — machbar als A, löst
  aber Hockeys 88 s ohne Banner nicht (die Feier hängt ja am Tor). Nicht in diesem Paket.
- **Climbing / Takeshi's Castle:** alle klettern/laufen gleichzeitig; Publikum wären Getoppte bzw.
  Ausgeschiedene. Wiederverwendung des Baukastens am generischen Zielzweig (Z. 35209) möglich,
  kein Handlungsdruck.
- **Showcase:** hat mit dem Gold-Buzzer (Z. 22068, 22394–22419) schon ein Feierereignis — kann
  später auf den Baukasten umziehen, muss nicht.
- **Wettessen:** hat „Hände hoch" bei der Schlusshupe (Z. 18845–18856). Nichts zu tun.

### 3.8 Tennis/Fechten — bewusst ausgeklammert

Sie teilen den „Brett entschieden"-Zweig mit Speed-Schach (Z. 17097ff.). Der Schach-Haken muss
deshalb explizit auf `BB().schach` gegatet werden; für Fechten gilt ohnehin `u.gefechtSieg` statt
`v` (Z. 17100–17102). Eine Übernahme ist später trivial, gehört aber nicht in den ersten Wurf.

---

## 4. Harte Grenzen und Abnahme

1. **Rangtreue/Pp bit-identisch.** Kein `rr()`, kein `Math.random()`, keine Schreibzugriffe auf
   `u.summe/u.runden/u.aktuell/u.vorteil/u.zweikampf/u.lunge/u.pos/u.v/buehneAkt/buehneZeiger/done`.
   Nachweis vor/nach: `node scripts/miss-alle-disziplinen.mjs 24 gewichtheben breaking staffel
   time-trial spurt speed-schach` → `diff` leer. `teamFeierAusloesen` kehrt bei `stumm` zurück, der
   Messpfad sieht das Modul also gar nicht.
2. **Spoiler-Regel.** Gefeiert wird im selben Moment, in dem das Bild das Ergebnis zeigt — beim
   Gewichtheben an der Lampe (`stepHeben`), nicht an der Enthüllung (`stepBuehne`).
3. **Determinismus.** Uhr `jetztMs()`, Streuung `cypherHash()`. Der Sonden-Modus bleibt
   pixelstabil: `node scripts/pruefe-sonden-modus-determinismus.mjs` muss weiter grün sein.
4. **Dosis.** Die Dosis-Regel in 2.1 plus die Stufen-Tabelle: Konfetti erst ab „mittel", Wackeln
   und Blitz nur „groß"/Finale. Zielbild: ein großes Ereignis pro ~1 Minute, kleine Reaktionen
   im Sekundentakt. Kein neues Banner — die Feier läuft **neben** `feed()`, nicht über `callout()`.
5. **Kein Kurzschluss über `feed(…,true)`.** Verlockend wäre „jedes big-Feed löst eine Feier der
   Seite aus" — falsch, weil `feed` die Seite des *Betroffenen* trägt: „verpatzt die Übergabe"
   (Z. 35144), „VERLETZT!", „scheidet aus" (Z. 17184) würden dann die Pechvögel feiern lassen.
   Jeder Auslöser wird einzeln gesetzt.
6. **Sichtprobe** je Disziplin per Playwright (Produktionsmodus dark + `.im-spiel`), je ein Bild
   im Moment einer „groß"-Feier und eines 300 ms danach. Die Standbild-Messung aus dem Audit
   (Tabelle 6.2) vor/nach wiederholen — mit derselben Schwelle wie im Audit, damit ein 2-px-Wippen
   nicht als „Bewegung" durchgeht, wo keine Handlung ist.

---

## 5. Nebenfunde (nicht Teil dieses Auftrags, beim Bau entscheiden)

1. **Gewichtheben-Score zählt ein Duell zu früh.** `updateHudBuehne()` (Z. 19045) und
   `buehneStand()` (Z. 38994) zählen `u.aktuell+1>=u.runden.length&&u.duellGewonnen` — das greift schon beim
   *eigenen* sechsten Versuch des Siegers. Geht er in Runde 6 zuerst (leichtere Last, Z. 15671),
   steht das 1:0 im Bug, bevor der Gegner seinen letzten Versuch überhaupt hatte, und vor den
   Lampen. Mit der neuen Duell-Feier (am Lampen-Moment) würde der Bug der Party sichtbar
   vorauslaufen. Vorschlag: dieselbe Bedingung wie in 3.1 (beide fertig) — reine Anzeige, Klasse A.
2. **Die letzte Hebung ist unsichtbar** (B4): `done` fällt bei ihrer Enthüllung, das Overlay deckt
   sie im selben Frame zu. Der Endstand-Nachlauf (2.6) behebt das nebenbei — gilt sinngemäß für die
   letzte Enthüllung jeder Bühnen-Disziplin.
3. **Das Audit-Dokument fehlt im Repo** (1.1).

---

## 6. Umsetzungsreihenfolge

Begründung der Reihenfolge: Wirkung × vorhandene Struktur. Gewichtheben hat den größten gemessenen
Leerlauf **und** zehn ungenutzte Figuren **und** einen fertigen Auslöser; Breaking kostet fast nichts
und beweist den Baukasten an einem zweiten Chassis-Zweig; Staffel hat Publikum und Auslöser schon im
Bild. Time-Trial braucht die neue Bildschirm-Bank, Speed-Schach und Spurt profitieren nur am Ende.

### Phase 1 — Baukasten + Gewichtheben + Breaking (ein PR)

Build-Agent baut:
1. Modul aus Abschnitt 2.1–2.5 (Zustand, `teamFeierAusloesen`, `teamFeierHaltung`,
   `zeichneTeambank`, `zeichneTeamFeierEffekte`, Wackeln in `draw()`), Reset in `reset()`.
2. Gewichtheben 3.1: zwei Bänke in `zeichneHeben()`, Haken `hebenFeierAmUrteil()` in `stepHeben()`
   am Übergang `zug→hoch|ablage`, Klatsch-Übertrag von `klatschWippe`.
3. Breaking 3.2: ein Aufruf an Z. 16878, Hüpfer in der Ring-Schleife, Effekte nach der Vignette.
4. **Endstand-Nachlauf 2.6 nur, wenn Chris zustimmt** (vorher fragen); sonst Finale weglassen.
5. Pose-Einzelbild (2.2) per Screenshot wählen oder Pose weglassen.
6. Abnahme nach Abschnitt 4 (rho/Pp-Diff leer, Sonden-Determinismus, Sichtprobe, Standbild-Messung
   Gewichtheben vor/nach).

### Phase 2 — Staffel

Build-Agent baut 3.3: Hüpfer in den Transform bei Z. 35983 für `!u.aktiv`, Dimmung während der
Feier aufheben, drei Haken (Übergabe/Ziel in `stepStaffel`, Führungswechsel in `updateHudBahn`),
Anfeuern-Welle. Abnahme: `miss-alle-disziplinen.mjs 24 staffel` bit-identisch, Sichtprobe bei einer
Übergabe und beim Zieleinlauf, Stille-/Standbild-Messung vor/nach.

### Phase 3 — Time-Trial

Build-Agent baut 3.4: Bildschirm-Bänke über dem Streckenband, Haken am Hot-Seat-Wechsel, an der
ZZ-Bestzeit und am Zieleinlauf Rang ≤ 3, Klatschen vor dem eigenen Start. Abnahme wie oben mit
`time-trial`.

### Phase 4 — Speed-Schach und Spurt

Build-Agent baut 3.5 (Kiebitz-Gruppe, Haken „Brett entschieden" nur für `BB().schach`, Finale am
Matt-Ton) und 3.6 (Fertigen-Bank oben, Zieleinlauf-Haken). Beide mit ausdrücklicher Erwartung, dass
der Gewinn in der Schlussphase liegt.

### Danach (nur auf Zuruf)

Feldspiel-Torjubel (3.7), Climbing/Takeshi, Showcase-Umzug auf den Baukasten, Tennis/Fechten (3.8).

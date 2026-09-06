# Wertungstabelle je Disziplin — Bestandsaufnahme, Architektur, Rezepte (05.09.)

Reine Recherche und Planung, kein Code auf `main`. Auftrag von Chris, wörtlich: „du musst die
Wertungstabelle IMMER nutzen! die muss auch in jeder diszi adaptiert werden!" — ausgelöst durch
Playwright-Screenshots von Takeshi's Castle, Speed-Schach und Wettessen, in denen das Panel
„Wertung" unten rechts bei den beiden Bühnen-Disziplinen nur Striche zeigte und bei Takeshi
Zahlen, deren Spaltenbedeutung (Schaden/Heilung/Verhindert/Getankt/KO) für einen Hindernislauf
keinen Sinn ergibt.

Alle Aussagen unten sind am Code (`public/mockups/battle-mode.engine.js`, Stand `f251ab00`)
und an einer eigenen Playwright-Sonde nachgemessen, nicht vermutet: jede der zwanzig
Disziplinen wurde in einer frischen Seite gesetzt, bei Tempo 4× gestartet und nach 20 Sekunden
die Wertungstabelle (Kopfzeile, Zeilen, Fußtext) ausgelesen; dazu ein Standbild-Szenario
(erst TDM laufen lassen, dann auf Takeshi und Speed-Schach wechseln). Die Sonde steht in
Abschnitt 7, damit die Umsetzung sie als Abnahme wiederverwenden kann.

---

## 0. Ergebnis vorab

1. **Chris hat nicht drei Disziplinen mit falschen Spalten gesehen, sondern ein Standbild.**
   Die Wertungstabelle wird nur aus zwei Stellen befüllt — `updateHud()` (Kampf, Z. 14183) und
   `updateHudFeldspiel()` (Z. 9604). `updateHudBuehne()` (Z. 10891) und `updateHudBahn()`
   (Z. 14118) rühren sie nie an, und `build()` (Z. 12507) steigt für Bühne/Bahn/Feldspiel
   aus, bevor es die Kampf-Einheiten `U` neu baut. Folge: **alle 14 Bühnen- und
   Bahn-Disziplinen zeigen die zuletzt gerenderte Kampf- oder Feldspiel-Tabelle als
   Standbild** — beim Seitenstart die sechs TDM-Kämpfer mit lauter „—" (kein Kampf gelaufen),
   nach einem TDM-Lauf dessen Zahlen. Gemessen: Speed-Schach, Wettessen und Takeshi zeigen
   in einer frischen Seite exakt dieselben sechs Zeilen `Krolach | — | — | — | — | — | — | – | – | 73`
   (Spurt sogar sechs Zeilen bei 4 gegen 4); nach zwölf Sekunden TDM steht bei beiden
   `Krolach | 698 | — | 225 | 466 | 1 | 189 %`. Das ist der Unterschied zwischen Chris'
   „Striche" und „Zahlen" — es sind dieselbe Tabelle.
2. **Damit gilt der Befund für 14 von 20, nicht für 3.** Arena (TDM, Mini-DM, Battlefield) und
   Feldspiel (Basketball, Hockey, Football) rendern eine eigene Tabelle. Alle neun Bühnen
   (Gewichtheben, Showcase, Eiskunstlauf, Breaking, Wettessen, Speed-Schach, I-Spy, Tennis,
   Fechten) und alle fünf Bahnen (Spurt, Time-Trial, Climbing, Staffel, Takeshi's Castle)
   haben **keine** Wertungstabelle — und zwar nicht „unpassende Spalten", sondern gar keine
   Anbindung. Tabelle in Abschnitt 2.
3. **Die sechs, die eine Tabelle haben, sind nicht alle in Ordnung.** Basketball ist gut.
   Hockey zeigt Eishockey-Ereignisse unter Basketball-Wörtern (Reb = gewonnene Abpraller,
   Blk = Blocks *und* Torwart-Paraden, FG = Schüsse; Strafminuten und Checks fehlen, obwohl
   gezählt). Football ist nach 76 Spielsekunden bis auf den einen Touchdown-Scorer leer, weil
   Yards, Tackles und Sacks zwar an der Einheit gezählt werden (`passYards`, `laufYards`,
   `fangYards`, `bloecke`, `steals`), `fsBisher()` sie aber nicht kennt. Und bei beiden ist die
   „Imp"-Spalte NICHT `MOTOREN[disc].wert()` (wie der Kommentar in Z. 14102 behauptet),
   sondern die Basketball-Formel — Hockeys Torwart und Footballs Yards sind für die Anzeige
   unsichtbar, obwohl `feldspielWert()` (Z. 6126) sie längst bewertet. Arena ist inhaltlich
   richtig; „Heil" bleibt leer, solange kein Heiler-Unterklassen-Spieler (`HEILER`, Z. 3391)
   im Kader steht — kein Fehler, aber ein Grund für dynamische Spalten.
4. **Der richtige Ort ist ein `wertung:`-Block je Disziplin mit einem Default je Chassis** —
   genau wie `rezept`, `kurve`, `lang`, `plaene` schon in `ARENA_ART`/`FELDSPIEL_ART`/
   `BUEHNE_ART`/`BAHN_ART` sitzen. Eine Funktion `wertungVon(disc)` mischt Chassis-Default und
   Disziplin-Eintrag, EINE Render-Funktion `renderWertungTabelle()` ersetzt das Paar
   `renderWertung()`/`renderWertungFeldspiel()` plus `setWertungKopf()` und wird aus allen
   vier `updateHud*` aufgerufen. Kopfzeile aus der Spaltenliste gebaut statt zehn fester
   `<th id="wth0..9">` mit „–"-Füllern. Abschnitt 3 hat den Code.
5. **Reihenfolge.** Welle 1 (ein PR): der generische Umbau + die Bühnen- und Bahn-Defaults —
   das allein macht alle 14 Standbilder zu echten Tabellen — plus die drei disziplineigenen
   Einträge für Speed-Schach, Wettessen und Takeshi's Castle (Abschnitt 4, umsetzungsreif).
   Welle 2: Hockey- und Football-Wörter, Yards/Paraden/Strafminuten, `Imp = wert()`. Welle 3:
   die restlichen Feinheiten je Disziplin aus der Tabelle in Abschnitt 5.

---

## 1. Wie die Tabelle heute gebaut ist

### 1.1 Das DOM (`battle-mode.html` Z. 153–176)

Zwei Blöcke nebeneinander (`.wsplit`, Chris' Fund vom 29.08.): eigenes Team links
(`#wbodyL`), Gegner rechts (`#wbodyR`). Jeder Block hat eine fest verdrahtete Kopfzeile mit
**elf** `<th>`: `#wthN` (Name) und `#wth0`…`#wth9` (rechter Block mit Suffix `r`). Die HTML-
Beschriftung ist noch die alte lange (`Schaden Heilung Verhindert Getankt KO Leistung – – – –`);
`setWertungKopf()` überschreibt sie beim ersten Frame. Darunter `#wfuss` mit dem Erklärtext.
`.wertung` ist 210 px hoch mit `overflow-y:auto` — sechs Zeilen passen, mehr scrollt.

### 1.2 Die Kopfzeile (`WERTUNG_KOPF`, `setWertungKopf`, Z. 14041–14062)

```js
const WERTUNG_KOPF={
  kampf:["Schd","Heil","Verh","Tank","KO","Leist","–","–","–","Eig"],
  feldspiel:["Pkt","Reb","Ast","Stl","Blk","TO","FG","FG%","Imp","Eig"]};
function setWertungKopf(feldspiel){ ... kopf[i] in #wth{i} und #wth{i}r ... }
```

Ein Boolescher Schalter, zwei Varianten. Namensspalte „Kämpfer"/„Spieler", Fußtext ebenfalls
zweiwertig. Es gibt keinen dritten Zustand — Bühne und Bahn können hier gar nicht ankommen.

### 1.3 Die Zeilen

**Kampf — `renderWertung()` (Z. 13983):** liest `U` (die Arena-Einheiten aus `build()`), sortiert
je Seite nach `beitragVon(u)` (Z. 13931: `dmg + heal + schild + verh*0,4 + koAnteil*140`) und
schreibt `u.st.dmg / heal / verh / tank / ko`, `leistungVon(u,U)` (Beitrag gegen erwarteten
Eignungsanteil, Z. 13956), zwei feste `–`-Platzhalter und `u.eig`. Die `st`-Zähler entstehen in
`baueEinheit` (Z. 12498: `{dmg,heal,tank,verh,ko,koAnteil,cc,schild,wieder,ff,tode,beihilfe,
gegen,fuehrung}`) und werden in `stepSim` befüllt — `dmg/tank/verh` in `schadeAn` (Z. 12605),
`ko` bei Ausscheiden (Z. 12653/13085, Anteil über `verteileKo`), `heal` nur in der
Skill-Wirkung `heilung` (Z. 13308/13812), `schild` bei Blessed Shield.

**Feldspiel — `renderWertungFeldspiel()` (Z. 14063):** liest `FSTEAM[0..1]` und die
**enthüllten** Zähler aus `fsBisher()` (Z. ~5540–5580), das aus dem Ereignisprotokoll `fsZuege`
je Spieler `punkte/rebounds/assists/steals/bloecke/verluste/feldwuerfe/feldwuerfeTreffer/fouls`
aufsummiert — und nur die Ereignisarten `treffer / rebound / block / fehlwurf / steal /
turnover / foul` kennt. Sortiert nach Punkten, dann Assists. Spalte „Imp" ist die feste Zeile
`punkte + assists + rebounds*1,2 + (steals+bloecke)*1,5 − verluste*0,8`.

**Bühne, Bahn:** nichts. `updateHudBuehne()` und `updateHudBahn()` setzen Uhr, Phase,
Punktestand, Balken und rufen `renderKader()` — die Wertungstabelle kommt in beiden nicht vor.
`reset()` (Z. 17054) ruft je Chassis den passenden Updater, also auch dort nichts. Und weil
`build()` (Z. 12512–12514) für diese drei Chassis mit `return` aussteigt, bevor `U=[]` steht,
bleibt `U` beim Chassis-Wechsel der letzte Kampf-Kader — die Tabelle friert mit dem Stand des
letzten `renderWertung()`-Aufrufs ein.

### 1.4 Welche Daten je Chassis überhaupt existieren

Das ist die eigentliche Rohstoffliste für Abschnitt 3 und 4. Alles unten ist **heute schon
gezählt**, nur nirgends angezeigt.

| Chassis | Einheitenliste | Felder je Einheit (Auswahl) | Enthüllungs-Regel (Spoiler!) |
|---|---|---|---|
| Kampf | `U` | `st.*` s. o., `hp/max`, `down`, `eig` | live, keine Regel nötig |
| Feldspiel | `FSTEAM[0..1]` | `fsBisher().spieler` (7 Zähler) plus direkt an der Einheit: `xg`, `xp`, `saves`, `gegentore`, `checks`, `strafminuten`, `passYards`, `laufYards`, `fangYards`, `assists1/2`, `torwart` (Z. 5416–5433) | alle drei Feldspiele fahren den Live-Motor, `fsBisher()` ist dort reiner Mitschnitt (`fsZeiger==fsZuege.length`, Kommentar Z. 14067) — die Einheitenfelder sind **kein** Spoiler mehr |
| Bühne | `TEILNEHMER` | `runden[]` (`{punkte,ereignis}`; beim Heben `{kg,gueltig,uebung,versuch}`), `aktuell` (Index des zuletzt enthüllten Durchgangs, −1 vor dem ersten), `summe` (laufend), `eig`; Duell: `brett`, `gegnerN`, `verlauf[]`, `vorteil` (Endstand!); Heben: `rolle`, `duellNr`, `besteReissen/Stossen` (Endstand!), `versucheBis`, `zweikampf` (Endstand!), `nullwertung`, `duellGewonnen`, `anzeigeKg`, `groesse` | **alle Durchgänge sind beim Aufbau vorgerechnet** (Z. 10519). Anzeige darf nur `runden[0..aktuell]`, `verlauf[aktuell]` und `bestBisher(u,uebung)` (Z. 11037) lesen — `vorteil`, `zweikampf`, `duellGewonnen`, `besteReissen` erst bei `aktuell+1>=rundenN`. `zeichneBuehne` hat genau diesen Fehler schon einmal gehabt (Kommentar Z. 10987) |
| Bahn | `LAEUFER`, `rennFertig` | `pos` (0..1), `v`, `reserve/reserveMax`, `leer`, `gestolpert`, `durchbruch`, `tackles`, `getackelt`, `schattenS/spitzeS`, `stolper`/`huerde` (gerade im Stopp), `fertig` (Zielzeit), `raus`, `nerven/nervenMax` (nur Takeshi), `plan`, `eig`; Staffel: `bein`, `etappenZeit`, `wechselN`, `wechselKonto`, `wechselVerlust`, `aktiv` (Z. 15049–15068) | live, keine Regel nötig |

Was **nicht** gezählt wird und für Abschnitt 4 nachgezogen werden muss (klein, je eine Zeile):
- Bahn: „Hindernis sauber genommen" gibt es nicht als Zähler — ableitbar als
  `erreicht − gestolpert − durchbruch` mit `erreicht = HUERDEN_N().filter(h=>u.pos>=h).length`
  (das ist exakt die Schleife in Z. 15384, die jedes Hindernis einmal passiert). Für die
  Staffel zählt `gestolpert` auch den Wechsel-Patzer (Z. 15568) — dort ist die Ableitung
  nicht anwendbar, die Staffel bekommt ohnehin eigene Spalten.
- Feldspiel: `fsBisher()` kennt weder `strafe` noch `check` (Hockey) noch Yards (Football);
  beide liegen aber an der Einheit und sind im Live-Motor spoilerfrei lesbar.

---

## 2. Bestandsaufnahme aller zwanzig Disziplinen

Gemessen mit der Sonde aus Abschnitt 7 (frische Seite, `#t2`, `setDisc`, Tempo 4×, 20 s).
„Kopf" ist die Kopfzeile, die nach dem Disziplinwechsel tatsächlich im DOM steht.

| Disziplin | Chassis | Kopf im DOM | Zeilen | Zahlen? | Befund |
|---|---|---|---|---|---|
| TDM | Arena | Schd Heil Verh Tank KO Leist – – – Eig | 6/6 eigene | ja | passend; Heil leer (kein Heiler im Kader); drei „–"-Füller |
| Mini-DM | Arena | dito | 4/4 | ja | wie TDM |
| Battlefield | Arena | dito | 4/4 | ja | wie TDM |
| Basketball | Feldspiel | Pkt Reb Ast Stl Blk TO FG FG% Imp Eig | 6/6 | ja | **gut** — der Maßstab für die anderen |
| Hockey | Feldspiel | dito (Basketball-Wörter) | 6/6 | ja | Reb = Abpraller-Gewinn (Z. 9355), Blk = Feldspieler-Block **und** Torwart-Parade (`logZug(tw.side,"block")`, Z. 8477/8502), FG = Schüsse; Torwart-Zeile zeigt Blk 4, FG — statt Paraden/Gegentore; Strafminuten (`strafe`, Z. 6009) und Checks (Z. 8297) fehlen; Imp ≠ `feldspielWert` |
| Football | Feldspiel | dito | 6/6 | **fast leer** | nach 76 s nur der TD-Scorer (`6 | 1/1 | 100%`), fünf Zeilen komplett „—"; Yards/Sacks/Tackles/Interceptions gezählt, aber nicht in `fsBisher`; Imp ≠ `feldspielWert` |
| Gewichtheben | Bühne | **Kampf-Kopf** | 6 TDM-Namen | Standbild | keine Anbindung; `zeichneHeben` zeigt nur das aktive Duell auf der Leinwand |
| Showcase | Bühne | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| Eiskunstlauf | Bühne | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| Breaking | Bühne | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| **Wettessen** | Bühne | Kampf-Kopf | Standbild | Standbild | keine Anbindung — Chris' Screenshot |
| **Speed-Schach** | Bühne | Kampf-Kopf | Standbild | Standbild | keine Anbindung — Chris' Screenshot |
| I-Spy | Bühne | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| Tennis | Bühne | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| Fechten | Bühne | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| Spurt | Bahn | Kampf-Kopf | **6** Zeilen bei 4 gegen 4 | Standbild | keine Anbindung; Zeilenzahl verrät das Standbild |
| Time-Trial | Bahn | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| Climbing | Bahn | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| Staffel | Bahn | Kampf-Kopf | Standbild | Standbild | keine Anbindung |
| **Takeshi's Castle** | Bahn | Kampf-Kopf | Standbild | Standbild (Zahlen, falls vorher ein Kampf lief) | keine Anbindung — Chris' Screenshot |

**Standbild-Szenario, gemessen:** TDM 12 s laufen lassen → Zeile 1 `Krolach | 698 | — | 225 |
466 | 1 | 189 % | – | – | 73`. `setDisc("takeshis-castle")`, 12 s spielen (Score 4 : 5, Rennen
läuft) → Zeile 1 unverändert `Krolach | 698 | … | 189 %`. `setDisc("speed-schach")`, 8 s
→ unverändert. Das ist Chris' Takeshi-Screenshot: die Zahlen gehören zu einem Kampf, der vorher
in derselben Seite lief (im Spiel: der zuletzt geöffnete Arena-Tab), nicht zum Hindernislauf.

**Zwei Nebenbefunde derselben Krankheit**, hier nur benannt, nicht Teil des Auftrags:
- `renderEndstand()` (Z. 16992, der Endscreen mit `ESPALTEN` K/T/B/CC/H/S/SCH/ERL/FF/IMP) liest
  ausschließlich `U` und wird nur aus `finish()` gerufen — das ist Kampf-only; Bühne/Bahn/
  Feldspiel setzen `done` selbst und bekommen keinen Endscreen. Derselbe Umbau (Abschnitt 3)
  liefert die Spaltenliste, aus der sich später auch ein Endscreen je Chassis speist.
- Der Kommentar bei den Fouls (Z. 5572: „die Wertungstabelle hat feste 6 Spalten, geteilt mit
  Kampf — bewusst nicht angefasst") dokumentiert, dass die feste Spaltenzahl schon einmal
  eine Statistik aus der Anzeige gehalten hat.

---

## 3. Architektur: `wertung:` je Disziplin, Default je Chassis

### 3.1 Die Entscheidung

**Pro Disziplin konfigurierbar, mit einem Default pro Chassis** — nicht nur pro Chassis. Grund:
Innerhalb eines Chassis unterscheiden sich die *Wörter* (Bühne: „Pause"/„Sturz"/„Patzer" sind
dasselbe Ereignis `failWort`; Bahn: „Hürde"/„Kurve"/„Griff"/„Falle" sind dasselbe `hindernisWort`)
und teils die *Spalten* (Takeshi: Nerven und Ausscheiden; Staffel: Bein und Wechsel; Gewichtheben:
Reißen/Stoßen; Duell-Bühnen: Brett und Vorteil). Ein reiner Chassis-Schalter würde das gleiche
Provisorium wiederholen, das Hockey heute unter Basketball-Wörtern zeigt. Die ART-Tabellen sind
der Ort, an dem so etwas bereits steht (`lang`, `plaene`, `wortAbwehr/wortBlock/wortRebound`,
`failWort/erfolgWort`) — der neue Block liest genau diese Felder, statt Wörter zu duplizieren.

### 3.2 Der Vertrag

```js
// Eine SPALTE der Wertungstabelle. `wert` liefert eine Zahl (rechtsbündig, Bestwert fett)
// oder einen String (so angezeigt) oder null ("—"). Alles andere ist Kosmetik.
//   {id:"pkt", kopf:"Pkt", titel:"Punkte bisher", wert:(z)=>..., top:true, fmt:(v)=>..., farbe:(v)=>css}
// Eine ZEILE ist ein Objekt {n, side, raus, eig, ...} — die Zeilenquelle baut sie aus der
// jeweiligen Einheitenliste, und NUR sie kennt die Spoiler-Regel ihres Chassis (Abschnitt 1.4).
// Eine WERTUNG ist {namen, spalten, zeilen, sortierung, fuss}.
```

Die Chassis-Defaults heißen `WERTUNG_CHASSIS.kampf / .feldspiel / .buehne / .bahn`. Jeder
Default ist eine **Funktion der Disziplin-Art** (`(art)=>({...})`), damit er Wörter und Schalter
(`art.failWort`, `art.hindernisWort`, `art.tackle`, `art.duell`, `art.heben`, `art.staffel`) lesen
kann. Ein Disziplin-Eintrag `wertung:` in `ARENA_ART/FELDSPIEL_ART/BUEHNE_ART/BAHN_ART` darf
den Default **ersetzen** (Objekt) oder **abwandeln** (Funktion `(basis,art)=>({...basis, spalten:[...]})`).

```js
function wertungVon(d){
  const art=ARENA_ART[d]||FELDSPIEL_ART[d]||BUEHNE_ART[d]||BAHN_ART[d]||{};
  const chassis=istFeldspiel(d)?"feldspiel":istBuehne(d)?"buehne":istBahn(d)?"bahn":"kampf";
  const basis=WERTUNG_CHASSIS[chassis](art);
  const w=art.wertung;
  return !w?basis:(typeof w==="function"?w(basis,art):{...basis,...w});
}
```

### 3.3 Der eine Renderer

Ersetzt `renderWertung()`, `renderWertungFeldspiel()`, `setWertungKopf()` und `WERTUNG_KOPF`.
Kopfzeile wird aus `spalten` gebaut — die festen elf `<th>` im HTML werden zu einem leeren
`<thead><tr id="wkopfL"></tr></thead>` (und `wkopfR`). Die `<th>` bekommen weiterhin die Ids
`wthN`/`wth{i}` (+`r`), damit `scripts/schiesse-basketball-vergleich.mjs` und die Sonde aus
Abschnitt 7 nichts umlernen müssen.

```js
let wertungKopfStand="";
function renderWertungTabelle(){
  const tbL=document.getElementById("wbodyL"), tbR=document.getElementById("wbodyR");
  if(!tbL||!tbR)return;
  const w=wertungVon(disc);
  // Kopf nur neu bauen, wenn sich die Spaltenliste geaendert hat (Disziplinwechsel) —
  // der Renderer laeuft im Kampf je Tick (stepSim -> updateHud, Z. 13878).
  const stand=disc+"|"+w.spalten.map(s=>s.id+s.kopf).join(",");
  if(stand!==wertungKopfStand){
    for(const suf of ["","r"]){
      const tr=document.getElementById("wkopf"+(suf?"R":"L")); tr.textContent="";
      const thN=el("th",null,w.namen); thN.id="wthN"+suf; tr.appendChild(thN);
      w.spalten.forEach((s,i)=>{const th=el("th","n",s.kopf); th.id="wth"+i+suf; if(s.titel)th.title=s.titel; tr.appendChild(th);});
    }
    const fuss=document.getElementById("wfuss"); if(fuss)fuss.textContent=w.fuss||"";
    wertungKopfStand=stand;
  }
  const zeilen=w.zeilen();
  // Bestwert je Spalte ueber BEIDE Seiten (wie bisher maxD/maxP), nur fuer top:true-Spalten.
  const best={}; for(const s of w.spalten)if(s.top)best[s.id]=Math.max(0,...zeilen.map(z=>+s.wert(z)||0));
  tbL.textContent=""; tbR.textContent="";
  for(const seite of [0,1]){
    const tb=seite===0?tbL:tbR;
    for(const z of zeilen.filter(z=>z.side===seite).sort(w.sortierung)){
      const tr=el("tr",(seite===0?"eigen":"gegner")+(z.raus?" raus":""));
      tr.appendChild(el("td",null,z.n.length>10?z.n.slice(0,9)+"…":z.n));
      for(const s of w.spalten){
        const v=s.wert(z);
        const td=el("td","n"+(s.top&&typeof v==="number"&&v>0&&v>=best[s.id]?" top":""));
        td.textContent=v==null?"—":(s.fmt?s.fmt(v):(typeof v==="number"?String(Math.round(v)):v));
        if(s.farbe&&v!=null){const f=s.farbe(v); if(f){td.style.color=f; td.style.fontWeight="600";}}
        if(s.titel)td.title=s.titel;
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
  }
}
```

**Aufrufstellen (vier, alle bestehend):** `updateHud()` Z. 14183–14184 und
`updateHudFeldspiel()` Z. 9604–9605 ersetzen ihr Paar durch `renderWertungTabelle();`;
`updateHudBuehne()` (vor `renderKader()`, Z. 10936) und `updateHudBahn()` (vor `renderKader()`,
Z. 14150) bekommen den Aufruf **neu**. Weil `reset()` (Z. 17054) ohnehin den passenden Updater
ruft, ist die Tabelle damit auch direkt nach `setDisc` richtig — kein Standbild mehr, und
die Zeilenzahl ist automatisch `jeSeite`.

**Was sich für den Kampf und Basketball NICHT ändert:** die Spaltenliste des Kampf-Defaults
ist zeichengleich die heutige (ohne die drei „–"-Füller), `beitragVon`/`leistungVon` bleiben,
die Feldspiel-Zeilenquelle bleibt `fsBisher()`. Die Sonde aus Abschnitt 7 nimmt das ab: die
Zeilen von TDM und Basketball vor und nach dem Umbau müssen bis auf die weggefallenen Füller
identisch sein.

### 3.4 Die vier Defaults (Kurzform; die Bühnen- und Bahn-Defaults sind in Abschnitt 4 vollständig)

```js
const WERTUNG_CHASSIS={
  kampf:(art)=>({
    namen:"Kämpfer",
    zeilen:()=>U.map(u=>({n:u.n,side:u.side,raus:u.down,eig:u.eig,u})),
    sortierung:(a,b)=>beitragVon(b.u)-beitragVon(a.u),
    spalten:[
      {id:"dmg", kopf:"Schd", top:true, wert:z=>z.u.st.dmg||null},
      {id:"heal",kopf:"Heil", top:true, wert:z=>z.u.st.heal||null},
      {id:"verh",kopf:"Verh", top:true, wert:z=>z.u.st.verh||null},
      {id:"tank",kopf:"Tank", top:true, wert:z=>z.u.st.tank||null},
      {id:"ko",  kopf:"KO",              wert:z=>z.u.st.ko||null},
      {id:"leist",kopf:"Leist", wert:z=>leistungVon(z.u,U), fmt:v=>v+" %",
        farbe:v=>v>=140?"var(--ok)":v<=60?"var(--crit)":null, titel:"Beitrag gemessen an dem, was der Einsatzwert erwarten lässt"},
      {id:"eig", kopf:"Eig",  wert:z=>z.eig?Math.round(z.eig):null}],
    fuss:"„Getankt\" ist der Rohschaden vor Abzug …"   // der heutige Kampf-Text, unveraendert
  }),
  feldspiel:(art)=>({ namen:"Spieler", zeilen:feldspielZeilen, sortierung:(a,b)=>b.punkte-a.punkte||b.assists-a.assists,
    spalten:[ /* heutige zehn, Impact aber ueber feldspielWert(z.u, feldspielDisc) */ ], fuss:"…" }),
  buehne:(art)=>art.heben?WERTUNG_HEBEN(art):art.duell?WERTUNG_DUELL(art):WERTUNG_AUFTRITT(art),
  bahn:(art)=>art.staffel?WERTUNG_STAFFEL(art):WERTUNG_RENNEN(art)
};
```

Die Zeilenquelle des Feldspiels bleibt `fsBisher().spieler.get(u.id)`, ergänzt um die
Einheitenfelder, die `fsBisher` nicht kennt (`z.u.passYards` usw.) — im Live-Motor spoilerfrei
(Abschnitt 1.4). `Imp` wird `feldspielWert(z.u, feldspielDisc)`, also exakt `MOTOREN[fd].wert()`
(Z. 17473) — damit stimmt der Kommentar in Z. 14102 wieder, und Hockeys Torwart rangiert in der
Anzeige dort, wo ihn die Messung rangiert.

### 3.5 Warum nicht einfach `renderWertung()` mit `if(istBuehne)`-Zweigen erweitern

Das wäre der dritte Zweig neben Kampf und Feldspiel und der Anfang des vierten. Der
Multi-Disziplin-Plan (`docs/design/battle-arena-multi-disziplin-plan.md`, Punkt 1.2/5) hat
genau diesen Umbau schon als „Spaltensatz je Chassis konfigurierbar, kleiner UI-Refactor" offen
stehen; die Feldspiel-Fassung vom 29.08. war der erste Zweig. Der Vertrag oben ist bewusst
so schmal (fünf Felder), dass er nicht größer ist als die zwei bestehenden Funktionen zusammen.

---

## 4. Umsetzungsreife Rezepte für die drei dringendsten

Alle drei sind so geschnitten, dass ihr Default schon die übrigen Disziplinen desselben
Chassis abdeckt; der disziplineigene `wertung:`-Eintrag ändert nur Wörter und einzelne Spalten.
Breite: `.wsplit` gibt jedem Block rund 450 px; bei ~45 px je Spalte sind **neun bis zehn**
Wertspalten das Maximum (Chris' Fund vom 29.08. zu den kurzen Kopfwörtern gilt weiter).

### 4.1 Speed-Schach (Bühne, `duell:true`, 10 Züge, 6 Bretter)

Was ein Zuschauer bei einem Mannschaftskampf wissen will: welches Brett, wie steht es dort,
wie viele Züge sind gespielt, und hat mein Spieler stark gezogen oder Zeit verloren.
Datenquelle je Teilnehmer (Z. 10556–10569): `brett`, `gegnerN`, `runden[r].punkte/ereignis`,
`verlauf[r]` (laufender Vorteil nach Zug r), `aktuell`. **Nicht** `vorteil` (Endstand).

| # | Kopf | Titel | Wert | Anmerkung |
|---|---|---|---|---|
| 0 | Brett | Brett und Gegner | `"B"+(brett+1)` | String; Sortierung nach Brett, nicht nach Punkten — beide Blöcke zeigen so Zeile für Zeile dieselbe Paarung |
| 1 | Zug | gespielte Züge | `(aktuell+1)+"/"+rundenN` | String |
| 2 | Pkt | eigene Punkte bisher | `summe` | `top:true`; das ist `wert()` der Rangtreue (Z. 17436) |
| 3 | Stark | starke Züge | Anzahl `runden[0..aktuell]` mit `ereignis===erfolgWort` | |
| 4 | Zeit− | Zeitverluste am Zug | Anzahl mit `ereignis===failWort` | |
| 5 | Best | stärkster Zug | `max(runden[0..aktuell].punkte)` | `top:true` — Chris' „stärkster Zug" |
| 6 | Vort | laufender Vorteil | `verlauf[aktuell]` (0 vor dem ersten Zug) | signiert, `farbe`: >0 ok, <0 crit |
| 7 | Stand | Brett entschieden? | erst bei `aktuell+1>=rundenN`: `"+"` (Sieg) / `"="` (Remis) / `"−"` (Niederlage) aus `verlauf[rundenN-1]`, sonst `"…"` | Siege/Remis/Niederlagen je Brett — die Team-Summe steht schon im Score („1 : 5", Z. 10925) |
| 8 | Leist | Beitrag gegen Erwartung | `leistungBuehne(z)` — dieselbe Idee wie `leistungVon`: `summe` gegen `eig/Σeig × Σsumme` über alle zwölf | fair, weil die Warteschlange rundenweise abwechselt (Z. 10575): alle stehen bei `aktuell` ±1 |
| 9 | Eig | Einsatzwert | `eig` | |

```js
// BUEHNE_ART["speed-schach"].wertung — nur die Woerter; die Spalten kommen aus WERTUNG_DUELL.
wertung:{duellWort:"Brett", erfolgKopf:"Stark", failKopf:"Zeit−",
  fuss:"„Pkt\" sind die eigenen Zugpunkte (das Maß der Rangtreue), „Vort\" der laufende Vorteil am Brett gegen den Gegner in derselben Zeile. „Stand\" wird erst nach dem letzten Zug entschieden: + Sieg, = Remis, − Niederlage. „Leist\" vergleicht die Punkte mit dem, was der Einsatzwert erwarten lässt."}
```

`WERTUNG_DUELL(art)` (Default für Speed-Schach, I-Spy, Tennis, Fechten):

```js
const bisher=(u)=>u.runden.slice(0,Math.max(0,u.aktuell+1));
const WERTUNG_DUELL=(art)=>{
  const w=art.wertung||{};
  const zeilen=()=>TEILNEHMER.map(u=>({n:u.n,side:u.side,raus:false,eig:u.eig,u,brett:u.brett??0,
    r:bisher(u), fertig:u.aktuell+1>=art.rundenN}));
  return {namen:"Teilnehmer", zeilen, sortierung:(a,b)=>a.brett-b.brett,
    spalten:[
      {id:"brett",kopf:w.duellWort||"Brett", titel:"gegen wen", wert:z=>(w.duellWort||"B").slice(0,1)+(z.brett+1)},
      {id:"zug",  kopf:"Zug",  wert:z=>z.r.length+"/"+art.rundenN},
      {id:"pkt",  kopf:"Pkt",  top:true, wert:z=>z.u.summe||null},
      {id:"stark",kopf:w.erfolgKopf||"Stark", titel:art.erfolgWort, wert:z=>z.r.filter(r=>r.ereignis===art.erfolgWort).length||null},
      {id:"fail", kopf:w.failKopf||"Fehl", titel:art.failWort, wert:z=>z.r.filter(r=>r.ereignis===art.failWort).length||null},
      {id:"best", kopf:"Best", top:true, wert:z=>z.r.length?Math.max(...z.r.map(r=>r.punkte)):null},
      {id:"vort", kopf:"Vort", wert:z=>z.r.length&&z.u.verlauf?z.u.verlauf[z.r.length-1]:0,
        fmt:v=>(v>0?"+":"")+v, farbe:v=>v>0?"var(--ok)":v<0?"var(--crit)":null},
      {id:"stand",kopf:"Stand",wert:z=>!z.fertig?"…":(z.u.verlauf[art.rundenN-1]>0?"+":z.u.verlauf[art.rundenN-1]<0?"−":"="),
        farbe:v=>v==="+"?"var(--ok)":v==="−"?"var(--crit)":null},
      {id:"leist",kopf:"Leist",wert:z=>leistungBuehne(z.u), fmt:v=>v+" %", farbe:v=>v>=140?"var(--ok)":v<=60?"var(--crit)":null},
      {id:"eig",  kopf:"Eig",  wert:z=>z.eig?Math.round(z.eig):null}],
    fuss:w.fuss||""};
};
function leistungBuehne(u){
  const gesamt=TEILNEHMER.reduce((a,x)=>a+x.summe,0), gesamtEig=TEILNEHMER.reduce((a,x)=>a+(x.eig||1),0);
  if(gesamt<=0||gesamtEig<=0)return null;
  const erwartet=(u.eig||1)/gesamtEig*gesamt; return erwartet>0?Math.round(u.summe/erwartet*100):null;
}
```

Die Wörter der drei Geschwister: I-Spy `{duellWort:"Runde", erfolgKopf:"Fund", failKopf:"Übers"}`,
Tennis `{duellWort:"Match", erfolgKopf:"BW+", failKopf:"BW−"}` (Ballwechsel gewonnen/vergeben),
Fechten `{duellWort:"Gefecht", erfolgKopf:"Treff", failKopf:"Spät"}` — jeweils aus
`erfolgWort/failWort` der Art (Z. 10393/10431/10461).

### 4.2 Wettessen (Bühne, Auftritt, 8 Durchgänge, `failWort` „muss kurz pausieren")

Ein Wettessen ist eine Reihe von Durchgängen; interessant sind die Punkte je Durchgang, der beste
Durchgang, wie oft die Pause kam, und ob jemand hinten raus einbricht (AUSDAUER wirkt genau so,
Z. 10529). Datenquelle: `runden[0..aktuell].punkte/ereignis`, `summe`.

| # | Kopf | Titel | Wert |
|---|---|---|---|
| 0 | Dg | Durchgänge | `(aktuell+1)+"/"+rundenN` |
| 1 | Pkt | Punkte gesamt | `summe` (`top`) |
| 2 | Ø | Punkte je Durchgang | `summe/(aktuell+1)` (`top`) |
| 3 | Best | bester Durchgang | `max(punkte)` (`top`) |
| 4 | Letzt | letzter Durchgang | `runden[aktuell].punkte` |
| 5 | Pause | musste pausieren | Anzahl `ereignis===failWort` — Chris' „wie oft muss pausieren" |
| 6 | Serie | Durchgänge ohne Pause in Folge (aktuell) | Länge des Erfolgs-Suffix von `runden[0..aktuell]` |
| 7 | Abfall | späte gegen frühe Hälfte | `Ø(zweite Hälfte) − Ø(erste Hälfte)`, erst ab vier Durchgängen; signiert; zeigt AUSDAUER |
| 8 | Leist | wie 4.1 | `leistungBuehne` |
| 9 | Eig | | `eig` |

```js
// BUEHNE_ART.wettessen.wertung — nur Woerter.
wertung:{failKopf:"Pause", fuss:"Jeder Durchgang bringt Punkte; „Pause\" zählt, wie oft er kurz aussetzen musste (der Durchgang zählt dann nur 65 %). „Abfall\" vergleicht die späten Durchgänge mit den frühen — wer hinten raus einbricht, steht hier im Minus. „Leist\" vergleicht die Punkte mit dem, was der Einsatzwert erwarten lässt."}
```

`WERTUNG_AUFTRITT(art)` (Default für Wettessen, Showcase, Eiskunstlauf, Breaking) ist wie
`WERTUNG_DUELL` gebaut, sortiert nach `summe`, ohne Brett/Vort/Stand, mit Ø/Letzt/Serie/Abfall.
Wörter der Geschwister: Showcase `failKopf:"Patzer"`, Eiskunstlauf `"Sturz"`, Breaking
`"Abbr"` (Move bricht ab) — direkt aus `failWort` (Z. 10298/10314/10332).

### 4.3 Takeshi's Castle (Bahn, 14 Fallen, Nerven, Ausscheiden)

Ein Spießrutenlauf wird an Fallen gemessen, nicht an Sekunden: wie viele Fallen erreicht, wie
viele sauber, wie viele durchgebrettert (`durchbruch`, Z. 15410 — WUCHT heißt hier
„Durchbrettern", Z. 14850), wie viele Stürze, wie viel Nervenkostüm ist übrig (`nerven/nervenMax`,
Z. 15061/15444), wie weit ist er, und ist er raus (`raus`, Z. 15453) oder im Ziel (`fertig`).

| # | Kopf | Titel | Wert |
|---|---|---|---|
| 0 | Fallen | erreichte Fallen | `erreicht+"/"+HUERDEN_N().length` mit `erreicht = hindernisse.filter(h=>pos>=h).length` |
| 1 | Sauber | sauber genommen | `erreicht − gestolpert − durchbruch` (`top`) — Chris' „Hindernisse geschafft" |
| 2 | Durch | durchgebrettert | `durchbruch` |
| 3 | Sturz | gerissen | `gestolpert` — Chris' „gerissen" |
| 4 | Nerv | Nervenkostüm | `nerven/nervenMax` in %, `farbe`: <30 % crit |
| 5 | Weit | weiteste Position | `pos` in % (`top`) — Chris' „weiteste erreichte Position" |
| 6 | Res | Kraftreserve | `reserve/reserveMax` in %; „leer" wenn `leer` |
| 7 | Zeit | Zielzeit | `fertig` in s, nur für Finisher (`raus` → „—") |
| 8 | Stand | | `raus?"raus":fertig!=null?"Ziel "+platz:"läuft"` — Chris' „Ausscheiden ja/nein"; Platz = Index in `rennFertig` unter den Nicht-Ausgeschiedenen |
| 9 | Eig | | `eig` |

Sortierung: Finisher nach `fertig`, dann Laufende nach `pos` absteigend, dann Ausgeschiedene
nach `pos` absteigend — dieselbe Ordnung, die `MOTOREN[bd].wert()` für die Bahn benutzt
(`(a.fertig??99)-(b.fertig??99)`, Z. 17401; Ausgeschiedene tragen `fertig=90+(1−pos)·10`,
Z. 15453, sortieren sich also von selbst nach Strecke).

```js
// BAHN_ART["takeshis-castle"].wertung — Nerven-Spalte und Stand-Woerter ergaenzen den Rennen-Default.
wertung:(basis,art)=>({...basis,
  spalten:basis.spalten.flatMap(s=>s.id==="res"
    ?[{id:"nerv",kopf:"Nerv",titel:"Nervenkostüm — bei 0 scheidet er aus",
        wert:z=>z.u.nervenMax?Math.round(z.u.nerven/z.u.nervenMax*100):null, fmt:v=>v+"%",
        farbe:v=>v<30?"var(--crit)":null}, s]
    :[s]),
  fuss:"Vierzehn Fallen. „Sauber\" ist ohne Sturz und ohne Gewalt genommen, „Durch\" mit Gewalt durchgebrettert, „Sturz\" gerissen. Jeder Sturz kostet Nerven; sind sie leer, ist er raus („Stand\"). „Weit\" ist die erreichte Strecke, „Zeit\" nur für die, die ankommen."});
```

`WERTUNG_RENNEN(art)` (Default für Spurt, Time-Trial, Climbing, Takeshi):

```js
const WERTUNG_RENNEN=(art)=>{
  const H=()=>HUERDEN_N(), hw=art.hindernisWort||"Hürde", wucht=(art.lang||{}).WUCHT||"Wucht";
  const zeilen=()=>LAEUFER.map(u=>{
    const erreicht=H().filter(h=>u.pos>=h).length;
    return {n:u.n,side:u.seite,raus:!!u.raus,eig:u.eig,u,erreicht,
      sauber:Math.max(0,erreicht-u.gestolpert-(u.durchbruch||0)),
      platz:u.fertig!=null&&!u.raus?rennFertig.filter(x=>!x.raus).indexOf(u)+1:null};});
  const spalten=[
    {id:"hind", kopf:hw.slice(0,4), titel:hw+"n erreicht", wert:z=>z.erreicht+"/"+H().length},
    {id:"sauber",kopf:"Saub", titel:"sauber genommen", top:true, wert:z=>z.sauber||null},
    {id:"durch", kopf:wucht.slice(0,5), titel:wucht, wert:z=>z.u.durchbruch||null},
    {id:"sturz", kopf:"Sturz", wert:z=>z.u.gestolpert||null},
    ...(art.schatten?[{id:"sog",kopf:"Sog",titel:"Anteil im Windschatten",wert:z=>Math.round(z.u.schattenS/Math.max(0.1,z.u.schattenS+z.u.spitzeS)*100),fmt:v=>v+"%"}]:[]),
    ...(art.tackle?[{id:"rempl",kopf:"Rempl",titel:"gerempelt / eingesteckt",wert:z=>(z.u.tackles||z.u.getackelt)?z.u.tackles+"/"+z.u.getackelt:null}]:[]),
    {id:"weit", kopf:"Weit", titel:"erreichte Strecke", top:true, wert:z=>Math.round(z.u.pos*100), fmt:v=>v+"%"},
    {id:"res",  kopf:"Res", titel:"Kraftreserve", wert:z=>z.u.leer?"leer":Math.round(z.u.reserve/Math.max(1,z.u.reserveMax)*100)+"%",
      farbe:v=>v==="leer"?"var(--crit)":null},
    {id:"zeit", kopf:"Zeit", wert:z=>z.u.fertig!=null&&!z.u.raus?+z.u.fertig.toFixed(1):null, fmt:v=>v.toFixed(1)+" s"},
    {id:"stand",kopf:"Stand", wert:z=>z.u.raus?"raus":z.platz?"Ziel "+z.platz:"läuft",
      farbe:v=>v==="raus"?"var(--crit)":v.startsWith("Ziel")?"var(--ok)":null},
    {id:"eig",  kopf:"Eig", wert:z=>z.eig?Math.round(z.eig):null}];
  return {namen:"Läufer", zeilen, spalten,
    sortierung:(a,b)=>((a.u.fertig??99)-(b.u.fertig??99))||(b.u.pos-a.u.pos), fuss:""};
};
```

Spurt hat damit Sog und Rempler (beide Schalter an), Time-Trial und Climbing nicht (aus) —
keine leere Spalte, ohne dass eine Disziplin etwas eintragen muss. Die Wörter kommen aus
`hindernisWort` und `lang.WUCHT` („Hürd"/„Kurv"/„Grif"/„Fall" und „Wucht"/„Risiko"/
„Kraftzug"/„Durchbrettern").

### 4.4 Umfang von Welle 1

- `battle-mode.html`: elf `<th>` je Block durch ein leeres `<tr id="wkopfL|R">` ersetzen (2 Zeilen).
- `battle-mode.engine.js`: `WERTUNG_KOPF`, `setWertungKopf`, `renderWertung`,
  `renderWertungFeldspiel` (≈130 Zeilen) raus; `wertungVon`, `renderWertungTabelle`,
  `WERTUNG_CHASSIS` mit `kampf`/`feldspiel` (zeichengleiche Spalten) sowie `WERTUNG_DUELL`,
  `WERTUNG_AUFTRITT`, `WERTUNG_HEBEN`, `WERTUNG_RENNEN`, `WERTUNG_STAFFEL` (≈250 Zeilen) rein;
  vier Aufrufstellen; drei `wertung:`-Einträge (Speed-Schach, Wettessen, Takeshi) plus die
  reinen Wort-Einträge der übrigen Bühnen. Kein Motorpfad wird berührt — die Sonde
  `node scripts/miss-alle-disziplinen.mjs 24` muss danach bit-identisch lesen (sie rendert
  nicht, aber die Abnahme-Regel aus CLAUDE.md gilt trotzdem).
- Abnahme: Sonde aus Abschnitt 7.

---

## 5. Die übrigen siebzehn — Empfehlung je Disziplin

„Default" heißt: mit Welle 1 abgedeckt, nur der Wort-Eintrag ist zu setzen. Die Welle ist die
Umsetzungsrunde, in der die disziplineigenen Extras kommen.

| Disziplin | Chassis | Heute | Empfohlene Spalten (Kopf) | Datenquelle | Welle |
|---|---|---|---|---|---|
| TDM, Mini-DM, Battlefield | Arena | richtig, drei Füller | wie heute ohne Füller: Schd Heil Verh Tank KO Leist Eig; optional Beih (`st.beihilfe`) und Schild (`st.schild`), beide gezählt (Z. 13948, 13301) und im Endscreen schon sichtbar | `U[].st` | 3 (Heil nur zeigen, wenn ein Heiler im Kader: `SQUAD/OPP.some(HEILER)`) |
| Basketball | Feldspiel | gut | unverändert; Imp = `feldspielWert` (K3-Formel mit xP, Z. 6255) statt der Kopie | `fsBisher` | 2 |
| Hockey | Feldspiel | Basketball-Wörter | Tore Ast S S% Puck Blk Abpr TO PIM Imp Eig — Torwart-Zeile stattdessen Par GT SV% (`saves`, `gegentore`, `saves/(saves+gegentore)`) | `fsBisher` (`treffer/steal/block/rebound/fehlwurf`) + Einheit (`strafminuten`, `saves`, `gegentore`, `torwart`); `Imp=feldspielWert` (GSAA für den Torwart, Z. 6171) | 2 |
| Football | Feldspiel | fast leer | Pkt PassY LaufY FangY Kompl Sack Tkl/Int Fum Imp Eig | Einheit (`passYards/laufYards/fangYards`, `assists`=Completions Z. 6811, `bloecke`=Sacks Z. 6761, `steals`=Int/Recovery Z. 6780/6800, `verluste`=Fumbles/Int); `Imp=feldspielWert` (Fantasy-Scoring, Z. 6135) | 2 |
| Gewichtheben | Bühne | Standbild | Duell Rolle Reiß Stoß Vers Zwei Last Stand Eig — `Reiß/Stoß` = `bestBisher(u,"reissen"/"stossen")` in Anzeige-kg (`sinclairAnzeige`), `Vers` = gültig/gesamt aus `runden[0..aktuell].gueltig`, `Zwei` erst wenn beide Übungen enthüllt, `Last` = zuletzt angesagte kg, `Stand` = Duell gewonnen erst am Ende | `TEILNEHMER` (Heben-Felder) | 1 (`WERTUNG_HEBEN`; `zeichneHeben` zeigt nur das aktive Duell — die Tabelle ist der Ort für alle sechs) |
| Showcase, Eiskunstlauf, Breaking | Bühne | Standbild | Auftritt-Default, `failKopf` Patzer / Sturz / Abbr | `runden` | 1 |
| I-Spy, Tennis, Fechten | Bühne | Standbild | Duell-Default mit den Wörtern aus 4.1 | `runden`, `verlauf` | 1 |
| Spurt | Bahn | Standbild | Rennen-Default (mit Sog und Rempl) | `LAEUFER` | 1 |
| Time-Trial | Bahn | Standbild | Rennen-Default: Kurv Saub Risiko Sturz Weit Res Zeit Stand Eig | `LAEUFER` | 1 |
| Climbing | Bahn | Standbild | Rennen-Default: Grif Saub Kraftzug Sturz Weit Res Zeit Stand Eig | `LAEUFER` | 1 |
| Staffel | Bahn | Standbild | Bein Etappe Wechs Verl Patz Weit Res Team Stand Eig — `Bein`=`bein+1`, `Etappe`=`etappenZeit` s, `Wechs`=`wechselN`, `Verl`=`−wechselKonto` s, `Patz`=`gestolpert`, `Weit`=Fortschritt im eigenen Abschnitt `(pos−beinVon)/(beinBis−beinVon)`, `Team`=`fertig` (alle sechs gleich, Z. 15586), `Stand`=wartet/läuft/übergeben/Ziel aus `aktiv`/`durch`/`fertig`; Sortierung nach Bein | `LAEUFER` (Staffel-Felder) | 1 (`WERTUNG_STAFFEL`) |

Welle 2 braucht zusätzlich in `fsBisher()` je eine Zeile für `strafe` (→ `strafminuten`) oder —
einfacher, weil der Live-Motor ohnehin kein Spoiler-Problem mehr hat — die Feldspiel-
Zeilenquelle liest diese Felder direkt an der Einheit.

---

## 6. Priorisierung

1. **Welle 1 — ein PR, alle 14 Standbilder weg.** Generischer Umbau (3.3) + Chassis-Defaults
   Bühne/Bahn (4.1–4.3, 5) + die Wort-Einträge. Chris' drei Screenshots werden damit richtig,
   und keine Disziplin zeigt mehr einen fremden Kader. Das ist die Antwort auf „IMMER nutzen".
2. **Welle 2 — Feldspiel ehrlich machen.** Hockey/Football-Wörter, Torwart-Zeile, Yards,
   `Imp = feldspielWert`. Kleiner, aber sichtbar: Football ist heute die einzige Disziplin mit
   Tabelle, in der fünf von sechs Zeilen leer sind.
3. **Welle 3 — Arena-Kosmetik.** Heil nur bei Heiler, Beihilfe/Schild als Spalten, und der
   Endscreen (`renderEndstand`) aus derselben Spaltenliste für alle Chassis.

---

## 7. Abnahme: die Sonde, die diesen Bericht gemessen hat

Vorschlag: als `scripts/sonde-wertungstabelle.mjs` ins Repo (Muster
`scripts/screenshot-gewichtheben.mjs` / `scripts/schiesse-basketball-vergleich.mjs`; lädt die
Seite per `file://`, braucht keinen HTTP-Server, läuft mit dem festen Chromium unter
`/opt/pw-browsers`). Je Disziplin: frische Seite → `#t2` → `window.__arena.setDisc(d)` →
zweimal `#spd` (4×) → `#play` → 20 s → Kopfzeile, `#wbodyL/#wbodyR`, `#wfuss` auslesen.

Abnahmekriterien (heute verletzt, nach Welle 1 alle grün):

1. Kein `Kämpfer`-Kopf außerhalb der drei Arena-Disziplinen; kein `Spieler`-Kopf außerhalb
   der drei Feldspiele.
2. Zeilenzahl je Block == `jeSeite` der Disziplin (heute: Spurt 6 statt 4).
3. Jeder Zeilenname steht auch in der Kaderleiste derselben Seite (`#kaderL b` / `#kaderR b`)
   — das schließt den fremden Kader aus.
4. Nach 20 s bei 4× hat jede Spalte außer einer erlaubten Liste (`Heil` in der Arena, `Zeit`
   und `Stand` vor dem Ende, `Zwei` vor der zweiten Übung) mindestens eine Zeile ≠ „—".
5. TDM- und Basketball-Zeilen sind gegenüber dem Stand vor dem Umbau zeichengleich bis auf die
   drei entfernten Füller (Regression der bestehenden Tabellen).
6. Standbild-Szenario (TDM → Takeshi → Speed-Schach in **einer** Seite): nach jedem Wechsel
   ändert sich Kopfzeile und Zeilenmenge.

Die Sonde dieser Recherche (Scratchpad, nicht committet) ist genau dieses Skript ohne die
Kriterien 4–6; sie lief in ~4 Minuten für alle zwanzig.

---

## 8. Offene Fragen an Chris

1. **Sortierung der Duell-Bühnen:** nach Brett (beide Blöcke zeigen dieselbe Paarung auf einer
   Zeile — mein Vorschlag) oder nach Punkten (wie Basketball)? Beides ist eine Zeile im
   `wertung:`-Eintrag.
2. **Gewichtheben:** soll die Tabelle die angesagte nächste Last zeigen (`runden[aktuell+1].kg`
   — real ist die Ansage öffentlich, im Motor aber Teil der vorgerechneten Runden) oder nur die
   zuletzt gehobene? Vorschlag: nur die zuletzt gehobene, bis Chris es anders will.
3. **Leistung (%)** für Bühne und Bahn: für die Bühne ist `leistungBuehne` (4.1) sauber; für die
   Bahn gibt es keinen additiven Beitrag (Plätze sind ein Nullsummenspiel, Kommentar Z. 17483) —
   deshalb dort keine Leist-Spalte. Einverstanden, oder soll „Platz gegen Eignungsrang" als
   Ersatz rein?

# Echtzeit-Fluss oder rundenbasiert? — Analyse des Präsentationsmodells, Phase 1 (19.09.)

**Reine Analyse, keine Umsetzung, keine Empfehlung.** Phase 1 einer zweiphasigen Untersuchung;
die Synthese/Entscheidungsvorlage (Phase 2, Opus) baut hierauf auf. Stand `origin/main`
`d85ab462` (17.09., nach PR #964). Alle Zeilenangaben beziehen sich auf
`public/mockups/battle-mode.engine.js` in diesem Stand, sofern nicht anders gesagt.

Chris' Ausgangsgedanke, wörtlich: „vielleicht, wenn das mit dem Flow und den Animationen nicht
so gut läuft, gibt es ja auch immer noch die Möglichkeit, das rundenbasiert zu machen, das würde
Animationen etc. vereinfachen." Sein Ziel dahinter: „einfach ein cooles Spiel erschaffen, wo das
Auto-Battling auch beim Zuschauen Spaß macht."

---

## 0. Die Antwort in zehn Sätzen

1. **Das Projekt hat heute nicht EIN Zeitmodell, sondern zwei — und zwar sauber entlang der
   Chassis-Grenze.** Bühne (9 Disziplinen) rechnet jeden Durchgang **vorab** und enthüllt ihn
   über eine Warteschlange mit festem Takt (`buehneQueue`/`rundenDauer`); Bahn (5), Arena (3)
   und der Live-Pfad des Feldspiels (3) sind **durchgehende Tick-Simulationen**, in denen das
   Ergebnis erst im Lauf entsteht (`pos+=v*dt`, Abklingzeiten, `rr()<p*dt`). Das steht so
   schon im Code (`:26728-26731`) und war am 24.08. der Strukturbefund von
   `docs/ARENA_INTERAKTION_KONZEPT.md`. Die Prämisse „alle Ergebnisse werden vorab
   durchgerechnet" gilt nur für die Bühne — für 9 von 20 Disziplinen.
2. **Auf Produktionsebene stimmt die Prämisse trotzdem für alle zwanzig**, nur eine Etage höher:
   der gebuchte Spieltag wird headless in Playwright zu Ende simuliert
   (`lib/battle/arena-headless-runner.ts`, `MOTOREN[..].lauf()` mit festem 1/60), BEVOR
   irgendjemand zuschaut. Der sichtbare Lauf in der App ist heute ein **zweiter, eigener Lauf**
   — die Host-Brücke reicht Kader, Aufstellung und Anzeige-Meta durch, aber **keine Saat**
   (`FoundationBattleArenaHost.tsx:327-350`). Was Chris sieht, ist nicht das, was gebucht wurde.
3. **„Rundenbasiert" meint deshalb je nach Chassis drei völlig verschiedene Dinge** (Abschnitt
   2): für die Bühne nur die Frage „Auto-Advance mit Zierbewegung oder diskrete Clips"; für Bahn
   und Live-Feldspiel einen **neuen Motor** mit Neukalibrierung von 8 Disziplinen, davon 5
   bestanden; für die Arena einen neuen Motor bei drei Disziplinen, die **ohnehin
   durchgefallen** sind.
4. **Die vier dokumentierten Schmerzpunkte sind zu drei Vierteln keine Zeitmodell-Fragen.**
   Vollbild-/reiherMech-Sonderpfade und Z-Skalierungs-Drift sind Geometrie-/Zeichenpfad-Fehler
   (`zeichneSprite()` `:3359`/`:3398`) und bestehen in einem Rundenmodell wortgleich weiter.
   Das Screenshot-Rauschen kommt nicht aus „Echtzeit", sondern aus der **Wanduhr-Kopplung** von
   `loop()` (`:26852-26869`) und aus drei Stellen, die `performance.now()` lesen — das ist mit
   einem deterministischen Sonden-Modus behebbar, den `lauf()` im Kern schon hat.
5. **Der vierte Schmerzpunkt — der Verifikationsaufwand je PR — ist real und hat eine
   strukturelle Ursache, aber sie heißt nicht „Echtzeit", sondern „Präsentation läuft im selben
   Prozess wie die Messung".** Die `viz*`-Bewegungsmaschinen laufen in der Rangtreue-Sonde
   mit (`:13836-13838`: „disziplinProbe()/miss-alle-disziplinen.mjs durchlaufen diese Funktion
   mit"). Solange das so ist, muss JEDE Präsentations-PR bit-identisch nachmessen — egal, ob sie
   interpoliert oder Clips abspielt.
6. **Die eine Variante, die diesen Aufwand per Konstruktion beseitigt, ist nicht
   „rundenbasiert", sondern „Ereignisprotokoll + Abspieler"** (Variante R4 in Abschnitt 2): die
   Simulation schreibt, was passiert; die Präsentation liest nur. Dann ist die Präsentation
   rho-neutral, weil sie den Motor gar nicht mehr erreichen kann — und sie ist beliebig
   taktbar: Echtzeit-Replay, Highlights-Modus, Schritt-für-Schritt. Beides gleichzeitig.
7. **Chris' eigene Rückmeldungen der letzten drei Wochen gehen in eine klare Richtung, und
   sie heißt nicht „schneller/mehr Animation", sondern „ruhiger, lesbarer, spannender".**
   „zu hektisch" (29.08., `:26801`), „sehr schnell und unübersichtlich" (06.09., `:26832`),
   „Spurt sollte ca 3 Minuten dauern damit man sich das in Ruhe angucken kann" (06.09.,
   `:26750`), „ich weiß nicht ob alle gleichzeitig sinnvoll ist UND man hat gar keine
   Indikation welche Leute sich gerade besser schlagen" (13.09.), „muss noch irgendwie mehr
   Spannung haben" (13.09.), „die Charaktere suchen sich anscheinend einen Gegner und hauen
   drauf, aber es gibt gar nicht ne Dynamik" (13.09., `:4576`). Kein einziger Fund lautet „zu
   langsam" oder „zu wenig Bewegung".
8. **Wo kontinuierliche Zeit der Inhalt ist, wäre ein Rundenmodell ein Verlust:** Bahn (Rennen,
   Windschatten, Überholen, Zieleinlauf) und Feldspiel (Raum, Manndeckung, Fastbreak). Wo das
   Ereignis der Inhalt ist, ist es bereits da (Bühne) oder wäre ein Gewinn (Arena: „ein Schlag
   nach dem anderen" statt Gewusel — genau Chris' TDM-Kritik).
9. **Der größte Hebel liegt in der Arena**, nicht in einer Umstellung des ganzen Spiels: dort
   trifft die schlechteste Rangtreue (TDM 0,25, Mini-DM 0,09, Battlefield 0,39 je Spiel, alle
   durchgefallen) auf die klarste Lesbarkeitskritik und auf ein Chassis, dessen Nahkampf
   ohnehin **vollständig deterministisch** ist (`:28810`: „kein rr()-Wurf im ganzen Kampf ausser
   Fernkampf-Streuung") — eine rundenbasierte Kampfauflösung würde dort wenig Kalibrierung
   zerstören und viel Lesbarkeit gewinnen.
10. **Das größte Risiko wäre eine Pauschalumstellung:** sie würde 13 bestandene Disziplinen
    (8 Bühne, 5 Bahn) neu kalibrieren müssen und die zuletzt gebauten Bewegungsmaschinen (sechs `step*()`-Ziele
    seit 10.09.) entwerten, ohne die Sonderpfad- und Z-Fehler zu berühren. Die Frage für Phase
    2 ist deshalb nicht „Echtzeit oder Runden", sondern **„Trennung von Simulation und
    Präsentation — ja oder nein, und in welcher Reihenfolge je Chassis"**.

---

## 1. Was das heutige Modell wirklich ist — nachgelesen, nicht vermutet

### 1.1 Der gemeinsame Rahmen: ein Fixstep-Motor an einer Wanduhr

Alle vier Chassis hängen an derselben Schleife (`:26852-26869`):

```js
function loop(ts){
  if(!last)last=ts;
  let dt=Math.min(.05,(ts-last)/1000);last=ts;        // Wanduhr, gedeckelt auf 50 ms
  if(running){
    acc+=dt*speed;                                       // Tempo 1x/2x/4x (:28426)
    const zf=zeitFaktor();                               // ZEIT_DEHNUNG je Disziplin (:26798)
    while(acc>=1/60){stepSim((1/60)/zf);acc-=1/60;}      // FESTE Schrittweite, geteilt durch zf
    floats.forEach(f=>{f.y-=42/60;f.life-=1.1/60;});     // Schwebetexte: je BILD, nicht je Tick
    ...
  }
  draw();
  requestAnimationFrame(loop);
}
```

Drei Eigenschaften, die für die ganze Frage tragen:

- **Die Simulation ist bereits diskret getaktet.** Kein Chassis rechnet mit dem echten
  Frame-`dt`; alle bekommen Sechzigstel. `stepSim()` verzweigt nur (`:20085-20088`):
  Feldspiel → `stepFeldspiel`, Bühne → `stepBuehne`, Bahn → `stepSpurt`, sonst Arena.
- **Wie viele Ticks bis zu einem Wanduhr-Zeitpunkt gelaufen sind, hängt an der Wanduhr.** Das
  ist die Quelle des Screenshot-Rauschens (Abschnitt 4.1), nicht die Simulation.
- **`ZEIT_DEHNUNG` ändert die Schrittweite, nicht die Zahl der Schritte je Bild.** Für Bahn und
  Arena heißt das: der sichtbare Lauf bekommt `1/60/zf` als `dt`, die Sonde bekommt `1/60`.
  Der Kommentar `:26786-26792` benennt die Folge selbst: „ein groesserer Faktor teilt den
  Simulationstick in kleinere dt-Schritte und verschiebt damit die GENAUE Abfolge der
  Zufallszuege (rr(), z.B. Wechselpatzer/Windschatten-Wechsel) leicht — dieselbe Saat, aber
  nicht mehr exakt dieselbe Tick-Zahl bis zum Ziel" (Staffel: 170,3 s statt 180 s). **Der
  sichtbare Lauf ist also heute bei Bahn und Arena nicht tick-identisch mit dem gemessenen.**

Die Rangtreue-Sonden umgehen die Schleife komplett. Jeder Motor meldet ein `lauf()` an, das
den eigenen Step mit festem Sechzigstel bis `done` treibt (Arena `:28678`, Bahn `:28921`,
Bühne `:29018`, Feldspiel `:29071-29072`); `draw()` wird dabei nie gerufen, `feed()` ist über
`stumm` abgeschaltet (`:26686`, `stepSimStumm` `:20025`). Das ist, nebenbei, bereits ein
vollständiger **deterministischer Headless-Modus** — nur ohne Bild.

Der Zufall ist ein einziger linearer Kongruenzgenerator mit globalem Zustand (`:18855`):
`seed=(seed*1664525+1013904223)>>>0`. Jeder zusätzliche oder fehlende `rr()`-Aufruf
verschiebt alles danach. Deshalb steht in jedem Bewegungs-Vertrag „niemals rr()"
(`:13826-13838`), und deshalb ist selbst eine längere Simulationspause nicht bit-identisch
(Basketball: `:6284-6285` „DENSELBEN Seed und DIESELBE Anzahl rr()-Aufrufe pro Tick";
`docs/design/hockey-ausdauer-checks-konzept-13-09.md` Abschnitt 6.3: 0,772 → 0,771 durch
Leerlauf-Ticks).

### 1.2 Bühne (9 Disziplinen): vorab gerechnet, getaktet enthüllt — im Kern bereits rundenbasiert

`bauBuehne()` (`:12896`) rechnet für jeden Teilnehmer **alle** `rundenN` Durchgänge in einer
Schleife durch (`:12982-12996`), bevor ein einziges Bild gezeichnet ist:

```js
for(let ri=0;ri<art.rundenN;ri++){
  ...
  if(rr()<erfolg){ punkte=basis+...; ereignis=art.erfolgWort; }
  else            { punkte=basis*art.failAbzug; ereignis=art.failWort; }
  L.runden.push({punkte,ereignis});
}
```

Der Code sagt es selbst (`:12960-12963`): „ALLE DURCHGAENGE SOFORT DURCHRECHNEN, dann ueber
die Zeit ENTHUeLLEN. Das haelt die Logik einfach — kein ‚wer ist als naechstes dran' ueber
mehrere Frames — und ist ehrlich: die Formkarte und der Disziplinwert stehen fest, bevor der
Auftritt beginnt." Auch die Ausnahmen bleiben vorab: Gewichtheben rechnet paarweise, aber
ebenfalls beim Bau (`baueHebenDuelle`, `:13009`); die Duell-Variante (Schach/I-Spy/Tennis/
Fechten) bildet aus den fertigen `runden[]` den Vorteilsverlauf (`:13028-13036`); Eiskunstlauf
fusioniert die fertigen Rundenpunkte 80/20 (`:13078-13093`).

Danach gibt es nur noch eine **Warteschlange**: `buehneQueue` — eine Liste von Teilnehmern in
Enthüllungsreihenfolge, gebaut je Variante (Duett: Startgruppen `:13128-13140`; Showcase: ein
Auftritt am Stück `:13156-13172`; generisch: Setzliste `:13177-13183`). `stepBuehne()`
(`:13694-13824`) tut je Tick genau das:

```js
buehneAkt-=dt;
if(buehneAkt<=0 && buehneZeiger<buehneQueue.length){
  const u=buehneQueue[buehneZeiger++]; u.aktuell++;
  const r=u.runden[u.aktuell];
  if(!BB().heben)u.summe+=r.punkte;
  u.lunge=0.5;                       // 0,5 s „Ausschlag" der Figur
  schwebe({...});  feed(...);        // Schwebetext + Ticker-Zeile
  buehneAkt=BB().rundenDauer;        // nächste Enthüllung in rundenDauer Sekunden
}
buehnenBewegung(dt);                 // NUR viz*, s. Vertrag :13826-13838
```

Das ist strukturell ein **Kampf-Log mit Auto-Advance**: ein Ereignis, ein kurzer Ausschlag, ein
Text, feste Wartezeit, nächstes Ereignis. Die Taktung ist auf ~60 s je Spiel ausgelegt: Schach
`rundenDauer:60/(10*6*2)` (`:12641`), Fechten `60/(9*6*2)` (`:12816`), Eiskunstlauf 12 × 12 ×
0,425 s (`:12532`), Showcase 12 × 5 × 1,0 s (`:12490`); Gewichtheben 72 Versuche × 1,55 s ×
`ZEIT_DEHNUNG` 4 ≈ 7,4 min (`:12437`, `:26839-26842`).

Was seit dem 10.09. dazugekommen ist, sind die **Bewegungsmaschinen** (`buehnenBewegung()`,
`:13839-13854`): `stepKuer` (Eiskunstlauf), `stepCypher` (Breaking), `stepHeben`, `stepSchach`,
`stepFechten`, `stepShowcase`. Sie schreiben ausschließlich `viz*`-Felder, nie `rr()`. Zwei
Bauarten sind darin sichtbar:

- **Clip-Automaten**, die an der Enthüllung hängen: `stepHeben()` (`:14596-14618`) schaltet
  `boden → antritt → zug → hoch/ablage → boden`, jede Phase eine Konstante mal `rundenDauer`,
  ausgelöst von `u.lunge===0.5` (dem Enthüllungsmoment). Das ist exakt das, was ein
  JRPG-Kampf-Log tut — nur ohne Weiterklick.
- **Kontinuierliche Zierde**, die unabhängig von der Enthüllung läuft: die
  Lissajous-Grundfahrt der Eiskunstläufer (`:13878-13888`), das Cypher-Kreisen, die
  Fokus-Regie im Schach (alle 3 s ein anderes Brett, `:14636`).

**Befund:** Die Bühne ist in der Ergebnislogik vollständig rundenbasiert und in der
Präsentation ein Auto-Advance-Log mit optionaler kontinuierlicher Zierde. „Rundenbasiert
machen" kann hier nur noch zwei Dinge heißen: die Zierde weglassen (R1) oder einen Weiterklick
einführen (R2 manuell). Beides ist eine Detailentscheidung, kein Modellwechsel.

### 1.3 Feldspiel (3 Disziplinen): zwei Motoren, der lebende ist der einzige mit Nutzer

`stepFeldspiel()` (`:11455-11494`) verzweigt in der ersten Zeile: `if(LIVE())return
stepFeldspielLive(dt);`. Der Rest der Funktion ist der **Vorab-Pfad**: `fsZuege` ist eine
vorgerechnete Zugliste, `fsAkt`/`zugDauer` takten die Enthüllung, `fsLerpPositionen()`
(`:11405-11453`) interpoliert die Spieler zwischen Formationsslots und Aktivpositionen und
zeichnet Ballbögen aus einer `phase`-Variablen. Das ist die Bühne mit Raumkoordinaten —
rundenbasiert plus Interpolation.

Er hat aber **heute keine Disziplin mehr**: alle drei `FELDSPIEL_ART`-Einträge tragen einen
`live:{...}`-Block (Basketball `:5460`, Football `:5511`, Hockey `:5866`). Der Kommentar bei
`MOTOREN[fd]` (`:29045-29047`, „fuer die drei Vorab-Disziplinen") ist überholt — Tennis ist
auf die Bühne gezogen, Football/Hockey auf den Live-Motor.

Der **Live-Pfad** (`stepFeldspielLive()`, `:11012` ff.) ist eine echte Tick-Simulation:
Positionen aus `bewegeSpielerLive(dt)`, Ballaktionen aus `entscheideBallaktion()`, Steals,
Rebounds, Manndeckung, Fastbreak, Freiwürfe, Perioden. Der Zufall ist hier **ereignisbasiert**,
nicht tickbasiert — 86 `rr()`-Stellen im Feldspiel-Bereich, z. B. `:9340`
(`suchtPass=...rr()<Math.min(0.35,...)`), gezogen wenn eine Entscheidung ansteht, nicht in jedem
Sechzigstel. Das Ergebnis entsteht **im Lauf**; `fsBisher()` (`:7057`) zeigt deshalb „den
enthüllten Spielstand, nicht das vorab durchgerechnete Endergebnis" — beim Live-Motor gibt es
kein vorab durchgerechnetes.

Bemerkenswert für die Frage: Der Live-Motor hält die Uhr bei Freiwürfen und Viertelpausen
bewusst an (`:11055-11064`, `:11071-11076`), weil „die Boxscore-Kalibrierung an der Zahl der
Possessions hängt; ein Sichtbarkeits-Umbau darf sie nicht verschieben". Das Chassis hat also
schon Standphasen eingebaut, die wie Runden wirken — eine **Hybridform**, in der die
Präsentation Zeit anhalten darf, solange sie dabei keinen Tick verbraucht.

Historisch wichtig: Football lief erst über den Vorab-Pfad und stand dort bei rho 0,345/0,699;
auf dem Live-Motor bei 0,516/0,811 (`docs/design/stand-aller-disziplinen.md:299`). Der Wechsel
von „vorab" auf „live" hat die Rangtreue **verbessert**, nicht verschlechtert. Wer das
Feldspiel zurück in Runden bringt, kehrt zu einem Motor zurück, der schlechter gemessen war.

### 1.4 Bahn (5 Disziplinen): durchgehende Physik, das Ergebnis ist der Zieleinlauf

`stepSpurt()` (`:24774` ff.) ist die Funktion, die am wenigsten nach „Runde" aussieht:

```js
if(wunsch!=null && rr()<(0.25+u.WENDIGKEIT*0.009)*dt*3){ ... Bahnwechsel ... }   // :24846
u.v=tempoVon(u);
u.pos+=u.v*dt/strecke;                                                          // :24853
let zehr=(0.55+ueber*ueber*1.9)*(u.imSchatten?SCHATTEN_SPAREN:1);               // Kraftverbrauch je Tick
```

Zufallschancen **pro Tick, mit `dt` skaliert**, Windschatten aus der momentanen Geometrie,
Kraftbudget als Integral. 34 `rr()`-Stellen im Bahn-Bereich, keine davon vorab. `bauSpurt()`
(`:24204`) baut Läufer und Kurs, rechnet aber kein Ergebnis — das steht erst, wenn `u.fertig`
gesetzt ist. Die Staffel hat Wechselzonen mit `u.aktiv`, das Zeitfahren gestaffelte Starts
(`:24801`), Takeshi's Castle Fallen mit Nerven-Regeneration je Tick (`:24812`).

Die Zuschau-Zeit ist hier am stärksten gedehnt: Spurt `ZEIT_DEHNUNG` 11,14, Staffel 14,65,
Zeitfahren/Climbing 4,38 (`:26799-26800`). Und der Grund steht daneben, von Chris (`:26750`):
„spurt sollte ca 3 minuten dauern damit man sich das auch in ruhe angucken kann und kleine
unterschiede erkennt". Ein 100-m-Lauf in drei Minuten — das ist Zeitlupe als bewusste
Zuschau-Entscheidung, und sie setzt kontinuierliche Bewegung voraus. Kleine Unterschiede
zwischen nebeneinander laufenden Figuren sind genau das, was diskrete Zustände nicht zeigen.

### 1.5 Arena (3 Disziplinen): deterministische Echtzeit-Physik mit Formation

`stepSim()` (`:20085` ff.) für TDM/Mini-DM/Battlefield ist eine `dt`-Physik: Formationen,
Flankenfreigabe nach Zeit (`:20117-20126`), Rückzug mit Abklingzeit, Ermüdung ab 35 s
(`:20149`), Schild-/Stun-/Wurzel-Timer, Grundschlag sobald `inRange&&u.cd<=0` (`:20536-20539`),
Ende bei einer überlebenden Seite oder `t>95` (`:20559`).

Und — der überraschende Befund dieser Lektüre — sie ist **fast ohne Zufall**. Im gesamten
Arena-Bereich (`:18962-24204`) gibt es genau zwei `rr()`-Aufrufe im Kampf, beide für die
Streuung von Fernkampf-Geschossen (`:19688`, `:19951`), plus eine einmalige Ecken-Lotterie beim
Bau der Mini-DM-Runde (`:28826`). Der Code sagt es an dieser Stelle selbst (`:28810`): „Nahkampf
hier ist VOLLSTAENDIG deterministisch — kein rr()-Wurf im ganzen Kampf ausser
Fernkampf-Streuung". Wer trifft, wie viel Schaden, wer fällt — alles folgt aus Werten, Abstand
und Abklingzeiten.

Die Arena ist außerdem das einzige Chassis mit **Echtzeit-Interaktion**: die Zielansage
(`KFOKUS`, `verdrahteZielansage()` `:27938`), deren Sperre ausdrücklich „in KAMPFZEIT, nicht in
Echtzeit" läuft (`:20092-20094`), damit das Tempo 1x/2x/4x nicht heimlich mehr Eingriffe
erlaubt.

Rangtreue (kaderfest, `docs/design/stand-aller-disziplinen.md:231-233`): Battlefield 0,387,
TDM 0,253, Mini-DM 0,094 je Spiel — die drei schlechtesten Werte im ganzen Feld, alle
durchgefallen, und das seit Wochen trotz mehrerer Rezeptrunden (`:28614-28671` erzählt die
Geschichte). Chris' Kritik vom 13.09. (`:4576-4578`) zielt nicht auf die Zahl, sondern auf das
Bild: die Charaktere „suchen sich anscheinend einen Gegner und hauen drauf", es fehle „ne
Dynamik". PR #912 hat darauf mit dynamischer Zielwahl geantwortet — innerhalb desselben
Zeitmodells.

### 1.6 Zusammenfassung je Chassis

| | Bühne (9) | Feldspiel live (3) | Bahn (5) | Arena (3) |
|---|---|---|---|---|
| Ergebnis steht fest… | beim Bau (`bauBuehne`) | erst am Ende | erst am Ende | erst am Ende |
| Zufall | vorab, je Durchgang | im Lauf, je Entscheidung (86 Stellen) | im Lauf, je Tick × dt (34 Stellen) | praktisch keiner (2 Stellen, Fernkampf) |
| Was `dt` bewegt | nur die Enthüllungsuhr + viz* | Positionen, Uhren, Entscheidungen | Position, Kraft, Windschatten | Position, Abklingzeiten, Ermüdung |
| Enthüllung | Queue + `rundenDauer` (Auto-Advance) | kontinuierlich | kontinuierlich | kontinuierlich |
| Interpolation | `lunge` 0,5 s + Clip-Automaten + Zierde | `bewegeSpielerLive` | Sprite-Schritt `vizSchritt` + Kamera | `lunge`/`dodge`-Versatz |
| Sichtbarer Lauf = Sonde? | ja (rundenDauer ist nur ein Zeitwert) | Basketball ja (zf 1), Hockey nein (zf 2) | nein (zf 2,2–14,7) | nein (zf 1,6–5,0) |
| „Rundenbasiert" heute | **Logik: ja. Präsentation: Auto-Advance-Log** | nein (Standphasen als Ausnahme) | nein | nein |
| Rangtreue-Stand | 8 von 9 bestanden (I-Spy nicht) | Basketball knapp, Hockey/Football unter 0,80 | 4 von 5 bestanden, Climbing seit 16.09. auch | 0 von 3 |

### 1.7 Die Etage darüber: Produktion rechnet headless, die App zeigt einen anderen Lauf

`lib/battle/arena-headless-runner.ts` startet Chromium, lädt dieselbe Engine und ruft
`window.__arena.spieleFeldspiel(fd, saat)` bzw. `spieleBuehneHeben`/`spieleBuehneDuell`/… auf
(`:29650-29663`): `M.bau(saat); M.lauf(); M.wert()` — festes 1/60, ohne `draw()`, ohne Ton,
ohne Wanduhr. Das Ergebnis geht als Teampunkte und Boxscore in `SeasonState`
(`arena-matchday-resolve-service.ts`, `arenaMatchSeed`).

Der sichtbare Lauf in der App (`FoundationBattleArenaHost.tsx`) bekommt über
`window.__olyArenaKader` Kader, Aufstellung und Anzeige-Meta (`:327-350`) — **keine Saat**.
Chris klickt „Kampf starten" (`battle-mode.html:230`) und sieht einen Lauf mit der
Motor-Vorgabe-Saat, in der Wanduhr-Schleife, mit `ZEIT_DEHNUNG`. Für Bahn und Arena ist das
selbst bei gleicher Saat nicht der gebuchte Lauf (Abschnitt 1.1).

Das ist kein Fehler dieser Runde, sondern der Stand des Battle-Mode-Plans („der Host selbst
bleibt reiner Zuschau-Modus", `docs/design/battle-mode-spielmodus-plan.md:108`). Für die Frage
hier ist es aber die wichtigste Tatsache: **Ergebnis und Präsentation sind auf Produktionsebene
bereits getrennt** — nur ist die Präsentation heute eine Re-Simulation statt eines Replays.
Genau in dieser Lücke liegt der Gestaltungsraum, den Abschnitt 2 als Variante R4 beschreibt.

---

## 2. Was „rundenbasiert" hier konkret heißen kann — fünf Varianten auf zwei Achsen

Damit Phase 2 weiß, worüber sie entscheidet: „rundenbasiert" mischt zwei unabhängige Fragen.

- **Achse A — wo entsteht das Ergebnis?** Vorab (Bühne) oder emergent im Lauf (die anderen
  drei). Eine Änderung hier ist eine **Motoränderung** und berührt `wert()`/`rr()`/Rangtreue.
- **Achse B — wie wird enthüllt?** Kontinuierlich interpoliert, in diskreten Clips, oder als
  Standbild + Text. Eine Änderung hier ist eine **Präsentationsänderung** — und das ist, was
  Chris mit „würde Animationen vereinfachen" meint.

| Variante | Achse A | Achse B | Was es ist | Wo es heute schon so ist |
|---|---|---|---|---|
| **R0 — Status quo** | je Chassis | kontinuierlich, Wanduhr-gekoppelt | s. Abschnitt 1 | überall |
| **R1 — Ticker-/Boxscore-Enthüllung** | unverändert | Standbild je Zustand, Textzeile, fester Takt, **keine** Zwischeninterpolation | Der Feed (`feed()`, `:26685`) wird zum Hauptbild; die Figuren stehen, springen von Pose zu Pose | Bühne ohne `buehnenBewegung()` (Zustand vor dem 10.09.); Wertungstabelle |
| **R2 — Kampf-Log / JRPG-Clip** | unverändert | ein Ereignis → ein in sich geschlossener Clip fester Länge → nächstes; Auto-Advance, optional Pause/Schritt | Kein Weltzustand zwischen Clips; jede Animation hat Anfang und Ende | `stepHeben()` ist genau das (`:14596-14618`); `stepBuehne()` ist der Taktgeber |
| **R3 — rundenbasierte Simulation** | **geändert**: der Motor rechnet in diskreten Runden (Initiative/Zug in der Arena, Streckenabschnitte auf der Bahn, Ballbesitz-Runden im Feldspiel) | frei wählbar | Ein neuer Motor je Chassis mit Neukalibrierung | Bühne (bereits); alter Feldspiel-Vorab-Pfad (`fsZuege`, ohne Nutzer) |
| **R4 — Ereignisprotokoll + Abspieler** | unverändert (headless zu Ende gerechnet, wie in Produktion) | **beliebig**: Echtzeit-Replay (heutiges Bild), Highlights-Modus, Clip-Modus, Schritt-für-Schritt | Simulation schreibt Ereignisse mit Zeitstempel und Positionen; die Präsentation liest nur | In Ansätzen: `feed()`-Aufrufe, `HIGHLIGHTS[]` (`:26710`), `fsZuege`, `u.runden[]`, `sichern()/zurueck()` |

Zwei Bemerkungen zur Ordnung:

1. **R1 und R2 sind für die Bühne Detailvarianten des Bestehenden**, für Bahn/Feldspiel/Arena
   dagegen setzen sie voraus, dass es überhaupt diskrete „Ereignisse" gibt, aus denen Clips
   gebaut werden — und die gibt es dort heute nur teilweise (Feed-Zeilen, `big`-Ereignisse),
   nicht als vollständige Zustandsfolge. R1/R2 für diese Chassis **implizieren R4** als
   Unterbau oder R3 als Motorwechsel.
2. **Weiterklick ist keine ernsthafte Option, Auto-Advance ist Pflicht.** Die Mengen: 160
   Partien je Saison (`battle-mode-gameplay-grundmodell.md`), 144 Enthüllungen je
   Eiskunstlauf, 120 je Schach, 72 Versuche je Gewichtheben. Ein manueller Schritt ist als
   Pause/Einzelschritt sinnvoll, nie als Grundmodus. Die Frage „Weiterklick" reduziert sich
   damit auf: Gibt es einen Pause-Knopf, der zwischen zwei Clips hält (heute: `running` hält
   mitten im Tick, `:26855`).

Eine dritte Achse liegt quer dazu und ist unabhängig vom Zeitmodell: die **Zuschau-Dosierung**
(Football Manager: Key Highlights / Extended / Full; `battle-mode-gameplay-grundmodell.md:22`,
`:96`). Sie ist mit R4 fast gratis (Protokoll filtern), mit R0 teuer (man müsste die Simulation
vorspulen und an den richtigen Stellen anhalten).

---

## 3. Je Archetyp: was man gewinnt, was man verliert

### 3.1 Bühne — schon dort; der Umstieg wäre ein Rückbau

**Gewinn eines Umstiegs auf R1/R2:** gering. Die Enthüllungslogik ist bereits ein
Auto-Advance-Log; die Clip-Automaten (`stepHeben`, Schach-Zug-Gleiten `:14646`,
Fechten-Phasen) sind bereits Clips. Was R1 wegnähme, ist die kontinuierliche Zierde (Lissajous-
Fahrt, Cypher-Kreis, Rampenlicht-Wanderung) — und die ist rangtreue-neutral, im `viz*`-Vertrag
gebaut und seit 10.09. in sechs PRs abgenommen (`opus-plan-feinschliff-vier-disziplinen-09-10.md`
und Folgende).

**Was R1 tatsächlich einbringen würde:** deterministischere Bilder (ohne Zierde gibt es
zwischen zwei Enthüllungen nichts, das sich bewegt) und weniger Zeichencode. Beides ist
Entwickler-Nutzen. Der Zuschauer-Effekt wäre der Zustand vor dem 10.09. — den Chris am 24.08.
als „nur Rumstehen" beschrieben hat (`docs/ARENA_INTERAKTION_KONZEPT.md`, Kopf). Das ist ein
gemessener Rückschritt in Chris' eigener Rückmeldung.

**Wo Chris' Bühnen-Kritik wirklich lag** (13.09., Eiskunstlauf): „alle gleichzeitig" und
„keine Indikation, wer sich besser schlägt". Die Antwort war **Regie** (Spotlight, eine Gruppe
im Bild, Zwischenstand), nicht Diskretisierung — und sie hat funktioniert, ohne das Zeitmodell
anzufassen (`eiskunstlauf-startreihenfolge-spotlight-recherche-13-09.md`). Für die Bühne gilt
deshalb: der Hebel ist Regie und Spannungsbogen (Gewichtheben-Recherche 13.09.: „Verlässlichkeit
runter, und genau das ist Spannung als Zahl"), nicht das Zeitmodell.

**Was die Bühne von R4 hätte:** Sie ist der einfachste Kandidat, weil `u.runden[]` +
`buehneQueue` **schon ein Protokoll sind**. Ein Abspieler, der daraus Clips macht, ist fast nur
Umbenennung — und dann liefe `buehnenBewegung()` nicht mehr in der Sonde mit, womit die
bit-identische Nachmessung für jede Bühnen-Präsentations-PR entfiele.

### 3.2 Feldspiel — Raum ist der Inhalt; Runden nehmen ihn weg

**R3 (Possession-Runden als Motor)** ist der alte Vorab-Pfad — mit schlechterer Rangtreue
(Football 0,345 → 0,516 durch den Wechsel auf live) und ohne die Mechaniken, die seither
gebaut wurden (Manndeckung, Fastbreak, Zonen, Bodychecks, Strafen, Torwart, Down/Distance).
Basketball ist zudem die **einzige Disziplin im echten Spielstand** mit eigenem
Boxscore-Impact. Ein Motorwechsel hier wäre der teuerste des ganzen Projekts.

**R2 (Clips über dem Live-Motor)** verliert Raumkontext: ein Steal ist nur lesbar, wenn man
sieht, wo der Passweg war; ein Fastbreak nur, wenn man die Lücke sieht. Clip-Präsentation
funktioniert im Feldspiel als **Highlight-Schnitt** (das ist, was Fernsehen tut), nicht als
Grundmodus.

**Was das Feldspiel gewinnen würde, ist R4 in der Ausprägung „Highlights-Modus"**: bei 8
Minuten Hockey-Zuschauzeit (`:26828`) und 160 Partien je Saison ist die Dosierung die eigentliche
Spaßfrage — „nicht die Länge einer Partie langweilt, sondern Totzeit vor Ereignissen"
(Grundmodell, FM-Vorbild). Die `big`-Ereignisse (Tor, Touchdown, Sack, Interception, K.o.) sind
bereits markiert (`broadcast-praesentation-uebergreifend-recherche-06-09.md` Abschnitt 4); was
fehlt, ist ein Protokoll mit Positionen, um von Ereignis zu Ereignis springen zu können.

**Ein ehrlicher Nebenbefund:** Der Live-Motor hält heute schon die Uhr an, wenn er etwas
zeigen will (Freiwurf, Viertelpause). Das ist die richtige Naht für „Standphasen als
Mini-Runden" — und sie ist schon da.

### 3.3 Bahn — kontinuierlich ist das Genre; kein Hebel

Ein Rennen in Runden (Streckenabschnitte, Zwischenzeiten als Zustände) wäre eine Wertungstafel,
kein Rennen. Chris hat für Spurt ausdrücklich das Gegenteil bestellt (drei Minuten, „kleine
Unterschiede erkennen"), und die Staffel bekam dafür ein Oval mit Broadcast-HUD
(`staffel-oval-broadcast-hud-recherche-06-09.md`). Die Zwischenzeiten-Tafel des Zeitfahrens
(`time-trial-einzelzeitfahren-wertung-plan-05-09.md`) ist bereits die diskrete Ergänzung, die
ein Rennen verträgt: „wenn es jetzt so bliebe — wer führt, und wie knapp?"

**R3 hier** hieße fünf Disziplinen neu kalibrieren, von denen vier seit Wochen über 0,80 stehen
(Staffel 0,915, Takeshi 0,883, Spurt 0,894, Time-Trial 0,828) und Climbing seit 16.09. auch
(0,834). Das ist reines Risiko ohne Zuschauer-Nutzen.

**Was die Bahn von einer Trennung (R4) hätte:** der sichtbare Lauf würde endlich der gebuchte
Lauf (heute nicht, s. 1.1 — `ZEIT_DEHNUNG` 11–15 teilt die Ticks anders), und die Kamera-/
Silhouetten-Interpolation, die im Screenshot rauscht, wäre ein Abspieler-Detail statt ein
Sonden-Mitläufer.

### 3.4 Arena — der eine Ort, an dem ein Rundenmotor ernsthaft attraktiv ist

Drei Dinge treffen hier zusammen, die sonst nirgends zusammentreffen:

1. **Die Rangtreue ist ohnehin nicht da.** 0,25/0,09/0,39 nach mehreren Rezeptrunden; der
   Kommentar `:28614-28671` dokumentiert, dass der Anteil-Maßstab Battlefield und Fechten
   (damals noch Arena) gerettet hat, TDM aber „offen für eine naechste Runde" blieb. Fechten
   selbst ist auf die Bühne gezogen und dort von 0,153 auf 0,826 gestiegen — ein Präzedenzfall
   dafür, dass ein diskretes Modell für eine Kampfdisziplin **besser** messen kann.
2. **Der Nahkampf ist bereits deterministisch** (`:28810`). Ein Rundenmotor (Initiative aus
   einem Wert, eine Aktion je Einheit je Runde, Zielwahl aus `PERSZIEL`/`:4560-4564`, Schaden
   aus denselben Kampfwerten) würde keine über Monate gefittete Zufallsstruktur zerstören —
   es gibt keine.
3. **Chris' Kritik ist eine Lesbarkeitskritik**: „hauen drauf", „keine Dynamik". Ein
   Kampf-Log, in dem man sieht „Bollwerk deckt, Schleicher geht hinten rum, Heiler zieht
   Duellant hoch", ist genau das Bild, das er vermisst — und das der Auto-Chess-/JRPG-Ansatz
   von Haus aus liefert. Das Roguelike-Skill-Pool-Konzept (`roguelike-skill-pool-konzept-17-09.md`,
   „für später") würde auf einem Rundenmotor ebenfalls leichter lesbar.

**Was man verlieren würde:** die Zielansage als Echtzeit-Eingriff (sie würde zur Ansage je
Runde — das passt eher besser, und die Kampfzeit-Sperre `:20092` wäre dann eine Rundensperre),
das Formations-Gedränge als Bild (Flanke, Reihenanker `:20128-20145`) und drei Wochen
Zielwahl-/Formationscode (PR #912). Und: eine Neukalibrierung von drei Disziplinen, die dann
allerdings erstmals eine Chance auf 0,80 hätte.

**Ehrliche Gegenrechnung:** Auch ein Rundenmotor kann eine schlechte Rangtreue haben, wenn die
Rezepte falsch sind — Fechtens Sprung kam vor allem aus der Bühnen-Punkteformel, nicht aus
„diskret". Und 6-gegen-6 mit Skills sind je Runde 12 Aktionen; bei 10–15 Runden 120–180 Clips.
Das ist die Eiskunstlauf-Größenordnung (144) und braucht dieselbe Regie (Fokus auf das Duell,
das gerade zählt), sonst wird es ein schnelles Log statt eines Kampfes.

---

## 4. Die vier Schmerzpunkte, ehrlich gegengerechnet

### 4.1 Screenshot-Rauschen — kein Echtzeit-Problem, ein Wanduhr-Problem

Der Befund ist in drei Dokumenten gleich beschrieben (`climbing-wand-17-09.md:160-173`,
`showcase-s2-sechs-acts-17-09.md:163-173`,
`gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md:70-71`): zwei Läufe desselben Codes
liefern verschiedene Pixel; Score, Positionen und Text sind identisch, nur die kontinuierliche
Partikel-/Ring-/Kamera-Animation ist phasenverschoben; Ursache „Phase bei exakt ‚1500 ms nach
Klick' hängt von der tatsächlichen Browser-Frame-Taktung ab". Die Screenshot-Skripte tun genau
das (`scripts/screenshot-disziplin.mjs:49`: `waitForTimeout(wartenMs)`).

Die Ursachen im Code sind benennbar:

- `loop()` zählt Ticks aus der Wanduhr (`acc+=dt*speed`): Wie viele Sechzigstel bis 1500 ms
  gelaufen sind, streut um ±1–2 Ticks.
- Schwebetexte laufen **je Bild**, nicht je Tick (`:26859`).
- Drei Stellen lesen `performance.now()` direkt: Viertelpausen-Overlay (`:11578`,
  bewusst „Wandzeit"), Ton-Mindestabstand (`:21687`), Fackel-Bildindex (`:21797`).

Was das für die Varianten heißt:

| | R1 (Standbild) | R2 (Clips) | R3 (Rundenmotor) | R4 (Protokoll) | gezielter Fix im Status quo |
|---|---|---|---|---|---|
| Rauschen weg? | ja, zwischen Enthüllungen — aber jede Enthüllung liegt immer noch „irgendwo" in den 1500 ms | nein, innerhalb eines Clips dasselbe Problem, solange Clips an der Wanduhr hängen | nein, wenn die Präsentation Wanduhr bleibt | **ja per Konstruktion**, sobald das Skript „Ereignis k, Clip-Zeit x" statt „1500 ms" anspringt | **ja**: Sonden-Modus, der N Ticks fest fährt und dann genau einmal `draw()` ruft — `lauf()` + `draw()` sind vorhanden; dazu `performance.now()` durch Simulationszeit ersetzen |

Der gezielte Fix ist klein und unabhängig von der großen Frage. Er würde auch die
Baseline-vs-Baseline-Kontrollmessungen überflüssig machen, die heute jede Sicht-QA
begleiten.

### 4.2 Vollbild-/reiherMech-Sonderpfade — Zeichenpfad, nicht Zeitmodell

`zeichneSprite()` (`:2927`) kehrt für `b.reiherMech` (`:3359`) und `b.vollbild` (`:3398`) früh
zurück; alles, was danach im Normalpfad gezeichnet wird (Waffen, Requisiten, Effekte), sehen
diese Blätter nicht. Der Hantel-Fund (`:2936-2944`: „5 von 17 Figuren … stemmt genau ein Heber
Luft") und die Showcase-Einschränkungen („Vorrak — kein Bogen sichtbar", „Terradon — kein
Schwert", `showcase-s2-sechs-acts-17-09.md`) sind derselbe Fehlertyp; der Hockeyschläger
brauchte dafür eine eigene Runde (`vollbild-schlaeger-griffpunkte.md`).

**In einem Rundenmodell existiert dieser Fehler wortgleich.** Ein Clip zeichnet dieselbe Figur
mit derselben Requisite über denselben Zeichenpfad; ob der Frame 1 von 60 oder 1 von 3 ist,
ändert nichts daran, dass der Vollbild-Zweig die Requisite nicht kennt. Was hilft, ist die
Lösung, die am 13.09. für die Hantel begonnen wurde: den Requisiten-Aufruf **vor** die Weiche
ziehen (`hantelAnPunkt`, `:2975-2980`) bzw. eine Requisiten-Tabelle, die jeder Zweig liest
(`DISZIPLIN_PROP`). Das ist eine Refactoring-Frage an `zeichneSprite()`, keine an der Uhr.

Ein einziges indirektes Argument für weniger Frames: weniger **Phasen** je Requisite (Hantel
kennt vier, Schläger drei) sind weniger Stellen, an denen ein Zweig etwas vergessen kann. Das
ist ein Argument für einfachere Clips, nicht für Runden.

### 4.3 Z-Skalierungs-Drift — Geometrie, nicht Zeitmodell

„Ohne Z-Skalierung driftet die Requisite 5–10 px je Figurgröße"
(`opus-plan-top-zehn-ueber-90-16-09.md:433`; `gesamtstand…:1149`). Die Größenformel steht in
einer Zeile (`:2935`: `Z=groesseFaktor(u.groesse)*hoehenKorrektur(u)*bauSkala(b)`), und wer
sie bei einem neuen Versatz vergisst, driftet — in jedem Zeitmodell. Der schwerste Fund dieser
Klasse (`hoehenkorrektur-rekursion-13-09.md`: die Höhenkorrektur „hat sich selbst gemessen",
Stapelüberlauf, Wert hing an der Parität der Überlauftiefe) hatte ebenfalls nichts mit Zeit zu
tun. Strukturelle Abhilfe: alle Versätze in Zellkoordinaten des 64er-Rahmens und **eine**
Umrechnung — das ist der Weg, den `showcaseZ(u)` (`showcase-s2…:86`) und die Körperspanne
(`:2964-2980`) schon gehen.

### 4.4 Verifikationsaufwand je PR — real, und die Ursache ist die fehlende Trennung

Heute muss jede Präsentations-PR (a) `node scripts/miss-alle-disziplinen.mjs 24` bit-identisch
nachmessen, (b) eine Sicht-Review liefern, (c) oft eine zweite Runde wegen 4.2/4.3 drehen. Die
Rangtreue-Messung ist nötig, **weil die Präsentation in der Sonde mitläuft**:
`buehnenBewegung()` wird von `stepBuehne()` gerufen, das die Sonde treibt; `fsLerpPositionen`,
`bewegeSpielerLive`, `bahnBewegung` ebenso. Der `viz*`-Vertrag ist eine Konvention, keine
Struktur — deshalb heißt es im Code „die Rangtreue-Neutralitaet ist deshalb keine Hoeflichkeit,
sondern Bedingung" (`:13837-13838`), und deshalb muss man sie jedes Mal beweisen.

- **R1/R2 ändern daran nichts**, solange Clips im selben Tick-Prozess laufen.
- **R3 verschärft es** (neuer Motor = neue Basislinie für jede Disziplin).
- **R4 beseitigt es**: Was ein Abspieler aus einem Protokoll macht, kann keinen `rr()`-Zug
  verschieben, weil der Motor längst fertig ist. Die bit-identische Messung würde nur noch bei
  Motor-PRs gebraucht — und das ist, wo sie hingehört.

Der Preis von R4 ist ein Protokollformat je Chassis (Bühne: gibt es praktisch; Feldspiel/Bahn/
Arena: Positionen und Zustände je Tick oder je Ereignis, d. h. Datenmenge und ein
Interpolations-Abspieler) und die Umstellung des Hosts auf „Replay des gebuchten Laufs" statt
„zweiter Lauf". Letzteres ist ohnehin ein offener Punkt (Abschnitt 1.7).

---

## 5. Der Zuschauer-Spaß — was Auto-Battler beim Zusehen tragen, und wie beide Modelle dazu stehen

Fünf Dinge tragen einen Auto-Battler beim Zuschauen (aus den Recherchen dieses Repos und den
Vorbildern, die dort zitiert werden: Football Manager, TFT/Auto Chess, ZenGM, Eslabong):

1. **Lesbarkeit** — wer tut gerade was, und warum. Bei 12 Akteuren die schwerste Anforderung.
2. **Spannungsbogen** — Ungewissheit bis zum Schluss, Führungswechsel, ein Ende, das nicht in
   der ersten Minute feststeht (Gewichtheben-Recherche 13.09.: „in engen Duellen gewinnt der
   Führende nach Versuch 1 nur 56,3 %, Führungswechsel 59,8 % — diese Duelle sind bereits
   spannend").
3. **Kausalität** — man versteht, warum der Star gewinnt. Das ist die Rangtreue als
   Spaßgröße: Chris will, dass „ein Star in den meisten Einzelspielen auch tatsächlich oben
   steht" (Grundmodell, Korrektur-Absatz). Ein Auto-Battler ohne Kausalität ist eine Lotterie.
4. **Dosierung/Tempo** — keine Totzeit, aber Zeit zum Hinsehen. Chris' Tempo-Wünsche gingen
   bislang **alle** Richtung langsamer (Basketball 1,5-Minuten-Viertel, Hockey Faktor 2,
   Gewichtheben Faktor 4, Spurt 3 Minuten).
5. **Broadcast-Rahmung** — Bug, Uhr, Callouts, Ton, Einlauf, Endstand-Rückblick
   (`broadcast-praesentation-uebergreifend-recherche-06-09.md`: „kein Motorproblem, ein
   Kompositionsproblem").

Wie die Modelle dazu stehen — nicht aus Entwicklersicht:

| | Echtzeit-Fluss (R0/R4-Replay) | diskrete Enthüllung (R1/R2) |
|---|---|---|
| Lesbarkeit bei vielen Akteuren | schwach ohne Regie (Chris 13.09.: „alle gleichzeitig") — Regie (Spotlight, Fokusbrett, Kamera) hat es behoben, ohne das Modell zu ändern | stark: einer handelt, alle sehen hin. Verliert Raumbezug (wer stand wo, warum ging der Pass nicht) |
| Spannungsbogen | trägt über Bewegung (Aufholjagd sichtbar, Windschatten, Vorsprung schmilzt) — Staffel/Zeitfahren leben davon | trägt über Zwischenstände und Beats („Periode beendet", „Brett entschieden" — Fechten/Schach haben genau das bekommen) |
| Kausalität | oft implizit (man sieht, dass der Schnellere vorn ist) | oft explizit (Text: „trifft — +48, Durchgang 3/9") — gut für Manager, die Zahlen lesen |
| Tempo | dehnbar per Faktor; Gefahr „hektisch" ODER „zäh" je Disziplin | per Takt exakt steuerbar; Gefahr „Log rattert durch" (144 Enthüllungen à 0,4 s) |
| Broadcast-Gefühl | hoch — Kamera, Bewegung, Live-Uhr sind das Fernsehbild | mittel — eher Radio/Ticker; Fechten/Schach/Gewichtheben zeigen, dass es mit Bühnenbild und Regie trotzdem trägt |
| Passt zu… | Rennen, Feldspiel, alles Räumliche | Auftritte, Versuche, Duelle, Kämpfe mit Initiative |

**Die ehrliche Einordnung:** Beide Modelle können beim Zuschauen Spaß machen; das Repo hat für
beide Belege (Staffel-Oval auf der einen, Gewichtheben/Fechten/Schach auf der anderen Seite).
Was beim Zuschauen **nicht** funktioniert, ist unabhängig vom Modell: alle gleichzeitig ohne
Fokus, ein Ergebnis, das nach dem ersten Ereignis feststeht, und Figuren, die nichts tun. Chris'
Kritikpunkte der letzten Wochen sind alle von dieser Art — und alle wurden **innerhalb** des
jeweiligen Modells adressiert (Spotlight, Startreihenfolge, Perioden-Beats, Zielwahl, mehr
Führungswechsel im Heben). Das spricht dafür, dass „Flow und Animationen laufen nicht gut" bisher
nicht am Zeitmodell lag, sondern an Regie, Spannungsbogen und an den Zeichenpfad-Fehlern aus
Abschnitt 4.

**Wo das Zeitmodell selbst den Spaß begrenzt**, ist die Arena: dort ist das Gewusel nicht mit
Regie zu heilen, weil zwölf Figuren gleichzeitig zuschlagen — es gibt keinen „einen, der gerade
dran ist", auf den eine Kamera zeigen könnte. Genau das würde ein Rundenmotor liefern.

---

## 6. Rezept-/Rangtreue-Risiko: was CLAUDE.md's Kernregel für jede Variante bedeutet

Die Regel: Präsentation darf `wert()`/`rr()`/die Ergebnislogik nicht anfassen; Abnahme ist rho
je Spiel über 0,80, kaderfest, bit-identisch nachgemessen.

| Variante | Motor angefasst? | rho-neutral… | Nachmessung nötig? | Bemerkung |
|---|---|---|---|---|
| R0 (heute) | nein | per Konvention (`viz*`-Vertrag) | **jede Präsentations-PR** | Sichtbarer Lauf ≠ Sonden-Lauf bei Bahn/Arena/Hockey (`ZEIT_DEHNUNG`) |
| R1/R2 | nein | per Konvention | jede Präsentations-PR | gleich gut oder gleich schlecht wie heute; nichts wird leichter |
| R3 | **ja** | — | neue Basislinie je Disziplin | Bahn/Feldspiel: hohes Risiko bei bestandenen Disziplinen; Arena: kaum etwas zu verlieren |
| R4 | nein | **per Konstruktion** | nur Motor-PRs | Präsentation kann den Motor nicht erreichen; dazu wird der sichtbare Lauf = gebuchter Lauf |

Zwei Punkte, die Phase 2 nicht übersehen sollte:

- **R4 ist die einzige Variante, die die Regel leichter einhaltbar macht.** Alles andere lässt
  die Beweislast, wo sie ist.
- **Ein Rundenmotor für die Arena (R3 dort) ist rangtreue-seitig kein Verlust, sondern eine
  zweite Chance** — vorausgesetzt, die Messgrundlage bleibt dieselbe (kaderfest, Median über
  fünf Paarungen, `messgrundlage-kaderfest.md`), damit die neue Zahl mit der alten vergleichbar
  ist. Der Fechten-Umzug auf die Bühne ist die Blaupause dafür (Arena 0,153 → Bühne 0,826).

---

## 7. Vorläufige fachliche Einschätzung (nicht die Empfehlung — die ist Phase 2)

**Der größte Hebel** liegt nicht in einer Modellumstellung, sondern in der **Trennung von
Simulation und Präsentation** (R4) — angefangen dort, wo sie fast geschenkt ist (Bühne:
`runden[]` + `buehneQueue` sind das Protokoll), dann dort, wo sie den größten Verifikations-
und Regie-Gewinn bringt (Feldspiel: Highlights-Modus; Bahn: Replay des gebuchten Laufs). Sie
löst den Verifikationsaufwand strukturell, macht den sichtbaren Lauf zum gebuchten Lauf und
eröffnet die Zuschau-Dosierung — und sie lässt jedes Chassis sein Zeitmodell behalten.

**Der zweitgrößte Hebel** ist ein **Rundenmotor für die Arena** — als eigener Prototyp mit
kaderfester Messung, nicht als Produktionsumbau. Es ist der einzige Ort, an dem „rundenbasiert"
gleichzeitig Lesbarkeit (Chris' Kritik), Rangtreue (nichts zu verlieren) und Animationsaufwand
(Clips statt Gedränge) verbessern könnte. Wenn Chris' Bauchgefühl irgendwo recht hat, dann hier.

**Kleine, sofort nützliche Hebel unabhängig von allem:** ein deterministischer Sonden-Modus für
Screenshots (N Ticks, dann `draw()`), `performance.now()` an den drei Stellen durch
Simulationszeit ersetzen, und einen Requisiten-Hook vor der Vollbild-Weiche in
`zeichneSprite()`. Diese drei nehmen den Sicht-Reviews den größten Teil der zweiten Runden.

**Das größte Risiko** wäre eine Pauschalentscheidung „alles rundenbasiert": sie kostet die
Bahn ihr Genre, das Feldspiel seinen besten Motor, 13 bestandene Disziplinen ihre Basislinie
und sechs frisch abgenommene Bewegungsmaschinen — und lässt die Fehlerklassen, die die Reviews
wirklich verlängern (4.2, 4.3), unberührt. Das zweitgrößte Risiko ist das Gegenteil: aus „die
Bühne ist ja schon rundenbasiert" zu schließen, dass es nichts zu entscheiden gibt. Es gibt
etwas zu entscheiden — nur ist es die Trennung, nicht der Takt.

---

## 8. Offene Fragen an die Opus-Synthese

1. Soll die Trennung (R4) als Architekturziel gesetzt werden, und wenn ja: Bühne zuerst (fast
   gratis) oder Arena zuerst (größter Zuschauer-Gewinn)?
2. Ist ein Arena-Rundenmotor ein Prototyp mit eigener Messung (wie die Takeshi-/Schach-
   Prototypen vom 05./06.09.) oder ein Konzept, das erst nach dem Roguelike-Skill-Pool kommt?
3. Soll der sichtbare Lauf in der App der gebuchte Lauf werden (Saat durchreichen, Ticks
   angleichen) — unabhängig von allem anderen? Das ist heute eine stille Lücke.
4. Welche Zuschau-Dosierung will Chris (Full / Extended / Key Highlights je Spieltag)? Das
   entscheidet, wie viel Protokoll R4 wirklich braucht.

## 9. Was diese Analyse NICHT getan hat

- Keinen Prototyp gebaut, keine Zeit gemessen, keine Rangtreue nachgemessen. Alle Zahlen sind
  aus dem Repo zitiert (Stand in `stand-aller-disziplinen.md` inklusive Nachträge bis 16.09.).
- Die In-Game-Meldungen (`origin/bug-reports`) wurden gelesen: die jüngste ist vom 25.08.
  (Arena: Waffen fehlen, Tooltips, Ton) — keine neue Rückmeldung zum Zeitmodell.
- Keine Bewertung der Roguelike-/Skill-Pool-Konzepte über den Bezug in 3.4 hinaus.

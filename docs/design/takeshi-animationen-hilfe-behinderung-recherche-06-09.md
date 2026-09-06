# Takeshi's Castle: Animationen an den Hindernissen, Hilfe und Behinderung sichtbar machen (Fable, 06.09.2026)

Stand: `origin/main` `16828393` (PR #813 „Takeshi's Castle, komplett" bereits gemergt — Route,
Chaos/Outsmart und Burgpunkte sind produktiv, nicht nur geplant). **Reine Recherche, keine Zeile
Produktionscode.** Alle Zeilenangaben beziehen sich auf `public/mockups/battle-mode.engine.js` auf
diesem Stand.

Chris' Auftrag, nach einem live geschauten Takeshi-Rennen, sinngemäß: Animationen an den
Hindernissen, oder dass man sieht, wie Teamkollegen sich aktiv helfen, oder wie Gegner versuchen zu
behindern — nicht Animation um der Animation willen, sondern sichtbare Interaktion.

---

## 0. Die Antwort in acht Sätzen

1. **Die Behinderung existiert bereits vollständig als Mechanik — und ist im Bild fast unsichtbar.**
   Rempler (`tackle`), Gedränge (`gedraenge`) und Ausweichen (`tackleAusweichen`) laufen seit #813
   produktiv in `stepSpurt` (`:16801–16862`), kaderfest bei rho 0,860/0,872 gemessen. Sichtbar davon
   ist heute nur Schwebetext („gerammt", „im Gedränge", „weicht aus") und eine Ticker-Zeile — das
   bestehende Partikel-Effektsystem (`EFFEKTE`/`zeichneEffekte`, `:17112–17170`), das im Kampf jeden
   Treffer, jede Druckwelle, jeden Schild zeichnet, wird auf der Bahn nie aufgerufen.
2. **Der Rempler hat sogar schon eine fertig gemalte Stoß-Pose — die nie zu sehen ist.** `u.kraft`
   löst in `zeichneSprite` die „lunge"-Animation aus (dieselbe Stoß-/Schlag-Pose wie im Kampf,
   `:2451/2574–2581`), aber `tackleKosten:0` für Takeshi (`:15686`, bewusst gemessen — Abschnitt 1
   dort) setzt `u.kraft` nie über 0. Der Rempler bleibt optisch ein normal laufender Charakter.
3. **Die Hindernisse haben bereits Idle-Animationen — aber keine Reaktion auf den Läufer.**
   `zeichneFalleTakeshi` (`:14901–14936`) lässt den Pendelball schwingen, das Rad rotieren, die
   Walzen wippen, Schlammblasen steigen — rein aus der Uhr (`rennT`), unabhängig davon, ob gerade
   jemand die Falle nimmt, durchbricht oder stürzt. Das Fallen-Protokoll kennt den Ausgang aber genau
   (`u.fallen[...].aus`: `'sauber'`/`'durchbruch'`/`'sturz'`, `:16668/16712/16731`) — die Information
   ist da, nur ungenutzt für die Zeichnung.
4. **„Teamkollege hilft" existiert in Takeshi's Castle nicht — auch nicht als abgeschaltetes Feld.**
   Windschatten (`schatten`) ist die einzige bahnverwandte Mechanik, die einem anderen Läufer
   Tempo schenkt, ist aber seiten-neutral (`vordermann()`, `:16342–16345`, prüft nicht `o.seite`) und
   für Takeshi hart auf `false` (`:15022` ff.). Ein echtes „Teamkollege schiebt/zieht dich" gibt es in
   keiner Bahn-Disziplin.
5. **Sortierung nach Aufwand und Risiko:** Rempler/Ausweichen/Gedränge sichtbar machen ist reines
   Rendering (kein `wert()`-Zugriff, keine neue Zufallszahl, keine neue Variable in `BAHN_ART`) —
   **Kategorie „Dekoration", Risiko null, Aufwand klein.** Hindernisse auf den Ausgang reagieren
   lassen liest nur `u.fallen[...].aus`, schreibt nichts zurück — **ebenfalls Dekoration, Aufwand
   klein bis mittel** (zehn Fallentypen, nicht einer). Ein „Teamkollege hilft" mit echter Wirkung auf
   Zeit/Burgpunkte **ist neue Wertungsmathematik** — Kategorie „Mechanik", muss kaderfest gemessen
   werden wie die Chaos-Säule selbst, Aufwand mittel bis groß.
6. **Empfehlung, in dieser Reihenfolge:** (1) Rempler-Treffer/Ausweichen/Gedränge an `EFFEKTE`
   anschließen plus die vorhandene Lunge-Pose optisch (nicht mechanisch) auslösen — macht sichtbar,
   was heute schon rechnet, ohne eine einzige Kaderzahl zu berühren. (2) Fallen auf `aus` reagieren
   lassen — der Läufer kämpft sichtbar mit der Sache, nicht nur mit einer Zahl daneben. (3) Ein
   Teamkollegen-„Anschieben" **nur**, wenn Chris nach (1) und (2) noch mehr will — und dann als
   gemessenes Rezept nach demselben Muster wie `docs/design/takeshi-chaos-tackle-plan-06-09.md`, nicht
   als Bauchentscheidung.
7. **Warum diese Reihenfolge und nicht umgekehrt:** (1) und (2) beantworten „Gegner behindern
   sichtbar machen" fast vollständig, ohne jedes rho-Risiko — das ist der in der Aufgabenstellung
   benannte Fall a) reine Dekoration, aber hier zurecht, weil die Mechanik dahinter längst gemessen
   ist und nur der Bildschirm hinterherhinkt. „Teamkollege hilft" gibt es dagegen mechanisch noch gar
   nicht — jede sichtbare Fassung, die mehr sein soll als zwei Figuren, die sich kurz zunicken, muss
   die Kadermessung durchlaufen, bevor sie eingebaut wird, nicht danach.
8. **Kein Vorschlag hier verändert eine Zahl in `BAHN_ART` oder `MOTOREN`.** Wo eine neue Mechanik
   nötig wäre (Abschnitt 4), ist das explizit als offene, zu messende Frage markiert und nicht als
   fertiges Rezept — anders als beim Chaos-Plan gibt es hier noch keinen Prototyp-Diff.

---

## 1. Was heute schon rechnet, aber nicht zu sehen ist

### 1.1 Die drei Chaos-Ereignisse und ihre heutige Sichtbarkeit

| Ereignis | Code | Rechnet | Sichtbar heute |
|---|---|---|---|
| Rempler trifft | `:16847–16852` | `stark=WUCHT/(WUCHT+ROBUST)`, Opfer stolpert 0,55–1,45 s, −18 Reserve | Schwebetext „gerammt" (crit, rot) am Opfer + Ticker „X rammt Y vor der Falle um." |
| Rempler geht ins Leere | `:16839–16845` | TECHNIK (Opfer) gegen WUCHT (Täter), Duell-Form | Schwebetext „weicht aus" am Opfer + Ticker „X sieht Y kommen …" |
| Rempler abgewehrt | `:16853–16856` | derselbe `stark`-Wurf, nur `rr()>=stark` | Schwebetext „hält stand" am Opfer + Ticker „X steckt den Rempler weg." |
| Gedränge | `:16684–16703` | Zeitpreis `preis·extra·(1−0,8·schieb/100)`, `schieb=max(WUCHT,TECHNIK)` bei `lesen:true` | Schwebetext „im Gedränge" am Läufer + eine Ticker-Zeile je Falle/Pulk |

In allen vier Fällen passiert auf der Bühne **nichts** außer Text: kein Ruck in der Laufbewegung, kein
Blitz, kein Zusammenprall. Für zwölf Läufer auf einer Route mit Kamera-Zoom bis 3,4× (`:16972`) heißt
das: wer nicht gerade den Ticker mitliest, sieht einen Pulk aus Figuren, die sich unauffällig
aneinander vorbeibewegen — genau das Gegenteil von „chaotisch, wo die Leute sich tackeln, rammen".

### 1.2 Das vorhandene Partikel-Effektsystem — heute Kampf-exklusiv

`EFFEKTE`/`effekt()`/`zeichneEffekte()` (`:17112–17170`) ist ein generisches, bereits fertiges
Zeichensystem mit fünf Typen, alle nur auf `x/y`-Koordinaten im Bildschirmraum angewiesen:

| Typ | Bild | Bisherige Verwendung |
|---|---|---|
| `hieb` | kurzer Bogenschlag am Ziel, stärker bei `schwer:true` | Nahkampftreffer im Kampf |
| `spur` | Farbverlauf-Linie zwischen zwei Punkten | Eigenbewegungs-Skills |
| `welle` | expandierender Ring | Betäubung/Flächenwirkung |
| `kuppel` | Ring + gefüllte Kuppel | Schild-Wirkung |
| `strahl` | gerade Linie | Fernkampf/Linienform |

`zeichneEffekte(1/60)` wird ausschließlich am Ende der Arena-`draw()`-Funktion aufgerufen (`:17311`);
`zeichneSpurt()` (`:16962–17100`) hat eine eigene, kleinere Endstrecke für Schwebetexte, ruft
`zeichneEffekte` aber nirgends auf. Die Bahn-Kamera liefert mit `camX(u.pos)`/`bahnY(u.bahnZ)`
(bereits an jeder `schwebe()`-Stelle benutzt) exakt dieselben Bildschirmkoordinaten, die `effekt()`
erwartet — der Anschluss ist geometrisch trivial, nicht neu zu bauen.

**Konkret, drei Zeilen Wirkung, keine neue Optik-Idee nötig:**

- Rempler-Treffer (`:16848–16852`): `effekt({typ:"hieb",x:camX(o.pos),y:bahnY(o.bahnZ),ux:camX(u.pos),uy:bahnY(u.bahnZ),seite:u.seite,schwer:true,dauer:.42})` — derselbe Bogenschlag, der im Kampf jeden Treffer markiert.
- Gedränge (`:16688–16693`): `effekt({typ:"welle",x:camX(h) [Bildschirm-x der Falle],y:bahnY(?),r:34,seite:...,dauer:.5})`, ausgelöst einmal je gemeldetem Pulk (dieselbe `melden`-Schwelle wie der Ticker) — der Ring, den es für Betäubung schon gibt, liest sich hier als „Gedrängewelle".
- Ausweichen (`:16842–16845`): `spur` zwischen der alten und einer seitlich versetzten Position des Opfers — ein kurzer Ausweich-Ruck, keine neue Bewegungslogik (die Position selbst ändert sich nicht, nur die Zeichnung deutet die Bewegung an, wie der Sog-Farbverlauf das für Windschatten bereits tut, `:16991–16999`).

Kosten: drei `effekt()`-Aufrufe an bestehenden Codepunkten plus ein `zeichneEffekte(1/60)`-Aufruf am
Ende von `zeichneSpurt()`. Kein neuer Zustand in `LAEUFER`, keine neue `BAHN_ART`-Konstante, kein
`rr()`-Aufruf. **Aufwand: klein (Stunden, nicht Tage). Rho-Risiko: keins — die Funktion liest nur
Positionen, die bereits berechnet sind, und schreibt nichts zurück.**

### 1.3 Die Lunge-Pose: schon gemalt, nie gezeigt

`zeichneSprite` wählt bei `u.lunge>0` die Stoß-/Schlag-Animation („shoot"/„slash", je nach
Ausrüstung) statt des Laufzyklus (`:2574–2581`, `:2451–2453`). `zeichneSpurt` übergibt
`lunge:u.kraft>0?0.15:0` (`:16987`) — dieselbe Variable, die auch die Rempel-Bremse auslöst
(`:16477`: `u.kraft>0?0.82:1` auf die Geschwindigkeit, `:16619`: 1,15× Kraftverbrauch). Für Spurt ist
`tackleKosten:0,26` (`:14772` ff.), für Takeshi bewusst `tackleKosten:0` (gemessen in
`takeshi-chaos-tackle-plan-06-09.md`, Abschnitt 3.1: „der Rempler kostet den Remplenden weniger, als
er den Getroffenen kostet"). Ergebnis: der Takeshi-Rempler zahlt keinen Tempoverlust — und bekommt
dadurch auch nie die Stoß-Pose zu sehen, weil beides an derselben Variablen hängt.

**Das ist die Stelle, an der Vorsicht zählt.** `u.kraft` direkt hochzusetzen, nur um die Pose
auszulösen, würde denselben Tempo- und Kraftverbrauchs-Malus zurückbringen, den `tackleKosten:0`
absichtlich gemessen und verworfen hat (0,860 vs. eine teurere Fassung, die Torment langsamer machte
— Kommentar `:16812–16816`). Der saubere Weg ist ein **rein optisches** Feld, das dieselbe Pose
auslöst, ohne in die Geschwindigkeits-/Zehr-Formeln einzugehen — z. B. ein `u.lungeVis`-Timer, den
`zeichneSpurt` statt `u.kraft` an `lunge:` übergibt, gesetzt an derselben Stelle wie `u.tackleCd`
(`:16817`), gelesen nirgends außer beim Zeichnen. **Aufwand: klein** (ein neues Feld, eine geänderte
Zeile in `zeichneSpurt`, eine gesetzte Zeile im Tackle-Zweig). **Rho-Risiko: keins, sofern das Feld
ausschließlich in `zeichneSpurt` gelesen wird** — das ist die Bedingung, nicht eine Kleinigkeit: würde
irgendein Codepfad `u.lungeVis` versehentlich wie `u.kraft` lesen, wäre die Trennung für die Katz.

---

## 2. Hindernisse, die auf den Läufer reagieren

### 2.1 Was heute passiert: Idle-Animation, blind für den Läufer

Alle zehn Fallentypen in `zeichneFalleTakeshi` (`:14901–14936`) animieren aus der reinen
Simulationszeit `t=rennT`, unabhängig von jedem Läufer:

- `brueckenball` (Bridge Ball): Pendelball schwingt mit `sin(t·2,2+b·0,9)` (`:14915–14917`)
- `raeder` (High Rollers): Rad rotiert mit `t·3+b` (`:14922`)
- `walzen` (Roller Game): zwei Walzen wippen mit `sin(t·4+b+k)` (`:14928`)
- `schlamm` (Dragon God Lake): drei Blasen steigen phasenversetzt (`:14931`)
- `tuer` (Knock Knock): eine von zwei Türvarianten je Bahn (`:14911–14912`), aber statisch

`b` (Bahnnummer) verschiebt nur die Phase zwischen den Spuren, damit nicht alle Pendel synchron
schwingen — es gibt keine Kopplung an `u.pos`, `u.huerde` oder `u.fallen`.

### 2.2 Was zur Verfügung steht: der Ausgang ist bereits protokolliert

Im selben Frame, in dem ein Läufer eine Falle erreicht, schreibt `stepSpurt` in `u.fallen` genau,
was passiert ist (`:16668, 16712, 16731`):

```js
u.fallen.push({typ:hTyp, skill:hSkill, stoppAnteil:(1-0.8*hSkill/100), aus:'sauber'});
// ... später im selben Durchlauf, je nach Würfen:
u.fallen[u.fallen.length-1].aus='durchbruch';   // WUCHT-Wurf gewonnen
u.fallen[u.fallen.length-1].aus='sturz';        // beide Würfe verloren
```

`u.huerde>0` läuft für die Dauer des Stopps (`stoppAnteil`-Sekunden) ab `:16548` herunter — die Zeile
`if(u.huerde>0)u.huerde-=dt` ist bereits der Zähler, den eine Obstacle-Reaktion als „wie lange steht
er noch davor" lesen könnte, ganz ohne neuen Zustand.

### 2.3 Vorschlag: die Falle bekommt eine Reaktion, keine neue Mechanik

`zeichneFalleTakeshi(i,x,y,b)` bekommt zusätzlich den Läufer (oder die Läufer) mit, die gerade an
Position `i` stehen (`LAEUFER.filter(u=>HUERDEN_N().indexOf(HUERDEN_N().find(h=>...))===i && u.huerde>0)`
— eine Filterzeile, die es in ähnlicher Form beim Gedränge schon gibt, `:16686`). Drei Fälle:

| `aus` | Vorschlag je Fallentyp (Beispiele) |
|---|---|
| `'sauber'` | Tür schwingt weit auf statt der aktuellen halbtransparenten Fläche; Trittstein wird kurz heller markiert; Eisbahn zeigt eine Spur |
| `'durchbruch'` | Tür/Seilwand zittert stärker, ein Riss-Blitz (wiederverwendbar: derselbe `zeichneRiss`, der bei `b.gluehenderRiss` schon existiert, `:2494/2873`); der Pendelball schlägt sichtbar aus |
| `'sturz'` | Schlammspritzer (Partikel wie bei `schlamm` schon vorhanden, nur ausgelöst statt zeitgesteuert), Trittstein „wackelt" kurz, Walze rollt kurz zurück |

Das ist **keine neue Wertformel** — `zeichneFalleTakeshi` liest ausschließlich `u.fallen[...].aus`,
das bereits geschrieben wird, und schreibt selbst nichts zurück in die Simulation. Der Aufwand liegt
in der Zahl der Fälle: zehn Fallentypen × drei Ausgänge sind nicht alle gleich lohnend zu
individualisieren — realistisch macht man zuerst die vier Typen mit ohnehin schon animierten
Elementen (Tür, Pendelball, Rad, Walzen — die haben bereits eine bewegte Grafik, die auf einen
Treffer reagieren kann) und lässt die IdleAnimation für die übrigen sechs vorerst unverändert.
**Aufwand: klein bis mittel** (vier Typen zuerst, ein Nachmittag; alle zehn, zwei bis drei Tage).
**Rho-Risiko: keins** — reine Lesefunktion auf bereits bestehende Felder, kein `rr()`, kein
Rückschreiben.

---

## 3. „Gegner behindern" ist damit im Wesentlichen erledigt — eine Einordnung

Die Aufgabenstellung nennt den Chaos-Tackle als „vermutlich das wertvollste, risikoärmste" Element,
weil die Mechanik schon da ist und nur sichtbar werden muss. Das bestätigt sich: Abschnitt 1 zeigt,
dass **kein neuer Skill-Kanal, keine neue Zufallszahl und keine neue `BAHN_ART`-Konstante** nötig ist,
um Rempler, Ausweichen und Gedränge tatsächlich als Zusammenstoß zu erleben statt nur zu lesen. Das
ist der Idealfall in der Unterscheidung aus der Aufgabenstellung: eine Mechanik, die längst die
Kadermessung bestanden hat (0,860/0,872, Abschnitt 4 des Chaos-Plans), bekommt zusätzliches Bild, ohne
dass sich an der Zahl dahinter etwas ändert — Kategorie „Dekoration" im besten Sinn, weil die
Mechanik, die sie dekoriert, bereits echt ist.

---

## 4. „Teamkollege hilft" — was fehlt, und was es kosten würde

### 4.1 Der Befund: nichts davon existiert, auch nicht abgeschaltet

Anders als beim Chaos-Tackle (der als `tackle:false` bereits im Code lag, bevor er aktiviert wurde)
gibt es für „Teamkollege hilft" in Takeshi's Castle **keine Vorstufe**. Die einzige verwandte
Mechanik im Bahn-Chassis ist Windschatten (`schatten`, `plaene[].sucht`) — sie ist aber:

- **seiten-neutral**: `vordermann()` (`:16342–16345`) prüft nur `o!==u && o.fertig==null`, nicht
  `o.seite===u.seite`. Wer im Sog eines Gegners läuft, bekommt denselben Vorteil wie im Sog eines
  Vereinskollegen. Ein „hilft"-Narrativ bräuchte hier zuerst einen Seitenfilter.
- für Takeshi **hart deaktiviert** (`schatten:false`, `plaene[].sucht: 0/0/0`, Tabelle in
  `takeshi-chaos-tackle-plan-06-09.md` Abschnitt 1.1) — mit derselben Begründung wie beim
  Rempler-Rezept nie geprüft, ob es für Takeshis Werte-Mischung überhaupt passt.

„Hilfe" im Sinn von Chris' Feldspiel-Doppeln (`hilfeChance`, `hilfeBis`, `:8906–8919`) ist eine
gänzlich andere Mechanik (Verteidiger rückt zum Ballführer) und überträgt sich nicht direkt.

### 4.2 Was „Helfen" an einem Hindernis mechanisch bedeuten könnte — zwei Kandidaten, beide ungemessen

**Kandidat A — Sturz-Erholung beschleunigen.** Ein Teamkollege im Gedränge-Radius (`gedraenge.radius`,
bereits als Konstante da) reduziert `u.stolper` eines gestürzten Mitspielers, sobald der Helfer selbst
an derselben Falle steht — sinngemäß „hochziehen". Skalierung z. B. über ROBUST oder WUCHT des
Helfers, dieselben Größen, die auch das Tackle-Duell tragen (r=0,85/0,88 zur Eignung, Abschnitt 1.3
des Chaos-Plans) — **nicht** über TECHNIK, das dort schon als korrelationsschwächster Kanal (r=0,60)
identifiziert wurde und im Chaos-Plan (Abschnitt 3.3) genau deshalb aus jedem Bonus-Kanal
herausgehalten wurde.

**Kandidat B — Gedränge-Preis für die eigene Seite senken.** Statt eines Sturz-Bonus: wer mit
mindestens einem eigenen Mitspieler im Gedränge steht, zahlt einen Bruchteil weniger vom
Gedränge-Preis (`gedraenge.preis`) als jemand, der allein im gegnerischen Pulk steckt — das visuelle
Gegenstück zum „Kluge findet die Lücke" (`gedraenge.lesen`), nur mannschaftlich statt individuell.

Beide sind **nicht** durchgerechnet — anders als jede Zahl im Chaos-Plan sind das hier unbestätigte
Kandidaten, keine Empfehlung mit Rezept. Der Grund, warum keiner von beiden vorschnell empfohlen
wird: **jede neue Formel dieser Art geht direkt in `wert()`/Burgpunkte ein** (Kandidat A über
`u.stolper`, der in `burgpunkte()` über `stoppAnteil` einfließt; Kandidat B direkt über den
Gedränge-Preis) — es ist exakt der Fall, den die Aufgabenstellung als „bewegt rho unmessbar" benennt.
Vor jedem Einbau steht dieselbe Kadermessung wie beim Chaos-Tackle: mehrere Kadergrößen, zwei
Saatensätze, Isolation der anderen 19 Disziplinen (`scripts/miss-alle-disziplinen.mjs`), Star-auf-
Rang-1-Quote — nicht weniger Sorgfalt, weil es kleiner wirkt als der Rempler.

**Ein Risiko vorab, ohne Messung schon sichtbar:** ein Team-Bonus, der zu stark ausfällt, belohnt
„am selben Fleck stehen" statt individuelle Eignung — dieselbe Falle, vor der der Chaos-Plan bei
`tackleNerven` warnte („die Validität sinkt, weil ein Ausscheiden durch fremde Hand nicht die eigene
Eignung misst", Abschnitt 3.3 dort). Ein Sturz, den man nicht selbst vermieden hat, sondern dessen
Folgen ein Teamkollege abfedert, misst am Ende eher Kaderzusammensetzung (wie viele robuste
Mitspieler stehen zufällig in der Nähe?) als die Eignung des Gestürzten. Das ist kein Ausschlussgrund
— aber der Grund, warum Kandidat A/B eine eigene, kleine Messreihe brauchen, bevor irgendein Wert
gesetzt wird.

### 4.3 Der risikofreie Fallback: Helfen ohne Wertung

Sollte Chris eine Wertungs-Wirkung nicht wollen (oder soll sie erst später kommen), lässt sich „Helfen"
rein optisch zeigen, ohne eine einzige Zahl zu ändern: zwei Läufer derselben Seite im Gedränge-Radius
bekommen einen kurzen `spur`- oder `kuppel`-Effekt zwischen sich (dasselbe Effektsystem wie in
Abschnitt 1.2), ausgelöst rein aus Positionsnähe + Seitenprüfung, ohne Rückwirkung auf `u.huerde`,
`u.stolper` oder `burgpunkte()`. Das ist ehrlich die Kategorie „reine Dekoration" aus der
Aufgabenstellung — es sieht nach Zusammenhalt aus, ändert aber nichts am Ausgang. Wenn dieser Weg
gewählt wird, sollte er im Spiel auch so kommuniziert werden (kein Tooltip, der Hilfe als Vorteil
verspricht) — sonst erwartet der Spieler eine Wirkung, die es nicht gibt.

---

## 5. Zusammenfassung: Aufwand und Risiko im Überblick

| # | Vorschlag | Kategorie | `wert()`/rho berührt? | Aufwand | Voraussetzung |
|---|---|---|---|---|---|
| 1 | Rempler-Treffer/Ausweichen/Gedränge an `EFFEKTE` anschließen | Dekoration | nein | klein | keine |
| 2 | Lunge-Pose optisch beim Rempler auslösen (`u.lungeVis`, getrennt von `u.kraft`) | Dekoration | nein, **sofern getrennt von `u.kraft` gehalten** | klein | Abschnitt 1.3 lesen, bevor man `u.kraft` anfasst |
| 3 | Hindernisse reagieren auf `u.fallen[...].aus` (4 Typen zuerst: Tür, Pendelball, Rad, Walzen) | Dekoration | nein | klein–mittel | keine |
| 4 | Hindernisse, restliche 6 Typen | Dekoration | nein | mittel | 3 zuerst, zur Abschätzung des Aufwands je Typ |
| 5 | Team-Sturz-Hilfe oder Team-Gedränge-Rabatt (Kandidat A/B) | **Mechanik** | **ja** | mittel–groß | eigene Kadermessung nach dem Muster von `takeshi-chaos-tackle-plan-06-09.md`, vor jeder Umsetzung |
| 6 | Team-Hilfe rein optisch (Fallback zu 5) | Dekoration | nein | klein | keine, aber: nicht als Vorteil bewerben |

**Empfohlene Reihenfolge:** 1 → 3 → 2 → 4, dann Chris das Ergebnis zeigen. Erst danach 5 oder 6 —
und 5 nur mit einer eigenen Messreihe, nicht als Ergänzung „nebenbei" zum nächsten PR.

---

## Quellen

- `docs/design/takeshi-chaos-tackle-plan-06-09.md` — die Chaos-Tackle/Outsmart-Recherche selbst,
  inklusive aller Kadermessungen, die diesen Bericht tragen (Abschnitt 1.1, 3.1–3.3, 4).
- `docs/BATTLE_ARENA_UEBERGABE.md` — Überblick über die Arena-/Bahn-Architektur.
- `public/mockups/battle-mode.engine.js`: `zeichneSpurt` `:16962–17100`, `EFFEKTE`/`effekt`/
  `zeichneEffekte` `:17112–17170` (Aufruf im Kampf `:17311`), `zeichneFalleTakeshi`/`fallenLook`
  `:14889–14936`, Tackle/Ausweichen/Gedränge-Block `:16684–16862`, `zeichneSprite`-Lunge-Pose
  `:2451–2453/2574–2581`, `vordermann`/Windschatten `:16342–16345/16559–16562`,
  Feldspiel-„Hilfe" (Doppeln) `:8906–8919` als Kontrast, `BAHN_ART["takeshis-castle"]` ab `:15627`.

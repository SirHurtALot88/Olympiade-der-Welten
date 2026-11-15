# Spurt/HYROX-Stationen: Nahkamera statt Zwölf-Bahnen-Übersicht (08.11.)

Chris' Feedback zu PR #1368 (HYROX-Stationen-Mechanik), wörtlich: „Ok ich dachte du machst aber so
ne ganz andere Perspektive für hyrox :/ bzw nicht persoektive aber andere ansicht sls das kleine
mit den mini Hindernissen Sondern näher dran wo man die einzelnen Stationen abarbeitet Da wären ja
nicht alle spieler gleichzeitig dabei oder? Bitte mal ne bessere version mit pixellab bauen". Zwei
Teile: eine **Nahkamera**, die auf einzelne Stationen statt auf alle zwölf Bahnen gleichzeitig
zoomt, und **echte Arbeitsposen** statt der generischen liegenden Stolper-Pose, die PR #1368 für
jede Station (und jeden Läufer) wiederverwendet hatte.

Dieses Dokument behandelt **ausschließlich Format „hyrox"**. Klassisch und „Die Hatz" (PR #1367)
zeichnen Zeichen für Zeichen wie vorher — jeder neue Codepfad hängt entweder hinter
`bahnHyroxAktiv` oder (bei den Posen) hinter Feldern, die außerhalb von Hyrox nie gesetzt werden.

## 1. Die Nahkamera

### 1.0 Ein Vorab-Fund: die Kamera lief für Hyrox (und Hatz) bisher nie

`kameraUpdate(dt)` wurde bisher ausschließlich aus dem **gemeinsamen, generischen Nachlauf** von
`stepSpurt(dt)` aufgerufen — genau der Code, den die Format-Weiche am Funktionsanfang
(`if(bahnHyroxAktiv){ stepSpurtHyrox(dt); return; }`) für Hyrox (und ebenso für die Hatz)
**übersprang**. Nachgemessen per `window.__arena.hyroxKameraProbe()` (neue QA-Sonde, s.u.): `cam`
blieb während eines ganzen Hyrox-Rennens exakt auf ihrem Startwert `{zoom:1, cx:0.5}` stehen — die
Kamera hat sich vor dieser PR **nie bewegt**, unabhängig vom Format. Das erklärt rückblickend auch,
warum PR #1368s eigene Bildbelege (Abschnitt 5 dort) nur die immer gleiche, volle Breite zeigen.

Behoben **ausschließlich für Hyrox**: `stepSpurtHyrox(dt)` ruft `kameraUpdate(dt)` jetzt selbst am
Ende jedes Ticks auf. `stepSpurt()`s eigener Aufruf (Klassisch) bleibt unangetastet; `stepSpurtHatz`
bekommt bewusst **keinen** eigenen Aufruf — die Hatz hat dieselbe Lücke, aber der Auftrag gilt nur
Hyrox („Klassisch/Hatz bleiben exakt wie heute"), und das wäre eine Verhaltensänderung an einem
fremden Format gewesen.

### 1.1 Entscheidung 1 — wessen Station die Kamera zeigt

Nicht der Spitzenreiter: er ist nach dem Start fast immer allein unterwegs, eine Einzelkamera auf
ihn würde das Feld dahinter aus dem Bild nehmen (derselbe Fehler, den die bestehende
Zeitfahren-Einzelkamera für genau einen Läufer kennt und über ein Nachbarfenster löst, s.
`ZF_NACHBAR_FENSTER`). Stattdessen: die Station mit der **meisten gleichzeitigen Aktivität** — eine
echte HYROX-Übertragung schneidet auf den Punkt, an dem gerade am meisten passiert (ein Pulk an
einer Hürde oder am Seil), nicht stur auf den Ersten.

„Meiste Aktivität" wird über eine **Minimalabstand-Zuordnung** bestimmt: jeder noch laufende
Teilnehmer zählt für seine **nächstgelegene** Station (`hyroxNaechsteStation(pos)`), kein fester
Schwellwert. Die Station mit der höchsten Zählung gewinnt, bei Gleichstand die frühere (kleinerer
Index — dort steht typischerweise noch die Verfolgergruppe).

**Warum kein Schwellwert/Fenster-Ansatz (erster Anlauf, verworfen):** Die erste Fassung zählte nur
Läufer *innerhalb eines festen Fensters* um jede Station. Per `hyroxKameraProbe()` und
Screenshot-Gegenprobe (s. Abschnitt 1.4) nachgemessen: bei einem bereits auseinandergezogenen Feld
können **alle** Läufer außerhalb jedes Fensters liegen (zwischen zwei Stationen), die Kamera wählte
dann die zuletzt aktive Station weiter — und weil derselbe Fenstertest auch den Bildausschnitt
bestimmte, fror das Bild auf eine inzwischen **leere** Stationsmarke ein, bis zum nächsten Schnitt.
Die Minimalabstand-Zuordnung ordnet dagegen *jeden* Läufer immer genau einer Station zu (die Summe
der Zählungen ist immer die volle Feldgröße) — die gewählte Station hat also nie weniger als einen
fairen Anteil des Feldes.

### 1.2 Entscheidung 2 — Schnitt-Rhythmus

Alle `HYROX_CAM_SCHNITT_SEK` (3,5 s Simulationszeit) wird neu entschieden, nicht jeden Frame — sonst
würde die Kamera bei zwei etwa gleich aktiven Stationen zwischen ihnen flackern. Das ist der im
Auftrag vorgeschlagene „alle 3–4 s"-Rhythmus, als fester Mittelwert.

**Welche Läufer im Bild bleiben, wird beim Schnitt eingefroren.** Ein zweiter, beim Bildbeleg
gefundener Fehler (s. Abschnitt 1.4): wird die Zuordnung „wem ist diese Station gerade am
nächsten" **jeden Frame neu** ausgewertet (statt nur beim Schnitt), kann die Gruppe schon **vor**
dem nächsten planmäßigen Schnitt leerlaufen, sobald alle ihr zugeordneten Läufer über den
Mittelpunkt zur nächsten Station hinausgelaufen sind — der Ausschnitt zeigte dann bis zum nächsten
Schnitt nur noch leere Bahn. Jetzt hält `hyroxCamGruppe` (ein `Set` von Läufer-IDs) die Mitgliedschaft
ab dem Schnitt fest; der Bildausschnitt rechnet seine Grenzen zwar jeden Frame aus den *aktuellen*
Positionen dieser Gruppe neu (sie bewegen sich ja weiter), aber die Gruppen-*Zusammensetzung* ändert
sich nur beim nächsten Schnitt. Genau das Bild, das ein echter Kameraschwenk zeigen würde: dieselben
Läufer bleiben im Bild, auch wenn sie dabei über die Stationsmarke hinauslaufen.

**Übergang weich, nicht hart.** Derselbe `zielCx`/`zielZoom`-Anziehungsmechanismus wie überall sonst
in `kameraUpdate()` (`cam.zoom += (zielZoom-cam.zoom)*t`, `t=min(1,dt*Faktor)`), nur mit einem etwas
höheren Faktor (2,2 statt der sonst üblichen 1,8) für einen zügigeren, aber weiterhin
interpolierten Schwenk — kein Hart-Schnitt zwischen zwei Kamerazuständen, wie es ein echter
Broadcast-Schnitt wäre, sondern ein schneller Schwenk, der sich nicht ruckartig anfühlt (explizite
Vorgabe im Auftrag).

### 1.3 Entscheidung 3 — wer nicht im Bild ist

Eine kompakte **Rangleiste** am rechten Bildrand (`zeichneHyroxRangleiste()`, Teil von
`zeichneHyroxUeberlagerung()`): alle Läufer nach aktuellem Rang (`bahnRangliste()`, dieselbe Quelle
wie Endstand/HUD überall sonst in der Bahn), mit Kopfzeile „STATIONSNAME · GRUPPE" (was die Kamera
gerade zeigt), ✓-Markierung für bereits Angekommene und einer hellen Zeile für jeden, der gerade in
`hyroxCamGruppe` steckt. Dasselbe Bedürfnis wie die Roster-Leiste der bestehenden
Zeitfahren-Einzelkamera (`#ttroster`/`renderZeitfahrenPanel`, vom Auftrag selbst als Vorbild
genannt) — hier als Canvas-Zeichnung statt DOM-Panel, weil die Bahn für Spurt kein eigenes
DOM-Overlay führt (anders als Zeitfahren/Staffel mit `#ttfokus`/`#bahnHud`) und ein drittes
DOM-Panel nur für dieses eine Format mehr Flächen (battle-mode.html/.css) angefasst hätte als diese
eine Zeichenfunktion.

**Bekannte Einschränkung:** bei zwölf Namen kann die Leiste mit langen Läufer-Labels (Name/Platz)
am rechten Rand knapp kollidieren, wenn ein Läufer dort steht — reine Kosmetik, kein
Lesbarkeitsausfall, aber ein Punkt für eine spätere Politur-Runde.

### 1.4 Verifikation: die Kamera wechselt wirklich, nicht nur einmal statisch

Neue QA-Sonde `window.__arena.hyroxKameraProbe()` (reiner Lesezugriff, kein `rr()`, keine
Simulations-Schreibzugriffe) gibt `{aktiv, stationIdx, station, naechsterSchnitt, rennT, zoom, cx,
laufend, gesamt, laeufer:[{n,pos,stolper,hyroxGruppe,fertig}, ...]}` zurück. Direkt damit
nachgemessen (`debug-kamera.mjs`, Scratch-Skript dieser PR, nicht eingecheckt):

| rennT (Sim-s) | Station | Zoom |
|---:|---|---:|
| 0,36 | HÜRDE | 3,0–3,5× (öffnet sich noch) |
| 1,8–6,8 | HÜRDE | konvergiert auf 5,5× (Deckel) |
| 7,2 | PALISADE | Schnitt erfolgt, Zoom öffnet sich neu |

Bestätigt: die Kamera schneidet tatsächlich zwischen Stationen um (hier nach ~7 Sim-Sekunden =
einem vollen `HYROX_CAM_SCHNITT_SEK`-Takt plus Rest der vorherigen Konvergenz), nicht nur einmal.

**Gefundene Bugs während dieser Verifikation** (beide oben unter 1.1/1.2 schon beschrieben, hier nur
der Ablauf): die erste Fassung (fensterbasierte Aktivitätszählung, pro-Frame-Neuzuordnung der
Gruppe) bestand die Fingerabdruck-/rho-Prüfung sofort (reine Anzeige, keine Wertungswirkung), zeigte
aber im Screenshot bei `--format=hyrox`, `wartenMs=60000` eine **leere** HÜRDE-Station — alle zehn
Läufer hatten sie bereits verlassen, der Ausschnitt zeigte nur noch Bahnbelag. Nachgemessen über
`hyroxKameraProbe()`, behoben wie oben beschrieben, dieselbe Szene danach erneut geprüft: der
Ausschnitt zeigt jetzt durchgehend Läufer (s. Bildbeleg unten).

### 1.5 Drosselung: tatsächlich gemessener Faktor, nicht der aus PR #1368

PR #1368s eigene Dokumentation nennt „~80 s Wall-Clock für ein ~18–19-s-Zielzeit-Rennen" — nachmessbar
falsch für dieses Repo: `ZEIT_DEHNUNG.spurt = 11,14` (battle-mode.engine.js, Zeile ~52450), nicht
~4,4 wie die Aussage impliziert. Ein typisches Hyrox-Rennen (`HYROX_BASIS_SEK=26`, realistisch
15–24 Sim-Sekunden Zielzeit) braucht damit **eher 170–270 s Wall-Clock**, nicht 80 s. Die Bildbelege
unten sind entsprechend bei größeren `wartenMs`-Werten aufgenommen; wer diese PR nachvollzieht,
sollte sich auf den gemessenen Faktor verlassen, nicht auf die ältere Dokumentation.

## 2. Bildbeleg

`node scripts/screenshot-kulisse.mjs spurt - <ms> <ausgabe> --format=hyrox`, vier Zeitpunkte
desselben Rennens (Hash-Kulisse, Standard-Demo-Kader):

- **20 s** (`rennT≈1,8`): Kamera zoomt auf HÜRDE (TECHNIK), ~5,4×. Neun Läufer dicht gedrängt kurz
  vor/an der ersten Station, Tidesprinter (schnellster Läufer, s. PR #1368-Design) bereits allein
  voraus — die Rangleiste zeigt ihn auf Platz 1, aus dem Bildausschnitt heraus, aber in der Leiste
  weiter sichtbar. Deutlich großformatigere Figuren als die alte Zwölf-Bahnen-Übersicht.
- **60 s** (`rennT≈5,4`, noch an HÜRDE, Schnitt erst bei `rennT≈7,0`): die beim Schnitt eingefrorene
  Gruppe hat sich seither spürbar auseinandergezogen (einige bereits an BALKEN), der Ausschnitt
  öffnet sich deshalb sichtbar weiter (~4,1× statt 5,5×) und zeigt beide Stationen zugleich — der
  erwartete Kompromiss aus Abschnitt 1.2 (lieber ein weiterer Ausschnitt als ein leerer).
- **110 s** (`rennT≈10`): Kamera zeigt PALISADE/SEIL (KLETTERN), dichter Pulk von sieben Läufern,
  sichtbare Erschöpfungs-Partikel bei einer Läuferin (bestehender Effekt, nicht Teil dieser PR).
- **180 s** (`rennT≈16`): Kamera zeigt MAUER/STROHBALLEN (KRAFT), Tidesprinter bereits im Ziel
  (✓ in der Rangleiste), der Rest des Feldes verteilt über die letzten beiden Stationen.

**Ehrliche Einschätzung:** Die vier Aufnahmen zusammen zeigen klar erkennbar **unterschiedliche**
Stationen zu unterschiedlichen Zeiten, mit deutlich größeren, lesbaren Figuren als die alte
Übersicht — das liest sich wie „einzelne Stationen werden abgearbeitet", nicht mehr wie die
Zwölf-Bahnen-Miniaturansicht. Die 60-s-Aufnahme zeigt den einen bekannten Kompromiss des Entwurfs
(ein weiterer statt eines perfekt engen Ausschnitts, wenn die eingefrorene Gruppe auseinanderläuft) —
besser als ein leeres Bild, aber nicht immer die engstmögliche Nahaufnahme.

## 3. Arbeitsposen statt generischer Stolper-Pose

### 3.0 Befund (PR #1368, Ausgangslage)

PR #1368 ließ jede der sieben Stationen beim Überqueren dieselbe liegende „Stolper"-Pose zeigen
(`down:u.stolper>0`, dasselbe Signal wie ein Hürdensturz im klassischen Format). Visuell nicht von
einem Sturz zu unterscheiden — für eine HYROX-Station „wird gerade gearbeitet" war das nur ein
Platzhalter, wie PR #1368s eigene Dokumentation (Abschnitt 5) selbst einräumt.

### 3.1 Der Kanal: `u.hyroxGruppe` statt neuer Felder, wo möglich

`stepSpurtHyrox()` setzt beim Überqueren einer Stationsmarke weiterhin `u.stolper=0,4`
(unverändert, derselbe 0,4-s-Zeitgeber wie vorher — rein kosmetisch, die Zielzeit steht längst über
`u.hyroxZeit` fest), zusätzlich jetzt `u.hyroxGruppe` (`"technik"|"kletter"|"kraft"`, aus
`HYROX_STATIONEN[i].gruppe`, derselben Gruppierung wie die Mechanik und die Gruppenschilder).

`zeichneSpurt()` liest beide Felder und leitet daraus `hyroxProg` (0..1 über das 0,4-s-Fenster) und
einen `lunge`-Wert ab, der von 0,2 auf 0 fällt (genau wie ein echter Ausfallschritt-Windup). Dieser
`lunge`-Wert ist **derselbe Kanal**, den `zeichneSprite()`/`zeichnePixelFigur()` ohnehin für die
Angriffs-/Ausfallschritt-Pose lesen (`u.lunge>0` → `ani="slash"` im Baukasten, `istAngriff` bei
PixelLab-Figuren) — „bestehende Animationsart nutzen, bevor man neu generiert" (Auftrag), hier durch
Wiederverwendung eines bestehenden Mechanismus statt einer neuen Formel. `down` wird für Hyrox
**immer** auf `false` erzwungen (`bahnHyroxAktiv?false:(u.stolper>0)`) — die alte liegende
„tod"-Pose erscheint für Stationsarbeit nicht mehr.

**Baukasten-Figuren** (kein eigener PixelLab-Satz, die Mehrheit aller generierten Spieler) zeigen
damit für **alle drei Gruppen** einheitlich die bestehende „slash"-Ausfallschritt-Animation,
zusätzlich fein moduliert:
- **TECHNIK**: ein Sinusbogen-Hop, exakt derselbe visuelle Mechanismus wie die bestehende
  Hürdenflug-Pose (`huerdeHop`/`huerdeHaltung`), nur gespeist aus `hyroxProg` statt `u.vizHuerde`
  (kein echter Hürdenkontakt dahinter, reine Kosmetik).
- **KRAFT**: eine Stauchung statt einer Streckung (`hyroxKraftHaltung`, bis zu 16 % kürzer in der
  Bildmitte des 0,4-s-Fensters) — sichtbares In-die-Knie-Gehen beim Schieben/Tragen.
- **KLETTERN**: keine zusätzliche Modulation, nur die Basis-„slash"-Pose über den `lunge`-Kanal.

**PixelLab-Figuren ohne eigene Hyrox-Animation** (die große Mehrheit der Figuren, die überhaupt
einen eigenen Satz haben) zeigen dieselbe bestehende „angriff"-Animation für alle drei Gruppen
(`istAngriff` via `u.lunge>0`) — ein Ausfallschritt statt des alten Liegens, aber noch nicht
gruppen-unterscheidbar.

### 3.2 Echte neue PixelLab-Posen — für EINEN Charakter, als Teillösung

Drei neue Animationen wirklich bei PixelLab bestellt (`POST /characters/animations`,
`mode="pixminimax"`, 8 Aktionsbilder + Startbild, nur Richtung „east" — die Bahn zeigt Läufer nie
von Süden/Norden, s. `zeichnePixelFigur()`s `wunsch`-Zuordnung für Spurt):

| Art-Schlüssel | Station(en) | Beschreibungstext (gekürzt) |
|---|---|---|
| `hyroxTechnik` | Hürde/Balken | „leaps forward in a dynamic bounding stride over a low hurdle, arms pumping for balance" |
| `hyroxKletter` | Palisade/Seil | „grips a thick rope with both hands and hauls herself upward in a straining pull, legs bracing against a wooden wall" |
| `hyroxKraft` | Wassergraben/Mauer/Strohballen | „leans low and drives forward with both arms braced against a heavy sled, legs pushing hard against the ground" |

**Für `cassandra`** (Spielername „Cassandra", Teil des Standard-Demo-Kaders — `OPP[5]`, eine der
sechs garantiert mitlaufenden Gegnerinnen, s. `bauSpurt()`). Wahl begründet: Cassandra ist laut
PixelLab-Beschreibung „a fit athletic woman" mit Beinen und Armen (anders als z. B. „Tidesprinter",
dessen Figur laut eigenem PixelLab-Prompt „NOT a human: ... Its lower body is a long coiling
serpentine fish tail with a big teal tail fin instead of legs" ist — Hürdensprung/Seilklettern/
Schlittenschieben ergeben für eine beinlose Figur keinen Sinn, deshalb trotz Tidesprinters
prominenter Rolle als schnellster Läufer im Design-Dokument von PR #1368 NICHT gewählt).

Erst geprüft, ob eine der vier **bestehenden** Animationsarten (`walk`/`angriff`/`treffer`/`tod`)
für eine der drei Gruppen bereits brauchbar wäre: keine davon zeigt Hürdensprung/Seilklettern/
Schlittenschieben, nur `angriff` (Ausfallschritt mit Waffe) kommt der Körperhaltung einigermaßen
nahe — deshalb der generische `angriff`-Rückfall für alle Figuren ohne eigene Pose (s. 3.1), UND
echte Neugenerierung für Cassandra, wie vom Auftrag ausdrücklich verlangt („Chris hat hier
ausdrücklich 'mit PixelLab bauen' verlangt").

Technischer Weg: direkte `POST /characters/animations`-Aufrufe (nicht
`scripts/figuren-bestelle-animationen.py`, dessen `ARTEN_KANON` nur die vier Kampf-Grundarten kennt
und das Rendering an Richtung Süd/Ost/Nord koppelt — unnötiger Aufwand für drei Bahn-Posen, die nur
„east" brauchen). Drei Animationen, alle drei innerhalb von ~65 s fertig (PixelLab-Jobwarteschlange,
kein Problem mit Job-Slot-Limits). Export über das bestehende
`scripts/figuren-sprites-export.py --nur cassandra` (unverändert) nach Eintrag der drei neuen
`gid→Art`-Zuordnungen in `data/generated/figuren-sprites-animationsarten.json`.

**`scripts/baue-arena-figuren.mjs` musste erweitert werden:** die feste `ARTEN`-Liste dort kannte
bisher nur `["walk","angriff","treffer","tod"]` — ohne Erweiterung wären die drei neuen Arten im
Figuren-Index zwar vorhanden, aber nie in `battle-mode.figuren.js` gelandet (stumm verworfen,
keine Fehlermeldung). Jetzt: `["walk","angriff","treffer","tod","hyroxTechnik","hyroxKletter","hyroxKraft"]`
— rein additiv, jede Figur ohne diese drei Arten bekommt sie einfach nicht in ihrer `a`-Tabelle
(bit-identisch für alle anderen 359 Figuren, s. `tests/arena-pixel-figuren.test.ts`, das die
generierte Datei gegen den Index prüft).

**Verifikation, dass die Posen im echten Spiel ankommen:** `window.__arena.hyroxKameraProbe()`
wurde um `laeufer:[{n,pos,stolper,hyroxGruppe,fertig}]` erweitert; ein Scratch-Skript
(`debug-pose.mjs`, nicht eingecheckt) pollt alle 60 ms, erkennt den Moment, in dem Cassandras
`stolper>0`/`hyroxGruppe` für jede der drei Gruppen zum ersten Mal gesetzt ist, und fotografiert
die Leinwand genau dann. Ergebnis (dasselbe Rennen, ein Lauf):

| Gruppe | rennT (Sim-s) | Position |
|---|---:|---:|
| TECHNIK | 2,67 | 0,140 (Hürde) |
| KLETTERN | 7,25 | 0,380 (Seil) |
| KRAFT | 11,83 | 0,620 (Wassergraben) |

Alle drei Treffer liegen exakt auf den erwarteten Stationspositionen — die Gruppenzuordnung
(`HYROX_GRUPPE_JE_STATION`) und der Zeichenpfad (`hyroxGid`/`hyroxEigen` in `zeichnePixelFigur()`)
greifen wie entworfen. Bildbelege: `cassandra-pose-technik.png`, `cassandra-pose-kletter.png`,
`cassandra-pose-kraft.png` (Scratch-Verzeichnis dieser Sitzung, nicht Teil des Repos — drei
unterscheidbare Haltungen statt der alten liegenden Pose, s. Screenshots in der PR-Beschreibung).

### 3.3 Ehrlicher Rollout-Stand und Fahrplan

**Fertig:** 3 von 3 Posen für **1 von 12** Standard-Demo-Läufern (Cassandra), alle anderen 11 Läufer
zeigen den generischen `angriff`-Rückfall (PixelLab-Figuren) bzw. die modulierte „slash"-Pose
(Baukasten-Figuren) — beides eine klare Verbesserung gegenüber der alten liegenden Pose, aber noch
nicht gruppen-unterscheidbar.

**Was für den vollen Rollout fehlt:**
- **Alle 12 Standard-Demo-Läufer** (alle haben bereits einen PixelLab-Satz, s. unten): 11 weitere
  Charaktere × 3 Posen = 33 weitere `POST /characters/animations`-Aufrufe. Bei ~65 s je Dreier-Batch
  (diese PR, ein Charakter) realistisch 1–2 Sitzungen Aufwand (API-Zeit unkritisch, der Aufwand
  liegt im Prompt-Text je Charakter — jede Figur hat eine andere Statur/Ausrüstung, ein
  Pauschaltext wie bei Cassandra passt nicht blind auf einen 8-Fuß-Lava-Golem oder eine beinlose
  Nixe, s. 3.2).
- **Der volle 360er-Figuren-Bestand** (analog zur „Nord-Animation für alle 360 Charaktere"
  -Kampagne, 50 Batches à ~5 Figuren über mehrere Sitzungen, `git log --oneline --all -i --grep=
  "nord-animation"`/„Figuren Batch"): realistisch ebenfalls ein mehrsitziges Projekt, nicht Teil
  dieses Auftrags. Dazu kommt eine inhaltliche Hürde, die die Nord-Kampagne nicht hatte: **nicht
  jede der 360 Figuren hat Beine/Arme in menschlicher Anordnung** (Konstrukte, geflügelte Wesen,
  Tentakel-Kreaturen, s. Tidesprinter-Beispiel oben) — ein Pauschal-Rollout bräuchte für jede
  Figur einzeln geprüfte, zur Anatomie passende Beschreibungstexte, nicht nur einen generischen
  Text mit ausgetauschtem Namen. Das ist dieselbe Lektion wie bei den PixelLab-Tod-Animationen
  (CLAUDE.md: „charakterpassend wählen, nicht generisch kippen lassen") — hier auf Arbeitsposen
  übertragen.
- Für Figuren **ohne** eigenen PixelLab-Satz (Baukasten) bliebe der generische `lunge`-Kanal (3.1)
  dauerhaft die einzige Differenzierung, es sei denn, das Projekt entscheidet sich für eine eigene
  LPC-Sprite-Ergänzung (anderer Asset-Pipeline als PixelLab, nicht Teil dieses Auftrags).

## 4. Fingerabdruck-Beleg

```
node scripts/pruefe-wertung-fingerabdruck.mjs
```

| | Vorgabe (CLAUDE.md/PR #1368) | Dieser Branch |
|---|---|---|
| `spiele spurt 1` | `c6674a9c88ac` | `c6674a9c88ac` |
| `spiele spurt 7` | `4f4d574f7de2` | `4f4d574f7de2` |
| `spiele spurt 42` | `b205444457ed` | `b205444457ed` |
| **GESAMT** | `22f04e06e285 (69 Eintraege)` | `22f04e06e285 (69 Eintraege)` |

Bit-identisch. Erwartet: jede Änderung dieser PR sitzt entweder in `kameraUpdate()`/
`zeichneSpurt()`/`zeichneSprite()`/`zeichnePixelFigur()` (reine Zeichenfunktionen, kein `rr()`,
keine Schreibzugriffe auf `u.pos`/`u.fertig`/`wert()`) oder ist ein zusätzliches, rein kosmetisches
Feld (`u.hyroxGruppe`), das `MOTOREN["spurt"].wert()` nie liest.

## 5. Pflichttests

- `node scripts/pruefe-wertung-fingerabdruck.mjs` — bestanden (s. oben).
- `npx vitest run tests/arena-kulissen.test.ts tests/arena-pixel-figuren.test.ts` — bestanden
  (20/20 relevante Tests grün).
- `npx vitest run tests/spiele-bahn-invarianten.test.ts tests/time-trial-pp-margin-formel.test.ts
  tests/bahn-pod-liga.test.ts tests/bahn-pod-vier-teams.test.ts tests/bahn-pod-e2e-real-chromium.test.ts`
  — in dieser Sitzungsumgebung **übersprungen** (`describe.skipIf(!CHROMIUM_VERFUEGBAR)`): die Tests
  erwarten Chromium exakt unter `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, installiert ist
  hier `chromium-1243` (und kein `~/.cache/ms-playwright`-Fallback) — ein **vorbestehender**
  Versionspin-Mismatch dieser Umgebung, nachweislich unabhängig von dieser PR (betrifft alle
  Bahn-Formate gleichermaßen, nicht nur Hyrox). Playwright selbst funktioniert in dieser Umgebung
  einwandfrei (`chromium.launch()` ohne `executablePath` löst `chromium-1243` korrekt auf, s.
  `scripts/screenshot-kulisse.mjs`, das in dieser PR mehrfach erfolgreich lief) — die Testdateien
  müssten lediglich den Pfad-Pin aktualisieren oder einen `~/.cache/ms-playwright`-übergreifenden
  Fallback bekommen, was außerhalb des Auftrags dieser PR liegt. Als Ersatz-Beleg: die Fingerabdruck-
  Prüfung (rho-Neutralität) und die Bild-/Sonden-Belege in Abschnitt 2 und 3.2 (echte, im Browser
  gerenderte Hyrox-Rennen über `screenshot-kulisse.mjs`/`debug-kamera.mjs`/`debug-pose.mjs`).
- `node --check public/mockups/battle-mode.engine.js` — syntaktisch fehlerfrei.
- Bildbeleg: s. Abschnitt 2 (Kamera) und 3.2 (Posen).

## 6. Fundstellen

- `kameraUpdate()`, neuer Hyrox-Zweig direkt nach `istWand()`: `public/mockups/battle-mode.engine.js`.
- `hyroxNaechsteStation()`, `HYROX_CAM_SCHNITT_SEK`: nahe `HYROX_MIN_SEK`.
- `hyroxCamStationIdx`/`hyroxCamNaechsterSchnitt`/`hyroxCamGruppe`: Deklaration nahe
  `bahnHyroxAktiv`/`HYROX_STATIONEN`, Reset in `baueHyroxStationen()`, Save/Restore in
  `bahnAnzeigeSichern()`/`bahnAnzeigeZurueck()`.
- `stepSpurtHyrox()`: `u.hyroxGruppe`-Zuweisung, `kameraUpdate(dt)`-Aufruf am Funktionsende.
- `zeichneHyroxRangleiste()`: neuer Teil von `zeichneHyroxUeberlagerung()`.
- `zeichneSpurt()`: `hyroxAktivPose`/`hyroxProg`/`hyroxLunge`/`hyroxTechnikHop`/`hyroxKraftHaltung`,
  `parcSpriteArg.hyroxPose`/`.hyroxProg`, `down:bahnHyroxAktiv?false:(u.stolper>0)`.
- `zeichnePixelFigur()`: `HYROX_PIXEL_ART`, `hyroxGid`/`hyroxEigen`-Artauswahl, Frame-Formel.
- `window.__arena.hyroxKameraProbe()`: neue QA-Sonde nahe `hyroxGewichte`.
- `scripts/baue-arena-figuren.mjs`: `ARTEN`-Liste um die drei Hyrox-Posen erweitert.
- `data/generated/figuren-sprites.json`/`figuren-sprites-animationsarten.json`,
  `public/sprites/figuren/cassandra/hyrox{Technik,Kletter,Kraft}-east.png`,
  `public/mockups/battle-mode.figuren.js`: neue Cassandra-Animationen (einziger Charakter mit
  eigener Hyrox-Pose, s. Abschnitt 3.3 für den Rollout-Fahrplan).

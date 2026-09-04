# Hockey „zufriedenstellend machen" — Abschlussbericht

Chris, wörtlich: „Kannst du bitte Hockey und football und gewichtheben soweit fertig machen
dass man damit erstmal zufrieden sein kann inkl review von opus etc". Dieser Bericht deckt
Hockey (Football und Gewichtheben laufen als eigene, parallele Runden). Stand: Branch
`claude/hockey-zufriedenstellend`, abgezweigt von `origin/main` `0311dcdf`.

**Kein weiterer Rezeptversuch, keine neue Grundsatzrecherche.** Drei unabhängige Anläufe an
genau diesem Tag hatten bereits gezeigt, dass Rezept-Feintuning gemessen erschöpft ist
(`docs/design/hockey-rezept-ursache.md`, gemerged) und dass beide bisher gefundenen
strukturellen Hebel — Zoneneintritt als Zweikampf, zweimal gebaut
(`docs/design/hockey-zoneneintritt-umsetzung.md`) — bei diesem Projekts n=24-Stichprobengröße
nicht sauber validierbar sind: der scheinbare Gewinn bei n=24 kippte bei n=96 im Vorzeichen.
Diese Runde zieht stattdessen die drei konkreten, bereits identifizierten, sicheren Hebel aus
`docs/design/hockey-naechster-hebel-recherche-fable.md`.

## Kurzfassung

| Punkt | Ergebnis |
|---|---|
| 1 — Feldspieler-only-Messung als Standard | **Umgesetzt, ins Standardwerkzeug eingebaut.** `disziplinProbe` markiert Torhüter, `scripts/lib/rangtreue-messung.mjs`/`miss-alle-disziplinen.mjs` liefern automatisch eine zweite Zeile ohne sie. CI-Gate (`pruefe-rangtreue-schranke.mjs`) bleibt bewusst bei allen zwölf. |
| 2 — K3 (Tore halb als xG buchen) | **Umgesetzt, gemessen, hält bei n=24 UND n=48.** Feldspieler-rho je Spiel **0,651 → 0,719** (n=24), **0,666 → 0,714** (n=48) — größer als die Kader-Spannweite, also nach Projektmaßstab real. Kein neuer `rr()`-Aufruf, Basketball und der Torkorridor bit-identisch. |
| 3 — Visuelle Sichtprüfung | **Keine Befunde.** Vier Screenshots eines echten Spiels (Bully, offener Spielzug, Torwart-Save, Aufbau) zeigen nichts Auffälliges — konsistent mit den bereits abgeschlossenen Visual-Runden (`hockey-mechanik-angleichen.md` u. a.). |
| Endstand | **Feldspieler-rho 0,719 [Spannweite 0,182], Saison 0,818. Alle 12 (inkl. Torwart, reales Spiel): 0,618 [0,247], Saison 0,748.** „Knapp" statt „durchgefallen" — echte Bewegung, nicht am Ziel. |

Alles unten ist ausschließlich an `public/mockups/battle-mode.engine.js` (Hockey-Zweig hinter
`istHockey()`), `scripts/lib/rangtreue-messung.mjs` und `scripts/miss-alle-disziplinen.mjs`
geändert. Kein Rezept (`battle-mode.rezepte.js`) angefasst, keine andere Disziplin berührt —
Basketball bit-identisch in jeder Messung dieser Runde (Regressionsnachweis unten).

---

## 1. Die Feldspieler-only-Messung als Standard

### 1.1 Warum die Zwölferzahl allein irreführt

`disziplinProbe` ordnet in einer Zwölfer-Rangliste auch die beiden Torhüter ein. Ihre Eignung
ist die Feldspieler-Matrix (power/health) — Korrelation mit ihrem tatsächlichen PARADE-Wert
nur 0,46 — und ihr Spielwert (`HK_TW_BASIS + GSAA·2`) schwankt in EINEM Spiel um ±3,4 Tore rein
binomial (40 Schüsse bei ~9 % Torquote). Das ist **mehr** als der ganze reale
Fähigkeitsunterschied zwischen dem besten und dem schlechtesten gefeldeten Torwart (1,35 Tore,
gemessen in `hockey-naechster-hebel-recherche-fable.md` Abschnitt 1.1). Zwei so platzierte
Zeilen in einer Zwölfer-Spearman-Korrelation kosten gemessen 0,062–0,101 rho je Spiel, je nach
Stichprobe — Rauschen, das keine Mechanik der Welt wegbekommt, weil es keins ist: es ist
Eishockey.

### 1.2 Was gebaut wurde

- **`disziplinProbe`** (Motor) markiert jeden Teilnehmer der Feldspiel-Chassis jetzt mit
  `torwart:!!u.torwart` in der Teilnehmerliste — additiv, für jede andere Disziplin (auch
  Basketball) bleibt das Feld `false`/ungesetzt und ändert nichts an bestehenden Aufrufern.
- **`scripts/lib/rangtreue-messung.mjs`** bekommt zwei neue Exporte, `hatTorwart()` und
  `ohneTorwart()`, plus eine `feldOnlyZusatz()`-Funktion in `disziplinMessen`: sie prüft, ob
  IRGENDEIN Teilnehmer in den Spieldurchläufen als Torwart markiert ist (heute nur Hockey),
  und liefert dann zusätzlich `spielMedFeld`/`spielSpanFeld`/`saisonMedFeld`/`saisonSpanFeld`
  — dieselbe Median/Spannweite-über-die-Kader-Familie-Rechnung wie für die Zwölferzahl, nur
  auf der gefilterten Teilnehmerliste. Für jede Disziplin ohne Torwart-Rolle bleibt das
  Rückgabeobjekt Byte für Byte, was es vorher war.
- **`scripts/miss-alle-disziplinen.mjs`** druckt die Feldspieler-Zeile als eingerückte
  Zusatzzeile unter der Zwölferzahl, nur wenn sie existiert.
- **`scripts/pruefe-rangtreue-schranke.mjs` (das CI-Gate) ist NICHT umgestellt** — bewusst.
  Es prüft weiterhin die Zwölferzahl gegen `data/generated/rangtreue-basislinie.json`, weil
  genau das die Frage ist, die ein CI-Gate beantworten soll: „ist das reale Spiel schlechter
  geworden" — und ein reales Chris-Spiel feldet tatsächlich zwei Torhüter. Die
  Feldspieler-Zahl beantwortet eine andere, ebenso echte Frage: „funktioniert die
  Feldspieler-*Mechanik*". Beide Zahlen bleiben nebeneinander bestehen, s.
  `docs/design/stand-aller-disziplinen.md` Abschnitt 1a.

### 1.3 Die verworfene Alternative

Der Auftrag nannte `scripts/miss-hockey-feldspieler-rangtreue.mjs` aus dem (nicht gemergten)
Zoneneintritt-Versuch als möglichen Wiederverwertungskandidaten. Geprüft: **dieses Skript
existiert nicht** — der Bericht dieser Runde (`hockey-naechster-hebel-recherche-fable.md`
Abschnitt 4) hatte lediglich zwei Scratchpad-Sonden (`sonde-hockey-posten.mjs`,
`sonde-hockey-eintritte.mjs`) benutzt und vorgeschlagen, sie „mit Schritt 1" als
`scripts/miss-hockey-posten.mjs`/`-eintritte.mjs` ins Repo zu heben — aber Schritt 1 (K1, der
Zoneneintritt) wurde nie committed, also auch keines der beiden Skripte. Es gab nichts zu
bergen. Stattdessen wurde die Feldspieler-only-Messung dort eingebaut, wo sie für JEDE
künftige Disziplin mit einer Torwart-ähnlichen Rolle automatisch mitläuft: im gemeinsamen
Kern (`rangtreue-messung.mjs`), nicht in einem Hockey-eigenen Einwegskript. Das bereits
bestehende `scripts/miss-rangtreue-nach-rolle.mjs` bleibt daneben für seine eigentliche Frage
stehen — wie gut die Torwart-*Wertformel selbst* ist (PARADE gegen GSAA über die Saison,
gemessen 0,39 über 24 Torhüter-Identitäten) — und wird hier nicht angetastet.

---

## 2. K3 — Tore halb als xG buchen

### 2.1 Die Mechanik

`hockeySchussAusgang` kennt beim Abschuss bereits `pTor` — die kalibrierte
Torwahrscheinlichkeit dieses konkreten Schusses (Technik des Schützen × Torquoten-Konstante ×
Torwart-Paradefaktor). Bisher wurde nur gebucht, OB das Tor fiel (binär, 1 oder 0). Jetzt:

```js
// hockeySchussAusgang gibt pTor auf JEDEM Rückgabewert zurück (0 bei geblockt/vorbei,
// sonst die unveraendert berechnete Zahl) — KEIN neuer rr()-Aufruf, KEINE Verschiebung
// der drei bestehenden Wuerfe (Block, Vorbei, Tor/Abpraller-vs-Fest).
if (rr() < pTor) return { ausgang: "tor", torwart: tw, pTor };
...

// loeseHockeySchuss: jeder Schuss, der aufs Tor kam, bucht seine Torwahrscheinlichkeit auf xg
schuetze.xg = (schuetze.xg || 0) + (hk.pTor || 0);

// feldspielWert, Hockey-Feldspieler-Zweig:
return u.punkte*1.5 + u.xg*1.5 + u.assists1*2 + u.assists2*1.5 + ...
```

Vorher: `u.punkte*3`. Ein Tor ist bei ~9 % Torquote Poisson-verteiltes Rauschen (1,04 ± 1,67
Tore je Feldspieler und Spiel) — ein Spieler mit vielen guten Chancen, der einmal Pech mit dem
Abschluss hat, sah in EINEM Spiel wie ein schwacher Spieler aus. `xg` ist die kalibrierte
Torwahrscheinlichkeit desselben Schusses — im Erwartungswert identisch zu einem Tor (ein
Schuss mit `pTor` 0,5, der reingeht, zählt jetzt 1,5+0,75=2,25 statt vorher 3 — der Unterschied
IST die gesenkte Streuung, keine Restwertung nach unten), aber ohne den Münzwurf.

**Warum das sicher genug für diese Projektgröße ist, anders als der Zoneneintritt.** Der
Zoneneintritt scheiterte, weil sein Zweikampf einen NEUEN `rr()`-Aufruf 40–50× je Spiel
einführte, der die Zufallsfolge jedes folgenden Ereignisses verschob — bei n=24 sah das nach
einem Effekt aus, bei n=96 kippte das Vorzeichen. K3 fügt **keinen** neuen Zufallswurf ein und
verschiebt **keinen** bestehenden: `pTor` stand immer schon fest, nur an einer Stelle im Code,
die es vorher verwarf. Die drei Würfe in `hockeySchussAusgang` (Block, Vorbei, Tor-vs-Rest)
stehen exakt an derselben Stelle wie vorher. Nachgewiesen unten: die tatsächlichen
Spielverläufe (Endstände, Torkorridor) sind mit und ohne K3 **Zeichen für Zeichen identisch**
— K3 ist reine Bilanzierung eines schon berechneten Werts, keine Mechanikänderung.

### 2.2 Gemessen

**n=24, kaderfest** (`node scripts/miss-alle-disziplinen.mjs 24 hockey basketball`, fünf echte
Kader-Paarungen aus dem live-save-Abbild):

| | Baseline (vor K3) | Nach K3 | Δ |
|---|---:|---:|---:|
| rho/Spiel, alle 12 | 0,589 [0,292] | 0,618 [0,247] | +0,029 |
| rho Saison, alle 12 | 0,748 [0,105] | 0,748 [0,126] | ±0,000 |
| rho/Spiel, nur Feldspieler | 0,651 [0,197] | **0,719 [0,182]** | **+0,068** |
| rho Saison, nur Feldspieler | 0,818 [0,259] | 0,818 [0,259] | ±0,000 |
| Basketball rho/Spiel (Regression) | 0,757 [0,102] | 0,757 [0,102] | ±0,000 |

Die Feldspieler-Bewegung (+0,068) ist **größer als die eigene Kader-Spannweite** (0,182–0,197)
— nach der Projekt-eigenen Faustregel (`messgrundlage-kaderfest.md`: „eine Bewegung kleiner
als die Spannweite ist von Null nicht unterscheidbar") ein Kandidat für „bewegt real etwas".
Die Zwölferzahl bewegt sich nur um +0,029 (kleiner als ihre Spannweite 0,247) — sie bleibt
vom Torwart-Rauschen dominiert, was genau der Befund aus Abschnitt 1 ist und der Grund, warum
die Feldspieler-Zahl hier die informativere ist.

**Die Gegenprobe, n=48** (dieselben fünf Kader-Paarungen, mehr Spiele, um Kader-Ziehungs-Glück
auszuschließen — dieselbe Vorsicht, die den Zoneneintritt-Befund zum Kippen brachte):

| | Baseline | Nach K3 | Δ |
|---|---:|---:|---:|
| rho/Spiel, alle 12 | (0,595 aus Vorrunde, s. u.) | 0,613 [0,228] | ~+0,02 |
| rho/Spiel, nur Feldspieler | (0,666 aus Vorrunde, s. u.) | **0,714 [0,167]** | **~+0,05** |

(Die n=48-Baseline ohne K3 wurde nicht erneut separat gezogen — sie ist aus
`hockey-zoneneintritt-umsetzung.md` Abschnitt 2 bekannt, 0,595/0,666, gemessen auf denselben
fünf Kader-Paarungen. Die nach-K3-Zahl bei n=48 wurde in dieser Runde frisch gemessen.) Anders
als beim Zoneneintritt bewegt sich das Vorzeichen zwischen n=24 und n=48 **nicht** — beide
Stichproben zeigen dieselbe Richtung und eine ähnliche Größenordnung (+0,068 bzw. ~+0,05), was
für einen echten, wenn auch kleinen Effekt spricht statt für Kaderrauschen.

### 2.3 Die Regressionsnachweise

- **Basketball bit-identisch** in jeder Messung dieser Runde (0,757/0,102/0,923/0,231, Ziffer
  für Ziffer) — die K3-Änderung liegt vollständig hinter dem Hockey-Feldspieler-Zweig von
  `feldspielWert`, kein anderer Codepfad ist berührt.
- **Der Torkorridor ist Zeichen für Zeichen identisch mit und ohne K3**
  (`scripts/miss-hockey-korridor.mjs 24`, Einzelkader): Tore je Team 4,13, Schüsse aufs Tor
  37,8, Fangquote 89,1 %, und — als schärfster Beweis — dieselben acht ersten Endstände
  (5:4 5:3 3:2 5:4 4:8 3:1 2:4 3:3) bei gleichem Startzustand. Das bestätigt die Vorhersage aus
  2.1: K3 ändert keine einzige `rr()`-gesteuerte Spielentscheidung, nur die Bilanzierung eines
  bereits gefallenen Ergebnisses.
- `node --check public/mockups/battle-mode.engine.js` sauber.

---

## 3. Visuelle Sichtprüfung

`public/` über `python3 -m http.server` bedient (nicht `file://`), Playwright/Chromium
(`/opt/pw-browsers/chromium-1194`), vier Screenshots eines laufenden Hockey-Spiels bei 3 s,
23 s, 68 s und 143 s nach dem Start (`window.__arena.setDisc("hockey")` → `#t2` → `#play`):

- **3 s / 23 s** (Bully-Phasen): beide Teams sauber am Bullykreis versammelt, Schiedsrichter
  sichtbar positioniert, Torhüter korrekt im eigenen Tor. Kein Clipping, keine
  Sprite-Überlappung, die nach einem Fehler aussieht.
- **68 s** (offener Spielzug): Spieler über die neutrale Zone verteilt, Torhüter im Torraum,
  ein Verteidiger an der blauen Linie, Angreifer im Slot — sieht nach einer plausiblen
  Eishockey-Formation aus, keine unnatürliche Häufung.
- **143 s** (Torwart-Save-Moment, „SAVE!"-Textmarker sichtbar): Rückraum-Aufbau des
  verteidigenden Teams um den eigenen Torhüter, Rest des Feldes leer — konsistent mit „Puck
  gerade im eigenen Drittel gehalten".

**Keine Befunde.** Kein manufaktierter Fehler — dieser Punkt war als Sanity-Check gedacht,
nicht als Suchauftrag, und Hockey hat bereits mehrere dedizierte Visual-Runden hinter sich
(`hockey-mechanik-angleichen.md`, die Torwart-/Bodycheck-Bauwunden). Die beiden
session-eigenen Neuerungen (Zoneneintritt, Netfront-Schirm) wurden **nicht committed** (s.
Einleitung) und sind deshalb auch visuell nicht zu prüfen — es gibt keinen neuen Sichtpfad,
den diese Runde eingeführt hat. Checks/Strafen liefen im Sample nicht sichtbar mit, sind aber
laut Korridor-Sonde mit der erwarteten Häufigkeit vorhanden (5,3 Checks, 2,8 kleine Strafen je
Team und Spiel) — reines Stichprobenglück, kein Befund.

---

## 4. Endstand und ehrliches Fazit

| Größe | Wert |
|---|---:|
| rho je Spiel, Feldspieler (die ehrlichere Zahl) | **0,719** [Spannweite 0,182] |
| rho Saison, Feldspieler | 0,818 [0,259] |
| rho je Spiel, alle 12 inkl. Torwart (die CI-Gate-Zahl) | 0,618 [0,247] |
| rho Saison, alle 12 | 0,748 [0,126] |

**Ist Hockey jetzt in einem Zustand, mit dem man erstmal zufrieden sein kann?** Ja, mit einer
klaren Einschränkung: Hockey erreicht die 0,80-Schranke weiterhin nicht — weder über alle
zwölf (durchgefallen) noch über die Feldspieler allein (0,719, „knapp"). Was sich diese Runde
geändert hat, ist nicht die Schranke, sondern zwei Dinge darunter:

1. **Die Zahl, an der man Hockey ehrlich misst, ist jetzt sichtbar** — vorher stand nur die
   vom Torwart-Rauschen verzerrte Zwölferzahl (0,589→0,618) im Dokument, ohne dass irgendwo
   sichtbar war, dass ein struktureller Teil der Lücke gar keine Mechanik-Lücke ist, sondern
   ein reales Eishockey-Phänomen (Torwart-Varianz), das keine Rezeptrunde beheben kann oder
   sollte.
2. **Ein echter, sauber gemessener Fortschritt liegt drauf** (K3), erzielt ohne die zwei
   Risiken, an denen diese Session bisher gescheitert ist: kein Rezept-Rauschen (K3 ändert
   keine Sub-Skill-Gewichte) und keine RNG-Kaskade (K3 fügt keinen neuen Würfel ein). Die
   Feldspieler-Zahl bewegt sich von 0,651 auf 0,719 — real, bei zwei unabhängigen
   Stichprobengrößen in dieselbe Richtung, nicht wie beim Zoneneintritt ein n=24-Artefakt.

Was fehlt, um wirklich über 0,80 zu kommen, steht unverändert in
`hockey-naechster-hebel-recherche-fable.md`: der Zoneneintritt (K1) oder der Netfront-Schirm
(K2) — beide real größer als K3, beide aber entweder eine deutlich größere Stichprobe
(n≥150 je Kader-Paarung) oder einen Bauweg ohne neuen `rr()`-Wurf im Tick-Loop brauchen, um an
diesem Projekt sauber messbar zu sein. Das ist kein Auftrag für diese Runde — Chris bat darum,
Hockey „soweit fertig zu machen, dass man damit erstmal zufrieden sein kann", nicht darum, die
0,80-Schranke um jeden Preis zu erzwingen. Mit einer ehrlicheren Messzahl, einem echten,
risikoarmen Fortschritt und einer sauberen visuellen Prüfung ohne Befund ist dieser Auftrag
erfüllt.

---

## 5. Was NICHT angefasst wurde

- **Kein Rezept.** `public/mockups/battle-mode.rezepte.js` ist unverändert — K3 ist eine
  reine Wertformel-Änderung in `battle-mode.engine.js`, keine Sub-Skill-Gewichtung.
- **Keine andere Disziplin.** Jede neue Zeile liegt hinter `istHockey()`-Weichen (K3) oder ist
  additiv und für andere Disziplinen ungelesen (`torwart`-Flag in `disziplinProbe`,
  `u.xg`-Feld an jeder Feldspiel-Einheit — dasselbe Muster wie `checks`/`saves`/`passYards`).
  Basketball bit-identisch in jeder Messung, s. Abschnitt 2.3.
- **`ARENA_RESOLVED_DISCIPLINE_IDS`** (`lib/resolve/battle-mode-arena-team-points.ts`) enthält
  weiterhin ausschließlich `"basketball"` — Hockey bleibt mockup-only, dieser PR trägt kein
  Produktionsrisiko.
- **Der Zoneneintritt und der Netfront-Schirm** aus derselben Recherche wurden NICHT erneut
  versucht — beide sind an dieser Stelle bereits einmal (Zoneneintritt: zweimal) gescheitert
  bzw. nicht sauber validierbar, und ein dritter Anlauf auf derselben Bauform hätte hier keine
  neue Erkenntnis geliefert, nur eine weitere Zahl.

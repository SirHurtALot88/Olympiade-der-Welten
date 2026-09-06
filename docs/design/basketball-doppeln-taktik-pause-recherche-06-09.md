# Basketball: Fokus-Doppeln als Viertelpausen-Taktik — Recherche (06.09.)

**Reine Recherche. Keine Codeänderung, kein Prototyp im Repo.** Alle Datei-/Zeilenangaben sind
gegen `origin/main` = `9036cef3` geprüft. Eine eigene Scratch-Messung (Abschnitt 4.2) lief gegen
denselben Stand, ist aber nicht Teil dieses Commits — sie nutzt ausschließlich bereits
vorhandene, produktive `window.__arena`-Einstiegspunkte, keine Codeänderung an
`battle-mode.engine.js`.

## 0. Ausgangslage und Chris' Vorgabe

Chris, im Zuge eines separaten Basketball-Auftrags (Viertellänge/Pausen-Buzzer, parallel bei
einem anderen Agenten):

> „basketball sollte doch 1,5 minuten lange viertel haben mit pause, da fehlt der pausen buzzer
> dann müsste man ja auswählen können wen ein spieler doppelt usw überleg dir mal was da sinn
> machen könnte als vorgabe"

Diese Recherche behandelt **nur** den zweiten Teil: die Idee, während einer Viertelpause eine
taktische Anpassung zu erlauben — allen voran, wen ein eigener Verteidiger doppelt — und was
als **Vorgabe** (Default) sinnvoll ist, wenn der Manager nicht eingreift. Die Viertellänge/der
Buzzer selbst ist nicht Gegenstand hier.

**Der wichtigste Befund vorweg, weil er die ganze Aufgabe umsortiert:** Die Mechanik, nach der
Chris fragt, **existiert bereits vollständig** — sowohl die KI-Seite (Hilfsverteidigung mit
Bias) als auch die manuelle Auswahl per Klick. Gebaut am 29.08. (PR #685, „Basketball:
Fokus-Doppeln — einen Gegner markieren, die Hilfsverteidigung geht auf ihn"), auf Chris' eigene
Formulierung von damals:

> „vllt waere es cool wenn man fokussieren koennte also ich kann zb einen spieler der gegner
> selektieren und der wird dann mehr von help defense gedoppelt." (`battle-mode.engine.js:5116-5121`)

Was fehlt, ist nicht die Mechanik und nicht die Bedienung — es ist die **Anbindung an das
Spiel, das tatsächlich zählt** (Abschnitt 1.4), und die Frage, die Chris heute stellt: **ein
Standardverhalten, wenn niemand klickt.** Genau darauf antwortet dieses Dokument.

---

## 1. Ist-Zustand: was schon da ist, und wo die eigentliche Lücke sitzt

### 1.1 Die KI-Mechanik: Fokus-Doppeln (bereits gebaut, kalibriert, produktiv im Live-Motor)

`battle-mode.engine.js:5115-5153` definiert die Konstanten, `bewegeSpielerLive` (Aufrufstelle
der `HILFE_RADIUS`-Logik, Kommentarblock ab `:5115`) die Wirkung. Zusammengefasst:

- Hilfsverteidigung (ein zweiter Mann kommt zum Ballführer) **existierte schon vorher**
  (`HILFE_RADIUS`, generisches Help-Defense). Neu war ausschließlich eine **Gewichtung**
  ihrer Auslösung, wenn der Ballführer der vom Nutzer gewählte Spieler ist
  (`fsLive.fokusZiel`).
- Bewusst ein **Bias, keine Sperre**: „der Fokussierte darf weiter alles tun, es kommt nur
  oefter und frueher ein zweiter Mann" (`:5120-5121`).
- Ohne gesetzten Fokus (`fokusZiel===null`) ist die Wirkung **beweisbar null** — über 60 volle
  Spiele bit-identische Ereignisprotokolle zum Stand davor (`:5127-5129`). Das ist die
  Rückversicherung, die die bestehende Pp-Balance (PR #682) nicht verschiebt.
- Kalibrierte Stärke, direkt aus dem Code: mit Fokus steigt die gemessene **Doppel-Dichte am
  markierten Spieler von 5,1 % auf 7,0 %** der Ballbesitze (`:5144`, `fokus-mess.mjs`, erste
  Fassung) — ein Bias von rund +1,9 Prozentpunkten, kein Schalter.
- Was ein Doppel selbst kostet, wenn es eintritt (`entscheideBallaktion`, `:7370-7645`):
  `doppelMalus=0.26` auf die Wurftechnik (`:7443`), `kickOutChance` springt von
  `min(0.85, bedraengnisGate*2.0)` auf **0,90** (`:7603`) — mit realer Referenz im Kommentar
  (arXiv:1803.02940: gedoppelte Ballführer werfen in der Realität nur in ~6 % der Fälle
  selbst). Das Doppel wirkt also vor allem über **erzwungene Abgaben**, nicht über eine
  schlechtere Trefferquote des Fokussierten selbst — bestätigt in der eigenen Messung unten.

**Einordnung für die Standing-Context-Frage aus dem Auftrag:** Das hier ist **nicht** dasselbe
System wie `PERS`/`PERSDEF`/`PERSZIEL`/`PERSORD` (`:3357-3429`). Jenes System (Persönlichkeit →
Befehl/Zielpriorität/drei Verhaltensskalen, inkl. `ziel:"bedrohung"` beim „Duellant") gehört zum
**Duell/TDM-Chassis** (`baueEinheit`, Kampf-Disziplinen mit LP/ANG/VER/TMP/AUS) — strukturell
komplett getrennt vom Feldspiel-Chassis, das Basketball fährt (`bauFeldspiel`). Und: dort ist
die Zielpriorität **bereits heute per Dropdown manuell wählbar** (`:12305-12313`,
`<select aria-label="Zielpriorität …">`, mit „★" markiertem Persönlichkeits-Default) — die
Prämisse der parallel laufenden Hockey/Takeshi-Recherche, das sei dort „latent, aber nicht
UI-exponiert", trifft für das Duell-Chassis so nicht zu und sollte dort geprüft werden. Für
Basketball ist der PERS-Fund ohnehin irrelevant: Fokus-Doppeln ist ein **eigenes,
Basketball-eigenes System**, unabhängig von PERS entstanden und vom Hockey-Rollout-Plan bereits
als das Muster für „Forecheck-Ziel" vorgesehen (`docs/design/hockey-rollout-plan.md:36,43,530`;
`docs/design/hockey-torwart-puck-tore-recherche-fable.md:356,515`) — die Übertragbarkeit ist
also schon woanders dokumentiert, nicht neu zu erfinden.

### 1.2 Die Bedienung: bereits gebaut, bereits „jederzeit", nicht an Viertelpausen gebunden

`battle-mode.engine.js:17967-18110` („FOKUS-DOPPELN — die Bedienseite"):

- **Zwei Wege zur Auswahl**, beide auf dieselbe Funktion (`fokusUmschalten(id)`, `:17993`):
  Klick auf einen gegnerischen Spieler direkt im Spielfeld, oder Klick auf seine Kachel in der
  Kaderleiste (robuster, weil die Figuren auf dem Feld laufen — `mousedown` statt `click`
  wegen ständigem Neu-Rendern, `:18027-18038`).
  „Ein Klick auf denselben Spieler hebt den Fokus auf, ein Klick auf einen anderen ersetzt
  ihn — ein Zustand, kein Stapel" (`:17991-17992`). Nur Gegner sind wählbar.
- **Jederzeit änderbar**, nicht an eine Phase gebunden: `fokusAuswahlMoeglich()` (`:17984-17986`)
  prüft nur `LIVE() && istFeldspiel(disc) && !!fsLive` — **nicht** `fsLive.phase`. Ein Manager
  kann den Fokus schon heute mitten im Spiel setzen, während der Freiwurf-Standphase, oder
  während einer Viertelpause — die Funktion unterscheidet nicht.
- Sichtbarkeit: eine eigene Statuszeile („Fokus-Doppeln auf **X** — die Hilfsverteidigung geht
  bevorzugt auf ihn.", `:18013-18020`), eine Signalfarbe `FOKUS_FARBE="#ffb02e"` auf Feld-Ring,
  Kopf-Pfeil, HUD-Zeile und Kaderleisten-Kachel (`:5131-5134`, `:18441-18446`).
- **Nur Basketball** kann das überhaupt: „es ist die einzige Disziplin mit einer Live-Engine.
  Football/Hockey/Tennis rechnen ihren Verlauf weiter vorab durch" (`:17980-17983`).
- **Für die Abnahme bereits vorbereitet:** `window.__arena.spieleBasketball(saat, fokusName)`
  (`:19980`) spielt ein Spiel headless mit gesetztem Fokus durch — genau das Werkzeug, mit dem
  PR #685 seinerzeit kalibriert wurde und das die eigene Messung unten (Abschnitt 4.2)
  wiederverwendet.

**Fazit Abschnitt 1.1/1.2:** Die Aufgabe „AI-Logik bauen" + „UI zum Steuern bauen" ist **bereits
erledigt**, seit einer Woche, produktiv. Chris' heutiger Satz beschreibt kein fehlendes
Feature — er beschreibt (vermutlich ohne es mit dem 29.08.-Feature zu verknüpfen) denselben
Wunsch noch einmal, diesmal im Kontext der Viertelpause.

### 1.3 Die Viertel-Struktur selbst existiert schon — inklusive Pause

Auch das ist kein weißes Blatt. `battle-mode.engine.js:4835-4854` (Auftrag vom 01.09., korrigiert
auf Chris' Nachfrage „hatten wir nicht gesagt ein Viertel dauert 1:30 Minute?"):

```
VIERTEL_ANZAHL_BASKETBALL = 4
VIERTEL_DAUER_BASKETBALL  = 90     // 1:30, exakt was Chris heute nochmal nennt
SPIELDAUER_BASKETBALL     = 360    // 4 × 90
VIERTELPAUSE_DAUER_BASKETBALL = 1.0   // in Simulationssekunden
```

Die Pause selbst ist ebenfalls bereits gebaut (`starteViertelpause`, `:7133-7169`;
Wiederanpfiff-Zweig in `stepFeldspiel`, `:9161-9173`): Ball wird geräumt, Uhr steht, eine
automatische Rotation (`zuordneSlots(seite, liegtZurueck(seite))`) läuft für beide Teams. **Die
Manndeckung wird bewusst NICHT neu zugeteilt** in der Pause selbst — nachgemessen, dass ein
vorgezogener `zuordneDeckung(true)`-Aufruf rho beschädigt (0,722 statt 0,740 Ziel, `:7149-7161`).
Das ist ein wichtiger Präzedenzfall für Abschnitt 4: **eine Intervention genau am
Viertelübergang wurde hier schon einmal gemessen und wegen Rho-Schaden verworfen** — die Latte
für jede neue Pausen-Intervention liegt entsprechend hoch.

Zwei Einordnungen für den parallelen Auftrag (nicht Gegenstand hier, nur zur Abgrenzung):

1. Die von Chris heute genannte Viertellänge (1,5 Minuten) **ist bereits genau so im Code**,
   seit 01.09. Was fehlt, ist ausdrücklich der **Buzzer** (Ton/Signal) und vermutlich eine
   wahrnehmbare Pausendauer — `VIERTELPAUSE_DAUER_BASKETBALL=1.0` sind bei
   `ZEIT_DEHNUNG.basketball=2` (`:4844`) rund **zwei Echtzeitsekunden**. Das ist zu kurz, um
   überhaupt etwas zu lesen, geschweige denn eine taktische Wahl zu treffen — jeder
   Vorschlag in Abschnitt 2 unten **hängt an einer längeren Pause**, die der parallele Auftrag
   vermutlich ohnehin liefert.
2. Damit ein Manager während der Pause etwas *wählen* kann, muss die Pause lang genug für eine
   UI-Interaktion sein — reine Konsequenz aus Punkt 1, hier nicht weiter vertieft.

### 1.4 Die eigentliche Lücke: die Wahl wirkt auf keinen einzigen echten Spielstand

Das ist der Befund, der die Aufgabe am stärksten umsortiert. Die „Battle Arena"-Ansicht, in der
Fokus-Doppeln bedienbar ist, ist **kein Teil der Saison-Spieltag-Abwicklung** — sie ist ein
eigener, frei wählbarer Navigationspunkt:

- `app/foundation/FoundationShellRouterBody.tsx:3269` rendert `FoundationBattleArenaHost` nur
  unter `activeView === "battleArena"` — einem eigenständigen Tab, in dem der Nutzer **zwei
  beliebige Teams** wählt (`listeArenaTeams`/`ArenaTeamAuswahl`), nicht zwingend die heutige
  Spieltagspaarung.
- Der Host selbst beschreibt sich als „der Entwurf des Battle Mode, im Spiel sichtbar" —
  „Die Frage, die der Entwurf beantworten soll, ist 'wie fuehlt sich das im Spiel an?'"
  (`FoundationBattleArenaHost.tsx:15-19`). `docs/BATTLE_ARENA_UEBERGABE.md:17` nennt die ganze
  Battle Arena „ein *zuschaubarer Auto-Battler*".
- Der **echte** Spieltag eines Battle-Mode-Saves wird **headless** aufgelöst:
  `lib/season/arena-matchday-resolve-service.ts` (`kickoffArenaMatchdayApply`, `:218`) startet
  einen Playwright-Hintergrundlauf über `runArenaFixtures` (`lib/battle/arena-headless-runner.ts`),
  der für **alle** Spiele des Spieltags (8–16 Duelle auf einmal, `:19-20` dort) —
  einschließlich des Teams des Nutzers — `window.__arena.spieleFeldspiel(fd, saat)` aufruft
  (`arena-headless-runner.ts:409,517`).
- **`spieleFeldspiel(fd, saat)` (`battle-mode.engine.js:19577-19590`) kennt kein `fokusName`.**
  Es baut auf, simuliert `M.lauf()`, liest den Boxscore — `fsLive.fokusZiel` bleibt für die
  gesamte Dauer `null`. Kein Aufrufer dieser Funktion setzt es je.

**Konsequenz:** Was auch immer ein Nutzer heute im „Battle Arena"-Tab anklickt, hat **keinerlei
Einfluss** auf das Ergebnis, das für Tabelle, Preisgeld, Formkarten oder irgendetwas sonst
zählt. Die Mechanik ist real, kalibriert und bedienbar — aber sie hängt an einer Ansicht, die
strukturell vom Ergebnis-Pfad getrennt ist. **Bevor eine Viertelpausen-Bedienung überhaupt
Sinn ergibt, muss geklärt sein, ob und wie ein Battle-Mode-Spieltag den Nutzer sein eigenes
Spiel live erleben lässt** — heute ist das nicht der Fall; jedes Spiel, auch das des Nutzers,
läuft unbeobachtet und ohne Eingriffsmöglichkeit im Hintergrund.

Das ist keine Randnotiz, sondern der zentrale Fund dieser Recherche: **Chris' Wunsch, wörtlich
genommen, ist noch nicht baubar**, ohne vorher diese Anbindung zu klären. Alles, was danach
folgt (Abschnitt 2–5), gilt für den Fall, dass diese Anbindung entweder schon existiert (und
diese Recherche sie übersehen hat — dann bitte gegenprüfen) oder als eigener, vorgelagerter
Auftrag gebaut wird.

---

## 2. Design-Vorschlag: die Viertelpause als Entscheidungsmoment

Unter der Annahme, dass (a) die Pause lang genug wird (Abschnitt 1.3) und (b) die Anbindung ans
echte Ergebnis existiert oder gebaut wird (Abschnitt 1.4):

### 2.1 Kein neues Feature — dasselbe Feature, prominent an einem neuen Moment gezeigt

Die richtige Antwort ist **nicht**, Fokus-Doppeln neu zu bauen, sondern die **bestehende**
Fokuszeile/Kaderleisten-Auswahl (`renderFokusZeile`, `:18000-18023`) beim Eintritt in
`fsLive.phase==="viertelpause"` **aktiv in den Vordergrund zu holen** — z. B. als kurzer,
nicht blockierender Hinweis-Zustand („Wen soll [Team] im nächsten Viertel doppeln?" mit der
Kaderleiste des Gegners direkt darunter), statt der beiläufigen Statuszeile, die während des
laufenden Spiels leicht übersehen wird. Technisch ändert sich an `fokusUmschalten`/`fsLive.
fokusZiel` nichts — nur *wann und wie auffällig* die Bedienung angeboten wird.

Grund, warum das genügt: Der Nutzer kann den Fokus schon jederzeit ändern (Abschnitt 1.2) — das
Problem ist nicht die fehlende Möglichkeit, sondern dass ein Klick mitten im hektischen
Live-Geschehen leicht ausbleibt oder daneben geht. Die Pause ist der natürliche Moment, in dem
ohnehin nichts in Bewegung ist (`fsLive.ball.traeger=null`, `:7164`) — der ideale Zeitpunkt für
eine bewusste, nicht zeitkritische Entscheidung, ohne dass die freie Jederzeit-Bedienung während
des laufenden Spiels deswegen verschwindet.

### 2.2 Die zweite Stellschraube („usw"): bewusst KEINE zweite bauen

Chris nennt Doppeln als Beispiel und deutet mit „usw" eine Kategorie an, ohne eine zweite
Auswahl konkret zu benennen. Zwei naheliegende Kandidaten wurden geprüft und **beide
verworfen**, aus demselben Grund:

- **Manndeckungs-Zuordnung ändern** (Manager weist einem Verteidiger einen anderen Gegner zu):
  Genau das wurde in Abschnitt 1.3 bereits gemessen und **wegen Rho-Schaden verworfen** — ein
  vorgezogener `zuordneDeckung(true)`-Aufruf am Viertelübergang zog rho auf 0,722 (Ziel 0,740).
  Eine manuelle Variante desselben Eingriffs trüge dasselbe Risiko, nur diesmal ohne die
  Kontrolle, die ein automatischer, gemessener Aufruf hätte.
- **Rotation manuell steuern**: Die Rotation am Viertelübergang läuft bereits automatisch
  (`zuordneSlots(seite, liegtZurueck(seite))`, `:7147-7148`, an eine Regel gekoppelt — „liegt
  zurück" —, nicht an manuellen Klick). Sie manuell überschreibbar zu machen wäre ein zweiter,
  eigener Regelkreis neben einem bereits funktionierenden automatischen — zusätzlicher Aufwand
  ohne erkennbaren Chris-Wunsch dahinter.

**Empfehlung: Scope auf Fokus-Doppeln allein halten.** Das deckt sich mit Chris' eigenem
Formulierungsmuster in diesem Projekt (ein Beispiel nennen, „überleg dir was Sinn macht" —
nicht „bau folgende Liste"), und mit der Faustregel aus `battle-arena-multi-disziplin-plan.md`
Punkt 3 („Fokus-Doppeln … die einzige neue Interaktionsart" in der sonst reinen
Zuschau-Arena). Eine zweite Wahlmöglichkeit jetzt zu erfinden wäre Kitchen-Sink-Gefahr ohne
konkreten Auftrag.

---

## 3. Der Standardwert — Chris' eigentliche Frage

„Überleg dir mal was da Sinn machen könnte als Vorgabe" — das ist die konkrete Frage, die
beantwortet werden soll. Drei Kandidaten, gegeneinander abgewogen:

| Vorgabe | Für | Gegen |
|---|---|---|
| **A. Aus** (heutiger Zustand, `fokusZiel=null`) | Rho-neutral per Konstruktion (bit-identisch belegt, `:5127-5129`); ändert nichts am kalibrierten Stand | Beantwortet Chris' Frage nicht — er fragt explizit nach einer Vorgabe, die etwas TUT |
| **B. Statisch: höchste Eignung des Gegners** (im Feld, ohne Torwart-Analog) | Realistisch (Trainer doppeln den erkennbar besten Spieler, nicht den zufällig heißesten); an EINER stabilen, rauscharmen Größe verankert (`u.eig`), nicht an wenigen Ereignissen | Muss je Viertel neu geprüft werden (Verletzung/Foul-Wechsel), sonst zeigt die Anzeige einen falschen Namen |
| **C. Reaktiv: wer im letzten Viertel am meisten getroffen hat** | Erzählerisch naheliegend, passt zum Blick auf den Boxscore in der Pause | Genau die Art von Kleinstichprobe, vor der `CLAUDE.md` warnt („Mehr Ereignisse helfen fast nie", Verlässlichkeit vs. Validität) — ein Viertel hat wenige Ballbesitze, ein Spieler kann durch Zufall heiß sein, ohne der eigentlich beste zu sein; ein Doppel auf den FALSCHEN Spieler ist genau der Fehler, den Chris nicht will |

**Empfehlung: B — automatisch der Feldspieler mit der höchsten Eignung (`eig`) im gegnerischen
Kader, neu bestimmt bei jedem Viertelwechsel** (nicht einmalig zu Spielbeginn: ein Wechsel durch
Foul-Ausfall oder Rotation soll den Fokus mitnehmen). Begründung, direkt aus dem Projekt-eigenen
Vokabular:

1. **Eignung ist die stabile Größe, nicht der Boxscore eines einzelnen Viertels.** `CLAUDE.md`
   selbst unterscheidet Verlässlichkeit (Ereigniszahl-abhängig, rauscht) von Validität
   (Rezept-abhängig, stabil) — ein Default auf `eig` verankert die Vorgabe an der stabileren
   der beiden Größen.
2. **Realistisch:** Ein Trainer weiß vor dem Spiel (Scouting), wer der gefährlichste
   Gegenspieler ist — er muss nicht erst ein Viertel abwarten, um das zu erkennen. Der
   „heiße Hand"-Ansatz (C) unterstellt dem Trainer eine Reaktionsfähigkeit, die echte Coaches
   zwar auch haben, aber typischerweise ergänzend zur Scouting-Vorbereitung, nicht ersetzend.
3. **Ändert nichts an bereits gemessenem Verhalten, wenn ein Manager manuell eingreift** — der
   manuelle Klick (Abschnitt 1.2) bleibt unverändert die Übersteuerung; die Vorgabe greift nur,
   solange niemand geklickt hat.
4. Ist **rho-seitig die vorsichtigere Wahl**, weil sie ausschließlich auf einer bereits im
   Ranking verwendeten Größe (`eig`) aufbaut, statt eine neue, mit dem Ranking nicht
   korrelierte Signalquelle (kurzfristige Trefferzahl) einzuführen.

**Wichtige Nebenregel:** Die Vorgabe sollte **nur für vom Nutzer nicht besetzte Teams** (KI vs.
KI im Rest der Liga) automatisch greifen — und für das eigene Team **nur, solange der Manager
nicht selbst gewählt hat**. Sobald ein Nutzer klickt, ist es sein Fokus, nicht die Vorgabe;
klickt er den aktuellen Fokus wieder ab, fällt die Vorgabe (höchste Eignung) beim nächsten
Viertelwechsel wieder ein. Genau das „natürlich = Persönlichkeit entscheidet, man stellt nur
ein, was einen stört"-Muster, das dieses Projekt schon beim PERS-System verwendet
(`:3414-3415`, „man stellt nur ein, was einen wirklich stoert, der Rest bleibt Charakter").

---

## 4. Ist Doppeln stark genug, um Rho zu gefährden?

### 4.1 Bereits im Code belegte Effektgröße

Aus Abschnitt 1.1: Doppel-Dichte am Fokussierten steigt von 5,1 % auf 7,0 % der Ballbesitze
(+1,9 Prozentpunkte absolut, **nicht** ein Vielfaches) — ein Bias, keine Sperre, per
Konstruktionsentscheidung (`:5120-5121`). Das allein spricht dafür, dass die Mechanik so
kalibriert ist, dass sie nicht dominant wird, wenn sie NUR auf einen Spieler wirkt und sonst
das Spiel unverändert lässt.

### 4.2 Eigene Scratch-Messung: „immer den eignungsstärksten Gegner doppeln" gegen „nie doppeln"

**Methodik (ausdrücklich EIN Testkader, EIN Team-Paarung — nicht die offizielle
Kaderfamilien-Abnahme aus `messgrundlage-kaderfest.md`):** `window.__arena.spieleBasketball
(saat, fokusName)` (bereits vorhandener, unveränderter Produktions-Einstiegspunkt) für 40 Seeds
(`1337 + i·7919`), einmal mit `fokusName=null`, einmal mit `fokusName` = dem laut
`feldspielProbe`-Eignung höchstplatzierten Gegenspieler. Aus dem zurückgegebenen
Ereignisprotokoll wurde je Spieler dieselbe Impact-Formel wie `MOTOREN.basketball.wert()`
nachgebildet (Punkte + Assists + 1,2·Rebounds + 1,5·(Steals+Blocks) − 0,8·Verluste,
s. `miss-feldspiel-rangtreue.mjs`-Kopfkommentar). Skript nicht Teil dieses Commits (reine
Diagnose, kein Produktionscode).

Ergebnis für den Testkader (Gegner-Eignung 30,9 bis 58,6, sechs Feldspieler je Seite):

| Größe | ohne Fokus | mit Fokus (Top-Spieler immer gedoppelt) |
|---|---:|---:|
| Punkte Top-Eignungsspieler | 10,3 | 8,2 (−20 %) |
| Impact Top-Eignungsspieler | 15,6 | 13,0 (−17 %) |
| FG% Top-Eignungsspieler | 36,1 % | 37,5 % (leicht **höher**) |
| Feldwurfversuche Top-Spieler | 9,6 | 7,5 (−22 %) |
| Assists Top-Spieler | 2,00 | 2,45 |

Die Wirkung läuft — exakt wie in Abschnitt 4.1 erwartet — über **Ballvolumen, nicht über
Trefferquote**: der fokussierte Spieler bekommt seltener/kürzer den Ball, gibt öfter ab
(Assists steigen), seine Trefferquote sinkt nicht, sondern steigt sogar leicht (übrig bleiben
die saubereren Würfe). Das ist realistisches Verhalten, kein Zufallsrauschen.

**Rangtreue-Wirkung, zwei Paare desselben Kaders:**

| Paar | Eignungsabstand | „Nr. 2 schlägt Top" ohne Fokus | mit Fokus (Top gedoppelt) |
|---|---:|---:|---:|
| Top vs. Nr. 2 | 1,8 Punkte | 35 / 40 | 38 / 40 |
| Top vs. Schwächster | 27,7 Punkte | 0 / 40 | 1 / 40 |

**Einordnung:** Das eng benachbarte Paar (1,8 Punkte Abstand) liegt schon **ohne** jeden Fokus
weit im Bereich, den `CLAUDE.md` selbst als nicht sinnvoll ordenbar bezeichnet („Paare unter
zwei Eignungspunkten Abstand — die kann kein Motor der Welt ordnen, und sie sollen es auch
nicht") — hier verschiebt Fokus die ohnehin dominierende Störung nur geringfügig (35→38 von
40). Das **gut getrennte** Paar (27,7 Punkte, weit über der 15-Punkte-Schwelle aus `CLAUDE.md`,
für die 99 % korrekte Ordnung gemessen sind) bleibt praktisch unverändert korrekt geordnet
(0→1 von 40 Ausreißern) — genau das Paar, an dem sich eine echte Rho-Gefährdung zeigen müsste,
zeigt keine.

**Vorbehalt, unbedingt ernst nehmen:** Das ist EIN Testkader, EINE Team-Paarung, `jeSeite=6`,
40 Spiele — kein Ersatz für die offizielle kaderfeste Abnahme (5 Team-Paarungen ×
`--je-seite=2,4,6`, `scripts/miss-alle-disziplinen.mjs`). Bevor „immer den eignungsstärksten
Gegner doppeln" als Vorgabe scharf geschaltet wird, gehört eine echte Messung mit
`feldspielProbe`/`disziplinMessen` erweitert um eine `fokusZielRegel`-Option in die
Abnahme-Pipeline — die Richtung aus dieser Scratch-Messung ist ermutigend, aber keine
Freigabe.

### 4.3 Antwort auf die gestellte Frage

**Ja, Doppeln als Default für den besten Gegenspieler lässt sich mit der bestehenden
Kaderfest-Rho-Schranke vereinbaren** — mit hoher Wahrscheinlichkeit, nicht mit Gewissheit ohne
die offizielle Messung. Die Mechanik wirkt gezielt auf Ballvolumen und Verteilung, nicht auf
Trefferquote, und sie betrifft strukturell nur EINEN Spieler pro Team pro Spiel — das begrenzt
den Hebel von vornherein. Der einzige Bereich mit messbarer (wenn auch kleiner) Verschiebung
liegt exakt dort, wo laut CLAUDE.md ohnehin keine verlässliche Ordnung zu erwarten ist.

---

## 5. Priorisierte Empfehlung

1. **Zuerst klären, nicht bauen: die Anbindung aus Abschnitt 1.4.** Ohne eine Antwort auf „wie
   erlebt der Nutzer sein eigenes Battle-Mode-Spiel überhaupt" ist jede UI-Arbeit an einer
   Viertelpause Arbeit an einer Ansicht, die das Ergebnis nicht beeinflusst. Das ist eine
   Produkt-/Architekturfrage an Chris, keine, die diese Recherche allein beantworten kann
   (Abschnitt 6, Frage 1).
2. **Die Vorgabe zuerst, unabhängig von jeder UI** — sie ist die einzige Änderung, die *jedes*
   Spiel betrifft (auch die 30+ KI-vs-KI-Spiele desselben Spieltags, die nie ein Mensch sieht),
   sobald Punkt 1 geklärt ist. Konkret: höchste Eignung des Gegner-Feldspielers, neu bestimmt
   pro Viertel, mit derselben Fokus-Variable, die es schon gibt. Das ist die kleinste
   Änderung mit der größten Wirkung auf „fühlt sich das Spiel wie echtes Basketball an" —
   und die einzige, die Chris' Frage direkt beantwortet.
3. **Danach die offizielle Rho-Messung** (Abschnitt 4.2, letzter Absatz) — vor jeder
   Produktivschaltung des Defaults, nicht danach.
4. **Zuletzt die UI-Politur der Viertelpause** (Abschnitt 2.1): die bestehende Fokuszeile
   während `phase==="viertelpause"` prominenter zeigen. Das ist reine Sichtbarkeits-/
   UX-Arbeit auf einer bereits funktionierenden Mechanik — am wenigsten riskant, aber ohne
   Punkt 1 auch am wenigsten wirksam.

**Generalisierung auf andere Disziplinen:** verfrüht. Fokus-Doppeln ist heute an
`istFeldspiel(disc) && LIVE()` gebunden, und Basketball ist „die einzige Disziplin mit einer
Live-Engine" (`:17980-17983`). Der Hockey-Rollout-Plan hat die Übertragung auf Forecheck-Ziele
bereits vorgesehen (`docs/design/hockey-rollout-plan.md:36,43,530`) — das ist der richtige,
bereits dokumentierte Ort für diese Frage, sobald Hockey selbst live-fähig ist. Die separate
Hockey/Takeshi-PERS-Recherche (Duell-Chassis, Zielpriorität-Dropdown) ist davon strukturell
unabhängig (Abschnitt 1.1) und braucht keine Abstimmung mit dieser hier — beide Systeme lösen
„wen bevorzugt ein Spieler" auf unterschiedlichen Chassis, mit unterschiedlichem Code, und das
sollte so bleiben, statt künstlich zusammengeführt zu werden.

---

## 6. Offene Fragen an Chris

1. **Die Kernfrage, vor allem anderen:** Wie soll ein Nutzer sein eigenes Battle-Mode-Spiel
   künftig erleben — weiterhin komplett headless mit Nachbericht, oder soll es (mindestens für
   das eigene Team) einen Live-Watch-Modus geben, dessen Ausgang tatsächlich zählt? Ohne
   Antwort hierauf ist jede Viertelpausen-Bedienung ein Feature ohne Wirkung.
2. **Vorgabe bestätigen:** höchste Eignung des Gegner-Feldspielers, pro Viertel neu bestimmt,
   für alle KI-Teams automatisch, für den Nutzer nur als Vorschlag, den ein eigener Klick
   übersteuert — oder eine andere Regel?
3. **Reicht Fokus-Doppeln als einzige Pausenwahl**, oder gibt es doch eine konkrete zweite
   Idee hinter dem „usw" — falls ja, welche (die zwei geprüften und verworfenen Kandidaten
   stehen in Abschnitt 2.2)?
4. **Reihenfolge bestätigen:** Anbindung vor Vorgabe vor Messung vor UI (Abschnitt 5) — oder
   soll die UI-Politur (die risikoärmste, aber wirkungsloseste Stufe ohne Punkt 1) parallel
   zum parallelen Viertellänge/Buzzer-Auftrag schon jetzt mitlaufen?

---

## 7. Was in dieser Runde bewusst nicht gemacht wurde

Keine Zeile in `battle-mode.engine.js`, `app/`, `lib/` oder `tests/` geändert. Die
Scratch-Messung (Abschnitt 4.2) lief gegen den unveränderten Motor über bereits vorhandene
`window.__arena`-Einstiegspunkte und ist nicht Teil dieses Commits. Keine offizielle
Kaderfamilien-Abnahme gefahren (das ist Voraussetzung für eine Produktivschaltung, nicht Teil
dieser Recherche). Die Hockey/Takeshi-PERS-Recherche wurde nicht wiederholt, nur an der
Schnittstelle (Abschnitt 1.1) sachlich korrigiert, wo ihre Prämisse für das Duell-Chassis nicht
zutrifft.

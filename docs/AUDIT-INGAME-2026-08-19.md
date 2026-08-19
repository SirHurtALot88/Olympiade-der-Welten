# In-Game-Audit — 19.08.2026

**Auftrag von Chris:** „kannst du bitte ingame noch mal nach fehlern suchen, nen audit machen der
wichtigsten features, flow usw. auch oben die weiter klicken mit leertaste leiste, ob alles UI UX
etc mäßig stark ist oder wenn sachen verbessert werden können alles notieren damit wir darauf
zurück kommen können".

---

## Wie gemessen wurde — und was das wert ist

Das Spiel lief **lokal mit einer Kopie deines echten Spielstands** (`new-game-1786626914058-hwz8fk`,
Season 1, Spieltag 10, Cash Creators). Nicht mit einer synthetischen Liga: was hier steht, hast du
so vor dir. Gesteuert per Chromium über die echte Oberfläche — Klicks, Leertaste, Scrollen —
nicht über die API.

**Abgedeckt:** 19 Hauptansichten, die Leertaste-Leiste über 16 Schritte, der Saisonabschluss,
Einsatzliste und Arena.

**NICHT abgedeckt, und das ist ehrlich zu sagen:**
- Kein zweiter Spielstand, keine frühe Saison, kein Multiplayer. Alles hier gilt für *Saisonende*.
- Keine kleinen Fenster / mobil — gemessen bei 1600×1000.
- Kein echtes Durchspielen eines Spieltags (die Saison ist zu Ende).
- Portrait-404 in meiner Umgebung sind **kein Befund**: `public/portraits` enthält nur eine README,
  die Bilder liegen auf deinem Server. Nachgesehen, nicht angenommen.

**Was NICHT gefunden wurde, und das ist die gute Nachricht:** kein Absturz, kein `NaN`, kein
`undefined`, kein `[object Object]`, keine 500er. Alle 19 Ansichten waren erreichbar. Cash stand
auf Home und Teams identisch bei 16,9 Mio. Der Saisonabschluss rendert alle 13 Auszeichnungen.

---

## A — Blockierend / hoch

### A1 · Die Leertaste-Leiste läuft am Saisonende in eine Sackgasse

**Gemessen:** 16 Klicks auf „Weiter" hintereinander. Ab dem vierten stand **13 Mal in Folge**
dasselbe da:

```
 2. "Season vorbereiten"      →  "Saisonrückblick prüfen"
 3. "Saisonrückblick prüfen"  →  "Season vorbereiten"
 4. "Season vorbereiten"      →  "Season vorbereiten"     ← ab hier 13x identisch
```

Der Knopf steht dabei auf **grün/`is-ready`**, nicht auf blockiert. Das Spiel sagt „alles bereit,
drück Weiter" — und dann passiert nichts Sichtbares.

**Ursache, nachgesehen:** der Schritt `prepare_season` (`game-flow-controller.ts:279`) ist kein
Handler, sondern eine **Navigation** auf `seasonV2` / Panel `season-finale`. Man ist nach dem
ersten Druck schon dort. Jeder weitere Druck navigiert an dieselbe Stelle.

**Und der eigentliche Haken:** nach dem Klick steht die Seite auf `scrollY = 0` bei einer
Seitenhöhe von **2720 px** und 1000 px Sichtfenster. Die Aktion, um die es geht — „Neue Saison
starten / Saisonwechsel prüfen" — liegt **unterhalb des Sichtbereichs**. Der Spieler sieht
denselben Bildschirm und denselben Knopftext und schließt daraus, dass nichts passiert ist.

**Vorschlag:** ein Navigationsschritt muss zu seinem Ziel *scrollen* und es kurz hervorheben.
Und wenn man bereits am Ziel steht, darf der Knopf nicht unverändert weiter „Season vorbereiten"
sagen — dann ist die nächste Handlung eine andere.

---

### A1 · ERLEDIGT — mit der genauen Ursache und drei Nachbefunden

**Die Ursache war ein Wettlauf, kein fehlender Anker.** `scrollToFoundationTarget` sah nach festen
90 ms genau einmal nach und brach bei `null` still ab. Gemessen am echten Spielstand:

| | vorher | nachher |
|---|---|---|
| Scroller feuert bei | 90 ms | wartet auf das Element |
| `#season-finale` dann vorhanden | **nein** | — |
| Element erstmals im DOM | **2972 ms** | 2919 ms (unverändert) |
| Hervorhebung gesetzt | **nie** | **ab 4279 ms, 57 Frames** |
| Scrollposition danach | **0** | **96** (rect.top 224 → 114) |

**Gebaut:** gewartet wird jetzt auf das ELEMENT, nicht auf die Uhr — mit 4 s als Reißleine. Die
Wartelogik (`warteAufSprungziel`) ist von `document`/`window` getrennt, sonst wäre sie in der
Node-Testumgebung dieses Projekts nicht nachstellbar; ein Fehler, den man nicht rot bekommt, kommt
wieder. Läuft ein Sprung noch, wenn der nächste startet, wird der alte abgebrochen. Und ein Ziel,
das die Frist reißt, schreibt eine Warnung statt spurlos zu verschwinden.

**Warum nicht einfach 90 auf 3000 hochdrehen:** das wäre dieselbe Wette auf eine Zahl, nur mit
anderem Einsatz. Eine schwerere Ansicht, ein langsamerer Rechner, ein größerer Spielstand — und
der Sprung wäre wieder still tot.

**Die Warnung hat sich sofort bezahlt gemacht — drei weitere tote Sprungziele:**

1. **`formcards` zeigte auf `foundation-lineup`.** Das ist nur ein `data-testid`; die id lautet
   `foundation-lineup-v2`. **Behoben.**
2. **Der allgemeine Rückfall zeigte auf `foundation-home`** — ein Name ohne Element (die Startseite
   heißt `foundation-home-v2`). Jeder Sprung ohne eigene Zuordnung fiel damit still aus.
   **Behoben**, an vier Stellen.
3. **`board-objectives` ist tot, obwohl seine id existiert.** `#team-board-objectives` steht in
   `FoundationTeamsDetailPanel.tsx` — aber **im Browser gemessen** rendert die Teams-Ansicht die
   New-Look-Variante, und `[data-testid="foundation-teams-view"]` taucht auch nach **60 Sekunden**
   nicht auf. `FoundationTeamsNewLook` kennt gar keine Board-Ziele. **Offen** — ein Anker lässt
   sich nicht raten, die Board-Ziele müssten in der Live-Ansicht erst einen Platz bekommen.
   Das trifft ausgerechnet den ERSTEN Schritt, den der Weiter-Knopf auf Chris' Spielstand anbietet.

**Der Test deckt jetzt die Klasse ab, nicht den Einzelfall.** `season-checklist-jump-targets`
prüfte nur `season-readiness-checklist.ts` — eine von drei Stellen, die `targetPanel` vergeben.
`season-finale` kam aus `game-flow-controller.ts` und lag damit außerhalb. Geprüft werden jetzt
alle drei Quellen; die restlichen toten Ziele (`finalize-transfers`, `form-board`, `resolve-lab`)
sind als bekannte Lücke verriegelt: ein NEUES totes Ziel macht rot, und ein repariertes ebenso —
es zwingt dann, den Eintrag zu streichen.

**Ehrlich zur Grenze dieses Tests:** er liest `id="…"` aus Dateien und sieht nicht, ob die
Komponente überhaupt gerendert wird. Genau daran ist Punkt 3 vorbeigekommen — die Zusicherung war
grün, der Sprung trotzdem tot. Steht als Kommentar im Test.

**Was NICHT geändert wurde:** dass der Knopf nach der Ankunft unverändert „Season vorbereiten"
sagt. Mit der jetzt funktionierenden Hervorhebung bekommt jeder Druck eine sichtbare Antwort; ob
darüber hinaus die Beschriftung wechseln soll, hängt an A2 (der Knopf trägt einen Zustand statt
einer Handlung) und gehört dorthin.

### A2 · Der Weiter-Knopf zeigt einen abgeschnittenen Zustand statt einer Aktion

Auf Home steht wörtlich: **„Weiter Board-Ziel verfehlt: For…"** — abgeschnitten, unlesbar.

Zwei Fehler in einem:
1. Der Knopf beschriftet sich mit einem **Zustand** („Board-Ziel verfehlt"), nicht mit einer
   **Handlung**. Was der Druck bewirkt, steht nirgends.
2. Der Text passt nicht in die Leiste und bricht mit Ellipse ab. Ausgerechnet beim wichtigsten
   Knopf des Spiels.

Der Quelltext kennt das Problem schon: `game-flow-controller.ts:290` erklärt ausführlich, warum
`board_objectives_failed` aus den Warnungen entfernt wurde, weil der Knopf sonst dauerhaft
„Board-Ziel verfehlt" hieß. **Es steht trotzdem noch da** — der Weg über `primaryInboxItem.title`
(`foundation-global-next-actions.ts:38`) bringt es wieder herein.

---

### A2 · ERLEDIGT — die Lösung lag seit jeher im Datensatz

**`ctaLabel` gab es die ganze Zeit.** Das Feld steht am `GameInboxItem`, ist an 20 Einträgen
gesetzt und trägt genau das Richtige — „Lineup prüfen", „Kapitän wählen", „Sponsor wählen". Und
**keine einzige Anzeige hat es je gelesen.** Der Knopf zog stattdessen `title`, also den Zustand.

Dritter Fall derselben Klasse an einem Tag: die Rechnung war da, die Anzeige holte sie nicht ab.

**Gemessen am echten Spielstand**, vor jeder Änderung:

| | vorher | nachher |
|---|---|---|
| Einträge, die auf die Leiste können | 27 | 27 |
| davon ohne Handlungstext | **2** | **0** |
| längste Beschriftung | **74 Zeichen** | **20** |
| Median | 15 | 15 |

Die beiden ohne Handlungstext waren `team_season_objectives` — genau der 74-Zeichen-Eintrag, den
Chris abgeschnitten sah — und `game_phase` („Pre-Season Schritt offen").

**Im Browser nachgemessen**, bei 1600 / 1280 / 1024 px:

```
"Board-Ziele ansehen" (19 Zeichen)  abgeschnitten=false  162/162px
```

Vorher stand dort „Weiter Board-Ziel verfehlt: For…".

**Der lange Titel bleibt, wo er hingehört.** Er ist absichtlich lang (`game-inbox-service.ts:1060`:
sonst ergäben mehrere Board-Ziele wortgleiche Karten) — richtig für die Liste, falsch für einen
Knopf. Er steht weiterhin im `title` des Knopfes, also im Tooltip.

**Der Riegel gegen die Klasse:** `isPrimaryInboxCandidate` ist aus `getPrimaryInboxTask`
herausgelöst (die Bedingung wurde vorher abgeschrieben, wer sie brauchte), und
`tests/weiter-leiste-beschriftung.test.ts` prüft jeden `createItem`-Aufruf mit wählbarer
Kategorie auf ein `ctaLabel`. Der Riegel hat sofort **zwei weitere** gefunden, die auf Chris'
Spielstand gar nicht auftraten: „Mitspieler wartet / Ready fehlt" (Online-Spiel) und
„AI/Workflow Blocker". Beide ergänzt.

**Und der Riegel hat beim ersten Anlauf gegen sich selbst geprüft.** Die Gegenprobe — das echte
`ctaLabel` entfernen — blieb grün: der Test suchte das *Wort* `ctaLabel` irgendwo im Block, und
der erklärende Kommentar daneben nennt es ebenfalls. Ein Riegel, den die eigene Begründung
aufhält, ist keiner. Geprüft wird jetzt die **Zuweisung** (`ctaLabel:`) in kommentarfreiem
Quelltext; danach wird die Gegenprobe rot.

### A3 · `foundation-global-next-actions.ts` ist tot — und ein Test prüft trotzdem darauf

`deriveGlobalNextUi`, `createUpdateInboxItemStatus`, `createTriggerGlobalNext` sind exportiert.
**Kein einziges Laufzeit-Modul importiert diese Datei.** Die identische Logik liegt inline in
`use-foundation-shell-router-body-scope.tsx:7166–7192` — Zeile für Zeile dieselbe verschachtelte
Bedingung.

Schlimmer: `tests/game-inbox-ui-contract.test.ts:23` liest die tote Datei als **Text** ein und
hängt sie an den zusammengesetzten Quelltext, gegen den `toContain(...)` prüft. Eine Zusicherung
kann also allein von der toten Datei erfüllt werden, während die echte Oberfläche die Verdrahtung
längst verloren hat.

Dieser Test dokumentiert die Fehlerklasse **in sich selbst** (Zeile 41 ff.: „ein Name, den zuletzt
nur noch ein TOTER IMPORT am Leben hielt") — und tappt an der nächsten Stelle wieder hinein.

**Das ist die teuerste Sorte Befund:** wer künftig `deriveGlobalNextUi` repariert, ändert am Spiel
nichts, und der Test bleibt grün.

---

### A3 · ERLEDIGT — und die Richtung war nicht die erwartete

Naheliegend wäre gewesen, die ausgelagerten Funktionen zu verdrahten und die Inline-Kopien zu
löschen. **Der Diff hat das widerlegt.** Die drei Funktionen waren nicht gleich:

| Funktion | Verhältnis zur gelebten Fassung | Entscheidung |
|---|---|---|
| `deriveGlobalNextUi` | **wortgleich** | verdrahtet, Inline-Kopie gelöscht |
| `createUpdateInboxItemStatus` | **wortgleich** | verdrahtet, Inline-Kopie gelöscht |
| `createTriggerGlobalNext` | **drei Korrekturen hinterher** | gelöscht |

`createTriggerGlobalNext` zu verdrahten hätte nicht aufgeräumt, sondern drei behobene Fehler
wieder eingeschleppt: die rohe `status === "ready"`-Abfrage statt `canAdvanceMatchdayFromStep`
(ein Team mit gerissenen Board-Zielen kam über diesen Weg nicht weiter), der direkte Aufruf von
`runCockpitMatchdayAdvance` ohne die Ablehnungsgründe, und der fehlende Wechsel in den
Saisonstand. Dazu fehlten ihr `canJumpToArenaAfterLineupSave` (Online-Spiel) und der
`finalize_transfers`-Zweig.

**Eine zweite tote Datei kam dabei heraus:** `foundation-game-flow-navigation.ts` — ebenfalls von
niemandem importiert, ebenfalls nur als Text im Vertrag, und ebenfalls veraltet: sie trug noch
`scrollToFoundationTarget("foundation-home")`, also genau den toten Anker, der unter A1 repariert
wurde. **Gelöscht.**

**Der Riegel gegen die Klasse** steht in `tests/vertragstests-lesen-keinen-toten-code.test.ts`:

1. Jede Datei, die ein Vertragstest als Text einliest, muss von Laufzeitcode importiert werden.
2. Das Shell muss die Funktionen **rufen**, statt sie nachzubauen.
3. Der Text `"Leertaste: Weiter"` darf in **genau einer** Laufzeitdatei stehen.

Alle drei mit Gegenprobe gefahren. Punkt 3 ist der schärfste — er hätte die ursprüngliche Kopie
sofort aufgedeckt.

**Warum es diesen Riegel braucht, nachgemessen:** löst man im Shell die Verdrahtung wieder, bleibt
`game-inbox-ui-contract` **grün**. Er prüft, dass Namen irgendwo im zusammengeklebten Quelltext
stehen — nicht, dass sie benutzt werden. Genau so konnte die Kopie überhaupt entstehen.

**Nebenertrag:** `deriveGlobalNextUi` ist jetzt eine echte, geprüfte Funktion
(`tests/weiter-leiste-beschriftung.test.ts`, 9 Fälle) statt nur lesbarer Text. Damit hat **A2**
eine messbare Ausgangslage — der Fall „der Posteingang verdrängt das Label" ist dort festgehalten,
ausdrücklich als Ist-Zustand und nicht als Soll.

---

## B — Widersprüche, die der Spieler sieht

### B1 · „Bereit — alle Aktionen abgeschlossen" neben „Board-Ziel verfehlt"

Auf Home stehen gleichzeitig, im selben Blickfeld:
- oben links grün: **„Bereit · Alle Aktionen abgeschlossen"**
- oben rechts: **„Weiter · Board-Ziel verfehlt…"**
- in der Teamkarte: **„Board-Ziel verfehlt: Formkarten-Ausbeute: Ligarang vor dem unteren Viertel: bereit"**

Die dritte Zeile ist eine Textverkettung, die aus dem Ruder läuft:
`HomeV2NewLook.tsx:454` baut `` `${nextStepLabel}: ${nextStepStatus}` ``. Der Kommentar darüber
erklärt die Absicht (den Schritt beim Namen nennen). Sie kippt, weil `nextStepLabel` selbst schon
ein mehrteiliger Satz mit Doppelpunkt ist — heraus kommt ein Satz mit drei Doppelpunkten, der auf
„: bereit" endet.

### B2 · Die Arena bietet an, eine bereits gewertete Disziplin zu starten

Im Auswahlfeld: **„1. Football · ✓ gewertet"** und **„2. Fechten · ✓ gewertet"**. Darunter trotzdem
aktiv: **„▶ Start · Etappe 1 / 3"**, **„⏩ Quick-Sim"**, **„↻ Neu"**.

Dasselbe auf der Einsatzliste: die Aufstellung für Spieltag 10 ist voll bearbeitbar
(„Lineup speichern", „Arena bereit", „Zur Arena →"), obwohl der Spieltag gespielt und die Saison
abgeschlossen ist.

**ERLEDIGT — und eine Korrektur an diesem Audit.**

**Meine Einstufung war falsch.** Weiter unten stand B2 in der Reihenfolge-Tabelle als
„Datenrisiko, nicht nur Anzeige". Das stimmt nicht. `commitFinishedDiscipline` bucht eine bereits
gewertete Seite nicht erneut, und **nachgemessen** ist die Spielstand-Datei nach einem vollständigen
Quick-Sim einer gewerteten Disziplin **md5-identisch**. Es gibt kein Datenrisiko.

**Der echte Fehler ist trotzdem da, und es ist wieder dieselbe Klasse:** die Arena meldete
`data-active-side-scored="true"` — sie *wusste* also, dass gewertet ist — und der Hauptknopf stand
trotzdem auf „▶ Start · Etappe 1 / 4", aktiv. Die Information lag vor und wurde nicht an die Bühne
weitergegeben. Der Spieler lässt einen Durchlauf laufen, der folgenlos bleibt, und muss selbst
darauf kommen, warum sich nichts geändert hat.

| | vorher | nachher |
|---|---|---|
| Hauptknopf | `▶ Start · Etappe 1 / 4` | `▶ Nachspielen · Etappe 1 / 4` |
| Hinweis | — | „Bereits gewertet — ein Durchlauf ändert die Wertung nicht." |

**Was ausdrücklich NICHT gebaut wurde:** die Bühne auf „fertig" zu setzen. Dann stünde „gewertet"
über einem Rundenstand aus lauter Nullen — es ist ja nichts gelaufen. Eine falsche Zahl ist
schlimmer als eine fehlende. Ich hatte das zuerst so gebaut und wieder zurückgenommen.

Nachspielen bleibt möglich; der Riegel liegt beim Buchen, nicht beim Abspielen. Ein Test hält
genau diese Zeile fest — fällt sie weg, wird aus B2 doch noch ein echter Fehler.

**Offen bleibt der zweite Teil:** die Einsatzliste für einen gespielten Spieltag ist weiterhin
voll bearbeitbar. Das ist eine eigene Entscheidung (was soll ein Speichern dort tun?) und gehört
nicht in dieselbe Änderung.

### B3 · Ein Feld sagt „Offen", der Statuschip daneben sagt „erledigt"

Auf dem Saisonabschluss, Block „DAS STEHT JETZT AN":

> **Verkäufe & Verträge öffnen**
> *Offen* — Verträge verlängern und Spieler verkaufen. …
> → Chip rechts: **erledigt**

**ERLEDIGT.** Beides stimmte, aber über verschiedene Dinge: „Offen" beschrieb das
**Verkaufsfenster**, „erledigt" den **Schritt**, es zu öffnen. In einer Zeile gelesen ist das ein
Widerspruch — und danach glaubt der Spieler keiner der beiden Angaben mehr.

Der Schritt ist erledigt; der Text sagt jetzt, was dadurch möglich ist:
„**Freigeschaltet** — du kannst jetzt Verträge verlängern und Spieler verkaufen." Die
Einschränkung bleibt erhalten (Kaufen ist weiterhin zu) — der Widerspruch war das Problem, nicht
die Information. Im laufenden Spiel nachgemessen.

### B4 · Die Arena zeigt eine Rangfolge, von der sie selbst sagt, dass es sie nicht geben soll

Panel **„RUNDENSTAND — LIVE"**: eine vollständige Liste #1 bis #32, jede Zeile mit `—` und `0`.
Direkt darunter Panel **„SPIELTAGS-WERTUNG · Wertung folgt"** mit dem Satz:

> „Die Wertung aller Teams erscheint mit dem ersten gewerteten Ergebnis … **Bis dahin steht hier
> bewusst keine Reihenfolge.**"

Die Entscheidung ist also schon getroffen und richtig begründet — das Panel darüber hält sich
nicht daran und erfindet eine Reihenfolge aus lauter Nullen.

### B5 · Saisonabschluss und Saisonstand widersprechen sich auf demselben Bildschirm

Oben: **„SAISON ABGESCHLOSSEN · Platz 20 zum Saisonende"**.
Weiter unten auf derselben Seite: **„LIGA-WERTUNG · SAISON LÄUFT"** und **„Season 1 (aktiv)"**.

**ERLEDIGT.** Die Beschriftung kannte nur **zwei** Zustände — Archiv oder laufend. Es gibt drei:
die Saison des Spielstands ist *nicht* archiviert (sie ist die aktuelle) und trotzdem durch.
Genau dieser Fall fiel in den Zweig „läuft".

Die Zeile stand **wortgleich an zwei Stellen** — im Saisonstand und in den Rängen. Das war der
Grund, dass der dritte Zustand an beiden fehlte; ihn zweimal nachzutragen hätte die nächste
Abweichung nur vorbereitet. Beide ziehen jetzt `resolveLigaWertungKopfzeile`
(`lib/foundation/liga-wertung-kopfzeile.ts`), und ein Test hält fest, dass der Text nirgends
mehr nachgetippt wird.

Im laufenden Spiel nachgemessen: `LIGA-WERTUNG · SAISON ABGESCHLOSSEN`, passend zur Überschrift
darüber.

**Unterwegs noch ein toter Pfad:** der erste Eingriff ging in `FoundationSeasonV2Host.tsx` — die
Datei wird **nirgends gerendert** (der Quelltext dokumentiert das an zwei Stellen selbst).
Gemessen statt geglaubt: die Beschriftung blieb unverändert. Zurückgenommen und der lebende Pfad
(`FoundationShellRouterBody` → `FoundationSeasonV2Panel`) verdrahtet. Das ist derselbe Stolperstein
wie bei A1 und A3 — dieser Codebestand trägt mehrere „Host"-Dateien, die niemand rendert.

**Nicht angefasst:** das „(aktiv)" in der Saison-Auswahl. Dort heißt „aktiv" *die Saison dieses
Spielstands* im Gegensatz zum Archiv — eine andere Aussage als „läuft gerade", und in der
Auswahlliste die nützlichere.

---

## C — Zahlen und Beschriftung

### C1 · „Top 63 %" bei Rang 20 von 32

Rechnerisch stimmt der Perzentilwert. Gelesen wird er als Lob — bei einem
unterdurchschnittlichen Rang. „Platz 20 von 32" trägt dieselbe Information ohne die falsche
Färbung.

### C2 · „S1 … S10" unter der Überschrift „FORM · SAISON"

In der Teamkarte steht die Formkurve als `S1 … S10`, darüber „FORM · SAISON", und im Kopf derselben
Karte „SEASON 1 · SPIELTAG 10". `S` steht hier für Spieltag, liest sich aber als Season.

### C3 · „Player of the Season · Malagor · 30.2 PPs · 0 MVP"

Eine glatte `0` als Kennzahl der besten Saisonleistung. Gleiche Klasse wie das MVS-0-Thema, das du
schon entschieden hast („mach es so dass nix rot ist").

### C4 · Überschrift mitten im Wort abgeschnitten

`FoundationShellRouterBody.tsx:2746`: **„Ranks - Teamstärke pro Diszi"**. Fest im Quelltext, nicht
durch CSS gekürzt. Dazu ein ASCII-Bindestrich statt Gedankenstrich.

---

## D — Struktur und Bedienbarkeit

### D1 · 13 von 14 Ansichten haben keine `<h1>`

Gemessen über die Ansichten hinweg:

| Ansicht | h1 | h2 | h3 |
|---|---:|---:|---:|
| Home, Inbox, Einsatzliste, Saisonstand, Teams, Ranks | 0 | 1 | 0–9 |
| **Gebäude, Transfermarkt, Finanzen, Leaders, Sponsoren** | **0** | **0** | 2–10 |
| Arena | 1 | 0 | 0 |

Fünf Ansichten beginnen bei `h3` ohne irgendetwas darüber. Die einzige `h1` im Spiel heißt
„Football" — ein Disziplinname, keine Seitenüberschrift. Der Link „Zum Hauptinhalt springen"
existiert, hat aber nichts, worauf er zeigen könnte.

### D2 · Spielerliste braucht rund 10 Sekunden bis zum Inhalt

Gemessen: Ladeskelett bis ~8,3 s, Inhalt ab ~10,7 s (2320 Spieler). Alle anderen Ansichten sind
in ~1 s da. Der Saisonstand wirkte beim ersten Aufruf ebenfalls langsam, war beim zweiten nach
1,06 s vollständig — das war kalter Cache, kein Befund.

### D3 · Abgeschaltete Knöpfe ohne Begründung

Auf der Einsatzliste stehen „Nächster Slot" und „Automatisch füllen" grau, ohne Hinweis warum.
Daneben **„Optimieren 7"** — was die 7 zählt, steht nirgends.

### D4 · Klickziele unter 24 px

Neun Bedienelemente in der Kopfzeile und Seitenleiste sind unter 24 px hoch, darunter die
Breiten-Umschaltung (`Standard` / `Breit` / `Cinema`, je 17 px) und „Alle Aufgaben →" (14 px).

---

## Wo ich anfangen würde

| # | Befund | Warum zuerst |
|---|---|---|
| 1 | **A1** Sackgasse am Saisonende | Der Spieler kommt nicht weiter und bekommt keinen Hinweis. Alles andere ist Kosmetik dagegen. |
| 2 | **A3** tote Datei + Test darauf | Solange die drin ist, kann jede Reparatur an der Weiter-Leiste ins Leere gehen — und der Test meldet es nicht. |
| 3 | **A2 + B1** Weiter-Knopf und Statuszeile | Eine Ursache, zwei Symptome: ein Zustand steht dort, wo eine Handlung hingehört. |
| 4 | **B2** gewertete Disziplin neu startbar | ~~Datenrisiko~~ — nachgemessen falsch, siehe B2. Reine Anzeige, aber irreführend. |
| 5 | **B3, B4, B5** Widersprüche | Billig zu beheben, kosten aber Vertrauen in jede Zahl daneben. |
| 6 | **D1** Überschriften | Einmalige Aufräumarbeit, danach stimmt die Struktur überall. |
| 7 | **C1–C4, D2–D4** | Feinschliff. |

---

## Werkzeug

Der Durchlauf ist wiederholbar: `scripts/audit-ingame-durchlauf.mjs` startet gegen einen laufenden
Server und legt Screenshots, Texte und Befunde ab. Der Spielstand kommt über
`OLY_APP_SQLITE_PATH` aus einer **Kopie** — der Server wird nie angefasst.

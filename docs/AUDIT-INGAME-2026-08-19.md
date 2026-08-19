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

### B3 · Ein Feld sagt „Offen", der Statuschip daneben sagt „erledigt"

Auf dem Saisonabschluss, Block „DAS STEHT JETZT AN":

> **Verkäufe & Verträge öffnen**
> *Offen* — Verträge verlängern und Spieler verkaufen. …
> → Chip rechts: **erledigt**

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
| 4 | **B2** gewertete Disziplin neu startbar | Datenrisiko, nicht nur Anzeige. |
| 5 | **B3, B4, B5** Widersprüche | Billig zu beheben, kosten aber Vertrauen in jede Zahl daneben. |
| 6 | **D1** Überschriften | Einmalige Aufräumarbeit, danach stimmt die Struktur überall. |
| 7 | **C1–C4, D2–D4** | Feinschliff. |

---

## Werkzeug

Der Durchlauf ist wiederholbar: `scripts/audit-ingame-durchlauf.mjs` startet gegen einen laufenden
Server und legt Screenshots, Texte und Befunde ab. Der Spielstand kommt über
`OLY_APP_SQLITE_PATH` aus einer **Kopie** — der Server wird nie angefasst.

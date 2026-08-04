# Verkaufs-Popup — Entwurf (Mockup-Phase)

Status: **Entwurf zur Abnahme** · noch keine Verdrahtung ins Spiel.
Mockup: `docs/design/verkauf-popup-mockup.html` (eigenständige Datei, im Browser öffnen).
Referenzfall: Claudelio Feelgood (Bard · Construct, Team C-C, Saison 1 MD10) — alle Zahlen aus dem echten Spielstand.

---

## 1. Warum neu

Der heutige Verkaufsblock (`app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx`, 827 Zeilen)
ist ein senkrechter Stapel unter der Teamseite. Die konkreten Fehler, die der Entwurf beseitigt:

| Heute | Neu |
|---|---|
| Kein Portrait — der Spieler ist nicht zu sehen | Großes Portrait als Anker des Popups, links oben im Hero |
| Gründe für/gegen den Verkauf sind zugeklappt (`<details>`) | Die Board-Bilanz ist **die zentrale, immer offene Karte** des Popups |
| Vier gleich laute rote Warnbalken, obwohl zwei neutral und einer positiv ist | Hinweise werden nach **Gewicht** getrennt: Blocker / Achtung / Hinweis / Stärkt den Deal |
| Verkaufspreis nicht im Blickfeld | Netto-Erlös ist die größte Zahl im Popup, oben rechts im Hero |
| Kaputte Umlaute in Begründungstexten („fuer", „uebersteigt") | Muss **in der Datenquelle** repariert werden, siehe Abschnitt 7 |
| Kein Abbruchpunkt — man scrollt hinein und heraus | Echtes Modal mit Overlay, X, Esc und Abbrechen-Button |

Leitprinzip: **Der Spieler will in drei Sekunden wissen, was er kriegt, was er verliert und was
sein Board davon hält.** Alles andere ist zweite Ebene.

---

## 2. Grundform

Ein **modales Popup** über der Teamseite (Overlay abgedunkelt, Dialog max. ~920 px breit,
max. 90 vh hoch). Kopf und Fußleiste sind fixiert, nur der Mittelteil scrollt. Schließen über
X, Esc, Klick aufs Overlay oder „Abbrechen" — der Abbruchpunkt, der heute fehlt.

Designsprache: `.is-new-look`-Tokens aus `app/globals.css` (`--nl-panel`, `--nl-line`,
`--nl-mut`, `--nl-accent`, `--nl-good`, `--nl-warn`, `--nl-risk`), Karten mit 12–18 px Radius,
Schriftgrößen 0,68–1,24 rem. Das Popup soll aussehen wie das Spiel, nicht wie ein Fremdkörper.

---

## 3. Aufbau — Zonen von oben nach unten

```
┌──────────────────────────────────────────────────────────────┐
│ A  Kopf: „Transfermarkt · Verkauf" · Status-Pill · X          │
├──────────────────────────────────────────────────────────────┤
│ B  Hero:  [Portrait groß]  Name, Klasse, Rasse, Rolle, Team  │
│                            Vertrag/Gehalt      NETTO-ERLÖS ▲ │
├──────────────────────────────────────────────────────────────┤
│ C  3-Sekunden-Zeile: Du bekommst · Dein Team danach · Board  │
├──────────────────────────────────────────────────────────────┤
│ D  BOARD-BILANZ (Kern): Empfehlung + Intent-Balken           │
│    Gründe dafür (offen)  │  Gründe dagegen (offen)           │
├──────────────────────────────────────────────────────────────┤
│ E  Hinweise nach Gewicht: Achtung / Hinweis / Stärkt Deal    │
├──────────────────────────────────────────────────────────────┤
│ F  Konsequenzen: Marktsperre 1 Saison · endgültig · GM-Zeile │
│ G  Zweite Ebene (zugeklappt): Leistung, Vertrag, Historie    │
├──────────────────────────────────────────────────────────────┤
│ H  Fuß: Abbrechen ·· [Grund, falls gesperrt] · Primärbutton  │
└──────────────────────────────────────────────────────────────┘
```

### A — Kopf
Kicker „Transfermarkt · Verkauf", rechts eine Status-Pill (`bereit` / `Fenster zu` /
`blockiert` / `verkauft`) und der X-Button. Die Pill ist die Kurzfassung des Zustands —
sie ersetzt keinen Banner, sie ergänzt ihn.

### B — Hero: Wer, und für wie viel
- **Portrait groß** (~132 px, abgerundet). Im Mockup ein CSS-Platzhalter mit Initialen und
  Klassen-Farbverlauf (Bard = gelb, analog `classVisuals.ts`); im echten Bau kommt hier
  `portraitUrl` aus `marketSellSubject` rein — dieselbe Quelle, die das Kaufmodal nutzt.
- Identität: Name (größte Schriftzeile), Klassen-Chip in Klassenfarbe, Rasse, Rollen-Tag,
  Team, Vertragsrestlaufzeit und Gehalt als Chips.
- **Netto-Erlös rechts als DIE Zahl** (Accent-Farbe, ~2 rem, tabellarische Ziffern),
  darunter klein die Herleitung: `Brutto X − Buyout Y` bzw. „kein Buyout", plus
  `Faktor 0,95× auf MW 23,2 Mio`. Damit ist Fehler Nr. 4 (Preis unsichtbar) strukturell
  unmöglich — der Preis hängt an der Identität, nicht an einer Kachel weiter unten.

### C — 3-Sekunden-Zeile
Drei gleich breite Kacheln, bewusst nur je 2–3 Werte:

1. **Du bekommst** — Netto-Erlös (Wiederholung, klein), Cash vorher → nachher,
   GuV gegen Kaufpreis (grün/rot).
2. **Dein Team danach** — Kader 9 → 8, Gehaltsentlastung p. a., Aufstellungs-Check danach
   (Ampel: bereit/eingeschränkt/kritisch).
3. **Board & GM** — Empfehlungs-Label („Verkaufen — Underperformer"), Board-Reaktion in
   einem Satz mit Vertrauens-Impuls (±), Board-Stimmung (Smiley aus `boardTrustSmiley`) und
   GM-Name mit Druck-Level.

Wer nur diese Zeile liest, kann entscheiden. Alles darunter begründet.

### D — Board-Bilanz (der Kern)
Das ist die Antwort auf „Board-Verkaufsgründe transparent machen". **Nie zugeklappt.**

- Kopf der Karte: Doktrin-Persona als Eyebrow („Doktrin: Churner · 40 % Churner ·
  40 % Value-Hunter · 20 % Merchant"), Titel „Board-Bilanz: 7 dafür · 1 dagegen".
- **Intent-Balken**: ein horizontaler Balken, der `sellIntentScore` gegen `keepIntentScore`
  aufteilt (Referenzfall 123 : 0 → praktisch voll auf „verkaufen"). Der Balken zeigt die
  *Gewichtung* des Boards, nicht bloß die Anzahl der Gründe — 7:1 an Gründen kann trotzdem
  50:50 an Gewicht sein (Fall Yamikani: 6 dafür, 2 dagegen, aber ein Dagegen-Grund
  „Netto-Verlust 7,9 Mio" wiegt schwer).
- Zwei Spalten: **Dafür (7)** links, **Dagegen (1)** rechts. Jeder Grund ist eine Zeile mit
  farbigem Marker (Dafür = Accent, Dagegen = Warn) und einem **Kategorie-Tag**
  (Finanzen / Leistung / Vertrag / Strategie), damit man das Muster erkennt („viermal
  Finanzen+Vertrag" liest sich anders als „siebenmal Bauchgefühl").
- Die Dagegen-Spalte ist **immer** sichtbar, auch leer („Keine Haltegründe") — und bei
  wenigen, schweren Haltegründen (Yamikani) trägt genau diese Spalte die Entscheidung.
  Ein Entwurf, der nur den Ja-Fall hübsch macht, taugt nicht; darum sind beide Spalten
  gleich breit und gleich laut.
- Farb-Logik bewusst **nicht** grün/rot: Verkaufsgründe sind keine „guten Nachrichten" und
  Haltegründe keine Fehler. Accent (blau) = Argument des Boards für die Aktion,
  Warn (amber) = Argument dagegen. Grün/Rot bleibt für Geld (GuV) und echte Risiken reserviert.
- Unter den Spalten: `strategyFitSummary` als ein Satz in Muted, plus die
  `pricingPolicyNotes` falls vorhanden.

### E — Hinweise nach Gewicht (statt vier roter Balken)
Die heutigen vier gleich lauten roten Balken werden nach Bedeutung einsortiert. Die
Einstufung passiert **pro Warning-Key** (aus `translateSellWarning` bekannt), nicht pro Text:

| Stufe | Farbe | Warning-Keys (heutiger Bestand) |
|---|---|---|
| **Blocker** | `--nl-risk`, eigener Callout ganz oben | `team_would_fall_under_7`, `team_would_fall_under_player_min` + alle `blockingReasons` |
| **Achtung** | `--nl-warn`, Zeile mit Amber-Marker | `team_would_fall_under_player_opt` (Kader unter Empfehlung), `team_readiness_would_get_worse`, `active_player_referenced_in_lineup` |
| **Hinweis** | neutral (`--nl-mut`, Punkt-Marker) | „außerhalb des idealen Verkaufsfensters", `matchday_missing_for_readiness_preview`, `readiness_context_*` |
| **Stärkt den Deal** | `--nl-good` | „Starker Team-Fit stützt den Verkaufspreis" |

Rot gibt es nur noch, wenn wirklich etwas blockiert. Ein positiver Hinweis darf nie rot sein.
Neue, unbekannte Keys fallen defensiv auf „Achtung" — nie auf Blocker, nie auf Positiv.

### F — Konsequenzen
Eine schmale Zeile, kein Balken-Drama: **Marktsperre 1 Saison** (`soldPlayerSeasonBanNote`),
„Ein Verkauf ist endgültig", und falls vorhanden der **Nachfolger-Slot** (Budget + Ziel-OVR)
als konstruktiver Ausblick. GM-Warnung (`gmWarning`/`gmDetail`) erscheint hier als eigene
Amber-Zeile, wenn gesetzt.

### G — Zweite Ebene (zugeklappt, bewusst)
Leistung & PP-Profil, Entwicklung & Vertrag, Einsätze/Diszis/Transferhistorie — alles, was
heute den Stapel füllt, wandert in **ein** Disclosure „Mehr zum Spieler" mit Zusammenfassung
in der Summary-Zeile (OVR, Season-PPs, Einsätze). Das ist der einzige zugeklappte Bereich —
und es ist der richtige, weil er die Entscheidung informiert, aber nicht trägt. Die
Board-Bilanz war zugeklappt und die Statistik offen; das drehen wir exakt um.

### H — Fußleiste (fixiert)
Links „Abbrechen", rechts der Primärbutton. Ist der Button deaktiviert, steht der **Grund als
Text direkt daneben** (nicht nur im Tooltip) — die Friction-Lektion aus dem Bestand bleibt
erhalten. Button-Beschriftung je Zustand, siehe unten.

---

## 4. Zustände

Genau **ein** tragender Zustand pro Ansicht (Zustandsmaschine wie im Bestand, aber als
Popup-Varianten):

| Zustand | Was trägt | Primärbutton |
|---|---|---|
| **Lädt** | Hero mit Identität (aus `marketSellSubject`, keine „—"-Wand) + Skeleton für C–E | deaktiviert, „Vorschau lädt…" |
| **Vorschau (verkaufbar)** | Vollbild wie oben | „Verkaufen…" → wechselt in *Bestätigen* |
| **Vorschau (gesperrt)** | Vollbild + Sperr-Banner (s. u.) | deaktiviert, Grund daneben |
| **Bestätigen** | Fußleiste wechselt: Endgültigkeits-Satz + Marktsperre-Recap, ggf. Risiko-Checkbox | „Ja, endgültig verkaufen" + „Zurück" |
| **Gebucht** | Erfolgskarte ersetzt C–F: Netto-Erlös und Cash danach zählen hoch, Marktsperre-Recap | „Schließen" |
| **Fehler** | EINE Meldung + „Vorschau neu laden", Hero bleibt | deaktiviert |

### Gesperrt — zwei Fälle, ein Prinzip
Die Vorschau bleibt **vollständig lesbar**; nur der letzte Klick ist zu. Kein roter Alarm,
denn „Fenster zu" ist ein regulärer Spielzustand:

1. **Verkaufsfenster geschlossen** (`phase_blocked`): schmaler **Amber-Banner** unter dem
   Hero — „Verkaufsfenster geschlossen — verkauft wird am Season-End (nach MD10)." Die
   Status-Pill zeigt „Fenster zu". Der Primärbutton heißt „Verkauf öffnet nach MD10" und ist
   deaktiviert. Der Wert des Screens ist jetzt die *Planung*: Board-Bilanz und Zahlen
   informieren die Entscheidung, die man am Season-End trifft.
2. **Verkauf blockiert** (`blockingReasons`, z. B. Kader-Minimum): **roter** Callout an
   Position E-oben mit dem ersten Grund groß und dem konkreten nächsten Schritt
   („Kaufe zuerst Ersatz"). Das ist der einzige Ort, an dem Rot erlaubt ist.

### Bestätigen — zwei Klicks statt Checkbox-Pflicht
Der heutige eine Klick auf „Endgültig verkaufen" wird zu einem expliziten zweiten Schritt in
der Fußleiste (kein zweites Popup): Endgültigkeit + Marktsperre werden genau dort wiederholt,
wo der Klick passiert. Die **Risiko-Checkbox** erscheint nur, wenn das Board sie verlangt
(`boardReaction.requiresStrongAcknowledgment` oder GM-Soft-Block bei `keepIntent ≥ 55`) —
mit derselben Sichtbarkeits-Invariante wie im Bestand: sobald die Bestätigung sperrt, ist die
Checkbox sichtbar, sonst gäbe es einen stillen Dead-End.

---

## 5. Referenzfall im Mockup

Claudelio Feelgood, Bard · Construct, Team C-C, Saison 1 MD10 — Doktrin Churner, Empfehlung
„Verkaufen — Underperformer" (Priorität 100), Intent 123 : 0, GM Kira Morrow „Bargain Hunter"
(Druck: beobachtet), Board „Vorstand registriert Verkauf" (+0,05, severity info), Stimmung
`>:( ` mit Policy „Verlängerungs-Warnung", Marktsperre 1 Saison, MW 23,2 Mio, Gehalt 5,2 Mio,
Kader 9 → 8, 7 Gründe dafür / 1 dagegen.

Nicht gemessene Einzelwerte (Verkaufspreis-Brutto, Cash vorher/nachher, Teamgehalt) sind im
Mockup **konsistent aus den gemessenen abgeleitet** (Faktor 0,95× → Brutto 22,0 Mio, kein
Buyout, GuV +0,1 Mio gegen Kaufpreis 21,9 Mio; Cash 2,1 → 24,1 Mio passend zu „Cash-Reserve
zu knapp"). Bei der Verdrahtung kommen alle Werte 1:1 aus `TransfermarktSellPreview` —
es gibt keinen Wert im Entwurf, den die Preview nicht liefert.

Gegentest Yamikani (6 dafür, 2 dagegen, darunter „frisch gekauft — Netto-Verlust 7,9 Mio"):
funktioniert im selben Layout — der Intent-Balken kippt Richtung Halten, der schwere
Dagegen-Grund steht in der immer sichtbaren rechten Spalte, GuV in Kachel C wird rot, und die
Bestätigen-Stufe verlangt die Risiko-Checkbox.

---

## 6. Interaktion & Zugänglichkeit

- `role="dialog"` + `aria-modal`, Fokusfalle, Esc schließt (außer während `marketSellBusy`).
- Erfolgs- und Fehlermeldungen mit `aria-live="polite"` / `role="alert"` wie im Bestand.
- Zahlen tabellarisch (`font-variant-numeric: tabular-nums`), Count-Up respektiert
  `prefers-reduced-motion` (Muster `NlCountUpValue`).
- Mobil (< 720 px): Hero stapelt (Portrait über Identität, Erlös darunter volle Breite),
  3-Sekunden-Kacheln und Bilanz-Spalten untereinander, Fußleiste bleibt fixiert.

---

## 7. Datenqualität: Umlaute gehören in die Quelle repariert

Mehrere Begründungstexte kommen mit ASCII-Ersatzschreibweisen aus der Datenquelle
(„Cash-Reserve ist zu knapp **fuer** sichere Kaderplanung", „Gehaltslast **uebersteigt**…").
Das ist **kein Rendering-Problem** und wird nicht in der View geflickt: die Texte entstehen in
`lib/market/transfermarkt-sell-coaching-service.ts` (bzw. den Doktrin-/Reason-Quellen dahinter)
und gehören dort auf echte Umlaute korrigiert — einmal, für alle Anzeigen (auch Deal-Desk,
Reports etc.). Das Mockup zeigt bereits die korrigierten Texte als Soll-Zustand. Die Korrektur
ist Teil des „sauber neu bauen"-Schritts nach der Abnahme, vor der Verdrahtung.

---

## 8. Nach der Abnahme (nicht Teil dieses Entwurfs)

1. Umlaute in den Reason-/Warning-Quelltexten reparieren (Abschnitt 7).
2. Warning-Gewichtsklassen als Mapping neben `translateSellWarning` anlegen.
3. Popup als neue Komponente bauen (Props-Kontrakt identisch zu `FoundationMarketSellShellHost`,
   damit die Verdrahtung ein Austausch ist, kein Umbau).
4. Alten Verkaufsblock unter der Teamseite entfernen, Popup verdrahten, Tests
   (`data-testid`-Namen bleiben stabil: `transfer-sell-confirm-button`,
   `transfer-sell-blocked-callout`, `transfer-sell-risk-ack`, …).

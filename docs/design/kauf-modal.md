# Kauf-Modal — Entwurf (Mockup-Phase)

Status: **Entwurf zur Abnahme** · noch keine Verdrahtung ins Spiel.
Mockup: `docs/design/kauf-modal-mockup.html` (eigenständige Datei, im Browser öffnen).
Vorgänger und Hausform: `docs/design/verkauf-popup.md` (abgesegnet).

**Wichtig zum Referenzfall:** Anders als beim Verkaufs-Popup gibt es hier **keine echten Messwerte**.
Der Referenzfall „Sable Windrunner" ist **komplett erfunden** — plausibel gebaut und intern konsistent
(inkl. echter Formeln, wo sie deterministisch sind), aber erfunden. Details in Abschnitt 8.

---

## 1. Warum neu

Der heutige Kaufblock (`app/foundation/transfermarkt-v2/FoundationMarketBuyShellHost.tsx`, 760 Zeilen,
plus `ContractOfferClient`) stapelt acht und mehr Karten senkrecht, geordnet nach Datenherkunft statt
nach der Entscheidung des Spielers. Die konkreten Fehler, die der Entwurf beseitigt:

| Heute | Neu |
|---|---|
| Die drei Wahrscheinlichkeiten (Zusage/Nachverhandeln/Absage) stehen als Balken in einer Karte in der Mitte des Stapels — weit weg von den Stellschrauben, die sie verändern | **Verhandlungstisch**: Stellschrauben links, Reaktion rechts, in einer Karte, live gekoppelt |
| Der `negotiationScoreBreakdown` („Warum der Deal so ausfällt") ist die dritte von drei Meta-Karten ganz unten | Die **Verhandlungs-Bilanz** ist eine große, nie zugeklappte Karte direkt unter dem Tisch — analog zur Board-Bilanz im Verkaufs-Popup |
| Gehalt/Laufzeit/Form stecken in einem generischen Formular (`ContractOfferClient`: Number-Input, nackter Slider, zwei `<select>`) ohne Bezug zum Spielerwunsch | Stellschrauben als Segmente und Slider, **mit dem Wunschfenster des Spielers direkt im Control markiert** |
| Die zugesagte Rolle (`promisedRole`) ist gar nicht bedienbar, obwohl Service und Preview sie kennen | Rolle wird vierte Stellschraube (Starter/Rotation/Bank/Prospect) |
| Der Zwei-Schritt-Flow (erst verhandeln, dann abschließen) wird per erklärendem Hinweis-Streifen gerettet | Der Flow steckt in der Fußleiste selbst: ein Primärbutton, dessen Beschriftung und Zustand den Schritt tragen |
| Portrait 72 px klein im Hero, Ablöse taucht erst in der „Team-Auswirkung"-Karte auf | Hausform: Portrait groß links, die entscheidende Zahl groß rechts |
| `yearlySalarySchedule` ist eine dreispaltige Texttabelle | Jahresplan als **Balken** direkt unter der Vertragsform — front/back-loaded wird sichtbar statt erklärt |
| Kaputte Umlaute in Verhandlungstexten („Stoert ihn", „fruehere Absage", „fuer") | Reparatur **in der Datenquelle**, siehe Abschnitt 10 |

Leitprinzip (geerbt vom Verkaufs-Popup, aber für den Kauf gedreht): **Beim Verkauf liest der Spieler
eine Bilanz und entscheidet allein. Beim Kauf verhandelt er mit einem Gegenüber, das antworten wird.**
Das Modal ist deshalb kein Bericht, sondern ein Tisch: links stellst du das Paket ein, rechts siehst du
sofort, wie er darauf reagiert — und darunter steht, warum.

---

## 2. Grundform

Identisch zur Hausform des Verkaufs-Popups: **modales Popup** (Overlay abgedunkelt, Dialog max. ~940 px
breit — 20 px breiter als beim Verkauf, weil der Verhandlungstisch zwei Spalten braucht —, max. 90 vh).
Kopf und Fußleiste fixiert, nur der Mittelteil scrollt. Schließen über X, Esc, Overlay-Klick, Abbrechen.
Tokens 1:1 aus `.is-new-look` (`--nl-panel`, `--nl-line`, `--nl-accent`, `--nl-good`, `--nl-warn`,
`--nl-risk`, …), Karten 12–18 px Radius, tabellarische Ziffern.

---

## 3. Aufbau — Zonen von oben nach unten

```
┌────────────────────────────────────────────────────────────────┐
│ A  Kopf: „Transfermarkt · Kauf" · Status-Pill · X               │
├────────────────────────────────────────────────────────────────┤
│ B  Hero:  [Portrait groß]  Name, Klasse, Rasse, Fit,   ABLÖSE ▲ │
│                            Vertragswunsch-Chip     dazu Vertrag │
│    (Banner-Slot: Blocker / Gegenangebot / Absage / Zusage)      │
├────────────────────────────────────────────────────────────────┤
│ C  3-Sekunden-Zeile: Was er kostet · Dein Team danach ·         │
│                      Wie er reagiert                            │
├────────────────────────────────────────────────────────────────┤
│ D  VERHANDLUNGSTISCH (Kern):                                    │
│    Stellschrauben (Gehalt, Laufzeit,  │  Seine Reaktion:        │
│    Form + Jahresplan-Balken, Rolle)   │  Verdikt, Haltungs-     │
│    — Spielerwunsch im Control markiert│  Balken, Deal-Druck     │
├────────────────────────────────────────────────────────────────┤
│ E  VERHANDLUNGS-BILANZ (nie zugeklappt):                        │
│    dein Hebel (Gehaltsangebot) als Pinn-Zeile                   │
│    Spricht für Zusage │ Spricht dagegen   (Score-Faktoren)      │
│    darunter: So entsteht seine Forderung (Demand-Faktoren)      │
├────────────────────────────────────────────────────────────────┤
│ F  Hinweise nach Gewicht: Achtung / Hinweis / Stärkt den Deal   │
│ G  Konsequenzen: Abbruch-Malus · Absage wirkt nach · Buyout     │
│ H  Zweite Ebene (zugeklappt): Team-Auswirkung, Deal-Druck-Werte │
├────────────────────────────────────────────────────────────────┤
│ I  Fuß: Abbrechen ·· [Grund, falls gesperrt] · Primärbutton     │
└────────────────────────────────────────────────────────────────┘
```

### A — Kopf
Kicker „Transfermarkt · Kauf", Status-Pill (`verhandelbar` / `gesperrt` / `Gegenangebot` /
`abgelehnt` / `Zusage liegt vor` / `verpflichtet`), X. Der Kauf hat mehr Pill-Zustände als der
Verkauf, weil die Gegenseite antwortet — die Pill ist die Kurzfassung, die Banner tragen den Inhalt.

### B — Hero: Wer, und die eine große Zahl

**Entscheidung zu Kernfrage 3: Die eine große Zahl ist die Ablöse.** Begründung:

1. Sie ist die **einzige nicht verhandelbare Zahl** des Deals (`purchasePrice` = Marktwert). Alles
   andere im Modal bewegt sich — sie nicht. Eine große Zahl, die beim Schieben der Regler springt,
   wäre kein Anker.
2. Sie ist das **Cash-Ereignis jetzt** — das exakte Gegenstück zum Netto-Erlös des Verkaufs-Popups.
   Verkauf: „so viel kommt sofort rein." Kauf: „so viel geht sofort raus." Die Hausform bleibt lesbar.
3. Sie entscheidet den härtesten Blocker (`insufficient_cash`): reicht das Cash nicht, ist genau
   diese Zahl der Grund.

Die **Gehaltslast verliert damit nicht, sie bekommt eine andere Bühne**: Sie ist keine Zahl, sondern
ein Plan über Jahre (`yearlySalarySchedule`). Im Hero läuft sie als Begleitzeile direkt unter der
Ablöse live mit („dazu Vertrag: 12,9 Mio über 3 Saisons") und ändert sich mit jedem Reglerzug; ihre
volle Form sind die Jahresplan-Balken am Verhandlungstisch (Zone D). Zwei konkurrierende große Zahlen
im Hero hätten die Drei-Sekunden-Lesbarkeit gekostet.

Sonst wie beim Verkauf: Portrait ~132 px (CSS-Platzhalter mit Initialen und Klassenfarbe, im echten
Bau `portraitUrl`), Name, Klassen-Chip, Rasse, Bracket, Team-Fit — plus ein Chip, den nur der Kauf
hat: **der Vertragswunsch des Spielers** („Wunsch: 2–4 Saisons · ausgeglichen", aus
`contractPreference`). Der steht bewusst schon im Hero, weil er die Verhandlung rahmt, bevor man
den ersten Regler anfasst.

Unter dem Hero sitzt der **Banner-Slot**: genau ein Banner je Zustand (Blocker rot, Gegenangebot
amber, Absage rot, Zusage grün) — nie mehrere gestapelte Feedback-Banner wie heute.

### C — 3-Sekunden-Zeile

1. **Was er kostet** — Ablöse, Cash vorher → nachher, Vertragssumme über die Laufzeit (läuft live mit).
2. **Dein Team danach** — Kader vorher → nachher, Gehaltslast p. a. vorher → nachher (live),
   Team-Marktwert vorher → nachher.
3. **Wie er reagiert** — das Verdikt in einem Satz („Er sagt zu"), Zusage-Prozent, Fit- und
   Wunsch-Kurzcheck. Wer nur diese Zeile liest, weiß Preis, Wirkung und Ausgangslage.

### D — Verhandlungstisch (Kern, Antwort auf Kernfrage 2)

Eine Karte, zwei Hälften, **live gekoppelt** — jede Änderung links berechnet die Preview neu
(die echte Verdrahtung tut das heute schon serverseitig; neu ist nur, dass Ursache und Wirkung
nebeneinander stehen statt drei Karten auseinander).

**Links, die Stellschrauben** — kein Formular, sondern vier beschriftete Hebel:

- **Dein Angebot p. a.**: große Zahl + Slider. Auf der Slider-Skala ist die **Forderung als Marke**
  eingezeichnet; darunter steht die Kurzherleitung „Forderung 4,3 Mio = Basis 3,8 × 1,13" mit Verweis
  auf die Bilanz (Zone E). Man sieht beim Ziehen, ob man unter, auf oder über seiner Forderung liegt.
- **Laufzeit**: fünf Segmente (1–5 Saisons). Das **Wunschfenster des Spielers ist im Control selbst
  schattiert** (`preferredMinLength`–`preferredMaxLength`), die Ideallänge markiert. Nicht „Formular
  plus separate Wunsch-Karte" wie heute, sondern Wunsch und Hebel an derselben Stelle.
- **Vertragsform**: drei Segmente (ausgeglichen / vorne schwer / hinten schwer), der Spielerwunsch
  trägt ein „Wunsch"-Tag. Direkt darunter der **Jahresplan als Balken** (`yearlySalarySchedule`):
  drei Balken mit Saison-Label und Betrag, Summe und „Buyout heute = Restsumme" daneben. Wer auf
  „vorne schwer" klickt, *sieht* das Gehalt nach vorn kippen — das ist die Antwort auf Kernfrage 4.
- **Zugesagte Rolle**: vier Segmente (Starter / Rotation / Bank / Prospect). Heute nicht bedienbar,
  obwohl `promisedRole` in Params und Preview existiert und in den Deal-Druck einfließt (Prospect +
  lange Bindung erzeugt Druck, Starter entlastet).

**Rechts, seine Reaktion** — siehe Kernfrage 1:

### Kernfrage 1: Drei Wahrscheinlichkeiten, ohne dass es nach Glücksspiel aussieht

Die ehrliche Grundlage steht im Code: Der Ausgang ist **deterministisch**. `negotiateBuy` in
`TransfermarktV2Client.tsx` würfelt nicht — die stärkste der drei Reaktionen gewinnt (Absage gewinnt
bei Gleichstand, Nachverhandeln schlägt Zusage nur, wenn es strikt größer ist). Die drei Zahlen sind
also keine Lostrommel, sondern eine **Haltung**, die man verschieben kann.

Genau so wird sie gezeigt:

1. **Das Verdikt zuerst**, als Satz: „Er sagt zu." / „Er verhandelt nach." / „Er lehnt ab." Das ist
   die eigentliche Information — und mechanisch die Wahrheit, denn das dominante Segment *ist* der
   Ausgang.
2. Darunter der **Haltungs-Balken**: ein Balken, drei Segmente (Zusage grün, Nachverhandeln amber,
   Absage rot), das dominante Segment voll gesättigt und in der Legende hervorgehoben, die anderen
   gedimmt. Die Prozentwerte bleiben sichtbar (Ehrlichkeit), aber klein — sie begründen das Verdikt,
   sie sind nicht die Show.
3. Eine feste Zeile darunter benennt das Prinzip: „Kein Würfel — die stärkste Reaktion entscheidet.
   Änderst du das Paket, ändert sich die Antwort." Das nimmt der Anzeige die Casino-Optik und macht
   sie zur Rückmeldung eines Verhandlungspartners.
4. Dazu der **Verhandlungs-Score** (`acceptanceScore`) als Summe und die **Deal-Druck-Signale**
   (`dealPressure`: Wechselstimmung, Vertrauensrisiko, Nachfass-Druck plus Klartext-Signale) als
   kleine Chips — die Frühwarnungen, warum ein an sich gutes Paket kippen könnte.
5. Das **Warum** steht nicht im Tooltip, sondern in der großen Karte darunter (Zone E).

Grün/Amber/Rot ist hier — anders als in der Board-Bilanz des Verkaufs — bewusst erlaubt: Zusage,
Nachforderung und Absage sind echte gute/mittlere/schlechte Ausgänge, keine neutralen Argumente.

### E — Verhandlungs-Bilanz (die große, nie zugeklappte Begründungs-Karte)

Das Kauf-Gegenstück zur Board-Bilanz. Zwei Abschnitte, weil die Daten zwei Fragen beantworten:

**„Warum die Antwort so ausfällt"** (`negotiationScoreBreakdown`):
- Ganz oben eine **Pinn-Zeile für deinen Hebel**: der Faktor „Gehaltsangebot" wird aus der Liste
  herausgehoben und hervorgehoben dargestellt („±0 — Angebot liegt auf der Forderung"), weil er der
  einzige Faktor ist, den der Slider direkt bewegt. Beim Ziehen sieht man genau diese Zeile kippen
  (−9 bei Lowball, +9 bei Überbietung) — die Brücke zwischen Stellschraube und Bilanz.
- Darunter zwei gleich breite, gleich laute Spalten: **Spricht für eine Zusage** / **Spricht
  dagegen**. Jede Zeile mit Punktwert (+45 Grundinteresse, +18 Teamfit, −4 Laufzeitsicherheit, …)
  und Kategorie-Tag (Basis / Fit / Vertrag / Kultur / Persönlichkeit / Historie / Laune) — dieselbe
  Muster-Erkennbarkeit wie die Kategorie-Tags der Board-Bilanz. Die Dagegen-Spalte ist immer
  sichtbar, auch leer.
- Summenzeile: „Verhandlungs-Score 68 von 99".

**„So entsteht seine Forderung"** (`demandBreakdown`): Basis-Zeile („Basis 3,8 Mio — aus MW, Klasse,
Traits"), dann die Faktoren als Prozent-Zeilen (Teamfit −3 %, Ambition +6 %, …), Abschlusszeile
„Forderung 4,3 Mio = 3,8 × 1,13". Wer die Forderung zu hoch findet, sieht hier, ob sie an ihm liegt
(Fit, Historie) oder am Spieler (Persönlichkeit, Laune) — und ob eine Stellschraube sie senken kann.

### F — Hinweise nach Gewicht
Dasselbe Stufenmodell wie im Verkaufs-Popup: **Blocker** (rot, eigener Callout ganz oben, nur aus
`blockingReasons`) / **Achtung** (amber: z. B. `offer_below_expected_salary`,
`low_team_fit_reduces_acceptance`, `previous_rejected_offer_reduces_trust`) / **Hinweis** (neutral:
z. B. `preview_only_contract_negotiation`, `market_bracket_factor_preview_pending`) / **Stärkt den
Deal** (grün: hoher Fit, Scouting-Bonus — aus `negotiationReasons`). Einstufung pro Key, unbekannte
Keys fallen defensiv auf „Achtung".

### G — Konsequenzen
Schmale Zeile, kauf-spezifisch und alles real im System: **Abbruch nach Kontakt** hinterlässt einen
Vertrauensmalus (der Close-Handler bucht ihn bei Abbruch nach Gegenangebot) · **eine Absage wirkt
nach** (`priorBadExperience`: Forderung steigt, Zusage sinkt in der nächsten Runde) · **Ausstieg
später kostet den Buyout** — bei Vertragsschluss ist das die volle Restsumme des Vertrags
(`calculateOpenBuyoutCost` bei 0 verstrichenen Saisons).

### H — Zweite Ebene (der einzige zugeklappte Bereich)
„Mehr zum Deal": Team-Marktwert vorher → nachher, Gehaltslast-Detail, die drei Deal-Druck-Werte als
Zahlen, Bracket, Rundungsausgleich (`roundingAdjustment`). Informiert die Entscheidung, trägt sie
nicht — exakt das Kriterium aus dem Verkaufs-Entwurf.

### I — Fußleiste
Links Abbrechen, rechts der Primärbutton; ist er deaktiviert, steht der Grund als Text daneben
(Friction-Lektion bleibt). Der heutige Zwei-Schritt-Flow bleibt erhalten, wird aber vom Button selbst
getragen: erst „Angebot senden", nach der Zusage wechselt die Fußleiste in die Abschluss-Stufe.
Der Abschluss-Button ist **Accent, nicht rot**: ein Kauf ist ein Commitment, kein destruktiver Akt —
das Danger-Rot bleibt dem endgültigen Verkauf vorbehalten.

---

## 4. Zustände

Genau ein tragender Zustand pro Ansicht. Der Kauf hat zwei mehr als der Verkauf, weil die Gegenseite
antwortet:

| Zustand | Was trägt | Primärbutton |
|---|---|---|
| **Lädt** | Hero mit Identität aus der Marktliste + Skeleton für C–E | deaktiviert, „Vorschau lädt…" |
| **Verhandelbar** | Vollbild wie oben, Stellschrauben aktiv | „Angebot senden" |
| **Gesperrt** | Vollbild + Blocker-Callout (s. u.), Stellschrauben bleiben bedienbar (Planungswert) | deaktiviert, Grund daneben |
| **Gegenangebot** | Amber-Banner: seine Zahl, Angebot wird automatisch auf sie gesetzt (heutiges Verhalten), Hinweis auf Abbruch-Malus | „Neues Angebot senden" |
| **Abgelehnt** | Roter Banner: „Heb das Gehalt an oder passe den Vertrag an" — Stellschrauben aktiv, Absage-Nachwirkung benannt | deaktiviert bis zur ersten Änderung, Grund daneben |
| **Zusage (Bestätigen)** | Grüner Banner + Fußleiste wechselt: Recap (Ablöse, Gehalt, Laufzeit, Summe), Stellschrauben eingefroren — jede Änderung würde die Zusage verwerfen (heutiges Verhalten: Outcome-Reset bei Reglerzug) | „Kauf abschließen — 16,8 Mio" + „Zurück (Paket ändern)" |
| **Verpflichtet (gebucht)** | Erfolgskarte ersetzt C–H: Ablöse und Gehalt p. a. zählen hoch, Vertragszeile | „Schließen" |
| **Fehler** | EINE Meldung + „Vorschau neu laden", Hero bleibt | deaktiviert |

### Gesperrt — zwei Fälle, ein Prinzip (geerbt vom Verkauf)
Die Vorschau bleibt vollständig lesbar, nur der letzte Klick ist zu:

1. **Harte Blocker** (`blockingReasons`: `insufficient_cash`, `roster_limit_reached`,
   `player_not_free_agent_in_scope`, …): **roter** Callout unter dem Hero mit dem ersten Grund groß
   und dem konkreten nächsten Schritt („Dir fehlen 5,6 Mio für die Ablöse — verkaufe zuerst oder
   wähle einen günstigeren Kandidaten"). Das Mockup zeigt den Cash-Fall.
2. **Regulärer Spielzustand** (Kauffenster/Phase, Nur-Ansicht-Modus): schmaler **Amber-Banner**,
   keine Alarm-Optik, Pill „gesperrt". Der Wert des Screens ist dann die Planung.

### Gegenangebot und Absage — die Zustände, die der Verkauf nicht hat
Beide sind **keine Fehler**, sondern Antworten. Darum ersetzen sie nicht den Screen, sondern setzen
sich als ein Banner in den Slot unter dem Hero, während Tisch und Bilanz sichtbar und (bei Absage)
bedienbar bleiben — man soll direkt sehen, an welcher Schraube man dreht, um die Antwort zu ändern.
Beim Gegenangebot wird zusätzlich der Abbruch ehrlich bepreist („Jetzt abbrechen hinterlässt einen
Vertrauensmalus"), weil das System genau das bucht.

---

## 5. Abgrenzung zum Verkaufs-Popup

**Bleibt gleich (Hausform):** Modal-Anatomie (fixer Kopf/Fuß, scrollende Mitte, X/Esc/Overlay),
Portrait groß links im Hero, die entscheidende Zahl groß rechts, 3-Sekunden-Zeile aus drei Kacheln,
eine große nie zugeklappte Begründungs-Karte mit zwei gleich lauten Spalten und Kategorie-Tags,
Hinweise nach Gewicht statt Einheitsrot, genau ein Disclosure, Grund neben deaktiviertem Button,
Erfolgskarte mit Count-Up.

**Bewusst anders — und warum:**

| Verkauf | Kauf | Warum |
|---|---|---|
| Kern ist eine **Bilanz** (Board-Meinung zum Lesen) | Kern ist ein **Tisch** (Stellschrauben + Reaktion) | Beim Verkauf entscheidest du allein; beim Kauf muss der Spieler zusagen — das Modal muss bedient werden, nicht nur gelesen |
| Eine Meinung (Board) über deine Aktion | Eine Haltung (Spieler) zu deinem Angebot, die du verschieben kannst | Interaktivität ist hier die Hauptinformation |
| 4 Zustände | 6 Zustände (+ Gegenangebot, + Abgelehnt) | Die Gegenseite antwortet — der Ausgang ist offen |
| Bestätigen-Stufe rot (endgültig, destruktiv) | Abschluss-Stufe Accent (Commitment, konstruktiv) | Rot bleibt echten Risiken vorbehalten |
| Accent/Amber für Argumente (bewusst kein grün/rot) | Grün/Amber/Rot für Zusage/Nachverhandeln/Absage | Das sind echte gute/schlechte Ausgänge, keine neutralen Argumente; die Score-Bilanz darunter nutzt weiter neutrale Marker |
| Große Zahl: Netto-Erlös (Cash rein) | Große Zahl: Ablöse (Cash raus), Vertragssumme als Live-Begleitzeile | Einzige fixe Zahl des Deals; die Gehaltslast ist ein Plan und bekommt die Jahresplan-Balken als eigene Bühne |

---

## 6. Interaktion & Zugänglichkeit

- `role="dialog"` + `aria-modal`, Fokusfalle, Esc schließt (außer während `buyBusy`).
- Haltungs-Balken mit `role="img"` und vollständigem `aria-label` („Zusage 58 %, Nachverhandeln
  30 %, Absage 12 % — Zusage überwiegt"); Verdikt und Banner mit `aria-live="polite"`.
- Stellschrauben sind echte Controls (Slider mit `aria-valuetext`, Segmente als Radio-Gruppe).
- Zahlen tabellarisch, Count-Up respektiert `prefers-reduced-motion`.
- Mobil (< 760 px): Hero stapelt, Tisch-Spalten untereinander (erst Stellschrauben, dann Reaktion),
  Bilanz-Spalten untereinander, Fußleiste bleibt fixiert.

---

## 7. Was das Mockup live zeigt — und was nicht

Damit „live gekoppelt" nicht behauptet, sondern gezeigt wird, ist im Mockup ein kleiner Demo-Kreis
verdrahtet — **ohne die echte Engine nachzubauen**:

- Der **Gehalts-Slider** hat drei Stufen (3,9 / 4,3 / 4,7 Mio) mit drei **handgebauten
  Reaktions-Schnappschüssen** (Verdikt, Balken, Score, Pinn-Zeile, Vertragssumme, Gehaltslast).
  Die Punktrechnung der Schnappschüsse folgt der echten Formel (Angebots-Delta × 95, gedeckelt),
  ist aber handverdrahtet — keine zweite Engine.
- Die **Zustände erzählen dieselbe Geschichte wie ihr Banner**: „Gegenangebot" springt auf das
  Lowball-Paket (3,9), das die Nachforderung provoziert hat; „Abgelehnt" zeigt zusätzlich den
  „angefressen"-Faktor (−14, Historie) in der Dagegen-Spalte und ein Absage-dominantes Verdikt
  (Score 45, Haltung 30/32/38). Ein Reglerzug hebt den Schnappschuss auf — das ist genau die
  Geste „Paket nach der Antwort anpassen".
- Die **Vertragsform** schaltet die Jahresplan-Balken um. Die Balkenwerte folgen der echten
  Gewichtsformel aus `buildShapeWeights` (bei 3 Saisons: 1,2 / 1,0 / 0,8).
- **Laufzeit** und **Rolle** sind anklickbar, verändern im Mockup aber nichts — im Spiel rechnet
  die echte Preview. Im Mockup steht das dran.

---

## 8. Referenzfall — ERFUNDEN, klar markiert

Beim Verkaufs-Popup stammten alle Zahlen aus einem echten Spielstand. **Hier nicht.** Es gibt keinen
gemessenen Kauf-Referenzfall; alle Zahlen unten sind **erfunden** und nur intern konsistent gehalten.
Lieber ehrlich beschriftet als falsche Präzision. Was trotzdem „echt" ist: die Formeln, wo sie
deterministisch sind (Jahresplan-Gewichte, Buyout = Restsumme, Gegenangebots-Formel
`max(Forderung × 1,04; Angebot × 1,08)`, Punkte-Deckel des Angebots-Faktors) und sämtliche
Feldnamen, Kategorien und Zustandsübergänge aus `TransfermarktBuyPreview` bzw. dem heutigen Flow.

Die Geschichte schließt an den Verkaufs-Referenzfall an: Team C-C hat Claudelio Feelgood verkauft
(Cash danach 24,1 Mio, Kader 8) und sucht Ersatz.

**Sable Windrunner** (erfunden), Sprinter · Elf, Bracket 3, Team-Fit 27:
- Ablöse 16,8 Mio · Cash 24,1 → 7,3 Mio · Kader 8 → 9
- Basisforderung 3,8 Mio · Forderungsfaktor ×1,13 → Forderung 4,3 Mio · Startangebot 4,3 (Ratio 1,00)
- Vertragswunsch: 2–4 Saisons, ideal 3, Form ausgeglichen → Startpaket passt
- Laufzeit 3 · ausgeglichen → Jahresplan 4,3/4,3/4,3, Summe 12,9 Mio, Buyout heute 12,9 Mio
- Score 68 = +45 Grundinteresse, +18 Teamfit, +6 Vertragswunsch, +4 Scouting, +2 Tagesform,
  ±0 Gehaltsangebot, −4 Laufzeitsicherheit, −3 Ambition
- Haltung 58 / 30 / 12 → Verdikt „Er sagt zu"
- Deal-Druck: Wechselstimmung 21 · Vertrauensrisiko 9 · Nachfass-Druck 27 · „kein auffälliger Zusatzdruck"
- Team: Gehaltslast 33,2 → 37,5 Mio p. a. · Team-MW 148,3 → 165,1 Mio
- Slider-Schnappschüsse: 3,9 Mio → Score 59, Haltung 38/44/18 („verhandelt nach");
  4,7 Mio → Score 77, Haltung 72/21/7 („sagt klar zu")
- Abgelehnt-Zustand: 3,9 Mio plus „angefressen"-Malus −14 → Score 45, Haltung 30/32/38 („lehnt ab")
- Gegenangebots-Zustand: nach Lowball 3,9 fordert er 4,5 Mio (echte Formel: max(4,3 × 1,04;
  3,9 × 1,08) = 4,47), +0,6 gegenüber dem Angebot
- Gesperrt-Zustand: Cash-Variante 11,2 Mio → es fehlen 5,6 Mio für die Ablöse

Bei der Verdrahtung kommen alle Werte 1:1 aus `TransfermarktBuyPreview` — es gibt keinen Wert im
Entwurf, den die Preview nicht liefert (die Rolle liefert der Param `promisedRole`, der heute schon
existiert und nur kein UI hat).

---

## 9. Nach der Abnahme (nicht Teil dieses Entwurfs)

1. Umlaute in den Verhandlungs-Quelltexten reparieren (Abschnitt 10).
2. Warning-Gewichtsklassen als Mapping neben `formatNegotiationSignalLabel` anlegen.
3. Modal als neue Komponente bauen (Props-Kontrakt kompatibel zu `FoundationMarketBuyShellHost`,
   damit die Verdrahtung ein Austausch ist); `promisedRole` als vierte Stellschraube durchreichen.
4. Alten Kaufblock ersetzen, Tests stabil halten (`transfer-buy-confirm-button`,
   `transfer-buy-disabled-reason`, `transfer-buy-rejection-reason`, `contract-offer-screen`, …).

---

## 10. Datenqualität: Umlaute gehören in die Quelle repariert

Wie beim Verkauf (dort Abschnitt 7): Verhandlungstexte kommen teilweise in ASCII-Ersatzschreibweise
aus der Quelle — „Stoert ihn" (Buy-Host), „fruehere Absage belastet", „fuer lange Bindung",
„Ueberdurchschnittliches Angebot" (`transfermarkt-local-service.ts`, `use-market-buy-derivations.ts`,
`contract-negotiation-preview.ts`). Das wird nicht in der View geflickt, sondern einmal in den
Quelltexten korrigiert — für alle Anzeigen. Das Mockup zeigt die korrigierten Texte als Soll-Zustand.

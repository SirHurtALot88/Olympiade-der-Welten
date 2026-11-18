# Form, Moral und Farbregel im echten Spiel (Bau und Scharfschaltung, 18.11.)

Vorlage: Mockup `public/mockups/form-moral-modern-17-11.html` (Erklärung `form-moral-anzeige-17-11.md`), Regelwerk und
Messungen `form-moral-17-11.md`. Chris-Entscheidungen: Moral überall als Zahl, **als Gesicht in Farbe von grün bis rot
(nicht Herz)**, Karten-Marke dreiteilig, Bauchbinde nach jedem Spieltag automatisch.

## Was gebaut ist

**Eine Wahrheit für die Farbregel.** `calculateFormModifierForSide` rechnet über `formkartenZerlegungFuerSpieler` und liefert
`formByPlayerId` (alle / Farbe / Form-Hebel / Summe je Spieler). Es lesen dieselbe Funktion: Legacy-Wertung
(`legacy-matchday-resolve-engine`, `legacy-lineup-preview-from-context`, Score-Engine verteilt je Spieler), Arena-Aufstellungsadapter
(`arena-aufstellung-adapter`), Einsatzliste (`lib/lineups/formkarten-wirkung.ts`) und der KI-Kartenplan (`formCardSlotValue` über
`kartenWertFuerSpieler`). Test: `tests/form-moral-bau.test.ts` (Anzeige = Wertung, Arena = Wertung in `formkarten-echt-motor.test.ts`).

**Form-Verlauf.** `playerFormState[].verlauf` (additiv, höchstens 40 Einträge, nur laufende Saison): Form danach und davor,
Einsatz ja/nein, Leistungs- und Erwartungs-Perzentil, Disziplin, Bremse (Erschöpfung mit Punkten oder Verletzung). Alte Stände ohne das
Feld laden unverändert, die Kurve beginnt beim nächsten Spieltag. Saisonwechsel: Form zurück auf 50, Verlauf leer
(`resetPlayerFormForNewSeason`, an beiden Stellen, an denen die Moral-Carry läuft).

**Form in der Legacy-Wertung.** Form skaliert dort den Spielerwert neben der schon vorhandenen Moral (`formWirkungByPlayerId`,
dieselbe Dosis wie in der Arena). Die Moral des Legacy-Pfads (+8 %/−10 %) bleibt unverändert; sie auf die Arena-Skala zu ziehen ist
weiterhin offene Frage 3 an Chris.

**Moral als Gesicht.** `components/foundation/broadcast/BcMoralGesicht.tsx` (eigenes SVG, kein Emoji-Font), Logik `lib/morale/moral-anzeige.ts`.
Gesichtsausdruck und Farbe folgen dem Wert stetig; die fünf Stufen sind dieselben wie `getVisibleMood`:

| Wert | Stufe | Gesicht | Farbe |
|---|---|---|---|
| 80–100 | sehr zufrieden | lachende Augen, Mundwinkel weit oben | grün (`--bc-gut`) |
| 60–79 | zufrieden | Lächeln | grün bis gelbgrün |
| 40–59 | neutral | gerader Mund | bernstein (`--bc-acht`) |
| 20–39 | unzufrieden | Mundwinkel unten | orange |
| 0–19 | verärgert | Mundwinkel tief unten, Brauen | rot (`--bc-warn`) |

Überall gleich: Platzkarte, Kaderliste, Warum-Block, Reiter „Form & Moral“, Spielerprofil-Blatt, Spieler-Drawer
(`PlayerDetailDrawer`, das Emoji ist ersetzt).

**Oberfläche (Einsatzliste modern).** Platzkarte und Kaderzeile: Form-Pfeil + Moral-Gesicht, anklickbar zum Warum. Reiter „Form & Moral“:
Team-Form (fünf Zähler), Moral-Schnitt, eine Zeile je Aufgestellter mit Wirkung in Prozent, darüber der Warum-Block (Form, letzte drei
Einsätze Erwartung → Leistung, Erschöpfung mit Bremse, Moral mit drei Ursachen, Summe), darunter Formkarten-Wirkung mit Regel in einem
Satz und der Tabelle „Wer bekommt“ (alle / Farbe / Form / gesamt, Team-Summe). Spielerprofil-Blatt: Form-Kurve (gefüllt = Einsatz,
hohl = kein Einsatz), Leistung gegen Erwartung, Moral-Ursachen. Nach dem Spieltag: Bauchbinde (größte Bewegung, blätterbar,
wegklickbar) und Liste „Form-Meldungen“ im Spieltagsergebnis, jeweils mit Begründung. Phone: Blatt von unten (Screenshot `app-07`).

**Gezeigt = gebucht.** `formkartenBuchung`: im Manager-Modus (Legacy-Wertung) zählt die gespielte Karte in jeder Disziplin; im
Battle-Modus nur dort, wo der Motor die echte Karte liest (`FORMKARTEN_ECHT_DISCIPLINE_IDS`: time-trial, spurt). In den übrigen
Arena-Disziplinen zeigt die Einsatzliste keine Punkte an der Platzkarte und schreibt stattdessen, dass die Karte dort noch nicht zählt.
Form und Moral wirken in der Arena für alle arena-aufgelösten Disziplinen (`arena-kader-adapter`), die Warum-Zahlen sind genau diese.

## Messung (Abnahme)

Methode: `scripts/miss-form-moral-dosis.mts` (n = 24 Spiele je Variante, Median der Kader-Familie, rho gegen die Eignung ohne Modifikator,
also die strenge Lesart) und `scripts/miss-formkarten-farbregel.mts`. Rohdaten der Läufe vom 18.11.

### Form + Moral, Dosis 1,0 gegen Basis (rho je Spiel)

| Disziplin | Basis | Dosis 1,0 | Δ |
|---|---:|---:|---:|
| basketball | 0,862 | 0,824 | −0,038 |
| battlefield (Sonde, s.u.) | 0,589 | 0,586 | −0,003 |
| breaking | 0,860 | 0,858 | −0,002 |
| climbing | 0,797 | 0,765 | −0,032 |
| eiskunstlauf | 0,927 | 0,915 | −0,012 |
| fechten | 0,876 | 0,862 | −0,014 |
| football | 0,874 | 0,872 | −0,002 |
| gewichtheben | 0,892 | 0,890 | −0,002 |
| hockey (Sonde, s.u.) | 0,700 | 0,713 | +0,013 |
| i-spy | 0,853 | 0,857 | +0,004 |
| mini-dm (Sonde, s.u.) | 0,199 | 0,261 | +0,062 |
| showcase | 0,771 | 0,760 | −0,011 |
| speed-schach | 0,904 | 0,902 | −0,002 |
| spurt | 0,903 | 0,871 | −0,032 |
| staffel | 0,957 | 0,952 | −0,005 |
| takeshis-castle | 0,838 | 0,851 | +0,013 |
| tdm | 0,911 | 0,912 | +0,001 |
| tennis | 0,885 | 0,859 | −0,026 |
| time-trial | 0,934 | 0,930 | −0,004 |
| wettessen | 0,905 | 0,889 | −0,016 |

Lesart: **keine Disziplin, die auf dieser Sonde vorher ≥ 0,80 war, fällt unter 0,80**; die größten Kosten tragen basketball (−0,038, bleibt
0,824), spurt, climbing, tennis (je −0,03). Unter 0,80 liegen schon in der Basis battlefield, hockey, mini-dm (Sonden-Artefakte: diese
Sonde misst Pod-/Torwart-Mechanik nicht wie `disziplin-abnahme.json`, deren Werte 0,874 / 0,70 / 0,80 sind), climbing (0,797) und showcase
(0,771). **Climbing und showcase sind die engen Fälle**: amtlich 0,801 / 0,781 (`disziplin-abnahme.json`), mit Dosis 1,0 auf der Sonde 0,765 / 0,760,
also über der harten Schranke 0,75, aber unter dem Ziel 0,80. Hockey liegt amtlich schon vor diesem Bau bei 0,70 (Arbeitsauftrag
Hockey, unabhängig). Mit Dosis 1,0 ist die Schranke 0,75 nirgends durch Form + Moral verletzt, die nur auf der Sonde unter 0,75 stehenden
Disziplinen sind in der Basis schon dort.

### Farbregel „neu“ (PM-Faktoren) gegen „alt“

Die gespielte Karte erreicht den Arena-Motor nur in time-trial und spurt; dort ist die Farbregel real wirksam. Gemessen (Modus „echt“,
gleicher Kartenzug je Spiel):

| Disziplin | rho alt | rho neu (PM) | Pp alt (zwei Saatströme) | Pp neu (zwei Saatströme) |
|---|---:|---:|---|---|
| time-trial | 0,941 | 0,942 | 12,8 / 14,6 | **11,6 / 10,7** |
| spurt | 0,918 | 0,892 | 13,9 / 9,6 | **15,4 / 13,0** |

Pp (Budget-Methode, `einflussVon`, **12 Läufe je Saatstrom**, Versatz 0 und 10 000 000): beide Disziplinen deutlich unter der Pflichtgrenze 25,
spurt knapp über dem angestrebten Optimum 15 im ersten Strom. rho (n = 3 Spiele in diesem Lauf, daher nur Größenordnung; n = 24-Werte für time-trial
0,930 → 0,936 liegen vor). Kumuliert mit Dosis 1,0: spurt etwa 0,903 → 0,84, time-trial ≈ 0,93 — beide weit über 0,80.
Zusätzlich n = 24 für weitere Disziplinen unter Karten-Hypothese (dort wirkt die Regel im Spiel nicht, nur Vergleich): tdm 0,900 → 0,898,
staffel 0,958 → 0,955, gewichtheben 0,887 → 0,895, eiskunstlauf 0,926 → 0,922, basketball 0,864 → 0,849, breaking 0,853 → 0,846, climbing 0,789 → 0,755.

**Nicht lückenlos gemessen:** ein vollständiger n = 24-Lauf der Farbregel über alle zwanzig Disziplinen scheiterte an der Messmaschine (Speicher, Browser
mehrfach beendet); die Disziplinen, in denen die Karte im Spiel nicht gebucht wird, sind dafür nicht abnahmerelevant, bleiben aber als offene Nachmessung.

### Wertungs-Fingerabdruck

`node scripts/pruefe-wertung-fingerabdruck.mjs` → **GESAMT ce8fcef66028 (75 Einträge)**, identisch zu main. Erwartet: die Engine
(`public/mockups/battle-mode.engine.js`) ist nicht angefasst, alle Änderungen liegen in Adaptern und Anzeige.

## Scharfschaltung

Standard jetzt AN: `OLY_FORM_MORAL` (Form + Moral), Dosis **1,0** je Stufe, `OLY_FORMKARTEN_FARBREGEL` = neu. Abschalten:
`OLY_FORM_MORAL=0`, `OLY_FORMKARTEN_FARBREGEL=alt`. Im Browser-Bundle fehlt `process.env`; dort gelten die Standardwerte. Wer serverseitig
abschaltet, müsste die Anzeige im Browser ebenfalls abschalten (heute nicht gekoppelt): die Form-Teile der Oberfläche blenden sich aus, wenn der
Spielstand keine `playerFormState` hat, die Karten-Zahlen der Einsatzliste folgen im Browser dem Standard.

## Offen

- Climbing und showcase liegen mit Form + Moral unter dem Ziel 0,80 (über 0,75); Hockey amtlich 0,70 unabhängig davon.
- Formdynamik: ein ▲▲-Spieler, der nur „auf Erwartung“ spielt, fällt um bis zu 8 Punkte (Ziel ist die Mitte). Das ist konzeptgemäß,
  wirkt im Bericht hart; der Bericht erklärt es mit „Die Form nähert sich der Mitte.“
- Kopplung Server-/Browser-Schalter, Legacy-Moral auf Arena-Skala (Frage 3), Nachmessung der Farbregel über alle 20 Disziplinen.

## Review-Nachträge (18.11., Opus-Review zu PR #1571)

1. **Moral gezeigt = gebucht.** Die Anzeige kennt zwei Pfade (`wertungsPfad`): Legacy-Wertung (Manager-Modus und PPS-Disziplinen im Battle-Modus) zeigt den
   Moralanteil aus `buildPlayerMoralePerformanceMap` (+8 %/−10 %, „% Spielerwert“), die Arena (Battle, arena-aufgelöst) den aus `buildFormMoralMultipliers`
   („% Eignung“, höchstens ±⅔ Dosis). Die Legacy-Skala selbst bleibt unverändert. Test: Anzeige-Prozent == gebuchter Multiplikator je Pfad.
2. **Formkarten-Dropdown und Formboard** (`LegacyLineupLabClient`, `FormBoardPanel`) zeigen „x2“ nur noch bei der alten Regel; die neue zeigt
   „passt: +8 alle, +4 Farbe“ aus `kartenEffekt` (= `kartenZerlegungFuerSpieler`).
3. **Regelstand serverseitig.** `LegacyLineupLoadedContext.formMoralRegeln` ({formMoral, dosisPct, farbregel}) wird vom Server gesetzt
   (`lib/morale/form-moral-regeln.ts`); Anzeige, lokale Vorschau und Resolve lesen ihn statt `process.env`.
4. **Keine Selbstverstärkung der Form.** Die Score-Engine liefert je Spieler `formSystematisch` (Form-Multiplikator + flacher Kartenwert, ohne
   Tagesform-Zufall), das auf `playerDisciplinePerformances` gespeichert wird; die Fortschreibung vergleicht `finalPlayerScore − formSystematisch` mit
   der Erwartung. Verteilung der nachgeführten Form am Abbild (10 Spieltage, 328 Spieler mit Einsatz, damalige Verletzung/Erschöpfung aus `injuryEvents`):
   min 11,4 / p10 33,1 / Median 50,7 / p90 67,2 / max 83,9, Mittel 50,5; Stufen ▲▲ 2,7 %, ▲ 29,0 %, – 41,2 %, ▼ 22,6 %, ▼▼ 4,6 %.
   Einschränkung: das Abbild stammt aus der Zeit vor der Form, seine Leistungszeilen enthalten noch keinen Form-Anteil — der Effekt der Korrektur selbst
   lässt sich erst an einer Saison mit aktiver Form messen.
5. **Nachführ-Skript** nimmt Verletzung und Erschöpfung von damals aus `injuryEvents` (statt des heutigen Stands).
6. **Größe.** Kompakter Verlauf (`m`, `f`, `e`, `l`, `x`, `d`, `b`, `v` nur am ersten Eintrag, keine Nullfelder, Saison in der Zeile):
   251 KB statt 669 KB nach zehn Spieltagen. `entpackeFormVerlauf` liefert die lesbare Form.
7. **Form als eigener Schritt** in der Score-Engine (`formMultiplierPunkte`), `moraleModifier` bleibt reine Moral.
8. **Tagesform in der Karten-Anzeige** ausgewiesen („Tagesform ±4“), Zeilen mit |Kartenwert| < 4 tragen ein „~“ (Vorzeichen kann kippen).
9. **KI** (`formCardDeploymentValue`, `takeCheapestNegativeFormCard`) rechnet über `kartenEffekt`.
CI-Fall `legacy-matchday-resolve` (Form-Summe 0,2 statt ≥ 4): gewollte neue Regel (Karte rot +4 / blau +2 in einer anderen Disziplinfarbe zählt nur halb bzw. voll
ohne Farbträger); Test leitet den Sollwert jetzt aus `formkartenSummeFuerSpieler` ab, ein Zweitfall pinnt die alte Regel, dazu „Vorschau = Resolve“ je Regel.

## Einsatzliste näher am Mockup (Chris 18.11.: „genauso hätte ich das auch gern“)

Angeglichen an `public/mockups/form-moral-modern-17-11.html` (Branch `origin/claude/form-moral-mockup-17-11`), alle Zahlen aus der einen Wahrheit:

| Mockup-Baustein | App (Einsatzliste modern) |
|---|---|
| Kopf „Team-Form · Moral Ø“ mit ▲▲/▲/–/▼/▼▼-Zählern | `TeamFormKopf` im Hero rechts (Aufgestellte beider Seiten, Moral-Schnitt als Gesicht) |
| Disziplin-Reiter „Karten +61,5“ / „ohne Karte“ | Reiter-Zusatz „erwartet · Karten +X“ / „ohne Karte“ / „Karte zählt hier nicht“ (nicht gebucht) |
| Kader-Spalten PLATZ · FORM · MORAL · KARTE | getrennte Spalten Form (Pfeil), Moral (Gesicht + Zahl), Karte (nur Aufgestellte, Bankspieler „–“) |
| Platzkarten mit Form-Pfeil, Moral, Karten-Chips | `FormMoralMarke` + `KartenMarke` (alle / Farbe / Form), Karten-Chips nur wo gebucht |
| Leiste „FORMKARTEN · n GELEGT“ mit Kacheln (passt / fremd ½) und „KARTEN FÜRS TEAM“ | `KartenLeiste` unter den Kartenwahl-Menüs: Kacheln mit Wert, Farbe, Spieler, passt/fremd ½, Summe alle · Farbe · Form |
| Reiter „KARTEN-WIRKUNG \| FORM & MORAL“ | zwei eigene Kontext-Reiter; Karten-Wirkung mit Regelsatz, Tabelle „Wer bekommt“ (alle/Farbe/Form/Karte), Tagesform-Hinweis, „Alle Karten im Vergleich“ |

Abweichung vom Mockup, bewusst: Das Mockup hat eine „Hand“ mit Antippen-Legen; die App behält die bestehenden Kartenwahl-Menüs (Plan wird gespeichert) und
ergänzt Kacheln und Vergleich darüber. Bankspieler zeigen keine Karten-Wirkung („würde bekommen“ wäre nicht gebucht).

**Screenshots:** Die Mockup-Bilder liegen auf dem Mockup-Branch (`docs/design/form-moral-anzeige-17-11/01…17-*.png`), die App-Bilder (`app-01…07`) in diesem Ordner.
Die App-Bilder dieses Standes (mit den neuen Bausteinen) konnten nicht neu aufgenommen werden: die Platte der Umgebung war voll (< 1 GB frei, Dev-Server plus Spielstand-Kopie
würden fremde Läufe gefährden). Die vorhandenen `app-*.png` stammen vom Stand davor (Kader-Spalte „Form · Moral“ zusammen, Karten-Wirkung im Reiter „Form & Moral“).
Neu aufnehmen: Dev-Server mit `OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0`, Kopie des Abbilds, `scripts/form-am-save-abbild-nachfuehren.ts`, dann Playwright.

### Abgleich Mockup | App je Feature

| Mockup-Feature | Status |
|---|---|
| Kopf Team-Form · Moral Ø (Zähler) | drin |
| Disziplin-Reiter mit Karten-Summe / ohne Karte | drin (angepasst: zusätzlich „Karte zählt hier nicht“) |
| Kader-Spalten Platz · Form · Moral · Karte | drin (Karte nur für Aufgestellte) |
| Platzkarte mit Form-Pfeil, Moral-Gesicht, Karten-Marke | drin (angepasst: Marke nur, wo gebucht; in dichten Feldern kann die Nachbarkarte den Klick überdecken) |
| Moral als Herz | angepasst: Gesicht in Farbe (Chris) |
| Formkarten-Leiste mit Kacheln und „Karten fürs Team“ | drin (angepasst: über den bestehenden Kartenwahl-Menüs statt Hand mit Antippen-Legen) |
| Hover-Vorschau der Karte vor dem Legen | fehlt |
| Karten in der Hand abgedunkelt („in Spurt“), Legen per Klick | fehlt (Menüs bleiben) |
| Reiter Karten-Wirkung + Form & Moral | drin |
| Tabelle „Wer bekommt“ (alle/Farbe/Form/gesamt) | drin |
| Hinweisbox, Karten-Vergleich | drin (Vergleich: bis 8 Karten) |
| Kader-Karte „würde bekommen“ für Bankspieler | bewusst nicht (nicht gebucht) |
| Spielerprofil mit Kurve, Leistung gegen Erwartung, Moral-Ursachen | drin (Blatt) |
| Bauchbinde nach dem Spieltag + Meldungen | drin |
| Phone-Blätter | drin |

**Zielgeräte (Chris, korrigiert 18.11.):** MacBook Air 15" M4 = Viewport 1710×1112 (16:10, DSF 2), Hauptrechner 32" 4K = 2560×1440 (Nebenprobe 1920×1080).
Es gibt Regeln für unter 1500 px (kleinere Kacheln und Zähler) und ab 2200 px (größere Schrift in den Form-Bausteinen). **Aufnahmen bei 1710×1112, 2560×1440 und 1920×1080 stehen aus:**
die Platte der Umgebung war wiederholt voll (zuletzt < 700 MB frei), ein Dev-Server plus Spielstand-Kopie hätte fremde Läufe gefährdet. Vorhanden sind nur die Aufnahmen
bei 1600×900 und Phone 390×844 vom Stand davor. Vor dem Merge nachholen: Dev-Server (`OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0`, eigener Port), Kopie des Abbilds,
`scripts/form-am-save-abbild-nachfuehren.ts --save new-game-1787123325719-swnjlk`, dann die drei Viewports mit Playwright.

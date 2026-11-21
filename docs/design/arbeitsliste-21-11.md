# Arbeitsliste 21.11. — alle Rückmeldungen vom 19./20.11., priorisiert

Quelle: Chris' Nachrichten vom 19. und 20.11. (Screenshots aus dem Spielstand `new-game-1795114260527-nzr0z9`) und die
In-Game-Meldungen bis 20.11. Freigabe von Chris: „du fängst Samstag erst an, das alles zu sortieren und zu priorisieren,
und dann geht es direkt los“. Größere neue Konzepte bekommt Chris weiter zuerst als Mockup.

Regeln, die für jeden Punkt gelten: Wertungsänderung → Fingerabdruck absichtlich neu, rho ≥ 0,75 in einem Spiel,
Pp ≤ 25, Opus-Review. Reine Anzeige → Fingerabdruck muss gleich bleiben. Assets nur PixelLab, keine neuen Figuren und
Animationen. Ränge (Tabelle, Kaderstärke) je Liga; PP und Marktwert/VK über beide Ligen.

## Welle 1 — Spielfluss kaputt (sofort, parallel)

| # | Punkt | Wer |
|---|---|---|
| 1.1 | **Draft-Tempo**: „Vor zu meinem Pick“ nur rechnen, ≤ 2 s (WIP `claude/draft-ki-tempo-19-11`: 2,3–3,1 s) | Sonnet |
| 1.2 | **Draft lässt sich nicht abbrechen** (Abbrechen, Überspringen, Fertig) | Sonnet |
| 1.3 | **Startwahl „Draft spielen / Selbst kaufen“** als unübersehbarer Dialog nach Saisonstart; KI kauft bei „Selbst kaufen“ sofort | Sonnet |
| 1.4 | **Paarungen D1 ≠ D2** (2. Disziplin mit anderen Teams) | Opus |
| 1.5 | **Saison-Rang / ±-Rang nur in der eigenen Liga** (heute über 32) | Opus |
| 1.6 | **Tennis 5 Einzel endet 2:2** | Opus |
| 1.7 | Hover Spieltagswertung „noch offen“ nach Wertung | Opus |
| 1.8 | **Einsatzliste speichern**: Mehrfachklick / 20 s bis Arena; sofortiges Feedback | Sonnet |
| 1.9 | **Wertung nach D2 dauert lange** | Sonnet |
| 1.10 | Arena: eigene Matches zuerst, KI danach; D2 während D1 vorladen; **kein Auto-Sprung D1→D2**; **Endergebnis bleibt stehen** | Sonnet |
| 1.11 | **Gewichtheben zeigt Platzhalter-Glatzköpfe** statt Pixel-Figuren | Sonnet |
| 1.12 | **TDM live noch alte Gegenüber-Arena**, endet 0:0 nach Zeit → echtes TDM-Gefecht, Kampf bis zum Ende (keine Respawns) | Sonnet |
| 1.13 | **Staffel**: Übergabe findet nicht statt; nächster Läufer wartet an Start/Ziel, Stab wird übergeben und getragen | Sonnet |
| 1.14 | **PP-Analyse**: PP folgen der Leistung nicht (Spurt Score 142,7 → 1,2 PP; Eiskunst viele glatt 5; Hockey keiner 5) | Opus |

## Welle 2 — halb Fertiges abschließen, Mockups einbauen

| # | Punkt |
|---|---|
| 2.1 | Transfermarkt: Hover-Bild, PP-Spalte weg, Spaltenbreiten, großes Profil (WIP `claude/tm-spalten-ziehen-hover-19-11`) |
| 2.2 | Verhandlung: Liste = Startforderung, eigenwillige Spieler trait-basiert (Diagnose auf `claude/tm-verhandlung-fix-19-11`) |
| 2.3 | Kaderstärke: Spieltage, Slots je Auftritt, Sortierung Spielplan (`claude/tm-diszi-spielplan-19-11`, Layout zu eng) |
| 2.4 | ~~Draft: verhandeln über „Picken“~~ — **entfällt (Chris 21.11.)**: im Draft wird immer fest 1 Saison gepickt, Mensch und KI, ohne Verhandlung; verhandelt wird erst bei Verlängerungen am Ende von S1. Der Markt-Verhandlungstisch ist während des Drafts zu. |
| 2.5 | Team-Fit: positive Fits + Mercs standardmäßig, negative per Schalter (alte Marktregel) |
| 2.6 | Filter bleiben beim Reiterwechsel stehen (Markt + Draft) |
| 2.7 | Draft-Brett links: Umschalter Draftliste ↔ Stats meines Teams (In-Game-Meldung, gab es früher) |
| 2.8 | Training/Entwicklung nach Mockup `training-modern-18-11` bauen; alle übrigen Mockups gegen den Ist-Stand abgleichen und bauen |
| 2.9 | PR #1656 (TM-Spalten sortierbar) mergen |

## Welle 3 — Anzeige-Fixes (Fingerabdruck gleich)

- Spieltagswertung: Diff, Paarungen (wer gegen wen), Form/Captain je Disziplin, Mutator-Spalte raus, Spiele anderer Teams ansehen (Wiederholung).
- Ergebnis bei Summen-Disziplinen als Summe statt 1:0 (Time Trial, Spurt, Staffel …); Breaking zählt besiegte Gegner (2:1).
- Arena: gleiche Slot-Namen beidseitig; Arena-Vorschau mit Liga-Rängen; 4er-Disziplinen klar kennzeichnen.
- Einsatzliste: Disziplin/beide leeren, Auffüllen nur aktive Disziplin, Gegner-Rang im Kopf, alle Gegner bei 4er.
- Spieler-Drawer: Porträt + Figur nebeneinander (OVR-Rahmen), Kacheln OVR/MVS/PP, Form und Moral, Achsen vertikal, Abschnitt Training, PP-Liste zeigt alle Spieltage.
- PP-Ränge OLY-weit (beide Ligen); Marktwert/VK-Pool über beide Ligen.
- Home: Kasse → Finanzen. Navigation: Spielplan nach oben. Alle Tabellen sortierbar (Designsystem-Regel). Alte Tooltips entfernen/ersetzen.

## Welle 4 — Mechanik (Wertung, Opus-Review)

- Formkarten: keine 0er, jede Karte ±; Karten-Wirkung zeigt negative; KI setzt Formpunkte gezielt (Siege, Rivalen, Reserve); Formpunkte im Saisonstand/Gegneranalyse.
- Battlefield: 5-Punkte-Domination als Standard + Respawns mit sinkenden HP.
- Hockey: Torwart-Balance (Puste unter Dauerfeuer oder Gegentor-Abzug), PP-Skala.
- Basketball: Puste; Maru-Fall ST7 (fast null Beteiligung) prüfen.
- Spannungsbögen in allen Disziplinen (Davonziehen und Aufholen).
- Breaking: Tag-Team-1v1 (Tekken/Street-Fighter-Art, Ein- und Auswechseln, jeder kommt dran), HP/DMG je Spieler und Waffe unterschiedlich.
- Takeshi: ruckelt, unübersichtlich, zu schnell vorbei.
- Wettessen-Rework (Ereignisse statt Zähler).
- Pause nach 10 Spieltagen: ein Spieltag Fatigue-Regeneration für alle, sichtbar kommuniziert.
- Finanzen je Spieltag buchen (Sponsor-Raten, Heimspiel-Einnahmen, Gehalt, Unterhalt).
- Vertragsverlängerung während der Saison (gilt ab sofort, laufende Saison zählt mit).

## Welle 5 — Konzeptrunde (Fable-Mockup → Chris → bauen)

Spieltag-Layout einheitlich (Steuerknöpfe, Spieler-Ratings als Overlay; zuerst Basketball perfektionieren, dann ausrollen) ·
Draft-Ergebnisseite · Belastung/Resistenz-Stufen · Inbox (Trainingswünsche, Verletzungen …) · Vorstandsziele (keine
Widersprüche, Laufzeit-Quoten, Lieblingsspieler) · Bonuszahlungen Spieler/Team · Spielerprofil Leistung (All-Time-Ränge)
und Karriere (Einsätze, PP, Achsen mit Rang, OVR, MVS, MW, VK) · Seiten-Sichtung auf neuen Standard ·
PixelLab-Remakes Spurt und Gewichtheben + Altlasten-Audit mit Guard-Test.

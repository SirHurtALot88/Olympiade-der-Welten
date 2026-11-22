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

## Geparkt — Ligagröße (Chris 22.11.)

- **Neue Teams und Aufsteiger nur notiert, nicht umgesetzt.** Mockup und Datenvorschlag liegen in
  `public/mockups/neue-teams-40-21-11.html`, `docs/design/neue-teams-40-21-11.md`,
  `docs/design/neue-teams-40-21-11/vorschlag.json` (10 Teams, alle für Liga 2; Aufsteiger-Vorschlag M-S, D-P, V-V, T-G).
  Chris: erst umsetzen, wenn mit 16 Teams je Liga alles sauber läuft — 20er-Ligen hießen, alle Layouts anzupassen.
- **Entschieden (Chris 22.11. abends): vorerst 2×16, später potentiell 2×20** (Empfehlung Rahmenkonzept: 2×20 mit vier
  Auf-/Absteigern als Ziel einer späteren Welle; 3×16 verworfen — 16 neue Teams, +50 % Rechenzeit auf dem 4-GB-Server).

## Welle 4 — Stand 22.11. abends

Gemergt: Basketball Puste (#1677), Finanzen je Spieltag + Rang-Abschlag (#1678), Takeshi (#1679), Arena-Vorstellung (#1680),
Breaking Tag-Team (#1681), Formkarten Plus/Minus 2/4/6/8 + Gegenfarbe (#1682). Offen aus Welle 4: Spannungsbögen,
Wettessen-Rework (Konzept `docs/design/wettessen-ereignisse-22-11.md`, Strafe „Würgen“ ja), PixelLab-Arena + Geräte für
Breaking, Hockey rho (Feldspieler-Validität).

## Welle 6 — aus der Gameplay-Review 22.11. (`docs/design/gameplay-review-22-11.md`, `gameplay-designreview-22-11.md`)

**Fehler / Balance (läuft: Branch `claude/review-fixes-wirtschaft-ki-22-11`)**
- Vorstandsquote greift im Fenster nicht (26–27 von 32 Teams über Freigabe): nur Pflichtkader 8 quotenfrei.
- Vorstand belohnt Kaderabbau (Sportziel an eigener, sinkender Kaderstärke gemessen).
- KI verkauft gute und kauft sehr schwache Spieler; KI baut zu dünne Kader (Tiefe schlägt beste 6 in S1–S2).
- Jedes KI-gesteuerte Team (auch Voll-KI/Halbautomatik-Delegation) kauft ab Saison 2 wie in Saison 1.
- Vertragsende = Verkauf (Chris 22.11.): Begriffe und Regeln vereinheitlichen; Rückkäufe ausgelaufener Spieler.
- Messwerkzeug und App draften verschieden (S1-Draft-Markierung).

**Wertung**
- PP-Skala C2: mehrere Spieler glatt auf 5,0 an 18–21 von 40 Tagen; Tagesanker-Prototyp (`origin/claude/pp-analyse-21-11`)
  — Freigabe Chris offen. Anker für TDM-Gefecht, Breaking (neu), Bahn nachziehen.
- Ergebnisskala E1: Median-Abstand je Disziplin 2–9 statt ~3 (Climbing 40 % 10:0) — Anker nachziehen.
- Hockey rho 0,68 (Ausnahme) — Feldspieler-Validität.

**Mechanik (Entscheidungen Chris offen/teils gefallen)**
- Moral wirkt kaum (±0,67 %) — Frage offen (Vorschlag ±2–3 %).
- Kadertiefe in der Kaderstärke-Anzeige ausweisen? — Frage offen.
- Training/Entwicklung (Chris 22.11.): wenige stark besser, wenige stark schlechter, die Masse kaum; Potential je
  Attribut driftet je Saison leicht; Ligamittel neutral; gesundes Verhältnis Trainingspunkte (SP) ↔ Leistung (PP).
- Mehrspieler: dritter Sitz im Online-Raum (Ramona).

**UI aus der Design-Review**
- Erledigt in #1684: Lexikon/Sprache, Ziele „auf Kurs / gefährdet“, Titelrennen nach Duellpunkten je Liga.
- Mockups `spieltag-entscheidungen-rennen-22-11`: „Deine Entscheidungen“ (+ Gegnerspalte), Rennen (neu denken, nicht
  generisch), Halbzeitbericht zur Winterpause, Manager-Leiste + Derby. Entschieden: drittes Rennen Liga 2 = Vorstandsziel;
  Gegenprobe = Differenz der Vorhersagen; Mitspieler sehen Status + Ergebnisse und nach dem Spieltag die gespielten
  Entscheidungen, keinen Kartenhaushalt/Lager vorab.

## Welle 7 — Rahmenkonzept „Zwischen den Spieltagen“ (`docs/design/zwischen-den-spieltagen-22-11.md`, Runde 2 läuft)

Vier Schleifen (Spieltag, Woche, Saison, Ära), fünf Säulen (Kader, Spieltag, Verein, Welt, Rivalen). Chris 22.11.:
- **Welt** ist der größte Punkt: Saisons sollen nicht gleich ablaufen, die Welt entwickelt sich weiter.
- **Ligaweite Ereignisse** (treffen alle gleich, z. B. Sponsor-Auszahlungen, Zuschauer) mit **drei Antworten** je Team —
  „richtig gut“, viele Ereignisse und Antworten, gebalanced.
- **Befristete Ligaregeln per Abstimmung** (Punkteverteilung, Blockaden …) — nur befristet (wenige Spieltage bis max.
  eine Saison), als Regel-Stempel, nie dauerhaft im Code.
- **Ausrüstung:** erhöht Attribute um X, on top (nicht matrix-gedeckelt, Ausreißer gewollt); disziplin-, farb- oder
  allgemein; Forecast je kommender Disziplin; Figur in der Mitte, Slots drumherum; Haltbarkeit vielfältig (Einweg,
  N Spieltage, Verschleiß, gebraucht, Reparatur); Kisten mit Öffnen-Animation; KI muss alles nutzen; Server 4 GB.
- **Winterpause** als Status (Halbzeitbericht), ggf. Transferfenster/Item-Shop/fahrende Händler.
- **Entscheidungen im Spieltag** (Zurufe/Haltungen disziplinübergreifend, Mehrspieler ohne Anhalten).
- **Verein** ausführlicher (Identität, Fans/Stadion, Gebäude mit Zweck, Personal, Nachwuchs, Vorstand mit Persönlichkeit).
- **Ära** später, aber sehr wichtig. Kein Pokal/keine WM vorerst.
- **Rangtreue (Chris 22.11.): Schranke 0,75 gilt nur gegen die reine Eignung**; alles on top (Form, Moral, Karten,
  Ausrüstung, Zurufe) zählt nicht dagegen — Schwächere dürfen dadurch besser sein.

## Welle 8 — Ausrüstung, Kabine, Postfach (Stand 22.11. abends)

Konzept + Mockups: PR #1687 (`docs/design/zwischen-den-spieltagen-22-11.md`, §1–70). Bauplan Ausrüstung:
`docs/design/ausruestung-pilot-bauplan-22-11.md` (Phasen 0–5, PM-Entscheidungen Abschnitt C). Chris' Entscheidungen 22.11.:
Lager 16 Plätze inkl. Materialien, ein Teil je Familie und Spieler, Legendäre I–III nur über Material, Reparatur-Benchmark
≈ 2 C je Saison voll ausgerüstet, Icons im Sparweg (61 Gen.), Affix-Quoten 60/20/15, Gold-Truhe für Ruhm alle 5 Spieltage,
Winterpause ohne Transferfenster, Liga-Mittel der Entwicklung −1…+1, Identität driftet ≤ 15–20 % je Saison, Personal später,
Zuruf in der Arena (neu rechnen ab Zuruf, erst Laufzeit messen, je Manager abschaltbar), Trait-Ereignisse ±2 %,
Transfergerüchte wirken auf Gehaltsforderungen und kommen ins Postfach.

- [ ] Phase 0 + 1a Ausrüstung (nach Merge von #1687)
- [ ] Kabine/Moral-Baustein (Moral ±2,5 %, Hierarchie, Kabinen-Ereignisse)
- [ ] Postfach: Transfergerücht, Schnäppchen, Auflösungswunsch (Antwort-Karten)
- [ ] Kadertiefe: Balken B überall, A im Teamprofil, C eigenes Team (Ligatabelle ohne)
- [ ] PP-Tagesanker scharf ab nächster Saison (läuft)
- [ ] Entwicklung Liga-Mittel −1…+1 (läuft)
- [ ] Vorstand/KI-Kauf Runde 2 inkl. Quote-Vorausschau und Kernschutz bei gutem Angebot (läuft)
- [ ] Budget-Gespräch mit dem Vorstand und zwei Töpfe ab Saison 1: Konzept und Mockup liegen vor (`docs/design/budget-gespraech-s1-22-11.md`), Bau nach Chris’ „bau das“.

# Arbeitsplan 16.11. — was noch zu tun ist, in welcher Reihenfolge, nach welchen Regeln

**Rolle:** Opus als PM/Architekt. Auftrag von Chris: „Lass Opus bestimmen, was noch erledigt werden
muss, und mach das dann sauber." Nur Analyse, kein Code.

**Stand der Prüfung:** `origin/main` = `81fedad1` (#1508). Die Spiegel sind frisch: `live-save`
16.11. 13:30 UTC, `bug-reports` 16.11. 13:22 UTC. Die neueste In-Game-Meldung auf `bug-reports`
ist vom 25.08. (`bug-2026-08-25T13-50-21-597Z-rtyqa9.json`), es gibt also keine neuen Tickets
aus dem Spiel. Offene PRs (REST-Abfrage 16.11.): #1509 (Draft), #1479 (Draft), #1463, #1462,
#1441 (Draft), #1439 (Draft), #1358 (Draft). Zu „Performance-Paket 1" gibt es **noch keinen
offenen PR**.

**Belegregel:** Hinter jeder Aussage steht Datei:Zeile, eine PR-Nummer oder ein Messwert. Zeilen
in `battle-mode.engine.js` beziehen sich auf `origin/main` `81fedad1`. Zahlen, die nur aus den
heutigen Reviews stammen und nicht im Repo stehen, sind als „Review 16.11. (nicht im Repo)"
markiert. Wo nichts belegbar ist, steht „unklar".

---

## 1. Alle offenen Punkte

Legende: **Nutzen**: S = Spielgefühl, St = Stabilität/Performance, R = Risikoabbau.
**Wertungsrisiko**: „0" heißt Fingerabdruck-identisch nachweisbar, „Messung" heißt rho/Pp/Fingerabdruck
nötig. **Freigabe**: C = Chris, PL = PixelLab-Freigabe, M = Pflichtmessung.

### 1a. Performance

| # | Punkt | Quelle / Beleg | Nutzen | Aufwand | Wertungsrisiko | Abhängig von | Freigabe |
|---|---|---|---|---|---|---|---|
| P1 | Alte Motor-Instanzen laufen nach einem Remount weiter (fps 60 → 17 nach 5 Remounts) | Review 16.11. (nicht im Repo). Paket 1 in Arbeit, kein PR offen | St (hoch) | M | 0 (reiner Lebenszyklus) | — | — |
| P2 | `ctx.filter="grayscale(1)"` je Bild im Breaking-Foltertisch (14 fps) | `engine.js:36752` (`if(i<stufe)ctx.filter="grayscale(1)"`), Messwert aus Review 16.11. Älterer Befund: `docs/design/breaking-performance-einbruch-befund-01-10.md` | St | S (Graustufen-Fassung einmal vorrendern und cachen) | 0 | — | — |
| P3 | Keine Interpolation bei Hockey, Battlefield, Mini-DM und TDM (12–36 Updates/s) | Review 16.11. Vorlage: #1503 (Spurt, Variationskoeffizient 3,48 → 0,50, Fingerabdruck unverändert) | S (hoch) | M je Chassis | 0, wenn nur in `draw()` gemischt wird wie bei #1503 | P1 (erst messen, wenn Leichen-Instanzen weg sind) | — |
| P4 | `battle-mode.engine.js` ist 19.705.295 Byte groß, davon laut Review ~15 MB base64-Sprites; Erstladung 18 s bei 10 Mbit/s | `git ls-tree -l` auf main. 15 MB/18 s: Review 16.11. | St | L (Sprites als Dateien auslagern, Ladepfad im Headless-Runner mitziehen) | 0, aber hohes Bruchrisiko für Headless-Messwerkzeuge | P5 | — |
| P5 | `/sprites/*` und `/mockups/*` werden ohne Cache-Header ausgeliefert | `next.config.ts:16-24` setzt Cache-Control nur für `portraits\|team-logos`. `deploy/hetzner/Caddyfile` setzt keine Header | St | S | 0 | — | — |

### 1b. Wertungsschutz und CI

| # | Punkt | Quelle / Beleg | Nutzen | Aufwand | Wertungsrisiko | Abhängig von | Freigabe |
|---|---|---|---|---|---|---|---|
| W1 | Die CI-Rangtreue-Schranke misst bei Spurt nur „klassisch", Hatz und HYROX sind ungeschützt | `BAHN_FLAGS={spurtFormat:"klassisch",…}` `engine.js:46646`. Das Gate wählt ohne echten Kader immer klassisch (`spurt-format-die-hatz-08-11.md:275-278`). `pruefe-rangtreue-schranke.mjs` setzt kein Format | R (hoch) | M | Messung | — | M |
| W2 | Hatz allein: Pp **25,1** auf Saatstrom 2, also über der Pflichtschranke. Die Spielmischung besteht (rho 0,873, Pp 18,7/19,1) | `spurt-format-die-hatz-08-11.md:286-292`, #1502 | R | S–M | Messung | W1 | M, C (Frage 6) |
| W3 | Übergang: Ein Spurt, der vor #1502 gebucht wurde, kann in der Arena jetzt in einem anderen Format laufen als gebucht (verletzt gezeigt = gebucht) | `spurt-format-die-hatz-08-11.md:294-296` | R | S–M | 0 für neue Spiele | — | C (Frage 6) |
| W4 | Task #136: Football und Hockey in `disziplin-abnahme.json` | Auf main bereits nachgezogen: football 0,854 / Pp 15,3·16,0; hockey 0,700 / 13,9·21,8, beide `datum 2026-11-15` | — | — | — | — | **wahrscheinlich erledigt**: prüfen und Task schließen |
| W5 | Task #119: `bahn-pod-vier-teams.test.ts` und `battlefield-pod-ffa.test.ts` rot im Sandkasten (Chromium-Pfad 1194) | Beide Tests liegen in `tests/`. Fester Pfad 1194: `tests/arena-chromium-revision-goldentest.test.ts:5`. Ob sie in der CI grün sind: **unklar** | R | S | 0 | — | — |
| W6 | Showcase (0,781) und I-Spy (0,776) liegen unter 0,80 und sind nur per rho-Ausnahme gewertet; Climbing 0,801 ist der knappste bestandene Wert | `disziplin-abnahme.json`; `arena-resolved-disciplines.ts:404-430` (`ARENA_ABNAHME_AUSNAHMEN`), #1484 | R | — (Beobachtung) | — | — | — |

### 1c. Zeitfahren

| # | Punkt | Quelle / Beleg | Nutzen | Aufwand | Wertungsrisiko | Abhängig | Freigabe |
|---|---|---|---|---|---|---|---|
| Z1 | Kartenthema: Die Seitenansicht zeichnet immer Wiese und Gras, auch bei Wüste oder Küste | `zfSeitenBild()` `engine.js:45337ff.`, Farben fest codiert (`#79b25a`, `#4f8a3c`, `#3f7a35`, Zeilen ~45367-45390) | S | S–M (Palette je Karte aus `discipline-scenes.ts`) | 0 (läuft nur mit sichtbarer Kulisse) | — | — |
| Z2 | Etiketten im Zielraum überlagern sich. Am Start dasselbe Problem: „Textsalat" | Review 16.11.; `zeitfahren-kulissen-rework-10-11.md:94-96` | S | S | 0 | — | — |
| Z3 | `zfSeite()` hängt an `kulisseSichtbar()`. Lädt das Bild nicht, fällt die Ansicht still auf die alte Draufsicht zurück | `engine.js:45101-45102` | St | S (Rückfall sichtbar machen oder entkoppeln) | 0 | — | — |
| Z4 | „Puste-Pause echt": Eine sichtbare Pause wäre Mechanik, eine eigene Animation dafür neu | #1505 zeigt nur einen Puste-Trend. Für eine Pause-Pose gilt die Sperre `CLAUDE.md:201ff.` | S | M (Mechanik) / L (Pose) | Messung | — | M; PL für eine Pose |
| Z5 | Gleiches Höhenprofil auf jeder Karte | `zeitfahren-kulissen-rework-10-11.md:99-101` | S | M | Messung | — | M |

### 1d. Kulissen und Spielplan

| # | Punkt | Quelle | Nutzen | Aufwand | Risiko | Abh. | Freigabe |
|---|---|---|---|---|---|---|---|
| K1 | Im Spielplan zeigen alle Disziplinen außer Tennis nur eine **Vorhersage** der Hash-Wahl, nicht die gebuchte Kulisse | #1507 (Commit-Text: „Tennis = gebuchte Variante, übrige = Vorhersage") | R (gezeigt = gebucht) | M (Kulisse in die Buchung schreiben) | 0 | #1509 | — |
| K2 | Tooltip ergänzen (Vorhersage als solche kennzeichnen) | Review 16.11. | S | S | 0 | — | — |
| K3 | `tests/arena-kulisse-bit-identisch.test.ts` koppelt nicht an die echten Host-Eingaben | Review 16.11.; Test aus #1507 | R | S | 0 | — | — |
| K4 | PR #1509: Variantenwahl für 17 Disziplinen | offen, Draft | S | (läuft) | 0, Fingerabdruck zeigen | — | — |

### 1e. UI

| # | Punkt | Quelle | Nutzen | Aufwand | Risiko | Freigabe |
|---|---|---|---|---|---|---|
| U1 | Spezifität von Inbox-Hover und Auswahlring | Review #1508 (nicht im Repo). Gleiche Fehlerklasse wie der `.nl-card`-Fix in #1508 | S | S | 0 | — |
| U2 | Farblegende: dauerhaft sichtbar oder einklappbar? | #1508 `PortraitFrameLegend.tsx` | S | S | 0 | C (klein, Empfehlung: einklappbar, Zustand merken) |
| U3 | Training-Spalte angeschnitten | Review 16.11. | S | S | 0 | — |
| U4 | Mobile: Seitenleiste kollabiert nicht, ~900 px Scrollweg | `fable-uiux-brainstorm-14-11.md:315-343`, Vorschläge 15/16 | S | M (einklappbar) / L (Drawer) | 0 | **C** (Frage 1) |
| U5 | Deep-Links: Die Navigation ist reiner Client-State | ebd. Vorschlag 19 | St | L | 0 | — |
| U6 | Einsatzliste-Revamp | #1358, Draft seit 08.11. | S | L | 0 | C (weiterführen oder schließen) |
| U7 | Ton-Kleinkram: Hockey-Check, Breaking-Fackel, TDM-Herzschlag | Review 16.11. | S | S je Ton | 0 | — |
| U8 | Task #94: weniger Dauertext über den Spielern | Task-Liste. Bahn-Pod: #1498 erledigt. Zeitfahren-Start: Z2 | S | M (alle Chassis) | 0 | — |

### 1f. I-Spy

| # | Punkt | Quelle | Nutzen | Aufwand | Risiko | Freigabe |
|---|---|---|---|---|---|---|
| I1 | Eine große Arena ohne Trennsteg, sichtbare Wege statt Teleport, Fortschrittsbalken beim Verweilen. Mechanisch bleiben es zwei Truhenkopien | `i-spy-offener-raum-konzept-14-10.md:172-185` („28e, Klasse A, sicher baubar") | S (hoch) | M | 0 bei reiner Anzeige | C (Frage 2: Teilerfüllung offen benennen) |
| I2 | Echte Exklusivität, Schubsen und Tackeln über Teamgrenzen | Der geteilte Pool maß **rho 0,53** (`i-spy-offener-raum-konzept-14-10.md:67,129`). Dazu P1 0,659–0,689 und I-2k 0,717–0,738 (Zeile 130-131). Heutiger Stand 0,776, nur per Ausnahme | S | L | **sehr hoch** | C + M |

### 1g. Neue Großthemen

| # | Punkt | Quelle | Nutzen | Aufwand | Risiko | Freigabe |
|---|---|---|---|---|---|---|
| N1 | Polish-Durchgang über alle 20 Disziplinen | Chris 16.11. | S | L (Summe), S–M je Disziplin | überwiegend 0 | — |
| N2 | Kontakt-Interaktionen (schubsen, wegdrängeln, hängenbleiben) in allen Disziplinen mit Gegnern auf dem Feld | Chris 16.11.; Fable-Recherche `fable-kontakt-interaktionen-16-11.md` (entsteht parallel, **hier nicht gelesen**) | S (hoch) | L | **Messung je Disziplin** | C, M, ggf. PL |
| N3 | Strategie-Vorlagen je Disziplin (offensiv / neutral / defensiv, im Stil des Football Manager) | Chris 16.11. (Zusatzpunkt) | S (hoch) | L | Messung je Variante | C, M |
| N4 | Mini-DM: Rausschubsen als dritter Ausgang | `arenen-mechaniken-konzept-konsolidiert-15-11.md:225-249` (Baustein 3) | S | L | Messung | **C vor dem Bau** |
| N5 | Ekelroulette (Wettessen), Grube/Knockout produktionsreif | ebd. 5.2, 5.4 | S | M / L | Messung | M |
| N6 | Tasks #61/#62/#63: 10 neue PixelLab-Charaktere | Task-Liste | S | L (Kosten) | 0 | **PL/C** |
| N7 | Task #105: GuV-Kalibrierung | Task-Liste. Kein Dokument im Repo gefunden: **unklar** | — | unklar | 0 für die Wertung | — |

### 1h. PR-Hygiene

| PR | Befund | Empfehlung |
|---|---|---|
| #1462, #1463, #1479 | Football-Rezeptläufe vom 14./15.11., durch #1490 (Football 0,854 / 15,3·16,0, produktiv) überholt | Mit Verweis auf #1490 schließen. Branches nicht löschen |
| #1439 | Arena-Review-Anzeigefixes, `dirty` (konsolidiert-15-11.md:324-327) | Rebasen und mit Fingerabdruck mergen, oder in Welle 2 aufgehen lassen |
| #1441 | Fable-Brainstorm, reine Doku | Mergen, sobald die CI grün ist |
| #1358 | Einsatzliste-Revamp, Draft seit 08.11. | Chris entscheiden lassen (U6). Basis für den Vorlagen-Ort (N3) |
| #1354 | Tennis-Oberflächen-Pilot, `dirty` (konsolidiert-15-11.md:305-314) | Nicht rebasen, nach dem Bühnen-Rollout schlank neu aufsetzen |

---

## 2. Reihenfolge in vier Wellen

### Welle 1: diese Woche, sicher und wirksam (alles Fingerabdruck-identisch außer W1/W2)

Die Reihenfolge innerhalb der Welle folgt der Wirkung pro Risiko.

1. **P1 Remount-Leck abschließen** (läuft). Abnahme: 5 Remounts, danach fps ≥ 55. Fingerabdruck
   unverändert.
2. **P5 Cache-Header** für `/sprites/:path*` und `/mockups/:path*` in `next.config.ts`. Für
   versionierte Dateien `immutable`, sonst wie die Portraits (`max-age=3600, swr`). Eine Zeile,
   sofort spürbar bei jedem zweiten Laden.
3. **P2 Breaking-Filter:** die ausgegraute Gerätefassung einmal in ein Offscreen-Canvas rendern.
   Abnahme: Breaking ≥ 50 fps, Fingerabdruck unverändert.
4. **W1 + W2 Spurt-Formate absichern:** die Schranke misst Hatz und HYROX ausdrücklich mit
   (eigene Basislinien-Einträge `spurt:hatz` und `spurt:hyrox`). Danach Hatz auf ≤ 25 Pp in
   beiden Saatströmen bringen. Rezeptänderung nur mit voller Pflichtmessung: rho > 0,80 je Format,
   Pp zwei Ströme, Mischung neu.
5. **W3 Übergang:** gebuchte Spurt-Spiele vor #1502 auf „klassisch" festnageln (Format im
   Buchungsdatensatz oder Stichtag), damit gezeigt = gebucht gilt. Erst nach Chris' Antwort auf
   Frage 6.
6. **Zeitfahren Z1–Z3** in einem PR: Palette je Karte, Etiketten-Entzerrung (Start und Ziel),
   sichtbarer Rückfall. Fingerabdruck plus Screenshots von drei Karten (Alpen, Küste, Wüste).
7. **Kulissen K2/K3:** Tooltip „voraussichtlich" und Test an die Host-Eingaben koppeln. K1 erst
   mit #1509.
8. **#1509 fertigstellen und mergen** (läuft).
9. **UI U1/U3** als ein kleiner PR. U7-Töne als ein zweiter kleiner PR.
10. **Hygiene:** #1462/#1463/#1479 schließen, #1441 mergen, Task #136 prüfen und schließen
    (W4), Task #119 klären (W5).

### Welle 2: Polish-Durchgang über alle 20 Disziplinen

**Voraussetzung:** P1 ist gemergt, sonst misst jede fps-Zahl die Leichen mit. P3 (Interpolation)
ist der erste Baustein dieser Welle, weil er vier Disziplinen auf einmal hebt.

**Allgemeine Checkliste, gilt für jede Disziplin.** Jeder Punkt wird mit Screenshot oder
Messwert abgehakt:

- [ ] **Bewegung:** Gezeichnete Positionen ändern sich flüssig, ≥ 30 sichtbare Schritte/s oder
  Interpolation nach dem Muster #1503. Kein Teleport.
- [ ] **Performance:** ≥ 50 fps im Dev-Profil auf dem Referenzrechner. Kein `ctx.filter`, kein
  `shadowBlur` und kein `getImageData` je Bild.
- [ ] **Überlagerung:** Namensschilder und Etiketten überlappen sich nicht (Muster #1498).
  Dauertext über Spielern nur bei Ereignissen (Task #94).
- [ ] **Lesbarkeit/HUD:** Das HUD zeigt den gebuchten Stand (Muster #1497). Zahlen
  nachvollziehbar, keine „0"-Platzhalter nach Ereignissen.
- [ ] **Assets:** Die Kulisse passt zum Kartenthema, keine Strichmännchen und keine Rückfall-
  Grafik (Muster #1493–#1496). Nur bereits gewählte Requisiten oder neue Requisiten (frei
  bestellbar), keine neuen Figuren oder Animationen.
- [ ] **Töne:** Jedes Schlüsselereignis hat einen Ton, keine Dauerschleifen-Nerverei.
- [ ] **Gezeigt = gebucht:** Kulisse, Format und Ergebnis stimmen mit der Buchung überein.
- [ ] **Wertung:** `pruefe-wertung-fingerabdruck.mjs` vorher gleich nachher.

**Disziplinspezifisch (belegte Befunde zuerst):**

| Chassis | Disziplin | Konkreter Polish-Punkt |
|---|---|---|
| Feldspiel | Hockey | Interpolation (P3), Ton des Checks (U7) |
| Feldspiel | Football | Neuer Motor #1490: Linien-Duelle und Tackling sichtbar lesbar? **unklar**, ansehen |
| Feldspiel | Basketball | Taktik-Fundament besteht (`engine.js:9324ff.`, `taktikManuell` von keiner Mechanik gelesen, `engine.js:10865`). Im Polish nur die Anzeige |
| Bühne | Breaking | P2-Filter, Fackel-Ton (U7) |
| Bühne | Eiskunstlauf | HUD #1497 erledigt. Vier Aktive gleichzeitig **anzeigen** (`rempler-persoenlichkeit-machbarkeit-08-11.md` Abschnitt 4, „billig, rangtreue-neutral") |
| Bühne | I-Spy | I1 (eine Arena, Wege, Verweilbalken), nach Chris' Frage 2 |
| Bühne | Tennis, Fechten | Kulissen-Rework erledigt (#1493, #1495). Nur Checkliste |
| Bühne | Gewichtheben, Speed-Schach, Wettessen, Showcase | Nur Checkliste. Showcase: keine Mechanik anfassen (rho 0,781, Ausnahme) |
| Bahn | Zeitfahren | Z1–Z3 aus Welle 1, sonst Checkliste |
| Bahn | Spurt | Ruckeln erledigt (#1503). Hatz und HYROX visuell durchsehen |
| Bahn | Staffel, Takeshi | Label-Fix #1498 erledigt. Takeshi: `takeshi-performance-diagnose-13-10.md` gegenprüfen |
| Bahn | Climbing | Nur Checkliste. **Keine Mechanik anfassen** (0,801) |
| Kampf | TDM, Mini-DM, Battlefield | Interpolation (P3), TDM-Herzschlag (U7). #1439-Fixes übernehmen |

**Zuschnitt:** ein PR je Chassis-Fehlerklasse (z. B. „Interpolation Arena", „Etiketten Bahn"),
nicht ein Mammut-PR. Ein PR, der eine einzelne Disziplin umbaut, nur bei disziplinspezifischen
Punkten.

### Welle 3: Kontakt-Interaktionen, vom Konzept zum Prototyp je Chassis

**Grundregeln, alle schon im Projekt belegt:**

- **Kontakt kostet, er nimmt nicht.** Zeit, Balance, Position, nie Punkte, Höhe oder Treffer
  (`climbing-kontakt-konzept-14-10.md:104`, `battlefield-domination-konzept-14-10.md:299`).
- **Die Persönlichkeit wählt die Gelegenheit, die Eignung entscheidet den Ausgang.** Das ist das
  bewährte Bahn-Muster (`willTackeln` `engine.js:51968`). Der Ausgang hängt an WUCHT, ROBUST und
  TECHNIK aus dem Rezept (`rempler-…-08-11.md` 2.1, 3.2).
- **Neue `rr()`-Würfe nur hinter Flags.** Disziplinen ohne Kontakt bleiben bit-identisch.
- **Preis bekannt:** Takeshis `tackleNerven` kostete Saison-rho 0,937 → 0,902 (`engine.js:47666`,
  `i-spy-offener-raum-konzept-14-10.md:162`). Gelegenheits-Kontakt in der Arena (Zusammenhalt/
  Bindung) brachte Battlefield +27,1/+36,8 Pp und wurde abgebrochen (`rempler-…-08-11.md` 3.2).
- **Keine neuen Animationen.** Gearbeitet wird mit vorhandenen Posen (Sturz, Angriffs-Ausfall,
  Stolpern). Fehlende Posen nur als Vorschlag mit Kostenschätzung (`CLAUDE.md:201ff.`).
- **Kein Kontakt mit Wertungswirkung**, wo der Puffer fehlt: I-Spy (0,776), Showcase (0,781),
  Hockey (0,700), Climbing (0,801). Dort höchstens reine Anzeige-Berührung ohne `rr()`.

**Schritt 0 (Konzept, S):** Fables Recherche (`fable-kontakt-interaktionen-16-11.md`) mit diesem
Plan abgleichen und je Chassis eine Kontaktform festlegen. Dazu eine Persönlichkeits-
Ableitungsschicht als reine Funktion aus der Engine lösen (`leitePers` `engine.js:37296`),
bit-identisch (`rempler-…-08-11.md` 0, Punkt 6a).

**Prototyp je Chassis**, je in einem isolierten Worktree mit vorher festgelegtem Abbruchkriterium:

| Chassis | Ausgangslage im Code | Prototyp | Puffer (rho / Pp) | Pflicht-Abnahme |
|---|---|---|---|---|
| **Bahn** | Spurt und Takeshi `tackle:true` (`engine.js:46698`, `47676`). Climbing hat Kreuzungsgriffe (`engine.js:47224ff.`). Staffel und Zeitfahren `tackle:false` | „Hängenbleiben/Wegdrängeln" als Positionskosten in Spurt (Formate einzeln). Staffel nur nach Klärung der WUCHT-Doppelbelegung (`rempler-…` 2.1). Zeitfahren nie (Einzelstart) | Spurt 0,876 / 12,9·6,5; Staffel 0,924 / 21,6·21,4 (Pp knapp) | rho > 0,80 **je Format**, Pp ≤ 25 zwei Ströme, Fingerabdruck übrige 19 |
| **Feldspiel** | Hockey-Check nur am Puckführer (`versucheSteal` `engine.js:15402`). Football mit Tackling #1490. Basketball ohne Kontaktzweig | Basketball „Ausboxen/Screen-Kontakt" als Positions- und Zeitkosten | Basketball 0,822 / 15,6·16,7; Football 0,854 / 15,3·16,0 | wie oben plus Star auf Rang 1 und Paartreue |
| **Bühne** | Würfe vorab in `bauBuehne()` (`engine.js:20539`). Die Bewegung darf vertraglich nie `rr()` rufen | Eiskunstlauf: erst vier Aktive **anzeigen**, dann ein Rempler, der **vorab** in `bauBuehne()` gewürfelt wird | Eiskunstlauf 0,927 / 10,6·12,0 (bester Puffer der Bühne) | wie oben. Der Bewegungsvertrag bleibt |
| **Kampf** | Kontakt ist hier schon Angriff (`rempler-…` 2.3) | Rückstoß/Wegdrängen ohne Schaden in TDM. Mini-DM-Rausschubsen (N4) erst nach Chris' Freigabe | TDM 0,839 / 14,6·14,7; Mini-DM-FFA nicht bestanden (Ausnahme) | wie oben, Mini-DM zusätzlich mit Chris |

Gebaut wird nur, was im Prototyp alle Kriterien hält. Rollout danach je Disziplin als eigener PR.

### Welle 4: Strategie-Vorlagen je Disziplin (langfristig, nach Welle 3)

**Chris' Vorgaben (16.11.):** auswählbare Vorlagen offensiv / neutral / defensiv, disziplintypisch.
Bei der Auswahl steht wie bei einem FM-Zuruf, wie sie auf die Spieler wirkt („aggressiver",
„mehr Schubsen"). Die Vorlage wirkt **nur auf das Verhalten, nie auf die Stats**. Man soll sehen,
ob offensiver gespielt und mehr geschubst wird. Gewählt wird vorher in der Einsatzliste oder live
mit Blick aufs aktive Team.

**Was heute schon im Code steckt (geprüft):**

| Baustein | Fundstelle | Heute für den Manager wählbar? | Taugt als Vorlagen-Hebel? |
|---|---|---|---|
| Intensität Schonen/Normal/Push | `lib/lineups/legacy-lineup-modifiers.ts:899-916` (Score-Spanne je Stufe, Push +2…+6) | Ja, in der Einsatzliste | **Nein:** Das ist ein Score-Zuschlag, also genau die Art „Stat"-Wirkung, die Vorlagen nicht haben sollen. Klar davon abgrenzen |
| Rennpläne der Bahn | `plaene` in allen fünf Bahn-Disziplinen (`engine.js:46813, 47088, 47438, 47605, 47974`), fest je Slot (`planJeSlot` `engine.js:46821, 47102`) | **Nein:** kein Treffer für `planJeSlot` in `lib/` oder `app/` | **Ja:** Tempo und Windschatten-Suche sind reines Verhalten, Texte für den Tooltip stehen schon da |
| TDM-Befehle je Reihe + Haltung/Zusammenhalt/Bindung | `ORDERS` `engine.js:7811`, `PERSORD` 7829, `HALTUNG/ZUSAMMEN/BINDUNG` 7848ff. Tooltip-Versprechen „was dort steht, tut die Simulation" (7809) | Nur in der Battle Arena (Testwerkzeug, Auswahl-Element bei `engine.js:38103` im Worktree-Stand) | Ja, aber Vorsicht: Zusammenhalt und Bindung waren die gemessene Fehlordnungsquelle (ε² TDM 0,229, `rempler-…` 3.2) |
| Feldspiel-Taktik-Karte (Basketball, 4 Schalter) | `FELDSPIEL_ART.<d>.taktik`, `setzeTaktik` `engine.js:10908ff.`; Fundament ohne Mechanik-Bindung (`stand-aller-disziplinen.md` §10) | Nein | Ja, das ist das Vorlagen-Gerüst fürs Feldspiel. Die Mechanik-Bindung fehlt noch |
| Bühnen-Haltung (Speed-Schach rechnen/normal/blitzen, Wettessen sprint/gleichmäßig/schlussspurt) | `arena-aufstellung-adapter.ts:45-51` (Feld `haltung`). `BUEHNE_FLAGS speedSchachUhr:2, wettessenMauer:2` (`engine.js:19908`): Mechanik scharf | **Nein:** „Diese Datei füllt es noch nicht" (Adapter:50). Es entscheidet die KI-Vorgabe | **Ja, sofort:** Rohr und Mechanik stehen, und beide Disziplinen sind mit KI-Haltung abgenommen |
| Taktisches Slot-System | Slots je Disziplin (`SLOT_ZUSATZ` `engine.js:~8325`), Einsatzliste-Schritt „Taktik" (`LegacyLineupLabClient.tsx:2917-2921`) | Ja (Slots und Taktik-Label) | Indirekt: Ort für die UI, keine Verhaltensvorlage |
| Mutatoren/Formkarten | `zieheFormkarten` `engine.js:8733`; Forced Mutators `legacy-lineup-modifiers.ts:1221ff.` | Formkarten ja | **Nein:** Sie wirken auf Werte, nicht aufs Verhalten |
| Persönlichkeit → Tackel-Neigung | `willTackeln` `engine.js:51968` | Nein (abgeleitet) | Ja, sie ist der natürliche Regler für „mehr Schubsen", setzt aber Welle 3 voraus |

**Wertungsrisiko:** Jede Vorlage ist für die Abnahme eine eigene Variante. **Jede Variante muss
einzeln** rho > 0,80 und Pp ≤ 25 in zwei Saatströmen halten, nicht nur die Mischung (Lehre aus W2:
Hatz 25,1). Vorlagen verschieben nur Verhaltensparameter, keine Attributgewichte, Rezepte oder
die Matrix (`CLAUDE.md:110ff.`). Eine Vorlage, die über die Persönlichkeit wirkt, braucht die
Gegenprobe „Persönlichkeit neutral" (`rempler-…` 3.4). Zusätzlich gilt: Eine KI-Vorgabe muss es
weiterhin geben (Vorlage „Automatisch"), damit unveränderte Spielstände bit-identisch bleiben.

**UI-Orte:**

1. **Einsatzliste:** ein Vorlagen-Wähler je Disziplin im Schritt „Taktik", mit Tooltip-Satz im
   FM-Stil („Deine Läufer suchen öfter den Windschatten und drängeln mehr").
2. **Live in der Arena:** zuerst nur **anzeigen**, welche Vorlage läuft und wie oft geschubst
   wurde. Eine Live-Umstellung, die das Ergebnis ändert, beißt sich mit „gezeigt = gebucht",
   solange Spieltage vorab gebucht werden (Frage 7).

**Aufwand:** L in Summe. Grundgerüst M: Datenfeld in der Aufstellung (das Rohr `haltung` gibt
es), UI-Wähler, Anzeige in der Arena. Danach je Disziplin S–M plus Pflichtmessung je Variante.

**Pilot-Empfehlung:**

- **Pilot A, Wettessen.** Es ist die einzige Disziplin, bei der heute **nichts Neues an der
  Mechanik** nötig ist: Die Haltung ist scharf (`wettessenMauer:2`), das Rohr steht, und der Puffer
  ist der größte im Feld (0,905 / 8,7·10,0). Pilot A beweist die Kette Einsatzliste → Buchung →
  Arena-Anzeige.
- **Pilot B, Spurt-Rennpläne,** sobald Welle 3 den Bahn-Kontakt hat. Erst dort wird „mehr
  Schubsen" sichtbar und eignungsgebunden (die Persönlichkeit wählt nur die Gelegenheit).

---

## 3. „Sauber"-Regeln für die Umsetzung

1. **Jeder PR nennt seine Wertungsklasse:** (a) Fingerabdruck-identisch, mit Lauf von
   `pruefe-wertung-fingerabdruck.mjs` vorher und nachher im PR-Text, oder (b) Mechanik, mit rho je
   Spiel (n ≥ 24, bei Grenzfällen n = 48), Pp in zwei Saatströmen, Star auf Rang 1 und Paartreue,
   und dem nachgezogenen Eintrag in `disziplin-abnahme.json`.
2. **Ohne Messung wird nie geändert:** `battle-mode.rezepte.js`, Rezepte und Sub-Skills, jede
   Stelle mit `rr()`, `BAHN_ART`/`BUEHNE_ART`/`FELDSPIEL_ART`-Parameter mit Wertungswirkung,
   `*_FLAGS`-Standardwerte, `ARENA_RESOLVED_DISCIPLINE_IDS` und `ARENA_ABNAHME_AUSNAHMEN`, die
   Formatwahl. Die Matrix gar nicht (`CLAUDE.md:110ff.`, Ausgleichspflicht).
3. **Jede Variante einzeln abnehmen** (Format, Vorlage, Kulisse mit Wirkung). Die Mischung allein
   genügt nicht.
4. **Gezeigt = gebucht:** Was die Arena zeigt (Kulisse, Format, Vorlage), steht in der Buchung
   oder ist sichtbar als Vorhersage markiert.
5. **Review-Pflicht:** Vor dem Merge prüft ein unabhängiger Opus-Review jeden PR, wie bei
   #1502–#1508. BLOCKER-Funde werden im selben PR behoben. Der Merge erfolgt selbst, sobald CI
   grün ist und `mergeable_state: clean` (`CLAUDE.md`, Abschnitt PRs mergen).
6. **PR-Zuschnitt:** ein Thema je PR. Performance, Anzeige und Mechanik nie gemischt.
   Mechanik-PRs fassen nur eine Disziplin an. Neue CI-Jobs bekommen die Weiche (`needs: weiche`).
7. **Lokal mit `OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 npm run dev`** arbeiten
   (`CLAUDE.md`, Auto-Export).
8. **PixelLab:** Requisiten sind frei. Figuren und Animationen nur mit Chris' Freigabe für genau
   diesen Fall.
9. **Ehrlich verbuchen:** Eine Teilerfüllung (z. B. I-Spy 28e) wird als Teilerfüllung benannt,
   nicht als „erledigt".

---

## 4. Fragen, die nur Chris entscheiden kann

1. **Mobile:** Soll das Handy die volle Management-Oberfläche bekommen (Burger-Menü, L) oder
   reicht eine einklappbare Seitenleiste als Nebenkanal (M)? *Empfehlung: zuerst die einklappbare
   Seitenleiste, den Drawer erst bei echter Handy-Nutzung.*
2. **I-Spy:** Akzeptierst du eine große Arena mit sichtbaren Wegen und Verweilbalken, in der
   mechanisch weiter jede Seite ihre eigenen Truhen hat (keine echte Konkurrenz um dieselbe Truhe)?
   Echte Exklusivität maß rho 0,53. *Empfehlung: ja zur Anzeige. Schubsen in I-Spy nur als
   Anzeige ohne Wertungswirkung.*
3. **Kontakt-Dosis:** Darf Kontakt die rho einer Disziplin spürbar senken (z. B. um bis zu 0,03),
   solange sie über 0,80 bleibt? Und soll Kontakt in Disziplinen unter oder knapp an der Schranke
   (Hockey, Showcase, I-Spy, Climbing) nur sichtbar sein und nicht werten? *Empfehlung: ja und ja.*
4. **Animationen für Kontakt:** Reicht der vorhandene Posen-Bestand (Sturz, Ausfall, Stolpern),
   oder willst du später eine „Schubsen"-Pose für alle Figuren freigeben? *Empfehlung: erst mit dem
   Bestand bauen, danach eine Kostenschätzung vorlegen.* Für die Tasks #61–#63 (10 neue
   Charaktere) ist deine Freigabe ebenfalls nötig.
5. **Mini-DM-Rausschubsen:** bauen, obwohl Mini-DM-FFA heute nur per Ausnahme gewertet wird?
   *Empfehlung: erst nach dem Bahn-Prototyp aus Welle 3.*
6. **Spurt-Formate:** (a) Muss jedes Format einzeln die Pflichtschranke halten (Hatz heute
   25,1 Pp)? *Empfehlung: ja.* (b) Sollen vor #1502 gebuchte Spurt-Spiele auf „klassisch" bleiben?
   *Empfehlung: ja.*
7. **Strategie-Vorlagen:** Nur vorher in der Einsatzliste, oder auch live mit Wirkung? Live mit
   Wirkung heißt, dass das Spiel nicht mehr vorab gebucht ist. *Empfehlung: in der Einsatzliste
   wählen, live nur anzeigen.* Pilot Wettessen, danach Spurt?
8. **Einsatzliste #1358:** weiterführen (sie ist der natürliche Ort für die Vorlagen) oder
   schließen? *Empfehlung: weiterführen, rebasen, in Welle 2/4 einplanen.*

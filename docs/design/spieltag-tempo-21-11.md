# Spieltag-Tempo (21.11.): Abgabe der Einsatzliste, Wertung, Arena-Vorlauf

Anlass (Chris, 19./20.11.): „Entweder muss ich mehrfach klicken, bevor man sieht, dass etwas lädt, oder es wird gar
nichts angezeigt und es dauert 20 Sekunden, bevor man zur Arena gehen kann." Und: die Wertung nach D2 dauert lange.

Alles hier ist Ablauf und Anzeige. Gezeigt = gebucht bleibt: der Wertungs-Fingerabdruck
(`node scripts/pruefe-wertung-fingerabdruck.mjs --node`) ist vor und nach den Änderungen identisch
(`GESAMT eaafed96150e`, 75 Einträge, gemessen auf demselben Stand); das Ergebnis des KI-Aufstellungslaufs ist
Byte-gleich (Hash aller Entwürfe `1749bb13caae694e`, alt wie neu).

## 1. Messung: wo die Zeit hinter „Einsatzliste speichern" bleibt

Messwerkzeug: `scripts/messe-spieltag-tempo.ts` (Einzelschritte), `scripts/messe-ki-batch-profil.ts` (CPU-Profil und
Entwurfs-Hash des KI-Laufs). Messbasis: **Kopie des Live-Abbilds** (`origin/live-save`, Spielstand
`new-game-1795114260527-nzr0z9`, Spieltag 12, 32 Teams, rund 240 MB Datenbank), nicht ein frischer Wegwerf-Save. Der
Unterschied ist erheblich: frisch kostet der KI-Lauf 6 s, im echten, gewachsenen Stand 28–30 s. Die Sandbox-Maschine ist
schneller als der CX23; absolute Zahlen dort liegen höher, die Verhältnisse gelten.

Was `PUT /api/lineups/legacy` (der Klick auf „Abgeben") hintereinander tut, alles synchron im Request:

| Schritt | Frisch (6 s-Save) | Live-Abbild |
|---|---:|---:|
| Eigene Aufstellung schreiben (`saveLocalLegacyLineupDraft`) | 0,7 s | 1,0–2,5 s |
| KI-Batch für fehlende Teams (`applyAiLegacyLineupBatchLocally`, Feld schon voll) | 0,6 s | 2,2–3,8 s |
| Spieltags-Schnappschuss (`ensureMatchdayResolveSnapshot`) | 2,6 s | 3,2–8,1 s |
| Anstoß Arena-Vorlauf (`kickoffArenaVorlauf`, nur synchroner Teil) | 1,5 s | 2,0–3,3 s |
| **Summe Antwortzeit, KI-Aufstellungen waren vorgewärmt** | ~5,3 s | **~9–17 s** |
| **zusätzlich, wenn das Vorwärmen fehlte** (der Batch erzeugt alle KI-Aufstellungen im Request) | +6 s | **+28–30 s** |

Das erklärt Chris' „20 Sekunden" und das „gar nichts angezeigt": der Klick stieß den Request an, die Oberfläche zeigte
nichts, und der Request war bei fehlendem Vorwärmen 30–45 s lang. Dazu kam hinter dem Speichern **ein zweiter,
überflüssiger KI-Batch plus ein voller `loadSave`** (siehe Ursache B).

### Ursachen und Behebung

**A. Der KI-Aufstellungslauf baute dieselbe Karte hundertfach neu (30,6 s → 7,4 s, gleicher Output).**
CPU-Profil: 17 von 29 s `buildPlayerSeasonPerformanceMap`/`buildSeasonPointsLedger` — `buildTeamPlayerTrainingLoadPlans`
baute je Spieler und Team die Leistungskarte der ganzen Liga samt Punkte-Ledger neu (nur um `appearances` zu lesen).
Behoben mit `getCachedPlayerSeasonPerformanceMap` (`lib/foundation/player-season-performance.ts`): Schlüssel sind
Identität und Länge der Ergebnislisten plus Saison, nicht das GameState-Objekt (Teilabläufe bauen je Team eine eigene
Hülle um dieselben Listen). Wer die Listen mit `push` fortschreibt, bekommt eine frische Karte (Test).

**B. Doppelter Batch nach dem Speichern.** `handleHumanLineupSaved` rief nach dem Speichern `ensureAiLineupsForCurrentMatchday`
auf. Der Client-Stand kannte die vom Server soeben erzeugten KI-Aufstellungen noch nicht, also stieß er einen zweiten
`ai-batch-apply` und danach einen vollen `loadSave` an, obwohl die Route das schon erledigt hatte. Entfernt; nachgeladen
wird nur der Saisonstand, und fehlen KI-Teams danach wirklich noch, holt sie der Arena-Eintritt (`arena_open`) wie bisher.

**C. Rating-Karte der ganzen Liga je Team und Spieler** (`selectTeamCaptain` → `buildPlayerRatingContractMap`, 16 s
inklusive im Gesamtlauf aus KI-Lauf, Wertung und Vorlauf). Neu: `getCachedPlayerRatingContractMap`
(`lib/foundation/player-rating-contract.ts`), nur lesend, Schlüssel: Listen-Identitäten und -Längen, Saison, Prüfsumme über OVR
und Kernwerte der Spieler; eingefrorene Bewertung geht ungepuffert durch. Genutzt in `selectTeamCaptain` und im
Kapitänsdienst.

**D. Ganzstand-Schreiben.** (1) `writeSaveSessionCache` machte bei jedem Schreiben ein `JSON.stringify` des ganzen Spielstands
nur für die Verdrängungs-Schätzung (rund 4,5 s je Lauf); jetzt wird eine bekannte Schätzung wiederverwendet und nur alle
25 Schreibvorgänge neu vermessen. (2) `normalizePlayerBaselineRecord` rechnete bei jedem Speichern für alle rund 3000
Baselines eine reine JS-SHA-256 neu (rund 4 s); jetzt gemerkt je Eingabeobjekt und Optionen.

### Vorher / Nachher (Live-Abbild-Kopie, dieselbe Maschine)

| Schritt | Vorher | Nachher |
|---|---:|---:|
| KI-Aufstellungen für alle Teams (Prewarm bzw. Batch im Request) | 27,8–29,7 s | 7,4–10,5 s (Profil-Lauf 10,5 s) |
| Wertung des Spieltags (`runLocalMatchdayAutoRun`) | 19,6–22,3 s | 13,6 s |
| Schnappschuss | 5,4–8,1 s | 3,2 s |

(Messungen schwanken auf der geteilten Maschine um ±20 %; angegeben ist die Spanne.) Der Arena-Vorlauf selbst (Node-Weg
D1+D2, 34–39 s auf dem Live-Abbild) ist Motor-Rechenzeit und wurde nicht angefasst.

## 2. Sofort-Rückmeldung beim Abgeben

Der Knopf im Taktgeber („Weiter: Abgeben") zeigte während des Speicherns nichts. Jetzt: erster Klick sperrt den Knopf
(`disabled`, `aria-busy`), Beschriftung „Speichert …", Taktgeber im Zustand „Aktion läuft". Doppelklick-Schutz doppelt
gesichert: `speichertAbgabeRef` in `handleSaveDraft` greift noch vor dem nächsten Render, der Knopf selbst ist gesperrt.
Dateien: `EinsatzlisteModern.tsx` (Beschriftung/`busy`), `einsatzliste-abgabe-store.ts`, `FoundationTaktgeber.tsx`,
`LegacyLineupLabClient.tsx` (`isSavingLineup`).

## 3. Wertung nach D2

Der Lauf `runLocalMatchdayAutoRun` (Ergebnis- und Standings-Buchung, Kasse, Moral) profitiert von C und D (22 s → 13,6 s auf dem
Live-Abbild). Die Hinweistafel „Spieltag wird gewertet" bleibt (sie ist ehrlich: der Lauf rechnet synchron).
Offen: Moral-Bewertung (`computePlayerMorale` je Spieler) baut die Anforderungen je Spieler neu; weiteres Potenzial,
aber nicht ohne Eingriff in die Moral-Rechnung (Wertungsnähe) — nicht Teil dieser Runde.

## 4. Arena-Reihenfolge und D2 vorladen (Punkte 3 und 4): Befund, nicht umgesetzt

Der Vorlauf (`arena-vorlauf-service.ts`) rechnet D1 und D2 seriell, je Disziplin alle Fixtures beider Ligastufen, und
schreibt Ergebnis, Datensatz und Schnappschuss **einmal am Ende** (`finishArenaVorlauf`). Die Bühne kann das eigene Spiel
deshalb erst zeigen, wenn beide Disziplinen komplett sind. „Eigene Spiele zuerst, KI-gegen-KI danach" und „D1 frei geben,
während D2 noch rechnet" wären nur mit **teilweise veröffentlichtem Vorlauf-Datensatz** (D1-Overrides zuerst, D2 und
KI-Duelle nachgeschoben) wirksam. Das berührt die Signatur-/„erstes terminales Ergebnis gewinnt"-Logik und damit die
Garantie „gezeigt = gebucht"; eine reine Umsortierung der Fixtures brächte ohne Teilveröffentlichung nichts. Vorschlag für
eine eigene Runde mit Opus-Review: (1) `runBattleModeArenaMatchday` liefert die Duelle der menschlich gesteuerten Teams als
erste Charge, (2) der Datensatz bekommt je Disziplin `status: "arena"` sofort nach Abschluss (heute erst gesamt), die Bühne
liest pro Disziplin, (3) KI-gegen-KI läuft als zweite Charge derselben Signatur. Parallel arbeitet ein anderer Agent in
`battle-mode.engine.js`; deshalb wurde der Motor nicht berührt.

## 5. Kein Auto-Sprung D1 → D2, Endergebnis bleibt

Siehe Abschnitt „Ergebnis der Browser-Prüfung" unten bzw. im Bericht.

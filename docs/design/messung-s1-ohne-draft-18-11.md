# Messung: S1-Kaderaufbau ohne Draft und die Kassenhortung der KI (18.11.2026)

Auftrag (Chris, wörtlich): (1) „wenn wir keinen draft machen sondern alle teams ‚normal‘ picken was kommt dann raus kannst du das mal messen? also nur S1 käufe ohne draft modus?“
(2) „aber 63 mio cash oder selbst 43 mio ist crazy viel im verhältnis zu 50-70 mio cash zb — das ist fast 100% davon“.

**Reine Messung, keine Spiellogik geändert.** Alles lief auf Wegwerf-SQLite, `data/online-saves` blieb unberührt. Neues Spiel (Battle, `solo_1`, Liga-Split 2x16),
**32 KI-Teams** (M-M direkt nach der Anlage auf KI, mit Sponsor), **ein Seed** (Save `new-game-1795027900917-s3le8s`), alle Varianten **paarweise ab derselben Anlage**
(SQLite-Kopie derselben Basis). Stand `main` 558d7e81 (Finanzkonzept V2 mit Rücklage nach Finanzwert und Vorstandsbudget ist AN, S1-Rücklage halbiert).
Werkzeuge (alle neu bzw. erweitert, nur `scripts/`):

| Datei | Zweck |
|---|---|
| `scripts/miss-teamfinanzen-saison.ts` | erweitert um `--variante A\|C\|C2` und `--mischen <saat>` (Reihenfolge der Teams vor dem Kaderbau mischen) |
| `scripts/diagnose-s1-kader-und-kasse-18-11.ts` | Kadermetriken (Eignung > 60, Top-20-Spieler) und Befragung des Planers auf dem Endzustand mit/ohne Rücklage/Vorstand |
| `scripts/probe-s2-kaufgrenzen-18-11.ts` | Trockenlauf des S2-Marktplans auf dem Stand nach der Kaufphase: was würde er noch kaufen, welche Sperrgründe |
| `scripts/auswerte-s1-ohne-draft-18-11.mjs` | alle Tabellen unten |

## 0. Kurzfassung

1. **Ohne Draft kommt dasselbe heraus.** Der „normale“ Kaufweg, der denselben Planer wie der Draft benutzt (C2: `runTransferWindowSession`, Phase `preseason`), baut Kader von
   gleicher Stärke (Top-6-Eignung Ø 46,81 gegen 46,84), gleicher Größe (Median 11, 0 Teams unter 8) und gleicher Kasse (7,8 % gegen 8,3 % des Startbudgets). Der Draft ist in S1
   kein Qualitätsfaktor, nur ein anderer Aufrufer desselben Planers. **Der eigentliche „normale“ Kaufweg der KI (Marktplan der Preseason, `applyAiMarketPlanLocally`) kann S1 gar nicht**:
   23 von 32 Teams bleiben leer (`roster_after_market_plan_below_player_min`), im Mittel 2,1 Spieler je Team, 99 % des Geldes bleiben liegen.
2. **In S1 hortet die KI nicht — sie hält exakt die Rücklage.** Kasse nach dem Kaderbau Median **8,3 % des Startbudgets** (P10 4,8 / P90 12,1), nach Finanzwert 3,8 % bis 12,8 %, also
   auf oder knapp über dem halbierten Ziel (2,5 bis 12,5 %). Alle 31 Teams mit Luft zum Kauf stehen **0,4 bis 6 Mio über ihrem Rücklagen-Floor**, die Lücke ist kleiner als der billigste
   Spieler (6,3 Mio). Der Preis dafür: **29 von 32 Teams bleiben unter ihrem Kader-Optimum** (51 fehlende Plätze).
3. **Das, was Chris meint (63/43 Mio), ist die S2-Kaufphase, und dort hat es drei Ursachen:** (a) die Rücklagen-Quote (15 bis 25 % bzw. 5 bis 10 %) wird auf **Kasse + Kaderwert**
   gerechnet, nicht auf die Kasse; zu Beginn der S2-Kaufphase ist der Floor damit **48 % der vorhandenen Kasse** (Median 34,7 von 83,2 Mio), (b) der Kauf läuft über den **einseitigen
   Marktplan** (ein Durchgang, Kauf nur bis zum Optimum, Vorstands- und Reserve-Sperren), nur 21 von 32 Teams werden „abgeschlossen“, Kader 7 → 9 bei Optimum 12, 6 Teams bleiben
   **unter 8**, (c) 42 Gebäudeaktionen laufen vorher. Ein Trockenlauf direkt danach plant noch **36 weitere Käufe bei 25 Teams**.
4. **Beobachtung am Rand: Kein einziger der Top-20-Spieler (Marktwert 81 bis 113 bzw. Spitzen-Eignung ≥ 98) wird in S1 gekauft**, in keiner Variante. Alle 20 liegen im Kandidatenpool,
   der teuerste Spieler in einem Kader hat Marktwert 67,1.

## 1. Welcher Kaufweg ist „normal“? (Produktionspfade, mit Beleg)

| Weg | Wer ruft ihn auf | Planer | Ergebnis auf leeren S1-Kadern |
|---|---|---|---|
| **A — Block-Draft (heute live)** | `kickoffLeagueSetupDraft` → `fuehreLigaSetupDraftAus` → `runAiPicksExecutePreview` (`lib/game/league-setup-draft-service.ts`) | organischer Planer `planOrganicDraftForTeam` je Team nacheinander, im Spielstand-Reihenfolge, aus dem Restpool (`runOrganicTeamDraftExecute`) | 347 Käufe, Kader Median 11 |
| **C — KI-Kauflauf der Preseason (Season-Market-Modus)** | `fuehreKiPreseasonLaufAus` (`lib/ai/ai-preseason-background-service.ts`, Route `/api/ai/preseason-background`, wird beim Saisonwechsel serverseitig angestoßen) → `applyAiMarketPlanLocally` (Quelle `ai_preseason_market_buy`) | **Marktplan** (`buildAiTransfermarktPreview`, Kaufanzahl `resolveAllowedMarketBuyCount` = Lücke bis Optimum), **nicht** der organische Planer | **kann S1 nicht**: 23/32 Teams `blocked` (`roster_after_market_plan_below_player_min`), 8 Teams bauen (Kader 8 bis 10), Kader Ø 2,13, Σ Kasse 6440 von 7915 |
| **C2 — organischer Kauf der Kaufsitzung** | `runTransferWindowSession` (Phase `preseason`, `runOrganicBuyCycle`, Quelle `ai_organic_squad_buy`), so baut es `baueNachkaufSitzung` (`lib/ai/organischer-nachkauf-eingabe.ts`) und die Saisonübergangs-Kette | **derselbe** `planOrganicDraftForTeam`, nur im Zyklus- statt im Draft-Rahmen (bis 5 Zyklen, 3 Ligarunden) | 347 Käufe, Kader Median 11 |

Warum C2 als „normal einkaufen“ gewertet wird: C kann keine leere Liga bauen (Ergebnis oben, Sperrgrund ist in der Marktplan-Logik fest verdrahtet: alles-oder-nichts bis zum Mindestkader),
es gibt **keinen zweiten Kauf-Code**, C2 ist die einzige produktive „Nicht-Draft“-Linie, die S1 überhaupt füllt. S1-Regeln (Vorstand 100 %, Rücklage nach Finanzwert halbiert) stecken
im gemeinsamen Planer und gelten für A und C2 gleich. Die Reihenfolge ist in beiden Wegen fest (A-A zuerst); deshalb zusätzlich je Variante eine **gemischte Reihenfolge** (Saat 7).
Variante B (Ein-Schritt-Draft aus PR #1619) wurde nicht gemessen (laut Auftrag nur wenn trivial; frühere Messung ≈ A).

## 2. Ergebnisse (ein Seed, paarweise; gemischt = Saat 7, nur Kaderbau)

(b) und (c) nur für A und C2 (voller S1 mit 20 Spieltagen + Saisonende-Kette + S2-Kaufphase, je ca. 55 Minuten). Kasse in % des **Startbudgets der Teams** (Ø 247, Median 250).

| Kennzahl | A Block-Draft | C2 normal (organisch) | A gemischt | C2 gemischt |
|---|---|---|---|---|
| Kaderstärke Mittel (Top-6, Ø 20 Disziplinen) | 46,84 | 46,81 | 46,76 | 46,65 |
| Median / P25 / P75 | 46,68 / 42,70 / 50,96 | 46,87 / 42,71 / 51,25 | 46,68 / 42,70 / 51,14 | 46,51 / 42,42 / 50,76 |
| Spreizung beste − schlechteste | 17,27 | 16,51 | 16,67 | 16,36 |
| Kader Median / Teams unter 8 | 11 / 0 | 11 / 0 | 11 / 0 | 11 / 0 |
| Teams unter Optimum / fehlende Plätze | 29 / 51 | 31 / 49 | 28 / 48 | 29 / 47 |
| Käufe gesamt S1 | 347 | 347 | 350 | 349 |
| Gehalt Median (Ist) | 62,9 | 66,2 | 64,2 | 65,1 |
| **(a) Kasse nach Kaderbau, % Startbudget: Median** (P10 / P90) | **8,3** (4,8 / 12,1) | **7,8** (4,8 / 11,9) | 8,2 (4,7 / 12,4) | 7,6 (4,8 / 12,3) |
| (a) absolut Median / Mittel | 17,7 / 20,0 | 17,2 / 19,6 | 16,6 / 19,8 | 17,9 / 19,8 |
| **(b) Ende S1 vor Auszahlung, %: Median** (P10 / P90) | **8,0** (4,7 / 12,1) | **8,3** (3,7 / 12,9) | – | – |
| **(c) nach S2-Kaufphase, %: Median** (P10 / P90) | **15,9** (8,3 / 27,3) | **19,1** (5,5 / 34,3) | – | – |
| (c) absolut Median / Mittel | 41,5 / 40,7 | 49,4 / 47,5 | – | – |
| S2: Kasse vor → nach Kaufphase (Median) | 83,2 → 41,5 | 78,4 → 49,4 | – | – |
| S2: **Anteil der Kasse, der liegen bleibt**, Median (P10 / P90) | **50 %** (26 / 87) | **56 %** (18 / 90) | – | – |
| S2: Kader Median vor → nach (Optimum Median 12) | 7 → 9 | 7,5 → 9 | – | – |
| S2: Teams unter 8 nach der Kaufphase | **6** | **6** | – | – |
| S2: Käufe / abgeschlossene KI-Teams (von 32) | 69 / 21 | 61 / 18 | – | – |
| Disziplinen mit ≥ 1 soliden Spieler (Eignung > 60), Ø je Team (von 20) | 12,9 | 12,6 | 12,8 | 12,7 |
| Disziplinen mit ≥ 3 soliden Spielern, Ø je Team | 1,6 | 1,8 | 1,6 | 1,8 |
| Top-20-Spieler gekauft (nach Marktwert / nach Spitzen-Eignung) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Teuerster Spieler im Kader: Median / Max (Marktwert) | 35,5 / 67,1 | 34,8 / 67,1 | 35,5 / 67,1 | 34,8 / 67,1 |
| Erstzugriff: Rangkorrelation Position ↔ Stärke | 0,02 | 0,01 | 0,01 | 0,02 |
| Erstzugriff: Stärke erste 8 / letzte 8 in der Reihenfolge | 45,80 / 46,75 | 45,85 / 46,76 | 45,83 / 46,60 | 45,64 / 46,62 |

Zu C (Marktplan, nicht tragfähig): Kader Ø 2,13 (23 Teams 0 Spieler, 8 Teams 8 bis 10), Σ Kasse 6440; die 8 Teams, die bauen, behalten **38,7 bis 119,2 Mio** (≈ 15 bis 37 % ihres Budgets).

Lesehilfe: A und C2 sind im Rahmen des Rauschens gleich (Stärke ±0,2, Käufe identisch 347); die Mischung der Reihenfolge ändert **nichts**: Die Rangkorrelation Zugriffsposition ↔ Stärke ist ≈ 0, die ersten acht Teams sind in
beiden Reihenfolgen um ca. 0,8 bis 0,95 Punkte (rund 2 %) schwächer als die letzten acht — ein kleiner Reihenfolge-Effekt (spät hat leicht Vorteil, vermutlich über die verbliebene Auswahl an günstigen Stützen), der mit
der Mischung **mitwandert**, also nicht an den Teams hängt. Kein „First-come“-Vorteil.

### Kasse nach S1-Kaderbau nach Finanzwert (% Startbudget; Ziel S1 = halbierte Quote 2,5 bis 12,5 %)

| Finanzwert | n | A Median % | C2 Median % | Ziel S1 % |
|---|---|---|---|---|
| 1 | 1 | 5,4 | 5,7 | 2,5 |
| 2 | 3 | 3,8 | 3,6 | 3,6 |
| 3 | 7 | 5,1 | 5,1 | 4,7 |
| 4 | 4 | 6,6 | 6,1 | 5,8 |
| 5 | 2 | 8,3 | 7,6 | 6,9 |
| 6 | 2 | 8,8 | 8,2 | 8,1 |
| 7 | 8 | 10,1 | 10,4 | 9,2 |
| 8 | 1 | 12,2 | 11,1 | 10,3 |
| 9 | 2 | 11,9 | 11,7 | 11,4 |
| 10 | 2 | 12,8 | 12,8 | 12,5 |

Gegen die CLAUDE.md-/Finanzkonzept-Vorgabe (Rücklage nach Finanzwert 15 bis 25 % hoch, 5 bis 10 % niedrig, in S1 halbiert, Floor ≥ 0,35 × Zielgehalt): **in S1 wird sie eingehalten**, die Teams landen 0,3 bis 2,9 Prozentpunkte darüber
(die Reste, die kein weiterer Spieler mehr füllt).

## 3. Warum behält die KI Geld? (Variante A, mit Zahlen)

### 3.1 S1 (Draft): die Rücklage ist die Bremse, sonst nichts

Der Planer (`lib/ai/organic-squad/draft-builder.ts`) hört auf, wenn **(i)** der Kader voll ist, **(ii)** kein Kandidat mehr bezahlbar ist, ohne unter den Floor zu fallen
(`cash − Preis − reserveForMin ≥ affordFloor`), oder **(iii)** der „Halten“-Nutzen (`stopUtility`) größer ist als der beste Kauf; dazu Fee-/Gehaltsdeckel des Vorstands. Für jedes Team
wurde der Floor zur Draftzeit rekonstruiert (S1: `max(5, ½ × Rücklage-Quote × Startbudget)`, Kader war leer) und mit der Endkasse verglichen:

| Grund (Teams, Variante A, S1) | Anzahl |
|---|---|
| **Rücklage bindet**: nächster Spieler (billigster im Pool 6,34 Mio) ginge nur unter den Floor | **28** |
| Kasse zu klein, auch ohne Rücklage geht nichts mehr (Kasse 9 bis 10 Mio, Floor 5) | 3 |
| Kader voll (14 von 14) | 1 |
| Vorstandsbudget bindet / Stop-Nutzen bindet | 0 / 0 |

Spielraum Endkasse − Floor: Median 1,5 Mio (P10 0,5, P90 4,2). Σ Floor 575 von Σ Endkasse 641 Mio: **90 % der in S1 übrig gebliebenen Kasse sind die Rücklage selbst.**
Gegenprobe (Planer auf dem Endzustand befragt, Rücklage V2 abgeschaltet): 28 Teams würden mindestens einen weiteren Spieler kaufen (zusammen 33 Käufe; die Gehalts-Untergrenze 0,35 × Gehalt bleibt in dieser
Probe stehen, also eine Untergrenze), ohne Vorstandsbudget ändert sich nichts. **C2 identisch** (Rücklage bindet 27, Kasse zu klein 4, 1 Team „kauft noch“).

### 3.2 S2 (Kaufphase): hier entsteht die „Hortung“

Gemessen (A, Median über 32 Teams): Kasse vor der Kaufphase **83,2**, danach **41,5** (also 50 % bleiben), Ausgabe Median 37,9 für ca. 2 Spieler, Kader 7 → 9 bei Optimum 12; **28 von 32 Teams bleiben unter dem Optimum, 6 unter dem Mindestkader 8**.
C2-Start liefert dasselbe Bild (78,4 → 49,4). Beide S2-Läufe nutzen **denselben** Kaufweg (Weg C, Marktplan), sie unterscheiden sich nur im S1-Ausgangsstand — das sind **keine zwei S2-Varianten**.

Die Ursachen, nach Gewicht:

1. **Rücklagen-Basis „Kasse + Kaderwert“.** `resolveKiRuecklageFuerTeam` rechnet `q(Finanzwert) × (Kasse + Marktwert des Kaders)` (5 bis 25 %), ab S2 **nicht** halbiert. Zu Beginn der Kaufphase (Kader 7 von 12) ist der Kaderwert
   deutlich größer als die Kasse, der Floor liegt bei Median **34,7 Mio = 48 % der Kasse** (Finanzwert 1 bis 3: 37 %, 4 bis 6: 50 %, 7 bis 10: 70 %). Das ist die Rücklage nach Konzept — nur eben 15 bis 25 % von etwas, das
   doppelt so groß ist wie das verfügbare Geld. Für 16 von 32 Teams ist sie die bindende Grenze (Endkasse − Floor kleiner als der billigste Spieler), Median Endkasse = 1,13 × Floor.
   **Das ist Chris’ „fast 100 %“**: Wer 83 Mio hat und 35 Mio als „Rücklage“ halten soll, behält mit dem Rest-Spielraum rechnerisch 40 bis 50 %.
2. **Der S2-Kauf nimmt den einseitigen Marktplan, nicht den organischen Planer.** `fuehreKiPreseasonLaufAus` → `applyAiMarketPlanLocally`: **ein** Durchgang, Kaufanzahl nur bis zum Optimum
   (`resolveAllowedMarketBuyCount`: Lücke bis Optimum, darüber 0, außer „Post-Opt-Upgrade“ mit 1 bis 3 Käufen und nur bei Kasse/Gehalt ≥ 1,1 — erfüllen nach dem Kauf nur 9 von 32 Teams), alles-oder-nichts-Gate bis zum Mindestkader
   (`roster_after_market_plan_below_player_min`). Lauf-Protokoll: `aiTeamsCompleted` **21/32**; gemeldete Sperren: `vorstand_transferbudget_nicht_freigegeben`, `cash_after_market_plan_below_reserve`,
   `roster_after_market_plan_below_player_min`, `insufficient_cash`, `buy_execute_failed`. **Beleg, dass der Kauf nicht erschöpft ist:** ein Trockenlauf desselben Marktplans direkt auf dem Endstand plant **noch 36 Käufe bei 25 Teams**
   (6 Teams `hold`, 2 `blocked`). 16 Teams stehen am Ende **oberhalb** ihres Floors und kaufen trotzdem nicht weiter.
3. **Gebäude vor Kauf.** Im selben Lauf werden 42 Gebäude-Aktionen (Eimer „Budgetplanung/Gebäude“) vor dem Markt gebucht; klein (Stufe 1: 5 bis 13 Mio), aber sie ziehen aus demselben Topf.
4. **Der organische Planer würde noch mehr kaufen:** auf dem Endstand befragt kaufen 16 (A) bzw. 17 (C2) Teams weiter (`kauft_noch`), 10 bzw. 7 sind rücklagengebunden, 6 bzw. 7 haben zu wenig Kasse (Kader < 8, Kasse zu klein).
   Der organische Pfad ist also der weniger zögerliche; der S2-Hauptlauf nutzt ihn nicht.

Zu Chris’ Zahlen: seine 63,2 / 42,9 Mio (Median nach S2-Kaufphase) sind in dieser Messung **41,5 (A) bzw. 49,4 (C2)**, ein anderer Seed; Kasse vor der Kaufphase ist hier 78 bis 83 Mio, nicht 50 bis 70 —
am **Anteil** ändert das nichts: **50 bis 56 % der Kasse bleiben liegen**, P90 87 bis 90 %.

## 4. Empfehlung

**Variante A (Block-Draft) behalten — ein Umbau auf „normal einkaufen“ bringt in S1 nichts**, weil C2 mit demselben Planer Stärke, Kaderform, Kasse und Reihenfolge-Effekt gleich liefert und der echte „normale“ Marktplan S1 nicht kann.
Der Hebel gegen die Hortung liegt **in S2 und bei der Rücklagen-Basis**, nicht im Draft: (1) die Quote (5 bis 25 %) auf die **Kasse zu Kaufbeginn** beziehen (oder ab S2 auf einen Wert ≈ 1/2 der heutigen Quote setzen) statt auf Kasse + Kaderwert,
sodass der Floor 15 bis 25 % bzw. 5 bis 10 % des tatsächlich verfügbaren Geldes ist (heute 48 %); (2) die S2-Kaufphase auf den **organischen Planer in der Kaufsitzung** (`runTransferWindowSession`/Konvergenz) umstellen, damit Teams bis zum Optimum **und**
bis zum Floor ausgeben (Trockenlauf: noch 36 Käufe offen, 28 von 32 Teams unter Optimum, 6 unter dem Mindestkader) und der alles-oder-nichts-Block `roster_after_market_plan_below_player_min` entfällt; (3) in S1 nichts Neues nötig, ggf. den halbierten Floor weiter
senken, wenn mehr als 1,6 fehlende Plätze je Team stören (29/32 Teams unter Optimum, Floor = 90 % der Restkasse). Anschließend A/B mit demselben Skript (`--variante A` vs. geänderter Code) und Wertungs-Fingerabdruck prüfen.

## 5. Grenzen und Vorbehalte

- **Ein Seed** je Variante (+ eine gemischte Reihenfolge, nur Kaderbau). Die Einzelzahlen (z. B. 41,5 gegen 49,4 Mio in S2) streuen; das Muster (Rücklage ist Floor, S2 ≈ 50 % liegen) ist über beide Läufe stabil.
- Die S1-Gründe sind **auf dem Endzustand rekonstruiert** (Floor aus Startbudget bei leerem Kader nachgerechnet, Planer-Gegenprobe auf dem Endpool), nicht im laufenden Draft mitprotokolliert; die Gegenprobe mit abgeschalteter Rücklage behält die
  Gehalts-Untergrenze und ist ein Mindestmaß. Stop-Nutzen und Preisgrenzen sind im Draft-Builder nicht einzeln gezählt; sie sind **keine** Hauptbremse (0 Teams), weil jedes Team 0,4 bis 6 Mio über dem Floor und unter dem billigsten Kandidaten endet.
- Die S2-Rücklage-Rekonstruktion nutzt den Schnappschuss „vor Kaufphase“ (Kasse, Kaderwert, Gehalt, Finanzwert) und das Optimum aus der Planer-Probe; der Trockenlauf-Marktplan wurde auf dem **Endstand**, nicht vor dem Kauf befragt.
- Die „Top-20 nie gekauft“-Beobachtung ist ein **Befund ohne Ursachenanalyse** (Marktwert 81 bis 113; in der Pool-Liste jedes Teams vorhanden); mögliche Ursachen: Lizenz-/Pyramiden-Logik, Preisaufschlag, Rücklage — nicht untersucht.
- Maschine war ausgelastet (andere Agenten, Arena-Spieltage liefen seriell, einige Arena-Vorläufe wurden wiederholt); das berührt die Spielergebnisse, nicht die Käufe.
- Disziplin-Eignung „solide“ = Eignung > 60 (`disciplineRatings`); Superstar-Maß = Top-20 nach Marktwert bzw. nach Mittel der drei besten Disziplinwerte.

## 6. Nachstellen

```sh
env -u NODE_OPTIONS OLY_APP_SQLITE_PATH=/pfad/basis.sqlite npx tsx scripts/miss-teamfinanzen-saison.ts --nur-anlage --out basis.json --keep
cp basis.sqlite lauf.sqlite
env -u NODE_OPTIONS OLY_APP_SQLITE_PATH=/pfad/lauf.sqlite OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 npx tsx scripts/miss-teamfinanzen-saison.ts --von-anlage <saveId> --variante C2 --mischen 7 --stop-after draft --out lauf.json --keep
env -u NODE_OPTIONS OLY_APP_SQLITE_PATH=/pfad/lauf.sqlite npx tsx scripts/diagnose-s1-kader-und-kasse-18-11.ts <saveId> diag.json basis-oder-lauf.json
node scripts/auswerte-s1-ohne-draft-18-11.mjs "A=lauf-A.json,diag-A.json,diag-A-s2.json" "C2=lauf-C2.json,diag-C2.json"
```

Voller Lauf mit (b) und (c): `--seasons 2 --stop-after kaufphase` statt `--stop-after draft` (ca. 55 Minuten); danach `scripts/probe-s2-kaufgrenzen-18-11.ts <saveId> out.json` auf derselben SQLite.

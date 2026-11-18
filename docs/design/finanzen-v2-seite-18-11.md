# Finanzseite V2 — Bau, Entscheidungen, Messung (18.11.2026)

Baut auf `docs/design/finanzen-v2-stufe0-3-18-11.md` und `finanzkonzept-v2-budgets-18-11.md` (Abschnitt 12 = Chris' Entscheidungen).
Wertung und Arena-Motor unberührt (`pruefe-wertung-fingerabdruck.mjs`: GESAMT ce8fcef66028 bleibt).

## 1. Was gebaut ist

| Teil | Datei |
|---|---|
| Neue Seite (Kopf mit Kennzahl-Reitern, sechs Reiter: Übersicht, Kontoauszug, Budgets, Sponsor, GuV, Apron; Kontext Lage/Quelle/Liga) | `app/foundation/finances/FinanzenModern.tsx`, `finanzen-modern.css` |
| Lesemodell (Kontoauszug, Verlauf je Station, Prognose) | `lib/finance/finanzseite-modell.ts` |
| Töpfe, Umschichten, Lockerung, Anzapfen, Alles auf eine Karte (Rechnung) | `lib/finance/vorstand-budgetfreigabe.ts` |
| Aktionen (Mensch und KI, gleiche Funktionen) | `lib/finance/vorstand-budget-aktionen.ts` |
| Schreibweg | `POST /api/finance/vorstand` (`authorizeServerRoomWrite`, Aktion `vorstand_budget_update`) |
| Gebäude gegen den Investitionstopf | `lib/facilities/facility-upgrade-service.ts` (Vorschau, damit auch Anwenden und KI) |
| Gehaltserhöhung bei Verlängerung gegen den Gehaltstopf | `lib/contracts/contract-renewal-service.ts` |
| Ausgang der Wette und Anzapf-Kosten als Vorstandsziele (nur Vertrauen, keine Geldstrafe) | `lib/board/team-season-objectives-service.ts` |
| KI-Entscheidung einmal je Fenster | `lib/ai/ai-transfer-window-session-service.ts` |

Raus: `FoundationFinancesNewLook.tsx`, der `.nl-fin-*`-Block in `globals.css`, `finances-view-sections.ts`, die Markup-Tests der alten Seite.
Gehälter stehen **groß je Saison, klein je Spieltag**, Einheit C.

## 2. Entscheidungen (wo das Konzept offen war)

1. **Saison 1 bleibt voll frei** (Chris: Quote 100 % für alle). Ab Saison 2 gilt die harte Sperre, auch bei Quote 100 % für den Gehaltstopf.
2. **Transfertopf ab Saison 2** = q × (Kasse − Rücklage-Ziel − Gehaltspuffer) + q × Verkaufserlöse (Konzept Abschnitt 1). Im ersten Fenster (Saison 2) zählt nur die **halbe** Rücklage (Übergang, Rückfrage an Chris unten).
3. **Gebäude**: Bau und Ausbau gegen den freien Transfertopf; in der Sparauflage keine Gebäude außer mit „Alles auf eine Karte“ (Konzept Abschnitt 7). Verkauf eines Gebäudes zählt als negative Kosten.
4. **Verlängerung**: nur die Gehaltserhöhung zählt gegen den freien Gehaltstopf; gleiches oder niedrigeres Gehalt geht immer, kein Zwangsverkauf. Verlängerungen im Saisonende-Fenster von Saison 1 sind frei (die Saison-ID ist noch 1).
5. **Umschichten** ±25/20/15/10 % des Gehaltstopfs, 1 C = 1 C Jahresgehalt; Gehalt → Transfer nur im Fenster und höchstens die Hälfte von Rücklage + Puffer.
6. **Lockerung**: Puffer 10/20/30 % des tragbaren Gehalts, eine Stufe je Fenster, Mehrfreigabe höchstens der Verkaufserlös, Boden Rücklage + Puffer + X. Gesperrt bei Kasse im Minus, bei Kredit dieses Fensters und unter dem Kader-Minimum.
7. **Rücklage anzapfen** bis 50 % des Ziels, Vertrauen −0,25 je angefangenem Viertel. Die Kosten stehen als Vorstandsziel „Rücklage angezapft“; **die Quote dieser Saison bleibt** (Wirkung erst bei der nächsten Festlegung).
8. **Alles auf eine Karte**: einmal je Saison, nur im Fenster ab Saison 2. Mensch: Antrag, genehmigt ab Vertrauen 4, sonst Ablehnung mit Begründung. Vorstand fordert es bei Erwartungsrang ≤ 3 und Vertrauen ≥ 8, der Mensch nimmt per Knopf an. Wirkung: Quote 100 % in beiden Töpfen, Rücklage und Puffer entfallen, bis auf 5 % bleibt alles ausgebbar. Ziel eingefroren = Endrang zwei Plätze besser als die Kader-Erwartung (mindestens Platz 1). Ausgang als Vorstandsziel: Treffer +0,75 Vertrauen, Verfehlen −1,0, keine Geldstrafe.
9. **KI** (`entscheideKiVorstandMassnahmen`): Charakter aus der Risikobereitschaft (<4 vorsichtig, >7 aggressiv). Umschichten Transfer → Gehalt nach Charakter (0/50/100 % der Grenze), wenn der Gehaltstopf zuerst bindet; Rücklage anzapfen nur aggressiv und unter Soll; „Alles auf eine Karte“ nur aggressiv, Ambition ≥ 7, Vertrauen ≥ 5, Erwartungsrang ≤ 4, oder wenn der Vorstand es fordert.
10. **Verlauf je Spieltag**: heute bucht das Spiel Sponsor, Gehalt, Gebäude und Kredit am Saisonende, Spieltags-Zeilen gibt es nur für Transfers (Taktung ist Stufe 4). Die Seite zeigt deshalb Start, Spieltage, Prognose und die Saisonabrechnung als eigene Station und erfindet keine Spieltags-Posten.
11. **Liga-Vergleich** steht nach dem Mockup im Kontext-Panel (Reiter „Liga“), der Apron hat einen eigenen Reiter (Chris' frühere Vorgabe bleibt erfüllt, „ganz oben“ ist durch das Mockup ersetzt).
12. Nicht gebaut: KI-Regel „Gebäude höchstens 30 % des freien Betrags und erst bei Soll-Kader“ (die harte Sperre wirkt trotzdem), Pflichtkredit-Lockerungssperre nur vereinfacht, Fans/Merch-Reiter des Mockups (die Mechaniken gibt es noch nicht).

## 3. Messung (`scripts/miss-teamfinanzen-saison.ts`, 32 KI-Teams, Saison 1 voll gespielt, Kaufphase Saison 2, eine Saat)

Paarweise auf identischem Stand vor der Kaufphase (`--stop-after vorkauf`, dann je Variante `--resume`). **vorher** = `OLY_VORSTAND_BUDGET=0` (identisch mit Stufen 1+2 allein); **nachher** = dieser Stand.

| Kennzahl (32 Teams, nach der S2-Kaufphase) | vorher | nachher |
|---|---:|---:|
| Käufe | 69 | 48 |
| Kader (Median / kleinster) | 10 / 6 | 8 / 6 |
| Teams unter Minimum 8 | 7 | 12 |
| Kasse (Median) | 42,9 | 60,1 |
| **Kaderstärke Median** | 44,30 | 41,62 (**−6,0 %**) |
| Kaderstärke unterstes Viertel | 40,29 | 39,18 (−2,8 %) |
| Gebäude gesamt | 43 | 43 |

**Abbruchkriterium (−5 % im Median) ist ausgelöst.** Der PR bleibt Draft und wird nicht gemergt.

Wie oft greift die Sperre (abgelehnte Prüfungen, Saison-2-Kaufphase):

| Art | Prüfungen | Teams |
|---|---:|---:|
| Kauf, Ablöse über dem freien Transfertopf | 20 | 20 |
| Kauf, Gehalt über dem freien Gehaltstopf | 1 | 1 |
| Gebäude | 0 (1 Lauf: 2 bei einem Team, mit voller Rücklage) | 0 bis 1 |
| Verlängerung | 0 | 0 |

„Alles auf eine Karte“: 0 Nutzungen, Umschichten: 0, Rücklage anzapfen: 0, Lockerung: 0 (KI-Bedingungen sind eng, im Lauf erfüllte keines der 32 Teams sie; Stufen zu Beginn: 18 hoch, 14 mittel, 0 niedrig, 0 Sparauflage).

### Diagnose

* Es ist **nicht die Rücklage**: ohne Rücklage im Topf (Testlauf) und mit halber Rücklage kommen dieselben Zahlen heraus (Median 41,62).
* Die abgelehnten Käufe sind je Team genau **ein teurer Zugang** (Ablöse 36 bis 45 C bei 7 bis 36 C frei). Sie kommen aus dem **Markt-Plan der KI** (`ai_preseason_market_buy`, `ai-market-plan-apply-service`), der die Töpfe nicht kennt, nur der organische Planer (`planOrganicDraftForTeam`) bekommt `feeCap`/`salaryCap`. Der Zugang scheitert an der harten Sperre, und die Teams bleiben mit Geld auf der Hand bei Kader 8 stehen (Kasse 60 statt 43).
* **Empfohlene Behebung (nicht mehr in diesem PR):** den Markt-Plan-Planer mit `investition.frei` und `gehalt.frei` als Kaufgrenze füttern, damit er billigere Spieler plant statt eines gesperrten Stars; danach Messung wiederholen. Alternativ die Sperre für die KI nur über den organischen Planer wirken lassen.

## 4. Offene Punkte für Chris

1. Soll im ersten Fenster (Saison 2) nur die halbe Rücklage zählen (Übergang)? Ohne diese Entscheidung wären die Töpfe im ersten Fenster noch enger.
2. Die KI-Planer müssen die Töpfe kennen (siehe Diagnose), sonst kostet die harte Sperre Kaderstärke.
3. Verlängerungen im Saisonende-Fenster von Saison 1 sind frei (Saison-ID 1). Soll die Sperre dort schon für die kommende Saison gelten?
4. Spieltags-Buchungen (Stufe 4) fehlen, der Verlauf je Spieltag ist bis dahin eine Transfer-/Saisonende-Kurve.

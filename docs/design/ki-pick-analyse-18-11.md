# KI-Pick-Analyse + Vorschlag „Kaderplan" — Draft ja oder nein? (18.11.2026)

Auftrag (Chris, wörtlich): „wenn ein spieler nicht selber pickt soll SINNVOLL gepickt werden als wäre das team richtig AI gesteuert,
das soll nicht über so einen NOTFALL weg fahren! niemals — und es gibt immer jemanden der affordable ist, deswegen wollte ich das nicht
mit dem beschränkten draft mode sondern man soll aus ALLEN knapp 3k spielern picken können! … versuch mal bitte zu verstehen wie die AI
aktuell pickt und ob das mit dem draft mode funktionieren kann … und die team identitäten widerspiegelt und man nicht nur minimum picks
hat mit einem star drin". Dazu im Lauf des Abends: „wenn C-C 14 picks plant, sollte es am Ende nicht 8 haben", die Planer-Vorgabe
(„mit dem adjusted Budget rechnen und trotzdem die Slots füllen") und die Rücklage-Vorgaben (Spreizung nach Persönlichkeit,
„Notrücklage, kein greedy Vorstand").

**Basis dieses Branches:** `claude/finanzen-v2-seite-18-11` (#1618, KI-Planung mit Töpfen) **plus** `claude/draft-neubau-kern-18-11`
(#1619, Liga-Draft im Einzelschritt) **plus** `main`. Beide PRs ändern denselben Kaufschritt; die #1618-Änderungen sind hier in
`organicBuyStep` (#1619) übertragen — dieselbe Auflösung braucht, wer die beiden PRs nacheinander merged.
Baut auf der Messung `docs/design/messung-s1-ohne-draft-18-11.md` (#1628) auf und wiederholt sie nicht.

Werkzeuge (alle neu, nur `scripts/`): `scripts/miss-ki-pick-analyse-18-11.ts` (Messlauf), `scripts/auswerte-ki-pick-analyse-18-11.mjs`
(Tabellen), `scripts/sonde-ki-topstars-18-11.ts` (warum kein Top-Star), `scripts/rechne-ruecklage-s2-vorschlag-18-11.ts` (Rücklage S2,
Rechnung). Rohdaten und volle Auswertung: `data/generated/ki-pick-analyse-18-11/`. Alles auf Wegwerf-SQLite (gelöscht),
`data/online-saves` unberührt, kein Dev-Server. Arena-Fingerabdruck unverändert **`ce8fcef66028`** (75 Einträge).

Messaufbau: neues Spiel (Battle, `solo_1`, Liga-Split 2×16), **32 KI-Teams mit Sponsor**, zwei Saaten (zwei Anlagen,
`new-game-1795031007669-tlnbzg`, `new-game-1795031831980-4fi8up`). Jede Variante paarweise ab derselben SQLite-Kopie. Neben dem echten Lauf
rechnet das Messskript je Team den **Solo-Plan** (die KI darf als Erste aus dem vollen Pool) und eine **Block-Simulation** im Speicher
mit Abbruchgrund je Team; die Simulation trifft den echten Blocklauf zu **99,7 %** (1475 von 1479 Spielern).

---

## 0. Kurzfassung

1. **Pool: es gibt immer jemanden, der bezahlbar ist — und die KI sieht schon heute alle.** Im frischen Spiel 2984 Spieler, **2983 frei
   und kaufbar** (Marktwert > 0). Billigster 2,6, die acht billigsten zusammen 29,9; das ärmste Team hat 170. Blocklauf und Einzelschritt
   bewerten bei **jedem** Kauf alle 2983 (`listLocalTransfermarktFreeAgents({ fullPool: true })` bzw. `freieSpieler`). Die „Top 3 → 20 →
   200" in #1619 sind keine Pool-Grenze, sondern nur die Nachrück-Reihenfolge nach einem gescheiterten Kauf.
2. **Wie die KI heute endet (S1):** nicht „Minimum + ein Star", sondern **flach und 1 bis 4 Spieler unter dem eigenen Kaderziel**.
   29 von 32 Teams unter Opt (48 leere Plätze), Kader 8–13 (Ø 10,8), **26 Teams ohne einen Star** (Marktwert ≥ 45), Geld bis auf die
   Rücklage ausgegeben (Median 2,1 über der Rücklage). Grund: die Schleife reserviert Geld nur fürs **Minimum 8**, nicht für die
   **geplanten Plätze bis Opt**; sie zahlt im Schnitt mehr je Spieler, als ihr Budget je geplantem Platz hergibt (29 von 32 Teams), und
   steht dann mit `nothing_affordable` an der Rücklage. Kein Kandidat „fehlt", der Topf ist leer.
3. **Identität zeigt sich bei der Kadergröße und der Star-Konzentration, aber zu schwach bei Stars.** Spearman Opt ↔ Kader 0,80,
   Elite-Neigung ↔ Kader −0,80, Star-Priorität ↔ Anteil des Teuersten am Kaderwert 0,76. Aber: der Kompositionsplan sieht für 25 von 32
   Teams **keinen** Star vor, kein Top-20-Spieler (Marktwert 81–113) wird je gekauft — die Preis-Strafe eines 100er-Spielers (5–6 „Plätze"
   Budget, ≈ 125–180 Nutzenpunkte) schlägt jeden Stärkegewinn (Abschnitt 2.4).
4. **Einzelschritt-Draft funktioniert mit dieser Logik.** Gleiche Kader wie der Blocklauf (Stärke 46,7 gegen 46,8, gleiche Stufen, gleiche
   Kasse), **0 Notkäufe**, 0 Nachrücker in einer reinen KI-Liga. Der Greedy-Loop entscheidet ohnehin Schritt für Schritt; der Einzelschritt
   ist nur ein anderer Takt. **Entscheidung: Draft JA** — mit dem Kaderplan unten und ohne Notweg.
5. **Der Notweg ist an sechs Stellen eingebaut**; in S1 greift er in einer KI-Liga praktisch nie, in S2 dagegen strukturell (Marktplan
   mit Kurzliste). Empfehlung je Stelle in Abschnitt 4.
6. **Prototyp „Kaderplan" (`OLY_KI_KADERPLAN=1`, Standard aus):** jeder Kauf unter Opt reserviert die restlichen geplanten Plätze zum
   Platzpreis (ab 12, keine Füller), Füller gesperrt solange das Budget den Plan trägt, kein „Aufhören" unter Opt, kein
   Billigster-Spieler-Notweg mehr (Bestbewertung mit gelockerter Schranke). Gemessen, beide Saaten und beide Draft-Arten:
   **0 Teams unter Opt (vorher 28–30), Kader 10–14 (8–10 Teams mit 14), Kasse genau an der Rücklage, Stärke 45,8 statt 46,8 (−2,2 %)**,
   Block und Einzelschritt identisch verteilt.
7. **Saison 2 ist die eigentliche Baustelle** (Horten, Stopp bei 8–9): dort kauft **eine zweite KI** (Marktplan mit Kurzliste
   `max(3, Lücke bis Minimum + 2)`), nicht der organische Planer. Vorschlag: **ein** Kaufweg für Draft, S1, S2 und Auto-Pick —
   der organische Schritt mit Kaderplan; Rücklage ab S2 nach Sparneigung und **angespart statt gesperrt**, als **Notrücklage**.

---

## 1. Wie die KI heute pickt

### 1.1 Wer kauft wann (zwei verschiedene KIs)

| Zeitpunkt | Aufrufer | Entscheider | Kandidaten |
|---|---|---|---|
| S1-Draft, Blocklauf (live) | `kickoffLeagueSetupDraft` → `fuehreLigaSetupDraftAus` → `runAiPicksExecutePreview` → `runOrganicTeamDraftExecute` (`lib/ai/ai-picks-run-service.ts:2953`) | organischer Planer `planOrganicDraftForTeam` (`lib/ai/organic-squad/draft-adapter.ts`), ganzer Kader am Stück je Team | alle freien Spieler (`fullPool: true`, Z. 3020), 2983 |
| S1-Draft, Einzelschritt (#1619, `OLY_LIGA_DRAFT_MODUS=einzelschritt`) | `laufeKiZuege` → `bewerteKiPick` (`lib/draft/liga-draft-ki.ts`) | **derselbe** Schritt `organicBuyStep`, ein Pick je Zug | alle freien Spieler (`freieSpieler`), 2983 |
| S2+-Kauffenster (live) | `fuehreKiPreseasonLaufAus` → `applyAiMarketPlanLocally` (`lib/ai/ai-preseason-background-service.ts:377`) | **Marktplan** (`buildAiMarketPlanPreview`, `ai-transfermarkt-preview-service.ts`) — nicht der organische Planer | **Kurzliste** `recommendedBuys = max(3, Lücke bis Minimum + 2)` (`ai-transfermarkt-preview-service.ts:2093`) |
| S2+ organisch (gebaut, im Spiel nicht im Kauffenster) | `runTransferWindowSession` → `runOrganicBuyCycle` | organischer Planer | alle freien |

Reihenfolge im Blocklauf: `orderTeamsForDraft` (Z. 2514) — höchster Startrang (schwächstes Team) zuerst, jedes Team plant seinen ganzen
Kader gegen den Restpool. Im Einzelschritt: Runde für Runde, schwächstes Team zuerst (`berechneRundenReihenfolge`).

### 1.2 Der Kaufschritt (organisch)

Je Schritt (`organicBuyStep`, `lib/ai/organic-squad/draft-builder.ts`):

1. **Bezahlbar** ist ein Kandidat, wenn `Kasse − Preis − Reserve fürs Minimum ≥ Untergrenze`. Untergrenze: unter 8 die Rücklage (S1
   halbiert, fällt auf 0, wenn das Minimum sonst nicht erreichbar ist), zwischen 8 und Opt die Rücklage, ab Opt der volle Puffer
   (`max(Rücklage, 0,35 × Gehalt)`). Reserve fürs Minimum = Summe der billigsten Preise für die fehlenden Plätze **bis 8**. Mit #1618
   zusätzlich Transfer- und Gehaltstopf des Vorstands (`kaufRahmen`).
2. **Bewertung** (`buyUtility`, `utility.ts:468`): `wWin × Stärkezuwachs` (Eignung je Disziplin, gedämpft durch die Abdeckung, Identitäts-
   Achsen) + Rotationswert unter Opt + Füllqualität + Themen-Passung + Kompositions-Zuschlag (Soll-Pyramide Superstar/Star/Core/Depth/
   Backup/Reserve aus `deriveCompositionCounts`) + Potenzial − **`wThrift × Preis in Plätzen × 30`** − Gehaltslast + Saat-Jitter (±7,5).
   „Preis in Plätzen" = (Ablöse + 2 × Gehalt) / (Kasse / offene Plätze bis Opt).
3. **Stopp**, wenn (ab 8) `wPatience × Cash-Optionswert ≥ bester Kauf`, wenn der Kader voll ist (14) oder wenn nichts bezahlbar ist.

Gewichte aus Identität und GM (`weights.ts`): `wWin` aus Ambition/Vorstandsdruck/Star-Priorität, `wThrift` aus Finanzwert/Wertorientierung,
`wPatience` aus Finanzwert/Cash-Priorität; **Opt = Blatt-`playerOpt` (11–14), GM-Tiefe darf nur nach oben schieben**.

---

## 2. Messung heute (S1, 32 KI-Teams)

### 2.1 Pool

| im Spielstand | frei | kaufbar (MW > 0) | billigster | P10 | Median | P90 | teuerster | Σ 8 billigste | für das ärmste Team (170) bezahlbar |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2984 | 2983 | 2983 | 2,6 | 12,1 | 25,0 | 48,4 | 113,5 | 29,9 | **2983** |

Stufen im Pool: Superstar (≥ 65) 89, Star (45–65) 297, Core 710, Depth 855, Backup (12–20) 743, Reserve (< 12) 289.
Σ Kassen der Liga 7915 bei 32 × Opt ≈ 390 Plätzen: **im Schnitt 20 je Platz** — genau die Depth-Stufe. Mehr Stars heißt zwingend
billigere Plätze daneben; das ist die Stellschraube der Identität (Abschnitt 5.3).

### 2.2 Verteilung nach dem Draft (vorher)

| Lauf | Kader Ø (min–max) | unter Opt | Stars (0 / 1 / ≥ 2 Teams) | Top-1-Anteil am Kaderwert | Kasse Median (% Start) | über Rücklage Median | Stärke Ø |
|---|---|---:|---|---:|---|---:|---:|
| Block, Saat 1 | 10,8 (8–13) | 29 | 26 / 3 / 3 | 0,16 | 19,0 (8 %) | 2,1 | 46,8 |
| Einzelschritt, Saat 1 | 10,7 (9–13) | 30 | 26 / 3 / 3 | 0,16 | 17,5 (8 %) | 1,9 | 46,7 |
| Block, Saat 2 | 10,8 (8–14) | 28 | 26 / 3 / 3 | 0,16 | 18,2 (8 %) | 1,4 | 46,8 |

Stufen gesamt (Saat 1, Block): Superstar 3, Star 6, Core 46, Depth 146, Backup 89, Reserve 55. Abbruchgrund (Block-Simulation):
**`nothing_affordable` 31, stop 1** — die Teams hören nicht freiwillig auf, das Geld ist an der Rücklage aus.

**In S1 hortet die KI nicht** (Kasse 8 % des Startbudgets, wie #1628 und #1618 gemessen). Kasse ↔ Finanzwert Spearman 0,87 —
das ist die Rücklage nach Finanzwert, nicht Zögern.

### 2.3 Plan gegen Ist (Chris: „wenn C-C 14 picks plant …")

| Team | Archetyp | geplant (Opt) | gekauft | Lücke | Abbruch | Budget je geplantem Platz | Ø Preis je gekauftem Spieler | Kasse über Rücklage |
|---|---|---:|---:|---:|---|---:|---:|---:|
| R-C | rivalry_hawk | 13 | 9 | 4 | nothing_affordable | 15,4 | 21,9 | 3,0 |
| P-C | bargain_hunter | 12 | 9 | 3 | nothing_affordable | 14,7 | 19,0 | 5,8 |
| S-C | rivalry_hawk | 12 | 9 | 3 | nothing_affordable | 15,8 | 21,0 | 0,0 |
| V-V | star_chaser | 11 | 8 | 3 | nothing_affordable | 20,4 | 27,6 | 3,1 |
| C-C | bargain_hunter | 14 | 12 | 2 | nothing_affordable | 13,5 | 15,7 | 0,1 |
| C-S | facility_architect | 12 | 10 | 2 | nothing_affordable | 23,5 | 28,1 | 0,5 |
| D-P | culture_keeper | 12 | 12 | 0 | nothing_affordable | 19,0 | 19,0 | 0,1 |

Σ 48 leere geplante Plätze bei 29 Teams. **Warum ein geplanter Platz leer bleibt:** nicht, weil der Wunschkandidat weg ist (es gibt
2983, der Schritt nimmt den nächstbesten), nicht wegen Stop-Nutzen (1 von 32), nicht wegen der Vorstandssperre (in S1 100 %), sondern
weil **frühere Käufe das Budget der späteren Plätze verbraucht haben**: im Schnitt teurer als Budget je Platz bei 29 von 32 Teams. Die
Schleife reserviert nur für die Plätze bis 8. Das Bild „C-C endet bei 8" stammt aus **Saison 2** (#1618: C-C, D-P stehen nach dem
Fenster bei 8–9 mit ≈ 30 frei) — dort ist der Grund die Kurzliste des Marktplans (Abschnitt 4, Stelle 6).

### 2.4 Warum kein Top-Star (Marktwert 81–113) gekauft wird

`scripts/sonde-ki-topstars-18-11.ts`, erster Kaufschritt aus dem vollen Pool:

| Team | Kasse / Opt | Budget je Platz | Lizenz | Platz 1 (MW, Nutzen) | Top-5-Spieler: Rang von 2983 | Preis in Plätzen | Preis-Strafe |
|---|---|---:|---|---|---|---:|---:|
| M-M | 325 / 12 | 27,1 | ja | 65,7 / 300 | 451 – 1785 | 5,4–6,2 | 126–146 |
| Z-H | 320 / 11 | 29,1 | ja | 47,2 / 283 | 1412 – 1783 | 5,0–5,8 | 154–178 |
| R-L | 295 / 10 | 29,5 | ja | 52,1 / 299 | 523 – 1939 | 5,0–5,7 | 147–169 |
| C-S | 315 / 11 | 28,6 | nein | 30,4 / 254 | 2066 – 2866 | 5,1–5,9 | 99–115 |

Bester Rang irgendeines Top-20-Spielers über alle Teams: **11**. Ursache ist allein der **budgetrelative Preis-Term**: ein 100er-Spieler
„kostet" 5–6 Plätze Budget, das sind 125–180 Nutzenpunkte Strafe, der Stärkegewinn bringt ≈ 60–90. Keine Preisdeckelung, kein Vorstand,
keine Rücklage, kein Stopp. Dazu plant der Kompositionsplan Stars nur bei hoher Prämien-Neigung (`STAR_APPETITE_THRESHOLD 0,95`,
Superstar nur mit Liga-Lizenz für 2–3 Teams): **25 von 32 Teams planen 0 Stars**, M-M/R-L/Z-H je einen Superstar.

### 2.5 Spiegelt sich die Identität? (Spearman, Saat 1 Block, n = 32)

| Merkmal | Kader | Stars | Top-1-Anteil | MW max | Kasse | Stärke |
|---|---:|---:|---:|---:|---:|---:|
| Opt (Blatt + GM) | **0,80** | −0,49 | −0,48 | −0,52 | 0,20 | −0,49 |
| Elite-Neigung (GM) | **−0,80** | 0,48 | **0,73** | 0,69 | −0,45 | 0,49 |
| Tiefen-Neigung (GM) | **0,73** | −0,50 | −0,58 | −0,58 | 0,33 | −0,47 |
| Star-Priorität (GM) | −0,35 | 0,56 | **0,76** | 0,63 | −0,83 | 0,37 |
| Finanzwert | 0,13 | −0,46 | −0,49 | −0,44 | **0,87** | −0,23 |
| Startkasse | −0,26 | 0,54 | 0,06 | 0,67 | 0,30 | **0,95** |

Nach Archetyp (Block, Saat 1): star_chaser Kader 9,6 / Stars 1,0, risk_gambler 10,2 / 0,8, depth_spammer 12,7 / 0, culture_keeper 12,3 / 0,
bargain_hunter 11,0 / 0. **Die Richtung stimmt überall** (Startrang ↔ Zugriff ≈ 0, #1628). Was fehlt: echte **Star-Teams** (2–3 Stars)
und die **12–14er-Teams**, die ihr Ziel auch erreichen. Die Stärke folgt fast nur dem Geld (0,95).

---

## 3. Einzelschritt-Draft: funktioniert er mit dieser Logik?

**Ja.** Gemessen (Saat 1, ab derselben Anlage):

| | Block | Einzelschritt |
|---|---:|---:|
| Kader Ø / unter Opt | 10,8 / 29 | 10,7 / 30 |
| Stufen Superstar/Star/Core/Depth/Backup/Reserve | 3/6/46/146/89/55 | 3/6/46/147/90/51 |
| Kasse Median / über Rücklage | 19,0 / 2,1 | 17,5 / 1,9 |
| Stärke Ø | 46,8 | 46,7 |
| Ausstiege | — | `nichts_leistbar` 32 |
| Notkäufe / Nachrücker | — | **0 / 0** |

Wo es brechen **könnte** und warum es das nicht tut:

* **Neuplanen je Schritt** — der Greedy-Loop plant ohnehin nicht voraus; Rahmen (Rücklage, Komposition, Lizenz) entsteht einmal zu
  Draft-Beginn und wird je Pick nachgespielt (`bewerteKiPick`). Kein Unterschied zur Schleife außer dem Pool.
* **Pool leert sich** — nach dem Draft liegen noch ≈ 2590 Spieler frei; es fehlt nie ein Kandidat, nur Geld.
* **Top-N** — nur Nachrück-Reihenfolge nach einem gescheiterten Kauf, keine Pool-Grenze; in der Messung nie ausgelöst.
* **Aufgeben** — `nichts_leistbar` heißt heute „Geld an der Rücklage", nicht „nichts da". Mit dem Kaderplan landen alle am Opt (Abschnitt 5).

Mit Menschen im Draft gilt: Auto-Pick für einen Abwesenden ist **bereits** `bewerteKiPick` — die volle KI des Teams (eigene Identität,
eigener GM). Ein Notweg ist dafür nicht nötig.

---

## 4. Alle Notwege — Empfehlung je Stelle

| # | Stelle | Was passiert | Greift heute? | Empfehlung |
|---|---|---|---|---|
| 1 | `lib/ai/ai-picks-run-service.ts` `runSeason1ExecuteEmergencyMinFill` (Z. 2733, Aufrufe 4142, 4492) | Füllt im Legacy-S1-Execute bis zum Minimum | **nein** — nur bei `OLY_ORGANIC_SQUAD_BUILDER=0`; der organische Zweig endet vorher mit `continue` (Z. 3968) | **entfernen** zusammen mit dem Legacy-Execute-Pfad (eigener Aufräum-PR) |
| 2 | Cockpit „Kader-Fill" → `app/api/ai/roster-fill/route.ts` → `lib/ai/auto-roster-fill-service.ts` | Alter Füll-Lauf, Bewertung **ohne Qualitätsterm** (Z. 10ff., `scoreRosterFillCandidate`), ab S2 gesperrt, füllt in S1 auch Menschen-Teams | nur per Knopf | **ersetzen**: Knopf ruft den organischen Planer mit Kaderplan für KI- und delegierte Teams, nie für selbst pickende Menschen; Test `tests/auto-roster-fill-service.test.ts` (erwartet Menschen-Füllung) anpassen |
| 3 | `lib/draft/liga-draft-dienst.ts` `notkauf_mindestkader` (#1619) | Nach Fehlkäufen unter 8 der billigste bezahlbare Spieler | in KI-Liga 0× gemessen | **ersetzt (Prototyp)**: weiter in der Rangliste der KI über den ganzen Pool, nie nach Preis |
| 4 | `lib/ai/organic-squad/draft-builder.ts` Auffangnetz (#1618) | Unter 8 mit Töpfen: billigster bezahlbarer Spieler, darf den Topf überziehen | selten (Topf zu) | **ersetzt (Prototyp)**: bestbewerteter bezahlbarer Spieler, Topf-Schranke gelockert, Kasse hart |
| 5 | `lib/ai/ai-market-plan-apply-service.ts` `pflichtkader_auffangnetz` (#1618, Z. 802) | S2-Marktplan: billigste übrige Kandidaten bis 8 | ja, in S2 | **entfällt** mit Stelle 6 (S2 auf organisch); bis dahin übergangsweise nach Gate-Rangfolge statt Preis |
| 6 | S2-Marktplan Kurzliste `recommendedBuys = max(3, Lücke bis Minimum + 2)` (`ai-transfermarkt-preview-service.ts:2093`) + `resolveAllowedMarketBuyCount` | Kauft höchstens die vorab geplanten Kandidaten; ist einer weg oder gesperrt, gibt es keinen Ersatz → Stopp bei 8–9 mit Geld | **ja** — #1628: 21/32 Teams fertig, Kader 7 → 9 bei Opt 12, 6 unter 8, Trockenlauf danach plant 36 weitere Käufe | **ersetzen**: S2-Kauf über den organischen Schritt mit Kaderplan (derselbe wie im Draft) |
| 7 | Delegierte Menschen (`draft: "ki"`) ab S2: `ai-preseason-background-service.ts:106-117` (`getAiTeamIds` nur `controlMode "ai"`), `ai-transfer-window-session-service.ts:672ff.` (`manualTeamIds` gefiltert) | Bekommen ab S2 **gar keine** Käufe | ja | **Lücke schließen**: Bereich „Transfers" delegiert ⇒ Team läuft durch dieselbe KI (eigene Identität), Schutz für selbst pickende Menschen bleibt |
| 8 | Builder-Rückfälle unter 8 ohne Töpfe (Floor 0, dann ohne Mindest-Reserve) | Lockern die Kassen-Schranke, **Wahl bleibt die Bewertung** | in S1 0× | **behalten** — das ist Schranke lockern, nicht Logik wechseln; mit Kaderplan praktisch unerreichbar |

Leitsatz für alle Stellen: **Schranken dürfen sich stufenweise lockern, die Wahl ist immer die Bewertung über den ganzen Pool.**
Kein Pfad sortiert je nach Preis.

---

## 5. Vorschlag: „Kaderplan" — eine KI für Draft, S1, S2 und Auto-Pick

### 5.1 Regeln (aus Chris' Vorgaben)

1. **Ein Kaufschritt.** Draft (Block wie Einzelschritt), S2-Kauffenster, Auto-Pick eines Abwesenden und delegierte Teams laufen durch
   `organicBuyStep` — gleiche Bewertung, gleicher Pool (alle freien Spieler).
2. **Plan gegen den echten Rahmen.** Die Plätze bis Opt werden vom ersten Kauf an gegen **Kasse − Rücklage und `kaufRahmen`
   (Transfertopf)** reserviert, nicht nur bis 8. Ein Kauf ist nur erlaubt, wenn danach die restlichen geplanten Plätze zum **Platzpreis**
   (billigste Spieler ab 12 = Backup-Stufe, keine Füller) bezahlbar bleiben.
3. **Ein Platz hat viele Kandidaten.** Passt der Wunschspieler nicht, nimmt der Schritt den bestbewerteten, der in den Plan passt — der
   Platz fällt nicht weg. Füller unter 12 nur, wenn das Budget den Plan zu 12 je Platz nicht trägt.
4. **Weniger als Opt nur bewusst.** Unter Opt gewinnt „aufhören" nicht nebenbei. Ein kleinerer Kader ist eine Identitäts-Entscheidung,
   die im Opt selbst steckt (Blatt + GM-Elite/Tiefe) bzw. in Stufe 2 explizit protokolliert wird („einen weniger, dafür stärker": Ambition,
   Verletzungsrisiko, Vorstandsziel Kadergröße).
5. **Kein Notweg.** Siehe Abschnitt 4.

### 5.2 Prototyp und Messung vorher/nachher

Gebaut hinter `OLY_KI_KADERPLAN=1` (Standard aus, Live unverändert): `lib/ai/organic-squad/draft-builder.ts` (Platz-Reserve bis Opt
gegen Kasse **und** Transfertopf, Füller-Sperre mit Rückfall, kein Stopp unter Opt, Auffangnetz nach Bewertung),
`lib/draft/liga-draft-dienst.ts` (Nachrücken über die ganze Rangliste, keine Billig-Liste). Test: `tests/ki-kaderplan-prototyp.test.ts`.

| Lauf | Kader Ø (min–max) | unter Opt | leere Plätze | Stars (0/1/≥2) | Kasse Median (% Start) | über Rücklage Median (max) | Stärke Ø |
|---|---|---:|---:|---|---|---|---:|
| vorher Block, Saat 1 | 10,8 (8–13) | 29 | 48 | 26/3/3 | 19,0 (8 %) | 2,1 (5,8) | 46,8 |
| **Kaderplan Block, Saat 1** | **12,3 (10–14)** | **0** | **0** | 26/3/3 | 16,2 (7 %) | **0 (0,2)** | 45,8 |
| vorher Einzelschritt, Saat 1 | 10,7 (9–13) | 30 | 50 | 26/3/3 | 17,5 (8 %) | 1,9 (6,6) | 46,7 |
| **Kaderplan Einzelschritt, Saat 1** | **12,3 (10–14)** | **0** | **0** | 26/3/3 | 16,4 (7 %) | 0,5 (6,5) | 45,8 |
| vorher Block, Saat 2 | 10,8 (8–14) | 28 | 49 | 26/3/3 | 18,2 (8 %) | 1,4 (5,7) | 46,8 |
| **Kaderplan Block, Saat 2** | **12,3 (9–14)** | **0** | **0** | 26/4/2 | 16,2 (7 %) | 0 (2,4) | 45,7 |

Kadergrößen: vorher 8er 1, 9er 8, 10er 3, 11er 9, 12er 7, 13er 4 — **nachher 10er 3, 11er 6, 12er 10, 13er 5, 14er 8** (Saat 2: 14er 10).
C-C, D-L, M-S, N-W, T-C, T-T, U-A, L-K kommen bei 14 an; B-P (10), P-S (10), R-L (10) bleiben kompakt. Plan gegen Ist: **0 leere Plätze**
in allen drei Läufen. Spearman Opt ↔ Kader 0,76 (Block) bzw. **1,00** (Einzelschritt), Elite-Neigung ↔ Top-1-Anteil 0,92.

Stufen (Saat 1): Block vorher Depth 146 / Backup 89 / Reserve 55 → nachher Depth 76 / Backup 265 / **Reserve 1**; Einzelschritt
nachher Depth 95 / Backup 193 / Reserve 54. Abbruchgründe nachher: `nothing_affordable` 22–24 (am Opt, Geld an der Rücklage),
`roster_full` 8–10, **stop 0, Notkäufe 0**.

**Preis dafür, ehrlich:** dieselbe Geldmenge auf mehr Köpfe. Top-6-Stärke −1,0 Punkte (−2,2 %), Depth-Spieler werden zu Backup-Spielern.
Das ist genau Chris' Abwägung „einen weniger, dafür stärker — oder füllen, um vor Verletzungen geschützt zu sein": heute entscheidet sie
das leere Konto, mit Kaderplan das Opt der Identität. Die Arena-Wertung ist nicht berührt (Fingerabdruck `ce8fcef66028`); ob die breiteren
Kader in der Saison (Ermüdung, Verletzungen, Einsatz in 20 Disziplinen) die Top-6-Differenz zurückholen, misst erst ein Saisonlauf.

Offen im Prototyp: im Einzelschritt bleiben 54 Spieler unter 12 (Block: 1). Im Einzelschritt nehmen sich 32 Teams gleichzeitig die
billigen 12–15er weg, der Platzpreis steigt, die Füller-Sperre fällt öfter auf den Rückfall. Lösung in Stufe 1: Platzpreis aus dem
Startpool des Drafts fest machen statt aus dem Restpool.

### 5.3 Stufe 2: Star-Teams möglich machen (Entwurf, nicht gebaut)

Heute planen 25 von 32 Teams keinen Star, und die Preis-Strafe verhindert jeden 80+-Spieler. Vorschlag:

* **Star-Budget aus der Identität:** Star-Neigung `= f(Star-Priorität, Elite-Neigung, Ambition)` bestimmt, wie viele Plätze des Plans
  als Star-Plätze gelten (0 bis 3) und wie viel Budget sie bekommen; der Rest wird zum Platzpreis gerechnet. Ein star_chaser mit 295
  und Opt 10 plant z. B. 2 × 70 + 8 × 19.
* **Preis-Term gegen den Plan statt gegen den Durchschnitt:** „Preis in Plätzen" eines Star-Kandidaten gegen das Star-Budget messen, nicht
  gegen Kasse / offene Plätze. Dann ist ein 90er für ein Star-Team ein normaler Kauf und für ein Tiefen-Team weiter zu teuer.
* **Kompakt bewusst:** Star-Teams dürfen Opt um 1–2 senken (protokolliert), Tiefen-Teams nie.
* Messung: Stars je Archetyp, Top-20-Spieler gekauft (heute 0), Kadergrößen-Spreizung, Stärke je Archetyp. Vorher Mockup/Erklärung
  für Chris (größeres Konzept).

---

## 6. Rücklage ab Saison 2 und Notrücklage (Entwurf + Rechnung)

Chris (18.11.): mehr Spreizung, Persönlichkeit drin, nicht verkrüppeln; das gesperrte Geld ist eine **Notrücklage**, die der Vorstand
in der Not lieber freigibt, als Kredit aufzunehmen oder Spieler zu verkaufen.

**Formel (Vorschlag des PM, so gerechnet):** Sparneigung `s = Finanzwert − max(0, Ambition − 5)`, 1..10; `q = 10 % + 65 % × (s − 1) / 9`
(10–75 %); **Ziel = q × Gehalt**; im Kauffenster gesperrt nur `max(0, Ziel − erwarteter Überschuss bis Saisonende)`, der Rest wird über
die Saison angespart.

Rechnung (`scripts/rechne-ruecklage-s2-vorschlag-18-11.ts`, Saat 1; Gehalt = Kader nach dem S1-Draft, Überschuss = Sponsor-Erwartung
(Anker × 0,92) − Gehalt, ohne Tickets/Merch/Fixkosten, nur Größenordnung). Auszug, volle Tabelle `data/generated/ki-pick-analyse-18-11/ruecklage-s2-rechnung.md`:

| Team | Fin | Amb | s | q #1618 → neu | Rücklage #1618 → Ziel neu | Überschuss | im Fenster gesperrt |
|---|---:|---:|---:|---|---|---:|---:|
| Z-H | 2 | 10 | 1 | 7 % → 10 % | 5,7 → 7,9 | 6,9 | 1,1 |
| M-M | 5,1 | 8,6 | 1,5 | 14 % → 14 % | 11,5 → 11,0 | 17,3 | 0 |
| A-A | 1,2 | 8,9 | 1 | 6 % → 10 % | 2,4 → 4,3 | 7,7 | 0 |
| C-S | 8,3 | 7 | 6,3 | 21 % → 48 % | 15,4 → 35,1 | 21,7 | 13,4 |
| C-C | 9,7 | 2,8 | 9,7 | 24 % → 73 % | 13,1 → 39,3 | 7,4 | 31,9 |
| W-L | 10 | 5,3 | 9,7 | 25 % → 73 % | 17,3 → 50,3 | 6,0 | 44,3 |
| T-T | 8,9 | 4,8 | 8,9 | 22 % → 67 % | 14,2 → 42,2 | −13,3 | 42,2 |
| **Σ Liga** | | | | | **279 → 626** | | **411** |

Lesart: die Spreizung ist da (Ziel 4 bis 50, aggressive Teams 10–14 %, sparsame 67–73 %). Gesperrt im Fenster wären Σ 411 statt 279 —
**+132 C mehr gebunden**, fast nur bei den sparsamen Teams mit knapper Sponsor-Deckung (W-L 44, T-T 42, S-S 37, C-C 32). Zusammen mit dem
Kaderplan heißt das: diese Teams erreichen ihr Opt mit billigeren Plätzen, verkrüppeln aber nicht (Pflicht bis 8 bleibt nie gesperrt,
#1618). Ob „angespart" genug ist, misst erst ein Mehrsaisonlauf; der Überschuss hier ist eine Unterschätzung (Tickets, Merch, Prämien fehlen).

**Notrücklage — Reihenfolge in der Not** (für KI und Mensch dieselbe Regel, KI verhandelt nach Charakter):

1. Notlage erkannt (Kasse < 0, Gehälter nicht gedeckt, Kader < 8 oder deutlich unter Opt nach Verletzungen) → **zuerst Notrücklage
   freigeben** (bestehende Lockerung „Rücklage anzapfen" in `lib/finance/vorstand-budgetfreigabe.ts`, in #1618 0× genutzt, weil die
   KI-Bedingungen zu eng sind — Bedingung auf genau diese Notlagen umstellen);
2. **dann** Kredit (`resolveAiLoanDecision`, Notkredit `applyInsolvencyBackstop`);
3. Verkauf nur als letztes Mittel; **kein Verkauf am Saisonende, nur um die Rücklage zu füllen** (`sellUtility` liest heute
   `cashHealth = Kasse / Puffer` — der Puffer darf dort nicht das volle Rücklage-Ziel sein, sonst erzeugt die Rücklage Verkaufsdruck).

Zählung in der Messung (Stufe 3 unten): Freigaben der Notrücklage, Kredite, Notkredite, Notverkäufe je Team und Saison; Ziel: Kredit
oder Notverkauf nur bei ausgeschöpfter Notrücklage. **Nicht gemessen in diesem PR** (braucht S1 komplett + Saisonende + S2-Fenster, je
Variante ≈ 55 min, #1628).

**Zeitpunkt — neu entschieden (Chris, 18.11. abends):** es gibt **ein** gemeinsames Transferfenster vor Spieltag 1 der neuen Saison,
Kauf und Verkauf gleichzeitig offen, Verkaufserlöse sofort zu 100 % frei; der S1-Draft zählt nicht als Transfer, das Fenster vor Saison N
zählt zu Saison N. Phasenpolitik, Session-Reihenfolge (Verkauf → Kauf → Nachrunde → Kassensturz) und Transferbilanz baut ein eigener Agent;
**die Session-Datei fasst dieser PR nicht an.** Für den Planer heißt das:

* **Rahmen nach jedem Verkauf neu lesen.** Der Kaufschritt liest die Kasse ohnehin je Schritt; der Planrahmen (`buildOrganicDraftFrame`:
  Rücklage, `kaufRahmen`, Komposition, Opt-Plätze) muss **nach** den Verkäufen des Fensters gebaut werden (bzw. nach jedem Verkauf neu), damit
  Erlöse den Transfertopf sofort erhöhen. Das ist eine Aufruf-Reihenfolge, keine Planer-Änderung.
* **Abbau-Verkäufe im Fenster** (statt am Saisonende): Verkauf und Kauf sehen dann denselben Kaderplan — ein Team verkauft nur, was sein
  Plan bis Opt nicht braucht bzw. womit es einen Platz aufwerten kann. Ein Verkauf, der **nur** wegen der Rücklage nötig wäre, darf es
  nicht geben: `sellUtility` liest `cashHealth = Kasse / Puffer`; der Puffer dort darf nicht das volle Rücklage-Ziel sein (Notrücklage
  ist Schutz, kein Verkaufsdruck).

---

## 7. Entscheidung und Bauplan

**Draft: JA.** Der Einzelschritt-Draft ist mit der KI-Logik gleichwertig (gleiche Kader, gleiche Kasse, 0 Notkäufe) und hat mit dem
Kaderplan dieselbe Verteilung wie der Blocklauf. Der „beschränkte Draft-Modus" beschränkt den Pool nicht. Der Grund, den Weg zu lassen,
wäre ein Logikproblem — das liegt aber im Kaufschritt selbst (Plätze bis Opt, Stars) und im S2-Marktplan, nicht im Draft.

| Stufe | Inhalt | Prüfung |
|---|---|---|
| 1 | Kaderplan an (Schalter auf Standard), Platzpreis aus dem Startpool, Protokoll „bewusst unter Opt" | Messlauf wie hier, 2 Saaten: 0 unter Opt, 0 Notkäufe, Füller < 12 ≤ 5 je Liga, Stärke ≥ −3 % |
| 2 | Notwege 3/4/5 raus (#1618/#1619 übernehmen den Prototyp), Legacy-Emergency-Fill (1) löschen, Kader-Fill-Knopf (2) auf organisch | Tests der Notwege umschreiben; `tests/auto-roster-fill-service.test.ts` |
| 3 | Kauf im gemeinsamen Fenster über den organischen Schritt mit Kaderplan (statt `applyAiMarketPlanLocally`; die Session-Reihenfolge baut der Fenster-Agent, dieser Teil liefert den Kaufschritt und `kaufRahmen` nach Verkäufen), delegierte Teams (7) einbeziehen, Rücklage S2 nach Sparneigung, angespart, Notrücklage-Reihenfolge | Mehrsaisonlauf S1→S2 (`scripts/miss-teamfinanzen-saison.ts`): kein Team < 8, Kader nahe Opt, Kasse nach Fenster im Rücklage-Band, Spreizung nach Identität, jedes Team kauft, Zählung Notrücklage/Kredit/Notverkauf |
| 4 | Star-Teams (5.3): Mockup + Erklärung an Chris, dann bauen | Stars je Archetyp, Top-20 gekauft > 0, Stärke je Archetyp |

Opus-Review der Kaufschritt-Änderung vor Stufe 1 (Wertungsnähe: ändert Kader, nicht die Arena).

## 8. Grenzen

* Zwei Saaten derselben Spielerdaten (nur die Saat der KI unterscheidet sich); Budgets und Pool sind je Anlage gleich.
* „Stärke" = Top-6-Eignung je Disziplin; sie belohnt Breite nicht. Kein Saisonlauf mit dem Prototyp.
* S2-Aussagen zu Stelle 6 aus Code + Messung #1618/#1628, nicht neu gemessen; Rücklage S2 nur gerechnet.
* Die Merge-Auflösung #1618 × #1619 im Kaufschritt ist hier gemacht, aber nicht von den Autoren beider PRs geprüft.

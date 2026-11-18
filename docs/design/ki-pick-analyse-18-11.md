# KI-Pick-Analyse + Vorschlag „Kaderplan" — Draft ja oder nein? (18.11.2026)

Auftrag (Chris, wörtlich): „wenn ein spieler nicht selber pickt soll SINNVOLL gepickt werden als wäre das team richtig AI gesteuert,
das soll nicht über so einen NOTFALL weg fahren! niemals — und es gibt immer jemanden der affordable ist, deswegen wollte ich das nicht
mit dem beschränkten draft mode sondern man soll aus ALLEN knapp 3k spielern picken können! … versuch mal bitte zu verstehen wie die AI
aktuell pickt und ob das mit dem draft mode funktionieren kann … und die team identitäten widerspiegelt und man nicht nur minimum picks
hat mit einem star drin". Im Lauf des Abends dazu: „wenn C-C 14 picks plant, sollte es am Ende nicht 8 haben", „der Planner soll mit
dem adjusted Budget rechnen und trotzdem die Slots füllen", „keine Notkäufe im Modell, gar keine — der Plan muss von Anfang an so stehen",
„Top-20 nicht kaufen ist richtig", „Stars relativ sehen", „der GM kann aus Opt 13 z. B. 12 oder 11 machen", Rücklage-Vorgaben
(Spreizung nach Persönlichkeit, „Notrücklage, kein greedy Vorstand") und das gemeinsame Transferfenster.

**PM-Entscheidung (18.11.):** Draft bleibt, Kaderplan wird nach unabhängigem Review Standard. Dieser PR liefert Analyse, Kaderplan
und Messung; S2-Kauf und Star-Teams Stufe 2 sind **nicht** Teil davon (Abschnitt 7). **Stand nach dem Opus-Review (Abschnitt 9):** der
Kaderplan ist im **Saison-1-Setup-Draft Standard AN** (`OLY_KI_KADERPLAN=0` schaltet ab) und ab Saison 2 aus; die Abschnitte 1–8
beschreiben den Prototyp-Stand davor (`OLY_KI_KADERPLAN=1`). Die alten Läufe r7/r8 tragen im `env`-Feld fälschlich
`OLY_LIGA_DRAFT_MODUS=einzelschritt`, es lief der Block (Abschnitt 9.2).

**Basis des Branches:** `claude/finanzen-v2-seite-18-11` (#1618, inzwischen mit `main` samt #1619) plus #1628 (Messung S1 ohne Draft,
Konflikt im Messskript gelöst: `--variante A|C|C2`, `--mischen` und `--draft block|einzelschritt` funktionieren zusammen). Die #1618-
Änderungen am Kaufschritt sind in `organicBuyStep` (#1619) übertragen. Baut auf `docs/design/messung-s1-ohne-draft-18-11.md` (#1628) auf.

Werkzeuge (nur `scripts/`): `scripts/miss-ki-pick-analyse-18-11.ts` (Messlauf), `scripts/auswerte-ki-pick-analyse-18-11.mjs` (Tabellen),
`scripts/sonde-ki-topstars-18-11.ts` (Top-Spieler), `scripts/rechne-ruecklage-s2-vorschlag-18-11.ts` (Rücklage S2, Rechnung). Rohdaten und
volle Auswertung (je Team): `data/generated/ki-pick-analyse-18-11/`. Alles auf Wegwerf-SQLite (gelöscht), `data/online-saves` unberührt,
kein Dev-Server. Arena-Fingerabdruck **`d3a39030a3ef`** (75 Einträge) = aktueller Stand in CLAUDE.md (die Kaufschritt-Änderung berührt die Arena nicht).

Messaufbau: neues Spiel (Battle, `solo_1`, Liga-Split 2×16), **32 KI-Teams mit Sponsor**, **zwei Saaten** (zwei Anlagen
`new-game-1795033498271-kba61o`, `new-game-1795033515552-p067ow`), je Saat Blocklauf und Einzelschritt, vorher und mit Kaderplan, paarweise
ab derselben SQLite-Kopie. Das Messskript rechnet je Team zusätzlich den **Solo-Plan** (Team darf als Erstes aus dem vollen Pool) und eine
**Block-Simulation** im Speicher mit Abbruchgrund; sie trifft den echten Blocklauf zu **99,7 %** (1448 von 1452 Spielern).

---

## 0. Kurzfassung

1. **Pool: es gibt immer jemanden, der bezahlbar ist — und die KI sieht schon heute alle.** 2984 Spieler, **2983 frei und kaufbar**, alle
   für das ärmste Team (170) bezahlbar; billigster 2,6, die acht billigsten zusammen 29,9. Blocklauf und Einzelschritt bewerten bei
   **jedem** Kauf alle 2983. Die „Top 3 → 20 → 200" des Einzelschritts sind nur die Nachrück-Reihenfolge nach einem gescheiterten Kauf.
2. **Wie die KI heute endet (S1):** flach und **1 bis 4 Spieler unter dem eigenen Kaderziel**: 27–32 von 32 Teams unter Opt (44–51 leere
   Plätze), Kader 8–14 (Ø 10,7–10,8). Geld bis auf die Rücklage ausgegeben (1–1,7 darüber). Grund: Geld wird nur für die Plätze bis **8**
   reserviert, nicht bis Opt; frühere Käufe verbrauchen das Budget der späteren Plätze (`nothing_affordable` bei 29–31 Teams). Kein
   Kandidat „fehlt".
3. **Stars, relativ gesehen (neu):** Star = Marktwert ≥ 45 bzw. Ablöse ≥ 15 % des eigenen Startbudgets; Superstar ≥ 60 bzw. ≥ 25 %.
   Heute haben **13–16 Teams einen Star nach Budget** (Σ 15–20), 8 nach Markt; die Superstars (≥ 60) haben die drei Teams mit Liga-Lizenz.
   Star-Chaser liegen beim teuersten Spieler bei 20 % ihres Budgets, Schnäppchenjäger bei 12 %. Top-20-Spieler (81–113) kauft niemand —
   **richtig so** (Chris).
4. **Identität zeigt sich** (Opt ↔ Kader 0,80, Elite-Neigung ↔ Kader −0,76, Star-Priorität ↔ Anteil des Teuersten 0,76), aber die
   12–14er-Teams kommen nicht an (C-C plant 14, kauft 11) und die Kompakt-Teams sind kompakt, weil das Geld aus war, nicht aus Absicht.
5. **Einzelschritt-Draft funktioniert mit dieser Logik**: vorher wie nachher dieselben Kadergrößen, Stärken und Kassen wie der Blocklauf,
   **0 Notkäufe, 0 Nachrücker**. **Entscheidung: Draft JA.**
6. **Prototyp Kaderplan** (beide Saaten, Block und Einzelschritt): **0 Teams unter Opt** (vorher 27–32), Kader 9–14 mit **9 Teams bei 14**,
   **kein Rückfall/Notweg gegriffen** (gezählt: 0), Kasse genau an der Rücklage (0–0,7 darüber), Block und Einzelschritt **gleich**
   (Kadergrößen-Histogramm identisch, Stärke 45,9–46,0 gegen 45,6–45,7, Füller unter 12: 1 gegen 10–11). Star-Chaser planen bewusst
   kompakt (Opt 11 → 9,4) und haben dafür 1,6 Stars (Markt) bzw. 1,8 (Budget). Preis: Top-6-Stärke −0,9 Punkte (−1,9 %).
7. **Saison 2 ist die eigentliche Baustelle** (Stopp bei 8–9 mit Geld): dort kauft **eine zweite KI** (Marktplan mit Kurzliste). Vorschlag:
   ein Kaufweg (der Kaufschritt mit Kaderplan) im gemeinsamen Fenster; Rücklage S2 nach Sparneigung, angespart, als Notrücklage.
   **Nicht in diesem PR** (Session-Datei gehört dem Transferfenster-Agenten).

---

## 1. Wie die KI heute pickt

### 1.1 Wer kauft wann (zwei verschiedene KIs)

| Zeitpunkt | Aufrufer | Entscheider | Kandidaten |
|---|---|---|---|
| S1-Draft, Blocklauf (live) | `kickoffLeagueSetupDraft` → `fuehreLigaSetupDraftAus` → `runAiPicksExecutePreview` → `runOrganicTeamDraftExecute` (`lib/ai/ai-picks-run-service.ts`) | organischer Planer `planOrganicDraftForTeam` (`lib/ai/organic-squad/draft-adapter.ts`), ganzer Kader am Stück je Team | alle freien Spieler (`fullPool: true`), 2983 |
| S1-Draft, Einzelschritt (#1619, `OLY_LIGA_DRAFT_MODUS=einzelschritt`) | `laufeKiZuege` → `bewerteKiPick` (`lib/draft/liga-draft-ki.ts`) | **derselbe** Schritt `organicBuyStep`, ein Pick je Zug | alle freien Spieler, 2983 |
| S2+-Kauffenster (live) | `fuehreKiPreseasonLaufAus` → `applyAiMarketPlanLocally` (`lib/ai/ai-preseason-background-service.ts`) | **Marktplan** (`buildAiMarketPlanPreview`) — nicht der organische Planer | **Kurzliste** `recommendedBuys = max(3, Lücke bis Minimum + 2)` (`ai-transfermarkt-preview-service.ts`) |
| S2+ organisch (gebaut, im Spiel nicht im Kauffenster) | `runTransferWindowSession` → `runOrganicBuyCycle` | organischer Planer | alle freien |

Reihenfolge im Blocklauf: `orderTeamsForDraft` — höchster Startrang (schwächstes Team) zuerst, jedes Team plant seinen ganzen Kader
gegen den Restpool. Einzelschritt: Runde für Runde, schwächstes Team zuerst.

### 1.2 Der Kaufschritt (organisch, heute)

Je Schritt (`organicBuyStep`, `lib/ai/organic-squad/draft-builder.ts`):

1. **Bezahlbar**, wenn `Kasse − Preis − Reserve fürs Minimum ≥ Untergrenze`. Untergrenze: unter 8 die Rücklage (S1 halbiert; fällt auf 0,
   wenn das Minimum sonst nicht erreichbar ist), zwischen 8 und Opt die Rücklage, ab Opt der volle Puffer. Reserve fürs Minimum = Summe
   der billigsten Preise **bis 8**. Mit #1618 zusätzlich Transfer- und Gehaltstopf (`kaufRahmen`).
2. **Bewertung** (`buyUtility`): `wWin × Stärkezuwachs` (Eignung, Abdeckung, Identitäts-Achsen) + Rotationswert unter Opt + Füllqualität
   + Themen-Passung + Kompositions-Zuschlag (Soll-Pyramide) + Potenzial − **`wThrift × Preis in Plätzen × 30`** − Gehaltslast + Saat-Jitter.
   „Preis in Plätzen" = (Ablöse + 2 × Gehalt) / (Kasse / offene Plätze bis Opt).
3. **Stopp**, wenn (ab 8) der Cash-Optionswert den besten Kauf schlägt, der Kader voll ist (14) oder nichts bezahlbar ist.

Gewichte aus Identität und GM (`weights.ts`); **Opt = Blatt-`playerOpt` (11–14), die GM-Tiefe schiebt nur nach oben**.

---

## 2. Messung heute (S1, 32 KI-Teams, zwei Saaten)

### 2.1 Pool

| im Spielstand | frei | kaufbar (MW > 0) | billigster | P10 | Median | P90 | teuerster | Σ 8 billigste | für das ärmste Team (170) bezahlbar |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2984 | 2983 | 2983 | 2,6 | 12,1 | 25,0 | 48,4 | 113,5 | 29,9 | **2983** |

Σ Kassen der Liga 7915 bei 32 × Opt ≈ 390 Plätzen: **im Schnitt 20 je Platz**. Wer einen Star will, zahlt ihn mit billigeren Plätzen
daneben — das ist die Stellschraube der Identität.

### 2.2 Verteilung nach dem Draft (vorher)

| Lauf | Kader Ø (min–max) | unter Opt | leere Plätze | Kasse Median (% Start) | über Rücklage Median | Stärke Ø |
|---|---|---:|---:|---|---:|---:|
| Block, Saat 1 | 10,7 (8–14) | 29 | 51 | 17,9 (8 %) | 1,7 | 46,9 |
| Einzelschritt, Saat 1 | 10,7 (9–13) | 32 | 51 | 18,1 (7 %) | 1,7 | 46,9 |
| Block, Saat 2 | 10,8 (8–14) | 27 | 44 | 18,4 (8 %) | 1,7 | 46,8 |
| Einzelschritt, Saat 2 | 10,8 (8–14) | 29 | 46 | 17,9 (8 %) | 1,0 | 46,8 |

Abbruchgrund (Block-Simulation): `nothing_affordable` 30–31, voll 1–2 — die Teams hören nicht freiwillig auf, das Geld ist an der
Rücklage aus. **In S1 hortet die KI nicht** (8 % des Startbudgets, wie #1628 und #1618).

### 2.3 Plan gegen Ist (Chris: „wenn C-C 14 picks plant …")

Block, Saat 1:

| Team | Archetyp | geplant (Opt) | gekauft | Lücke | Abbruch | Budget je geplantem Platz | Ø Preis je gekauftem Spieler | Kasse über Rücklage |
|---|---|---:|---:|---:|---|---:|---:|---:|
| R-C | rivalry_hawk | 13 | 9 | 4 | nothing_affordable | 15,4 | 21,9 | 3,2 |
| C-C | bargain_hunter | 14 | 11 | 3 | nothing_affordable | 13,5 | 17,2 | 0,0 |
| P-C | bargain_hunter | 13 | 10 | 3 | nothing_affordable | 13,6 | 17,3 | 3,6 |
| S-C | rivalry_hawk | 11 | 8 | 3 | nothing_affordable | 17,2 | 23,4 | 2,6 |
| T-C | depth_spammer | 14 | 11 | 3 | nothing_affordable | 13,6 | 17,1 | 2,4 |
| V-V | star_chaser | 11 | 8 | 3 | nothing_affordable | 20,4 | 27,5 | 3,6 |
| D-P | culture_keeper | 13 | 12 | 1 | nothing_affordable | 17,6 | 19,0 | 0,8 |

**Warum ein geplanter Platz leer bleibt:** nicht, weil der Wunschkandidat weg ist (der Schritt nimmt aus 2983 den nächstbesten), nicht
wegen Stop-Nutzen, nicht wegen der Vorstandssperre (S1 100 %), sondern weil **frühere Käufe das Budget der späteren Plätze verbraucht
haben**: im Schnitt teurer als Budget je Platz bei 29 von 32 Teams. Das Bild „C-C endet bei 8" stammt aus **Saison 2** (#1618: C-C, D-P bei
8–9 mit ≈ 30 frei) — dort ist der Grund die Kurzliste des Marktplans (Abschnitt 4, Stelle 6).

### 2.4 Stars, relativ (Chris 18.11.)

Chris: „Zu Beginn ist ein 60er-Spieler ein Superstar, ab 45 eigentlich ein Star." „Wenn … ein Spieler schon alleine 25 % vom Budget beim
Kauf kostet … dann ist das wohl ein Star oder sogar Superstar." „Ich erwarte nicht, dass Star-Chaser-GMs in einem Team wie Z-H einen Spieler
für > 80 Mio holen."

**Vorgeschlagene Schwellen (in Auswertung und Doku so verwendet):**

| Maß | Star | Superstar | Bedeutung |
|---|---|---|---|
| **Markt** (Startpool S1) | Marktwert ≥ 45 | ≥ 60 | absolut, was die Liga als Star sieht. Später relativ zum Pool der Saison: Star ab P87, Superstar ab P96 (im S1-Startpool genau 45 bzw. ≈ 60) |
| **Budget** (Identität) | Ablöse ≥ 15 % des eigenen Startbudgets | ≥ 25 % | was das Team sich leistet — „Star-Neigung = Bereitschaft, einen relativ teuren Spieler zu holen", nicht einen absoluten Top-Spieler |

Gehaltsanteil des Teuersten am Kadergehalt wird mitgemessen (er liegt praktisch gleichauf mit dem Ablöse-Anteil, 13–15 % im Median).

| Lauf | Teams mit Star (Markt) | Stars Σ / Superstars Σ (Markt) | Teams mit Star (Budget) | Stars Σ / Superstars Σ (Budget) | teuerster: Anteil Budget (Median) |
|---|---:|---|---:|---|---:|
| vorher Block, Saat 1 | 8 | 12 / 3 | 15 | 20 / 1 | 14,6 % |
| vorher Einzelschritt, Saat 1 | 7 | 11 / 3 | 16 | 20 / 1 | 15,1 % |
| vorher Block, Saat 2 | 8 | 12 / 3 | 13 | 15 / 0 | 14,1 % |
| vorher Einzelschritt, Saat 2 | 8 | 11 / 3 | 15 | 17 / 0 | 14,8 % |

Nach Archetyp (vorher, Block Saat 1): star_chaser 1,2 Stars (Markt) / 1,4 (Budget), teuerster 20 % des Budgets; risk_gambler 0,8 / 0,8,
18 %; elite_curator 1 / 2, 17 %; bargain_hunter, depth_spammer, talent_builder 0 / 0–0,3, 12–13 %. **Die Richtung stimmt**; die alte
Aussage „26 Teams ohne Star" galt für die absolute Stufe ≥ 45 und war zu streng.

**Top-20 (Marktwert 81–113):** niemand kauft sie (bester Rang eines Top-20-Spielers in der Bewertung über alle Teams: 11; ein 100er kostet
5–6 Platzbudgets, 125–180 Strafpunkte, `scripts/sonde-ki-topstars-18-11.ts`). Das ist nach Chris **richtig**: zu Beginn sind sie für ihre
Leistung viel zu teuer. Der Preis-Term bleibt.

### 2.5 Spiegelt sich die Identität? (Spearman, vorher, Block Saat 1, n = 32)

| Merkmal | Kader | Stars (≥ 45) | Anteil Teuerster | MW max | Kasse | Stärke |
|---|---:|---:|---:|---:|---:|---:|
| Opt (Blatt + GM) | **0,80** | −0,57 | −0,62 | −0,77 | 0,04 | −0,63 |
| Elite-Neigung (GM) | **−0,76** | 0,71 | **0,75** | 0,79 | −0,27 | 0,53 |
| Tiefen-Neigung (GM) | **0,72** | −0,68 | −0,64 | −0,74 | 0,20 | −0,51 |
| Star-Priorität (GM) | −0,38 | 0,65 | **0,76** | 0,70 | −0,77 | 0,37 |
| Finanzwert | 0,01 | −0,50 | −0,45 | −0,46 | **0,84** | −0,19 |
| Startkasse | −0,31 | 0,50 | 0,05 | 0,64 | 0,41 | **0,95** |

---

## 3. Einzelschritt-Draft: funktioniert er mit dieser Logik?

**Ja.** Vorher (Saat 1 / Saat 2) Block gegen Einzelschritt: Kader 10,7 / 10,7 und 10,8 / 10,8, Stärke 46,9 / 46,9 und 46,8 / 46,8,
Kasse an der Rücklage, **0 Notkäufe, 0 Nachrücker**. Mit Kaderplan genauso (Abschnitt 5.3). Wo es brechen **könnte**:

* **Neuplanen je Schritt** — der Greedy-Loop plant nicht voraus; Rahmen (Rücklage, Komposition, Lizenz, Opt) entsteht zu Draft-Beginn
  und wird je Pick nachgespielt. Kein Unterschied zur Schleife außer dem Pool.
* **Pool leert sich** — nach dem Draft liegen ≈ 2600 Spieler frei. Was sich ändert: die billigen 12er nehmen sich alle 32 Teams zugleich
  weg. Das hat der Kaderplan zunächst falsch eingeschätzt (50 Füller im Einzelschritt, 1 im Block); gelöst mit der Wettbewerbs-Reserve
  (Abschnitt 5.2).
* **Top-N** — nur Nachrück-Reihenfolge nach Fehlkauf, keine Pool-Grenze; nie ausgelöst.
* **Auto-Pick eines Abwesenden** ist schon heute `bewerteKiPick` — die volle KI des Teams (eigene Identität, eigener GM).

---

## 4. Alle Notwege — Empfehlung je Stelle

| # | Stelle | Was passiert | Greift heute? | Empfehlung |
|---|---|---|---|---|
| 1 | `lib/ai/ai-picks-run-service.ts` `runSeason1ExecuteEmergencyMinFill` | Füllt im Legacy-S1-Execute bis zum Minimum | **nein** — nur bei `OLY_ORGANIC_SQUAD_BUILDER=0` | **entfernen** mit dem Legacy-Pfad (Folge-PR) |
| 2 | Cockpit „Kader-Fill" → `app/api/ai/roster-fill/route.ts` → `lib/ai/auto-roster-fill-service.ts` | Alter Füll-Lauf **ohne Qualitätsterm**, ab S2 gesperrt, füllt in S1 auch Menschen-Teams | nur per Knopf | **ersetzen** durch den Kaufschritt mit Kaderplan für KI- und delegierte Teams (Folge-PR; Test `tests/auto-roster-fill-service.test.ts` anpassen) |
| 3 | `lib/draft/liga-draft-dienst.ts` `notkauf_mindestkader` (#1619) | Nach Fehlkäufen unter 8 der billigste bezahlbare Spieler | 0× gemessen | **in diesem PR ersetzt** (mit Schalter): weiter in der Rangliste der KI über den ganzen Pool, nie nach Preis |
| 4 | `lib/ai/organic-squad/draft-builder.ts` Auffangnetz (#1618) | Unter 8 mit Töpfen der billigste bezahlbare Spieler | selten | **in diesem PR ersetzt** (mit Schalter): Bestbewertung mit gelockertem Topf, laut protokolliert (`notweg: topf_ueberzogen`), gemessen 0× |
| 5 | `lib/ai/ai-market-plan-apply-service.ts` `pflichtkader_auffangnetz` (#1618) | S2-Marktplan: übrige Kandidaten bis 8 (seit dem neuen #1618-Stand nur, wenn sie allein am Rahmen scheiterten) | in S2 | **entfällt** mit Stelle 6 (Folge-PR) |
| 6 | S2-Marktplan Kurzliste `max(3, Lücke bis Minimum + 2)` + `resolveAllowedMarketBuyCount` | Kauft höchstens die vorab geplanten Kandidaten, ohne Ersatz → Stopp bei 8–9 mit Geld | **ja** — #1628: 21/32 Teams fertig, Kader 7 → 9 bei Opt 12, 6 unter 8 | **ersetzen**: S2-Kauf über den Kaufschritt mit Kaderplan (Folge-PR mit dem Transferfenster-Agenten) |
| 7 | Delegierte Menschen (`draft: "ki"`) ab S2: `getAiTeamIds` nur `controlMode "ai"`; `manualTeamIds` in der Kaufsitzung gefiltert | Bekommen ab S2 **keine** Käufe | ja | **Lücke schließen** (Folge-PR): delegierter Transfer-Bereich ⇒ dieselbe KI, Schutz selbst pickender Menschen bleibt |
| 8 | Builder-Rückfälle unter 8 ohne Töpfe (Rücklage angetastet, ohne Mindestreserve) | Lockern die Kassen-Schranke, Wahl bleibt die Bewertung | 0× | **bleiben als Fehlerfall**: mit Kaderplan laut protokolliert (`notweg`), gemessen 0× |

Leitsatz: **Der Plan reserviert von Anfang an genug für Opt; Schranken lockern sich nie still, und die Wahl ist immer die Bewertung über den
ganzen Pool.** Kein Pfad sortiert nach Preis.

---

## 5. Vorschlag „Kaderplan" — eine KI für Draft, S1, S2 und Auto-Pick

### 5.1 Regeln (aus Chris' Vorgaben)

1. **Ein Kaufschritt.** Draft (Block wie Einzelschritt), Kauffenster, Auto-Pick und delegierte Teams laufen durch `organicBuyStep` —
   gleiche Bewertung, gleicher Pool (alle freien Spieler).
2. **Opt ist das Ziel, nicht das Minimum.** Vom ersten Kauf an reserviert der Plan Geld für **alle** Plätze bis Opt, gegen Kasse − Rücklage
   **und** den Transfertopf (`kaufRahmen`): so viele Plätze wie möglich zum **Platzpreis** (billigste Spieler ab 12 = Backup-Stufe, keine
   Füller), den Rest zu den billigsten Preisen im Pool (`kaderplanRahmen`). Ein Kauf ist nur erlaubt, wenn danach der Rest des Plans
   bezahlbar bleibt.
3. **Ein Platz hat viele Kandidaten.** Passt der Wunschspieler nicht, nimmt der Schritt den bestbewerteten, der in den Plan passt.
4. **Füller nur nach Plan.** Unter Opt sind zuerst nur Spieler ab Platzpreis wählbar. Einen günstigeren gibt es nur, wenn der Plan
   selbst günstige Plätze vorsieht (Rahmen trägt nicht alle zum Platzpreis — „Tiefe vor Qualität", protokolliert).
5. **Weniger als Opt nur bewusst** (Abschnitt 5.4): die GM-Senkung des Opt ist die einzige Quelle; unter Opt gewinnt „aufhören" nicht.
6. **Kein Notweg.** Alle Rückfälle sind laut protokolliert und gezählt; Soll ist 0.

### 5.2 Platzpreis: Startpool, Restpool, Wettbewerb (Messweg)

Der Auftrag „Platzpreis aus dem Startpool festlegen" ist umgesetzt (Messschalter `OLY_KI_KADERPLAN_STARTPOOL=1`) und gemessen:

| Variante | Block: Füller < 12 | Einzelschritt: Füller < 12 | Bewertung |
|---|---:|---:|---|
| Restpool, Füller-Sperre nur bei vollem Rahmen (erster Prototyp) | 1 | 54 | Einzelschritt ≠ Block |
| **Startpool** (Auftrag) | 65 | 66 | gleich, aber beide schlecht: die Reserve rechnet mit 12er-Preisen, die andere Teams längst gekauft haben; die letzten Plätze passen dann nur noch mit Füllern |
| Restpool + Füller-Sperre immer + günstige Reserve für nicht getragene Plätze | 1 | 50 | Block gut, Einzelschritt nicht |
| **Restpool + Wettbewerbs-Reserve im Einzelschritt (Standard)** | **1** | **10–11** | gleich genug |

Wettbewerbs-Reserve: im Einzelschritt picken T Teams reihum; der i-te eigene Platz kommt erst nach i × T fremden Picks dran. Die Reserve
rechnet deshalb mit jedem T-ten Preis ab Platzpreis (T = Teams, die noch aktiv picken), im Blocklauf mit T = 1. Startpool bleibt als
Messschalter im Code, Standard ist der Restpool.

### 5.3 Messung vorher / Kaderplan (Endstand, beide Saaten)

| Lauf | Kader Ø (min–max) | unter Opt | leere Plätze | Füller < 12 | Kasse Median (% Start) | über Rücklage Median (max) | Stärke Ø | Notwege |
|---|---|---:|---:|---:|---|---|---:|---:|
| vorher Block, Saat 1 | 10,7 (8–14) | 29 | 51 | 54 | 17,9 (8 %) | 1,7 (4,4) | 46,9 | — |
| **Kaderplan Block, Saat 1** | **11,9 (9–14)** | **0** | **0** | **1** | 16,2 (7 %) | 0 (0,7) | 46,0 | **0** |
| vorher Einzelschritt, Saat 1 | 10,7 (9–13) | 32 | 51 | 54 | 18,1 (7 %) | 1,7 (5,7) | 46,9 | — |
| **Kaderplan Einzelschritt, Saat 1** | **11,9 (9–14)** | **0** | **0** | 11 | 16,5 (7 %) | 0,6 (2,2) | 45,6 | **0** |
| vorher Block, Saat 2 | 10,8 (8–14) | 27 | 44 | 57 | 18,4 (8 %) | 1,7 (5,5) | 46,8 | — |
| **Kaderplan Block, Saat 2** | **11,9 (9–14)** | **0** | **0** | **1** | 16,2 (7 %) | 0 (2,3) | 45,9 | **0** |
| vorher Einzelschritt, Saat 2 | 10,8 (8–14) | 29 | 46 | 55 | 17,9 (8 %) | 1,0 (6,4) | 46,8 | — |
| **Kaderplan Einzelschritt, Saat 2** | **11,9 (9–14)** | **0** | **0** | 10 | 17,3 (7 %) | 0,7 (2,1) | 45,7 | **0** |

Kadergrößen: vorher (Block, Saat 1) 8er 2, 9er 6, 10er 6, 11er 8, 12er 6, 13er 3, 14er 1 — **Kaderplan 9er 4, 10er 4, 11er 4, 12er 7, 13er 4,
14er 9**; im Einzelschritt **identisch**. Notwege: Block-Simulation 0, Einzelschritt-Verlauf 0 `notweg:`; Notkäufe 0, Nachrücker 0.
Kaderplan-Protokoll: Block 32 × `opt_erreicht`; Einzelschritt 20–21 × `opt_erreicht`, 2–3 × `opt_erreicht_tiefe_vor_qualitaet`, die
übrigen 9 enden mit 14 Picks (= Opt 14).

**Stars mit Kaderplan:**

| Lauf | Teams mit Star (Markt) | Stars Σ / Superstars Σ (Markt) | Teams mit Star (Budget) | Stars Σ / Superstars Σ (Budget) | GM-Senkung (Teams, Σ Plätze) |
|---|---:|---|---:|---|---|
| Block, Saat 1 | 8 | 14 / 3 | 11 | 18 / 1 | 9, −12 |
| Einzelschritt, Saat 1 | 6 | 12 / 3 | 10 | 18 / 0 | 9, −12 |
| Block, Saat 2 | 8 | 14 / 3 | 12 | 17 / 0 | 8, −11 |
| Einzelschritt, Saat 2 | 8 | 14 / 3 | 11 | 17 / 0 | 8, −11 |

Nach Archetyp (Kaderplan, Block Saat 1; Opt Identität → Plan, Kader, Stars Markt / Budget, teuerster Anteil am Budget):

| Archetyp | Opt → Plan | Kader | Stars Markt | Stars Budget | teuerster |
|---|---|---:|---:|---:|---:|
| star_chaser (5) | 11 → 9,4 | 9,4 | 1,6 | 1,8 | 21 % |
| risk_gambler (5) | 11,4 → 11,2 | 11,2 | 1,0 | 1,0 | 18 % |
| elite_curator (1) | 10 → 9 | 9 | 1 | 2 | 17 % |
| rivalry_hawk (4) | 12,3 → 11,8 | 11,8 | 0 | 0,5 | 15 % |
| bargain_hunter (4) | 13 → 13 | 13 | 0 | 0 | 10 % |
| culture_keeper (4) | 13,5 → 13,5 | 13,5 | 0 | 0 | 11 % |
| depth_spammer (3) | 14 → 14 | 14 | 0 | 0 | 8 % |
| talent_builder (3) | 13,3 → 13,3 | 13,3 | 0 | 0 | 11 % |

Beispiele je Team (Block Saat 1, volle Tabelle in `data/generated/ki-pick-analyse-18-11/auswertung.md`): **R-L** (star_chaser) Opt 10 → 9,
2 Stars + 1 Superstar (68,1 = 23 % des Budgets); **Z-H** 11 → 10, 3 Stars + 1 Superstar (65,7, 21 %); **M-M** 11, 2 Stars + 1 Superstar
(67,1); **A-A** 12 → 10, ein Spieler für 28 % des Budgets (Superstar nach Budget); **B-P** (elite_curator) 10 → 9, 2 Stars nach Budget;
**C-C, D-L, N-W, T-C, T-T, U-A, L-K, M-S, G-G** bei 14 mit Spielern ≤ 15 % des Budgets.

**Preis, ehrlich:** dieselbe Geldmenge auf mehr Köpfe. Top-6-Stärke −0,9 Punkte (−1,9 %), Depth-Spieler (20–30) werden zu Backup-Spielern
(12–20): Depth 139 → 71, Backup 91 → 252, Füller 54 → 1. Das ist Chris' Abwägung „einen weniger, dafür stärker — oder füllen, um vor
Verletzungen geschützt zu sein": heute entscheidet das leere Konto, mit Kaderplan die Identität (Opt) und der GM. Die Arena-Wertung ist
nicht berührt; ob breitere Kader in der Saison (Ermüdung, Verletzungen, 20 Disziplinen) die Top-6-Differenz zurückholen, misst erst ein
Saisonlauf.

### 5.4 Bewusste GM-Entscheidung „weniger, dafür stärker"

`gmKaderOptAnpassung` (`lib/foundation/team-general-managers.ts`, nur mit Kaderplan): Kompakt-Neigung = Mittel aus Star-Priorität und
Elite-Kader-Neigung (1..10, neutral 5) über neutral; **≥ 4 → Opt − 2, ≥ 2,5 → Opt − 1**, sonst 0. Eine Tiefen-Neigung ≥ 7 verhindert die
Senkung. **Untergrenze Minimum + 1 (9)** — es wird nie nur bis zum Minimum gepickt. Gemessen senken 8–9 GMs um Σ 11–12 Plätze: die fünf
Star-Chaser (−1 bis −2), B-P, S-C, T-G, Z-H (−1). Protokolliert: im Blocklauf als Warnung `kaderplan_gm:…`, im Einzelschritt am Ausstieg im
Verlauf („GM kompakt (Star 10, Elite 9): Opt 12 → 10, weniger Spieler, dafür stärker").

### 5.5 Protokoll je Team

`KaderplanProtokoll` (Block: Warnung `kaderplan:<grund>:opt=…:kader=…:rahmen=…:gm=…:notwege=…`; Einzelschritt: Kurzgrund des Ausstiegs im
Verlauf):

* `opt_erreicht` — Zielkader erreicht, der Rahmen trug alle Plätze zum Platzpreis;
* `opt_erreicht_tiefe_vor_qualitaet` — Zielkader erreicht, der Rahmen trug zu Beginn nur n Plätze ab 12, der Rest bewusst günstiger;
* `unter_opt_rahmen_erschoepft` — Warnsignal, darf mit dem Kaderplan nicht vorkommen (gemessen 0×);
* `notwege` — Rückfälle, die einen Kauf geliefert haben (`fueller_rueckfall`, `ruecklage_angetastet`, `ohne_mindestreserve`,
  `topf_ueberzogen`); jeder wird zusätzlich mit `console.warn` laut gemeldet. Gemessen: **0** in allen Läufen.

## 6. Rücklage ab Saison 2 und Notrücklage (Entwurf + Rechnung)

Chris (18.11.): mehr Spreizung, Persönlichkeit drin, nicht verkrüppeln; das gesperrte Geld ist eine **Notrücklage**, die der Vorstand
in der Not lieber freigibt, als Kredit aufzunehmen oder Spieler zu verkaufen.

**Formel (Vorschlag des PM, so gerechnet):** Sparneigung `s = Finanzwert − max(0, Ambition − 5)`, 1..10; `q = 10 % + 65 % × (s − 1) / 9`
(10–75 %); **Ziel = q × Gehalt**; im Kauffenster gesperrt nur `max(0, Ziel − erwarteter Überschuss bis Saisonende)`, der Rest wird über
die Saison angespart.

Rechnung (`scripts/rechne-ruecklage-s2-vorschlag-18-11.ts`, erste Anlage `new-game-1795031007669-tlnbzg`; Gehalt = Kader nach dem S1-Draft, Überschuss = Sponsor-Erwartung
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

---

## 7. Entscheidung und Bauplan

**Draft: JA** (PM-Entscheidung 18.11.). Der Einzelschritt-Draft ist mit der KI-Logik gleichwertig (vorher wie mit Kaderplan gleiche
Kader, gleiche Kasse, 0 Notkäufe). Der „beschränkte Draft-Modus" beschränkt den Pool nicht. Die Probleme lagen im Kaufschritt selbst
(Plätze bis Opt) und im S2-Marktplan — nicht im Draft.

| Stufe | Inhalt | In diesem PR? | Prüfung |
|---|---|---|---|
| 1 | Kaderplan (Reserve bis Opt, Füller nur nach Plan, kein Stopp unter Opt, Wettbewerbs-Reserve, GM-Opt, Protokoll), Notwege 3 und 4 ersetzt | **ja; nach dem Opus-Review im S1-Setup-Draft Standard** (Abschnitt 9) | gemessen (Abschnitt 5.3 und 9.3); Review-Befunde umgesetzt (Abschnitt 9) |
| 2 | Notwege 1, 2, 5, 7, 8: Legacy-Emergency-Fill löschen, Kader-Fill-Knopf auf den Kaufschritt, delegierte Teams ab S2, Rest-Rückfälle entfernen | nein, Folge-PR nach dem Review | Tests der Notwege umschreiben |
| 3 | Kauf im gemeinsamen Fenster über den Kaufschritt mit Kaderplan (Stelle 6), Rahmen nach Verkäufen neu, Rücklage S2 nach Sparneigung und angespart, Notrücklage-Reihenfolge | nein — die Session-Datei gehört dem Transferfenster-Agenten; der PM koordiniert | Mehrsaisonlauf S1 → S2: kein Team < 8, Kader nahe Opt, Kasse im Band, Spreizung nach Identität, jedes Team kauft, Zählung Notrücklage/Kredit/Notverkauf |
| 4 | Star-Teams (bewusste Star-Plätze im Plan, Preis-Term gegen das Star-Budget) | nein — erst Mockup + Erklärung für Chris | Stars relativ je Archetyp (Abschnitt 2.4), Kadergrößen-Spreizung, Stärke je Archetyp |

## 8. Grenzen

* Zwei Saaten derselben Spielerdaten (nur die Saat der KI unterscheidet sich); Budgets und Pool sind je Anlage gleich.
* „Stärke" = Top-6-Eignung je Disziplin; sie belohnt Breite nicht. Kein Saisonlauf mit dem Prototyp.
* S2-Aussagen (Stelle 6) aus Code und den Messungen #1618/#1628, nicht neu gemessen; Rücklage S2 nur gerechnet (erste Anlage
  `new-game-1795031007669-tlnbzg`, Gehalt nach dem S1-Draft).
* Im Einzelschritt bleiben 10–11 Füller (Block 1); die Wettbewerbs-Reserve rechnet mit dem schlechtesten Fall (alle anderen nehmen die
  billigsten 12er) und ist trotzdem nicht ganz dicht, weil Teams ihre letzten Plätze in derselben Runde füllen.
* Fingerabdruck auf diesem Branch `d3a39030a3ef` = aktueller Stand in CLAUDE.md (auf `main` bewegt durch #1617 Climbing, nicht durch
  diesen PR; die Kaufschritt-Änderung berührt die Arena nicht).

---

## 9. Review-Fixes (unabhängiges Opus-Review, 18.11.) — Kaderplan jetzt Standard im S1-Setup-Draft

Chris' Vorgaben, an denen gemessen wird: (1) die KI rechnet mit dem freigegebenen Rahmen und füllt trotzdem ihr Opt, weniger nur als
bewusste, protokollierte GM-Entscheidung (höchstens −2, nie unter Minimum + 1); (2) keine Notkäufe, kein Minimum-Auffüllen, keine
Billigst-Auffangnetze; (3) kein Team unter 8; (4) Stars relativ, Top-20 in S1 bewusst nicht kaufen; (5) nach dem Picken liegen die
meisten Teams bei etwa 50–70 Gehalt.

### 9.1 Befunde und was geändert ist

| Befund | Problem | Änderung | Test |
|---|---|---|---|
| **S1** `kaderplanRahmen` | Bei `rest = 0` blieben trotzdem die billigsten `voll` Plätze reserviert. Trug die Kasse sie nicht, bestand kein Kandidat, über dem Minimum folgte `nothing_affordable` — Kader 8 statt 9 ohne Kaderplan. | Zwei Stufen: erst die **Zahl der Plätze** schrittweise bis zum größten tragbaren m senken (m = 0 ist genau die Schranke ohne Kaderplan), dann davon so viele zum Platzpreis wie tragbar. Nie weniger Spieler als ohne Kaderplan. | Beispiel Kader 8 / Opt 12 / Kasse für zwei Plätze → 10 (vorher 8); 120 Zufallsfälle „mit ≥ min(ohne, Opt)" |
| **S2** Zählung | `traegtNicht` rechnete den aktuellen Kauf mit dem absolut billigsten Spieler (oft ein Füller): `plaetze`/`rahmenPlaetze` bis zu 1 zu hoch, die Füller-Sperre fiel, ein Füller kam unter Opt bei Grund `opt_erreicht`. | Der aktuelle Kauf zählt zum **billigsten Platzpreis** (`billigsterPlatz`, ab 12); trägt nicht einmal der, zählt er nicht als Platzpreis-Platz. Im Protokoll zählt jeder Füller unter Opt bei `opt_erreicht` als Notweg `fueller_rueckfall` (nicht doppelt, wenn der Schritt ihn schon gemeldet hat). | Opt 9, Kasse für Füller, nicht für 13er → `plaetze` 8, Grund „Tiefe vor Qualität"; Protokoll-Test |
| **S4** Einzelschritt | Scheiterte der Kauf selbst (40 Fehlversuche oder teamweiter Grund), buchte `bucheAusstieg` ohne Protokoll; `bewerteKiPick` setzte es nur bei `kind !== "buy"`. | `bewerteKiPick` liefert das Protokoll immer (mit den Notwegen der bisherigen Picks aus dem Verlauf); der Ausstieg nach gescheitertem Kauf hängt `kaderplan:<grund> kaderplan_notwege:… kauf_gescheitert:<grund>/<Kaufgrund>` an und warnt (`console.warn [kaderplan] AUSSTIEG`). Ein Kader unter 8 ist Notweg `unter_minimum` (Block wie Einzelschritt). Ebenso trägt der Ausstieg am Kader-Maximum das Protokoll. | Integration gegen echten Wegwerf-Spielstand, Kaufweg gemockt (`tests/liga-draft-kaderplan-ausstieg.test.ts`) |
| **S5** über Opt | Die GM-Senkung wurde über Opt wieder aufgehoben (Stop-Nutzen gegen Kauf wie bisher, keine Füllersperre; gemessen R-L: Opt 10 → 9, Endkader 10 mit Füller 2,84). | Mit Kaderplan über dem Opt **nie ein Füller** unter dem Platzpreis; hat der GM den Opt bewusst gesenkt (`kaderplan.gmOptGesenkt`), **hört das Team am gesenkten Opt auf**. | 20 Fälle mit GM-Senkung: Endkader = Opt; Fall „nur Füller bezahlbar" → Schluss am Opt |
| **S3** Gehaltstopf | Über dem Minimum prüft der Builder `salaryCap` nur mit der Mindestkader-Reserve; die Gehaltsseite der Plätze bis Opt ist nicht reserviert (nur gedeckelte Saisons, ab S2). | **Nicht gelöst, sondern begrenzt:** `istKaderplanAktiv(gameState)` (draft-adapter.ts) = Schalter **und** Saison 1. Der Builder entscheidet nicht mehr selbst über eine Env-Variable, sondern liest `input.kaderplan` (nur der Adapter setzt es). Ab S2 aus, kommt mit der S2-Umstellung. | Saison 1 an, Saison 2/11 aus, `OLY_KI_KADERPLAN=0` aus |
| **K2** | `Math.max(1, NaN) = NaN` für `platzWettbewerb`. | `Number.isFinite`-Wächter (auch in der neuen günstigen Reserve). | NaN rechnet wie 1 |
| **K3** | `notweg` und Verlaufs-`grund` (`notweg:ruecklage_angetastet`) wurden auch ohne Schalter gesetzt. | Nur mit Kaderplan; ohne ist das Ergebnis auch in den Daten gleich zur Basis. | Schritt ohne Kaderplan: kein `notweg` |
| **K5** | Mit `OLY_DRAFT_FILLQB=1` kürzte die Geld-Senkung bis `ROSTER_MIN`. | Mit Kaderplan nie unter Minimum + 1, und FILLQB + GM zusammen höchstens −2 gegen den Identitäts-Opt (`optEntscheidung.identitaetsOpt` ist jetzt der Opt **vor** FILLQB). FILLQB bleibt Standard aus. | — (gerechnet im Adapter, Konstante `GM_OPT_SENKUNG_MAX`) |
| **K6** Tests | „Schalter aus bit-gleich" verglich AUS mit AUS; die Füller-Prüfung `>= 12 − 9` war immer wahr; Nachrück-Test mit 400 statt 40 Versuchen. | **Fixture-Kopie** des Builders der Basis #1618 (`tests/fixtures/kaderplan-basis/draft-builder-basis.ts`, Stand `a78c5ada`) und je **300 Zufallsfälle** Block und Einzelschritt (Töpfe, Komposition, Startkader, Gehaltsdeckel, Saat, `rosterMax`, Floors): Pläne, `finalCash`, `finalSalaryTotal`, `stoppedBelowMin`, je Schritt `kind`, `best`, Nutzen, Stop-Nutzen, Top 3 — gleich. Füller echt geprüft (unter Opt bei `opt_erreicht` keiner, über Opt keiner). Nachrücken mit 40: Platz 36 wird gekauft, nach 40 Fehlversuchen `blockiert`, nie die Billig-Liste. | `tests/ki-kaderplan-prototyp.test.ts` (18 Tests) |

Bei der Messung fiel ein weiterer Punkt auf: mit der ehrlicheren Zählung (S2) war die Reserve im **Einzelschritt** zu knapp — 3 Teams
mit Opt 14 endeten bei 13 (`unter_opt_rahmen_erschoepft`), weil die wenigen Spieler unter 4 längst weg waren, als ihr letzter Platz dran
war. Die günstigen Plätze rechnen deshalb jetzt wie die Platzpreis-Plätze mit Wettbewerb (jeder T-te Preis, `billigeReserve`); im Block
(T = 1) ändert sich nichts. Danach 0 Teams unter Opt.

**Schalter:** `OLY_KI_KADERPLAN` ist im Saison-1-Setup-Draft **Standard an**; `OLY_KI_KADERPLAN=0` schaltet ab. Der Builder hat keinen
eigenen Env-Schalter mehr: ohne `input.kaderplan` ist er bit-gleich zur Basis (K6), mit `input.kaderplan` plant er. Gesetzt wird es nur
von `buildOrganicDraftFrame` (Blocklauf `planOrganicDraftForTeam`, Einzelschritt `bewerteKiPick`), wenn `istKaderplanAktiv(gameState)`.

### 9.2 Korrektur der alten Läufe r7/r8 (`env`-Feld)

In `r7-v-block1/2.json` und `r8-kp-block1/2.json` steht im `env`-Feld `OLY_LIGA_DRAFT_MODUS=einzelschritt`, obwohl **der Blocklauf
lief** (`draft: "block"`). Ursache im Messskript: es ruft Block (`fuehreLigaSetupDraftAus`) und Einzelschritt (`starteLigaDraft`) direkt
auf, der Schalter aus der Shell wirkte also nie, wurde aber mitgeschrieben. Die Zahlen dieser Läufe sind Block-Zahlen. Behoben: das
Skript setzt `OLY_LIGA_DRAFT_MODUS` jetzt passend zu `--draft` (Block: entfernt), und das Ergebnis trägt zusätzlich `kaderplanAktiv`.

### 9.3 Messung mit Kaderplan im Standard (Block und Einzelschritt, zwei Saaten)

Neue Anlagen `new-game-1795040032554-du3pjj` (Saat 1) und `new-game-1795040053402-9uwlm4` (Saat 2), Schalter **nicht gesetzt**
(Standard), je Saat Block und Einzelschritt ab derselben SQLite-Kopie (Wegwerf, gelöscht). Rohdaten `data/generated/ki-pick-analyse-18-11/
r10-std-*.json`, volle Auswertung `auswertung-review-fixes.md`. Gehalt = Summe der Gehaltsforderungen des Kaders nach dem Picken.

| Lauf | Kader Ø (min–max) | unter 8 | unter Opt | Füller < 12 (Teams) | Gehalt Median (min–max) | **in 50–70** | über 70 | unter 50 | Stärke Ø | Notwege |
|---|---|---:|---:|---|---|---:|---:|---:|---:|---|
| Review-Vergleich (Block, vorher) | — | — | — | — | — | **20 / 32** | 9 | 3 | — | — |
| Block, Saat 1 | 11,8 (9–14) | 0 | 0 | 1 (1) | 63,7 (41,5–88,3) | **21** | 9 | 2 | 46,0 | 0 |
| Block, Saat 2 | 11,8 (9–14) | 0 | 0 | 2 (2) | 65,0 (43,0–87,3) | **18** | 10 | 4 | 46,0 | 1 × `fueller_rueckfall` |
| Einzelschritt, Saat 1 | 11,8 (9–14) | 0 | 0 | 7 (5) | 65,9 (45,8–86,5) | **20** | 10 | 2 | 45,8 | 0 |
| Einzelschritt, Saat 2 | 11,8 (9–14) | 0 | 0 | 7 (5) | 65,7 (41,9–86,2) | **19** | 10 | 3 | 45,8 | 0 |

* **Kadergrößen** in allen vier Läufen identisch: 9er 4, 10er 3, 11er 7, 12er 7, 13er 2, 14er 9. Kein Team unter 8, keins unter Opt.
* **GM-Senkung** (bewusst, protokolliert): 8 Teams, Σ −11 Plätze; alle enden **genau** am gesenkten Opt (R-L 10 → 9, Kader 9; A-A
  12/13 → 10/11; V-V 11 → 9). Der Fall aus dem Review (R-L Endkader 10 mit Füller) kommt nicht mehr vor.
* **Gründe:** Block (Simulation, deckt den echten Lauf zu 378/379 Spielern) 32 × `opt_erreicht`; Einzelschritt im Verlauf 19–21 ×
  `opt_erreicht`, 2–4 × `opt_erreicht_tiefe_vor_qualitaet`, die übrigen 9 Teams (alle mit Opt 14) beenden den Draft über die Pick-Grenze
  (`max_picks`) ohne Ausstiegszug und damit ohne Verlaufs-Protokoll.
* **Notwege:** 0 `[kaderplan] NOTWEG`/`AUSSTIEG`-Warnungen in allen Läufen; gezählt 1 × `fueller_rueckfall` (Block Saat 2, A-A: 10. Platz
  mit 11,45 statt ≥ 12 — der Rahmen trug zu Beginn alle Plätze, am Ende passte kein 12er mehr über die Rücklage). Keine Notkäufe,
  keine Nachrücker.
* **Füller:** Block 1–2. Der Füller von P-S (4,63) ist sein **Startspieler** aus dem frischen Stand, kein Kauf (P-S kauft 8, Opt 9) — das
  ist auch der vom Review gemeldete „9. Spieler". Im Einzelschritt 7 (vorher 10–11), alle bei Teams mit Opt 14 auf den letzten Plätzen
  (Tiefe vor Qualität, weil die günstigen 12er im Wettbewerb weg sind).
* **Stars relativ:** 7–8 Teams mit Star nach Markt (Σ 11–13, 3 Superstars bei den drei Lizenz-Teams), 11–14 nach Budget; Top-20 kauft
  niemand (teuerster gekaufter Spieler 77,7; die Top 20 beginnen bei 81).
* **Gehalt:** Median 64–66, **18–21 von 32 in 50–70** (Review-Vergleich 20), 9–10 darüber (quer durch die Kadergrößen 9 bis 14, also
  eher reiche bzw. star-lastige Teams als große Kader), 2–4 darunter (R-R, V-W, je nach Saat A-A, S-C). Vorgabe 5 („die meisten") ist
  erfüllt, aber nicht enger als im Review gemessen: der Kaderplan verschiebt die Gehaltsverteilung kaum.
* Kasse über der Rücklage: Median 0–0,1 (Block) bzw. 0,6 (Einzelschritt); Stärke Block 46,0 (vorher mit Prototyp 45,9–46,0),
  Einzelschritt 45,8 (vorher 45,6–45,7).

Arena-Fingerabdruck unverändert **`d3a39030a3ef`** (75 Einträge).

### 9.4 Offen

* **S3** (Gehaltsseite der Plätze bis Opt im Gehaltstopf) — **gelöst** mit „Fenster auf Opt“ (`docs/design/fenster-auf-opt-18-11.md`): `kaderplanRahmen` reserviert Ablöse und Gehalt gegen `kaufRahmen().grenzeFuer`; der Kaderplan ist im Fenster ab Saison 2 an (`OLY_FENSTER_AUF_OPT=0` = nur Saison 1).
* Teams, die den Einzelschritt-Draft über die Pick-Grenze beenden (`max_picks`, 9 Teams mit Opt 14), haben kein Verlaufs-Protokoll; ihre
  Füller auf den letzten Plätzen sind deshalb nicht als Notweg gezählt (Block: dieselben Teams ohne Füller).
* 9–10 Teams liegen über 70 Gehalt. Soll das Band 50–70 enger werden, braucht es eine Gehaltsseite im Plan (Teil von S3) oder eine
  Vorgabe an Identität/Rücklage, nicht den Kaderplan.

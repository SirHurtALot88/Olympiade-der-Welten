# Gameplay-Systemreview (22.11.)

Frage von Chris: „Greifen alle Systeme sauber ineinander? Funktioniert alles, was wir uns vorgenommen haben? Wo gibt es
Verbesserungspotential?“ Dieses Dokument stellt je System **Soll** (CLAUDE.md, Arbeitsliste 21.11., Konzepte) gegen
**Ist** (Code und gemessenes Verhalten). Am Spiel wurde nichts geändert; neu ist nur die Mess-Sonde
`scripts/sonde-gameplay-review.ts`.

## 0. Messgrundlage

| Quelle | Was | Stand |
|---|---|---|
| **A. Langlauf** | neuer Battle-Spielstand, **32 KI-Teams von Anfang an**, Liga-Split 2×16, **3 Saisons à 20 Spieltage** über die Produktionspfade: Draft, `runLocalMatchdayAutoRun` (Node-Motor), `executeMatchdayAdvance`, Saisonabschluss, Saisonende-Kette, KI-Kaufphase `fuehreKiPreseasonLaufAus`. Werkzeug `scripts/miss-teamfinanzen-saison.ts --seasons 3` (Schnappschüsse je Phase), dazu `scripts/sonde-gameplay-review.ts` auf einer Kopie nach jeder Saison (PP, Ergebnisskala, Tabelle, Verletzung, Form/Moral, Formkarten, Training, Verträge) | `main` 80221a261 (alle Welle-4-PRs bis #1679), Laufzeit 51 min. Alle Stempel der neuen Saison gesetzt: PP `c2`, Ergebnis `e1`, Battlefield `domination5`, Hockey-Torwart `neu`, Basketball-Puste `neu`, Climbing `canyon`, Finanzen je Spieltag `v1`, Belastung `v2` |
| **B. Live-Abbild** | Chris' Spielstand `new-game-1795114260527-nzr0z9` (Saison 1 nach Spieltag 11, D-P menschlich, 31 KI) aus `live-save` vom 22.11. 12:10 | Spieltage 1–11 mit den Regeln vor Welle 4; Format-Wechsel ab Spieltag 12 gestempelt |
| **C. Wertungs-Fingerabdruck** | `node scripts/pruefe-wertung-fingerabdruck.mjs --node` | **GESAMT ea36f666cc71** = Stand CLAUDE.md (Basketball-Puste); Nebensummen Climbing-Standard, Battlefield-Orte3, Hockey-alt, Basketball-alt, TDM-Gefecht wie dokumentiert |
| **D. In-Game-Meldungen** | `bug-reports` (Spiegel frisch, 22.11. 12:07) | 94 Meldungen; die letzten zwei vom 19.11. (Draft: Attribut-Bereiche im Nebel, Umschalter Draftliste/eigene Team-Stats). Seit 20.11. keine neuen Meldungen, der Live-Stand ist seit 20.11. 17:43 nicht weitergespielt |
| **E. Code** | Lektüre der Stellen, auf die sich die Befunde stützen | Zeilen beziehen sich auf `main` 80221a261 |

**Einschränkungen.** (1) Das Messwerkzeug draftet im **Blocklauf** (`--draft block`, Standard), die App seit 19.11. im
Einzelschritt-Liga-Draft. Für Wertung, Verletzung, Form, Training, Tabelle und die Kaufphasen ab Saison 2 ist das
gleichwertig, für die Vertragsregel der S1-Draft-Picks nicht (Befund 9). (2) Ein Lauf ist eine Stichprobe: jede Disziplin
kommt je Saison an zwei Spieltagen vor. Als Befund steht unten nur, was in **mindestens zwei von drei Saisons** gleich
auftritt oder über den Code erklärt ist. (3) Mensch-Verhalten (Chris, Franky, Ramona) ist nicht simuliert; Mehrspieler ist
aus Code und Tests beurteilt.

---

## 1. Kurzfazit

Das Grundgerüst trägt: Wertung und Buchung sind deterministisch (Fingerabdruck bestätigt), drei Saisons laufen ohne
Abbruch durch, Auf-/Abstieg tauscht korrekt je drei Teams, die Verletzungsregel hält (0 Einsätze am Sperrspieltag),
Verletzungen liegen mit 172/156/142 je Saison im Korridor 150–200, die Saisonpause wirkt sichtbar (Spieltag 11: 0/2/0
Verletzungen gegen 12/8/6 an Spieltag 10), und Finanzen je Spieltag mit Rang-Abschlag halten die Kassen weitgehend im
Plus. **Was hakt, liegt an den Nahtstellen:** (a) Die Vorstandsfreigabe greift im wichtigsten Transferfenster nicht –
26–27 von 32 Teams geben mehr aus als freigegeben, und Teams mit wenig Vertrauen überziehen am stärksten. (b) Der Vorstand
misst Erfolg an der Erwartung aus der eigenen Kaderstärke; ein KI-Team, das gute Spieler verkauft und Schrott kauft,
landet zweimal auf Platz 16 und hat Vertrauen 9,8 – die Liga franst nach unten aus (schwächstes Team Kaderstärke 39 → 25).
(c) Die PP-Skala C2 trifft „Top ≈ 5“ nicht stabil: an 18–21 von 40 Disziplin-Tagen je Saison stehen drei oder mehr Spieler
glatt auf 5,0 (Breaking in Saison 3 im Mittel 30 je Tag), an anderen ist der Beste der Liga bei 2,6. (d) Die Ergebnisskala E1 verfehlt
ihr Ziel „Median-Sieg = Abstand 3“ je nach Disziplin um bis zu 6 Punkte. (e) Kadertiefe entscheidet in Saison 1–2 mehr
über die Tabelle als die angezeigte Kaderstärke (beste 6). Moral ist im Spiel praktisch unsichtbar, ein Viertel aller
Formkarten hat Wert 0, und Hockey liegt als einzige Disziplin unter der rho-Mindestschranke.

---

## 2. Ampel je System

| System | Ampel | Begründung in einem Satz |
|---|---|---|
| 1. Spieltagsablauf, gezeigt = gebucht, Format-Stempel | **grün** | Fingerabdruck ea36f666cc71 bestätigt, alle acht Stempel einer neuen Saison gesetzt, gebuchte Spieltage behalten ihr Format; im Langlauf keine einzige blockierte Buchung. |
| 2. Wertung: PP C2, E1, Duellpunkte, Kaderstärke | **gelb/rot** | Duellpunkte und Tabelle sind sauber, aber PP-Spitzen klumpen an 18–21 von 40 Tagen auf 5,0 und E1-Abstände streuen je Disziplin 2–9 statt um 3; die Anker passen nach den Umstellungen dieser Woche (TDM-Gefecht, Breaking, Bahn) nicht mehr. |
| 3. Form, Moral, Formkarten, Verletzung, Belastung, Pause, Training | **gelb** | Verletzung, Belastung und Pause wirken wie vorgegeben; Moral bewegt die Eignung höchstens um 0,67 % (70–76 % der Spieler „neutral“), 24–26 % der Formkarten sind 0er (Welle 4 offen), Training bringt rund 1 % je Saison. |
| 4. Wirtschaft: Finanzen je Spieltag, Vorstand, zwei Töpfe, Rücklage | **rot** | Kassenverlauf gut (Teams im Minus 7 → 1 → 2), aber die Vorstandsquote wird im Fenster von 26–27 Teams überschritten (Σ +19 % / +13 %), umgekehrt proportional zum Vertrauen. |
| 5. KI-Teams | **gelb/rot** | Aufstellung plausibel (94–95 % der bestmöglichen Eignung), aber einzelne Teams verfallen durch Verkauf guter und Kauf sehr schwacher Spieler, und die KI baut dünne Kader, obwohl Tiefe Punkte bringt. |
| 6. Mehrspieler / Delegation | **gelb** | Delegation in allen sechs Bereichen verdrahtet und getestet; „Voll KI“ kauft ab Saison 2 nicht, und ein dritter Sitz im Online-Raum fehlt. |
| 7. Saisonwechsel und Langzeit | **gelb** | Wechsel, Auf-/Abstieg, Vertragsablauf, Kaufphasen laufen stabil, Gehälter/Marktwerte bleiben ohne Inflation; die Schere der Kaderstärke öffnet sich nach unten (Bottom-4 39,5 → 33,4, Top-4 konstant 53–55). |

---

## 3. Befunde, priorisiert

Schwere: **F** = Fehler, **B** = Balance, **L** = Lücke Soll–Ist, **V** = Verbesserung. Aufwand S/M/L.

### Befund 1 (L/B, hoch) – Vorstandsfreigabe greift im Transferfenster faktisch nicht, und am wenigsten bei wenig Vertrauen

- **Soll (CLAUDE.md „Finanzen“):** Die Freigabe ist **hart**: über dem freien Betrag ist kein Kauf möglich, Stufen 100/90/80/70/50 % nach Vertrauen.
- **Ist (gemessen, Langlauf, `vorstandStatistik` = `berechneVorstandBudgetStand` je Team nach der KI-Kaufphase):**

  | Fenster | Teams über ihrem Transfertopf | Σ Topf | Σ ausgegeben (Ablöse + Gebäude) | ausgegeben/Topf nach Stufe |
  |---|---:|---:|---:|---|
  | vor Saison 2 | 27 von 32 | 1893,8 | 2252,2 (+19 %) | hoch 1,06 · standard 1,21 · **niedrig 1,27** |
  | vor Saison 3 | 26 von 32 | 1690,2 | 1904,1 (+13 %) | hoch 1,09 · standard 1,12 · niedrig 1,32 · **knapp 1,36** |

- **Wahrscheinliche Ursache (Code; nicht Kauf für Kauf nachverfolgt):** `kaderpflichtZuschlag` (`lib/finance/vorstand-budgetfreigabe.ts:316–330`) gibt nicht nur bis zum
  Pflichtkader 8 frei, sondern bis `kaderOpt` (= `identity.playerOpt`, :477), begrenzt nur durch `cash − notruecklage`
  (:326), also **ohne Quote**. Nach jedem Saisonende liegen fast alle KI-Kader unter ihrem Optimum (Vertragsablauf: Ø-Kader
  11,9 → 9,5 nach Saison 1, 10,9 → 9,4 nach Saison 2; vor der Kaufphase S3 haben 20 von 32 Teams ≤ 9 Spieler). Damit
  rechnet `kaufRahmen().grenzeFuer` (:629–645) für fast jedes Team mit dem Zuschlag statt mit der Quote.
- **Wirkung:** Die Vertrauensstufe hat im wichtigsten Fenster keine spürbare Wirkung, Teams mit niedriger Stufe
  (80 %/70 %) überziehen am stärksten. Für den Menschen wirkt die Finanzseite („X % freigegeben“) unehrlich, sobald er unter seinem Optimum ist.
- **Vorschlag (S):** Zuschlag über `kaderMin` hinaus nur **mit der Quote** gewähren (`q × fehltOpt × platzAbloese`) oder
  nur bis `kaderMin`; Gegenprobe mit `scripts/miss-teamfinanzen-saison.ts --seasons 3` (Kaderstärke darf nicht einbrechen,
  vgl. Messung 18.11. „Kaderstärke −6 %“).

### Befund 2 (B/L, hoch) – Der Vorstand belohnt den Abstieg in die Bedeutungslosigkeit; einzelne KI-Teams verfallen

- **Soll:** Der Vorstand gibt bei ausbleibendem Erfolg weniger frei (Chris 18.11.); KI-Teams sollen plausibel und
  wettbewerbsfähig bleiben.
- **Ist (Langlauf, Team D-L, Liga 2):**

  | Zeitpunkt | Kader | Kaderstärke (beste 6) | Rang | Vertrauen | Gehalt | Sponsor-Anker |
  |---|---:|---:|---:|---:|---:|---:|
  | nach Draft S1 | 14 | 40,1 | – | – | 75,7 | 56,0 |
  | Ende S1 | 14 | 40,4 | 6 | 5,5 | 75,0 | 56,0 |
  | nach Kaufphase S2 | 12 | 32,4 | – | 6,5 | 46,9 | 56,6 |
  | Ende S2 | 12 | 32,9 | **16** | **9,5** | 46,8 | 56,6 |
  | nach Kaufphase S3 | 11 | 25,4 | – | 9,9 | 27,9 | 59,3 |
  | Ende S3 | 11 | 25,8 | **16 (10 Punkte, Verhältnis −194)** | **9,8** | 27,9 | 59,3 |

  In der Kaufphase S2 verkauft D-L fünf Spieler mit Top-5-Eignung 38–46 und kauft vier mit **11,2 / 14,1 / 15,7 / 21,0**
  (Ablöse 2,6–3,7 C); in S3 verkauft es seine Besten (50,2 / 47,7 / 45,5 / 45,2) und kauft acht Spieler, davon sieben mit 22–38 (Werte jeweils am Ende von S3). Der freie Pool hatte zur
  selben Zeit eine Top-5-Eignung von Median 57,8 (86 % ≥ 45). Ligaweit: 8 % der KI-Käufe in S2 und 4 % in S3 liegen unter
  Top-5-Eignung 25 (je drei Teams). U-A (Rang 14, Vertrauen 10,0) zeigt dasselbe Muster schwächer.
- **Ursache (Code):** Das Sportziel ist relativ zur Erwartung **aus der eigenen Kaderstärke**:
  `expectation-rank` in `lib/board/team-season-objectives-service.ts:604–616` (`rankDelta = expectedRank − currentRank`).
  Wer seinen Kader selbst schwächt, senkt die Erwartung mit; Platz 16 bei erwartetem Platz 16 ist „erfüllt“, dazu kommen
  Finanzziele (Gehalt 75 → 28 bei Sponsor 59). Der Verkauf-/Kaufpfad ist `ai_organic_squad_sell` / `ai_organic_squad_buy`.
- **Wirkung:** Liga 2 bekommt dauerhafte Punktelieferanten; die Kaderstärke-Schere öffnet sich nach unten
  (Bottom-4 39,5 → 36,8 → 33,4, Top-4 54,1 → 52,8 → 54,3). Für Chris heißt das: leichte Gegner, die nicht mehr aufholen.
- **Vorschlag (M):** (a) Erwartungsrang zusätzlich an einer **festen Ligaerwartung** (Vorsaisonrang, Finanzwert/Ambition)
  verankern, nicht nur an der aktuellen Kaderstärke; zwei Letzte in Folge dürfen nie „hohes Vertrauen“ ergeben.
  (b) Untergrenze in der KI-Kaufbewertung: kein Kauf unter einer Eignungs-Untergrenze relativ zum Ligaschnitt, wenn Kasse
  für einen besseren reicht; Verkauf eines Top-3-Spielers nur bei Ersatz gleicher Stärke. Gegenprobe: Bottom-4 über drei
  Saisons stabil.

### Befund 3 (B/L, hoch) – PP-Skala C2: Spitzen klumpen auf 5,0, an anderen Tagen bleibt der Beste weit darunter

- **Soll (CLAUDE.md „Player Points“):** der beste Spieler einer Disziplin an einem Spieltag liegt **um 5 PP, nicht weit darüber**; PP sind ein Leistungsmaß.
- **Ist (Langlauf, alle Spieler beider Ligen je Disziplin-Tag; vollständige Tabelle im Anhang):**
  - Disziplin-Tage mit **≥ 3 Spielern glatt auf 5,0**: **18 / 20 / 21 von 40** (S1/S2/S3).
  - Spitzenreiter je Tag glatt auf 5,0: Climbing 15/16/16, Time-Trial 15/12/16, **Breaking 4 / 11,5 / 30,5**, Staffel 8/8/4,
    Hockey 1,5/8/4,5 (trotz Neukalibrierung 22.11.), **TDM: Tagesbester an allen sechs Tagen 5,0, im Mittel 3–4 Spieler glatt auf 5** (Live-Abbild, noch altes Duell: 1).
  - Gleichzeitig Tage, an denen der **beste Spieler beider Ligen** weit unter 5 bleibt: Showcase 2,43 (S1), Eiskunst 2,61,
    Wettessen 2,84 und 3,62, I-Spy 3,29, Basketball 3,33 (alle S2), Spurt 3,79 (S2/S3).
- **Ursache:** C2 legt die Kurve auf **feste** Anker je Disziplin × Feldgröße (`lib/resolve/pp-skala.ts`,
  `data/generated/pp-skala-kalibrierung.json`, gezogen 18.11.). (1) Die Feldgröße wechselt zwischen den beiden Auftritten
  einer Disziplin (z. B. Wettessen 6 → 4, Breaking 6 → 2, Climbing 3 → 6 Plätze); je Feldgröße liegen nur wenige
  Kalibrierzellen. (2) Bahn-Disziplinen vergeben Platzpunkte statt stetiger Leistung (bekannt, `pp-analyse-21-11.md` §0.3).
  (3) Die TDM-Anker stammen aus dem alten Echtzeit-Duell; seit #1668 bucht TDM das Gefecht bis zum Ende
  (`kalibrierung.json` hat Quellen für Battlefield, Hockey, Basketball vom 22.11., **keine für TDM**).
- **Wirkung:** MVP, PP-Ränge, Marktwert, Trainings-XP und Spielerprofile lesen eine Zahl, die an manchen Tagen 16 Spieler
  gleich stellt und an anderen den Besten mit 2,6 abspeist; genau die Rückmeldung aus Welle 1.14.
- **Vorschlag (M):** Den fertigen Prototyp **Tagesanker OLY-weit + weiche Kappe** (`pp-analyse-21-11.md` §4–5; Code liegt
  auf `origin/claude/pp-analyse-21-11`, **nicht** auf `main`) als Saisonstempel `wertungsSkalen.pp = "c3"` scharf
  schalten; bis dahin mindestens TDM nachkalibrieren (`scripts/miss-pp-skala.ts` + `werte-pp-skala-aus.mjs
  --schreibe-kalibrierung`). Stufe 2 (stetiger Bahn-Impact) braucht Chris' Freigabe (Motor).

### Befund 4 (B, hoch) – In Saison 1–2 entscheidet Kadertiefe die Tabelle stärker als die angezeigte Kaderstärke

- **Soll:** Kaderstärke wird über die **besten 6** gezeigt (Chris 18.11.); der Spielplan deckelt die Plätze je Spieltag
  bewusst nicht, „wer einen breiten Kader hält, kann an einem 12er-Spieltag alle Plätze besetzen“
  (`lib/season/season-discipline-schedule.ts` Kommentar vor :578). Tiefe soll also zählen.
- **Ist (Langlauf):** Je Duell gewinnt das Team mit der höheren Disziplin-Kaderstärke 69 / 66 / 74 % (bei ≥ 10 Punkten
  Abstand 85–87 %). Über die Saison folgt die Tabelle der Kaderstärke aber nur schwach:

  | Saison | Spearman Kaderstärke ↔ Endrang Liga 1 / Liga 2 | Korrelation Residuum (Siege − erwartet) ↔ Kadergröße | Kader ≤ 10: Siege − erwartet | Kader ≥ 13 |
  |---|---|---:|---:|---:|
  | S1 | 0,21 / 0,30 | **0,72** | −3,8 (n=7) | +3,0 (n=11) |
  | S2 | 0,31 / 0,85 | **0,75** | −2,6 (n=14) | +4,3 (n=3) |
  | S3 | 0,76 / 0,64 | 0,38 | −2,0 (n=13) | −0,4 (n=2) |

  (von 32 Duellen je Team; Residuum gegen Verletzungen −0,49 / −0,58 / −0,62). Die Spieltage mit 10–11 Plätzen
  (z. B. S1 ST14 Tennis 5 + Schach 6, ST17 Climbing 6 + Wettessen 4, ST19 Battlefield 5 + Eiskunst 6) treffen 9er- und
  10er-Kader; S1 ST17 allein brachte 29 von 172 Verletzungen.
- **Wirkung:** Die gezeigte Kaderstärke (Draft, Transfermarkt, Vorstandserwartung, Arena-Vorschau) sagt dem Spieler wenig
  über seine Tabellenchance; die KI baut trotzdem dünn (vor S2-Kauf 6 Teams ≤ 7, nach Kauf 14 Teams ≤ 10). In S3, mit
  größerer Stärkespanne, kehrt sich das um (Stärke dominiert wieder).
- **Vorschlag (S–M):** (a) Neben der Kaderstärke eine **Tiefe/Last-Kennzahl** zeigen (z. B. „Plätze am vollsten Spieltag
  / Kader“ oder Stärke der Plätze 7–12); (b) KI-Kaderziel an der höchsten Spieltagslast der Saison ausrichten
  (`playerOpt` ≥ größte Platzsumme); (c) Chris fragen, ob Tiefe so stark wirken soll (Frage 2).

### Befund 5 (L, mittel) – Ergebnisskala E1 verfehlt „Median-Sieg = Abstand 3“ je nach Disziplin stark

- **Soll (`ergebnisskala-18-11.md` §0.2):** für alle Disziplinen dieselbe Kurve, Median-Sieg → Abstand 3, oberste 2,5 % → 10;
  das Verhältnis soll durch keine Disziplin „kaputtgerissen“ werden.
- **Ist (Langlauf, je Saison 32 Duelle je Disziplin; Tabelle im Anhang):** Median-Abstand je Disziplin und Saison zwischen
  **2 und 9**; Climbing 5 / 9 / 8,5 (40 % Kantersiege 10:0 in S3), Tennis 2 / 8 / 2 (38 % 10:0 in S2), Speed-Schach 8 / 4 / 4,
  Showcase dauerhaft 2 (90-%-Quantil 2 in S1). Anteil am Gesamt-|Verhältnis| je Disziplin S1: Wettessen 7,0 % bis Showcase
  2,3 %; S3: Climbing 7,3 % bis Showcase 2,7 % (Soll je 5 %).
- **Ursache:** Anker vom 18.11. (`data/generated/ergebnis-skala-kalibrierung.json`, Quellen ohne Canyon-Langlauf, TDM vor
  dem Gefecht, Breaking/Tennis-Änderungen) und dünne Feldgrößen-Zellen (z. B. Climbing Feldgröße 2: alle Knoten 0,2–0,4).
- **Wirkung:** Das Verhältnis (Tiebreaker, Anzeige „87 : 79 → 7 : 4“) wirkt je Disziplin unterschiedlich großzügig;
  Climbing und Speed-Schach entscheiden Gleichstände öfter als Showcase.
- **Vorschlag (S):** E1-Anker mit drei frischen Langläufen nachziehen (`werte-ergebnisskala-aus.ts --schreibe-kalibrierung`)
  und einen Wächter-Test „Median-Abstand je Disziplin in [2, 4]“ auf einer festen Sonde.

### Befund 6 (B, mittel) – Moral ist im Spiel praktisch wirkungslos, Form nur schwach

- **Soll (CLAUDE.md „Form, Moral“):** Form und Moral skalieren die Arena-Eignung; Moral wird groß als farbiges Gesicht gezeigt.
- **Ist:** Wirkung höchstens ± `MORAL_ANTEIL` × Dosis = **± 0,67 %** Eignung (`lib/morale/form-moral-modifikator.ts:40–45,
  126–129`). Gemessen: Moral P10/Median/P90 = 36/50/60 (S1) bis 37/51/61 (S3), **70–76 % der Kaderspieler „neutral“**
  (Live-Abbild: 286 von 376). Form P10/P90 = 21–27 / 65–69 → −1,9 % … +1,3 %. Zum Vergleich: eine Formkarte bewegt ± 2–8
  Formpunkte je Spieler.
- **Wirkung:** Das prominente Moral-Gesicht hat keine spielerische Konsequenz; Entscheidungen über Einsatzzeit, Prämien
  oder Versprechen zahlen sich sportlich nicht aus.
- **Vorschlag (S):** Dosis auf den PM-Vorschlag 1,5 % (`OLY_FORM_MORAL_DOSIS`) heben und/oder `MORAL_SAETTIGUNG` 20 → 12;
  Wirkung mit `miss-alle-disziplinen.mjs` auf rho prüfen. Grundsatzfrage an Chris (Frage 3).

### Befund 7 (L, mittel) – Ein Viertel der Formkarten ist wertlos (0er)

- **Soll (Arbeitsliste Welle 4):** „keine 0er, jede Karte ±“.
- **Ist:** Wert-0-Karten 201 von 764 (S1), 180 von 700 (S2), 184 von 688 (S3), im Live-Abbild 176 von 752 (23–26 %).
  `formkartenZerlegungFuerSpieler` liefert für 0 sofort `summe: 0` (`lib/lineups/formkarten-farbregel.ts:78`).
- **Vorschlag (S):** Welle-4-Punkt umsetzen (Kartengenerator ohne 0, Wertung über `FORMKARTEN_ECHT`-Pfad bleibt);
  Fingerabdruck bewegt sich nicht, die Kartenverteilung schon – Messlauf `miss-alle-disziplinen.mjs` mit `OLY_FORM_MODUS=echt`.

### Befund 8 (L, mittel) – Hockey bleibt als einzige Disziplin unter der rho-Mindestschranke

- **Soll (CLAUDE.md):** rho in **einem** Spiel ≥ 0,75 (hart), Ziel > 0,80.
- **Ist (`data/generated/disziplin-abnahme.json`, 22.11.):** Hockey `rhoJeSpiel` **0,681** (Feldspieler 0,71), gedeckt
  durch `ARENA_ABNAHME_AUSNAHMEN`; alle anderen 19 Disziplinen ≥ 0,80 (Showcase 0,812, Climbing 0,815, Football 0,818,
  Battlefield 0,819 knapp). Die Torwart-Regel vom 22.11. hat den Torwart-Abschlag um 0,02–0,03 verringert, die Lücke liegt
  laut `hockey-torwart-22-11.md` §3 in der **Feldspiel-Validität**.
- **Vorschlag (L):** eigener Hockey-Auftrag „Feldspiel-Validität“ (Rezept/Kanäle, nicht Uhr), Opus-Review.

### Befund 9 (L/V, mittel) – Messwerkzeug und App draften verschieden; die S1-Vertragsregel wird so nicht gemessen

- **Ist:** `scripts/miss-teamfinanzen-saison.ts:102` und `scripts/miss-pp-skala.ts:42` laufen im Blocklauf
  (`fuehreLigaSetupDraftAus`), die App im Einzelschritt-Liga-Draft (`lib/game/league-setup-draft-service.ts:95–118`). Die
  Sperre `in_season_renewal_draft_s1` liest nur `seasonState.ligaDraft.verlauf` (`lib/contracts/verlaengerung-in-saison.ts:55–63, 72`).
  Folge im Messlauf: **94 In-Saison-Verlängerungen in S1** (24 Teams), die es in der App nicht gäbe; auch die Zahlen
  „49 In-Saison-Verlängerungen“ in `finanzen-je-spieltag-22-11.md` §9 sind davon betroffen.
- **Vorschlag (S):** Standard der Messwerkzeuge auf `--draft einzelschritt` stellen; die Sperre zusätzlich an einer
  Kennung am Roster festmachen (`joinedViaDraftS1`), damit sie nicht vom Draft-Weg abhängt.

### Befund 10 (L, mittel) – Mehrspieler: „Voll KI“ kauft ab Saison 2 nicht, dritter Sitz im Raum fehlt

- **Soll (CLAUDE.md „Mehrspieler“):** drei Stufen je Bereich; „Voll KI“ = die KI erledigt alles nach denselben Regeln.
- **Ist:** `getAiTeamIds` (`lib/ai/ai-preseason-background-service.ts:109–120`) nimmt nur `controlMode === "ai"`; ein
  menschliches Team mit `transfers: "ki"` bekommt ab Saison 2 weder Kaufphase noch Kaderrettung (so schon in
  `mehrspieler-delegation-18-11.md` §13 als Lücke notiert, unverändert). Ramona (Halbautomatik, Käufe selbst) ist davon nicht
  betroffen. Im **Online-Raum** gibt es nur Host + einen Gast (`lib/room/online-room-model.ts:73`, Schätzung 1,5–2 Tage,
  §11 dort). Positiv: alle sechs Bereiche lesen `isBereichDelegiert` (Einsatzliste, Draft, Transfers inkl. Verlängerung,
  Training, Gebäude/Reha, Sponsor), Tests `tests/mehrspieler-delegation-*.test.ts`.
- **Vorschlag (M):** delegierte Menschenteams in `getAiTeamIds` aufnehmen (mit `protectedHumanTeamIds` nur für
  `transfers: "selbst"`); dritter Sitz als eigener Auftrag, sobald Ramona online mitspielen soll.

### Weitere Beobachtungen (niedrig)

- **V – KI lässt Verträge auslaufen und kauft dieselben Spieler zurück:** 11 Rückkäufe eigener Vertragsabgänge (Σ Ablöse
  267,7 C), ligaweit 59 von 206 Käufen in S2/S3 betreffen Spieler, deren Vertrag zuvor irgendwo ablief. Verlängern wäre
  billiger (nur Gehalt). KI-Verlängerungsregel gegen „Ablöse bei Rückkauf“ abwägen (S).
- **V – Training ist kaum spürbar:** 0,29–0,33 Attributpunkte je Spieler und Spieltag, rund +6 Summenpunkte je Saison auf
  ~548 (≈ +1 %); Ø-Rating der Kader 34,8 → 34,5 → 34,0, Marktwert Ø 19,8 → 20,5. Bewusst langsam oder zu langsam? (Frage 4)
- **V – Vertragsablauf als Kader-Reset:** nach S1 laufen 265 von 382 Verträgen aus (Draft fest 1 Saison), die
  Kaderstärke fällt in der Kette von 46,5 auf 42,1, und die Kaufphase muss Ø 1,4 Spieler je Team nachkaufen. Das ist
  gewollt (Chris 21.11.), erklärt aber Befund 1.
- **B – Speed-Schach endet in 22–28 % der Duelle remis** (14–18 Remis-Zeilen je Saison), Spurt-Duelle in S2/S3 zu 19 %.
  Remis bleibt Remis (E1-Garantie); ob das gewollt ist, gehört in die nächste Disziplin-Runde.
- **Bekannt offen (Arbeitsliste):** Formkarten-KI „gezielt setzen“, Breaking Tag-Team, Spannungsbögen, Wettessen-Rework,
  Draft-Brett-Umschalter (In-Game-Meldung 19.11.).

---

## 4. Wechselwirkungen

**Spielen gut zusammen**

1. **Belastung v2 + Saisonpause + Verletzungsregel + KI-Schonung.** Verletzungen 172 → 156 → 142 (Korridor 150–200),
   Spieltag 11 nach der Pause 0/2/0 Verletzungen; kein Verletzter je auf dem Sperrspieltag (Live 0 von 92); die KI stellt
   im Mittel 94–95 % der bestmöglichen Eignung auf und schont an Lastspitzen (ST10/ST17 rund 88 %).
2. **Finanzen je Spieltag + Rang-Abschlag + Vorstand rechnet auf die Kasse vor Spieltagsbuchungen.** Teams zwischendurch
   im Minus: 7 → 1 → 2 (tiefster −14,3 / −2,7 / −8,9 C); keine Notkredit-Kaskade, Σ Schulden 0 → 9,4 → 33,1 C.
3. **Format-Stempel + Fingerabdruck-Nebensummen.** Jede Umstellung dieser Woche hat einen Rückweg und gebuchte Spieltage
   behalten ihr Format; der Live-Stand zeigt die Wechsel sauber ab Spieltag 12.
4. **Auf-/Abstieg:** je drei Teams, Aufsteiger halten sich (S2: Rang 8/10/14; S3: 9/10/15), Absteiger aus Liga 1 kommen
   in Liga 2 oben an (S3: Rang 4/6/7).

**Spielen schlecht zusammen**

1. **Draft fest 1 Saison → Massenablauf → Kaderpflicht-Zuschlag bis `playerOpt` → Vorstandsquote wirkungslos** (Befund 1).
   Drei für sich sinnvolle Regeln heben zusammen die Kernmechanik des Vorstands auf.
2. **Vorstandserwartung aus Kaderstärke → KI-Organik verkauft Qualität → Vertrauen steigt** (Befund 2). Der Regelkreis
   belohnt Schrumpfen; dazu bestraft Befund 1 nicht.
3. **Kaderstärke „beste 6“ (Anzeige, Draft-Reihenfolge, Vorstandserwartung) ↔ Belastung v2 + ungedeckelter Spielplan**
   (Befund 4): die Anzeige misst Qualität, die Saison belohnt Tiefe; Erwartung und Ergebnis laufen in S1/S2 auseinander,
   was wiederum Vertrauen und Ziele verzerrt.
4. **Feste PP- und E1-Anker ↔ Motoränderungen im Tagesrhythmus** (Befunde 3 und 5): jede Wertungsänderung der Welle 4
   verschiebt die Verteilung, nachkalibriert wurde nur, wer den Anker ausdrücklich mitzog (Battlefield, Hockey, Basketball).
   PP fließen in Marktwert, Training und MVP weiter.

---

## 5. Offene Fragen an Chris

1. **Vorstand:** Soll die Quote auch dann gelten, wenn ein Team unter seiner Wunsch-Kadergröße ist (nur der Pflichtkader 8
   ist immer frei), oder soll ein dünner Kader die Quote aushebeln dürfen?
2. **Kadertiefe:** Ist gewollt, dass in Saison 1–2 die Kadergröße mehr über die Tabelle entscheidet als die Stärke der
   besten 6? Wenn ja, soll die Kaderstärke-Anzeige Tiefe mit ausweisen?
3. **Moral:** Soll Moral spürbar auf die Leistung wirken (z. B. ± 2–3 %) oder bewusst vor allem Vertrags- und
   Gesprächsthema bleiben?
4. **Training:** Sind rund +1 % Attributsumme je Saison das gewünschte Tempo, oder soll man Entwicklung in einer Saison sehen?
5. **PP-Tagesanker:** Freigabe, den Prototyp (OLY-weiter Tagesanker, keiner mehr glatt auf 5) als neuen Saisonstempel ab der
   nächsten Saison scharf zu schalten?

---

## Anhang: Messwerte

### A1. PP je Disziplin (Langlauf, alle Spieler beider Ligen)

| Disziplin | Tagesbester PP (S1 / S2 / S3, je 2 Tage: Min–Max) | Spieler glatt auf 5,0 je Tag (S1 / S2 / S3) |
|---|---|---|
| basketball | 4,33–4,75 / 3,33–5,00 / 5,00–5,00 | 0 / 2 / 5 |
| battlefield | 5,00–5,00 / 4,94–5,00 / 4,79–5,00 | 1 / 0,5 / 0,5 |
| breaking | 5,00–5,00 / 5,00–5,00 / 5,00–5,00 | 4 / 11,5 / 30,5 |
| climbing | 5,00–5,00 / 5,00–5,00 / 5,00–5,00 | 15 / 16 / 16 |
| eiskunstlauf | 4,17–5,00 / 2,61–5,00 / 4,77–5,00 | 1 / 4,5 / 3,5 |
| fechten | 4,08–5,00 / 4,96–5,00 / 5,00–5,00 | 1 / 1 / 4,5 |
| football | 4,43–4,78 / 4,89–5,00 / 5,00–5,00 | 0 / 1 / 5,5 |
| gewichtheben | 4,56–5,00 / 5,00–5,00 / 5,00–5,00 | 2 / 6 / 4,5 |
| hockey | 4,63–5,00 / 5,00–5,00 / 5,00–5,00 | 1,5 / 8 / 4,5 |
| i-spy | 5,00–5,00 / 3,29–5,00 / 3,87–5,00 | 1 / 2 / 2 |
| mini-dm | 5,00–5,00 / 4,70–5,00 / 4,64–5,00 | 3,5 / 2,5 / 2,5 |
| showcase | 2,43–5,00 / 4,58–5,00 / 4,28–5,00 | 0,5 / 1 / 0,5 |
| speed-schach | 5,00–5,00 / 4,20–5,00 / 5,00–5,00 | 3 / 0,5 / 4 |
| spurt | 4,73–4,98 / 3,79–4,73 / 3,79–4,21 | 0,5 / 0 / 0 |
| staffel | 5,00–5,00 / 5,00–5,00 / 4,59–5,00 | 8 / 8 / 4 |
| takeshis-castle | 5,00–5,00 / 5,00–5,00 / 5,00–5,00 | 3,5 / 4 / 6 |
| tdm | 5,00–5,00 / 5,00–5,00 / 5,00–5,00 | 4 / 3,5 / 3 |
| tennis | 4,54–5,00 / 5,00–5,00 / 5,00–5,00 | 2 / 3 / 1,5 |
| time-trial | 5,00–5,00 / 5,00–5,00 / 5,00–5,00 | 15 / 12 / 16 |
| wettessen | 5,00–5,00 / 2,84–3,62 / 4,57–5,00 | 6 / 0 / 1,5 |

Disziplin-Tage mit mindestens drei Spielern glatt auf 5,0: 18 / 20 / 21 von 40. Disziplinen mit einem Tag, an dem der Beste unter 4 blieb: 1 / 5 / 2.

### A2. Ergebnisskala E1 je Disziplin (Duelle, Siegersicht)

„Median-Sieg“ = Median der Siegerwerte : Median der Verliererwerte (getrennt gerechnet, daher nicht immer gleich dem
Median-Abstand). Remis-Zeilen zählen beide Seiten (18 Zeilen = 9 von 32 Duellen).

| Disziplin | Median-Sieg S1 / S2 / S3 | Median-Abstand S1 / S2 / S3 | Anteil 10:0 S1 / S2 / S3 | Remis-Zeilen S1 / S2 / S3 |
|---|---|---|---|---|
| basketball | 7:2 / 7:1 / 7:3 | 5 / 5 / 3 | 0 % / 0 % / 19 % | 2 / 2 / 0 |
| breaking | 8:3 / 9,5:3 / 10:2 | 3 / 4 / 7 | 13 % / 13 % / 22 % | 0 / 0 / 0 |
| climbing | 8:3 / 10:1 / 10:1,5 | 5 / 9 / 8,5 | 28 % / 11 % / 40 % | 0 / 10 / 4 |
| eiskunstlauf | 5:1 / 7,5:0 / 7,5:3 | 3 / 5 / 4 | 3 % / 22 % / 3 % | 0 / 0 / 0 |
| fechten | 5,5:1 / 4:1 / 9:1 | 3,5 / 3 / 7 | 10 % / 10 % / 25 % | 4 / 2 / 0 |
| football | 6,5:3 / 7:2 / 8:3 | 3 / 5 / 5 | 7 % / 16 % / 19 % | 4 / 0 / 2 |
| gewichtheben | 7:1 / 6,5:0 / 6:1 | 4 / 3 / 2,5 | 0 % / 13 % / 9 % | 0 / 0 / 0 |
| hockey | 6:3 / 7:2 / 7:3 | 4 / 4 / 3,5 | 10 % / 10 % / 13 % | 6 / 2 / 4 |
| i-spy | 6:1,5 / 6:1 / 6:0 | 3 / 3 / 4 | 0 % / 9 % / 13 % | 0 / 0 / 0 |
| showcase | 3:1 / 6:3 / 3:1 | 2 / 2 / 2 | 0 % / 6 % / 0 % | 0 / 0 / 0 |
| speed-schach | 9:0 / 6:2 / 8:2 | 8 / 4 / 4 | 30 % / 0 % / 8 % | 18 / 18 / 14 |
| spurt | 7:2,5 / 7:2 / 7:3 | 4,5 / 5 / 4 | 9 % / 4 % / 0 % | 0 / 12 / 12 |
| tdm | 6:4 / 7,5:2,5 / 6:4 | 2 / 5 / 2 | 0 % / 16 % / 28 % | 2 / 0 / 0 |
| tennis | 8:1 / 8:0 / 5:0 | 2 / 8 / 2 | 3 % / 38 % / 19 % | 0 / 0 / 0 |
| time-trial | 8:2 / 7:3 / 7:3 | 6 / 3,5 / 4 | 6 % / 9 % / 16 % | 0 / 0 / 0 |
| wettessen | 8:0 / 4:0 / 7,5:2 | 5 / 3 / 4 | 22 % / 9 % / 6 % | 0 / 0 / 0 |

### A3. Wirtschaft und Kader über drei Saisons (Summen/Mittel über 32 Teams)

| Zeitpunkt | Σ Kasse | Kasse min / Median / max | Σ Schulden | Ø Kader | Σ Jahresgehalt | Σ Marktwert | Ø Kaderstärke (SD) | min / max | Liga 1 / Liga 2 |
|---|---:|---|---:|---:|---:|---:|---|---|---|
| S1 nach Draft | 578 | 7,9 / 16,1 / 36,3 | 0 | 11,9 | 2204 | 7342 | 45,9 (4,9) | 39,0 / 55,2 | 50,0 / 41,9 |
| S1 nach Spieltagen | 355 | −14,3 / 13,7 / 44,4 | 0 | 11,9 | 2137 | 7342 | 46,5 (4,9) | 39,5 / 55,8 | 50,7 / 42,4 |
| S2 nach Kaufphase | 442 | 5,2 / 11,8 / 41,7 | 9,4 | 10,9 | 1806 | 6832 | 45,0 (5,2) | 32,4 / 54,0 | 48,8 / 41,1 |
| S2 nach Spieltagen | 645 | −2,7 / 16,9 / 66,3 | 9,4 | 10,9 | 1798 | 6832 | 45,7 (5,3) | 32,9 / 54,8 | 49,7 / 41,8 |
| S3 nach Kaufphase | 499 | 5,8 / 13,1 / 57,6 | 33,1 | 10,8 | 1805 | 6794 | 44,8 (6,3) | 25,4 / 56,2 | 48,8 / 40,7 |
| S3 nach Spieltagen | 993 | −8,9 / 25,9 / 65,6 | 33,1 | 10,8 | 1796 | 6794 | 45,6 (6,5) | 25,8 / 57,7 | 49,8 / 41,4 |

Rangtreue der Kaderstärke von Saison zu Saison (Spearman): S1→S2 0,91, S2→S3 0,95. Rücklage nach der Kaufphase S2
(Kasse/Jahresgehalt, Median): Finanzwert < 4: 0,13 · 4–7: 0,22 · ≥ 7: 0,29 (richtung wie vorgegeben, erstes Fenster mit
halber Rücklage). Nach 20 von 32 Teams lag der Sponsor-Anker nach dem Draft S1 unter dem Jahresgehalt.

### A4. Form, Moral, Formkarten, Training, Verträge, Verletzungen

| | S1 | S2 | S3 | Live (S1, ST 1–11) |
|---|---|---|---|---|
| Verletzungen in der Saison | 172 | 156 | 142 | 92 |
| Verletzungen ST10 → ST11 (nach Pause) | 12 → 0 | 8 → 2 | 6 → 0 | – |
| Form P10 / Median / P90 | 20,7 / 49,4 / 68,6 | 26,7 / 48,4 / 65,0 | 25,9 / 49,9 / 64,5 | 22,9 / 50,3 / 67,1 |
| Moral P10 / Median / P90 | 36 / 50 / 60 | 36 / 51 / 61 | 37 / 51 / 61 | 37 / 50 / 60 |
| Anteil Moral „neutral“ | 73 % | 70 % | 74 % | 76 % |
| Formkarten mit Wert 0 | 201 / 764 | 180 / 700 | 184 / 688 | 176 / 752 |
| Trainingszuwachs je Spieler und Spieltag | 0,29 | 0,30 | 0,33 | 0,32 |
| Trainingsziel vom Manager gesetzt | – | – | – | 0 von 4136 Einträgen |
| In-Saison-Verlängerungen (Teams) | 94 (24)* | 29 (13) | 35 (13) | – |
| KI-Aufstellung: Eignung / beste mögliche (Median, P10) | 0,947 / 0,740 | 0,943 / 0,738 | 0,946 / 0,728 | – |

\* Blocklauf-Draft, in der App wären S1-Draft-Picks gesperrt (Befund 9).

### A5. Werkzeuge

- `scripts/sonde-gameplay-review.ts <saveId> <out.json>` (neu, liest nur): PP je Disziplin-Tag, E1-Verteilung, Tabelle,
  Verletzung/Belastung, Form/Moral, Formkarten, Training, Verträge, Stempel. Immer mit `OLY_APP_SQLITE_PATH` auf eine Kopie.
- Langlauf: `OLY_APP_SQLITE_PATH=<wegwerf> OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 npx tsx scripts/miss-teamfinanzen-saison.ts --mode battle --seasons 3 --out <lauf.json> --keep`
  (51 min); Kopien nach jeder Saison per SQLite-Backup, sobald `s<N>_03_nach_spieltagen` im Lauf-JSON steht.
- Die Auswertungen zu Favoritenquote, Residuum gegen Kadergröße, Aufstellungsquote, Verhältnis-Anteil und Kaufqualität
  waren kurze Python-Skripte über dieselben Kopien (Tabellen `season_states`, `players`, `rosters`, `transfer_history`);
  die Formeln stehen jeweils im Befund.

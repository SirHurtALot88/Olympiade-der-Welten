# Vertragswert, Laufzeit 1–5, Rollen-Etikett raus: Bau (25.11.)

**Auftrag (Chris, 25.11.):** „Kannst du das bitte noch einbauen? Also heute.“ Quelle: `docs/design/kauf-vertrag-gesamtkonzept-25-11.md`,
verbindlich ist dort Abschnitt 12. Baut auf `docs/design/verkauf-restgehalt-24-11.md` Abschnitte 7–10 (#1745) auf.

**Kurz:**

1. Das Rollen-Etikett („Stammspieler / Bank / Nachwuchs“, Feld am Kadereintrag) ist komplett raus — Typ, Kaufwege, Verlängerung,
   Moral, Vorstandsvertrauen, Sponsorziel, Anzeigen, Filter, Prisma-Schema samt Migration, Daten, Skripte, Tests. Gilt sofort (Fehler,
   keine Spielregel); alte Spielstände verlieren das Feld beim Laden.
2. Der **Vertragswert W** entscheidet mit Stempel `vertragsPlan` Kaufen (Laufzeit 1–5 und Form je Angebot), Verlängern, Halten,
   Verkaufen und Vertragsauflösung. Er ersetzt die feste Sperre „Restgehalt netto ≥ 0,9 × MW“ in Abwägung, Umbau und Tausch.
3. Die Verhandlungsansicht zeigt die Erwartung (besser / gleich / schlechter, im Scouting-Nebel gestuft), den Formkarten-Beitrag, den
   Jahresplan und „Ausstieg kostet“ je Vertragsjahr; Laufzeit bis 5 Jahre wählbar.

---

## 1. Rollen-Etikett entfernt (Abschnitt 12, erste Zeile)

Chris: „Lösch das mal und guck mal, dass da auch keine Code-Rückstände sind.“ Jeder Kaufweg schrieb „Nachwuchs“, nichts setzte je
„Stammspieler“ (Abbild 25.11.: 327 von 328). Wo das Etikett Verhalten steuerte, bleibt das bis dahin **tatsächlich wirksame**
Verhalten (der Nachwuchs-Zweig) als Zahl stehen oder der Vertragswert übernimmt — kein Ersatz-Etikett.

| Fundstelle | Was es tat | Jetzt |
|---|---|---|
| `lib/data/olyDataTypes.ts` (`RosterEntry`) | Typfeld | entfernt; `lib/contracts/rollen-etikett-entfernen.ts` löscht es beim Laden (`save-repository.ts`), einzige Stelle mit dem alten Namen |
| `lib/contracts/contract-renewal-service.ts` `getRecommendedLength` | 5 Jahre nur „Stammspieler“ mit Top-40 und Kasse ≥ 40 | ohne Stempel: Nachwuchs-Grenzen (1–3, Top-40 2–4); mit Stempel: Laufzeit aus W, keine Rangsperre |
| ebd. `shouldAiRenewContract` (`usefulRoleSignal`, `hasRotationSignal`) | Bedingung „Stammspieler oder Nachwuchs“ (immer wahr) | Bedingung gestrichen, Signal unverändert |
| `lib/market/transfermarkt-local-service.ts` (2 Kaufwege), `lib/ai/ai-pick-import-service.ts`, `lib/admin/season-simulation-runner.ts`, `lib/season/draft-theme-gate-service.ts`, `lib/foundation/ensure-nula-on-project-suicide.ts`, `lib/ai/ai-needs-picks-compare-service.ts` (Simulation), `lib/season/team-strength-rank-reconstruction.ts`, `lib/data/dataAdapter.ts` | schrieben das Etikett | Zeile entfernt |
| `lib/market/transfermarkt-buy-service.ts`, `prisma/schema.prisma` | Prisma-Spalte + Enum | entfernt, Migration `20261125120000_drop_active_player_role_tag` |
| `lib/morale/player-morale-service.ts` | Erwartete Einsätze und Rollen-Stufe aus Versprechen, sonst Etikett | nur noch versprochene Rolle (`promisedRole`), sonst Stärke im Kader |
| `lib/ai/player-board-trust-service.ts` | Gewicht verfehlter Erwartung 1,25 / 0,8 / 0,55 | fester Wert 0,55 (der Nachwuchs-Wert, der praktisch immer galt); Einsatz-Abzug „Stammspieler“ (nie aktiv) gestrichen |
| `lib/ai/ai-transfermarkt-sell-preview-service.ts` | Bonus „kein Stammspieler“ 0,15 | fest 0,15 (galt immer) |
| `lib/ai/ai-manager-apply-service.ts` | Vertragsstrategie „extend_core“ für Stammspieler | Zweig gestrichen (nie aktiv) |
| `lib/sponsor/sponsor-objective-evaluator.ts` | „Eigengewächs“ = Etikett Nachwuchs (also jeder gekaufte Spieler) | nur versprochene Rolle „Talent“ oder Zugang über Draft/Nachwuchs — **Verhaltensänderung**: das Sponsorziel zählt keine Käufe mehr als Eigengewächs |
| `lib/training/player-progression-forecast.ts`, `scripts/season1-autoprep.ts` | Rolle für die Prognose | versprochene Rolle |
| `lib/ai/ai-full-repick-audit-service.ts`, `scripts/export-ai-full-repick-audit.ts` | Prüfspalte „Etikett-Exportfehler“ | entfernt |
| `lib/ai/ai-manager-doctrine-service.ts`, `lib/season/season-review-service.ts`, `lib/market/contract-negotiation-preview.ts`, `lib/market/transfermarkt-sell-service.ts`, `lib/db/*`, `lib/foundation/player-detail-drawer.ts`, `lib/foundation/team-detail-drawer-types.ts`, `lib/foundation/training-player-row-view.ts`, `lib/foundation/tabs/*` | Feld durchgereicht | entfernt |
| Teams-Seite (`FoundationTeamsNewLook`, `FoundationTeamsDetailPanel`, `FoundationTeamsViewHost`, `use-teams-*`, `use-foundation-*`) | Spalte „Rolle“, Filter Starter/Rotation/Bank, Panels „Starter“/„Bench“, Sortierung nach Etikett | Spalte, Filter und Sortierung entfernt; ein Panel „Kader“ |
| `TeamProfileNewLook`, `TrainingCompactNewLook`, `FoundationPlayerPortraitCard`, Verkaufsdialog (`FoundationMarketSellShellHost`, `transfer-sell-view-labels`) | Anzeige „Rolle …“ | entfernt (CSS der Spalte mit) |
| `data/generated/oly-rosters.json` | 261 Einträge | Feld entfernt |
| `scripts/*` (14 Rauch-/Audit-Skripte), `tests/*` (≈150 Fixtures) | Fixtures | Feld entfernt; Tests, die die Rolle prüften, auf `promisedRole` bzw. die Nachwuchs-Grenzen umgestellt |

Nicht angefasst: die alte Migration `20260602191500_init_supabase_foundation` (Historie), `references/project-snapshots/*` (Abbilder),
Mockups unter `public/mockups/`. `promisedRole` (Rollenversprechen in der Verhandlung) ist ein anderes Feld und bleibt (Konzept 2: „hier
nicht Thema“). Wächter: `tests/vertragswert.test.ts` Fall 1 verbietet den alten Feldnamen in `lib`, `app`, `components`, `scripts` und im
Prisma-Schema.

## 2. Der Vertragswert (Formel in drei Sätzen)

1. **W = Σ über die Vertragsjahre d^(t−1) × (B × M(t) + F − G(t)) + Fortsetzung**: Nutzen (Bedeutung im Team × Marktgehalt der Leistung
   im Jahr t, plus Formkarten-Beitrag) minus Gehalt **laut echtem Jahresplan** (front / ausgewogen / back), abgezinst mit der Geduld des
   Teams, plus am Vertragsende das Bessere aus „gehen lassen“ (Abgangswert 0,89 × MW) und „verlängern“ bis zum Horizont von 5 Jahren.
2. W wird für drei Verläufe (Marktwert je Saison besser / gleich / schlechter, ±18 %, bekannte Spieler ±13,5 %) gerechnet und nach der
   **Erwartung** gewichtet (Grundverteilung 30/40/30, verschoben durch Potenzial, Trainingsgüte, Trainingsvorlieben, Leistung im
   MW-Bracket, Form und Charakter; ±20 Punkte); die **Risikoscheu** des Teams (0,25–1) zieht einen Anteil des Abstands zum schlechten
   Verlauf ab (Sicherheitsäquivalent) — danach wird die Laufzeit gewählt und das Halten im Verkaufsurteil bewertet; die Verlängerung am
   Vertragsende rechnet mit dem Erwartungswert (der Ersatz trüge dasselbe Risiko).
3. Verkauft wird, wenn **Netto (Angebot − Restgehalt) > W** plus die Kosten aus #1745 (Ersatzrisiko, Wechsel, Tiefe, Marge, Verlustscheu
   am Preis); verlängert, wenn W des neuen Vertrags > Abgangswert − Ersatzkosten; gekauft und verlängert wird zum **Wunschpaar des
   Spielers** (Ideallaufzeit, Wunschform), und W entscheidet Abweichungen, sobald sie mindestens ein Jahres-Marktgehalt bringen.

**Keine Doppelzählung:** das Restgehalt steht im Netto (Verkäufer zahlt, Chris), dieselben Gehälter stehen beim Halten mit Minus in W;
im Vergleich hebt sich das Gehalt bis auf den Zeitwert auf (`tests/vertragswert.test.ts` Fall 4). Umbau und Tausch rechnen das Restgehalt
jenseits ihres Ein-Jahres-Horizonts zurück.

**Formkarte (Chris: „weil der dann dir eine passende Formkarte aus der Farbe mitbringt“):** F = 1,0 C je Saison × (Anteil der
Disziplinen dieser Farbe im Spielplan × 4) / (1 + Spieler derselben Klassenfarbe im übrigen Kader). Fehlt die Farbe, voller Beitrag;
jeder weitere Träger teilt ihn. F steckt in jedem Vertragsjahr und in der Verlängerung, also auch im Verkaufsurteil (der letzte Träger
einer Farbe geht schwerer).

**Rabatt unverändert (Chris: „haben wir ja schon drin“):** W liest das Jahresgehalt je (Laufzeit, Form) aus der bestehenden Logik
(`resolveContractLengthSalaryFactor` mit dem Wunschpreis aus `buildPlayerContractPreference`), nichts daran ist geändert.

**Charakter (Konzept 7):** aus `sellForProfitAggression`, `shortContractPreference`, `longContractPreference`, `loyaltyBias`,
`riskTolerance`, `cashPriority`, `wageSensitivity`, `starPriority` und der Team-Matrix (`finances`, `harmony`, `boardConfidence`):
Händler / Bewahrer / Sparer / Zocker; daraus Geduld 0,90–0,97, Optimismus ±0,08, Handel 0–1 (Bonus für front-loaded), Risikoscheu
0,25–1.

**Geländer:** Kasse eng → Kauf höchstens 2 Jahre (Premium 3) und back-loaded, Verlängerung höchstens 2 Jahre (Kasse unter halbem
Jahresgehalt); Moral-Grenze (`moraleContractLengthLimit`); Liquidität/Gehaltsberg (`wendeLiquiditaetUndMixAn`); **Vertragsenden
staffeln**: höchstens 40 % der Verträge eines Teams enden in derselben Saison (ab 5 Verträgen), sonst rückt die Laufzeit um ein Jahr.
Saison 1 bleibt beim Draft-Jahresvertrag und der bisherigen Kaufgrenze. Kein vorzeitiges Verlängern (nur auslaufende Verträge).

**Vertragsauflösung:** Restgehalt zahlt der Verkäufer — außer der Spieler bietet die Auflösung an (bestehender Weg, Teilverzicht). Die KI
nimmt sie an, wenn ihr Netto (Erlös − zahlbarer Rest) größer ist als W beim Halten (`decideAiContractDissolution`, Grund
`vertragswert_niedriger`). „Anbieten“ durch das Team gibt es nicht (der Spieler bietet an); nicht gebaut.

**Vertragsabsicht** (Kern / Handel / Test / Tiefe) wird beim Kauf berechnet und mit der Wahl zurückgegeben
(`bestimmeVertragsAbsicht`), aber nicht am Kadereintrag gespeichert; „erst testen, dann binden“ steckt in der Rechnung selbst (neu
gekaufte Spieler streuen mit ±18 %, bekannte mit ±13,5 %).

## 3. Regel-Stempel

`seasonState.wirtschaftsRegeln.vertragsPlan` (`lib/resolve/wirtschafts-regeln.ts`, Abfrage `wirtschaftsRegel(gs, "vertragsPlan")` bzw.
`vertragsPlanAktiv`): neues Spiel ab Saison 1, laufender Spielstand ab dem nächsten Saisonwechsel; setzt `verkaufSchwellen: neu` voraus.
Rückweg `OLY_KI_VERTRAGSPLAN=aus` (neue Saisons), Notbremse `OLY_KI_VERTRAGSPLAN=aus-sofort` (auch gestempelte Saisons). Bestehende
Verträge bleiben, wie sie sind. Ausnahme: das Rollen-Etikett ist sofort weg (Abschnitt 1). Die Arena-Engine ist nicht berührt.

## 4. Anzeige (Verhandlungstisch, kein neuer Screen)

`app/foundation/transfermarkt-modern/VerhandlungsTisch.tsx`, Kauf und Verlängerung:

- **Erwartung** (linke Spalte unter Team-Fit): ▲ eher besser / – eher gleich / ▼ eher schlechter. Nebel (`nebelStufeFuer`, auf dem
  Server): unbekannt → „? nicht gescoutet“; beobachtet → nur die Stufe, gerechnet ohne Potenzial und Vorlieben; gescoutet (eigener Kader
  immer) → Stufe und Anteile besser/gleich/schlechter. Dieselbe Rechenstelle wie die KI (`vertragswertAnzeige` → `vertragswertSpieler`),
  dieselbe Nebelregel gilt für die KI beim Kauf.
- **Formkarte**: Farbe und Beitrag in C je Saison.
- **Jahresplan** (vorhanden) und darunter **„Ausstieg kostet“** je Vertragsjahr (Restgehalt laut Plan, dieselbe Summe wie der Buyout).
- **Laufzeit 1–5** wählbar (vorher 1–4).

Mehrspieler: Daten kommen über die bestehenden Routen (`/api/transfermarkt/buy`, `/api/contracts/renewal`) für das anfragende Team
(`teamId` = aktives Team), Schreibwege unverändert hinter `authorizeServerRoomWrite`.

## 5. Messung

Wegwerf-SQLite, 32 KI-Teams von Anfang an, Saaten 1 und 7, Basis je Saat mit `main` gebaut (Kaderbau + 20 Spieltage Saison 1,
`scripts/miss-teamfinanzen-saison.ts --stop-after spieltage`), dann je Variante auf einer Kopie durchgehend: Saisonwechsel S1 → S2, die
20 Spieltage von Saison 2, Saisonwechsel S2 → S3 (Messweg wie `verkauf-restgehalt-24-11.md` 10.6). „neu“ = dieser Stand, Saison 1
gestempelt wie ein neues Spiel (`vertragsPlan: neu`); „main“ = `origin/main`. Der Lauf main/Saat 7 brach in S2 → S3 einmal am Speicher ab
(OOM bei vier gleichzeitigen Läufen) und wurde ab dem gespeicherten Saisonende fortgesetzt.

**Laufzeiten aller neuen Verträge (Käufe + Verlängerungen, beide Fenster zusammen), Anteil in %:**

| | 1 J. | 2 J. | 3 J. | 4 J. | 5 J. | n |
|---|---:|---:|---:|---:|---:|---:|
| main Saat 1 | 20,8 | 43,4 | 30,1 | 4,4 | **1,2** | 408 |
| main Saat 7 | 24,1 | 39,9 | 31,6 | 3,6 | **0,7** | 411 |
| **neu Saat 1** | 21,9 | 35,7 | 16,1 | 13,6 | **12,7** | 448 |
| **neu Saat 7** | 23,1 | 35,5 | 15,5 | 13,1 | **12,9** | 451 |

Ziel (jede Laufzeit ≥ 8 %, 5 Jahre 8–15 %): **erreicht** in beiden Saaten.

| S1 → S2 | main S1 | **neu S1** | main S7 | **neu S7** |
|---|---:|---:|---:|---:|
| Neue Verträge (Kauf / Verlängerung) | 370 (113 / 257) | 372 (85 / 287) | 369 (106 / 263) | 380 (91 / 289) |
| Laufzeit Kauf 1/2/3/4/5 % | 28 / 52 / 11 / 4 / 4 | 21 / 17 / 33 / 15 / 14 | 37 / 51 / 7 / 3 / 3 | 28 / 18 / 30 / 14 / 11 |
| Laufzeit Verlängerung 1/2/3/4/5 % | 9 / 42 / 43 / 5 / 0 | 19 / 40 / 11 / 16 / 15 | 9 / 40 / 46 / 5 / 0 | 18 / 40 / 13 / 15 / 15 |
| Form front / ausgewogen / back (≥ 2 J.) % | 88 / 9 / 3 | 22 / 60 / 18 | 61 / 37 / 3 | 21 / 62 / 17 |
| Wunsch: Laufzeit im Fenster / plus Form / klar verfehlt % | 87 / 29 / 2 | 91 / **82** / 3 | 86 / 38 / 3 | 91 / **82** / 5 |
| Vertragsenden (Abgang) | 115 | 85 | 94 | 68 |
| Gewinnverkäufe / Median Preis/MW | 59 / 1,26 | 55 / 1,32 | 42 / 1,24 | 40 / 1,24 |
| Käufe n / C | 113 / 2510 | 85 / 1931 | 106 / 2202 | 91 / 1981 |
| Kader 1. Spieltag min / Median / max (unter 8) | 8 / 11 / 14 (0) | 9 / 11 / 14 (0) | 9 / 12 / 14 (0) | 9 / 12,5 / 14 (0) |
| Δ Kasse + Kaderwert | −237 (−2,22 %) | −111 (−1,04 %) | −319 (−3,07 %) | −306 (−2,95 %) |
| Δ Stärke beste 6 je Team | +2,33 | +2,02 | +2,28 | +2,09 |
| Gehaltssumme Liga vorher → nachher | 1925 → 1933 | 1925 → 1879 | 1813 → 1941 | 1813 → 1911 |
| Teams mit allen vier Kartenfarben vorher → nachher | 18 → 27 | 18 → 23 | 20 → 22 | 20 → 25 |

| S2 → S3 | main S1 | **neu S1** | main S7 | **neu S7** |
|---|---:|---:|---:|---:|
| Neue Verträge (Kauf / Verlängerung) | 38 (16 / 22) | 76 (33 / 43) | 42 (17 / 25) | 71 (22 / 49) |
| **Verkäufe mit laufendem Vertrag (je Liga)** | **0 (0)** | **5 (2,5)** | **0 (0)** | **1 (0,5)** |
| Vertragsenden (Abgang) | 12 | 27 | 13 | 21 |
| Gewinnverkäufe / Median Preis/MW | 9 / 1,11 | 16 / 1,18 | 5 / 1,20 | 6 / 1,27 |
| Umbau (Planer am Vertragsende) / Cash-Verkauf | 1 / 0 | 3 / 0 | 0 / 0 | 1 / 1 |
| Tausch mit Kredit / Kredite | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Vertragsauflösungen | 3 | 2 | 4 | 1 |
| Kader 1. Spieltag min / Median / max (unter 8) | 9 / 11 / 14 (0) | 9 / 11,5 / 14 (0) | 9 / 12 / 14 (0) | 8 / 12 / 14 (0) |
| Δ Kasse + Kaderwert | −47 (−0,44 %) | −204 (−1,88 %) | −317 (−3,04 %) | −19 (−0,18 %) |
| Δ Stärke beste 6 je Team | +0,11 | +0,60 | −0,05 | +0,46 |
| Gehaltssumme Liga vorher → nachher | 1921 → 1861 | 1873 → 1861 | 1926 → 1883 | 1904 → 1896 |
| Teams mit allen vier Kartenfarben vorher → nachher | 27 → 25 | 23 → 27 | 22 → 25 | 25 → 25 |

**Lesart.**

- **Laufzeiten:** die Sperre durch das Rollen-Etikett ist weg; 5-Jahres-Verträge 12,7 / 12,9 % (main 1,2 / 0,7 %), jede Laufzeit über
  8 %. Die KI startet beim Wunschpaar des Spielers: Laufzeit und Form getroffen 82 % (main 29 / 38 %), klar verfehlt 3–6 %.
- **Formen:** front-loaded fällt von 61–88 % auf 21–47 %, ausgewogen 40–62 %, back-loaded 13–18 % (Ziel 20–40 / 40–60 / 10–25: front
  in S1 → S2 knapp darunter, S2 → S3 darüber).
- **Verkäufe mit laufendem Vertrag S2 → S3: 5 und 1 (main 0) — Ziel ≥ 10 je Liga NICHT erreicht.** Grund in der Spielmechanik:
  ein Vertragsende ist ein Verkauf mit Gutschrift (≈ 0,89 × MW). W enthält diese Gutschrift am Vertragsende; ein Verkauf mitten im
  Vertrag lohnt deshalb nur, wenn das Angebot klar über Abgangswert plus Nutzen der Restjahre liegt (bei einem Stammspieler mit 2
  Restjahren ≈ 1,3 × MW, bei einem Bankspieler ≈ 1,0 × MW), und die Angebote im Fenster liegen meist um den Marktwert. Mit dem
  Erwartungswert statt des Sicherheitsäquivalents beim Halten gab es gar keinen Verkauf mit Vertrag (Diagnose am Stand S3: 1 / 3 / 8
  Verkäufe ligaweit bei Risiko-Anteil 0 / 0,5 / 1). Die 0,9-Sperre ist ersetzt; mehr Verkäufe kämen nur über höhere Angebote oder eine
  geringere Gutschrift am Vertragsende — beides Chris-Entscheidungen (Abschnitt 7).
- **Liga-Wert:** innerhalb ±3 % außer main/S7 (−3,07 / −3,04 %); neu −1,04 / −2,95 % (S1 → S2) und −1,88 / −0,18 % (S2 → S3). Weniger
  Abgänge am Vertragsende und weniger Käufe in S1 → S2 (85–91 statt 106–113), dafür mehr Bewegung in S2 → S3 (71–76 neue Verträge statt
  38–42).
- **Kader:** kein Team unter 8 am 1. Spieltag. **Gehaltssumme** S1 → S2 −46 C bzw. −31 C gegen main (längere Verträge sind günstiger).
- **Formkarten:** Teams mit allen vier Farben nach S2 → S3: 27 / 25 (main 25 / 25), nach S1 → S2 23 / 25 (main 27 / 22) — gemischt.
- **Stärke beste 6:** S1 → S2 etwas geringer (+2,02 / +2,09 gegen +2,33 / +2,28; weniger Käufe), S2 → S3 höher (+0,60 / +0,46 gegen
  +0,11 / −0,05).

Kalibrierung (Fälle aus dem Basis-Abbild, 773 Spieler: Kader als Verlängerung, 400 freie als Kauf): ohne Wunsch-Startpunkt und
Risikoscheu wählte W fast nur 1 oder 5 Jahre (25 / 0 / 0 / 2 / 73 %), weil der bestehende 5-Jahres-Rabatt (62–78 %) die Rechnung dominiert;
mit Risikoscheu 0,25–1, Marktwert-Streuung ±18 % und Wunschpaar als Start (Abweichen ab einem Jahres-Marktgehalt Vorteil) 21 / 38 / 13 /
15 / 14 %.

## 6. Tests und Prüfungen

- `tests/vertragswert.test.ts` (18 Fälle): Wächter gegen das Rollen-Etikett (lib, app, components, scripts, Prisma-Schema) und
  Lade-Migration; Jahresplan statt linear (front-loaded im 4. von 5 Jahren 10,09 statt 14,42 C Ausstieg, back-loaded 18,75 C); W über
  offene Jahre nach Plan; Chris' Beispiele (15 C Angebot / 1 Jahr / 10 C Gehalt: bei 12 C MW Verkauf, bei 15 C MW halten, fallender MW
  Verkauf; 8 C × 4 J. bei 25 C MW, Angebot 40 C: Stammspieler bleibt, Bankspieler geht); keine Doppelzählung (3 C mehr Gehalt je Jahr
  verschiebt den Vorteil < 1,5 C); Formkarte (günstiger Bankspieler mit fehlender Farbe 5 Jahre, ohne kurz; Grenznutzen halbiert/viertelt);
  jede Laufzeit 1–5 wählbar; Vertragsauflösung mit Teilverzicht angenommen, wo der Verkauf mit vollem Rest nicht lohnt; Stempel, Rückweg
  `aus`, `aus-sofort`, Altstempel = alt; Geländer 40 %; Erwartung; Charakter; Kaufangebot (1–5 ab Saison 2, Kasse eng ≤ 2 und back-loaded,
  Saison 1 unverändert); Sicherheitsäquivalent.
- Bestehende Tests der Schicht #1745 (`verkauf-kosten-nutzen`, `verkauf-restgehalt`, `verkauf-team-blick`, `verkauf-keine-groessenbremse`)
  laufen mit `vertragsPlan: alt` im Stempel, weil sie genau diese Schicht prüfen.
- Angepasst wegen des Etiketts: `contract-renewal-service` (Nachwuchs-Grenzen statt Rollen-Grenzen), `player-morale-service`
  (Rolle über `promisedRole`), `player-progression-forecast` (Rolle über das Feld `role` der Fixture), `transfermarkt-local-service`
  (Kauf schreibt kein Etikett), ≈150 Fixtures.
- Lauf über alle betroffenen Testdateien (313 Dateien, 3019 Tests): grün bis auf die beiden danach behobenen Fälle
  (`player-progression-forecast`, `transfermarkt-modern-vertraege`) und den während des Laufs geänderten `vertragswert.test.ts`; diese drei
  danach einzeln grün.
- `npx tsc --noEmit -p tsconfig.next.json` fehlerfrei; eslint ohne Fehler; Client-Bundle (`FoundationPageClient`) ohne `node:`-Import.
- Wertungs-Fingerabdruck (`--node`): **GESAMT `fe1dc086d68d`** unverändert, alle Nebensummen unverändert.

## 7. Abweichungen vom Konzept und offen

- **Verkäufe mit laufendem Vertrag ≥ 10 je Liga** nicht erreicht (2,5 / 0,5), siehe Messung. Hebel, falls gewollt: Gutschrift am
  Vertragsende (Abgangswert) senken oder Angebote im Fenster über den Marktwert heben — beides ändert die Wirtschaft über den Vertragswert
  hinaus, deshalb nicht ohne Chris.
- **Rollen-Etikett und Moral:** ohne Versprechen richtet sich die Rollenerwartung der Moral jetzt nach der Stärke im Kader (vorher fast
  immer „Nachwuchs“ = Tiefe); erwartete Einsätze ohne Versprechen 4 statt 2. Kleine Verschiebung der Moral, gewollt (kein Ersatz-Etikett).
- **Sponsorziel „Eigengewächse“** zählt gekaufte Spieler nicht mehr (vorher zählte jeder Kauf über das Etikett) — Verhaltensänderung.
- **Vertragsabsicht** (Kern / Handel / Test / Tiefe) wird beim Kauf berechnet, aber nicht am Kadereintrag gespeichert; Messung „Testphase
  40–70 % danach ≥ 3 Jahre verlängert“ und „Bewahrer − Händler ≥ 1,0 Jahre“ nicht gemessen.
- **„Anbieten“ der Vertragsauflösung durch das Team** gibt es im Spiel nicht (der Spieler bietet an); die KI nimmt nach W an.
- **Mittlere Rabattkurve / Rabatt nach Wunsch** (Konzept Abschnitt 5): bewusst nicht gebaut (Chris: nichts ändern).
- **Formen:** front-loaded in S1 → S2 21–22 % (Ziel 20–40), S2 → S3 42–47 % (über dem Ziel); der Gehaltsberg wurde nicht eigens gemessen.
- **Vertragsenden staffeln** ist eingebaut (40 %-Geländer), aber nicht eigens gemessen.
- **Basis** der Messung wurde mit main gebaut (Saison 1 inklusive Draft und Spieltage); der Vertragsplan wirkt in „neu“ ab dem
  Saisonwechsel S1 → S2. Die Käufe von Saison 1 sind in beiden Varianten gleich (Saison-1-Käufe bleiben ohnehin beim bisherigen Weg).

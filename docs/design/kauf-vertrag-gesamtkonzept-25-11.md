# Kaufen, verlängern, halten, verkaufen: ein Vertragsmodell für alle vier Entscheidungen (25.11.)

**Auftrag (Chris, 25.11.):** „Was muss man alles bedenken, wenn man einen Spieler kauft? … aus sportlicher Sicht, so wie bei Football
Manager … Und was für Stats haben wir davon? Und das muss halt so ein Gesamtkonzept sein.“ Dazu: Laufzeiten 1 bis 5 Jahre als Hebel
(lang = Rabatt und Bindung, kurz = teurer, aber Gewinnchance), Restgehalt als Kosten, nicht linear abschreiben, sondern nach dem
echten Jahresplan des Vertrags, breite Spielerwünsche, KI geht darauf ein oder testet erst.

**Stand:** Konzept, kein Code. Baut auf PR #1745 auf (`docs/design/verkauf-restgehalt-24-11.md` Abschnitte 7–10: Kosten-Nutzen-Verkauf,
Team-Blick, Risiko-Kredit, Tiefen-Aufstockung) und ersetzt davon nur eine Regel (die 0,9-Sperre, Abschnitt 3.3).

**Kurz:**

1. Fast alles, was Chris beschreibt, gibt es schon als Einzelteil: Wunschlaufzeit 1–5, Wunschform, Rabatt für Laufzeit (5 Jahre im
   Mittel −28 %), Jahresplan je Vertrag, Restgehalt nach Jahresplan. Es fehlt die **eine Rechnung**, die alle vier Entscheidungen
   verbindet.
2. Diese Rechnung ist der **Vertragswert W**: was der Spieler dem Team über die Restjahre bringt, minus Gehalt laut Jahresplan, plus
   Abgangswert am Vertragsende. Kaufen, Laufzeit wählen, verlängern, halten, verkaufen fragen alle dieselbe Zahl.
3. Die KI vergibt nie 5 Jahre wegen eines **Code-Fehlers**, nicht wegen der Spielerwünsche (Abschnitt 1.3).

---

## 1. Bestand (nachgesehen und nachgemessen)

Gemessen am Live-Abbild vom 25.11. (`origin/live-save`, Spielstand „19.8.2026“, Saison 2, 2984 Spieler, 328 Verträge).

### 1.1 Was es gibt

| Baustein | Fundstelle | Befund |
|---|---|---|
| Vertragsform | `ContractShape` (`lib/data/olyDataTypes.ts:34`), `buildShapeWeights` (`lib/market/contract-negotiation-preview.ts:429`) | `balanced`, `front_loaded`, `back_loaded`. Schritt 20 % je Jahr um die Mitte: 5 Jahre 140/120/100/80/60 %, 3 Jahre 120/100/80 %. Die Summe bleibt gleich. |
| Jahresplan | `RosterEntry.yearlySalarySchedule`, `buildContractSalarySchedule` (`:449`) | Jedes Vertragsjahr hat seinen Betrag. `salary` ist die Rate des laufenden Jahres, `negotiatedAnnualSalary` der Durchschnitt (Apron-Grundlage). |
| Restgehalt / Buyout | `calculateOpenBuyoutCost` (`:551`), `resolveTransfermarktSellProceeds` (`lib/market/transfermarkt-sell-proceeds.ts`), Fenster `lib/market/contract-buyout-season-window.ts` | **Schon nach Jahresplan**: Summe der offenen Jahre, nicht Durchschnitt × Jahre. Vor Spieltag 1 zählt das laufende Jahr mit. Der Verkäufer zahlt alles. |
| Rabatt für Laufzeit | `RETOOL_STANDARD_CONTRACT_SALARY_RANGES` (`:1387`), `resolveContractLengthSalaryFactor` (`:1549`) | Spannen je Spieler (Hash): 1 J. 92–108 %, 2 J. 86–102 %, 3 J. 78–94 %, 4 J. 70–86 %, 5 J. 62–78 %. Gemessenes Mittel: **1,00 / 0,945 / 0,873 / 0,798 / 0,721**. Trait `mercenary`: flacher (5 J. 78–94 %). |
| Sicherheits-Rabatt bei Verlängerung | `resolveLengthSecurityDiscount` (`lib/contracts/contract-renewal-service.ts:333`) | Ab 3 Jahren, zufriedener Spieler in loyalem Team: bis −15 %. |
| Spielerwunsch | `buildPlayerContractPreference` (`:617`) | Aus Traits und Hash: Laufzeit kurz/mittel/lang mit Wunschzahl 1–5 und Fenster (kurz 1–2, mittel 2–4, lang 3–5), Wunschform. Treffer −2,5 % (lang −4 %), Fenster knapp verfehlt 0 bis +1,5 %, klar verfehlt +6 % (lang +7,5 %), falsche Form +2 %. Gedeckelt −6 bis +8 %. |
| Moral begrenzt Laufzeit | `getContractLengthLimit` (`lib/morale/player-morale-service.ts:228`) | Moral unter 42: höchstens 2 Jahre, unter 25: 1 Jahr. `contractIntent` kann Verlängerung verweigern. |
| KI-Wahl beim Kauf | `recommendContractOfferForPlayer` (`:753`) | Start beim Spielerwunsch, dann Team-Regeln: Kasse eng → höchstens 2–3 Jahre, back-loaded; GM mit `shortContractPreference` ≥ 8 → höchstens 2; `longContractPreference` ≥ 8 → mindestens 3; teuer und riskant → höchstens 4; Saison 1 → höchstens 3 (`seasonOneCap`, `:1011`). |
| KI-Wahl bei Verlängerung | `getRecommendedLength` (`contract-renewal-service.ts:281`), `resolveContractRenewalTco` (`:386`), `chooseAiRenewalContractShape` (`:835`) | Wunschzahl des Spielers, begrenzt nach `roleTag`. Kostenvergleich Verlängern gegen Ersatz: `Gehalt × Jahre` (`:430`) — **linear, ohne Form, ohne Blick auf den Marktwert-Verlauf**. |
| Form nach Teamlage | `wendeLiquiditaetUndMixAn` (`lib/market/contract-shape-context.ts:132`) | Kasse leer → nicht front-loaded; Gehaltsberg über 0,15 → nicht noch ein back-loaded. Gilt für alle drei Formwähler. |
| Verlängern in der Saison | `lib/contracts/ki-verlaengerung-in-saison.ts`, `verlaengerung-in-saison.ts` | Nur auslaufende Verträge, Mindestlaufzeit 2, Mensch und KI über denselben Dienst. |
| Verkauf als Abwägung | PR #1745, `planOrganicSellsForTeam` (`lib/ai/organic-squad/draft-adapter.ts`) | Vorteil in C je Spieler, Team-Blick, Umbau-Pläne. Spieler mit offenem Restgehalt nur bei netto ≥ 0,9 × MW. |
| Vertragsende | `buildContractExitValue`, CLAUDE.md „Vertragsende ist ein Verkauf“ | Ablösefreier Verkauf über denselben Preisweg; gemessen 0,89 × MW Gutschrift. |

### 1.2 Was die Spieler wollen (alle 2984)

| Wunschlaufzeit | 1 J. | 2 J. | 3 J. | 4 J. | 5 J. |
|---|---:|---:|---:|---:|---:|
| Anteil | 17,6 % | 40,5 % | 17,0 % | 12,8 % | **12,1 %** |

| Wunschform | ausgewogen | front-loaded | back-loaded |
|---|---:|---:|---:|
| Anteil | 51,4 % | 34,0 % | 14,6 % |

Die Verteilung ist breit, wie Chris es will, und sie hängt nicht am Marktwert (Top 150 nach MW: 5 Jahre 18,7 %, 1 Jahr 16,7 %).
Eine Lücke: wer lang will, will fast immer ausgewogen (5 J./front 30 Spieler, 4 J./front 3 von 2984), weil dieselben Traits beides
steuern.

### 1.3 Warum die KI nie 5 Jahre vergibt

**Code, nicht Verteilung.** 12 % der Spieler wünschen sich 5 Jahre, bekommen sie aber nicht:

1. **Verlängerung** (der größte Strom: 339 von 366 Verträgen nach Saison 1). `getRecommendedLength` erlaubt 5 Jahre nur für
   `roleTag === "starter"` mit Top-40-Rang und Kasse ≥ 40 C. Jeder Kaufweg schreibt aber `roleTag: "prospect"`
   (`lib/market/transfermarkt-local-service.ts:2984` und `:3104`, `lib/ai/ai-pick-import-service.ts:353`,
   `lib/admin/season-simulation-runner.ts:851`), und nichts setzt je „starter“. Am Abbild: **327 von 328 Einträgen „prospect“, 0
   „starter“**. Für „prospect“ gilt höchstens 3, mit Top-40-Rang 4. Genau das zeigt die Messung aus #1745: neue Laufzeiten
   1/2/3/4/5 = 38/134/154/13/**0**.
2. **Saison 1:** Draft-Verträge sind fest 1 Jahr (Absicht), Käufe gedeckelt auf 3.
3. **Käufe ab Saison 2:** 5 Jahre sind möglich, wenn der Spieler sie will und keine Bremse greift (Kasse eng, teuer und riskant,
   vorsichtiger GM). Am Abbild 4 von 328 Verträgen (1,2 %), in älteren Ständen 3 bis 7.

### 1.4 Was fehlt

| Lücke | Folge |
|---|---|
| Keine Rechnung über die **Restjahre**. Die Verkaufs-Abwägung (#1745 Abschnitt 9) rechnet mit dem Gehalt des laufenden Jahres, der Planwert mit „ein Jahr Gehalt“, die Verlängerung mit `Gehalt × Jahre`. | Ein front-loaded Vertrag im 4. Jahr (billig) und ein back-loaded im 4. Jahr (teuer) werden gleich behandelt. |
| Restgehalt wird beim Verkauf abgezogen, das Gehalt beim Halten aber nicht gegengerechnet. | Doppelzählung: ab Saison 2 verkauft die KI praktisch keinen Spieler mit Vertrag mehr (#1745 Abschnitt 10.5: S2 → S3 nur 13–16 Abgänge je Liga, Umbau-Pläne nie vollzogen). |
| Keine **Erwartung**, wohin sich Marktwert und Leistung entwickeln. | Die Laufzeit folgt Rolle und Kasse, nicht der Frage „wird er besser oder schlechter?“. Kurz kaufen, um teurer zu verkaufen, kann die KI nicht planen. |
| Der Spielerwunsch ist billig. Gegen den Wunsch 5 Jahre: 0,72 + 0,06 + 0,02 = rund 0,80 — immer noch 20 % unter einem Jahr. | „Auf den Spieler eingehen spart viel Geld“ stimmt heute kaum (2,5–4 %). |
| „Erst testen“ gibt es nur in Saison 1 als Deckel, nicht als Entscheidung. | Kein Zusammenhang zwischen unsicherer Passung und kurzer Laufzeit. |

---

## 2. Was andere Spiele und der echte Sport tun (nur Übertragbares)

| Quelle | Mechanik | Für uns |
|---|---|---|
| Football Manager | Spieler und Berater haben Wunschlaufzeit und Gehaltsvorstellung; wer davon abweicht, zahlt mit Gehalt, Bonus oder Klauseln. Junge Talente unterschreiben lang, wollen aber Ausstiegsklauseln; wer 1 Jahr Rest hat, wird verkauft, weil er sonst ablösefrei geht. | Wunsch als Preis: ja (haben wir, zu schwach). „Mit 1 Jahr Rest verkaufen“: **nein** — bei uns bringt das Vertragsende den Abgangswert (0,89 × MW), der Druck entfällt. |
| OOTP Baseball | Gebote mit freiem Jahresplan (front/back), Team- und Spieleroption, Spieler wägen Gesamtsumme gegen Laufzeit. Bewertung über „Surplus Value“: Wert der Leistung minus Gehalt je Vertragsjahr. | Der Kern dieses Konzepts: Vertragswert je Jahr nach Plan (Abschnitt 3). |
| NBA 2K (GM) | 1–5 Jahre, steigende oder fallende Jahresraten, Optionsjahre; lange Verträge schlechter Spieler sind „tote“ Last, die man nur mit Aufpreis loswird. | Bestätigt: lang = Bindung. Bei uns zahlt der Verkäufer das ganze Restgehalt, die Last ist also noch härter. |
| FC-Karriere | Laufzeit 1–5, Gehalt + Prämien, Rolle als Versprechen. | Rollenversprechen gibt es (`promisedRole`), hier nicht Thema. |
| Echter Sport | „Prove-it-Deal“: 1 Jahr zum vollen Preis, danach lang; Kurzvertrag = Option, wertvoll bei Unsicherheit; lange Verträge frieren das Gehalt ein, bevor der Spieler teurer wird. | Laufzeit als Wette auf die Entwicklung (Abschnitt 4), „erst testen“ (Abschnitt 4.3). |

---

## 3. Die eine Rechnung: der Vertragswert

### 3.1 Begriffe

| Zeichen | Bedeutung | Quelle heute |
|---|---|---|
| G(t) | Gehalt im Vertragsjahr t laut Jahresplan | `yearlySalarySchedule` |
| Rest | Summe der offenen G(t) | `calculateOpenBuyoutCost` |
| M(t) | Marktgehalt: was diese Leistung im Jahr t für ein Jahr kosten würde | `resolvePlayerEconomyContract().expectedSalary` am erwarteten Marktwert (Liga-Median 0,27 × MW) |
| B | Bedeutung für dieses Team (0,35 bis 1,6) | #1745: Stärke nach Team-Bedarf / Kader-Median |
| A | erwarteter Abgangswert am Vertragsende | erwarteter MW × Verkaufsfaktor (gemessen 0,89) |
| P | Angebot heute | `estimateRealizedSellPrice` |

    Vertragswert  W = Summe über die Restjahre ( B × M(t) − G(t) )  +  A

W ist, was der laufende Vertrag dem Team noch wert ist: Nutzen minus Gehalt, Jahr für Jahr nach Plan, plus das Geld am Ende.
Spätere Jahre zählen mit einem Geduldsfaktor (0,90 bis 0,97 je Jahr, je nach Team, Abschnitt 5); die Beispiele rechnen ohne ihn.

### 3.2 Vier Entscheidungen, eine Zahl

| Entscheidung | Regel |
|---|---|
| **Kaufen** | Für jede Laufzeit 1–5 und jede Form: W(Laufzeit, Form) − Kaufpreis. Das beste Paar wird angeboten; ist auch das beste negativ, wird nicht gekauft. |
| **Verlängern** | W des neuen Vertrags (ohne Kaufpreis) gegen „auslaufen lassen“ = Abgangswert jetzt. Ersetzt `Gehalt × Jahre` in `resolveContractRenewalTco`. |
| **Halten** | Nichts tun, solange kein Angebot W schlägt. W wird je Fenster neu gerechnet (Trend kippt, Kasse wird knapp). |
| **Verkaufen** | Wenn **Netto-Erlös = P − Rest** größer ist als **W** (plus Marge, Risiko und Tiefenkosten aus #1745). |

**Keine Doppelzählung.** Das Restgehalt bleibt Kosten des Verkaufs, wie Chris sagt — es steht im Netto-Erlös. Dasselbe Gehalt zahlt
das Team aber auch, wenn es hält; darum steht es in W mit Minus. Kürzt man, bleibt: verkaufen lohnt, wenn das Angebot mehr bringt
als der Nutzen der Restjahre plus der Abgangswert am Ende. Der Jahresplan entscheidet, **wie viel sofort in der Kasse ankommt**
(wichtig für Vorstands-Freigabe und Kassendruck); **ob** sich der Verkauf lohnt, entscheidet die Erwartung.

### 3.3 Zahlenbeispiele

**a) Chris' Beispiel: Angebot 15 C, 1 Jahr Rest, Gehalt 10 C.** Kasse sofort 15 − 10 = **+5 C** (seine Rechnung, stimmt).
Vergleich mit Halten (B = 1):

| Fall | M | A | W = M − 10 + A | Netto 5 gegen W | Urteil |
|---|---:|---:|---:|---|---|
| MW 15, bleibt (Angebot = MW) | 4,0 | 13,4 | 7,4 | 5 < 7,4 | halten |
| MW 12, bleibt (Angebot 1,25 × MW) | 3,2 | 10,7 | 3,9 | 5 > 3,9 | verkaufen |
| MW 15, fällt auf 11 | 4,0 | 9,8 | 3,8 | 5 > 3,8 | verkaufen |

Der Gewinn von 5 C ist echt. Ob er reicht, hängt daran, was der Spieler am Vertragsende noch bringt.

**b) Front-loaded im 4. von 5 Jahren.** Chris' Spieler mit 10 C Marktgehalt, 5 Jahre zum Mittelwert 0,721 = 7,21 C je Jahr,
Summe 36,05 C in allen drei Formen.

| Vor Jahr … | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|
| Rate front-loaded | 10,09 | 8,65 | 7,21 | 5,77 | 4,33 |
| Rate back-loaded | 4,33 | 5,77 | 7,21 | 8,65 | 10,09 |
| Restgehalt front-loaded | 36,05 | 25,96 | 17,31 | **10,10** | 4,33 |
| Restgehalt ausgewogen (= linear) | 36,05 | 28,84 | 21,63 | 14,42 | 7,21 |
| Restgehalt back-loaded | 36,05 | 31,72 | 25,95 | **18,74** | 10,09 |

Im 4. Jahr kostet der Ausstieg front-loaded 10,10 C statt 14,42 C linear (−30 %), back-loaded 18,74 C (+30 %). Bei einem Angebot
von 30 C sind das 19,90 C gegen 11,26 C sofort in der Kasse. Ein echter Vertrag vom Abbild: 5 Jahre, verhandelt 5,90 C,
Plan 8,26 / 7,08 / 5,90 / 4,72 / 3,54 — im 4. Jahr Rest 8,26 C statt 11,80 C.

**c) 8 C × 4 Jahre bei 25 C Marktwert** (Rest 32 C, Marktgehalt 6,75 C — der Vertrag ist teurer als der Markt).

| Fall | Nutzen B × Summe M | A | W | Angebot 40 C (netto +8) | Verkaufen ab |
|---|---:|---:|---:|---|---:|
| Stammspieler (B = 1), MW bleibt | 27,0 | 22,3 | 17,3 | halten | 49 C |
| Bankspieler (B = 0,5), MW bleibt | 13,5 | 22,3 | 3,8 | verkaufen | 36 C |
| Stammspieler, MW fällt auf 15 | 23,0 | 13,4 | 4,3 | verkaufen | 36 C |

Die 0,9-Sperre aus #1745 (netto ≥ 0,9 × MW, also ab 54,5 C) behandelt alle drei Fälle gleich. Mit W bleibt der Stammspieler
(fast gleiche Linie), der Bankspieler und der Absteiger dürfen gehen. **Vorschlag: W ersetzt die 0,9-Sperre** — das ist die Antwort
auf die offene Frage 1 in #1745 Abschnitt 10.6. Alles andere aus Abschnitt 9 und 10 bleibt: Haltewert und Gehaltsbilanz werden
über die Restjahre summiert statt für ein Jahr gerechnet.

---

## 4. Laufzeit als Werkzeug

### 4.1 Was lang und kurz kosten (Spieler mit 10 C Marktgehalt)

| Laufzeit | Gehalt je Saison | Summe | gespart gegen 1-Jahres-Verträge | Restgehalt nach Jahr 1 |
|---|---:|---:|---:|---:|
| 1 Jahr | 10,00 | 10,00 | – | 0 |
| 2 Jahre | 9,45 | 18,90 | 1,10 | 9,45 |
| 3 Jahre | 8,73 | 26,19 | 3,81 | 17,46 |
| 4 Jahre | 7,98 | 31,92 | 8,08 | 23,94 |
| 5 Jahre | 7,21 | 36,05 | **13,95** | 28,84 |

Das ist Chris' Rechnung („über 5 Jahre 15 gespart“) mit den Zahlen, die im Spiel schon gelten.

| | Lang (4–5) | Kurz (1–2) |
|---|---|---|
| Gewinn | Rabatt bis 28 %; Gehalt eingefroren, auch wenn der Spieler besser und teurer wird | Jedes Jahr frei: zum Abgangswert gehen lassen, teurer verkaufen oder neu verhandeln |
| Preis | Bindung: ein Verkauf kostet das Restgehalt; wird er schlechter, zahlt man weiter und bekommt am Ende weniger | Volles Gehalt; wird er besser, kostet die Verlängerung mehr |
| Passt zu | sicherem Kernspieler, hohe Passung, gute Moral | unsicherer Passung, schwankender Leistung, Handelsabsicht |

Verletzungen sind bei uns kurz (1 Spieltag aus, 1 Spieltag Erholung, `lib/fatigue/fatigue-injury-service.ts`). Das Risiko eines
langen Vertrags ist deshalb vor allem **Leistungsabfall** (je Saison werden 30 % der Spieler schwächer, 10 % deutlich) und **Moral**.

### 4.2 Die Wette in Zahlen

Spieler mit 30 C MW, Marktgehalt 8 C, B = 1. Vergleich über drei Saisons: ein 3-Jahres-Vertrag (0,873 × 8 = 6,98 C, Summe
20,95 C) gegen dreimal ein Jahr.

| Verlauf | Dreimal 1 Jahr | Einmal 3 Jahre | Vorteil lang |
|---|---|---|---:|
| **wird besser** (MW 30 → 35 → 40) | zahlt 8,0 + 9,3 + 10,0 = 27,3 C | zahlt 20,95 C | **+6,4 C** |
| **wird schlechter** (MW 30 → 25 → 20) | zahlt 8 C, lässt ihn nach Jahr 1 gehen: Abgangswert 22,3 C | zahlt 20,95 C für Nutzen 20,7 C; Abgangswert erst nach Jahr 3: 17,8 C | **−4,7 C** |

Lang lohnt ab etwa **40 % Chance, dass er besser wird**. Darunter ist kurz richtig. Der Händler kann im guten Fall zusätzlich nach
Jahr 1 verkaufen: MW 35 × Leistungsfaktor 1,2 = 42 C für einen Spieler, der 30 C gekostet hat.

Die KI rechnet W deshalb für drei Verläufe (besser / gleich / schlechter) und gewichtet sie. Die Gewichte kommen aus den Signalen
in Abschnitt 6 (Abstand zum Potenzial, Trainingsgüte des Teams, Trainingsvorliebe, Leistung im Bracket, Form). Der Wert der
Flexibilität fällt dabei von selbst heraus; es braucht keinen eigenen Parameter dafür.

### 4.3 Erst testen, dann binden

Die Gewichte sind bei einem neuen Spieler unsicherer als bei einem, der schon eine Saison im Team war: Passung, Leistung im eigenen
System und Moral sind dann gemessen statt geschätzt.

- **Neu und unsicher** (Passung unter 10, heikle Traits, ungescoutet): die Verläufe streuen breit, die Rechnung landet bei 1–2
  Jahren — auch wenn der Spieler 4 will. Das kostet den Wunsch-Aufschlag (heute +6 bis +7,5 %): der Preis der Testphase.
- **Getestet und gut:** in der Saison oder am Vertragsende verlängern, jetzt in seiner Wunschlaufzeit mit vollem Rabatt.
- **Getestet und schwach:** auslaufen lassen, Abgangswert kassieren, kein Restgehalt.

Die Absicht wird beim Kauf gemerkt (Abschnitt 6.2, `vertragsAbsicht`: Kern / Handel / Test / Tiefe), damit die Verlängerung weiß,
warum der Vertrag kurz war.

### 4.4 Form (front / back / ausgewogen)

Die Form ändert die Summe nicht, nur den Zeitpunkt. Die bestehenden Regeln bleiben (`wendeLiquiditaetUndMixAn`: Kasse leer → nicht
front, Gehaltsberg → nicht back). Neu kommt aus W nur eines dazu:

- **Front-loaded** macht späte Jahre billig und den Ausstieg günstig (Tabelle 3.3 b). Richtig für Teams mit Kasse und für Spieler,
  die man später vielleicht handeln will.
- **Back-loaded** schont die Kasse jetzt, macht den Ausstieg später teuer. Richtig bei knapper Kasse und nur für Spieler, die
  sicher bleiben.
- Der Geduldsfaktor entscheidet zwischen beiden: ein Sparer rechnet spätes Geld kleiner und nimmt back-loaded eher.

---

## 5. Spielerwünsche

**Bestand nutzen:** Wunschlaufzeit, Fenster, Wunschform, Preis für Treffer und Abweichung, Moral-Grenze — alles aus Abschnitt 1.1
bleibt. Drei kleine Erweiterungen:

1. **Rabatt nach Wunsch statt für alle gleich.** Heute bekommt jeder (außer `mercenary`) die volle Rabattkurve. Vorschlag: drei
   Kurven aus den zwei vorhandenen Tabellen plus einer mittleren.

   | Spieler will | 1 J. | 2 J. | 3 J. | 4 J. | 5 J. | Quelle |
   |---|---:|---:|---:|---:|---:|---|
   | lang | 1,00 | 0,94 | 0,86 | 0,78 | **0,70** | Standard-Tabelle (unverändert) |
   | mittel | 1,00 | 0,96 | 0,90 | 0,84 | 0,78 | neu, Mitte der beiden |
   | kurz | 1,00 | 0,98 | 0,94 | 0,90 | **0,86** | `mercenary`-Tabelle (vorhanden) |

   Auf den Spieler eingehen spart dann wirklich: 5 Jahre mit einem, der lang will, 30 %; mit einem, der kurz will, 14 %.
   Die bestehenden Auf- und Abschläge für Treffer und Abweichung bleiben obendrauf.
2. **Form unabhängiger von der Laufzeit.** Wer lang will, soll auch front- oder back-loaded wollen können (heute rund 80 % ausgewogen).
   Die Form bekommt einen eigenen Hash-Anteil, die Gesamtanteile (rund 50 / 35 / 15) bleiben.
3. **KI fragt den Wunsch zuerst.** Die Suche über Laufzeit × Form (Abschnitt 3.2) enthält den Wunschpreis schon; das Wunschpaar
   gewinnt, sobald die Teamlage nichts anderes verlangt. Abweichen ist eine bewusste Entscheidung mit sichtbarem Preis (Testphase,
   knappe Kasse, Handelsabsicht).

---

## 6. Welche Stats wir dafür haben

### 6.1 Vorhanden

| Signal | Quelle im Code | Nutzung im Modell |
|---|---|---|
| Eignung je Disziplin, Bedarf des Teams | `player.d` / Eignungsrechnung, `lib/market/transfermarkt-disziplin-bedarf.ts`, `transfermarkt-roster-impact.ts` | Bedeutung B (Stärke nach Team-Bedarf) |
| Kaderstärke beste 6 | `lib/market/transfermarkt-kaderstaerke.ts` | Wert eines Plans (#1745), nie genauer (CLAUDE.md) |
| Marktwert, Marktgehalt | `resolvePlayerEconomyContract` (`lib/foundation/player-economy-contract.ts`) | M(t), A, Kaufpreis |
| Leistung im MW-Bracket (PP, Saisonrang) | `buildTransfermarktSaleFactorBreakdown` (`lib/market/transfermarkt-sale-factor.ts`), `PlayerRatingContractRow.ppsSeason` | Angebot P (Faktor 0,65–1,65), Verlauf „besser/schlechter“ |
| Potenzial | `gameState.playerPotential[].hiddenPotentialScore`, `resolvePlayerPotentialScoreFromGameState` | Verlauf: Abstand zur Decke |
| Entwicklung, Trainingsgüte | `lib/training/entwicklung-neu.ts` (`ertragsFaktor`), `trainings-guete.ts`, `trainings-guete-spieler.ts`, `player-progression-forecast.ts` | Verlauf: wie gut dieses Team diesen Spieler entwickelt |
| Trainingsvorlieben | `lib/training/trainings-vorlieben.ts` | Verlauf: Liebling ×1,30, ungeliebt ×0,50 |
| Form | `playerFormState[].verlauf` | Verlauf (kurzfristig), Zeitpunkt des Verkaufs |
| Moral, Vertragsabsicht | `assessPlayerMorale` (`lib/morale/player-morale-service.ts`): `contractIntent`, `moraleSalaryModifier`, `moraleContractLengthLimit` | Laufzeit-Grenze, Gehaltsaufschlag, Risiko langer Bindung |
| Traits, Wesen | `traitsPositive` / `traitsNegative`, `derivePlayerNatureDemandSignals` | Wunschprofil, Forderung, Risiko (Diva, Söldner) |
| Passung zum Team | `calculateTransfermarktFit` (`lib/market/transfermarkt-fit.ts`), `team-fit-matrix.ts` | Rabatt ab 25, Unsicherheit bei niedriger Passung |
| Belastung, Verletzung | `lib/fatigue/` | Tiefenkosten (#1745), kein Langzeitrisiko |
| Vertrag | `yearlySalarySchedule`, `contractShape`, `contractEndSeasonNumber`, `purchasePrice` | G(t), Rest, Gewinn gegen Einkauf |
| Team-Matrix | `TeamIdentity`: `finances`, `ambition`, `boardConfidence`, `harmony`, `playerMin`, `playerOpt` | Geduld, Rücklage, Charakter |
| GM-Charakter | `lib/foundation/team-general-managers.ts`: `shortContractPreference`, `longContractPreference`, `sellForProfitAggression`, `riskTolerance`, `cashPriority`, `wageSensitivity`, `loyaltyBias` | Charakter (Abschnitt 7) |
| Gewichte der Kaderplanung | `lib/ai/organic-squad/weights.ts`: `wWin`, `wThrift`, `wPatience`, `wProfit` | Marge, Geduld (wie #1745) |
| Vorstand, Töpfe | `lib/finance/vorstand-budgetfreigabe.ts`, `kaufRahmen` | harte Grenze für Ablöse und Gehalt |
| Gehaltsberg, Kassenlage | `lib/market/contract-shape-context.ts` | Formwahl |

### 6.2 Fehlt (klein gehalten)

| Neu | Was | Warum |
|---|---|---|
| `vertragswert(...)` | reine Funktion: W aus Jahresplan, B, M(t), A | die eine Rechenstelle für alle vier Entscheidungen und für die Anzeige |
| `mwVerlauf(...)` | drei Verläufe mit Gewichten aus Potenzial, Trainingsgüte, Vorliebe, Bracket-Leistung, Form | keine neue Stat, nur eine Zusammenfassung vorhandener |
| Rolle aus dem Kaderrang | Stamm = beste 6 nach Team-Bedarf, statt des toten `roleTag` | behebt „nie 5 Jahre“ (Abschnitt 1.3) |
| `vertragsAbsicht` am Kadereintrag | Kern / Handel / Test / Tiefe, beim Kauf gesetzt | Verlängerung und Verkauf kennen den Plan |
| mittlere Rabattkurve | eine Tabelle mit fünf Spannen | Abschnitt 5 Punkt 1 |

Keine neuen Spielerattribute, kein Alter, keine Verletzungsanfälligkeit.

---

## 7. KI-Charaktere

Keine neuen Typen. Vier Haltungen als Mischung aus vorhandenen Kennzahlen; jedes Team hat von jeder etwas.

| Haltung | Verankert in | Typische GMs | Wirkung im Modell |
|---|---|---|---|
| **Händler** | `sellForProfitAggression`, `shortContractPreference`, `wProfit` | `bargain_hunter` (9 / 7), `risk_gambler` (7 / 8), `rivalry_hawk` | glaubt eher an „besser“, nimmt kurz, front-loaded bei Kasse; kleine Marge beim Verkauf; Absicht „Handel“ |
| **Bewahrer** | `longContractPreference`, `loyaltyBias`, `harmony`, `boardConfidence` | `culture_keeper` (8 / 10), `talent_builder`, `star_chaser` | hohe Geduld, bindet lang in der Wunschlaufzeit, holt den vollen Rabatt; große Marge; Absicht „Kern“ |
| **Sparer** | `cashPriority`, `wageSensitivity`, niedriger Finanzwert, `wThrift` | `bargain_hunter` (Kasse 10), `facility_architect` (8) | niedrige Geduld (Geld heute zählt), back-loaded, sucht Wunsch-Treffer wegen des Rabatts, scheut Restgehalt |
| **Zocker** | `riskTolerance`, niedrige `cashPriority`, `starPriority` | `risk_gambler` (10), `star_chaser` (8) | gewichtet den guten Verlauf höher, lang auch bei unsicherem Spieler, Risiko-Kredit (#1745 10.5) |

Stellschrauben je Team, alle aus diesen Kennzahlen gerechnet: Geduldsfaktor (0,90–0,97), Gewicht des guten Verlaufs (±10 Punkte),
Risikoscheu gegen Bindung, Marge beim Verkauf (aus #1745 „Haltefreude“). Dazu ein kleines reproduzierbares Bauchgefühl je Spieler
und Team, damit zwei gleiche Teams nicht gleich entscheiden.

**Geländer, die bleiben oder dazukommen:** Vorstands-Freigabe und Gehaltstopf hart; Kasse eng → höchstens 2–3 Jahre;
Gehaltsberg-Riegel; Moral-Grenze; Pflichtkader 8. Neu: **Vertragsenden staffeln** — höchstens rund 40 % der Verträge eines Teams
enden in derselben Saison, sonst rückt die Laufzeit um ein Jahr (gegen die Auslauf-Welle, die schon einmal Fehlerursache war).

---

## 8. Mehrspieler und Anzeige

- **Eine Rechenstelle.** Mensch, KI und delegierte KI (`isBereichDelegiert(..., "transfers")`) nutzen `vertragswert` und denselben
  Verhandlungsdienst. Die delegierte KI füllt nur, was der Mensch nicht gesetzt hat, und hält die Vorstands-Freigabe ein.
- **Gezeigt = gebucht.** Die Verhandlungsansicht (Kauf und Verlängerung, bestehender Dialog, keine neue Seite) zeigt:
  - Wunschprofil des Spielers: Laufzeit, Fenster, Form, was Treffer und Abweichung kosten (vorhanden, bleibt).
  - Tabelle Laufzeit 1–5: Gehalt groß je Saison, klein je Spieltag; Summe; Ersparnis gegen 1 Jahr.
  - Jahresplan der gewählten Form und darunter **„Ausstieg kostet“** je Vertragsjahr (Restgehalt nach Plan).
  - Erwartung: Pfeil besser / gleich / schlechter als grobe Stufe. Im Scouting-Nebel gestuft: ungescoutet keine Erwartung,
    beobachtet grob, gescoutet voll; der Marktwert bleibt immer exakt. Der Server vergröbert, nicht der Browser.
- **Verkaufsdialog:** Brutto − Restgehalt = Netto (vorhanden), neu daneben „Vertragswert beim Halten“ mit den drei Posten.
- **Je Team getrennt:** `vertragsAbsicht` und Entwürfe hängen am Kadereintrag bzw. Team, Schreibwege nur über
  `authorizeServerRoomWrite`. Nichts liest „das erste menschliche Team“.
- Fremde Verträge (Gehalt, Restlaufzeit, Form) bleiben im Nebel wie heute.

---

## 9. Regel-Stempel

| | |
|---|---|
| Stempel | `seasonState.wirtschaftsRegeln.vertragsPlan` („neu“ / „alt“), neben `restgehalt` und `verkaufSchwellen` in `lib/resolve/wirtschafts-regeln.ts`; Abfrage nur `wirtschaftsRegel(gs, "vertragsPlan")` |
| Neues Spiel | „neu“ ab Saison 1 (Draft-Verträge bleiben 1 Jahr) |
| Laufender Spielstand | rechnet seine Saison „alt“ zu Ende, „neu“ ab dem nächsten Saisonwechsel; der Tick am Saisonende fragt den Stempel der endenden Saison (wie `restgehalt`) |
| Bestehende Verträge | bleiben, wie sie sind (Gehalt, Plan, Laufzeit). Neu sind nur Entscheidungen und neue Unterschriften. |
| Rückweg | `OLY_KI_VERTRAGSPLAN=aus` (neue Saisons), `aus-sofort` als Notbremse; nur Server |
| Reihenfolge | nach #1745 bauen; `vertragsPlan: neu` setzt `verkaufSchwellen: neu` voraus |

Die Arena-Engine wird nicht berührt, der Wertungs-Fingerabdruck bleibt.

---

## 10. Messplan

32 KI-Teams von Anfang an, Saaten 1 und 7, durchgehend S1 → S3 (für die 5-Jahres-Verträge ein Lauf bis S5), Messweg wie
#1745 (`scripts/miss-teamfinanzen-saison.ts`).

| Größe | Heute | Ziel |
|---|---|---|
| Laufzeiten neuer Unterschriften ab S2 (1/2/3/4/5) | 11 / 40 / 45 / 4 / 0 % (Verlängerungen nach S1, #1745) | jede Stufe ≥ 8 %, keine über 40 %, **5 Jahre 8–15 %** |
| Wunsch getroffen (Laufzeit im Fenster und Form) | nicht gemessen | ≥ 55 %, klar verfehlt ≤ 15 % |
| Formen bei Mehrjahresverträgen (front / ausgewogen / back) | schwankt stark je Spielstand (4–30 % / 38–70 % / 23–57 %) | 20–40 / 40–60 / 10–25 %; Gehaltsberg über 0,15 bei höchstens 4 Teams |
| Charaktere trennen sich | nicht gemessen | mittlere Laufzeit Bewahrer − Händler ≥ 1,0 Jahre |
| Kapitalbindung (Restgehalt / Jahresgehalt je Team) | nicht gemessen | Median 1,0–1,8; Bewahrer ≥ 0,5 über Händlern |
| Verkäufe von Spielern mit Vertrag, S2 → S3 | rund 0 | ≥ 10 je Liga, keiner mit Netto unter W |
| Gewinnverkäufe S2 → S3 | 5–8 | ≥ 15, Median Preis/MW ≥ 1,15 |
| Testphase | – | von den 1–2-Jahres-Erstverträgen mit Absicht „Test“ werden 40–70 % danach ≥ 3 Jahre verlängert |
| Liga-Gehaltssumme | Basis | ±5 % (mehr lange Verträge senken, die Wunschkurve hebt) |
| **Liga-Wert (Kasse + Kaderwert)** | | **±3 % je Saison bei Faktor 1,00** (Chris' Abnahme) |
| Kader am 1. Spieltag | min 8 | nie unter 8, kein Team mit negativer Kasse am Fensterende |

Dazu Wächter-Tests mit den Tabellen aus 3.3 und 4.2 (jede Zeile ein Fall) und einer für „Rolle aus dem Kaderrang“.

---

## 11. Offene Fragen an Chris

1. **0,9-Sperre durch den Vertragswert ersetzen?** Spieler mit Vertrag gehen dann, wenn Netto-Erlös > W (Beispiel 3.3 c).
   *Empfehlung: ja.* Es löst die offene Frage aus #1745 und macht Umbau, Tausch und Cash-Verkauf ab Saison 2 wieder möglich.
2. **Rabatt nach Spielerwunsch (drei Kurven, Abschnitt 5)?** Wer kurz will, gibt für 5 Jahre nur 14 % statt 28 %.
   *Empfehlung: ja* — erst das macht „auf den Spieler eingehen“ zu einer echten Geldfrage. Hebt die Gehälter leicht, wird über den
   Liga-Wert kontrolliert.
3. **Zielanteil 5-Jahres-Verträge 8–15 %** (so viele, wie Spieler es wollen)? *Empfehlung: ja*, über die Rolle aus dem Kaderrang;
   nur für Stammspieler mit guter Moral.
4. **Restgehalt bleibt voll beim Verkäufer?** Folge: mit 3 Restjahren lohnt ein Verkauf erst ab etwa 1,7 × MW, lang heißt wirklich
   gebunden. *Empfehlung: ja, so lassen* — das ist die Kapitalbindung, die den Rabatt rechtfertigt. Alternative wäre ein Abschlag,
   weil der Spieler ja einen neuen Vertrag bekommt.
5. **Vorzeitig verlängern**, wenn noch 2+ Jahre laufen (billiges Gehalt sichern, bevor der Spieler teurer wird)?
   *Empfehlung: später*, nicht in diesem Bau; heute nur für auslaufende Verträge.
6. **Erwartung in der Verhandlung zeigen** (Pfeil besser / gleich / schlechter, im Nebel gestuft)? *Empfehlung: ja* — sonst sieht
   der Mensch weniger als die KI rechnet.

## 12. Entscheidungen Chris (25.11.) — verbindlich für den Bau

| # | Frage | Entscheidung |
|---|---|---|
| — | Rolle „Stammspieler“/„Nachwuchs“ (`roleTag`) | **Komplett raus.** Chris: „das mit Stammspieler und Nachwuchs und so, das solltest du ja rausnehmen. Lösch das mal und guck mal, dass da auch keine Code-Rückstände sind.“ Jede Stelle, die über `roleTag` Laufzeit, Rabatt oder Verhalten steuert, wird entfernt bzw. durch den Vertragswert ersetzt; keine toten Felder, keine Ersatz-Etiketten. |
| 1 | Vertragswert statt 0,9-Sperre | **Ja**, einbauen. |
| 2 | Rabatt nach Wunschlaufzeit in drei Kurven | **Nein, nichts ändern** — „haben wir ja schon drin“. Die bestehende Rabatt-/Wunschlogik bleibt unverändert. |
| 3 | 5-Jahres-Verträge nur für Stammspieler | **Nein.** Auch günstige Spieler können sich für 5 Jahre lohnen, z. B. wegen ihrer **Formkarte**: „es kann sich lohnen, einen günstigen Spieler, der vielleicht auch nur sehr wenig Gehalt kostet, mitzunehmen, weil der dann dir eine passende Formkarte aus der Farbe mitbringt.“ Der Vertragswert muss deshalb den **Beitrag zur Formkarten-Aufstellung des Teams** (Klassenfarbe des Spielers ↔ Farbbedarf der Disziplinen/Kartenplan, `lib/lineups/formkarten-farbregel.ts`, Plus/Minus-Regel) als Nutzen enthalten, nicht nur Eignung/Leistung. Keine Laufzeit-Sperre nach Rolle oder Rang. |
| 4 | Wer zahlt das Restgehalt | **Der Verkäufer**, wie bisher — **außer der Spieler bietet die Vertragsauflösung an**: dann gelten günstigere Konditionen, es wird aber trotzdem etwas bezahlt (bestehender Weg der Vertragsauflösung; die KI soll ihn im Vertragswert nutzen). |
| 5 | Vorzeitig verlängern | **Nein**, machen wir nicht. |
| 6 | Erwartung (besser/gleich/schlechter) in der Verhandlung zeigen, im Scouting-Nebel gestuft | **Ja.** |

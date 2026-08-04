# KI, Vertragsformen und der Apron — Befund

Stand: 2026-08-04 · Anlass: Bug-Report `bug-2026-08-04T12-13-40-352Z-fm2opo` (Ticket 25) von Chris,
Seite „Spieltag · Saisonstand":

> „Top Teams sollten wenn es geht evtl mehr die Mechanik nutzen Front und Back Loaded verträge zu
> gestalten um die Apron probleme ggf. umgehen zu können - das muss die AI berücksichtigen"

Dieses Dokument ändert **keinen Code und keine Balance-Zahl**. Es beantwortet die Frage, die vor jedem
Eingriff steht: *kann die KI mit der vorhandenen Mechanik überhaupt tun, was hier verlangt wird?*

**Kurzfassung: Nein — und zwar aus einem Grund, der ausdrücklich so gebaut wurde.** Der Apron ist
gegen die Vertragsform blind. Er bemisst sich an einer geglätteten Gehaltszahl, die weder
`contractShape` noch `yearlySalarySchedule` liest. Eine KI, die Verträge front- oder back-loaded
gestaltet, verändert ihre Apron-Abgabe um **exakt null**. Der Wunsch ist nicht durch eine bessere
KI-Entscheidung erfüllbar, sondern nur durch eine Änderung an der Bemessungsgrundlage des Apron —
und die ist eine kalibrierte Balance-Entscheidung (PR #368), keine Bugfix-Frage.

---

## 1. Bestandsaufnahme

### 1.1 Wie Front-/Back-Loading heute funktioniert

Ein Kadervertrag trägt zwei Felder (`lib/data/olyDataTypes.ts:1875-1876`):
`contractShape: "balanced" | "front_loaded" | "back_loaded"` (Typ: `olyDataTypes.ts:18`) und
`yearlySalarySchedule: ContractYearSalary[]`.

Der Zahlungsplan entsteht in `buildShapeWeights` (`lib/market/contract-negotiation-preview.ts:375-393`)
und `buildContractSalarySchedule` (ebd. `:395-442`). Entscheidend sind zwei Eigenschaften:

- **Die Gesamtsumme ist formunabhängig.** `totalSalary = annualSalary × contractLength`
  (`:410`); die Form verteilt nur um. Front-/Back-Loading ist reine Verschiebung im Zeitverlauf,
  nie ein Rabatt.
- **Bei einem Einjahresvertrag ist die Form ein No-Op.** `contractLength <= 1` liefert die Gewichte
  `[1]` (`:376-378`). Ein Einjahresvertrag mit `contractShape: "front_loaded"` ist ein Etikett ohne
  Wirkung.

Die Spreizung ist gedeckelt: `step = min(0.2, 0.8/(Laufzeit−1))`. Damit liegt die Jahr-1-Rate bei
2 Jahren bei 1,10×, bei 3 Jahren 1,20×, bei 4 Jahren 1,30×, ab 5 Jahren 1,40× der flachen Rate
(back-loaded spiegelbildlich). **Höchstens ±40 % je Vertrag** — das ist die Obergrenze des Hebels.

### 1.2 Wer setzt die Form — Mensch oder KI?

Beide. Die KI setzt sie heute schon, an zwei Stellen:

| Stelle | Datei:Zeile | Wovon die Wahl abhängt |
|---|---|---|
| Kauf (Transfermarkt, Redraft-Topup, Marktplan) | `lib/market/contract-negotiation-preview.ts:697` `recommendContractOfferForPlayer`, Formwahl in `:782`, `:794`, `:797`, `:826`, `:830`, `:856` | Cash-Enge (`cashTight` → `back_loaded`), Cash-Polster (`cashComfortable` + langer/Kern-Deal → `front_loaded`), GM-Bias |
| Vertragsverlängerung | `lib/contracts/contract-renewal-service.ts:677-710` `chooseAiRenewalContractShape` | Cash gegen die geforderte Reserve, `cashPriority`, `wageSensitivity`, `longContractPreference`, `sellForProfitAggression` |

Angewandt wird das Ergebnis in `lib/ai/ai-market-plan-apply-service.ts:1986` und `:2026`,
`lib/ai/ai-transfermarkt-preview-service.ts:1276`, `lib/ai/chunked-redraft-topup-service.ts:4356`
und `:5105` sowie beim Verlängern in `lib/contracts/contract-renewal-service.ts:1299-1317`.

**In keiner dieser Stellen kommt der Apron vor.** Das ist der einzige Teil der Meldung, der wörtlich
zutrifft: die KI berücksichtigt den Apron bei der Formwahl nicht. Der Befund unten erklärt, warum das
Nachrüsten trotzdem nichts brächte.

### 1.3 Wie der Apron wirkt und woran ein Team merkt, dass es drüber liegt

Zwei Linien am **Median-Gehalt der Liga**, zu Saisonbeginn eingefroren
(`lib/season/apron-service.ts:60-70`, Einfrieren in `lib/season/apron-settlement-service.ts:52-70`):

- 1. Linie = Median × 1,10 (`apron-service.ts:62`)
- 2. Linie = Median × 1,25 (`:64`)
- Satz zwischen den Linien 0,8, über der 2. Linie 1,6 (`:66`, `:68`), Deckel = halber
  Sponsor-Wertungsanteil (`:70`), Konjunkturhebel `k(f)` (`:101-104`).

Abgerechnet wird am Saisonende in `lib/season/apron-settlement-service.ts`; die Abgaben aller Zahler
bilden einen Topf, der zu gleichen Teilen an alle Teams **strikt unter** der 1. Linie geht
(`apron-service.ts:242-247`).

Sichtbar wird der Zustand in der Sponsorenübersicht: ein Text-Badge „über 1./2. Linie" je Teamzeile
(`app/foundation/sponsors-v2/FoundationSponsorsNewLook.tsx:526-528`, `:1064-1072`) plus die
Linien-Zeile darunter (`:1081-1086`).

### 1.4 Die Bemessungsgrundlage — der Kern des Befundes

Der Apron rechnet mit `getTeamDisplaySalaryTotal` (`lib/sponsor/sponsor-team-salary-display.ts:10-21`),
sowohl für die Linien (`apron-service.ts:123`) als auch für die Abgabe
(`apron-settlement-service.ts:135`). Diese Funktion summiert je Kadereintrag
`contract.expectedSalary` — und `expectedSalary` ist in
`lib/foundation/player-economy-contract.ts:379` definiert als
`salaryBreakdown?.finalSalary ?? storedCalculatedSalary ?? legacyDisplaySalary`: eine **aus den
Spielerattributen neu gerechnete Formelzahl**. Sie liest weder `contractShape` noch
`yearlySalarySchedule`.

Der Kopfkommentar von `apron-service.ts:14-24` sagt das ausdrücklich und begründet es:

> „… NICHT die echte, front-/back-loaded Vertragssumme … sie glättet gerade die
> Front-/Back-Loading-Spitzen weg, die sonst ein Team allein durch die zeitliche Verteilung seiner
> Vertragsraten über oder unter die Linie schieben würden — der Apron soll echte Mehrausgabe treffen,
> nicht Buchungstechnik."

**Das ist genau der Weg, den die Meldung eröffnen möchte, und er wurde bewusst zugemauert.**

Die *echte*, formabhängige Rate existiert daneben und wird auch benutzt — nur nicht vom Apron:

- `resolvePlayerEconomyContract(...).salary` ist die Jahr-1-Rate aus dem Zahlungsplan
  (`player-economy-contract.ts:36-68`, `resolveRosterContractSalaries`).
- Der **Gehaltsabzug am Saisonende** bucht diese echte Rate
  (`lib/sponsor/sponsor-settlement-service.ts:60`, angewandt `:184-194`). Back-Loading spart also
  **echtes Cash in dieser Saison** — es senkt nur die Apron-Abgabe nicht.

### 1.5 Eine zweite, unabhängige Beobachtung: die KI misst gegen eine andere Zahl

`resolveTeamApronSalaryCeiling` (`lib/ai/ai-cash-salary-target-service.ts:132-139`) bildet die
ambitionsabhängige Gehaltsdecke aus denselben Linien — vergleicht sie aber mit `getTeamSalarySum`
(`:15-27`, `:142`, `:155`), und das ist die **formabhängige** Jahr-1-Summe. Die daraus abgeleitete
Kaufbremse `resolveApronTighteningMultiplier` (`:152-158`) ist der einzige Produktivnutzer; sie geht
in die Cash-Reserve der KI ein (`lib/ai/ai-team-cash-reserve-service.ts:120`, `:133`).
`isTeamOverApronSalaryCeiling` (`:141`) wird außerhalb von Messskripten nirgends aufgerufen.

Die KI bremst also gegen eine andere Zahl, als der Apron belastet. Gemessen (Abschnitt 2) weichen
beide Zahlen je Team um bis zu 16,7 voneinander ab. Das ist kein Fehler mit sichtbarer Wirkung im
Spielstand, aber es ist der Grund, warum ein naiver Fix hier gefährlich wäre (Abschnitt 4).

---

## 2. Messung am echten Spielstand

Save `new-game-1785823388048-1hf25q` (Chris), Saison 1, Spieltag 7, 32 Teams, 339 Kaderspieler.
Messskript: `scripts/apron-shape-bestandsaufnahme.ts` (temporär, nach der Messung entfernt — die
Zahlen sind mit `scripts/apron-kalibrierung.ts --save <id> --detail` nachvollziehbar, dieselbe
Bemessungsgrundlage).

### 2.1 Wie viele Verträge sind heute nicht flach?

| Form | Verträge | Anteil |
|---|---:|---:|
| `front_loaded` | 205 | 60,5 % |
| `balanced` | 97 | 28,6 % |
| `back_loaded` | 36 | 10,6 % |
| nicht gesetzt | 1 | 0,3 % |

Die 71 % „geformten" Verträge sind eine Fassade: **nur 63 von 339 Verträgen sind überhaupt
mehrjährig**, und nur bei diesen 63 hat die Form eine Wirkung (Abschnitt 1.1). 44 davon sind geformt.
Bei den übrigen 276 Einjahresverträgen ist `contractShape` ein wirkungsloses Etikett.

### 2.2 Apron-Lage der Liga

Eingefrorene Linien: Median 64,9 · **1. Linie 71,4** · **2. Linie 81,1** (Referenzgehalt-Fallback, weil
die Linien zu Saisonbeginn bei noch leeren Kadern eingefroren wurden). Salary Factor 1,18.

**10 von 32 Teams liegen über der 1. Linie, 4 davon über der 2.** Topf 57,3 bei 10 Zahlern und
22 Empfängern (≈ 2,6 je Empfänger).

| Team | geglättet (Apron) | echt Jahr 1 | Δ | Rang | Abgabe | Deckel | Ambition | KI-Decke |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| H-R | 85,7 | 95,0 | +9,3 | 1 | **12,0** | 44,4 | 9 | 81,1 |
| G-G | 82,7 | 78,3 | −4,4 | 12 | 8,2 | 24,6 | 6 | 75,3 |
| L-R | 82,7 | 83,6 | +0,9 | 8 | 8,2 | 31,4 | 7 | 75,3 |
| M-M | 82,4 | 99,1 | **+16,7** | 3 | 7,8 | 40,6 | 10 | 81,1 |
| W-L | 80,5 | 80,5 | −0,0 | 4 | 5,8 | 38,7 | 5 | 71,4 |
| Z-H | 80,0 | 87,8 | +7,8 | 2 | 5,5 | 42,5 | 9 | 81,1 |
| C-S | 78,5 | 73,8 | −4,7 | 9 | 4,5 | 29,7 | 6 | 75,3 |
| P-S | 75,7 | 79,7 | +4,0 | 13 | 2,7 | 22,9 | 6 | 75,3 |
| N-N | 73,9 | 81,8 | +7,9 | 11 | 1,6 | 26,2 | 8 | 81,1 |
| R-L | 73,1 | 74,3 | +1,2 | 7 | 1,1 | 33,2 | 8 | 81,1 |

Über die ganze Liga: größte Abweichung zwischen den beiden Gehaltszahlen 16,7, mittlere absolute
Abweichung 4,02. Über ihrer KI-Apron-Decke liegen 8 Teams — über der Apron-1. Linie 10; die Mengen
überschneiden sich nur teilweise (C-S und R-L zahlen, gelten der KI aber als „unter der Decke").

Der Deckel greift bei keinem der 10 Zahler (kleinster Abstand: P-S mit 2,7 gegen 22,9) — die Abgabe
bestimmt allein der Gehaltsüberschuss.

### 2.3 Wie stark ist der Formhebel wirklich?

Summe aus `Jahr-1-Rate − flache Rate` über alle mehrjährigen Verträge eines Teams — also die volle
Verschiebung, die die heutige Formwahl bewirkt:

| Team | Form-Effekt | geformte Mehrjahresverträge |
|---|---:|---:|
| G-G | +3,87 | 8 |
| W-W | +2,07 | 4 |
| U-A | +1,55 | 3 |
| N-W | +1,47 | 5 |
| … | … | … |

**Größter Betrag der Liga 3,87 · Mittel 0,57** — gegen einen Abstand von 9,7 zwischen 1. und 2. Linie
und Überschüsse über der 1. Linie von 1,7 bis 14,3.

### 2.4 Gegenprobe: was wäre, wenn der Apron die echte Rate läse?

Hypothetische Rechnung mit `getTeamSalarySum` als Bemessungsgrundlage, gleiche Linien und Sätze:
12 statt 10 Zahler, Topf **104,3 statt 57,3** (+82 %). Die Frage ist dann, ob ein Zahler sich durch
**maximale** Rückverlagerung (jeder mehrjährige Vertrag voll `back_loaded`) unter die 1. Linie
retten könnte:

| Team | echt Jahr 1 | max. Entlastung | danach | unter 71,4? | mehrjährige Verträge |
|---|---:|---:|---:|---|---:|
| M-M | 99,1 | 0,00 | 99,1 | nein | 0 |
| H-R | 95,0 | 0,00 | 95,0 | nein | 1 |
| Z-H | 87,8 | 1,08 | 86,7 | nein | 1 |
| L-R | 83,6 | 0,00 | 83,6 | nein | 2 |
| N-N | 81,8 | 0,00 | 81,8 | nein | 0 |
| W-L | 80,5 | 0,00 | 80,5 | nein | 0 |
| P-S | 79,7 | 0,00 | 79,7 | nein | 0 |
| G-G | 78,3 | 10,16 | 68,1 | **ja** | 10 |
| R-L | 74,3 | 0,63 | 73,7 | nein | 1 |
| B-P | 74,0 | 0,00 | 74,0 | nein | 0 |
| C-S | 73,8 | 0,38 | 73,4 | nein | 1 |
| T-T | 71,6 | 1,21 | 70,4 | **ja** | 2 |

**Selbst in der Welt, in der die Form zählt, kämen 2 von 12 Zahlern unter die Linie** — und die
beiden nur, weil sie ohnehin knapp drüber lagen bzw. ungewöhnlich viele Mehrjahresverträge haben. Die
sieben teuersten Kader haben null bis einen mehrjährigen Vertrag: der Hebel existiert für sie
physisch nicht.

---

## 3. Warum hier kein Fix gebaut wurde

Drei unabhängige Gründe, jeder für sich ausreichend:

1. **Der Apron ist formblind — der gewünschte Effekt ist exakt 0.** Eine apron-bewusste Formwahl in
   `recommendContractOfferForPlayer` oder `chooseAiRenewalContractShape` verändert `contractShape`
   und den Zahlungsplan, aber nicht eine einzige Zahl, die in `computeApronSettlement` eingeht.
   Das wäre ein Placebo mit Changelog-Eintrag.
2. **Der Hebel ist um eine Größenordnung zu klein.** Mittel 0,57, Maximum 3,87 gegen Überschüsse bis
   14,3 (Abschnitt 2.3/2.4). Auch eine Verstärkung des Hebels wäre eine Balance-Entscheidung, keine
   Fehlerbehebung.
3. **Der einzige Weg zum gewünschten Effekt führt durch die Gehaltsbemessung des Apron.** Die
   Bemessungsgrundlage zu wechseln, verändert Linien, Topf, Zahlerkreis und Ausgleich gleichzeitig
   (gemessen: Topf +82 %) und entwertet die dreirundige Kalibrierung aus PR #368. Das ist
   ausdrücklich außerhalb dessen, was ein Bugfix-Lauf ohne Balance-Freigabe anfassen darf.

Zusätzlich eine Falle, die ein „kleiner" Fix aufreißen würde: die KI-Kaufbremse liest die
**formabhängige** Zahl (Abschnitt 1.5). Eine KI, die back-loadet, um unter ihre Apron-Decke zu kommen,
löst damit **ihre eigene Bremse** (`resolveApronTighteningMultiplier` springt zurück auf 1) und kauft
danach mehr ein — ohne dass ihre Apron-Abgabe je gesunken wäre. Das Ergebnis wäre eine Rückkopplung,
die die Abgaben der Topteams erhöht statt senkt: das exakte Gegenteil der Meldung.

---

## 4. Was nötig wäre — drei Wege, alle mit Preisschild

Zur Entscheidung, nicht als Empfehlung. Jeder Weg braucht eine Mehrsaison-Messung
(`npm run season:balance-audit`, `npm run balance:block3-run`) und eine Freigabe der Balance-Zahlen.

**Weg A — Apron auf die echte Jahresrate umstellen.** `getTeamDisplaySalaryTotal` in
`apron-service.ts:123` und `apron-settlement-service.ts:135` durch `getTeamSalarySum` ersetzen. Dann
zählt die Form. Preis: Topf +82 % im gemessenen Save, Neukalibrierung von Linienfaktoren und Sätzen
nötig, und die Apron-Badges in der Sponsorenübersicht zeigen dann eine andere Zahl als die daneben
stehende Gehaltsspalte (genau der Widerspruch, den der Kopfkommentar vermeiden wollte). Nutzen selbst
dann: 2 von 12 Zahlern könnten sich freischaufeln.

**Weg B — Zweite Bemessung nur für die KI-Bremse.** Die KI-Decke gegen dieselbe geglättete Zahl
prüfen wie der Apron (`getTeamSalarySum` → `getTeamDisplaySalaryTotal` in
`ai-cash-salary-target-service.ts:142` und `:155`). Beseitigt die Rückkopplung aus Abschnitt 3 und
macht die Bremse ehrlich, erfüllt die Meldung aber ausdrücklich **nicht** — im Gegenteil: es schließt
die Tür endgültig. Kleiner Eingriff, rein KI-seitig, aber er verschiebt die Kaufzurückhaltung von 8
auf 10 Teams im gemessenen Save und gehört deshalb ebenfalls gemessen.

**Weg C — Formhebel stärken und Laufzeiten verlängern.** Die Spreizung (`step`-Deckel 0,2 in
`contract-negotiation-preview.ts:384`) erhöhen und der KI mehr Mehrjahresverträge geben. Ohne Weg A
bleibt das für den Apron wirkungslos; mit Weg A wäre es die eigentliche Voraussetzung dafür, dass der
Hebel je greift (heute: 0–1 mehrjährige Verträge bei den sieben teuersten Kadern). Größter Eingriff
von den dreien, mit Wirkung auf Cashflow, Kaderplanung und Transfermarkt.

---

## 5. Was dagegen spricht (gegen diesen Befund selbst)

- **Die Meldung bleibt unerfüllt.** Chris hat einen konkreten Wunsch geäußert und bekommt ein
  Dokument. Das ist die richtige Antwort nur, solange die Alternative ein wirkungsloser Eingriff wäre
  — und genau das belegen die Zahlen in Abschnitt 2.4.
- **Die Messung ist eine Momentaufnahme aus Saison 1.** In Saison 1 sind fast alle Verträge einjährig
  (276 von 339); in späteren Saisons wachsen Laufzeiten, und damit wächst der Formhebel. Die Aussage
  „Hebel zu klein" ist für Saison 1 belegt, für Saison 5 nicht gemessen. Was sich dadurch **nicht**
  ändert, ist Grund 1: der Apron bleibt formblind, egal wie lang die Verträge werden.
- **Die Apron-Linien dieses Saves stammen aus dem Referenzgehalt-Fallback** (eingefroren, als die
  Kader noch leer waren). Wären sie am echten Median eingefroren worden, lägen sie höher, und
  weniger Teams wären Zahler. Die Größenordnung des Formhebels (Mittel 0,57) hängt davon nicht ab.
- **Weg B wäre heute baubar** und hätte einen echten, wenn auch anderen Nutzen als der Wunsch. Er ist
  bewusst nicht mitgebaut worden: er ändert die Kaufzurückhaltung von einem Viertel der Liga und
  gehört damit vor eine Balance-Messung, nicht in einen Bugfix.

# Verkauf mit Restgehalt: warum die KI 330 C Abloese zahlte (24.11.)

**Anlass.** Messung mit 32 KI-Teams (Saat 1), Fenster „nach der Abrechnung von Saison 1 → Stichtag Saison 2“
(`scripts/miss-teamfinanzen-saison.ts`): 50 KI-Verkaeufe an den Markt (`ai_organic_squad_sell`) brachten 704,65 C brutto,
trugen aber zusammen **330,73 C Restgehalt-Abloese** (`buyoutCost`, 47 % des Erloeses). Dazu 28 Vertragsenden mit 360,46 C
Gutschrift auf 406,88 C Marktwert.

Chris: In Saison 1 haben die Spieler Ein-Jahres-Vertraege. Wer nach Saison 1 geht, hat keinen Restvertrag; Restgehalt-Abloese
gibt es nur bei mehrjaehrigen Vertraegen mit offenen Jahren. Er glaubt nicht, dass so viel Geld verschwindet, und vermutet einen
Fehler.

**Kurz:** Er hat recht, dass es ein Fehler ist — nur sitzt er nicht in der Buyout-Rechnung, sondern in der **Reihenfolge zweier
KI-Entscheidungen**. Der Vertrags-Tick hat die auslaufenden Saison-1-Vertraege verlaengert, und die Verkaufsrunde des naechsten
Fensters hat genau diese frisch verlaengerten Spieler verkauft — mit dem Restgehalt des **gerade unterschriebenen** Vertrags als
Abloese. Behoben als Regel-Stempel `restgehalt` (Abschnitt 3).

---

## 1. Ursachen je Verkauf (alle 50 aus der Messung)

Nachgezaehlt an den Spielstaenden der Messung (`state-s1_04_nach_abschluss` → `state-s2_02_saisonstart`):

| Frage | Befund |
|---|---|
| Vertrag in Saison 1 | alle 366 Draft-Vertraege `draftPickS1`, Laufzeit **1**, `contractEndSeasonNumber` 1 (Ausnahme: Nula bei P-S, 5/5). Ein-Jahres-Vertraege sind Absicht. |
| Was im Tick geschah | Schritt `player_development` → `computeSeasonEndContractTick` (`lib/season/season-transition-service.ts:605`): 339 Vertraege **verlaengert** (`ai_contract_renewal`, 335 davon `tco_prefers_renew`/`hard_min_retention`), 28 laufen aus (`ai_contract_expiry`). Neue Laufzeiten 1/2/3/4 Jahre = 38/134/154/13. |
| Wer verkauft wurde | **alle 50** waren im selben Tick verlaengert worden: 14× auf 1 Jahr, 17× auf 2, 19× auf 3 Jahre. |
| Restlaufzeit beim Verkauf | 1 / 2 / 3 (`remainingContractLength`); Buyout 58,58 / 106,88 / 165,27 C = genau das Gehalt der neuen Vertragsjahre. |
| Rechenweg Buyout | `executeLocalTransfermarktSell` → `resolveTransfermarktSellProceeds` (`lib/market/transfermarkt-sell-proceeds.ts:90`) → `resolveOpenBuyoutCostForRoster` (`:72`) → `calculateOpenBuyoutCost` (`lib/market/contract-negotiation-preview.ts:551`), Saisonfenster `lib/market/contract-buyout-season-window.ts:37` (vor Spieltag 1 ist das laufende Jahr offen → zaehlt mit). |
| Lief eine zweite Alterung vor dem Verkauf? | Nein. Der Tick ist idempotent (Marke `season_end_contract_tick`); die Laufzeiten stehen von `kette_3` bis `s2_00_vor_kaufphase` unveraendert. Keine falsch gezaehlte Restlaufzeit, keine Doppelbuchung mit dem Abgangswert (die 50 haben keinen `contract_exit`). |
| Draft-Vertraege mehrjaehrig? | Nein, Ein-Jahres-Vertraege. Mehrjaehrig wurden sie erst durch die Verlaengerung im Tick. |

**Ursache.** Zwei Entscheidungen, die nichts voneinander wussten:

1. **Verlaengern** im Tick (`lib/contracts/contract-renewal-service.ts`, vorher Zeile 1640): nach der Kosten-Rechnung
   `resolveContractRenewalTco` ist Verlaengern fast immer billiger als ein Ersatz (Ersatz-Abloese mindestens 15 C) — also
   `tco_prefers_renew`. Ob die KI den Spieler ueberhaupt behalten will, fragt diese Rechnung nicht.
2. **Verkaufen** in der Verkaufsrunde des gemeinsamen Fensters (`runOrganicSellCycle` → `planOrganicSellsForTeam`,
   `lib/ai/ai-transfer-window-session-service.ts:391`, `lib/ai/organic-squad/draft-adapter.ts`).

Die Absicht „wer verkauft wird, wird nicht verlaengert“ stand sogar im Code (`ai-transfer-window-session-service.ts:421`:
`if (sellPlayerIds.has(entry.player.id)) continue; // sold below, not renewed`). Sie lief aber ins Leere, seit der Tick beim
Betreten der Saisonende-Phase laeuft (Schritt `player_development`) und seit im gemeinsamen Fenster erst in der neuen Saison
verkauft wird: Wenn die organische Runde kommt, ist schon alles verlaengert.

Verlaengern und sofort verkaufen heisst: N Jahre Gehalt zusagen und sie sofort als Abloese zahlen. Haette der Tick den Spieler
auslaufen lassen, waere der Abgang ein **abloesefreier Verkauf** gewesen (`buildContractExitValue`, CLAUDE.md „Vertragsende ist
ein Verkauf“) — gleicher Preisweg, kein Restgehalt.

**Bug oder Absicht?**

| Befund | Einordnung |
|---|---|
| Verlaengern → sofort verkaufen mit vollem Restgehalt des neuen Vertrags | **Bug** (Reihenfolge/fehlende Abstimmung), behoben |
| Verkaufspruefung „think twice“ verglich den BRUTTO-Erloes mit dem Marktwert; Kasse und Upgrade-Tausch im Plan buchten den vollen Marktwert gut (`draft-adapter.ts`, vorher Zeilen 1209, 1220, 1258) | **Bug** (Buyout fehlte in der Pruefung; `sellUtility` selbst rechnete schon netto, `utility.ts:559`), behoben |
| Vertragsaufloesung mit Teilverzicht wurde nicht gegen den spaeteren Verkauf mit vollem Buyout abgewogen (`ai-contract-dissolution-service.ts`) | **Luecke**, behoben (KI nimmt an, wenn der Verkauf ohnehin geplant ist) |
| Restgehalt-Abloese beim Verkauf eines **mehrjaehrigen** Vertrags mit offenen Jahren | **Absicht** (`docs/design/fenster-auf-opt-18-11.md` Abschnitt 1 „gewollte Logik, kein Fehler“, `docs/APRON_UND_VERTRAGSFORMEN.md`, Verkaufs-Popup „Brutto X − Buyout Y“). Nicht angefasst. |
| Laufendes Jahr zaehlt im Fenster vor Spieltag 1 mit (`contract-buyout-season-window.ts`) | **Absicht**, korrekt: das Gehalt der neuen Saison ist noch nicht gebucht, nach dem Verkauf faellt keins mehr an. Verkaufen geht nur vor Spieltag 1 (`isTransferSellPhaseOpen`), also gibt es keinen Fall „halbe Saison schon je Spieltag bezahlt“. |

## 2. Die 28 Vertragsenden (+0,89 × Marktwert)

**Absicht, konsistent.** CLAUDE.md (22.11.): „Ein Abgang durch Vertragsende ist ein Verkauf (abloesefrei)“;
`docs/design/finanzkonzept-v2-18-11.md` Abschnitt 3 („ein Vertragsende ist ein Verkauf“, der Abschlag fliesst in den Liga-Topf);
`docs/design/finanzen-posten-22-11.md:67`; `docs/design/ki-kaufverhalten-analyse-18-11.md:110/209`. Der Code rechnet den Abgang
ueber denselben Preisweg wie einen Verkauf (`buildContractExitValue` → `buildTransfermarktSaleFactorBreakdown` +
`applySellPricingPolicyToBreakdown` mit `rosterAfter`, Waechter `tests/vertragsende-ist-ein-verkauf.test.ts`). Gemessen:
360,46 / 406,88 = **0,886** des Marktwerts; Verkaeufe derselben Messung 704,65 / 755,16 = 0,933 brutto. Der Unterschied ist die
Verkaufsfaktor-Streuung (Leistung, Kaderdruck), kein zweiter Rechenweg. Nicht angefasst.

## 3. Was geaendert wurde (Regel-Stempel `restgehalt`)

Stempel `seasonState.wirtschaftsRegeln.restgehalt` (`lib/resolve/wirtschafts-regeln.ts`, Abfrage `wirtschaftsRegel(gs, "restgehalt")`):
neues Spiel ab Saison 1 „neu“; ein bestehender Spielstand rechnet seine Saison „alt“ zu Ende und bekommt „neu“ mit dem naechsten
Saisonwechsel (der Tick am Ende einer Saison fragt den Stempel der endenden Saison). Rueckweg `OLY_KI_RESTGEHALT=aus` (neue
Saisons). **Hinweis:** `deploy/hetzner/docker-compose.yml` reicht die Variable noch nicht durch (deploy/ war fuer diesen Auftrag
gesperrt) — der Standard „neu“ braucht das nicht, nur der Rueckweg.

1. **Verkaufsabsicht vor dem Tick** — `lib/contracts/ki-verkaufsabsicht-saisonende.ts`
   (`ermittleKiVerkaufsabsichtAmSaisonende`): fuer jedes KI-Team (auch Menschen mit delegierten Transfers) laeuft
   `planOrganicSellsForTeam` mit denselben Eingaben und derselben Saat wie die Verkaufsrunde (`saltOrganicSeed`, jetzt exportiert).
   Ohne „Fenster auf Opt“ gilt dieselbe Grenze max(8, playerMin) wie in der Runde.
2. **Tick** — `computeSeasonEndContractTick(save, preview, { kiVerkaufsabsicht })` (`contract-renewal-service.ts`): ein
   auslaufender Vertrag eines KI-Teams, dessen Spieler verkauft werden soll, wird **nicht verlaengert** und nicht
   brueckenverlaengert; er endet, der Abgang ist der abloesefreie Verkauf (`contract_exit`, Grund `ki_verkauf_geplant`). Diese
   Abgaenge zaehlen nicht gegen `MAX_RELEASES_PER_TEAM_PER_TICK`. Der Vertragsdienst importiert den Planer nicht (der haengt ueber
   die Transferfenster-Sitzung wieder am Vertragsdienst); alle produktiven Aufrufer gehen ueber
   `computeSeasonEndContractTickMitVerkaufsabsicht` / `applySeasonEndContractTickMitVerkaufsabsicht`:
   Saisonuebergang (`season-transition-service.ts`), Saisonstart (`preseason-workflow-service.ts`), Nachzieher
   (`vertragsalterung-nachziehen.ts`), Route `app/api/season/preseason-workflow`, Sim-Lauf (`season-simulation-runner.ts`).
3. **Vertragsaufloesung bevorzugt** — `decideAiContractDissolution`: steht ein Spieler mit Aufloesungsangebot auf der
   Verkaufsliste, nimmt die KI an (Grund `verkauf_geplant`): gleicher Verkaufspreis, aber nur der nicht erlassene Teil des
   Rest-Buyouts statt des vollen. Die Pleite-Wache gilt weiter. (Angebote gibt es nur fuer laufende Vertraege, also ab dem Ende
   von Saison 2; im Fenster S1 → S2 greift das noch nicht.)
4. **Verkaufspruefung netto** — `planOrganicSellsForTeam`: die „think twice“-Sperre prueft `Erloes − Rest-Buyout` gegen den
   Marktwert (Verlust hoechstens max(25 %, 5 C)); Kasse und Upgrade-Tausch im Plan buchen das Netto. Ein freiwilliger Verkauf mit
   grossem Restgehalt kommt damit nur noch zustande, wenn der Preis klar ueber dem Marktwert liegt (Chris: „auch mit einem Jahr
   Restlaufzeit, wenn der Verkaufswert deutlich ueber dem MW liegt“) oder das Team in Finanznot ist.

## 4. Messung vorher / nachher

Paarweise auf derselben Basis: `miss-teamfinanzen-saison.ts --stop-after spieltage --keep` (32 KI, Saat 1 ohne Mischen bzw.
`--mischen 7`), dann je Kopie dieselben Schritte wie das Messskript (Saisonabschluss → Saisonende-Kette → Saisonwechsel →
`fuehreKiPreseasonLaufAus`), „vorher“ mit dem Code von `origin/main`, „nachher“ mit diesem Stand und Stempel `restgehalt: neu`
ab Saison 1 (wie ein neues Spiel). Fenster A = nach der Abrechnung S1, B = nach der Kaufphase S2. Kasse in C.

| Fluss (Σ Kasse) | Saat 1 vorher | Saat 1 nachher | Saat 7 vorher | Saat 7 nachher |
|---|---:|---:|---:|---:|
| Kauf extern | 92 / −1594,70 | 144 / −2861,06 | 82 / −1735,91 | 139 / −2648,75 |
| Verkauf extern brutto | 53 / +704,58 | 1 / +11,97 | 48 / +612,73 | 0 / 0 |
| davon Restgehalt-Abloese | **−357,48** | **−1,62** | **−283,00** | **0** |
| Verkauf extern netto | +347,10 | +10,35 | +329,73 | 0 |
| Vertragsende (abloesefrei) | 33 / +502,60 | 141 / +1831,33 | 28 / +422,11 | 131 / +1718,10 |
| davon wegen Verkaufsplan | – | 116 | – | 116 |
| Gebaeude | 42 / −396,38 | 33 / −251,58 | 40 / −394,99 | 38 / −310,55 |
| **Δ Σ Kasse** | **−1141,38** | **−1270,96** | **−1379,06** | **−1241,20** |

| Kader (Σ Marktwert) | Saat 1 vorher | Saat 1 nachher | Saat 7 vorher | Saat 7 nachher |
|---|---:|---:|---:|---:|
| Σ MW A → B | 7199,35 → 7393,75 | 7199,35 → 7998,49 | 7183,05 → 7804,99 | 7183,05 → 8000,39 |
| Δ Σ MW | +194,40 | +799,14 | +621,94 | +817,34 |
| Abgaenge (MW bei A) | 86 / 1396,35 | 142 / 2058,33 | 76 / 1110,38 | 131 / 1828,46 |
| Zugaenge (MW bei B) | 92 / 1594,70 | 144 / 2861,06 | 82 / 1735,91 | 139 / 2648,75 |
| Neubewertung Bleiber | 271 / −3,95 | 215 / −3,59 | 283 / −3,59 | 228 / −2,95 |
| **Δ Kasse + Δ MW** | **−946,98** | **−471,82** | **−757,12** | **−423,86** |
| Verlaengert im Tick | 323 | 215 | 330 | 227 |
| davon im Fenster gleich wieder verkauft | 53 | 1 | 48 | 0 |

**Lesart.**

- Die Restgehalt-Abloese verschwindet fast ganz (357 → 2 C, 283 → 0 C). Der eine verbliebene Verkauf (Saat 1, 11,97 C brutto,
  1,62 C Restgehalt) ist ein Spieler, den erst die Verkaufsrunde im neuen Fenster abgeben wollte (Kader und Kasse stehen dort nach
  den Abgaengen anders als am Tick); er hat die Netto-Pruefung bestanden.
- Was die KI abgeben will, geht jetzt am Vertragsende statt nach einer Verlaengerung. Der Abschlag gegen den Marktwert
  (Vertragsende + Verkauf + Restgehalt) faellt von 546,7 auf 216,7 C (Saat 1) und von 358,5 auf 110,4 C (Saat 7).
- Die Kasse am Stichtag ist bei Saat 1 um 130 C niedriger, bei Saat 7 um 138 C hoeher: die Teams geben das freie Geld fuer
  Kaeufe aus (Fenster auf Opt), der Kaderwert steigt um 605 bzw. 195 C mehr. Vermoegen (Kasse + Kaderwert) im Fenster: +475 C
  bzw. +333 C gegenueber vorher.
- Der Planer will ohne Restgehalt deutlich mehr abgeben (116 statt ~50 je Liga, Spitze T-C 11 von 14). Das ist die Verkaufslogik
  selbst, nicht diese Aenderung — siehe offene Frage 2. Die Groessenordnung entspricht den frueheren Messungen
  (finanzkonzept-v2-18-11.md: Vertragsenden 1244 bis 1796 C je Wechsel).

## 5. Tests und Pruefungen

- Neu: `tests/verkauf-restgehalt.test.ts` (Tick laesst geplante Verkaeufe auslaufen statt zu verlaengern, ohne Brueckenbremse;
  Mensch unberuehrt; Aufloesung bei geplantem Verkauf, Pleite-Wache; netto Verkaufspruefung mit/ohne Stempel, kein Effekt ohne
  Restvertrag; Absicht = Plan der Verkaufsrunde, leer ohne Stempel; Stempel und Rueckweg).
- Angepasst (Quelltext-Waechter auf den neuen Aufruf): `tests/vertragsalterung-automatisch.test.ts`,
  `tests/schnappschuss-friert-vor-der-marktoeffnung.test.ts`.
- Gruen: Vertrags-, Aufloesungs-, Verkaufs-, Transferfenster-, Saisonwechsel- und Organik-Suiten (52 Dateien, 568 Tests),
  `npx tsc --noEmit -p tsconfig.next.json` fehlerfrei, Fingerabdruck `--node` GESAMT `fe1dc086d68d` (unveraendert).

## 6. Offene Fragen an Chris

1. **Restgehalt beim Verkauf an den Markt.** Heute zahlt der Verkaeufer das ganze offene Restgehalt, obwohl der Spieler geht
   (in der echten Welt uebernimmt der Kaeufer den Vertrag). Das ist dokumentierte Absicht (fenster-auf-opt-18-11.md) und blieb so.
   Folge: ein Verkauf mit Restgehalt ist kassenwirksam nur „Gehalt vorziehen“; gegenueber Behalten (Gehalt wird ohnehin gezahlt,
   am Vertragsende kommt der Abgangswert) lohnt er sich fast nie. Soll das so bleiben?
2. **Wie viel die KI am Vertragsende abgibt.** Ohne Restgehalt markiert der Planer je Liga rund 116 Spieler (Saat 1 und 7) zum
   Abgang; einzelne Teams tauschen 8 bis 11 von 12 bis 14 Spielern. Das ist die bestehende Verkaufslogik (Ueberschuss ueber Opt,
   Gewinnmitnahme, Upgrade-Tausch, „Fenster auf Opt“ ohne Minimum). Soll ein Abgang am Vertragsende zusaetzlich an „Verkaufswert
   deutlich ueber Marktwert“ gebunden sein (dann blieben mehr Spieler, und die Verlaengerung nach Kosten-Rechnung entschiede)?
   **Entschieden (Chris, 24.11.): ja, mit den bestehenden Schwellen — umgesetzt in Abschnitt 7.**
3. **Rueckweg-Schalter auf dem Server.** `OLY_KI_RESTGEHALT` muss in `deploy/hetzner/docker-compose.yml` und `.env` eingetragen
   werden, wenn der Rueckweg gebraucht wird.

## 7. Nachtrag: Abgang am Vertragsende nur nach Schwellen (Stempel `verkaufSchwellen`, 24.11.)

**Anlass.** Mit Abschnitt 3 liess die KI 116 bis 141 Spieler je Liga am Vertragsende gehen (Saat 1: 136 statt 34), einzelne Teams 8
bis 11 von 12 bis 14, und kaufte entsprechend mehr (92 → 136). Chris: Bei schlechtem Verkaufswert sollen die Teams ihre Spieler
behalten, manchmal will man schwache Spieler loswerden; es gab schon ein ausgewogenes Kauf-/Verkaufssystem mit verschiedenen
Schwellen, das soll wieder greifen. Und: bei mehrjaehrigen Vertraegen muss die Hemmung viel groesser sein (8 C Gehalt, 4 Jahre,
25 C MW: niemand zahlt 32 C Restgehalt und verschenkt die 25 C obendrauf).

### 7.1 Das bestehende System (vor #1743)

Zwei Stufen, beide mit eigenen Schwellen:

1. **Vertrags-Tick** (`previewSeasonEndContracts` → `computeSeasonEndContractTick`, `lib/contracts/contract-renewal-service.ts`):
   je auslaufendem Vertrag `shouldAiRenewContract` (Rollen-, Leistungs-, Marktwert-Signale, `extend_core`/`market_test`-Strategie
   des GM, Mindestkader) plus Kassen-Tor (`buildAiRenewalCashGate`) und Kosten-Rechnung `resolveContractRenewalTco` (Verlaengern =
   Gehalt x Jahre gegen Abgang = Erloes + Ersatz-Abloese mindestens 15 C + realisierter Verlust + Mindestkader-Risiko, Marge 8 %;
   `resolveContractExitRenewBias` haelt gegen einen Verlust unter Einkaufspreis). Freigaben nur bei `bad_value_contract`
   (Gehalt > 0,42 x MW bei schwacher Wertung), Moral, Kassen-Tor oder Heuristik; je Team hoechstens 3 heuristische Freigaben
   (`MAX_RELEASES_PER_TEAM_PER_TICK`), der Rest wird fuer ein Jahr brueckenverlaengert. Gemessen (Code `main` vor #1743): **328 / 341
   verlaengert, 34 / 30 Vertragsenden** (Saat 1 / 7), im Mittel ~1 je Team.
2. **Verkaufsrunde im Fenster** (`planOrganicSellsForTeam`, `lib/ai/organic-squad/draft-adapter.ts`): Nutzen `sellUtility`
   (`wThrift x Verkaufswert − wWin x Staerkeverlust + wPatience x Geldwert + wProfit x Gewinn + Gehaltsentlastung in Not`, Gewichte
   aus Identitaet und GM), verkauft wird ueber Opt ab −18 (`OPT_SURPLUS_SELL_THRESHOLD`), bei/unter Opt ab 0 (`SELL_THRESHOLD`),
   „think twice“-Sperre bei grossem Abschlag (Verlust > max(25 % MW, 5 C), `isBigHaircut`), Kernschutz der besten drei (Angebot
   1,5 / 1,4 / 1,3 x MW), Upgrade-Tausch (standardmaessig aus). Der Verkaufswert war **netto nach Restgehalt** — und im Fenster hatte
   jeder Spieler gerade einen frisch verlaengerten Vertrag. Diese Abloese war die eigentliche Bremse: gemessen 61 / 59 Verkaeufe.
   Summe vorher: **95 / 89 Abgaenge, Median 2 je Team, Spitze 9 / 8**.

### 7.2 Warum #1743 die Schwellen aushebelte

#1743 stellte die Frage der Verkaufsrunde vor den Tick, mit derselben Eingabe — aber am Vertragsende hat ein auslaufender Vertrag kein
Restgehalt. Damit fiel die Bremse weg, die den Planer im Fenster geeicht hatte: der volle Marktwert ging als Verkaufswert in
`sellUtility`, und jeder Abgang war gratis. Diagnose am Stand direkt vor `player_development` (Code #1743): alle Kader lagen bei oder
unter Opt, also kamen **alle 111 / 117 geplanten Abgaenge aus der Schwelle 0 unter Opt** (kein einziger Ueberschuss); 102 / 110
davon wollte die Kosten-Rechnung des Ticks eigentlich verlaengern (`tco_prefers_renew`). Nur 27 / 27 lagen mit dem Verkaufspreis
ueber 1,1 x MW (Median des realisierten Preises 0,86 / 0,89 x MW). Die Liste des Planers war also ein Verkaufswunsch unter der Annahme
„spaeter Verkauf mit Abloese“, nicht die Entscheidung „lohnt sich der Abgang“.

### 7.3 Was jetzt gilt (Stempel `seasonState.wirtschaftsRegeln.verkaufSchwellen`)

> **Ueberholt durch Abschnitt 8 (Chris, 24.11.):** die Hoechstzahl `ABGANG_UNTER_OPT_MAX` (Punkt 1), die Unterscheidung „unter Opt nur
> Gewinnmitnahme/klar schwach, ueber Opt frei“ als Groessen-Regel und das Mitzaehlen der geplanten Abgaenge gegen die Freigabe-Bremse
> (Punkt 2) sind gestrichen. Die Wert-Schwellen bleiben.

Neues Spiel ab Saison 1 „neu“, bestehender Spielstand ab dem naechsten Saisonwechsel (der Tick fragt den Stempel der endenden Saison).
Rueckweg `OLY_KI_VERKAUF_SCHWELLEN=aus` (neue Saisons; nur Server, in `deploy/hetzner/docker-compose.yml` noch nicht durchgereicht).

1. **Abgang am Vertragsende nur, wenn er sich lohnt** (`planOrganicSellsForTeam` mit `vertragsende: true`, nur aus
   `ermittleKiVerkaufsabsichtAmSaisonende`): ueber Opt bleibt die Ueberschuss-Schwelle unveraendert (`ueberschuss_opt`); bei/unter
   Opt geht ein Spieler nur bei **Gewinnmitnahme** (realisierter Preis ≥ `GEWINNMITNAHME_FAKTOR` 1,1 x MW) oder wenn er **klar
   schwach** ist (Qualitaet ≤ `KLAR_SCHWACH_ANTEIL` 0,8 x Median des eigenen Kaders), und zusammen hoechstens `ABGANG_UNTER_OPT_MAX`
   = 3 je Team. Alle anderen bleiben im Kader und gehen in die gewohnte Verlaengern-oder-Freigeben-Entscheidung des Ticks. Jeder Abgang
   traegt seinen Grund (`OrganicSellDecision.abgangsGrund`).
2. **Bremse im Tick** (`computeSeasonEndContractTick`): die geplanten Abgaenge zaehlen von Anfang an gegen
   `MAX_RELEASES_PER_TEAM_PER_TICK`; eine weitere heuristische Freigabe desselben Teams wird dann brueckenverlaengert statt obendrauf
   zu gehen. (Mit #1743 allein zaehlten sie nicht.)
3. **Restgehalt-Verkauf praktisch gesperrt** (`restgehaltVerkaufLohnt`, gilt fuer jede Verkaufsrunde des Planers, auch ueber Opt und
   in Finanznot): mit offenem Restgehalt nur, wenn netto (Preis − Restgehalt) mindestens `RESTGEHALT_NETTO_MINDESTANTEIL` 0,9 x MW
   bleibt. Chris' Beispiel: 25 C MW, 32 C Restgehalt ⇒ netto negativ ⇒ behalten; selbst 40 C Angebot reicht nicht, erst ~55 C. In
   Finanznot hilft der Kassensturz (Ruecklage, Kredit, Notkredit, Notverkauf), nicht ein Verkauf, der Bargeld kostet. Der
   Upgrade-Tausch nimmt nie einen Spieler mit Restgehalt.
4. **Nie ein frisch verlaengerter Vertrag** (`frischVerlaengerteSpieler`): letztes Vertragsereignis `contract_renewed` und die Laufzeit
   steht noch auf der neuen Laufzeit ⇒ der Planer verkauft ihn nicht freiwillig (Schutz aus #1743 bleibt, jetzt auch ausdruecklich).

### 7.4 Messung

Paarweise auf derselben Basis (`miss-teamfinanzen-saison.ts --stop-after spieltage --keep`, 32 KI, Saat 1 ohne Mischen bzw.
`--mischen 7`), je Kopie Saisonabschluss → Saisonende-Kette → Saisonwechsel → `fuehreKiPreseasonLaufAus`. Fenster A = nach der
Abrechnung von S1, B = Stichtag S2 (nach der Kaufphase). „vor #1743“ = Code `origin/main` vor dem Merge, „#1743“ = PR-Stand,
„Schwellen“ = dieser Stand mit Stempel `verkaufSchwellen: neu` in Saison 1 (wie ein neues Spiel). Kasse in C, Σ ueber 32 Teams.
Die Basen sind neu angelegt, deshalb weichen die Werte leicht von Abschnitt 4 ab.

| Fluss | S1 vor #1743 | S1 #1743 | **S1 Schwellen** | S7 vor #1743 | S7 #1743 | **S7 Schwellen** |
|---|---:|---:|---:|---:|---:|---:|
| Kauf extern (n / C) | 92 / −1916,22 | 136 / −2742,00 | **87 / −1954,16** | 77 / −1499,95 | 130 / −2596,39 | **68 / −1612,56** |
| Verkauf extern brutto (n / C) | 61 / +773,99 | 2 / +27,74 | **0 / 0** | 59 / +784,39 | 1 / +14,26 | **0 / 0** |
| davon Restgehalt-Abloese | −383,52 | −6,75 | **0** | −376,98 | −1,76 | **0** |
| Vertragsende abloesefrei (n / C) | 34 / +506,25 | 136 / +1738,44 | **82 / +989,85** | 30 / +405,41 | 140 / +1778,60 | **74 / +964,27** |
| davon geplant (`ki_verkauf_geplant`) | – | 111 | **58** | – | 117 | **51** |
| Gebaeude (n / C) | 46 / −396,00 | 38 / −307,70 | **35 / −296,42** | 45 / −441,85 | 38 / −289,05 | **36 / −293,29** |
| **Δ Kasse** | −1415,50 | −1290,27 | **−1260,73** | −1128,98 | −1094,34 | **−941,58** |
| **Δ Kaderwert (Σ MW)** | +523,64 | +811,21 | **+900,52** | +151,59 | +590,87 | **+572,27** |
| **Δ Kasse + Kaderwert** | −891,86 | −479,06 | **−360,21** | −977,39 | −503,47 | **−369,31** |
| Verlaengert im Tick | 328 | 226 | **280** | 341 | 231 | **297** |
| davon im Fenster gleich wieder verkauft | 61 | 2 | **0** | 59 | 1 | **0** |
| **Abgaenge je Team min / Median / max** | 0 / 2 / 9 | 0 / 4 / 10 | **0 / 3 / 5** | 0 / 2 / 8 | 0 / 5 / 11 | **0 / 2 / 6** |
| Abgaenge gesamt | 95 | 138 | **82** | 89 | 141 | **74** |
| Kader am Stichtag min / Median / max | 9 / 11 / 14 | 9 / 11 / 14 | 9 / 11 / 14 | 8 / 11 / 14 | 8 / 11 / 14 | 8 / 11 / 14 |

Verteilung der Abgaenge je Team (Anzahl Teams): Saat 1 Schwellen {0: 3, 1: 5, 2: 7, 3: 7, 4: 8, 5: 2} (vorher {… 7: 2, 8: 1, 9: 2},
#1743 {… 8: 2, 10: 2}); Saat 7 Schwellen {0: 2, 1: 9, 2: 8, 3: 6, 4: 5, 5: 1, 6: 1}.

**Lesart.**

- Ein typisches KI-Team tauscht jetzt 2 bis 4 Spieler je Saisonwechsel (22 / 19 von 32 Teams), Spitze 5 / 6 statt 9 bis 11. Das ist
  die Groessenordnung vor #1743 (Median 2), nur ohne dessen Ausreisser — und ohne einen Cent Restgehalt-Abloese.
- Externe Kaeufe fallen auf das Niveau vor #1743 zurueck (87 / 68 statt 136 / 130).
- Vermoegen (Kasse + Kaderwert) im Fenster: −360 / −369 C, besser als vorher (−892 / −977) und als #1743 (−479 / −503). Die Kasse
  bleibt hoeher als mit #1743, weil weniger nachgekauft werden muss.
- Was jetzt geht: 58 / 51 geplante Abgaenge (Ueberschuss, Gewinnmitnahme, klar schwach) plus 24 / 23 Freigaben des Ticks selbst
  (`bad_value_contract`, Moral, Heuristik).

### 7.5 Tests

`tests/verkauf-restgehalt.test.ts` (neu): Chris' Beispiel 8 C x 4 Jahre, 25 C MW (reine Regel, Planer, Vertragsende-Plan, Finanznot —
immer behalten; ohne Stempel verkaufte ein Team in Finanznot denselben Kader); Vertragsende mit 18 gleich starken Spielern bei Opt 8:
nur Ueberschuss ueber Opt; klar schwache gehen auch unter Opt; frisch verlaengert wird nicht verkauft, gealtert schon wieder pruefbar;
Tick-Bremse zaehlt geplante Abgaenge mit Stempel; Stempel und Rueckweg. Die Restgehalt-Waechter aus Abschnitt 5 setzen
`verkaufSchwellen: alt`, damit sie weiter genau die Regel `restgehalt` messen.

### 7.6 Offene Fragen an Chris

1. **Schwellen-Zahlen.** Gewinnmitnahme ab 1,1 x MW, klar schwach ab 0,8 x Kader-Median, hoechstens 3 Abgaenge unter Opt je Team,
   Restgehalt-Verkauf erst ab netto 0,9 x MW. Gesetzt nach der Diagnose oben, nicht abgestimmt.
2. **Finanznot und Restgehalt.** Ein Team mit Kasse unter 0 verkauft im Planer jetzt auch keinen Spieler mehr, dessen Restgehalt den
   Preis frisst; Liquiditaet kommt ueber den Kassensturz (Kredit, Notverkauf). Passt das?
3. **Rueckweg-Schalter auf dem Server.** `OLY_KI_VERKAUF_SCHWELLEN` (wie `OLY_KI_RESTGEHALT`) muss in `deploy/hetzner/docker-compose.yml`
   und `.env` eingetragen werden, wenn der Rueckweg gebraucht wird.

## 8. Keine Kadergroessen-Bremse (Chris, 24.11.)

> **Teilweise ueberholt durch Abschnitt 9 (Chris, 24.11.):** die Gewinnmitnahme-Runde ab 1,1 x MW und die Vertragsende-Schwellen (klar
> schwach, Ueberschuss ueber Opt) sind durch die Kosten-Nutzen-Abwaegung ersetzt. Die Regel „keine Kadergroessen-Bremse“ bleibt.

Chris, woertlich: „Nee, unterhalb der Soll-Kadergroesse einen Spieler nur gehen zu lassen, ist schon der falsche Weg. Weil es ist ja
okay, wenn ein Team unter Minimum verkauft, weil sie dann ja neue Spieler kaufen koennen. … Wenn ich jetzt zum Beispiel 12 Spieler habe
und 10 davon haben ein richtig gutes Angebot und ich soll mindestens 10 Spieler haben, dann verkaufe ich ja nicht nur 2, dann verkaufe
ich 8 oder so und kaufe mir ein viel besseres Team oder ein gleichwertiges Team und habe viel mehr Cash. Du willst immer diese Regelung
einbinden. Bitte unterdruecke das fuer immer. … Also es ist immer erlaubt, alle moeglichen Spieler zu verkaufen. Es gibt keine Groesse,
die sagt, du darfst nicht unter die Soll-Kadergroesse gehen. Weil sonst wuerde das ja bedeuten, bei Teams, die als Optimum 14 haben, die
duerfen ja gar keinen verkaufen oder was.“

**Regel.** Ob ein Spieler geht (Verkauf im Fenster, Vertragsende, Vertragsaufloesung), entscheidet allein der Wert: Preis gegen
Marktwert (Gewinnmitnahme ab 1,1 x MW netto nach Restgehalt), klar schwach (≤ 0,8 x Kader-Median), Restgehalt netto (≥ 0,9 x MW),
Finanzlage, Kosten-Rechnung des Ticks. Nie Opt, Soll, Minimum oder Pflichtkader. Die Kadergroesse steuert nur, wie viel das Team danach
nachkauft. Eingetragen auch in `CLAUDE.md` (Finanzen und KI-Kaufverhalten). Alles hinter demselben Stempel
`seasonState.wirtschaftsRegeln.verkaufSchwellen` (neues Spiel ab Saison 1, laufender Spielstand ab dem naechsten Saisonwechsel,
Rueckweg `OLY_KI_VERKAUF_SCHWELLEN=aus`).

### 8.1 Fundstellen

Gesucht in `lib/` und `app/` (inkl. `app/api/`) nach jeder Stelle, an der die Kadergroesse einen Verkauf, eine Freigabe, eine
Nicht-Verlaengerung oder eine Aufloesung verhindert oder deckelt — fuer KI und Menschen.

**Entfernt (mit Stempel `neu`):**

| Stelle | Was es tat | Jetzt |
|---|---|---|
| `draft-adapter.ts` `ABGANG_UNTER_OPT_MAX` (aus Abschnitt 7) | hoechstens 3 Abgaenge unter Opt je Team | Konstante gestrichen |
| `draft-adapter.ts` Vertragsende-Pruefung | unter Opt nur Gewinnmitnahme/klar schwach, ueber Opt frei | dieselben Wert-Gruende fuer jede Kadergroesse; Ueberschuss ueber Opt nur noch zusaetzliche Erlaubnis |
| `draft-adapter.ts` `rosterMin` (`ROSTER_MIN` ohne `allowBelowMin`) | Nutzen-Runde endet bei 8 | mit Stempel 0 |
| `draft-adapter.ts` Nutzen-Runde allein | eine Gewinnmitnahme ging nur, solange `sellUtility` (Staerkeverlust OHNE Nachkauf) positiv blieb — der Kader bremste sich ueber den Staerkeverlust selbst | neue **Gewinnmitnahme-Runde** nach der Nutzen-Runde: jedes Angebot ab 1,1 x MW netto geht, hoechstes zuerst, Preis je Abgang mit dem kleineren Kader neu gerechnet |
| `contract-renewal-service.ts` Mitzaehlen geplanter Abgaenge (Abschnitt 7.3 Punkt 2) | geplante Abgaenge fuellten die Freigabe-Bremse | gestrichen |
| `contract-renewal-service.ts` `MAX_RELEASES_PER_TEAM_PER_TICK` = 3 | mehr als 3 „heuristic“-Freigaben je Team wurden fuer ein Jahr brueckenverlaengert | mit Stempel keine Hoechstzahl |
| `contract-renewal-service.ts` `shouldAiRenewContract`: `rosterRetentionSignal`, `hardMinRetentionSignal` | Kader nach dem Abgang unter Opt bzw. Minimum ⇒ verlaengern | mit Stempel aus (KI) |
| `contract-renewal-service.ts` `resolveContractRenewalTco`: `minRiskPremium` / `underMin` | Mindestkader-Risiko als Kostenaufschlag und Zwang zum Verlaengern | mit Stempel ohne Kadergroesse (KI) |
| `contract-renewal-service.ts` `buildAiRenewalCashGate` | unter dem Minimum gelockertes Kassen-Tor | mit Stempel aus |
| `contract-renewal-service.ts` Grund `hard_min_retention` | Etikett der Groessen-Verlaengerung | mit Stempel nicht mehr vergeben |
| `ki-verkaufsabsicht-saisonende.ts` `spielraum` max(8, playerMin) | Absicht nur bis zum Minimum (nur im alten Stand `OLY_FENSTER_AUF_OPT=0`) | nur ohne Stempel |
| `ai-transfer-window-session-service.ts` `sellNotBelowMin` | Fenster-Verkaufsrunde nur bis max(8, playerMin) (nur im alten Stand `OLY_FENSTER_AUF_OPT=0`) | nur ohne Stempel |
| `ai-contract-dissolution-service.ts` `rosterFactor` | Kader unter Opt hob den Behalten-Wert bis x 1,45 | mit Stempel hoechstens 1 (ueber Opt bleibt der Abschlag) |
| `ai-market-plan-preview-service.ts` → `selectCompositeSellCandidates` `hardMin` (Altpfad `OLY_ORGANIC_SQUAD_BUILDER=0`) | Verkauf unter das Minimum nur im Cash-Notfall | mit Stempel kein `hardMin` |

**Bleibt — keine Groessen-Bremse auf eine Verkaufs-Entscheidung:**

- `OPT_SURPLUS_SELL_THRESHOLD` (−18 ueber Opt): **lockert** die Nutzen-Schwelle, solange der Kader ueber Opt steht; darunter gilt die
  normale Schwelle 0, die Wert-Gruende ebenso. Behalten, weil ein Platz ueber dem eigenen Ziel Bank ist und das Geld mehr wert ist —
  eine zusaetzliche Erlaubnis, keine Sperre. Gemessen gab es in beiden Saaten keinen Ueberschuss-Abgang (alle Kader bei/unter Opt).
- Kaderdruck-Abschlag im Verkaufspreis (`transfermarkt-sell-pricing-policy.ts`, am Minimum x 0,95, darunter x 0,9; Ticket #38): ein
  Preis, keine Sperre. Er gehoert zum Angebot — eine Gewinnmitnahme unter dem Minimum braucht deshalb ein entsprechend hoeheres Angebot.
- Bewertungsterme in `sellUtility` (`underOptPressure`, `rosterFullBoost` im Geldwert): weiche Gewichte der Nutzen-Runde, keine
  Untergrenze und keine Hoechstzahl. Die Gewinnmitnahme-Runde haengt nicht daran.
- Kernschutz (Angebot 1,5 / 1,4 / 1,3 x MW fuer die besten drei), „think twice“ (grosser Abschlag), frisch verlaengert, Restgehalt
  netto: Wert-Regeln.
- Kassensturz-Notverkauf nie unter 8 (`KASSENSTURZ_NOTVERKAUF_KADER_MIN`, Chris 18.11.): ein **Zwangs**verkauf am Ende des Fensters,
  nach dem kein Kauf mehr moeglich ist. Er begrenzt einen Zwang, keine Entscheidung des Teams; jeder gewollte Verkauf liegt davor.
- Admin-Simulation (`lib/admin/season-simulation-runner.ts`, Kassen-Notverkauf bis `playerMin`): Werkzeug ausserhalb des Spielablaufs,
  ebenfalls Zwangsverkauf.
- Mensch: der Verkauf auf dem Transfermarkt (`executeLocalTransfermarktSell`, Vorschau in `transfermarkt-local-service.ts`) zeigt nur
  Warnungen (`team_would_fall_under_7`, `…_player_min`, `…_player_opt`, Bereitschaft) und sperrt nie; Vertragsfreigabe und Aufloesung
  des Menschen pruefen keine Kadergroesse. Nichts zu aendern, deshalb auch kein Stempel noetig.
- Altpfad-Vorschau `ai-transfermarkt-sell-preview-service.ts` `allowSellBelowRosterMin`: fuer KI-Teams standardmaessig `true`.

### 8.2 Spielfaehigkeit

Wer unter das Minimum verkauft, kauft im selben Fenster nach — ueber den bestehenden Kaufweg, keine zweite Kauflogik: im gemeinsamen
Fenster (Standard, „Fenster auf Opt“) laufen nach der Verkaufsrunde die Kaufrunde und eine Nachrunde ueber den organischen Planer mit
Kaderplan bis Opt (`ai-preseason-background-service.ts`), danach der Kassensturz. Gemessen (8.3) standen vor dem Kauf 17 von 32 Teams
unter 8 (kleinster Kader 5 bzw. 3), am ersten Spieltag von Saison 2 **kein** Team unter 8 (Minimum 8 bzw. 9, Median 11).

Findet ein Team am Markt nichts Bezahlbares, meldet der Kaufplaner den Notweg `unter_minimum`; einen Notkauf oder ein Auffuellen mit
Billigst-Spielern gibt es nicht (Chris 18.11.: „niemals“). Der Spieltag sperrt dann nicht: nach der Teilaufstellungs-Regel
(`lib/lineups/legacy-matchday-partial-lineup-rule.ts`) setzt ein Team alle verfuegbaren Spieler ein, die Aufstellung gilt als
vollstaendig, leere Plaetze druecken das Ergebnis. Mitten in der Saison gibt es kein Transferfenster; unter 8 faellt ein Team dort nur
durch Verletzungen (Verletzte sind nicht einsetzbar), die Verletzungs-Tiefe der KI (`applyAiInjuryDepthTopup`) kauft im naechsten
Fenster nach. Ein menschliches Team bekommt beim Verkauf die Warnungen oben und muss selbst nachkaufen; gesperrt wird es nicht.

### 8.3 Messung

Derselbe Messweg wie 7.4 (`miss-teamfinanzen-saison.ts --stop-after spieltage --keep`, 32 KI von Anfang an, Saat 1 ohne Mischen bzw.
`--mischen 7`; je Kopie Saisonabschluss → Saisonende-Kette → Saisonwechsel → `fuehreKiPreseasonLaufAus`), auf **neu angelegten** Basen
mit dem Code dieses Branches (neues Spiel ⇒ Stempel `verkaufSchwellen: neu` ab Saison 1). „PR“ = Stand von Abschnitt 7 (`0c058e19b`),
„ohne Bremse“ = dieser Stand, beide auf derselben Basis. Die Gruende stammen aus dem Plan unmittelbar vor dem Tick.

| Fluss | S1 PR | **S1 ohne Bremse** | S7 PR | **S7 ohne Bremse** |
|---|---:|---:|---:|---:|
| Abgaenge gesamt | 76 | **114** | 88 | **124** |
| davon Gewinnmitnahme (Median Preis / MW) | 31 (1,28) | **60 (1,29)** | 28 (1,25) | **59 (1,28)** |
| davon klar schwach | 23 | **29** | 29 | **32** |
| davon Ueberschuss ueber Opt | 0 | **0** | 1 | **0** |
| davon Tick (schlechter Vertrag, Kosten, Moral) | 22 | **25** | 30 | **33** |
| Brueckenverlaengerung (Freigabe-Bremse) | 5 | **0** | 4 | **0** |
| `hard_min_retention` | 25 | **0** | 16 | **0** |
| Abgaenge je Team min / Median / max | 0 / 3 / 5 | **1 / 3 / 6** | 0 / 3 / 6 | **0 / 4 / 8** |
| Kader vor dem Kauf min / Median, Teams unter 8 | 6 / 9 / 9 | **5 / 7 / 17** | 4 / 8,5 / 8 | **3 / 7 / 17** |
| Kauf extern (n / C) | 76 / −1757,42 | **108 / −2515,16** | 84 / −1958,43 | **119 / −2705,76** |
| Vertragsende abloesefrei (n / C) | 76 / +1117,71 | **114 / +1832,75** | 88 / +1156,54 | **124 / +1954,78** |
| Verkauf extern / Restgehalt-Abloese | 0 / 0 | **0 / 0** | 0 / 0 | **0 / 0** |
| Verlaengert im Tick | 289 | **251** | 278 | **242** |
| Δ Kasse | −930,31 | **−1013,09** | −1114,09 | **−1037,21** |
| Δ Kaderwert (Σ MW) | +639,32 | **+774,05** | +697,92 | **+811,25** |
| **Δ Kasse + Kaderwert** | −290,99 | **−239,04** | −416,17 | **−225,96** |
| **Kader am 1. Spieltag S2 min / Median / max** | 9 / 11 / 14 | **8 / 11 / 14** | 9 / 11 / 14 | **9 / 11 / 14** |

Verteilung der Abgaenge je Team (Anzahl Teams): S1 ohne Bremse {1: 3, 2: 5, 3: 10, 4: 3, 5: 7, 6: 4}, S7 ohne Bremse {0: 1, 1: 2, 2: 4,
3: 5, 4: 8, 5: 7, 6: 4, 8: 1} (PR: S1 {0: 1, 1: 8, 2: 6, 3: 14, 4: 1, 5: 2}, S7 {0: 1, 1: 5, 2: 6, 3: 13, 4: 4, 5: 2, 6: 1}).

**Lesart.**

- Die Abgaenge steigen um rund 40 je Liga, fast ganz durch Gewinnmitnahmen (31 → 60, 28 → 59). Die gehen im Median zu 1,28 x MW, die
  Nachkaeufe kosten genau den Marktwert (Kauf zu 1,00 x MW) — Chris' Rechnung „verkaufe 8 und kaufe ein gleichwertiges Team mit mehr
  Cash“. Das Vermoegen (Kasse + Kaderwert) im Fenster wird besser: −239 statt −291 C bzw. −226 statt −416 C auf derselben Basis, und
  auch besser als die −360 / −369 C aus 7.4 (andere Basen).
- Keine Explosion: hoechstens 6 bzw. 8 Abgaenge eines Teams, kein Kader wird ausgetauscht. Was bremst, ist der Wert: unter dem Minimum
  sinkt der Preis (Kaderdruck), und ohne Angebot ueber 1,1 x MW geht ein Spieler nicht. Die Wert-Schwellen mussten nicht verschaerft werden.
- Spielfaehig: vor dem Kauf 17 Teams unter 8, am ersten Spieltag keines. Die Kaufrunde fuellt bis Opt (Median 11 wie vorher).
- Die Freigaben des Ticks steigen nur leicht (22 → 25, 30 → 33): ohne Halte-Signal nach Kadergroesse entscheidet die Kosten-Rechnung,
  die Spieler ohne Wert-Grund werden weiter verlaengert.

### 8.4 Tests

`tests/verkauf-keine-groessenbremse.test.ts` (neu): Chris' Beispiel (12 Spieler, Opt 10, zehn Angebote zu 1,25 x MW ⇒ 9 Abgaenge, am
Vertragsende und im Fenster; der Kernschutz haelt die besten drei); der Kaderdruck im Preis beendet die Gewinnmitnahme, keine
Groessen-Regel; ohne gutes Angebot verkauft dasselbe Team unter Opt nichts; ohne Stempel deutlich weniger; der Kaufplaner fuellt den
Rest-Kader (3) bis Opt 10; Tick ohne Freigabe-Hoechstzahl und ohne `hard_min_retention`; Aufloesung `rosterFactor` ≤ 1; Fenster-Grenze
nur ohne Stempel. `tests/verkauf-restgehalt.test.ts`: der Vertragsende-Test prueft jetzt Wert-Gruende statt „hoechstens Ueberschuss“,
der Tick-Test „geplante Abgaenge zaehlen gegen die Bremse“ ist umgestellt auf „keine Bremse mit Stempel, drei ohne“.

## 9. Verkauf als Kosten-Nutzen-Abwaegung (Chris, 24.11.)

Chris, woertlich (gekuerzt): „Ich habe dir doch gerade noch gesagt, dass es eine alte Berechnung dafuer gab und das schoen abgewaegt
wurde. Und jetzt machst du ab 1,1-fachen Marktwert, haust du einfach alle Spieler raus. Das muss balanciert sein zwischen, okay, das ist
ein gutes Angebot, aber der Spieler hat ja auch in seinem Bracket ueberperformt. … es ist immer Kosten-Nutzen-Verhaeltnis. Wenn du jetzt
einen Top-Spieler weghaust, musst du den Slot ja auch erstmal fuellen und du hast keine Garantie, dass ein gleichwertiger Spieler perfekt
in dein Team reinpasst. Klar, wenn das Angebot so unverschaemt gut ist, dass du richtig viel Kohle damit machst, dann lohnt sich das auch.
… Du hast einen Spieler, der 10 Millionen kostet. Und den wuerdest du jetzt fuer 11 verkaufen … Das waere doch total daemlich. … Es muss
halt moeglich sein, auch zum Beispiel 8 Spieler zu verkaufen, die alle ein gutes Angebot haben und vielleicht kaufst du dir dafuer 12
neue … Wichtig ist nur, dass die Teams das auf dem Schirm haben mit den Verletzungen und dass es anstrengend wird, wenn du nur 9 oder 10
Spieler hast. … es muessen ja auch mal Spieler verkauft werden, die unter Marktwert sind … Ohne Limitationen … dynamisch und organisch,
so wie der Draft an sich. Es muss halt auch zum Team passen.“

### 9.1 Der Bestand, auf dem das aufsetzt

| Baustein | Wo | Was er schon abwaegt |
|---|---|---|
| `sellUtility` | `lib/ai/organic-squad/utility.ts` | `wThrift x Verkaufswert − wWin x Staerkeverlust + wPatience x Geldwert + wProfit x Gewinn + Gehaltsentlastung in Not`, Gewichte aus Identitaet und GM, Jitter 8 je Saat. Nutzen-Einheiten, kein C. Der Verkaufswert zaehlt voll als Nutzen, ein Ersatz kostet nichts. |
| Schwellen | `draft-adapter.ts` | 0 (bei/unter Opt), −18 (ueber Opt), Kernschutz 1,5 / 1,4 / 1,3 x MW fuer die besten drei, „think twice“ (Verlust > max(25 % MW, 5 C)). |
| Angebot | `estimateRealizedSellPrice` → `buildTransfermarktSaleFactorBreakdown` + `applySellPricingPolicyToBreakdown` | Preis = MW x Leistungsfaktor (Rang im MW-Bracket nach Saisonleistung, 0,65 bis 1,65) x Marktlage (Saisonstart, Zeitpunkt, Kaderdruck am/unter dem Minimum 0,95 / 0,9, Passung). |
| Kaufplaner | `buildOrganicDraftFrame`, `kaderplanRahmen` | Ziel = Identitaets-Opt; der GM darf um hoechstens 2 senken (Elite-Neigung, Rahmen traegt nur Fueller), nie heben. |
| Kredit | `resolveAiLoanDecision`, Kreditprobe der Fenster-Sitzung | bedarfsgetrieben (Kader unter der Zwischenstufe Min + halber Weg zu Opt, Kasse reicht nicht), Persoenlichkeit, Tragfaehigkeit, Vorstands-Sperre (`pruefeKreditAufnahme`). Saison 1 nie. |
| Belastung | `lib/fatigue/` | Last 16 je Einsatz, Erholung 28, Risikokurve ab Fatigue 25; Spieltagsbedarf = Summe beider Disziplinen (4 bis 12, im Spielplan im Mittel 8). |

Die Gewinnmitnahme-Runde aus Abschnitt 8 hing an keinem dieser Bausteine: jedes Angebot ab 1,1 x MW ging, ohne zu fragen, was der Spieler
dem Team bringt und was ein Ersatz kostet.

### 9.2 Die Abwaegung

Mit Stempel `verkaufSchwellen: neu` rechnet die Verkaufsschleife (`planOrganicSellsForTeam`, im Fenster und am Vertragsende gleich) je
Schritt fuer jeden gehaltenen Spieler den Vorteil in C und verkauft den mit dem groessten, solange er positiv ist. Preis, Kaderdruck und
Tiefenkosten werden nach jedem Abgang mit dem kleineren Kader neu gerechnet. Die alte Nutzen-Runde, die Gewinnmitnahme-Runde und die
Vertragsende-Schwellen (klar schwach, Ueberschuss) entfallen mit dem Stempel; ohne Stempel laeuft die alte Nutzen-Runde unveraendert.

    Vorteil = Erloes − Haltewert − Ersatzrisiko − Wechselkosten + Gehaltsbilanz − Tiefenkosten + Liquiditaet − Marge − Verlustscheu
              ± Bauchgefuehl

| Posten | Formel | Begruendung |
|---|---|---|
| Erloes | Angebot − Restgehalt | das Angebot wie bisher (Leistung, Angebot/Nachfrage, Kaderdruck); am Vertragsende der Abgangswert |
| Haltewert | MW x Leistungsanteil x Team-Bedeutung | was ein gleichwertiger Ersatz am Markt kostet (Kauf zum MW) |
| Leistungsanteil | 1 + 0,25 x (Leistungsfaktor − 1) bei Ueber-, 1 + 0,5 x (…) bei Unterleistung | Ueberleistung im Bracket zaehlt zu einem Viertel als bestaendig (Rest Form/Glueck: man verkauft hoch), Unterleistung zur Haelfte (wer ein Jahr unter seinem Bracket bleibt, bestaetigt es eher). Der Leistungstraeger bleibt trotzdem, weil er dem Team mehr bedeutet (naechste Zeile; Chris: „hat ja auch in seinem Bracket ueberperformt“). |
| Team-Bedeutung | Staerke / Kader-Median: darueber linear (bis 1,6), darunter 1 − 6 x (1 − x)^2 (ab 0,35) | Staerke = Qualitaet nach den Achsen, die DIESES Team braucht (`computePlayerQuality` mit dem Disziplin-Bedarf). Ein Leistungstraeger ist dem Team mehr wert als dem Markt, ein Bankspieler weniger. |
| Ersatzrisiko | 0,04 x Haltewert x max(1, Bedeutung) | „keine Garantie, dass ein gleichwertiger Spieler perfekt reinpasst“, je wichtiger, desto teurer |
| Wechselkosten | 0,25 x Gehalt | Ersatz suchen, Handgeld, Eingewoehnung |
| Gehaltsbilanz | Gehalt x (1 − Leistungsanteil x Bedeutung) | wer weniger bringt, als er kostet, spart beim Abgang Gehalt; ein Leistungstraeger ist im Verhaeltnis billig |
| Tiefenkosten | 4 x ((Bedarf/(n−1))^2 − (Bedarf/n)^2) | Belastung je Spieler bis zum Nachkauf (Bedarf = Spieler je Spieltag laut Spielplan, im Mittel 8): bei 12 → 11 0,34 C, 10 → 9 0,6, 8 → 7 1,2, 6 → 5 3,1, 5 → 4 5,8, 4 → 3 12,4 C. Eine Kostenkurve, keine Grenze. |
| Liquiditaet | 0,2 x Erloes in Finanznot | Geld ist dann mehr wert; die Marge entfaellt |
| Marge | 0,03 x Haltewert x Haltefreude | Haltefreude = 0,6 + 0,4 x wWin − 0,5 x (wProfit − 0,1), 0,25 bis 1,8: ehrgeizige Teams halten, Haendler verkaufen |
| Verlustscheu | 0,5 x Verlust^2 / (Verlust + 4 C), Verlust = MW − Erloes | ein kleiner Verlust in C geht (2 C kosten 0,33), ein grosser kaum (7 C kosten 2,2); in Finanznot keine (Chris: „gerade wenn das absolut kein grosser Verlust ist in Credits“) |
| Bauchgefuehl | ± 0,06 x Haltewert | reproduzierbar aus Saat und Spieler: manche Teams zocken, manche halten |

Weiter gelten: Kernschutz (Angebot 1,5 / 1,4 / 1,3 x MW fuer die besten drei, ausser in Finanznot), Restgehalt netto ≥ 0,9 x MW
(`restgehaltVerkaufLohnt`), nie ein frisch verlaengerter Vertrag. Die „think twice“-Sperre entfaellt mit dem Stempel: ein Verlust
steht jetzt als Betrag in der Rechnung (Chris: „Manchmal hat man halt einen Verlust oder geht ein Gamble ein“). Keine Untergrenze, keine
Hoechstzahl.

**Zahlenbeispiele** (neutrales Team, Kader 12, 8 Spieler je Spieltag, Gehalt 0,27 x MW wie im Liga-Median; Waechter
`tests/verkauf-kosten-nutzen.test.ts`):

| Fall | Haltewert | Vorteil | Urteil |
|---|---:|---:|---|
| Top-Performer, 10 C MW, Leistungsfaktor 1,2, Staerke 1,25 x Median, Angebot 11 C | 13,1 | −5,0 | bleibt |
| derselbe, Angebot 18 C | 13,1 | +2,0 | geht (Linie bei etwa 16 C = 1,6 x MW, passend zum Kernschutz 1,5 / 1,4 / 1,3) |
| Mittelfeld, 20 C MW, Leistung 1,0, Staerke = Median, Angebot 20 / 22 / 24 C | 20 | −3,1 / −1,1 / +0,9 | geht ab etwa 1,16 x MW |
| schwacher Spieler, 6 C MW, Leistung 0,67, Staerke 0,75 x Median, Angebot 4 C | 3,1 | +0,35 | geht unter Marktwert (Linie bei etwa 3,8 C) |
| 12 Spieler (je 30 C MW), zehn Angebote 1,5 x MW | | | 8 gehen (12 → 4), p2/p3 haelt die Tiefe (Chris: „dann verkaufe ich 8 oder so“) |
| dieselben zehn Angebote 1,25 x MW | | | 4 gehen (12 → 8); unter dem Minimum kostet der Kaderdruck 10 % im Preis, dazu die Tiefe |
| dieselben Angebote 1,0 x MW | | | keiner |

### 9.3 Kaufseite: Tiefen-Aufstockung

Das Gegenstueck zur bestehenden Senkung um hoechstens 2 (`buildOrganicDraftFrame`, nur im Fenster ab Saison 2, nur mit Stempel):
traegt der Rahmen (Kasse, Toepfe, Vorstands-Freigabe, Kaderpflicht-Grenze) einen weiteren Platz zum Platzpreis mit einem Platz Luft, und
liegt die Einsatzquote (Spieler je Spieltag / Ziel) noch ueber dem Belastungsziel des Teams, hebt der GM das Ziel um einen Platz —
hoechstens 2 ueber den Identitaets-Opt, nie ueber 14 (`planeTiefenAufstockung`, `TIEFE_EINSATZ_ZIEL` 0,62, Tiefen-GM bis 0,57, Elite-GM
bis 0,67). Bei 8 Spielern je Spieltag heisst das: wer Geld hat, plant 12 bis 13 Koerper (Elite 12, Tiefe bis 14), wer knapp ist, bleibt
bei seinem Opt. Kein Notkauf, kein Auffuellen mit Billigst-Spielern: gekauft wird weiter nur, was der Planer nach Nutzen will.

**Finanzierung.** Die KI nimmt schon heute Kredite fuer Kaeufe auf (`resolveAiLoanDecision` in der Kreditprobe der Fenster-Sitzung und im
Kassensturz): sobald der Kader unter der Zwischenstufe Min + halber Weg zu Opt steht und die Kasse den Bedarf nicht traegt, im Rahmen der
Tragfaehigkeit und der Vorstands-Sperre. Daran wurde nichts geaendert (siehe Messung).

### 9.4 Messung

Derselbe Messweg wie 8.3 (`miss-teamfinanzen-saison.ts --stop-after spieltage --keep`, 32 KI von Anfang an, Saat 1 ohne Mischen bzw.
`--mischen 7`; je Kopie Saisonabschluss → Saisonende-Kette → Saisonwechsel → `fuehreKiPreseasonLaufAus`), auf **neu angelegten** Basen,
alle drei Staende auf derselben Basis: „main“ = `origin/main` (ohne Abschnitte 7 bis 9), „PR“ = Stand von Abschnitt 8 (`d05d19c5d`,
Gewinnmitnahme ab 1,1 x MW), „Abwaegung“ = dieser Stand. Stempel `verkaufSchwellen: neu` ab Saison 1. Kasse in C, Σ ueber 32 Teams.
Preis/MW = Abgangswert bzw. Verkaufspreis gegen den Marktwert nach der Abrechnung von S1. Top-3 = die drei besten Spieler des Teams nach
Rating vor dem Wechsel. Staerke = Mittel der besten 6 nach Rating (CLAUDE.md „beste 6“), Aenderung je Team.

| | S1 main | S1 PR | **S1 Abwaegung** | S7 main | S7 PR | **S7 Abwaegung** |
|---|---:|---:|---:|---:|---:|---:|
| Abgaenge gesamt | 133 | 106 | **88** | 152 | 117 | **96** |
| je Team min / Median / max | 0 / 3,5 / 11 | 0 / 3 / 6 | **0 / 3 / 6** | 0 / 5 / 10 | 0 / 3,5 / 7 | **1 / 3 / 5** |
| davon Planer / Tick (schlechter Vertrag, Moral, Heuristik) | 116 / 17 | 89 / 17 | **72 / 16** | 127 / 25 | 87 / 30 | **66 / 30** |
| Preis/MW Median (alle) | 0,86 | 1,14 | **0,88** | 0,87 | 1,10 | **0,92** |
| Preis/MW Median (Planer), Quartile | 0,86 (0,73–1,08) | 1,19 (0,84–1,30) | **0,96 (0,67–1,29)** | 0,87 (0,68–1,09) | 1,17 (0,87–1,32) | **1,05 (0,72–1,28)** |
| Planer-Abgaenge unter MW | 82 | 31 | **39** | 81 | 26 | **29** |
| Abgaenge ab 1,2 x MW (alle) | 18 | 44 | **25** | 19 | 40 | **22** |
| Top-3 unter den Planer-Abgaengen (Preis/MW) | 11 (0,75–1,18) | 4 (1,14–1,46) | **0** | 9 (0,65–1,31) | 5 (1,12–1,39) | **1 (1,07)** |
| Top-3 unter allen Abgaengen | 17 | 9 | **5** | 13 | 11 | **6** |
| Nachkaeufe (n / C) | 123 / 2582,57 | 109 / 2477,60 | **88 / 1972,59** | 150 / 2953,16 | 123 / 2580,95 | **105 / 2171,90** |
| Kader vor dem Kauf: Teams unter 8 | 17 | 12 | **10** | 22 | 13 | **12** |
| **Kader am 1. Spieltag S2** min / Median / max | 8 / 11 / 14 | 9 / 11 / 14 | **9 / 11 / 14** | 9 / 11 / 14 | 8 / 11,5 / 14 | **8 / 11,5 / 14** |
| davon Teams mit 13 / 14 | 2 / 5 | 0 / 10 | **2 / 7** | 5 / 4 | 1 / 10 | **6 / 8** |
| Kredite fuer Kaeufe | 0 | 0 | **0** | 0 | 0 | **0** |
| Δ Kasse | −1149,00 | −1079,57 | **−1128,07** | −1333,51 | −1082,34 | **−1294,74** |
| Δ Kaderwert (Σ MW) | +702,68 | +878,44 | **+798,50** | +788,52 | +822,70 | **+871,58** |
| **Δ Kasse + Kaderwert** | −446,32 | −201,13 | **−329,57** | −544,99 | −259,64 | **−423,16** |
| Δ Staerke (beste 6) je Team, Mittel | +2,60 | +2,96 | **+2,30** | +2,35 | +2,53 | **+2,04** |
| Verlaengert im Tick | 231 | 257 | **275** | 214 | 247 | **268** |

Verteilung der Abgaenge je Team (Anzahl Teams): S1 Abwaegung {0: 1, 1: 5, 2: 9, 3: 8, 4: 5, 5: 3, 6: 1}, S7 {1: 5, 2: 8, 3: 8, 4: 4,
5: 7}. Kader am 1. Spieltag S2: S1 {9: 6, 10: 6, 11: 6, 12: 5, 13: 2, 14: 7}, S7 {8: 1, 9: 3, 10: 7, 11: 5, 12: 2, 13: 6, 14: 8}.

**Lesart.**

- Keine Leistungstraeger mehr zu 1,1 bis 1,5 x MW: unter den Planer-Abgaengen ist hoechstens ein Top-3-Spieler (Saat 7, 1,07 x MW;
  nach Rating Top-3, nach der Bedarfs-Qualitaet des Teams nicht). Mit #1745 (PR) waren es 4 / 5, auf `main` 11 / 9 (dort auch unter MW).
  Die Top-3-Abgaenge, die bleiben (5 / 6), kommen aus dem Vertrags-Tick (schlechter Vertrag, Moral), nicht aus dem Verkaufsplan.
- Beide Richtungen kommen vor: rund ein Viertel der Planer-Abgaenge geht zu 1,2 x MW und mehr (Gewinn, Ueberleister ohne
  Schluesselrolle), etwas ueber die Haelfte (S1) bzw. 44 % (S7) unter MW — fast alles Bankspieler mit schwacher Saison (Rating der
  Abgaenge 27, der Zugaenge 36 bis 38), zum Boden des Verkaufsfaktors (0,65). Grosse Verluste in C bremst die Verlustscheu.
- Weniger Umschlag als PR und main (88 / 96 statt 106 / 117 bzw. 133 / 152), entsprechend weniger Nachkaeufe; die Spitze eines Teams
  liegt bei 5 bis 6. Wer viele richtig gute Angebote hat, kann aber weit mehr abgeben (Waechter: 8 von 12 bei 1,5 x MW).
- Kader am 1. Spieltag: keines unter 8, 9 / 14 Teams mit 13 bis 14 (main 7 / 9, PR 10 / 11).
- Vermoegen (Kasse + Kaderwert) liegt zwischen main und PR (−330 / −423 C gegen −201 / −260 PR und −446 / −545 main), ebenso die
  Staerke der besten 6 (+2,3 / +2,0 gegen +3,0 / +2,5 PR, +2,6 / +2,4 main): wer weniger umschlaegt, hebt weniger Gewinn ab, und
  Abgaenge unter MW kosten Buchwert. Das ist der Preis der Vorsicht, die Chris verlangt (Top-Spieler nicht fuer 1 C Gewinn); die
  Stellschrauben stehen in `VERKAUFS_ABWAEGUNG` (Abschnitt 9.6).
- Kredite: in keinem der sechs Laeufe — kein Team stand nach dem Fenster knapp (niedrigste Kasse nach dem Fenster rund 20 C, Teams am
  Minimum mit 100 C und mehr waren GMs mit kleinem Ziel). Die KI nimmt Kredite fuer Kaeufe nur, wenn die Kasse den Kaderbedarf nicht
  traegt (`resolveAiLoanDecision`); siehe offene Frage 3.

### 9.5 Tests

`tests/verkauf-kosten-nutzen.test.ts` (neu): die drei Zahlenbeispiele (10 C zu 11 C bleibt, zu 18 C geht; 6 C zu 4 C geht) und das
Mittelfeld; Verlustscheu; Tiefenkosten als Kurve; Finanznot; Charakter und Bauchgefuehl; Chris' 8-raus/12-rein (zehn Angebote zu 1,5 x
MW ⇒ 8 von 12 gehen, am Vertragsende wie im Fenster; danach hebt die Tiefen-Aufstockung das Ziel 10 → 12 und der Kaufplaner kauft
mindestens 8 nach); Aufstockung ohne Geld, Elite- gegen Tiefen-GM. `tests/verkauf-keine-groessenbremse.test.ts`: Chris' Beispiel jetzt
mit 1,5 (8 gehen) und 1,25 (4 gehen, Kaderdruck und Tiefe beenden), ohne gutes Angebot keiner. `tests/verkauf-restgehalt.test.ts`:
Vertragsende = Fenster-Abwaegung, schwache Spieler unter MW. `tests/wirtschafts-regeln-runde2.test.ts`: Kernschutz-Waechter misst die
Nutzen-Runde (`verkaufSchwellen: alt`).

### 9.6 Offene Fragen an Chris

1. **Zahlen der Abwaegung.** Ueberleistung zaehlt zu 25 %, Unterleistung zu 50 % als bestaendig; Team-Bedeutung linear darueber, steil
   darunter; Ersatzrisiko 4 %, Wechselkosten ein Viertel Jahresgehalt, Marge 3 %, Verlustscheu 0,5 x V²/(V + 4), Tiefe 4 C x
   Belastungsdifferenz, Bauchgefuehl ± 6 %. Gesetzt nach den Beispielen und zwei Messlaeufen, nicht abgestimmt.
2. **Wie viel Umschlag?** Jetzt 88 / 96 Abgaenge je Liga (PR 106 / 117), Preis-Median 0,96 / 1,05 im Plan. Soll die KI mehr Gewinn
   mitnehmen (z. B. Marge/Ersatzrisiko senken), auf Kosten von etwas mehr Abgaengen guter Mittelfeldspieler?
3. **Kredite.** Die KI leiht nur bei echter Kassenluecke; im Fenster S1 → S2 hatte kein Team eine. Soll es einen „Investitionskredit“
   geben (gutes Upgrade am Markt, Kasse reicht knapp nicht, Tragfaehigkeit da), der auch bei voller Kasse fuer einen Zusatzkauf greift?
4. **Tiefen-Aufstockung.** Belastungsziel 0,62 Spieler je Spieltag pro Kopf (bei 8 je Spieltag: 13 Koerper), hoechstens +2 ueber den Opt.

## 10. Team-Blick: Verkauf und Nachkauf als ein Plan, Kredit nach Risikobereitschaft (Chris, 25.11.)

Chris, woertlich, zu den offenen Fragen aus 9.6: „1. ja die ki soll häufiger gewinne mitnehmen! das ist essenziell um das team zu
sichern gerade bei guten deals - du hast das einzeln jetzt ganz gut aufbereitet aber es gibt keinen team blick darauf der sagt ok ich hab
jetzt 2 leute unter wert verkauft vllt sollte ich dann doch meinen starken teuren player verkaufen wenn der n gutes angebot hat um das zu
kompensieren und mich neu aufzustellen ODER teams die knapp bei kasse sind müssten verkaufen damit sie vllt 1 teuren spieler verkaufen um
2 mittlere zu holen - oder nen mittleren oder günstigen verkaufen und nicht nachbesetzen um cash zu generieren etc 2. ja das team soll
kaufen, aber wenn sie das geld noch haben benötigen sie den kredit nicht, wenn kein geld da ist aber es die lage vom team verbessert hängt
das auch bisschen von der risikobereitschaft des teams ab ob sie ihre lage verbessern wollen mit dem kredit 3. ja passt“ (3 = Tiefen-Aufstockung,
bleibt wie 9.3).

### 10.1 Was sich geaendert hat

Alles hinter demselben Stempel `seasonState.wirtschaftsRegeln.verkaufSchwellen`.

1. **Haeufiger Gewinne mitnehmen** (`VERKAUFS_ABWAEGUNG`): Ersatzrisiko 0,04 → 0,025, Wechselkosten 0,25 → 0,15 Jahresgehalt, Marge
   0,03 → 0,015. Ein Mittelfeldspieler geht jetzt ab etwa 1,1 x MW (vorher 1,16), ein Leistungstraeger (Staerke 1,25 x Median, Leistung
   1,2) weiter erst ab gut 1,5 x MW (Linie 15,3 C bei 10 C MW; 11 C bleibt), der schwache Spieler 6 C zu 4 C geht weiter.
2. **Bilanz der Runde** (`buchBilanz`, Posten `Ausgleich` der Abwaegung): die Verkaufsrunde fuehrt Σ (Erloes − MW) ihrer Abgaenge mit.
   Steht sie im Minus, rechnet ein Gewinnverkauf mit 0,5 x min(Buchverlust, Gewinn) hoeher — wer zwei unter Wert abgab, nimmt den guten
   Deal fuer den Dritten mit, statt ihn knapp liegen zu lassen. Grund im Protokoll `ausgleich`.
3. **Knapp bei Kasse** (`liquiditaetsDruck`): Druck = (Ziel − Kasse) / Ziel mit Ziel = max(Puffer, 0,5 x Jahresgehalt des Kaders), 1 in
   Finanznot. Der Druck hebt den Liquiditaetswert des Erloeses (0,2 x Druck x Erloes) und senkt Marge und Verlustscheu mit (1 − Druck);
   die Tiefenkosten bleiben voll. So verkauft ein klammes Team einen mittleren oder guenstigen Spieler fuer Bargeld, solange die Tiefe es
   traegt, ein reiches behaelt ihn. Grund `cash_verkauf`, wenn die Liquiditaet den Ausschlag gibt. Nachbesetzt wird danach nur, was der
   Kaufplaner im Rahmen (Vorstand, Ruecklage) noch will.
4. **Umbau-Plaene** (`planOrganicSellsForTeam`, nach den Einzelabgaengen): fuer die zwei teuersten Spieler (MW ≥ 1,25 x Kader-Median)
   mit Angebot ueber dem Marktwert rechnet das Team den ganzen Plan durch — Verkauf + Nachkauf mit dem **bestehenden Kaufplaner**
   (`buildOrganicDraftFrame` + `buildOrganicSquadPlan`, freie Spieler des Spielstands, auf 150 gleichmaessig ueber die Preise
   ausgeduennt) gegen Halten + Nachkauf. Wert eines Plans = Marktpreis je Qualitaetspunkt (Steigung MW ~ Qualitaet am Markt) x Staerke der
   besten 6 + Kasse nach den Kaeufen − ein Jahr Gehalt; Risiko 0,1 x Abloesen der Nachkaeufe + Wechselkosten; dazu der Bilanz-Ausgleich.
   Der beste Plan mit Gewinn wird genommen (Grund `umbau`, der Plan haengt an der Entscheidung), dann neu bewertet; hoechstens 2 Runden.
   Ein Kernspieler darf hier schon ab 1,1 x MW gehen (statt Kernschutz 1,5 / 1,4 / 1,3): der Ersatz ist mit echten Marktangeboten
   durchgerechnet, das ist die begruendete Ausnahme. Ohne Markt (Tests, leerer Pool) entfaellt die Stufe.
5. **Risiko-Kredit** (`resolveAiLoanDecision` → `risikoKreditOder`, `kreditRisikoBereitschaft`): sagt der bedarfsgetriebene Kredit
   `no_need` / `cash_sufficient` / `shortfall_minor`, prueft die KI einen zweiten Weg bis Opt + 1: Bedarf zum Fuellpreis gegen das
   ausgebbare Geld (fehlt weniger als 8 C, kauft das Team ohne Kredit), Risikobereitschaft = 0,5 + 0,07 x (riskTolerance − 5) − 0,06 x
   (cashPriority − 5) + 0,03 x (starPriority − 5) + 0,02 x (Finanzwert − 5), Schwelle 0,55, Betrag = Fehlbetrag x Bereitschaft x
   Leverage-Bereitschaft, dieselbe Kapazitaet, Tragfaehigkeit und Vorstands-Sperre. Ob der Kauf das Team verbessert, entscheidet danach
   die Kaufplan-Probe der Fenster-Sitzung (`deckleKreditAufKaufplan`: kein Kredit ohne geplanten Kauf). Grund `risk_driven_borrow`.

### 10.2 Messung

Derselbe Messweg wie 9.4 auf neu angelegten Basen (32 KI von Anfang an, Saat 1 bzw. `--mischen 7`), beide Staende auf derselben Basis:
„Abschnitt 9“ = Commit `fa871880e`, „Team-Blick“ = dieser Stand. Top-3 nach Rating vor dem Wechsel; Staerke = Mittel der besten 6 nach
Rating, Aenderung je Team.

| | S1 Abschnitt 9 | **S1 Team-Blick** | S7 Abschnitt 9 | **S7 Team-Blick** |
|---|---:|---:|---:|---:|
| Abgaenge (je Team min / Median / max) | 99 (0 / 3 / 6) | **113 (1 / 3 / 6)** | 101 (1 / 3 / 6) | **113 (2 / 3 / 6)** |
| davon aus dem Verkaufsplan | 75 | **90** | 80 | **90** |
| **Gewinnverkaeufe (Preis > MW), Median Preis/MW** | 48 / 1,22 | **60 / 1,23** | 55 / 1,21 | **68 / 1,21** |
| Verkaeufe unter MW, Median | 51 / 0,69 | **53 / 0,69** | 46 / 0,66 | **45 / 0,66** |
| Preis/MW Median aller Abgaenge | 0,99 | **1,04** | 1,02 | **1,04** |
| Umbau-Plaene (Plan kauft ≥ 2) | – | **4 (4)** | – | **4 (4)** |
| Bilanz-Ausgleich | – | **0** | – | **3** |
| Cash-Verkauf ohne Nachbesetzung | – | **0** | – | **0** |
| Top-3 im Verkaufsplan (Preis/MW) | 5 (1,07–1,40) | **8 (1,07–1,58)** | 0 | **4 (1,13–1,30)** |
| Nachkaeufe (n / C) | 107 / 2238,56 | **119 / 2475,65** | 110 / 2272,76 | **120 / 2542,49** |
| Kader 1. Spieltag S2 min / Median / max | 9 / 11 / 14 | **9 / 11,5 / 14** | 9 / 11,5 / 14 | **9 / 11 / 14** |
| Teams mit 13 / 14 | 1 / 9 | **3 / 6** | 1 / 10 | **2 / 9** |
| Kasse am Fensterende min / Median | 13,7 / 49,3 | **13,7 / 48,5** | 10,1 / 49,4 | **10,1 / 50,4** |
| Kredite | 0 | **0** | 0 | **0** |
| Δ Kasse | −1252,86 | **−1206,10** | −1252,05 | **−1186,21** |
| Δ Kaderwert | +949,72 | **+954,30** | +937,21 | **+948,30** |
| **Δ Kasse + Kaderwert** | −303,14 | **−251,80** | −314,84 | **−237,91** |
| **Δ Staerke beste 6** je Team | +2,23 | **+2,38** | +2,30 | **+2,57** |

**Lesart.**

- Mehr Gewinn mitgenommen: 60 / 68 Gewinnverkaeufe statt 48 / 55, im Median zu 1,23 / 1,21 x MW. Verkaeufe unter Wert bleiben etwa
  gleich (53 / 45). Vermoegen und Staerke werden beide besser: Kasse + Kaderwert +51 / +77 C gegen Abschnitt 9, Staerke der besten 6
  +0,15 / +0,27 je Team.
- Umbau: je Liga 4 Plaene, alle mit mindestens zwei Nachkaeufen. In 5 von 8 ist der Kader danach staerker als beim Halten (z. B.
  Staerke-Summe 246,8 gegen 231,2), in 3 traegt die Kasse den Gewinn (etwas schwaecher, aber 12 bis 29 C Wert mehr). Verkauft wurden
  Spieler um 19 bis 40 C MW.
- Top-3: im Verkaufsplan 8 / 4 Top-3-Spieler (nach Rating), alle ueber dem Marktwert (1,07 bis 1,58) — die Umbau-Ausnahme und das
  niedrigere Ersatzrisiko. Abschnitt 9 hatte 5 / 0.
- Cash-Verkauf: keiner — nach Saison 1 ist kein Team knapp (Kasse vor dem Fenster rund 100 C je Team, niedrigste am Fensterende 13,7 /
  10,1 C). Die Regel greift erst bei klammen Teams (Waechter-Test).
- Kredite: keine. In Saat 1 (Diagnose-Lauf) qualifizieren sich 4 risikofreudige Teams (Risiko 0,56 bis 0,77) fuer den Risiko-Kredit; die
  Kaufplan-Probe der Sitzung findet bei ihnen keinen Kauf, den das Geld ermoeglichen wuerde (`ai_loan_skipped_no_plan`): sie stehen schon
  auf ihrem Ziel. Die uebrigen: 25 `no_need`, 2 `cash_sufficient`, 1 Tragfaehigkeit. Genau Chris' Regel: wer das Geld hat oder nichts
  kaufen will, leiht nicht.
- Kader am 1. Spieltag: keiner unter 9.

### 10.3 Tests

`tests/verkauf-team-blick.test.ts` (neu): (1) Bilanz-Ausgleich — 24 C fuer einen 20-C-Leistungstraeger reicht allein nicht, nach 7 C
Buchverlust schon; (2) Umbau — der Teure (60 C MW, Angebot 1,15) geht als `umbau`, der Plan kauft mindestens zwei mittlere und ist mehr
wert als Halten; ohne gutes Angebot oder ohne Markt kein Umbau; (3) Cash-Verkauf — Kasse 6 C verkauft mehr als Kasse 300 C, mindestens
einer als `cash_verkauf`, der Kader bleibt bei 8 oder mehr; (4) Risiko-Kredit — mutig (riskTolerance 9) leiht mit `risk_driven_borrow`,
vorsichtig nicht, mit Geld nicht, ohne Stempel `no_need`. Angepasst: `tests/verkauf-kosten-nutzen.test.ts` (Linien 1,1 bzw. 1,5 x MW),
`tests/verkauf-keine-groessenbremse.test.ts` (1,25 x MW: 5 bis 8 bleiben).

### 10.4 Offene Fragen an Chris

1. **Kredite fuer Upgrades.** Der Risiko-Kredit fuellt bis Opt + 1; ein Team auf seinem Ziel, das einen besseren Spieler nur mit Kredit
   bekaeme, leiht nicht, weil der Kaufplaner auf dem Ziel kaum noch kauft. Soll ein Kredit auch einen reinen Qualitaetstausch
   (verkaufen + teurer nachkaufen) finanzieren?
2. **Umbau-Ausnahme vom Kernschutz** ab 1,1 x MW, wenn der durchgerechnete Plan staerker oder deutlich mehr wert ist. Passt die Schwelle?
3. **Knapp bei Kasse** = Kasse unter max(Puffer, halbes Jahresgehalt). Nach Saison 1 trifft das niemanden; soll die Messung eine spaetere
   Saison (S2 → S3) abdecken, um Cash-Verkaeufe und Kredite unter Druck zu sehen?

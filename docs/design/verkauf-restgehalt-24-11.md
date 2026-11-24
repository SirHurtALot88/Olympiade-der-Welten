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
3. **Rueckweg-Schalter auf dem Server.** `OLY_KI_RESTGEHALT` muss in `deploy/hetzner/docker-compose.yml` und `.env` eingetragen
   werden, wenn der Rueckweg gebraucht wird.

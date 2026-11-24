# Sponsoren-Rework: Bau Phase 0 bis 3 (24.11.)

Konzept: `docs/design/sponsoren-rework-22-11.md` (Abschnitt 13 = Entscheidungen Chris, 23.11., gehen allen früheren Abschnitten vor).
Mockup für die Seite (kommt in der Folge-PR): `public/mockups/sponsoren-modern-22-11.html`. Diese PR baut **keine Seite**; die alte Sponsorenseite
läuft weiter, zeigt unter dem neuen Stempel aber noch die Zahlen des alten Systems (siehe „Offen für die Seiten-PR“).

## 1. Was gebaut ist

| Phase | Inhalt | Stelle |
|---|---|---|
| 0 | Messwerkzeug: `miss-teamfinanzen-saison.ts` schreibt den eingefrorenen Topf-Stand je Team, die Termine und die Farb-Topf-Verteilung; `auswerte-sponsor-topf.ts` rechnet die Abnahme (Liga-Wert, Drift, GuV-Mittel, Modell gegen gebaute Regel) | `scripts/miss-teamfinanzen-saison.ts`, `scripts/auswerte-sponsor-topf.ts` |
| 1 | Stempel `seasonState.sponsorRegel`, Liga-Topf, Grundbetrag, Leistungsteil mit Liga-Ausgleich, Vorab-Zusage, Stichtag, Buchung über den bestehenden Spieltagsweg plus Schlussausgleich, ein gemeinsamer Erwartungsrang mit dem Vorstand | `lib/resolve/sponsor-regel.ts`, `lib/sponsors/*` |
| 2 | Drei Vertragsarten (Fest 0,5 / Leistung 1 / Prämie 1,5), gewählte Laufzeit 1 bis 3 mit Treuebonus, Ziel mit neuem Einsatz, KI-Wahl nach Konzept 7, Überführung laufender Verträge | `sponsor-topf-wahl.ts`, `sponsor-topf-modell.ts`, `sponsor-offer-service.ts` |
| 3 | Farb-Partner mit Farb-Töpfen, Sponsorentermin als Entscheidung (max. 2 je Saison, +1,5 C gegen Form −1 Stufe), Würfel-Ereignisse aus | `sponsor-topf-buchung.ts`, `sponsor-topf-termine.ts`, `sponsor-event-service.ts` |
| Schreibwege | `POST /api/sponsor/choose` nimmt `vertragsart`, `laufzeit`, `farben`; `POST /api/sponsor/event` nimmt `terminId` + `antwort` (`zusagen`/`absagen`/`ki`). Beide hinter `authorizeServerRoomWrite` mit `resolveAuthoritativeWriteOwnerId`, frisch vom Server gelesen, je Team | `app/api/sponsor/choose/route.ts`, `app/api/sponsor/event/route.ts` |
| View-Modell | `baueSponsorUebersicht(gameState, teamId)` für die vier Ansichten der Folge-Seite | `lib/sponsors/sponsor-uebersicht.ts` |

### Entscheidungen Chris 23.11., wie umgesetzt

1. **κ = 1** (Kader-Ersatz an, auch in Saison 1): `K_E = 0,06 × Σ Kaderwert` (Saison 1 zusätzlich +0,08, siehe Abschnitt 7: die Konstanten sind **gemessen**, nicht aus dem Konzept übernommen). Die Steigung ist mit Kader-Ersatz 1,8 / 1,6 C je Erwartungsrang (nachkalibriert, Abschnitt 7). Dazu eine **Liga-Wert-Rückkopplung** (Abschnitt 2), die den Rest auf „die Liga bleibt im Wert“ zieht.
2. **Neue Einnahmen verdrängen den Topf**: in `P_i` stehen die gebauten Posten Tickets samt Dauerkarten (`ticketsSaisonbetrag`, nur mit `arenaAktiv`), Marketing (`marketingJahresbetrag`, nur mit `marketingAktiv`), Medaillen (Planwert 1,25 / 0,75 C, nur mit `medaillenAktiv`), Gebäude-Einnahme, Vorstandsziele (6,5 C Plan, gemessen 5,2 bis 7,6 C) und Sponsorentermine (1,5 C Plan). Ungebaute Posten (Verpflegung, Versicherung, Trainingslager, Ausrüstung) stehen **nicht** in `B_i`: sonst wäre der Topf um Geld größer, das nie ausgegeben wird.
3. **Keine Seltenheitsstufen auf neuen Angeboten, stattdessen Passung** 0,95 bis 1,05 (2/3 Beliebtheit des Kaders gegen das Liga-Mittel, 1/3 Treue 0 bis 3 Saisons), über die Liga auf Mittel 1,00 normiert (topfneutral), deterministisch. Der Leih-Kurs folgt der Passung (`leihKursFuerPassung`: 1,4 bis 3,0). Laufende Verträge behalten ihre alten Konditionen bis zum Vertragsende (der Vertrag rollt wie bisher, nur das Geld rechnet neu).
4. **Der Farb-Partner ist der Farb-Meister**: unter dem Topf-Stempel zahlt `berechneVergabe` keinen Farb-Meister mehr (die Schleife läuft über keine Liga), die Medaillen bleiben. `rangPraemieFaktor` ist unter dem Stempel 1 (es gibt keine Rang­prämie zu kürzen).

## 2. Formeln, wie gebaut (`lib/sponsors/sponsor-topf-modell.ts`)

```
F    = Grundwert (Stempel, 1,00) x Konjunktur;   Konjunktur = klammere(1 + (f_alt - 1) x 0,24, 0,95 .. 1,05)    f_alt = seasonEconomyFactors[0]
K_B  = klammere( Summe_i (B_i - P_i),  0,85 x K_B,Vorjahr,  1,15 x K_B,Vorjahr )          Saison 1: K_B,Vorjahr = Summe_i (59 C - P_i)
K_E  = (0,06 + 0,08 in Saison 1) x Summe_i W_i
Korr = klammere( Korr_alt + 0,75 x (V_Stichtag - V_Vorjahr),  +-6 % von F x (K_B + K_E) )      V = Summe Kasse + Summe Kaderwert
T    = F x (K_B + K_E) - Uebertrag - Korr
T_H  = T - 4 x (12 x F + 9 x F) - Summe Treueboni                                                              Farb-Toepfe Liga 1 / Liga 2 je Farbe
x_i  = T_H / 32 x a_L / mittel(a)  +  F x s_L x (mittel_L(E) - E_i)  +  0,8 x (Beliebtheit_i - mittel_L)       a = 1,11 / 0,89
G_i  = x_i x p_i x (Summe_L x / Summe_L x p)        p = Passung (roh), Summe je Liga bleibt Summe x
L_i  = F x p_L x sigma x [ h_i (E_i - R_i) - mittel_L( h_j (E_j - R_j) ) ]      p_L = 3,0 / 2,5, sigma 0,5 in Saison 1, sonst 1
Farb = Topf (Liga, Farbe) verteilt 40/25/15/10/5/5 % nach Farbpunkten (pointsByArea), Gleichstand teilt
Ziel = Einsatz x (2 x Erfuellung - 1),  Einsatz 0 / 4 / 8 C
```

- **Liga-Wert-Rückkopplung** (neu, nicht im Konzept): Entscheidung 1 verlangt „die Liga bleibt im Wert“. Eine feste Quote Kader-Ersatz trifft das nur zufällig (die Messung zeigt +1,5 bis +4 % je Saison, Abschnitt 7). Der Stichtag misst deshalb den Liga-Wert (`ligaWert`), vergleicht ihn mit dem Stichtag der Vorsaison und schreibt 75 % der Abweichung als Korrektur des Topfs fort (integrierend, auf ±6 % des Topfs gedeckelt; wächst der Wert, sinkt der Topf). Der Stempel der nächsten Saison trägt `ligaWertVorjahr` und `ligaWertKorrektur` als Bezug weiter.
- **Rundung**: jede an die Kasse gehende Zahl liegt auf 0,1. `rundeMitSumme` (Methode des größten Rests) hält die Summe exakt: Grundbetrag je Liga = Summe `x`, Leistungsteil je Liga = **0**, Farb-Topf = Topf auf 0,1.
- **Erwartungsrang** `E_i`: Stärkerang des Vorstands (`computeTeamExpectation`), ab Saison 2 ungerundet mit dem Vorjahres-Anteil gemittelt, je Liga so geschoben, dass die Summe n(n+1)/2 ist (136 bei 16 Teams). Vor dem Draft (keine Kader) liegen alle in der Mitte. **Nach dem Stichtag liest der Vorstand denselben Wert** (`sponsorAnkerFuer`, gerundet in `computeTeamExpectation`).
- **Vorab-Zusage**: `stempleVorlaeufig` rechnet beim Saisonwechsel und beim Anlegen einen vorläufigen Topf (Betriebsteil der Vorsaison statt der heutigen Kosten) und je Team einen vorläufigen Grundbetrag in den Stempel. Am Stichtag liegt jedes Team mindestens bei 90 % davon; der Fehlbetrag kommt anteilig von den Teams über ihrer Untergrenze (Liga-Summe bleibt). Reicht der Topf nicht für alle Untergrenzen (die Bremse erlaubt bis 15 % weniger als vorläufig gerechnet, die Zusage verspricht 90 %), werden die Untergrenzen anteilig auf 97 % der Liga-Summe gekürzt, damit ein Gefälle bleibt. Die KI-Kaufplanung (`erwarteterSponsorFuerPlanung`) rechnet mit genau diesen 90 % plus Treuebonus, Leistungsteil 0, **plus** den vom Topf verdrängten Einnahmen (Tickets, Marketing, Medaillen, erwarteter Farb-Anteil): die Planung zählt diese Posten sonst nirgends, und ohne sie kaufte die KI deutlich kleinere Kader als im alten System (erster Lauf ohne diese Posten: Draft-Kader 11,0 statt 11,5; mit ihnen 11,7 bis 11,9).
- **Übertrag**: `uebertragFuerSaisonwechsel` = gebuchte Sponsorsumme der Vorsaison minus Topf, gedeckelt auf ±3 % des Topfs; er geht mit umgekehrtem Vorzeichen in den Topf der nächsten Saison.
- **Treuebonus**: +1 C im 2., +2 C im 3. Vertragsjahr, vorab aus dem Topf genommen (steht in der Zeile Grundbetrag, getrennt ausgewiesen).

### Buchung (gezeigt = gebucht)

| Betrag | je Spieltag | Saisonende |
|---|---|---|
| Grundbetrag + Treuebonus | `sponsorBasis`, 1/N (über `sponsorBasisJahr`) | Zeile „Grundbetrag“ bucht nur den Rest (0) |
| Leistungsteil | `rangAbschlag` = 80 % von `L` beim heutigen Platz, 1/N (über `sponsorRangAbschlag`) | Zeile „Leistungsteil“ = Schlussausgleich auf den Endrang (darf negativ sein) |
| Farb-Partner | – | Zeile „Farb-Partner“ (eine Zeile je Team, Summe aus beiden Farben) |
| Ziel | – | Zeile „Ziel“ |
| Sponsorentermin | – | sofort bei Zusage: `SponsorEventRecord` (Typ `sponsor_termin`), steht in der bestehenden GuV-Zeile der Sponsor-Ereignisse |

Die Saisonende-Zeilen kommen aus `topfSaisonendeZeilen`; dieselben Funktionen speisen `baueSponsorUebersicht`.

## 3. Stempel und Rückweg

`seasonState.sponsorRegel = { seasonId, version: "topf"|"alt", saisonfaktor, kaderErsatz, betriebsteilVorjahr, uebertrag, ligaWertVorjahr?, ligaWertKorrektur?, vorlaeufig, eingefroren, termine?, notbremse? }`
(Muster `formkarten-regel.ts`; Typen in `lib/sponsors/sponsor-topf-typen.ts`.)

- **Neues Spiel** (nur Battle): `"topf"` ab Saison 1, gesetzt in `new-game-setup-service.ts` **vor** der Angebotserzeugung, damit die KI-Wahl Vertragsart, Laufzeit und Farben an den Vertrag hängt.
- **Bestehender Spielstand**: Lade-Migration `stempleSponsorRegelNachLaden` schreibt für die laufende Saison `"alt"`; sie rechnet bit-gleich alt zu Ende (Test „alt-Stempel“). Beim nächsten Saisonwechsel (`preseason-workflow-service.ts`) bekommt die neue Saison `"topf"`, `ueberfuehreAltvertraege` macht aus jedem laufenden Altvertrag einen Leistungsvertrag derselben Marke (Restlaufzeit bleibt, Vertragsjahr aus der Laufzeit, Treuebonus zählt weiter, KI-Farben, `gewaehltVon: "ueberfuehrt"`). Die alten Konditionen (`sponsorV3`) bleiben am Vertrag und rollen weiter: ein Rückweg landet ohne Datenverlust im alten System.
- **Rückweg** `OLY_SPONSOR_REGEL=aus`: neue Saisons bekommen `"alt"`. **Notbremse** `=aus-sofort`: `spiegleSponsorNotbremse` (Spieltagsabschluss, nur Server) setzt `notbremse` im Stempel; danach zahlt der Grundbetrag weiter, Leistungsteil und Farb-Partner sind 0, es entstehen keine neuen Termine. Die Variable wird **nur** in `lib/resolve/sponsor-regel.ts` gelesen (Test „nur dort aus der Variable gelesen“). Sie muss noch in `deploy/hetzner/docker-compose.yml` und `.env.example` stehen (diese PR fasst `deploy/` nicht an); ohne Eintrag gilt der Standard „an“.
- **Stichtag** = Fensterschluss vor der ersten Wertung (`legacy-matchday-result-apply-service.ts`, neben dem Einfrieren der Apron-Linien), Rückfall beim ersten Buchen (`bucheSpieltagFinanzen`). Idempotent. Wer bis dahin keinen Vertrag hat, bekommt den Leistungsvertrag des Angebots mit der besten Passung, Laufzeit 1, KI-Farben (`gewaehltVon: "auto"`): der Stichtag wartet nie auf einen Menschen.

## 4. Mehrspieler und Delegation

- Alles hängt am Team (Vertrag, Wahl, Farben, Termine); das aktive Team kommt wie bisher aus `activeManagerTeamId`/`authorizeServerRoomWrite`, nie aus „Chris“ oder `teams[0]`.
- „Mensch überschreibt, KI respektiert das“: `chooseSponsorOffer({ topf })` nimmt gesetzte Felder, die KI füllt nur fehlende (`ergaenzeTopfWahl`). Delegierte Menschen (`waehleSponsorFuerDelegierteTeams`) wählen mit `gewaehltVon: "delegiert"`.
- Sponsorentermin: Menschen entscheiden über die Route (`zusagen`, `absagen`, `ki` = an die KI geben). KI-Teams, passive Teams und Menschen mit delegiertem Bereich „sponsor“ werden beim Spieltagsabschluss sofort beantwortet. Ein Mensch ohne Delegation hält nichts auf: der Termin verfällt nach zwei Spieltagen als „abgesagt“.

## 5. Abweichungen vom Konzept

| Konzept | Gebaut | Grund |
|---|---|---|
| Vertragsart, Farben im Stempel | am Vertrag (`contract.sponsorTopf`) | rollen mit dem Mehrjahresvertrag, ein Rückweg verliert nichts; der Stempel hält nur Liga-Größen |
| „Prestige“ 0,97 bis 1,04 | entfällt, ersetzt durch Passung (Entscheidung 3) | Chris 23.11. |
| Konjunktur 0,95 bis 1,05 um „Faktor“ | `1 + (f_alt − 1) × 0,24` | der alte Faktor 1,00 bleibt 1,00 (Messläufe mit Faktor 1 treffen genau den Grundwert); die Spanne 0,82 bis 1,24 wird auf ±5 % abgebildet |
| Würfel-Seltenheit der **Angebote** | das alte Angebotsgerüst (Marke, Variante, Achse, Leihe, Rarity-Feld) bleibt; die Seltenheit wirkt unter dem Stempel **nicht mehr auf Geld** | das Gerüst weiter zu nutzen hält alle bestehenden Wege (Phasen, Delegation, Leihe) heil. Die Seite blendet die Stufe aus |
| Ziel für jede Vertragsart | nur Angebote mit Achsen-Karte tragen ein Ziel; die Basis-Karte hat keines (Einsatz 0, die Übersicht meldet `einsatz: 0`) | das Ziel-Gerüst hängt an der Achsen-Karte, ein zweites Ziel zu erfinden war nicht Auftrag |
| Form −1 des Sponsortermins | eine Stufe = `FORM_PUNKTE_JE_STUFE` (15 Punkte auf 0..100) sofort bei Zusage | „Form −1“ ist dort die Anzeigestufe |
| KI-Sponsorentermin „nicht aufgestellt oder nicht knapp“ | zusagen, wenn der benannte Spieler nicht zu den besten vier des Kaders gehört oder die Kasse unter 20 C liegt (plant 1,5 C je Team: zwei Termine, rund die Hälfte zugesagt) | die Formkarten-Knappheitsrechnung braucht die Aufstellung des nächsten Spieltags, die zum Abschlusszeitpunkt noch nicht steht |
| Leih-Kurs folgt Passung | `leihKursFuerPassung` ist gebaut und getestet, ein Angebot trägt den Kurs im View-Modell; die Gebäude-Leihe steht im Spiel weiterhin auf AUS (`SPONSOR_GEBAEUDE_LEIHE_AKTIV`), das Angebotsgerüst setzt ihren Kurs also nicht neu | Leihe ist abgeschaltet; wird sie wieder eingeschaltet, setzt die Seiten-PR den Kurs aus dem View-Modell |
| Passung auf der Angebotskarte | `angebote[].passung.wert` ist die rohe Passung (0,95 bis 1,05); die Normierung auf Liga-Mittel 1,00 passiert am Stichtag über die tatsächlich unterschriebenen Verträge (`passung` im eingefrorenen Stand) | vor dem Stichtag gibt es kein Liga-Mittel der Passung |
| Bezug der Bremse, Kader-Ersatz, Steigung | siehe Abschnitt 7 (gemessen nachkalibriert) | die Konzeptzahlen widersprachen den Läufen |
| Liga-Wert-Rückkopplung | neu | Entscheidung 1 verlangt „Liga bleibt im Wert“; eine feste Quote trifft das nicht robust |
| Vorab-Zusage ≥ 90 % | anteilig gekürzt, wenn der Topf unter der Bremse nicht reicht | 90 % und eine Bremse von 15 % schließen sich sonst aus |
| KI-Planung | Zusage + verdrängte Einnahmen (Tickets, Marketing, Medaillen, Farb-Mittel) | sonst plant die KI mit zu wenig Geld |
| „Nachfordern“ | nicht gebaut | Phase 4 |

## 6. View-Modell der Seite (`baueSponsorUebersicht`)

`baueSponsorUebersicht(gameState, teamId): SponsorUebersicht | null` — `null` unter dem alten System (die alte Seite bleibt zuständig). Rechnet nichts selbst, liest `topfStandFuer`, `topfLeistungJetzt`, `topfFarbVerteilung`, `topfZielAuszahlung` und das Ledger.

| Feld | Inhalt | Ansicht |
|---|---|---|
| `eingefroren`, `notbremse`, `faktor`, `spieltage`, `gebuchteSpieltage` | Stand des Stichtags, Notbremse, Gesamtfaktor | alle |
| `vertrag` | Marke, Vertragsart, Hebel, Laufzeit, Vertragsjahr, Restsaisons, Farben, Passung (Wert + Text), Treuebonus; `zeilen.{grund, leistung, farbe, ziel}` mit `saison` (Hochrechnung „wenn die Saison heute endete“), `jeSpieltag`, `gebucht`; Leistung zusätzlich `satzJePlatz`, `platzJetzt`, `erwartungsrang`, `abstand`; Ziel `einsatz`, `erfuellung`; `hochrechnung.{saison, jeSpieltag, gebucht}` | Vertrag |
| `leistungVerlauf[]` | je gebuchtem Spieltag Platz, Erwartungsrang, gebuchter Abschlag | Vertrag („Leistungsteil je Spieltag gegen die Erwartung“) |
| `farbPartner[]` | je Farbe Topf, Teilnehmer, eigener Platz und Punkte, Betrag heute, `rangliste[]` | Vertrag |
| `termine[]` | Sponsortermine der Saison (Status, Spieler, Betrag) | Vertrag |
| `angebote[]` | ohne Vertrag: je Angebot Marke, Passung (`wert`, `text`, `zBeliebtheit`, `treueSaisons`), `leihKurs`, `grundbetragRichtwert.{saison, jeSpieltag, zusage}`, `arten[]` (drei Vertragsarten mit Hebel, Zieleinsatz, Satz je Platz, `spannweite.{besterRang, beiErwartung, schlechtesterRang}`), `laufzeiten[]` mit Treuebonus je Jahr | Angebote |
| `liga_vergleich[]` | 16 Teams der eigenen Liga: Marke, Vertragsart, Farben, Erwartungsrang, Platz, Grund, Leistung, Farbe, Ziel, Summe heute, Kosten, Plan-Einnahmen, `guvBeiErwartung`; `nebel: true` für fremde Teams (die Seite zeigt Erwartungsrang und Stärke dann nur grob, Scouting-Nebel) | Liga |
| `rechnung` | die vier Schritte (`betrieb`, `ersatz`, `faktor`, `verteilung`) mit Formel und Wert, dazu `betriebsteil`, `kaderErsatz`, `uebertrag`, `topf`, `farbToepfe`, `treueSumme`, `hauptTopf`, `ligaMittelBeiErwartung` | Rechnung |

Der Regler „Faktor“ des Mockups rechnet die Seite selbst mit `berechneTopf` aus `sponsor-topf-modell.ts` (reine Funktion, client-sicher).

## 7. Messung

Aufbau: `scripts/miss-teamfinanzen-saison.ts`, 32 KI-Teams von Anfang an (kein Preset mit Menschen), Battle-Modus 2×16, Draft im Einzelschritt, 20 Spieltage,
**Saisonfaktor fest 1,00** (`OLY_LONG_RUN_SALARY_FACTOR_PATTERN=1,1,…`), drei Saisons. Auswertung: `scripts/auswerte-sponsor-topf.ts`.

| Lauf | Regel | Seed | Stand der Konstanten |
|---|---|---|---|
| BASIS | kein Stempel (alt), Stand origin/main `24bb023b3` | 1 | – (läuft in Saison 3 beim Saisonabschluss in den Speicher-Deckel; Saison 1 bis Saisonstart 3 sind vollständig) |
| TOPF-A, TOPF-B | Topf, zwei Seeds, drei volle Saisons | 2 | Steigung 2,2 / 2,0 (Erwartungswerte im Konzept) |
| TOPF-C, TOPF-D | Topf, zwei Seeds, Saison 1 bis Kaufphase Saison 2 | 2 | **endgültig**: Steigung 1,8 / 1,6 |

Vor dem Lauf wurden die Konstanten **zweimal nachkalibriert**, weil die ersten Messungen die Konzeptzahlen widerlegten (jeweils belegt in der Tabelle unten):

| Konstante | Konzept | gebaut | Beleg |
|---|---|---|---|
| Bezug der Bremse in Saison 1 | 32 × 62 C | Σ(59 C Kosten − Plan-Einnahmen) | der erste Lauf (Richtwert 1.984 C) hielt den Topf bei 1.686 C, die echte Rechnung `Σ(B−P)` lag bei 1.074 C (Tickets, Marketing, Medaillen sind jetzt gebaut): GuV-Mittel +23,7 C statt 0 |
| Kader-Ersatz | 10 % (Saison 1: 0) | 6 % (Saison 1: 14 %) | Liga-Wert −5,6 / −5,9 % von Saison 1 auf 2 bei 10 % (Kaufphase kostet je Saison 730 bis 870 C Wert, der erste Entwicklungsschritt nach der Draft schreibt −6 % ab), +3,1 / +4,0 % von 2 auf 3 |
| Steigung mit Kader-Ersatz | 2,2 / 2,0 | 1,8 / 1,6 | Budget-Viertel bei Erwartung: +4,1 C im Mittel bei 2,2/2,0, Modellrechnung auf den eingefrorenen Ständen: +2,0 C bei 1,8/1,6 (gemessen in C/D: +1,7 / +1,9) |
| Liga-Wert-Rückkopplung | – | 0,75, ±6 % | hält die Abnahme „Liga-Wert ±3 %“ auch dann, wenn sich KI-Verhalten oder Posten ändern |
| Plan Vorstandsziele | 4,5 C | 6,5 C | gemessen 5,2 bis 7,6 C (Ziel + Vorstandsziel) |

### Liga-Wert je Saison (Σ Kasse + Σ Kaderwert zum Saisonstart, nach der Kaufphase), Faktor 1

| Lauf | S1 | S2 | Drift S1→S2 | S3 | Drift S2→S3 |
|---|---:|---:|---:|---:|---:|
| BASIS (kein Topf) | 9.552,0 | 9.585,2 | +0,3 % | 9.852,8 | +2,8 % |
| TOPF-A | 9.552,0 | 9.421,9 | **−1,4 %** | 9.421,7 | **0,0 %** |
| TOPF-B | 9.552,0 | 9.618,9 | **+0,7 %** | 9.555,4 | **−0,7 %** |
| TOPF-C (endgültig) | 9.552,0 | 9.476,0 | **−0,8 %** | – | – |
| TOPF-D (endgültig) | 9.552,0 | 9.439,8 | **−1,2 %** | – | – |

Alle sechs Drifts liegen innerhalb ±3 % (Entscheidung 1). Die Rückkopplung hat gearbeitet: TOPF-A Saison 2 Korrektur −97,6 C bei Drift −130,1 C, TOPF-B Saison 2 +50,1 C bei +66,9 C.

### GuV-Mittel je Team (Faktor 1, nach Abzug des Kader-Ersatzes je Team, also die Betriebsrechnung)

| Lauf | S1 | S2 | S3 | Teams ≥ 0 (S1 / S2 / S3) | sd (S1 / S2 / S3) |
|---|---:|---:|---:|---|---|
| BASIS (alt) | +31,3 | +30,5 | – | 31 / 31 / – | 15,3 / 17,2 / – |
| TOPF-A | −1,2 | +5,2 | +3,0 | 16 / 21 / 19 | 15,1 / 15,2 / 19,6 |
| TOPF-B | −0,7 | −0,8 | −0,4 | 15 / 9 / 17 | 12,3 / 17,6 / 20,2 |
| TOPF-C | −1,1 | – | – | 15 | 12,7 |
| TOPF-D | −1,8 | – | – | 14 | 10,2 |

Das Liga-Mittel der Betriebsrechnung liegt in sieben von acht gemessenen Saisons zwischen −1,8 und +3,0 C je Team. Einzige Ausnahme: TOPF-A Saison 2 mit +5,2 C, davon +3,0 C die Rückkopplung (der Liga-Wert war gefallen, der Topf stieg bewusst). Gegen den Altbestand (+31 C Überschuss je Team, das ist der Betrag, den die neu gebauten Einnahmen „obendrauf“ legten) ist das der verlangte Faktor-1-Nullpunkt. Teams im Plus: 9 bis 21 von 32 (Abnahme 12 bis 20: TOPF-B Saison 2 mit 9 liegt darunter, die Verteilung ist dort sehr schief, sd 17,6).

### Topf, Grundbetrag, Farb-Töpfe, Modell gegen gebaute Regel

| Lauf / Saison | K_B | K_E | Übertrag | Wert-Korrektur | Topf T | Σ Grund + Farb + Treue − T | Farb-Töpfe verteilt = Topf | Vertragsarten fest/leistung/prämie |
|---|---:|---:|---:|---:|---:|---:|---|---|
| A S1 | 1.273,1 | 1.038,8 | 0,0 | 0,0 | 2.312,0 | −0,1 | ja (8 von 8) | 11/8/13 |
| A S2 | 1.203,8 | 461,3 | −40,1 | −97,6 | 1.802,8 | 0,0 | ja | 14/8/10 |
| A S3 | 1.072,3 | 487,6 | 0,1 | −93,6 | 1.653,3 | 0,0 | ja | 10/7/15 |
| B S1 | 1.276,8 | 1.035,7 | 0,0 | 0,0 | 2.312,5 | 0,0 | ja | 11/8/13 |
| B S2 | 1.260,0 | 479,1 | −40,0 | +50,1 | 1.729,0 | 0,0 | ja | 12/8/12 |
| B S3 | 1.118,4 | 494,8 | −4,9 | +2,5 | 1.615,7 | −0,1 | ja | 11/5/16 |

- **Farb-Töpfe**: in allen sechs Saison-Abschlüssen sind alle acht Töpfe auf 0,1 C genau verteilt (Summe der Zeilen = Topf).
- **Modell gegen gebaute Regel (Phase 0)**: dieselben eingefrorenen Eingaben noch einmal durch `berechneTopf` liefern den Topf auf 0,1 C genau (6 von 6). Der Grundbetrag weicht je Team höchstens um 0,1 bis 6,3 C ab; die Abweichung ist ausschließlich die Vorab-Zusage (1 bis 8 Teams wurden auf 90 % ihres vorläufigen Betrags angehoben).
- **Liga-Summe des Leistungsteils** ist je Liga 0 (Test, Runden mit größtem Rest); in den Läufen steht neben ihm das Ziel: Σ Leistungsteil + Ziel je Liga liegt zwischen −36 und +6 C. Das Ziel wird im Mittel deutlich seltener erfüllt als zu 50 % (der feste Preis nimmt 50 % an; in Liga 2 fehlen im Mittel 1,3 bis 2,3 C je Team), nicht ausgezahlte Einsätze kehren über den Übertrag (−40 C, ≤ 3 % des Topfs) in den Topf der Folgesaison zurück.

### Schere und Kaderstärke

| Messgröße | Abnahme | BASIS | A | B | C | D |
|---|---|---|---|---|---|---|
| Sponsorgeld Liga 1 : Liga 2, Saison 1 | ≤ 1,25 | 1,48 | 1,29 | 1,29 | 1,27 | 1,27 |
| dito Saison 2 | | 1,39 | 1,24 | 1,23 | – | – |
| dito Saison 3 | | – | 1,31 | 1,30 | – | – |
| reichstes minus ärmstes Budget-Viertel bei Erwartung (C) S1 / S2 / S3 | ≤ +2 | – | 2,8 / 5,3 / 4,0 | 4,8 / 7,0 / 1,9 | 1,7 | 1,9 |
| Kaderstärke Ø Saisonstart S1 / S2 / S3 | ≥ BASIS | 45,1 / 47,6 / 49,3 | 46,1 / 47,3 / 48,7 | 46,2 / 48,3 / 49,2 | 45,9 / 47,5 | 45,8 / 47,3 |
| Kadergröße Ø Saisonstart S1 / S2 / S3 | ≥ BASIS | 11,5 / 11,4 / 11,4 | 11,8 / 11,3 / 11,2 | 11,7 / 11,3 / 11,1 | 11,8 / 11,6 | 11,9 / 11,4 |

- Das Verhältnis Liga 1 zu Liga 2 liegt im Grundbetrag exakt bei 1,25 (Liga-Anteil 1,11 : 0,89), mit Farb-Töpfen (12 : 9) und den unausgezahlten Zielen bei 1,23 bis 1,31 (Saison 1 und 3 etwas über 1,25, weil das Ziel in Liga 2 häufiger verfehlt wird); der Altbestand liegt bei 1,39 bis 1,48.
- Das Viertel-Gefälle ist mit den endgültigen Konstanten in Saison 1 bei 1,7 und 1,9 C (≤ 2). Für Saison 2 und 3 wurde die Steigung nach den A/B-Läufen gesenkt; diese beiden Saisons sind **nicht** mit 1,8 / 1,6 nachgemessen (C und D enden nach der Kaufphase von Saison 2). Die Modellrechnung auf den eingefrorenen Ständen von A und B sagt dort im Mittel +2,0 C voraus. Die Ursache des Gefälles ist gewollt: die eigenen Tickets und Marketing-Einnahmen der Starken bleiben bei ihnen (+3,9 C zwischen oberem und unterem Viertel). Ein Planausgleich je Team wurde verworfen, weil er jeden Euro in Tickets und Marketing zur Hälfte wieder wegnähme.
- Kaderstärke: Mittel der beiden Läufe S1 +1,1, S2 +0,2, S3 −0,35 gegen BASIS (ein Seed, Seed-Rauschen ±1). Die Kader sind ab Saison 2 um 0,1 bis 0,3 Spieler kleiner. **Das ist kein Beleg für „nicht unter dem Lauf ohne Regel“**; die Mittel liegen im Seed-Rauschen, der Topf trägt den Kaderumbau aber (Kasse zum Start von Saison 2: 1.624 bis 1.740 C gegen 1.719 C BASIS).
- Wertungs-Fingerabdruck: `env -u NODE_OPTIONS node scripts/pruefe-wertung-fingerabdruck.mjs --node` → **GESAMT fe1dc086d68d** (75 Einträge), alle sechs Schutzsummen unverändert.

### Tests

Neue Dateien: `tests/sponsor-topf-modell.test.ts` (27), `tests/sponsor-topf-regel.test.ts` (29). Alle 78 Quelltext-Wächter-Dateien, die eine der geänderten Quellen lesen, sind grün (860 Tests); die ganze Suite lief grün bis auf `tests/bahn-pod-vier-teams.test.ts` (3 Tests „spieleBahn() bit-identisch zum Vorstand“, Motor-Fingerabdrücke, unabhängig von dieser PR) und zwei eigene Tests, die danach korrigiert wurden. `tsc --noEmit`: 741 Fehler gesamt, keiner in einer berührten Datei (vorher ~740 in fremden Skripten und Tests).


## 8. Offen für die Seiten-PR (Phase 4) und Entscheidungen

### Für die Seiten-PR (Phase 4)

- Neue Seite nach dem Mockup mit **einer** Quelle: `baueSponsorUebersicht` (Abschnitt 6). Die alte `FoundationSponsorsNewLook` zeigt unter dem Topf-Stempel noch die Zahlen des alten Gerüsts (Leiter, Seltenheit, Achse), weil sie `contract.sponsorV3` liest; gebucht wird bereits nach dem neuen System. Bis zur neuen Seite ist die Anzeige der alten also **nicht** gleich der Buchung (kein Schreibweg betroffen).
- Der Faktor-Regler der Rechenansicht rechnet clientseitig mit `berechneTopf` (reine Funktion).
- Scouting-Nebel: `liga_vergleich[].nebel` markiert fremde Teams; die Seite zeigt deren Erwartungsrang und Stärke als grobe Stufe, nie exakt.
- Seltenheitsstufen auf den Angebotskarten ausblenden (das Feld `rarity` bleibt am Angebot, wirkt aber unter dem Stempel nicht auf Geld); Passungszeile aus `angebote[].passung.text`.
- Wahl beim Unterschreiben: `POST /api/sponsor/choose` mit `vertragsart`, `laufzeit`, `farben`; Sponsorentermin: `POST /api/sponsor/event` mit `terminId`, `antwort`.
- Nachfordern (Konzept 4.6) und die Wappen-Wellen bleiben Phase 4/5.
- `OLY_SPONSOR_REGEL` in `deploy/hetzner/docker-compose.yml` und `.env.example` eintragen (Standard „an“, ohne Eintrag ändert sich nichts).

### Entscheidungen, die ich Chris vorlege

1. **Ziel nur auf Achsen-Karten.** Das alte Gerüst gibt jedem Team zwei von drei Angeboten mit Zielachse. Für „jeder Vertrag trägt ein Ziel“ müsste jede Karte eine Achse bekommen (Eingriff in die Slate-Erzeugung).
2. **Kader-Ersatz auch in Saison 1.** Konzept 4.2 setzt ihn in Saison 1 auf 0; die Abnahme „Liga-Wert ±3 % je Saison“ (Entscheidung 1) verlangt ihn, weil der Wert der Liga schon von Saison 1 auf 2 stehen bleiben soll (siehe Messung).
3. **Die Konstanten sind aus zwei Seeds und drei Saisons gemessen** (Kader-Ersatz 6 % + 8 % in Saison 1, Steigung 1,8 / 1,6, Plan Vorstandsziele 6,5 C). Die Liga-Wert-Rückkopplung fängt Abweichungen auf, ersetzt aber keine Nachmessung: nach den ersten drei echten Saisons (mit Menschen, die anders kaufen als die KI) sollte `scripts/auswerte-sponsor-topf.ts` über die Live-Abbilder laufen.
4. **Form −1 beim Sponsorentermin** ist als eine Anzeige-Stufe (15 Formpunkte) gebaut, nicht als −1 Punkt.


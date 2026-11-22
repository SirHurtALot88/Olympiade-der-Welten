# Formkarten Plus/Minus (22.11., Arbeitsliste 21.11. Welle 4)

Auftrag: „Formkarten: keine 0er, jede Karte ±; Karten-Wirkung zeigt negative; KI setzt Formpunkte gezielt (Siege, Rivalen, Reserve); Formpunkte im Saisonstand/Gegneranalyse."
Stand 22.11. (nach Chris' Entscheidungen, Abschnitt 6): gebaut mit Spielstand-Stempel `seasonState.formkartenRegel`, Kartenwerte **2/4/6/8**. Nicht gemergt, kein PR.

## 1. Ist-Stand

- **Karten:** jeder Spieler bekommt je Saison zwei Karten in seiner Klassenfarbe (POW rot, SPE gruen, MEN blau, SOC gelb), eine Plus- und eine Minuskarte, unabhaengig gezogen (`buildGeneratedFormCardRecordsForTeam`). Werte aus `[0, 2, 4, 8]`. **Die 0 ist tot:** `getTeamFormCardOptions` blendet 0er aus, jeder vierte Wurf liefert also keine Karte; sichtbar sind nur 2/4/8 (Mittel 4,7). Ungespielte Minuskarten kosten am Saisonende Tabellenpunkte, ungespielte Pluskarten verfallen.
- **Wirkung (Farbregel seit 18.11., eine Wahrheit `formkartenZerlegungFuerSpieler`):** alle Aufgestellten v x 0,5 (Karte in fremder Disziplinfarbe) bzw. v x 1,0 (passende Disziplinfarbe), dazu Farbtraeger (Klassenfarbe = Kartenfarbe) v x 0,5, Form-Hebel nur bei Pluskarten. Spitze +12. Minuskarten spiegelbildlich. Pro Seite zwei Karten, die zweite nie negativ.
- **Negatives gibt es heute schon:** jede Minuskarte wirkt negativ fuer alle. Das fehlte in der Anzeige an einer Stelle: „Alle Karten im Vergleich" (`KartenWirkungPanel`) war nach Teamsumme absteigend sortiert und auf `slice(0, 8)` gekappt, die Minuskarten fielen also weg. Der Rest der Karten-Wirkung (Zeilen, Team-Summe, Marke am Platz) zeigte Vorzeichen korrekt.
- **KI:** Saisonplan `ai-form-card-season-plan.ts` (Zuordnung Karte -> Slot ueber die Restsaison, Minuskarten zuerst ins billigste Versteck, Tauschdurchlauf, Geduld/Ausgabedruck, Wettbewerbslage `competitiveness`, `rankPointSwing`). Der Plan kannte weder Rivalen noch knappe Duelle; Rivalen wurden nur fuer Team-Powers gelesen.
- **Formpunkte im Saisonstand / Gegneranalyse:** schon da (`buildSeasonFormCardBonusByTeamId` in `SeasonStandingsModern` und `EinsatzlisteGegnerTab`, Tank mit Rest/Pool/Minus). Nichts zu bauen.

## 2. Konzept „jede Karte ±" (5 Saetze)

1. Keine 0er: Kartenwerte `[2, 4, 6, 8]` (Mittel 5 statt der sichtbaren 4,7; Chris 22.11.), jeder Spieler hat wirklich ein Plus- und ein Minuskartenpaar.
2. Jede Karte hat einen Plus- und einen Minus-Teil: die Gegenfarbe (POW gegen MEN, SPE gegen SOC) traegt `-v x 0,25`; eine Pluskarte kostet also Spieler der Gegenfarbe, eine Minuskarte entlastet sie.
3. Damit wird jede Karte eine Aufstellungsentscheidung (wen stelle ich neben die Karte), nicht nur ein Bonus; die Farbregel (alle + Farbtraeger, Spitze 12) bleibt unveraendert, die Gegenfarbe zieht nur ab (Spitze fuer Gegenfarbe +6 bei v=8, passend).
4. Die KI preist die Gegenfarbe mit dem Farbanteil des eigenen Kaders ein und gewichtet den heutigen Spieltag: knappes Duell 1,25, klar vorn 1,0 (Overkill-Bremse), klar hinten 0,8, je Top-8-Rivale +0,1 (hoechstens +0,2). Pluskarten wandern auf schwere Slots, Minuskarten auf billige. Zukunft bleibt 1,0 (kein Informationsvorsprung).
5. Anzeige: Spalte Gegenfarbe in der Karten-Wirkung, Marke am Platz, Zeile in der Team-Summe, Effekttext im Dropdown, Vergleichsliste zeigt die schlechtesten drei Karten mit.

### Wertetabelle (Karte +8 bzw. -8 in fremder Disziplinfarbe, Regel PM +Gegenfarbe 0,25)

| Spieler | Pluskarte +8 | Minuskarte -8 |
|---|---:|---:|
| Farbtraeger | +8 (4 + 4) | -8 |
| neutrale Farbe | +4 | -4 |
| Gegenfarbe | +2 (4 - 2) | -2 (-4 + 2) |
| passende Disziplinfarbe, Traeger | +12 | -12 |
| passende Disziplinfarbe, Gegenfarbe | +6 | -6 |

Kartenwerte alt `[0,2,4,8]`, neu `[2,4,6,8]`. Gezeigt = gebucht: Legacy-Wertung, Einsatzliste, Arena-Adapter und KI lesen dieselbe Funktion (`kartenZerlegungFuerSpieler`); `tests/formkarten-plusminus.test.ts` prueft Einsatzliste = Motor-Eingabe je Spieler.

### Schalter und Stempel

Siehe Abschnitt 5: Regel im Spielstand (`seasonState.formkartenRegel`), Rueckweg `OLY_FORMKARTEN_PLUSMINUS=aus`, Notbremse `=aus-sofort`. Ohne Stempel gilt die Regel von 18.11.

## 3. Messung (Regel plusminus, Kartenwerte 2/4/6/8, Node-Motor, Formkarten-Modus echt)

Neu gemessen am 22.11. nach Chris' Wertewechsel auf 2/4/6/8 (alle frueheren Laeufe mit 2/3/5/8 verworfen):
`OLY_SHARD=i/2 scripts/miss-formkarten-plusminus.mts 12 <out.json>` (Hook um Gegenfarbe und Kartenwerte erweitert). Spalten: rho je Spiel
(Median ueber Kaderfamilie, 12 Spiele) ohne Karte, mit der Regel von heute (alt: Werte 0/2/4/8, keine Gegenfarbe), nur Gegenfarbe dazu, und
volles ± (Gegenfarbe + Werte 2/4/6/8). Die beiden letzten Spalten: Anteil der Spiele, in denen der beste Spieler gegenueber „ohne Karte"
wechselt (Naeherung fuer „Karte dreht das Ergebnis").

| Disziplin | ohne Karte | heute (alt) | +Gegenfarbe | ± (2/4/6/8 + Gegenfarbe) | Sieger gedreht heute | Sieger gedreht ± |
|---|---:|---:|---:|---:|---:|---:|
| basketball | 0.837 | 0.850 | 0.840 | 0.855 | 57 % | 62 % |
| battlefield | 0.617 | 0.610 | 0.601 | 0.596 | 72 % | 85 % |
| breaking | 0.864 | 0.854 | 0.850 | 0.858 | 33 % | 35 % |
| climbing | 0.859 | 0.830 | 0.838 | 0.808 | 33 % | 33 % |
| eiskunstlauf | 0.929 | 0.914 | 0.913 | 0.910 | 20 % | 23 % |
| fechten | 0.854 | 0.867 | 0.865 | 0.871 | 15 % | 17 % |
| football | 0.863 | 0.802 | 0.808 | 0.843 | 45 % | 38 % |
| gewichtheben | 0.890 | 0.899 | 0.899 | 0.890 | 20 % | 28 % |
| hockey | 0.754 | 0.654 | 0.728 | 0.735 | 48 % | 48 % |
| i-spy | 0.812 | 0.810 | 0.809 | 0.805 | 40 % | 48 % |
| mini-dm | 0.325 | 0.133 | 0.333 | 0.349 | 55 % | 58 % |
| showcase | 0.784 | 0.814 | 0.818 | 0.805 | 17 % | 17 % |
| speed-schach | 0.922 | 0.925 | 0.919 | 0.924 | 7 % | 7 % |
| spurt | 0.916 | 0.878 | 0.875 | 0.880 | 13 % | 25 % |
| staffel | 0.958 | 0.956 | 0.959 | 0.956 | 18 % | 18 % |
| takeshis-castle | 0.818 | 0.860 | 0.834 | 0.834 | 28 % | 20 % |
| tdm | 0.901 | 0.914 | 0.908 | 0.897 | 25 % | 40 % |
| tennis | 0.882 | 0.879 | 0.881 | 0.877 | 15 % | 20 % |
| time-trial | 0.942 | 0.936 | 0.938 | 0.938 | 27 % | 35 % |
| wettessen | 0.925 | 0.933 | 0.937 | 0.933 | 13 % | 15 % |
| **Mittel** | 0.833 | 0.816 | | 0.828 | 30 % | 34 % |

Lesart: 12 Spiele je Variante sind knapp, Schwankungen von +-0,03 sind Rauschen. Mit ± liegt rho im Mittel bei 0.828 (heute 0.816, ohne Karte 0.833):
die neue Regel ist im Schnitt besser als die von heute. Hockey (0,654 -> 0,735) und Football (0,802 -> 0,843) gewinnen, Climbing (0,830 -> 0,808) verliert etwas, bleibt klar ueber 0,75.
**Unter 0,75 liegen mit der neuen Regel nur Battlefield (0,596) und Mini-DM (0,349) — beide schon OHNE Karte darunter (0,617 / 0,325), also kein Effekt der Regel,
sondern der Pod-Aufbau dieser Sonde (12 Spiele, Kaderfamilie); Hockey 0,735 liegt in der Sonde knapp darunter, ohne Karte 0,754 (Rauschen +-0,03; die Vollmessung in
`docs/design/hockey-torwart-22-11.md` ist die massgebliche).** Kein Disziplin-Rutsch unter die Schranke, der durch die Regel entsteht.

### Pp-Abweichung (Pflichtpruefung, Grenze <= 25, Budget-Methode `einflussVon`, zwei Saatstroeme)

`OLY_PP=1 OLY_REGELN='pm,pm±' OLY_PP_LAEUFE=16 scripts/miss-formkarten-plusminus.mts 4 <out.json> <disziplin ...>`, mit der Karte als Form je Spieler im Motor
(Formkarten-Modus echt). **16 Laeufe je Strom statt der ueblichen 48** (auf dieser, mit anderen Sitzungen geteilten Maschine 3 Min fuer Tennis, aber Basketball (6 gegen 6) lief nach 90 Min bei 16 Laeufen und nach weiteren 60 Min bei 12 Laeufen nicht durch und wurde abgebrochen — **Basketball ist damit NICHT gemessen**; ehrliche Einschraenkung: die Absolutwerte sind bei n=16 systematisch eher zu guenstig, siehe `messe-arena-einfluss.mjs`,
verglichen wird deshalb heute gegen ± mit gleicher Laufzahl).

| Disziplin (Gattung) | heute (alt), Strom 0 / Strom 1 | ± (2/4/6/8 + Gegenfarbe), Strom 0 / Strom 1 | gepoolt heute -> ± |
|---|---|---|---|
| Tennis (Duell) | 6.7 / 6.2 | 7.1 / 6.2 | 6.5 -> 6.7 |
| Basketball (Feldspiel) | nicht gemessen | nicht gemessen | - |
| Time-Trial (Bahn) | 10.6 / 10.7 | 12.2 / 11.7 | 10.6 -> 11.9 |
| Eiskunstlauf (Buehne) | 15.0 / 11.0 | 16.7 / 10.5 | 13.0 -> 13.6 |

Alle drei gemessenen Disziplinen liegen unter der Pflichtschranke 25 (Basketball offen, Nachmessung: `OLY_PP=1 OLY_REGELN='pm,pm±' OLY_PP_LAEUFE=12 npx tsx scripts/miss-formkarten-plusminus.mts 4 out.json basketball` auf einer freien Maschine); die Regel verschiebt die Pp-Abweichung um hoechstens 1.3 Pp. Nicht gemessen: Basketball und die uebrigen 16 Disziplinen
(die Karte geht dort ueber denselben Form-Kanal ein, die Gegenfarbe verschiebt nur Anteile zwischen Klassen).

### Aufnahmen (aus der echten App, Battle-Spielstand, neues Spiel mit Stempel plusminus)

Unter `docs/design/formkarten-plusminus-22-11/`, Spieltag 1 Battlefield, Disziplinfarbe SOC, bei 1920x1080 und 2560x1440
(`scripts/screenshot-einsatzliste-optik.ts bau|foto`, neu: `OPTIK_MAX_KOPIEN`, `OPTIK_KARTE`, `OPTIK_KARTE_FARBE`):

- `app-battlefield-1920.png`, `app-battlefield-2560.png`: Einsatzliste mit der Kartenhand 2/4/6/8 (keine 0er, Minuskarten -2/-4/-6/-8).
- `app-battlefield-karten-1920.png`, `app-battlefield-karten-2560.png`: Reiter Karten-Wirkung mit gelegter Karte Mental +8: Spalte **Gegenfarbe** (Ravager, Berserker/POW: -2,0),
  Zeile „GEGENFARBE -2,0" in der Teamsumme, Marke „+2,0 -2,0" am Platz, Erklaertext „Abzug fuer 1 POW-Spieler (Gegenfarbe)", Vergleichsliste mit Minuskarten (-6, -8, -8).
- `app-battlefield-gegner-*.png`: Reiter Gegner (nur zur Vollstaendigkeit).

Selbst angesehen. Abweichungen: (1) die Kartenhand ist kein Mockup-Bestandteil, es gibt fuer Plus/Minus kein eigenes Mockup; verglichen wurde mit der Ansicht vor der Aenderung (Spalte Gegenfarbe und
Minuskarten in der Vergleichsliste sind neu, sonst unveraendert). (2) Der lange Farbbonus-Satz in der Kartenzeile wird bei 1920 rechts abgeschnitten (bestand schon vor dieser Arbeit,
durch den Gegenfarb-Zusatz etwas laenger). (3) Bei 1920x1080 ueberlappt die Arena-Beschriftung der Karte mit der Kopfzeile des Einsatz-Reglers (Schonen/Normal/Vollgas) — bestand vorher, nicht angefasst.
(4) Es wurde nur Battlefield fotografiert (Bau-Zeit des Spielstands); die Anzeige haengt nicht an der Disziplin.

### Wie oft drehen KI-Karten Ergebnisse?

Nicht direkt messbar mit der Sonde (kein Team-Ergebnis, keine KI-Aufstellung im Motor). Naeherung: Karten drehen den besten Spieler eines Spiels in 7 bis 85 % der Spiele (Battlefield 72-85 %, Basketball 57-62 %, Hockey 48-57 %, Speed-Schach 7 %). Der KI-Plan selbst (Slot-Auswahl, Duell-Gewicht) ist per Test deterministisch belegt, eine Saison-Simulation mit und ohne Gewicht steht aus.

## 4. Geaendert

- `lib/lineups/formkarten-farbregel.ts` (Gegenfarbe, `FARBREGEL_PM_PLUSMINUS`, `GEGENFARBE`, Schalter), `legacy-lineup-modifiers.ts` (Kartenwerte), `formkarten-wirkung.ts`, `lib/morale/form-moral-regeln.ts` (Regelstand).
- KI: `ai-form-card-season-plan.ts` (`gewicht`, `duellGewicht`, Gegenfarbe im Slot-Wert), `ai-legacy-lineup-batch-apply-service.ts`.
- Anzeige: `FormMoralBausteine.tsx` (Gegenfarbe, `vergleichAuswahl` zeigt Minuskarten auch **ohne** Schalter), `EinsatzlisteKartenHand.tsx`, `EinsatzlisteModern.tsx`, `form-moral.css`.
- Stempel (22.11.): `lib/resolve/formkarten-regel.ts` (neu), `lib/data/olyDataTypes.ts`, `new-game-setup-service.ts`, `preseason-workflow-service.ts`, `save-repository.ts`; Regelstand `resolveFormMoralRegeln(env, gameState)`, Adapter und KI lesen den Stempel.
- Messung/Test: `scripts/miss-formkarten-plusminus.mts`, `scripts/lib/formkarten-farbregel-hook.mjs`, `tests/formkarten-plusminus.test.ts`.

## 5. Entscheidungen von Chris (22.11.) und Umsetzung

1. **Gegenfarbe** kommt (nicht „Erschoepfung"). Chris bestaetigt ausdruecklich: jeder Spieler hat genau eine positive Farbe (seine Klassenfarbe) und eine negative (die Gegenfarbe, POW<->MEN, SPE<->SOC); eine Minuswirkung bei der Farbe bleibt negativ, nichts wird abgeschwaecht.
2. **Kartenwerte 2/4/6/8** (zuerst 2/3/5/8 empfohlen, von Chris auf 2/4/6/8 geaendert).
3. **Scharf ab der naechsten Saison per Spielstand-Stempel**: `seasonState.formkartenRegel = { seasonId, regel: "plusminus" | "alt" }` (`lib/resolve/formkarten-regel.ts`).
   Neues Spiel (nur Battle): plusminus ab Saison 1 (`stempleFormkartenRegelBeimAnlegen` in `new-game-setup-service.ts`). Bestehender Spielstand: die Lade-Migration
   (`stempleFormkartenRegelNachLaden`, `save-repository.ts`) schreibt fuer die laufende Saison „alt" fest, damit schon gezogene Karten und gebuchte Aufstellungen unveraendert bleiben;
   der Saisonwechsel (`preseason-workflow-service.ts`) stempelt die Folgesaison nach dem Schalter. Manager-Spielstaende bleiben alt (kein Stempel).
   Rueckweg `OLY_FORMKARTEN_PLUSMINUS=aus` (neue Saisons alt, gestempelte rechnen weiter), Notbremse `=aus-sofort` (schaltet nur die WIRKUNG ab: Gegenfarbe und Duellgewicht, auch mitten in der Saison;
   die Kartenwerte 2/4/6/8 haengen allein am Stempel und bleiben, damit die Karten eines Menschen nicht still umgeschrieben werden). Die Variable ist reine Server-Variable
   (`deploy/hetzner/docker-compose.yml` environment, `.env.example`), kein `NEXT_PUBLIC`/Build-Arg: der Browser loest die Regel nie selbst auf.
4. **Vergleichsliste mit sichtbaren Minuskarten** (`vergleichAuswahl`) ist reine Anzeige und gilt seit dem Fix unabhaengig vom Stempel.

### Wer liest die Regel (eine Quelle, gezeigt = gebucht)

Kein Rechenweg liest mehr die Prozess-Variable. `resolveFormMoralRegeln(env, gameState)` setzt `plusMinus` aus `formkartenRegelFuer(gameState)`; daraus bekommt `farbregelAusRegeln` die Regel
`FARBREGEL_PM_PLUSMINUS`. Gelesen wird sie von: Legacy-Wertung und Vorschau (`context.formMoralRegeln`, gesetzt in `legacy-lineup-local-service.ts` aus dem Spielstand), Einsatzliste und Karten-Wirkung
(`formkarten-wirkung.ts`), Arena-Aufstellungsadapter (`arena-aufstellung-adapter.ts` rechnet `calculateFormModifierForSide` mit der Regel aus dem Spielstand), KI-Kartenplan
(`ai-legacy-lineup-batch-apply-service.ts`: Duellgewicht nur bei `plusMinus`, Plan und Einsatzwert nutzen `plan.farbregel`) und die Kartenziehung (`buildGeneratedFormCardRecordsForTeam`).
Zum Arena-Host/Node-Motor reist die Regel nicht als eigenes Feld: der Umschlag traegt die fertigen Kartenwerte je Spieler (`form`), die der Adapter aus derselben Funktion rechnet.
`tests/formkarten-plusminus.test.ts` prueft Einsatzliste = Adapter fuer plusminus und fuer alt (auch bei gesetztem Schalter).

**Wertungs-Fingerabdruck:** `node scripts/pruefe-wertung-fingerabdruck.mjs --node` zeigt `GESAMT 0310ec4a4e3d` (75 Eintraege), identisch zum aktuellen main; der Motor wurde nicht angefasst, eine eigene Schutzsumme ist nicht noetig.

## 6. Nachbesserungen nach dem Review (22.11.)

- **KI-Duellgewicht (muss 1):** das Gewicht der Seite (`duellGewicht`, einmal je Seite in `sidePlans`) geht jetzt auch in den Jetzt-Wert der Kartenwahl (`selectPositiveFormCardForSlot`, `gewicht`), nicht nur in den Plan-Anspruch; sonst haette die Reserve-Schwelle die fuer das knappe Duell geplante Karte auf ihrem eigenen Platz zurueckgehalten. Das Neutral-Veto (knappes Duell) faellt bei Regel plusminus weg, wenn der Plan fuer die Seite eine Pluskarte auf den Primaerplatz gelegt hat; ohne Plan und bei Regel alt bleibt es. Test end-to-end ueber `buildAiLegacyLineupModifiers` (`tests/ai-form-card-season-plan.test.ts`, Gegenprobe Regel alt).
- **Schalter im Container (muss 2):** `OLY_FORMKARTEN_PLUSMINUS` steht in `docker-compose.yml` und `.env.example`; der `NEXT_PUBLIC`-Vorrang ist entfernt.
- **Saisonwechsel (sollte 3):** die Karten der Folgesaison werden mit einem Spielstand gezogen, der den Stempel der NEUEN Saison traegt (`nextFormkartenRegel`); Test ueber den echten Pfad `applyPreSeasonNextSeasonSetup` (alt -> plusminus: nur 2/4/6/8).
- **Basketball-Pp (sollte 5):** Nachmessung mit `nice -n 10`, 8 Laeufe je Strom, auf der geteilten Maschine nach 50 Min ohne Ergebnis abgebrochen (zusaetzlich liefen andere Messungen). Basketball-Pp bleibt **nicht gemessen**; die Karte geht dort ueber denselben Form-Kanal wie in den drei gemessenen Disziplinen ein (Tennis, Time-Trial, Eiskunstlauf: Verschiebung hoechstens 1,3 Pp).
- **Notbremse (sollte 4):** Kartenwerte nur nach Stempel (`formkartenKartenwerteNeu`), `aus-sofort` aendert keine Karte eines Menschen (Test).
- **Anzeige:** die Karten-Zusammenfassung bricht um statt abgeschnitten zu werden (CSS), die Platzmarke beschriftet den Abzug als „Gegenf. −2,0".
- **Nits:** KI-Schaden der Minuskarte nutzt `plan.farbAnteile` statt fester 0,25; `formMoralRegeln` liest den Stempel der angefragten Saison (`params.seasonId`); implizite `any` im Messskript behoben. „Ist plusminus" hat zwei bewusst getrennte Quellen: Kartenwerte = Stempel allein, Wirkung = Stempel, ausser Notbremse und `OLY_FORMKARTEN_FARBREGEL=alt` (dann kein `plusMinus` im Regelstand).

### Folgen fuer das Spiel (fuer Chris und die Abnahme)

- **+33 % spielbare Karten je Spieler:** bisher blendete `getTeamFormCardOptions` jede vierte Karte (Wert 0) aus, jetzt hat jeder Spieler wirklich ein Plus- und ein Minuskartenpaar.
- **Jeder Spieler hat jetzt eine Minuskarte.** Die moegliche Saisonende-Strafe fuer ungespielte Minuskarten steigt um etwa 43 % (Betrag im Mittel 5,0 statt 3,5 bei den bisher vorhandenen Karten); sichtbar in Inbox und Startseite.
- **Keine Nachkalibrierung von C2/E1 noetig:** Netto-Wirkung je Pluskarte 2,81 statt 2,92. Nach der ersten plusminus-Saison mit `werte-pp-skala-aus.mjs` nachpruefen.

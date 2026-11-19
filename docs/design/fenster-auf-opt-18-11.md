# Fenster auf Opt: frei verkaufen, danach bis Opt auffüllen (18.11.)

Chris am 18.11., wörtlich: „Nein, man darf alle Spieler verkaufen, auch unter Minimum. Die KI soll danach ja einfach auf
Optimum füllen! Die Kader können nicht einfach mit 8–9 Leuten fertig sein, dann sind die Roster zu star-lastig.“

Enthält **#1629** (Kaderplan im organischen Planer); baut auf **#1618** (Kaderpflicht-Freigabe, `kaufRahmen`) und **#1634**
(gemeinsames Transferfenster) auf.

## 1. Was sich ändert

| | Stand #1634 | jetzt (Standard) |
|---|---|---|
| Verkaufsrunde im Fenster | nur bis max(8, playerMin) (`sellNotBelowMin`) | **frei** nach der bestehenden organischen Verkaufslogik, auch unter das Minimum |
| Kaufrunde im Fenster | Marktplan (`applyAiMarketPlanLocally`, Kurzliste `max(3, Lücke + 2)`, Auswahl nach Bewertung) | **organischer Planer mit Kaderplan** in der Kauffenster-Sitzung (`runTransferWindowSession`, Phase `preseason`) — derselbe Kaufweg wie der Saison-1-Draft |
| Nachrunde | Marktplan noch einmal | dieselbe Sitzung noch einmal (nur Teams unter Opt) |
| Kredite vor/nach dem Kauf | eigener Durchgang ohne Kaufplan-Probe | Kredit-Durchgänge der Sitzung, gedeckelt auf den geprobten Kaufplan (vorhanden seit dem Kredit-Umbau) |
| Kaderplan (`istKaderplanAktiv`) | nur Saison 1 | Saison 1 **und** das Fenster ab Saison 2 |
| Gehaltsseite der Plätze bis Opt (Review S3) | nicht reserviert | **reserviert**: Ablöse **und** Jahresgehalt der geplanten Plätze gegen `kaufRahmen().grenzeFuer` bzw. die Töpfe |
| Kassensturz | Rücklage → Kredit → Notkredit → Notverkauf (nie unter 8, nie Menschen) | **unverändert** |

Kein Notkauf, kein Auffüllen auf das Minimum mit Billigst-Spielern, kein Fuell-Lauf: die Kaderplanung mit
Platzpreis-Reservierung ist der einzige Kaufweg. Die GM-Senkung des Ziels (höchstens 2, nie unter Minimum + 1) bleibt die einzige
bewusste Ausnahme vom Opt und steht im Protokoll (`kaderplan_gm:<Team>:…`).

**Schalter:** `OLY_FENSTER_AUF_OPT=0` stellt den Stand von #1634 her (Verkauf bis zum Minimum, Marktplan-Kauf, Kaderplan nur in
Saison 1). Ohne gemeinsames Fenster (`OLY_TRANSFERFENSTER_GEMEINSAM=0`) gibt es auch kein Fenster auf Opt.
Code: `lib/market/transferfenster-gemeinsam.ts` (`istFensterAufOpt`).

## 2. Warum der Planer und nicht der nachgerüstete Marktplan

Der Auftrag ließ zwei Wege offen: den Kaufschritt auf den organischen Planer umstellen oder den Marktplan um eine
Platzpreis-Reservierung erweitern. Umgestellt, weil

1. **der Weg schon da war.** Die Kauffenster-Sitzung kauft in der Phase `preseason` mit genau dem Planer, der in Saison 1 draftet
   (`runOrganicBuyCycle` → `planOrganicDraftForTeam`), samt Kreditprobe gegen den Kaufplan, Ligarunden und Opt-Lücken-Runde.
   Aufgerufen hatten ihn im Spiel nur noch Skripte; der Hintergrundlauf nahm den Marktplan.
2. **die M-M-Ursache im Marktplan sitzt in der Auswahl** (Kandidaten nach Bewertung statt nach Lücke,
   `empfehlungsAnzahl = max(3, Lücke + 2)` in `ai-transfermarkt-preview-service.ts`). Eine Reservierung dort wäre eine zweite
   Kaderplanung neben der des Planers — zwei Zahlen für „wie viel darf dieser Kauf kosten“.
3. **ein Kaufweg für alle**: Saison-1-Draft (Block und Einzelschritt), Fenster-Kauf, Kreditprobe und „KI picken“ rechnen jetzt
   alle mit `kaderplanRahmen`, `kaufRahmen().grenzeFuer` und derselben Fueller-Sperre.

Der Marktplan bleibt für den alten Stand (`OLY_FENSTER_AUF_OPT=0`) und für die Wege, die ihn ausdrücklich rufen.

## 3. Review S3 gelöst: Gehalt der Plätze bis Opt

Bis hierher reservierte der Kaderplan nur die **Ablöse** der Plätze bis Opt. Über dem Minimum prüfte der Kaufschritt den
Gehaltstopf mit der Mindestkader-Reserve (0) — ein Star, dessen Gehalt den Topf fast leerte, ging durch, und die übrigen Plätze
passten danach nicht mehr ins Gehalt. Deshalb war der Kaderplan ab Saison 2 aus.

Jetzt (`lib/ai/organic-squad/draft-builder.ts`):

* `kaderplanRahmen` rechnet für dieselben Plätze (jeder T-te Spieler ab Platzpreis 12, fehlende mit den billigsten) auch das
  **Jahresgehalt** (`platzReserveGehalt`, `billigeReserveGehalt`) und prüft „trägt der Rahmen diese Plätze?“ gegen **beide**
  Grenzen: Ablöse gegen `kaufGrenze().fee` (sonst `feeCap`), Gehalt gegen `kaufGrenze().salary` (sonst `salaryCap`).
  Trägt das Gehalt nicht alle Plätze zum Platzpreis, plant der Rahmen weniger Plätze zum Platzpreis und den Rest günstiger
  (Tiefe vor Qualität), wie bisher bei der Ablöse.
* `organicBuyStep` prüft jeden Kandidaten mit `Gehalt + reserviertes Gehalt der übrigen Plätze ≤ Gehaltsgrenze`.
* `kaufGrenze` ist die Kaderpflicht-Freigabe aus #1618 (`kaufRahmen().grenzeFuer`): unter dem Minimum gibt der Vorstand Ablöse
  und Gehalt der fehlenden Plätze frei, zwischen Minimum und Opt die Plätze bis Opt zum Platzpreis, soweit Kasse über der
  Notrücklage da ist. Planer und Sperre rechnen damit dieselbe Zahl.
* Saison 1 (keine Gehaltsgrenze): unverändert, die Gehaltsreserve wird nirgends geprüft (Test „ohne Gehaltsgrenze“).

## 3a. Hebel (b): weniger, dafür stärker, wenn der Rahmen nur Füller trägt (PM-Entscheidung 19.11.)

Die erste Messung (Abschnitt 4, „Runde 1“) erreichte Opt, aber mit 45–50 Füllern je Fenster. Entscheidung im Rahmen von Chris’
bestehender Regel („GM darf Opt um bis zu 2 senken, bewusst einen weniger dafür stärker; aber nie nur bis Minimum“):

* `buildOrganicDraftFrame` (`lib/ai/organic-squad/draft-adapter.ts`) prüft im Fenster ab Saison 2 vor dem Plan mit
  `kaderplanRahmen`, ob der Rahmen (Kasse, Kaderpflicht-Grenze, Ablöse **und** Gehalt) alle Plätze bis Opt zum Platzpreis trägt.
  Wenn nicht, senkt der GM das Ziel auf das größte, das er ganz zum Platzpreis trägt — höchstens bis zur bestehenden Grenze
  (Identitäts-Opt − 2, nie unter Minimum + 1). Trägt auch das nicht, gilt die Grenze.
* Der Builder hält dann am gesenkten Ziel an (`gmOptGesenkt`), das Protokoll nennt den Grund
  (`kaderplan_gm:<Team>:… Rahmen traegt Opt N nur mit Fuellern: Opt N -> M, weniger Spieler, dafuer staerker`).
* Saison 1 bleibt unverändert (der Draft plant aus dem vollen Startbudget). Hebel (a) (Verkauf begrenzen) und (c) (Platzpreis an
  den Markt koppeln) sind bewusst nicht umgesetzt.

**Restgehalt-Ablösung beim Verkauf (Fall T-C) — gewollte Logik, kein Fehler.** Wer verkauft, zahlt das offene Restgehalt des
Vertrags (`resolveTransfermarktSellProceeds` → `calculateOpenBuyoutCost`, Summe der offenen Vertragsjahre;
`lib/market/contract-buyout-season-window.ts`: im Fenster vor Spieltag 1 ist das laufende Jahr noch offen und zählt mit). So steht
es im Verkaufs-Popup („Brutto X − Buyout Y“, `docs/design/verkauf-popup.md`) und in `docs/APRON_UND_VERTRAGSFORMEN.md`. Die
KI-Verkaufslogik rechnet mit demselben Nettowert (`planOrganicSellsForTeam` → `resolveOpenBuyoutCostForRoster`). T-C verkaufte
6 Spieler brutto 80,9 C, Buyout 34,6 C, netto 46,3 C — die Entscheidung kannte das Netto.

## 4. Messung (32 KI-Teams, S1 → Fenster S2, zwei Basen, Merge-Stand mit #1618 auf main, #1629 und Hebel (b))

Zwei Basen, je ein neues Spiel mit 32 KI-Teams von Anfang an (`scripts/miss-teamfinanzen-saison.ts --stop-after spieltage`,
Basis 2 mit `--mischen 7`), Liga-Draft und 20 Spieltage von Saison 1, gebaut auf dem Merge-Stand. Von jeder Basis zwei Kopien,
derselbe Weg wie im Spiel (`scripts/miss-transferfenster-gemeinsam.ts`: Saisonabschluss → Saisonende-Kette → Saisonwechsel →
KI-Lauf im Fenster): „alt“ mit `OLY_FENSTER_AUF_OPT=0`, „neu“ im Standard. Wegwerf-SQLite, danach gelöscht.
„GM-Opt“ = das Ziel, mit dem der Planer im Fenster tatsächlich plante (Protokoll `kaderplan:<Team>:…:opt=N`), höchstens Opt.

**Saison 1** (nach dem Draft; Fenster auf Opt und Hebel (b) greifen erst ab Saison 2): Basis 1 Kader 9×4, 10×4, 11×5, 12×8,
13×3, 14×8; Basis 2 9×4, 10×4, 11×6, 12×6, 13×3, 14×9; **0 Teams unter 8**. Gehalt Median 65,8 / 67,5, im Band 50–70: 20 / 19.

**Saison 2, Fenster:**

| | Basis 1 alt | **Basis 1 neu** | Basis 2 alt | **Basis 2 neu** |
|---|---:|---:|---:|---:|
| Teams unter 8 | 0 | **0** | 0 | **0** |
| Teams unter GM-Opt | 21 | **2** (P-C 9/10, V-W 9/10) | 18 | **0** |
| Teams bei 8–9 ohne GM-Grund | 8 | **2** (dieselben) | 4 | **0** |
| Kader min / Median / Summe | 8 / 10 / 328 | 9 / 11,5 / 358 | 8 / 11 / 346 | 9 / 11 / 366 |
| Verkäufe im Fenster (Summe) | 34 (392,9 C) | 64 (772,6 C) | 43 (437,6 C) | 66 (586,5 C) |
| Teams mit Verkauf / danach unter 8 | 16 / 8 | 24 / 18 | 18 / 7 | 23 / 13 |
| Käufe im Fenster (Summe) | 60 (1418,9 C) | 120 (1873,3 C) | 73 (1722,8 C) | 116 (2035,1 C) |
| davon Füller < 12 | 14 | **19** | 19 | **20** |
| Notwege (`fueller_rueckfall`) | – | 3 | – | 5 |
| Neue Kredite / Notkredite / Notverkäufe | 9 / 0 / 0 | 4 / 0 / 0 | 6 / 0 / 0 | 4 / 0 / 0 |
| Negative Kassen | 0 | 0 | 0 | 0 |
| Kasse Summe / Median / min | 924,7 / 27,1 / 4,8 | 468,9 / 10,6 / 5,2 | 757,4 / 18,5 / 7,4 | 531,5 / 12,6 / 5,2 |
| Kasse unter Notrücklage | 2 | **0** | 1 | 2 |
| Transferbilanz S2 Median, positiv/negativ | −22,4, 6/26 | −15,1, 5/27 | −23,1, 8/24 | −26,4, 8/24 |
| Gehalt je Team Median, im Band 50–70, min/max | 55,7, 15, 30,6/89,3 | 58,6, **20**, 36,0/90,5 | 58,4, 18, 42,2/82,2 | 59,2, **22**, 38,7/85,3 |
| Kaderplan-Grund (opt erreicht / Rahmen erschöpft) | – | 27 / 5 | – | 30 / 2 |

Lesart:

* **0 Teams unter 8** in allen vier Läufen. Unter GM-Opt bleiben 2 (Basis 1) bzw. 0 Teams; die beiden (P-C, V-W) hat Hebel (b) auf
  10 gesenkt, sie enden mit „Rahmen erschöpft“ bei 9.
* **Füller deutlich runter:** 19 / 20 statt 45–50 in der ersten Fassung (Runde 1, Tabelle unten) und praktisch auf dem Niveau des
  alten Stands (14 / 19) — bei doppelt so vielen Käufen.
* Hebel (b) bringt dafür **Notwege** (`fueller_rueckfall` 3 / 5): der gesenkte Opt wird genau so gewählt, dass der Rahmen alle
  Plätze zum Platzpreis trägt; kauft der Planer davor stärkere (teurere) Spieler als die reservierten billigsten 12er, reicht es für
  den letzten Platz nur noch für einen Füller. Kein Notkauf, aber laut Protokoll ein Plan, der seine Reserve nicht ganz hielt.
* Kasse: kein Minus, kein Notkredit, kein Notverkauf. Median rund 11–13 statt 18–27; unter der Notrücklage 0 bzw. 2 Teams.
* Gehalt: Median 58–59, 20 / 22 Teams im Band 50–70 (alt 15 / 18).

**Runde 1 (vor Hebel (b), Stand vor dem Merge von #1618 auf main):** Basis 1 / 2 neu: 0 unter 8, unter GM-Opt 1 / 2, aber
**50 / 45 Füller** (alt 11 / 17), 0 / 1 Notwege, Kasse Median 9,9 / 10,5. Auslöser für Hebel (b).
**Runde 2 (Hebel (b), vor dem Merge):** Basis 1 / 2 neu: Füller 9 / 19, Notwege 1 / 0, unter GM-Opt V-V 8/9 / keins.

## 5. Tests

* `tests/fenster-auf-opt.test.ts` — Schalter; S3: Gehaltsrahmen für vier Plätze → kein Star, der die Plätze auffrisst, Kader 12,
  keine Füller, Rahmen gehalten (für Topf und Kaderpflicht-Grenze; ohne die Reservierung rot); der Rahmen meldet das
  reservierte Gehalt; ohne Gehaltsgrenze ändert sich nichts; Quellprüfung Verkaufsrunde, Kaufweg, Kassensturz.
  Hebel (b) auf dem echten Saison-1-Pool: knappe Kasse senkt das Ziel (höchstens −2, nie unter Minimum + 1, mit Protokollgrund),
  reiche nicht; Saison 1 und der alte Stand senken nicht.
* `tests/preseason-hintergrundlauf-kauffenster.test.ts` — Standard: Verkaufsrunde, Kaufrunde, Nachrunde über die Sitzung, kein
  Marktplan; alter Stand per Schalter wie bisher.
* Angepasst (begründet): `tests/ki-kaderplan-prototyp.test.ts` (Kaderplan ab Saison 2 an, mit Schalter aus),
  `tests/transferfenster-gemeinsam.test.ts` (Verkaufsgrenze nur im alten Stand), `tests/kein-minus-nach-kauffenster.test.ts` und
  `tests/kader-auf-optimum-in-neuer-saison.test.ts` (prüfen den Marktplan-Weg, laufen jetzt im alten Stand).
* Merge #1618 × #1634: `tests/finanzen-v2-stufe0-3.test.ts`, `tests/finanzen-v2-seite.test.ts`,
  `tests/transferfenster-gemeinsam.test.ts` — Verkaufserlöse im Fenster zu 100 % frei auch im neuen Transfertopf (Lockerung nach
  Verkäufen nur im alten Ablauf, im Fenster bleibt nichts einbehalten).

Wertungs-Fingerabdruck nach dem Merge von main: `GESAMT d3a39030a3ef (75 Eintraege)` — derselbe Wert wie auf main
(`public/` unverändert gegenüber main).

## 6. Offene Punkte

1. **Notwege durch Hebel (b)** (3 / 5 `fueller_rueckfall` je Fenster): der gesenkte Opt ist auf Kante gerechnet. Möglicher Feinschliff:
   beim Senken einen Platz Luft lassen (das größte Ziel wählen, das der Rahmen mit Reserve für einen teureren Kauf trägt) oder den
   Rahmen mit dem Median statt den billigsten Preisen ab 12 rechnen. Nicht umgesetzt (PM: „nichts Weiteres anfangen“).
2. **Unter GM-Opt bei 9** (Basis 1: P-C, V-W; Runde 2: V-V 8/9). Muster V-V (Runde 2, am Spielstand verfolgt): Kader 6, verkauft 2
   auf 4, kauft bis 8, dann ist die Kasse leer. Unter dem Minimum deckt die Kaderpflicht-Grenze (`kaufRahmen().grenzeFuer`, #1618)
   nur die Plätze bis zum Minimum; der Kaderplan reserviert am 7. Platz deshalb nichts mehr für den 9., kauft einen 21-C-Spieler,
   und ab 8 sperrt die Notrücklage die Plätze bis Opt. Lösung wäre, dass der Rahmen unter dem Minimum die Plätze Minimum → Ziel
   gegen die Grenze „ab Minimum“ (Kasse − Notrücklage) mitplant; Planer- und Finanzfrage, nicht umgesetzt.
3. **Kasse:** Median ~11–13 nach dem Fenster (alt 18–27). Kein Minus, kein Notkredit — aber wenig Puffer für die Saison.
4. **Nicht über Transfers erklärte Kassenabflüsse im Fenster** (in beiden Ständen): Kasse Ende − (Start + Verkäufe − Käufe) war in
   Runde 1 bei Basis 1 −94,9 C (alt) bzw. −278,9 C (neu). Ein Teil sind Gebäude (z. B. G-G 24,7 C, W-L 20,8 C), ein Rest ist im
   Kontoauszug nicht sichtbar (T-C −41,8 C ohne Gebäude, Kredit oder Vertragsende). Nicht von dieser Änderung eingeführt — eigener
   Auftrag.
5. Die S1-Kaderaufbau-Karte von #1634 lag in der alten Finanzseite; ob die neue Finanzseite (#1618, main) sie zeigt, ist Sache der
   Finanzseite.

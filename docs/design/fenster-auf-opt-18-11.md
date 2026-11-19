# Fenster auf Opt: frei verkaufen, danach bis Opt auffüllen (18.11.)

Chris am 18.11., wörtlich: „Nein, man darf alle Spieler verkaufen, auch unter Minimum. Die KI soll danach ja einfach auf
Optimum füllen! Die Kader können nicht einfach mit 8–9 Leuten fertig sein, dann sind die Roster zu star-lastig.“

Baut auf **#1618** (Kaderpflicht-Freigabe, `kaufRahmen`), **#1629** (Kaderplan im organischen Planer) und **#1634**
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

## 4. Messung (32 KI-Teams, S1 → Fenster S2, zwei Basen)

Zwei Basen, je ein neues Spiel mit 32 KI-Teams von Anfang an (`scripts/miss-teamfinanzen-saison.ts --stop-after spieltage`,
Basis 2 mit `--mischen 7`), Liga-Draft und 20 Spieltage von Saison 1. Von jeder Basis zwei Kopien, derselbe Weg wie im Spiel
(`scripts/miss-transferfenster-gemeinsam.ts`: Saisonabschluss → Saisonende-Kette → Saisonwechsel → KI-Lauf im Fenster):
„alt“ mit `OLY_FENSTER_AUF_OPT=0` (Stand #1634 mit #1618/#1629), „neu“ im Standard. Wegwerf-SQLite, danach gelöscht.
Basis 1 „neu“ zweimal gelaufen: Ergebnis gleich (121 Käufe, 50 Füller), der Lauf ist wiederholbar.

**Saison 1** (nach dem Draft, unverändert — Fenster auf Opt greift erst ab Saison 2, der S3-Teil ist ohne Gehaltsgrenze wirkungslos):
Basis 1 Kader 9×3, 10×4, 11×6, 12×8, 13×2, 14×9; Basis 2 9×4, 10×3, 11×7, 12×8, 14×10; **0 Teams unter 8**. Gehalt Median
66,6 / 66,3, im Band 50–70: 18 / 20 Teams.

**Saison 2, Fenster:**

| | Basis 1 alt | **Basis 1 neu** | Basis 2 alt | **Basis 2 neu** |
|---|---:|---:|---:|---:|
| Teams unter Opt | 22 | **9** | 23 | **8** |
| Teams unter **GM-Opt** | 20 | **1** (V-W 11/12) | 22 | **2** (V-W 11/12, P-C 11/12) |
| Teams bei 8–9 ohne GM-Grund | 7 | **0** | 2 | **0** |
| Teams unter 8 | 1 (B-B 7) | **0** | 0 | **0** |
| Kader min / Median / Summe | 7 / 10 / 325 | **9 / 12 / 376** | 9 / 10 / 334 | **9 / 12 / 379** |
| Kaderverteilung | 7×1, 9×8, 10×13, 11×5, 12×4, 13×1 | 9×4, 10×4, 11×7, 12×6, 13×3, 14×8 | 9×3, 10×19, 11×6, 12×2, 13×1, 14×1 | 9×5, 11×10, 12×6, 13×2, 14×9 |
| Verkäufe im Fenster (Summe) | 33 (297,4 C) | 51 (464,9 C) | 38 (391,2 C) | 58 (587,9 C) |
| Teams mit Verkauf / danach unter 8 | 18 / 6 | 24 / 17 | 19 / 5 | 23 / 14 |
| Käufe im Fenster (Summe) | 52 (1349,1 C) | **121** (1671,8 C) | 66 (1523,0 C) | **131** (1847,8 C) |
| davon Füller < 12 | 11 | **50** | 17 | **45** |
| Notweg-Zähler (Kaderplan) | – | 0 | – | 1 (`fueller_rueckfall`) |
| Neue Kredite / Notkredite / Notverkäufe | 9 / 0 / 0 | 5 / 0 / 0 | 10 / 0 / 0 | 3 / 0 / 0 |
| Negative Kassen | 0 | 0 | 0 | 0 |
| Kasse Summe / Median / min | 826,9 / 19,3 / 5,6 | 487,8 / 9,9 / 5,5 | 897,2 / 25,1 / 6,2 | 438,1 / 10,5 / 5,5 |
| Kasse unter Notrücklage | 0 | 2 | 0 | 2 |
| Transferbilanz S2 Median, positiv/negativ | −16,0, 6/24 | −25,5, 5/26 | −32,0, 5/26 | −29,4, 5/27 |
| Gehalt je Team Median, im Band 50–70, min/max | 53,4, 20, 33,1/85,1 | 56,2, **22**, 37,1/93,3 | 57,9, 22, 33,2/90,5 | 58,7, **21**, 34,9/86,5 |
| Kaderplan-Grund (opt erreicht / Tiefe vor Qualität / Rahmen erschöpft) | – | 17 / 11 / 4 | – | 13 / 14 / 5 |
| Laufzeit KI-Lauf | 169 s | 208 s | 293 s | 289 s |

Lesart:

* **Ziel erreicht:** kein Team unter 8, kein Team bei 8–9 ohne Grund. Die Teams bei 9 haben Opt oder GM-Opt 9 (z. B. B-P Opt 9;
  N-N, P-S, R-L Opt 10 mit GM-Senkung). Unter GM-Opt bleiben 1 bzw. 2 Teams um einen Spieler, beide mit Protokoll
  „Rahmen erschöpft“ (V-W: Kasse 6,0 nach dem Fenster).
* Die KI verkauft mehr (51/58 statt 33/38), und deutlich mehr Teams fallen in der Verkaufsrunde unter 8 (17/14 statt 6/5) —
  alle füllt die Kaufrunde wieder auf. Kein Notkauf, kein Notkredit, kein Notverkauf, keine negative Kasse; alle Füller kamen
  aus dem Planer (`ai_organic_squad_buy`), keiner aus dem Verletzungs-Topup.
* **Der Preis ist die Kasse und die Füllerquote:** Käufe +69/+65, Kasse ligaweit −339/−459 C, Median rund 10 statt 19–25.
  41 % bzw. 34 % der Käufe liegen unter dem Platzpreis 12. Das sind geplante „Tiefe vor Qualität“-Plätze (der Rahmen trägt
  nicht alle Plätze bis Opt zum Platzpreis), keine Notwege — aber es sind Füller. Siehe offene Punkte.
* Gehalt: Median 56–59, 21–22 Teams im Band 50–70 (vorher 20–22), Ausreißer bis 93 (H-R mit „Alles auf eine Karte“).

## 5. Tests

* `tests/fenster-auf-opt.test.ts` — Schalter; S3: Gehaltsrahmen für vier Plätze → kein Star, der die Plätze auffrisst, Kader 12,
  keine Füller, Rahmen gehalten (für Topf und Kaderpflicht-Grenze; ohne die Reservierung rot); der Rahmen meldet das
  reservierte Gehalt; ohne Gehaltsgrenze ändert sich nichts; Quellprüfung Verkaufsrunde, Kaufweg, Kassensturz.
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

1. **Füllerquote (Entscheidung für Chris).** Mit freiem Verkauf und Auffüllen bis Opt kauft die KI 45–50 Füller (< 12) je
   Fenster (vorher 11–17). Typisch: T-C verkauft 6 Spieler (netto 46 C, 34,6 C gingen als Restgehalt-Ablösung weg) und füllt
   mit 7 Spielern um 6,5 C auf 14 auf. Chris’ zwei Vorgaben — „nicht mit 8–9 fertig“ und „keine Füller“ — stoßen sich, sobald
   die Kasse nicht alle Plätze zum Platzpreis trägt. Mögliche Hebel, nicht umgesetzt: (a) die Verkaufsrunde verkauft nur, wenn der
   Nachkauf des Platzes zum Platzpreis im Rahmen bleibt (ändert die Verkaufslogik, war ausdrücklich ausgeschlossen);
   (b) GM-Senkung stärker nutzen, wenn der Rahmen nur Füller trägt (weniger, dafür stärker); (c) Füller-Platzpreis an den
   Markt nach dem Saisonende koppeln statt fest 12.
2. **Kasse:** Median ~10 nach dem Fenster, 2 Teams unter der Notrücklage. Kein Minus, kein Notkredit — aber wenig Puffer für
   die Saison.
3. **Nicht über Transfers erklärte Kassenabflüsse im Fenster** (in beiden Ständen, im neuen größer): Kasse Ende − (Start +
   Verkäufe − Käufe) summiert sich in Basis 1 auf −94,9 C (alt) bzw. −278,9 C (neu). Ein Teil sind Gebäude (z. B. G-G 24,7 C,
   W-L 20,8 C), ein Rest ist im Kontoauszug nicht sichtbar (T-C −41,8 C ohne Gebäude, Kredit oder Vertragsende). Nicht von
   dieser Änderung eingeführt (der alte Stand zeigt dasselbe Muster), aber für die Füllerfrage relevant — eigener Auftrag.
4. Die Lockerung nach Verkäufen (#1618) greift im gemeinsamen Fenster nie, weil Erlöse dort ohnehin zu 100 % frei sind (Merge
   #1618 × #1634). Die Finanzseite zeigt sie trotzdem an; ggf. dort ausblenden (Datei des Finanz-Agenten).
5. Die S1-Kaderaufbau-Karte von #1634 lag in der alten Finanzseite (`FoundationFinancesNewLook.tsx`), die #1618 entfernt; sie
   gehört in die neue Finanzseite (#1618).

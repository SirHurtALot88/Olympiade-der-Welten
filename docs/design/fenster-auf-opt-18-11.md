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

## 4. Messung (32 KI-Teams, S1 → Fenster S2, zwei Basen)

MESSUNG_PLATZHALTER

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

## 6. Offene Punkte

OFFEN_PLATZHALTER

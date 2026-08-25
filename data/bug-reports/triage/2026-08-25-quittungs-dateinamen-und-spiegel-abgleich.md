# Zwei Quittungen ohne bug-Präfix — und ein Riegel, der das nie gemeldet hätte

**Nicht gemeldet — beim planmäßigen Bugfixing-Lauf um 20:33 UTC selbst aufgefallen:** Schritt 0
(Vergleich Meldungen gegen Quittungen) zeigte die zwei gerade erst bearbeiteten Meldungen
`ihcjoz` und `rtyqa9` weiter als **unbearbeitet**, obwohl der Fix längst gemergt war (#675).

**Status: gebaut.**

## Der Befund

Die beiden Quittungsdateien hießen `2026-08-25T13-49-35-444Z-ihcjoz.md` und
`…-rtyqa9.md` — **ohne** das `bug-`-Präfix, das die Routine selbst als Dateinamen verlangt
(`data/bug-reports/triage/bug-<id>.md`, wörtlich in ihrer eigenen Schritt-0-Anleitung, exakt
gleich der `reportId` aus der Meldung). Beim Anlegen übernommen aus einem falschen Reflex
(einige meiner eigenen, nicht an eine Chris-Meldung gebundenen Notizen tragen bewusst kein
`bug-`-Präfix — hier war es aber die falsche Vorlage).

**Die Folge wäre gewesen:** jeder künftige Vier-Stunden-Lauf hätte dieselben zwei Meldungen
erneut als offen behandelt, obwohl der Fix längst da war — ein Endlos-Zyklus aus wiederholter
„Bearbeitung" eines bereits erledigten Falls.

## Der zweite, wichtigere Befund

`scripts/pruefe-quittungen.ts` hat einen eigenen Spiegel-Abgleich (`ci:quittungen`, Teil 3) —
und der hätte das **nicht gemeldet**. Er prüfte bisher nur per **Substring**, ob der
sechsstellige Meldungscode (`ihcjoz`) irgendwo im Namen einer Quittung vorkam — nicht, ob die
Datei den vollen, erwarteten Namen trägt. Der Code stand im (falschen) Dateinamen, also meldete
der Abgleich „erledigt". Ein Riegel, der genau diese Art von Drift verhindern soll, hätte seinen
eigenen Auslöser nie gesehen.

## Was gebaut ist

1. **Beide Dateien umbenannt** auf `bug-<id>.md`.
2. **Der Spiegel-Abgleich prüft jetzt exakt**, nicht per Substring:
   `bestimmeUnbearbeiteteMeldungen` (neu exportiert aus `pruefe-quittungen.ts`) verlangt, dass die
   erwartete Datei unter ihrem vollen Namen existiert.

## Geprüft

`tests/quittungs-spiegel-abgleich-ist-exakt.test.ts`, 6 Fälle — geprüft wird die **echte**
Vergleichsfunktion, nicht eine Nacherzählung. Darunter der Fall, der genau den heutigen Zustand
nachstellt (Datei ohne `bug-`-Präfix), und ein Fall, den ein reiner Substring-Test ebenfalls
verfehlt hätte (eine andere Quittung, die den Code zufällig im Fließtext-Dateinamen trägt).

**Gegenprobe:** die alte Substring-Logik gegen denselben Test gefahren — 4 von 6 Fällen fallen.

Manuell nachgemessen: `npx tsx scripts/pruefe-quittungen.ts` (voller Lauf, mit Spiegel) zeigt
jetzt „unbearbeitet: 0" statt der vorherigen (falschen) „0" aus der Substring-Prüfung — dieselbe
Zahl, aber jetzt aus dem richtigen Grund, nachgewiesen durch den Rückbau-Test oben.

`tsc` leer (Routinen-Filter) · `ci:import-exists` (2364) · `ci:client-bundle-lint` ·
`ci:flow-smoke` (205) · `ci:quittungen` ok.

Kein Changelog-Eintrag — reine Werkzeug-/Prozesskorrektur, keine sichtbare Änderung im Spiel.

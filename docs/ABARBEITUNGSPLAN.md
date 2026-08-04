# Abarbeitungsplan für Chris' offene Liste

Reihenfolge nach **gemeinsamer Ursache**, nicht nach Meldedatum. Drei der offenen Punkte gehen
vermutlich auf denselben Defekt zurück; wer ihn einmal richtig löst, erledigt alle drei. Deshalb
steht er vorn, obwohl er nicht der lauteste ist.

Jeder Schritt gilt erst als fertig, wenn er hat: Ursache mit Datei:Zeile, ein Test der **ohne** den
Fix nachweislich rot ist (Gegenprobe ausgeführt, nicht behauptet), grünes `ci:flow-smoke`, PR mit
Auto-Merge, Changelog-Eintrag in Alltagssprache und Triage-Quittung.

## Block 1 — die gemeinsame Wurzel (zuerst)

Grundlage: `docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md`. Der Browser hält einen beschnittenen
Spielstand; alles, was daraus abgeleitet wird, wird still zu 0. Bereits zweimal bestätigt (VK-Wert,
Performance-Anteil), einmal gemessen offen (Top-Disziplinen-Ränge).

**1.1 Ränge in den Top-Disziplinen** (`uzetn6`) — *zuerst, weil am weitesten vorbereitet.*
Gemessen: voller Save 6 Zeilen mit Rang, kompakter Payload 0 — bei identischen PP-Zahlen. Der Wert
stimmt, nur der Vergleich über alle Spieler fehlt. Zwei Wege stehen im Befund; die Wahl ist zu
belegen, nicht zu raten. Die Spalte „−1 PPs" hat gar keinen Rang im Code und bleibt in Saison 1
ehrlich leer.

**1.2 Performance-Anteil im Trainings-Forecast** — *der größte Gewinn, aber auch der größte Brocken.*
Befund fertig: `docs/TRAINING_PERFORMANCE_ANTEIL_BEFUND.md`. Chris' Richtungsvorgabe („die
bonuspunkte die die spieler pro spieltag erhalten müssen irgendwo zwischengespeichert werden") zuerst
gegen das prüfen, was es schon gibt — `persistedSeasonDerivations` und der Saison-Ledger gehen in
dieselbe Richtung. Existiert der Zwischenspeicher bereits und wird nur weggeschnitten, ist das die
Antwort. Grenzen: keine Save-Migration, Scoring bleibt unangetastet.

**1.3 Formkarten-Spalte zeigt überall „—"** — *Verdacht, noch nicht geprüft.*
Passt ins Muster, ist aber **nicht** gemessen. Erst die Messung (voller Save gegen kompakten
Payload), dann entscheiden. Bestätigt sich der Verdacht, ist es nach 1.1 eine kleine Nacharbeit.

## Block 2 — eigenständige Anzeige-Punkte

Unabhängig voneinander, jeder für sich klein bis mittel.

**2.1 RANG-Tabellen-Spaltenordnung** (Showcase 6 Spieler, SHO nur 2.) — erst klären, woher die
Sortierung ihre Zahl nimmt: feste Katalogzahl oder echte Teilnehmerzahl der Saison. Laufen die
auseinander, ist genau das der Befund. Ist die Sortierung korrekt und Chris' „6" eine andere Zahl,
wird **nicht** umgebaut.

**2.2 Teamansicht: größere Portraits, PP je Achse, PP je Disziplin** — reine Anzeige. Achsen-PP aus
den Server-Ratings, Disziplin-PP aus dem Directory-Slice; **nicht** aus dem Client-Ledger (siehe
Block 1). Wird der dritte Teil zu voll für die Karte, weglassen und im PR begründen.

**2.3 Bilder in Hovers und Teamkarte vorladen** (`2tlf67`) — kleinster Punkt der Liste, gutes Ventil
für eine Runde mit wenig Luft.

**2.4 Aufstellung erlaubt nur 4 Spieler** — aus der Übergabe, nie nachgestellt. Zuerst reproduzieren;
ohne Reproduktion kein Fix.

## Block 3 — Regeln und Geld (Vorsicht)

**3.1 Transfers aus der GuV raus.** Chris' Entscheidung ist die Vorgabe, der Finanzen-Reiter macht
es bereits so. Anzeige angleichen ist erlaubt, Buchungen umschreiben nicht. Bleibt danach eine
Differenz, muss sie benannt und im Hover erklärt sein.

**3.2 Verletzungen im richtigen Spieltag und der richtigen Disziplin werten.** Berührt die Wertung —
erst nachstellen und belegen, dann bauen. Im Zweifel Befund statt Fix.

**3.3 KI: Front-/Back-loaded gegen den Apron.** Der größte und unschärfste Punkt („wenn es geht",
„evtl"). Bestandsaufnahme und Messung zuerst; gebaut wird nur die KI-*Entscheidung*, nicht die
Gehaltsmechanik. Ein Befund ist hier ein vollwertiges Ergebnis.

## Wartet auf Chris — nicht selbst entscheiden

- **Fatigue-Balance.** Eine Balance-Frage, keine Fehlfunktion.
- **Cash-danach-Spalte.** Blockiert, bis geklärt ist, ob `team.cash` realisierte Transfers schon
  enthält. Ohne diese Antwort zeigt die Spalte eine doppelt gezählte Zahl.
- **Eigenständige Routine** in der Routinen-Oberfläche (`docs/BUGFIXING_ROUTINE_EINRICHTEN.md`). Die
  laufende funktioniert, hängt aber an einer Sitzung.

## Arbeitsweise

Ein Punkt pro Branch, ein PR pro Punkt. Lieber **einen Punkt ganz** als drei halb — halbe Fixes sind
teurer als keine. Vor jedem Griff die offenen PRs auf Titel prüfen: an diesem Repo arbeiten mehrere
Sitzungen gleichzeitig, und doppelt gebaut ist doppelt bezahlt.

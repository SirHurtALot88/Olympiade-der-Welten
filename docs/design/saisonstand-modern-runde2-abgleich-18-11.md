# Saisonstand modern, Runde 2 — Abgleich mit dem Mockup (18.11.)

Bilder: `docs/design/saisonstand-modern-17-11/abgleich-01..04-*.png` (links Mockup, rechts die echte App im Duell-Save nach 6 Spieltagen,
1600x900), Einzelbilder `app-r2-*.png` (1710x1112 MacBook Air 15", 1920x1080, 2560x1440, Phone 412).
Der Showdown-Balken heisst bewusst **Kaderstärke** (Verhältnis A/(A+B) der Top-6-Eignung der Disziplin,
`team-discipline-rank-engine` → `scorePack.disciplines`), nicht Papierform/Siegchance: es gibt keine Prognose-Rechnung.

## Tabelle (abgleich-01, abgleich-02)

| Mockup-Feature | Stand |
|---|---|
| Rang mit Zonenstreifen (Titel/Aufstieg/Abstieg), gestrichelte Grenze | drin |
| ± Platzbewegung (▲ grün / ▼ rot mit Zahl) | drin (`fieldRaceRankDelta`) |
| Wappen, Teamname, DU / RIVALE | drin (+ FRANKY) |
| S-U-N, Verhältnis | drin |
| Form: 6 schräge Kästchen (grün 3–4, grau 2, rot 0–1), leere Plätze vorn | drin (13 px, skewX -14°; Phone 9 px) |
| Verlauf: Sparkline des Ligaplatzes, eigenes Team Gold, Endpunkt | drin (nur gewertete Spieltage, ab 2 Punkten) |
| POW/SPE/MEN/SOC | angepasst: Mockup hebt nur den besten Bereich fett hervor; Chris wollte Top-10-Farben: Rang 1–3 grün, 4–6 gelb, 7–10 rot (Rang je Bereich in der angezeigten Liga, Gesamt über 32) |
| Nä. (Wappen des nächsten Gegners) | drin |
| Abst. (Punkte hinter dem Führer, Führer „–") | drin |
| Pkt | drin |
| Sport / Verein | drin |
| Fußzeile mit Legende | drin (+ Band- und Form-Legende) |
| Kopf: Liga-Reiter mit Wappen des Führers | angepasst: Symbol L1/L2/32 und Führerpunkte statt Führer-Wappen |
| Kopf: Spieltag-Zeitregler `‹ ›` und Button „Ansetzungen ›" | fehlt: kein Zeitregler (keine Datenquelle für frühere Tabellenstände); „gegen X" steht im Kopf, Ansetzungen über den Reiter Spieltage |
| Rechte Spalte: Teamkarte / Showdown / Bestenliste als drei Reiter | angepasst: Teamkarte + Showdown rechts, Bestenliste ist ein eigener Hauptreiter |

## Showdown (abgleich-01, rechts)

| Mockup-Feature | Stand |
|---|---|
| „Dein Spiel" + weitere Paarungen der eigenen Liga | drin (Dein Spiel, Spitzenspiel = kleinste Rangsumme, Kellerduell = größte) |
| Wappen, Name, „Rang · Pkt" je Seite | drin |
| Je Disziplin zweifarbiger Balken mit Prozent | angepasst: Kaderstärke-Anteil statt Papierform-Prozent; Tooltip nennt beide Kaderstärke-Ränge und Werte |
| Vierer-Pod-Disziplinen | angepasst: statt Balken Zeile „Vierer-Pod · Kaderstärke #a · #b" |
| „Was auf dem Spiel steht" (Aufstiegslinie, Noch zu holen) | drin (Linien- und Restpunkte-Block, wie in der Teamkarte) |

## Spieltage (abgleich-03 Ergebnisse, abgleich-04 Ansetzungen)

| Mockup-Feature | Stand |
|---|---|
| Ergebnisse / Ansetzungen umschalten, Spieltag blättern | drin |
| Karten in zwei Spalten je Liga | drin (ab 1500 px) |
| Ansetzungen: Balken je Disziplin mit Prozent | drin (Kaderstärke-Anteil, Pods als Rang-Chips) |
| Ergebnisse: Pille 0/1/2 je Disziplin, Rohwerte beider Seiten | angepasst: Punkte „2:0" und Normierung/Rohwerte in einer Zeile, keine Pillen |
| Legende Sieg / Unentschieden / Niederlage als Pillen | fehlt (reiner Text) |
| Chip „Spitzenspiel/Kellerduell/ST n" an der Karte | fehlt (nur im Showdown) |
| Große Wappen in den Karten | angepasst: kleine Wappen |

## Neu in dieser Runde, ohne Mockup-Vorbild

* Disziplin-Matrix (Punkte-Modus): Hover zeigt je Einsatz eine Zeile „2 Pkt · Sieg 8–4 gegen Royal Court (Spieltag 3)"
  (0–10-Normierung, sonst gerundete Rohwerte); Vierergruppe „2 Pkt · Platz 1 von 4 · gegen A, B, C".
* 16:9-Feinschliff: Zeilenhöhe der Tabelle und Höhe des Arbeitsbereichs folgen der Fensterhöhe; rechte Spalte wächst bis 520 px.
  Bei 2560 px begrenzt die Shell die Inhaltsbreite selbst (~1420 px, zentriert) — das ist Shell, nicht Saisonstand.

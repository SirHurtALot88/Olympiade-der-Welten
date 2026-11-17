# TDM- und Mini-DM-Formate — Konzept (17.11.)

Anlass, Chris am 17.11. zu einem TDM-Screenshot (Lavaboden, 1:1, „Sudden Death 1:34“): „bei tdm steht
sich nur gegenüber und es wird gar nicht gekämpft — und ich hätte da gerne einen modus wo spieler 1v1
nacheinander gegeneinander kämpfen und einen modus wo sie alle gleichzeitig auf dem feld sind! nicht nur
optisch andere arena“. Nachgereicht: bei **Mini-DM** dasselbe — „alle Spieler stehen nur auf ihrem
Punkt herum … da fehlt Bewegung, Dynamik“.

## 0. Befund und Sofort-Fix (Teil 1, schon umgesetzt)

**Reiner Anzeigefehler, die Wertung war nie betroffen.** TDM wird seit 11.11. vor dem ersten Tick
als Takt-Protokoll entschieden (`tdmGefecht()` → `tdmSchlagwechsel()`), die Arena spielt es nur ab
(`tdmReplaySchritt()`). Dieses Abspielen bewegte **keine einzige Figur**: `baueEinheit()` stellt die
Seiten als zwei senkrechte Reihen bei x=320 / x=920 (Leinwand 1240) auf, dort blieben sie das ganze
Gefecht, Treffer waren nur Schwebezahl plus 0,16 s `lunge` (4 % jedes 4-s-Taktes). Das „Sudden Death
1:34“ war ein Beschriftungsrest des alten Echtzeit-Zweikampfs — das Gefecht kennt kein Sudden Death.

Mini-DM hat eine eigene Vier-Ecken-Leinwand (`mdffaBuehne`), aber denselben Kern: jede Figur stand
fest auf ihrem Eckkreis, ein Schlag war ein 0,4-s-Ausfall Richtung gegnerische Ecke und zurück, und
der ganze Schlagwechsel einer Runde lief in 250-ms-Takten in rund 2 s durch.

Gemessen (TDM 30 Saaten, Sonde `window.__arena.tdmBewegungsProbe`; Mini-DM Zeitreihe der Leinwand):

| | vorher | nachher |
|---|---:|---:|
| TDM: Spiele mit Stillstandsphase > 10 s Uhr | 30 / 30 | 0 / 30 |
| TDM: Anteil Spielzeit „beide Reihen > 200 px getrennt“ | 100 % | 0 % |
| TDM: längste Stillstandsphase (Uhr) | Ø 116 s = ganzes Spiel | 0 s |
| TDM: Abstand Angreifer→Ziel beim Schlag | Ø 620 px | Ø ~100 px |
| Mini-DM: Kampfphase je Runde | ~2 s | ~5 s (+0,9 s Anmarsch) |
| Wertungs-Fingerabdruck | `e80babacb68c` (75) | `e80babacb68c` (75), alle 75 Zeilen identisch |

Fix: TDM-Figuren laufen an eine Frontlinie in der Feldmitte und stellen sich dort ihrem Protokoll-Ziel
des laufenden Taktes gegenüber (`tdmReplayBewegen`, Positionen gehen in keine Wertung ein); Mini-DM-
Figuren laufen aus den Ecken an, umkreisen ihr letztes Ziel in Schlagweite, weichen bei „position“-
Ereignissen aus, der Rundensieger geht in die Mitte (`mdffaBewegen`); Mini-DM-Takt 250 → 400 ms.
Schalter für Vorher/Nachher: `__arena.tdmBewegung(false)`, `__arena.mdffaBewegung(false)`.

**Was der Fix nicht liefert:** es bleibt EIN Format je Disziplin. Die Bewegung folgt einem Protokoll,
in dem Ort keine Rolle spielt. Die zwei Formate unten sind echte Mechanik-Varianten.

## 1. Das Muster: der Spurt-Format-Umschalter

`SPURT_FORMATE=["klassisch","hatz","hyrox"]`, `spurtFormatWaehlen(saat)`: Format aus einem Hash der
Saat (`kulisseHash("spurt-format|"+saat)`), **nur** wenn ein echter Kader hängt; ausdrücklich
gesetzt über `bahnFlags({spurtFormat})`; Messwerkzeuge ohne Kader laufen bit-identisch „klassisch“.
Weil Vorlauf, Arena und Battle Arena dieselbe Saat sehen, wählen alle dasselbe Format — gezeigt =
gebucht ohne durchgereichtes Flag. Der Fingerabdruck führt die Zusatzformate als eigene Einträge
am Listenende (`spiele spurt/hatz s`, `spiele spurt/hyrox s`).

Für TDM genauso: `TDM_FORMATE=["linie","duell-reihe","handgemenge"]`, `tdmFormatWaehlen(saat)` mit
eigenem Hash-Präfix `"tdm-format|"`, `tdmFlags({format})`. `spieleTdmGefecht()` und `build()`s
TDM-Zweig verzweigen an genau einer Stelle (heute rufen beide `tdmGefecht()`), damit Buchung und
Anzeige garantiert dasselbe Format rechnen. „linie“ = das heutige Gefecht, unverändert.

## 2. Format „Duell-Reihe“ (1 gegen 1 nacheinander)

**Ablauf.** Beide Teams stellen ihre k Kämpfer in eine Reihenfolge (die Slot-Reihenfolge der
Aufstellung; ohne Aufstellung nach Eignung absteigend — dieselbe Ersatzregel wie heute). Duell i:
Heim-Platz i gegen Gast-Platz i, **Hin- und Rückrunde**: in der Rückrunde ist die Gastreihe um eins
verschoben (Platz i gegen Platz i+1). Jeder kämpft genau zweimal, gegen zwei verschiedene Gegner.

**Ein Duell** ist `tdmSchlagwechsel()` mit je einem Kämpfer pro Seite — die Funktion kann das heute
schon (`kaempfer`-Liste, `N` Seiten, Ende „allein“ oder Zeit). Eigene Saat je Duell
(`saat+"|duell|"+i`), höchstens 8 Takte; endet es auf Zeit, entscheidet der Anteil restlicher
Stand. Kein `rr()`, nur `mdffaZufall`.

**Erschöpfung/Verletzung.** Was ein Kämpfer in der Hinrunde an Stand verliert, nimmt er zur Hälfte
mit in die Rückrunde; Stamina (Matrix 14) bestimmt, wie viel er zurückholt („Ausdauer“-Kanal bekommt
damit eine zweite, sichtbare Wirkung). Determination (Letzter Atem) gilt einmal je Spiel, nicht je
Duell — sonst verdoppelt sie ihr Gewicht.

**Punkte.** Teamwertung: 3 je Duellsieg, 1 Bonus bei K.o.; Einzelwert wie heute (`wert` = Schaden +
15 je K.o. + 2 je Takt auf den Beinen), damit Boxscore und PPS-Pfad unverändert lesen können.

**Kanäle — die Matrix bleibt, nur die Bedeutung zweier Kanäle wechselt** (1 gegen 1 hat kein
zweites Ziel und keine Mannschaft auf dem Feld): Intelligence (6) „Schwachstelle“ → **Lesen**: ab
Takt 3 eines Duells Trefferbonus, weil der Gegner durchschaut ist; Charisma (10) „Befehl“ →
**Bank**: wer gerade nicht kämpft, feuert an — Wucht-Bonus für den nächsten eigenen Duellanten
(der Nebenweg aus der Mehrwege-Leitlinie: ein Charisma-Spieler hilft, auch wenn er selbst verliert).
Alle anderen Kanäle 1:1 aus `tdmKaempfer()`.

**Zuschauer.** Mitte: die zwei Duellanten, Laufen aufeinander zu, Angriff/Treffer/Tod aus dem
vorhandenen Bestand. Rand: beide Teams als Bank in ihrer Reihe (Grundpose), wer dran ist, läuft aus
der Reihe in die Mitte; Gefallene liegen am Rand. HUD: „Duell 3/12“ und eine Leiter mit allen
Paarungen. Keine neue Animation nötig.

## 3. Format „Handgemenge“ (alle gleichzeitig, mit Kontakt)

Heute stehen nach dem Fix zwar alle gleichzeitig auf dem Feld, die Zielwahl ist aber zufällig über
alle Gegner — wer neben wem steht, zählt nicht. Das Handgemenge macht den Ort zur Mechanik, und zwar
**im Protokoll**, sonst wäre gezeigt ≠ gebucht:

- Das Feld hat **drei Bahnen** (oben/Mitte/unten). Jeder Kämpfer steht je Takt in genau einer;
  geschlagen wird nur innerhalb der eigenen Bahn. Bahn ohne Gegner = Takt ohne Schlag, er wechselt.
- **Bahnwahl** zu Taktbeginn: Intelligence (6) sucht Überzahl, Awareness (2) erkennt eine offene
  Flanke; ohne beides bleibt man in seiner Bahn. **Speed wiegt in der TDM-Matrix 0** — die
  Bewegungsgeschwindigkeit darf deshalb an nichts Messbarem hängen (sonst Pp-Verstoß).
- **Zange**: zwei gegen einen in derselben Bahn gibt Schwachstellen-Bonus (Mini-DMs `zange`-Ereignis
  als Vorlage). Charisma (10) bleibt „Befehl“, wirkt aber nur auf Kameraden in derselben Bahn.
- **Rückzug**: wer unter 25 % Stand fällt, darf mit Spirit (12) eine Bahn ausweichen (Mini-DMs
  `position`-Ereignis) — ein Takt ohne erlittenen Treffer, aber auch ohne eigenen Schlag.

Vorbild ist `bfffaGefecht()` (Battlefield-Pod: Orte, `nach`, Bewegung im Protokoll; rho 0,86–0,92,
Pp 4,8–20,2). Die Anzeige liest Bahn und Ziel je Takt aus dem Protokoll; `tdmReplayBewegen()` aus dem
Fix trägt dann nur noch die y-Lage der Bahn statt der Ziel-Höhe.

## 4. Mini-DM

Mini-DM ist heute schon das, was für TDM „Duell-Reihe“ heißt, nur vierseitig: je Runde ein Kämpfer
je Team, vier Runden nach Rolle. Ein „Alle gleichzeitig“ hieße dort: alle k Kämpfer aller vier Teams
in einem Vier-Ecken-Handgemenge — das ist fast genau der Battlefield-Pod ohne Kontrollpunkte
(`bfffaGefecht` mit einem einzigen Ort „Mitte“). Die Leinwand `mdffaBuehne` ist auf eine Figur je
Ecke gebaut; für k Figuren je Ecke braucht sie dieselbe Bewegungslogik wie der Fix, mit Bahnen.
Reihenfolge: erst TDM, dann Mini-DM mit dem dort fertigen Handgemenge-Kern.

## 5. Buchung, Determinismus, Fingerabdruck

- Format nur aus der Saat (Hash), gezeigt = gebucht wie bei Spurt; ohne echten Kader immer „linie“.
- Fingerabdruck: die 75 bestehenden Zeilen bleiben, „linie“ ändert sich nicht. Neu am Ende:
  `spiele tdm/duell-reihe 1|7|42` und `spiele tdm/handgemenge 1|7|42` (75 → 81), Format dafür wie bei
  Spurt ausdrücklich gesetzt und im `finally` zurück. Neuer GESAMT-Wert in CLAUDE.md.
- `boxscore` je Kämpfer bleibt `{name, wert}`, die Anteile summieren sich wie heute auf 100 — PPS-,
  Saison- und Headless-Pfad lesen kein Format.

## 6. rho/Pp — Erwartung und Messplan

| Format | rho je Spiel erwartet | Risiko | Pp erwartet |
|---|---|---|---|
| linie (heute) | 0,81–0,83 (gemessen 10.11.) | — | 13,5–16,5 (gemessen) |
| duell-reihe | 0,74–0,82 | jeder hat nur 2 Duelle, der Gegner bestimmt mit → Verlässlichkeit niedriger | 15–25, Charisma/Intelligence neu gebunden |
| handgemenge | 0,80–0,86 | Bahnen bündeln Zufall, Vorbild Battlefield | 10–20 |

Messplan je Format, Pflicht vor dem Scharfschalten: `tdmGefechtSonde` und `tdmGefechtEinfluss` bekommen
einen `format`-Parameter; `scripts/miss-tdm-gefecht-abnahme.mjs --format=<f>` (kaderfest, 30 Paare,
zwei Saatströme, k=2..6) für rho; `--nur-pp --pp=48` (Budget-Methode, Hebung +15, zwei Saatströme)
für Pp. Schranken wie CLAUDE.md: rho hart ≥ 0,75, Ziel > 0,80; Pp ≤ 25, Ziel < 15. Fällt die
Duell-Reihe unter 0,75, zuerst Duelle verlängern (8 → 12 Takte), dann drittes Duell je Spieler —
nicht an der Matrix drehen.

## 7. Aufwand und Reihenfolge

1. Format-Gerüst (`TDM_FORMATE`, Wahl per Saat, `tdmFlags`, Fingerabdruck-Einträge, Formatanzeige im
   HUD) — ½ Tag.
2. Duell-Reihe: Motor (baut auf `tdmKaempfer`/`tdmSchlagwechsel` ohne Änderung daran) + Messung —
   1 Tag; Anzeige (Bank, Mitte, Leiter) — 1 Tag.
3. Handgemenge: Bahnen im Protokoll + Kalibrierung — 1½–2 Tage; Anzeige — ½ Tag.
4. Mini-DM-Handgemenge — 2 Tage, nach 3.

Keine PixelLab-Bestellung: Laufen, Angriff, Treffer, Tod und Grundpose reichen für beide Formate.

## 8. Offene Fragen an Chris

1. **Format per Saat würfeln wie beim Spurt (je ein Drittel Linie / Duell-Reihe / Handgemenge)?**
   Empfehlung: **Ja** — Buchung und Anzeige bleiben dadurch ohne zusätzliches Flag deckungsgleich.
2. **Duell-Reihe mit „Sieger bleibt stehen“ (Kachinuki: der Sieger kämpft mit seinem Reststand weiter,
   bis er fällt)?** Empfehlung: **Nein** — ein Star könnte das ganze Gegnerteam allein abräumen, wer
   nie drankommt, hat keinen Wert, rho fällt. Stattdessen Hin- und Rückrunde, jeder kämpft zweimal.
3. **Soll Mini-DM danach ebenfalls ein „Alle gleichzeitig“-Format bekommen (alle k je Team im
   Vier-Ecken-Handgemenge)?** Empfehlung: **Ja**, aber erst wenn das TDM-Handgemenge abgenommen ist.

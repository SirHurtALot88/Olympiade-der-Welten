# Battlefield: Fünf-Punkte-Domination als Standard, Respawn mit sinkenden HP (22.11.)

Arbeitsliste 21.11., Welle 4: „Battlefield: 5-Punkte-Domination als Standard + Respawns mit sinkenden HP.“
Vorgeschichte: `vier-teams-staffel-battlefield-17-11.md` Abschnitt 3 (das Format entstand dort als Umschalter,
Standard blieb das Gefecht je Ort), `battlefield-pod-ffa-02-11.md`.

## 1. Was jetzt gilt

| | vorher (bis 21.11.) | jetzt |
|---|---|---|
| Format im Pod (3 oder 4 Teams) | `orte3`: drei Orte, wer fällt, scheidet aus | **`domination5`**: fünf Orte, 1 Punkt je Sekunde und gehaltenem Ort, Respawn |
| Wertung | Punkte, dann Stehende, dann Kampfrichterwertung | Punkte, dann Stehende am Ende, dann Kampfrichterwertung (Review D1, unverändert) |
| Respawn | gab es nicht | nach 3 Takten (6 s) an der Ecke, **mit sinkenden HP** |
| Wer legt das Format fest | Konstante `BATTLEFIELD_POD_FORMAT` (Prozess) | **Spielstand-Stempel je Spieltag** (`seasonState.battlefieldFormat`) |

### 1.1 Sinkende HP beim Respawn (Konstanten im Motor)

`BF_D5_GRUND` in `public/mockups/battle-mode.engine.js`, über `window.__arena.battlefieldD5({...})` für Messungen änderbar:

- `respawnHpSchritt: 0.25`, `respawnHpMin: 0.5`
- der n-te Respawn eines Kämpfers bringt `max(0,5, 1 − n · 0,25)` seiner vollen HP zurück: **100 % → 75 % → 50 %**, danach bleibt es bei 50 %.
- Das Protokoll trägt es: Ereignis `respawn {wer, hp, n}`, je Kämpfer im Schnappschuss `hp` (Stufe) und `respawnTakt`.
  Die Wiedergabe liest dieselben Zahlen (gezeigt = gebucht).
- Nichts scheidet aus: wer wenig HP hat, bleibt im Spiel, aber ein zweiter Fehler kostet mehr als der erste; die Spätphase kippt
  trotzdem, weil Respawns weiter möglich sind.

Gewählt aus vier Varianten (Schritt/Untergrenze 0,25/0,4, 0,25/0,5, 0,2/0,5 und ohne Abfall), `--gruppen=30`, beide Saatströme:
alle liegen im Messrauschen (±0,02 bei k=2), 0,25/0,5 entspricht Chris' Beispielfolge 100 → 75 → 50 und hat eine klare Untergrenze.

### 1.2 HUD (vorhandenes HUD-System, keine neuen Figuren oder Animationen)

- **Tafel oben** (`zeichneBfPodTafel`): zweite Zeile je Team. Fünf Kästchen (gefüllt = Ort gehalten, in Teamfarbe), daneben
  „N von 5 Orten“ — oder, solange jemand wartet, **„↻ Name 5 s“** (Respawn-Zähler, bis zu zwei Namen, dann „+n“).
- **Figur**: Der Teil der Lebensleiste, der nach dem Respawn nicht mehr gefüllt werden kann, ist dunkel abgesetzt; rechts daneben steht die
  Stufe („75 %“, „50 %“).
- **Ticker/Schwebetext**: „zurück · 75 % HP“, „ist zurück im Spiel, mit nur noch 75 % der HP“.
- Aufnahmen: `battlefield-5punkte-22-11/pod-1920x1080-ganz.png`, `pod-2560x1440.png`, `pod-2560x1440-ganz.png`, `pod-1920x1080.png`
  (Pod, Kampfzeit 45–58 s) und `duell-1920x1080-ganz.png` (Zweier-Duell, unverändert).
  **Ehrliche Einschränkung:** Die Aufnahmen kommen aus der Motor-Seite `battle-mode.html` (`scripts/screenshot-battlefield-pod.mjs`,
  neu mit `--viewport=` und `--duell`), nicht aus der eingeloggten App-Hostseite — dort ist kein Login im Container. Die Canvas
  bleibt in der Motor-Seite bei 938 px logischer Breite; die Host-Skalierung auf die ganze Fensterbreite wurde nicht neu geprüft.
  Gesehen und behoben: die Stufenzahl lag zuerst unter der Figur und deckte Namen; jetzt rechts neben der Leiste.

## 2. Duell: was das Format kann und was nicht

Das Fünf-Punkte-Gefecht ist ein **Pod-Format** (`bfPodLauf` verlangt 3 oder 4 Teams, Geometrie: vier Ecken plus Mitte). Das Zweier-Duell
(`spieleArenaDomination`, `spiele battlefield`, Kontrollpunktregel) **wird in der Liga nicht gebucht** — ein Spieltag ohne Pods fällt auf
den PPS-Pod zurück, das Duell ist nur Referenz. Es bleibt deshalb **unverändert** (Fingerabdruck-Zeilen byte-gleich, Aufnahme
`duell-1920x1080-ganz.png`). Was fehlte, um das Duell ebenfalls umzustellen: ein Zwei-Ecken-Layout für fünf Orte, ein eigener
Anzeige-Kontext für zwei Seiten und eine Abnahme der Duell-Messung (`miss-alle-disziplinen.mjs --node 24 battlefield`: rho 0,589,
„durchgefallen“ — Messpfad-Befund vom 15.11., dieselbe Zahl wie vorher, nie gewertet). Nicht gebaut, weil nichts es bucht.

## 3. Format je Spieltag, Rückweg (wie Canyon)

`lib/resolve/battlefield-format.ts` (Muster `climbing-format.ts`):

- Stempel `seasonState.battlefieldFormat = { seasonId, wechsel: [{ab, format}] }`, gesetzt beim Laden (`stempleBattlefieldFormat`
  in `save-repository.ts`), rein und idempotent, nur Battle-Spielstände. Schon gebuchte Spieltage einer laufenden Saison ohne Stempel
  bekommen `orte3`, ab dem nächsten gewerteten Spieltag gilt der Schalter (Standard `domination5`).
- **Umstellung ab dem nächsten gewerteten Spieltag**, nicht erst zum Saisonwechsel (Vorschlag und Standard wie Canyon): das Format ändert
  nur, WIE ein Pod-Kampf ausgespielt wird; die Wertungsskala (PP C2, Ergebnis E1) und die Buchung (Platz 1–4, 2-1-0-0) bleiben, und
  gebuchte Spieltage behalten ihr Format. Wer es erst zum Saisonwechsel will, setzt den Schalter erst dann.
- **Rückweg-Schalter `OLY_BATTLEFIELD_FORMAT=alt`** (auch `orte3`, `aus`, `0`, `false`; Browser: `NEXT_PUBLIC_OLY_BATTLEFIELD_FORMAT`),
  in `deploy/hetzner/.env` (+ `.env.example`, `docker-compose.yml`, `Dockerfile`-Build-Argument). Wirkt ab dem nächsten gewerteten
  Spieltag; schon gebuchte Fünf-Punkte-Spieltage bleiben so.
- **Gezeigt = gebucht:** Host (`echterKader.battlefieldPod.format`), Chromium-Runner und Node-Runner lesen alle
  `battlefieldFormatFuer(gameState, matchdayId)`; `battlefieldPodFormatOption(format)` liefert das Format jetzt **immer
  ausdrücklich** (vorher fehlte das Feld im Standard). Das Format steht im Eingabe-Hash des Vorlaufs
  (`arena-eingabe-hash.ts`: `pod-gefecht-je-ort` bleibt für `orte3`, sonst `pod-domination5`) — ein Wechsel nach dem Vorlauf verwirft ihn.
- **Referenz je Format** (`data/generated/battlefield-pod-referenz.json`): `feldgroessen` = Fünf Punkte (neu gezogen,
  `scripts/ziehe-battlefield-pod-referenz.mjs`, neu mit `--format=`), `feldgroessenOrte3` = alt. Die Rohdaten tragen `format`
  (fehlt es in alten Snapshots, gilt `orte3`). Die rohe Kampfrichterwertung ist im neuen Format etwa doppelt so groß (mehr K.o. durch
  Respawns); die Spieler-PP laufen über p50/p99,5 und bleiben auf der PP-Skala.
- Lauf-Option `echtzeit` (alter freier Kampf um drei Orte, nur Vergleich) läuft immer als `orte3`.

## 4. Abnahme (Pflicht): 30 Vierergruppen × 4 Kämpfe, zwei Saatströme, kaderfest, `OLY_FORM_MODUS=echt`

Befehl: `node scripts/miss-battlefield-pod-ffa-abnahme.mjs 4 --gruppen=30 --format=<orte3|domination5> --je-seite=2..6 --pp=48 --pp-je-seite=2..6`

rho je Kampf (Median über die Gruppen), Strom 0 / Strom 10 000 000:

| k | vorher `orte3` | `domination5` ohne HP-Abfall | **jetzt `domination5` + sinkende HP** | Gruppen < 0,80 (jetzt) |
|---|---|---|---|---|
| 2 | 0,895 / 0,888 | 0,850 / 0,856 | **0,819 / 0,851** | 11 · 3 von 30 |
| 3 | 0,900 / 0,885 | 0,868 / 0,883 | **0,865 / 0,885** | 2 · 1 |
| 4 | 0,879 / 0,866 | 0,914 / 0,907 | **0,901 / 0,895** | 0 · 0 |
| 5 | 0,921 / 0,920 | 0,933 / 0,923 | **0,929 / 0,920** | 0 · 0 |
| 6 | 0,915 / 0,913 | 0,936 / 0,935 | **0,939 / 0,929** | 0 · 0 |

Pp-Abweichung (Budget-Methode, 48 Läufe), Strom 0 / Strom 10 000 000:

| k | vorher `orte3` | **jetzt** |
|---|---|---|
| 2 | 10,1 / 11,9 | **10,2 / 13,4** |
| 3 | 7,4 / 7,3 | **6,1 / 6,6** |
| 4 | 6,6 / 10,1 | **6,8 / 11,0** |
| 5 | 5,4 / 6,5 | **8,1 / 10,5** |
| 6 | 4,8 / 4,6 | **8,2 / 7,9** |

- **rho:** Mindestschranke 0,75 und Ziel > 0,80 erfüllt bei jedem k und beiden Strömen; schwächster Wert 0,819 (k = 2, Strom 0), bei
  k ≥ 4 über 0,89. Das Ziel 0,85 erreichen k ≥ 3 und k = 2 im zweiten Strom; k = 2 Strom 0 (0,819) bleibt unter 0,85 und ist das, was
  die kleinste Kadergröße ohnehin immer war (die Gruppenmittel streuen dort 0,70–0,96). Saison-rho 0,949–0,985, Paare ab 15 Punkten
  Abstand zu 99 % richtig, kein Pod endet „allein“ (100 % Punktelimit oder Zeit).
- **Pp:** alle ≤ 13,4, also unter dem Optimum < 15 (Schranke 25). Schwächstes Attribut-Delta: Charisma 17–20 und Intelligenz 16–18
  gegen ihr Matrixgewicht; die Matrix ist nicht angefasst.
- Der Abfall kostet gegenüber „ohne HP-Abfall“ ≤ 0,03 rho (k = 2), sonst ≤ 0,013 — Rauschen der 30 Gruppen.
- `data/generated/disziplin-abnahme.json` (Eintrag `battlefield`): Kopfwerte auf die neuen Zahlen (rho je Spiel 0,819, Pp 10,2 / 13,4),
  die alten stehen in `formatOrte3Alt`.
- Duell (`miss-alle-disziplinen.mjs --node 24 battlefield`): rho 0,589 wie am 15.11. — nicht gewertet, unverändert.

## 5. Wertungs-Fingerabdruck (absichtlich neu)

`env -u NODE_OPTIONS node scripts/pruefe-wertung-fingerabdruck.mjs --node`

- **GESAMT `eaafed96150e` → `5b9acba4fe42` (75 Einträge).** Bewegt sich NUR die Zeile `spieleBattlefieldPod`
  (`4424ef90cb0c` → `2271b1fad9a4`). Alle Duell-Zeilen (`spiele battlefield 1|7|42`, `disziplinProbe battlefield`, `spieleArenaDomination`)
  und alle anderen Disziplinen sind byte-gleich.
- Neu **außerhalb von GESAMT**: `BATTLEFIELD-ORTE3 6413fbdc4641`, drei Zeilen `spieleBattlefieldPod/orte3 <saat>`
  (`4424ef90cb0c` / `df13d3ff7cb0` / `b01640494054`); die erste trifft den alten Wert, der Rückweg ist damit bitgenau geschützt.
- Eingetragen in `CLAUDE.md` (Abschnitt Fingerabdruck) und im Kopf von `scripts/pruefe-wertung-fingerabdruck.mjs`.

## 6. Tests

- `tests/battlefield-format.test.ts` (neu): Schalter, Stempel beim Laden, gebuchte Spieltage behalten `orte3`, Abschalt-Schalter,
  Saisonwechsel, keine Stapelung, Manager-Spielstände ohne Stempel, Format-Option ausdrücklich, Referenz je Format.
- `tests/battlefield-domination5.test.ts`: Vorgabe `domination5`, `orte3` ohne `podFormat`, Echtzeit immer `orte3`,
  gezeigt = gebucht (Replay endet im gebuchten Endstand), **sinkende HP** (Ereignisse 0,75 / 0,5, nie darunter, Konstanten änderbar).
- `tests/battlefield-pod-ffa.test.ts` fährt die Seite jetzt explizit im Format `orte3` (schützt den Rückweg).

## 7. Werkzeuge

| Skript | Zweck |
|---|---|
| `scripts/miss-battlefield-pod-ffa-abnahme.mjs … --format=… [--d5='{"respawnHpSchritt":0.2}']` | rho/Pp, neu mit Konstanten-Überschreibung |
| `scripts/ziehe-battlefield-pod-referenz.mjs [--format=orte3\|domination5]` | Referenz je Format |
| `scripts/screenshot-battlefield-pod.mjs <format> <png> [--vorspulen=s] [--viewport=BxH] [--duell] [--ganze-seite]` | Abgleich-Aufnahmen |

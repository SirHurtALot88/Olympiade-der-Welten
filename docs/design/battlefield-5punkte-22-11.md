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

## 8. Review-Funde und Behebung (Opus-Review 22.11.)

**1. E1-Anker je Format (Muss).** `ergebnis-skala-kalibrierung.json` → `battlefield.pod` war am 18.11. im Format `orte3` gemessen; die
Spannen Platz 1–4 sind im Fünf-Punkte-Format deutlich größer (Median k=4: 104 → 158), fast jeder neue Pod wäre ein 10:0 gewesen und hätte
`verhaeltnis` und den Tabellen-Tiebreaker verzerrt. Jetzt: `battlefield.pod` = Fünf-Punkte (neu gemessen), `battlefield.podOrte3` = die
unveränderten alten Knoten. `berechnePodErgebnisE1({ podVariante })` / `ergebnisSkalaAnker(…, podVariante)` wählen nach dem Format DES
Spieltags (`battlefieldFormatFuer(gameState, matchdayId)` in `legacy-matchday-resolve-engine.ts`), gebuchte `orte3`-Spieltage rechnen also wie
vorher. Messung: drei frische Battle-Saves (32 KI-Teams, je 20 Spieltage, `OLY_PP_SKALA=roh`, `miss-pp-skala.ts`, Node-Motor), 48 Pods
(k=2: 8, k=3: 16, k=4: 16, k=6: 8; k=5 kam nicht vor und fällt auf den Disziplin-weiten Anker), Befehl
`npx tsx scripts/werte-ergebnisskala-aus.ts --nur-battlefield-pod <abzug.json> …` (mischt nur Battlefield in die Datei; `--format=orte3` für das
alte Format). Median der Spanne Platz 1–4 (alt → neu): k=2 152 → 114, k=3 128 → 132, k=4 92 → 150, Disziplin-weit 96 → 145; oberster Knoten
(2,5 %) k=4 149 → 163. Das Skript reicht das Format jetzt an `resolveBattlefieldPodMargeReferenz` durch (Nebenbefund).

**2. C2-PP-Anker (Sollte).** Gemessen an denselben drei Saves (12 Zellen; vorher 20): Tagesbester Median 5,23 → 5,54 (bleibt bei 5 PP),
Median-Einsatz 1,00 → 1,25 (mit den alten Ankern wäre er auf rund 1,5 PP gestiegen, bei k=2 noch mehr). Deshalb Anker je Format:
`pp-skala-kalibrierung.json` → `battlefield` (Fünf-Punkte) und `battlefieldOrte3` (alt, unverändert); `ppSkalaAnker(…, "orte3")`,
`skaliereUngedeckelt`/`ppAusKurveSkaliert({ variante })`, in `battlefield-pod-matchday.ts` nach dem Format des Spieltags. Je Feldgröße
(rTop/rMed): k=2 4,71/1,46 (2 Zellen), k=3 5,87/1,22, k=4 4,69/1,19, k=6 5,51/1,51. Befehl
`node scripts/werte-pp-skala-aus.mjs --nur-battlefield <abzug.json> …`. Die E1-Leistungsanker (lP5/50/95) sind danach mit den neuen PP-Ankern
neu gezogen. Der Ledger rechnet Pod-Zeilen nicht neu (sie sind persistiert), dort ändert sich nichts. Stichprobe klein (12 Zellen, je k 2–4):
beim nächsten Nachkalibrieren mit mehr Saves erweitern.

**3. Stempel-Rückfall (Sollte).** Der Rückfall „gebuchte Spieltage ohne Stempel = altes Format“ der Lade-Migration traf auch einen Spielstand,
der in derselben Prozesslaufzeit ohne Neuladen schon Spieltage im neuen Format gebucht hatte. Jetzt schreibt der Buchungsweg
(`legacy-matchday-result-apply-service.ts`) beide Stempel (Battlefield, Climbing) VOR dem Ergebnis fest (`stempleBattlefieldFormat` /
`stempleClimbingFormat`, rein, idempotent); eine neue Saison ohne gewertete Spieltage bekommt das Format des Schalters. Gebuchte
Spieltage bleiben unangetastet. Tests „mehrere Spieltage ohne Neuladen“ in `battlefield-format.test.ts` und `climbing-format.test.ts`.

**4. Kopierreste:** Kommentar „DAS CLIMBING-FORMAT EINES SPIELTAGS“ und `describe("Climbing-Format: …")` in den Battlefield-Dateien korrigiert.

**5. Aufnahmen aus der echten App** (`scripts/screenshot-battlefield-app.ts`, Dev-Server gegen Kopie des live-save-Abbilds, Reiter Arena
des Battle-Arena-Hosts, Vorschau des nächsten Battlefield-Spieltags, 3:26 Kampfzeit): `app-pod-1920x1080.png`, `app-pod-2560x1440.png`
(+ `-ganz`). Befund: bei 2560×1440 füllt die Bühne die ganze Breite; bei 1920×1080 begrenzt die Höhe die 16:9-Bühne (1688 von 1920 px, je
rund 116 px Rand), das ist das Verhalten des Hosts für alle Disziplinen, nicht Battlefield-spezifisch. Die HP-Stufe („50 %“) wird jetzt nach
den Namen gesetzt, wählt rechts/links des Balkens bzw. darüber die erste Lage ohne Überdeckung eines Namens oder einer anderen Zahl und entfällt
sonst (das schraffierte Balkenstück zeigt die Stufe weiter); in den neuen Aufnahmen überdeckt sie keinen Namen. Reine Zeichnung.

**6. Echtzeit-Pod:** `echtzeit` + ausdrücklich `format:"domination5"` wird wieder abgelehnt (Fehler statt stillem `orte3`); `echtzeit` ohne
Format läuft als `orte3` und meldet `podFormat:"orte3"` in der Ergebniszeile. Test in `battlefield-domination5.test.ts`.

**Fingerabdruck:** unverändert **GESAMT `5b9acba4fe42`** (und `BATTLEFIELD-ORTE3 6413fbdc4641`, `CLIMBING-STANDARD 164b3d846334`,
`TDM-GEFECHT 4f5a6af94a46`): E1/PP-Anker sitzen in TypeScript hinter dem Motor, die HP-Zahl ist Zeichnung, die Echtzeit-Änderung betrifft
keine gebuchte Zeile.

# Spacing-Modul: Positionstreue für die Ballsportarten (17.11.)

**Auslöser.** Chris am 17.11., wörtlich: „spieler brauchen mehr positionstreue und nicht alle nur dem
puck/ball hinterher, niemand steht mal separat und ist frei für einen pass etc — da brauchen wir nen
generellen fix“. Zum Basketball: „alle laufen immer nur als klumpen gefühlt rum“.

**Ort.** `public/mockups/battle-mode.engine.js`, Abschnitt `SPACING-MODUL` direkt unter `korbXVon`.
Parameter stehen je Disziplin in `FELDSPIEL_ART[d].feld` und `FELDSPIEL_ART[d].spacing`. Bisher trägt
nur Basketball beide Blöcke. Ohne Block liefert jede Funktion das alte Verhalten, Zeichen für Zeichen.
Hockey und Football sind dadurch anschließbar, ohne dass sie heute umgebaut sind. Im Node-Motor
nachgeprüft: von den 60 Einträgen `spiele(d, 1|7|42)` aller 20 Disziplinen ändern sich nur die drei Basketball-Einträge.

## 1. Diagnose: warum es Klumpen gab

Gemessen mit der neuen Sonde `window.__arena.diagSpacing` (Werkzeug `scripts/miss-spacing.mjs`) auf
main, Basketball, 6 Spiele zu 120 s, laufende Phase:

| Größe | main |
|---|---:|
| mittlerer Abstand zwischen Mitspielern | 112 px |
| Abstand zum nächsten Mitspieler | 58 px |
| Ticks mit ≥3 Spielern in einem 45-px-Kreis | **92,9 %** |
| Ticks mit ≥3 **Mitspielern** in einem 45-px-Kreis | **49,1 %** |
| Spieler im Umkreis 80 px um den Ballführer | 4,7 |
| Ballführer hat mindestens eine freie Anspielstation | **27 %** |

Drei Ursachen, alle im Code nachgewiesen:

1. **Das Feld war zu klein für das Spiel.** Die Logik rechnet seit jeher mit `DREIER_RADIUS` 112,8 px,
   die Slots liegen bis 150 px vom Korb. Gezeichnet war aber ein 1091 px langes Feld. Gemessen am Feld
   lag die gesamte Angriffsformation in einem Halbkreis von 4 m um den Ring, und der Dreierbogen lag
   *innerhalb* der Zone (Bogen bis x≈207, Freiwurflinie x≈294). Zwölf Spieler in diesem Halbkreis
   ergeben den Klumpen, egal wie gut die Slots verteilt sind.
2. **Jeder jagte den freien Ball.** `LAUF_ZUM_BALL_RADIUS` 260 px: nach jedem Fehlwurf lief praktisch
   die ganze Mannschaft zum Abpraller.
3. **Kein Mindestabstand unter Mitspielern.** Die Separation (`SEP_RADIUS` 60) wirkt gegen alle, nimmt
   den eigenen Gegenspieler aber aus. Zwei Angreifer samt ihren Verteidigern konnten auf zwei
   benachbarten Slots einen Vierer-Knoten bilden.

## 2. Die vier Bausteine

| Baustein | Funktion | Parameter (Basketball) | Wirkung |
|---|---|---|---|
| **Feld-Metrik** | `feldLogikDist`, `feldVersatz`, `feldLogikDy` | `feld.skala {x:2.3321, y:1.3963}`, `feld.eckeDreierY 110.3`, `feld.tempo 1.0` | Die Logik rechnet weiter in „Logik-px“ (alle Radien, Slots, Wunschdistanzen unverändert). Die Skala legt sie auf das echte FIBA-Feld: 112,8 Logik-px = 6,75 m = 263 px längs / 157,5 px quer. Ein Logik-px entspricht 1/16,7 m in beide Richtungen. |
| **Jäger** | `spacingJaeger(ball)` | `jaegerJeSeite 2`, `jaegerRadius 200` | Einem freien Ball laufen je Team nur die zwei Nächsten nach. Alle anderen bleiben in ihrer Rolle: Angreifer in ihrem Slot, Verteidiger an ihrem Mann. |
| **Mitspieler-Abstand** | `spacingMitspielerZiel(u,zx,zy)` | `mitspielerMin 58` (≈3,5 m), `mitspielerStaerke 0.8` | Das Laufziel eines Angreifers ohne Ball wird aus dem Mindestkreis jedes Mitspielers herausgeschoben. Dadurch entstehen Anspielstationen. |
| **Rücklauf** | `spacingRuecklauf(zx)` | `ruecklauf 0.35` | Wer beim Fehlwurf nicht jagt, sichert ein Stück Richtung Mittellinie ab (Transition-Defense). |

Heimatpositionen und Rollen je Slot liefern weiter die vorhandenen Tabellen (`SLOTS`, `SLOTS_HOCKEY`,
`SLOTS_FOOTBALL`, Vergabe in `zuordneSlots`). Das Modul legt sie nur in den echten Feldmaßstab.

**Was bewusst in Bildschirm-px bleibt:** alles, was einen *Körper* misst und keinen Feldabstand:
`BEDRAENGT_RADIUS`, `STEAL_REICHWEITE`, `GREIF_REICHWEITE`, Passlinien-Radius, Offenheit (Decker/60),
der Verteidiger-Versatz `sag`. Der Zug des Verteidigers zum Korb richtet sich nach der Logik-
Entfernung, der Versatz selbst bleibt ein Körperabstand.

**Nur einen Verteidiger zum Ball:** Das galt schon vorher, und das Modul ändert daran nichts. Der Ball
wird vom eigenen Decker gepresst, dazu kommt höchstens ein Helfer (`HILFE_RADIUS`, seit dem Modul in
Logik-Abstand gemessen).

## 3. Ergebnis Basketball (gleiche Sonde)

| Größe | main | neu |
|---|---:|---:|
| mittlerer Abstand Mitspieler | 112 px | **185 px** |
| Abstand nächster Mitspieler | 58 px | **92 px** |
| ≥3 Spieler im 45-px-Kreis | 92,9 % | **61 %** |
| ≥3 Mitspieler im 45-px-Kreis | 49,1 % | **9,4 %** |
| Spieler um den Ballführer (80 px) | 4,7 | **2,4** |
| Ballführer hat freie Anspielstation | 27 % | **50 %** |
| freie Anspielstationen im Mittel | 0,42 | **0,93** |
| Streuung der Angreifer quer (Feldbreite) | 59 px | **79 px** |

Die 61 % bei „≥3 Spieler beliebiger Teams“ sind kein Fehler: Jeder Angreifer hat seinen Verteidiger
dicht bei sich (Manndeckung). Ein Paar plus irgendein Dritter in 45 px reicht schon. Die Mitspieler-
Zahl (9 %) ist die Größe, die den Klumpen trifft.

## 4. Anschluss für Hockey, Football, TDM

1. In `FELDSPIEL_ART.hockey` einen `spacing`-Block eintragen, etwa `{jaegerJeSeite:2, jaegerRadius:…,
   mitspielerMin:…, mitspielerStaerke:…, ruecklauf:0}`. Hockey hat mit `naechsteZumFreienPuck` schon
   seine eigene Jäger-Regel. Die Abfrage `JAEGER` ist dort bewusst ausgeschaltet (`!istHockey()`). Wer
   umstellt, nimmt die Hockey-Regel heraus und misst neu.
2. Einen `feld`-Block nur eintragen, wenn das Feld massstabsgetreu gezeichnet ist. Die Skala ist das
   Verhältnis zwischen gezeichneter Linie und Logik-Radius.
3. Football löst seine Züge über `fkZugPosition` auf (Standphasen). Die Sonde `diagSpacing` misst dort
   nichts, weil es keine `laufend`-Phase gibt (0 Ticks). Für Football bräuchte die Sonde eine eigene
   Phase.
4. TDM: dasselbe Muster mit dem nächsten Gegner oder Ziel als Attraktor statt des Balls.
5. Abnahme wie hier: `node scripts/miss-spacing.mjs <d>` vorher und nachher, dazu
   `miss-alle-disziplinen.mjs` (rho) und `messe-arena-einfluss.mjs` (Pp).

## 5. Werkzeuge

- `node scripts/miss-spacing.mjs [disziplin] [spiele] [sekunden] [radius]`, mit
  `OLY_ENGINE_DATEI=<kopie>` für Vorher/Nachher gegen eine eingefrorene Engine-Kopie.
- `window.__arena.diagSpacing(saaten, bis, dId, r)`: read-only, wie `diagAbstaende`.

## 6. Runde 2 (17.11. abends): Laufwege, Feld-Grenze, Kamera — dieselbe Anschlusslogik

Drei weitere Bausteine nach demselben Muster (Parameterblock in `FELDSPIEL_ART[d]`, ohne Block altes
Verhalten zeichengleich). Erste Anwendung wieder Basketball, Messungen in
`docs/design/benchmark-basketball-17-11.md` Abschnitt 7.

| Baustein | Block | Was eine andere Disziplin zum Anschalten braucht |
|---|---|---|
| **FELD-GRENZE** `feldGrenze(zx,zy)` | `feld.grenze {laengs:[a,b], querHalb, rand}` | die gezeichneten Grundlinien (Anteil von W) und die halbe Feldbreite in px. Hockey: Bande statt Linie (`RINK()`), Football: Seitenlinien. Abnahme: `diagSpielzuege(n).seitenlinie.ausserhalb` = 0. |
| **LAUFWEG-MODUL** `lwBallfuehrer`, `lwAngreifer`, `lwVerteidiger`, `lwCrash`, `lwFastbreakLane` | `laufwege {postBlock, postUp, backdoor, deny, pickRoll, ausboxen, crash, fastbreak, rotation, tempo, passArt, wurfAbsicht}` | Jeder Unterblock einzeln: fehlt er (`null`), ist der Baustein aus. Hockey: `deny`+`backdoor` (Pass in den Rücken des Verteidigers), `crash` (Netfront), `fastbreak` (Odd-Man-Rush), `tempo`. Fußball-artige: `deny`, `rotation`, `fastbreak`. Post-up/Pick sind basketballnah, bleiben dort aus. |
| **KAMERA-MODUL** `feldKameraAnwenden` | `kamera {zoom, korbZug, querZug, daempfung, zoomDaempfung, nahZoom, nahDauer, nahVersatz}` | nichts außer dem Block — liest Ball, Ballbesitz und den laufenden Wurf; `korbXVon` liefert das angegriffene Ziel (Tor/Endzone). |
| **TEAMFOUL-/BONUS-MODUL** | `fouls {bonusAb, reachIn, einwurfRest}` | basketballspezifisch; Hockey hat Strafzeiten. |
| **EFFEKT-/TON-MODUL** | — (basketballeigen) | Muster (Ereignis-Warteschlange mit Deckel, Ton erst nach Geste) übertragbar. |

Zustand aller Module liegt in WeakMaps bzw. modulweiten Variablen, nie an den Spielerobjekten
(Fingerabdruck). Abnahme beim Anschalten wie in Abschnitt 4: `miss-alle-disziplinen.mjs`,
`messe-arena-einfluss.mjs`, `miss-spacing.mjs`, dazu `diagSpielzuege` für die Häufigkeit der Aktionen.

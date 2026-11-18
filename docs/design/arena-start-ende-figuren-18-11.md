# Arena: Start, Ende, Figuren, Wartezeit (18.11.)

Chris' Befunde aus dem Live-Spiel, Spieltag 1 (D1 Climbing, Nunchuck Ninjas gegen Natures Wrath; D2 Battlefield als
Vierergruppe). Branch `claude/arena-start-ende-figuren-18-11`. Die Commits sind getrennt: zuerst die drei Anzeige-Commits
(Fingerabdruck unveraendert `ce8fcef66028`), danach die absichtliche Wertungsaenderung (`d3a39030a3ef`).

## 1. Endstand vor dem Start (Anzeige)

**Befund:** vor dem Anpfiff stand oben „7 · 3 … Punkte nach Rang (von 10) · vorläufig“ und unten in der Kaderleiste „7:3“.

**Ursache:** `bahnRangliste()` vergibt Rangpunkte N..1 nach der Sortierung. Vor dem ersten Tick hat niemand einen Meter
gezeigt, alle stehen gleich, die Sortierung ist nur die stabile Laeuferreihenfolge (Heim zuerst) -- die Rangpunkte
darauf sahen aus wie ein Ergebnis. Nachgestellt mit 2 gegen 2 (genau Chris' „(von 10)“): Climbing und Spurt zeigten vor
dem Start `[7,3]`, Time-Trial/Takeshi/Staffel `[0,0]`. Feldspiel (Tore), Buehne (lampengesteuerte Summen) und Kampf
(Ausschaltungen/Lebende) starten ohnehin bei ihrem Nullstand.

**Fix:** vor dem Start (`!done && !(rennT>0)`) bekommt jeder 0 Punkte; Kopfzeile, Kaderleiste (`#kmitte`) und Kacheln
lesen dieselbe Funktion. Suffix „vor dem Start“ statt „vorläufig“. Ab dem ersten Sim-Tick gilt die alte Zeile; am
Rennende (wert()/Sonde/Endstand) bit-identisch. Test: `tests/arena-start-ende-anzeige.test.ts`.

## 2. Ende erst, wenn alle im Ziel sind (Wertung)

**Befund:** Climbing endete am Lead-Zeitlimit (`BAHN_ART.climbing.zeitlimit`, 10,6 Sim-s); im Beispiel stand Nukka ohne
Zeit („—“, Platz 4, 1 Punkt).

**Messung vorher** (Node-Sonde, 5 Kader der Kaderfamilie x 6 Saaten, je 12 Kletterer): **64 % der Kletterer ohne Zeit**,
jedes Rennen hatte Offene. Alle anderen Bahnen (Spurt, Time-Trial, Takeshi, Staffel): 0 % ohne Zeit -- dort war nichts
zu tun. Ohne Limit kommen in Climbing alle an: letzter Zieleinlauf Median 18 Sim-s, Maximum 49 Sim-s (60 Rennen).

**Fix:** Zeitlimit entfernt. Jede Bahn endet beim letzten Zieleinlauf; Sicherheitsdeckel `BAHN_DECKEL_SEK = 60` (der
alte Deckel). Wer dort noch unterwegs ist, bekommt eine aus seinem Fortschritt hochgerechnete Zielzeit (bei Climbing auf
der Hoechstmarke `u.hoch`); gemessen erreicht kein Rennen den Deckel. Die Zeitlimit-Box an der Wand zeigt jetzt
„OBEN n / N“.

| Groesse (Climbing) | vorher | nachher |
|---|---:|---:|
| Kletterer ohne Zeit am Ende | 64 % | 0 % |
| rho je Spiel (Median, n=48, 5 Kader) | 0,801 (Spannweite 0,209) | **0,816** (0,174) |
| rho Saison | 0,881 | 0,881 |
| Pp-Abweichung (Saatstaemme 0 / 10000000, n=48) | 12,0 / 9,5 | 12,7 / 9,6 |
| Fingerabdruck GESAMT | `ce8fcef66028` | `d3a39030a3ef` (nur `spiele climbing 1/7/42`) |

Beide Schranken halten (rho >= 0,75, Ziel > 0,80; Pp <= 25, unter 15). Gemessen ueber den Node-Motor mit demselben
Messcode (`disziplinMessen`, `einflussVon`); die Kontrolle am Vorstand traf die eingetragenen Werte 0,801/0,881 und
12,0/9,5 exakt, und der Node-Fingerabdruck trifft `ce8fcef66028` des Chromium-Skripts.

**Sendedauer** (Zuschauzeit bei Tempo 1x, Zeitfaktor 4,38; 120 Rennen mit 2 und 6 je Seite): vorher immer 46 s (Ende am
Limit). Ohne weitere Massnahme waeren es Median 70 s, bis 180 s. Deshalb **„Rest im Zeitraffer“**: sobald der erste oben
ist und man vier echte Sekunden seinen Moment gesehen hat, laeuft der Rest dreifach schnell (nur Wiedergabe, mehr
1/60-Ticks je Bild wie die Tempo-Taste; Einblendung „REST IM ZEITRAFFER · 3×“). Ergebnis: **Median 50 s, Maximum 85 s.**

**Rechenzeit:** ein Climbing-Rennen im Node-Motor (voller Kader) 41 -> 60 ms im Mittel (80 Rennen). Fuer einen Spieltag
mit 16 Paarungen sind das rund +0,3 s reine Motorzeit im Vorlauf.

## 3. Platzhalter-Figuren (Anzeige)

**Befund:** Crimson Shadow, Fungor und Nukka kletterten als dieselbe glatzkoepfige Figur (nur Abyssalfin echt), auch in
der Spielerleiste. Ebenso in Battlefield.

**Ursache:** kein Lade-, Pfad- oder Posenfehler. Diese Spieler **haben keinen PixelLab-Satz**: der Figuren-Index
(`data/generated/figuren-sprites.json` -> `battle-mode.figuren.js`) fuehrt 361 von 2984 Spielern. In der Kaderfamilie aus
dem Live-Abbild haben 49 von 119 Spielern eine Figur. Wer keine hat, faellt auf `BAU_STD`; seit die alten
LPC-Baukasten-Eintraege am 30.10. abgeschaltet wurden, sieht jeder davon gleich aus. Eine fehlende Kletter-/Nord-Pose
spielt keine Rolle (fehlt sie, nimmt der Motor die Ost-Naeherung derselben Figur).

**Fix mit vorhandenem Material** (keine Bestellung): ueber dem Kopf jedes Spielers ohne eigene Figur steht sein Portraet als
runde Marke (dasselbe Bild wie in Kaderleiste und Spielerkamera), die Kaderleiste zeigt fuer ihn nur noch das Portraet statt
eines zweiten Platzhalters. Nur ueber HTTP aktiv; Messlaeufe unter file:// unveraendert.

**Vorschlag an Chris (nicht bestellt):** echte Figuren nur fuer die tatsaechlich gepickten Spieler erzeugen (Chris' eigene
Idee vom 17.11.), z. B. je Spieltag die Kader der beteiligten Teams. Umfang je nach Liga: in der Kaderfamilie fehlen
70 von 119 Spielern eine Figur; je Figur Grundposen plus die vier Basisanimationen (walk/angriff/treffer/tod). Neue
Charaktere bleiben ohne Einzelfreigabe gesperrt.

## 4. Wartezeit nach „Einsatzliste abgeben“ (Anzeige/Ladeweg)

**Wohin die Zeit geht:** nach dem Abgeben stoesst der Server den Arena-Vorlauf an (alle Paarungen des Spieltags im Motor);
die Buehne zeigt bis dahin „Die Arena-Duelle werden im Hintergrund berechnet“ und pollte alle 4 s. Erst wenn der Vorlauf
fertig ist, haengt sie die Arena ein und beginnt dann, Huelle, CSS und Motor (~5 MB `battle-mode.engine.js`) zu laden.

Gemessen mit `scripts/messe-arena-vorlauf-wartezeit.ts` (Wegwerf-Store, Battle-Mode-Neuanlage, KI-Aufstellungen, Node-Weg):
Spieltag 1 (Tennis + Battlefield) **9,6 s Vorlauf**, davon Motor 1,8 s (Tennis) + 0,6 s (Battlefield) und ~7 s
Schnappschuss/Vorschau/Schreiben. Motor direkt fuer Climbing-Spieltage: 2,1 s bzw. 6,7 s (zwei verschiedene Neuanlagen,
nicht vergleichbar; je Rennen s. oben). Der Server-Weg nach dem Abgeben laeuft ueber Headless-Chromium (der
Node-Weg nur ueber den Quick-Sim); gemessen ist hier nur der Node-Weg, Chromium braucht zusaetzlich Browserstart und Laden
des Motors je Disziplin.

**Billige Beschleunigung (gebaut):**
- **Fortschritt sofort:** der Vorlauf merkt sich im Prozess, welche Disziplinen geplant/fertig sind
  (`leseArenaVorlaufFortschritt`); die Buehne zeigt „Arena wird vorbereitet … Climbing 1/2 (8 s)“.
- **Schneller merken:** die ersten 20 Status-Abfragen im Sekundentakt statt alle 4 s -- die Arena erscheint im Mittel
  ~1,5 s frueher nach Ende des Vorlaufs (vorher im Mittel 2 s Pollverzug, jetzt 0,5 s).
- **Vorladen waehrend des Wartens:** Host-Chunk und per `rel=prefetch` Huelle, CSS und Motor-Skripte; die ~5 MB
  Uebertragung liegt damit in der Wartezeit statt dahinter.

**Nicht gebaut (groesserer Hebel, eigene Entscheidung):** den Vorlauf nach dem Abgeben standardmaessig ueber den Node-Weg
statt Chromium rechnen (wie der Quick-Sim, mit Chromium als Rueckfall).

## 5. Battlefield: falsches Spiel in der Vorstellung (Anzeige)

**Befund:** beim Wechsel auf D2 zeigte die Vorstellung „Mayhem Mavericks vs Project Suicide“ samt Aufstellungen, obwohl
Chris Nunchuck Ninjas steuert (Kopf: „Nunchuck Ninjas vs Natures Wrath · 0·0·0·0“).

**Ursache:** die Vorstellung (`renderEinlauf`) hat zwei Plaetze und las immer Seite 0 und 1 -- im Vier-Team-Pod die ersten
beiden Teams der Gruppe in Buchungsreihenfolge, nicht das gesteuerte Team.

**Fix:** der Host reicht je Pod `eigeneSeite` (Index des gesteuerten Teams) und `gegnerSeite` (sein Spieltagsgegner) mit,
`einlaufSeiten()` im Motor zeigt diese beiden. Gruppenreihenfolge, Saat und Aufstellung bleiben die der Buchung. Gilt
auch fuer die Bahn-Pods (Takeshi, Staffel). Test: `tests/arena-start-ende-anzeige.test.ts`.

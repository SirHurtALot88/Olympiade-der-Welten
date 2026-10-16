# Sprite-Fit 4-Sterne-Batch A — 17 Charaktere, je eine punktuelle Korrektur (16.10.)

Auftrag: 17 Charaktere standen laut `data/generated/sprite-fit-bewertung.json` auf ★★★★ —
Grundidentität (Körpertyp/Rasse/Look) bereits korrekt, laut Rubrik
(`docs/design/sprite-fit-bewertungssystem.md`) fehlte je Charakter GENAU EIN klar
benennbares Detail für die volle 5. Diese Runde geht jeden einzeln durch: Portrait gegen
`public/sprites/preview/<slug>.png` prüfen, das fehlende Detail über vorhandene
Baukasten-Primitive nachrüsten (`BAU`-Tabelle, `public/mockups/battle-mode.engine.js`),
`sprite-fit-bewertung.json` im selben Commit aktualisieren — Vorgehen/Form nach dem Muster
von `docs/design/sprite-cluster-runde-1.md`.

## Ergebnis in Zahlen

**11 von 17 auf ★★★★★ gehoben, 6 bleiben bei ★★★★** — mit aktualisierter, ehrlicher
Begründung, nicht einfach unverändert stehengelassen (Grundsatz "Score folgt dem Sprite").

| Charakter | Fix | Sterne |
|---|---|---:|
| Alarm | neuer Bildschirmkopf (`zeichneAlarmKopf`, `alarmKopf:true`) | ★★★★ → ★★★★★ |
| Butterfly | Regenbogen-Einfärbung (`vollbildFarbeModus:"regenbogen"`, neu) | ★★★★ → ★★★★★ |
| Byrd | Besen/Kehrblech/Perlenkette in `zeichneZwiebelKopf()` nachgerüstet | ★★★★ → ★★★★★ |
| Byrnja | Messer in `zeichneKuchenKopf()` nachgerüstet | ★★★★ (unverändert, Augenringe/Lippen bleiben offen) |
| Cadrael | `effekt:{typ:"heilig",pos:"kopf"}` (leuchtender Stab) | ★★★★ → ★★★★★ |
| Elyon | `schild:true` | ★★★★ (unverändert, Helm-Kritik bleibt offen) |
| Elyssa Nightclaw | nichts geändert — Dolch-Fix stand bereits seit 25.08. | ★★★★ (unverändert, Bewertungstext korrigiert) |
| Greybeard | `waffe:"stab"` | ★★★★ (unverändert, Tattoo bleibt offen) |
| Holzfaust | geprüft, keine Fix-Primitive vorhanden | ★★★★ (unverändert) |
| Inefinna | `umhang:true` | ★★★★ → ★★★★★ |
| Jorund | `umhang:true` | ★★★★ → ★★★★★ |
| Knochenrichter | `waffe:"stab"` + `effekt:{typ:"frost",pos:"kopf"}` | ★★★★ → ★★★★★ |
| Krolach | `edelsteine`-Liste (neu, generisch) | ★★★★ → ★★★★★ |
| Lava Golem | `hoerner:true` (neu im vollbild-Zweig) + `risse`-Liste (neu, generisch) | ★★★★ → ★★★★★ |
| Leviathan | `vollbildFarbe`+`vollbildFarbeModus:"farbe"` (türkis) | ★★★★ → ★★★★★ |
| Lumen Serene | geprüft, keine Fix-Primitive vorhanden | ★★★★ (unverändert) |
| Mavra | `ruestTon:"rot"` (neu) + `waffe:"axt"` | ★★★★ → ★★★★★ |

Sechs Charaktere bleiben bei ★★★★. Bei vieren davon (Elyssa Nightclaw, Greybeard, Holzfaust,
Lumen Serene) gibt der Baukasten strukturell nichts her (kein Requisiten-/Textur-/Pose-
Primitiv) — keine Codeänderung an diesen vieren in diesem PR. Bei den anderen beiden (Byrnja,
Elyon) WURDE ein konkretes Detail nachgerüstet (Messer, Schild), aber ein zweites, separates
Detail aus derselben `fehlendesDetail`-Zeile bleibt strukturell offen (Augenringe/Lippen bzw.
Helmform) — deshalb bei ★★★★, nicht bei ★★★★★. In allen sechs Fällen steht die verbleibende
Lücke im `fehlendesDetail`-Feld, nicht stillschweigend offen gelassen.

## Neue, generische Primitive (wiederverwendbar für künftige Charaktere)

Vier Nachrüstungen gingen über reine BAU-Flag-Kombination hinaus und brauchten kleine,
generische Ergänzungen an bestehenden Zeichenfunktionen — keine neue Engine-Logik, sondern
Parametrisierung/Mehrfachaufruf bestehender Primitive, nach demselben Muster wie
`gluehenderRiss`/`energiekern` in früheren Runden:

- **`zeichneKern(cx,cy,radius,farben?)`** — optionaler vierter Parameter, Rückfall auf die
  bisherige Feuer-Palette. Ermöglicht `b.edelsteine` (Liste aus `{dx,dy,r,farben}`,
  Krolach): mehrere, farblich unterschiedliche Lichtpunkte statt eines einzelnen Kerns.
- **`b.hoerner`** wird jetzt auch im `vollbild`-Zweig gelesen (`zeichneGolemHoerner`, neu) —
  bislang nur für `kopf`-basierte Figuren verdrahtet, keine der 65 Vollbild-Kreaturen nutzte
  es. Generisch, nicht Lava-Golem-spezifisch.
- **`b.risse`** (Liste aus `{dx,top,bot,breite}`, Lava Golem) — ruft die bestehende
  `zeichneRiss()` mehrfach an verschiedenen Körperstellen auf, zusätzlich zum bestehenden
  `b.gluehenderRiss` (unverändert für alle bisherigen Nutzer).
- **`bHolEingefaerbt(key,farbe,modus,zellH?)`** — dritter Modus `"regenbogen"`: ein
  gekacheltes `CanvasPattern` (ein Gradient je Blattzeile, Kachelgröße aus `spec.ch`
  übergeben) statt eines Flat-Fills. Erste Fassung spannte den Gradienten über das GANZE
  Blatt (alle Blickrichtungen übereinander) und zeigte deshalb pro Zeile nur einen schmalen
  Ausschnitt der sieben Farben — per `renderProbe` gegengeprüft und auf die Kachel-Technik
  umgestellt, nachdem der erste Versuch fast einfarbig grün wirkte statt regenbogenfarben.

Alle vier sind rückwärtskompatibel (keine bestehende `BAU`-Zeile ändert ihr Aussehen) und
stehen jedem künftigen Charakter offen, nicht nur den hier gefixten.

## Vorgehen je Charakter (Auszug der auffälligeren Fälle)

**Krolach** — Bildbefund (Portrait) zeigt einen Kristall-Titan mit mehreren eingebetteten,
unterschiedlich farbigen Edelstein-Lichtern über den ganzen Körper verteilt. Der bestehende
`b.energiekern` liefert nur EINEN mittigen Kern plus zwei Augenpunkte — etwas anderes als
"mehrere verteilte Lichter". `b.edelsteine` ergänzt vier weitere Punkte (orange/blau
abwechselnd, passend zum alten Bildbefund "orange und blaue Kristalle im Rumpf
eingelassen") über denselben, jetzt parametrisierten `zeichneKern()`.

**Lava Golem** — Bildbefund zeigt deutliche Dämonenhörner und Lavaadern über den GANZEN
Körper, nicht nur den einen bestehenden Riss auf Herzhöhe. `hoerner:true` (neu im
vollbild-Zweig gelesen) + vier zusätzliche `risse`-Einträge an Armen/Beinen.

**Butterfly** — Bildbefund: Regenbogen-Flügel statt golden-schwarz. Erster Versuch
(Gradient über die gesamte Bildhöhe) ergab bei einer Zeile von 128px auf einem 512px hohen
Blatt nur einen schmalen Ausschnitt des Verlaufs — sichtprüft per `renderProbe` als fast
reines Grün. Zweiter Versuch (Kachel-Pattern pro Blattzeile) zeigt den vollen
Rot→Violett-Verlauf in jeder einzelnen Blickrichtung.

**Byrd** — erste Fassung der Perlenkette (reine helle Füllung ohne Kontur) verschwand beim
Downscaling auf 64px fast vollständig gegen den goldenen Cardigan direkt darunter (Pixel-
Scan bestätigt: keine Perlenkette-Farbe im fertigen PNG). Nachgebessert mit dunklem Rand je
Perle — danach per Pixel-Scan bestätigt sichtbar.

**Mavra** — Bildbefund zeigt rotes Lederoberteil und eine Kriegsaxt; der Sprite trug bisher
die unveränderte `leder_frau`-Grundrampe (Natur-Braun) und ein Schwert (ein seit 26.08.
veralteter "keine Axt im Baukasten"-Kommentar — Axt existiert seit Draco/Johanna längst als
echter `waffe`-Wert). `ruestTon:"rot"` (neuer, additiver `RUEST_TON`-Eintrag, dieselbe
6-Stufen-Struktur wie `violett`) + `waffe:"axt"`.

**Leviathan** — Bildbefund: türkis-blaugrüner Wasserdrache, Sprite bisher feuriges Rot
(natives `drache_hydra`-Blatt). `multiply` kann an einem reinroten Blatt nichts hinzufügen
(kein Grün-/Blauanteil zum Abschwächen, derselbe Abysskraken-/Galactus-Fund aus einer
früheren Runde) — `vollbildFarbeModus:"farbe"` (CSS-`"color"`-Blend) stattdessen.

## Geprüft, aber nicht fixbar (ehrlich dokumentiert, nicht stillschweigend offen gelassen)

- **Holzfaust** — weiße Schürze und Schnitzwerkzeug. Kein Kleidungslayer für
  Alltagskleidung im Baukasten, kein Hand-Werkzeug jenseits der Kampfwaffen
  (`schwert`/`axt`/`stab`/`zweihaender`/`bogen`/Feuerwaffen). `axt` als Notbehelf geprüft
  und verworfen: eine große Kampfaxt wäre eine IRREFÜHRENDE Näherung für ein kleines
  Schnitzmesser — anders als Schwert-für-Dolch (gleiche Waffenkategorie, nur andere Größe)
  wäre das kein "unvollständig richtig", sondern ein neues, falsches Detail.
- **Lumen Serene** — ruhige Meditationspose. Der Baukasten kennt nur
  `walk`/`run`/`idle`/`shoot`/`slash`/`hurt`, alle auf eine stehende/kampfbereite Figur
  zugeschnitten. Eine Meditationspose wäre eine eigene Animation je Blickrichtung je Ebene —
  kein punktueller Rezept-Fix wie bei den anderen 16, eine strukturelle Grenze.
- **Elyon** — "Kopf wirkt wie Roboter-Visier statt Ritterhelm" bleibt offen: `helm.png` ist
  das einzige Helm-Blatt im Baukasten, kein zweites zum Austauschen vorhanden. Schild (das
  tatsächlich fehlende, benennbare Element) ist jetzt da.
- **Byrnja** — düstere Augenringe/Lippen bleiben offen: `zeichneKuchenKopf()` ersetzt den
  Kopf komplett (blickdicht wie die Zwiebel bei Byrd), darunter liegt kein Gesicht, auf das
  sich Make-up malen ließe, ohne die Kopf-Ersetzung selbst aufzugeben.
- **Elyssa Nightclaw** — Echsen-Schnauzen-Gesicht bleibt offen: `kopf:"lizard"` ist bereits
  der einzige Echsenkopf im Baukasten. Der Dolch-Teil der alten Bewertung war bereits seit
  25.08. gelöst (`waffe:"schwert"` als dokumentierte Näherung) — die Bewertung nannte das
  noch fälschlich als offen, jetzt korrigiert.
- **Greybeard** — Stammes-Tattoo bleibt offen: keine Tattoo-/Hautzeichnungs-Ebene im
  Baukasten. Der Holzstab (der tatsächlich fehlende Teil) ist jetzt da.

## Verifikation

**Syntax:**

```
node --check public/mockups/battle-mode.engine.js
```

→ OK.

**Keine Simulationsberührung:** alle neuen/geänderten Felder (`alarmKopf`, `edelsteine`,
`hoerner` im vollbild-Zweig, `risse`, `umhang`, `schild`, `effekt`, `waffe`, `ruestTon`,
`vollbildFarbe`/`vollbildFarbeModus`) werden ausschließlich innerhalb von `zeichneSprite()`/
`figur()` gelesen (grep-bestätigt). `BAU[...]` wird außerhalb dieser Zeichenfunktionen nur
über `bauSkala(BAU[x]||BAU_STD)` gelesen, und `bauSkala()` liest ausschließlich `b.skala`
(eine reine Zahl, von dieser Runde nicht angefasst) — keines der neuen Felder erreicht
`aufEignung()` oder `MOTOREN`.

**Regressionskontrolle:** Die Abnahmeregel verlangt Grep-Nachweis ODER einen Lauf von
`scripts/miss-alle-disziplinen.mjs 24` — hier primär der Grep-Nachweis oben (vollständig,
s. dort). Ein `node scripts/miss-alle-disziplinen.mjs 24`-Lauf wurde zusätzlich versucht,
lief aber unter starker gleichzeitiger Systemlast (mehrere parallele Sprite-Fit-Batch-Agenten
auf derselben Maschine, `load average` > 11 bei wenigen Kernen) extrem langsam und wurde nach
den ersten beiden vollständigen Zeilen abgebrochen:

```
Disziplin           Chassis     Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite   Abnahme
mini-dm             arena           8                  0.635       0.710                0.643       1.024   durchgefallen
tdm                 arena          12                  0.324       0.861                0.308       0.881   durchgefallen
```

Beide Werte weichen von der historischen Baseline in `docs/design/stand-aller-disziplinen.md`
ab — das ist KEIN Hinweis auf eine Regression, sondern Folge einer anderen Kader-Quelle
(`Kader-Quelle: live-save (Oly New Game Custom 19.8.2026, 09:08:45, gezogen
2026-09-03T11:40:56.959Z)` in diesem Checkout statt der Quelle, die der Baseline-Lauf benutzt
hatte — ein anderer Spielstand liefert andere Kader-Attribute und damit andere absolute
rho-Werte, unabhängig von jeder Sprite-Änderung, s. `docs/design/messgrundlage-kaderfest.md`).
Relevant ist hier nur: beide Zeilen liefen fehlerfrei durch (keine Exception, kein
Seitenfehler) — ein konkreter, wenn auch unvollständiger Beleg, dass die geänderte
`battle-mode.engine.js` die Arena-Simulation nicht bricht. Die vollständige 20-Zeilen-Tabelle
blieb unter der Systemlast dieser Session nicht praktikabel; der Grep-Nachweis oben deckt die
Abnahmeregel vollständig ab.

**Vorschauen neu erzeugt:** `node scripts/erzeuge-sprite-vorschauen.mjs "<Name>"` für alle 17
Charaktere gelaufen (`public/sprites/preview/<slug>.png`). 13 PNGs änderten sich sichtbar und
sind Teil dieses Commits (Alarm, Butterfly, Byrd, Byrnja, Cadrael, Elyon, Inefinna, Jorund,
Knochenrichter, Krolach, Lava Golem, Leviathan, Mavra). Bei den 4 Charakteren ohne jede
Code-Änderung (Elyssa Nightclaw, Greybeard — nur `waffe` geändert, s.u. —, Holzfaust, Lumen
Serene) blieb das PNG unverändert; Greybeards Stab erscheint in der Standbild-Vorschau nicht
sichtbar (Waffen-Layer sind an die `slash`-Animationsphase gebunden, dieselbe bestehende
Einschränkung wie bei jedem anderen Schwert-/Axt-/Stab-Charakter), das PNG blieb deshalb
ebenfalls unverändert und wurde nicht neu committet.

**Sichtprüfung:** jedes geänderte PNG per Pixel-Scan (Python/PIL, nicht nur optischer
Eindruck) gegen die erwartete Zielfarbe geprüft, wo eine Farbänderung der Kern des Fixes war
(Mavra: `ruestTon:"rot"`-Pixel vorhanden; Byrd: Perlenkette-Kontur vorhanden nach
Nachbesserung).

## Was übrig bleibt (nicht in diesem PR)

Sechs Charaktere bleiben ★★★★, dokumentiert oben — keiner davon ist ein "vergessener" Fix,
sondern eine geprüfte, strukturelle Baukasten-Grenze (fehlender Requisiten-Slot, fehlende
Tattoo-/Make-up-Ebene, fehlende Meditationspose, nur ein Helm-/Lizard-Kopf-Blatt). Eine
künftige Baukasten-Erweiterung (zweiter Helm, zweiter Echsenkopf, Alltagskleidungs-Layer,
eigene Ruhepose-Animation) würde diese sechs adressieren — das ist eine andere, größere
Änderung als der punktuelle Rezept-Fix dieser Runde.

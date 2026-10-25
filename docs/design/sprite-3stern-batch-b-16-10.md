# Sprite-Fit 3-Sterne-Batch B — 30 Charaktere (Gram–Pinkypie), 16.10.

Auftrag: 90 Charaktere standen laut `data/generated/sprite-fit-bewertung.json` auf ★★★ —
grobe Kategorie richtig, aber mehrere Baustellen oder eine zu grobe Näherung (Rubrik:
`docs/design/sprite-fit-bewertungssystem.md`). Aufgeteilt in drei parallele Batches zu je 30;
dies ist Batch B, die alphabetische Scheibe 31–60 (Gram bis Pinkypie). Sieben Namen aus
dieser Scheibe (Ironhoof, Kora, Medibull, Myrkos, Orichalcos, Othrama, Pinkypie) waren
bereits am selben Tag von früheren Runden (Minotauren/Zentauren-Cluster,
2-Sterne-Batch-B) als Verbesserung von ★★ auf ★★★ angefasst worden — hier als gewöhnliche
3-Sterne-Kandidaten erneut einzeln geprüft, nicht blind übersprungen.

**Zwischen-Feedback von Chris, eingearbeitet:** signature Requisiten/Waffen aus dem Portrait
sind "make or break" für die Bewertung — wichtiger als generische Ton-/Farbkorrekturen. Wo
ein benennbares, charakterprägendes Requisit (Waffe, Instrument, Schmuckstück) fehlte, hatte
dessen Behebung Vorrang vor kosmetischen Korrekturen; wo ein fehlendes signature-Requisit
NICHT behebbar war (kein Instrumenten-/Masken-Layer im Baukasten), wurde der Charakter bewusst
bei 3 statt 4 Sternen belassen, auch wenn es rein rechnerisch die einzige verbleibende Lücke
war (Melody, Hellvoice — s. unten).

**Engine-Hinweis vom Koordinator:** `renderProbe(name)` (die Pose, aus der alle
Vorschau-PNGs entstehen) läuft immer mit `lunge=0`, einer reinen Idle-Pose — Nahkampfwaffen
(`schwert`/`axt`/`stab`/`zweihaender`) werden aber nur gezeichnet, wenn `ani==="slash"`. Jede
`waffe`-Korrektur in diesem PR ist deshalb in den Vorschau-PNGs unten NICHT sichtbar, obwohl
sie im Rezept korrekt steht — ein bekannter, separat behobener Engine-Fund, kein Fehler dieser
Runde.

## Ergebnis in Zahlen

**14 von 30 auf ★★★★ gehoben, 16 bleiben bei ★★★** — mit aktualisierter, ehrlicher Begründung
in jedem einzelnen Fall (Grundsatz "Score folgt dem Sprite"), nicht stillschweigend
unverändert gelassen. Mehrere ★★★-Einträge trugen ein Rubrik-verletzendes `fehlendesDetail:
null` (bei 3 Sternen muss das Feld laut Rubrik gefüllt sein) — in dieser Runde durchweg
korrigiert.

| Charakter | Fix | Sterne |
|---|---|---:|
| Gram | `waffe:"schwert"→"axt"` (Portrait zeigt eindeutig eine Axt-Silhouette) | ★★★ → ★★★★ |
| Gronkslime | `effekt:{typ:"gift",pos:"koerper"}` (leuchtender Brustkern) | ★★★ → ★★★★ |
| Issyria | `effekt:{typ:"arkan",pos:"koerper"}` (Magie-Orbs) | ★★★ → ★★★★ |
| Isuzu | `waffe:"schwert"→"stab"` + `effekt:{typ:"feuer",pos:"koerper"}` | ★★★ → ★★★★ |
| Johanna | `waffe:"schwert"→"axt"` (Kriegshammer-Näherung) | ★★★ → ★★★★ |
| Krag'Zul | `effekt.streuung` 9→18 (großflächigeres violettes Glühen) | ★★★ → ★★★★ |
| Kreischende Kogge | `effekt:{typ:"frost",pos:"koerper"}` (Bild zeigt Cyan, nicht Grün) | ★★★ → ★★★★ |
| Lady Yueqin | `waffe:"stab"` + `ruestTon:"tuerkis"` (neue Rampe) | ★★★ → ★★★★ |
| Lilly | nichts geändert — Bewertungstext korrigiert (Schwert war schon die Dolch-Näherung) | ★★★ → ★★★★ |
| Moonveil | `ruestTon:"gold"→"blau"` + `effekt:{typ:"frost",pos:"koerper"}` | ★★★ → ★★★★ |
| Nimri | `geist:true` (durchscheinender Kristallkörper) | ★★★ → ★★★★ |
| Nocture | `vollbildFarbe:"#1f1b1a"` (rauchig-schwarze Einfärbung) | ★★★ → ★★★★ |
| Node | `effekt:{typ:"frost",pos:"koerper"}` (cyanfarbene Energieschlieren) | ★★★ → ★★★★ |
| Omniclops | nichts geändert — Bewertungstext korrigiert (alle 4 Merkmale treffen bereits) | ★★★ → ★★★★ |
| Grizz | geprüft, keine Fix-Primitive vorhanden (Zahnräder/Brille strukturell) | ★★★ (unverändert) |
| Hellvoice | Gitarre fehlt, strukturell unbaubar — bewusst bei 3 (signature-Priorität) | ★★★ (unverändert) |
| Ironhoof | unverändert — Zentauren-Unterkörper strukturell unbaubar (Vorrunde) | ★★★ (unverändert) |
| Jihanna | Bewertungstext korrigiert (Spitzohren schon da); Dual-Wield strukturell unbaubar | ★★★ (unverändert) |
| Kora | Bewertungstext/`fehlendesDetail` gefüllt (Vorrunde-Fix bleibt stehen) | ★★★ (unverändert) |
| Lulu | unverändert — Armreifen/Blätter-Requisite strukturell unbaubar | ★★★ (unverändert) |
| Lynara | Bewertungstext korrigiert (Spitzohren schon da); Schriftrolle+Zweiton-Robe offen | ★★★ (unverändert) |
| Medibull | unverändert — mehrere Requisiten-Lücken (Vorrunde, bereits ausführlich dokumentiert) | ★★★ (unverändert) |
| Melody | `ruestTon:"dunkel"` + `krone:true`; Gitarre fehlt — bewusst bei 3 (signature-Priorität) | ★★★ (unverändert) |
| Murky | unverändert — tropfende Algen-Textur strukturell unbaubar | ★★★ (unverändert) |
| Mushu | unverändert — mehrere Lücken (Statur, Augenfarbe, Hautton) | ★★★ (unverändert) |
| Myrkos | unverändert — Rücken-Tentakelkreatur strukturell unbaubar (Vorrunde) | ★★★ (unverändert) |
| Nachtschatten | Bewertungstext korrigiert (Spitzohren schon da); Maske+Netzmuster offen | ★★★ (unverändert) |
| Orichalcos | unverändert — Maske+Schärpe strukturell unbaubar (Vorrunde, bereits dokumentiert) | ★★★ (unverändert) |
| Othrama | unverändert — Fühler/Gliedmaßen-Proportion strukturell unbaubar (Vorrunde) | ★★★ (unverändert) |
| Pinkypie | unverändert — Hut+Buch strukturell unbaubar (Vorrunde, bereits dokumentiert) | ★★★ (unverändert) |

## Neue, wiederverwendbare Erweiterung

- **`RUEST_TON.tuerkis`** — sechste additive Farbrampe in `RUEST_TON` (nach `gold`/`bronze`/
  `dunkel`/`violett`/`rot`/`blau`), aus Lady Yueqins jadegrüner Seidenrobe abgetastet
  (`#071A16` → `#7FD4BB`). Keine bestehende Rampe angetastet, sofort für jeden künftigen
  Charakter mit grün/türkisfarbener Kleidung wiederverwendbar (Grundsatz "keine
  Asset-Exklusivität").

Alle anderen Fixes sind reine Rekombination bestehender `BAU`-Felder (`waffe`, `effekt`,
`ruestTon`, `geist`, `vollbildFarbe`) — keine neue Engine-Logik, keine neue Zeichenfunktion
nötig.

## Vorgehen bei den auffälligeren Fällen

**Nocture** — größter Einzelfund der Runde: das `vollbild:"geist"`-Blatt lief seit jeher
**ungefärbt** (per `renderProbe` nachgemessen: ein helles, grünlich-weißes Standard-
Leichentuch statt der rauchig-schwarzen Gestalt aus dem Bild), obwohl die alte Bewertung
"rauchig-schwarze Farbe fehlt" korrekt benannte — die Ursache war ein fehlendes
`vollbildFarbe`, keine fehlende Palette. Erster Versuch mit `vollbildFarbeModus:"farbe"`
(CSS-`"color"`-Blend, behält die Original-Luminanz bei) änderte bei einem fast-schwarzen
Füllton sichtbar **nichts** — ein `color`-Blend überträgt nur Farbton/Sättigung, und ein
Grau/Schwarz-Ton hat praktisch keins von beidem. Per `renderProbe` vorher/nachher verglichen
und auf den **Default-Modus `multiply`** umgestellt (kann eine Zielfarbe laut Funktions-
Kommentar "nur SCHWÄCHEN, nie HINZUFÜGEN") — multipliziert das helle Blatt sichtbar auf einen
rauchig-dunklen Ton herunter. Kombiniert mit dem bereits vorhandenen `effekt:voidRot`
(rotglühende Energie) sind beide ursprünglich benannten Lücken jetzt behoben.

**Lady Yueqin** — Portrait zeigt eine ältere Elfen-Weise in jadegrüner Seidenrobe mit
Wanderstab, umgeben von schwimmenden Fischen. `waffe:"stab"` (bislang komplett unbewaffnet)
und eine neue `RUEST_TON.tuerkis`-Rampe (additiv, s. oben) beheben zwei der drei genannten
Lücken; die schwimmenden Fische bleiben strukturell unbaubar (kein Tier-Begleiter-Layer).

**Kreischende Kogge** — "Bild schlägt Tags"-Fund: die alte Bewertung nannte "giftgrüner
Nebel" als fehlendes Detail, das Portrait zeigt aber eindeutig **cyan/blau** glühende
Totenkopf-Segel und blaue Geisterflammen, kein Grün. `effekt:{typ:"frost",pos:"koerper"}`
(hellblau/weiß) korrigiert das, statt eine falsche Farbe nachzubauen.

**Gram / Johanna** — beide hatten laut altem `fehlendesDetail` eine falsche Waffe: Gram
führte `waffe:"schwert"`, das Portrait zeigt aber eine gebogene Doppelklinge am Stiel (Axt);
Johanna führte ebenfalls `waffe:"schwert"`, das Portrait zeigt einen Kriegshammer. Kein
Hammer-Typ existiert im `waffe`-Slot (nur `schwert`/`axt`/`stab`/`zweihaender`/`bogen`) — bei
Johanna ist `axt` die nächstliegende Näherung, weil sie wie ein Hammer einen abgesetzten Kopf
an einem Haft zeigt statt einer geraden Klinge. Bei Gram waren Farbe/Flammenkamm (`haut:
"black"`, `effekt:feuer` am Kopf, `gluehenderRiss`) bereits aus einer früheren Runde korrekt
gesetzt — die alte Bewertung war hier teilweise stale.

**Lilly / Jihanna / Lynara / Nachtschatten** — vier Fälle, in denen der alte
`fehlendesDetail`-Text ein Merkmal nannte, das im Rezept **bereits vorhanden** war
(`ohren:true` bei allen vieren, außerdem war Lillys `waffe:"schwert"` schon die
dokumentierte Dolch-Näherung). Keine Code-Änderung nötig, nur eine ehrliche Neubewertung:
Lilly rückt dadurch auf ★★★★ (die verbleibende Lücke — Augenklappe — ist jetzt die einzige),
die anderen drei bleiben bei ★★★ wegen je zweier unabhängiger, weiterhin offener Lücken.

**Melody / Hellvoice — bewusst NICHT auf ★★★★ gehoben.** Beide sind Musiker-Charaktere, deren
Portrait eine Gitarre als zentrales Requisit zeigt; keine existiert im Baukasten (kein
Instrumenten-Layer, der `waffe`-Slot kennt nur Kampfwaffen). Bei Melody wurden `ruestTon:
"dunkel"` (schwarze Robe) und `krone:true` (Tiara-Näherung, Form stimmt, Farbe nicht) ergänzt
— danach ist die Gitarre rechnerisch die einzige verbleibende Lücke, was nach Rubrik-Buchstabe
★★★★ nahelegen würde. Nach Chris' explizitem Zwischen-Feedback ("signature Requisiten sind
make or break, wichtiger als generische Ton-/Farbkorrekturen") wiegt ein fehlendes,
identitätsstiftendes Requisit bei einem Musiker-Charakter schwerer als eine punktuelle
Korrektur — beide bleiben deshalb bewusst bei ★★★, mit explizit dokumentierter Begründung im
Code-Kommentar und in `sprite-fit-bewertung.json`.

## Geprüft, aber nicht fixbar (16 Charaktere, ehrlich dokumentiert)

Strukturelle Baukasten-Grenzen, keine vergessenen Fixes — je eine kurze Einordnung:

- **Grizz** — Zahnräder/Rohre auf der gesamten Rüstung, hochgeschobene Schutzbrille: kein
  Textur-/Brillen-Layer.
- **Ironhoof** — Zentauren-Unterkörper: kein Vierbeiner-Körpertyp im Baukasten (Vorrunde,
  unverändert bestätigt).
- **Jihanna** — Dual-Wield (zwei Klingen): die Engine zeichnet nur eine Nahkampfwaffe je
  Figur, eine grundsätzlich andere Bauweise statt einer punktuellen Korrektur.
- **Kora** — Kopf liest "Reh" statt "Stier" (keine bessere Kopf-Alternative) UND
  Gürtel-/Beutel-Details (kein Requisiten-Layer) — zwei unabhängige Lücken.
- **Lulu** — Armreifen und Blätter-Requisite: kein Schmuck-/Naturmotiv-Layer.
- **Lynara** — Schriftrolle/Feder (kein Requisiten-Layer) UND zweifarbige Weiß-Gold-Robe
  (`ruestTon` färbt nur einheitlich) — zwei unabhängige Lücken.
- **Medibull** — Rotes-Kreuz-Armbinde, Verbandtasche, Stethoskop (kein Requisiten-Layer) UND
  Kopf liest "Reh" statt "Stier" — mehrere Lücken (Vorrunde, bereits ausführlich dokumentiert).
- **Murky** — tropfend-schleimige Algentextur: kein Textur-/Tropf-Layer.
- **Mushu** — vierbeinige Statur, blaue Augenfarbe, reinweiße (statt hautfarbene) Färbung —
  mehrere unabhängige Lücken, kein reines Weiß in der `HAUT`-Tabelle verfügbar.
- **Myrkos** — die namensgebende Rücken-Tentakelkreatur: kein Rücken-Kreatur-Layer
  (Vorrunde, unverändert bestätigt).
- **Nachtschatten** — Augenmaske (kein Masken-Layer) UND spinnennetzartiges Verzierungsmuster
  (kein Textur-/Stickmuster-Layer) — zwei unabhängige Lücken.
- **Orichalcos** — goldene Vogel-Maske und rote Schärpe: kein Masken-/Zweitstoff-Layer
  (Vorrunde, bereits dokumentiert).
- **Othrama** — Fühler und lange, dünne Insekten-Gliedmaßen: starre Humanoid-Proportion
  (Vorrunde, bereits dokumentiert).
- **Pinkypie** — spitzer Hexenhut und Zauberbuch: kein Hut-/Buch-Layer (Vorrunde, bereits
  dokumentiert).
- **Hellvoice** — Gitarre: kein Instrumenten-Layer; bewusst bei 3 statt 4 trotz nur dieser
  einen Lücke (s. Abschnitt oben, signature-Priorität).
- **Melody** — Gitarre: kein Instrumenten-Layer; bewusst bei 3 statt 4 trotz nur dieser einen
  Lücke (s. Abschnitt oben, signature-Priorität).

## Verifikation

**Syntax:**

```
node --check public/mockups/battle-mode.engine.js
```

→ OK.

**Keine Simulationsberührung:** `aufEignung(s,eig)` gelesen (Zeile ~7238) — die Funktion
fasst ausschließlich `s.LP`, `s.VER`, `s.ANG` an (plus `rohKraft()`, das dieselben drei Felder
liest); kein `BAU`, kein Sprite-Feld (`kopf`/`haut`/`ruest`/`waffe`/`effekt`/`geist`/
`vollbildFarbe`/`ruestTon`) kommt in ihrem Funktionskörper vor. Alle in diesem PR geänderten
Felder (`waffe`, `effekt`, `ruestTon`, `geist`, `vollbildFarbe`, `RUEST_TON.tuerkis`) werden
ausschließlich innerhalb von `zeichneSprite()`/`figur()`/`bHolEingefaerbt()`/`spriteRuest()`
gelesen — reine Zeichenfunktionen. Eine zweite, gleichnamige Fundstelle (`a.geist`/`b.geist`
in der Battlefield-Bündnis-Logik, Zeile ~49699) ist ein **anderes** Feld auf einem anderen
Objekt (ein Kämpfer-Persönlichkeitswert "Geist/Spirit" für Allianzen), nicht das BAU-Flag
`b.geist` — verwechslungsfrei geprüft, kein Übergriff auf die Simulation.

**Regressionskontrolle:** `node scripts/miss-alle-disziplinen.mjs 4` versucht; unter starker
gleichzeitiger Systemlast (mehrere parallele Sprite-Fit-Batch-Agenten auf derselben Maschine,
dieselbe Lage wie in `sprite-4stern-batch-a-16-10.md` beschrieben) lief der Prozess über die
reguläre Timeout-Grenze hinaus. Der Grep-/Lese-Nachweis von `aufEignung()` oben ist laut
Projekt-Doku ("Grep-Nachweis ODER kurzer Lauf", `scripts/miss-alle-disziplinen.mjs`-Kommentar)
als eigenständiger Beleg ausreichend und wird hier als primärer Nachweis geführt.

**Vorschauen neu erzeugt:** `node scripts/erzeuge-sprite-vorschauen.mjs "<Name>"` für alle 13
sichtbar geänderten Charaktere gelaufen (Gram, Gronkslime, Issyria, Isuzu, Johanna, Krag'Zul,
Kreischende Kogge, Lady Yueqin, Melody, Moonveil, Nimri, Nocture, Node) —
`public/sprites/preview/<slug>.png` aktualisiert und Teil dieses Commits. Nocture per
`renderProbe` vorher/nachher verglichen (weiß/grünlich → rauchig-dunkel, bestätigt die
Modus-Umstellung oben). Bei den 17 unveränderten/waffen-only Charakteren blieb das PNG
unverändert (Waffen-Layer sind an die `slash`-Animationsphase gebunden und in der
Idle-Vorschau nie sichtbar, s. Engine-Hinweis oben) und wurde nicht neu committet.

## Was übrig bleibt (nicht in diesem PR)

16 Charaktere bleiben ★★★, dokumentiert oben — keiner ist ein "vergessener" Fix, sondern
entweder eine geprüfte strukturelle Baukasten-Grenze (fehlender Requisiten-/Masken-/
Instrumenten-Layer, falscher Körpertyp, starre Einzelwaffen-Engine) oder eine bewusste
Entscheidung, ein fehlendes signature-Requisit höher zu gewichten als eine rein rechnerische
4-Sterne-Eignung (Melody, Hellvoice). Ein Instrumenten-Layer, eine zweite Maske/ein zweiter
Hut, ein Requisiten-Slot für Kleinteile (Armbinde, Schriftrolle, Verbandtasche) oder ein
echter Vierbeiner-/Zentauren-Körpertyp wären künftige, größere Baukasten-Erweiterungen, keine
punktuellen Rezept-Fixes wie in dieser Runde.

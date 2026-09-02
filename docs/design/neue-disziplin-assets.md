# Neue Disziplin — der Asset-Teil

Chris' Auftrag: ein Handbuch, das zusammenfasst, was das Anlegen einer neuen Disziplin
braucht — damit "Gewichtheben" (oder jede andere künftige Disziplin) ein Auftrag wird, den
ein Agent ohne Rückfragen abarbeiten kann.

Dieses Dokument ist der **Asset-Teil**: welche Bilder/Töne/Formen eine Disziplin braucht, wo
sie herkommen, wie sie in den Motor eingebaut werden, und wie geprüft wird, ob sie zur Figur
passen. Mechanik, Punktevergabe, Rezept-Kalibrierung und Abnahme-Kriterien stehen im
**Verfahrensteil**, [`docs/design/neue-disziplin-handbuch.md`](./neue-disziplin-handbuch.md)
— dort weiterlesen für "wie wird gewertet", hier für "was muss gezeichnet/beschafft werden".

Geltungsbereich: **`public/mockups/battle-mode.engine.js`**, der sprite-basierte
Auto-Battler-Entwurf ("Battle Arena", s. `docs/BATTLE_ARENA_UEBERGABE.md`). Die
produktive Spielwertung läuft über eigene, abstrakte SVG-Arenen unter
`app/foundation/discipline-stage/arena/disciplines/` (z. B. `barbell.tsx` für
Gewichtheben, Stand 02.09. ohne Requisiten-Sprites, nur Token/Türme/Achsen) — dieses
Dokument betrifft nicht jene Produktionsarena, sondern den Sprite-Motor, in dem "Gewichtheben"
bereits als `BUEHNE_ART`-Eintrag rechnet (`public/mockups/battle-mode.engine.js:7791-7817`),
aber noch keine eigene Requisite in der Hand hat.

Alle Datei-/Zeilenangaben sind Stand dieses Commits auf `origin/main`. Wo etwas nur auf einem
Feature-Branch existiert, steht das ausdrücklich dabei.

---

## 1. Welche Assets eine Disziplin überhaupt braucht

Eine Disziplin im Sprite-Motor besteht aus sechs Bestandteilen. Nicht jeder ist ein Bild —
manche sind Formen, die eine Funktion aus Zahlen zeichnet, ohne dass irgendwo eine Datei
liegt.

| Posten | Beispiel (bestehend) | Beschafft oder prozedural? | Warum |
|---|---|---|---|
| Spielfläche | Basketball-Parkett (`public/sprites/basketball/parkett.png`, LPC-Floors-Kachel), Eisfläche (`eisflaeche()`, `battle-mode.engine.js:7279`) | **Je nachdem.** Basketball: eine gekachelte Bodentextur plus vektorielle Linien-Overlays. Hockey: **komplett prozedural** — Canvas-Formen aus echten NHL-Maßen (200×85 Fuß, s. Abschnitt unten) | Ein Spielfeld hat feste geometrische Verhältnisse (Linien, Kreise, Zonen) — die lassen sich exakt aus Maßen herleiten. Eine Bodentextur (Parkett, Eis-Grundton) ist dagegen eine Fläche, die man nicht bei jeder Zelle neu erfinden will |
| Requisite in der Hand | Schwert/Axt/Stab/Bogen (`public/sprites/baukasten/`, LPC-Waffenblätter) vs. Hockeyschläger (`zeichneHockeyschlaeger()`, `battle-mode.engine.js:297`) | **Je nachdem.** Fantasy-Nahkampfwaffen: beschafft (LPC-Universal-Generator). Hockeyschläger: **prozedural** | Kein CC0-Blatt trifft "dünner Schaft + abgewinkelte Kelle in vier Blickrichtungen und vier Haltungen (halten/ausholen/schuss)" — wörtlich der Kommentar an der Stelle: *"kein CC0-Requisitenblatt trifft 'duenner Schaft + abgewinkelte Kelle' in vier Blickrichtungen UND vier Haltungen zugleich, und ein prozedural gezeichnetes Requisit bleibt scharfkantig ohne Weichzeichnung, wie es imageSmoothingEnabled=false verlangt"* (`battle-mode.engine.js:246-249`) |
| Tore/Ziele/Geräte | Basketballkorb (`public/sprites/basketball/korb_topdown.png`, Kenney Sports Pack, CC0) vs. Hockeytor (`zeichneTor()`, `battle-mode.engine.js:7349-7367`) | **Je nachdem.** Der Korb ist ein fertiges Icon-Sprite. Das Hockeytor ist zwei rote Pfosten + Netz aus Linien/Rechtecken, weil seine Maße (`TOR_HALBHOEHE`, `TOR_TIEFE`) exakt mit der Schussauflösung übereinstimmen müssen — eine Bilddatei könnte das nicht "wissen" | Ein Tor, dessen Geometrie eine Rechenformel braucht (Trefferfläche = Zeichenfläche), gehört prozedural gezeichnet; ein Korb, der nur ein Ziel-Icon ohne eigene Trefferlogik ist, kann ein Sprite sein |
| Töne | `bkSfx`/`bkBild` (Basketball-spezifische Sounds/Bilder, s. Abschnitt 4) | Beschafft (nicht Teil dieses Auftrags — kein Download in dieser Sitzung) | — |
| Disziplin-Icon | `public/discipline-icons/Gewichtheben.png` (1254×1254, Herkunft **ungeklärt**, kein `quellen.json` neben dem Ordner) neben `Gewichtheben.svg` (64×64, aus `scripts/generate-discipline-icons.ts:14`, Platzhalter-Monogramm "GW" auf Farbfläche) | Für neue Disziplinen: **prozedural als Platzhalter**, echtes Icon ein späterer Schritt | `scripts/generate-discipline-icons.ts` baut aus Label+Farbe ein SVG (`buildSvg()`, Zeile 33-39) — für 23 von 20+ Disziplinen bereits vorhanden. **Offene Frage:** wer/wann die `.png`-Fassungen erzeugt hat und unter welcher Lizenz, ist im Repo nicht dokumentiert — für eine neue Disziplin gehört das nachgeholt, nicht wiederholt |
| Zuschauer | `public/sprites/basketball/zuschauer.png` ("Welcome to The Arena!", Spring Spring, CC-BY 3.0/4.0) | Beschafft, aber **wiederverwendbar** — die Bühnen-Disziplinen (`bodenBuehne()`, `battle-mode.engine.js:8088-8103`) zeichnen bislang nur Scheinwerferkegel auf dunklem Grund, **keine** Publikums-Sprites | Ein einmal lizenziertes Zuschauer-Blatt lässt sich horizontal kacheln und für jede Disziplin wiederverwenden — vor einer neuen Suche erst prüfen, ob `zuschauer.png` schon reicht |

**Faustregel:** prozedural, wenn die Form (a) aus echten Maßen/Regeln ableitbar ist (Spielfeld,
Tor-Trefferfläche) oder (b) eine Kombination aus Blickrichtung × Haltung verlangt, die kein
Blattpaket in dieser Auflösung anbietet (Requisite in der Hand während einer Spielaktion).
Beschafft, wenn ein fertiges Motiv die Silhouette trifft und keine spielrelevante Geometrie
daran hängt (Figuren, Bodentexturen, Tor-Icons ohne eigene Trefferlogik, Zuschauer).

---

## 2. Wie ein Asset in den Motor kommt

Der Weg von der Datei bis zum gezeichneten Pixel hat **fünf** Stellen. Alle fünf liegen in
derselben Datei, `public/mockups/battle-mode.engine.js`, aber an weit auseinanderliegenden
Zeilen — und das ist der Kern der Falle unten.

1. **Base64 in ein Sprite-Objekt.** Zwei getrennte Sammlungen:
   - `SPRITES` (`battle-mode.engine.js:14`) — die animierbaren LPC-Körper-/Kopf-/Waffenblätter
     für die laufende Arena-Figur.
   - `B_SPRITES` (`battle-mode.engine.js:63`) — der Baukasten-Bestand (Krone, Axt, Stab,
     Zweihänder, Vollbild-Kreaturen wie `golem_walk`), zusätzlich gebraucht für die stehende
     Kader-/Board-Ikone (`figur()`) und für vier Nahkampfwaffen, die auch die animierte Arena
     zeichnet (`zeichneB()`, `battle-mode.engine.js:2009`).

   Beide werden identisch geladen: `for(const k in B_SPRITES){const im=new Image();im.src=
   B_SPRITES[k];bBild[k]=im;}` (`battle-mode.engine.js:69`, analog für `SPRITES`). Ein neues
   Requisiten-/Rassenblatt muss hier als Base64-Data-URI eingetragen sein, sonst existiert es
   für den Motor nicht.

2. **Ein `VOLLBILD`-Eintrag mit Zellraster** (`battle-mode.engine.js:1403-…`) — nur nötig,
   wenn das Motiv eine **fertige Fremdillustration** ist (Golem, Kraken, Drache, Roboter),
   die Kopf/Körper/Rüstung komplett ersetzt statt sie zu kombinieren. Ein Eintrag nennt Bild-
   schlüssel (`key`), Zellgröße (`cw`/`ch`), Spaltenzahl (`cols`) und die Blattordnung
   (LPC-Standard: hinten/links/vorn/rechts, `stendhal:true` für die andere Reihenfolge,
   `rows`/`rowMap` für Sonderfälle wie den 8-Zeilen-Mech, `battle-mode.engine.js:1464`).
   Requisiten wie ein Hockeyschläger oder ein Barbell-Prop brauchen **keinen**
   `VOLLBILD`-Eintrag — sie sind entweder ein eigener Sprite-Layer (wie Schwert/Axt) oder
   prozedural (wie der Hockeyschläger).

3. **Ein `BAU`-Eintrag je Figur** (`battle-mode.engine.js:627-…`, Fallback `BAU_STD`,
   Zeile 1359: `{kopf:"human",haut:"light",ruest:"leder"}`) — sagt, welche Ebenen/Requisiten
   *dieser* Charakter trägt: `kopf`, `haut`, `ruest`, `waffe`, `helm`/`krone`/`bart`/`haar`,
   `fluegel`, `schwanz`, `effekt` (Partikel-Overlay), oder `vollbild`+`vollbildFarbe` für
   Fremdillustrationen. Jeder Eintrag im Bestand trägt einen Kommentar, der den Bildbefund
   (was das Portrait zeigt) gegen die gewählten Flags hält — z. B. `battle-mode.engine.js:636`
   für Draco oder `:658` für Lava Golem (inklusive der Begründung, warum `vollbildFarbe`
   nötig war). Für eine neue Disziplin ist das nicht direkt relevant (das ist Charakter-, nicht
   Disziplin-Zeichnung) — **aber** ein neues Requisiten-Flag (z. B. `hantel:true`) wird hier so
   gesetzt wie `waffe`/`fluegel` es heute sind.

4. **Die Zeichenpfade in `zeichneSprite()` und `figur()` — zwei getrennte, das ist eine
   Falle.**
   - `zeichneSprite(ctx,u,x,y,feldspiel)` (`battle-mode.engine.js:1565`) zeichnet die
     **animierte** Arena-Figur: Laufzyklus, Kampfpose, Effekte, Requisiten in Bewegung. Sie
     liest `BAU`, ruft `male()` (Zeile 1991, die eigentliche `drawImage`-Grundfunktion) über
     `zeichne()`/`zeichneB()`/`zeichneR()`/`zeichneHaar()` usw.
   - `figur(p)` (`battle-mode.engine.js:8348`) zeichnet die **stehende** Kader-/Board-Ikone
     (40×50-Ausschnitt aus derselben 64×64-Zelle, Kommentar Zeile 8349-8352 erklärt den
     Ausschnitt). Sie liest **dasselbe** `BAU`, aber mit einer eigenen, zweiten Implementierung
     der Zeichenlogik (`setzIm`/`setzR`/`setzHaar`/`setzWaffe`/`setzFluegel`, Zeilen
     8426-8476) — **keine gemeinsame Funktion mit `zeichneSprite()`**.

   **Was passiert, wenn man eine Stelle vergisst:** genau das ist im Repo mehrfach passiert
   und dokumentiert, nicht spekuliert:
   - Ein `BAU`-Flag, das nur in `zeichneSprite()` abgefragt wurde, fehlte in `figur()` — Chris'
     Fund laut Kommentar `battle-mode.engine.js:8438-8442`: *"Lulu, Inefinna, King Arlen
     Morgolor, Jorund stehen kahl da, und die Waffen fehlen noch!"* — Haar/Bart/Krone/Hose
     standen längst in `BAU`, wurden aber von der Kaderleisten-Zeichnung nie gelesen.
   - Umgekehrt fehlte `b.fluegel` in `figur()`, obwohl `zeichneSprite()` es längst zeichnete
     (`battle-mode.engine.js:8462-8474`) — betraf laut Kommentar 19 namentlich genannte
     geflügelte Charaktere.
   - Für Vollbild-Kreaturen ohne eigenen `kopf`/`ruest`-Bauplan (Golem, Kraken, Werwolf,
     Spinne, Roboter) fiel `figur()` früher ganz durch: *"vorher fiel so ein Spieler hier
     durch und stand als nackter Koerper OHNE Kopf in der Kaderliste"*
     (`battle-mode.engine.js:8369-8370`).

   **Konsequenz für eine neue Disziplin:** eine Requisite (Hockeyschläger, Hantel), die nur
   in `zeichneSprite()` verdrahtet wird, taucht in der Kader-/Board-Ansicht nicht auf. Das war
   für den Hockeyschläger zum Zeitpunkt dieses Commits explizit *bewusst* offen gelassen
   (`zeichneHockeyschlaeger()` ist gebaut, aber laut PR-Beschreibung von Commit `fb7f608e`
   *"kein zeichneSprite-Aufruf geaendert, keine Figur bekommt hier einen Schlaeger in die
   Hand"* — erst `7bd21ebd` verdrahtet ihn in `zeichneSprite()`, `figur()` blieb unangetastet).
   Wer eine Requisite vollständig durchzieht, prüft beide Stellen.

5. **Der Generator für die Slot-Daten.** `scripts/erzeuge-sprite-vorschauen.mjs` rendert für
   jeden Kader-Eintrag aus `data/generated/battle-arena-sprite-gallery.json` über
   `window.__arena.renderProbe(name)` ein PNG nach `public/sprites/preview/<slug>.png` — der
   Cache, den die QA-Galerie (`FoundationBattleArenaSpriteGallery.tsx`) anzeigt. Er lädt
   `public/mockups/battle-mode.html` per Playwright (`chromium.launch`, Pfad
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, Zeile 52-54) und braucht **keinen**
   HTTP-Server, weil alle Bild-Ebenen als Base64 in der Engine-Datei liegen (Kommentar Zeile
   20-24). Für eine neue Disziplin ist dieser Generator nicht direkt zuständig (er zeigt
   Charaktere, keine Disziplin-Szenen) — aber jede Änderung an `BAU` braucht danach einen
   erneuten Lauf, sonst zeigt die Galerie den alten Stand.

### Wie die Nahkampfwaffen (Axt/Stab/Zweihänder) den Bauplan-Weg zeigen

Ein bereits fertig durchgezogenes Beispiel für den vollständigen Weg (Base64 → `zeichneB()` →
`BAU`-Flag `waffe`) mit einer dokumentierten Einschränkung: Schwert, Axt, Stab und Zweihänder
haben im Baukasten **nur ein Angriffsblatt**, keine Steh-/Laufpose (`quellen.json`:
`sword/arming/attack_slash`, `blunt/waraxe/attack_slash`, `magic/gnarled/thrust`,
`sword/longsword/attack_slash`). Der Motor behilft sich, indem er immer **Spalte 0** dieses
Blattes zeichnet — laut Kommentar (`battle-mode.engine.js:8448-8459`) die einzige Spalte, in
der die Waffe ruhig in der Hand liegt, "kein perfekte Loesung: ein echtes Idle-Blatt fuer diese
vier Waffen gibt es nicht". Wer eine neue Requisite mit vergleichbarer Blattlage plant, sollte
dieselbe Kompromiss-Frage stellen: reicht eine einzelne Spalte als Ruhepose?

---

## 3. Die Beschaffung

### Woher der bisherige Bestand kommt

| Quelle | Wofür | Lizenz(en) im Bestand |
|---|---|---|
| **OpenGameArt.org** (weit überwiegend) | LPC-Pakete (Terrains, Floors, Monsters, Conifers, Animated Torch, Birds …), Sports Pack, Basketballs, "Welcome to The Arena!", Angels, Gnomes, Flying Dragon Rework, Mechs 64×64, JS Monster Set — Elementals, Ice Elemental | CC0, CC-BY 3.0/4.0, CC-BY-SA 3.0/4.0, OGA-BY 3.0, GPL 2.0/3.0 |
| **LPC-Universal-Generator** (GitHub, `LiberatedPixelCup/universal-lpc-spritesheet-character-generator`) | 209 Körper-/Kopf-/Waffen-Bewegungsblätter (walk/run/shoot/hurt/idle), weiblicher Körper+Kopf, Flossen-Kopfschmuck (`flossen.png`) | OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0 (Baukasten-README, `public/sprites/baukasten/README.md:112-113`) |
| **Stendhal-Projekt** (eigenes Reihenformat, N/O/S/W statt LPC-Standard) | Frogmen (`froschmensch.png`), Werwolf, Spinnenwesen, Angels (Divine/Voidborn) | CC-BY 3.0, teils OGA-BY 3.0 |
| **Kenney.nl** | Sports Pack (Basketballkorb-Icons) | CC0 |

Portale, die **erfolglos** durchsucht wurden (wichtig für künftige Suchen — nicht noch einmal
denselben Weg gehen): der LPC-Universal-Generator wurde gezielt nach taktischer/moderner
Kleidung durchsucht und lieferte laut `public/sprites/spec_ops/quellen.json` *"wie erwartet
NICHTS — LPC ist konsequent Mittelalter/Fantasy"*; ebenso hat er laut
`public/sprites/waffen/quellen.json` **keine** Feuerwaffen-Kategorie.

### Was die Lizenzen konkret verlangen (nicht generisch, sondern wie im Bestand dokumentiert)

| Lizenz | Pflicht laut Bestand | Beleg |
|---|---|---|
| CC0 | Keine Attributionspflicht | `public/sprites/gnom/quellen.json:4` |
| CC-BY 3.0/4.0 | Namensnennung; Bearbeitung ausdrücklich erlaubt | `public/sprites/pflanze/quellen.json:9`: *"CC-BY 3.0 erlaubt Bearbeitungen mit Namensnennung"* |
| CC-BY-SA / GPL (LPC-Baukasten) | Copyleft — Pflichten greifen **erst bei Weitergabe**; für dieses private, nicht verkaufte Spiel unproblematisch | `public/sprites/baukasten/README.md:112-113` |
| OGA-BY 3.0 | Namensnennung **mit Link zurück auf die OpenGameArt-Seite** reicht laut Autor | `public/sprites/monster/quellen.json:288` |
| Explizite Autor-Bedingung (Einzelfall) | Manche Urheber verlangen mehr als die Lizenz selbst: Svetlana Kushnariova (Cabbit, Angels-Paket) verlangt bei Weitergabe ausdrücklich ihren vollen Namen **und** ihre E-Mail `lana-chan@yandex.ru` | `public/sprites/divine/quellen.json:3`, `voidborn/quellen.json:4`, `zwerg/quellen.json:5` |

**Regel für eine neue Suche:** die Lizenz-Bedingung steht nicht immer vollständig in der
Lizenz selbst — die Quellseite auf OpenGameArt kann zusätzliche Bedingungen des Urhebers
nennen (wie oben bei Kushnariova). Das Feld "License(s)" auf der Seite direkt prüfen, nicht
raten.

### Die `quellen.json`-Konvention

Jeder Unterordner unter `public/sprites/` (außer `preview/`, ein reiner Render-Cache) trägt
eine `quellen.json` neben den Bilddateien. Sie ist **die** Stelle, an der eine spätere Sitzung
nachvollziehen kann, warum ein Motiv gewählt und ein anderes verworfen wurde — das ist ihr
eigentlicher Wert, nicht nur die Lizenz-Buchhaltung.

**Pflichtfelder je Datei-Eintrag** (Name variiert leicht zwischen Ordnern, Substanz ist gleich):

| Feld | Bedeutung |
|---|---|
| `paket` oder `original` | Name des Quellpakets bzw. der Originaldatei vor Umbenennung |
| `blatt` | Rastermaß, Zellgröße, Blickrichtungs-/Bewegungsreihenfolge, ggf. Schnittkoordinaten |
| `urheber` | Person(en), wie auf der Quellseite genannt |
| `lizenz` | genau wie auf der Quellseite geprüft, nicht aus dem Gedächtnis |
| `url` | die geprüfte Quellseite |
| `verwendung` (optional, aber wertvoll) | wofür/wie das Motiv im Spiel eingesetzt wird oder warum **nicht** |

**Ordnerweite Felder** (Konvention: Unterstrich-Präfix, damit sie nicht wie ein Dateieintrag
aussehen): `_hinweis` (Kontext: wann/wofür der Ordner angelegt wurde), `_lizenz` (gemeinsame
Lizenzlage, wenn alle Dateien aus einem Paket stammen), `_warum_unbearbeitet` /
`_stilbruch_*` (Begründungen, die für den ganzen Ordner gelten).

**Beispieleintrag** (leicht gekürzt, nach dem Muster von `public/sprites/elementar/
quellen.json`, das Verfahren UND Ausgang eines Freistellungsversuchs festhält):

```json
{
  "elementarwesen_wasser.png": {
    "paket": "JS Monster Set - Elementals I",
    "original": "_quelle_elementals1_original.png, Zelle oben links (0,0)-(72,88)",
    "blatt": "Einzelbild, freigestellt und auf 64x64 zentriert (50x64 Inhalt)",
    "urheber": "JosephSeraph",
    "lizenz": "CC-BY 3.0",
    "url": "https://opengameart.org/content/js-monster-set-elementals",
    "hinweis": "Freigestellt mit scripts/stelle-wasserelementar-frei.py. Der erste Anlauf hatte aufgegeben, weil das Hintergrund-Lila im Inneren der Figur als Gestaltungsfarbe wiederkehrt. Geloest, indem die inneren Lilapixel nicht geloescht, sondern per Farbton UMGEFAERBT werden. ACHTUNG: Einzelbild ohne Gehzyklus und ohne vier Blickrichtungen."
  }
}
```

Ein Feld, das nicht aus einer geprüften Quelle stammt, gehört **nicht** hinein — lieber eine
offene Frage im Fließtext des PRs als ein erfundener Urheber.

---

## 4. Was der Bestand schon hergibt

Alle Unterordner unter `public/sprites/`, Stand dieses Commits. "Dateien" zählt nur
Bildeinträge (ohne `_`-Präfix-Metafelder).

| Ordner | Dateien | Was drin ist | Wofür es taugt |
|---|---|---|---|
| `baukasten/` | 110 (Bilder) + `README.md` + `index.json` | Das Ebenensystem: Körper, Kopf, Rüstung, Haar, Waffen (Schwert/Axt/Stab/Zweihänder/Bogen), Flügel (Federn/Fledermaus), Schwanz, **Flossen** — s. unten | Der Baustein-Kasten für animierbare Humanoiden. LPC-Standardraster 64×64, Waffen breiter (128/192px) |
| `arena/` | 13 | Boden-Kacheln (Sand/Stein/Erde/Bahn/Rasen), Zaun/Mauer, Bäume, Fackel, Deko-Adler | Umgebungs-Deko für die Kampf-Arena, nicht spielrelevant |
| `basketball/` | 7 | Parkett, drei Korb-Ansichten, Ball, Ball-Varianten, Zuschauer | Vollständiger Satz für ein Feldspiel mit fertigem Court |
| `monster/` | 39 | LPC-Monster (Fledermaus, Biene, Würmer …), vier Drachen (Stilbruch, 144×128), Golem/Kraken/Werwolf/Roboter/Mechs (Vollbild-Kreaturen) | Vollbild-Ersatzkörper für Charaktere, die keine Humanoid-Form haben |
| `demon/` | 7 | Vollkörper-Dämon (LPC Imp 2, 64px-Standardraster) | Eigene Rasse "Demon" statt Behelfs-Hörner auf Orc/Human-Kopf |
| `divine/` | 6 | Engel (Stendhal, 48×64, N/O/S/W) | Rasse "Divine" |
| `voidborn/` | 2 | Gefallene Engel-Varianten (dasselbe Paket wie Divine) | Rasse "Voidborn" |
| `zwerg/` | 5 | Zwergen-Vollkörper (Stendhal) | Rasse "Dwarf" — LPC-Generator hat keine eigene Zwergenstatur |
| `gnom/` | 5 | Gnom-Vollkörper (CC0) | Rasse "Gnom" (kleinste Rasse, 5 Spieler) |
| `goblin/` | 2 | Goblin-Vollkörper | Rasse "Goblin" |
| `insekt/` | 1 | Spinnenwesen (Vollbild) | Insektoide/arachnide Charaktere |
| `pflanze/` | 2 | Humanoider Baum-/Dryaden-Körper (freigestellt) | Rasse "Plant" mit Menschenform (Abgrenzung zur reinen Fressblume in `monster/`) |
| `fisch/` | 8 | Unterwasser-Kreaturen, teils **nicht** im 64px-Raster (32/16px) | "Aqua"-Rassen; Kleinteile eher Deko als Kampf-Sprite |
| `vogel/` | 10 | Harpyie/Vogelmensch-Motive | Avian-Charaktere |
| `schiff/` | 1 | Piraten-Vollbild (Einzelbild, `rows:1`) | Charaktere, die tatsächlich Schiffe sind (Aegirion, Kreischende Kogge) |
| `spec_ops/` | 10 | Moderne/taktische Ausrüstung | Einzige Quelle für nicht-mittelalterliche Kleidung — LPC-Generator hat dafür nichts |
| `waffen/` | 6 | Feuerwaffen-Overlays + Mündungsfeuer | Einzige Quelle für moderne Waffen — LPC-Generator hat nur Fantasy-Waffen |
| `elementar/` | 1 (von 8 möglichen) | Wasserelementar (freigestellt); sieben weitere Motive (Feuer/Blitz/Erde/Licht/Schatten/Leere/Wind) liegen **unbearbeitet** als Referenzblätter bei | s. Abschnitt 5 — sieben von acht Freistellversuchen sind bewusst aufgegeben, nicht vergessen |
| `preview/` | — | Render-Cache aus `scripts/erzeuge-sprite-vorschauen.mjs`, kein Quellmaterial | QA-Galerie, kein `quellen.json` nötig |

**Ausdrücklich ungenutzte Teile — die Liste, in die man zuerst schaut:**

- **`baukasten/flossen.png`** (plus `flossen_walk.png`, `flossen_run.png`, `flossen_shoot.png`,
  `flossen_idle.png`, `flossen_hurt.png`) liegt im Baukasten (`quellen.json`-Eintrag:
  `head/fins/fin/adult/slash.png`, LPC-Lizard-Headgear, OGA-BY 3.0/GPL 3.0/CC-BY-SA 3.0), ist
  aber **weder** in `baukasten/index.json` verzeichnet **noch** irgendwo in
  `battle-mode.engine.js` referenziert (nachgeprüft per Volltextsuche — kein Treffer). Für
  Tidesprinter (Wassermann-Charakter) ausdrücklich als "der richtige Weg" benannt, aber noch
  nicht verdrahtet: *"WAS TIDESPRINTER WIRKLICH BRAEUCHTE: flossen.png liegt im Baukasten und
  ist noch nirgends verdrahtet. Flossen auf einem Echsenkoerper mit tuerkiser Rampe waeren der
  richtige Weg"* (Commit `c9912f8f`).
- **Sieben der acht Elementarwesen-Motive** (`_quelle_elementals1_original.png`,
  `_quelle_elementals2_original.png`) liegen als volle Referenzblätter mit Lila-Hintergrund
  unbearbeitet im Ordner — der Freisteller wurde für sie versucht und **verworfen**, weil das
  Hintergrund-Lila großflächig in der Flügel-Innenzeichnung liegt und sich nicht per Farbton
  von der Gestaltung trennen lässt (`public/sprites/elementar/quellen.json`, Feld
  `_warum_unbearbeitet`). Nur das Wasser-Motiv ist gelöst (s. Abschnitt 5) — und dieser Fix
  liegt bislang nur auf dem Branch `claude/tidesprinter-wasserelementar`, **nicht auf main**.
- **`public/discipline-icons/*.png`** (die produktiv verwendeten, hochauflösenden
  Disziplin-Icons, z. B. `Gewichtheben.png`, 1254×1254) haben **kein** `quellen.json` — Herkunft
  und Lizenz sind für diesen Ordner nirgends dokumentiert. Offene Frage, keine Erfindung: wer
  sie erzeugt hat und woher, müsste vor einer Weitergabe geklärt werden.

---

## 5. Freistellen und Anpassen

### Der bewährte Weg: Flood-Fill vom Bildrand

Das Standardverfahren für ein Blatt mit einer bekannten Hintergrundfarbe (typischerweise ein
Violett-/Lila-Ton wie `#7F00FF`, das in mehreren OpenGameArt-Motiv-Sheets als
Farbschlüssel dient): vom Bildrand aus fluten, jede zusammenhängende Fläche der
Hintergrundfarbe auf Alpha 0 setzen, auf die Inhalts-Bounding-Box zuschneiden, mittig/
bodenbündig auf eine 64×64-Leinwand montieren. So dokumentiert für den Baum-/Dryaden-Körper:
*"aus dem 144x176-Sheet ... wurde nur die Baum-/Dryaden-Zelle ... freigestellt
(Hintergrundfarbe #7F00FF per Farbschluessel transparent gemacht), auf ihre
Inhalts-Bounding-Box zugeschnitten (47x64 Pixel) und mittig/bodenbuendig auf eine 64x64-
Leinwand montiert"* (`public/sprites/pflanze/quellen.json`, Feld `bearbeitung`).

### Wenn die Hintergrundfarbe im Inneren der Figur wiederkehrt

Das Verfahren scheitert, sobald dieselbe (oder eine sehr ähnliche) Farbe **innerhalb** der
Silhouette als Gestaltungsfarbe vorkommt — ein reiner Flood-Fill vom Rand erreicht diese
Flächen nicht über den Rand, sondern sie bleiben als Loch stehen, sobald ein Farbschlüssel statt
eines randbasierten Flood-Fill benutzt wird, oder sie werden fälschlich mitgelöscht, sobald man
den Farbschlüssel bildweit statt nur vom Rand anwendet. Für alle acht Elementarwesen-Motive
wurde genau das beobachtet und **zunächst aufgegeben**: *"Ein Flood-Fill vom Bildrand entfernt
nur den AUSSEN anschliessenden Hintergrund, nicht aber diese im Inneren der Figur
eingeschlossenen, gleichfarbigen Flaechen — das Ergebnis waren Figuren mit sichtbar
durchsichtigen Loechern mitten im Koerper"* (`quellen.json`, Feld `_warum_unbearbeitet`, auf
Branch `claude/tidesprinter-wasserelementar`).

**Die Lösung, die im zweiten Anlauf funktionierte** (nur für das Wasser-Motiv durchgezogen,
`scripts/stelle-wasserelementar-frei.py`, ebenfalls auf demselben Branch, noch nicht auf
`main` gemergt): die inneren Lila-Pixel **nicht löschen, sondern umfärben** — sie sind
Schattierung, keine Luft. Erkannt wird die Zugehörigkeit **über den Farbton**, nicht über einen
festen RGB-Wert: bei echtem Hintergrund-Lila liegt Rot mindestens auf Grün-Höhe und Blau
deutlich darüber (`r >= g and b >= g + 30` im Skript); jedes echte Wasserblau des Motivs hat
dagegen mehr Grün als Rot und bleibt unangetastet. Das Skript zählt die betroffenen Pixel
explizit (289 im Wasser-Fall) — eine nachprüfbare Zahl statt einer Behauptung. Ablauf im Detail:

1. Flood-Fill **nur vom Rand** entfernt den echten Außenhintergrund (Toleranz 40 auf die
   RGB-Distanz zur Hintergrundfarbe).
2. Für alle verbleibenden, nicht transparenten Pixel: liegt der Farbton im Lila-Band
   (`r>=g and b>=g+30`), wird er nach einer Wasser-Farbrampe umgerechnet, abhängig von seiner
   Helligkeit — die Zeichnung (hell/dunkel) bleibt erhalten, nur der Ton wechselt.
3. Zuschnitt auf die Inhalts-Bounding-Box, zentriert auf eine 64×64-Leinwand.

Die übrigen sieben Motive bleiben unbearbeitet: bei den geflügelten Elementarwesen liegt das
Lila großflächig **in** der Flügel-Innenzeichnung und lässt sich nicht mehr eindeutig per
Farbton von echter Gestaltung trennen — der Fall ist ehrlich als ungelöst dokumentiert, nicht
stillschweigend übersprungen.

### Requisiten-Ankerpunkte messen: Handpunkte fürs Ausrüsten

Bevor eine Requisite (Waffe, Schläger, künftig eine Hantel) in eine Hand gezeichnet werden
kann, muss die Position der Hand **gemessen**, nicht geschätzt werden. Verfahren
(`docs/design/sprite-handpunkte.md`, Skripte `scripts/messe-sprite-handpunkte.py` und
`scripts/erzeuge-sprite-handpunkte-beweisbild.mjs`):

1. Das Body-Walk-Blatt aus `SPRITES` extrahieren (Regex auf die Base64-Data-URI, `PIL.Image`
   dekodiert sie).
2. Je Zelle (Blickrichtung × Laufbild) im Höhenband y=36–52 (Schulter- bis Hüfthöhe) die am
   weitesten seitlich ausladenden Pixel suchen — dort, wo die Silhouette am weitesten über den
   Rumpf hinausragt, sitzt die Faust.
3. **Gegenprobe im echten Rendering**: dieselbe Figur über die echte
   `zeichneSprite()`-Pipeline rendern (`window.__arena.renderProbe`, Playwright) und die
   gemessenen Punkte farbig markieren — ein Beweisbild. Landet der Punkt sichtbar nicht auf
   einer Hand, ist die Messung falsch.

Ergebnis für `body_walk`: in Front-/Rückenansicht bleiben beide Hände über den ganzen Laufzyklus
fix (`x=20,y=47` / `x=44,y=47`); im Profil wandert die sichtbare Hand mit dem Schwung, mit einer
dokumentierten Lücke — die "Passier"-Bilder (Spalte 0-2, 7-8 von 9) zeigen **keine eigene
Handkontur**, dafür gibt es bewusst keine erfundene Koordinate, nur eine ausdrücklich als
Interpolation gekennzeichnete Notlösung (`sprite-handpunkte.md`, Abschnitt "Praktische
Notlösung").

**Ein Messfehler, offen gemeldet statt verschwiegen:** der erste Versuch für die
Stand-Frames verwechselte vordere und hintere Hand (Koordinaten geschätzt statt am Profilbild
gemessen); das Beweisbild zeigte den Punkt auf dem Gürtel. Neu gemessen (Farbklassen-Scan statt
Alpha-Silhouette), im zweiten Beweisbild bestätigt (`sprite-handpunkte.md`, Abschnitt "Ein
Messfehler unterwegs").

**Wie die Messung zur Requisite wird:** der Hockeyschläger hängt an genau diesem gemessenen
Punkt, nicht an der Figurmitte — Umrechnung mit demselben Maßstab, den `male()` in
`zeichneSprite()` benutzt: eine Zellkoordinate `(cx,cy)` liegt bei `x-32*Z+cx*Z` und
`y-46*Z+cy*Z` (Commit `7bd21ebd`, Nachricht). Die Haltung (halten/ausholen/schuss) kommt aus
einer separaten Datenfunktion (`hockeySchussPhase`), nicht aus der Zeichenfunktion selbst — Zahl
und Zeichnung sind getrennt, damit eine Kalibrier-Runde nur die eine Seite anfasst.

---

## 6. Die Qualitätsprüfung

**Maßstab:** das Konzept-Portrait (`public/portraits/<slug>.jpg`, 2984 Dateien, 400×400 JPEG)
ist die Vorlage. `data/generated/sprite-fit-bewertung.json` hält das Ergebnis — je Charakter
`sterne` (1-5), `begruendung`, `fehlendesDetail`. Die Rubrik dahinter steht in
`docs/design/sprite-fit-bewertungssystem.md`:

| Sterne | Bedeutung | Anker (Chris' Kalibrierpunkt) |
|---|---|---|
| ★★★★★ | Körpertyp/Rasse/Silhouette UND alle charakteristischen Details treffen | King Arlen Morgolor |
| ★★★★ | Grundidentität korrekt, **genau ein** benennbares Detail fehlt | Krolach (nach Golem-Umbau: Form/Farbe stimmen, Edelstein-Lichter fehlen) |
| ★★★ | Grobe Kategorie stimmt, aber spürbar generisch, mehrere Baustellen | — |
| ★★ | Kategorie verfehlt, aber thematischer Bezug (Farbe/Silhouette-Analogie) erkennbar | — |
| ★ | Kein sinnvoller Bezug, strukturell außerhalb des Baukastens | — |

Erste Bewertungsrunde über 144 Charaktere: 47,9 % ★★, 31,2 % ★★★, 16,7 % ★★★★, 3,5 % ★, 0,7 % ★★★★★
(`docs/design/sprite-fit-ergebnisse.md`). Nebenbefund derselben Runde: mehrere Charaktere teilen
**byte-identische** Sprite-Dateien, obwohl ihre Portraits nichts miteinander zu tun haben — ein
Hinweis darauf, dass ★★-Häufung teils an Wiederverwendung eines generischen Rezepts liegt, nicht
an mangelndem Bestand.

Für eine neue Disziplin überträgt sich dasselbe Prinzip auf **Requisiten und Spielfläche**: die
Frage ist nicht nur "sieht die Figur richtig aus?", sondern "trifft die Requisite die reale
Vorlage?" — bei Hockey war die Referenz die NHL-Maßangabe (Abschnitt 1), bei einer Figur ist es
das Portrait.

### Die Lehre: erst das Bild ansehen, dann suchen

Bei Tidesprinter wurde ein Ersatzmotiv (Wasserelementar) vorgeschlagen und teilweise umgesetzt,
**ohne vorher das Portrait anzusehen** — allein nach der Textbeschreibung in
`lib/battle/subclass-archetypes.ts`. Chris hat korrigiert: *"der sieht ja nicht aus wie ne welle
sondern wie eine schlanke unterwasser kreatur!"* Der Agent räumt das in derselben Sitzung ein:
*"Er hat recht, und ich haette das Portraet vor dem Vorschlag ansehen muessen statt nur die
Textbeschreibung"* (Commit `c9912f8f`, Branch `claude/tidesprinter-wasserelementar`). Das
tatsächliche Portrait (`public/portraits/tidesprinter.jpg`) zeigt eine schlanke Fischhumanoide
mit Schuppenschwanz, türkisem Flossenkamm, Reißzähnen und Dreizack — das Wasserelementar (eine
breite, strömende Wassergestalt) traf das nicht, ein zweiter Versuch über den Baukasten
(Echsenkopf + blaue Haut + Schwanz) ebenfalls nicht (türkise Rampe fehlt, Stab nur während eines
Angriffsbilds sichtbar). Beide Versuche wurden verworfen — *"eine Sackgasse einzubauen ist
schlechter als nichts zu tun"* — Tidesprinter blieb bei seinem alten, ebenfalls unpassenden
`froschmensch.png`, bis ein echter Kandidat gefunden ist.

**Die Regel, die daraus folgt und für jede neue Disziplin/Figur gilt: erst das Bild ansehen,
dann suchen.** Eine Textbeschreibung (und sei sie noch so ausführlich) ersetzt nicht den Blick
auf das Portrait — Silhouette, Requisite, Farbfamilie sind oft anders akzentuiert, als der Text
suggeriert.

---

## 7. Gewichtheben als durchgearbeitetes Beispiel

### Ist-Zustand im Sprite-Motor

Gewichtheben existiert bereits vollständig als Mechanik-Eintrag unter `cat:"buehne"`
(`battle-mode.engine.js:2598`) mit eigenem Rezept (`BUEHNE_ART.gewichtheben`,
`battle-mode.engine.js:7791-7817`: drei Runden, ein gescheiterter Versuch zählt komplett null,
Attribut-Matrix Power 55/Health 25/Determination 20 als Grundlage). Was noch **rein generisch**
ist:

- **Hintergrund**: `bodenBuehne()` (`battle-mode.engine.js:8088-8103`) — ein Podest mit drei
  Scheinwerferkegeln auf dunklem Verlauf, geteilt mit Showcase/Eiskunstlauf/Breaking/Wettessen/
  Speed-Schach/I-Spy. Keine Hantel, keine Bühnenwertungsanzeige, kein Publikum.
- **Figur**: `zeichneBuehne()` (`battle-mode.engine.js:8105-8174`) zeichnet jeden Teilnehmer
  als normale stehende `zeichneSprite()`-Figur mit Ausfallpose (`lunge`) beim aktiven Versuch,
  darunter Name und Punktesäule. **Keine Hantel in der Hand.**
- **Wertungsanzeige**: die generische Punktesäule (relativ zur Feldbreite, Zeile 8146-8151) und
  der Fortschritt "N/rundenN" — kein Kilogramm-Balken, keine Hantel-Grafik.

### Welche Assets es bräuchte

| Asset | Prozedural oder beschaffen? | Begründung |
|---|---|---|
| **Hantel/Langhantel in der Hand** | **Prozedural**, nach dem Muster von `zeichneHockeyschlaeger()` | Dieselbe Logik wie beim Hockeyschläger: eine Hantel muss in vier Blickrichtungen und mindestens zwei Haltungen (halten über Kopf / gerissen am Boden) an einem gemessenen Handpunkt hängen — kein Requisitenblatt im Bestand bildet das ab, und der Bestand enthält (nachgeprüft, Abschnitt 3) **keinen einzigen** Hantel-/Barbell-Treffer. Die Handpunkt-Messung für `body_walk`/`bodyw_walk` liegt bereits vor (`docs/design/sprite-handpunkte.md`) und ist wiederverwendbar — eine Hantel braucht **beide** Hände gleichzeitig (anders als der einhändig geführte Schläger), das Messverfahren selbst bleibt aber identisch |
| **Hebe-Plattform** | **Prozedural**, wie `eisflaeche()`/`bodenFeldspiel()` | Eine Wettkampf-Plattform hat feste reale Maße (IWF-Norm: 4×4 m, quadratisch) — dieselbe "aus echten Maßen übertragen"-Logik wie bei der Eisfläche, nicht freihändig gezeichnet. **Offene Frage:** die genaue IWF-Maßangabe wurde in dieser Sitzung nicht recherchiert (kein Internetzugriff im Auftrag) — vor dem Bau nachschlagen, nicht schätzen |
| **Kilogramm-Anzeige / Hantelscheiben-Stapel** | **Prozedural** | Genau das Muster, das `barbell.tsx` (die *produktive* Arena, `app/foundation/discipline-stage/arena/disciplines/barbell.tsx:328-390`) für den Gewichtsturm bereits verwendet: Rechtecke, deren Höhe/Anzahl aus dem aktuellen kg-Wert berechnet wird, kein Bild. Für den Sprite-Motor wäre dieselbe Idee neu zu bauen (eigene Codebasis, kein gemeinsamer Renderer) |
| **Publikum** | **Beschaffen — aber schon vorhanden.** `public/sprites/basketball/zuschauer.png` ("Welcome to The Arena!", CC-BY 3.0/4.0) ist bereits im Repo, horizontal kachelbar, thematisch neutral (Pixel-Monster-Gesichter) | Vor einer neuen Suche prüfen, ob dieses Blatt für die Bühnen-Disziplinen ausreicht — bislang zeichnet `bodenBuehne()` gar kein Publikum, nur Scheinwerferkegel |
| **Disziplin-Icon** | **Bereits vorhanden**, beide Fassungen | `public/discipline-icons/Gewichtheben.svg` (Platzhalter-Monogramm "GW", `scripts/generate-discipline-icons.ts:14`) und `Gewichtheben.png` (1254×1254, produktiv über `DisciplineIcon.tsx:12` eingebunden, Herkunft **ungeklärt** — s. Abschnitt 4) |
| **Ton (Hantel-Aufschlag, Jury-Signal)** | Nicht recherchiert in dieser Sitzung | Kein Download-Auftrag hier; für eine spätere Runde vormerken |

### Wo mit der Suche anfangen (falls doch beschafft statt gezeichnet werden soll)

Für die Fälle, in denen sich doch ein fertiges Motiv anbietet (z. B. falls eine
Publikums-Variante speziell für eine Kraftsport-Bühne gewünscht wird, statt das
Basketball-Publikum wiederzuverwenden): dieselben zwei Portale, die den bisherigen Bestand
geliefert haben.

- **OpenGameArt.org**, Suchbegriffe: `barbell`, `weightlifting`, `gym equipment`, `sports pack`
  (das Kenney-"Sports Pack (350+)", das schon den Basketballkorb lieferte, ist laut eigenem
  Titel breiter als Basketball allein — lohnt zuerst geprüft zu werden, bevor eine neue Suche
  beginnt).
- **LiberatedPixelCup/universal-lpc-spritesheet-character-generator** (GitHub): für eine
  Requisite in der Hand eher unwahrscheinlich (der Generator ist konsequent
  Mittelalter/Fantasy, s. Abschnitt 3) — aber ein Blick auf die `held`-Kategorien (was Figuren
  in Händen halten können) kostet nichts, bevor man ihn ausschließt.

**Nachgeprüft, nicht nur vermutet:** eine Volltextsuche über alle 18 `quellen.json`-Dateien
nach `hantel`, `barbell`, `dumbbell`, `weightlift`, `gewicht` ergab **keinen einzigen Treffer**
— der Bestand hat für Gewichtheben aktuell nichts vorzuweisen außer der Bühnen-Kulisse und dem
Disziplin-Icon.

---

## Offene Fragen (bewusst nicht beantwortet, statt geraten)

- Herkunft und Lizenz von `public/discipline-icons/*.png` (produktive Disziplin-Icons,
  Gewichtheben eingeschlossen) — kein `quellen.json` im Ordner, keine Spur in der Git-Historie
  außerhalb des Platzhalter-Generators.
- Die IWF-Normmaße einer Gewichtheber-Plattform (Länge/Breite) — für eine "aus echten Maßen
  übertragen"-Umsetzung wie bei der Eisfläche nötig, in dieser Sitzung nicht recherchiert.
- Ob `scripts/stelle-wasserelementar-frei.py` und das freigestellte
  `elementarwesen_wasser.png` (Branch `claude/tidesprinter-wasserelementar`) inzwischen nach
  `main` gemergt sind — zum Zeitpunkt dieser Recherche noch nicht.
- Ton-Assets für Gewichtheben (Hantel-Aufschlag, Jury-Lampe/-Pfiff) — nicht Teil dieser
  Recherche.

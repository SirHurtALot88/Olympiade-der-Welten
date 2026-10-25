# Sprite-Fit-Zweistern-Runde A (16.10.) — zwölf Einzelfälle, kein Cluster

Zwölf Charaktere standen bei ★★ (Kategorie passt kaum/ist stark verfälscht, aber ein loser
Bezug bleibt, s. [`sprite-fit-bewertungssystem.md`](./sprite-fit-bewertungssystem.md)): Aegirion,
Brunhilde, Crumbsage, Draco, Eldara, Falcon, Harbinger, Kento, Lady Mournvale, Lucky, Lys
Puppenkopf, Mindtamer. Anders als bei [`sprite-cluster-runde-1.md`](./sprite-cluster-runde-1.md)
teilten sich keine zwei davon ein byte-identisches `BAU`-Rezept — zwölf unabhängige Charaktere,
keine Gruppen. Vorgehen, Verifikationsmethode und PR-Form folgen trotzdem demselben Muster wie
dort: Portrait und Sprite-Vorschau einzeln nebeneinandergelegt, ein eigenständiges Rezept je
Charakter, `data/generated/sprite-fit-bewertung.json` im selben Commit aktualisiert.

## Zwei Funde, die über die Hälfte der Fälle erklären

Vor dem eigentlichen Rezeptbau fielen zwei stille Bugs auf, die mehrere Charaktere gleichzeitig
betrafen — ihre Behebung trägt einen guten Teil der Hebung in dieser Runde:

1. **`haut:"fur_white"` existiert nicht.** Falcons Nachlieferung vom 13.10. hatte die Hautfarbe
   auf `"fur_white"` umgestellt, mit dem Kommentar "existiert als Rampe, s. HAUT" — das stimmt
   nicht. Die vollständige `HAUT`-Tabelle kennt nur `light/green/bright_green/dark_green/blue/
   olive/brown/fur_grey/fur_brown/lavender/black/amber/pink`, kein `fur_white`. `faerbe(img,ton)`
   fällt bei einem unbekannten Ton auf das ungefärbte Originalbild zurück (`if(!ziel||!img.width)
   return img;`) — der alte "Fix" war ein stiller No-Op, der Wolfskopf blieb in seiner dunklen
   Rohfarbe. Echter Fix: `"fur_grey"` (existiert, helles Grauweiß `#B8BBBC` am Rampenende).
2. **`b.kapuze` wird nie eingefärbt.** Anders als `b.helm` (`zeichneR(...,b.ruestTon)`) zeichnet
   sowohl `zeichneSprite` als auch die Kader-Ikone die Kapuze mit einem festen `null`-Tonwert
   (`zeichne("kapuze_"+ani,64,0,0,null)` / `setz("kapuze_walk",null)`) — jede Figur mit
   `kapuze:true` bleibt beim hellen Rohton des Blatts, egal welchen `ruestTon` ihr Rezept setzt.
   Für Kento (durchgehend schwarz maskierter Ninja) war das der Hauptgrund für die 2-Sterne-
   Bewertung. Keine Ein-Zeilen-Korrektur am Rezept behebt das (strukturelle Engine-Lücke, betrifft
   jede Kapuzenträgerin) — stattdessen `helm` statt `kapuze` verdrahtet, da `helm_*` korrekt über
   `ruestTon` eingefärbt wird und den Kopf ebenso blickdicht abdeckt.

Beide Funde sind im Code dokumentiert (Kommentar bei `BAU["Falcon"]`/`BAU["Kento"]`) und nicht
rückwirkend für alle anderen `kapuze`-Träger behoben — das wäre ein eigener, größerer Auftrag
(mehrere Charaktere, jeweils mit Sichtprüfung, dieselbe Regel wie beim offen gelassenen
`leder_frau`-Rollout im Baukasten-README) und lag außerhalb dieser Runde.

## Zwei strukturelle Grenzen — neue, aber minimale Requisiten-Funktionen

Lady Mournvale (leeres, ringförmiges Void-Gesicht) und Lys Puppenkopf (übergroßer, tropfäugiger
Puppenkopf) zeigen beide ein komplett kopf-ersetzendes, prägendes Merkmal, für das keine
vorhandene Baukasten-Ebene etwas hergibt — genau die beiden Fälle, die der Auftrag vorab als
mögliche strukturelle Grenzen benannte. Nach demselben, bereits viermal bewährten Muster
(`zeichneKameraKopf`/Vigil, `zeichneZwiebelKopf`/Byrd, `zeichneEimerKopf`/Orakelpfropf,
`zeichneKuchenKopf`/Byrnja — alle reine Canvas-Formen statt Sprite-Layer, weil kein Blatt im
Baukasten das Motiv zeigt) kamen zwei neue, isolierte Zeichenfunktionen dazu:

- **`zeichneRinggesicht`** (`ringgesicht:true`): ein dreifach gerillter, elfenbeinfarbener Ring
  um einen pechschwarzen Kern — ersetzt das Gesicht komplett, blickdicht wie Zwiebel/Kuchen.
- **`zeichnePuppenKopf`** (`puppenkopf:true`): bewusst GRÖSSER als die anderen Kopf-Requisiten
  (Bildbefund: "der Kopf ist größer als der Körper"), zwei hohle Augenhöhlen mit Tropflinien nach
  unten, feine Risslinien im bleichen Ton, ersetzt den Kopf komplett.

Beide sind an genau den zwei bestehenden Call-Sites verdrahtet, an denen auch die vier
Vorgänger-Requisiten hängen: die animierte `zeichneSprite`-Figur und die Kader-/Board-Ikone.

## Rezepte im Einzelnen

| Charakter | Vorher | Sterne | Geändert? | Sterne nachher |
|---|---|---:|---|---:|
| **Aegirion** | `vollbild:"schiff_pirat"`, warmes Holzbraun | ★★ | `vollbildFarbe` auf kühles Rost-/Stahlgrau, `effekt:{feuer,koerper}` + `gluehenderRiss` für Rauch/Glühen | ★★★ |
| **Brunhilde** | Mensch/Leder, sandfarbenes Haar, nur Axt | ★★ | `kapuze:true` (Pelzkapuze-Näherung), `ruestTon:"bronze"`, `haarTon:"white"`, `effekt:{frost,koerper}` | ★★★★ |
| **Crumbsage** | `kopf:"orc"`, braun, `effekt:"frost"` (widersprüchlich) | ★★ | `vollbild:"golem"`, Keksteig-Goldbraun, `energiekern` (glühende Augen), `effekt:{arkan,koerper}` | ★★★★ |
| **Draco** | Helm/Hörner/Axt/Schild/Kopf-Feuereffekt | ★★ | `gluehenderRiss:true` für glühende Rissader über den Torso | ★★★ |
| **Eldara** | Mensch/Leder, `haut:"light"`, `effekt:"feuer"` (flackernd, falsch) | ★★ | `ruest` entfernt, `haut:"brown"` (rindenartig, macht auch Hörner sichtbar), `effekt:{heilig,kopf}` (ruhiger Goldschein) | ★★★ |
| **Falcon** | `haut:"fur_white"` (existiert nicht, No-Op) | ★★ | `haut:"fur_grey"` (echter Fix) | ★★★★ |
| **Harbinger** | `haut:"black"` (endet in Braun), `effekt` am Körper | ★★ | `haut:"fur_grey"`, `effekt` auf `pos:"kopf"`, `skala:1.1` | ★★★ |
| **Kento** | `kapuze:true` (nie eingefärbt, bleibt hell) | ★★ | `kapuze` gegen `helm` getauscht (wird über `ruestTon` eingefärbt) | ★★★★ |
| **Lady Mournvale** | gewöhnliches Gesicht | ★★ | NEU `ringgesicht:true` (`zeichneRinggesicht`) | ★★★★ |
| **Lucky** | `ruest:"leder"` ungetönt (natürliches Braun) | ★★ | `ruestTon:"dunkel"` (schwarze Lederjacke) | ★★★ |
| **Lys Puppenkopf** | gewöhnlicher Mädchenkopf | ★★ | NEU `puppenkopf:true` (`zeichnePuppenKopf`), `ruestTon:"violett"` | ★★★★ |
| **Mindtamer** | `helm:true` (undurchsichtiger grauer Ritterhelm, Widerspruch zum Glaskolben) | ★★ | `helm` entfernt, `effekt:{arkan,kopf}` | ★★★ |

Alle zwölf erreichen mindestens ★★★, sechs davon ★★★★. Keiner erreicht ★★★★★ — bei jedem bleibt
mindestens eine benennbare Lücke (s. `fehlendesDetail` je Eintrag in
`data/generated/sprite-fit-bewertung.json`), oft eine echte Baukasten-Grenze: kein Begleittier-
System (Brunhildes Wolf), kein Vogel-/Schnabelkopf unter den 23 Kopf-Typen (Falcon), keine zweite
gleichzeitige Waffe (Harbingers Energieklinge), keine Wurfmesser/Kleinrequisiten (Luckys
Bandoliere/Münzen). Lady Mournvale und Lys Puppenkopf landen bei ★★★★ statt ★★★★★ — derselbe
Maßstab wie beim Vigil-Kamera-Präzedenzfall (volle prozedurale Kopf-Requisite statt echtem
Sprite-Asset, dort ausdrücklich bei 4 statt 5 Sternen verankert, s.
`sprite-fit-bewertungssystem.md`).

### Baukasten-Grenzen, die über den Einzelfall hinausreichen

- **Kein Vogel-/Schnabelkopf.** Die vollständige `kopf`-Liste (23 Typen, ausgezählt statt
  geschätzt: `alien/boarman/frankenstein/goblin/human/humanw/jack/lizard/minotaur/mouse/orc/
  orc_frau/pig/rabbit/rat/sheep/skeleton/troll/vampire/wartotaur/wolf/wolf_frau/zombie`) enthält
  keinen einzigen avianen Kopf. Falcon bleibt deshalb bei `kopf:"wolf"` — die nächstliegende
  Raubtier-Silhouette, kein Adler.
- **`b.kapuze` wird nie eingefärbt** (s. oben) — betrifft jede Figur mit `kapuze:true`, nicht
  nur Kento. Ein künftiger, eigener Auftrag könnte entweder die Engine korrigieren (Kapuze über
  `ruestTon` einfärben wie der Helm) oder systematisch durchzählen, welche der Kapuzenträger das
  überhaupt betrifft.
- **Keine Zweitwaffe gleichzeitig zur Hauptwaffe.** `b.waffe` kennt genau einen Wert — Harbingers
  Energieklinge neben der Pistole, Luckys Wurfmesser neben potenziell leeren Händen bleiben
  unrepresentiert.

## Verifikation

**Syntax:**

```
node --check public/mockups/battle-mode.engine.js
```

→ OK.

**Reine Zeichenfunktionen, keine Simulationswirkung.** `aufEignung()` (Zeile ~6776) rechnet
ausschließlich mit den numerischen Attributen (`LP`/`VER`/`ANG`/Eignungswert) und referenziert an
keiner Stelle `BAU`, `kopf`, `ruest`, `effekt`, `vollbild`, `gluehenderRiss`, `energiekern`,
`skala`, `ringgesicht` oder `puppenkopf` — dieselbe Trennung, die `sprite-cluster-runde-1.md`
schon für den vorigen Durchgang nachgewiesen hat (keine zweite Bauplan-Tabelle, `BAU`/
`zeichneSprite`/`figur()` sind reine Zeichenfunktionen). Die beiden neuen Felder `ringgesicht`/
`puppenkopf` sind ausschließlich an den zwei bekannten Zeichenstellen (`zeichneSprite`, Kader-
Ikone) verdrahtet, an denen auch `zwiebelkopf`/`eimerkopf`/`kuchenkopf` hängen — keine dritte
Stelle, kein Simulationscode.

**Regressionskontrolle** (`node scripts/miss-alle-disziplinen.mjs 24`, dieselben kaderfesten
Team-Paarungen wie in `docs/design/stand-aller-disziplinen.md`):

```
Disziplin           Chassis     Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite   Abnahme
time-trial          bahn           12                  0.943       0.049                0.951       0.049   bestanden
staffel             bahn           12                  0.937       0.089                0.958       0.229   bestanden
wettessen           buehne         12                  0.910       0.122                0.937       0.126   bestanden
speed-schach        buehne         12                  0.910       0.089                0.986       0.042   bestanden
spurt               bahn           12                  0.910       0.142                0.963       0.086   bestanden
takeshis-castle     bahn           12                  0.898       0.062                0.986       0.021   bestanden
eiskunstlauf        buehne         12                  0.866       0.105                0.986       0.035   bestanden
gewichtheben        buehne         12                  0.865       0.143                0.944       0.147   bestanden
fechten             buehne         12                  0.860       0.191                0.937       0.140   bestanden
showcase            buehne         12                  0.835       0.148                0.937       0.084   bestanden
climbing            bahn           12                  0.833       0.135                0.881       0.126   bestanden
football            feldspiel      12                  0.815       0.099                0.902       0.105   bestanden
tennis              buehne         12                  0.813       0.199                0.944       0.287   bestanden
breaking            buehne         12                  0.801       0.289                0.944       0.315   bestanden
basketball          feldspiel      12                  0.795       0.085                0.881       0.140   knapp
i-spy               buehne         12                  0.750       0.177                0.881       0.210   knapp
hockey              feldspiel      12                  0.640       0.222                0.797       0.098   durchgefallen
  davon nur Feldspieler            12                  0.676       0.171                0.782       0.210   durchgefallen
mini-dm             arena           8                  0.635       0.710                0.643       1.024   durchgefallen
battlefield         arena           8                  0.399       0.834                0.310       1.095   durchgefallen
tdm                 arena          12                  0.324       0.861                0.308       0.881   durchgefallen
Seitenfehler: keine
```

→ Muster unveraendert zur bekannten Baseline (Arena faellt durch wie immer, Basketball/I-Spy
"knapp" wie immer) — keine der zwölf geänderten Zeilen (auch nicht `vollbild`, `energiekern`,
`gluehenderRiss`, `skala`, `ringgesicht`, `puppenkopf`) wird von `aufEignung`/`MOTOREN` gelesen,
die Zahlen bestaetigen das.

**Vorschau-Screenshots:** alle zwölf Vorschauen (`public/sprites/preview/<slug>.png`) frisch über
`node scripts/erzeuge-sprite-vorschauen.mjs "<Name>"` erzeugt — exakt dasselbe `renderProbe()`,
das auch die Live-Kartenschmiede/Kader-Galerie zeigt, kein separater Zeichenpfad. Vorher/Nachher
je Charakter liegt im PR-Diff von `public/sprites/preview/`.

## Was übrig bleibt (nicht in diesem PR)

- **`b.kapuze`-Einfärbung** betrifft laut Baukasten-README mindestens die bekannten
  `leder_frau`-Fälle und vermutlich weitere Kapuzenträger — eigener, systematischer Auftrag.
- **Falcons Vogelkopf** bleibt eine echte Baukasten-Lücke (kein avianer Kopf-Typ) — nur über ein
  neues Sprite-Blatt oder eine siebte Kopf-Requisiten-Funktion lösbar, beides außerhalb dieser
  Runde.
- Mehrere Charaktere (Harbinger, Lucky, Eldara) bräuchten eine Zweitwaffen- bzw.
  Kleinrequisiten-Ebene, die es im Baukasten noch nicht gibt.

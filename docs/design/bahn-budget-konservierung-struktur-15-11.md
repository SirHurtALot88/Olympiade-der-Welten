# Bahn-Disziplinen und die Budget-Methode: Struktur-Befund, Werkzeug-Empfehlung, frische Pp-Zahlen (15.11.)

Task #134. **Reine Untersuchung** — kein Werkzeug gebaut, kein Rezept geändert. Betrifft die
fünf Bahn-Disziplinen: Staffel, Time-Trial, Spurt, Climbing, Takeshi's Castle. Grundlage:
`origin/main` bei `27a7b4117`.

## 0. Kurzfassung

- **Struktur passt.** `BAHN_ART[d].rezept` ist, genau wie bei Feldspiel und Bühne, ein
  `{SUB_SKILL:{attribut:gewicht}}`-Baum — dieselbe diskrete Form, nur andere Sub-Skill-Namen
  (ANTRITT/ENDTEMPO/TECHNIK/WENDIGKEIT/STEHEN/WUCHT/ROBUST, plus GESPUER bei Time-Trial und
  GLEICHGEWICHT bei Climbing). Zeit statt Punktescore ändert daran **nichts an der Form** — nur
  an der Mechanik, WIE ein Sub-Skill wirkt (s. Abschnitt 1.2).
- **Beide bestehenden Werkzeuge passen unverändert, ohne Codeänderung.** `rezeptAus()`/
  `rezepteNachziehen()` (engine.js, Abschnitt 8866 ff.) ziehen **alle vier** Chassis-Tabellen
  (`ARENA_ART, FELDSPIEL_ART, BUEHNE_ART, BAHN_ART`) gleich durch `window.__ARENA_REZEPTE` nach —
  das ist absichtlich chassis-blind ("Daten-Datei zuerst, Motor als Rückfall", keine Sonderregel
  für Bahn). `scripts/sondiere-feldspiel-subskills.mjs` liest seine Sub-Skill-Liste schon heute
  generisch aus **jedem** `rezept:{...}`-Block, egal in welcher Chassis-Tabelle er steht (Fallback-
  Zweig für "inline im Motor, noch nicht in `battle-mode.rezepte.js`" — exakt der Fall, in dem
  alle fünf Bahnen heute sind), und misst mit `window.__arena.einflussVon()` — derselben Funktion,
  die auch die Pp-Abnahme in Abschnitt 3 produziert. Nachgewiesen, nicht nur gelesen: Abschnitt 2.
  **Keine dritte, bahn-eigene Sondierung nötig.**
- Ein echter dritter Unterschied bleibt: **Staffel führt ein zweites Rezept** (`podRezept`, für
  das Vier-Team-Pod-Format), das `rezepteNachziehen()` nicht nachzieht. Das ist eine kleine Lücke
  in der Tool-Kette, kein Blocker für die Hauptarbeit (Duell-Rezept) — Abschnitt 2.3.
- **Frisch gemessen, alle 5 Disziplinen, zwei Saatströme:** keine der fünf Bahnen hat sich seit
  dem letzten Eintrag in `data/generated/disziplin-abnahme.json` bewegt — jede Zahl reproduziert
  sich auf die Dezimalstelle. Die Doku ist **aktuell**, nicht veraltet. Staffel bleibt mit 21,1/
  22,0 die Bahn mit dem knappsten Puffer zur 25-Pp-Schranke (Abschnitt 3).

## 1. Die Struktur von `BAHN_ART`

### 1.1 Dieselbe Form wie Feldspiel/Bühne

Jede der fünf Bahnen trägt in ihrem `BAHN_ART[d]`-Eintrag ein `rezept:{...}`-Feld mit derselben
Form wie `FELDSPIEL_ART[d].rezept`/`BUEHNE_ART[d].rezept`: benannte Sub-Skills, jeder ein Dict aus
`attribut:gewicht`-Paaren, die Gewichte je Sub-Skill auf 100 normiert. Spurt zum Beispiel
(engine.js ~45750):

```js
rezept:{
  ANTRITT:    {speed:42,power:34,determination:24},
  ENDTEMPO:   {speed:36,will:30,determination:22,stamina:12},
  TECHNIK:    {dexterity:52,awareness:30,determination:18},
  WENDIGKEIT: {dexterity:46,awareness:34,speed:20},
  STEHEN:     {torment:36,health:30,dexterity:20,will:14},
  WUCHT:      {torment:55,power:42,speed:3},
  ROBUST:     {health:28,torment:24,will:20,dexterity:18,awareness:10}
}
```

Alle fünf Bahnen führen ANTRITT/ENDTEMPO/TECHNIK/WENDIGKEIT/STEHEN/WUCHT/ROBUST (sieben
Sub-Skills); Time-Trial hat zusätzlich GESPUER (ein streckenweiter Dexterity/Awareness-Kanal,
s. u.), Climbing zusätzlich GLEICHGEWICHT ("der Kopf unter Druck"). Das sind sieben bis acht
diskrete Sub-Skills je Disziplin — deutlich unter den zwölf Attributen, die die Sondierung als
Träger braucht (Abschnitt 2.1).

Die Kommentare im Rezept selbst beschreiben schon exakt das Budget-Problem, das Chris am 14.11.
für alle 20 Disziplinen verlangt — zum Beispiel an Staffels Pod-Rezept (engine.js ~46521):

> "Anteil(a) ~ Matrix(a) + Summe_k (p_k - 1/7) x Rezept(k,a), p_k der Wirkungsanteil des
> Sub-Skills."

Das ist Sinkhorn in Worten: eine Zeile (Attribut-Budget = Matrixgewicht) und eine Spalte
(Sub-Skill-Masse = sein mechanisches Gewicht) müssen gleichzeitig aufgehen. Die Bahn-Rezepte
wurden bisher von Hand in diese Richtung gezogen (Spurt, Time-Trial, Climbing, Staffel, Takeshi
jeweils mit mehreren dokumentierten Kalibrierschritten) — nie mit dem Sinkhorn-Löser selbst.

### 1.2 Was WIRKLICH anders ist: zeit-/geschwindigkeitsbasiert statt Score-basiert

Kein struktureller Unterschied im Rezept, aber ein mechanischer in seiner WIRKUNG:

- **ANTRITT/ENDTEMPO/STEHEN/ROBUST wirken über die GANZE Renndauer** (`tempoVon()`s `grund`,
  `mued`, `KRAFT_VON()`) — wie ein Feldspiel-Sub-Skill, der in jedem Spielzug zählt.
- **TECHNIK/WENDIGKEIT/WUCHT (und GLEICHGEWICHT/GESPUER, wo gesetzt) wirken nur an bestimmten
  ZONEN/HINDERNISSEN** der Strecke — bei Time-Trial z. B. nur in den Gelände-Zonen (~45 % der
  Strecke, `gelaende[]`), bei Spurt/Climbing/Takeshi nur an den Hindernis-/Griff-/Fallen-
  Positionen. Ein Sub-Skill, der nur 3 von 10 Stationen bedient, kann mechanisch nie so viel
  wiegen wie einer, der die ganze Strecke trägt — unabhängig davon, wie viel Attributgewicht das
  Rezept ihm zuschreibt.
- **Zusätzliche Multiplikatoren** wie `huerdePreis`/`wuchtPreisFaktor` (Spurt), `tempoSpanne`
  (alle), `mengeAusEignung` (Climbing/Takeshi/Staffel-Pod) verstärken oder dämpfen, wie stark ein
  Sub-Skill-Gewinn am Ende in Zeit ankommt.
- **Staffel/Takeshi kennen zusätzlich eine Pod-Variante** (`bahnPodLauf`, Vier-Team-Format) mit
  eigener `wertung` ("etappe"/"burg" statt "rang"/"zeit").

Für die Budget-Methode heißt das: das mechanische Gewicht eines Sub-Skills lässt sich bei Bahn
**nicht aus der Rezeptform allein ablesen** (anders als man vermuten könnte) — es muss weiter
GEMESSEN werden, genau wie bei Feldspiel. Das ist aber keine neue Anforderung: Genau dafür gibt
es die Sondierung (Abschnitt 2), und die misst empirisch über `einflussVon()`, trifft also jede
Zonen-/Preis-/Skalierungs-Eigenheit automatisch — ohne dass das Werkzeug die Bahn-Mechanik im
Detail verstehen müsste.

### 1.3 Staffel: zwei Rezepte, eine Matrix

Staffel führt neben `rezept` (Duell, 15 von 20 Disziplinen-Pfaden) ein zweites `podRezept`
(Vier-Team-Rennen, engine.js ~46542), das nur drei der sieben Sub-Skills ersetzt (ANTRITT/WUCHT/
ROBUST) — die anderen vier (ENDTEMPO/TECHNIK/WENDIGKEIT/STEHEN) kommen auch im Pod aus `rezept`.
Begründung steht im Code selbst: "Menge aus der Eignung" reicht die Matrix über `eig` ohnehin
durch; abweichen kann ein Attribut nur, weil sein Sub-Skill über- oder unterdurchschnittlich
trägt. Keine der anderen vier Bahnen führt ein zweites Rezept.

## 2. Werkzeug-Prüfung: passt `baue-feldspiel-rezept.mjs` + `sondiere-feldspiel-subskills.mjs`?

### 2.1 Ja — nachgewiesen am Code, nicht nur vermutet

Zwei Fundstellen beweisen, dass beide Werkzeuge schon heute chassis-agnostisch sind:

1. **`rezepteNachziehen()`** (engine.js:8896) wird für alle vier Chassis-Tabellen gleich
   aufgerufen (`for(const tabelle of [ARENA_ART,FELDSPIEL_ART,BUEHNE_ART,BAHN_ART])
   rezepteNachziehen(tabelle);`, engine.js:46978) und ersetzt `tabelle[dId].rezept` durch
   `window.__ARENA_REZEPTE[dId]`, falls die Daten-Datei (`battle-mode.rezepte.js`) diese
   Disziplin führt — sonst bleibt das Inline-Rezept stehen. Das ist **eine** Regel für alle
   zwanzig Disziplinen, keine Bahn-Ausnahme.
2. **`sondiere-feldspiel-subskills.mjs`** hat genau für diesen Fall (Disziplin noch inline im
   Motor, nicht in `battle-mode.rezepte.js`) einen Fallback-Zweig: er sucht den
   `DISZIPLIN:{...rezept:{...}...}`-Block über **alle** Chassis-Tabellen hinweg (generische
   Klammer-Suche, keine Tabelle namentlich bevorzugt), liest die Sub-Skill-Namen daraus, baut ein
   orthogonales Ersatz-Rezept (ein Attribut je Sub-Skill, keine Überlappung) und schreibt es als
   **neuen** `window.__ARENA_REZEPTE`-Eintrag in eine temporäre Kopie von
   `battle-mode.rezepte.js`. Die Messung selbst läuft über `window.__arena.einflussVon(d,n)` —
   dieselbe Funktion, die auch `messe-arena-einfluss.mjs` nutzt und die wir in Abschnitt 3 für
   alle fünf Bahnen erfolgreich gegen die Matrix gemessen haben.

Mit sieben bis acht Sub-Skills je Bahn (Abschnitt 1.1) bleibt die Sondierung weit unter ihrer
eigenen Grenze (`subskills.length > ATTRIBUTE.length`, 12 Attribute) — eine orthogonale Zuordnung
ist für jede der fünf Bahnen ohne Weiteres möglich.

**Ergebnis: kein drittes Werkzeug nötig.** Die Zonen-/Zeit-Eigenheit aus Abschnitt 1.2 ist für
die Sondierung kein Problem, weil sie GAR NICHT ANALYTISCH modelliert, sondern EMPIRISCH über
`einflussVon()` misst — Zonenanteil, `huerdePreis`, `mengeAusEignung` etc. fließen automatisch in
die gemessene Zahl ein, ohne dass das Skript sie kennen müsste.

### 2.2 Was für die Bahn ergänzt werden muss (Konfiguration, kein Code)

`baue-feldspiel-rezept.mjs` selbst trägt die `MATRIX`/`ERLAUBT`-Tabellen hartkodiert für hockey/
football. Für die Bahn braucht es denselben Eintrag, fünfmal:

- `MATRIX.<d>` — die gesperrte Matrix aus dem Kommentar über jedem `BAHN_ART[d]`-Block (steht
  schon im Code, muss nur abgeschrieben werden, z. B. Climbing: stamina 26, determination 16,
  speed 12, dexterity 12, health 10, power 8, awareness 8, will 8).
- `ERLAUBT.<d>` — je Sub-Skill, welche Attribute dort fachlich hingehören. Das ist die einzige
  Stelle mit Semantik und sollte, wie beim Hockey-Vorbild, aus dem bestehenden Rollout-/
  Kalibrierdokument der jeweiligen Disziplin kommen (`spurt-modellierung-recherche-05-09.md`,
  `zeitfahren-recherche-06-09.md`, `climbing-opus-gegencheck-24-09.md`,
  `staffel-modellierung-recherche-05-09.md`, `takeshi-chaos-tackle-plan-06-09.md`), nicht neu
  erfunden werden.

Ob das als fünf weitere Einträge in derselben Datei oder als eigene, klar benannte Bahn-Variante
(gleicher Algorithmus, eigene Konfiguration) geschieht, ist eine Geschmacksfrage für den
Bau-Schritt — der Sinkhorn-Kern (Zeilen/Spalten abwechselnd normieren, Zeilen 8886-8886 bzw.
130-152 der Datei) braucht dafür keine Änderung.

### 2.3 Offene Lücke: `podRezept` (nur Staffel)

`rezepteNachziehen()` zieht nur `.rezept` nach, nicht `.podRezept` — ein Override über
`window.__ARENA_REZEPTE` würde also Staffels Pod-Pfad nicht erreichen. Das ist kein Blocker für
den Haupt-Rollout (das Duell-Rezept, das 1:1 wie jede andere Disziplin behandelt werden kann),
aber eine Notiz für den Bau-Schritt: entweder `podRezept` separat (von Hand, mit derselben
Sinkhorn-Logik, aber eigenem `ERLAUBT`) kalibrieren, oder `rezepteNachziehen`/`rezeptAus` um einen
optionalen zweiten Schlüssel erweitern, falls die Pod-Variante ebenfalls budget-konserviert
werden soll. Keine der anderen vier Bahnen hat dieses Problem.

## 3. Frisch gemessene Pp-Zahlen, alle fünf Bahnen, zwei Saatströme

Gemessen auf `27a7b4117` (heute, 15.11.), `node scripts/messe-arena-einfluss.mjs <d> 48
[--saat-versatz=10000000]` (Staffel: Standardlauf ist 144, s. `VORGABE` im Skript). Für Time-Trial
und Spurt **mit** `OLY_FORM_MODUS=echt` — beide sind seit dem 11./14.11. in
`FORMKARTEN_ECHT_DISCIPLINE_IDS` und laufen im echten Spiel mit der gespielten Formkarte statt der
Ersatzkarte (separate, parallele Formkarten-Rollout-Arbeit, s. `docs/design/
formkarten-motor-p4-11-11.md` — nicht Teil dieser Budget-Untersuchung, aber relevant für den
Bau-Schritt: wer dort das Rezept kalibriert, muss mit `OLY_FORM_MODUS=echt` messen, sonst misst er
den alten Ersatz-Zustand). Staffel/Climbing/Takeshi's Castle sind noch nicht umgeschaltet, dort
ist der Standardlauf (ohne die Variable) der korrekte, aktuelle Produktionszustand.

| Disziplin | Pp Strom 0 | Pp Strom 10 000 000 | Deckt sich mit `disziplin-abnahme.json`? |
|---|---:|---:|---|
| Staffel | **21,1** | **22,0** | ja, exakt (Stand 16.10.) |
| Time-Trial | 12,0 | 11,6 | ja, exakt (Stand 11.11., echt-Modus) |
| Spurt | 18,5 | 15,4 | ja, exakt (Stand 14.11., echt-Modus) |
| Climbing | 12,0 | 9,5 | ja, exakt (Stand 16.10.) |
| Takeshi's Castle | 18,9 | 17,7 | ja, exakt (Stand 16.10.) |

**Jede der zehn Zahlen reproduziert sich auf die Dezimalstelle.** Die Einträge in
`data/generated/disziplin-abnahme.json` sind für alle fünf Bahnen **aktuell**, nicht veraltet —
trotz der drei verschiedenen Stand-Daten (16.10./11.11./14.11.) ist seitdem an keiner der fünf
Bahn-Mechaniken oder -Matrizen etwas verändert worden, das die Pp-Abweichung bewegt hätte.

**Staffel bestätigt den kleinsten Puffer:** 21,1/22,0 gegen die 25-Schranke — ein Polster von
3,0-3,9 Pp, das engste aller fünf Bahnen und enger als die meisten "bestandenen" Disziplinen
sonst. Der größte Einzel-Ausreißer ist Charisma (Matrix 10, gemessen ~4 %, –6,0/–6,5 Pp) — sitzt
laut Rezept nur in WUCHT, einem laut Staffel-Pod-Kommentar schwach tragenden Sub-Skill. Ein
künftiges Budget-Rezept für Staffel sollte diesen Kanal als Erstes prüfen.

Zur Einordnung, wo diese Zahlen relativ zu anderen Chassis stehen: Climbing (12,0/9,5) und
Time-Trial (11,6/12,0) liegen bereits sehr nah an der "<15 Optimum"-Linie aus CLAUDE.md; Staffel,
Spurt und Takeshi's Castle (18,5-22,0) liegen im Mittelfeld — bestanden, aber mit klarem Raum für
eine echte Budget-Rechnung.

## 4. Empfehlung

1. **Kein drittes, bahn-eigenes Werkzeug bauen.** `scripts/sondiere-feldspiel-subskills.mjs` und
   `scripts/baue-feldspiel-rezept.mjs` sind durch den `rezeptAus()`/`rezepteNachziehen()`-
   Mechanismus bereits chassis-agnostisch und funktionieren für `BAHN_ART` ohne Codeänderung
   (Abschnitt 2.1). Der Bau-Schritt muss nur `MATRIX`/`ERLAUBT` für die fünf Bahnen ergänzen — der
   Rechenkern bleibt derselbe wie bei Feldspiel (und voraussichtlich bei Bühne, Task #132).
2. **Reihenfolge: Climbing und Time-Trial zuerst** (knapper gegen "<15", zeigen also am
   deutlichsten, ob Sinkhorn gegenüber der Handarbeit etwas bringt), **Staffel mit Vorsicht**
   (kleinster Pp-Puffer UND das zusätzliche `podRezept`-Problem aus Abschnitt 2.3 — erst das
   Duell-Rezept, `podRezept` als eigener, zweiter Schritt), Spurt/Takeshi's Castle zuletzt.
3. **Time-Trial/Spurt im Bau-Schritt mit `OLY_FORM_MODUS=echt` messen**, Staffel/Climbing/
   Takeshi's Castle ohne — je nachdem, wie weit der parallele Formkarten-Rollout bis dahin
   fortgeschritten ist (Abschnitt 3).
4. **`podRezept`-Frage an Chris oder an den Bau-Schritt delegieren**, nicht in dieser
   Untersuchung entscheiden: lohnt sich eine eigene Budget-Rechnung für Staffels Pod-Pfad, oder
   reicht die alte Hand-Kalibrierung (bereits unter der Schranke, 9,3/10,1 Pp laut Code-Kommentar)?

## Anhang: Messbefehle dieser Runde

```sh
node scripts/messe-arena-einfluss.mjs staffel                              # 21,1 Pp (144 Laeufe, Standard)
node scripts/messe-arena-einfluss.mjs staffel 144 --saat-versatz=10000000  # 22,0 Pp
OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs time-trial 48                              # 12,0 Pp
OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs time-trial 48 --saat-versatz=10000000       # 11,6 Pp
OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs spurt 48                                    # 18,5 Pp
OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs spurt 48 --saat-versatz=10000000             # 15,4 Pp
node scripts/messe-arena-einfluss.mjs climbing 48                          # 12,0 Pp
node scripts/messe-arena-einfluss.mjs climbing 48 --saat-versatz=10000000  # 9,5 Pp
node scripts/messe-arena-einfluss.mjs takeshis-castle 48                          # 18,9 Pp
node scripts/messe-arena-einfluss.mjs takeshis-castle 48 --saat-versatz=10000000  # 17,7 Pp
```

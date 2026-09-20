# Projektmanager-Plan: die Kampfmodell-Entscheidung abarbeiten (20.09.)

**Auftrag von Chris, wörtlich:** „lass den projektmanager das organisieren und arbeite die punkte
dann alle ab". Die Entscheidung ist gefallen und wird hier **nicht** neu getroffen. Dieses Dokument
bricht sie in zehn dispatchbare Arbeitsaufträge herunter, macht die Abhängigkeiten explizit und
schlägt eine Wellen-Reihenfolge für **eine** Session vor.

**Grundlage:** `docs/pm-briefings/opus-konvergenz-kampfmodell-debatte-20-09.md` (Branch
`konvergenz-kampfmodell-debatte-20-09`, PR #974), vollständig gelesen. Dazu die drei Vordokumente,
weil die Konvergenz an mehreren Stellen „unverändert aus dem bestehenden Plan" schreibt und der
bestehende Plan woanders steht: `docs/pm-briefings/opus-synthese-echtzeit-vs-rundenbasiert-19-09.md`
(A0/A1/A2/A3, auf `main`), `docs/pm-briefings/opus-synthese-universelles-kampfmodell-20-09.md`
(A1.0-Varianten A–D, A1.1, K1, S1, F1 — seit PR #972 auf `main`),
`docs/pm-briefings/opus-gegencheck-kampfmodell-spielsysteme-20-09.md` (PRD, L1–L9, G1, die
Zufallsfrei-Auflage 5.2; Branch `gegencheck-kampfmodell-spielsysteme-20-09`).

**Stand beim Schreiben:** `origin/main` = `1ee8b643`. Konvergenz (#974) und Gegencheck sind noch
nicht gemergt — jeder Auftrag unten, der auf sie verweist, muss ihren Branch mitziehen oder auf den
Merge warten.

**Dieses Dokument ändert keine Zeile Code, fährt keine Messung und fasst keinen Motor an.** Was ich
am Code selbst nachgeprüft habe, steht in Abschnitt 2 mit Datei und Zeile — es sind vier Befunde,
und drei davon ändern einen Auftragstext gegenüber der Konvergenz.

---

## 0. Die Kurzfassung

### 0.1 Die Wellen

| Welle | Aufträge | warum zusammen | Produktionscode? |
|---|---|---|---|
| **1** | **M0**, **A3**, **P1** — parallel | alle drei ohne Vorbedingung; M0 ist der Flaschenhals für alles Mechanische und muss als Erstes laufen | M0 nein · A3 **ja** · P1 **ja** |
| **1b** | **Frage 2 an Chris** stellen (nicht dispatchen, fragen) | M1 liefert ohne Chris' Antwort eine Zahl ohne Schwelle. Die Frage muss raus, **bevor** M1 fertig ist, nicht danach | — |
| **2** | **M1** (nach M0) · **B0′** (nach A3) · **K1** (nach A3) | drei verschiedene Ergebnisse, die zusammen das Tor zu Welle 3 bilden | M1 nein · B0′ nein · K1 **ja** |
| **3** | **A1.0** (nach M0, Sonden-Bau auf M1's Gerüst) | erst sinnvoll, wenn der Messstand steht **und** M1's `place`-Variante existiert — sonst wird dieselbe Variante zweimal gebaut | nein |
| **4** | **Fork**: **C1** (bei M1-Tor A/B **und** B0′-„ja, wegen der Aufstellung") **oder** **A1.1** (bei B0′-„nein") | die Konvergenz nennt das selbst einen Fork; welcher Zweig läuft, entscheiden Messung und Chris, nicht der Plan | beide **ja** |
| **5** | **S1** — eigener Strang, Engpass ist Beschaffung, nicht Code | 33 fehlende Klassenkarten; heute nur als Konzept-/Beschaffungsauftrag dispatchbar | später ja |

**Sofort dispatchbar (Welle 1): M0, A3, P1.** Alles andere wartet auf ein Ergebnis oder auf Chris.

### 0.2 Die drei Dinge, die ein PM am Konvergenz-Plan ändern muss

1. **M1 und A1.0 sind teilweise derselbe Lauf.** Die Konvergenz definiert A1.0-Variante P als „das
   ist M1, hier als gemeinsamer Lauf" (§4, A1.0) und setzt M1 trotzdem drei Stufen davor (§4, M1).
   Zweimal dispatcht baut man die `place`-Sonde zweimal. **Auflage: M1 baut das Sondengerüst, A1.0
   erbt es** und liefert Variante P numerisch vergleichbar zu M1's Stufen 1–3. Steht so in keinem
   der beiden Absätze und muss in beide Aufträge hinein.
2. **Das Konvergenz-Dokument nennt zwei verschiedene Reihenfolgen.** §0 (Z. 40): „… → A1.0 →
   **(Fork: C1 oder A1.1)** → K1 → S1". §7 (Z. 527): „… → A1.0 → **C1 → K1 → A1.1** → S1". Die
   Fork-Fassung ist die richtige: C1 hängt an M1-Tor A/B, A1.1 am B0′-Ausgang „nein" — beide Tore
   können nicht gleichzeitig offen sein. Die Kette in §7 liest sich so, als würden C1 **und** A1.1
   beide gebaut. **Ich arbeite mit der Fork-Fassung und sage das hier hin, damit es niemand still
   anders auslegt.**
3. **Zwei der im Dokument gesetzten Abhängigkeiten sind organisatorisch, nicht technisch** (B0′←A3,
   K1←A3, s. Abschnitt 1.2). Das ändert die Reihenfolge nicht — aber es heißt, dass eine blockierte
   A3 weder B0′ noch K1 aufhält, und das sollte man wissen, wenn A3 hakt.

---

## 1. Die Abhängigkeitskette, am Dokument nachgeprüft

### 1.1 Was die Konvergenz je Punkt wörtlich sagt

| Punkt | Klammerzusatz in §4 | daraus folgende Vorbedingung | Art |
|---|---|---|---|
| **M0** | „zuerst, blockiert alles Mechanische" | keine | — |
| **A3** | „parallel zu M0, unabhängig" | keine | — |
| **M1** | „nach M0, vor jedem Motor und jeder Regie" | **M0** | hart (M0 liefert die Familie, auf der M1 misst) |
| **B0′** | „nach A3, parallel zu M1" | A3 | **weich**, s. 1.2 |
| **A1.0** | „nach M0" | **M0** (+ faktisch M1, s. 0.2) | hart |
| **P1** | „unabhängiger Nebenstrang, jederzeit" | keine | — |
| **C1** | „nur bei M1-Tor A oder B, und nach B0′" | **M1-Ergebnis + B0′-Ergebnis** (+ M0, weil C1 „nach jedem Schritt kaderfest auf der M0-Familie" misst) | hart |
| **K1** | „parallel, jederzeit nach A3" | A3 | **weich**, s. 1.2 |
| **A1.1** | „nur bei B0′-Ausgang ‚nein', oder als Vorbereitung auf S1" | **B0′-Ergebnis** + **M0** (die Abnahmezahl ist M0's Spannweite) + **A1.0** (§6.2 Synthese: „erst, wenn A1.0 sagt, dass es sich lohnt") | hart |
| **S1** | „eigener Strang, Engpass sind die 33 fehlenden Klassenkarten" | Karten; inhaltlich Chris' Fragen 3 und 4 | hart, aber nicht Code |

### 1.2 Die zwei weichen Abhängigkeiten — ehrlich benannt

**B0′ braucht A3 technisch nicht.** B0′ ist laut §4 und Gegencheck 5.2 „ausdrücklich ohne jeden
Zufall gescriptet". Ein zufallsfreies Drehbuch konsumiert keine Saat; es kann nicht davon abhängen,
ob der Host eine durchreicht. Die Reihenfolge ist trotzdem sinnvoll — A3 ist eine kleine PR und
Chris soll den Mockup-Nachmittag nicht in eine Woche fallen sehen, in der der echte Kampf immer noch
ein anderer ist als der gezählte. **Aber: hakt A3 (s. den Eskalationspunkt in 3.2), ist B0′ nicht
blockiert.**

**K1 braucht A3 technisch nicht.** K1 sitzt in `renderKader()` in
`public/mockups/battle-mode.engine.js`, A3 in `app/foundation/battle-arena/FoundationBattleArenaHost.tsx`
und dem Auflösungspfad — verschiedene Dateien, kein gemeinsamer Zustand. „Nach A3" ist
Reihenfolge-Hygiene auf dem Präsentationspfad, kein Blocker.

### 1.3 Der kritische Pfad

```
M0 ──► M1 ──┐
            ├──► C1        (Tor A/B + B0′-"ja, wegen der Aufstellung")
A3 ──► B0′ ─┘
            └──► A1.1      (B0′-"nein"), zusätzlich hinter A1.0
M0 ──► A1.0 ─► A1.1
P1  ── unabhängig ──────────────────────────────────────────────
K1  ── unabhängig (nominell nach A3) ───────────────────────────
S1  ── eigener Strang, Engpass Beschaffung ─────────────────────
```

**Der kritische Pfad ist M0 → M1 → (Tor) → C1.** M0 ist damit der einzige Auftrag, dessen
Verzögerung alles Mechanische verzögert — er gehört als Erstes und allein in die Dispatch-Queue,
noch vor A3 und P1, falls die Session nicht drei Agenten gleichzeitig fahren kann.

---

## 2. Was ich selbst am Code nachgeprüft habe

Vier Stichproben, alle an `origin/main` = `1ee8b643`. Drei davon ändern einen Auftragstext.

| Behauptung / Annahme | Fundstelle | Befund |
|---|---|---|
| A3's Auflage: „zuerst nachweisen, dass `seedZuZahl()` produktive Saat-Strings nicht auf 0 kollabiert" (Konvergenz §4) | `lib/battle/arena-headless-runner.ts:206`, Kommentar Z. 67–85 | **Die Auflage ist im Runner bereits erfüllt.** `seedZuZahl()` existiert und hasht String-Saaten mit FNV-1a auf 32 Bit, **bevor** sie an `spieleFeldspiel()` gehen; genau der `NaN>>>0 === 0`-Kollaps ist dort dokumentiert und behoben. **Der Auftrag A3 darf das nicht ein zweites Mal bauen** — er muss stattdessen prüfen, ob der **Host** denselben Weg nimmt. Siehe 3.2. |
| Der Host reicht keine Saat durch | `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` | **Bestätigt**, null Treffer für `seed`/`saat`. Der Host importiert den Aufstellungs-Adapter, aber keine Saat. |
| M0 sei „eine Datendatei und eine Auswertespalte" (Konvergenz §4) | `scripts/ziehe-kader-familie.ts:71-77` | **Untertrieben.** Die fünf Paarungen stehen als **hartkodierte Vereinsnamen** in einer `PAARUNGEN`-Konstante. Fünfundzwanzig Paarungen heißt: die Auswahl programmatisch machen (oder 25 Namen pflegen) **und** vorher prüfen, ob der Spielstand genug Arena-Teams hat. Das ist Werkzeugcode, kein Produktionscode — aber es ist Code, nicht nur Daten. |
| P1: „Die `rr()`-Stellen im Feldspiel auf PRD umstellen" (Konvergenz §4) | `public/mockups/battle-mode.engine.js:19325` | **Es gibt genau EINEN `rr()`.** Ein einziger LCG auf Modulebene, aus dem **alle** Chassis ziehen (193 Aufrufstellen über die ganze Datei). „Die `rr()`-Stellen im Feldspiel" gibt es als abgegrenzte Menge nicht. **Wer `rr()` selbst anfasst, ändert den Ziehungsstrom aller zwanzig Disziplinen.** P1 muss deshalb als Wrapper an footballspezifischen Entscheidungspunkten gebaut werden, und die Auftragsformulierung muss das sagen, sonst baut ein Agent das Naheliegende und reißt neunzehn Basislinien ein. Siehe 3.6. |

---

## 3. Die zehn Arbeitsaufträge

Jeder Abschnitt ist so geschrieben, dass er als Auftragstext an einen Fable-Recherche- oder
Build-Agenten kopiert werden kann. „PRODUKTIONSCODE: ja" heißt nach der Konvention dieses Projekts:
**der Auftrag wird nicht direkt gemergt, sondern bekommt eine unabhängige Review** (wie
`docs/pm-briefings/opus-review-pr-*.md`). „PRODUKTIONSCODE: nein" heißt: Werkzeug-, Sonden- oder
Dokumentpfad, direkt mergbar, wenn die Verifikation grün ist.

Die Verifikation unten ist immer **zusätzlich** zu dem, was CI ohnehin fährt
(`ci:typecheck`, `lint`, `test`, `ci:rangtreue-schranke`, `ci:quelltext-waechter`,
`ci:render-waechter`, `ci:quittungen` u. a., s. `.github/workflows/ci.yml`). Ein Auftrag ist erst
fertig, wenn seine eigene Zahl **im PR-Text steht** — nicht, wenn CI grün ist.

---

### 3.1 M0 — den Arena-Messstand messbar machen

> **Auftrag.** Die Arena-Kader-Familie von fünf auf rund fünfundzwanzig echte Team-Paarungen
> vergrößern und die Messauswertung um die **Streuung des Medians selbst** erweitern. Ziel ist eine
> Antwort auf genau eine Frage: *Wie genau ist die Zahl, mit der dieses Projekt seit Monaten über
> die Arena argumentiert?*
>
> Konkret: `scripts/ziehe-kader-familie.ts` zieht heute fünf hartkodierte Paarungen
> (`PAARUNGEN`, Z. 71–77) über `buildArenaTeam()` aus dem Live-Save-Abbild. Der Auftrag ersetzt die
> Namensliste durch eine **deterministische, reproduzierbare Auswahl** über die Teams des
> Spielstands (`listeArenaTeams()`), die bewusst über Kadergröße und Tabellenbereich streut, und
> behält dabei die erste Paarung (Vigilante Wranglers / Armageddon Aftermath) als **Anker**, damit
> die neue Familie mit der gesamten Vorgeschichte vergleichbar bleibt. Prüfe **zuerst**, wie viele
> Arena-Teams der Spielstand überhaupt hergibt — wenn fünfundzwanzig disjunkte Paarungen nicht
> möglich sind, sag das und nimm die größtmögliche Zahl, statt Paarungen zu erfinden.
>
> Zweitens: die Auswertung in `scripts/lib/rangtreue-messung.mjs` /
> `scripts/miss-alle-disziplinen.mjs` weist heute Median und Spannweite aus. Ergänze eine dritte
> Größe, die **Unsicherheit des Medians** (Bootstrap über die Paarungen, Intervallbreite
> ausgewiesen). Additiv — ohne den Schalter bleibt die Ausgabe unverändert.
>
> Drittens: fahre die neue Familie **nur** für `tdm`, `mini-dm`, `battlefield` und stelle die Zahlen
> alt gegen neu nebeneinander: Median, Spannweite, Median-Unsicherheit, je bei 5 und bei ~25
> Paarungen. Diese Tabelle **ist** das Ergebnis des Auftrags.
>
> Den Weg an den Spielstand nimmst du wie in CLAUDE.md beschrieben (`git fetch origin live-save`,
> Abbild nach `/tmp`, `OLY_APP_SQLITE_PATH` auf die **Kopie**) — und du prüfst vorher mit
> `npx tsx scripts/pruefe-spiegel-frische.ts`, ob der Spiegel überhaupt noch läuft. Ein veraltetes
> Abbild sieht aus wie ein gültiger Spielstand.

**Nicht anfassen.** `public/mockups/battle-mode.engine.js` — keine Zeile. Keine Rezepte, keine
Zielwahl, keine Regie, kein `MOTOREN`-Eintrag. Die eingecheckte Basislinie
(`data/generated/rangtreue-basislinie.json`) wird **nicht** nachgezogen; die siebzehn
Nicht-Arena-Disziplinen behalten die Fünferfamilie.

**Verifikation (Pflicht).**
- `node scripts/miss-alle-disziplinen.mjs 24` auf der **alten** Familie: bit-identisch zur
  eingecheckten Basislinie. Das ist der Beweis, dass die Auswertungserweiterung nichts verschiebt.
- `npm run ci:rangtreue-schranke` grün.
- Die Alt-gegen-Neu-Tabelle der drei Arena-Zeilen im PR-Text.

**Abnahme / Abbruch (aus Konvergenz §4).** Schrumpft die Spannweite mit mehr Paarungen deutlich →
die Arena ist messbar, M1 startet. Schrumpft sie **nicht** → Arena-rho ist keine Schätzung von
irgendetwas, und die 0,80-Schranke ist auf die Arena in ihrer heutigen Form nicht anwendbar; das ist
dann Chris' Frage 1, keine Panne.

**Offen und vom PM zu setzen — „deutlich" ist keine Zahl.** Die Konvergenz quantifiziert das
Entscheidungstor nicht. **Vorschlag dieses Plans, ausdrücklich als PM-Setzung markiert, nicht aus
der Konvergenz übernommen:** Entscheidungsgröße ist die **Median-Unsicherheit**, nicht die
Spannweite. Fällt die Intervallbreite des Medians unter **0,10**, ist die Arena messbar (Tor grün).
Bleibt sie über **0,20**, ist sie es nicht (Tor rot). Dazwischen entscheidet Chris zusammen mit
Frage 1. Der M0-Agent liefert die Zahl in jedem Fall — die Schwelle darf die Hauptsession korrigieren,
solange sie **vor** dem Lauf feststeht und nicht danach.

**PRODUKTIONSCODE: nein.** Werkzeug- und Datenpfad (`scripts/`, `data/generated/`). Direkt mergbar,
wenn die bit-identische Nachmessung im PR steht.

---

### 3.2 A3 — die gebuchte Saat durch den Host reichen

> **Auftrag.** Heute rechnet die Produktion den Spieltag headless zu Ende
> (`lib/battle/arena-headless-runner.ts`, `M.bau(saat); M.lauf(); M.wert()`), und
> `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` reicht Kader, Aufstellung und
> Anzeige-Meta durch — **aber keine Saat** (nachgezählt: null Treffer für `seed`/`saat` in 551
> Zeilen). Was Chris zuschaut, ist nicht das Spiel, das gezählt hat. Schließe diese Lücke: der Host
> bekommt die **gebuchte** Saat und gibt sie an denselben Motoraufruf weiter, den der Headless-Lauf
> nimmt.
>
> **Die Vorbedingung aus der Konvergenz ist präzisiert** (nachgeprüft, s. Abschnitt 2 des
> PM-Plans): die Konvergenz verlangt, „zuerst nachzuweisen, dass `seedZuZahl()` produktive
> Saat-Strings nicht auf 0 kollabiert". Das ist im Runner **bereits gelöst** —
> `lib/battle/arena-headless-runner.ts:206` hasht String-Saaten mit FNV-1a, bevor sie an
> `spieleFeldspiel()` gehen, und der Kommentar Z. 67–85 dokumentiert genau den `NaN>>>0 === 0`-Kollaps.
> **Baue das nicht noch einmal.** Der Nachweis, der wirklich fehlt, lautet:
> *nimmt der Host-Pfad dieselbe Normalisierung wie der Headless-Pfad?* Wenn der Host die Saat an einer
> anderen Stelle oder in einer anderen Form (`saat||1337` direkt im Motor,
> `battle-mode.engine.js`) einspeist, gibt es zwei Normalisierungen und damit wieder zwei
> verschiedene Kämpfe. **Eine Quelle, ein Weg, und das im PR belegen.**
>
> Zweitens gilt die Einschränkung aus der 19.09.-Synthese (§5.3) weiter und gehört in den PR-Text:
> für Bahn und Arena ist gleicher Endstand bei gleicher Saat **nicht** dasselbe wie gleicher
> Ablauf, weil `ZEIT_DEHNUNG` die Ticks anders teilt. Der Auftrag verspricht den **Endstand**, nicht
> Bild für Bild.

**Nicht anfassen.** Keine Motorlogik, kein Rezept, keine Zielwahl. `seedZuZahl()` bleibt, wie es
ist. Keine Änderung an den siebzehn Nicht-Arena-Disziplinen.

**Verifikation (Pflicht).**
- `node scripts/miss-alle-disziplinen.mjs 24` bit-identisch — der Host ist kein Motor, die Zahl darf
  sich nicht bewegen.
- `npm run ci:rangtreue-schranke` grün.
- **Die eigentliche Abnahme:** gezeigter Endstand == gezählter Endstand, **an fünf Spieltagen**
  belegt (Konvergenz §4). Nicht an einem.
- Der Ein-Weg-Nachweis für die Saat-Normalisierung, im PR-Text.

**Abbruch / Eskalation.** Lässt sich die Saat nicht so durchreichen, dass Host und Headless
nachweislich dieselbe Zahl sehen — eskalieren, nicht improvisieren. Ein stiller Saat-Kollaps ist
genau die Fehlerbauart, an der sich dieses Projekt zweimal verbrannt hat (Formkarten-Bug,
Einzelkader-Bug).

**PRODUKTIONSCODE: ja.** Host- und Auflösungspfad. **Unabhängige Review vor dem Merge.**

---

### 3.3 M1 — was kostet die Aufstellung?

> **Auftrag.** Die Kader-Familie führt heute **kein `place`**
> (`data/generated/kaderfamilie-live-save.json`: je Spieler `{n,c,r,sub,tp,tn,d,groesse,a}`), also
> fällt der Motor auf seine Eigenordnung zurück (`SLOT_ZUSATZ`, `battle-mode.engine.js:5056-5065`:
> „der beste Spieler bekommt den vordersten Slot"). **Daraus folgt der Befund, der die ganze Debatte
> entschieden hat: Die 0,80-Schranke ist noch nie gegen eine menschliche Aufstellung geprüft worden
> — gemessen wird die Rangtreue der motoreigenen Optimalaufstellung.**
>
> Miss den Preis dieser Autorschaft. Fahre die Sonde **mit gesetztem `place`** in drei Stufungen,
> kaderfest auf der **M0-Familie**:
> 1. motoroptimale Aufstellung (= heutiger Zustand, Kontrolle),
> 2. plausible menschliche Aufstellung,
> 3. absichtlich schlechte Aufstellung (Star nach hinten, Bollwerk auf die Flanke).
>
> **Die gesuchte Zahl ist die Spannweite zwischen 1 und 3** — der Preis der Autorschaft in rho. Sie
> existiert nirgends.
>
> Der Weg von der Aufstellung in den Motor ist bereits verdrahtet und darf **nicht** neu gebaut
> werden: `lineupDrafts` → `lib/foundation/battle-arena/arena-aufstellung-adapter.ts` →
> `aufstellung[name]={d,slot}` → `slotFuer`. Deine Aufgabe ist, die Sonde diesen Weg gehen zu lassen,
> nicht ihn zu ersetzen.
>
> **Auflage aus der PM-Planung (steht so in keinem Absatz der Konvergenz, folgt aber zwingend aus
> ihr):** Was du hier als Sondengerüst baust, **erbt A1.0 als seine Variante P** (Konvergenz §4,
> A1.0: „Variante P: `place` gesetzt — das ist M1, hier als gemeinsamer Lauf"). Baue es deshalb so,
> dass ein späterer Lauf deine drei Stufungen als eine Variante neben A–E einhängen kann, und lege
> die Zahlen so ab, dass sie mit A1.0's Ausgabe **numerisch vergleichbar** sind. Sonst wird dieselbe
> Sonde zweimal gebaut und die beiden Zahlen sind hinterher nicht dieselbe Größe.

**Nicht anfassen.** **Nichts wird gemergt, was den Motor ändert.** Reiner Sondenpfad. Keine
`SLOT_ZUSATZ`-Änderung, keine Zielwahl, keine Formation. Die produktiven Arena-Disziplinen bleiben
Byte für Byte, wie sie sind.

**Verifikation (Pflicht).**
- kaderfest auf der M0-Familie, **Median UND Spannweite UND Median-Unsicherheit** je Stufung.
- `node scripts/miss-alle-disziplinen.mjs 24` bit-identisch (nichts am Motor geändert — das ist hier
  trivial nachweisbar und muss trotzdem im PR stehen).
- **Die Bewegungsregel gilt:** eine Differenz zwischen zwei Stufungen zählt nur, wenn sie die
  Spannweite der M0-Familie überschreitet.

**Abnahme / Abbruch (drei Tore, aus Konvergenz §4).**
- **Tor A (grün):** Spannweite klein genug, dass eine schlechte Aufstellung rho nicht unter die
  Schranke drückt → C1 wird gebaut, Aufstellung sichtbar **und** wirksam.
- **Tor B (gelb):** Spannweite groß, aber *Exposition* lässt sich von *Höhe* trennen → C1 wird
  gebaut, die Aufstellung formt Varianz und Exposition, nicht den Erwartungswert.
- **Tor C (rot):** Die Aufstellung verschiebt den Erwartungswert so stark, dass Autorschaft und
  Schranke unvereinbar sind → C verliert nachträglich, zurück an Chris (Frage 2), B rückt auf.

**Achtung, das Tor ist ohne Chris nicht auswertbar.** Die Konvergenz sagt es selbst (§6, Frage 2):
„Ohne deine Antwort ist M1 nur eine Zahl ohne Schwelle." **Deshalb steht Frage 2 in Welle 1b und
nicht am Ende.** Der M1-Agent liefert die Zahl; die Einordnung in Tor A/B/C macht die Hauptsession
mit Chris' Antwort in der Hand.

**PRODUKTIONSCODE: nein.** Sondenpfad, nichts gemergt, was der Motor sieht. Direkt mergbar.

---

### 3.4 B0′ — das Drehbuch-Mockup, beginnend bei der Aufstellung

> **Auftrag.** Baue ein **zufallsfreies, vollständig gescriptetes** Drehbuch-Mockup eines
> Arena-Kampfes, das **bei der Aufstellung beginnt** und nicht beim Kampf. Aufbau:
> Aufstellungstafel mit drei Reihen, echten Portraits, Befehl je Slot und Zielansage → Klick
> „Aufstellung abgeben" → Auflösung als Enthüllung **mit Rückbezug** („Schleicher geht hinten rum —
> dein Bollwerk steht links"). Echte Sprites aus `public/sprites/baukasten/`, Duell-Bühne nach dem
> Vorbild `zeichneHeben()`, Höhepunkt-Dosierung über den bestehenden `HIGHLIGHTS`/`callout()`-Pfad,
> und „zählt für Spieltag 7" sichtbar im Bild.
>
> **Die Auflage des Gegenchecks (5.2) ist nicht verhandelbar und gilt hier doppelt: ausdrücklich
> ohne jeden Zufall gescriptet — und das im Mockup dazugeschrieben.** Ein Drehbuch, das seinen
> Zufall verschweigt, beweist bei Erfolg das Gegenteil dessen, was es beweisen soll.
>
> **Warum es bei der Aufstellung beginnt, und warum ein Mockup ohne sie wertlos wäre** (Konvergenz
> §2.6, wörtlich zu beherzigen): Ein Drehbuch, das einen Kampf zeigt, ohne die Entscheidung zu
> zeigen, die ihn erzeugt hat, beantwortet die Abnahmefrage nicht — egal wie Chris antwortet. Sagt
> er ja, haben wir bewiesen, dass ein Bildschirmschoner hübsch sein kann. Sagt er nein, wissen wir
> nicht, ob die Regie zu schwach war oder die fehlende Entscheidung. **Der Test wäre in beide
> Richtungen nicht informativ.**
>
> Das Ergebnis ist ein Mockup, das Chris **anschaut**, kein Feature. Es kostet einen Nachmittag, und
> es darf einen Nachmittag kosten.

**Nicht anfassen.** Kein Motor, kein Rezept, keine Produktionsansicht. Nichts, was
`miss-alle-disziplinen.mjs` sehen kann.

**Verifikation (Pflicht).**
- `node scripts/miss-alle-disziplinen.mjs 24` bit-identisch — hier als reine Formalie, aber sie
  gehört in den PR, weil sie beweist, dass das Mockup wirklich neben dem Motor steht.
- Die Zufallsfreiheit ist **im Mockup sichtbar beschriftet**, nicht nur im PR-Text behauptet.

**Abnahme.** Zwei Fragen an Chris, wörtlich zu stellen:
*Fühlt sich das an wie ein Spiel?* — und: *War es die Aufstellung, oder war es die Inszenierung?*

| Antwort | Folge |
|---|---|
| **Ja, wegen der Aufstellung** | C1 ist bestätigt, B rückt hinter S1 |
| **Ja, wegen der Inszenierung** | D's These lebt, **L5** rückt auf |
| **Nein** | beide Präsentationsthesen sind falsifiziert, **A1.1 rückt sofort auf** — und wir haben einen Nachmittag statt einer Runde ausgegeben |

**PRODUKTIONSCODE: nein.** Mockup-Pfad. Direkt mergbar — der Wert steckt in Chris' Antwort, nicht im
Merge.

---

### 3.5 A1.0 — die Expositions-Sonde, um zwei Varianten erweitert

> **Auftrag.** Miss, wie viel Rangtreue die Arena an unbepreiste Kanäle verliert, **bevor** ein
> Motor gebaut wird. Sechs Varianten, alle **nur als Sondenpfad, nichts wird gemergt**:
>
> - **A:** heutiger Motor, unverändert — Basislinie.
> - **B:** `cdKuerzung=(u)=>0` — die Rate-Hälfte von Chris' Formel-Fix. Die Zahlen liegen bereits
>   vor (0,113 / 0,269 / 0,325); die Sonde reproduziert sie **zur Kontrolle**, dass die Sonde selbst
>   misst, was sie soll.
> - **C:** Zielwahl gleichverteilt statt geometrisch (Round-Robin über die lebenden Gegner) — die
>   Aussetzungs-Hälfte, die noch nie gemessen wurde.
> - **D:** B und C zusammen.
> - **E:** alle Wahrscheinlichkeiten PRD-gebunden (Pseudo Random Distribution, Gegencheck 2.4/5.3).
> - **P:** `place` gesetzt — **das ist M1**, hier als gemeinsamer Lauf, damit Zielwahl und
>   Aufstellung im selben 2×2 trennbar bleiben.
>
> **Variante P baust du nicht neu.** Sie existiert als Sondengerüst aus M1; übernimm es und liefere
> die Zahl so, dass sie mit M1's Stufungen 1–3 dieselbe Größe ist. Wenn das Gerüst aus M1 nicht
> passt, sag das und begründe es — aber baue die Sonde nicht stillschweigend ein zweites Mal.
>
> Kaderfest auf der **M0-Familie**, **Median und Streuung des Medians** je Variante.

**Nicht anfassen.** Nichts wird gemergt, was der Motor sieht. Kein `MOTOREN`-Eintrag, keine
Rezeptänderung, keine Regie.

**Verifikation (Pflicht).**
- `node scripts/miss-alle-disziplinen.mjs 24` bit-identisch auf `main`.
- kaderfest auf der M0-Familie, n je Variante **im PR ausgewiesen** (Synthese-Hürde: n ≥ 96–150 je
  Kadervariante; eine 24er-Messung kann hier grundsätzlich nichts beweisen — weder Erfolg noch
  Misserfolg).
- **Die Bewegungsregel:** eine Bewegung zählt nur, wenn sie die Spannweite der M0-Familie
  überschreitet. Diese Regel gilt ab hier auch für A1.1's Abnahmezahl.

**Abnahme / Abbruch.** Hebt C oder D die Arena deutlich (oberhalb der M0-Spannweite), weiß A1.1, was
es bauen muss. Trägt **nichts** davon, liegt die Ursache woanders, A1.1 fällt vorerst aus — und wir
haben eine Runde gespart statt sie zu verbrennen.

**PRODUKTIONSCODE: nein.** Sondenpfad. Direkt mergbar.

---

### 3.6 P1 — PRD für Football

> **Auftrag.** Football ist der einzige Ort im Projekt, an dem eine klare Diagnose auf ein passendes
> Werkzeug trifft, und beide Vordokumente haben die beiden nebeneinander liegen lassen, ohne sie zu
> verbinden. Die Zwei-Spalten-Regel aus CLAUDE.md, auf Football angewandt: **0,516 je Spiel bei
> 0,811 über die Saison** — hohe Saisonzahl, niedrige Einzelspielzahl, also „die Mechanik belohnt
> das Richtige, aber zu laut". Die **Verlässlichkeit von 0,405 ist die niedrigste der zwanzig**.
> Pseudo Random Distribution (PRD) senkt exakt diese Größe: Erwartungswert bleibt, Streuung sinkt,
> Validität wird nicht berührt.
>
> Stelle Footballs Zufallsentscheidungen im Feldspiel auf PRD um und miss.
>
> **Die entscheidende Auflage, nachgeprüft am Code (s. Abschnitt 2 des PM-Plans) — lies sie, bevor
> du irgendetwas anfasst:** Die Konvergenz schreibt „die `rr()`-Stellen im Feldspiel". **Diese Menge
> gibt es nicht.** `public/mockups/battle-mode.engine.js` hat **genau einen** `rr()` — einen einzigen
> LCG auf Modulebene (`:19325`), aus dem **alle vier Chassis** ziehen, mit 193 Aufrufstellen über die
> ganze Datei. Wer `rr()` selbst auf PRD umstellt, ändert den Ziehungsstrom **aller zwanzig
> Disziplinen** und reißt neunzehn Basislinien ein.
>
> PRD gehört deshalb an die **footballspezifischen Entscheidungspunkte** (die Zweige hinter
> `FELDSPIEL_ART.football` / `fsLive`), als Bindung je Entscheidungsart mit eigenem Zähler — nicht in
> den gemeinsamen Generator. Und: **ändere auf den Basketball-/Hockey-Pfaden nicht die Anzahl der
> `rr()`-Aufrufe.** Ein zusätzlicher oder entfallender Zug verschiebt deren Strom, auch wenn keine
> Zeile ihrer Logik angefasst wurde. Genau das prüft die Isolationspflicht unten.

**Nicht anfassen.** `rr()` selbst. Basketball, Hockey und die siebzehn übrigen Disziplinen. Footballs
Rezept (`spielEignung`, Gewichte) — PRD ändert die **Streuung**, nicht den Erwartungswert; wer am
Rezept dreht, misst hinterher zwei Dinge gleichzeitig.

**Verifikation (Pflicht).**
- **Isolationspflicht:** `node scripts/miss-alle-disziplinen.mjs 24` — **neunzehn Zeilen
  bit-identisch**, nur Football bewegt sich. Das ist die Kernabnahme, nicht eine Formalie.
- `npm run ci:rangtreue-schranke` grün; Basislinie nur für Football nachziehen, und das im PR
  benennen.
- `node scripts/miss-feldspiel-rangtreue.mjs football 24 6` für den Boxscore.
- **Beide Spalten ausweisen:** rho je Spiel **und** rho Saison **und** die Verlässlichkeit. Ohne die
  Verlässlichkeit ist der Auftrag nicht beantwortet — sie ist die Größe, die PRD bewegen soll.

**Abnahme / Abbruch.** Erfolg: Football **über 0,60 je Spiel bei unveränderter Saisonzahl**, und die
Verlässlichkeit steigt von 0,405 **messbar**. Steigt die Verlässlichkeit nicht, ist die PRD-These
widerlegt — dann wird nicht nachgebessert, sondern berichtet.

**PRODUKTIONSCODE: ja.** Motorpfad in `battle-mode.engine.js`. **Unabhängige Review vor dem Merge**,
und zwar mit besonderem Augenmerk auf die Isolationspflicht — das ist der Punkt, an dem dieser
Auftrag scheitern kann, ohne dass es jemand sieht.

---

### 3.7 C1 — die Aufstellung sichtbar und wirksam machen

> **Auftrag.** Schließe die bereits verdrahtete Schleife: Aufstellungstafel im **Produktivpfad**,
> Zielansage aus dem Spielstand statt aus der Mockup-Tafel (`zielOf` lebt heute nur im
> Tafel-Renderpfad, drei Treffer: `battle-mode.engine.js:18113`, `:18839`, `:18841`), und das
> Aufdecken als inszenierter Moment auf dem bestehenden `resolve-preview-submission`-Commit.
>
> Das Kabel ist an beiden Enden angelötet und wird in der Mitte nicht sichtbar: `lineupDrafts` liegt
> in fünf `lib/`-Modulen, `submitted_preview_lineups_changed` existiert,
> `lib/foundation/battle-arena/arena-aufstellung-adapter.ts` baut daraus `aufstellung[name]={d,slot}`,
> und die Wirkung ist gemessen (r(Reihe, Wert) = −0,310 in Battlefield). **Nichts davon ist je
> gezeigt worden.** Du baust die Sichtbarkeit, nicht die Verdrahtung.
>
> **Die Warnung, die C selbst ausspricht und die stehen bleibt:**
> `docs/design/arena-zielwahl-umsetzung.md` dokumentiert **zwei gescheiterte Zielwahl-Anläufe, beide
> kaderfest schlechter**. C1 fasst denselben Mechanismus an. Lies das Dokument, bevor du anfängst,
> und miss **nach jedem Schritt** kaderfest auf der M0-Familie — nicht erst am Ende.
>
> Welche der drei Ausbaustufen gebaut wird, sagt dir das M1-Tor: bei **Tor A** wird die Aufstellung
> sichtbar **und** ergebniswirksam; bei **Tor B** formt sie nur **Varianz und Exposition**, nicht den
> Erwartungswert. Starte nicht, bevor das Tor feststeht.

**Vorbedingungen (alle drei, hart).** M1-Ergebnis mit Tor A oder B · B0′-Ausgang „ja, wegen der
Aufstellung" · M0-Familie steht.

**Nicht anfassen.** Kein neuer Motor, kein Rundenmodell, kein Rezept. Die siebzehn
Nicht-Arena-Disziplinen.

**Verifikation (Pflicht).**
- **Nach jedem Schritt** kaderfest auf der M0-Familie, nicht nur am Schluss.
- `node scripts/miss-alle-disziplinen.mjs 24` — die siebzehn Nicht-Arena-Zeilen bit-identisch.
- `npm run ci:rangtreue-schranke` grün, **inklusive** des absoluten Stufenwächters.
- `npm run lineup:check-context`, `npm run lineup:check-readiness`, `npm run resolve:smoke-preview`,
  `npm run resolve:smoke-apply` — C1 sitzt genau auf diesem Pfad.

**Abnahme / Abbruch.** Kaderfeste Verschlechterung der drei Arena-Zeilen → **zurück**, nicht
nachbessern. Die beiden gescheiterten Vorgänger sind dokumentiert; ein dritter Anlauf, der „knapp"
schlechter ist, ist derselbe Fehler zum dritten Mal.

**PRODUKTIONSCODE: ja, und es ist der größte Posten des ganzen Plans** (Konvergenz §5: „mittel,
2–3 PRs, rho-Risiko mittel — der größte Posten", und das ist beabsichtigt, weil C1 als einziger
Chris' Kriterium B an der Wurzel trifft). **Unabhängige Review je PR**, nicht einmal am Ende.

---

### 3.8 K1 — Kachel → Portrait-Karte in `renderKader()`

> **Auftrag.** `renderKader()` zeigt heute eine Kachel mit Sprite-Mini und Namen. Mach daraus eine
> **Portrait-Karte** mit Rolle und Zustand — eine Funktion, alle vier Chassis, alle zwanzig
> Disziplinen. Die 2 984 Portraits liegen bereit.
>
> **Sag ehrlich dazu, was der Zugewinn ist und was nicht** (D's eigene Auflage, wörtlich zu
> übernehmen): Sprite und Name stehen dort schon. Der Zugewinn ist **Portrait und Wiedererkennung**,
> nicht null auf eins. Wer den Auftrag als „endlich sieht man die Spieler" verkauft, verkauft ihn
> falsch.

**Vorbedingung.** Nominell nach A3 (Konvergenz §4). **Technisch keine** — K1 sitzt in
`public/mockups/battle-mode.engine.js`, A3 im Host. Hakt A3, ist K1 nicht blockiert.

**Nicht anfassen.** Keine Simulationsvariable. `renderKader()` darf nichts schreiben, was der Motor
liest — das ist die Bedingung, unter der die Bit-Identität überhaupt beweisbar ist.

**Verifikation (Pflicht).**
- `node scripts/miss-alle-disziplinen.mjs 24` **bit-identisch über alle zwanzig Zeilen**. Das ist
  hier keine Formalie, sondern die Abnahme: K1 ist rho-neutral **konstruktiv**, nicht nur
  behauptet — `renderKader()` schreibt in keinen Simulationszustand, und genau das weist die Messung
  nach.
- `npm run ci:render-waechter`, `npm run ci:design-tokens`, `npm run audit:ui`.
- Sicht-QA über den deterministischen Sonden-Modus (A0.2, PR #970) — Screenshots ohne
  Wanduhr-Rauschen.

**Abnahme / Abbruch.** Bewegt sich **eine** der zwanzig Zeilen, schreibt die Präsentation in den
Motor — dann zurück auf Anfang, unabhängig davon, wie gut es aussieht.

**PRODUKTIONSCODE: ja.** Motordatei, wenn auch im Renderpfad. **Unabhängige Review**, deren
Hauptfrage lautet: *schreibt die Karte irgendwo in den Simulationszustand?*

---

### 3.9 A1.1 — der Rundenpilot

> **Auftrag.** Baue Mini-DM als Rundenprototyp — **als NEUEN `MOTOREN`-Eintrag neben dem alten**
> (z. B. `"mini-dm-runden"`) mit eigenem `bau/lauf/namen/wert`. Die drei produktiven
> Arena-Disziplinen bleiben **Byte für Byte unangetastet**; damit ist die CLAUDE.md-Kernregel nicht
> nur eingehalten, sondern trivial nachweisbar.
>
> Wiederverwenden, **unverändert**: `rohKraft()`, `aufEignung()`, `chooseTarget()` samt
> `PERSZIEL`/Persönlichkeiten, Schadensformel, Schild/Heilung/K.o.-Anteil, `beitragVon()`/`wert()`
> als Maßstab. **Neu**: Initiative-Reihenfolge (aus TMP, **nur Reihenfolge**), „eine Aktion je
> lebender Einheit je Runde", und das **Protokoll** (Runde, Handelnder, Ziel, Aktion, Ergebnis,
> Intent), das der Abspieler später liest. So ändert sich genau eine Sache: die Verteilung der
> Gelegenheit — und wenn rho steigt, kann nichts anderes es gewesen sein.
>
> Welche Variablen der Pilot ändert, sagt dir **A1.0**: liefert dort Variante C oder D den Ausschlag,
> muss der Pilot Gelegenheit **und** Aussetzung gleichverteilen, und die Messung muss das als **2×2**
> abbilden statt als vorher/nachher — sonst weiß hinterher niemand, welche der beiden gewirkt hat.
>
> **Die Abnahmezahl ist gegenüber allen Vordokumenten geändert** (Konvergenz §4): nicht mehr
> „deutlich über 0,50", sondern **der Erfolg muss die Spannweite der M0-Familie überschreiten**. Der
> Grund steht in Konvergenz §1.1 und ist B's eigener Selbstwiderspruch: von 0,094 auf 0,50 sind
> +0,41, und das ist kleiner als Mini-DMs Spannweite von 0,697 — nach B's eigener Regel von Null
> nicht unterscheidbar. Ein Motor, der gelingen könnte, ohne dass wir es wüssten, ist kein Test.

**Vorbedingungen (hart).** B0′-Ausgang „nein" **oder** ausdrückliche Vorbereitung auf S1 · A1.0
liefert einen tragenden Hebel · M0-Familie steht (sie liefert die Abnahmeschwelle).

**Nicht anfassen.** Die drei produktiven Arena-Disziplinen. Der bestehende Motor. Das Rezept.

**Verifikation (Pflicht).**
- `node scripts/miss-alle-disziplinen.mjs 24` bit-identisch über alle zwanzig — trivial, weil an
  keiner gemessenen Disziplin eine Zeile steht, und deshalb ohne Ausrede zu liefern.
- `scripts/miss-mini-dm-ffa-rangtreue.mjs` als Vergleichswerkzeug: es vergleicht bereits zwei
  Chassis-Varianten nebeneinander mit derselben rho-Formel und ist genau für diese Frage gebaut.
- **n ≥ 96–150 je Kadervariante**, kaderfest über die M0-Familie, Median **und** Spannweite.

**Abnahme / Abbruch.** Bewegung unterhalb der M0-Spannweite = **Widerlegung, kein Teilerfolg**. Das
ist vorab festzuhalten, damit hinterher nicht umgedeutet wird.

**PRODUKTIONSCODE: ja** (neuer Motor, auch wenn er neben dem alten steht). **Unabhängige Review**,
Hauptfrage: *bleibt der alte Motor wirklich Byte für Byte?*

---

### 3.10 S1 — Skill-/Item-Ebene

**Dieser Punkt ist heute nicht als Build-Auftrag dispatchbar, und das ist kein Versäumnis der
Konvergenz — sie sagt es selbst:** „eigener Strang, **Engpass sind die 33 fehlenden Klassenkarten**"
(§4/§5). Ein Engpass in der Beschaffung wird nicht dadurch kleiner, dass man einen Code-Auftrag
darauf schreibt. Dazu kommt, dass **zwei von Chris' vier offenen Fragen (3 und 4) genau hier
einschlagen** — ob Krit und Ausweichen aus Skills statt aus Attributen kommen, und wie weit die
Matrix-Erlaubnis vom 05.09. reicht.

**Was stattdessen jetzt dispatchbar ist — ein Konzept- und Beschaffungsauftrag, keine Zeile Motor:**

> **Auftrag.** Nimm `docs/design/roguelike-skill-pool-konzept-17-09.md` und beantworte drei Fragen
> auf Papier: (1) Welche der 33 fehlenden Klassenkarten blockieren S1 wirklich, und welche sind
> nur Vollständigkeit? (2) Wie sieht ein Item-/Skill-Effekt aus, der die **drei Auflagen** dieser
> Debatte erfüllt? (3) Wo liegt der kleinste sinnvolle erste Schnitt — eine Disziplin, vier Slots,
> und was er kostet.

**Die drei Auflagen aus der Debatte, die jeder spätere S1-Bau erfüllen muss** (Konvergenz §4,
wörtlich zu übernehmen):

1. **Zuteilung per Saat (Input-Zufall), Wirkung deterministisch oder PRD-gebunden** — nie frei
   gewürfelt (Gegencheck 2.5).
2. **Jeder Item-Effekt braucht ein bepreistes Ziel.** A's bestes Argument der ganzen Debatte:
   „+12 AGI" hat eines, „+15 % Krit" hat keines. Wenn A's Substat je kommt, kommt er **hier** und
   nicht in `aufEignung()`.
3. **Folgen gehen in beide Richtungen** (L7): keine Narben ohne Wachstum.

**Vorbedingung.** Chris' Fragen 3 und 4. Beide sind in Konvergenz §6 gestellt und ungestellt
nichts wert — sie müssen zusammen mit Frage 2 raus.

**PRODUKTIONSCODE: nein** (für den Konzeptauftrag). Der spätere Bau: ja, und dann groß.

---

## 4. Wo das Konvergenz-Dokument für einen Dispatch noch zu vage ist

Vier Stellen. Bei dreien schlage ich vor, was zuerst geklärt werden muss; bei einer sage ich, dass
ich sie nicht klären kann.

| Stelle | warum das für einen Auftrag nicht reicht | was zuerst geklärt werden muss |
|---|---|---|
| **M0's Entscheidungstor** („Schrumpft die Spannweite … **deutlich**") | „Deutlich" ist keine Zahl, und die Versuchung, sie hinterher zu setzen, ist genau der Fehler, den das Dokument bei anderen rügt | Eine Schwelle **vor** dem Lauf. Vorschlag in 3.1: Median-Unsicherheit < 0,10 grün, > 0,20 rot, dazwischen Chris. Ausdrücklich PM-Setzung, nicht Konvergenz |
| **M1's Tore A/B/C** | Das Dokument sagt selbst: „Ohne deine Antwort ist M1 nur eine Zahl ohne Schwelle" (§6, Frage 2) | Chris' Frage 2 muss **vor** M1's Ende beantwortet sein. Deshalb Welle 1b |
| **M1-Stufe 2, „plausible menschliche Aufstellung"** | Was ist plausibel? Ohne Definition misst der Agent seine eigene Meinung und nennt sie einen Befund | Eine **abgeleitete Regel**, keine Intuition: z. B. „Rolle vor Eignung" (Bollwerk vorn, Schütze hinten) als Regelaufstellung, im PR benannt und begründet. Stufe 1 und 3 sind dagegen eindeutig — Motoroptimum und Umkehrung —, an denen hängt die gesuchte Spannweite ohnehin |
| **A1.0-Variante E („alle `rr()`-Wahrscheinlichkeiten PRD-gebunden")** | Nach Abschnitt 2 gibt es genau **einen** `rr()`, aus dem alle Chassis ziehen. „Alle `rr()`-Wahrscheinlichkeiten" in der Arena ist als Sondenvariante machbar, weil nichts gemergt wird — aber die Formulierung lädt dazu ein, denselben Eingriff später für einen Merge zu halten | Im Auftrag klarstellen: Variante E ist ein **Sondeneingriff am gemeinsamen Generator**, der genau deshalb **nie** gemergt wird. Für einen produktiven PRD-Bau gilt der Weg aus P1 (Wrapper an disziplinspezifischen Entscheidungspunkten) |

**Und eine Stelle, die ich nicht kläre, weil sie nicht mir gehört:** ob C1 überhaupt gebaut werden
soll, wenn M1 Tor B liefert. Tor B heißt „die Aufstellung formt Varianz und Exposition, nicht den
Erwartungswert" — das ist eine schwächere Entscheidung, als C sie gemeint hat, und ob sie Chris das
Kriterium B erfüllt, kann nur Chris sagen. Die Konvergenz setzt Tor B als „C1 wird gebaut". Ich
übernehme das, markiere es aber als die Stelle, an der der Plan eine Geschmacksfrage als
Messergebnis führt.

---

## 5. Die Wellen-Reihenfolge für den Dispatch

### Welle 1 — sofort, drei Aufträge parallel

| | Auftrag | Vorbedingung | Produktionscode |
|---|---|---|---|
| **M0** | Arena-Messstand messbar machen | keine | nein |
| **A3** | Gebuchte Saat durch den Host | keine | **ja → Review** |
| **P1** | PRD für Football | keine | **ja → Review** |

**M0 hat Vorrang vor allem**, weil der kritische Pfad durch ihn läuft. Kann die Session nur einen
Agenten fahren, läuft M0 zuerst und allein.

**Welle 1b, parallel und ohne Agent: Chris' vier Fragen stellen** (Konvergenz §6). Keine davon
blockiert Welle 1 — aber **Frage 2 blockiert die Auswertung von M1** und muss deshalb beantwortet
sein, bevor Welle 2 endet. Fragen 3 und 4 blockieren S1.

### Welle 2 — nach M0 bzw. A3, drei Aufträge parallel

| | Auftrag | Vorbedingung | Produktionscode |
|---|---|---|---|
| **M1** | Preis der Aufstellung | **M0 grün** | nein |
| **B0′** | Drehbuch ab Aufstellungstafel | A3 (weich) | nein |
| **K1** | Kachel → Portrait-Karte | A3 (weich) | **ja → Review** |

Ist M0's Tor **rot**, startet M1 **nicht** — dann geht die Arena-Frage an Chris zurück (Frage 1),
und B0′ und K1 laufen trotzdem, weil keiner von beiden eine rho-Zahl braucht.

### Welle 3 — nach M0 und M1

| | Auftrag | Vorbedingung | Produktionscode |
|---|---|---|---|
| **A1.0** | Expositions-Sonde A–E + P | M0 grün · M1's Sondengerüst | nein |

A1.0 könnte formal schon nach M0 starten. **Der Plan setzt es trotzdem hinter M1**, weil Variante P
laut Konvergenz **dasselbe** ist wie M1 — parallel dispatcht baut man sie zweimal, und die beiden
Zahlen wären hinterher nicht vergleichbar.

### Welle 4 — der Fork

Jetzt liegen drei Ergebnisse vor: M1's Tor, B0′'s Antwort von Chris, A1.0's Hebel. Sie bestimmen,
**welcher** Zweig gebaut wird — nicht beide.

| Konstellation | was gebaut wird |
|---|---|
| M1-Tor **A oder B** **und** B0′ „ja, wegen der Aufstellung" | **C1** (2–3 PRs, je mit Review, nach jedem Schritt kaderfest) |
| B0′ „ja, wegen der **Inszenierung**" | **L5** rückt auf (Dynamic Highlight Mode) — mit D's eigener Auflage: `big` ist kein Dramatikmaß, ein echtes braucht ein kontinuierliches Signal in vier Chassis |
| B0′ **„nein"** | **A1.1**, der Rundenpilot — beide Präsentationsthesen sind falsifiziert |
| M1-Tor **C** (rot) | zurück an Chris (Frage 2); B rückt auf, also A1.1 |

### Welle 5 — eigener Strang

**S1** als Konzept-/Beschaffungsauftrag (3.10), sobald Chris' Fragen 3 und 4 beantwortet sind. Der
Bau folgt später und ist größer als alles darüber.

### Was bewusst nicht in den Wellen steht

**L5** (Dynamic Highlight Mode) und **F1** (Football-Down-Karte) sind **verschoben, nicht
gestrichen** (Konvergenz §4). Beide billig, beide rho-neutral, beide auf Disziplinen, die bereits
bestehen. Sie kommen nach C1 oder über den B0′-Ausgang „ja, wegen der Inszenierung". **A2** (TDM und
Battlefield nachziehen) steht hinter A1.1 und taucht deshalb in keiner Welle dieses Plans auf.

---

## 6. Review-Konvention: was direkt gemergt werden darf

| Auftrag | Pfad | direkt mergbar? |
|---|---|---|
| M0 | `scripts/`, `data/generated/` | **ja**, mit bit-identischer Nachmessung im PR |
| M1 | Sondenpfad, nichts am Motor | **ja** |
| B0′ | Mockup | **ja** |
| A1.0 | Sondenpfad, nichts gemergt | **ja** |
| S1 (Konzept) | `docs/` | **ja** |
| **A3** | Host + Auflösungspfad | **nein → Review** |
| **P1** | `battle-mode.engine.js`, Football-Zweige | **nein → Review**, Schwerpunkt Isolationspflicht |
| **K1** | `battle-mode.engine.js`, `renderKader()` | **nein → Review**, Schwerpunkt: schreibt die Karte in den Simulationszustand? |
| **C1** | Produktivpfad Aufstellung/Zielansage | **nein → Review je PR**, nicht einmal am Ende |
| **A1.1** | neuer `MOTOREN`-Eintrag | **nein → Review**, Schwerpunkt: bleibt der alte Motor Byte für Byte? |

**Fünf Aufträge sind reine Messung oder Papier und können durchlaufen. Fünf fassen Produktionscode
an und brauchen die zweite Prüfung.** Von den fünf Produktions-Aufträgen liegen genau zwei in
Welle 1 (A3, P1) — die Review-Last ist am Anfang also gering und steigt erst mit C1.

---

## 7. Für die Hauptsession, in einem Absatz

Dispatche **M0, A3 und P1 sofort und parallel**; M0 hat Vorrang, weil der kritische Pfad
(M0 → M1 → Tor → C1) durch ihn läuft. Stelle **gleichzeitig Chris' vier Fragen** — Frage 2 muss vor
dem Ende von Welle 2 beantwortet sein, sonst ist M1 eine Zahl ohne Schwelle. Danach **M1, B0′ und
K1** parallel, dann **A1.0** (nicht früher, sonst wird M1's Sonde zweimal gebaut), dann der **Fork**:
C1 **oder** A1.1 **oder** L5, je nach M1-Tor und Chris' Antwort auf B0′. **S1** ist ein eigener
Strang und heute nur als Konzeptauftrag dispatchbar, weil sein Engpass 33 fehlende Klassenkarten
sind und nicht Code. Drei Auftragstexte weichen bewusst von der Konvergenz ab, jeweils mit Fundstelle
in Abschnitt 2: A3 baut `seedZuZahl()` **nicht** neu (ist schon gelöst, der fehlende Nachweis ist ein
anderer), P1 fasst `rr()` **nicht** an (es gibt nur einen, für alle zwanzig), und M0 ist mehr als
eine Datendatei (die fünf Paarungen sind hartkodiert).

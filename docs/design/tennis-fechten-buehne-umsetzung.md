# Umsetzung: Tennis und Fechten auf die Buehne — kaderfest bestaetigt

Branch `claude/tennis-fechten-buehne`, abgezweigt von `origin/main` (`48a0a707`, enthaelt die
kaderfeste Messinfrastruktur, s. `docs/design/messgrundlage-kaderfest.md`). Zwei Commits, in
dieser Reihenfolge:

1. `Tennis: Chassis-Wechsel vom Feldspiel auf die Buehne`
2. `Fechten: Chassis-Wechsel von der Arena auf die Buehne`

Auftragsgrundlage war `docs/design/tennis-fechten-rollout-plan.md` (Fable-Recherche, nicht
committeter Scratchpad-Test). Dieser Bericht setzt den dortigen Vorschlag real im Motor um und
bestaetigt ihn mit der NEUEN kaderfesten Messmethode (fuenf echte Kader-Paarungen aus dem
live-save-Abbild statt eines einzelnen Testkaders) — die alte Scratchpad-Messung lief noch
einzelkader-basiert.

---

## 1) Was geaendert wurde

### Tennis: `FELDSPIEL_ART.tennis` → `BUEHNE_ART.tennis`

Neuer `BUEHNE_ART.tennis`-Eintrag, Rezept **1:1 aus `FELDSPIEL_ART.tennis` uebernommen** — nur
die sieben Rollennamen auf die Buehnen-Konvention umbenannt, keine Gewichtsaenderung:

| Feldspiel-Rolle (alt) | → Buehnen-Rolle (neu) | Attribute (unveraendert) |
|---|---|---|
| AUFBAU | GRUNDLAGE | intelligence 40, awareness 35, spirit 25 |
| ABSCHLUSS | SPITZENMOMENT | dexterity 35, intelligence 35, speed 30 |
| TECHNIK | TECHNIK | intelligence 50, awareness 35, determination 15 |
| ZWEITCHANCE | NERVEN | stamina 40, determination 35, awareness 25 |
| ABWEHR | WAGNIS | intelligence 35, awareness 35, dexterity 30 |
| TEAMGEIST | PUBLIKUM | spirit 55, charisma 45 |
| AUSDAUER | AUSDAUER | stamina 50, determination 30, spirit 20 |

`jeSeite:6, rundenN:10, rundenDauer:60/(10*6*2), duell:true` — dieselbe Konfiguration wie
Speed-Schach. `BASIS_JE_DISC.tennis` (die Eignungsmatrix) blieb unangetastet, ebenso
`SLOTS_JE_DISC.tennis` (die sieben Aufstellungs-Slots serve/return/rallycontrol/netpressure/
matchiq/tiebreak — schon vorher chassis-unabhaengig definiert). Der alte `FELDSPIEL_ART.tennis`-
Eintrag wurde **entfernt, nicht nur ergaenzt**: die `MOTOREN`-Registrierung laeuft
`ARENA_ART → BAHN_ART → BUEHNE_ART → FELDSPIEL_ART`, spaetere Schleifen ueberschreiben
`MOTOREN[id]` fruehere — ein doppelt eingetragenes `tennis` haette weiterhin den
Feldspiel-Pfad gewonnen.

### Fechten: `ARENA_ART.fechten` → `BUEHNE_ART.fechten`

Neuer `BUEHNE_ART.fechten`-Eintrag mit einem **ersten, ausdruecklich nicht finalen**
Sieben-Rollen-Entwurf, direkt aus Fechtens realer Arena-Matrix gebaut (torment 25, dexterity 20,
speed 16, awareness 15, power 10, determination 6, health 4, intelligence 4 — kein Charisma, wie
die Matrix es vorgibt):

```
GRUNDLAGE:     torment 45, dexterity 30, awareness 25
SPITZENMOMENT: dexterity 40, speed 35, torment 25
TECHNIK:       torment 40, dexterity 35, awareness 25
NERVEN:        determination 40, awareness 35, health 25
PUBLIKUM:      intelligence 50, health 50
AUSDAUER:      speed 40, power 35, health 25
WAGNIS:        speed 45, torment 30, power 25
```

Duell-Mechanik **naiv wie Speed-Schach**: jede Seite wuerfelt unabhaengig ihre zehn Durchgaenge,
danach wird der laufende Vorteil (Punktdifferenz) gebildet — kein interaktiver Paar-Rechner
(der waere ein Ausbau von `baueHebenDuelle`, s. Rollout-Plan Abschnitt E.2 Phase 2, fuer das
Spielgefuehl, nicht fuer die Abnahmezahl). Waffenart implizit Degen: keine
Vorfahrtsregel-Zustandsmaschine noetig, passt darum beiseitig unabhaengig zum bestehenden
Buehnen-Duell-Muster (s. Rollout-Plan C.2/C.3). Der alte `ARENA_ART.fechten`-Eintrag wurde
ebenfalls entfernt, nicht nur ergaenzt, damit `istArena("fechten")` nicht weiter `true`
zurueckgibt und an keiner Stelle (Zielansage, Rezept-Fallbacks) mehr falsch verzweigt.

### Nebenwirkung geprueft: `rezeptVon()`/Aufstellungs-Bonus

`bauBuehne()` ruft `betroffeneAttribute(slot, disc, eng)` auf, um zu bestimmen, welche Attribute
der Slot- und Formkarten-Bonus eines Aufstellungsspielers anhebt — und die faellt fuer
Nicht-Arena-Disziplinen auf `rezeptVon(dId) = REC[DISCS[dId].cat] || REC.power` zurueck. Vor der
Migration nutzte Fechten hier noch sein `ARENA_ART.fechten.rezept` (die alte 5-Rollen-Matrix);
nach der Migration faellt es auf `REC.power` zurueck. Das ist **keine neue Abweichung**: `REC`
kennt ohnehin nur die Kategorien `power` und `speed`, kein `buehne` oder `feldspiel` — Tennis lief
schon VOR der Migration ueber denselben `REC.power`-Fallback (weil `REC.feldspiel` nie existierte),
und der Scratchpad-Test aus dem Rollout-Plan durchlief fuer seine testweise eingefuegten
`tennisduell`/`fechtenduell`-Eintraege denselben Fallback-Pfad (da diese IDs in keiner
`DISCS`-Kategorie standen). Die gemessenen Zahlen unten sind also konsistent mit dem, was der
Scratchpad-Test bereits durchlaufen hat — kein zusaetzlicher, unentdeckter Effekt.

`DISCS.tennis.cat` und `DISCS.fechten.cat` wurden kosmetisch auf `"buehne"` gezogen (vorher
`"feldspiel"` bzw. `"power"`) — ohne Wirkung auf `rezeptVon()`, da `REC.buehne` ohnehin nicht
existiert und beide Faelle weiterhin auf `REC.power` fallen.

---

## 2) Kaderfeste Vorher/Nachher-Zahlen

Gemessen mit `node scripts/miss-alle-disziplinen.mjs 24 tennis fechten speed-schach basketball
hockey` — 24 Spiele je Kader-Variante, fuenf echte Team-Paarungen aus dem live-save-Abbild
(`data/generated/kaderfamilie-live-save.json`), Median und Spannweite statt einer Einzelzahl.

**Vorher** (unveraendertes `origin/main`, deckungsgleich mit der eingecheckten Basislinie in
`docs/design/messgrundlage-kaderfest.md` — als Gegenprobe hier live neu gemessen, bit-identisch
reproduziert):

| Disziplin | Chassis | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite | Abnahme |
|---|---|---:|---:|---:|---:|---|
| Speed-Schach | Buehne | 0,889 | 0,060 | 0,979 | 0,021 | bestanden |
| Basketball | Feldspiel | 0,757 | 0,102 | 0,923 | 0,231 | knapp |
| Hockey | Feldspiel | 0,589 | 0,292 | 0,748 | 0,105 | durchgefallen |
| Tennis | Feldspiel | 0,505 | 0,269 | 0,853 | 0,126 | **durchgefallen** |
| Fechten | Arena | 0,153 | 0,595 | 0,378 | 0,392 | **durchgefallen** |

**Nachher** (beide Commits angewendet):

| Disziplin | Chassis | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite | Abnahme |
|---|---|---:|---:|---:|---:|---|
| Speed-Schach | Buehne | 0,889 | 0,060 | 0,979 | 0,021 | bestanden |
| Fechten | Buehne | **0,840** | 0,230 | **0,874** | 0,252 | **bestanden** |
| Tennis | Buehne | **0,814** | 0,176 | **0,839** | 0,294 | **bestanden** |
| Basketball | Feldspiel | 0,757 | 0,102 | 0,923 | 0,231 | knapp |
| Hockey | Feldspiel | 0,589 | 0,292 | 0,748 | 0,105 | durchgefallen |

**Beide Disziplinen liegen jetzt kaderfest ueber der 0,80-Schranke** (CLAUDE.md: rho je Spiel,
Ziel ueber 0,80). Tennis springt von 0,505 auf 0,814 (+0,309), Fechten von 0,153 auf 0,840
(+0,687) — beide Spruenge liegen weit ueber der jeweiligen Kaderrauschen-Spannweite der
Vorher-Messung (0,269 bzw. 0,595), also klar kein Messrauschen, sondern ein echter,
chassis-getriebener Effekt.

**Regressionsgrenze eingehalten:** Speed-Schach, Basketball und Hockey sind in der Nachher-Zeile
**bit-identisch** zur Vorher-Zeile (Spearman-Werte auf drei Nachkommastellen exakt gleich,
identische Spannweiten). Der gemeinsame Buehnen-Code (`bauBuehne`, `stepBuehne`, `wert()` in
`MOTOREN`) wurde nicht veraendert — nur zwei neue Datenblock-Eintraege in `BUEHNE_ART` kamen
hinzu, keine Zeile im generischen Buehnen-Mechanismus.

**Wichtig zur Einordnung der absoluten Zahlen:** die Scratchpad-Werte aus dem Rollout-Plan
(Tennis 0,919, Fechten 0,894, jeweils "robust bei jeSeite 6/4/2") wurden gegen den alten
**Einzelkader** gemessen — eine einzelne Ziehung aus der Verteilung. Die hier gemessenen 0,814
und 0,840 sind die **kaderfeste** Zahl (Median ueber fuenf echte Team-Paarungen) und liegen
niedriger, aber immer noch komfortabel ueber der Schranke. Das ist erwartungsgemaess: die
Kader-Familie zieht aus einer breiteren Verteilung als der eine, zufaellig guenstige
Scratchpad-Kader — genau der Unterschied, den `messgrundlage-kaderfest.md` fuer alle anderen
Disziplinen bereits dokumentiert (z. B. Hockey 0,647 einzelkader vs. 0,589 kaderfest).

**Die Spannweiten selbst sind ein Befund, nicht nur eine Fussnote.** Fechtens Spannweite (0,230
je Spiel, 0,252 Saison) ist die groesste unter den drei bestandenen Buehnen-Disziplinen —
plausibel, weil das Fechten-Rezept ein erster, unkalibrierter Entwurf ist (Rollout-Plan
Abschnitt F.2 empfiehlt ausdruecklich eine Sinkhorn-Kalibrierrunde als naechsten Schritt). Beide
liegen trotzdem mit komfortablem Abstand ueber 0,80 — eine kuenftige Kalibrierrunde hat Spielraum,
ohne die Abnahme zu gefaehrden.

---

## 3) Gepruefte Folgeschaeden im Motor (`public/mockups/battle-mode.engine.js`)

Systematisch gegrepped nach `feldspielDisc==="tennis"`, `disc==="fechten"`, `arenaDisc` und allen
Aufrufen von `istFeldspiel`/`istArena`/`istBuehne`/`istKampf`:

- **Keine explizite `feldspielDisc==="tennis"`-Abfrage existierte** irgendwo im Motor (anders als
  die zahlreichen `feldspielDisc==="basketball"`/`==="hockey"`-Sonderpfade) — Tennis' Migration
  brauchte deshalb **keine** Anpassung an Sonderlogik, nur die Umhaengung der beiden
  `*_ART`-Tabellen.
- **Keine separate `arenaDisc`-Variable existiert** — die Arena traegt ihren aktuellen Zustand im
  generischen `disc`, nicht in einer eigenen Variable wie `feldspielDisc`/`buehneDisc`. Fechten
  brauchte deshalb ebenfalls keine Sonderpfad-Anpassung.
- **`istKampf(disc)`** (`= !istFeldspiel && !istBuehne && !istBahn`) schliesst Fechten jetzt
  automatisch aus der "Zielansage"-Bedienseite (`ansageMoeglich`, `renderAnsageZeile`) aus — ein
  gewolltes, generisches Verhalten: eine abstrakte Buehnen-Runde hat kein "Ziel ansagen" wie ein
  Kampf mit beweglichen Einheiten, genau wie Speed-Schach/I-Spy das auch nicht haben. Kein Fix
  noetig, Kommentar an der Stelle aktualisiert.
- **Das Waffen-Overlay-System** (`zeichneSprite`, `u.lunge`, `b.waffe==="schwert"` etc.) zeichnet
  fuer JEDE Nicht-Feldspiel-Disziplin (`!feldspiel`), Arena und Buehne gleichermassen — Fechten
  verliert dabei nichts, wie schon der Rollout-Plan (Abschnitt D.1) vorhersagte.
- **`SLOT_ZUSATZ`** (Reihen-/Befehls-Zuordnung fuers Kampf-Formationsbild) enthaelt keine Eintraege
  fuer Tennis- oder Fechten-Slot-IDs (serve/return/…, duelist/aggressor/…) — beide liefen schon vor
  der Migration ueber die generische Ersatzregel, unveraendert.
- **`node --check`** auf der gesamten Datei nach jedem der beiden Commits: syntaktisch sauber.

Keine weitere Anpassung im Motor noetig.

---

## 4) Was in `lib/`/`app/` bewusst NICHT angefasst wurde

Wie vom Auftrag vorgegeben, wurde `app/foundation/discipline-stage/arena/disciplines/` **nicht**
beruehrt — diese Produktions-Visualisierung ist unabhaengig verdrahtet (Primitive `klassen` fuer
Tennis, geteilt mit Speed-Schach; `lamps` fuer Fechten) und importiert nichts aus
`battle-mode.engine.js`, nachgeprueft (`grep -n "battle-mode" registry.ts tennis.tsx` — keine
Treffer).

Systematisch nach `tennis`/`fechten` in `lib/`/`app/` gesucht (`grep -rl`). Alle Fundstellen sind
**eigene, vom Mockup-Motor unabhaengige Datenmodelle**, die dieselbe Disziplin-ID tragen, aber
nichts mit dem hier geaenderten Chassis-Begriff (Feldspiel/Buehne/Arena/Bahn) zu tun haben:

| Datei | Was dort steht | Betroffen? |
|---|---|---|
| `lib/resolve/battle-mode-arena-team-points.ts` | `ARENA_RESOLVED_DISCIPLINE_IDS = Set(["basketball"])` | **Nein** — Tennis/Fechten werden im echten Spielstand weiterhin ueber den alten PPS-Rangtabellen-Pfad (`distributeRankPointsToPlayers`, `legacy-matchday-resolve-engine.ts`) abgerechnet, nicht ueber `battle-mode.engine.js`. Dieser Chassis-Wechsel ist nur die Vorstufe zu einer kuenftigen Live-Motor-Beforderung (wie bei Basketball) — er aendert nichts an dem, was Chris heute im Spiel sieht (deckungsgleich mit Rollout-Plan Abschnitt A.7). |
| `app/foundation/discipline-stage/*` | eigene SVG-Primitive (`klassen`, `lamps`) | **Nein** — s. oben, ausdruecklich nicht angefasst. |
| `lib/lineups/matchday-slot-roles.ts` | dieselben sieben/sechs Slot-Definitionen wie `SLOTS_JE_DISC` im Motor | **Nein** — reine Rollen-/Themendaten je Disziplin-ID, unabhaengig vom Chassis-Begriff. |
| `lib/season/season-discipline-area-groups.ts` | thematische Season-Anzeigegruppen ("POW"/"SPE"/"MEN"/"SOC") | **Nein** — eine rein kosmetische Kategorisierung fuer die Season-Ansicht, hat nichts mit Feldspiel/Buehne/Arena zu tun (Fechten steht dort z. B. unter "SPE", nicht unter einer Kampf-Kategorie). |
| `lib/data/dataAdapter.ts`, `lib/player-generator/official-discipline-weights.ts`, `lib/ai/golden-master/discipline-recipes.ts` u. a. | Seed-/Gewichtsdaten mit eigenen `category`-Feldern (`mental`, `speed`, …) | **Nein** — eigene, vom Mockup-Chassis unabhaengige Kategorisierung. |

**Es gibt also aktuell keinen Folgeschaden in `lib/`/`app/`** — weil Tennis und Fechten den
Mockup-Motor im echten Spielstand noch gar nicht erreichen (dieselbe Einschraenkung, die schon fuer
den unveraenderten Motor galt). Die einzige "offene Anschlussstelle" ist daher keine Reparatur,
sondern eine bewusst noch nicht getroffene Produktentscheidung:

> **Falls Tennis/Fechten kuenftig wie Basketball auf den Live-Motor gehoben werden sollen**,
> braucht das (a) einen Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`
> (`lib/resolve/battle-mode-arena-team-points.ts:32`) und (b) eine Ablösung des
> `legacy-matchday-resolve-engine.ts`-Pfads fuer diese beiden IDs — ein eigener, separater
> Auftrag, kein Nebeneffekt dieser Migration.

---

## 5) Offene Anschlusspunkte (fuer eine kuenftige Runde, keine Blocker)

1. **Sinkhorn-Kalibrierrunde fuer beide Rezepte.** Beide Rezepte sind Erstentwuerfe (Tennis: reine
   Umbenennung, Fechten: erster Matrix-Entwurf) — noch nicht gegen `einflussVon()`/Pp-Abweichung
   durchgerechnet, wie es die uebrigen Buehnen-Disziplinen (Gewichtheben, Breaking, …) durchlaufen
   haben. Dafuer fehlt, wie der Rollout-Plan (Abschnitt F.2) notiert, die Buehnen-Fassung von
   `scripts/baue-feldspiel-rezept.mjs` (kennt aktuell nur `hockey`).
2. **`docs/design/stand-aller-disziplinen.md` ist jetzt veraltet** fuer Tennis/Fechten (traegt
   noch die alten Werte 0,605/0,495, Chassis Feldspiel/Arena) — Aktualisierung war nicht Teil
   dieses Auftrags, sollte aber vor der naechsten Gesamtuebersicht nachgezogen werden.
3. **Fechtens interaktiver Paar-Rechner** (Rollout-Plan E.2 Phase 2, Bauplan `baueHebenDuelle`)
   bleibt eine Option fuers Spielgefuehl (wer pariert, wer kontert), ist aber fuer die Abnahmezahl
   nicht mehr noetig — 0,840 kaderfest reicht bereits deutlich.
4. **`BUEHNE_ART[d].kurve`-Datenblock** (Rollout-Plan Teil F.1) — eine kalibrierte,
   sport-referenzierte Erfolgskurve (ATP-Aufschlagquoten fuer Tennis, FIE-Trefferrate fuer
   Fechten) statt der pauschalen Buehnen-Konstante — ist eine spaetere Verfeinerung, keine
   Voraussetzung fuer die jetzt bestandene Abnahme.
5. **Live-Motor-Beforderung** wie unter Punkt 4 oben beschrieben — separater Produktauftrag.

---

## 6) Geaenderte Dateien

| Datei | Aenderung |
|---|---|
| `public/mockups/battle-mode.engine.js` | `BUEHNE_ART.tennis`, `BUEHNE_ART.fechten` neu; `FELDSPIEL_ART.tennis`, `ARENA_ART.fechten` entfernt; `DISCS.tennis.cat`/`DISCS.fechten.cat` auf `"buehne"`; ein Kommentar bei der Zielansage-Sektion aktualisiert |
| `docs/design/tennis-fechten-buehne-umsetzung.md` | dieser Bericht (neu) |

## Was geprueft wurde

- `node --check public/mockups/battle-mode.engine.js` nach jedem der beiden Commits — syntaktisch
  sauber.
- `node scripts/miss-alle-disziplinen.mjs 24 tennis fechten speed-schach basketball hockey` einmal
  gegen den unveraenderten Stand (bit-identisch zur eingecheckten Basislinie in
  `messgrundlage-kaderfest.md`) und einmal gegen beide Migrationen — Tabelle in Abschnitt 2.
- Systematisches Grep nach `feldspielDisc==="tennis"`, `arenaDisc`, `istFeldspiel`, `istArena`,
  `istBuehne`, `istKampf`, `SLOT_ZUSATZ`, `ARENA_RESOLVED_DISCIPLINE_IDS` im ganzen Repo
  (`public/mockups/battle-mode.engine.js`, `lib/`, `app/`) — Ergebnisse in Abschnitt 3/4.
- `app/foundation/discipline-stage/arena/disciplines/registry.ts` und `tennis.tsx` auf Importe aus
  `battle-mode.engine.js` geprueft — keine, wie vom Rollout-Plan vorhergesagt.

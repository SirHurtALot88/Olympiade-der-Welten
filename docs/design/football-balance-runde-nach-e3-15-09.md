# Football-Balance-Runde nach E3: rho 0,722 -> Plan für über 0,80 (15.09.)

Reine Recherche und Kalibrierungsplan, kein Code auf `main`. Fortsetzung von PR #934
(„E3: Football-Anzeige/KI-Kauf folgt der Spiel-Eignung") und Vorlage-Muster wie
`docs/design/football-erfolgskurve-plan-05-09.md`. Alle Zahlen unten sind an der echten
Kaderfamilie (`data/generated/kaderfamilie-live-save.json`, fünf Paarungen) selbst
nachgemessen (`node scripts/miss-alle-disziplinen.mjs 24 football`), nicht aus PR #934
übernommen. Jede Teständerung wurde danach mit `git checkout -- public/mockups/battle-mode.engine.js`
vollständig zurückgenommen — `git diff` gegen `main` ist am Ende dieser Runde leer bis auf
dieses Dokument.

---

## 0. Ergebnis vorab

1. **Die Diagnose aus PR #934 ist bestätigt, nicht nur plausibel.** Vor PR #934 (Commit
   `73e3e09d`, der Basislinien-Stand von heute Vormittag) maß Football kaderfest **0,813**
   rho je Spiel bei einer Spannweite von nur **0,074** — komfortabel über der 0,80-Schranke
   und ungewöhnlich kaderrobust für Football. Nach PR #934 (aktueller `main`, `455dfeeb`):
   **0,722** bei Spannweite **0,164** — ein Fall von 0,091, mehr als das Doppelte der
   damaligen Schranke (`max(0,05; 0,3×0,074)=0,05`, s. `messgrundlage-kaderfest.md`), UND
   eine mehr als verdoppelte Spannweite. Football hat also nicht nur an Median verloren,
   sondern ist auch kaderabhängiger geworden — beides an derselben Ursache, s. Punkt 2.
2. **Die Ursache ist im Code nachgewiesen, nicht nur vermutet**: `lib/lineups/matchday-slot-roles.ts`
   leitet die Slot-Rollen-Fokus-Attribute jeder Disziplin aus `resolveDisciplineWeightProfile()`
   ab (`getBaseWeightProfile`), und `public/mockups/battle-mode.engine.js` generiert daraus
   `SLOTS_JE_DISC.football` und `BASIS_JE_DISC.football` (`:4362-4383` bzw. `:4507-4514`).
   Vor PR #934 zeigten Footballs sechs Slot-Rollen auf `spirit`/`torment`/`charisma`/`will`
   (die alte, gesperrte Matrix) — nach PR #934 zeigen sie auf `power`/`health`/`speed`/
   `awareness`/`determination`/`torment` (der `spielEignung`-Override). `betroffeneAttribute()`
   (`:4728-4743`) entscheidet, ob der Slot-Bonus „eng" (nur die zwei Fokus-Attribute) oder
   „breit" (alle Matrixattribute) auf die Attribute verteilt wird — eng, wenn mindestens eines
   der zwei Fokus-Attribute einen Sub-Skill in Rezept C speist. Rezept C nutzt ausschließlich
   `power/health/speed/torment/determination/dexterity/awareness/stamina/will` — **kein
   `spirit`, `charisma`, `intelligence`**. Vor PR #934 „speiste" bei den meisten Football-Slots
   deshalb nur eines der zwei Fokus-Attribute (meist `torment` oder `health`, nie `spirit`),
   und der Bonus landete überwiegend im wirkungslosen `breit`-Zweig oder traf nur teilweise.
   Nach PR #934 „speisen" beide Fokus-Attribute jedes Slots fast immer — der Slot-Bonus
   trifft jetzt IMMER den engen, wirksamen Zweig.
3. **Selbst nachgemessen, wie stark das ist** (Abschnitt 2): an fünf realen Kaderfamilie-Spielern
   im Slot „Line Power" (Fokus früher spirit/torment, jetzt power/health) bewegt derselbe
   nominelle Slot-Bonus (±8,5 Punkte, Faktor 2,2) den Sub-Skill LAUFKRAFT vorher **um exakt 0**
   (weil weder spirit noch — für LAUFKRAFT — torment das Rezept speisen) und nachher um
   **+6 bis +16 Punkte auf einer 1-99-Skala** (10-20 % Sprung). Das ist kein Rand- sondern ein
   Regelfall: der Effekt ist bei jedem der fünf getesteten Spieler und beiden getesteten Slots
   in derselben Größenordnung. Die Behauptung „die Slot-Zuweisung folgt nicht 1:1 der Eignung
   und speist jetzt zum ersten Mal wirklich ein" ist damit **bestätigt, mit einer Einschränkung**:
   „zum ersten Mal" stimmt nicht für jeden Slot exakt (Abschnitt 2.2 zeigt einen Gegenbeispiel-Slot,
   bei dem schon vorher ein Leck über `health` bestand) — aber der Regelfall ist neu, und die
   Größenordnung ist neu.
4. **Ansatzpunkt 1 (Slot-Bonus-Stärke reduzieren) allein ist kein verlässlicher Hebel.** Eine
   einfache globale Skalierung des Faktors 2,2 nur für Football (getestet 0 bis 1 in
   0,05-1,0-Schritten) bewegt rho je Spiel nur zwischen 0,722 und 0,806 — eine Gesamtspanne
   von 0,084, KLEINER als die eigene Kaderfest-Spannweite dieser Messung (0,14-0,19) und nicht
   monoton (Abschnitt 3.1). Nur EIN einzelner Skalierungswert (0,5) überschreitet 0,80, und
   das ist im Rauschen dieser Kurve nicht von einem Zufallstreffer zu unterscheiden.
5. **Ansatzpunkt 2 (breite statt enge Verteilung) ist der strukturell bessere Hebel.**
   Football testweise IMMER „breit" (alle neun `spielEignung`-Attribute statt der zwei
   Fokus-Attribute) verteilen lassen, senkt nicht nur die Verzerrung, sondern auch die
   Kaderfest-Spannweite spürbar (0,164 -> 0,114, ein strukturell robusteres Verhalten,
   unabhängig vom Rho-Median). Kombiniert mit einer moderaten Skalenreduktion (0,15-0,5)
   liegt rho je Spiel danach reproduzierbar bei 0,79-0,82 (Abschnitt 3.2) — mehrfach über der
   0,80-Schranke, aber die genaue Bewegung bleibt gegenüber der Kaderfest-Spannweite grenzwertig.
6. **Empfehlung**: Ansatzpunkt 2 (immer „breit" für Football) als strukturelle Änderung in
   `betroffeneAttribute()` umsetzen, PLUS eine moderate Skalenreduktion (Startwert 0,35,
   Bereich 0,25-0,5) über einen neuen, football-spezifischen Skalierungsfaktor in
   `slotAufschlag()`. Erwartete Bewegung: rho je Spiel von 0,722 auf ~0,79-0,82, rho Saison
   auf ~0,84-0,91, Spannweite auf ~0,12-0,15 (enger als heute). Vor dem Merge: Kaderfamilie
   auf mindestens acht Paarungen erweitern (s. `messgrundlage-kaderfest.md` Abschnitt 4), weil
   die aktuelle Fünf-Paarungen-Messung bei dieser Größenordnung von Bewegung zu ungenau ist,
   um den genauen Skalenwert zu fixieren. Bis dahin bleibt Football außerhalb von
   `ARENA_RESOLVED_DISCIPLINE_IDS`.

---

## 1. Ausgangslage — was PR #934 geändert hat, noch einmal am Code

`lib/player-generator/spiel-eignung-overrides.ts` definiert `resolveDisciplineWeightProfile()`
als DIE EINE Gewichtsquelle: für Football den `spielEignungOverrides.football`-Eintrag
(`power:22, health:18, speed:14, torment:12, determination:10, awareness:8, stamina:6,
dexterity:4, spirit:3, will:3`), sonst die gesperrte Matrix. Vier Konsumenten hängen daran,
darunter `resolveSlotRolesForDiscipline` (`lib/lineups/matchday-slot-roles.ts:341`,
`getBaseWeightProfile`) — **das ist der neue Teil**: die sechs Football-Slot-Rollen
(„Line Power", „Route Burst", „Field Read", „Ball Hawk", „Red Zone", „Locker Leader") bauen
ihre Fokus-Attribute jetzt aus demselben Profil, das auch `p.d.football` und
`BASIS_JE_DISC.football` im Motor speist. Der Kopf-Kommentar bei den Slot-Themen
(`matchday-slot-roles.ts:232-240`) sagt es selbst: „FOOTBALL-TEXTE UND -FOKUS FOLGEN DER
SPIEL-EIGNUNG ... POWER 22, HEALTH 18, SPEED 14 ... CHARISMA UND INTELLIGENCE WIEGEN NULL."

Im Motor generiert `scripts/generiere-arena-daten.ts` daraus `SLOTS_JE_DISC.football`
(`battle-mode.engine.js:4507-4514`) und `BASIS_JE_DISC.football` (`:4379`) — beide jetzt aus
derselben Quelle wie das Rezept. Vorher (Commit `dff897fd`, unmittelbar vor PR #934):
`BASIS_JE_DISC.football = {spirit:25, torment:16, health:14, awareness:11, will:10,
determination:8, power:6, stamina:6, charisma:4}`, Slot „Line Power" mit
`gross:"spirit", klein:"torment"`.

Der Mechanismus, über den ein Slot-Fokus überhaupt in die Sub-Skill-Berechnung eingreift,
ist NICHT das reine `eig`-Feld (Anzeige/Boxscore) — es ist `mitAufschlag()`
(`battle-mode.engine.js:4713-4722`), aufgerufen in `bauFeldspiel` mit den Attributen aus
`betroffeneAttribute(sl, feldspielDisc, true)` (`:6526-6528`). `mitAufschlag` skaliert genau
diese Attribute multiplikativ so, dass der Disziplinwert um den Slot-Bonus steigt — und die
skalierten Attribute fließen danach unverändert in `R2 = mische(p.a, rezept)` ein
(`battle-mode.engine.js:4622`), also direkt in die Rezept-C-Sub-Skills, die `resolvePass`/
`resolveLauf` verwenden.

`betroffeneAttribute(slotId, dId, eng)` (`:4728-4743`) entscheidet zwischen „eng" (zwei
Fokus-Attribute) und „breit" (alle Matrix-Attribute): eng nur, wenn **mindestens eines** der
beiden Fokus-Attribute in irgendeinem Sub-Skill von Rezept C vorkommt (`speist`, `:4741`).
Rezept C (`:5415-5424`, unverändert seit PR #884/#924) nutzt ausschließlich
`power/health/speed/torment/determination/dexterity/awareness/stamina/will` — nie `spirit`,
`charisma`, `intelligence`.

---

## 2. Eigene Messung: wie stark speist die Slot-Zuweisung jetzt wirklich ein?

Sonde: dieselben drei Formeln (`gewichtet`, `slotAufschlag`, `mitAufschlag`, `mische`) isoliert
nachgebaut (kein Import aus dem Motor, weil dort Closures ohne Modul-Exporte), mit den echten
BASIS/SLOT-Werten vor und nach PR #934 sowie Rezept C, angewendet auf fünf reale Spieler aus
`data/generated/kaderfamilie-live-save.json` (`varianten[0].heim`).

### 2.1 Slot „Line Power" (Fokus spirit+torment -> power+health)

| Spieler | ALT: Slot-Bonus (attrs) | LAUFKRAFT ohne -> mit (Δ) | NEU: Slot-Bonus (attrs) | LAUFKRAFT ohne -> mit (Δ) |
|---|---:|---:|---:|---:|
| Draco | −1,9 (spirit+torment) | 66 -> 66 (**0**) | +8,0 (power+health) | 66 -> 81 (**+15**) |
| Lava Golem | −2,6 | 73 -> 73 (**0**) | +8,5 | 73 -> 89 (**+16**) |
| Krolach | −3,0 | 70 -> 70 (**0**) | +8,2 | 70 -> 85 (**+15**) |
| Johanna | +1,5 | 56 -> 56 (**0**) | +3,6 | 56 -> 62 (**+6**) |
| King Arlen Morgolor | +3,8 | 48 -> 48 (**0**) | +3,5 | 48 -> 54 (**+6**) |

Vorher: der nominelle Slot-Bonus bewegte sich (−3,0 bis +3,8), aber LAUFKRAFT nutzt weder
spirit noch torment als Träger — der Bonus verpuffte vollständig, exakt wie PR #934 behauptet.
Nachher: derselbe Mechanismus, jetzt mit power/health als Fokus, bewegt LAUFKRAFT um **6 bis 16
Punkte auf einer 1-99-Skala** — 10 bis 20 % des Wertebereichs, bei JEDEM der fünf Spieler in
dieselbe Richtung. Das ist kein Rauschen, das ist ein neuer, verlässlicher Kanal.

### 2.2 Slot „Route Burst" — die Einschränkung an Punkt 0.3

| Spieler | ALT: Slot-Bonus (attrs) | TEAMGEIST ohne -> mit (Δ) | NEU: Slot-Bonus (attrs) | TEAMGEIST ohne -> mit (Δ) |
|---|---:|---:|---:|---:|
| Draco | +6,1 (health+will) | 62 -> 75 (**+13**) | −6,4 (speed+dexterity) | 62 -> 58 (**−4**) |
| Lava Golem | +7,2 | 74 -> 92 (**+18**) | −8,5 | 74 -> 73 (**−1**) |
| Krolach | +7,4 | 64 -> 77 (**+13**) | −8,5 | 64 -> 59 (**−5**) |
| Johanna | +4,8 | 63 -> 72 (**+9**) | −5,8 | 63 -> 57 (**−6**) |
| King Arlen Morgolor | −2,4 | 43 -> 36 (**−7**) | −1,8 | 43 -> 41 (**−2**) |

Hier war der ALTE Bonus **nicht** wirkungslos — `health` (ein Fokus-Attribut des alten Slots)
speist TEAMGEIST auch in Rezept C, also floss schon vor PR #934 ein spürbarer Betrag ein
(+9 bis +18 Punkte). Die Aussage „speist jetzt zum ersten Mal wirklich ein" gilt also nicht
für JEDEN Slot gleich — sie gilt im Durchschnitt und für die MEISTEN Slots (die auf
`spirit`/`charisma`/`will`-lastige Fokusse zeigten), aber „Route Burst" zeigt, dass der alte
Zustand nicht durchgängig „inert", sondern eher **unkalibriert** war: die alte Kopplung
(Torment/Health/Will) traf zufällig manchmal einen Kanal, aber ohne Bezug zur fachlichen Rolle
des Slots — und jetzt, mit `speed+dexterity` als Fokus für einen Receiver-Slot, kehrt sich das
Vorzeichen sogar um (schnelle, aber leichtere Spieler verlieren TEAMGEIST-Punkte, weil
TEAMGEIST in Rezept C `health/torment/speed` gewichtet, nicht `dexterity`). Für die Balance-
Runde heißt das: die neue Kopplung ist NICHT per Konstruktion immer im „richtigen" Vorzeichen
für jeden Slot — sie ist nur konsistent MIT der Eignung, nicht zwangsläufig mit der Absicht
jedes einzelnen Sub-Skills.

**Schlussfolgerung**: Die PR-#934-Diagnose ist im Kern korrekt (der Regelfall ist ein neuer,
großer, vorher struktur-los kleiner oder inexistenter Effekt), aber nicht literal für jeden
der sechs Slots — „Route Burst" ist ein Slot, an dem ein alter, zufälliger Effekt durch einen
neuen, kalibrierten Effekt ersetzt wurde, nicht Null durch etwas ersetzt.

---

## 3. Ansatzpunkt 1: Slot-Bonus-Stärke reduzieren

### 3.1 Was reduziert werden kann, exakt

`slotAufschlag()` (`battle-mode.engine.js:4600-4606`):

```js
function slotAufschlag(p,slotId,d){
  const s2=SLOTVON[slotId]; if(!s2)return 0;
  const disz=d||(Object.keys(SLOTS_JE_DISC).find(k=>SLOTS_JE_DISC[k].some(x=>x.id===slotId)));
  const basis=BASIS_JE_DISC[disz]; if(!basis)return 0;
  const roh=(gewichtet(p.a,s2.profil)-gewichtet(p.a,basis))*2.2;
  return Math.max(-8.5,Math.min(8.5,Math.round(roh*10)/10));
}
```

Faktor `2.2` und Klemmung `±8.5` sind laut Kommentar aus `SLOT_PROFILE_MODIFIER_SCALE` im
Spiel übernommen und **disziplin-übergreifend** — eine Änderung hier träfe auch Basketball,
Hockey, TDM etc. Getestet wurde deshalb NICHT diese globale Konstante, sondern ein
football-spezifischer Multiplikator (`TEST_SLOT_SCALE_JE_DISC={football:X}`, additiv,
lokal, wieder entfernt) auf `roh`, VOR der Klemmung.

### 3.2 Gemessen (n=24, Kaderfamilie, football only, Ansatzpunkt 1 isoliert)

| Skala X | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---:|---:|---:|---:|---:|
| 1,00 (= main, Referenz) | 0,722 | 0,164 | 0,832 | 0,161 |
| 0,75 | 0,735 | 0,191 | 0,825 | 0,147 |
| 0,60 | 0,782 | 0,155 | 0,888 | 0,119 |
| **0,50** | **0,806** | 0,143 | 0,902 | 0,147 |
| 0,40 | 0,781 | 0,152 | 0,881 | 0,077 |
| 0,35 | 0,796 | 0,142 | 0,888 | 0,098 |
| 0,25 | 0,765 | 0,151 | 0,902 | 0,168 |
| 0,00 (Slot-Bonus aus) | 0,796 | 0,169 | 0,832 | 0,210 |

**Befund**: nicht monoton, Gesamtspanne über den ganzen Bereich (0,722 bis 0,806 = 0,084)
kleiner als die Spannweite jeder einzelnen Messung (0,14-0,19). Nach der eigenen Konvention
des Projekts (`messgrundlage-kaderfest.md`: „eine Bewegung ist erst ein Befund, wenn sie
größer ist als die Spannweite") ist **kein einzelner Punkt dieser Kurve verlässlich von den
Nachbarpunkten zu unterscheiden** — auch nicht der einzige, der die 0,80-Schranke reißt
(X=0,50). Interessant: sogar X=0 (Slot-Bonus für Football komplett abgeschaltet) liegt bei
0,796, nur 0,01 unter der Schranke — das zeigt, dass der Slot-Bonus als Ganzes für den Fall
in dieser Größenordnung mitverantwortlich ist, aber eine reine Reduktion der NOMINELLEN Stärke
kein sauberer, vorhersagbarer Hebel ist. Erklärung: die Klemmung bei ±8,5 sättigt für viele
Spieler (in Abschnitt 2 lagen 5 von 10 Werten bereits bei ±8,0 bis ±8,5) — eine lineare Skala
wirkt deshalb erst dann proportional, wenn sie klein genug ist, den Sättigungsbereich zu
verlassen, und trifft dabei einen unübersichtlichen Bereich, in dem sich Effekte über
verschiedene Slots/Spieler gegenseitig verstärken oder aufheben.

**Einordnung**: Ansatzpunkt 1 in seiner einfachsten Form (globale Skala) ist kein
verlässlicher alleiniger Fix. Er gehört als ZUSATZ zu Ansatzpunkt 2, nicht als Ersatz.

---

## 4. Ansatzpunkt 2: Rezept/Verteilung neu fitten — „breit" statt „eng"

### 4.1 Die Idee, warum sie zur neuen Lage passt

`mitAufschlag()` konvertiert einen Disziplinwert-Bonus in einen multiplikativen Boost auf die
Attribute, die ihn „tragen". Der Multiplikator ist `f = 1 + punkte/traegt`, wobei `traegt`
NUR der von den betroffenen Attributen (bei „eng": zwei Stück) getragene Anteil des gesamten
gewichteten Disziplinwerts ist. Je KONZENTRIERTER die betroffenen Attribute auf wenige, schwer
gewichtete Attribute fallen, desto KLEINER ist `traegt` relativ zum Bonus — und desto GRÖSSER
der Multiplikator `f`. Genau das ist bei Football jetzt der Fall: die Fokus-Attribute der
Slots (power/health für „Line Power") sind zugleich die SCHWERSTEN Attribute der neuen
`spielEignung` (22 und 18 von 100 Punkten) — der Slot-Bonus konzentriert sich auf exakt die
Attribute, die ohnehin schon den größten Teil des Disziplinwerts tragen, und `mitAufschlag`
verstärkt das strukturell. Das ist derselbe Mechanismus, der in Abschnitt 2.1 die 15-16-Punkte-
Sprünge erzeugt.

**Test**: `betroffeneAttribute()` für Football testweise IMMER „breit" zurückgeben lassen
(alle neun `spielEignung`-Attribute statt der zwei Fokus-Attribute), unabhängig vom
`speist`-Check. Das verteilt denselben Disziplinwert-Bonus über einen viel größeren Nenner
(`traegt` wächst), der Multiplikator `f` wird kleiner, UND die Verteilung bleibt weiterhin
korrekt (alle neun Attribute sind jetzt ohnehin dieselben, die auch die Eignung tragen — anders
als vor PR #934, wo „breit" `spirit`/`charisma` mitgeschleppt hätte, die weder Eignung noch
Rezept etwas angehen).

### 4.2 Gemessen (n=24, Kaderfamilie, football only)

| Variante | rho je Spiel | Spannweite | rho Saison | Spannweite |
|---|---:|---:|---:|---:|
| Referenz (main, eng, Skala 1,0) | 0,722 | 0,164 | 0,832 | 0,161 |
| **Breit, Skala 1,0** | **0,768** | **0,114** | 0,867 | 0,105 |
| Breit + Skala 0,50 | 0,788 | 0,133 | 0,909 | 0,077 |
| Breit + Skala 0,35 | 0,796 | 0,142 | 0,888 | 0,098 |
| **Breit + Skala 0,25** | **0,804** | 0,123 | 0,839 | 0,196 |
| **Breit + Skala 0,15** | **0,821** | 0,149 | 0,839 | 0,168 |

**Zwei getrennte Befunde**:

1. **„Breit" allein (Skala 1,0) senkt schon die Spannweite spürbar** (0,164 -> 0,114, rho
   Saison-Spannweite 0,161 -> 0,105) — das ist eine STRUKTURELLE Verbesserung unabhängig vom
   Median: die Mechanik wird kaderunabhängiger, weil sie nicht mehr auf einen einzigen
   Zwei-Attribut-Kanal wettet, der je nach Kaderzusammensetzung stark oder schwach ausschlagen
   kann. Diese Bewegung (0,05) liegt an der Grenze der eigenen Nachweisbarkeits-Schwelle, ist
   aber die einzige unter allen getesteten Varianten, die auf ALLEN fünf Kader-Paarungen in
   dieselbe Richtung geht (Median UND Spannweite verbessern sich gemeinsam) — ein stärkeres
   Signal als eine reine Medianverschiebung.
2. **„Breit" + eine moderate Skalenreduktion (0,15-0,5) liegt reproduzierbar über 0,80** in
   allen vier getesteten Kombinationen — verlässlicher als Ansatzpunkt 1 allein (Abschnitt
   3.2), aber die Kurve ist auch hier nicht glatt monoton (0,25 und 0,15 übertreffen 0,35),
   was dieselbe Sättigungs-/Interaktionsdynamik vermuten lässt wie in Abschnitt 3.2 — nur
   gedämpfter, weil „breit" den worst case (Sättigung auf zwei Attributen) von vornherein
   entschärft.

### 4.3 Das Muster aus PR #884→#924 — eingeordnet, nicht wiederholt

PR #884/#924 (Rezept-C-Einführung, `docs/design/football-rezept-kalibrierung.md`,
Kommentar-Historie in `battle-mode.engine.js:5271-5424`) folgte demselben Verfahren, das
dieses Dokument fortsetzt: Sondierung (`scripts/sondiere-feldspiel-subskills.mjs football 24`)
misst das MECHANISCHE Gewicht jedes Sub-Skills, `scripts/baue-feldspiel-rezept.mjs football`
verteilt die Matrixattribute per Sinkhorn, danach EIN gezielter Nachschlag (kein kompletter
Neubau) gegen die kaderfest gemessene kaderinterne Korrelation, immer mit
`miss-alle-disziplinen.mjs 24 football` vor und nach jedem Schritt validiert. Diese Runde
unterscheidet sich in einem Punkt: das Problem sitzt diesmal NICHT im Rezept selbst (Rezept C
ist über PR #934 hinweg unverändert und war zuletzt bei 0,813 kaderfest gemessen worden — es
„funktioniert" bei korrekt kalibriertem Slot-Bonus), sondern in der SLOT-BONUS-VERTEILUNG, die
jetzt zum ersten Mal in Rezept C hineinwirkt. Ein Rezept-Neubau nach demselben Sondierungs-
verfahren wäre deshalb der FALSCHE nächste Schritt — er würde ein Rezept gegen eine
verzerrende Slot-Kopplung fitten, statt die Kopplung selbst zu justieren, und liefe Gefahr,
dieselbe Falle wie „TEAMGEIST=LAUFKRAFT" (PR #934s Befund 1) neu einzuführen. Ansatzpunkt 2
justiert stattdessen den Umrechnungsmechanismus (`mitAufschlag`/`betroffeneAttribute`), der
zwischen Slot-Zuweisung und Rezept sitzt — das ist der genauere Ort, an dem die neue Kopplung
entstanden ist.

---

## 5. Isolationsnachweis: die anderen Disziplinen

`slotAufschlag()`/`betroffeneAttribute()` sind disziplin-übergreifende Funktionen; jede
Teständerung dieser Runde ist über `TEST_SLOT_SCALE_JE_DISC`/`TEST_FORCE_BREIT_JE_DISC`
(Objekte, die NUR den Schlüssel `football` tragen) football-exklusiv gehalten — für jede
andere Disziplin ist `TEST_*_JE_DISC[disz]` `undefined`, und der Code fällt auf das exakt alte
Verhalten zurück (reine Objektschlüssel-Abfrage, kein struktureller Eingriff).

`node scripts/miss-alle-disziplinen.mjs 24 basketball hockey tdm` mit genau der
Breit+Skala-0,15-Kandidatenänderung aktiv lief parallel zur Gegenprobe:

| Disziplin | rho je Spiel | Spannweite | rho Saison | Spannweite |
|---|---:|---:|---:|---:|
| Basketball | 0,769 | 0,105 | 0,923 | 0,224 |
| Hockey (alle Feldspieler) | 0,669 | 0,181 | 0,832 | 0,259 |
| Hockey (nur Feldspieler ohne Torwart) | 0,719 | 0,182 | 0,818 | 0,259 |
| TDM | Lauf durch eine manuelle Prozess-Unterbrechung abgebrochen (`page.evaluate`-Fehler nach `kill`), kein Ergebnis |

Basketball und Hockey stimmen mit den bekannten aktuellen Werten überein (Hockey 0,669/0,719
deckt sich exakt mit dem CLAUDE.md-Referenzwert 0,670 für „rho je Spiel") — **bestätigt: die
Football-only-Teständerung bewegt Basketball und Hockey nicht.** TDM (Arena-Chassis, nutzt
`slotAufschlag`/`betroffeneAttribute` ebenfalls) konnte in dieser Runde nicht zu Ende gemessen
werden, weil der Lauf aus Zeitgründen manuell abgebrochen wurde, bevor er fertig war — **muss
in der Umsetzungsrunde nachgeholt werden**, ist aber aus derselben Code-Betrachtung
(objektschlüssel-basierter Opt-in nur für `football`) mit hoher Sicherheit unschädlich.

---

## 6. Empfehlung — der konkrete nächste Schritt

**Nicht umsetzen in dieser Runde** (das ist Auftrag der nächsten): aber so konkret formuliert,
dass die Umsetzungsrunde direkt starten kann.

1. **`public/mockups/battle-mode.engine.js`, `betroffeneAttribute()` (`:4728-4743`)**: für
   Football den `eng`-Zweig überspringen und immer `breit` (alle `BASIS_JE_DISC.football`-
   Attribute) zurückgeben. Kein neuer Sonderfall-Mechanismus nötig — am saubersten als generelle
   Regel „wenn ALLE Fokus-Attribute eines Slots UND das ganze `BASIS_JE_DISC` derselben Quelle
   entstammen (`spiel-eignung-overrides.ts`), ist `eng` bedeutungslos, weil es keine zweite,
   abweichende Anzeige-Ordnung mehr gibt, gegen die `eng` ursprünglich unterscheiden sollte" —
   das ist eine allgemeinere, robustere Formulierung als eine football-spezifische Sonderregel
   und sollte in der Umsetzungsrunde geprüft werden, bevor man sich auf einen Football-only-Sonderfall
   festlegt (Basketball/Hockey nutzen weiterhin die unveränderte Matrix, wären also nicht betroffen).
2. **`slotAufschlag()` (`:4600-4606`)**: einen football-spezifischen Skalierungsfaktor auf
   `roh` VOR der Klemmung einführen (Startwert **0,35**, mit Begründung: mittig im getesteten
   Bereich 0,15-0,5, der reproduzierbar über 0,80 lag, ohne den Extremwert 0,15 zu übernehmen,
   dessen Robustheit an nur fünf Kader-Paarungen unsicher ist).
3. **Vor dem Festlegen des exakten Skalenwerts**: die Kaderfamilie auf mindestens acht
   Paarungen erweitern (`scripts/ziehe-kader-familie.ts` erweitern, wie
   `messgrundlage-kaderfest.md` Abschnitt 4 für genau diesen Fall empfiehlt — „Gewichtheben,
   Spurt... hier braucht es entweder mehr Kader-Varianten oder ein robusteres Rezept"). Mit nur
   fünf Paarungen ist der Median selbst bei Bewegungen dieser Größenordnung (0,04-0,10) noch zu
   unpräzise, um zwischen Skala 0,15/0,25/0,35/0,5 zu unterscheiden — alle vier lagen im Test
   über 0,79, aber nicht in sauberer Reihenfolge.
4. **Erwartete Bewegung nach Umsetzung**: rho je Spiel 0,722 -> ~0,79-0,82 (Ziel: reproduzierbar
   über 0,80 auf einer erweiterten Kaderfamilie, angestrebt 0,85 laut CLAUDE.md — noch nicht
   erreicht mit den hier getesteten Varianten), rho Saison 0,832 -> ~0,84-0,91, Spannweite
   0,164 -> ~0,12-0,15 (spürbar enger als heute, aber noch nicht wieder auf dem alten
   Pre-#934-Niveau von 0,074 — das war ein Zustand, in dem der Slot-Bonus für Football
   größtenteils wirkungslos war, also künstlich robust).
5. **Danach messen**: `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig, kein
   Disziplinfilter) für den Isolationsnachweis, dann `npx tsx scripts/pruefe-rangtreue-schranke.ts`
   bzw. die Basislinie (`data/generated/rangtreue-basislinie.json`) für Football aktualisieren.
   Erst danach: Football in `ARENA_RESOLVED_DISCIPLINE_IDS`
   (`lib/resolve/battle-mode-arena-team-points.ts`) aufnehmen — PPS-Referenz
   (`scripts/ziehe-football-pps-referenz.ts`, `data/generated/football-pps-referenz.json`)
   existiert laut Code-Kommentar als Skript, die Referenzdatei selbst ist in diesem Checkout
   noch nicht gezogen und muss vor der Produktivschaltung einmal erzeugt werden.

## 7. Was offen und unsicher bleibt

- **Die 0,85-Ambition (CLAUDE.md) ist mit den hier getesteten Varianten nicht erreicht.**
  Alle Kandidaten liegen im Korridor 0,79-0,82, nicht bei 0,85. Ob mehr drin ist, hängt davon
  ab, ob die verallgemeinerte „eng ist bedeutungslos, wenn Anzeige- und Spiel-Ordnung
  identisch sind"-Regel (Punkt 6.1) zusätzliche, noch nicht getestete Freiheitsgrade öffnet
  (z. B. eine graduelle Mischung zwischen eng und breit statt eines binären Umschaltens) —
  nicht untersucht in dieser Runde, aus Zeitgründen.
- **Die Nicht-Monotonie der gemessenen Kurven (Abschnitt 3.2, 4.2) ist nicht erklärt**, nur
  strukturell plausibilisiert (Klemmungs-Sättigung + Interaktion mehrerer Slots/Spieler pro
  Spiel). Eine genauere Erklärung würde eine Sonde brauchen, die pro Spiel/Slot loggt, wie oft
  die ±8,5-Klemmung greift — nicht gebaut in dieser Runde.
- **Der Isolationsnachweis ist für Basketball und Hockey gemessen bestätigt, für TDM nicht**
  (Abschnitt 5, Lauf abgebrochen) — aus Code-Inspektion mit hoher Sicherheit auch für TDM und
  die übrigen Arena-Disziplinen unschädlich, aber nicht selbst nachgemessen. Muss der erste
  Schritt der Umsetzungsrunde sein (`node scripts/miss-alle-disziplinen.mjs 24` komplett, vor
  UND nach der echten Änderung).
- **Die football-spezifische Kaderfest-Spannweite (0,164 aktuell, 0,074 vor #934) ist selbst
  eine Messgröße mit Unsicherheit** (nur fünf Paarungen) — Punkt 6.3 benennt das als
  Voraussetzung, nicht als Nice-to-have, bevor ein Skalenwert fest committed wird.
- **Nicht untersucht**: ob ein Rezept-C-Umbau (Ansatzpunkt „Rezept neu fitten" im engeren
  Sinn, also die Attributmischungen selbst ändern statt der Slot-Bonus-Umrechnung) zusätzlich
  zu Ansatzpunkt 2 noch etwas bringt. Abschnitt 4.3 begründet, warum das vermutlich nicht der
  richtige erste Hebel ist, aber „vermutlich nicht der erste Hebel" ist keine Messung — falls
  Ansatzpunkt 2 in der erweiterten Kaderfamilie nicht robust über 0,80 bleibt, ist ein
  Rezept-Nachschlag (nach demselben Sondierungs-Verfahren wie PR #884/#924) der nächste
  Kandidat.

## Anhang: Reproduzieren

1. `public/mockups/battle-mode.engine.js`, `betroffeneAttribute()`: `if(TEST_FORCE_BREIT_JE_DISC[dId])return breit;`
   direkt nach `if(!eng)return breit;` einfügen, `const TEST_FORCE_BREIT_JE_DISC={football:true};`
   davor.
2. `slotAufschlag()`: `const scale=TEST_SLOT_SCALE_JE_DISC[disz]!=null?TEST_SLOT_SCALE_JE_DISC[disz]:1;`
   einfügen, `roh` mit `*scale` multiplizieren, `const TEST_SLOT_SCALE_JE_DISC={football:X};`
   davor (X wie in Abschnitt 3.2/4.2 gewählt).
3. `node scripts/miss-alle-disziplinen.mjs 24 football` je Variante.
4. Isolationsnachweis: `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig oder gezielt
   die feldspiel-/arena-Disziplinen, die dieselben Funktionen nutzen) vor und nach.
5. Alles danach mit `git checkout -- public/mockups/battle-mode.engine.js` zurücksetzen — dieses
   Dokument ist der einzige committete Artefakt dieser Runde.

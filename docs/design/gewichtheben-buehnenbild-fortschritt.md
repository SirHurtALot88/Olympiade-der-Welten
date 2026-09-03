# Gewichtheben: Bühnenbild, Kalibrierung, Rangtreue — Fortschrittsbericht

Stand 03.09.2026, Branch `claude/gewichtheben-buehnenbild` (abgezweigt von
`origin/claude/sonde-alle-disziplinen`, Basis `ed675c58`). Ausgangslage: S1 (Heber-
Rundenrechner) war bereits fertig und gemerged; dieser Bericht deckt S2–S5 aus
`docs/design/gewichtheben-plan.md`, Abschnitt 8. Jede Zahl unten ist gemessen, mit dem
Skript benannt, das sie erzeugt hat.

## Kurzfassung

| Schritt | Ergebnis |
|---|---|
| S2 — Bühnenbild | **fertig**. Zwei Heber mittig, Hantel mit Last, gültig/ungültig als Geste, Duellstand groß, Gesamtlast klein, wartende Paare am Rand. Volles Spiel (118 s) im Browser ohne Seitenfehler. |
| S3 — Kalibrierung | **Korridor bestanden**, Pp-Abweichung zur Matrix nicht (48 statt Ziel ≤25/≤15) — ehrlich offen gelassen, s. u. |
| S4 — Rangtreue/Archetypen | rho je Spiel **0,745 → 0,792** (Ziel 0,80) — Verbesserung, Schwelle nicht erreicht. 3 von 4 Archetypen führen klar, einer (Zocker) nicht. |
| S5 — Größe→Anzeige | **fertig, verifiziert.** War durch S1 bereits korrekt gebaut; neuer Test bestätigt es. |
| S6 — Produktivierung | **nicht begonnen** — bewusst zurückgestellt, s. „Was offen bleibt". |

Die sieben Fable-Empfehlungen aus Abschnitt 9 (plus die Kernarchitektur-Entscheidung aus
Abschnitt 0) wurden **übernommen, nicht angetastet** — s. Tabelle ganz unten für den Status
jeder einzelnen.

---

## S2 — Bühnenbild

`zeichneBuehne()` verzweigt jetzt für `heben:true` in eine neue `zeichneHeben()`
(`public/mockups/battle-mode.engine.js`). Statt der zwölf Teilnehmer in zwei Reihen (das
Bild der sechs Auftritts-Disziplinen) zeigt die Bühne nur das **aktive Duell**, mittig,
Kopf an Kopf — Chris' Bild „immer 2 gleichzeitig":

- Zwei Heber zentriert (`x=W*0.30`/`W*0.70`), Name/Rolle darunter, dazu die bisher
  enthüllte Zweikampf-Last klein (**Gesamtlast klein**, Plan Abschnitt 7). „Bisher
  enthüllt" heißt wörtlich: nur was schon gezeigt wurde, nicht das fertige Endergebnis —
  eine neue Hilfsfunktion `bestBisher(u,uebung)` nimmt nur die schon enthüllten,
  gültigen Versuche.
- Eine Hantel dazwischen (Balken plus vier Scheiben, reine Primitiven, keine neue
  Sprite-Pipeline) mit der zuletzt gehobenen/verpassten Last: grün bei gültig, rot bei
  ungültig, **plus** Haken/Kreuz und das Wort — nicht nur Farbe, damit das Drama auch
  ohne Farbsehen ankommt.
- Der Duellstand (gewonnene Duelle) **groß** über der Bühne, dieselbe Zahl wie im
  DOM-Score (`#score`), dazu „Duell N von 6 · <Rolle>".
- Die übrigen Duelle **klein am unteren Rand**: wartet / läuft / fertig mit Ergebnis und
  Teamfarbe — das Gedächtnis, das das Reihenbild der anderen Bühnen über die zwölf
  sichtbaren Figuren selbst mitbringt.

Aktives Duell wird aus dem zuletzt enthüllten Zug bestimmt (neue Variable
`letzterHebenZug`, in `bauBuehne()` zurückgesetzt). Die Feed-Texte („Reißen, 2. Versuch,
152 kg — gültig") und der DOM-Score existierten schon aus S1 und mussten nicht angefasst
werden — sie passten bereits exakt zu Plan-Abschnitt 4.4.

**Abnahme (Plan 8.1):** ein volles Spiel (118 s, sechs Duelle) lief im Browser ohne
Seitenfehler durch (Playwright, neues `scripts/screenshot-gewichtheben.mjs` als
visueller Rauchtest — `node scripts/screenshot-gewichtheben.mjs <ms> [ausgabepfad]`,
öffnet das Mockup, startet den Kampf, macht einen Screenshot). Sichtgeprüft bei
t=3s/10s/12s/20s/60s und beim Schlussstand (4:2, inklusive eines echten ungültigen
Versuchs, „✗ ungültig" in Rot). Der Feed liest sich wie ein Wettkampf.

---

## S3 — Kalibrierung

### Ausgangsbefund: Pp-Abweichung 66,3 (Ziel ≤25/≤15)

Erste Messung (`node scripts/messe-arena-einfluss.mjs gewichtheben 48`, vor jeder
Änderung dieser Runde):

| Attribut | Anteil gemessen | Matrix | Differenz |
|---|---:|---:|---:|
| power | 51,6 % | 28 | **+23,6** |
| health | 20,8 % | 16 | +4,8 |
| determination | 16,3 % | 12 | +4,3 |
| charisma | 1,4 % | 23 | **−21,6** |
| dexterity | 2,4 % | 6 | −3,6 |
| will | 1,5 % | 7 | −5,5 |
| speed | 3,5 % | 6 | −2,5 |
| stamina | 2,4 % | 2 | +0,4 |
| **Summe** | | | **66,3 Pp** |

Ursache, nachgemessen: `u.LAST` (power 60/health 25/determination 15) bestimmt über
`tagesmax` fast allein die Kilogramm-Spanne — von 104 bis 476 kg, ein Faktor 4,6.
`NERVEN` wirkt nur auf den **dritten** Versuch, `ANSAGE` nur auf Eröffnungshöhe und
Sprunggröße — beides Verschiebungen von wenigen Prozentpunkten **innerhalb** dieser
riesigen Spanne. Der Kommentar aus S1 („Charisma sitzt zweimal, beide ausgangswirksam")
war strukturell richtig gemeint, aber die Koeffizienten waren zu klein, um das
einzulösen — dieselbe Lektion wie beim PUBLIKUM-Bonus, nur eine Ebene tiefer.

### Was eingebaut wurde

Koeffizienten angehoben (`public/mockups/battle-mode.engine.js`, Kommentar an Ort und
Stelle):

| Konstante | Vorher | Nachher |
|---|---:|---:|
| `HEBEN_TECHNIK_K` | 0,0020 | 0,0035 |
| `HEBEN_NERVEN_K` | 0,0030 | 0,0090 |
| `HEBEN_ANSAGE_EROEFFNUNG` | 0,00035 | 0,0016 |
| `HEBEN_ANSAGE_SPRUNG` | 0,006 | 0,015 |
| `HEBEN_BASIS.stossen[2]` | 0,514 | 0,565 |

Dazu ein Deckel: die Eröffnungshöhe darf 97 % des Tagesmaximums nicht überschreiten —
ohne ihn eröffnete ein Heber mit sehr hoher ANSAGE rechnerisch **über** seinem eigenen
Maximum (0,94 Basis + 49·0,0016 = 1,018) und riss den ersten Versuch fast sicher. Die
Stoßen-Basis für den dritten Versuch wurde von 0,514 auf 0,565 angehoben, um den
Korridor nach der Koeffizienten-Erhöhung zu halten (reale Referenz 51,4 % Männer /
53,6 % Frauen, Mittel 52,5 % — 0,565 bleibt in der Nähe dieses Werts).

### Ergebnis: Pp 66,3 → 48, Korridor sauber

| Attribut | Anteil gemessen (n=48) | Anteil gemessen (n=96) | Matrix |
|---|---:|---:|---:|
| power | 47,7 % | 46,6 % | 28 |
| health | 18,3 % | 18,4 % | 16 |
| determination | 13,8 % | 15,0 % | 12 |
| charisma | 7,3 % | 6,6 % | 23 |
| speed | 5,7 % | 5,6 % | 6 |
| dexterity | 2,9 % | 3,4 % | 6 |
| will | 2,3 % | 2,3 % | 7 |
| stamina | 2,0 % | 2,0 % | 2 |
| **Abweichung** | **47,6 Pp** | **48,1 Pp** | Ziel ≤25/≤15 |

Charisma stieg von 1,4 % auf 6,6–7,3 % — eine reale Verbesserung, **aber die
25-Pp-Schranke wird nicht erreicht.** Das ist ehrlich zu benennen, nicht wegzurechnen.

Korridor (`node scripts/miss-gewichtheben-korridor.mjs 96`, zweiter Saatstrom
`miss-gewichtheben-korridor.mjs 48`):

| Größe | n=48 | n=96 | Ziel |
|---|---:|---:|---|
| Gelingen Reißen 1./2./3. | 84,2/74,8/56,3 % | 83,7/76,8/55,6 % | 84–90/71–80/50–63 % |
| Gelingen Stoßen 1./2./3. | 85,9/70,8/50,9 % | 85,4/71,4/51,3 % | 84–90/71–80/50–63 % |
| Fehlversuche je Heber | 1,77 | 1,76 | 1,4–1,8 |
| Nullwertungen je Heber | 3,0 % | 2,7 % | ≤3 % |
| Reißen-Anteil | 46,7 % | 46,8 % | 44–47 % |

Reißen 1. Versuch liegt bei n=96 um 0,3 Pp unter der Untergrenze — im Rauschen eines
12-köpfigen festen Kaders, nicht als systematische Abweichung zu werten. Alle anderen
Zeilen liegen sauber im Korridor.

### Zwei Versuche geprüft und verworfen (mit Zahlen)

**Rezept-Rebalance (Power aus TECHNIK/ANSAGE, Gewicht an Dexterity/Speed/Determination/
Charisma/Will).** Senkte Pp weiter auf 33 — aber:

| Größe | vorher (Koeffizienten allein) | nachher (plus Rezept-Rebalance) |
|---|---:|---:|
| Pp-Abweichung | 48 | **33** (besser) |
| Reißen 1. Versuch | 84,2 % | 82,3 % (**schlechter**) |
| Stoßen 3. Versuch | 50,9 % | 45,0 % (**schlechter**) |
| Nullwertungen | 3,0 % | 4,2 % (**schlechter**, über der Schranke) |
| rho je Spiel (gesamt, jeSeite 6) | 0,800 | 0,789 (**schlechter**) |

Ursache: der Kader ist power-lastig (mehrere Golems/Konstrukte mit power 80–98); Power
aus TECHNIK/ANSAGE zu entfernen senkte die durchschnittliche Gelingchance breit über den
ganzen Kader, nicht nur für die Ränder. Eine bessere Pp-Zahl bei schlechterem Korridor
**und** schlechterer Rangtreue ist kein guter Tausch — **verworfen**, Rezept unverändert
gelassen (Kommentar im Code dokumentiert Vorher/Nachher an Ort und Stelle).

**`HEBEN_ANSAGE_SPRUNG` weiter auf 0,032 (für den Zocker-Archetyp, s. u.).** Hob den
Zocker-rho von 0,11 auf nur 0,27 — kaum Wirkung —, riss aber Stoßen 3. Versuch aus dem
Korridor (51,3 % → 47,7 %). **Verworfen**, bei 0,015 belassen.

---

## S4 — Rangtreue und Archetypen

### Rangtreue: 0,745 → 0,792, Schwelle nicht erreicht

Offizielle Methodik (`node scripts/miss-alle-disziplinen.mjs 120 gewichtheben`, gepoolt
über beide Seiten je Spiel — dieselbe Methode, die auch die Zahlen in
`stand-aller-disziplinen.md` für alle zwanzig Disziplinen liefert):

| | vorher (dokumentiert) | nachher (n=120) |
|---|---:|---:|
| rho je Spiel | 0,745 | **0,792** |
| rho Saison | 0,839 | **0,909** |

Eine echte, gemessene Verbesserung (+0,047), aber weiterhin **„knapp"**, nicht
„bestanden" — CLAUDE.mds Schranke (0,80) wird nicht erreicht.

Kadergrößen 6/4/2 je Seite (neues `scripts/miss-gewichtheben-jeseite.mjs`, das
`disziplinProbe()` ein neues `o.jeSeite` beibringt — dieselbe Erweiterung, die
`feldspielProbe` für 2v2/4v4/6v6 schon hatte):

| jeSeite | rho je Spiel (gepoolt) | rho Saison |
|---:|---:|---:|
| 6 | 0,792 | 0,909 |
| 4 | 0,757 | 0,976 |
| 2 | 0,753 | 1,000 |

Alle drei liegen im selben Band (0,75–0,79), keine erreicht 0,80. Der **Seiten-Split**
aus dem Plan (rho getrennt je Seite gerechnet, dann gemittelt) ist bei jeSeite=6 mit
0,76 noch niedriger als der gepoolte Wert, und bei jeSeite=2 rechnerisch **degeneriert**
(Spearman über zwei Punkte ist nicht aussagekräftig — die Funktion liefert dort keinen
brauchbaren Wert). Für die Abnahme zählt deshalb die gepoolte Zahl, dieselbe Methodik
wie bei allen anderen neunzehn Disziplinen in `stand-aller-disziplinen.md`.

**Warum die Simulation (0,92) und der echte Motor (0,79) auseinanderlaufen:** Fables
Simulation (Plan 3.2) bildete Eignung direkt linear auf die Zweikampf-Last ab. Der echte
Motor spaltet das in fünf Sub-Skills auf, von denen nur `LAST` (power/health/
determination) die Kilogramm-**Obergrenze** setzt; die anderen vier verschieben nur
Wahrscheinlichkeiten oder kleine Prozentanteile innerhalb dieser Grenze. Das ist genau
die Pp-Lücke von oben, nur von der Rangtreue-Seite aus gesehen: ein Heber mit hoher
Eignung (die alle acht Attribute mit Matrixgewicht zählt) aber mittlerem Power/Health
hebt strukturell weniger, als seine Eignung vermuten lässt. Die Koeffizienten-Kalibrierung
mildert das, löst es aber nicht auf — dafür bräuchte es entweder einen zweiten,
kraftvolleren Kanal für die übrigen Attribute (mit dem Risiko, das der verworfene
Rezept-Versuch gezeigt hat) oder eine tiefere Neubewertung, wie viel Eignungsgewicht
Charisma/Will/Dexterity/Speed beim Gewichtheben überhaupt tragen sollten — eine
Rezept-Frage, die über reine Kalibrierung hinausgeht und Chris gehört, nicht diesem
Bericht.

### Archetypen: drei von vier führen klar

Neue Sonde `scripts/miss-gewichtheben-archetypen.mjs` (Terzil-Methodik wie
`miss-hockey-archetypen.mjs`: oberes Terzil gegen unteres Terzil des echten
12-köpfigen Kaders, 320 Spiele für stabile Mittelwerte). `bauBuehne()` trägt dafür jetzt
`attr` auf jedem Teilnehmer, und das Gewichtheben-Protokoll exportiert die sechs
Rohattribute (power/health/dexterity/speed/will/charisma) zusätzlich zu den Sub-Skills.

| Archetyp | Input | Output | rho | Terzil unten | Terzil oben | Führt? |
|---|---|---|---:|---:|---:|---|
| Kraftpaket | power/health | Zweikampf/Spiel | **0,902** | 225 kg | 408 kg | **Ja** |
| Techniker | dexterity/speed | Gelingensquote | 0,571 | 68,8 % | 76,8 % | **Ja** |
| Nervenbündel | will/charisma | 3.-Versuch-Quote | 0,699 | 40,7 % | 63,9 % | **Ja** |
| Zocker | charisma/speed | Sprung-Mittel | **0,112** | 8,93 kg | 8,85 kg | **Nein** |

Kraftpaket, Techniker und Nervenbündel führen klar und in der erwarteten Größenordnung.
**Zocker führt nicht** — dieselbe strukturelle Ursache wie bei der Pp-Lücke: ANSAGE ist
ein zu schwacher Kanal, um Charisma/Speed bei den Sprunggrößen sichtbar zu machen (s.
oben, „verworfen: `HEBEN_ANSAGE_SPRUNG` auf 0,032"). Ehrlich gemessen, nicht erzwungen.

---

## S5 — Größe → Anzeige

War durch S1 bereits richtig gebaut: `u.groesse` fließt nirgends in `LAST`/`TECHNIK`/
`NERVEN`/`ANSAGE`/`ERHOLUNG` oder in die Gelingens-Wahrscheinlichkeit ein — es wird nur
von `sinclairAnzeige()` gelesen (Anzeige) und von `groesseFaktor()` (Sprite-Skalierung).
Neuer Test `scripts/miss-gewichtheben-groessentausch.mjs`: vertauscht im laufenden Kader
die Größe zweier Heber (`Draco` ↔ `Lulu`, größter verfügbarer Kontrast) direkt über die
von `bauBuehne` gelesene Kader-Referenz und vergleicht dieselbe Saat vor/nach dem
Tausch.

Ergebnis bei zwei Saaten (1337, 4242): `summe`/`zweikampf`/`nullwertung`/
`duellGewonnen`/`eig`/`LAST`/`TECHNIK`/`NERVEN`/`ANSAGE`/`ERHOLUNG` und das **komplette**
Versuchsprotokoll (kg und gültig/ungültig je Versuch) bleiben zeichengleich — nur
`anzeigeKg` ändert sich. **Bestanden.**

---

## Die sieben Fable-Empfehlungen — Status

| # | Empfehlung | Status |
|---|---|---|
| 0 (Kernarchitektur) | Team-Ergebnis über Duelle je Slot, nicht über Gesamt-kg | **Umgesetzt** (S1): HUD-Score zählt `duellGewonnen`, nicht rohe Kilogramm. |
| 9.1 | 3:3 bleibt möglich, aber entschieden: bei Duell-Gleichstand entscheidet Gesamt-kg | **Teilweise.** 3:3 ist sichtbar möglich (Score im HUD/Bühnenbild), und EIN Duell endet praktisch nie unentschieden (IWF-Regel „weniger Versuche gewinnt" in `baueHebenDuelle`). Der Gesamt-kg-**Tiebreak für den TEAM-Stand bei 3:3** hat aber noch keinen Platz im Code — `seiten`/ein Team-Resolve existiert für Gewichtheben gar nicht, weil die Disziplin nicht in `ARENA_RESOLVED_DISCIPLINE_IDS` steht (S6). Diese Lücke wurde bei der Arbeit an diesem Bericht entdeckt und ist als offener Punkt unten aufgeführt. |
| 9.2 | Voller Reißen+Stoßen-Ablauf (nicht kompakt) | **Umgesetzt** (S1): `rundenN:6`, drei Versuche je Übung. |
| 9.3 | Sinclair-normiert, Größe nur Anzeige | **Umgesetzt** (S1) und **verifiziert** (S5, dieser Bericht). |
| 9.4 | Nullwertung hart (drei Fehlversuche = 0) | **Umgesetzt** (S1): `failAbzug:0`, gemessen 2,7–3,0 % je Heber (Ziel ≤3 %). |
| 9.5 | Paarung nach Rolle, nicht nach Stärke | **Umgesetzt** (S1): `baueHebenDuelle` paart Index-für-Index nach `HEBEN_ROLLEN`, das der Slot-Reihenfolge folgt. |
| 9.6 | Reihenfolge Duell für Duell (zwei auf der Bühne) | **Umgesetzt** (S1, Warteschlange) **und jetzt auch visuell** (S2, dieser Bericht: die Bühne zeigt nur das aktive Duell). |

Keine der sieben Empfehlungen wurde eigenmächtig geändert. Die einzige Lücke (9.1,
Team-Tiebreak) ist eine **fehlende Anschlussstelle**, keine Abweichung von der
Empfehlung — die Empfehlung selbst wurde nicht in Frage gestellt.

---

## Was offen bleibt

**S6 (Produktivierung) wurde nicht begonnen — bewusst.** Die Aufgabenstellung sah S5/S6
nur vor, „falls S2–S4 sauber durchlaufen". S4 tut das nicht ganz: rho bleibt bei 0,79
„knapp" statt „bestanden", und die Pp-Abweichung liegt bei 48 statt ≤25. Beides sauber
zu schließen bräuchte eine Rezept-Runde, die über Koeffizienten-Kalibrierung hinausgeht
(s. „Warum Simulation und Motor auseinanderlaufen" oben) — das ist eine
Design-Entscheidung, keine Kalibrierung, und gehört vor S6, nicht in ihn hinein. Für S6
selbst, wenn die Rangtreue steht:

1. `gewichtheben` in `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts`) aufnehmen.
2. Einen Orchestrator-Pfad bauen, der den Heber-Rundenrechner statt Basketballs Live-Motor aufruft.
3. `app/foundation/discipline-stage/arena/disciplines/barbell.tsx` von der PPS-Score-Umrechnung („kg-Skala 150…400, monoton im Endscore") auf echte Heber-Kilogramm umstellen.
4. **Neu entdeckt, gehört in denselben Zug:** den Gesamt-kg-Tiebreak für ein 3:3 im Team-Ergebnis irgendwo verdrahten — er hat aktuell keinen Code-Ort, weil es noch keinen Resolve-Pfad für Gewichtheben gibt.

**Vor S6, wenn Chris will, dass die Rangtreue erst über 0,80 steht:** eine Rezept-Runde
nach Chris' Budget-Methode für die fünf Sub-Skills — nicht mehr Koeffizienten-Tuning,
sondern eine ehrliche Neuverteilung, wie viel Eignungsgewicht LAST gegenüber den
übrigen vier Sub-Skills tragen soll, ähnlich der Rezeptrunde, die
`stand-aller-disziplinen.md` für die sechs „knappen" Disziplinen ohnehin empfiehlt
(Abschnitt 5, Punkt 4).

## Geänderte/neue Dateien

- `public/mockups/battle-mode.engine.js` — `disziplinProbe(dId,{jeSeite})`,
  Kalibrierungs-Konstanten (S3), `zeichneHeben()` (S2), `attr` auf Buehnen-Teilnehmern
  und im Gewichtheben-Protokoll (für die Archetypen-Sonde).
- `scripts/miss-gewichtheben-jeseite.mjs` (neu, S4)
- `scripts/miss-gewichtheben-archetypen.mjs` (neu, S4)
- `scripts/miss-gewichtheben-groessentausch.mjs` (neu, S5)
- `scripts/screenshot-gewichtheben.mjs` (neu, S2, visueller Rauchtest)
- `docs/design/stand-aller-disziplinen.md` — Gewichtheben-Zeile und Prozent-Einschätzung aktualisiert

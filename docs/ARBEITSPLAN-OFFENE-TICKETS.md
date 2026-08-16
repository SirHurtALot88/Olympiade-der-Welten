# Arbeitsplan — was noch offen ist und in welcher Reihenfolge

Stand nach dem Bugfixing-Lauf vom 14./15.08. Gilt für die Tickets #32–#44 aus dem Spiel plus die
Altlasten aus `docs/ROTE_TESTS_TRIAGE.md`.

**Wie dieser Plan zu lesen ist:** jeder Schritt hat ein *Fertig-Kriterium*, das man messen kann —
keine Absichtserklärung. Schritte, die eine Entscheidung von Chris brauchen, sind als solche
gekennzeichnet und blockieren die darunterliegenden nicht.

---

## NACHTRAG 16.08. — was seither erledigt ist

Der Plan unten steht auf dem Stand vom 15.08. und ist an mehreren Stellen überholt. **Nachgesehen
im Code, nicht aus der Erinnerung:**

| Schritt | Stand | Beleg |
|---|---|---|
| 1.1 — #38 VK-Faktor ab 8 | **fertig** | `6e6a8a4e` („VK-Faktor ab acht im Bracket") |
| 1.2 — #33 VK-Anzeige eigenes Team | **fertig** | eine Portraitkarte für beide Fälle; `heroIsOwnTeam` steuert nur noch das Gehalt, die VK-Zahl kommt aus `resolveTeamsPortraitSellValueDisplay` |
| 1.3 — #32 All-Time-Zeile | **fertig** | `berechneAllTimeWert` in `TeamDrawerHistoryTable.tsx` aggregiert je Spalte nach Art (Summe/Mittel/Maximum/letzter Stand), Verletzungen eingeschlossen |
| 2.1 — #42 Top-24 | **fertig** | `6e6a8a4e`, Gegenprobe in `tests/arena-top-spieler-zwei-spalten.test.ts` |
| 3.1–3.4 — #41 Awards | **fertig** | `buildPlayerSeasonAwards`, `PlayerAwardStrip` (Profil `full`, Arena-Zeile `icons`), Persistenz im Saison-Schnappschuss |
| 3.5 — Erklärung auf der Leaders-Seite | **fertig** | `NL_LEADERS_ERKLAERUNG` in `LeagueLeadersNewLook.tsx` — und zwar für *jede* Kategorie, nicht nur Most Improved |
| Block 4 — die vier Triage-Fragen | **beantwortet** | siehe Nachtrag in `docs/ROTE_TESTS_TRIAGE.md` |

**Neu dazugekommen (16.08.):** die Verletzten-Erholung stand an vier Stellen, Chris' Entscheidung
auf 1,0 hatte nur eine erreicht. Am schwersten wog, dass `calculateTeamRecovery` weiter mit einer
eingetippten 0,5 rechnete — und genau die benutzen die beiden Audit-Skripte, mit denen die Balance
*bewertet* wird. Behoben, `INJURY_RECOVERY_FACTOR` exportiert, Gegenprobe gefahren.

**Damit offen ist genau ein Punkt:** Block 0.2 — der Endspurt-Stau. Der braucht eine Entscheidung
von Chris und keine weitere Messung; die Messung liegt vor und sagt, dass die Erholung ihn nicht
löst (der Anteil bleibt über R = 20…56 bei 53–57 %). Der Hebel wäre der Spielplan: Spieltag 9
verlangt 12 Spieler, so viele wie kein anderer der Saison.

---

## Block 0 — die Ermüdung zu Ende bringen (LÄUFT)

Die Schonschwelle liest jetzt den echten Spieltagsbedarf. Vorher/Nachher, beides synthetische
Läufe mit 32 KI-Teams über eine volle Saison:

| | vorher | nachher |
|---|---|---|
| Verletzungen | 222 | **188** |
| Trefferquote | 9,19 % | **7,59 %** |
| Median je Team | 7 | **4** |
| Ø Ermüdung dünner Kader | 62,8 | **56,7** |
| KI-Einsätze ab Ermüdung 65 | 27,6 % | **23,4 %** |

**Ehrlich dazu, was diese Zahlen NICHT sagen:** es sind zwei verschieden gewürfelte Spielstände
(7 gegen 11 dünne Teams). Die Richtung stimmt auf jeder einzelnen Kennzahl, aber ein Teil des
Unterschieds ist Streuung, nicht Wirkung. Für eine saubere Aussage bräuchte es denselben Startwurf.

**Und das Kernproblem bleibt:** am letzten Spieltag liegen weiterhin 56 % der Einsätze bei
Ermüdung 65 oder darüber (vorher 57 %). Die Ermüdung steigt über die Saison monoton an, und die
Schonschwelle bremst nur, sie baut nichts ab.

### Schritt 0.1 — denselben Startwurf zweimal fahren
Den Abnahmelauf mit festem Seed einmal mit und einmal ohne die Korrektur laufen lassen.
**Fertig, wenn:** die Differenz aus der Messung stammt und nicht aus dem Würfel.

### Schritt 0.2 — ENTSCHEIDUNG CHRIS: der Endspurt
Die Ermüdung kennt keinen Abbau über die Saison. Drei Wege:
- **Erholung zwischen den Spieltagen anheben** — trifft alle Teams gleich, entschärft den Stau.
- **Recovery-Gebäude stärken** — deine eigene Frage aus #39; belohnt, wer investiert.
- **So lassen** — der Stau ist der Preis eines dünnen Kaders, wie beim Kader-Minimum entschieden.

Ohne diese Entscheidung ist Block 0 nicht abschließbar. Die bereits gebaute Korrektur bleibt
davon unberührt und ist in jedem Fall richtig.

---

## Block 1 — die Verkaufs-Familie (#38, #33, #32)

Drei Tickets, eine Ursache: die VK-Rechnung war an zwei Stellen verschieden. Seit #44 ist geklärt,
welche stimmt (`applySellPricingPolicyToBreakdown` gehört dazu). Ab hier ist alles billig.

### Schritt 1.1 — #38: VK-Faktor ab 8 Spielern
> „der VK Faktor soll schon ab 8 spielern beginnen, zumindest für die top und bottom 2 spieler
> ungefähr — selbe logik wie bisher aber auch!"

Heute greift der Kaderdruck-Faktor erst weiter unten. Er soll ab Kadergröße 8 einsetzen, und zwar
für die zwei besten und die zwei schwächsten Spieler.
**Fertig, wenn:** an einem echten Spielstand für ein Achtmannteam gemessen ist, welcher Faktor
vorher und nachher auf top-2 und bottom-2 liegt — und die mittleren Spieler unverändert bleiben.

### Schritt 1.2 — #33: VK-Anzeige beim eigenen Team wie beim fremden
> „Bei anderen Teams steht VK und darunter der VK Preis mit vergleich zum MW — das ist besser
> gelöst als beim eigen gesteuerten team"

Die bessere Darstellung existiert bereits. Es geht darum, dass beide Ansichten dieselbe Komponente
benutzen, nicht darum, die zweite nachzubauen — sonst laufen sie beim nächsten Umbau wieder
auseinander.
**Fertig, wenn:** im Browser beide Ansichten nebeneinander dieselben Zahlen und dasselbe Layout
zeigen.

### Schritt 1.3 — #32: All-Time-Zeile vervollständigen
> „in der ALl Time Zeile der History sind die PPs Verletzungen MW usw noch nicht erfasst"

Eine Summenzeile, die einen Teil ihrer Spalten leer lässt, liest sich wie „Wert null" statt „nicht
gezählt". Die Einzeljahre haben die Zahlen bereits.
**Fertig, wenn:** die All-Time-Zeile für ein Team gegen die Summe seiner Saisonzeilen geprüft ist
— nicht gegen sich selbst.

---

## Block 2 — Anzeige (#42)

### Schritt 2.1 — Top-Player-Liste auf 24
> „nicht nur die top 12 sondern Top 24 hier sieht ohne dass man die Tabelle in der höhe größer
> macht, sondern nebeneinander"

Zwei Spalten à 12 statt einer à 12. Reine Darstellung, hängt an nichts.
**Fertig, wenn:** die Tabelle bei 24 Einträgen nicht höher ist als vorher bei 12, auch auf
schmalem Fenster.

---

## Block 3 — Awards im Spielerprofil (#41)

Der größte Brocken und das einzige echte Feature der Liste. Chris hat den **vollen Satz mit
Icons** entschieden. In fünf Schritten, jeder für sich abschließbar.

> „Wir brauchen noch eine erklärung wie Most Improved Player sich zusammensetzt! Dann brauchen wir
> noch verschiedene awards im Spielerprofil … für die einzelnen Bereiche wie POW SPE MEN SOC ->
> das sind quasi die All Stars. OVR = MVP. Training und Most Improved Award. Dafür hätte ich gerne
> im Spielerprofil die Icons dass man auch später direkt sieht ah der spieler gehört [dazu]"

### Schritt 3.1 — Most Improved: die Rechnung offenlegen
Zuerst die vorhandene Rechenstelle finden und prüfen, ob sie überhaupt stimmt — die Erklärung
einer falschen Zahl ist schlimmer als keine Erklärung.
**Fertig, wenn:** an einem echten Spielstand nachgerechnet ist, wie der aktuelle Most Improved
zustande kommt, und die Erklärung im Spiel diese Rechnung zeigt.

### Schritt 3.2 — die Award-Ermittlung, eine Rechenstelle
Sieben Auszeichnungen je Saison: All-Star POW, SPE, MEN, SOC, MVP (über OVR), Training, Most
Improved. Alle aus **einer** Funktion, sonst driften sie auseinander wie zuletzt die VK-Zahlen.
**Fertig, wenn:** die Funktion für eine gespielte Saison alle sieben Träger liefert und jede
Auswahl gegen die Rohdaten nachvollzogen ist.

### Schritt 3.3 — Awards in den Saisonschnappschuss
Ohne Persistenz sind sie nach dem Saisonwechsel weg — und genau darum geht es Chris: „dass man
auch später direkt sieht". Der Schnappschuss ist der Ort, an dem die Saison stehenbleibt.
**Fertig, wenn:** ein Award aus Saison 1 nach dem Wechsel in Saison 2 noch abrufbar ist.

### Schritt 3.4 — Icons im Spielerprofil
**Fertig, wenn:** ein mehrfach ausgezeichneter Spieler alle seine Icons trägt, mit Saison und
Kategorie im Tooltip, und ein Spieler ohne Auszeichnung keine leere Zeile bekommt.

### Schritt 3.5 — Leaders-Seite
Die Erklärung aus 3.1 dort verlinken, wo die Frage entstanden ist.

---

## Block 4 — Entscheidungen, die auf Chris warten

Aus `docs/ROTE_TESTS_TRIAGE.md`. Keine davon blockiert das Spiel; alle vier halten je einen Test
rot oder eine Ungereimtheit offen.

1. **MVS 0 oder „keine Quelle"?** Ein Spieler ohne Platzierungen zeigt „Quelle fehlt" statt 0. Die
   Anzeige zu korrigieren ist eine Zeile — aber die KI liest an drei Stellen `mvs ?? ovr ?? 0` und
   bewertet mit einer echten 0 die ganze Vorsaison anders.
2. **`full_clean_redraft` gegen Nula.** Zwei bewusste Regeln stoßen zusammen. Betrifft nur ein
   Sandbox-Skript.
3. **Die GM-Zuweisung.** Fünf Tests hängen an einer verschobenen Zuordnung. Ist die heutige
   gewollt, ziehe ich die Erwartungen nach — besser auf Eigenschaften statt auf feste GM-Kennungen.
4. **„legacy" im Wirtschafts-Vergleich.** Beim Gehalt steht inzwischen auf beiden Seiten eine
   Formel; das Signal dafür liegt vor und wird nicht gelesen.

---

## Reihenfolge und Begründung

```
Block 0.1  ─ Messung sauber machen        (klein, macht 0.2 entscheidbar)
Block 1    ─ 1.1 → 1.2 → 1.3              (klein, hängt an geklärter VK-Rechnung)
Block 2    ─ 2.1                          (klein, unabhängig)
Block 3    ─ 3.1 → 3.2 → 3.3 → 3.4 → 3.5  (groß, streng in dieser Folge)
Block 4    ─ wenn Chris entscheidet
Block 0.2  ─ wenn Chris entscheidet
```

**Warum Block 1 und 2 vor Block 3:** vier kleine Tickets, die heute noch falsche oder
unvollständige Zahlen zeigen, wiegen schwerer als ein neues Feature. Ein Spieler, der zwei
verschiedene VK-Preise sieht, glaubt danach keiner Zahl mehr — die Awards dagegen fehlen bloß.

**Warum Block 3 streng nacheinander:** 3.2 ohne 3.1 hieße, sechs weitere Auszeichnungen auf eine
Rechnung zu setzen, die niemand geprüft hat. 3.4 ohne 3.3 wären Icons, die beim Saisonwechsel
verschwinden.

**Ein Commit je Schritt**, jeder mit seiner Messung im Text. Ein PR je Block.

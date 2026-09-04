# Football: Entscheidungsvorlage zur MATRIX-Frage

Chris, das hier ist keine Rezeptrunde und keine Messung — eine Seite, eine Entscheidung, die
nur du treffen kannst. Herleitung und Quellen: `football-gewichtheben-opus-review.md` B.6,
`football-rezept-kalibrierung.md` 4.2, `naechste-schritte-fable-04-09.md` 2.3/Auftrag 7.

## Der Befund

`BASIS_JE_DISC.football` — das Gewicht, mit dem jedes der zwölf Attribute in Footballs
Eignung einfließt — lautet:

    spirit 25, torment 16, health 14, awareness 11, will 10,
    determination 8, power 6, stamina 6, charisma 4

Das ist keine Kalibrierungsgröße, sondern **die Design-Zielgröße des ganzen Projekts**: jede
Rangtreue-Zahl, die je für Football gemessen wurde, misst, wie gut eine Mechanik GEGEN genau
diese Matrix funktioniert. Zwei Dinge folgen daraus zwangsläufig, unabhängig von jedem Rezept:

- **`LAUFKRAFT: {spirit 56, health 30, power 14}`** — ein Running Back, dessen Laufkraft
  rechnerisch zu 56 % aus „Geist" (spirit) kommt und zu 14 % aus Körperkraft.
  `PASSGENAUIGKEIT: {will 54, determination 46}` — weder Geschicklichkeit noch Wahrnehmung
  stehen für einen Quarterback überhaupt zur Verfügung.
- **`awareness`** (Matrixgewicht 11, drittschwerste Position) korreliert auf dem echten Kader
  gemessen mit **−0,335** gegen die Football-Eignung, die die Matrix selbst daraus berechnet.
  Ein Attribut, das die Matrix hoch bepreist, hängt im Kader negativ mit dem zusammen, was sie
  daraus macht.

Zwei Rezeptrunden liefen dazu bereits am 04.09. — beide haben den abnehmenden Grenzertrag
selbst benannt (Kalibrierung +0,155, Down-Verdrahtung +0,008, beide innerhalb der eigenen
Kader-Spannweite von 0,258 bzw. 0,383, also nicht sauber von Null unterscheidbar). Eine dritte
Rezeptrunde ändert an obigem nichts — die Bremse sitzt in der Matrix, nicht im Rezept.

**Was das nicht ist:** ein Fehler, den eine Kalibrierungsrunde „reparieren" könnte. Die Matrix
selbst zu ändern würde die Zielgröße verschieben — jede danach gemessene bessere Zahl wäre
zirkulär, keine Verbesserung.

**Der zweite, unabhängige Befund**, der bisher in keinem Football-Fazit stand, obwohl es das
Erste ist, was ein Betrachter sieht: **während eines Spielzugs bewegt sich ausschließlich der
Ball — alle zwölf Spieler stehen komplett still** (`animiereFootballZug()`,
`public/mockups/battle-mode.engine.js`). Bewusst so gebaut, in den bisherigen Berichten
begründet, aber nie so benannt.

## Zwei Wege

**Weg A — Matrix anfassen.** Die Zielgröße selbst ändert sich. Jede bisherige Football-Zahl
(0,305 → 0,460 → 0,468 rho je Spiel, in dieser Reihenfolge über die drei Football-Runden vom
04.09.) wird damit unvergleichbar zu allem danach — eine neue Baseline wäre nötig, bevor
irgendeine weitere Zahl etwas aussagt. Vorteil: falls du das Bildgefühl teilst, dass ein
Running Back vor allem power/speed sein sollte statt spirit, koppelt das Footballs Eignung an
ein realistischeres Attributprofil — und **könnte**, muss aber nicht, auch die Rangtreue heben
(power liegt im Kader positiv, awareness negativ mit der heutigen Eignung; ob eine neue Matrix
insgesamt sauberer trennt, ist ungemessen, weil noch keine existiert).

**Weg B — Matrix akzeptieren, Football als Schauspiel-Disziplin führen.** 0,468 je Spiel /
0,671 Saison als das nehmen, was mit der bestehenden Design-Absicht erreichbar ist — beide
Rezeptrunden haben ihren Grenzertrag selbst benannt, eine dritte ändert daran nichts. Der
nächste Football-Schritt wäre dann **nicht** Produktivierung, sondern die visuelle Frage
(bewegte Spieler statt nur Ball) — und auch die erst, wenn Football irgendwann live gehen soll.

## Unabhängig vom gewählten Weg

**Football ist aktuell nicht produktivierungsreif.** Die Mechanik bewegt sich noch (Matrix
offen, Spieler-Bewegung ungebaut) — die Projektregel „erst Mechanik, dann Rezept, nie
umgekehrt" (Arena-Rollout-Plan, Abschnitt 5) gilt hier genauso: eine gezogene PPs-Referenz auf
einem noch wandernden Motor ist sofort veraltet. Das gilt für Weg A wie für Weg B.

## Was ich brauche

Nur deine Antwort auf eine Frage: **A (Matrix ändern) oder B (Matrix akzeptieren, Football als
Schauspiel führen und die Spieler-Bewegung als nächste visuelle Investition vormerken)?** Alles
Weitere — neue Baseline bei A, visuelle Runde bei B — folgt erst aus dieser Antwort.

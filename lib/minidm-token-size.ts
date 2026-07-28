// =====================================================================================
// Mini-DM (duelhp) — reine Rechenhelfer für die Pit-Optik.
//
// Hier liegen bewusst NUR kosmetische Größen: der Token-Durchmesser und der
// Angriffs-Rhythmus. Beides beeinflusst weder Score noch HP noch die Dauer der
// Disziplin — die Wahrheit (Score/Rang/Reveal-Takt) liefert der Host
// (DisciplineStageNativeArena) und wird hier nie zurückgeschrieben.
// =====================================================================================

// Kosmetischer Kampf-Rhythmus im Pit: alle N ms greift ein Team sichtbar an.
// Vorher 400 ms → jetzt 310 ms ≈ 29 % mehr Treffer-Ereignisse pro Runde ("mehr
// Action"). Die Rundendauer selbst taktet der Host — dieser Wert ändert nur, wie
// oft INNERHALB der unveränderten Dauer ein Funke/Chip-Schaden aufploppt.
export const MINI_DM_ATTACK_INTERVAL_MS = 310;

// Durchmesser-Spanne relativ zum Basis-Durchmesser baseD (= H·0.062 im Feld):
// Führender bekommt das 1,5-fache, die absolute Untergrenze hält abgeschlagene
// Teams hover-/klickbar (35 % von baseD ≈ 11 px bei üblicher Feldhöhe). Vorher
// war der Führende fix 1,24× und alle anderen gleich groß. Das Band, in dem die
// Größe EXAKT proportional ist, reicht damit von ratio ≈ 0,23 bis 1 — der
// Nutzer-Fall "4× Punkte → 4× Größe" (ratio 0,25) liegt vollständig darin.
export const MINI_DM_DIA_MAX_FACTOR = 1.5;
export const MINI_DM_DIA_MIN_FACTOR = 0.35;

export type MiniDmSizeInput = {
  score: number; // Anzeige-Punkte des Teams (shownScore — wächst live im Reveal)
  maxScore: number; // größte Anzeige-Punkte im Feld (der Führende)
  baseD: number; // Basis-Durchmesser D des Feldes
  isOwn?: boolean; // eigenes Team: kleiner konstanter Bonus zur Wiedererkennung
};

// Token-DURCHMESSER proportional zu den Punkten.
//
// Normierung: Verhältnis zum Führenden (score / maxScore), NICHT fieldNorm
// (Min/Max). Begründung: der Nutzer-Wunsch ist wörtlich "4× Punkte → 4× Größe";
// eine Min/Max-Normierung würde ein enges Feld künstlich auf die volle Spanne
// spreizen und bei echtem 4×-Abstand eben NICHT 4× liefern. score/maxScore tut
// genau das: halber Punktestand → halber Durchmesser.
//
// Es skaliert der DURCHMESSER linear (nicht die Fläche): flächenproportional
// hieße bei 4× Punkten 16× Fläche — das sprengt den Pit mit 32 Teams.
//
// Grenzen: exakt proportional gilt im Band [MIN/MAX-Faktor ≈ 0,23 … 1] des
// Verhältnisses; darunter greift die Untergrenze (sonst unsichtbar/unklickbar),
// der Führende deckelt bei MAX (sonst läuft er aus der Bühne). Bewusster
// Kompromiss — Klickbarkeit schlägt buchstäbliche Proportionalität ganz unten.
export function miniDmTokenDiameter(input: MiniDmSizeInput): number {
  const { score, maxScore, baseD, isOwn } = input;
  const dMax = baseD * MINI_DM_DIA_MAX_FACTOR;
  const dMin = baseD * MINI_DM_DIA_MIN_FACTOR;
  const ownBonus = isOwn ? 2 : 0; // vorher +1 auf den Radius = +2 Durchmesser

  // Vor dem ersten Reveal (alle 0) oder bei kaputten Werten: neutrale Basisgröße,
  // damit die Startaufstellung ruhig aussieht und nie NaN ins SVG gelangt.
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || !Number.isFinite(baseD) || maxScore <= 0 || baseD <= 0) {
    return Math.max(0, baseD) + ownBonus;
  }

  const ratio = Math.max(0, score) / maxScore;
  const dia = Math.min(dMax, Math.max(dMin, dMax * ratio));
  return dia + ownBonus;
}

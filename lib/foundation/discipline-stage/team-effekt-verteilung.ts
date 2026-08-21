import { round1ByMathRound as round1 } from "@/lib/foundation/foundation-number-utils";

/**
 * Ein Team-Effekt gehoert der ganzen Seite — und wird deshalb auch so gezeigt.
 *
 * GEMELDET VON CHRIS: „Was ist denn der ,Team' Score den ein Spieler bekommt??? anscheinend
 * immer letzte spieler in der Diszi hat so einen Bonus."
 *
 * Er hatte recht. Intensitaet, Team-Power, Team-PPs und der Team-Anteil der Mutatoren haengen
 * nicht an einem Spieler, sondern an der Aufstellung. Die Buehne muss sie trotzdem irgendwo
 * unterbringen, weil sie additiv aufdeckt: die Summe der Bahnen MUSS den Team-Score treffen,
 * sonst meldet der Kopf eine andere Zahl als die Bahnen darunter. Wer den Betrag als einen
 * Klumpen auf die letzte Bahn legt, loest zwar die Summe, erfindet dabei aber einen Helden —
 * der zuletzt aufgestellte Spieler sieht aus, als haette er den Aufschlag verdient.
 *
 * Deshalb: gleichmaessig auf alle Bahnen, nur der Rundungsrest bleibt auf der letzten. Damit
 * stimmt die Summe weiter exakt, und niemand bekommt einen Bonus zugeschrieben, den es als
 * Einzelleistung nie gab.
 *
 * WICHTIG — das ist reine Anzeige. Der gebuchte Spielerwert (`finalPlayerScore`) und die
 * Player-Points (`pointsAwarded`) werden hier nicht angefasst.
 */
export function verteileTeamEffektAufBahnen(
  bahnen: { mods: { k: string; sign: 1 | -1; amt: number }[] }[],
  betrag: number,
  beschriftung = "Team",
): void {
  if (bahnen.length === 0) return;
  const gesamt = round1(betrag);
  if (Math.abs(gesamt) < 0.05) return;

  let offen = gesamt;
  bahnen.forEach((bahn, index) => {
    const anteil = index === bahnen.length - 1 ? round1(offen) : round1(gesamt / bahnen.length);
    offen = round1(offen - anteil);
    if (Math.abs(anteil) < 0.05) return;
    bahn.mods.push({ k: beschriftung, sign: anteil < 0 ? -1 : 1, amt: Math.abs(anteil) });
  });
}

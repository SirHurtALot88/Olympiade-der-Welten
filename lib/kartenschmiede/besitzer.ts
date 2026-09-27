import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Wer greift auf die Kartensammlung zu? Die Sammlung ist bewusst EINE gemeinsame für alle, die sich
 * einloggen können (Chris und Franky spielen Quest zusammen, die Karten gehören der Runde). Der Name
 * wird nur vermerkt, damit man sieht, wer eine Karte zuletzt gespeichert hat.
 * `null` heißt: Login ist an, aber niemand eingeloggt.
 */
export type KartenZugriff = { sammlung: string; wer: string | null };

export async function kartenZugriff(): Promise<KartenZugriff | null> {
  if (!isAuthEnabled()) return { sammlung: "gemeinsam", wer: null };
  const user = await getSessionUser();
  return user ? { sammlung: "gemeinsam", wer: user.displayName || user.username } : null;
}

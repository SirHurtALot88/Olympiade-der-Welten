/**
 * EIN SATZ DAFUER, WARUM DIE APRON-ABGABE KLEINER IST, ALS DIE LINIEN VERMUTEN LASSEN.
 *
 * GEMELDET VON CHRIS (`6fv43h`): „Apron scheint nicht korrekt zu ziehen! M-M hat Gehalt 123,5 Mio
 * und die 2. Linie ist 67,3 Mio! Die müssten fast 60 mio Strafe zahlen!"
 *
 * DER APRON RECHNET RICHTIG — gedrosselt wird er vom Konjunkturhebel
 * `k(f) = clamp((f − 0,95) / 0,29, 0, 1)`. Er ist Absicht (`apron-service.ts`): die Gehälter stehen
 * fest, bevor die Konjunktur der Saison gewürfelt wird, und ohne den Hebel schmerzte die Abgabe
 * genau dann am meisten, wenn ohnehin niemand Geld hat.
 *
 * DIE ERKLAERUNG DAZU WAR ABER ALLES ODER NICHTS. Sie erschien nur bei `k === 0`. Am Live-Abbild
 * nachgemessen, über alle fünf Spielstände (laufende und kommende Saison, zehn Beobachtungen):
 *
 *   f = 0,84 → k = 0      f = 0,87 → k = 0      f = 0,92 → k = 0
 *   f = 0,96 → k = 0,03   f = 0,99 → k = 0,14   f = 1,03 → k = 0,28
 *   f = 1,05 → k = 0,34   f = 1,08 → k = 0,45   f = 1,12 → k = 0,59   f = 1,19 → k = 0,83
 *
 * Die Hälfte der Beobachtungen liegt bei k ≤ 0,14 — die Liga zieht dort höchstens 14 % der
 * nominalen Abgabe ein, und die Oberfläche sagte kein Wort dazu. Genau dieser Fall ist Chris'
 * Meldung: in seiner Saison 2 steht f bei 0,96, also k = 0,03. Ein Team weit über der Linie zahlt
 * drei Prozent — und niemand konnte sehen, warum.
 *
 * DAS IST EINE ERKLAERUNG, KEINE REGELAENDERUNG. An der Arithmetik ist keine Zeile angefasst; ob
 * der Hebel so scharf drosseln SOLL, ist eine Balancing-Frage und liegt bei Chris.
 *
 * WARUM HIER UND NICHT VIERMAL AM ORT: den Satz gab es an vier Stellen (Finanzen-Karte,
 * Liga-Ausweis, GuV-Hover, Saisonende-GuV), jede mit eigener Formulierung. Vier Formulierungen für
 * eine Regel driften auseinander, sobald jemand die Schwelle anfasst.
 */
import { APRON_KONJUNKTUR_FACTOR_MAX, APRON_KONJUNKTUR_FACTOR_MIN } from "@/lib/season/apron-service";

/** Unterhalb dieser Wirkung ist der Hebel die Erklaerung fuer die Zahl und gehoert danebengeschrieben. */
const NENNENSWERTE_DROSSELUNG = 0.995;

function zahl(value: number, stellen = 2): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: stellen });
}

/**
 * Kurzform fuer Aufzaehlungen (GuV-Hover, Liga-Ausweis) — `null`, wenn der Hebel nichts erklaert.
 *
 * `konjunkturhebel` ist `k(f)` aus `apronKonjunkturhebel`, `salaryFactor` das `f` dazu.
 */
export function apronKonjunkturKurzhinweis(input: {
  konjunkturhebel: number | null | undefined;
  salaryFactor: number | null | undefined;
}): string | null {
  const k = input.konjunkturhebel;
  if (typeof k !== "number" || !Number.isFinite(k) || k >= NENNENSWERTE_DROSSELUNG) return null;
  const f = typeof input.salaryFactor === "number" && Number.isFinite(input.salaryFactor) ? input.salaryFactor : null;
  if (k <= 0) {
    return f == null
      ? `Konjunktur zu schwach: in dieser Saison keine Abgabe`
      : `Konjunktur zu schwach (Salary Factor ${zahl(f)} unter ${zahl(APRON_KONJUNKTUR_FACTOR_MIN)}): in dieser Saison keine Abgabe`;
  }
  const prozent = Math.round(k * 100);
  return f == null
    ? `Konjunktur drosselt die Abgabe auf ${prozent} %`
    : `Konjunktur drosselt die Abgabe auf ${prozent} % (Salary Factor ${zahl(f)})`;
}

/**
 * Langform fuer die Finanzen-Karte — ein ganzer Satz mit fuehrendem Leerzeichen, damit er sich an
 * den Statustext davor anschliesst. `""`, wenn der Hebel nichts erklaert.
 */
export function apronKonjunkturSatz(input: {
  konjunkturhebel: number | null | undefined;
  salaryFactor: number | null | undefined;
}): string {
  const k = input.konjunkturhebel;
  if (typeof k !== "number" || !Number.isFinite(k) || k >= NENNENSWERTE_DROSSELUNG) return "";
  const f = typeof input.salaryFactor === "number" && Number.isFinite(input.salaryFactor) ? input.salaryFactor : null;
  const faktorTeil = f == null ? "Der Salary Factor liegt" : `Der Salary Factor liegt bei ${zahl(f)} und damit`;
  if (k <= 0) {
    return (
      ` Abgabe in dieser Saison abgeschaltet: ${faktorTeil} unter ${zahl(APRON_KONJUNKTUR_FACTOR_MIN)} —` +
      ` unterhalb dieser Schwelle zahlt niemand, egal wie weit über den Linien.`
    );
  }
  const prozent = Math.round(k * 100);
  return (
    ` Abgabe konjunkturbedingt auf ${prozent} % gedrosselt: ${faktorTeil} zwischen der Schwelle` +
    ` ${zahl(APRON_KONJUNKTUR_FACTOR_MIN)} und der vollen Wirkung ab ${zahl(APRON_KONJUNKTUR_FACTOR_MAX)}.` +
    ` Ein Team weit über den Linien zahlt deshalb spürbar weniger, als die Linien vermuten lassen.`
  );
}

import { redirect } from "next/navigation";

/** Empfehlungen sind im Sortiment aufgegangen (Reiter "Daten prüfen", "Auslisten", "Nachbestellen", Dashboard "Muss weg"): UX_KONZEPT_GESAMT.md, Entscheidungen 14.11. */
export default function Page() {
  redirect("/sortiment?aufgabe=daten");
}

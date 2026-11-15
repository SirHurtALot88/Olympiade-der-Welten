import { redirect } from "next/navigation";

/** Marktpreise ist im Sortiment aufgegangen (Reiter "Preis ändern", Markt im Drawer): UX_KONZEPT_GESAMT.md, Entscheidungen 14.11. */
export default function Page() {
  redirect("/sortiment?aufgabe=preis");
}

import type { SaleWindowKey } from "@/lib/parsing/date";
import { WINDOW_OPTIONS } from "@/lib/cockpit/viewModel";

/** Fenster-Umschalter als Links -- die Seite rendert serverseitig, kein Client-State. */
export function WindowSwitch({ current }: { current: SaleWindowKey }) {
  return (
    <nav className="ck-seg" aria-label="Zeitfenster">
      {WINDOW_OPTIONS.map((o) => (
        <a key={o.key} href={`/cockpit?fenster=${o.key}`} aria-current={o.key === current ? "true" : undefined}>
          {o.label}
        </a>
      ))}
    </nav>
  );
}

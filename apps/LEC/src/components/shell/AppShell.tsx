import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** Rechter Bereich der Topbar (Suche, Fenster-Umschalter, …). */
  topbarRight?: ReactNode;
  /** Zusaetzliche Datenstand-Angaben, werden nach dem "Live"-Tag angehaengt. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Gemeinsame Seiten-Huelle (Sidebar + <main> + Topbar-Slot + Footer), extrahiert
 * aus DashboardShell (docs/enterich-cards/PAGES_CONCEPT.md, Vorarbeit). Jede
 * Seite nutzt AppShell statt Sidebar/main manuell zu kopieren, siehe
 * "Seitenuebergreifende Prinzipien" #1 im Konzept.
 */
export function AppShell({ title, subtitle, topbarRight, footer, children }: Props) {
  return (
    <div className="app">
      <Sidebar />
      <main>
        <div className="topbar">
          <div>
            <h1>{title}</h1>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <div className="spacer" />
          {topbarRight}
        </div>

        {children}

        <footer>
          <span className="tag">Live</span>
          {footer}
        </footer>
      </main>
    </div>
  );
}

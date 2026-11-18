import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FoundationRailIcon } from "@/app/foundation/shell/foundation-nav-icons";
import { FOUNDATION_NAV_GROUPS } from "@/lib/foundation/foundation-nav-config";
import {
  NAV_RAIL_PINNED_STORAGE_KEY,
  loadNavRailPinned,
  saveNavRailPinned,
} from "@/lib/ui/nav-rail-preference";

const lies = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

function fakeWindow(speicher: Record<string, string>, wirft = false) {
  return {
    localStorage: {
      getItem: (k: string) => {
        if (wirft) throw new Error("gesperrt");
        return k in speicher ? speicher[k] : null;
      },
      setItem: (k: string, v: string) => {
        if (wirft) throw new Error("gesperrt");
        speicher[k] = v;
      },
    },
    dispatchEvent: vi.fn(),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Icon-Schiene der App-Navigation (18.11.)", () => {
  it("ist standardmäßig kompakt: Shell setzt is-bc-rail ohne Opt-in, Anheften ist Default aus", () => {
    const shell = lies("app/foundation/shell/FoundationShell.tsx");
    expect(shell).toContain("compactRail = true");
    expect(shell).toContain("is-rail-pinned");
    expect(lies("app/foundation/FoundationShellRouterBody.tsx")).not.toContain("compactRail=");
    vi.stubGlobal("window", fakeWindow({}));
    expect(loadNavRailPinned()).toBe(false);
  });

  it("Hover klappt nach kurzer Verzögerung aus, Tastaturfokus sofort; Maus-Fokus nicht", () => {
    const sidebar = lies("app/foundation/shell/FoundationSidebar.tsx");
    expect(sidebar).toContain("RAIL_HOVER_DELAY_MS");
    expect(sidebar).toContain("onMouseEnter");
    expect(sidebar).toContain("onMouseLeave");
    expect(sidebar).toContain(':focus-visible');
    expect(sidebar).toContain('data-rail={railMode}');
    expect(sidebar).toContain('"compact"');
    expect(sidebar).toContain('"open"');
    expect(sidebar).toContain('"pinned"');
  });

  it("Anheften wird pro Browser gespeichert und übersteht gesperrtes localStorage", () => {
    const speicher: Record<string, string> = {};
    vi.stubGlobal("window", fakeWindow(speicher));
    saveNavRailPinned(true);
    expect(speicher[NAV_RAIL_PINNED_STORAGE_KEY]).toBe("1");
    expect(loadNavRailPinned()).toBe(true);
    saveNavRailPinned(false);
    expect(loadNavRailPinned()).toBe(false);

    vi.stubGlobal("window", fakeWindow({}, true));
    expect(() => saveNavRailPinned(true)).not.toThrow();
    expect(loadNavRailPinned()).toBe(false);
  });

  it("der Schalter ist ein beschrifteter Umschalter", () => {
    const sidebar = lies("app/foundation/shell/FoundationSidebar.tsx");
    expect(sidebar).toContain('data-testid="foundation-rail-pin"');
    expect(sidebar).toContain("aria-pressed={rail.pinned}");
    expect(sidebar).toContain("Beschriftung immer zeigen");
  });

  it("jeder Nav-Eintrag hat in der Schiene ein Symbol (keine Funktion geht verloren)", () => {
    for (const gruppe of FOUNDATION_NAV_GROUPS) {
      for (const item of gruppe.items) {
        const html = renderToStaticMarkup(<FoundationRailIcon viewId={item.id} />);
        expect(html, `${item.id} ohne SVG`).toContain("<svg");
      }
    }
  });

  it("CSS: Phone-Zeile, Fokusring und Reduced-Motion sind da", () => {
    const css = lies("components/foundation/broadcast/broadcast.css");
    expect(css).toContain('[data-rail="compact"]');
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (max-width: 760px)");
    const rm = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(rm).toContain(".foundation-shell-layout.is-bc-rail .foundation-sidebar");
  });
});

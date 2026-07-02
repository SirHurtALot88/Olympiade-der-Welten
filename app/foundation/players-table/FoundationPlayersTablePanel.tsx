"use client";

import type { ReactNode } from "react";

import FoundationViewMount from "@/lib/foundation/foundation-view-mount";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

import FoundationPlayersTableBody, { type FoundationPlayersTableBodyProps } from "./FoundationPlayersTableBody";

export default function FoundationPlayersTablePanel({
  activeView,
  header,
  toolbar,
  bracketStrip,
  footnote,
  table,
}: {
  activeView: FoundationViewId;
  header: ReactNode;
  toolbar: ReactNode;
  bracketStrip: ReactNode;
  table: FoundationPlayersTableBodyProps;
  footnote: ReactNode;
}) {
  return (
    <FoundationViewMount
      activeView={activeView}
      views={["players"]}
      className="panel"
      id="players-table"
      suspend={false}
    >
      {header}
      {toolbar}
      {bracketStrip}
      <FoundationPlayersTableBody {...table} />
      {footnote}
    </FoundationViewMount>
  );
}

"use client";

import type { ReactNode } from "react";

type LobbyCardProps = {
  title: string;
  children: ReactNode;
};

export function LobbyCard({ title, children }: LobbyCardProps) {
  return (
    <section className="panel lobby-card">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

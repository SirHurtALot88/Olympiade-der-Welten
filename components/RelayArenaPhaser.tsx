"use client";

import { useEffect, useRef } from "react";

import type { CoachRole, OlyRoomState } from "@/types/game";

type RelayArenaPhaserProps = {
  state: OlyRoomState;
  currentRole: CoachRole;
  onTokenSelect: (tokenId: string) => void;
};

export function RelayArenaPhaser({ state, currentRole, onTokenSelect }: RelayArenaPhaserProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<{ destroy: (removeCanvas: boolean, noReturn?: boolean) => void } | null>(null);
  const sceneRef = useRef<{ syncState: (nextState: OlyRoomState, nextRole: CoachRole) => void } | null>(null);
  const latestStateRef = useRef(state);
  const latestRoleRef = useRef(currentRole);
  const onTokenSelectRef = useRef(onTokenSelect);

  latestStateRef.current = state;
  latestRoleRef.current = currentRole;
  onTokenSelectRef.current = onTokenSelect;

  useEffect(() => {
    let isDisposed = false;

    async function boot() {
      const Phaser = (await import("phaser")).default;
      if (!containerRef.current || isDisposed || gameRef.current) {
        return;
      }

      class RelayScene extends Phaser.Scene {
        syncState(nextState: OlyRoomState, nextRole: CoachRole) {
          this.children.removeAll();
          const { width } = this.scale;
          const startX = 56;
          const startY = 140;
          const usableWidth = width - startX * 2;
          const spacing = usableWidth / Math.max(nextState.board.laneLength - 1, 1);

          this.add.text(28, 28, nextState.board.laneLabel, {
            color: "#eef2ff",
            fontFamily: "Verdana",
            fontSize: "20px",
          });

          this.add.text(28, 56, `Turn ${nextState.turnNumber} · Coach ${nextState.activeRole} aktiv`, {
            color: "#cbd5e1",
            fontFamily: "Verdana",
            fontSize: "14px",
          });

          for (let index = 0; index < nextState.board.laneLength; index += 1) {
            const x = startX + index * spacing;
            this.add.rectangle(x, startY, 44, 44, 0x172554, 1).setStrokeStyle(2, 0x60a5fa);
            this.add.text(x - 8, startY - 10, String(index + 1), {
              color: "#dbeafe",
              fontFamily: "Verdana",
              fontSize: "14px",
            });
          }

          nextState.tokens.forEach((token, tokenIndex) => {
            const x = startX + token.position * spacing;
            const rowOffset = token.ownerRole === "A" ? -62 : 62;
            const intraOffset = (tokenIndex % 4) * 12 - 18;
            const isCurrentRoleToken = token.ownerRole === nextRole;
            const circle = this.add
              .circle(x + intraOffset, startY + rowOffset, 14, token.ownerRole === "A" ? 0xf97316 : 0x10b981)
              .setStrokeStyle(3, isCurrentRoleToken ? 0xf8fafc : 0x94a3b8);

            if (isCurrentRoleToken) {
              circle.setInteractive({ useHandCursor: true });
              circle.on("pointerdown", () => {
                onTokenSelectRef.current(token.id);
              });
            }

            this.add.text(x + intraOffset - 10, startY + rowOffset - 6, token.label, {
              color: "#0f172a",
              fontFamily: "Verdana",
              fontSize: "10px",
            });
          });
        }

        create() {
          sceneRef.current = this;
          this.syncState(latestStateRef.current, latestRoleRef.current);
        }
      }

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 1200,
        height: 320,
        parent: containerRef.current,
        backgroundColor: "#0f172a",
        scene: RelayScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });

      gameRef.current = game;
    }

    boot();

    return () => {
      isDisposed = true;
      sceneRef.current = null;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.syncState(state, currentRole);
  }, [currentRole, state]);

  return <div className="phaser-shell" ref={containerRef} />;
}

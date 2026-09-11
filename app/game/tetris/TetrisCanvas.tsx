"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createTetrisGame, type TetrisGame, type TetrisStats } from "./engine";
import type { GameCanvasProps, GameEngineHandle } from "@/app/game/registry";

export interface TetrisCanvasHandle extends GameEngineHandle {}

const TetrisCanvas = forwardRef<TetrisCanvasHandle, GameCanvasProps>(
  function TetrisCanvas({ onStats, onGameOver }, ref) {
    const boardRef = useRef<HTMLCanvasElement>(null);
    const nextRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<TetrisGame | null>(null);

    useEffect(() => {
      const boardCanvas = boardRef.current;
      const nextCanvas = nextRef.current;
      if (!boardCanvas || !nextCanvas) return;

      const handleStats = (stats: TetrisStats) =>
        onStats({ score: stats.score, lives: stats.lines, level: stats.level });

      const game = createTetrisGame(boardCanvas, nextCanvas, {
        onStats: handleStats,
        onGameOver,
      });
      gameRef.current = game;
      game.start();

      return () => {
        game.destroy();
        gameRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      pause: () => gameRef.current?.pause(),
      resume: () => gameRef.current?.resume(),
      restart: () => gameRef.current?.restart(),
      forceGameOver: () => gameRef.current?.forceGameOver(),
    }));

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <canvas ref={boardRef} width={300} height={600} />
        <aside
          className="mono"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: 120,
          }}
        >
          <div>
            <div
              className="pixel"
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                letterSpacing: "0.14em",
                marginBottom: 6,
              }}
            >
              SIGUIENTE
            </div>
            <canvas ref={nextRef} width={120} height={120} />
          </div>
          <div>
            <div
              className="pixel"
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                letterSpacing: "0.14em",
                marginBottom: 6,
              }}
            >
              CONTROLES
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 11,
                color: "var(--ink-dim)",
              }}
            >
              <li>
                <kbd>←</kbd> <kbd>→</kbd> mover
              </li>
              <li>
                <kbd>↑</kbd> / <kbd>X</kbd> rotar
              </li>
              <li>
                <kbd>↓</kbd> bajar
              </li>
              <li>
                <kbd>Espacio</kbd> caída
              </li>
            </ul>
          </div>
        </aside>
      </div>
    );
  }
);

export default TetrisCanvas;

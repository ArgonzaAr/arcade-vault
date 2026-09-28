"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createSnakeGame, type SnakeGame, type SnakeStats } from "./engine";
import type { GameCanvasProps, GameEngineHandle } from "@/app/game/registry";

export type SnakeCanvasHandle = GameEngineHandle;

const SnakeCanvas = forwardRef<SnakeCanvasHandle, GameCanvasProps>(
  function SnakeCanvas({ onStats, onGameOver, skin }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<SnakeGame | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleStats = (stats: SnakeStats) =>
        onStats({
          score: stats.score,
          lives: stats.length,
          level: stats.level,
        });

      // Contador de FPS para medir rendimiento en cualquier dispositivo (spec 11).
      const showFps =
        new URLSearchParams(window.location.search).get("fps") === "1";
      const game = createSnakeGame(
        canvas,
        {
          onStats: handleStats,
          onGameOver,
        },
        skin,
        { showFps }
      );
      gameRef.current = game;
      game.start();

      return () => {
        game.destroy();
        gameRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cambiar de skin solo repinta; no reinicia la partida ni toca la pausa.
    useEffect(() => {
      gameRef.current?.setSkin(skin);
    }, [skin]);

    useImperativeHandle(ref, () => ({
      pause: () => gameRef.current?.pause(),
      resume: () => gameRef.current?.resume(),
      restart: () => gameRef.current?.restart(),
      forceGameOver: () => gameRef.current?.forceGameOver(),
    }));

    return (
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    );
  }
);

export default SnakeCanvas;

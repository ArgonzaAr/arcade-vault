"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  createArkanoidGame,
  type ArkanoidGame,
  type ArkanoidStats,
} from "./engine";
import type { GameCanvasProps, GameEngineHandle } from "@/app/game/registry";

export interface ArkanoidCanvasHandle extends GameEngineHandle {}

const ArkanoidCanvas = forwardRef<ArkanoidCanvasHandle, GameCanvasProps>(
  function ArkanoidCanvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<ArkanoidGame | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleStats = (stats: ArkanoidStats) => onStats(stats);

      const game = createArkanoidGame(canvas, {
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

export default ArkanoidCanvas;

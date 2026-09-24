"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  createAsteroidsGame,
  type AsteroidsGame,
  type AsteroidsStats,
} from "./engine";
import type { SkinId } from "@/app/game/skins";

export interface AsteroidsCanvasHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  forceGameOver: () => void;
}

interface AsteroidsCanvasProps {
  onStats: (stats: AsteroidsStats) => void;
  onGameOver: (finalScore: number) => void;
  skin: SkinId;
}

const AsteroidsCanvas = forwardRef<AsteroidsCanvasHandle, AsteroidsCanvasProps>(
  function AsteroidsCanvas({ onStats, onGameOver, skin }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<AsteroidsGame | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const game = createAsteroidsGame(canvas, { onStats, onGameOver }, skin);
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

export default AsteroidsCanvas;

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createFroggerGame, type FroggerGame } from "./engine";
import type { GameCanvasProps, GameEngineHandle } from "@/app/game/registry";

export type FroggerCanvasHandle = GameEngineHandle;

const FroggerCanvas = forwardRef<FroggerCanvasHandle, GameCanvasProps>(
  function FroggerCanvas({ onStats, onGameOver, skin }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<FroggerGame | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // FroggerStats ya tiene la forma de GameStats (score, lives, level).
      const game = createFroggerGame(canvas, { onStats, onGameOver }, skin);
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
        width={640}
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

export default FroggerCanvas;

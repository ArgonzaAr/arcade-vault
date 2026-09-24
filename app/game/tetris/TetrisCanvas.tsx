"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createTetrisGame, type TetrisGame, type TetrisStats } from "./engine";
import type { GameCanvasProps, GameEngineHandle } from "@/app/game/registry";

export type TetrisCanvasHandle = GameEngineHandle;

// Tamaño de .crt-screen--narrow en escritorio, para el que está maquetado el
// bloque tablero + panel. En pantallas más chicas (móvil) se escala entero.
const BASE_W = 460;
const BASE_H = 627;

const TetrisCanvas = forwardRef<TetrisCanvasHandle, GameCanvasProps>(
  function TetrisCanvas({ onStats, onGameOver, skin }, ref) {
    const boardRef = useRef<HTMLCanvasElement>(null);
    const nextRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<TetrisGame | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Escala tablero + panel al espacio disponible; nunca agranda (scale ≤ 1),
    // así el layout de escritorio queda igual.
    useEffect(() => {
      const wrap = wrapRef.current;
      const content = contentRef.current;
      if (!wrap || !content) return;
      const fit = () => {
        const s = Math.min(
          1,
          wrap.clientWidth / BASE_W,
          wrap.clientHeight / BASE_H
        );
        content.style.transform = s < 1 ? `scale(${s})` : "";
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(wrap);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      const boardCanvas = boardRef.current;
      const nextCanvas = nextRef.current;
      if (!boardCanvas || !nextCanvas) return;

      const handleStats = (stats: TetrisStats) =>
        onStats({ score: stats.score, lives: stats.lines, level: stats.level });

      const game = createTetrisGame(
        boardCanvas,
        nextCanvas,
        { onStats: handleStats, onGameOver },
        skin
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
      <div
        ref={wrapRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={contentRef}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexShrink: 0,
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
      </div>
    );
  }
);

export default TetrisCanvas;

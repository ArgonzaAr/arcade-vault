// ===== registry.ts — registro de motores reales por id de juego =====
// Reemplaza los `if (id === "asteroides")` puntuales: agregar un juego nuevo
// con motor real es agregar una entrada aquí, no tocar los consumidores.

import type {
  ComponentType,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import AsteroidsCanvas from "./asteroides/AsteroidsCanvas";
import TetrisCanvas from "./tetris/TetrisCanvas";
import ArkanoidCanvas from "./arkanoid/ArkanoidCanvas";

export interface GameEngineHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  forceGameOver: () => void;
}

export interface GameStats {
  score: number;
  lives: number;
  level: number;
}

export interface GameCanvasProps {
  onStats: (stats: GameStats) => void;
  onGameOver: (finalScore: number) => void;
}

export type GameCanvasComponent = ForwardRefExoticComponent<
  GameCanvasProps & RefAttributes<GameEngineHandle>
>;

export interface GameRegistryEntry {
  Canvas: GameCanvasComponent;
  hasRealLeaderboard: boolean;
  // Label y formato del slot "Vidas" del player-hud para este juego
  // (asteroides muestra corazones; otros motores pueden mostrar un número, p.ej. líneas).
  secondaryStatLabel: string;
  formatSecondaryStat: (value: number) => string;
  // Clase extra para .crt-screen cuando el tablero no encaja en el 4:3 por defecto.
  screenClassName?: string;
}

const formatHearts = (value: number) => "♥ ".repeat(value).trim() || "—";
const formatNumber = (value: number) => String(value);

export const gameRegistry: Record<string, GameRegistryEntry> = {
  asteroides: {
    Canvas: AsteroidsCanvas as ComponentType<unknown> as GameCanvasComponent,
    hasRealLeaderboard: true,
    secondaryStatLabel: "Vidas",
    formatSecondaryStat: formatHearts,
  },
  tetris: {
    Canvas: TetrisCanvas as ComponentType<unknown> as GameCanvasComponent,
    hasRealLeaderboard: true,
    secondaryStatLabel: "Líneas",
    formatSecondaryStat: formatNumber,
    screenClassName: "crt-screen--narrow",
  },
  arkanoid: {
    Canvas: ArkanoidCanvas as ComponentType<unknown> as GameCanvasComponent,
    hasRealLeaderboard: true,
    secondaryStatLabel: "Vidas",
    formatSecondaryStat: formatHearts,
  },
};

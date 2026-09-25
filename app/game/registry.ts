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
import SnakeCanvas from "./snake/SnakeCanvas";
import FroggerCanvas from "./frogger/FroggerCanvas";
import type { SkinId } from "./skins";
import {
  KEY_DOWN,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_SPACE,
  KEY_UP,
  type TouchControlsConfig,
} from "./touch";

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
  // Skin visual activa; solo afecta el render, nunca la mecánica.
  skin: SkinId;
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
  // Skins disponibles en el selector del HUD, en orden; siempre incluye "clasico".
  skins: SkinId[];
  // Gamepad virtual que se muestra en dispositivos táctiles.
  touchControls: TouchControlsConfig;
}

const formatHearts = (value: number) => "♥ ".repeat(value).trim() || "—";
const formatNumber = (value: number) => String(value);

export const gameRegistry: Record<string, GameRegistryEntry> = {
  asteroides: {
    Canvas: AsteroidsCanvas as ComponentType<unknown> as GameCanvasComponent,
    hasRealLeaderboard: true,
    secondaryStatLabel: "Vidas",
    formatSecondaryStat: formatHearts,
    skins: ["clasico", "neon", "retro"],
    touchControls: {
      buttons: {
        left: { emit: KEY_LEFT },
        right: { emit: KEY_RIGHT },
        up: { emit: KEY_UP }, // propulsar
        a: { emit: KEY_SPACE, label: "DISPARO" },
      },
    },
  },
  tetris: {
    Canvas: TetrisCanvas as ComponentType<unknown> as GameCanvasComponent,
    hasRealLeaderboard: true,
    secondaryStatLabel: "Líneas",
    formatSecondaryStat: formatNumber,
    screenClassName: "crt-screen--narrow",
    skins: ["clasico", "neon", "retro"],
    touchControls: {
      buttons: {
        up: { emit: KEY_UP }, // rotar
        down: { emit: KEY_DOWN, repeat: true }, // caída suave
        left: { emit: KEY_LEFT, repeat: true },
        right: { emit: KEY_RIGHT, repeat: true },
        a: { emit: KEY_SPACE, label: "CAÍDA" }, // caída dura
      },
    },
  },
  arkanoid: {
    Canvas: ArkanoidCanvas as ComponentType<unknown> as GameCanvasComponent,
    hasRealLeaderboard: true,
    secondaryStatLabel: "Vidas",
    formatSecondaryStat: formatHearts,
    skins: ["clasico", "neon", "retro"],
    touchControls: {
      buttons: {
        left: { emit: KEY_LEFT },
        right: { emit: KEY_RIGHT },
      },
    },
  },
  snake: {
    Canvas: SnakeCanvas as ComponentType<unknown> as GameCanvasComponent,
    hasRealLeaderboard: true,
    secondaryStatLabel: "Longitud",
    formatSecondaryStat: formatNumber,
    skins: ["clasico", "neon", "retro"],
    touchControls: {
      buttons: {
        up: { emit: KEY_UP },
        down: { emit: KEY_DOWN },
        left: { emit: KEY_LEFT },
        right: { emit: KEY_RIGHT },
      },
    },
  },
  frogger: {
    Canvas: FroggerCanvas as ComponentType<unknown> as GameCanvasComponent,
    hasRealLeaderboard: true,
    secondaryStatLabel: "Vidas",
    formatSecondaryStat: formatHearts,
    screenClassName: "crt-screen--frogger",
    skins: ["clasico", "neon", "retro"],
    touchControls: {
      buttons: {
        up: { emit: KEY_UP },
        down: { emit: KEY_DOWN },
        left: { emit: KEY_LEFT },
        right: { emit: KEY_RIGHT },
      },
    },
  },
};

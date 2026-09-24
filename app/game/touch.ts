// ===== touch.ts — contrato del gamepad virtual para dispositivos táctiles =====
// El gamepad no habla con los motores: despacha KeyboardEvent sintéticos en
// `document`, así cada motor sigue leyendo el teclado como siempre.

export type PadButtonId = "up" | "down" | "left" | "right" | "a" | "b";

// Tecla que emite un botón del pad: se usan ambos campos porque
// asteroides/tetris leen `e.code` y arkanoid/snake leen `e.key`.
export interface PadKey {
  key: string;
  code: string;
}

export interface PadButtonConfig {
  emit: PadKey;
  label?: string; // texto visible en A/B (p.ej. "DISPARO"); las flechas usan su glifo
  repeat?: boolean; // re-emite keydown mientras se mantiene pulsado
}

export interface TouchControlsConfig {
  // Botones no declarados no se renderizan.
  buttons: Partial<Record<PadButtonId, PadButtonConfig>>;
}

export const KEY_UP: PadKey = { key: "ArrowUp", code: "ArrowUp" };
export const KEY_DOWN: PadKey = { key: "ArrowDown", code: "ArrowDown" };
export const KEY_LEFT: PadKey = { key: "ArrowLeft", code: "ArrowLeft" };
export const KEY_RIGHT: PadKey = { key: "ArrowRight", code: "ArrowRight" };
export const KEY_SPACE: PadKey = { key: " ", code: "Space" };

export const REPEAT_DELAY_MS = 170;
export const REPEAT_INTERVAL_MS = 50;

// Burbujea desde `document` hasta `window`, así llega a los motores que
// escuchan en cualquiera de los dos.
export function emitKey(type: "keydown" | "keyup", k: PadKey): void {
  document.dispatchEvent(
    new KeyboardEvent(type, {
      key: k.key,
      code: k.code,
      bubbles: true,
      cancelable: true,
    })
  );
}

"use client";

// ===== TouchGamepad.tsx — gamepad virtual para dispositivos táctiles =====
// Cruceta + botones A/B declarados por juego en `touchControls` del registro.
// Cada botón despacha KeyboardEvent sintéticos (ver touch.ts): los motores no
// saben que existe. Multitouch: cada botón rastrea su propio pointerId.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  emitKey,
  type PadButtonConfig,
  type PadButtonId,
  type TouchControlsConfig,
} from "./touch";

interface TouchGamepadProps {
  config: TouchControlsConfig;
  disabled: boolean; // true en pausa o fin: suelta todo y no emite eventos
  placement: "below" | "sides"; // vertical: debajo del canvas; horizontal: a los lados
}

interface HeldButton {
  pointerId: number;
  config: PadButtonConfig;
  delay?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
}

// Posiciones fijas de la cruz; se omiten las que el juego no declara.
const DIRECTIONS = [
  { id: "up", label: "Arriba" },
  { id: "left", label: "Izquierda" },
  { id: "right", label: "Derecha" },
  { id: "down", label: "Abajo" },
] as const satisfies readonly { id: PadButtonId; label: string }[];

const ACTIONS = ["b", "a"] as const satisfies readonly PadButtonId[];

// Flecha pixel-art (apunta arriba); cada dirección la rota por CSS.
function PixelArrow() {
  return (
    <svg
      className="touch-arrow"
      viewBox="0 0 7 4"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d="M3 0h1v1h1v1h1v1h1v1H0V3h1V2h1V1h1z" />
    </svg>
  );
}

export default function TouchGamepad({
  config,
  disabled,
  placement,
}: TouchGamepadProps) {
  const held = useRef(new Map<PadButtonId, HeldButton>());
  const [pressed, setPressed] = useState<ReadonlySet<PadButtonId>>(
    () => new Set()
  );

  const syncPressed = () => setPressed(new Set(held.current.keys()));

  const stopRepeat = (h: HeldButton) => {
    clearTimeout(h.delay);
    clearInterval(h.interval);
  };

  const release = (id: PadButtonId, pointerId: number) => {
    const h = held.current.get(id);
    if (!h || h.pointerId !== pointerId) return;
    stopRepeat(h);
    held.current.delete(id);
    emitKey("keyup", h.config.emit);
    syncPressed();
  };

  // Suelta todo lo pulsado: sin teclas "pegadas" en el motor.
  const releaseAll = useCallback(() => {
    if (held.current.size === 0) return;
    for (const h of held.current.values()) {
      stopRepeat(h);
      emitKey("keyup", h.config.emit);
    }
    held.current.clear();
    setPressed(new Set());
  }, []);

  const press = (
    id: PadButtonId,
    cfg: PadButtonConfig,
    e: ReactPointerEvent<HTMLButtonElement>
  ) => {
    // Evita foco, selección y el zoom por doble toque.
    e.preventDefault();
    if (disabled || held.current.has(id)) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const h: HeldButton = { pointerId: e.pointerId, config: cfg };
    emitKey("keydown", cfg.emit);
    if (cfg.repeat) {
      h.delay = setTimeout(() => {
        h.interval = setInterval(
          () => emitKey("keydown", cfg.emit),
          REPEAT_INTERVAL_MS
        );
      }, REPEAT_DELAY_MS);
    }
    held.current.set(id, h);
    syncPressed();
  };

  // Con captura (implícita en touch) no llega pointerleave al deslizar fuera:
  // se comprueba a mano si el dedo salió del botón.
  const move = (id: PadButtonId, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!held.current.has(id)) return;
    const r = e.currentTarget.getBoundingClientRect();
    const outside =
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom;
    if (outside) release(id, e.pointerId);
  };

  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") releaseAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAll();
    };
  }, [releaseAll]);

  const renderButton = (
    id: PadButtonId,
    cfg: PadButtonConfig,
    className: string,
    ariaLabel: string,
    content: ReactNode
  ) => (
    <button
      key={id}
      type="button"
      tabIndex={-1}
      className={className + (pressed.has(id) ? " is-pressed" : "")}
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={(e) => press(id, cfg, e)}
      onPointerMove={(e) => move(id, e)}
      onPointerUp={(e) => release(id, e.pointerId)}
      onPointerCancel={(e) => release(id, e.pointerId)}
      onPointerLeave={(e) => release(id, e.pointerId)}
      onLostPointerCapture={(e) => release(id, e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {content}
    </button>
  );

  const { buttons } = config;

  return (
    <div
      className={`touch-pad touch-pad--${placement}`}
      role="group"
      aria-label="Controles táctiles"
    >
      <div className="touch-dpad">
        <span className="touch-dpad-hub" aria-hidden="true" />
        {DIRECTIONS.map(({ id, label }) => {
          const cfg = buttons[id];
          if (!cfg) return null;
          return renderButton(
            id,
            cfg,
            `touch-btn touch-dir touch-dir--${id}`,
            label,
            <PixelArrow />
          );
        })}
      </div>

      <div className="touch-actions">
        {ACTIONS.map((id) => {
          const cfg = buttons[id];
          if (!cfg) return null;
          const letter = id.toUpperCase();
          return (
            <div key={id} className={`touch-action touch-action--${id}`}>
              {renderButton(
                id,
                cfg,
                "touch-btn touch-round",
                cfg.label ?? letter,
                letter
              )}
              {cfg.label && (
                <span className="touch-action-label" aria-hidden="true">
                  {cfg.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

# 10 — Controles táctiles para móvil

**Estado:** Aprobado
**Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
**Fecha:** 2026-09-24

**Objetivo:** Hacer jugables en un teléfono con pantalla táctil los cuatro juegos con motor real (asteroides, tetris, arkanoid, snake) mediante un gamepad virtual genérico, configurado por juego en el registro, que despacha eventos de teclado sintéticos sin modificar los motores.

## Alcance

**Incluye:**

- Gamepad virtual genérico (`app/game/TouchGamepad.tsx`): cruceta de 4 direcciones + botones de acción `A`/`B` opcionales. Solo se renderizan los botones que el juego declara.
- Tipos y constantes de teclas del gamepad en `app/game/touch.ts`.
- Hook `app/game/useIsTouchDevice.ts` que detecta dispositivo táctil con `matchMedia("(pointer: coarse)")` (con listener de cambio). El gamepad solo aparece si el hook devuelve `true`; en escritorio nada cambia.
- Campo **obligatorio** `touchControls` en `GameRegistryEntry` (`app/game/registry.ts`), y su valor para `asteroides`, `tetris`, `arkanoid` y `snake`. Todo juego futuro debe declararlo (el compilador lo exige).
- Comunicación gamepad → motor mediante `KeyboardEvent` sintéticos (`keydown`/`keyup`) despachados en `document` con `bubbles: true` y con `key` y `code` correctos, de modo que llegan tanto a los motores que escuchan en `document` (arkanoid, snake) como en `window` (asteroides, tetris).
- Multitouch: cada botón rastrea su propio `pointerId` con Pointer Events; se pueden mantener varios botones a la vez (p.ej. girar + propulsar + disparar en asteroides). `pointerup`, `pointercancel` y `pointerleave` del botón emiten `keyup`.
- Auto-repetición opcional por botón (`repeat: true`): al mantenerlo pulsado re-emite `keydown` tras `REPEAT_DELAY_MS` y luego cada `REPEAT_INTERVAL_MS`. Se usa en tetris para `←`, `→` y `↓`.
- Liberación de seguridad: al desmontar el gamepad, al ocultarse la pestaña o al pasar a pausa/fin, se emite `keyup` de todo botón que siga pulsado (sin teclas "pegadas").
- Pausa automática: si `document.visibilityState` pasa a `hidden` durante una partida en curso (no pausada, no terminada), el reproductor activa la PAUSA existente. Rotar el teléfono **no** pausa.
- Layout del reproductor en dispositivo táctil (`app/globals.css`), soportando ambas orientaciones sin bloquear la rotación:
  - **Vertical:** HUD arriba, canvas (`.crt`) al centro, gamepad debajo (cruceta a la izquierda, `A`/`B` a la derecha).
  - **Horizontal:** cruceta a la izquierda del canvas, `A`/`B` a la derecha; el canvas se limita en altura al viewport disponible (`dvh`) para que HUD + canvas quepan sin scroll.
- HUD compacto en táctil: `player-hud` con stats en una fila reducida, botones PAUSA/FIN/SALIR y selector de skin más pequeños, y `.crt-bottom` oculto en horizontal, para liberar espacio al canvas.
- Bloqueo de gestos del navegador sobre la zona de juego: `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none` y `-webkit-tap-highlight-color: transparent` en el canvas y el gamepad; `contextmenu` cancelado en los botones del gamepad. El resto de la página conserva scroll y zoom normales.
- Diseño visual del gamepad coherente con la estética CRT/neón del sitio, usando la skill `/frontend-design` (regla del `CLAUDE.md`).
- Actualización de `CLAUDE.md` (sección "Juegos con motor real") indicando que cada entrada del registro declara `touchControls`.

**Fuera de alcance (para futuras specs):**

- Controles por gestos (swipe, arrastre, tap sobre el canvas) — descartados a favor del gamepad genérico (ver Decisiones).
- Control de la paleta de arkanoid arrastrando el dedo sobre el canvas (el `mousemove` existente no se adapta a touch).
- Botón de pantalla completa (Fullscreen API).
- Vibración háptica (`navigator.vibrate`).
- Toggle manual en el HUD para forzar mostrar/ocultar el gamepad.
- Pausa al cambiar de orientación.
- Adaptación móvil de otras páginas (home, biblioteca, detalle, salón, auth) más allá de lo que ya tengan.
- Cualquier cambio en `app/game/*/engine.ts` o en los `*Canvas.tsx` de los cuatro juegos.
- Cambios en Supabase, leaderboard o en el juego `invasores` de `specs/game-jam/04-invasores/` (aún no implementado).
- Tests automatizados (no hay framework configurado en el repo).
- Cualquier archivo bajo `references/`.

## Modelo de datos

```ts
// app/game/touch.ts
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
```

```ts
// app/game/TouchGamepad.tsx — client component
interface TouchGamepadProps {
  config: TouchControlsConfig;
  disabled: boolean; // true en pausa o fin: suelta todo y no emite eventos
  placement: "below" | "sides"; // vertical: debajo del canvas; horizontal: a los lados
}
```

```ts
// app/game/useIsTouchDevice.ts
export function useIsTouchDevice(): boolean; // false en SSR y hasta hidratar
```

`GameRegistryEntry` (`app/game/registry.ts`) gana un campo obligatorio:

```ts
// Gamepad virtual que se muestra en dispositivos táctiles.
touchControls: TouchControlsConfig;
```

Valores por juego:

```ts
asteroides: {
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
  touchControls: {
    buttons: {
      left: { emit: KEY_LEFT },
      right: { emit: KEY_RIGHT },
    },
  },
},
snake: {
  touchControls: {
    buttons: {
      up: { emit: KEY_UP },
      down: { emit: KEY_DOWN },
      left: { emit: KEY_LEFT },
      right: { emit: KEY_RIGHT },
    },
  },
},
```

No se introduce persistencia nueva (ni `localStorage` ni Supabase).

## Plan de implementación

1. **`app/game/touch.ts`** — tipos `PadButtonId`, `PadKey`, `PadButtonConfig`, `TouchControlsConfig`, constantes `KEY_*`, `REPEAT_DELAY_MS`, `REPEAT_INTERVAL_MS`, y helper `emitKey(type: "keydown" | "keyup", k: PadKey)` que hace `document.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }))`. Nada lo consume todavía; el build sigue verde.
2. **`app/game/registry.ts`** — agregar `touchControls: TouchControlsConfig` (obligatorio) a `GameRegistryEntry` y los valores de los cuatro juegos definidos en el modelo de datos, sin tocar el resto de campos. El reproductor aún no lo usa.
3. **`app/game/useIsTouchDevice.ts`** — hook cliente con `matchMedia("(pointer: coarse)")`: estado inicial `false`, se sincroniza en `useEffect` tras hidratar y escucha `change`.
4. **`app/game/TouchGamepad.tsx`** — client component: cruceta (solo direcciones declaradas, en posiciones fijas de cruz) + botones `A`/`B` declarados con su `label`. Por botón: `onPointerDown` → `setPointerCapture`, `emitKey("keydown")`, arranca repetición si `repeat`; `onPointerUp`/`onPointerCancel`/`onLostPointerCapture` → detiene repetición y `emitKey("keyup")`. Mapa interno de botones pulsados para soltarlos todos al desmontar, al pasar `disabled` a `true` o en `visibilitychange` a `hidden`. `onContextMenu` con `preventDefault`. Estado visual `pressed` por botón. Diseño visual vía `/frontend-design`, coherente con la estética CRT/neón.
5. **Reproductor `app/game/[id]/play/page.tsx`** — usar `useIsTouchDevice()`; si es `true` y hay `entry`, renderizar `<TouchGamepad config={entry.touchControls} disabled={paused || over} placement={...} />` según orientación (`matchMedia("(orientation: landscape)")`). Envolver `.crt` y el gamepad en un contenedor que permita ambos layouts. Juegos sin `entry` (demo sin motor) no muestran gamepad.
6. **Pausa automática** — en el reproductor, listener de `visibilitychange`: si `hidden` y hay motor, no está en pausa ni terminado, activar la misma lógica que el botón PAUSA (`engineRef.current?.pause()` + `paused = true`). No se reanuda sola al volver.
7. **CSS `app/globals.css`** — estilos del gamepad; layout vertical/horizontal bajo `@media (pointer: coarse)` y `(orientation: landscape)`; HUD compacto en táctil; `.crt-bottom` oculto en horizontal táctil; alturas con `dvh`; `touch-action: none` y reglas anti-selección/anti-callout sobre canvas y gamepad. En escritorio (`pointer: fine`) ninguna regla nueva cambia el layout actual.
8. **`CLAUDE.md`** — en "Juegos con motor real", añadir `touchControls` a la lista de campos que define cada entrada del registro.
9. **Verificación final** — `npm run build` y `npm run lint` sin errores; recorrido en Chrome DevTools (modo dispositivo táctil, vertical y horizontal) y en un teléfono real vía `npm run dev` en la red local (`allowedDevOrigins` ya configurado en `next.config.ts`), jugando una partida de cada uno de los cuatro juegos; confirmar en escritorio que no aparece el gamepad y que teclado/mouse funcionan igual que antes.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores nuevos.
- [ ] `GameRegistryEntry.touchControls` es obligatorio: quitarlo de una entrada provoca error de tipos.
- [ ] Ningún archivo `app/game/*/engine.ts` ni `app/game/*/*Canvas.tsx` fue modificado (`git diff` vacío en ellos).
- [ ] En escritorio (puntero fino) el gamepad no se renderiza y el layout de `/game/<id>/play` es idéntico al actual.
- [ ] En dispositivo táctil el gamepad aparece en `/game/<id>/play` para los cuatro juegos, mostrando solo los botones declarados en su `touchControls`.
- [ ] **asteroides:** `←`/`→` rotan mientras se mantienen, `↑` propulsa mientras se mantiene, `DISPARO` dispara una bala por toque; se puede rotar + propulsar + disparar a la vez con varios dedos.
- [ ] **tetris:** `↑` rota una vez por toque, `←`/`→`/`↓` mueven una celda por toque y auto-repiten al mantener, `CAÍDA` hace caída dura.
- [ ] **arkanoid:** `←`/`→` mueven la paleta mientras se mantienen y se detiene al soltar.
- [ ] **snake:** las cuatro flechas cambian la dirección; la reversión de 180° sigue ignorándose.
- [ ] Soltar el dedo, deslizarlo fuera del botón o un `pointercancel` detiene la acción (sin teclas pegadas).
- [ ] Tocar el canvas o el gamepad no desplaza la página, no hace zoom, no selecciona texto ni abre el menú de mantener pulsado.
- [ ] En vertical: HUD, canvas completo y gamepad visibles sin scroll horizontal en un viewport de 360×740.
- [ ] En horizontal: cruceta a la izquierda y `A`/`B` a la derecha del canvas, con HUD + canvas visibles sin scroll vertical en un viewport de 740×360.
- [ ] Girar el teléfono a mitad de partida reacomoda el layout sin pausar ni reiniciar la partida.
- [ ] Ocultar la pestaña (cambiar de app) durante una partida activa la PAUSA; al volver sigue en pausa hasta pulsar REANUDAR.
- [ ] Con la partida en PAUSA o en el modal de fin, pulsar el gamepad no emite eventos.
- [ ] En el modal de fin, el input de iniciales y GUARDAR PUNTUACIÓN funcionan con el teclado del teléfono (la puntuación se guarda en Supabase como antes).
- [ ] El selector de skin del HUD sigue funcionando en táctil.
- [ ] `CLAUDE.md` menciona `touchControls` como campo de cada entrada del registro.
- [ ] Ningún archivo bajo `references/` fue modificado.

## Decisiones tomadas y descartadas

- **Sí:** gamepad virtual genérico (cruceta + `A`/`B`) para todos los juegos. Decisión explícita del usuario — uniforme y simple de extender.
- **No:** esquema híbrido por juego (arrastre en arkanoid, swipe en snake, etc.). Mejor ergonomía por juego, pero descartado por el usuario a favor de un único control.
- **No:** controles solo por gestos sobre el canvas. Descartado: asteroides necesita varias acciones simultáneas.
- **Sí:** los cuatro juegos actuales + campo `touchControls` obligatorio en el registro, para que todo juego futuro nazca jugable en móvil. Decisión explícita del usuario.
- **Sí:** eventos `KeyboardEvent` sintéticos despachados en `document` (con `key` y `code`). Decisión explícita del usuario — cero cambios en los motores.
- **No:** nueva API `press`/`release` en `GameEngineHandle`. Más explícita, pero obliga a tocar los cuatro motores y el contrato.
- **Sí:** botones del pad declarados por juego; los no declarados no se renderizan. Decisión explícita del usuario (evita botones inertes, p.ej. `↑`/`↓` en arkanoid).
- **Sí:** mapeo de tetris con rotación en `↑` de la cruceta y `A` = caída dura, sin botón `B`. Decisión explícita del usuario (sobre la alternativa `A` = rotar, `B` = caída).
- **Sí:** auto-repetición opcional por botón (`repeat`), usada solo en tetris `←`/`→`/`↓`. Decisión explícita del usuario — los eventos sintéticos no heredan el auto-repeat del teclado físico. `REPEAT_DELAY_MS`/`REPEAT_INTERVAL_MS` son valores de partida ajustables en implementación.
- **Sí:** multitouch con Pointer Events y `pointerId` por botón. Decisión explícita del usuario.
- **Sí:** detección automática por `(pointer: coarse)`, sin UI extra. Decisión explícita del usuario.
- **No:** detección por ancho de pantalla, ni toggle manual en el HUD. Descartados por el usuario.
- **Sí:** soporte de vertical y horizontal sin bloquear la rotación. Decisión explícita del usuario.
- **Sí:** HUD compacto y bloqueo de scroll/zoom/selección solo en la zona de juego. Decisiones explícitas del usuario; el resto de la página conserva el zoom por accesibilidad.
- **No:** pantalla completa y vibración háptica. No seleccionadas por el usuario; quedan para una spec futura.
- **Sí:** pausa automática al ocultar la pestaña; rotar no pausa. Decisión explícita del usuario. La reanudación es siempre manual.
- **Sí:** estilos táctiles bajo `@media (pointer: coarse)` en vez de por ancho: una laptop con ventana angosta no cambia de layout. Derivado de la decisión de detección.
- **Sí (excepción aprobada durante la implementación):** cambio mínimo en `app/game/tetris/TetrisCanvas.tsx` — un `ResizeObserver` escala el bloque tablero + panel (maquetado a 300×600 + 120 px fijos) para que quepa en pantallas chicas; nunca agranda (`scale ≤ 1`), así escritorio queda igual. Sin él el tablero salía recortado en móvil. El criterio "ningún `*Canvas.tsx` modificado" aplica a los otros tres juegos.
- **Sí (excepción aprobada durante la implementación):** nav compacto solo en el reproductor táctil (`.av-nav:has(~ .av-main .av-player)` en `globals.css`), porque el nav global desbordaba a 360 px e impedía cumplir "sin scroll horizontal". Las demás páginas no cambian.

## Riesgos identificados

| Riesgo                                                                                                                                           | Mitigación                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un motor futuro que lea `e.which`/`e.keyCode` (deprecados) o compruebe `e.isTrusted` ignoraría los eventos sintéticos.                           | Los cuatro motores actuales usan solo `e.key`/`e.code` (verificado). `CLAUDE.md` documenta que los motores deben leer `key`/`code`; el recorrido de verificación de cada juego nuevo incluye el gamepad. |
| Teclas "pegadas" si se pierde el `pointerup` (notificación del sistema, cambio de app, desmontaje), p.ej. la nave de asteroides girando sin fin. | `setPointerCapture` + manejo de `pointercancel`/`lostpointercapture`; liberación de todos los botones al desmontar, al pasar a `disabled` y en `visibilitychange`.                                       |
| En horizontal, la altura útil de un teléfono (~360px) menos la barra del navegador no alcanza para HUD + canvas 4:3 legible.                     | HUD compacto, `.crt-bottom` oculto y altura del canvas basada en `dvh`; criterio de aceptación explícito en 740×360.                                                                                     |
| Tetris (`crt-screen--narrow`) tiene otra proporción y puede desbalancear el layout de dos columnas del pad en horizontal.                        | Verificación explícita de tetris en ambas orientaciones; el contenedor del pad no asume la proporción 4:3.                                                                                               |
| El doble toque rápido sobre los botones puede disparar zoom en iOS Safari a pesar de `touch-action`.                                             | `touch-action: none` sobre el gamepad y el canvas, más `preventDefault` en `pointerdown`; verificar en teléfono real.                                                                                    |
| La spec de `invasores` en `specs/game-jam/04-invasores/` se escribió antes de este contrato y no declara `touchControls`.                        | Al implementarla, el compilador exigirá el campo; se añade en esa implementación (flechas + `A` = `Space`). Esta spec no modifica esa carpeta.                                                           |

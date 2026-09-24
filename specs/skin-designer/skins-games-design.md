# Skins de juegos — estado

Mantenido por el agente `skin-designer`. Skins obligatorias por juego: `clasico` (default),
`neon`, `retro`. Selector en el HUD del reproductor (`app/game/[id]/play/page.tsx`), persistido en
`localStorage["av_skin_<game-id>"]`.

## Infraestructura

| Pieza                           | Estado         | Fecha      |
| ------------------------------- | -------------- | ---------- |
| `app/game/skins.ts`             | ✔ implementado | 2026-09-23 |
| `skin`/`skins` en `registry.ts` | ✔ implementado | 2026-09-23 |
| Selector `.hud-skin` en el HUD  | ✔ implementado | 2026-09-23 |

## Estado por juego

| game-id      | clasico | neon | retro | Spritesheet | Estrategia                  | Estado       | Última revisión |
| ------------ | ------- | ---- | ----- | ----------- | --------------------------- | ------------ | --------------- |
| `asteroides` | ✔       | ✔    | ✔     | no          | paleta (vectorial)          | IMPLEMENTADO | 2026-09-23      |
| `tetris`     | ✔       | ✔    | ✔     | no          | paleta + sprites cacheados¹ | IMPLEMENTADO | 2026-09-23      |
| `arkanoid`   | ✔       | ✔    | ✔     | sí          | recoloreo por luminancia²   | IMPLEMENTADO | 2026-09-23      |
| `snake`      | ✔       | ✔    | ✔     | sí          | paleta + fruta recoloreada³ | IMPLEMENTADO | 2026-09-23      |

¹ En `neon` cada tipo de bloque se prerenderiza con glow en un canvas offscreen (una vez por skin).
² Variante de la estrategia (a): cada sprite (bloque por color, 4 frames de explosión, paleta,
bola) se copia a tamaño de destino en un canvas offscreen y cada píxel se remapea según su
luminancia normalizada (conserva el sombreado del pixel art); en `neon` se añade glow precalculado.
Caché por skin, se vacía en `setSkin`.
³ Segmentos geométricos con la paleta (en `neon` prerenderizados con glow); fruta: `neon` sprite
original + glow magenta, `retro` recoloreada a 4 tonos con alfa binario.

Estados: `IMPLEMENTADO`, `OK` (ya estaba completo), `PENDIENTE` (sin revisar/implementar),
`ERROR` (intento fallido, ver historial).

## Detalle por juego

### tetris

- Archivos tocados: `app/game/tetris/engine.ts` (`TetrisPalette`, `TETRIS_PALETTES`,
  `paintBlock`, `paintGhostOutline`, `clearCanvas`, `setSkin`), `app/game/tetris/TetrisCanvas.tsx`
  (prop `skin`, `useEffect` → `setSkin`; además `TetrisCanvasHandle` pasa de interfaz vacía a
  `type` para quitar un error de lint previo), `app/game/registry.ts`
  (`skins: ["clasico", "neon", "retro"]`).
- Auditoría del render original: fondo `clearRect` (tablero y vista previa, deja ver el `#000` de
  `.crt-screen`); rejilla `rgba(255,255,255,0.08)` a 0.5px; 8 colores de pieza (`COLORS`);
  franja de brillo `rgba(255,255,255,0.12)` de 4px; pieza fantasma con `globalAlpha = 0.2`. Sin
  `drawImage`, sin texto en canvas (etiquetas SIGUIENTE/CONTROLES son HTML con tokens CSS y se
  leen bien en las tres skins).
- Paletas (hex principales por skin):
  - `clasico`: fondo `null` (clearRect); piezas I `#4dd0e1`, O `#ffd54f`, T `#ba68c8`,
    S `#81c784`, Z `#e57373`, J `#90caf9`, L `#ffb74d`, N `#9e9e9e`; rejilla y brillo idénticos
    al original; fantasma alpha 0.2.
  - `neon`: fondo `#05030d`; rejilla `rgba(0,245,255,0.07)`; bloques con relleno translúcido
    (~0.22) y trazo de 2px con `shadowBlur = 12` del mismo tono: I `#00f5ff`, O `#f5ff00`,
    T `#c026ff`, S `#00ff88`, Z `#ff006e`, J `#2f7bff`, L `#ff8a00`, N `#d6dcff`; fantasma
    alpha 0.28.
  - `retro`: Game Boy DMG de 4 tonos — `#0f380f`, `#306230`, `#8bac0f`, fondo `#9bbc0f`;
    rejilla de 1px dura `#8bac0f`; bloques con marco de 2px `#0f380f`, relleno y cuadro interior
    que distingue cada pieza; fantasma solo contorno `#306230` (sin transparencias);
    `shadowBlur = 0`, `imageSmoothingEnabled = false`.
- `setSkin` cambia la paleta y vacía la caché de sprites sin tocar el estado; repinta la vista
  previa siempre y el tablero de forma síncrona si el loop está detenido (pausa o game over).
- Decisiones a revisar:
  - Retro con paleta Game Boy (verde claro) en lugar de fósforo sobre negro; las 8 piezas se
    distinguen por combinación relleno/textura, no por color. Decidida por skin-designer — revisar.
  - La pieza fantasma en retro es un contorno en vez de un bloque translúcido (para no salir de
    los 4 tonos). Decidida por skin-designer — revisar.
  - Tuerca (N) en neon usa un blanco azulado `#d6dcff` para conservar la idea de "metal".
    Decidida por skin-designer — revisar.

### asteroides

- Archivos tocados: `app/game/asteroides/engine.ts` (`AsteroidsPalette`, `ASTEROIDS_PALETTES`,
  `applyGlow`, `draw(ctx, palette)` en `Bullet`/`Asteroid`/`PowerUp`/`Ship`/`Particle`, `setSkin`),
  `app/game/asteroides/AsteroidsCanvas.tsx` (prop `skin`, `useEffect` → `setSkin`),
  `app/game/registry.ts` (`skins`).
- Auditoría del render original (antes de la pasada): fondo `fillRect #000` (engine.ts:508);
  bala `#fff` en arco r=2 (:64); asteroide trazo `#fff` 1.5px `lineJoin round` (:122); power-up
  rombo `#0ff` 2px y texto `3x` `#0ff` `bold 12px monospace` (:166, :171); nave trazo `#fff`
  (:257); propulsor `rgba(255,130,0,0.85)` (:274); partículas `rgba(255,255,255,α)` (:311). Sin
  `drawImage`.
- Paletas:
  - `clasico`: valores originales exactos (sin glow, `lineJoin round`).
  - `neon`: fondo `#05030d`; nave `#00f5ff`; asteroides `#ff006e`; balas `#f5ff00`; power-up y
    texto `#00ff88`; propulsor `#ff8a00`; partículas `rgba(255,0,110,α)`; `shadowBlur = 12` del
    mismo tono en cada entidad.
  - `retro`: monitor vectorial de fósforo verde — fondo `#020d04`, trazos `#33ff66`, balas
    cuadradas y power-up `#b6ffc8`, propulsor `#1f9e3f`; `lineJoin miter`, alfa de partículas
    cuantizado a 2 pasos, sin glow, `imageSmoothingEnabled = false`.
- Decisiones a revisar:
  - Retro en fósforo verde (tetris usa Game Boy y arkanoid ámbar) para variar entre juegos.
    Decidida por skin-designer — revisar.
  - En retro las balas pasan de círculo a cuadrado 4×4 (misma posición y radio de colisión).
    Decidida por skin-designer — revisar.

### arkanoid

- Archivos tocados: `app/game/arkanoid/engine.ts` (`ArkanoidPalette`, `ARKANOID_PALETTES`,
  `drawSkinned`, caché `spriteCache`, `setSkin`), `app/game/arkanoid/spritesheet.ts`
  (`getSpritesheet()`), `app/game/arkanoid/ArkanoidCanvas.tsx` (prop `skin`, `useEffect` →
  `setSkin`; `ArkanoidCanvasHandle` pasa a `type` por el lint de interfaz vacía),
  `app/game/skins.ts` (utilidades compartidas `hexToRgb`, `rampMapper`, `tintMapper`,
  `recolorSprite`, `withGlow`), `app/game/registry.ts`.
- Auditoría: fondo `fillRect #000`; todo lo demás es `drawImage` del spritesheet
  (`/games/arkanoid/spritesheet-breakout.png`): bloques 7 colores (red, yellow, cyan, magenta,
  hotpink, green, gray), 4 frames de explosión por color, paleta y bola. Sin texto en canvas.
- Paletas:
  - `clasico`: spritesheet sin tocar sobre `#000` (mismas llamadas `drawSprite`/`drawFrame`).
  - `neon`: fondo `#05030d`; bloques teñidos red `#ff2b4e`, yellow `#f5ff00`, cyan `#00f5ff`,
    magenta `#c026ff`, hotpink `#ff006e`, green `#00ff88`, gray `#d6dcff`; paleta `#00f5ff`;
    bola `#f5ff00`; glow `shadowBlur = 8` del tono de cada sprite (precalculado).
  - `retro`: fósforo ámbar — fondo `#140a00`, 4 tonos `#5a3400`, `#a86200`, `#f09a00`,
    `#ffd27a` para todos los sprites; alfa binario, sin glow, sin suavizado.
- Decisiones a revisar:
  - En retro todos los bloques comparten la rampa ámbar (las filas se distinguen por el
    sombreado, no por color); la mecánica no depende del color. Decidida por skin-designer —
    revisar.
  - Recoloreo por luminancia (`getImageData`) en lugar de `source-atop`, para no perder el
    sombreado del pixel art. Decidida por skin-designer — revisar.

### snake

- Archivos tocados: `app/game/snake/engine.ts` (`SnakePalette`, `SNAKE_PALETTES`,
  `glowSegment`, `skinnedFruit`, caché `spriteCache`, `setSkin`), `app/game/snake/spritesheet.ts`
  (`getSpritesheet()`), `app/game/snake/SnakeCanvas.tsx` (prop `skin`, `useEffect` → `setSkin`;
  `SnakeCanvasHandle` pasa a `type`), `app/game/registry.ts`.
- Auditoría: fondo `fillRect #000`; cabeza `#81c784`, cuerpo `#4caf50` (celdas de 18px con 1px de
  margen); fruta con `drawImage` desde `/games/snake/fruits.png` (6 frutas, 20×20).
- Paletas:
  - `clasico`: valores originales exactos.
  - `neon`: fondo `#05030d`; cabeza `#00f5ff`; cuerpo `#00ff88`; segmentos con `shadowBlur = 10`
    prerenderizados; fruta con su sprite original y glow `#ff006e`.
  - `retro`: Game Boy DMG — fondo `#9bbc0f`, cabeza `#0f380f`, cuerpo `#306230` con cuadro
    interior `#8bac0f`; fruta recoloreada a `#0f380f`/`#306230`/`#8bac0f` con alfa binario.
- Decisiones a revisar:
  - En neon la fruta conserva sus colores originales (ya saturados) y solo gana glow magenta.
    Decidida por skin-designer — revisar.
  - Retro reutiliza la paleta Game Boy de tetris. Decidida por skin-designer — revisar.

## Historial

- 2026-09-23 — entrada: `tetris` — resultado: infraestructura común creada (skins.ts, registro,
  selector `.hud-skin`) y tetris con `clasico`/`neon`/`retro` IMPLEMENTADO; `npm run build` OK.
- 2026-09-23 — entrada: `arkanoid, asteroides, snake` — resultado: los tres juegos con
  `clasico`/`neon`/`retro` IMPLEMENTADO (utilidades de recoloreo de sprites añadidas a
  `skins.ts`); `tsc --noEmit`, `eslint` y `npm run build` OK.

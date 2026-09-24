"use client";

// ===== useIsTouchDevice.ts — detecta puntero táctil (dedo) =====
// Usa `(pointer: coarse)` en vez del ancho de pantalla: una laptop con la
// ventana angosta no debe mostrar el gamepad virtual.

import { useEffect, useState } from "react";

const QUERY = "(pointer: coarse)";

// false en SSR y hasta hidratar, para que el HTML del servidor coincida.
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const sync = () => setIsTouch(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return isTouch;
}

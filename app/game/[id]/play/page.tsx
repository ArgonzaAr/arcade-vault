"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import Link from "next/link";
import { GAMES } from "@/app/lib/data";
import { insertScore } from "@/app/lib/supabase/queries.client";
import {
  gameRegistry,
  type GameEngineHandle,
  type GameStats,
} from "@/app/game/registry";
import {
  DEFAULT_SKIN,
  SKIN_LABELS,
  isSkinId,
  type SkinId,
} from "@/app/game/skins";

interface StoredUser {
  name: string;
}

export default function GamePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  const entry = gameRegistry[game.id];
  const hasEngine = Boolean(entry);
  const engineRef = useRef<GameEngineHandle>(null);

  const [user, setUser] = useState<StoredUser | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);
  const skinKey = "av_skin_" + game.id;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("av_user");
      const stored: StoredUser | null = raw ? JSON.parse(raw) : null;
      setUser(stored);
      if (stored) setName(stored.name);
    } catch {}
  }, []);

  // Skin recordada por juego; solo se aplica si este juego la ofrece.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(skinKey);
      if (isSkinId(raw) && entry?.skins.includes(raw)) {
        // Sincroniza con localStorage tras hidratar (no disponible en SSR).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSkin(raw);
      }
    } catch {}
  }, [skinKey, entry]);

  // Solo cambia el aspecto: no pausa, no reinicia ni toca score/over.
  const changeSkin = (nextSkin: SkinId) => {
    setSkin(nextSkin);
    try {
      localStorage.setItem(skinKey, nextSkin);
    } catch {}
  };

  useEffect(() => {
    if (hasEngine || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220
    );
    return () => clearInterval(t);
  }, [hasEngine, over, paused]);

  useEffect(() => {
    if (hasEngine) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [hasEngine, score]);

  const handleStats = useCallback((stats: GameStats) => {
    setScore(stats.score);
    setLives(stats.lives);
    setLevel(stats.level);
  }, []);

  const handleGameOver = useCallback(() => {
    setOver(true);
  }, []);

  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      if (hasEngine) {
        if (next) engineRef.current?.pause();
        else engineRef.current?.resume();
      }
      return next;
    });
  };

  const endGame = () => {
    if (hasEngine) {
      engineRef.current?.forceGameOver();
    } else {
      setOver(true);
    }
  };

  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    if (hasEngine) engineRef.current?.restart();
  };

  const saveScore = async () => {
    if (entry?.hasRealLeaderboard) {
      await insertScore(game.id, name, score);
      setSaved(true);
      return;
    }
    try {
      const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
      all.push({ game: game.id, score, name, at: Date.now() });
      localStorage.setItem("av_scores", JSON.stringify(all));
    } catch {}
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">{entry?.secondaryStatLabel ?? "Vidas"}</div>
            <div className="v">
              {entry
                ? entry.formatSecondaryStat(lives)
                : "♥ ".repeat(lives).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {entry && entry.skins.length > 1 && (
            <div className="hud-skin" role="group" aria-label="Skin">
              <div className="l">Skin</div>
              <div className="hud-skin-opts">
                {entry.skins.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={id === skin ? "active" : undefined}
                    aria-pressed={id === skin}
                    onClick={(e) => {
                      changeSkin(id);
                      // Devuelve el teclado al juego (Espacio/flechas).
                      e.currentTarget.blur();
                    }}
                  >
                    {SKIN_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/game/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div
          className={
            "crt-screen" +
            (entry?.screenClassName ? ` ${entry.screenClassName}` : "")
          }
        >
          {entry ? (
            <entry.Canvas
              ref={engineRef}
              onStats={handleStats}
              onGameOver={handleGameOver}
              skin={skin}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={saveScore}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

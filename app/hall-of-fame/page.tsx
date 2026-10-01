"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES, seededScores, type ScoreRow } from "@/app/lib/data";
import {
  getPlayerBest,
  getTopScores,
  type PlayerBest,
} from "@/app/lib/supabase/queries.client";
import { gameRegistry } from "@/app/game/registry";
import { useAuth } from "@/app/lib/auth/AuthProvider";

// Mejor marca cargada junto con el juego y el usuario a los que pertenece,
// para no mostrar la de otra pestaña o sesión mientras llega la nueva.
interface LoadedBest {
  key: string;
  best: PlayerBest | null;
}

export default function HallOfFamePage() {
  const router = useRouter();
  const [tab, setTab] = useState(GAMES[0].id);
  const { profile } = useAuth();
  const [realRows, setRealRows] = useState<ScoreRow[]>([]);
  const [loadedBest, setLoadedBest] = useState<LoadedBest | null>(null);

  const userId = profile?.id ?? null;
  const bestKey = userId ? `${tab}:${userId}` : null;

  useEffect(() => {
    if (!userId || !gameRegistry[tab]?.hasRealLeaderboard) return;
    let cancelled = false;
    getPlayerBest(tab, userId).then((best) => {
      if (!cancelled) setLoadedBest({ key: `${tab}:${userId}`, best });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, userId]);

  useEffect(() => {
    if (!gameRegistry[tab]?.hasRealLeaderboard) return;
    let cancelled = false;
    getTopScores(tab, 12).then((real) => {
      if (!cancelled) setRealRows(real);
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const seeded = useMemo(() => seededScores(tab.length * 23 + 7, 12), [tab]);
  const rows = gameRegistry[tab]?.hasRealLeaderboard ? realRows : seeded;
  const game = GAMES.find((g) => g.id === tab)!;
  // Solo con sesión y si getPlayerBest devolvió datos para este juego.
  const you = bestKey && loadedBest?.key === bestKey ? loadedBest.best : null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{rows[1]?.name ?? "—"}</div>
          <div className="score">
            {rows[1]?.score.toLocaleString("es-ES") ?? "—"}
          </div>
          <div className="date">{rows[1]?.date ?? "—"}</div>
        </div>
        <div className="podium-slot gold">
          <div
            className="pixel"
            style={{
              fontSize: 9,
              color: "var(--gold)",
              letterSpacing: "0.18em",
            }}
          >
            CAMPEÓN
          </div>
          <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
            01
          </div>
          <div className="name">{rows[0]?.name ?? "—"}</div>
          <div className="score" style={{ fontSize: 20 }}>
            {rows[0]?.score.toLocaleString("es-ES") ?? "—"}
          </div>
          <div className="date">{rows[0]?.date ?? "—"}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{rows[2]?.name ?? "—"}</div>
          <div className="score">
            {rows[2]?.score.toLocaleString("es-ES") ?? "—"}
          </div>
          <div className="date">{rows[2]?.date ?? "—"}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.name + i}
            className={
              "tr" +
              (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
            }
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {profile && you && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div
              className="tr you"
              style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(you.rank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {profile.username.toUpperCase()}
              </div>
              <div
                className="sc"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                {you.score.toLocaleString("es-ES")}
              </div>
              <div className="dt">{you.date}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button className="btn lg" onClick={() => router.push("/")}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}

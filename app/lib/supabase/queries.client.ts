import { createClient as createBrowserSupabaseClient } from "@/app/lib/supabase/client";
import type { ScoreRow } from "@/app/lib/data";

export async function getTopScores(
  slug: string,
  limit: number
): Promise<ScoreRow[]> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("scores")
      .select("player_name, score, created_at, games!inner(slug)")
      .eq("games.slug", slug)
      .order("score", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row, i) => ({
      rank: i + 1,
      name: row.player_name,
      score: row.score,
      date: new Date(row.created_at).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    }));
  } catch {
    return [];
  }
}

export interface PlayerBest {
  rank: number; // 1 + nº de filas del juego con score mayor
  score: number;
  date: string; // dd/mm/aaaa, es-ES
}

// Mejor marca del usuario en un juego y su posición contando filas (no
// jugadores), igual que la tabla del Salón. null si no tiene partidas.
export async function getPlayerBest(
  slug: string,
  userId: string
): Promise<PlayerBest | null> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (gameError || !game) return null;

    const { data: best, error: bestError } = await supabase
      .from("scores")
      .select("score, created_at")
      .eq("game_id", game.id)
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (bestError || !best) return null;

    const { count, error: countError } = await supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id)
      .gt("score", best.score);

    if (countError || count === null) return null;

    return {
      rank: count + 1,
      score: best.score,
      date: new Date(best.created_at).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    };
  } catch {
    return null;
  }
}

// Con sesión se envía user_id y el trigger scores_before_insert fija
// player_name = upper(username); sin sesión, la BD rechaza usernames registrados.
export async function insertScore(
  slug: string,
  playerName: string,
  score: number,
  userId: string | null
): Promise<{ ok: boolean; reason?: "name_reserved" }> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (gameError || !game) return { ok: false };

    const { error: insertError } = await supabase.from("scores").insert({
      game_id: game.id,
      player_name: playerName,
      score,
      user_id: userId,
    });

    if (insertError) {
      if (insertError.message.includes("player_name_reserved")) {
        return { ok: false, reason: "name_reserved" };
      }
      return { ok: false };
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

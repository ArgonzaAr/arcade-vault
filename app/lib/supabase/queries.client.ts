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

export async function insertScore(
  slug: string,
  playerName: string,
  score: number
): Promise<{ ok: boolean }> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (gameError || !game) return { ok: false };

    const { error: insertError } = await supabase
      .from("scores")
      .insert({ game_id: game.id, player_name: playerName, score });

    if (insertError) return { ok: false };

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

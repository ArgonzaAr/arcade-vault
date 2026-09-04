import { createClient as createServerSupabaseClient } from "@/app/lib/supabase/server";
import { GAMES, type Game } from "@/app/lib/data";

interface GameRow {
  slug: string;
  title: string;
  short: string;
  long: string;
  cat: Game["cat"];
  cover: string;
  color: Game["color"];
  best: number;
  plays: string;
}

function toGame(row: GameRow): Game {
  return {
    id: row.slug,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat,
    cover: row.cover,
    color: row.color,
    best: row.best,
    plays: row.plays,
  };
}

export async function getGames(): Promise<Game[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("games")
      .select("slug, title, short, long, cat, cover, color, best, plays")
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) return GAMES;

    return (data as GameRow[]).map(toGame);
  } catch {
    return GAMES;
  }
}

export async function getGameBySlug(slug: string): Promise<Game | undefined> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("games")
      .select("slug, title, short, long, cat, cover, color, best, plays")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return GAMES.find((g) => g.id === slug);

    return toGame(data as GameRow);
  } catch {
    return GAMES.find((g) => g.id === slug);
  }
}

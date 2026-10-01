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

export interface RecentScore {
  player: string; // player_name
  game: string; // games.title
  color: Game["color"]; // games.color, para el color del ticker
  score: number;
  ago: string; // «ahora», «hace 5 min», «hace 2 h», «hace 3 d»
}

interface RecentScoreRow {
  player_name: string;
  score: number;
  created_at: string;
  games: { title: string; color: Game["color"] };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Tiempo relativo calculado en el servidor al pedir la página.
function formatAgo(createdAt: string, now: number): string {
  const diff = Math.max(0, now - new Date(createdAt).getTime());
  if (diff < MINUTE_MS) return "ahora";
  if (diff < HOUR_MS) return `hace ${Math.floor(diff / MINUTE_MS)} min`;
  if (diff < DAY_MS) return `hace ${Math.floor(diff / HOUR_MS)} h`;
  return `hace ${Math.floor(diff / DAY_MS)} d`;
}

export async function getRecentScores(limit: number): Promise<RecentScore[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("scores")
      .select("player_name, score, created_at, games!inner(title, color)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    const now = Date.now();
    return (data as unknown as RecentScoreRow[]).map((row) => ({
      player: row.player_name,
      game: row.games.title,
      color: row.games.color,
      score: row.score,
      ago: formatAgo(row.created_at, now),
    }));
  } catch {
    return [];
  }
}

export interface TodayTopScore {
  rank: number;
  player: string;
  score: number;
}

// Mejores puntuaciones individuales con created_at >= now() - 24 h, de cualquier juego.
export async function getTodayTopScores(
  limit: number
): Promise<TodayTopScore[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { data, error } = await supabase
      .from("scores")
      .select("player_name, score")
      .gte("created_at", since)
      .order("score", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row, i) => ({
      rank: i + 1,
      player: row.player_name,
      score: row.score,
    }));
  } catch {
    return [];
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

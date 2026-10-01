import HomeView from "@/app/components/HomeView";
import {
  getGames,
  getRecentScores,
  getTodayTopScores,
} from "@/app/lib/supabase/queries";

export default async function Home() {
  const [games, recent, top] = await Promise.all([
    getGames(),
    getRecentScores(7),
    getTodayTopScores(5),
  ]);

  return <HomeView games={games} recent={recent} top={top} />;
}

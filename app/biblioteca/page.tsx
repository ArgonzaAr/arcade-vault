import BibliotecaGrid from "@/app/components/BibliotecaGrid";
import { getGames } from "@/app/lib/supabase/queries";

export default async function Biblioteca() {
  const games = await getGames();

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <BibliotecaGrid games={games} />
    </div>
  );
}

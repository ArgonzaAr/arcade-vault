// ===== data.ts — datos mock compartidos (portado de references/templates/data.jsx) =====

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "PUZZLE" | "SHOOTER" | "ARCADE";
  cover: string; // clase CSS cover-*
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const GAMES: Game[] = [
  {
    id: "asteroides",
    title: "ASTEROIDES",
    short: "Pulveriza asteroides en gravedad cero.",
    long: "Nave triangular a la deriva en un campo de asteroides toroidal. Rota, propulsa y dispara para partir rocas grandes en fragmentos cada vez más pequeños. Un power-up cian ocasional entrega disparo triple por unos segundos.",
    cat: "SHOOTER",
    cover: "cover-asteroides",
    color: "cyan",
    best: 0,
    plays: "0",
  },
  {
    id: "tetris",
    title: "TETRIS",
    short: "Encaja piezas antes de que el tablero se desborde.",
    long: "Ocho tipos de pieza caen por un tablero de 10x20. Rótalas con wall kicks, usa la pieza fantasma para apuntar y limpia líneas para subir de nivel. La velocidad de caída aumenta cada 10 líneas.",
    cat: "PUZZLE",
    cover: "cover-tetris",
    color: "cyan",
    best: 0,
    plays: "0",
  },
  {
    id: "arkanoid",
    title: "ARKANOID",
    short: "Rebota, rompe bloques y limpia 5 niveles.",
    long: "Controla una paleta con teclado o mouse y rebota una pelota para pulverizar cinco tableros de bloques cromáticos cada vez más veloces. Tres vidas, cero piedad.",
    cat: "ARCADE",
    cover: "cover-arkanoid",
    color: "magenta",
    best: 0,
    plays: "0",
  },
  {
    id: "snake",
    title: "SNAKE",
    short: "Come, crece y no te muerdas la cola.",
    long: "Víbora clásica sobre un tablero toroidal: atraviesa los bordes sin penalidad, come frutas para crecer y ganar puntos, y evita chocar contra tu propio cuerpo mientras la velocidad aumenta con cada fruta.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    best: 0,
    plays: "0",
  },
];

export const CATS: string[] = ["TODOS", "PUZZLE", "SHOOTER", "ARCADE"];

export const PLAYERS: string[] = [
  "PX_KAI",
  "NEONFOX",
  "Z3R0COOL",
  "M00NRYU",
  "VAULT_07",
  "GLITCHA",
  "ATARI_KID",
  "CYBER_LU",
  "MAGENTA88",
  "SCANLINE",
  "BIT_LORD",
  "ARKADYA",
  "DROID_X",
  "RGB_QUEEN",
  "PIXEL_DAD",
  "RETROVIRA",
  "VECTORX",
  "JOY_STK",
];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export function seededScores(seed: number, count: number = 12): ScoreRow[] {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const used = new Set<string>();
  const rows: ScoreRow[] = [];
  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      name = PLAYERS[Math.floor(rand() * PLAYERS.length)];
    } while (used.has(name) && used.size < PLAYERS.length);
    used.add(name);
    const base = Math.floor(50000 + rand() * 250000);
    const score = base - i * Math.floor(2000 + rand() * 4000);
    const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
    const mon = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
    rows.push({
      rank: i + 1,
      name,
      score: Math.max(score, 1000),
      date: `${day}/${mon}/2026`,
    });
  }
  return rows
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

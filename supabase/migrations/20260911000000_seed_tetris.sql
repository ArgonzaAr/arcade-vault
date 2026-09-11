-- Siembra la fila del catálogo para el juego Tetris (motor real, SPEC 07).

insert into public.games (slug, title, short, long, cat, cover, color, best, plays) values
  ('tetris', 'TETRIS', 'Encaja piezas antes de que el tablero se desborde.', 'Ocho tipos de pieza caen por un tablero de 10x20. Rótalas con wall kicks, usa la pieza fantasma para apuntar y limpia líneas para subir de nivel. La velocidad de caída aumenta cada 10 líneas.', 'PUZZLE', 'cover-tetris', 'cyan', 0, '0');

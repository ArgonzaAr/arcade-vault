-- Siembra la fila del catálogo para el juego Snake (motor real, SPEC 09).

insert into public.games (slug, title, short, long, cat, cover, color, best, plays) values
  ('snake', 'SNAKE', 'Come, crece y no te muerdas la cola.', 'Víbora clásica sobre un tablero toroidal: atraviesa los bordes sin penalidad, come frutas para crecer y ganar puntos, y evita chocar contra tu propio cuerpo mientras la velocidad aumenta con cada fruta.', 'ARCADE', 'cover-snake', 'green', 0, '0');

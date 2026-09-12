-- Siembra la fila del catálogo para el juego Arkanoid (motor real, SPEC 08).

insert into public.games (slug, title, short, long, cat, cover, color, best, plays) values
  ('arkanoid', 'ARKANOID', 'Rebota, rompe bloques y limpia 5 niveles.', 'Controla una paleta con teclado o mouse y rebota una pelota para pulverizar cinco tableros de bloques cromáticos cada vez más veloces. Tres vidas, cero piedad.', 'ARCADE', 'cover-arkanoid', 'magenta', 0, '0');

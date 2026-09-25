-- Siembra la fila del catálogo para el juego Frogger (motor real, specs/game-jam/frogger/01-frogger-core.md).

insert into public.games (slug, title, short, long, cat, cover, color, best, plays) values
  ('frogger', 'FROGGER', 'Cruza la carretera y el río sin convertirte en papilla.', 'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.', 'ARCADE', 'cover-frogger', 'green', 0, '0');

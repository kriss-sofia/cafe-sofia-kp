INSERT INTO products (
  name,
  slug,
  description,
  category,
  price,
  stock,
  stock_minimum,
  image_url,
  is_active
) VALUES
('Espresso', 'espresso', 'Corto, intenso y directo. Ideal para una decisión rápida.', 'espresso', 800, 40, 10, '', TRUE),
('Latte', 'latte', 'Suave, cremoso y equilibrado con espuma sedosa.', 'latte', 1500, 25, 8, '', TRUE),
('Capuccino', 'capuccino', 'Clásico con espuma y un toque de canela.', 'capuccino', 2000, 20, 6, '', TRUE),
('Muffin de banano', 'muffin-banano', 'Snack dulce y compacto para acompañar el café.', 'snack', 1200, 15, 5, '', TRUE);

SELECT 'seed_loaded';

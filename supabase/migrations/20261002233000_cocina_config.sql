-- Cocina opcional: panadería puede no mandar pedidos; restaurante sí, y puede imprimir comanda.
-- Los productos marcan si ese ítem debe prepararse (pasa_cocina).

ALTER TABLE panaderias
  ADD COLUMN IF NOT EXISTS cocina_habilitada BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cocina_imprimir BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS pasa_cocina BOOLEAN NOT NULL DEFAULT true;

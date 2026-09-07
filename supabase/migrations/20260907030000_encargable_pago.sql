-- Encargable + estado de pago en encargos

ALTER TABLE productos ADD COLUMN IF NOT EXISTS encargable BOOLEAN NOT NULL DEFAULT false;

-- Marca tortas como encargables por defecto (heurística)
UPDATE productos p
SET encargable = true
FROM categorias c
WHERE p.categoria_id = c.id
  AND p.encargable = false
  AND (
    c.nombre ILIKE '%torta%'
    OR p.nombre ILIKE '%torta%'
    OR p.nombre ILIKE '%ponqué%'
    OR p.nombre ILIKE '%milky%'
  );

DO $$ BEGIN
  CREATE TYPE encargo_pago AS ENUM ('pendiente', 'abonado', 'pagado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE encargos ADD COLUMN IF NOT EXISTS estado_pago encargo_pago NOT NULL DEFAULT 'pendiente';
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS abono INTEGER NOT NULL DEFAULT 0 CHECK (abono >= 0);
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES productos(id) ON DELETE SET NULL;

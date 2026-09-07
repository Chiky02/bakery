-- Parche idempotente: columnas/funciones que la app ya usa
-- Ejecutar si db:push falló a medias o features no existen

DO $$ BEGIN
  CREATE TYPE producto_tipo AS ENUM ('venta', 'materia_prima');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_barras TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo producto_tipo NOT NULL DEFAULT 'venta';

ALTER TABLE panaderias ADD COLUMN IF NOT EXISTS tiempo_minimo_encargo_horas INT NOT NULL DEFAULT 48;
ALTER TABLE panaderias ADD COLUMN IF NOT EXISTS nombre_publico TEXT;
UPDATE panaderias SET nombre_publico = COALESCE(nombre_publico, nombre) WHERE nombre_publico IS NULL;

ALTER TABLE encargos ADD COLUMN IF NOT EXISTS fecha_envio DATE;
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS fecha_acordada DATE;

ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS nit TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contacto_nombre TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS ciudad TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS dias_entrega TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS condiciones_pago TEXT;

-- Mesas activas / inactivas
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT,
  leida BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notificaciones_select" ON notificaciones;
DROP POLICY IF EXISTS "notificaciones_update" ON notificaciones;
CREATE POLICY "notificaciones_select" ON notificaciones FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (EXISTS (SELECT 1 FROM miembros m WHERE m.panaderia_id = notificaciones.panaderia_id AND m.user_id = auth.uid() AND m.activo)));
CREATE POLICY "notificaciones_update" ON notificaciones FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "productos_public_menu" ON productos;
CREATE POLICY "productos_public_menu" ON productos FOR SELECT TO anon
  USING (disponible = true AND COALESCE(tipo, 'venta'::producto_tipo) = 'venta');

CREATE OR REPLACE FUNCTION public.delete_panaderia_if_empty(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_data BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_rol(p_id, ARRAY['dueno']::user_role[]) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM productos WHERE panaderia_id = p_id LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM mesas WHERE panaderia_id = p_id LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM ventas_mostrador WHERE panaderia_id = p_id LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM encargos WHERE panaderia_id = p_id LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM cuentas_mesa WHERE panaderia_id = p_id LIMIT 1
  ) INTO has_data;
  IF has_data THEN
    RAISE EXCEPTION 'La panadería tiene datos; no se puede borrar';
  END IF;
  DELETE FROM miembros WHERE panaderia_id = p_id;
  UPDATE profiles SET panaderia_activa_id = NULL WHERE panaderia_activa_id = p_id;
  DELETE FROM panaderias WHERE id = p_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_panaderia_if_empty(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_panaderia(
  p_panaderia UUID,
  p_tipo TEXT,
  p_titulo TEXT,
  p_cuerpo TEXT,
  p_roles user_role[] DEFAULT ARRAY['dueno','admin','mostrador','caja','cocina','mesero']::user_role[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notificaciones (panaderia_id, user_id, tipo, titulo, cuerpo)
  SELECT p_panaderia, m.user_id, p_tipo, p_titulo, p_cuerpo
  FROM miembros m
  WHERE m.panaderia_id = p_panaderia AND m.activo AND m.rol = ANY (p_roles);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_panaderia(UUID, TEXT, TEXT, TEXT, user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_panaderia(UUID, TEXT, TEXT, TEXT, user_role[]) TO service_role;

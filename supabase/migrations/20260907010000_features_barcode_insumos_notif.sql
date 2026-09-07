-- Features: barcode, insumos, proveedores ampliados, encargos fechas, notificaciones
-- Idempotente / seguro sobre esquema multitenant

-- Drop old policies that block dropping profiles.rol (si aún existen)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    -- only drop legacy role-on-profiles policies if still present
    IF r.policyname IN (
      'config_all_staff','config_select','config_public_menu',
      'categorias_write','categorias_read','categorias_public_menu',
      'productos_write','productos_read','productos_public_menu',
      'mesas_write','mesas_read','mesas_public_qr',
      'cuentas_write','cuentas_read',
      'subcuentas_write','subcuentas_read',
      'items_write','items_read',
      'ventas_write','ventas_read',
      'encargos_write','encargos_read',
      'profiles_select'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END IF;
  END LOOP;
END $$;

-- Si profiles.rol aún existe, quitarlo ahora que no hay policies
ALTER TABLE profiles DROP COLUMN IF EXISTS rol;

-- Tipo de producto: venta (menú) vs materia_prima (bodega)
DO $$ BEGIN
  CREATE TYPE producto_tipo AS ENUM ('venta', 'materia_prima');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_barras TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo producto_tipo NOT NULL DEFAULT 'venta';

CREATE INDEX IF NOT EXISTS idx_productos_barras ON productos(panaderia_id, codigo_barras);
CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos(panaderia_id, tipo);

-- Panadería: tiempo mínimo encargos (horas)
ALTER TABLE panaderias ADD COLUMN IF NOT EXISTS tiempo_minimo_encargo_horas INT NOT NULL DEFAULT 48;
ALTER TABLE panaderias ADD COLUMN IF NOT EXISTS nombre_publico TEXT;

UPDATE panaderias SET nombre_publico = COALESCE(nombre_publico, nombre);

-- Encargos: fecha envío/entrega
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS fecha_envio DATE;
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS fecha_acordada DATE;

-- Backfill
UPDATE encargos SET fecha_acordada = fecha_entrega WHERE fecha_acordada IS NULL;
UPDATE encargos SET fecha_envio = fecha_entrega WHERE fecha_envio IS NULL;

-- Proveedores ampliados
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS nit TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contacto_nombre TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS ciudad TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS dias_entrega TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS condiciones_pago TEXT;

-- Notificaciones
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

CREATE INDEX IF NOT EXISTS idx_notificaciones_user ON notificaciones(user_id, leida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_panaderia ON notificaciones(panaderia_id, created_at DESC);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificaciones_select" ON notificaciones;
DROP POLICY IF EXISTS "notificaciones_update" ON notificaciones;
CREATE POLICY "notificaciones_select" ON notificaciones FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member(panaderia_id));
CREATE POLICY "notificaciones_update" ON notificaciones FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Productos públicos: solo tipo venta
DROP POLICY IF EXISTS "productos_public_menu" ON productos;
CREATE POLICY "productos_public_menu" ON productos FOR SELECT TO anon
  USING (disponible = true AND tipo = 'venta');

-- Delete empty bakery RPC
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
    SELECT 1 FROM productos WHERE panaderia_id = p_id
    UNION ALL SELECT 1 FROM mesas WHERE panaderia_id = p_id
    UNION ALL SELECT 1 FROM ventas_mostrador WHERE panaderia_id = p_id
    UNION ALL SELECT 1 FROM encargos WHERE panaderia_id = p_id
    UNION ALL SELECT 1 FROM cuentas_mesa WHERE panaderia_id = p_id
  ) INTO has_data;
  IF has_data THEN
    RAISE EXCEPTION 'La panadería tiene datos; no se puede borrar';
  END IF;
  DELETE FROM panaderias WHERE id = p_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_panaderia_if_empty(UUID) TO authenticated;

-- Invite member by email (creates auth user if needed is done in app with service role)
-- Keep helper for notifications insert
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

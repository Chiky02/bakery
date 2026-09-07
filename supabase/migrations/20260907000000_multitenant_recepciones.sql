-- BakeryChiky02 — multitenant + recepción de proveedores
-- Ejecutar en SQL Editor de Supabase (sobre el esquema inicial ya aplicado)

CREATE TYPE recepcion_estado AS ENUM ('borrador', 'pendiente', 'parcial', 'recibida', 'cancelada');

-- ─── Panaderías (tenants) ───────────────────────────────────────────────────

CREATE TABLE panaderias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  moneda TEXT NOT NULL DEFAULT 'COP',
  pedido_directo_habilitado BOOLEAN NOT NULL DEFAULT false,
  requiere_aprobacion_mesero BOOLEAN NOT NULL DEFAULT true,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE miembros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol user_role NOT NULL DEFAULT 'mostrador',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (panaderia_id, user_id)
);

CREATE INDEX idx_miembros_user ON miembros(user_id);
CREATE INDEX idx_miembros_panaderia ON miembros(panaderia_id);

-- Panadería por defecto (migra config_negocio si existe)
INSERT INTO panaderias (id, nombre, slug, moneda, pedido_directo_habilitado, requiere_aprobacion_mesero)
SELECT
  gen_random_uuid(),
  COALESCE((SELECT nombre FROM config_negocio WHERE id = 1), 'BakeryChiky02'),
  'bakerychiky02',
  COALESCE((SELECT moneda FROM config_negocio WHERE id = 1), 'COP'),
  COALESCE((SELECT pedido_directo_habilitado FROM config_negocio WHERE id = 1), false),
  COALESCE((SELECT requiere_aprobacion_mesero FROM config_negocio WHERE id = 1), true);

-- Miembros desde profiles actuales
INSERT INTO miembros (panaderia_id, user_id, rol, activo)
SELECT p.id, pr.id, pr.rol, pr.activo
FROM profiles pr
CROSS JOIN panaderias p
WHERE p.slug = 'bakerychiky02'
ON CONFLICT DO NOTHING;

-- Profiles: quitar rol global, agregar panadería activa
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS panaderia_activa_id UUID REFERENCES panaderias(id) ON DELETE SET NULL;

UPDATE profiles pr
SET panaderia_activa_id = (
  SELECT m.panaderia_id FROM miembros m WHERE m.user_id = pr.id AND m.activo LIMIT 1
);

-- Quitar políticas viejas ANTES de borrar profiles.rol (dependen de esa columna)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','config_negocio','categorias','productos','mesas','cuentas_mesa','sub_cuentas',
        'items_cuenta','ventas_mostrador','encargos'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE profiles DROP COLUMN IF EXISTS rol;

-- ─── Scoped columns ────────────────────────────────────────────────────────

ALTER TABLE categorias ADD COLUMN IF NOT EXISTS panaderia_id UUID REFERENCES panaderias(id) ON DELETE CASCADE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS panaderia_id UUID REFERENCES panaderias(id) ON DELETE CASCADE;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS panaderia_id UUID REFERENCES panaderias(id) ON DELETE CASCADE;
ALTER TABLE cuentas_mesa ADD COLUMN IF NOT EXISTS panaderia_id UUID REFERENCES panaderias(id) ON DELETE CASCADE;
ALTER TABLE ventas_mostrador ADD COLUMN IF NOT EXISTS panaderia_id UUID REFERENCES panaderias(id) ON DELETE CASCADE;
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS panaderia_id UUID REFERENCES panaderias(id) ON DELETE CASCADE;

UPDATE categorias SET panaderia_id = (SELECT id FROM panaderias WHERE slug = 'bakerychiky02') WHERE panaderia_id IS NULL;
UPDATE productos SET panaderia_id = (SELECT id FROM panaderias WHERE slug = 'bakerychiky02') WHERE panaderia_id IS NULL;
UPDATE mesas SET panaderia_id = (SELECT id FROM panaderias WHERE slug = 'bakerychiky02') WHERE panaderia_id IS NULL;
UPDATE cuentas_mesa SET panaderia_id = (SELECT id FROM panaderias WHERE slug = 'bakerychiky02') WHERE panaderia_id IS NULL;
UPDATE ventas_mostrador SET panaderia_id = (SELECT id FROM panaderias WHERE slug = 'bakerychiky02') WHERE panaderia_id IS NULL;
UPDATE encargos SET panaderia_id = (SELECT id FROM panaderias WHERE slug = 'bakerychiky02') WHERE panaderia_id IS NULL;

ALTER TABLE categorias ALTER COLUMN panaderia_id SET NOT NULL;
ALTER TABLE productos ALTER COLUMN panaderia_id SET NOT NULL;
ALTER TABLE mesas ALTER COLUMN panaderia_id SET NOT NULL;
ALTER TABLE cuentas_mesa ALTER COLUMN panaderia_id SET NOT NULL;
ALTER TABLE ventas_mostrador ALTER COLUMN panaderia_id SET NOT NULL;
ALTER TABLE encargos ALTER COLUMN panaderia_id SET NOT NULL;

-- Unicidad por panadería
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nombre_key;
ALTER TABLE categorias ADD CONSTRAINT categorias_panaderia_nombre_key UNIQUE (panaderia_id, nombre);

ALTER TABLE mesas DROP CONSTRAINT IF EXISTS mesas_nombre_key;
ALTER TABLE mesas ADD CONSTRAINT mesas_panaderia_nombre_key UNIQUE (panaderia_id, nombre);

ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_categoria_id_nombre_key;
ALTER TABLE productos ADD CONSTRAINT productos_panaderia_categoria_nombre_key UNIQUE (panaderia_id, categoria_id, nombre);

CREATE INDEX IF NOT EXISTS idx_categorias_panaderia ON categorias(panaderia_id);
CREATE INDEX IF NOT EXISTS idx_productos_panaderia ON productos(panaderia_id);
CREATE INDEX IF NOT EXISTS idx_mesas_panaderia ON mesas(panaderia_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_panaderia ON cuentas_mesa(panaderia_id);
CREATE INDEX IF NOT EXISTS idx_ventas_panaderia ON ventas_mostrador(panaderia_id);
CREATE INDEX IF NOT EXISTS idx_encargos_panaderia ON encargos(panaderia_id);

-- Config ahora vive en panaderias
DROP TABLE IF EXISTS config_negocio CASCADE;

-- ─── Proveedores y recepciones ──────────────────────────────────────────────

CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (panaderia_id, nombre)
);

CREATE TABLE recepciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  numero TEXT,
  estado recepcion_estado NOT NULL DEFAULT 'borrador',
  fecha_pedido DATE,
  fecha_recepcion DATE,
  notas TEXT,
  total_estimado INTEGER NOT NULL DEFAULT 0 CHECK (total_estimado >= 0),
  creado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recibido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recepcion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id UUID NOT NULL REFERENCES recepciones(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  descripcion TEXT NOT NULL,
  cantidad_pedida NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cantidad_pedida >= 0),
  cantidad_recibida NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
  unidad TEXT NOT NULL DEFAULT 'unidad',
  costo_unitario INTEGER NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proveedores_panaderia ON proveedores(panaderia_id);
CREATE INDEX idx_recepciones_panaderia ON recepciones(panaderia_id);
CREATE INDEX idx_recepciones_estado ON recepciones(estado);
CREATE INDEX idx_recepcion_items_recepcion ON recepcion_items(recepcion_id);

-- ─── Helpers RLS ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_member(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM miembros
    WHERE panaderia_id = p_id AND user_id = auth.uid() AND activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_rol(p_id UUID, roles user_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM miembros
    WHERE panaderia_id = p_id
      AND user_id = auth.uid()
      AND activo = true
      AND rol = ANY (roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.my_panaderia_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT panaderia_id FROM miembros WHERE user_id = auth.uid() AND activo = true;
$$;

-- Crear panadería + membresía dueño (evita huevo/gallina de RLS)
CREATE OR REPLACE FUNCTION public.create_panaderia(p_nombre TEXT, p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  INSERT INTO panaderias (nombre, slug, created_by)
  VALUES (p_nombre, p_slug, auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO miembros (panaderia_id, user_id, rol, activo)
  VALUES (new_id, auth.uid(), 'dueno', true);
  UPDATE profiles SET panaderia_activa_id = new_id WHERE id = auth.uid();
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_panaderia(TEXT, TEXT) TO authenticated;

-- Trigger: nuevo usuario → solo profile (sin rol); membership se asigna al crear/invitar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE panaderias ENABLE ROW LEVEL SECURITY;
ALTER TABLE miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_items ENABLE ROW LEVEL SECURITY;

-- Drop old policies (ignore if missing on fresh names)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','categorias','productos','mesas','cuentas_mesa','sub_cuentas',
        'items_cuenta','ventas_mostrador','encargos'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- profiles
CREATE POLICY "profiles_select_auth" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- panaderias
CREATE POLICY "panaderias_select_member" ON panaderias FOR SELECT TO authenticated
  USING (id IN (SELECT public.my_panaderia_ids()));
CREATE POLICY "panaderias_insert_auth" ON panaderias FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "panaderias_update_owner" ON panaderias FOR UPDATE TO authenticated
  USING (public.has_rol(id, ARRAY['dueno','admin']::user_role[]));

-- miembros
CREATE POLICY "miembros_select" ON miembros FOR SELECT TO authenticated
  USING (panaderia_id IN (SELECT public.my_panaderia_ids()) OR user_id = auth.uid());
CREATE POLICY "miembros_write_admin" ON miembros FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin']::user_role[]));

-- categorias / productos / mesas / ventas / encargos / cuentas
CREATE POLICY "categorias_select" ON categorias FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));
CREATE POLICY "categorias_write" ON categorias FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin']::user_role[]));

CREATE POLICY "productos_select" ON productos FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));
CREATE POLICY "productos_write" ON productos FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','mesero']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','mesero']::user_role[]));

CREATE POLICY "mesas_select" ON mesas FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));
CREATE POLICY "mesas_write" ON mesas FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin','mesero','caja']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin','mesero','caja']::user_role[]));

CREATE POLICY "cuentas_select" ON cuentas_mesa FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));
CREATE POLICY "cuentas_write" ON cuentas_mesa FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin','mesero','caja']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin','mesero','caja']::user_role[]));

CREATE POLICY "subcuentas_select" ON sub_cuentas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cuentas_mesa c
      WHERE c.id = cuenta_mesa_id AND public.is_member(c.panaderia_id)
    )
  );
CREATE POLICY "subcuentas_write" ON sub_cuentas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cuentas_mesa c
      WHERE c.id = cuenta_mesa_id
        AND public.has_rol(c.panaderia_id, ARRAY['dueno','admin','mesero','caja']::user_role[])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cuentas_mesa c
      WHERE c.id = cuenta_mesa_id
        AND public.has_rol(c.panaderia_id, ARRAY['dueno','admin','mesero','caja']::user_role[])
    )
  );

CREATE POLICY "items_select" ON items_cuenta FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cuentas_mesa c
      WHERE c.id = cuenta_mesa_id AND public.is_member(c.panaderia_id)
    )
  );
CREATE POLICY "items_write" ON items_cuenta FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cuentas_mesa c
      WHERE c.id = cuenta_mesa_id
        AND public.has_rol(c.panaderia_id, ARRAY['dueno','admin','mesero','cocina','caja']::user_role[])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cuentas_mesa c
      WHERE c.id = cuenta_mesa_id
        AND public.has_rol(c.panaderia_id, ARRAY['dueno','admin','mesero','cocina','caja']::user_role[])
    )
  );

CREATE POLICY "ventas_select" ON ventas_mostrador FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));
CREATE POLICY "ventas_insert" ON ventas_mostrador FOR INSERT TO authenticated
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','caja']::user_role[]));

CREATE POLICY "encargos_select" ON encargos FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));
CREATE POLICY "encargos_write" ON encargos FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','mesero']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','mesero']::user_role[]));

-- proveedores / recepciones
CREATE POLICY "proveedores_select" ON proveedores FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));
CREATE POLICY "proveedores_write" ON proveedores FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','caja']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','caja']::user_role[]));

CREATE POLICY "recepciones_select" ON recepciones FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));
CREATE POLICY "recepciones_write" ON recepciones FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','caja']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin','mostrador','caja']::user_role[]));

CREATE POLICY "recepcion_items_select" ON recepcion_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recepciones r
      WHERE r.id = recepcion_id AND public.is_member(r.panaderia_id)
    )
  );
CREATE POLICY "recepcion_items_write" ON recepcion_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recepciones r
      WHERE r.id = recepcion_id
        AND public.has_rol(r.panaderia_id, ARRAY['dueno','admin','mostrador','caja']::user_role[])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recepciones r
      WHERE r.id = recepcion_id
        AND public.has_rol(r.panaderia_id, ARRAY['dueno','admin','mostrador','caja']::user_role[])
    )
  );

-- Menú QR público (anon) — por mesa → panadería
CREATE POLICY "productos_public_menu" ON productos FOR SELECT TO anon
  USING (disponible = true);
CREATE POLICY "categorias_public_menu" ON categorias FOR SELECT TO anon USING (true);
CREATE POLICY "mesas_public_qr" ON mesas FOR SELECT TO anon USING (true);
CREATE POLICY "panaderias_public_qr" ON panaderias FOR SELECT TO anon USING (true);
CREATE POLICY "cuentas_public_qr_read" ON cuentas_mesa FOR SELECT TO anon USING (true);

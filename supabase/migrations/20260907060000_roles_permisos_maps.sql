-- Google Maps URL por local + roles personalizables con permisos de menú
ALTER TABLE panaderias ADD COLUMN IF NOT EXISTS maps_url TEXT;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  rol_base user_role NOT NULL DEFAULT 'mostrador',
  activo BOOLEAN NOT NULL DEFAULT true,
  es_sistema BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (panaderia_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_roles_panaderia ON roles(panaderia_id);

CREATE TABLE IF NOT EXISTS role_permisos (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso TEXT NOT NULL,
  PRIMARY KEY (role_id, permiso)
);

ALTER TABLE miembros ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_miembros_role ON miembros(role_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated
  USING (panaderia_id IN (SELECT public.my_panaderia_ids()));

DROP POLICY IF EXISTS "roles_write" ON roles;
CREATE POLICY "roles_write" ON roles FOR ALL TO authenticated
  USING (public.has_rol(panaderia_id, ARRAY['dueno','admin']::user_role[]))
  WITH CHECK (public.has_rol(panaderia_id, ARRAY['dueno','admin']::user_role[]));

DROP POLICY IF EXISTS "role_permisos_select" ON role_permisos;
CREATE POLICY "role_permisos_select" ON role_permisos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id AND r.panaderia_id IN (SELECT public.my_panaderia_ids())
    )
  );

DROP POLICY IF EXISTS "role_permisos_write" ON role_permisos;
CREATE POLICY "role_permisos_write" ON role_permisos FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id
        AND public.has_rol(r.panaderia_id, ARRAY['dueno','admin']::user_role[])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id
        AND public.has_rol(r.panaderia_id, ARRAY['dueno','admin']::user_role[])
    )
  );

-- Permisos por defecto según menú actual
CREATE OR REPLACE FUNCTION public.default_permisos_for_rol(p_rol user_role)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_rol
    WHEN 'dueno' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','caja','encargos',
      'recepciones','productos','insumos','reportes','usuarios','negocios','configuracion','panaderias'
    ]
    WHEN 'admin' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','caja','encargos',
      'recepciones','productos','insumos','reportes','usuarios','negocios','configuracion','panaderias'
    ]
    WHEN 'mostrador' THEN ARRAY[
      'mostrador','encargos','recepciones','insumos','configuracion','panaderias'
    ]
    WHEN 'mesero' THEN ARRAY[
      'mesas','encargos','configuracion','panaderias'
    ]
    WHEN 'cocina' THEN ARRAY[
      'cocina','configuracion','panaderias'
    ]
    WHEN 'caja' THEN ARRAY[
      'mostrador','mesas','caja','recepciones','insumos','configuracion','panaderias'
    ]
    ELSE ARRAY['configuracion','panaderias']
  END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_roles(p_panaderia_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role_id UUID;
  perm TEXT;
  defs CONSTANT TEXT[][] := ARRAY[
    ARRAY['dueno', 'Dueño', 'Acceso total al local'],
    ARRAY['admin', 'Administrador', 'Gestión operativa completa'],
    ARRAY['mostrador', 'Mostrador', 'Ventas de mostrador y encargos'],
    ARRAY['mesero', 'Mesero', 'Mesas y encargos'],
    ARRAY['cocina', 'Cocina', 'Cola de cocina'],
    ARRAY['caja', 'Caja', 'Cobros y ventas']
  ];
  i INT;
  v_codigo TEXT;
  v_nombre TEXT;
  v_descripcion TEXT;
  base user_role;
  has_perms BOOLEAN;
BEGIN
  FOR i IN 1..array_length(defs, 1) LOOP
    v_codigo := defs[i][1];
    v_nombre := defs[i][2];
    v_descripcion := defs[i][3];
    base := v_codigo::user_role;

    INSERT INTO roles (panaderia_id, codigo, nombre, descripcion, rol_base, es_sistema, activo)
    VALUES (p_panaderia_id, v_codigo, v_nombre, v_descripcion, base, true, true)
    ON CONFLICT (panaderia_id, codigo) DO NOTHING;

    SELECT r.id INTO new_role_id
    FROM roles r
    WHERE r.panaderia_id = p_panaderia_id AND r.codigo = v_codigo;

    SELECT EXISTS (SELECT 1 FROM role_permisos rp WHERE rp.role_id = new_role_id)
      INTO has_perms;

    IF NOT has_perms THEN
      FOREACH perm IN ARRAY public.default_permisos_for_rol(base) LOOP
        INSERT INTO role_permisos (role_id, permiso)
        VALUES (new_role_id, perm)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  UPDATE miembros m
  SET role_id = r.id
  FROM roles r
  WHERE m.panaderia_id = p_panaderia_id
    AND r.panaderia_id = p_panaderia_id
    AND r.codigo = m.rol::text
    AND m.role_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_default_roles(UUID) TO authenticated;

-- Sembrar roles en panaderías existentes
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT id FROM panaderias LOOP
    PERFORM public.seed_default_roles(p.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_panaderia(p_nombre TEXT, p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  dueno_role_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  INSERT INTO panaderias (nombre, slug, created_by)
  VALUES (p_nombre, p_slug, auth.uid())
  RETURNING id INTO new_id;

  PERFORM public.seed_default_roles(new_id);

  SELECT id INTO dueno_role_id
  FROM roles
  WHERE panaderia_id = new_id AND codigo = 'dueno'
  LIMIT 1;

  INSERT INTO miembros (panaderia_id, user_id, rol, role_id, activo)
  VALUES (new_id, auth.uid(), 'dueno', dueno_role_id, true);

  UPDATE profiles SET panaderia_activa_id = new_id WHERE id = auth.uid();
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_panaderia(TEXT, TEXT) TO authenticated;

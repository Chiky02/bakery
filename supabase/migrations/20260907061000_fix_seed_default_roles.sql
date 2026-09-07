-- Fix: variables ambiguas en seed_default_roles (codigo/nombre/descripcion)
-- Ejecutar si la migración 20260907060000 falló a mitad o para reemplazar la función.

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

-- Completar siembra si falló el DO anterior
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT id FROM panaderias LOOP
    PERFORM public.seed_default_roles(p.id);
  END LOOP;
END $$;

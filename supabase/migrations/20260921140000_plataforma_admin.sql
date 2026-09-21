-- Admin de plataforma (SaaS) vs roles de tenant (dueño/gerente del local).
-- plataforma_admin vive en profiles y NO depende de miembros/panadería.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plataforma_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.plataforma_admin IS
  'Operador de la plataforma: ve todos los negocios, cuentas Auth y altas. No es rol de un local.';

-- Quitar "negocios" (cross-tenant) de permisos por defecto de dueño/admin de local
CREATE OR REPLACE FUNCTION public.default_permisos_for_rol(p_rol user_role)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_rol
    WHEN 'dueno' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','caja','encargos',
      'recepciones','productos','insumos','inventario','facturas','clientes',
      'reportes','usuarios','configuracion','panaderias'
    ]
    WHEN 'admin' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','caja','encargos',
      'recepciones','productos','insumos','inventario','facturas','clientes',
      'reportes','usuarios','configuracion','panaderias'
    ]
    WHEN 'mostrador' THEN ARRAY[
      'mostrador','encargos','recepciones','insumos','clientes','facturas',
      'configuracion','panaderias'
    ]
    WHEN 'mesero' THEN ARRAY[
      'mesas','encargos','clientes','configuracion','panaderias'
    ]
    WHEN 'cocina' THEN ARRAY[
      'cocina','configuracion','panaderias'
    ]
    WHEN 'caja' THEN ARRAY[
      'mostrador','mesas','caja','recepciones','insumos','inventario','facturas',
      'clientes','configuracion','panaderias'
    ]
    ELSE ARRAY['configuracion','panaderias']
  END;
$$;

-- Limpiar permiso "negocios" de roles de sistema de cada panadería
DELETE FROM role_permisos rp
USING roles r
WHERE rp.role_id = r.id
  AND r.es_sistema = true
  AND rp.permiso = 'negocios';

-- Actualizar descripciones de roles sistema
UPDATE roles
SET descripcion = 'Dueño del local: operación y equipo de su panadería'
WHERE es_sistema = true AND codigo = 'dueno';

UPDATE roles
SET nombre = 'Gerente',
    descripcion = 'Gerente del local: operación del día a día (no es admin de plataforma)'
WHERE es_sistema = true AND codigo = 'admin';

-- Marca el usuario seed de plataforma si ya existe
UPDATE profiles p
SET plataforma_admin = true
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'admin@panaderiasissa.com';

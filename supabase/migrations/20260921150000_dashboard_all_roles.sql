-- Dashboard como hub de inicio para todos los roles de tenant.
-- Impersonación es solo cookie de sesión (sin cambios de esquema).

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
      'dashboard','mostrador','encargos','recepciones','insumos','clientes','facturas',
      'configuracion','panaderias'
    ]
    WHEN 'mesero' THEN ARRAY[
      'dashboard','mesas','encargos','clientes','configuracion','panaderias'
    ]
    WHEN 'cocina' THEN ARRAY[
      'dashboard','cocina','configuracion','panaderias'
    ]
    WHEN 'caja' THEN ARRAY[
      'dashboard','mostrador','mesas','caja','recepciones','insumos','inventario','facturas',
      'clientes','configuracion','panaderias'
    ]
    ELSE ARRAY['dashboard','configuracion','panaderias']
  END;
$$;

-- Asegurar permiso dashboard en roles de sistema existentes
INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, 'dashboard'
FROM roles r
WHERE r.es_sistema = true
  AND NOT EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = r.id AND rp.permiso = 'dashboard'
  );

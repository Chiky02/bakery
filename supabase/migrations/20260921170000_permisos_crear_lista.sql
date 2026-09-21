-- Subpermisos listado / crear (y categorías / proveedores) para roles de tenant.

CREATE OR REPLACE FUNCTION public.default_permisos_for_rol(p_rol user_role)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_rol
    WHEN 'dueno' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','caja','encargos','encargos_crear',
      'recepciones','recepciones_crear','recepciones_proveedores',
      'productos','productos_crear','productos_categorias',
      'insumos','insumos_crear','inventario','facturas','clientes','clientes_crear',
      'reportes','usuarios','configuracion','panaderias'
    ]
    WHEN 'admin' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','caja','encargos','encargos_crear',
      'recepciones','recepciones_crear','recepciones_proveedores',
      'productos','productos_crear','productos_categorias',
      'insumos','insumos_crear','inventario','facturas','clientes','clientes_crear',
      'reportes','usuarios','configuracion','panaderias'
    ]
    WHEN 'mostrador' THEN ARRAY[
      'dashboard','mostrador','encargos','encargos_crear',
      'recepciones','recepciones_crear','recepciones_proveedores',
      'insumos','insumos_crear','clientes','clientes_crear','facturas',
      'configuracion','panaderias'
    ]
    WHEN 'mesero' THEN ARRAY[
      'dashboard','mesas','encargos','encargos_crear','clientes','clientes_crear',
      'configuracion','panaderias'
    ]
    WHEN 'cocina' THEN ARRAY[
      'dashboard','cocina','configuracion','panaderias'
    ]
    WHEN 'caja' THEN ARRAY[
      'dashboard','mostrador','mesas','caja',
      'recepciones','recepciones_crear','recepciones_proveedores',
      'insumos','insumos_crear','inventario','facturas',
      'clientes','clientes_crear','configuracion','panaderias'
    ]
    ELSE ARRAY['dashboard','configuracion','panaderias']
  END;
$$;

-- Propagar subpermisos a roles de sistema que ya tenían el módulo padre
INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, v.permiso
FROM roles r
CROSS JOIN (
  VALUES
    ('clientes', 'clientes_crear'),
    ('productos', 'productos_crear'),
    ('productos', 'productos_categorias'),
    ('encargos', 'encargos_crear'),
    ('insumos', 'insumos_crear'),
    ('recepciones', 'recepciones_crear'),
    ('recepciones', 'recepciones_proveedores')
) AS v(padre, permiso)
WHERE r.es_sistema = true
  AND EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = r.id AND rp.permiso = v.padre
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = r.id AND rp.permiso = v.permiso
  );

-- Roles custom: si tenían el padre, también reciben los hijos (pueden quitarse luego en Usuarios)
INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, v.permiso
FROM roles r
CROSS JOIN (
  VALUES
    ('clientes', 'clientes_crear'),
    ('productos', 'productos_crear'),
    ('productos', 'productos_categorias'),
    ('encargos', 'encargos_crear'),
    ('insumos', 'insumos_crear'),
    ('recepciones', 'recepciones_crear'),
    ('recepciones', 'recepciones_proveedores')
) AS v(padre, permiso)
WHERE r.es_sistema = false
  AND EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = r.id AND rp.permiso = v.padre
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = r.id AND rp.permiso = v.permiso
  );

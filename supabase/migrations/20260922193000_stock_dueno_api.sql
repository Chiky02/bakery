-- Ajuste manual de stock: solo quien tenga inventario_ajustar (por defecto el dueño).
-- Ventas, anulaciones, recepciones y producción siguen moviendo stock con su propio permiso.
-- Un UPDATE directo de productos.stock queda bloqueado: tiene que pasar por ajustar_stock.

CREATE OR REPLACE FUNCTION public.default_permisos_for_rol(p_rol user_role)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_rol
    WHEN 'dueno' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','produccion','produccion_recetas',
      'caja','encargos','encargos_crear',
      'recepciones','recepciones_crear','recepciones_proveedores',
      'productos','productos_crear','productos_categorias',
      'insumos','insumos_crear','inventario','inventario_ajustar','facturas','clientes','clientes_crear',
      'reportes','usuarios','configuracion','panaderias'
    ]
    WHEN 'admin' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','produccion','produccion_recetas',
      'caja','encargos','encargos_crear',
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
      'dashboard','cocina','produccion','produccion_crear','produccion_recetas',
      'configuracion','panaderias'
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

INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, 'inventario_ajustar'
FROM roles r
WHERE r.rol_base = 'dueno'
  AND NOT EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = r.id AND rp.permiso = 'inventario_ajustar'
  );

CREATE OR REPLACE FUNCTION public.ajustar_stock(
  p_producto UUID,
  p_cantidad NUMERIC,
  p_tipo TEXT,
  p_referencia TEXT DEFAULT NULL,
  p_notas TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pan UUID;
  v_stock NUMERIC;
  v_control BOOLEAN;
  v_nombre TEXT;
  v_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT panaderia_id, stock, control_stock, nombre
  INTO v_pan, v_stock, v_control, v_nombre
  FROM productos
  WHERE id = p_producto
  FOR UPDATE;

  IF v_pan IS NULL OR NOT public.is_member(v_pan) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(plataforma_admin, false) INTO v_admin
  FROM profiles WHERE id = auth.uid();

  IF p_tipo IN ('entrada', 'ajuste') THEN
    IF NOT v_admin AND NOT public.usuario_tiene_permiso(v_pan, 'inventario_ajustar') THEN
      RAISE EXCEPTION 'sin permiso para ajustar stock';
    END IF;
  ELSIF p_tipo = 'venta' THEN
    IF p_cantidad >= 0 THEN
      RAISE EXCEPTION 'la venta solo descuenta stock';
    END IF;
    IF NOT v_admin AND NOT (
      public.usuario_tiene_permiso(v_pan, 'mostrador')
      OR public.usuario_tiene_permiso(v_pan, 'mesas')
      OR public.usuario_tiene_permiso(v_pan, 'caja')
    ) THEN
      RAISE EXCEPTION 'sin permiso';
    END IF;
  ELSIF p_tipo = 'anulacion' THEN
    IF p_cantidad <= 0 THEN
      RAISE EXCEPTION 'la anulación solo devuelve stock';
    END IF;
    IF NOT v_admin AND NOT (
      public.usuario_tiene_permiso(v_pan, 'caja')
      OR public.usuario_tiene_permiso(v_pan, 'mostrador')
      OR public.usuario_tiene_permiso(v_pan, 'reportes')
      OR public.usuario_tiene_permiso(v_pan, 'inventario_ajustar')
    ) THEN
      RAISE EXCEPTION 'sin permiso';
    END IF;
  ELSIF p_tipo = 'recepcion' THEN
    IF p_cantidad <= 0 THEN
      RAISE EXCEPTION 'la recepción solo aumenta stock';
    END IF;
    IF NOT v_admin AND NOT (
      public.usuario_tiene_permiso(v_pan, 'recepciones')
      OR public.usuario_tiene_permiso(v_pan, 'recepciones_crear')
    ) THEN
      RAISE EXCEPTION 'sin permiso';
    END IF;
  ELSIF p_tipo IN ('produccion', 'consumo') THEN
    IF NOT v_admin AND NOT public.usuario_tiene_permiso(v_pan, 'produccion_crear') THEN
      RAISE EXCEPTION 'sin permiso';
    END IF;
  ELSE
    RAISE EXCEPTION 'tipo de movimiento no permitido';
  END IF;

  v_stock := COALESCE(v_stock, 0) + p_cantidad;
  IF v_stock < 0 THEN
    IF COALESCE(v_control, false) THEN
      RAISE EXCEPTION 'Stock insuficiente para %', COALESCE(v_nombre, 'producto');
    END IF;
    v_stock := 0;
  END IF;

  PERFORM set_config('sissa.stock_write', 'on', true);

  UPDATE productos
  SET stock = v_stock,
      disponible = CASE
        WHEN control_stock AND v_stock <= 0 THEN false
        WHEN control_stock AND v_stock > 0 THEN true
        ELSE disponible
      END,
      updated_at = now()
  WHERE id = p_producto;

  INSERT INTO stock_movimientos (panaderia_id, producto_id, tipo, cantidad, stock_despues, referencia, notas, creado_por)
  VALUES (v_pan, p_producto, p_tipo, p_cantidad, v_stock, p_referencia, p_notas, auth.uid());

  RETURN v_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.productos_bloquear_stock_directo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.stock, 0) <> 0
       AND current_setting('sissa.stock_write', true) IS DISTINCT FROM 'on'
    THEN
      SELECT COALESCE(plataforma_admin, false) INTO v_admin
      FROM profiles WHERE id = auth.uid();
      IF NOT v_admin AND NOT public.usuario_tiene_permiso(NEW.panaderia_id, 'inventario_ajustar') THEN
        RAISE EXCEPTION 'Solo el dueño puede fijar el stock inicial';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stock IS DISTINCT FROM OLD.stock
     AND current_setting('sissa.stock_write', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'El stock no se edita directo. Solo el dueño lo ajusta, o una venta, recepción o producción';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS productos_bloquear_stock_directo ON productos;
CREATE TRIGGER productos_bloquear_stock_directo
  BEFORE INSERT OR UPDATE OF stock ON productos
  FOR EACH ROW
  EXECUTE FUNCTION public.productos_bloquear_stock_directo();

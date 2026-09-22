-- Producción interna: productos elaborados en el local + recetas de insumos.
-- Registrar producción exige el permiso produccion_crear (rol cocina por defecto).

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS producible BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN productos.producible IS
  'true = se elabora en el local; el stock sube al registrar producción (no solo por compra).';

CREATE TABLE IF NOT EXISTS produccion_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  notas TEXT,
  creado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produccion_registros_panaderia
  ON produccion_registros (panaderia_id, created_at DESC);

CREATE TABLE IF NOT EXISTS receta_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad_por_unidad NUMERIC NOT NULL CHECK (cantidad_por_unidad > 0),
  UNIQUE (producto_id, insumo_id),
  CHECK (producto_id <> insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_receta_items_producto ON receta_items (producto_id);

ALTER TABLE produccion_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE receta_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produccion_registros_select" ON produccion_registros;
CREATE POLICY "produccion_registros_select" ON produccion_registros
  FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));

DROP POLICY IF EXISTS "receta_items_select" ON receta_items;
CREATE POLICY "receta_items_select" ON receta_items
  FOR SELECT TO authenticated
  USING (public.is_member(panaderia_id));

-- Escritura solo vía funciones SECURITY DEFINER (abajo).

CREATE OR REPLACE FUNCTION public.usuario_tiene_permiso(p_panaderia UUID, p_permiso TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role UUID;
  v_rol user_role;
  v_count INT;
BEGIN
  IF auth.uid() IS NULL OR p_permiso IS NULL OR p_panaderia IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT m.role_id, m.rol
  INTO v_role, v_rol
  FROM miembros m
  WHERE m.user_id = auth.uid()
    AND m.panaderia_id = p_panaderia
    AND m.activo
  LIMIT 1;

  IF v_rol IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role IS NULL THEN
    RETURN p_permiso = ANY (public.default_permisos_for_rol(v_rol));
  END IF;

  SELECT COUNT(*) INTO v_count FROM role_permisos WHERE role_id = v_role;
  IF v_count = 0 THEN
    RETURN p_permiso = ANY (public.default_permisos_for_rol(v_rol));
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = v_role AND rp.permiso = p_permiso
  );
END;
$$;

REVOKE ALL ON FUNCTION public.usuario_tiene_permiso(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_permiso(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_produccion(
  p_producto UUID,
  p_cantidad NUMERIC,
  p_notas TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod RECORD;
  v_item RECORD;
  v_need NUMERIC;
  v_id UUID;
  v_es_plataforma BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 OR p_cantidad > 100000 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT id, panaderia_id, nombre, producible, tipo
  INTO v_prod
  FROM productos
  WHERE id = p_producto
  FOR UPDATE;

  IF v_prod.id IS NULL OR NOT public.is_member(v_prod.panaderia_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF NOT COALESCE(v_prod.producible, false)
     OR COALESCE(v_prod.tipo::text, 'venta') = 'materia_prima' THEN
    RAISE EXCEPTION 'El producto no se elabora en el local';
  END IF;

  SELECT COALESCE(plataforma_admin, false) INTO v_es_plataforma
  FROM profiles WHERE id = auth.uid();

  IF NOT (
    public.usuario_tiene_permiso(v_prod.panaderia_id, 'produccion_crear')
    OR COALESCE(v_es_plataforma, false)
  ) THEN
    RAISE EXCEPTION 'Sin permiso para registrar producción';
  END IF;

  FOR v_item IN
    SELECT ri.insumo_id,
           ri.cantidad_por_unidad,
           p.stock,
           p.nombre,
           p.panaderia_id,
           p.tipo
    FROM receta_items ri
    JOIN productos p ON p.id = ri.insumo_id
    WHERE ri.producto_id = p_producto
      AND ri.panaderia_id = v_prod.panaderia_id
    FOR UPDATE OF p
  LOOP
    IF v_item.panaderia_id <> v_prod.panaderia_id
       OR COALESCE(v_item.tipo::text, 'venta') <> 'materia_prima' THEN
      RAISE EXCEPTION 'La receta tiene un insumo inválido';
    END IF;
    v_need := v_item.cantidad_por_unidad * p_cantidad;
    IF COALESCE(v_item.stock, 0) < v_need THEN
      RAISE EXCEPTION 'Stock insuficiente de % (hace falta %)', v_item.nombre, v_need;
    END IF;
  END LOOP;

  INSERT INTO produccion_registros (panaderia_id, producto_id, cantidad, notas, creado_por)
  VALUES (
    v_prod.panaderia_id,
    p_producto,
    p_cantidad,
    NULLIF(btrim(COALESCE(p_notas, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_id;

  UPDATE productos
  SET control_stock = true, updated_at = now()
  WHERE id = p_producto;

  PERFORM public.ajustar_stock(
    p_producto,
    p_cantidad,
    'produccion',
    v_id::text,
    COALESCE(NULLIF(btrim(COALESCE(p_notas, '')), ''), 'Producción')
  );

  FOR v_item IN
    SELECT insumo_id, cantidad_por_unidad
    FROM receta_items
    WHERE producto_id = p_producto AND panaderia_id = v_prod.panaderia_id
  LOOP
    PERFORM public.ajustar_stock(
      v_item.insumo_id,
      -(v_item.cantidad_por_unidad * p_cantidad),
      'produccion',
      v_id::text,
      'Consumo por producción'
    );
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_produccion(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_produccion(UUID, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.guardar_receta(
  p_producto UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod RECORD;
  v_line JSONB;
  v_insumo UUID;
  v_qty NUMERIC;
  v_ins RECORD;
  v_es_plataforma BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT id, panaderia_id, producible, tipo
  INTO v_prod
  FROM productos
  WHERE id = p_producto
  FOR UPDATE;

  IF v_prod.id IS NULL OR NOT public.is_member(v_prod.panaderia_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF NOT COALESCE(v_prod.producible, false)
     OR COALESCE(v_prod.tipo::text, 'venta') = 'materia_prima' THEN
    RAISE EXCEPTION 'Solo se arma receta de productos que se elaboran en el local';
  END IF;

  SELECT COALESCE(plataforma_admin, false) INTO v_es_plataforma
  FROM profiles WHERE id = auth.uid();

  IF NOT (
    public.usuario_tiene_permiso(v_prod.panaderia_id, 'produccion_recetas')
    OR COALESCE(v_es_plataforma, false)
  ) THEN
    RAISE EXCEPTION 'Sin permiso para editar recetas';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Receta inválida';
  END IF;

  DELETE FROM receta_items
  WHERE producto_id = p_producto AND panaderia_id = v_prod.panaderia_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_insumo := (v_line->>'insumo_id')::uuid;
    v_qty := (v_line->>'cantidad_por_unidad')::numeric;
    IF v_insumo IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cada insumo necesita cantidad mayor a 0';
    END IF;
    IF v_insumo = p_producto THEN
      RAISE EXCEPTION 'Un producto no puede ser insumo de sí mismo';
    END IF;

    SELECT id, panaderia_id, tipo, nombre
    INTO v_ins
    FROM productos
    WHERE id = v_insumo;

    IF v_ins.id IS NULL
       OR v_ins.panaderia_id <> v_prod.panaderia_id
       OR COALESCE(v_ins.tipo::text, 'venta') <> 'materia_prima' THEN
      RAISE EXCEPTION 'El insumo debe ser materia prima de este local';
    END IF;

    INSERT INTO receta_items (panaderia_id, producto_id, insumo_id, cantidad_por_unidad)
    VALUES (v_prod.panaderia_id, p_producto, v_insumo, v_qty);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_receta(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_receta(UUID, JSONB) TO authenticated;

-- Permisos por defecto
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
      'insumos','insumos_crear','inventario','facturas','clientes','clientes_crear',
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

-- Dueño y gerente: ver + recetas (no registrar, salvo que se les asigne)
INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, p.permiso
FROM roles r
CROSS JOIN (VALUES ('produccion'), ('produccion_recetas')) AS p(permiso)
WHERE r.rol_base IN ('dueno', 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = r.id AND rp.permiso = p.permiso
  );

-- Panadero (cocina): ver, registrar stock y recetas
INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, p.permiso
FROM roles r
CROSS JOIN (VALUES ('produccion'), ('produccion_crear'), ('produccion_recetas')) AS p(permiso)
WHERE r.rol_base = 'cocina'
  AND NOT EXISTS (
    SELECT 1 FROM role_permisos rp
    WHERE rp.role_id = r.id AND rp.permiso = p.permiso
  );

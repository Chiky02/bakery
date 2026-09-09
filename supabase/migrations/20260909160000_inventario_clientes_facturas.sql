-- Inventario (stock mínimo) + clientes CRM-lite + permisos nuevos

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS stock_minimo NUMERIC(14, 3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  documento TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_panaderia ON clientes(panaderia_id, nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(panaderia_id, documento)
  WHERE documento IS NOT NULL AND documento <> '';

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_member" ON clientes;
CREATE POLICY "clientes_member" ON clientes FOR ALL TO authenticated
  USING (public.is_member(panaderia_id))
  WITH CHECK (public.is_member(panaderia_id));

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

ALTER TABLE encargos
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_cliente ON facturas(cliente_id)
  WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facturas_numero ON facturas(panaderia_id, numero);
CREATE INDEX IF NOT EXISTS idx_facturas_created ON facturas(panaderia_id, created_at DESC);

-- Permisos de menú: inventario, facturas, clientes
CREATE OR REPLACE FUNCTION public.default_permisos_for_rol(p_rol user_role)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_rol
    WHEN 'dueno' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','caja','encargos',
      'recepciones','productos','insumos','inventario','facturas','clientes',
      'reportes','usuarios','negocios','configuracion','panaderias'
    ]
    WHEN 'admin' THEN ARRAY[
      'dashboard','mostrador','mesas_gestion','mesas','cocina','caja','encargos',
      'recepciones','productos','insumos','inventario','facturas','clientes',
      'reportes','usuarios','negocios','configuracion','panaderias'
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

-- Backfill permisos en roles de sistema existentes
INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, p.permiso
FROM roles r
CROSS JOIN LATERAL unnest(ARRAY['inventario','facturas','clientes']) AS p(permiso)
WHERE r.es_sistema = true
  AND r.codigo IN ('dueno', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, p.permiso
FROM roles r
CROSS JOIN LATERAL unnest(ARRAY['facturas','clientes']) AS p(permiso)
WHERE r.es_sistema = true
  AND r.codigo IN ('mostrador', 'caja')
ON CONFLICT DO NOTHING;

INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, 'inventario'
FROM roles r
WHERE r.es_sistema = true
  AND r.codigo = 'caja'
ON CONFLICT DO NOTHING;

INSERT INTO role_permisos (role_id, permiso)
SELECT r.id, 'clientes'
FROM roles r
WHERE r.es_sistema = true
  AND r.codigo = 'mesero'
ON CONFLICT DO NOTHING;

-- emitir_factura: opcional cliente_id del directorio
DROP FUNCTION IF EXISTS public.emitir_factura(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, medio_pago, JSONB, TEXT, UUID, UUID, UUID
);

CREATE OR REPLACE FUNCTION public.emitir_factura(
  p_panaderia UUID,
  p_origen TEXT,
  p_cliente_nombre TEXT,
  p_cliente_documento TEXT,
  p_cliente_email TEXT,
  p_cliente_direccion TEXT,
  p_cliente_telefono TEXT,
  p_subtotal INTEGER,
  p_iva INTEGER,
  p_total INTEGER,
  p_medio_pago medio_pago,
  p_detalle JSONB,
  p_notas TEXT,
  p_venta_id UUID DEFAULT NULL,
  p_cuenta_id UUID DEFAULT NULL,
  p_encargo_id UUID DEFAULT NULL,
  p_cliente_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consec INTEGER;
  v_prefijo TEXT;
  v_numero TEXT;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_member(p_panaderia) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT consecutivo_factura, COALESCE(NULLIF(prefijo_factura, ''), 'FV')
  INTO v_consec, v_prefijo
  FROM panaderias
  WHERE id = p_panaderia
  FOR UPDATE;

  IF v_consec IS NULL THEN
    RAISE EXCEPTION 'Panadería no encontrada';
  END IF;

  v_numero := v_prefijo || '-' || lpad(v_consec::text, 6, '0');

  INSERT INTO facturas (
    panaderia_id, numero, consecutivo, origen,
    venta_id, cuenta_mesa_id, encargo_id, cliente_id,
    cliente_nombre, cliente_documento, cliente_email, cliente_direccion, cliente_telefono,
    subtotal, iva, total, medio_pago, detalle, notas, emitida_por
  ) VALUES (
    p_panaderia, v_numero, v_consec, p_origen,
    p_venta_id, p_cuenta_id, p_encargo_id, p_cliente_id,
    p_cliente_nombre, p_cliente_documento, p_cliente_email, p_cliente_direccion, p_cliente_telefono,
    p_subtotal, p_iva, p_total, p_medio_pago, COALESCE(p_detalle, '[]'::jsonb), p_notas, auth.uid()
  )
  RETURNING id INTO v_id;

  UPDATE panaderias SET consecutivo_factura = v_consec + 1 WHERE id = p_panaderia;

  IF p_venta_id IS NOT NULL THEN
    UPDATE ventas_mostrador SET factura_id = v_id WHERE id = p_venta_id AND panaderia_id = p_panaderia;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emitir_factura(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, medio_pago, JSONB, TEXT, UUID, UUID, UUID, UUID
) TO authenticated;

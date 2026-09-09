-- Ops hardening: stock, turnos de caja, facturas de venta (no FE),
-- una cuenta abierta por mesa, RLS público más estricto.

-- ─── Productos: stock ───────────────────────────────────────────────────────
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS stock NUMERIC(14, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS control_stock BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS stock_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'venta', 'recepcion')),
  cantidad NUMERIC(14, 3) NOT NULL,
  stock_despues NUMERIC(14, 3) NOT NULL,
  referencia TEXT,
  notas TEXT,
  creado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_mov_panaderia ON stock_movimientos(panaderia_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_producto ON stock_movimientos(producto_id, created_at DESC);

ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_mov_member" ON stock_movimientos;
CREATE POLICY "stock_mov_member" ON stock_movimientos FOR ALL TO authenticated
  USING (public.is_member(panaderia_id))
  WITH CHECK (public.is_member(panaderia_id));

-- ─── Una sola cuenta abierta por mesa ─────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_cuentas_una_abierta_por_mesa
  ON cuentas_mesa (mesa_id)
  WHERE estado = 'abierta';

-- ─── Turnos de caja ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS turnos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  abierto_por UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  cerrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  apertura_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cierre_at TIMESTAMPTZ,
  fondo_inicial INTEGER NOT NULL DEFAULT 0 CHECK (fondo_inicial >= 0),
  efectivo_contado INTEGER,
  electronico_contado INTEGER,
  notas_apertura TEXT,
  notas_cierre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_uno_abierto
  ON turnos_caja (panaderia_id)
  WHERE estado = 'abierto';

CREATE INDEX IF NOT EXISTS idx_turnos_panaderia ON turnos_caja(panaderia_id, apertura_at DESC);

ALTER TABLE turnos_caja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "turnos_caja_member" ON turnos_caja;
CREATE POLICY "turnos_caja_member" ON turnos_caja FOR ALL TO authenticated
  USING (public.is_member(panaderia_id))
  WITH CHECK (public.is_member(panaderia_id));

ALTER TABLE ventas_mostrador
  ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES turnos_caja(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anulado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS factura_id UUID;

ALTER TABLE cuentas_mesa
  ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES turnos_caja(id) ON DELETE SET NULL;

-- ─── Datos fiscales de panadería (factura impresa, no FE) ─────────────────
ALTER TABLE panaderias
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS regimen TEXT DEFAULT 'simplificado',
  ADD COLUMN IF NOT EXISTS prefijo_factura TEXT DEFAULT 'FV',
  ADD COLUMN IF NOT EXISTS consecutivo_factura INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS texto_legal_factura TEXT;

-- ─── Facturas de venta (documento comercial imprimible) ───────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  consecutivo INTEGER NOT NULL,
  origen TEXT NOT NULL CHECK (origen IN ('mostrador', 'mesa', 'encargo', 'manual')),
  venta_id UUID REFERENCES ventas_mostrador(id) ON DELETE SET NULL,
  cuenta_mesa_id UUID REFERENCES cuentas_mesa(id) ON DELETE SET NULL,
  encargo_id UUID REFERENCES encargos(id) ON DELETE SET NULL,
  cliente_nombre TEXT NOT NULL,
  cliente_documento TEXT,
  cliente_email TEXT,
  cliente_direccion TEXT,
  cliente_telefono TEXT,
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  iva INTEGER NOT NULL DEFAULT 0 CHECK (iva >= 0),
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  medio_pago medio_pago,
  detalle JSONB NOT NULL DEFAULT '[]',
  notas TEXT,
  emitida_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (panaderia_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_facturas_panaderia ON facturas(panaderia_id, created_at DESC);

ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facturas_member" ON facturas;
CREATE POLICY "facturas_member" ON facturas FOR ALL TO authenticated
  USING (public.is_member(panaderia_id))
  WITH CHECK (public.is_member(panaderia_id));

-- FK tardía ventas → facturas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ventas_mostrador_factura_id_fkey'
  ) THEN
    ALTER TABLE ventas_mostrador
      ADD CONSTRAINT ventas_mostrador_factura_id_fkey
      FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── RPC: emitir factura + consecutivo atómico ────────────────────────────
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
  p_encargo_id UUID DEFAULT NULL
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
    venta_id, cuenta_mesa_id, encargo_id,
    cliente_nombre, cliente_documento, cliente_email, cliente_direccion, cliente_telefono,
    subtotal, iva, total, medio_pago, detalle, notas, emitida_por
  ) VALUES (
    p_panaderia, v_numero, v_consec, p_origen,
    p_venta_id, p_cuenta_id, p_encargo_id,
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
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, medio_pago, JSONB, TEXT, UUID, UUID, UUID
) TO authenticated;

-- ─── RPC: ajustar stock ───────────────────────────────────────────────────
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT panaderia_id, stock, control_stock
  INTO v_pan, v_stock, v_control
  FROM productos
  WHERE id = p_producto
  FOR UPDATE;

  IF v_pan IS NULL OR NOT public.is_member(v_pan) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_stock := COALESCE(v_stock, 0) + p_cantidad;
  IF v_stock < 0 THEN
    v_stock := 0;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.ajustar_stock(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ajustar_stock(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

-- ─── RLS público más estricto ─────────────────────────────────────────────
DROP POLICY IF EXISTS "mesas_public_qr" ON mesas;
CREATE POLICY "mesas_public_qr" ON mesas FOR SELECT TO anon
  USING (qr_habilitado = true AND COALESCE(activa, true) = true);

DROP POLICY IF EXISTS "panaderias_public_qr" ON panaderias;
CREATE POLICY "panaderias_public_qr" ON panaderias FOR SELECT TO anon
  USING (activa = true);

DROP POLICY IF EXISTS "cuentas_public_qr_read" ON cuentas_mesa;
-- Anon no necesita listar todas las cuentas; pedidos QR usan service role.
CREATE POLICY "cuentas_public_qr_read" ON cuentas_mesa FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS "categorias_public_menu" ON categorias;
CREATE POLICY "categorias_public_menu" ON categorias FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM panaderias p
      WHERE p.id = categorias.panaderia_id AND p.activa = true
    )
  );

DROP POLICY IF EXISTS "productos_public_menu" ON productos;
CREATE POLICY "productos_public_menu" ON productos FOR SELECT TO anon
  USING (
    disponible = true
    AND COALESCE(tipo, 'venta') = 'venta'
    AND EXISTS (
      SELECT 1 FROM panaderias p
      WHERE p.id = productos.panaderia_id AND p.activa = true
    )
  );

DROP POLICY IF EXISTS "notificaciones_select" ON notificaciones;
CREATE POLICY "notificaciones_select" ON notificaciones FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_select_auth" ON profiles;
CREATE POLICY "profiles_select_self_or_member" ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM miembros m1
      JOIN miembros m2 ON m1.panaderia_id = m2.panaderia_id
      WHERE m1.user_id = auth.uid() AND m1.activo
        AND m2.user_id = profiles.id AND m2.activo
    )
  );

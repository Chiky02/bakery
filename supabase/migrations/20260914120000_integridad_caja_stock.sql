-- Integridad: stock duro, montos mixto, anular ventas, recepciones idempotentes, caja encargos

-- ─── Montos de pago (mixto real) ───────────────────────────────────────────
ALTER TABLE ventas_mostrador
  ADD COLUMN IF NOT EXISTS monto_efectivo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_electronico INTEGER NOT NULL DEFAULT 0;

ALTER TABLE cuentas_mesa
  ADD COLUMN IF NOT EXISTS monto_efectivo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_electronico INTEGER NOT NULL DEFAULT 0;

-- Backfill aproximado para filas existentes
UPDATE ventas_mostrador SET
  monto_efectivo = CASE
    WHEN medio_pago = 'efectivo' THEN total
    WHEN medio_pago = 'mixto' THEN (total / 2)
    ELSE 0
  END,
  monto_electronico = CASE
    WHEN medio_pago = 'electronico' THEN total
    WHEN medio_pago = 'mixto' THEN total - (total / 2)
    ELSE 0
  END
WHERE monto_efectivo = 0 AND monto_electronico = 0 AND total > 0;

UPDATE cuentas_mesa SET
  monto_efectivo = CASE
    WHEN medio_pago = 'efectivo' THEN COALESCE(total_final, 0)
    WHEN medio_pago = 'mixto' THEN (COALESCE(total_final, 0) / 2)
    ELSE 0
  END,
  monto_electronico = CASE
    WHEN medio_pago = 'electronico' THEN COALESCE(total_final, 0)
    WHEN medio_pago = 'mixto' THEN COALESCE(total_final, 0) - (COALESCE(total_final, 0) / 2)
    ELSE 0
  END
WHERE monto_efectivo = 0 AND monto_electronico = 0 AND COALESCE(total_final, 0) > 0;

-- ─── Movimientos de caja (encargos / extras del turno) ─────────────────────
CREATE TABLE IF NOT EXISTS movimientos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panaderia_id UUID NOT NULL REFERENCES panaderias(id) ON DELETE CASCADE,
  turno_id UUID NOT NULL REFERENCES turnos_caja(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('encargo_abono', 'encargo_pago')),
  referencia_id UUID,
  monto_efectivo INTEGER NOT NULL DEFAULT 0,
  monto_electronico INTEGER NOT NULL DEFAULT 0,
  notas TEXT,
  creado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_caja_montos_chk CHECK (monto_efectivo >= 0 AND monto_electronico >= 0)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_turno
  ON movimientos_caja (panaderia_id, turno_id);

ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movimientos_caja_member" ON movimientos_caja;
CREATE POLICY "movimientos_caja_member" ON movimientos_caja FOR ALL TO authenticated
  USING (public.is_member(panaderia_id))
  WITH CHECK (public.is_member(panaderia_id));

-- ─── RLS: permitir anular ventas ───────────────────────────────────────────
DROP POLICY IF EXISTS "ventas_update" ON ventas_mostrador;
CREATE POLICY "ventas_update" ON ventas_mostrador FOR UPDATE TO authenticated
  USING (public.is_member(panaderia_id))
  WITH CHECK (public.is_member(panaderia_id));

-- ─── Stock: no permitir negativo con control_stock ─────────────────────────
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

  v_stock := COALESCE(v_stock, 0) + p_cantidad;
  IF v_stock < 0 THEN
    IF COALESCE(v_control, false) THEN
      RAISE EXCEPTION 'Stock insuficiente para %', COALESCE(v_nombre, 'producto');
    END IF;
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

-- ─── Venta mostrador atómica (venta + stock) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_venta_mostrador(
  p_panaderia UUID,
  p_medio_pago medio_pago,
  p_detalle JSONB,
  p_turno_id UUID,
  p_monto_efectivo INTEGER DEFAULT 0,
  p_monto_electronico INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_total INTEGER := 0;
  v_line JSONB;
  v_prod RECORD;
  v_qty NUMERIC;
  v_precio INTEGER;
  v_detalle JSONB := '[]'::jsonb;
  v_turno_ok BOOLEAN;
  v_control BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_member(p_panaderia) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM turnos_caja
    WHERE id = p_turno_id AND panaderia_id = p_panaderia AND estado = 'abierto'
  ) INTO v_turno_ok;
  IF NOT v_turno_ok THEN
    RAISE EXCEPTION 'No hay apertura de caja';
  END IF;

  IF p_detalle IS NULL OR jsonb_typeof(p_detalle) <> 'array' OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Detalle vacío';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    SELECT id, nombre, precio, disponible, COALESCE(tipo, 'venta') AS tipo,
           COALESCE(control_stock, false) AS control_stock
    INTO v_prod
    FROM productos
    WHERE id = (v_line->>'producto_id')::uuid
      AND panaderia_id = p_panaderia
    FOR UPDATE;

    IF v_prod.id IS NULL OR NOT v_prod.disponible OR v_prod.tipo = 'materia_prima' THEN
      RAISE EXCEPTION 'Producto no disponible';
    END IF;

    v_qty := GREATEST(1, floor(COALESCE((v_line->>'cantidad')::numeric, 0)));
    v_precio := COALESCE(v_prod.precio, 0);
    v_total := v_total + (v_precio * v_qty::integer);
    v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod.id,
      'nombre', v_prod.nombre,
      'cantidad', v_qty,
      'precio', v_precio,
      'subtotal', v_precio * v_qty::integer
    ));
  END LOOP;

  IF p_medio_pago = 'efectivo' THEN
    p_monto_efectivo := v_total;
    p_monto_electronico := 0;
  ELSIF p_medio_pago = 'electronico' THEN
    p_monto_efectivo := 0;
    p_monto_electronico := v_total;
  ELSIF COALESCE(p_monto_efectivo, 0) + COALESCE(p_monto_electronico, 0) <> v_total THEN
    RAISE EXCEPTION 'El desglose mixto no cuadra con el total';
  END IF;

  INSERT INTO ventas_mostrador (
    panaderia_id, total, medio_pago, detalle, registrado_por, turno_id,
    monto_efectivo, monto_electronico
  ) VALUES (
    p_panaderia, v_total, p_medio_pago, v_detalle, auth.uid(), p_turno_id,
    COALESCE(p_monto_efectivo, 0), COALESCE(p_monto_electronico, 0)
  )
  RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_detalle)
  LOOP
    SELECT COALESCE(control_stock, false) INTO v_control
    FROM productos WHERE id = (v_line->>'producto_id')::uuid;
    IF v_control THEN
      PERFORM public.ajustar_stock(
        (v_line->>'producto_id')::uuid,
        -((v_line->>'cantidad')::numeric),
        'venta',
        v_id::text,
        'Venta mostrador'
      );
    END IF;
  END LOOP;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_venta_mostrador(
  UUID, medio_pago, JSONB, UUID, INTEGER, INTEGER
) TO authenticated;

-- ─── Recepción idempotente ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recibir_recepcion(p_recepcion UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_item RECORD;
  v_qty NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT id, panaderia_id, estado
  INTO v_rec
  FROM recepciones
  WHERE id = p_recepcion
  FOR UPDATE;

  IF v_rec.id IS NULL OR NOT public.is_member(v_rec.panaderia_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF v_rec.estado = 'recibida' THEN
    RAISE EXCEPTION 'Ya estaba recibida';
  END IF;

  UPDATE recepciones
  SET estado = 'recibida',
      fecha_recepcion = CURRENT_DATE,
      recibido_por = auth.uid(),
      updated_at = now()
  WHERE id = p_recepcion;

  FOR v_item IN
    SELECT * FROM recepcion_items WHERE recepcion_id = p_recepcion
  LOOP
    v_qty := COALESCE(v_item.cantidad_pedida, 0);
    UPDATE recepcion_items
    SET cantidad_recibida = v_qty
    WHERE id = v_item.id;

    IF v_item.producto_id IS NOT NULL AND v_qty > 0 THEN
      PERFORM public.ajustar_stock(
        v_item.producto_id, v_qty, 'recepcion', p_recepcion::text, v_item.descripcion
      );
      UPDATE productos
      SET control_stock = true, updated_at = now()
      WHERE id = v_item.producto_id AND panaderia_id = v_rec.panaderia_id;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recibir_recepcion(UUID) TO authenticated;

-- Ticket de venta, unidades de medida, conciliación de turno
ALTER TABLE panaderias
  ADD COLUMN IF NOT EXISTS imprimir_ticket_venta BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unidades_medida TEXT[] NOT NULL DEFAULT ARRAY[
    'unidad', 'kg', 'g', 'litro', 'ml', 'libra', 'paquete', 'caja', 'docena'
  ];

ALTER TABLE turnos_caja
  ADD COLUMN IF NOT EXISTS esperado_efectivo INTEGER,
  ADD COLUMN IF NOT EXISTS esperado_electronico INTEGER,
  ADD COLUMN IF NOT EXISTS diferencia_efectivo INTEGER,
  ADD COLUMN IF NOT EXISTS diferencia_electronico INTEGER;

CREATE INDEX IF NOT EXISTS idx_stock_mov_panaderia_fecha
  ON stock_movimientos (panaderia_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ventas_anulado
  ON ventas_mostrador (panaderia_id, anulado, fecha_hora DESC);

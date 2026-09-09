-- Detalle de billetes/monedas en apertura y cierre de turno
ALTER TABLE turnos_caja
  ADD COLUMN IF NOT EXISTS detalle_apertura JSONB,
  ADD COLUMN IF NOT EXISTS detalle_cierre JSONB;

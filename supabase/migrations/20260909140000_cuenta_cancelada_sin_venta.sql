-- Cuentas liberadas sin cobro (no venta)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'cuenta_estado' AND e.enumlabel = 'cancelada'
  ) THEN
    ALTER TYPE cuenta_estado ADD VALUE 'cancelada';
  END IF;
END $$;

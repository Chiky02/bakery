-- Idempotencia de ventas de mostrador (cola offline / reintentos).
ALTER TABLE ventas_mostrador
  ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS ventas_mostrador_panaderia_client_request_uidx
  ON ventas_mostrador (panaderia_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN ventas_mostrador.client_request_id IS
  'UUID generado en el cliente para evitar ventas duplicadas al sincronizar offline.';

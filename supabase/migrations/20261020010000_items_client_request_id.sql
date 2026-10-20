-- Idempotencia de ítems de mesa anotados sin nube (reintento al volver internet).
ALTER TABLE items_cuenta
  ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS items_cuenta_client_request_id_uidx
  ON items_cuenta (client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN items_cuenta.client_request_id IS
  'UUID generado en el dispositivo para no duplicar la comanda al sincronizar.';

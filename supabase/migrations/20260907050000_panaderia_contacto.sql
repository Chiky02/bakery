-- Contacto público por panadería (dirección + teléfono)
ALTER TABLE panaderias ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE panaderias ADD COLUMN IF NOT EXISTS direccion TEXT;

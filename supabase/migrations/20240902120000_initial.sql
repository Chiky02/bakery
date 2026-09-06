-- Panadería Sissa — esquema inicial

CREATE TYPE user_role AS ENUM ('dueno', 'admin', 'mostrador', 'mesero', 'cocina', 'caja');
CREATE TYPE mesa_estado AS ENUM ('libre', 'ocupada');
CREATE TYPE cuenta_estado AS ENUM ('abierta', 'cerrada');
CREATE TYPE subcuenta_estado AS ENUM ('abierta', 'cerrada');
CREATE TYPE item_origen AS ENUM ('mesero', 'cliente_qr', 'mostrador');
CREATE TYPE item_estado AS ENUM ('pendiente', 'pendiente_confirmacion', 'en_preparacion', 'listo', 'entregado', 'cancelado');
CREATE TYPE encargo_estado AS ENUM ('pendiente', 'entregado', 'cobrado', 'cancelado');
CREATE TYPE medio_pago AS ENUM ('efectivo', 'electronico', 'mixto');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'mostrador',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE config_negocio (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre TEXT NOT NULL DEFAULT 'Panadería Sissa',
  moneda TEXT NOT NULL DEFAULT 'COP',
  pedido_directo_habilitado BOOLEAN NOT NULL DEFAULT false,
  requiere_aprobacion_mesero BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  medida TEXT NOT NULL DEFAULT 'unidad',
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nombre TEXT NOT NULL,
  precio INTEGER NOT NULL CHECK (precio >= 0),
  disponible BOOLEAN NOT NULL DEFAULT true,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (categoria_id, nombre)
);

CREATE TABLE mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  zona TEXT NOT NULL DEFAULT 'Salón',
  estado mesa_estado NOT NULL DEFAULT 'libre',
  qr_habilitado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cuentas_mesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id UUID NOT NULL REFERENCES mesas(id) ON DELETE RESTRICT,
  mesero_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  estado cuenta_estado NOT NULL DEFAULT 'abierta',
  hora_apertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  hora_cierre TIMESTAMPTZ,
  total_final INTEGER,
  medio_pago medio_pago,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sub_cuentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_mesa_id UUID NOT NULL REFERENCES cuentas_mesa(id) ON DELETE CASCADE,
  etiqueta TEXT NOT NULL,
  medio_pago medio_pago,
  total INTEGER,
  estado subcuenta_estado NOT NULL DEFAULT 'abierta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE items_cuenta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_mesa_id UUID NOT NULL REFERENCES cuentas_mesa(id) ON DELETE CASCADE,
  sub_cuenta_id UUID REFERENCES sub_cuentas(id) ON DELETE SET NULL,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_al_momento INTEGER NOT NULL CHECK (precio_al_momento >= 0),
  origen item_origen NOT NULL DEFAULT 'mesero',
  estado item_estado NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ventas_mostrador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  total INTEGER NOT NULL CHECK (total >= 0),
  medio_pago medio_pago NOT NULL DEFAULT 'efectivo',
  registrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  detalle JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE encargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL,
  cliente_nombre TEXT,
  cliente_telefono TEXT,
  fecha_entrega DATE NOT NULL,
  valor INTEGER NOT NULL CHECK (valor >= 0),
  estado encargo_estado NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  creado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_disponible ON productos(disponible);
CREATE INDEX idx_cuentas_mesa_mesa ON cuentas_mesa(mesa_id);
CREATE INDEX idx_cuentas_mesa_estado ON cuentas_mesa(estado);
CREATE INDEX idx_items_cuenta_cuenta ON items_cuenta(cuenta_mesa_id);
CREATE INDEX idx_items_cuenta_estado ON items_cuenta(estado);
CREATE INDEX idx_ventas_mostrador_fecha ON ventas_mostrador(fecha_hora);
CREATE INDEX idx_encargos_fecha ON encargos(fecha_entrega);
CREATE INDEX idx_encargos_estado ON encargos(estado);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_mesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_cuenta ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_mostrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE encargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "config_select" ON config_negocio FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_all_staff" ON config_negocio FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin'))
);

CREATE POLICY "categorias_read" ON categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias_write" ON categorias FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin'))
);

CREATE POLICY "productos_read" ON productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "productos_write" ON productos FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin', 'mostrador', 'mesero'))
);

CREATE POLICY "mesas_read" ON mesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "mesas_write" ON mesas FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin', 'mesero', 'caja'))
);

CREATE POLICY "cuentas_read" ON cuentas_mesa FOR SELECT TO authenticated USING (true);
CREATE POLICY "cuentas_write" ON cuentas_mesa FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin', 'mesero', 'caja'))
);

CREATE POLICY "subcuentas_read" ON sub_cuentas FOR SELECT TO authenticated USING (true);
CREATE POLICY "subcuentas_write" ON sub_cuentas FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin', 'mesero', 'caja'))
);

CREATE POLICY "items_read" ON items_cuenta FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_write" ON items_cuenta FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin', 'mesero', 'cocina', 'caja'))
);

CREATE POLICY "ventas_read" ON ventas_mostrador FOR SELECT TO authenticated USING (true);
CREATE POLICY "ventas_write" ON ventas_mostrador FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin', 'mostrador', 'caja'))
);

CREATE POLICY "encargos_read" ON encargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "encargos_write" ON encargos FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('dueno', 'admin', 'mostrador', 'mesero'))
);

-- Lectura pública de menú QR (productos disponibles + config + mesa por token)
CREATE POLICY "productos_public_menu" ON productos FOR SELECT TO anon USING (disponible = true);
CREATE POLICY "categorias_public_menu" ON categorias FOR SELECT TO anon USING (true);
CREATE POLICY "config_public_menu" ON config_negocio FOR SELECT TO anon USING (true);
CREATE POLICY "mesas_public_qr" ON mesas FOR SELECT TO anon USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE items_cuenta;
ALTER PUBLICATION supabase_realtime ADD TABLE cuentas_mesa;
ALTER PUBLICATION supabase_realtime ADD TABLE mesas;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, rol)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)), 'mostrador');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO config_negocio (id, nombre) VALUES (1, 'Panadería Sissa');

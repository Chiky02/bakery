export type UserRole =
  | "dueno"
  | "admin"
  | "mostrador"
  | "mesero"
  | "cocina"
  | "caja";

export type MedioPago = "efectivo" | "electronico" | "mixto";

export type RecepcionEstado =
  | "borrador"
  | "pendiente"
  | "parcial"
  | "recibida"
  | "cancelada";

export type Profile = {
  id: string;
  nombre: string;
  activo: boolean;
  panaderia_activa_id: string | null;
};

export type Panaderia = {
  id: string;
  nombre: string;
  slug: string;
  moneda: string;
  pedido_directo_habilitado: boolean;
  requiere_aprobacion_mesero: boolean;
  activa: boolean;
  tiempo_minimo_encargo_horas?: number;
  nombre_publico?: string | null;
};

export type Miembro = {
  id: string;
  panaderia_id: string;
  user_id: string;
  rol: UserRole;
  activo: boolean;
  panaderias?: Panaderia;
  profiles?: Profile;
};

export type SessionContext = {
  profile: Profile;
  panaderia: Panaderia;
  rol: UserRole;
  memberships: Miembro[];
};

export type Categoria = {
  id: string;
  panaderia_id: string;
  nombre: string;
  medida: string;
  orden: number;
};

export type ProductoTipo = "venta" | "materia_prima";

export type Producto = {
  id: string;
  panaderia_id: string;
  categoria_id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  orden: number;
  codigo_barras?: string | null;
  tipo?: ProductoTipo;
  categorias?: Categoria;
};

export type Mesa = {
  id: string;
  panaderia_id: string;
  nombre: string;
  zona: string;
  estado: "libre" | "ocupada";
  qr_habilitado: boolean;
  activa?: boolean;
};

export type CuentaMesa = {
  id: string;
  panaderia_id: string;
  mesa_id: string;
  mesero_id: string | null;
  estado: "abierta" | "cerrada";
  hora_apertura: string;
  hora_cierre: string | null;
  total_final: number | null;
  medio_pago: MedioPago | null;
  notas: string | null;
  mesas?: Mesa;
};

export type SubCuenta = {
  id: string;
  cuenta_mesa_id: string;
  etiqueta: string;
  medio_pago: MedioPago | null;
  total: number | null;
  estado: "abierta" | "cerrada";
};

export type ItemCuenta = {
  id: string;
  cuenta_mesa_id: string;
  sub_cuenta_id: string | null;
  producto_id: string;
  cantidad: number;
  precio_al_momento: number;
  origen: "mesero" | "cliente_qr" | "mostrador";
  estado:
    | "pendiente"
    | "pendiente_confirmacion"
    | "en_preparacion"
    | "listo"
    | "entregado"
    | "cancelado";
  notas: string | null;
  productos?: Producto;
};

export type VentaMostrador = {
  id: string;
  panaderia_id: string;
  fecha_hora: string;
  total: number;
  medio_pago: MedioPago;
  detalle: VentaDetalleItem[];
};

export type VentaDetalleItem = {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
};

export type Encargo = {
  id: string;
  panaderia_id: string;
  descripcion: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  fecha_entrega: string;
  fecha_envio?: string | null;
  fecha_acordada?: string | null;
  valor: number;
  estado: "pendiente" | "entregado" | "cobrado" | "cancelado";
  notas: string | null;
};

/** @deprecated usar Panaderia; se mantiene alias para páginas que leían config_negocio */
export type ConfigNegocio = {
  id: string;
  nombre: string;
  moneda: string;
  pedido_directo_habilitado: boolean;
  requiere_aprobacion_mesero: boolean;
};

export type Proveedor = {
  id: string;
  panaderia_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  activo: boolean;
  nit?: string | null;
  contacto_nombre?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  dias_entrega?: string | null;
  condiciones_pago?: string | null;
};

export type Notificacion = {
  id: string;
  panaderia_id: string;
  user_id: string | null;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  leida: boolean;
  created_at: string;
};

export type RecepcionItem = {
  id: string;
  recepcion_id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad_pedida: number;
  cantidad_recibida: number;
  unidad: string;
  costo_unitario: number;
  productos?: Producto;
};

export type Recepcion = {
  id: string;
  panaderia_id: string;
  proveedor_id: string | null;
  numero: string | null;
  estado: RecepcionEstado;
  fecha_pedido: string | null;
  fecha_recepcion: string | null;
  notas: string | null;
  total_estimado: number;
  created_at: string;
  proveedores?: Proveedor;
  recepcion_items?: RecepcionItem[];
};

export type CartItem = {
  producto: Producto;
  cantidad: number;
};

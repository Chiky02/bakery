export type UserRole =
  | "dueno"
  | "admin"
  | "mostrador"
  | "mesero"
  | "cocina"
  | "caja";

export type MedioPago = "efectivo" | "electronico" | "mixto";

export type Profile = {
  id: string;
  nombre: string;
  rol: UserRole;
  activo: boolean;
};

export type Categoria = {
  id: string;
  nombre: string;
  medida: string;
  orden: number;
};

export type Producto = {
  id: string;
  categoria_id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  orden: number;
  categorias?: Categoria;
};

export type Mesa = {
  id: string;
  nombre: string;
  zona: string;
  estado: "libre" | "ocupada";
  qr_habilitado: boolean;
};

export type CuentaMesa = {
  id: string;
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
  descripcion: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  fecha_entrega: string;
  valor: number;
  estado: "pendiente" | "entregado" | "cobrado" | "cancelado";
  notas: string | null;
};

export type ConfigNegocio = {
  id: number;
  nombre: string;
  moneda: string;
  pedido_directo_habilitado: boolean;
  requiere_aprobacion_mesero: boolean;
};

export type CartItem = {
  producto: Producto;
  cantidad: number;
};

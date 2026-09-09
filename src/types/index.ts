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
  telefono?: string | null;
  direccion?: string | null;
  maps_url?: string | null;
  whatsapp?: string | null;
  nit?: string | null;
  razon_social?: string | null;
  regimen?: string | null;
  prefijo_factura?: string | null;
  consecutivo_factura?: number;
  texto_legal_factura?: string | null;
  imprimir_ticket_venta?: boolean;
  unidades_medida?: string[] | null;
};

export type RolePermiso = {
  role_id: string;
  permiso: string;
};

export type RolCustom = {
  id: string;
  panaderia_id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  rol_base: UserRole;
  activo: boolean;
  es_sistema: boolean;
  created_at?: string;
  role_permisos?: RolePermiso[];
};

export type Miembro = {
  id: string;
  panaderia_id: string;
  user_id: string;
  rol: UserRole;
  role_id?: string | null;
  activo: boolean;
  panaderias?: Panaderia;
  profiles?: Profile;
  roles?: RolCustom | null;
};

export type SessionContext = {
  profile: Profile;
  panaderia: Panaderia;
  rol: UserRole;
  roleLabel: string;
  permisos: string[];
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
  encargable?: boolean;
  stock?: number;
  stock_minimo?: number;
  control_stock?: boolean;
  categorias?: Categoria;
};

export type Cliente = {
  id: string;
  panaderia_id: string;
  nombre: string;
  documento?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  notas?: string | null;
  activo?: boolean;
  created_at?: string;
  updated_at?: string;
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
  estado: "abierta" | "cerrada" | "cancelada";
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
  anulado?: boolean;
  turno_id?: string | null;
  factura_id?: string | null;
  registrado_por?: string | null;
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
  cliente_id?: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  fecha_entrega: string;
  fecha_envio?: string | null;
  fecha_acordada?: string | null;
  valor: number;
  estado: "pendiente" | "entregado" | "cobrado" | "cancelado";
  estado_pago?: "pendiente" | "abonado" | "pagado";
  abono?: number;
  producto_id?: string | null;
  notas: string | null;
  productos?: { id: string; nombre: string; precio: number } | null;
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

export type TurnoCaja = {
  id: string;
  panaderia_id: string;
  abierto_por: string;
  cerrado_por?: string | null;
  estado: "abierto" | "cerrado";
  apertura_at: string;
  cierre_at?: string | null;
  fondo_inicial: number;
  efectivo_contado?: number | null;
  electronico_contado?: number | null;
  notas_apertura?: string | null;
  notas_cierre?: string | null;
  detalle_apertura?: Record<string, number> | null;
  detalle_cierre?: Record<string, number> | null;
  esperado_efectivo?: number | null;
  esperado_electronico?: number | null;
  diferencia_efectivo?: number | null;
  diferencia_electronico?: number | null;
};

export type FacturaDetalleItem = {
  producto_id?: string;
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
};

export type Factura = {
  id: string;
  panaderia_id: string;
  numero: string;
  consecutivo: number;
  origen: "mostrador" | "mesa" | "encargo" | "manual";
  venta_id?: string | null;
  cuenta_mesa_id?: string | null;
  encargo_id?: string | null;
  cliente_id?: string | null;
  cliente_nombre: string;
  cliente_documento?: string | null;
  cliente_email?: string | null;
  cliente_direccion?: string | null;
  cliente_telefono?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  medio_pago?: MedioPago | null;
  detalle: FacturaDetalleItem[];
  notas?: string | null;
  emitida_por?: string | null;
  created_at: string;
};

/** Ruta del panel según tipo de notificación. */
export function notificationHref(tipo: string): string {
  switch (tipo) {
    case "encargo":
      return "/encargos";
    case "pedido":
    case "pedido_qr":
    case "qr":
      return "/cocina";
    case "mesa":
    case "cuenta":
      return "/mesas";
    case "recepcion":
      return "/recepciones";
    case "venta":
    case "caja":
      return "/caja";
    default:
      return "/dashboard";
  }
}

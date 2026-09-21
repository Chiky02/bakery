# BakeryChiky02

Sistema multitenant para panaderías: ventas de mostrador, mesas, cocina, encargos, recepción de proveedores, productos y reportes. Una persona puede tener o pertenecer a varias panaderías; cada una aísla catálogo, mesas y cuentas.

## Stack

- **App:** Next.js 16 (App Router) — Vercel
- **DB/Auth/Realtime:** Supabase
- **UI:** Tailwind CSS 4 (modo claro / oscuro)

## Configuración

### Migraciones (CLI)

```bash
npm run db:login
npx supabase link --project-ref TU_PROJECT_REF
npm run db:push
```

Eso aplica `supabase/migrations/*` al proyecto remoto. Luego `npm run seed`.

### Seguridad

- RLS por panadería (`miembros` + helpers `is_member` / `has_rol`)
- Materia prima (`tipo = materia_prima`) no sale en menú público QR
- Creación de usuarios solo dueño/admin vía API con service role
- Encargos públicos validados (fecha mínima) y notificaciones internas


### 2. Variables de entorno

```bash
cp .env.example .env
```

Completa con Project URL, anon key y service_role (Settings → API).

### 3. Seed

```bash
npm install
npm run seed
```

Crea la panadería **BakeryChiky02**, catálogo, mesas, usuarios y un proveedor demo.

### 4. Dev

```bash
npm run dev
```

## Multitenant

- Tabla `panaderias` = cada local/negocio
- Tabla `miembros` = usuario + rol **por panadería** (dueño, gerente, mostrador…)
- `profiles.plataforma_admin` = **admin de la plataforma** (SaaS): ve todos los negocios, cuentas Auth y altas de dueños. No es un rol de un local.
- `profiles.panaderia_activa_id` = panadería en uso
- Selector en el menú lateral; pantalla `/panaderias` para crear o cambiar

### Quién puede qué

| Actor | Alcance | Ejemplos |
|-------|---------|----------|
| Admin plataforma | Toda la app | `/negocios`, Usuarios → Cuentas Auth, Config → Alta de negocio |
| Dueño / Gerente | Solo su(s) local(es) | Equipo, productos, caja, reportes, config del negocio |
| Staff | Según rol del local | Mostrador, mesas, cocina… |

## Módulos

| Módulo | Ruta | Quién |
|--------|------|-------|
| Dashboard | `/dashboard` | todos (KPIs: dueño/gerente/admin plataforma; staff: atajos) |
| Mostrador | `/mostrador` | dueño, gerente, mostrador, caja |
| Mesas | `/mesas` | dueño, gerente, mesero, caja |
| Cocina | `/cocina` | dueño, gerente, cocina |
| Caja | `/caja` | dueño, gerente, caja |
| Encargos | `/encargos` | dueño, gerente, mostrador, mesero |
| Recepciones | `/recepciones` | dueño, gerente, mostrador, caja |
| Productos | `/productos` | dueño, gerente |
| Reportes | `/reportes` | dueño, gerente |
| Configuración | `/configuracion` | dueño, gerente (+ alta solo plataforma) |
| Usuarios (equipo) | `/usuarios` | dueño, gerente |
| Negocios | `/negocios` | **solo admin plataforma** |
| Mis panaderías | `/panaderias` | todos |
| Menú QR | `/qr/[mesaId]` | público |

El **admin de plataforma** puede simular cualquier rol (selector “Simular rol” en el menú) sin cerrar sesión: menú, dashboard y APIs respetan el rol simulado. Baner ámbar para salir.

## Usuarios de prueba (seed)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Dueño (local) | dueno@panaderiasissa.com | Sissa2026! |
| Admin plataforma | admin@panaderiasissa.com | Sissa2026! |
| Mostrador | mostrador@panaderiasissa.com | Sissa2026! |
| Mesero | mesero@panaderiasissa.com | Sissa2026! |
| Cocina | cocina@panaderiasissa.com | Sissa2026! |
| Caja | caja@panaderiasissa.com | Sissa2026! |

> Cambia estas contraseñas antes de producción.

## Tema

En el menú lateral (o header móvil): **Modo claro / Modo oscuro**. La preferencia se guarda en el navegador.

## Recepciones

En `/recepciones` puedes:

1. Registrar proveedores
2. Crear órdenes de compra / recepción con ítems y costos
3. Marcar la mercancía como recibida en la panadería

## Notas

- Las ventas en app son un subconjunto del negocio; la caja fiscal sigue aparte.
- Stock opcional por producto (`control_stock`): se descuenta en ventas de mostrador y al cerrar mesas; las recepciones suman inventario.
- Facturas de venta imprimibles (NIT, razón social, prefijo en Configuración): documento comercial, **no** factura electrónica DIAN. Emisión desde mostrador, cierre de mesa o Caja.
- Reportes y dashboard usan zona horaria America/Bogota y combinan mostrador + mesas cobradas + encargos + turnos de caja (filtro por fechas).
- Cerrar mesa en $0 / sin ítems libera la mesa como **cancelada** (no cuenta como venta).
- Tras desplegar, aplica migraciones con `npm run db:push` (stock, turnos de caja, facturas, cancelada).

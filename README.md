# BakeryChiky02

Sistema multitenant para panaderías: ventas de mostrador, mesas, cocina, encargos, recepción de proveedores, productos y reportes. Una persona puede tener o pertenecer a varias panaderías; cada una aísla catálogo, mesas y cuentas.

## Stack

- **App:** Next.js 16 (App Router) — Vercel
- **DB/Auth/Realtime:** Supabase
- **UI:** Tailwind CSS 4 (modo claro / oscuro)

## Configuración

### 1. Supabase

1. Crea el proyecto en [supabase.com](https://supabase.com)
2. En **SQL Editor**, ejecuta en orden:
   - `supabase/migrations/20240902120000_initial.sql`
   - `supabase/migrations/20260907000000_multitenant_recepciones.sql`
3. En **Authentication → URL Configuration**, agrega `http://localhost:3000` y tu URL de Vercel

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
- Tabla `miembros` = usuario + rol **por panadería**
- `profiles.panaderia_activa_id` = panadería en uso
- Selector en el menú lateral; pantalla `/panaderias` para crear o cambiar

## Módulos

| Módulo | Ruta | Roles |
|--------|------|-------|
| Dashboard | `/dashboard` | dueño, admin |
| Mostrador | `/mostrador` | dueño, admin, mostrador, caja |
| Mesas | `/mesas` | dueño, admin, mesero, caja |
| Cocina | `/cocina` | dueño, admin, cocina |
| Caja | `/caja` | dueño, admin, caja |
| Encargos | `/encargos` | dueño, admin, mostrador, mesero |
| Recepciones | `/recepciones` | dueño, admin, mostrador, caja |
| Productos | `/productos` | dueño, admin |
| Reportes | `/reportes` | dueño, admin |
| Configuración | `/configuracion` | dueño, admin |
| Usuarios | `/usuarios` | dueño, admin |
| Mis panaderías | `/panaderias` | todos |
| Menú QR | `/qr/[mesaId]` | público |

## Usuarios de prueba (seed)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Dueño | dueno@panaderiasissa.com | Sissa2026! |
| Admin | admin@panaderiasissa.com | Sissa2026! |
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
- Disponibilidad de producto = toggle, no inventario de unidades (las recepciones registran entrada, no stock automático aún).

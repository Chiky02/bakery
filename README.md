# Panadería Sissa

Sistema de ventas para panadería: calculadora de mostrador, mesas con división de cuenta, cocina en tiempo real, encargos, disponibilidad de productos y dashboard de flujo de ventas (no fiscal).

## Stack

- **Frontend/Backend:** Next.js 16 (App Router) — despliegue en Vercel
- **Base de datos:** Supabase (Postgres + Auth + Realtime)
- **Estilos:** Tailwind CSS 4

## Módulos

| Módulo | Ruta | Roles |
|--------|------|-------|
| Dashboard | `/dashboard` | dueño, admin |
| Mostrador | `/mostrador` | dueño, admin, mostrador, caja |
| Mesas | `/mesas` | dueño, admin, mesero, caja |
| Cocina | `/cocina` | dueño, admin, cocina |
| Caja | `/caja` | dueño, admin, caja |
| Encargos | `/encargos` | dueño, admin, mostrador, mesero |
| Productos | `/productos` | dueño, admin |
| Reportes | `/reportes` | dueño, admin |
| Configuración | `/configuracion` | dueño, admin |
| Menú QR | `/qr/[mesaId]` | público (anon) |

## Configuración

### 1. Crear proyecto en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. En **SQL Editor**, ejecuta el contenido de `supabase/migrations/20240902120000_initial.sql`
3. En **Authentication → URL Configuration**, agrega tu URL de Vercel y `http://localhost:3000`

### 2. Variables de entorno

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Completa con las claves de tu proyecto Supabase (Settings → API).

### 3. Sembrar datos del Excel

El archivo `supabase/seed-data.json` contiene **116 productos** y **6 categorías** extraídos de `Panaderi Sissa.xlsx`, más 10 mesas y usuarios de prueba.

```bash
npm run seed
```

### 4. Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

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

## Pedido por QR

1. Activa **Pedido directo por QR** en Configuración
2. Genera un QR con la URL: `https://tu-dominio.vercel.app/qr/[id-de-mesa]`
3. Opcional: activa **Mesero como filtro** para que pedidos QR requieran aprobación

## Notas

- Las ventas registradas en la app son un **subconjunto** del negocio real; la caja fiscal sigue siendo manual.
- La disponibilidad de productos es un toggle (disponible/agotado), sin inventario de unidades.
- Realtime sincroniza cocina, mesas y cuentas entre paneles.

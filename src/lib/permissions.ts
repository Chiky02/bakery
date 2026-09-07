import type { UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  dueno: "Dueño",
  admin: "Administrador",
  mostrador: "Mostrador",
  mesero: "Mesero",
  cocina: "Cocina",
  caja: "Caja",
};

export const NAV_ITEMS: {
  href: string;
  label: string;
  icon: string;
  roles: UserRole[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", roles: ["dueno", "admin"] },
  { href: "/mostrador", label: "Mostrador", icon: "🧮", roles: ["dueno", "admin", "mostrador", "caja"] },
  { href: "/mesas", label: "Mesas", icon: "🪑", roles: ["dueno", "admin", "mesero", "caja"] },
  { href: "/cocina", label: "Cocina", icon: "👨‍🍳", roles: ["dueno", "admin", "cocina"] },
  { href: "/caja", label: "Caja", icon: "💰", roles: ["dueno", "admin", "caja"] },
  { href: "/encargos", label: "Encargos", icon: "📦", roles: ["dueno", "admin", "mostrador", "mesero"] },
  {
    href: "/recepciones",
    label: "Recepciones",
    icon: "🚚",
    roles: ["dueno", "admin", "mostrador", "caja"],
  },
  { href: "/productos", label: "Productos", icon: "🥐", roles: ["dueno", "admin"] },
  { href: "/reportes", label: "Reportes", icon: "📈", roles: ["dueno", "admin"] },
  { href: "/configuracion", label: "Configuración", icon: "⚙️", roles: ["dueno", "admin"] },
  { href: "/usuarios", label: "Usuarios", icon: "👥", roles: ["dueno", "admin"] },
  { href: "/panaderias", label: "Mis panaderías", icon: "🏪", roles: ["dueno", "admin", "mostrador", "mesero", "cocina", "caja"] },
];

export function canAccess(rol: UserRole, href: string): boolean {
  const item = NAV_ITEMS.find((n) => href.startsWith(n.href));
  if (!item) return rol === "dueno" || rol === "admin";
  return item.roles.includes(rol);
}

export function navForRole(rol: UserRole) {
  return NAV_ITEMS.filter((n) => n.roles.includes(rol));
}

export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

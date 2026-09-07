import type { UserRole } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Calculator,
  Armchair,
  ChefHat,
  Wallet,
  Package,
  Truck,
  Croissant,
  Wheat,
  BarChart3,
  Settings,
  Users,
  Store,
  Building2,
} from "lucide-react";

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
  icon: LucideIcon;
  roles: UserRole[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["dueno", "admin"] },
  { href: "/mostrador", label: "Mostrador", icon: Calculator, roles: ["dueno", "admin", "mostrador", "caja"] },
  { href: "/mesas", label: "Mesas", icon: Armchair, roles: ["dueno", "admin", "mesero", "caja"] },
  { href: "/cocina", label: "Cocina", icon: ChefHat, roles: ["dueno", "admin", "cocina"] },
  { href: "/caja", label: "Caja", icon: Wallet, roles: ["dueno", "admin", "caja"] },
  { href: "/encargos", label: "Encargos", icon: Package, roles: ["dueno", "admin", "mostrador", "mesero"] },
  {
    href: "/recepciones",
    label: "Recepciones",
    icon: Truck,
    roles: ["dueno", "admin", "mostrador", "caja"],
  },
  { href: "/productos", label: "Productos", icon: Croissant, roles: ["dueno", "admin"] },
  {
    href: "/insumos",
    label: "Materia prima",
    icon: Wheat,
    roles: ["dueno", "admin", "mostrador", "caja"],
  },
  { href: "/reportes", label: "Reportes", icon: BarChart3, roles: ["dueno", "admin"] },
  { href: "/usuarios", label: "Usuarios", icon: Users, roles: ["dueno", "admin"] },
  { href: "/negocios", label: "Negocios", icon: Building2, roles: ["dueno", "admin"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["dueno", "admin"] },
  {
    href: "/panaderias",
    label: "Mis panaderías",
    icon: Store,
    roles: ["dueno", "admin", "mostrador", "mesero", "cocina", "caja"],
  },
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

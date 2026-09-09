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
  TableProperties,
  FileText,
  Contact,
  Boxes,
} from "lucide-react";

export const ROLE_LABELS: Record<UserRole, string> = {
  dueno: "Dueño",
  admin: "Administrador",
  mostrador: "Mostrador",
  mesero: "Mesero",
  cocina: "Cocina",
  caja: "Caja",
};

/** Claves de funcionalidad del panel (menú). */
export const FEATURE_PERMISOS: {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  defaultRoles: UserRole[];
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    defaultRoles: ["dueno", "admin"],
  },
  {
    key: "mostrador",
    label: "Mostrador",
    href: "/mostrador",
    icon: Calculator,
    defaultRoles: ["dueno", "admin", "mostrador", "caja"],
  },
  {
    key: "mesas_gestion",
    label: "Gestionar mesas",
    href: "/mesas/gestion",
    icon: TableProperties,
    defaultRoles: ["dueno", "admin"],
  },
  {
    key: "mesas",
    label: "Mesas",
    href: "/mesas",
    icon: Armchair,
    defaultRoles: ["dueno", "admin", "mesero", "caja"],
  },
  {
    key: "cocina",
    label: "Cocina",
    href: "/cocina",
    icon: ChefHat,
    defaultRoles: ["dueno", "admin", "cocina"],
  },
  {
    key: "caja",
    label: "Caja",
    href: "/caja",
    icon: Wallet,
    defaultRoles: ["dueno", "admin", "caja"],
  },
  {
    key: "facturas",
    label: "Facturas",
    href: "/facturas",
    icon: FileText,
    defaultRoles: ["dueno", "admin", "caja", "mostrador"],
  },
  {
    key: "encargos",
    label: "Encargos",
    href: "/encargos",
    icon: Package,
    defaultRoles: ["dueno", "admin", "mostrador", "mesero"],
  },
  {
    key: "clientes",
    label: "Clientes",
    href: "/clientes",
    icon: Contact,
    defaultRoles: ["dueno", "admin", "mostrador", "mesero", "caja"],
  },
  {
    key: "recepciones",
    label: "Recepciones",
    href: "/recepciones",
    icon: Truck,
    defaultRoles: ["dueno", "admin", "mostrador", "caja"],
  },
  {
    key: "productos",
    label: "Productos",
    href: "/productos",
    icon: Croissant,
    defaultRoles: ["dueno", "admin"],
  },
  {
    key: "insumos",
    label: "Materia prima",
    href: "/insumos",
    icon: Wheat,
    defaultRoles: ["dueno", "admin", "mostrador", "caja"],
  },
  {
    key: "inventario",
    label: "Inventario",
    href: "/inventario",
    icon: Boxes,
    defaultRoles: ["dueno", "admin", "caja"],
  },
  {
    key: "reportes",
    label: "Reportes",
    href: "/reportes",
    icon: BarChart3,
    defaultRoles: ["dueno", "admin"],
  },
  {
    key: "usuarios",
    label: "Usuarios",
    href: "/usuarios",
    icon: Users,
    defaultRoles: ["dueno", "admin"],
  },
  {
    key: "negocios",
    label: "Negocios",
    href: "/negocios",
    icon: Building2,
    defaultRoles: ["dueno", "admin"],
  },
  {
    key: "configuracion",
    label: "Configuración",
    href: "/configuracion",
    icon: Settings,
    defaultRoles: ["dueno", "admin", "mostrador", "mesero", "cocina", "caja"],
  },
  {
    key: "panaderias",
    label: "Mis panaderías",
    href: "/panaderias",
    icon: Store,
    defaultRoles: ["dueno", "admin", "mostrador", "mesero", "cocina", "caja"],
  },
];

export const NAV_ITEMS = FEATURE_PERMISOS.map((f) => ({
  href: f.href,
  label: f.label,
  icon: f.icon,
  roles: f.defaultRoles,
  key: f.key,
}));

export function defaultPermisosForRole(rol: UserRole): string[] {
  return FEATURE_PERMISOS.filter((f) => f.defaultRoles.includes(rol)).map((f) => f.key);
}

export function canAccess(rol: UserRole, href: string, permisos?: string[] | null): boolean {
  const item = [...FEATURE_PERMISOS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => href === n.href || href.startsWith(`${n.href}/`));
  if (!item) return rol === "dueno" || rol === "admin";
  if (permisos && permisos.length > 0) return permisos.includes(item.key);
  return item.defaultRoles.includes(rol);
}

export function navForRole(rol: UserRole, permisos?: string[] | null) {
  if (permisos && permisos.length > 0) {
    return FEATURE_PERMISOS.filter((n) => permisos.includes(n.key)).map((n) => ({
      href: n.href,
      label: n.label,
      icon: n.icon,
      key: n.key,
    }));
  }
  return FEATURE_PERMISOS.filter((n) => n.defaultRoles.includes(rol)).map((n) => ({
    href: n.href,
    label: n.label,
    icon: n.icon,
    key: n.key,
  }));
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

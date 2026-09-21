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
  ScrollText,
} from "lucide-react";

export const ROLE_LABELS: Record<UserRole, string> = {
  dueno: "Dueño",
  /** Gerente operativo del local (tenant). No es admin de plataforma. */
  admin: "Gerente",
  mostrador: "Mostrador",
  mesero: "Mesero",
  cocina: "Cocina",
  caja: "Caja",
};

/** Módulos exclusivos del admin de plataforma (no van en roles de panadería). */
export const PLATFORM_FEATURE_KEYS = ["negocios", "terminos"] as const;

export function isPlatformFeature(key: string): boolean {
  return (PLATFORM_FEATURE_KEYS as readonly string[]).includes(key);
}

/** Claves de funcionalidad del panel (menú). */
export const FEATURE_PERMISOS: {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  defaultRoles: UserRole[];
  /** Solo profiles.plataforma_admin */
  platformOnly?: boolean;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    defaultRoles: ["dueno", "admin", "mostrador", "mesero", "cocina", "caja"],
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
    defaultRoles: [],
    platformOnly: true,
  },
  {
    key: "terminos",
    label: "Términos",
    href: "/terminos",
    icon: ScrollText,
    defaultRoles: [],
    platformOnly: true,
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

/** Permisos asignables a roles de un local (sin módulos de plataforma). */
export const TENANT_FEATURE_PERMISOS = FEATURE_PERMISOS.filter((f) => !f.platformOnly);

export const NAV_ITEMS = FEATURE_PERMISOS.map((f) => ({
  href: f.href,
  label: f.label,
  icon: f.icon,
  roles: f.defaultRoles,
  key: f.key,
}));

export function defaultPermisosForRole(rol: UserRole): string[] {
  return FEATURE_PERMISOS.filter(
    (f) => !f.platformOnly && f.defaultRoles.includes(rol),
  ).map((f) => f.key);
}

export type AccessOpts = {
  plataformaAdmin?: boolean;
};

export function canAccess(
  rol: UserRole,
  href: string,
  permisos?: string[] | null,
  opts?: AccessOpts,
): boolean {
  const item = [...FEATURE_PERMISOS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => href === n.href || href.startsWith(`${n.href}/`));
  if (!item) return rol === "dueno" || rol === "admin" || !!opts?.plataformaAdmin;
  if (item.platformOnly) return !!opts?.plataformaAdmin;
  if (permisos && permisos.length > 0) {
    if (item.key === "negocios" || item.key === "terminos") return !!opts?.plataformaAdmin;
    return permisos.includes(item.key);
  }
  return item.defaultRoles.includes(rol);
}

export function navForRole(
  rol: UserRole,
  permisos?: string[] | null,
  opts?: AccessOpts,
) {
  return FEATURE_PERMISOS.filter((n) => {
    if (n.platformOnly) return !!opts?.plataformaAdmin;
    if (permisos && permisos.length > 0) {
      return permisos.includes(n.key) && !isPlatformFeature(n.key);
    }
    return n.defaultRoles.includes(rol);
  }).map((n) => ({
    href: n.href,
    label: n.label,
    icon: n.icon,
    key: n.key,
  }));
}

/** Une permisos de tenant + módulos de plataforma si aplica. */
export function resolveSessionPermisos(
  rol: UserRole,
  customPermisos: string[] | null | undefined,
  plataformaAdmin: boolean,
): string[] {
  let base =
    customPermisos && customPermisos.length > 0
      ? customPermisos.filter((p) => !isPlatformFeature(p))
      : defaultPermisosForRole(rol);
  // Hub de inicio: todos los roles llegan al dashboard (KPIs o atajos).
  if (!base.includes("dashboard")) {
    base = ["dashboard", ...base];
  }
  if (plataformaAdmin && !base.includes("negocios")) {
    base = [...base, "negocios"];
  }
  if (plataformaAdmin && !base.includes("terminos")) {
    base = [...base, "terminos"];
  }
  return base;
}

export const USER_ROLES: UserRole[] = [
  "dueno",
  "admin",
  "mostrador",
  "mesero",
  "cocina",
  "caja",
];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as string[]).includes(value);
}

/** Roles de gestión: ven KPIs en el dashboard. */
export function isManagementRole(rol: UserRole): boolean {
  return rol === "dueno" || rol === "admin";
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

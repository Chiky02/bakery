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

export type FeaturePermiso = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  defaultRoles: UserRole[];
  /** Solo profiles.plataforma_admin */
  platformOnly?: boolean;
  /**
   * false = no va al menú lateral; sí aparece en roles / pestañas.
   * Por defecto true.
   */
  nav?: boolean;
};

const ALL_STAFF: UserRole[] = ["dueno", "admin", "mostrador", "mesero", "cocina", "caja"];
const OPS_CLIENTES: UserRole[] = ["dueno", "admin", "mostrador", "mesero", "caja"];
const OPS_ENCARGOS: UserRole[] = ["dueno", "admin", "mostrador", "mesero"];
const OPS_RECEPCIONES: UserRole[] = ["dueno", "admin", "mostrador", "caja"];
const OPS_INSUMOS: UserRole[] = ["dueno", "admin", "mostrador", "caja"];
const GESTION: UserRole[] = ["dueno", "admin"];

/** Claves de funcionalidad del panel (menú + subpermisos listado/crear). */
export const FEATURE_PERMISOS: FeaturePermiso[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    defaultRoles: ALL_STAFF,
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
    defaultRoles: GESTION,
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
    defaultRoles: OPS_ENCARGOS,
  },
  {
    key: "encargos_crear",
    label: "Encargos · Crear",
    href: "/encargos",
    icon: Package,
    defaultRoles: OPS_ENCARGOS,
    nav: false,
  },
  {
    key: "clientes",
    label: "Clientes",
    href: "/clientes",
    icon: Contact,
    defaultRoles: OPS_CLIENTES,
  },
  {
    key: "clientes_crear",
    label: "Clientes · Crear",
    href: "/clientes",
    icon: Contact,
    defaultRoles: OPS_CLIENTES,
    nav: false,
  },
  {
    key: "recepciones",
    label: "Recepciones",
    href: "/recepciones",
    icon: Truck,
    defaultRoles: OPS_RECEPCIONES,
  },
  {
    key: "recepciones_crear",
    label: "Recepciones · Crear",
    href: "/recepciones",
    icon: Truck,
    defaultRoles: OPS_RECEPCIONES,
    nav: false,
  },
  {
    key: "recepciones_proveedores",
    label: "Recepciones · Proveedores",
    href: "/recepciones",
    icon: Truck,
    defaultRoles: OPS_RECEPCIONES,
    nav: false,
  },
  {
    key: "productos",
    label: "Productos",
    href: "/productos",
    icon: Croissant,
    defaultRoles: GESTION,
  },
  {
    key: "productos_crear",
    label: "Productos · Crear",
    href: "/productos",
    icon: Croissant,
    defaultRoles: GESTION,
    nav: false,
  },
  {
    key: "productos_categorias",
    label: "Productos · Categorías",
    href: "/productos",
    icon: Croissant,
    defaultRoles: GESTION,
    nav: false,
  },
  {
    key: "insumos",
    label: "Materia prima",
    href: "/insumos",
    icon: Wheat,
    defaultRoles: OPS_INSUMOS,
  },
  {
    key: "insumos_crear",
    label: "Materia prima · Crear",
    href: "/insumos",
    icon: Wheat,
    defaultRoles: OPS_INSUMOS,
    nav: false,
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
    defaultRoles: GESTION,
  },
  {
    key: "usuarios",
    label: "Usuarios",
    href: "/usuarios",
    icon: Users,
    defaultRoles: GESTION,
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
    defaultRoles: ALL_STAFF,
  },
  {
    key: "panaderias",
    label: "Mis panaderías",
    href: "/panaderias",
    icon: Store,
    defaultRoles: ALL_STAFF,
  },
];

/** Permisos asignables a roles de un local (sin módulos de plataforma). */
export const TENANT_FEATURE_PERMISOS = FEATURE_PERMISOS.filter((f) => !f.platformOnly);

export const NAV_ITEMS = FEATURE_PERMISOS.filter((f) => f.nav !== false).map((f) => ({
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

/** ¿Tiene la clave de permiso (lista custom o defaults del rol)? */
export function hasPermiso(
  key: string,
  permisos?: string[] | null,
  rol?: UserRole,
): boolean {
  if (permisos && permisos.length > 0) return permisos.includes(key);
  if (rol) {
    const f = FEATURE_PERMISOS.find((x) => x.key === key);
    return !!f && !f.platformOnly && f.defaultRoles.includes(rol);
  }
  return false;
}

function featuresForHref(href: string): FeaturePermiso[] {
  const matched = FEATURE_PERMISOS.filter(
    (n) => href === n.href || href.startsWith(`${n.href}/`),
  );
  if (matched.length === 0) return [];
  const maxLen = Math.max(...matched.map((m) => m.href.length));
  return matched.filter((m) => m.href.length === maxLen);
}

export function canAccess(
  rol: UserRole,
  href: string,
  permisos?: string[] | null,
  opts?: AccessOpts,
): boolean {
  const group = featuresForHref(href);
  if (group.length === 0) {
    return rol === "dueno" || rol === "admin" || !!opts?.plataformaAdmin;
  }
  if (group.some((g) => g.platformOnly)) {
    return !!opts?.plataformaAdmin;
  }
  if (permisos && permisos.length > 0) {
    return group.some((g) => {
      if (g.key === "negocios" || g.key === "terminos") return !!opts?.plataformaAdmin;
      return permisos.includes(g.key);
    });
  }
  return group.some((g) => g.defaultRoles.includes(rol));
}

export function navForRole(
  rol: UserRole,
  permisos?: string[] | null,
  opts?: AccessOpts,
) {
  return FEATURE_PERMISOS.filter((n) => {
    if (n.nav === false) return false;
    if (n.platformOnly) return !!opts?.plataformaAdmin;
    const siblings = FEATURE_PERMISOS.filter((s) => s.href === n.href);
    if (permisos && permisos.length > 0) {
      return siblings.some((s) => permisos.includes(s.key) && !isPlatformFeature(s.key));
    }
    return siblings.some((s) => s.defaultRoles.includes(rol));
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

import { cookies } from "next/headers";
import type { UserRole } from "@/types";
import { isUserRole } from "@/lib/permissions";

/** Cookie unificada: `rol:<role>` | `user:<userId>:<panaderiaId>` */
export const IMPERSONATE_COOKIE = "sissa_impersonate";
/** Compatibilidad con cookie anterior solo-rol */
const LEGACY_ROL_COOKIE = "sissa_impersonate_rol";

export type ImpersonationState =
  | { kind: "rol"; rol: UserRole }
  | { kind: "user"; userId: string; panaderiaId: string };

function parseCookie(raw: string): ImpersonationState | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("rol:")) {
    const rol = value.slice(4);
    if (isUserRole(rol)) return { kind: "rol", rol };
    return null;
  }

  if (value.startsWith("user:")) {
    const rest = value.slice(5);
    const [userId, panaderiaId] = rest.split(":");
    if (
      userId &&
      panaderiaId &&
      /^[0-9a-f-]{36}$/i.test(userId) &&
      /^[0-9a-f-]{36}$/i.test(panaderiaId)
    ) {
      return { kind: "user", userId, panaderiaId };
    }
    return null;
  }

  // Legacy: solo el nombre del rol
  if (isUserRole(value)) return { kind: "rol", rol: value };
  return null;
}

function serialize(state: ImpersonationState): string {
  if (state.kind === "rol") return `rol:${state.rol}`;
  return `user:${state.userId}:${state.panaderiaId}`;
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 12,
};

export async function readImpersonation(): Promise<ImpersonationState | null> {
  const jar = await cookies();
  const raw = jar.get(IMPERSONATE_COOKIE)?.value ?? jar.get(LEGACY_ROL_COOKIE)?.value ?? "";
  return parseCookie(raw);
}

/** @deprecated prefer readImpersonation */
export async function readImpersonateRol(): Promise<UserRole | null> {
  const state = await readImpersonation();
  return state?.kind === "rol" ? state.rol : null;
}

export async function setImpersonation(state: ImpersonationState | null): Promise<void> {
  const jar = await cookies();
  jar.delete(LEGACY_ROL_COOKIE);
  if (!state) {
    jar.delete(IMPERSONATE_COOKIE);
    return;
  }
  jar.set(IMPERSONATE_COOKIE, serialize(state), cookieOpts);
}

/** @deprecated prefer setImpersonation */
export async function setImpersonateRol(rol: UserRole | null): Promise<void> {
  if (!rol) {
    await setImpersonation(null);
    return;
  }
  await setImpersonation({ kind: "rol", rol });
}

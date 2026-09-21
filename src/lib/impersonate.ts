import { cookies } from "next/headers";
import type { UserRole } from "@/types";
import { isUserRole } from "@/lib/permissions";

export const IMPERSONATE_COOKIE = "sissa_impersonate_rol";

export async function readImpersonateRol(): Promise<UserRole | null> {
  const jar = await cookies();
  const raw = jar.get(IMPERSONATE_COOKIE)?.value?.trim() ?? "";
  if (!raw || !isUserRole(raw)) return null;
  return raw;
}

export async function setImpersonateRol(rol: UserRole | null): Promise<void> {
  const jar = await cookies();
  if (!rol) {
    jar.delete(IMPERSONATE_COOKIE);
    return;
  }
  jar.set(IMPERSONATE_COOKIE, rol, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
}

import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/types";
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { canAccess, FEATURE_PERMISOS } from "@/lib/permissions";

export async function requireApiContext(): Promise<
  { ctx: SessionContext; supabase: Awaited<ReturnType<typeof createClient>> } | NextResponse
> {
  const supabase = await createClient();
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Sin panadería activa" }, { status: 401 });
  }
  return { ctx, supabase };
}

/** Exige permiso de módulo (misma clave que el menú). */
export async function requireApiFeature(
  featureKey: string,
): Promise<
  { ctx: SessionContext; supabase: Awaited<ReturnType<typeof createClient>> } | NextResponse
> {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;
  const feature = FEATURE_PERMISOS.find((f) => f.key === featureKey);
  const href = feature?.href ?? `/${featureKey}`;
  if (!canAccess(ctx.rol, href, ctx.permisos)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  return { ctx, supabase };
}

export function assertRoles(
  ctx: SessionContext,
  roles: SessionContext["rol"][],
): NextResponse | null {
  if (!roles.includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  return null;
}

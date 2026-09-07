import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/types";
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";

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

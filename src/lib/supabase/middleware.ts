import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function readEnv(name: string) {
  return process.env[name]?.trim().replace(/^["']|["']$/g, "") ?? "";
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!/^https?:\/\//i.test(supabaseUrl) || !supabaseAnonKey) {
    console.error("Supabase env inválida en middleware", {
      hasUrl: Boolean(supabaseUrl),
      urlLooksLikeHttp: /^https?:\/\//i.test(supabaseUrl),
      hasAnonKey: Boolean(supabaseAnonKey),
    });
    return new NextResponse(
      "Falta NEXT_PUBLIC_SUPABASE_URL (debe ser https://xxxx.supabase.co) o NEXT_PUBLIC_SUPABASE_ANON_KEY. Revísalas en Vercel → Settings → Environment Variables y vuelve a desplegar.",
      { status: 500 },
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path === "/login" ||
    path === "/encargar" ||
    path === "/aceptar-terminos" ||
    path.startsWith("/qr") ||
    path.startsWith("/api/qr") ||
    path.startsWith("/api/public");

  if (!user && !isPublic && !path.startsWith("/api/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/aceptar-terminos")) {
    const dest = await postAuthPath(supabase, user.id);
    if (path !== dest) {
      return redirectKeepingSession(request, supabaseResponse, dest);
    }
  }

  return supabaseResponse;
}

/** Si ya aceptó, va al panel. Los términos solo se muestran cuando falta aceptar. */
async function postAuthPath(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<"/dashboard" | "/aceptar-terminos"> {
  const { data: vigente, error: versionError } = await supabase
    .from("terminos_versiones")
    .select("id")
    .eq("vigente", true)
    .maybeSingle();

  if (versionError || !vigente?.id) return "/dashboard";

  const { data: accepted, error: acceptError } = await supabase
    .from("terminos_aceptaciones")
    .select("id")
    .eq("user_id", userId)
    .eq("terminos_version_id", vigente.id)
    .maybeSingle();

  if (acceptError?.message?.includes("terminos_aceptaciones") || accepted) return "/dashboard";
  return "/aceptar-terminos";
}

function redirectKeepingSession(request: NextRequest, session: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  session.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

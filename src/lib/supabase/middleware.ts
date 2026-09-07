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
    path === "/login" ||
    path.startsWith("/qr") ||
    path.startsWith("/api/qr");

  if (!user && !isPublic && !path.startsWith("/api/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

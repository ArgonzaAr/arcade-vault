import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

const DEFAULT_NEXT = "/biblioteca";

// Solo rutas relativas del propio sitio: empiezan por "/" y no por "//".
// Además se comprueba el origin resultante, porque el parser de URL trata
// "\" como "/" y "/\evil.com" acabaría en otro host.
function safeNext(next: string | null, origin: string): URL {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    const url = new URL(next, origin);
    if (url.origin === origin) return url;
  }
  return new URL(DEFAULT_NEXT, origin);
}

// Destino de los enlaces de confirmación y de recuperación (SPEC 12).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(safeNext(searchParams.get("next"), origin));
    }
  }

  return NextResponse.redirect(new URL("/auth?error=callback", origin));
}

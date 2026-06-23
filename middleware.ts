import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset",
  "/check-email",
  "/auth/callback",
  "/terms",
  "/privacy",
  "/disclaimer",
  // NOTE: "/track-record" is intentionally NOT public yet. The page is built, but
  // current self-scored numbers (~37% directional, miscalibrated confidence on a
  // ~60 sample) would hurt more than help as public marketing. Re-add here to make
  // it public once the forecaster's track record is worth showing.
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  // The root path is the public marketing landing. Match it exactly (a
  // startsWith("/") check would make every route public).
  const isRoot = path === "/";
  const isPublic = isRoot || PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Unauthenticated: only allow public paths
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Authenticated: skip login/signup/landing and go straight to the dashboard.
  if (user && (path === "/login" || path === "/signup" || isRoot)) {
    return NextResponse.redirect(new URL("/terminal", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
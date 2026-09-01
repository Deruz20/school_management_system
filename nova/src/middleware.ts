import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/students", "/attendance", "/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lightweight check: Is the user trying to access a protected route?
  const isProtected = PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected) {
    const session = request.cookies.get("nova_session");
    
    // If no session cookie exists, redirect to login
    if (!session?.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (auth routes)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
};

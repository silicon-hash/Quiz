import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/", "/profile", "/test/*", "/topics/*"];
const loginRoute = "/login";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req: req as any,
    secret: process.env.AUTH_SECRET || "SECR3T",
  });

  const { pathname } = req.nextUrl;

  if (token && pathname === loginRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!token && protectedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL(loginRoute, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

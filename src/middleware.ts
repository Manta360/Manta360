import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
  ROLE_HOME,
  isRole,
  roleAllowedForPath,
  type Role,
} from "@/lib/roles";
import { SESSION_COOKIE } from "@/lib/session";

async function readRole(request: NextRequest): Promise<Role | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );
    const role =
      typeof payload.role === "string" && isRole(payload.role)
        ? payload.role
        : null;
    return role;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = await readRole(request);
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/registro");
  const isPanel = pathname.startsWith("/panel");

  if (isAuthPage && role) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  if (isPanel) {
    if (!role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!roleAllowedForPath(role, pathname)) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/registro", "/panel/:path*"],
};

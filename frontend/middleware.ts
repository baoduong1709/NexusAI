import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicPaths = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for token in cookies (more secure) or allow client-side auth check
  // Since the app currently uses localStorage for auth,
  // this middleware serves as a lightweight server-side guard.
  // The token cookie is set alongside localStorage for SSR compatibility.
  const token = request.cookies.get('nexusai_token')?.value;

  // If no token cookie, redirect to login
  // Note: The client-side AuthProvider will also redirect on missing localStorage token
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files, API routes, and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|login|api).*)',
  ],
};

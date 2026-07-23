// NEXUS-P4-001: Access Code Middleware
// Simple code-based protection for production environment

import { NextRequest, NextResponse } from 'next/server'

// Routes that don't need protection (API health checks, etc.)
const PUBLIC_ROUTES = ['/api/health', '/_next', '/favicon.ico']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes and static files
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Only require access code in production
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next()
  }

  // Get access code from environment
  const requiredCode = process.env.ACCESS_CODE

  // If no access code configured, allow access (admin responsibility)
  if (!requiredCode) {
    return NextResponse.next()
  }

  // Check for access code in multiple places
  const codeFromCookie = request.cookies.get('nexus-access')?.value
  const codeFromHeader = request.headers.get('x-access-code')
  const codeFromQuery = request.nextUrl.searchParams.get('code')

  // If code matches any source, set cookie and proceed
  if (codeFromCookie === requiredCode || codeFromHeader === requiredCode || codeFromQuery === requiredCode) {
    const response = NextResponse.next()
    response.cookies.set('nexus-access', requiredCode, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return response
  }

  // If already has valid cookie, allow
  if (codeFromCookie === requiredCode) {
    return NextResponse.next()
  }

  // No valid code found — redirect to access page
  if (pathname !== '/access') {
    return NextResponse.redirect(new URL('/access', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}

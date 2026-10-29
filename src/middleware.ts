import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import type { UserRole } from '@/types';
import { error as apiError } from '@/lib/response';

export interface TokenPayload {
  userId: string;
  phone: string;
  role: UserRole;
  fullName?: string;
  [key: string]: unknown;
}

const AUTH_COOKIE_NAME = 'auth_token';
const FALLBACK_COOKIE_NAME = 'token';

// Routes that do not require authentication
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/config/public',
  '/api/cutoffs/next',
  '/api/webhooks',
  '/api/cron',
];

// Verify JWT token using jose
async function verifyAuthToken(req: NextRequest): Promise<TokenPayload | null> {
  const token =
    req.cookies.get(AUTH_COOKIE_NAME)?.value ||
    req.cookies.get(FALLBACK_COOKIE_NAME)?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) return null;

  try {
    const secretKey = new TextEncoder().encode(
      process.env.JWT_SECRET || 'dev-jwt-secret-must-be-at-least-32-characters-long-for-testing'
    );
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow public paths without authentication
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  const authUser = await verifyAuthToken(req);

  // 2. Redirect authenticated users away from guest auth pages
  if (authUser && (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password')) {
    if (authUser.role === 'DEVELOPER' || authUser.role === 'BAKERY_ADMIN') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    if (authUser.role === 'RUNNER') {
      return NextResponse.redirect(new URL('/ops/runner', req.url));
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 3. Unauthenticated requests to protected endpoints
  if (!authUser) {
    if (pathname.startsWith('/api/')) {
      return apiError('UNAUTHORIZED');
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Role Gates
  // Gate: DEVELOPER ONLY (/admin/developer/* and /api/admin/developer/*)
  if (pathname.startsWith('/admin/developer') || pathname.startsWith('/api/admin/developer')) {
    if (authUser.role !== 'DEVELOPER') {
      if (pathname.startsWith('/api/')) {
        return apiError('FORBIDDEN');
      }
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }

  // Gate: BAKERY_ADMIN & DEVELOPER (/admin/* and /api/admin/*)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (authUser.role !== 'BAKERY_ADMIN' && authUser.role !== 'DEVELOPER') {
      if (pathname.startsWith('/api/')) {
        return apiError('FORBIDDEN');
      }
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Gate: RUNNER, BAKERY_ADMIN & DEVELOPER (/ops/* and /api/ops/*)
  if (pathname.startsWith('/ops') || pathname.startsWith('/api/ops')) {
    if (authUser.role !== 'RUNNER' && authUser.role !== 'BAKERY_ADMIN' && authUser.role !== 'DEVELOPER') {
      if (pathname.startsWith('/api/')) {
        return apiError('FORBIDDEN');
      }
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // 5. Pass through with authenticated user context in request headers for route handlers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', authUser.userId);
  requestHeaders.set('x-user-role', authUser.role);
  requestHeaders.set('x-user-phone', authUser.phone);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images and asset extensions (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

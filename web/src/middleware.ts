import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getAuthorizedUsers(): Map<string, string> {
  const users = new Map<string, string>();
  const envUsers = process.env.ALLOWED_USERS || '';

  if (!envUsers) {
    console.warn('⚠️ ALLOWED_USERS non défini - authentification désactivée');
    return users;
  }

  envUsers.split(',').forEach((pair) => {
    const [username, password] = pair.split(':');
    if (username && password) {
      users.set(username.trim(), password.trim());
    }
  });

  return users;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function validateCredentials(authHeader: string | null): boolean {
  const users = getAuthorizedUsers();

  if (users.size === 0 && process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const sep = credentials.indexOf(':');
    if (sep === -1) return false;
    const username = credentials.slice(0, sep);
    const password = credentials.slice(sep + 1);

    const expected = users.get(username);
    if (!expected) return false;
    return safeEqual(expected, password);
  } catch {
    return false;
  }
}

function unauthorized(): NextResponse {
  return new NextResponse('Authentification requise', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="LeadFlow - Accès restreint"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/_next') || pathname === '/api/health') {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');

  if (!validateCredentials(authHeader)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|svg|webp|css|js|woff2?|map)$).*)'],
};

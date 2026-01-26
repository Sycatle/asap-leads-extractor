import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Users autorisés (définis dans .env.local)
// Format: ALLOWED_USERS=user1:password1,user2:password2
function getAuthorizedUsers(): Map<string, string> {
  const users = new Map<string, string>();
  const envUsers = process.env.ALLOWED_USERS || '';
  
  if (!envUsers) {
    // Fallback si pas de variable d'env (dev uniquement)
    console.warn('⚠️ ALLOWED_USERS non défini - authentification désactivée');
    return users;
  }

  envUsers.split(',').forEach(pair => {
    const [username, password] = pair.split(':');
    if (username && password) {
      users.set(username.trim(), password.trim());
    }
  });

  return users;
}

function validateCredentials(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const users = getAuthorizedUsers();
  
  // En dev sans config, on laisse passer
  if (users.size === 0 && process.env.NODE_ENV === 'development') {
    return true;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    return users.get(username) === password;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  // Toujours autoriser les fichiers statiques et les assets
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // fichiers statiques (.ico, .svg, etc.)
  ) {
    return NextResponse.next();
  }

  // Vérifier l'authentification
  const authHeader = request.headers.get('authorization');

  if (!validateCredentials(authHeader)) {
    return new NextResponse('Authentification requise', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="LeadFlow - Accès restreint"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};

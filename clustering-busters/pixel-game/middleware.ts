// Vercel Routing Middleware: the whole site is behind one password (HTTP basic auth).
// It runs on Vercel before the cache, for every path: the page, the JS bundle, /media.
// Without the password nobody receives the game's code. Any user name works.
//
// Then the page: everything is one page (index.html: your name, the game, the story, the
// leaderboard, the odds), served at /. Old /play links land on it, at the game.
//
// The password is the GAME_PASSWORD environment variable on Vercel (never in the repo).
// Not set = the site stays closed (fail closed). Local `npm run dev` does not use this file.
import { next } from '@vercel/functions';

// Vercel gives middleware a Node-style process.env; declared here so the build's type check knows it.
declare const process: { env: Record<string, string | undefined> };

export const config = { matcher: '/:path*' };

/** Compares in constant time, so response timing does not leak how much of a guess matched. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Past the password: the one page at / (Vercel serves index.html there); old /play links go to it. */
function route(request: Request): Response {
  const url = new URL(request.url);
  if (url.pathname === '/play' || url.pathname === '/play/') return Response.redirect(new URL('/' + url.search + '#play-area', url), 308);
  return next();
}

export default function middleware(request: Request) {
  const password = process.env.GAME_PASSWORD;
  if (!password) return new Response('Ringfall is closed: GAME_PASSWORD is not set on Vercel.', { status: 503 });

  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    let decoded = '';
    try { decoded = atob(auth.slice(6)); } catch { /* malformed header: treat as no password */ }
    const sep = decoded.indexOf(':');
    if (sep >= 0 && safeEqual(decoded.slice(sep + 1), password)) return route(request);
  }
  return new Response('Ringfall is private. Ask the team for the password.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Ringfall", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

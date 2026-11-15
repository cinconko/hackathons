// Vercel Routing Middleware. Ringfall is public: everything is one page (index.html: your name,
// the game, the story, the leaderboard, the odds), served at / by Vercel itself. This only sends
// old /play links to that page, at the game.
//
// (Until 2026-11-15 the whole site sat behind a password here, HTTP basic auth with the
// GAME_PASSWORD env var; see git history to bring it back.) Local `npm run dev` does not use this file.

export const config = { matcher: ['/play', '/play/'] };   // nothing else passes through here

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  return Response.redirect(new URL('/' + url.search + '#play-area', url), 308);
}

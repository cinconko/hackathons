export const config = { matcher: ['/play', '/play/'] };

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  return Response.redirect(new URL('/' + url.search + '#play-area', url), 308);
}

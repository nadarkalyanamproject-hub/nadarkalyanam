// Shared by main.ts (REST API) and realtime.gateway.ts (WebSocket) so
// CORS_ORIGIN's format only ever needs to be understood in one place.
// CORS_ORIGIN is a comma-separated list (one origin, e.g. the web app's
// URL, is still valid — a list of one). Passing the resulting array
// straight to `cors`/socket.io's `origin` option makes them do an exact
// match against the request's actual Origin header themselves; this never
// reflects an arbitrary origin back.
export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

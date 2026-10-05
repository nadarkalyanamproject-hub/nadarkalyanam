// api-client.ts's request() is a plain function, so it can't reach the
// React auth state directly. AdminAuthProvider subscribes here: a silent
// token refresh hands it the new tokens, and an ended session clears auth
// (useRequireAdminAuth then sends the admin to /login).
// Where the admin session (tokens + admin id) is kept.
export const ADMIN_AUTH_STORAGE_KEY = 'nadar-admin-auth';

type TokensListener = (tokens: { accessToken: string; refreshToken: string }) => void;

const tokenListeners = new Set<TokensListener>();
const expiredListeners = new Set<() => void>();

export function notifyTokensRefreshed(tokens: { accessToken: string; refreshToken: string }): void {
  tokenListeners.forEach((listener) => listener(tokens));
}

export function onTokensRefreshed(listener: TokensListener): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

export function notifySessionExpired(): void {
  expiredListeners.forEach((listener) => listener());
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

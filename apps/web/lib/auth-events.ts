// api-client.ts's request() is a plain function, not a React hook, so it
// can't call useRegistration() directly to clear stale auth state on a 401.
// This is the minimal bridge: request() notifies, RegistrationProvider
// (the one place that owns auth state) subscribes and reacts.
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyUnauthorized(): void {
  listeners.forEach((listener) => listener());
}

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Any deliberate "clear auth state" action (a 401, or a manual logout) is
// immediately followed by its own explicit navigation. But clearing auth
// state also flips data.accessToken (and, via clearAuth's full reset, every
// other draft field too) to undefined — and every mounted guard effect
// reacting to that same state (useRequireAuth's redirect-to-/register
// effect, or a page-local guard like additional-details' wizard-step check)
// independently notices in the very same commit and may fire its own
// competing redirect. Claiming here, synchronously before the state clear,
// lets each such guard recognize "this change is already being handled
// elsewhere" and skip its own redirect.
//
// More than one guard effect can be mounted on the same page and need to see
// the SAME claim for the SAME state change (e.g. useRequireAuth's effect and
// additional-details' own local guard both run on that one page) — so this
// is a plain read, not a read-that-clears: a "consume-on-first-read" flag
// would let whichever guard happens to run first silently swallow it before
// the second gets a look. It's released once, after every guard for this
// render has had its chance, by RegistrationProvider's own effect (see
// there) rather than by any individual consumer.
let authRedirectClaimed = false;

export function claimAuthRedirect(): void {
  authRedirectClaimed = true;
}

// Named for how every guard effect uses it ("has this already been handled
// elsewhere?") — it no longer clears itself on read, see the note above.
export function consumeAuthRedirectClaim(): boolean {
  return authRedirectClaimed;
}

export function releaseAuthRedirectClaim(): void {
  authRedirectClaimed = false;
}

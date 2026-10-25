'use client';

import { useEffect, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, getActiveSessions, logoutOtherDevices, requestLogoutOthersOtp } from '../../lib/api-client';
import { OTPInputGroup } from '../ui/otp-verify';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; active: number; notice?: string };

// Members stay signed in until they log out themselves. This card shows how
// many devices are signed in and ends every other one (for a lost phone, or
// a shared computer) after a code sent to the registered number, so someone
// holding a stolen signed-in device can't lock the owner out.
export function SignedInDevicesCard() {
  const { data } = useRegistration();
  const accessToken = data.accessToken;
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Set once a code has been sent: where to, and (in development) the code.
  const [codeSent, setCodeSent] = useState<{ sentTo: string; devOtp?: string } | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getActiveSessions(accessToken)
      .then((r) => {
        if (!cancelled) setState({ kind: 'loaded', active: r.activeSessions });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not load your devices.' });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleSendCode() {
    if (!accessToken) return;
    setWorking(true);
    setCodeError(null);
    try {
      const sent = await requestLogoutOthersOtp(accessToken);
      setCodeSent({ sentTo: sent.sentTo, devOtp: sent.devOtp });
      setCode('');
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : 'Could not send the code. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  async function handleLogoutOthers() {
    if (!accessToken || code.length !== 6) return;
    setWorking(true);
    setCodeError(null);
    try {
      const { loggedOut } = await logoutOtherDevices(accessToken, code);
      setState({
        kind: 'loaded',
        active: 1,
        notice: loggedOut === 0 ? 'No other devices were signed in.' : `Logged out of ${loggedOut} other ${loggedOut === 1 ? 'device' : 'devices'}.`,
      });
      closeCodePanel();
    } catch (err) {
      // A wrong or expired code keeps the panel open to try again.
      setCodeError(err instanceof ApiError ? err.message : 'Could not log out other devices. Please try again.');
      setCode('');
    } finally {
      setWorking(false);
    }
  }

  function closeCodePanel() {
    setCodeSent(null);
    setCode('');
    setCodeError(null);
  }

  const others = state.kind === 'loaded' ? Math.max(0, state.active - 1) : 0;

  return (
    <div className="rounded-2xl border border-nk-line bg-[#FFFFFF] p-6 shadow-sm" data-testid="signed-in-devices">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-nk-line bg-nk-cream text-nk-maroon">
          <MonitorSmartphone className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-nk-maroon">
            Signed-in devices
          </h2>
          <p className="mt-1 text-xs text-nk-muted">You stay signed in on this device until you log out.</p>
        </div>
      </div>

      {state.kind === 'loading' && <p className="mt-4 text-sm text-nk-muted">Loading…</p>}
      {state.kind === 'error' && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {state.kind === 'loaded' && (
        <>
          <p className="mt-4 text-sm text-nk-ink" data-testid="signed-in-count">
            {others === 0
              ? 'Only this device is signed in.'
              : `This device and ${others} other ${others === 1 ? 'device' : 'devices'} are signed in.`}
          </p>

          {state.notice && (
            <p role="status" className="mt-3 rounded-lg border border-nk-line bg-nk-cream px-3 py-2 text-xs font-medium text-nk-ink">
              {state.notice}
            </p>
          )}

          {others > 0 &&
            (codeSent ? (
              <div className="mt-4 rounded-xl border border-nk-line-strong bg-nk-ivory p-3" data-testid="logout-others-code">
                <p className="text-sm text-nk-ink">
                  Enter the 6-digit code sent to <span className="font-semibold">{codeSent.sentTo}</span> to log out of{' '}
                  {others === 1 ? 'the other device' : `all ${others} other devices`}. You&apos;ll stay signed in here.
                </p>
                {codeSent.devOtp && (
                  <p className="mt-1 text-xs text-nk-muted">
                    Dev mode code: <strong className="tracking-wider">{codeSent.devOtp}</strong>
                  </p>
                )}
                <OTPInputGroup value={code} onChange={setCode} disabled={working} hasError={Boolean(codeError)} autoFocus className="mt-3" />
                {codeError && (
                  <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                    {codeError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLogoutOthers()}
                    disabled={working || code.length !== 6}
                    className="rounded-lg bg-nk-maroon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-nk-maroon-deep disabled:opacity-60"
                  >
                    {working ? 'Please wait…' : 'Log them out'}
                  </button>
                  <button
                    type="button"
                    onClick={closeCodePanel}
                    disabled={working}
                    className="rounded-lg border border-nk-line px-4 py-2 text-sm font-semibold text-nk-ink hover:bg-nk-cream"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendCode()}
                    disabled={working}
                    className="ml-auto text-xs font-semibold text-nk-maroon underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    Send a new code
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={working}
                  className="mt-4 rounded-lg border border-nk-maroon px-4 py-2 text-sm font-semibold text-nk-maroon transition-colors hover:bg-nk-maroon hover:text-white disabled:opacity-60"
                  data-testid="logout-other-devices"
                >
                  {working ? 'Sending code…' : 'Log out of all other devices'}
                </button>
                {codeError && (
                  <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                    {codeError}
                  </p>
                )}
              </>
            ))}
        </>
      )}
    </div>
  );
}

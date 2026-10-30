'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PROFILE_FOR, PROFILE_FOR_LABELS } from '@nadar-kalyanam/schemas';
import { AuthenticatedHome } from '../components/home/authenticated-home';
import { useRegistration } from './providers/registration-provider';
import { ApiError, requestOtp, verifyOtp } from '../lib/api-client';
import { isValidLocalPhone, toE164 } from '../lib/phone';
import { OTPVerification } from '@/components/ui/otp-verify';
import { FounderMessage } from '@/components/landing/founder-message';
import { TrustStrip } from '@/components/landing/trust-strip';
import { Faq, FinalCta } from '@/components/landing/landing-sections';
import { Logo, LogoMark } from '@/components/brand/logo';
import './landing.css';

function IndiaFlag() {
  return (
    <svg viewBox="0 0 640 480" width="22" height="16" style={{ borderRadius: 2, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} aria-hidden="true">
      <path fill="#f93" d="M0 0h640v160H0z" />
      <path fill="#fff" d="M0 160h640v160H0z" />
      <path fill="#128807" d="M0 320h640v160H0z" />
      <circle cx="320" cy="240" r="60" fill="#000088" />
      <circle cx="320" cy="240" r="50" fill="#fff" />
      <circle cx="320" cy="240" r="14" fill="#000088" />
    </svg>
  );
}

const PROFILE_OPTIONS = PROFILE_FOR.map((key) => PROFILE_FOR_LABELS[key]);

function getNamePlaceholder(profileFor: string): string {
  switch (profileFor.toLowerCase()) {
    case 'son':
      return "Enter your son's name";
    case 'daughter':
      return "Enter your daughter's name";
    case 'brother':
      return "Enter your brother's name";
    case 'sister':
      return "Enter your sister's name";
    case 'relative':
      return "Enter your relative's name";
    case 'friend':
      return "Enter your friend's name";
    case 'myself':
      return 'Enter your full name';
    default:
      return 'Full name';
  }
}

function getNameErrorMsg(profileFor: string): string {
  switch (profileFor.toLowerCase()) {
    case 'son':
      return "Please enter your son's name";
    case 'daughter':
      return "Please enter your daughter's name";
    case 'brother':
      return "Please enter your brother's name";
    case 'sister':
      return "Please enter your sister's name";
    case 'relative':
      return "Please enter your relative's name";
    case 'friend':
      return "Please enter your friend's name";
    case 'myself':
      return 'Please enter your full name';
    default:
      return 'Please enter full name';
  }
}

// `returnTo` may only be one of this app's own paths, never another site.
function safeReturnTo(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : null;
}

function HomeContent() {
  const router = useRouter();
  const { data, hydrated, setPhoneNumber, setAuth } = useRegistration();
  // /?login=true (e.g. from Membership's Pay Now) opens the same login modal
  // as the Log In button; returnTo is where a successful login goes next.
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));


  const [profileForOpen, setProfileForOpen] = useState(false);
  const [profileFor, setProfileFor] = useState('');
  const [profileForError, setProfileForError] = useState(false);

  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('');
  const [genderError, setGenderError] = useState(false);

  const [fullName, setFullName] = useState('');
  const [fullNameError, setFullNameError] = useState(false);

  const [mobileNumber, setMobileNumber] = useState('');
  const [phoneError, setPhoneError] = useState(false);

  const [registerStep, setRegisterStep] = useState<'form' | 'otp'>('form');
  const [registerOtp, setRegisterOtp] = useState('');
  const [registerOtpError, setRegisterOtpError] = useState<string | undefined>();
  const [registerDevOtp, setRegisterDevOtp] = useState<string | undefined>();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(() => searchParams.get('login') === 'true');
  const [submitting, setSubmitting] = useState(false);

  const [loginStep, setLoginStep] = useState<'phone' | 'otp'>('phone');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPhoneError, setLoginPhoneError] = useState(false);
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpError, setLoginOtpError] = useState<string | undefined>();
  const [loginDevOtp, setLoginDevOtp] = useState<string | undefined>();
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [toast, setToast] = useState({ visible: false, title: '', msg: '', isError: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileForRef = useRef<HTMLDivElement>(null);
  // A login or register success already knows exactly where to go (based on
  // hasProfile) and navigates there itself. Without this, setAuth() below
  // re-renders this same page with a now-truthy accessToken and this page
  // would flash the authenticated dashboard for a tick before that
  // navigation completes. Shared by both flows — it only needs to become
  // true in the same batch as setAuth() fires, regardless of which one set
  // it; state (not a ref) because it's read during render, below.
  const [skipHomeRedirect, setSkipHomeRedirect] = useState(false);

  function showToast(title: string, msg: string, isError = false) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, title, msg, isError });
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 3500);
  }

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (profileForRef.current && !profileForRef.current.contains(e.target as Node)) {
        setProfileForOpen(false);
      }
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    let isValid = true;

    if (!profileFor) {
      setProfileForError(true);
      isValid = false;
    } else {
      setProfileForError(false);
    }

    const isMyself = profileFor.toLowerCase() === 'myself';
    if (isMyself && !gender) {
      setGenderError(true);
      isValid = false;
    } else {
      setGenderError(false);
    }

    if (!fullName.trim() || fullName.trim().length < 2) {
      setFullNameError(true);
      isValid = false;
    } else {
      setFullNameError(false);
    }

    if (!mobileNumber || mobileNumber.length < 10) {
      setPhoneError(true);
      isValid = false;
    } else {
      setPhoneError(false);
    }

    if (!isValid || !isValidLocalPhone(mobileNumber)) return;

    const phoneNumber = toE164(mobileNumber);
    setSubmitting(true);
    try {
      const { devOtp } = await requestOtp({ phoneNumber });

      let effectiveGender: 'MALE' | 'FEMALE' | undefined = undefined;
      const lowerProfileFor = profileFor.toLowerCase();
      if (lowerProfileFor === 'myself') {
        if (gender === 'MALE' || gender === 'FEMALE') effectiveGender = gender;
      } else if (lowerProfileFor === 'son' || lowerProfileFor === 'brother') {
        effectiveGender = 'MALE';
      } else if (lowerProfileFor === 'daughter' || lowerProfileFor === 'sister') {
        effectiveGender = 'FEMALE';
      }

      const profileForKey = PROFILE_FOR.find((key) => PROFILE_FOR_LABELS[key] === profileFor);
      setPhoneNumber(phoneNumber, fullName.trim(), effectiveGender, profileForKey);
      setRegisterDevOtp(devOtp);
      setRegisterStep('otp');
    } catch (error) {
      showToast(
        'Could not send OTP',
        error instanceof ApiError ? error.message : 'Please try again.',
        true,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetRegisterForm() {
    setRegisterStep('form');
    setRegisterOtp('');
    setRegisterOtpError(undefined);
    setRegisterDevOtp(undefined);
    setGender('');
    setGenderError(false);
    setSubmitting(false);
  }

  async function handleRegisterOtp(otpCode: string) {
    setRegisterOtpError(undefined);
    setSubmitting(true);
    try {
      const result = await verifyOtp({
        phoneNumber: toE164(mobileNumber),
        otp: otpCode,
        intent: 'register',
      });
      if (!result.user.hasProfile) {
        setSkipHomeRedirect(true);
      }
      setAuth({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.user.id,
        hasProfile: result.user.hasProfile,
      });
      resetRegisterForm();
      router.push(result.user.hasProfile ? '/' : '/onboarding/basic-details');
    } catch (error) {
      setSubmitting(false);
      setRegisterOtpError(
        error instanceof ApiError ? error.message : 'Could not verify OTP. Please try again.',
      );
    }
  }

  async function handleResendRegisterOtp() {
    try {
      const { devOtp } = await requestOtp({ phoneNumber: toE164(mobileNumber) });
      setRegisterDevOtp(devOtp);
      showToast('OTP Resent', `A new verification code has been sent to +91 ${mobileNumber}`);
    } catch (error) {
      showToast('Could not resend OTP', error instanceof ApiError ? error.message : 'Please try again', true);
    }
  }

  function closeAuthModal() {
    setAuthModalOpen(false);
    setLoginStep('phone');
    setLoginPhone('');
    setLoginPhoneError(false);
    setLoginOtp('');
    setLoginOtpError(undefined);
    setLoginDevOtp(undefined);
    setLoginSubmitting(false);
  }

  async function handleLoginPhoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidLocalPhone(loginPhone)) {
      setLoginPhoneError(true);
      return;
    }
    setLoginPhoneError(false);

    setLoginSubmitting(true);
    try {
      const { devOtp } = await requestOtp({ phoneNumber: toE164(loginPhone) });
      setLoginDevOtp(devOtp);
      setLoginStep('otp');
    } catch (error) {
      // The number itself was valid (checked above); show the API's reason
      // (e.g. too many requests) instead of an "invalid number" hint.
      showToast(
        'Could not send OTP',
        error instanceof ApiError ? error.message : 'Please try again.',
        true,
      );
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleLoginOtp(otpCode: string) {
    setLoginOtpError(undefined);
    setLoginSubmitting(true);
    try {
      const result = await verifyOtp({
        phoneNumber: toE164(loginPhone),
        otp: otpCode,
        intent: 'login',
      });
      // Admin accounts log in through this exact same phone/OTP flow — this
      // is the one place that can tell the two apart (isAdmin on the
      // response, not something the member web app should ever act on
      // beyond redirecting away). Deliberately does NOT call setAuth: an
      // admin-scoped token must never end up in this app's own auth state.
      if (result.user.isAdmin) {
        showToast('Redirecting to admin panel…', 'This account signs in through the admin app.');
        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';
        window.location.href = adminUrl;
        return;
      }
      if (!result.user.hasProfile || returnTo) {
        setSkipHomeRedirect(true);
      }
      setAuth({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.user.id,
        hasProfile: result.user.hasProfile,
      });
      closeAuthModal();
      showToast('Logged In', 'Welcome back to Nadar Kalyanam!');
      router.push(result.user.hasProfile ? (returnTo ?? '/') : '/onboarding/basic-details');
    } catch (error) {
      setLoginSubmitting(false);
      setLoginOtpError(
        error instanceof ApiError ? error.message : 'Could not verify OTP. Please try again.',
      );
    }
  }

  async function handleResendLoginOtp() {
    try {
      const { devOtp } = await requestOtp({ phoneNumber: toE164(loginPhone) });
      setLoginDevOtp(devOtp);
      showToast('OTP Resent', `A new verification code has been sent to +91 ${loginPhone}`);
    } catch (error) {
      showToast('Could not resend OTP', error instanceof ApiError ? error.message : 'Please try again', true);
    }
  }

  if (!hydrated) return null;

  // A login/register success already knows where to go (based on
  // hasProfile) and navigates there itself via its own router.push —
  // skipHomeRedirect avoids flashing the dashboard for the one tick
  // between setAuth() and that navigation completing.
  if (data.accessToken) {
    return skipHomeRedirect ? null : <AuthenticatedHome />;
  }

  return (
    <div className="nk-landing">
      {/* Main Navigation */}
      <nav className="main-navbar">
        <div className="nav-container">
          <a href="#hero" className="brand-logo" aria-label="Nadar Kalyanam Home">
            <Logo className="landing-logo" />
          </a>

          <ul className={`nav-menu${mobileMenuOpen ? ' open' : ''}`}>
            <li>
              <a href="#hero" className="nav-link active">
                Home
              </a>
            </li>
            <li>
              <a href="#trustSection" className="nav-link">
                Community
              </a>
            </li>
          </ul>

          <div className="nav-actions">
            <div className="nav-login-group">
              <span className="nav-login-prompt">Already a user?</span>
              <button className="btn btn-outline" type="button" onClick={() => setAuthModalOpen(true)}>
                Log In
              </button>
            </div>
            <button
              className="hamburger-btn"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="hero-section" id="hero">
        <div className="hero-bg-layer" />
        <div className="hero-bg-vignette" />
        <div className="hero-pattern-left" aria-hidden="true" />

        <div className="hero-container">
          <section className="hero-left-content">
            <h1 className="hero-heading">
              More Than Matches,
              <br />
              A Stronger Tomorrow
            </h1>
            <div className="ornament-divider">
              <svg viewBox="0 0 24 24" width="22" height="22" className="flourish-icon">
                <g fill="#8E1B24">
                  <path d="M12 2 C13 7 17 11 22 12 C17 13 13 17 12 22 C11 17 7 13 2 12 C7 11 11 7 12 2 Z" />
                  <circle cx="12" cy="12" r="2.5" fill="#FFC107" />
                </g>
              </svg>
            </div>
            <p className="hero-description">
              Nadar Kalyanam brings together like-minded individuals and families with shared values, culture and
              aspirations.
            </p>
          </section>

          <section className="hero-form-wrapper">
            <div className="reg-card">
              <div className="card-header">
                <div className="card-icon-emblem" aria-hidden="true">
                  <svg viewBox="0 0 36 36" width="36" height="36">
                    <g fill="#F59E0B">
                      <path d="M18 4 C17 10 14 13 8 14 C14 15 17 18 18 24 C19 18 22 15 28 14 C22 13 19 10 18 4 Z" />
                      <circle cx="18" cy="14" r="3.5" fill="#8E1B24" />
                      <circle cx="18" cy="14" r="1.8" fill="#FFD54F" />
                      <circle cx="12" cy="9" r="2.2" opacity="0.8" />
                      <circle cx="24" cy="9" r="2.2" opacity="0.8" />
                      <circle cx="12" cy="19" r="2.2" opacity="0.8" />
                      <circle cx="24" cy="19" r="2.2" opacity="0.8" />
                    </g>
                  </svg>
                </div>
                <h2 className="card-title">
                  {registerStep === 'form' ? 'Begin Your Journey' : 'Verify Your Number'}
                </h2>
                <p className="card-subtitle">
                  {registerStep === 'form'
                    ? 'Create your profile and find a match with shared values.'
                    : `Enter the 6-digit code sent to +91 ${mobileNumber}`}
                </p>
              </div>

              {registerStep === 'form' ? (
                <form className="reg-form" onSubmit={(e) => void handleRegisterSubmit(e)} noValidate>
                  <div className={`form-group custom-select-group${profileForError ? ' has-error' : ''}`}>
                    {profileFor && <span className="floating-label">Profile created for</span>}
                    <div
                      className={`custom-select-trigger${profileForOpen ? ' active' : ''}`}
                      ref={profileForRef}
                      tabIndex={0}
                      role="combobox"
                      aria-haspopup="listbox"
                      aria-expanded={profileForOpen}
                      aria-controls="profileOptions"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProfileForOpen((v) => !v);
                      }}
                    >
                      <div className="input-leading">
                        <svg
                          className="field-icon"
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span className={`selected-value${profileFor ? ' chosen' : ''}`}>
                          {profileFor || 'Profile created for'}
                        </span>
                      </div>
                      <svg
                        className="chevron-icon"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    <ul
                      id="profileOptions"
                      className={`custom-select-options${profileForOpen ? ' show' : ''}`}
                      role="listbox"
                    >
                      {PROFILE_OPTIONS.map((option) => (
                        <li
                          key={option}
                          role="option"
                          aria-selected={profileFor === option}
                          onClick={(e) => {
                            e.stopPropagation();
                            setProfileFor(option);
                            setProfileForError(false);
                            setProfileForOpen(false);
                            if (option.toLowerCase() !== 'myself') {
                              setGender('');
                              setGenderError(false);
                            }
                          }}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                    <span className="error-msg">Please select who this profile is for</span>
                  </div>

                  {profileFor.toLowerCase() === 'myself' && (
                    <div className={`form-group gender-select-group${genderError ? ' has-error' : ''}`}>
                      <div className="gender-header">
                        <span className="gender-prompt-label">Select Gender</span>
                      </div>
                      <div className="gender-toggle-group" role="radiogroup" aria-label="Gender">
                        <button
                          type="button"
                          className={`gender-chip${gender === 'MALE' ? ' active' : ''}`}
                          onClick={() => {
                            setGender('MALE');
                            setGenderError(false);
                          }}
                          role="radio"
                          aria-checked={gender === 'MALE'}
                        >
                          <span className="gender-radio-circle">
                            <span className="gender-radio-dot" />
                          </span>
                          <span className="gender-chip-text">Male</span>
                        </button>
                        <button
                          type="button"
                          className={`gender-chip${gender === 'FEMALE' ? ' active' : ''}`}
                          onClick={() => {
                            setGender('FEMALE');
                            setGenderError(false);
                          }}
                          role="radio"
                          aria-checked={gender === 'FEMALE'}
                        >
                          <span className="gender-radio-circle">
                            <span className="gender-radio-dot" />
                          </span>
                          <span className="gender-chip-text">Female</span>
                        </button>
                      </div>
                      <span className="error-msg">Please select male or female</span>
                    </div>
                  )}

                  <div className={`form-group${fullNameError ? ' has-error' : ''}`}>
                    <div className="input-wrapper">
                      <svg
                        className="field-icon"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={getNamePlaceholder(profileFor)}
                        autoComplete="name"
                        required
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (e.target.value.trim().length > 1) setFullNameError(false);
                        }}
                      />
                    </div>
                    <span className="error-msg">{getNameErrorMsg(profileFor)}</span>
                  </div>

                  <div className={`form-group${phoneError ? ' has-error' : ''}`}>
                    <div className="input-wrapper phone-wrapper">
                      <div className="country-picker" tabIndex={0}>
                        <span className="flag-icon" aria-hidden="true">
                          <svg
                            viewBox="0 0 640 480"
                            width="22"
                            height="16"
                            style={{ borderRadius: 2, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }}
                          >
                            <path fill="#f93" d="M0 0h640v160H0z" />
                            <path fill="#fff" d="M0 160h640v160H0z" />
                            <path fill="#128807" d="M0 320h640v160H0z" />
                            <circle cx="320" cy="240" r="60" fill="#000088" />
                            <circle cx="320" cy="240" r="50" fill="#fff" />
                            <circle cx="320" cy="240" r="14" fill="#000088" />
                          </svg>
                        </span>
                        <span className="dial-code">+91</span>
                        <svg
                          className="chevron-icon-sm"
                          viewBox="0 0 24 24"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>

                      <div className="phone-divider" />

                      <div className="phone-input-box">
                        <svg
                          className="field-icon phone-icon"
                          viewBox="0 0 24 24"
                          width="17"
                          height="17"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <input
                          type="tel"
                          className="form-input phone-field"
                          placeholder="Enter mobile number"
                          maxLength={10}
                          autoComplete="tel"
                          value={mobileNumber}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            setMobileNumber(digits);
                            if (digits.length === 10) setPhoneError(false);
                          }}
                        />
                      </div>
                    </div>
                    <span className="error-msg">Please enter a valid 10-digit mobile number</span>
                  </div>

                  <button className="btn-submit" type="submit" disabled={submitting}>
                    <span>{submitting ? 'Sending OTP...' : 'Register'}</span>
                    {!submitting && (
                      <svg
                        className="btn-arrow"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    )}
                  </button>

                  <p className="terms-text">
                    * By registering, you agree to our{' '}
                    <a href="#terms" className="legal-link">
                      Terms &amp; Conditions
                    </a>{' '}
                    and{' '}
                    <a href="#privacy" className="legal-link">
                      Privacy Policy
                    </a>
                    .
                  </p>
                </form>
              ) : (
                <OTPVerification
                  variant="embedded"
                  length={6}
                  emailOrPhone={`+91 ${mobileNumber}`}
                  devOtp={registerDevOtp}
                  error={registerOtpError}
                  isLoading={submitting}
                  buttonLabel="Verify & Register"
                  onVerify={handleRegisterOtp}
                  onResend={handleResendRegisterOtp}
                  onChangeNumber={resetRegisterForm}
                />
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Trust strip: tagline + the four promises */}
      <TrustStrip />

      <FounderMessage />
      <Faq />
      <FinalCta />

      {/* Toast Notification */}
      <div className={`toast-notification${toast.visible ? ' active' : ''}`} role="alert" aria-live="assertive">
        <div className={`toast-icon${toast.isError ? ' error' : ''}`}>{toast.isError ? '!' : '✓'}</div>
        <div className="toast-content">
          <span className="toast-title">{toast.title}</span>
          <span className="toast-msg">{toast.msg}</span>
        </div>
      </div>

      {/* Login modal: a brand panel beside the phone / code form */}
      <div className={`modal-overlay${authModalOpen ? ' active' : ''}`} aria-hidden={!authModalOpen}>
        <div className="modal-card login-card" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <button className="modal-close-btn" aria-label="Close" type="button" onClick={closeAuthModal}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <aside className="login-brand" aria-hidden="true">
            <LogoMark className="login-brand-mark" />
            <p className="login-brand-title">
              Welcome back to
              <br />
              Nadar Kalyanam
            </p>
            <ul className="login-brand-points">
              <li>Your matches and shortlist in one place</li>
              <li>See who sent you an interest</li>
              <li>Pick up conversations where you left off</li>
            </ul>
          </aside>

          <div className="login-body">
            <LogoMark className="login-mobile-mark" />
            <div className="modal-header">
              <h3 className="modal-title" id="login-title">
                {loginStep === 'phone' ? 'Log in' : 'Enter your code'}
              </h3>
              <p className="modal-sub">
                {loginStep === 'phone'
                  ? 'Use the mobile number you registered with.'
                  : `We sent a 6-digit code to +91 ${loginPhone}`}
              </p>
            </div>
            {loginStep === 'phone' ? (
              <>
                <form className="modal-form" onSubmit={(e) => void handleLoginPhoneSubmit(e)} noValidate>
                  <div className={`form-group${loginPhoneError ? ' has-error' : ''}`}>
                    <label htmlFor="login-phone" className="login-label">
                      Mobile number
                    </label>
                    <div className="input-wrapper phone-wrapper">
                      <div className="country-picker login-dial" aria-hidden="true">
                        <span className="flag-icon">
                          <IndiaFlag />
                        </span>
                        <span className="dial-code">+91</span>
                      </div>
                      <div className="phone-divider" />
                      <div className="phone-input-box">
                        <svg className="field-icon phone-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <input
                          id="login-phone"
                          type="tel"
                          className="form-input phone-field"
                          placeholder="10-digit mobile number"
                          inputMode="numeric"
                          maxLength={10}
                          autoComplete="tel-national"
                          required
                          value={loginPhone}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            setLoginPhone(digits);
                            if (digits.length === 10) setLoginPhoneError(false);
                          }}
                        />
                      </div>
                    </div>
                    <span className="error-msg">Please enter a valid 10-digit mobile number</span>
                  </div>
                  <p className="login-hint">We&apos;ll send a one-time code. No password needed.</p>
                  <button className="btn-submit" type="submit" disabled={loginSubmitting}>
                    <span>{loginSubmitting ? 'Sending code...' : 'Send code'}</span>
                    {!loginSubmitting && (
                      <svg className="btn-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    )}
                  </button>
                </form>
                <p className="login-switch">
                  New to Nadar Kalyanam?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      closeAuthModal();
                      document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Create a free profile
                  </button>
                </p>
              </>
            ) : (
              <OTPVerification
                variant="embedded"
                length={6}
                emailOrPhone={`+91 ${loginPhone}`}
                devOtp={loginDevOtp}
                error={loginOtpError}
                isLoading={loginSubmitting}
                buttonLabel="Verify & Log in"
                onVerify={handleLoginOtp}
                onResend={handleResendLoginOtp}
                onChangeNumber={() => setLoginStep('phone')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary; the page renders nothing until
// the stored session has loaded anyway, so the fallback is empty too.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

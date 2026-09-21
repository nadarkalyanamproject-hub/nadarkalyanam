'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useRegistration } from './providers/registration-provider';
import { isValidLocalPhone, toE164 } from '../lib/phone';
import { ApiError, requestOtp } from '../lib/api-client';
import './landing.css';

const PROFILE_OPTIONS = ['Myself', 'Son', 'Daughter', 'Brother', 'Sister', 'Relative', 'Friend'];
const LANG_OPTIONS = ['English', 'தமிழ் (Tamil)'];

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

export default function Home() {
  const router = useRouter();
  const { setPhoneNumber, setDevOtp } = useRegistration();

  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('English');

  const [profileForOpen, setProfileForOpen] = useState(false);
  const [profileFor, setProfileFor] = useState('');
  const [profileForError, setProfileForError] = useState(false);

  const [fullName, setFullName] = useState('');
  const [fullNameError, setFullNameError] = useState(false);

  const [mobileNumber, setMobileNumber] = useState('');
  const [phoneError, setPhoneError] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState({ visible: false, title: '', msg: '', isError: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const langSelectorRef = useRef<HTMLDivElement>(null);
  const profileForRef = useRef<HTMLDivElement>(null);

  function showToast(title: string, msg: string, isError = false) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, title, msg, isError });
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 3500);
  }

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (langSelectorRef.current && !langSelectorRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
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
      setPhoneNumber(phoneNumber, fullName.trim());
      setDevOtp(devOtp);
      router.push('/register/verify');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not send OTP. Please try again.';
      showToast('Error', message, true);
      setSubmitting(false);
    }
  }

  function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthModalOpen(false);
    showToast('Logged In', 'Welcome back to Nadar Kalyanam!');
  }

  return (
    <div className="nk-landing">
      {/* Top Announcement Bar */}
      <header className="top-bar">
        <div className="top-bar-container">
          <div className="top-bar-left">
            <span>Tradition</span>
            <span className="pipe">|</span>
            <span>Trust</span>
            <span className="pipe">|</span>
            <span>Together in Values</span>
          </div>
          <div className="top-bar-right">
            <div
              className={`lang-selector${langOpen ? ' open' : ''}`}
              ref={langSelectorRef}
              tabIndex={0}
              role="button"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              onClick={(e) => {
                e.stopPropagation();
                setProfileForOpen(false);
                setLangOpen((v) => !v);
              }}
            >
              <svg
                className="icon-globe"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className="lang-label">{currentLang}</span>
              <svg
                className="chevron-down"
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <ul className={`lang-dropdown${langOpen ? ' show' : ''}`} role="listbox">
                {LANG_OPTIONS.map((lang) => (
                  <li
                    key={lang}
                    role="option"
                    aria-selected={currentLang === lang}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentLang(lang);
                      setLangOpen(false);
                      showToast('Language Updated', `Switched interface language to ${lang}`);
                    }}
                  >
                    {lang}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </header>

      {/* Main Navigation */}
      <nav className="main-navbar">
        <div className="nav-container">
          <a href="#hero" className="brand-logo" aria-label="Nadar Kalyanam Home">
            <div className="logo-symbol">
              <svg viewBox="0 0 100 100" width="50" height="50" className="mandala-icon">
                <defs>
                  <linearGradient id="logoMaroon" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#A8242F" />
                    <stop offset="100%" stopColor="#6C1118" />
                  </linearGradient>
                  <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFE082" />
                    <stop offset="45%" stopColor="#FFC107" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="12" r="3" fill="url(#logoGold)" />
                <circle cx="50" cy="88" r="3" fill="url(#logoGold)" />
                <circle cx="12" cy="50" r="3" fill="url(#logoGold)" />
                <circle cx="88" cy="50" r="3" fill="url(#logoGold)" />
                <circle cx="23" cy="23" r="2.8" fill="url(#logoGold)" />
                <circle cx="77" cy="23" r="2.8" fill="url(#logoGold)" />
                <circle cx="23" cy="77" r="2.8" fill="url(#logoGold)" />
                <circle cx="77" cy="77" r="2.8" fill="url(#logoGold)" />

                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="url(#logoGold)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.65"
                />
                <circle cx="50" cy="50" r="38" fill="none" stroke="url(#logoMaroon)" strokeWidth="0.8" opacity="0.4" />

                <path d="M50 16 C43 28 44 38 50 44 C56 38 57 28 50 16 Z" fill="url(#logoMaroon)" />
                <path d="M50 84 C43 72 44 62 50 56 C56 62 57 72 50 84 Z" fill="url(#logoMaroon)" />
                <path d="M16 50 C28 43 38 44 44 50 C38 56 28 57 16 50 Z" fill="url(#logoMaroon)" />
                <path d="M84 50 C72 43 62 44 56 50 C62 56 72 57 84 50 Z" fill="url(#logoMaroon)" />

                <path d="M26 26 C36 34 42 41 46 46 C41 42 34 36 26 26 Z" fill="url(#logoMaroon)" />
                <path d="M74 26 C64 36 58 42 54 46 C58 41 64 34 74 26 Z" fill="url(#logoMaroon)" />
                <path d="M26 74 C36 64 42 58 46 54 C41 58 34 64 26 74 Z" fill="url(#logoMaroon)" />
                <path d="M74 74 C64 64 58 58 54 54 C58 59 64 64 74 74 Z" fill="url(#logoMaroon)" />

                <circle cx="50" cy="27" r="2.8" fill="url(#logoGold)" />
                <circle cx="50" cy="73" r="2.8" fill="url(#logoGold)" />
                <circle cx="27" cy="50" r="2.8" fill="url(#logoGold)" />
                <circle cx="73" cy="50" r="2.8" fill="url(#logoGold)" />
                <circle cx="34" cy="34" r="2.2" fill="url(#logoGold)" />
                <circle cx="66" cy="34" r="2.2" fill="url(#logoGold)" />
                <circle cx="34" cy="66" r="2.2" fill="url(#logoGold)" />
                <circle cx="66" cy="66" r="2.2" fill="url(#logoGold)" />

                <circle cx="50" cy="50" r="11" fill="url(#logoMaroon)" />
                <circle cx="50" cy="50" r="7.5" fill="url(#logoGold)" />
                <circle cx="50" cy="50" r="4" fill="#6C1118" />
                <circle cx="50" cy="50" r="1.8" fill="#FFFDE7" />
              </svg>
            </div>
            <div className="logo-text-group">
              <span className="brand-title">Nadar Kalyanam</span>
              <span className="brand-subtitle">Relationships Rooted in Values</span>
            </div>
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
              More Than
              <br />
              Matches,
              <br />
              A Stronger
              <br />
              Tomorrow
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
                <h2 className="card-title">Begin Your Journey</h2>
                <p className="card-subtitle">Create your profile and find a match with shared values.</p>
              </div>

              <form className="reg-form" onSubmit={handleRegisterSubmit} noValidate>
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
                      setLangOpen(false);
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
                        }}
                      >
                        {option}
                      </li>
                    ))}
                  </ul>
                  <span className="error-msg">Please select who this profile is for</span>
                </div>

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
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Trust & Statistics Bar */}
      <aside className="trust-stats-bar" id="trustSection">
        <div className="stats-watermark-right" aria-hidden="true" />

        <div className="trust-container">
          <div className="trust-item">
            <div className="trust-icon-box">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="#8E1B24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
            </div>
            <div className="trust-text">
              <h4 className="trust-value">100% Verified</h4>
              <p className="trust-sub">Genuine Family Profiles</p>
            </div>
          </div>

          <div className="trust-item">
            <div className="trust-icon-box">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="#8E1B24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div className="trust-text">
              <h4 className="trust-value">
                Meaningful
                <br />
                Matches
              </h4>
              <p className="trust-sub">Based on Shared Values</p>
            </div>
          </div>

          <div className="trust-item">
            <div className="trust-icon-box">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="#8E1B24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </div>
            <div className="trust-text">
              <h4 className="trust-value">Safe &amp; Secure</h4>
              <p className="trust-sub">Your Privacy Our Priority</p>
            </div>
          </div>

          <div className="trust-item">
            <div className="trust-icon-box">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="#8E1B24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <div className="trust-text">
              <h4 className="trust-value">Direct Connect</h4>
              <p className="trust-sub">Mutual Family Interest</p>
            </div>
          </div>

          <div className="trust-vertical-divider" aria-hidden="true" />

          <div className="trust-community-badge">
            <h4 className="badge-title">
              A Community
              <br />
              Connected by Values
            </h4>
            <div className="badge-flourish">
              <span className="flourish-line" />
              <svg viewBox="0 0 20 20" width="10" height="10" className="flourish-star">
                <path fill="#8E1B24" d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
              </svg>
              <span className="flourish-line" />
            </div>
          </div>
        </div>
      </aside>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-container">
          <span className="footer-brand">Nadar Kalyanam</span>
          <span className="footer-copy">&copy; 2026 Nadar Kalyanam. All rights reserved.</span>
          <div className="footer-links">
            <a href="#terms" className="legal-link">
              Terms &amp; Conditions
            </a>
            <span className="pipe">|</span>
            <a href="#privacy" className="legal-link">
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      <div className={`toast-notification${toast.visible ? ' active' : ''}`} role="alert" aria-live="assertive">
        <div className={`toast-icon${toast.isError ? ' error' : ''}`}>{toast.isError ? '!' : '✓'}</div>
        <div className="toast-content">
          <span className="toast-title">{toast.title}</span>
          <span className="toast-msg">{toast.msg}</span>
        </div>
      </div>

      {/* Login / Auth Modal */}
      <div className={`modal-overlay${authModalOpen ? ' active' : ''}`} aria-hidden={!authModalOpen}>
        <div className="modal-card">
          <button
            className="modal-close-btn"
            aria-label="Close modal"
            type="button"
            onClick={() => setAuthModalOpen(false)}
          >
            &times;
          </button>
          <div className="modal-header">
            <h3 className="modal-title">Welcome Back</h3>
            <p className="modal-sub">Login to your Nadar Kalyanam account</p>
          </div>
          <form className="modal-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <input type="text" className="form-input" placeholder="Mobile Number or Email" required />
            </div>
            <div className="form-group">
              <input type="password" className="form-input" placeholder="Password" required />
            </div>
            <button className="btn-submit" type="submit">
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

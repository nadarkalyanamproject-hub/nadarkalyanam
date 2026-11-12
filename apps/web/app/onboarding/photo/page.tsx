'use client';

import { Suspense, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Camera, CheckCircle2, ShieldCheck, Upload, X } from 'lucide-react';
import { Button } from '@nadar-kalyanam/ui';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';
import {
  ApiError,
  confirmPhotoUpload,
  getMyProfile,
  requestPhotoUploadUrl,
  uploadPhotoToStorage,
} from '../../../lib/api-client';
import { consumeAuthRedirectClaim } from '../../../lib/auth-events';
import { countActivePhotos, photoStepDecision, photoStepExit } from '../../../lib/post-profile';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Shown right after the success screen (/onboarding/photo?welcome=1). Also
// safe to open directly: no profile -> wizard, already has a photo -> moves
// on, otherwise the upload screen. A reload keeps the member here.
export default function OnboardingPhotoPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPhotoStep />
    </Suspense>
  );
}

function OnboardingPhotoStep() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const router = useRouter();
  const fromSignup = useSearchParams().get('welcome') === '1';
  const exitHref = photoStepExit(fromSignup);
  const [checked, setChecked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useRequireAuth skips its profile check under /onboarding, so this page
  // checks for itself: the member needs a profile, and one who already has a
  // photo isn't asked again.
  const accessToken = data.accessToken;
  useEffect(() => {
    if (!ready || !accessToken) return;
    let cancelled = false;
    getMyProfile(accessToken)
      .then((profile) => photoStepDecision({ profile: 'found', activePhotoCount: countActivePhotos(profile.photos), fromSignup }))
      .catch((err: unknown) => {
        if (consumeAuthRedirectClaim()) return null; // a 401 navigates itself
        const profile = err instanceof ApiError && err.status === 404 ? 'missing' : 'unknown';
        return photoStepDecision({ profile, activePhotoCount: 0, fromSignup });
      })
      .then((decision) => {
        if (cancelled || !decision) return;
        if (decision.action === 'redirect') router.replace(decision.to);
        else setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accessToken, fromSignup, router]);

  if (!ready || !checked) return null;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);

    if (!file) return;

    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG, or WEBP image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }

  function handleClearSelected() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleUploadAndProceed() {
    if (!selectedFile) {
      // If no photo selected yet, open file picker immediately
      fileInputRef.current?.click();
      return;
    }

    if (!data.accessToken) {
      router.replace(exitHref);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { uploadUrl, objectKey } = await requestPhotoUploadUrl(data.accessToken, selectedFile.type);
      await uploadPhotoToStorage(uploadUrl, selectedFile);
      await confirmPhotoUpload(data.accessToken, objectKey);
      setUploadSuccess(true);

      setTimeout(() => {
        router.replace(exitHref);
      }, 1000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload photo. Please try again or skip.');
      setUploading(false);
    }
  }

  function handleDoItLater() {
    router.replace(exitHref);
  }

  return (
    <main
      className="relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat px-4 py-8 md:py-12"
      style={{
        backgroundImage: "url('/assets/onboarding_bg.jpg')",
      }}
    >
      {/* Soft warm overlay to ensure high contrast and legibility */}
      <div className="fixed inset-0 bg-[#FFFDF8]/75 backdrop-blur-[0.5px] pointer-events-none" />

      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6">
        <div className="rounded-2xl border border-[#FFE082]/70 bg-white/95 p-6 md:p-8 shadow-xl backdrop-blur-sm">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#8e1b2412] text-nk-maroon">
              <Camera className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-nk-ink sm:text-3xl">
              Add Profile Photos
            </h1>
            <p className="mt-2 text-sm text-nk-muted sm:text-base">
              Profiles with photos receive up to <span className="font-semibold text-nk-maroon">5x more responses</span> and interest from families.
            </p>
          </div>

          {/* Photo Dropzone / Preview Area */}
          <div className="mt-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              data-testid="onboarding-photo-input"
            />

            {previewUrl ? (
              <div className="relative mx-auto flex max-w-xs flex-col items-center">
                <div className="relative h-64 w-64 overflow-hidden rounded-2xl border-2 border-[#eadbca] shadow-md">
                  <Image
                    src={previewUrl}
                    alt="Profile preview"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  {!uploading && (
                    <button
                      type="button"
                      onClick={handleClearSelected}
                      title="Remove photo"
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {uploadSuccess && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white backdrop-blur-xs">
                      <CheckCircle2 className="h-12 w-12 text-[#2e8a5f]" />
                      <span className="mt-2 text-sm font-semibold">Photo Uploaded!</span>
                    </div>
                  )}
                </div>

                {!uploading && !uploadSuccess && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2.5 text-xs font-semibold text-nk-maroon hover:underline"
                  >
                    Change photo
                  </button>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
                className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadbca] bg-[#FAF8F5] px-6 py-10 text-center transition-all duration-150 hover:border-nk-maroon hover:bg-[#8e1b2408]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-xs group-hover:scale-105 transition-transform text-[#8C7B7B] group-hover:text-nk-maroon">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-nk-ink">
                  Click to select a photo
                </p>
                <p className="mt-1 text-xs text-nk-muted">
                  JPEG, PNG, or WEBP up to 5 MB
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-center text-xs text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Quick tips */}
          <div className="mt-6 rounded-xl border border-[#eadbca]/70 bg-[#FAF8F5] p-3.5 text-xs text-nk-muted">
            <div className="flex items-center gap-1.5 font-semibold text-nk-ink">
              <ShieldCheck className="h-4 w-4 text-nk-maroon" />
              <span>Photo Guidelines</span>
            </div>
            <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-[11px] sm:text-xs">
              <li>Clear front-facing close-up or portrait photo.</li>
              <li>Good lighting, no sunglasses or group pictures.</li>
              <li>Photos are reviewed before becoming visible to members.</li>
            </ul>
          </div>

          {/* Two Action Buttons: Add Photos Now & Do It Later */}
          <div className="mt-8 flex flex-col gap-3">
            <Button
              type="button"
              size="lg"
              disabled={uploading || uploadSuccess}
              onClick={handleUploadAndProceed}
              className="w-full"
            >
              {uploading
                ? 'Uploading photo...'
                : uploadSuccess
                  ? 'Continuing...'
                  : selectedFile
                    ? 'Upload & Continue'
                    : 'Add Photos Now'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={uploading || uploadSuccess}
              onClick={handleDoItLater}
              className="w-full border-[#eadbca] text-nk-ink hover:bg-[#FAF8F5]"
            >
              Do It Later
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}


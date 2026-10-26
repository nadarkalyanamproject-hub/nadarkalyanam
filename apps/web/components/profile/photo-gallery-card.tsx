'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { ProfileResponse } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../../app/providers/registration-provider';
import {
  ApiError,
  confirmPhotoUpload,
  deletePhoto,
  requestPhotoUploadUrl,
  setPrimaryPhoto,
  uploadPhotoToStorage,
} from '../../lib/api-client';
import { PhotoLightbox } from '../photo-lightbox';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 5;

export function PhotoGalleryCard({
  profile,
  onChanged,
}: {
  profile: ProfileResponse;
  onChanged: () => void;
}) {
  const { data } = useRegistration();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);

  const photos = [...(profile.photos || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0];
  // Primary first, so it lands in the grid's large top-left block.
  const orderedPhotos = primaryPhoto ? [primaryPhoto, ...photos.filter((p) => p !== primaryPhoto)] : photos;
  const pendingCount = photos.filter((photo) => photo.status === 'PENDING').length;
  const rejected = photos.filter((photo) => photo.status === 'REJECTED');

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setActionError(undefined);

    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      setActionError('Please choose a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setActionError('Image must be smaller than 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const { uploadUrl, objectKey } = await requestPhotoUploadUrl(data.accessToken!, file.type);
      await uploadPhotoToStorage(uploadUrl, file);
      await confirmPhotoUpload(data.accessToken!, objectKey);
      onChanged();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Could not upload photo. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSetPrimary(photoId: string) {
    setActionError(undefined);
    setPendingPhotoId(photoId);
    try {
      await setPrimaryPhoto(data.accessToken!, photoId);
      onChanged();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not update primary photo.');
    } finally {
      setPendingPhotoId(null);
    }
  }

  async function handleDelete(photoId: string) {
    setActionError(undefined);
    setPendingPhotoId(photoId);
    try {
      await deletePhoto(data.accessToken!, photoId);
      onChanged();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not delete photo.');
    } finally {
      setPendingPhotoId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-nk-line bg-[#FFFFFF] p-5 sm:p-6 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_CONTENT_TYPES.join(',')}
        className="hidden"
        onChange={(e) => void handleFileSelected(e)}
      />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-nk-maroon">
            Profile Photos
          </h2>
          <p className="mt-0.5 text-xs text-nk-muted">A clear, recent photo of your face helps build trust.</p>
        </div>
        <span className="shrink-0 pt-1 text-xs font-semibold text-nk-muted" data-testid="photo-count">
          {photos.length} of {MAX_PHOTOS}
        </span>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-nk-maroon-bright">
          {actionError}
        </div>
      )}

      {/* Moderation hold: only approved photos are shown to other members. */}
      {pendingCount > 0 && (
        <p className="mb-3 rounded-lg border border-nk-line-gold bg-nk-cream p-2.5 text-xs text-nk-ink-soft" data-testid="photos-pending-note">
          {pendingCount === 1 ? '1 photo is' : `${pendingCount} photos are`} waiting for review. Other members will see{' '}
          {pendingCount === 1 ? 'it' : 'them'} once approved; until then only you can.
        </p>
      )}
      {rejected.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-nk-maroon-bright" data-testid="photos-rejected-note">
          {rejected.map((photo, index) => (
            <li key={photo.id}>
              Photo {photos.indexOf(photo) + 1} was not approved{photo.rejectionReason ? `: ${photo.rejectionReason}` : ''}. Other
              members can&apos;t see it{index === rejected.length - 1 ? ' — you can delete it and upload another.' : '.'}
            </li>
          ))}
        </ul>
      )}

      {/* Photo Gallery Grid: the primary photo takes a 2x2 block. */}
      <div className="grid grid-cols-3 gap-2.5">
        {orderedPhotos.map((photo) => {
          const isPrimary = photo === primaryPhoto;

          return (
            <div
              key={photo.id}
              onClick={() => setEnlargedPhotoUrl(photo.url)}
              className={`@container group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-[#FAF6EF] ${
                isPrimary ? 'col-span-2 row-span-2 ring-2 ring-nk-maroon ring-offset-2' : 'border border-nk-line'
              }`}
            >
              {/* Moderation status (owner-only view) */}
              {photo.status !== 'APPROVED' && (
                <span
                  data-testid="photo-status"
                  className={`absolute right-2 top-2 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm ${
                    photo.status === 'PENDING' ? 'bg-[#FFF2D6] text-[#7A4A00]' : 'bg-red-600/95 text-white'
                  }`}
                >
                  {photo.status === 'PENDING' ? 'Pending review' : 'Rejected'}
                </span>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={isPrimary ? 'Primary profile photo' : 'Profile photo'}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Primary caption: along the bottom edge, never over the face.
                  Gives way to the action buttons on hover. */}
              {isPrimary && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 transition-opacity duration-200 group-hover:opacity-0 [@media(hover:none)]:hidden">
                  <span className="text-[11px] font-semibold text-white">Primary photo</span>
                </div>
              )}

              {/* Overlay actions: shown on hover, and always on touch screens
                  (no hover there, so they'd otherwise be unreachable). Sized
                  against the tile's own width (container query). */}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/20 to-transparent p-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [@media(hover:none)]:opacity-100 @[140px]:p-2">
                <div className="flex flex-col gap-1 @[140px]:flex-row @[140px]:gap-1.5">
                  {!isPrimary && (
                    <button
                      type="button"
                      disabled={pendingPhotoId === photo.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSetPrimary(photo.id);
                      }}
                      className="flex-1 whitespace-nowrap rounded bg-nk-ivory/90 px-1.5 py-1 text-[10px] font-semibold text-nk-maroon backdrop-blur-sm transition-colors hover:bg-[#FFFFFF]"
                    >
                      Make Primary
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pendingPhotoId === photo.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDelete(photo.id);
                    }}
                    className="whitespace-nowrap rounded bg-red-600/90 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-red-700"
                    title="Delete photo"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* One add tile while there's room (no rows of empty placeholders). */}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            data-testid="add-photo"
            className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#D9C6A8] bg-nk-ivory p-2 text-center text-nk-maroon transition-colors hover:border-nk-maroon hover:bg-nk-cream disabled:cursor-wait disabled:opacity-60 ${
              photos.length === 0 ? 'col-span-3 aspect-auto py-10' : ''
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-xs font-semibold">{uploading ? 'Uploading…' : 'Add photo'}</span>
            {photos.length === 0 && (
              <span className="text-[11px] text-nk-subtle">JPG, PNG or WEBP, up to 5 MB</span>
            )}
          </button>
        )}
      </div>

      {enlargedPhotoUrl && (
        <PhotoLightbox url={enlargedPhotoUrl} onClose={() => setEnlargedPhotoUrl(null)} />
      )}
    </div>
  );
}

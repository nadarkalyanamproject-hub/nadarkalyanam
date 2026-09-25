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
  const emptySlotsCount = Math.max(0, MAX_PHOTOS - photos.length);

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
    <div className="rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] p-5 sm:p-6 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_CONTENT_TYPES.join(',')}
        className="hidden"
        onChange={(e) => void handleFileSelected(e)}
      />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-[#7A0710]">
            Profile Photos
          </h2>
          <p className="text-xs font-medium text-[#776B62]">
            Add up to 5 photos · A clear profile photo helps build trust.
          </p>
        </div>

        <button
          type="button"
          disabled={uploading || photos.length >= MAX_PHOTOS}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6A33A]/60 bg-[#FFF9ED] px-3 py-1.5 text-xs font-semibold text-[#7A0710] shadow-sm transition-all hover:bg-[#FBEED1] hover:border-[#D6A33A] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <span>Uploading…</span>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path d="M8 3v10M3 8h10" />
              </svg>
              <span>+ Add Photos</span>
            </>
          )}
        </button>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-[#94151C]">
          {actionError}
        </div>
      )}

      {/* Photo Gallery Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo) => {
          const isPrimary = photo.isPrimary || (!primaryPhoto && photo === photos[0]);

          return (
            <div
              key={photo.id}
              onClick={() => setEnlargedPhotoUrl(photo.url)}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-[#E8DCC8] bg-[#FAF6EF]"
            >
              {/* Primary Badge */}
              {isPrimary && (
                <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded bg-[#7A0710]/95 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#F2D58A] shadow-sm">
                  Primary
                </span>
              )}

              {/* Photo Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="Profile photo"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Overlay Actions on Hover */}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="flex gap-1.5">
                  {!isPrimary && (
                    <button
                      type="button"
                      disabled={pendingPhotoId === photo.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSetPrimary(photo.id);
                      }}
                      className="flex-1 rounded bg-[#FFFDF9]/90 px-1.5 py-1 text-[10px] font-semibold text-[#7A0710] backdrop-blur-sm transition-colors hover:bg-[#FFFFFF]"
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
                    className="rounded bg-red-600/90 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-red-700"
                    title="Delete photo"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty Photo Slots */}
        {Array.from({ length: emptySlotsCount }).map((_, index) => (
          <button
            key={`empty-${index}`}
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="group flex aspect-square flex-col items-center justify-center rounded-xl border-1.5 border-dashed border-[#E8DCC8] bg-[#FFFDF9] p-3 text-center transition-all hover:border-[#D6A33A] hover:bg-[#FFF9ED] disabled:opacity-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FAF6EF] text-[#7A0710] transition-transform group-hover:scale-110 group-hover:bg-[#FFF2D6]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span className="mt-2 text-xs font-semibold text-[#776B62] group-hover:text-[#7A0710]">
              Add Photo
            </span>
          </button>
        ))}
      </div>

      {enlargedPhotoUrl && (
        <PhotoLightbox url={enlargedPhotoUrl} onClose={() => setEnlargedPhotoUrl(null)} />
      )}
    </div>
  );
}

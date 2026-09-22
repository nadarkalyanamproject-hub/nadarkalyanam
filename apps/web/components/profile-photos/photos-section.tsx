'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { ProfileResponse } from '@nadar-kalyanam/schemas';
import { Button, Card, FormError } from '@nadar-kalyanam/ui';
import { useRegistration } from '../../app/providers/registration-provider';
import {
  ApiError,
  confirmPhotoUpload,
  deletePhoto,
  requestPhotoUploadUrl,
  setPrimaryPhoto,
  uploadPhotoToStorage,
} from '../../lib/api-client';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function PhotosSection({
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

  const photos = [...profile.photos].sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file again later
    if (!file) return;

    setActionError(undefined);

    // Client-side checks mirror the backend's — they save a round trip for
    // the common case, but the backend validates independently regardless
    // (content-type via requestUploadUrlSchema's enum).
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
    <Card className="rounded-2xl p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">Photos</h2>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_CONTENT_TYPES.join(',')}
            className="hidden"
            onChange={(e) => void handleFileSelected(e)}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading...' : 'Upload photo'}
          </Button>
        </div>
      </div>

      {actionError ? <FormError>{actionError}</FormError> : null}

      {photos.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No photos yet. Upload one to get started.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-lg border border-border bg-background"
            >
              <div className="relative aspect-square w-full">
                {photo.isPrimary && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    Primary
                  </span>
                )}
                {/* Uploaded photos live in MinIO, an arbitrary external
                    origin not registered with next/image — a plain <img>
                    is the simplest correct option here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Profile" className="h-full w-full object-cover" />
              </div>
              <div className="flex gap-1 p-2">
                {!photo.isPrimary && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={pendingPhotoId === photo.id}
                    onClick={() => void handleSetPrimary(photo.id)}
                  >
                    Set primary
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={pendingPhotoId === photo.id}
                  onClick={() => void handleDelete(photo.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

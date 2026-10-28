'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { ReasonDialog } from '../../components/billing-ui';
import {
  ApiError,
  approveQueuedPhoto,
  listPendingPhotos,
  rejectQueuedPhoto,
  type QueuedPhoto,
} from '../../lib/api-client';
import { useCurrentAdmin } from '../../lib/use-current-admin';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';

const PAGE_SIZE = 20;

export default function PhotosPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();

  const [offset, setOffset] = useState(0);
  const [photos, setPhotos] = useState<QueuedPhoto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectingPhoto, setRejectingPhoto] = useState<QueuedPhoto | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canModerate = can('photos.moderate');

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listPendingPhotos(data.accessToken, { offset, limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setPhotos(result.items);
          setTotal(result.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load pending photos.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, offset, reloadKey]);

  async function handleApprove(photo: QueuedPhoto) {
    if (!data.accessToken) return;
    setPendingId(photo.id);
    setError(undefined);
    setMessage(undefined);
    try {
      await approveQueuedPhoto(data.accessToken, photo.id);
      setMessage(`Photo for ${photo.memberName ?? photo.phoneNumber} approved.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve photo.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleReject(reason: string) {
    if (!data.accessToken || !rejectingPhoto) return;
    setPendingId(rejectingPhoto.id);
    setError(undefined);
    setMessage(undefined);
    try {
      await rejectQueuedPhoto(data.accessToken, rejectingPhoto.id, reason);
      setMessage(`Photo for ${rejectingPhoto.memberName ?? rejectingPhoto.phoneNumber} rejected.`);
      setRejectingPhoto(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject photo.');
      throw err;
    } finally {
      setPendingId(null);
    }
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Photo Moderation</h1>
          <p className="text-sm text-muted-foreground">
            Review member photos before they become visible to other members.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="rounded-lg bg-emerald-500/10 p-4 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-medium">
            {total} {total === 1 ? 'photo' : 'photos'} awaiting review
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={!ready}
          >
            Refresh
          </Button>
        </div>

        {!photos ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse p-4">
                <div className="aspect-square w-full rounded-md bg-muted" />
                <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
              </Card>
            ))}
          </div>
        ) : photos.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-base font-semibold text-foreground">No pending photos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              All member photos have been reviewed and moderated.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <Card key={photo.id} className="flex flex-col justify-between overflow-hidden p-4">
                <div>
                  <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.memberName ?? 'Member photo'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {photo.isPrimary && (
                      <span className="absolute top-2 left-2 rounded bg-amber-500/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/members/${photo.userId}`}
                      className="font-medium text-sm text-foreground hover:underline"
                    >
                      {photo.memberName ?? 'Unnamed Member'}
                    </Link>
                    <p className="text-xs text-muted-foreground">{photo.phoneNumber}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Uploaded {new Date(photo.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!canModerate || pendingId === photo.id}
                    onClick={() => void handleApprove(photo)}
                  >
                    {pendingId === photo.id ? 'Working…' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive hover:bg-destructive/10"
                    disabled={!canModerate || pendingId === photo.id}
                    onClick={() => setRejectingPhoto(photo)}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {rejectingPhoto && (
          <ReasonDialog
            title="Reject Photo"
            description={
              <span>
                Reject photo for{' '}
                <strong>{rejectingPhoto.memberName ?? rejectingPhoto.phoneNumber}</strong>. The photo
                will be hidden from other members and the reason will be displayed to the member.
              </span>
            }
            confirmLabel="Reject Photo"
            onConfirm={handleReject}
            onClose={() => setRejectingPhoto(null)}
          />
        )}
      </div>
    </AdminShell>
  );
}

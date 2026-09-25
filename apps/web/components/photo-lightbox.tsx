'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

// Reuses the exact same photo.url already used for the thumbnail — no
// separate URL is constructed and nothing is re-fetched.
export function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm transition-colors hover:bg-white"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Full size"
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

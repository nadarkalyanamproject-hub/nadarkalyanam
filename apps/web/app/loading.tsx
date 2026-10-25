import { LogoMark } from '../components/brand/logo';

// Shown while a page's server content streams in: the pendant with its inner
// borders drawing round and a soft breathing glow.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <LogoMark className="nk-loader h-16 w-auto" />
    </div>
  );
}

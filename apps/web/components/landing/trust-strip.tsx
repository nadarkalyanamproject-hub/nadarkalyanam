import { HeartHandshake, Lock, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// The trust strip under the landing hero: a short tagline, then the four
// promises the product actually keeps today (every one of these is built).
const POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: 'OTP Verified', text: 'Every mobile number confirmed' },
  { icon: HeartHandshake, title: 'Meaningful Matches', text: 'Based on shared values' },
  { icon: Lock, title: 'Safe & Secure', text: 'Your privacy, our priority' },
  { icon: Users, title: 'Direct Connect', text: 'Mutual family interest' },
];

export function TrustStrip() {
  return (
    <aside className="trust-strip" id="trustSection" aria-label="Why families trust Nadar Kalyanam">
      <div className="trust-strip-inner">
        <div className="trust-strip-tagline">
          <p className="trust-strip-eyebrow">Why families trust us</p>
          <h2 className="trust-strip-title">A community connected by values</h2>
          <span className="trust-strip-rule" aria-hidden="true" />
        </div>

        <ul className="trust-strip-points">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="trust-strip-point">
              <span className="trust-strip-icon" aria-hidden="true">
                <Icon strokeWidth={1.6} />
              </span>
              <span>
                <span className="trust-strip-point-title">{title}</span>
                <span className="trust-strip-point-text">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

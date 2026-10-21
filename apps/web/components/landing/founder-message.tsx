'use client';

import { motion } from 'motion/react';

// The founder's note on the public landing page. All of the copy lives here so
// it can be changed in one place. DRAFT: the name, photo and wording still
// need the founder's own words and approval before launch.
const FOUNDER = {
  // Shown under the signature; leave name null to sign as the role only.
  name: null as string | null,
  role: 'Founder, Nadar Kalyanam',
  // Path under /public, e.g. '/assets/founder.jpg'. null shows a monogram.
  photo: null as string | null,
  heading: 'Why we started Nadar Kalyanam',
  paragraphs: [
    'In our community, finding a life partner has always been a family affair. Parents, elders and relatives come together to look for someone who shares our values, our traditions and our way of life.',
    'Nadar Kalyanam carries that same care online. Every member signs in with a verified mobile number, families decide who sees their details, and a conversation starts only when both sides are interested.',
    'We built this for the Nadar community, by people from the community. Our hope is simple: that every family finds a match they are proud of, with the trust and respect our elders taught us.',
  ],
};

const REVEAL = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -80px 0px' },
} as const;

export function FounderMessage() {
  return (
    <section className="founder-section" id="founder" aria-labelledby="founder-heading" data-testid="founder-message">
      <div className="founder-inner">
        <motion.div className="founder-portrait" {...REVEAL} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <div className="founder-photo-ring">
            {FOUNDER.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={FOUNDER.photo} alt={FOUNDER.name ?? FOUNDER.role} className="founder-photo" />
            ) : (
              <div className="founder-monogram" aria-hidden="true">
                NK
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="founder-copy" {...REVEAL} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}>
          <p className="founder-eyebrow">A word from our founder</p>
          <h2 className="founder-heading" id="founder-heading">
            {FOUNDER.heading}
          </h2>
          <blockquote className="founder-quote">
            {FOUNDER.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </blockquote>
          <div className="founder-signature">
            <span className="founder-signature-line" aria-hidden="true" />
            <div>
              {FOUNDER.name && <p className="founder-name">{FOUNDER.name}</p>}
              <p className="founder-role">{FOUNDER.role}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

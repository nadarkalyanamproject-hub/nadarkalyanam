'use client';

import { motion } from 'motion/react';

// The landing page sections between the trust strip and the footer. Every
// line describes something the product does today: no member counts, no
// testimonials, no unbuilt features. DRAFT copy for the client's review.

const REVEAL = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -80px 0px' },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
} as const;

function SectionHeading({ id, eyebrow, title, intro }: { id: string; eyebrow: string; title: string; intro?: string }) {
  return (
    <motion.div className="lp-heading" {...REVEAL}>
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 className="lp-title" id={id}>
        {title}
      </h2>
      <span className="lp-rule" aria-hidden="true" />
      {intro && <p className="lp-intro">{intro}</p>}
    </motion.div>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can join Nadar Kalyanam?',
    a: 'Members of the Nadar community, Hindu or Christian. You can create the profile yourself, or a parent, brother, sister or relative can create it for you.',
  },
  {
    q: 'Is creating a profile free?',
    a: 'Yes. Registering and building your profile is free. To view and contact other members you need a membership plan, which you can choose any time from Membership plans.',
  },
  {
    q: 'Who can see my phone number?',
    a: 'Nobody, by default. You can choose to let members you are connected with (both sides accepted an interest) see it, and you can turn that off again any time.',
  },
  {
    q: 'How are photos checked?',
    a: 'Every photo you upload is reviewed by our team before other members can see it. Photos that don’t follow our guidelines are not shown.',
  },
  {
    q: 'Can I hide my profile for a while?',
    a: 'Yes. In My Profile you can hide your profile from browse, search and matches, and show it again whenever you are ready.',
  },
];

export function Faq() {
  return (
    <section className="lp-section lp-faq" id="faq" aria-labelledby="faq-heading">
      <div className="lp-inner lp-faq-grid">
        <div className="lp-faq-side">
          <SectionHeading id="faq-heading" eyebrow="Questions" title="Questions families ask" />
          <p className="lp-faq-help">
            Still have a question?{" "}
            <a href="/contact" className="lp-faq-link">
              Contact our team
            </a>
          </p>
        </div>
        <div className="lp-faq-list">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="lp-faq-item">
              <summary className="lp-faq-q">{q}</summary>
              <p className="lp-faq-a">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="lp-cta" aria-labelledby="cta-heading">
      <motion.div className="lp-cta-inner" {...REVEAL}>
        <div>
          <h2 className="lp-cta-title" id="cta-heading">
            Begin your journey today
          </h2>
          <p className="lp-cta-text">Create your profile in a few minutes. Your family’s match could be waiting.</p>
        </div>
        <a href="#hero" className="lp-cta-button">
          Create a free profile
        </a>
      </motion.div>
    </section>
  );
}

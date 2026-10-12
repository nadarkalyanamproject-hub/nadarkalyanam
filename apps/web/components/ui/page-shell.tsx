import type { ReactNode } from 'react';
import { BotanicalSprig } from '../search/partner-search-bar';

// The cream page with corner sprigs, a centred column and the icon + serif
// title header used by Matches and Search (the same look as Notifications
// and Interests).
export function PageShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-nk-paper px-4 py-6 text-nk-ink sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
      <BotanicalSprig className="pointer-events-none absolute -top-4 -right-4 z-0 h-44 w-44 text-[#C4A882] opacity-40 sm:h-64 sm:w-64" />
      <BotanicalSprig className="pointer-events-none absolute -bottom-4 -left-4 z-0 h-44 w-44 rotate-180 text-[#C4A882] opacity-35 sm:h-64 sm:w-64" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#F8D7DA] bg-[#FDF2F2] text-nk-maroon shadow-2xs sm:h-12 sm:w-12">
            {icon}
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-heading,serif)] text-2xl font-bold tracking-tight text-nk-ink sm:text-3xl">{title}</h1>
            <p className="mt-0.5 text-xs text-nk-muted sm:text-sm">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

// A titled white card: the container every section on these pages sits in.
export function SectionCard({
  title,
  action,
  children,
  testId,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-nk-line-gold/80 bg-white p-5 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)] sm:rounded-3xl sm:p-7"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-1 shrink-0 rounded-sm bg-nk-maroon" />
          <h2 className="text-sm font-bold tracking-tight text-nk-ink sm:text-base">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

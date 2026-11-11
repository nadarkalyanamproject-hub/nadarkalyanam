import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@nadar-kalyanam/ui';

// Page building blocks in the Techarnik ERP style. Every admin page uses the
// same header, figure tiles, section cards and empty/error/loading states so
// the panel reads as one product.

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
}) {
  return (
    <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < crumbs.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden="true" />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}

const statTones = {
  neutral: { icon: 'bg-muted text-ink-soft', value: 'text-foreground' },
  accent: { icon: 'bg-accent-soft text-primary', value: 'text-foreground' },
  good: { icon: 'bg-good-soft text-good', value: 'text-foreground' },
  warn: { icon: 'bg-warn-soft text-warn', value: 'text-warn' },
  bad: { icon: 'bg-bad-soft text-bad', value: 'text-bad' },
} as const;
export type StatTone = keyof typeof statTones;

// A key figure. Becomes a link with a hover lift when `href` is given.
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  href,
  className,
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  href?: string;
  className?: string;
  testId?: string;
}) {
  const t = statTones[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {icon && <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full [&>svg]:h-[18px] [&>svg]:w-[18px]', t.icon)}>{icon}</span>}
      </div>
      <div className="mt-4">
        <div className={cn('text-[28px] font-semibold leading-none tracking-tight tabular-nums', t.value)} data-testid={testId}>
          {value}
        </div>
        {hint && <div className="mt-2 text-[13px] text-muted-foreground">{hint}</div>}
      </div>
    </>
  );
  const base = 'flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-card p-5 shadow-sm';
  if (href) {
    return (
      <Link href={href} className={cn(base, 'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover', className)}>
        {body}
      </Link>
    );
  }
  return <div className={cn(base, className)}>{body}</div>;
}

// A titled card. `flush` drops the body padding for tables and lists.
export function SectionCard({
  title,
  description,
  actions,
  children,
  flush,
  className,
  testId,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-sm', className)} data-testid={testId}>
      {(title || actions) && (
        <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5', flush ? 'pb-4' : 'pb-1')}>
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-5 pt-4'}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-bad-soft px-4 py-3 text-[14px] leading-snug text-bad" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function LoadingCard({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-black/[0.06] bg-card px-5 py-12 text-[14px] text-muted-foreground shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

// Segmented control (iOS style), for small time-range or view switches.
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-8 items-center rounded-[10px] bg-black/[0.05] p-[3px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-full whitespace-nowrap rounded-[8px] px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
              active ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_3px_8px_rgba(0,0,0,0.08)]' : 'text-ink-soft hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const avatarPalette = [
  'bg-[#e8f1fc] text-[#0b5cab]',
  'bg-[#e9f7ee] text-[#19702f]',
  'bg-[#fff4e5] text-[#8a4a00]',
  'bg-[#f3e8fd] text-[#6b2bb5]',
  'bg-[#fdecee] text-[#a8001a]',
  'bg-[#e6f6f8] text-[#0b6d7a]',
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Initials circle; the colour comes from the name so it stays the same.
export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const dims = { sm: 'h-7 w-7 text-[11px]', md: 'h-8 w-8 text-xs', lg: 'h-12 w-12 text-base' }[size];
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 select-none place-items-center rounded-full font-semibold tracking-wide', dims, avatarPalette[hash % avatarPalette.length], className)}>
      {initialsOf(name)}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-black/[0.08] bg-card px-1.5 font-sans text-[11px] font-medium text-muted-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      {children}
    </kbd>
  );
}

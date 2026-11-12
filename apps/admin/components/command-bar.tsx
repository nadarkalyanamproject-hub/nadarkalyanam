'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CornerDownLeft, Loader2, Search, User } from 'lucide-react';
import { cn } from '@nadar-kalyanam/ui';
import { listMembers, type MemberSummary } from '../lib/api-client';
import { Kbd } from './ui/kit';

export const OPEN_COMMAND_BAR = 'nk-open-command-bar';
export const openCommandBar = () => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_BAR));

export interface CommandPage {
  href: string;
  label: string;
  group: string;
}

type Row = { kind: 'page'; page: CommandPage } | { kind: 'member'; member: MemberSummary };

// Ctrl K / Cmd K: jump to any page the admin can open, or find a member by
// name or phone and open their record.
export function CommandBar({ pages, accessToken, canSearchMembers }: { pages: CommandPage[]; accessToken: string | null; canSearchMembers: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ q: string; items: MemberSummary[] } | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Opening always starts from an empty search.
  useEffect(() => {
    const show = () => {
      setQuery('');
      setActive(0);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuery('');
        setActive(0);
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_BAR, show);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND_BAR, show);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  const q = query.trim();
  const wantsMembers = open && !!accessToken && canSearchMembers && q.length >= 2;
  useEffect(() => {
    if (!wantsMembers || !accessToken) return;
    let cancelled = false;
    const t = setTimeout(() => {
      listMembers(accessToken, { search: q, limit: 6 })
        .then((r) => !cancelled && setResult({ q, items: r.items }))
        .catch(() => !cancelled && setResult({ q, items: [] }));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [wantsMembers, q, accessToken]);
  const members = wantsMembers && result?.q === q ? result.items : [];
  const searching = wantsMembers && result?.q !== q;

  const rows: Row[] = (() => {
    const lower = q.toLowerCase();
    const matched = pages.filter((p) => !lower || p.label.toLowerCase().includes(lower) || p.group.toLowerCase().includes(lower));
    return [...members.map((m) => ({ kind: 'member' as const, member: m })), ...matched.map((p) => ({ kind: 'page' as const, page: p }))];
  })();
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));

  function go(row: Row | undefined) {
    if (!row) return;
    setOpen(false);
    router.push(row.kind === 'page' ? row.page.href : `/members/${row.member.id}`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-[18px] border border-black/[0.06] bg-card/95 shadow-pop backdrop-blur-xl animate-pop-in">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            data-bare
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(Math.min(activeIndex + 1, rows.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(Math.max(activeIndex - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(rows[activeIndex]);
              }
            }}
            placeholder={canSearchMembers ? 'Search pages, or a member by name or phone' : 'Search pages'}
            className="h-14 w-full bg-transparent text-[16px] text-foreground outline-none placeholder:text-faint focus-visible:outline-none"
            aria-label="Search"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
        </div>
        <ul className="thin-scroll max-h-[50vh] overflow-y-auto p-1.5">
          {rows.length === 0 && <li className="px-3 py-8 text-center text-[14px] text-muted-foreground">Nothing found for &ldquo;{q}&rdquo;.</li>}
          {rows.map((row, i) => {
            const isActive = i === activeIndex;
            const firstMember = row.kind === 'member' && i === 0;
            const firstPage = row.kind === 'page' && (i === 0 || rows[i - 1]!.kind === 'member');
            return (
              <li key={row.kind === 'page' ? row.page.href : row.member.id}>
                {(firstMember || firstPage) && (
                  <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">{row.kind === 'member' ? 'Members' : 'Go to'}</p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(row)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', isActive ? 'bg-black/[0.05]' : '')}
                >
                  {row.kind === 'member' ? (
                    <>
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-foreground">{row.member.fullName ?? 'No profile yet'}</span>
                        <span className="block text-[12px] text-muted-foreground">{row.member.phoneNumber}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{row.page.label}</span>
                      <span className="text-[12px] text-faint">{row.page.group}</span>
                    </>
                  )}
                  {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-faint" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd> open
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

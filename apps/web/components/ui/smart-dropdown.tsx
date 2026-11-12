'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ChevronDown, Search, X } from 'lucide-react';
import { computeDropdownPlacement, estimateDropdownHeight } from '../../lib/dropdown-placement';

export interface SmartDropdownOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface SmartDropdownProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (string | SmartDropdownOption)[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  'aria-label'?: string;
}

// Visual reference: the landing page's "Profile created for" select
// (app/landing.css .custom-select-*). Same border, radius, warm focus ring,
// chevron, panel shadow, row padding and maroon hover. Height is 44px (h-11)
// rather than the landing's 46px so it lines up with the shared <Input>
// fields it sits next to in the onboarding and profile forms.
const GAP = 4;
const ROW_HEIGHT = 37;
const LIST_MAX_HEIGHT = 210;
const SEARCH_HEIGHT = 50;
const TYPEAHEAD_RESET_MS = 600;

interface PanelPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export function SmartDropdown({
  id: explicitId,
  name,
  value,
  onChange,
  options: rawOptions,
  placeholder = 'Select option...',
  invalid = false,
  disabled = false,
  className = '',
  searchable = false,
  searchPlaceholder = 'Search...',
  'aria-label': ariaLabel,
}: SmartDropdownProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  // Open state remembers the route it was opened on, so a route change
  // closes the panel without an effect.
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const isOpen = openPath !== null && openPath === pathname && !disabled;

  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef<{ text: string; timer: number | undefined }>({ text: '', timer: undefined });

  const normalizedOptions: SmartDropdownOption[] = useMemo(
    () => rawOptions.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt)),
    [rawOptions],
  );

  // A saved value that is no longer in the list still shows (never lost).
  const allOptions: SmartDropdownOption[] = useMemo(() => {
    if (value && !normalizedOptions.some((opt) => opt.value === value)) {
      return [{ value, label: value }, ...normalizedOptions];
    }
    return normalizedOptions;
  }, [value, normalizedOptions]);

  const filterOptions = useCallback(
    (query: string) => {
      const q = query.toLowerCase().trim();
      if (!searchable || !q) return allOptions;
      return allOptions.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          opt.value.toLowerCase().includes(q) ||
          opt.badge?.toLowerCase().includes(q),
      );
    },
    [allOptions, searchable],
  );

  const filteredOptions = useMemo(() => filterOptions(search), [filterOptions, search]);
  const selectedOption = allOptions.find((opt) => opt.value === value);
  const hasValue = Boolean(selectedOption && selectedOption.value !== '');

  // Measure the trigger against the visible viewport and place the panel on
  // the side with room, clamped to it. visualViewport excludes the mobile
  // keyboard; position: fixed and getBoundingClientRect share coordinates.
  const measure = useCallback(
    (optionCount: number): PanelPosition | null => {
      const trigger = triggerRef.current;
      if (!trigger) return null;
      const rect = trigger.getBoundingClientRect();
      const vv = window.visualViewport;
      const placement = computeDropdownPlacement({
        triggerTop: rect.top,
        triggerBottom: rect.bottom,
        viewportTop: vv ? vv.offsetTop : 0,
        viewportHeight: vv ? vv.height : window.innerHeight,
        desiredHeight: estimateDropdownHeight({
          optionCount,
          searchable,
          rowHeight: ROW_HEIGHT,
          listMaxHeight: LIST_MAX_HEIGHT,
          searchHeight: SEARCH_HEIGHT,
        }),
        gap: GAP,
      });
      const layoutHeight = document.documentElement.clientHeight;
      return {
        left: rect.left,
        width: rect.width,
        maxHeight: placement.maxHeight,
        ...(placement.side === 'bottom'
          ? { top: rect.bottom + GAP }
          : { bottom: layoutHeight - rect.top + GAP }),
      };
    },
    [searchable],
  );

  const open = useCallback(
    (initialSearch = '') => {
      if (disabled) return;
      const list = filterOptions(initialSearch);
      const selectedIdx = list.findIndex((opt) => opt.value === value);
      setSearch(initialSearch);
      setHighlightedIndex(initialSearch ? 0 : Math.max(0, selectedIdx));
      setPosition(measure(list.length));
      setOpenPath(pathname);
    },
    [disabled, filterOptions, measure, pathname, value],
  );

  const close = useCallback((returnFocus: boolean) => {
    setOpenPath(null);
    setSearch('');
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  function select(val: string) {
    onChange(val);
    close(true);
  }

  // Keep the panel attached to the trigger while anything scrolls (capture:
  // the onboarding card, a modal, the page) or the viewport/keyboard resizes.
  const filteredCount = filteredOptions.length;
  useEffect(() => {
    if (!isOpen) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPosition(measure(filteredCount)));
    };
    const vv = window.visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, [isOpen, measure, filteredCount]);

  // Outside click/tap closes. The panel lives in a portal, so check it too.
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen && searchable) searchInputRef.current?.focus({ preventScroll: true });
  }, [isOpen, searchable]);

  // Keep the highlighted option visible inside the list (scrolls the list
  // only, never the page).
  useEffect(() => {
    const list = listRef.current;
    if (!isOpen || !list) return;
    const el = list.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    if (!el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
    }
  }, [highlightedIndex, isOpen, position]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  // Type-to-find for lists without a search box: jumps to the first option
  // starting with what was typed in the last moment.
  function typeaheadIndex(char: string): number {
    const state = typeahead.current;
    window.clearTimeout(state.timer);
    state.text += char.toLowerCase();
    state.timer = window.setTimeout(() => (state.text = ''), TYPEAHEAD_RESET_MS);
    const idx = filteredOptions.findIndex((opt) => opt.label.toLowerCase().startsWith(state.text));
    return idx;
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    const inSearch = event.target === searchInputRef.current;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        open();
      } else if (isPrintable) {
        event.preventDefault();
        if (searchable) {
          open(event.key);
        } else {
          open();
          const idx = typeaheadIndex(event.key);
          if (idx >= 0) setHighlightedIndex(idx);
        }
      }
      return;
    }

    const count = filteredOptions.length;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // don't also close a surrounding modal
        close(true);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (count) setHighlightedIndex((prev) => (prev + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) setHighlightedIndex((prev) => (prev - 1 + count) % count);
        break;
      case 'Home':
      case 'End':
        if (inSearch) break;
        event.preventDefault();
        if (count) setHighlightedIndex(event.key === 'Home' ? 0 : count - 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredOptions[highlightedIndex]) select(filteredOptions[highlightedIndex].value);
        break;
      case ' ':
        if (inSearch) break; // typing a space in the search box
        event.preventDefault();
        if (filteredOptions[highlightedIndex]) select(filteredOptions[highlightedIndex].value);
        break;
      case 'Tab':
        // The panel is at the end of <body>: move focus back to the trigger
        // first so Tab continues to the next field, not the page end.
        close(true);
        break;
      default:
        if (isPrintable && !inSearch && !searchable) {
          const idx = typeaheadIndex(event.key);
          if (idx >= 0) setHighlightedIndex(idx);
        }
    }
  }

  const triggerState = disabled
    ? 'cursor-not-allowed border-[#EADBCA] bg-[#F9F7F5] opacity-60'
    : invalid
      ? 'cursor-pointer border-[#C22020] bg-white shadow-[0_0_0_2px_rgba(194,32,32,0.1)]'
      : isOpen
        ? 'cursor-pointer border-[#A58E80] bg-white shadow-[0_0_0_3px_rgba(165,142,128,0.14)]'
        : 'cursor-pointer border-[#EADBCA] bg-white hover:border-[#D3C1B1] focus-visible:border-[#A58E80] focus-visible:shadow-[0_0_0_3px_rgba(165,142,128,0.14)]';

  const panel =
    isOpen && position ? (
      <div
        ref={panelRef}
        data-nk-dropdown-panel=""
        style={{
          position: 'fixed',
          left: position.left,
          width: position.width,
          top: position.top,
          bottom: position.bottom,
          maxHeight: position.maxHeight,
        }}
        className="z-[1000] flex min-w-[8rem] flex-col overflow-hidden rounded-lg border border-[#EADBCA] bg-white py-1 text-left shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
        // Keeps clicks inside the panel from blurring the field.
        onMouseDown={(e) => {
          if (e.target !== searchInputRef.current) e.preventDefault();
        }}
      >
        {searchable && (
          <div className="shrink-0 border-b border-[#EADBCA]/70 px-2 pb-1.5 pt-0.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C7B7B]" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                role="searchbox"
                aria-label={searchPlaceholder}
                aria-controls={listboxId}
                aria-activedescendant={filteredOptions[highlightedIndex] ? optionId(highlightedIndex) : undefined}
                autoComplete="off"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                  setPosition(measure(filterOptions(e.target.value).length));
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-[#EADBCA] bg-white pl-8 pr-8 text-[0.88rem] text-nk-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-nk-subtle focus:border-[#A58E80] focus:shadow-[0_0_0_3px_rgba(165,142,128,0.14)]"
              />
              {search && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch('');
                    setHighlightedIndex(0);
                    setPosition(measure(allOptions.length));
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8C7B7B] hover:text-nk-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabel ? undefined : id}
          aria-label={ariaLabel}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ maxHeight: LIST_MAX_HEIGHT }}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3.5 py-2 text-center text-[0.84rem] text-nk-subtle">No matches</div>
          ) : (
            filteredOptions.map((opt, index) => {
              const isSelected = value === opt.value;
              const isHighlighted = index === highlightedIndex;
              return (
                <div
                  key={opt.value || `empty-${index}`}
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => select(opt.value)}
                  onMouseMove={() => {
                    if (!isHighlighted) setHighlightedIndex(index);
                  }}
                  className={`flex cursor-pointer items-center justify-between px-3.5 py-2 text-[0.88rem] transition-colors duration-200 ${
                    isHighlighted
                      ? 'bg-[rgba(142,27,36,0.07)] font-semibold text-[#8E1B24]'
                      : isSelected
                        ? 'font-semibold text-[#8E1B24]'
                        : 'text-nk-ink'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.badge && <span className="ml-2 shrink-0 text-xs font-normal text-nk-subtle">{opt.badge}</span>}
                </div>
              );
            })
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} onKeyDown={handleKeyDown}>
      {/* Hidden input for HTML form submission compatibility */}
      <input type="hidden" name={name || id} value={value} />

      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        disabled={disabled}
        onClick={() => (isOpen ? close(true) : open())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && !searchable && filteredOptions[highlightedIndex] ? optionId(highlightedIndex) : undefined}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border px-3.5 text-left text-[0.9rem] outline-none transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${triggerState}`}
      >
        <span className={`truncate ${hasValue ? 'font-semibold text-nk-ink' : 'font-normal text-nk-subtle'}`}>
          {hasValue ? selectedOption?.label : placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={2}
          className={`h-4 w-4 shrink-0 text-[#8C7B7B] transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  );
}

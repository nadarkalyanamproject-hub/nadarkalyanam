'use client';

// Copied from apps/web/components/ui/otp-verify.tsx's OTPInputGroup — kept as a
// standalone duplicate rather than a shared package because it's a single
// self-contained component and the two apps' login pages otherwise share no UI.
import { useRef, useEffect } from 'react';

export interface OTPInputGroupProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function OTPInputGroup({
  value,
  onChange,
  length = 6,
  disabled = false,
  hasError = false,
  autoFocus = true,
  className = '',
}: OTPInputGroupProps) {
  const digits = Array.from({ length }, (_, i) => value[i] || '');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanVal = rawVal.replace(/\D/g, '');

    if (cleanVal.length > 1) {
      const chars = cleanVal.slice(0, length);
      const newChars = Array.from({ length }, (_, i) => {
        if (i < index) return value[i] || '';
        const charFromPaste = chars[i - index];
        return charFromPaste !== undefined ? charFromPaste : value[i] || '';
      });
      const nextVal = newChars.join('');
      onChange(nextVal);
      const nextFocus = Math.min(index + cleanVal.length, length - 1);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const newChars = [...digits];
    newChars[index] = cleanVal;
    const nextVal = newChars.join('');
    onChange(nextVal);

    if (cleanVal && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newChars = [...digits];
        newChars[index - 1] = '';
        onChange(newChars.join(''));
      } else {
        const newChars = [...digits];
        newChars[index] = '';
        onChange(newChars.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const targetIdx = Math.min(pasted.length, length - 1);
    inputRefs.current[targetIdx]?.focus();
  };

  return (
    <div className={`flex items-center justify-center gap-2 sm:gap-2.5 ${className}`}>
      {Array.from({ length }).map((_, index) => {
        const char = digits[index] || '';
        const isFilled = Boolean(char);

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            disabled={disabled}
            value={char}
            autoComplete="one-time-code"
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`
              w-10 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl transition-all duration-200 outline-none
              bg-[#FFFDF8] text-[#2B1515] border border-[#EADBCA]
              focus:border-[#8E1B24] focus:ring-2 focus:ring-[#F59E0B]/40 focus:bg-white shadow-sm
              ${hasError ? '!border-[#C22020] !bg-red-50/50 !text-[#C22020] focus:!ring-red-200' : ''}
              ${isFilled && !hasError ? 'border-[#8E1B24] bg-white text-[#8E1B24]' : ''}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            aria-label={`Digit ${index + 1} of ${length}`}
          />
        );
      })}
    </div>
  );
}

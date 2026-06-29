'use client';

import React, { useRef, useEffect } from 'react';
import clsx from 'clsx';

interface Props {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export default function OTPInput({ value, onChange, disabled, error }: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').slice(0, 6);

  useEffect(() => {
    // Auto-focus first empty slot
    const firstEmpty = digits.length < 6 ? digits.length : 5;
    inputs.current[firstEmpty]?.focus();
  }, []);

  function handleChange(index: number, char: string) {
    const digit = char.replace(/\D/g, '').slice(-1);
    const arr = [...digits];
    arr[index] = digit;
    // Pad with empty
    const next = arr.join('').padEnd(6, '').slice(0, 6);
    onChange(next.trimEnd()); // trim trailing spaces
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputs.current[index - 1]?.focus();
        const arr = [...digits];
        arr[index - 1] = '';
        onChange(arr.join('').trimEnd());
      } else {
        const arr = [...digits];
        arr[index] = '';
        onChange(arr.join('').trimEnd());
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    inputs.current[focusIdx]?.focus();
  }

  return (
    <div className="flex gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={clsx(
            'w-11 h-12 text-center text-xl font-bold rounded-lg border-2 transition-all',
            'bg-gray-800 text-gray-100',
            'focus:outline-none focus:scale-105',
            error
              ? 'border-red-500 focus:border-red-400'
              : digits[i]
              ? 'border-brand-500 focus:border-brand-400'
              : 'border-gray-600 focus:border-brand-500',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      ))}
    </div>
  );
}

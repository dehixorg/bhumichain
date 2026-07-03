'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}

export default function AadhaarInput({ value, onChange, disabled, error, placeholder }: Props) {
  const [show, setShow] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
    onChange(digits);
  }

  // Display: XXXX-XXXX-1234 (mask all but last 4 when hidden)
  function displayValue(): string {
    if (!value) return '';
    const digits = value.padEnd(12, ' ');
    if (show) {
      return [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)]
        .join('-')
        .trimEnd();
    }
    const visible = value.slice(-4);
    return 'XXXX-XXXX-' + visible.padEnd(4, '_');
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={displayValue()}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder || 'XXXX-XXXX-XXXX'}
        className={clsx(
          'w-full pr-10 px-4 py-3 rounded-xl border-2 bg-gray-800 text-white',
          'font-mono text-base tracking-widest placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          error ? 'border-red-500' : 'border-gray-600',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

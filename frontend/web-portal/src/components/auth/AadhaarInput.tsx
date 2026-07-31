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
  const [show, setShow] = useState(true);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
    onChange(digits);
  }

  // Display: 1234-5678-9012 (or XXXX-XXXX-1234 when toggled hidden)
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
        placeholder={placeholder || '1234-5678-9012'}
        className={clsx(
          'w-full pr-10 px-4 py-3 rounded-xl border-2 bg-white text-gray-900',
          'font-mono text-base tracking-widest placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]',
          error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

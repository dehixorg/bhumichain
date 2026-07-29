'use client';

import React from 'react';

/**
 * PageShell — wraps any authenticated page in the standard
 * white government-portal layout (Sidebar + scrollable main area).
 */
interface PageShellProps {
  children: React.ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {children}
      </div>
    </main>
  );
}

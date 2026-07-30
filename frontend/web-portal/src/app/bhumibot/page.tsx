'use client';

import React, { useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import BhumiBotUI from '@/components/dashboard/BhumiBotUI';
import { getDemoToken } from '@/lib/api';

export default function BhumiBotPage() {
  useEffect(() => {
    getDemoToken('citizen', 'Demo Citizen').catch(() => {});
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex min-w-0 h-full overflow-hidden">
        <BhumiBotUI className="h-full w-full rounded-none border-none shadow-none" />
      </div>
    </div>
  );
}

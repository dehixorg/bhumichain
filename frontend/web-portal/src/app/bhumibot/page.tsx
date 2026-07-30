'use client';

import React, { useEffect } from 'react';
import BhumiBotUI from '@/components/dashboard/BhumiBotUI';
import { getDemoToken } from '@/lib/api';

export default function BhumiBotPage() {
  useEffect(() => {
    getDemoToken('citizen', 'Demo Citizen').catch(() => {});
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      <BhumiBotUI className="h-full w-full rounded-none border-none shadow-none" />
    </div>
  );
}
